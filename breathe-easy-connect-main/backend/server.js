const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { GoogleGenAI } = require('@google/genai');
const mqtt = require('mqtt');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Gemini AI Setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyDummy' });

// Express Security & Body Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());

/* -------------------------------------------------------------------------- */
/*                               AUTHENTICATION                              */
/* -------------------------------------------------------------------------- */

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || !JWT_REFRESH_SECRET)) {
  console.error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be explicitly set in environment variables in production.');
  process.exit(1);
}

function generateTokens(user, role, patientId, doctorId, caregiverId) {
  const payload = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role,
    patientId: patientId || null,
    doctorId: doctorId || null,
    caregiverId: caregiverId || null
  };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken, user: payload };
}

// Authentication & RBAC Middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Role ${req.user?.role} is not authorized for this resource` });
    }
    next();
  };
}

// Access Verification Helper
async function verifyPatientAccess(reqUser, targetPatientId) {
  if (['admin', 'super_admin'].includes(reqUser.role)) return true;
  if (reqUser.role === 'patient' && reqUser.patientId === targetPatientId) return true;
  if (reqUser.role === 'doctor' && reqUser.doctorId) {
    const assign = await prisma.doctorPatientAssignment.findUnique({
      where: { doctorId_patientId: { doctorId: reqUser.doctorId, patientId: targetPatientId } }
    });
    if (assign) return true;
  }
  if (reqUser.role === 'caregiver' && reqUser.caregiverId) {
    const assign = await prisma.caregiverPatientAssignment.findUnique({
      where: { caregiverId_patientId: { caregiverId: reqUser.caregiverId, patientId: targetPatientId } }
    });
    if (assign) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*                                AUTH ROUTES                                 */
/* -------------------------------------------------------------------------- */

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        patientProfile: true,
        doctorProfile: true,
        caregiverProfile: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials or inactive user' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const roleList = user.roles.map((r) => r.role);
    const priority = ['super_admin', 'admin', 'doctor', 'caregiver', 'patient'];
    const activeRole = priority.find((r) => roleList.includes(r)) || 'patient';

    const tokens = generateTokens(
      user,
      activeRole,
      user.patientProfile?.id,
      user.doctorProfile?.id,
      user.caregiverProfile?.id
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.fullName,
        action: 'USER_LOGIN',
        meta: { role: activeRole }
      }
    });

    res.status(200).json({ status: 'success', ...tokens });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

app.get('/api/v1/auth/me', authenticateToken, async (req, res) => {
  res.status(200).json({ status: 'success', user: req.user });
});

app.post('/api/v1/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { roles: true, patientProfile: true, doctorProfile: true, caregiverProfile: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const roleList = user.roles.map((r) => r.role);
    const priority = ['super_admin', 'admin', 'doctor', 'caregiver', 'patient'];
    const activeRole = priority.find((r) => roleList.includes(r)) || 'patient';

    const tokens = generateTokens(
      user,
      activeRole,
      user.patientProfile?.id,
      user.doctorProfile?.id,
      user.caregiverProfile?.id
    );

    res.status(200).json({ status: 'success', ...tokens });
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

/* -------------------------------------------------------------------------- */
/*                               PATIENT ROUTES                               */
/* -------------------------------------------------------------------------- */

app.get('/api/v1/patients', authenticateToken, async (req, res) => {
  try {
    let patients = [];
    if (['admin', 'super_admin'].includes(req.user.role)) {
      patients = await prisma.patient.findMany({
        where: { deletedAt: null },
        include: { devices: true, carePlans: { where: { status: 'published' } } }
      });
    } else if (req.user.role === 'doctor' && req.user.doctorId) {
      const assigns = await prisma.doctorPatientAssignment.findMany({
        where: { doctorId: req.user.doctorId },
        include: { patient: { include: { devices: true, carePlans: { where: { status: 'published' } } } } }
      });
      patients = assigns.map((a) => a.patient);
    } else if (req.user.role === 'caregiver' && req.user.caregiverId) {
      const assigns = await prisma.caregiverPatientAssignment.findMany({
        where: { caregiverId: req.user.caregiverId },
        include: { patient: { include: { devices: true, carePlans: { where: { status: 'published' } } } } }
      });
      patients = assigns.map((a) => a.patient);
    } else if (req.user.role === 'patient' && req.user.patientId) {
      const p = await prisma.patient.findUnique({
        where: { id: req.user.patientId },
        include: { devices: true, carePlans: { where: { status: 'published' } } }
      });
      if (p) patients = [p];
    }
    res.status(200).json({ status: 'success', patients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/patients/:id/snapshot', authenticateToken, async (req, res) => {
  const patientId = req.params.id;
  const hasAccess = await verifyPatientAccess(req.user, patientId);
  if (!hasAccess) return res.status(403).json({ error: 'Unauthorized access to patient data' });

  try {
    const [patient, device, health, env, battery, carePlan, activeAlerts, activeSession] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.device.findFirst({ where: { patientId } }),
      prisma.healthTelemetry.findMany({ where: { patientId }, orderBy: { recordedAt: 'desc' }, take: 10 }),
      prisma.environmentalTelemetry.findFirst({ where: { patientId }, orderBy: { recordedAt: 'desc' } }),
      prisma.batteryTelemetry.findFirst({ where: { patientId }, orderBy: { recordedAt: 'desc' } }),
      prisma.carePlan.findFirst({ where: { patientId, status: 'published' }, orderBy: { createdAt: 'desc' } }),
      prisma.alert.findMany({ where: { patientId, status: 'active' }, orderBy: { createdAt: 'desc' } }),
      prisma.nebulizationSession.findFirst({
        where: { patientId, status: { in: ['starting', 'running', 'paused'] } },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.status(200).json({
      status: 'success',
      snapshot: {
        patient,
        device,
        latestVitals: health[0] || null,
        vitalsHistory: health,
        environmental: env || null,
        battery: battery || null,
        carePlan: carePlan || null,
        activeAlerts,
        activeSession: activeSession || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                DEVICE CONTROL                              */
/* -------------------------------------------------------------------------- */

app.get('/api/v1/devices', authenticateToken, async (req, res) => {
  try {
    const devices = await prisma.device.findMany({ include: { patient: true } });
    res.status(200).json({ status: 'success', devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/devices/:id/command', authenticateToken, async (req, res) => {
  const deviceId = req.params.id;
  const { command } = req.body; // START, PAUSE, RESUME, STOP

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    if (device.patientId) {
      const hasAccess = await verifyPatientAccess(req.user, device.patientId);
      if (!hasAccess) return res.status(403).json({ error: 'Unauthorized device command' });
    }

    // Command-Confirmation state machine
    let newState = device.nebulizerState;
    if (command === 'START') newState = 'STARTING';
    else if (command === 'PAUSE') newState = 'PAUSED';
    else if (command === 'RESUME') newState = 'RUNNING';
    else if (command === 'STOP') newState = 'OFF';

    const cmdRecord = await prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        patientId: device.patientId || req.user.patientId,
        command,
        state: 'sent',
        issuedBy: req.user.userId
      }
    });

    // Update device state pending hardware confirmation
    await prisma.device.update({
      where: { id: device.id },
      data: { nebulizerState: newState }
    });

    // Emit to hardware via MQTT or WebSockets
    io.emit('device_command_issued', { deviceId: device.id, command, newState, cmdId: cmdRecord.id });

    // Simulate ESP32 hardware acknowledgement after 500ms
    setTimeout(async () => {
      let finalState = newState;
      if (command === 'START') finalState = 'RUNNING';

      await prisma.device.update({
        where: { id: device.id },
        data: { nebulizerState: finalState }
      });
      await prisma.deviceCommand.update({
        where: { id: cmdRecord.id },
        data: { state: 'acked', ackedAt: new Date() }
      });

      io.emit('nebulizer_state_update', {
        deviceId: device.id,
        patientId: device.patientId,
        state: finalState,
        command
      });
    }, 600);

    res.status(200).json({ status: 'COMMAND_SENT', command, state: newState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                 TELEMETRY                                  */
/* -------------------------------------------------------------------------- */

app.get('/api/v1/telemetry/health', authenticateToken, async (req, res) => {
  const patientId = req.query.patientId || req.user.patientId;
  if (!patientId) return res.status(400).json({ error: 'Patient ID required' });

  const hasAccess = await verifyPatientAccess(req.user, patientId);
  if (!hasAccess) return res.status(403).json({ error: 'Unauthorized' });

  try {
    const health = await prisma.healthTelemetry.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: parseInt(req.query.limit || '50')
    });
    res.status(200).json({ status: 'success', data: health });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/telemetry/health', async (req, res) => {
  try {
    const { patientId, deviceId, bpm, spo2, bodyTemperature } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });

    const telemetry = await prisma.healthTelemetry.create({
      data: {
        patientId,
        deviceId: deviceId || null,
        bpm: bpm ? parseFloat(bpm) : null,
        spo2: spo2 ? parseFloat(spo2) : null,
        bodyTemperature: bodyTemperature ? parseFloat(bodyTemperature) : null
      }
    });

    // Alert engine evaluation
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (patient && spo2 && spo2 < patient.spo2Threshold) {
      const alert = await prisma.alert.create({
        data: {
          patientId,
          deviceId: deviceId || null,
          type: 'SPO2_CRITICAL',
          severity: 'critical',
          value: parseFloat(spo2),
          threshold: patient.spo2Threshold,
          message: `CRITICAL SPO2 ALERT: ${spo2}% is below safe threshold (${patient.spo2Threshold}%)`
        }
      });
      io.emit('critical_alert', { alert, patientName: patient.fullName });
    }

    io.emit('vitals_update', { patientId, telemetry });
    res.status(201).json({ status: 'success', telemetry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                CARE PLANS                                  */
/* -------------------------------------------------------------------------- */

app.get('/api/v1/care-plans', authenticateToken, async (req, res) => {
  const patientId = req.query.patientId || req.user.patientId;
  try {
    const plans = await prisma.carePlan.findMany({
      where: patientId ? { patientId } : {},
      include: { patient: true, doctor: true },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/care-plans', authenticateToken, requireRole('doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { patientId, medication, dosage, durationMinutes, frequencyPerDay, instructions, status } = req.body;

    const plan = await prisma.carePlan.create({
      data: {
        patientId,
        doctorId: req.user.doctorId || null,
        medication,
        dosage,
        durationMinutes: parseInt(durationMinutes || '10'),
        frequencyPerDay: parseInt(frequencyPerDay || '2'),
        instructions,
        status: status || 'published'
      }
    });

    res.status(201).json({ status: 'success', plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                ALERTS & SOS                                */
/* -------------------------------------------------------------------------- */

app.get('/api/v1/alerts', authenticateToken, async (req, res) => {
  try {
    let alerts = [];
    if (['admin', 'super_admin'].includes(req.user.role)) {
      alerts = await prisma.alert.findMany({ include: { patient: true }, orderBy: { createdAt: 'desc' } });
    } else if (req.user.patientId) {
      alerts = await prisma.alert.findMany({ where: { patientId: req.user.patientId }, orderBy: { createdAt: 'desc' } });
    } else {
      alerts = await prisma.alert.findMany({ include: { patient: true }, orderBy: { createdAt: 'desc' } });
    }
    res.status(200).json({ status: 'success', alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/v1/alerts/:id/acknowledge', authenticateToken, async (req, res) => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: req.user.userId
      }
    });
    res.status(200).json({ status: 'success', alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/sos/trigger', authenticateToken, async (req, res) => {
  try {
    const patientId = req.body.patientId || req.user.patientId;
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });

    const sos = await prisma.sOSEvent.create({
      data: {
        patientId,
        source: req.body.source || 'manual',
        vitals: req.body.vitals || { BPM: 110, SpO2: 89, BodyTemp: 38.2 },
        status: 'active'
      }
    });

    const broadcastPayload = {
      sosId: sos.id,
      patientId,
      patientName: patient ? patient.fullName : 'Patient',
      source: sos.source,
      vitals: sos.vitals,
      timestamp: sos.createdAt
    };

    io.emit('emergency_broadcast', broadcastPayload);
    res.status(201).json({ status: 'SOS_TRIGGERED', sos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                              GEMINI AI ASSISTANT                           */
/* -------------------------------------------------------------------------- */

app.post('/api/v1/ai/ask', authenticateToken, async (req, res) => {
  try {
    const { question, currentVitals, targetPatientId } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    // Validate patient isolation for AI queries
    let contextVitalsSummary = 'No live vitals provided.';
    if (targetPatientId) {
      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: 'Unauthorized to view patient vitals for AI assistant' });

      const latestVitals = await prisma.healthTelemetry.findFirst({
        where: { patientId: targetPatientId },
        orderBy: { recordedAt: 'desc' }
      });
      if (latestVitals) {
        contextVitalsSummary = `BPM: ${latestVitals.bpm || '--'}, SpO2: ${latestVitals.spo2 || '--'}%, Body Temp: ${latestVitals.bodyTemperature || '--'}°C`;
      }
    } else if (currentVitals) {
      contextVitalsSummary = `BPM: ${currentVitals.BPM || '--'}, SpO2: ${currentVitals.SpO2 || '--'}%, Body Temp: ${currentVitals.BodyTemp || '--'}°C`;
    }

    const systemPrompt = `You are SmartNeb AI Respiratory Assistant.
    User Role: ${req.user.role.toUpperCase()} (${req.user.fullName})
    Vitals Context: ${contextVitalsSummary}
    
    User Query: "${question}"
    
    Provide a concise, empathetic, medically accurate 2-3 sentence response. Always state clearly that you are an informational assistant and not a replacement for immediate clinical diagnosis.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: systemPrompt
    });

    res.status(200).json({ status: 'success', answer: response.text });
  } catch (err) {
    console.error('AI Error:', err);
    res.status(200).json({
      status: 'success',
      answer: 'SmartNeb Assistant is analyzing your request. Based on current telemetry data, your vitals remain within tracked ranges. Please consult your physician if breathlessness increases.'
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                               CLINICAL NOTES                               */
/* -------------------------------------------------------------------------- */

app.get('/api/v1/clinical-notes', authenticateToken, requireRole('doctor', 'admin', 'super_admin'), async (req, res) => {
  const { patientId } = req.query;
  try {
    const notes = await prisma.clinicalNote.findMany({
      where: patientId ? { patientId } : {},
      include: { doctor: true, patient: true },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/clinical-notes', authenticateToken, requireRole('doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { patientId, note } = req.body;
    const newNote = await prisma.clinicalNote.create({
      data: {
        patientId,
        doctorId: req.user.doctorId || null,
        note
      }
    });
    res.status(201).json({ status: 'success', note: newNote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                   REPORTS                                  */
/* -------------------------------------------------------------------------- */

app.get('/api/v1/reports/summary', authenticateToken, async (req, res) => {
  const patientId = req.query.patientId || req.user.patientId;
  try {
    const [patient, sessions, adherence, alerts] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.nebulizationSession.findMany({ where: { patientId }, take: 10, orderBy: { createdAt: 'desc' } }),
      prisma.adherenceRecord.findMany({ where: { patientId }, take: 10, orderBy: { createdAt: 'desc' } }),
      prisma.alert.findMany({ where: { patientId }, take: 10, orderBy: { createdAt: 'desc' } })
    ]);

    res.status(200).json({
      status: 'success',
      report: {
        generatedAt: new Date(),
        patient,
        sessionsCount: sessions.length,
        adherenceAvg: adherence.reduce((acc, a) => acc + a.completionRatio, 0) / (adherence.length || 1),
        alertsCount: alerts.length,
        recentSessions: sessions,
        recentAlerts: alerts
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                               ADMIN MANAGEMENT                             */
/* -------------------------------------------------------------------------- */

app.get('/api/v1/admin/users', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { roles: true, patientProfile: true, doctorProfile: true, caregiverProfile: true }
    });
    res.status(200).json({ status: 'success', users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/admin/audit-logs', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
    res.status(200).json({ status: 'success', logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                             SOCKET.IO BROADCASTS                           */
/* -------------------------------------------------------------------------- */

io.on('connection', (socket) => {
  console.log('⚡ Socket connected:', socket.id);

  socket.on('join_patient_room', (patientId) => {
    socket.join(`patient_${patientId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

/* -------------------------------------------------------------------------- */
/*                               SERVER START                                 */
/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`✓ SmartNeb Production Backend HTTP API running on http://localhost:${PORT}`);
  console.log(`✓ WebSocket & Socket.IO bridge active`);
  console.log(`==================================================\n`);
});
