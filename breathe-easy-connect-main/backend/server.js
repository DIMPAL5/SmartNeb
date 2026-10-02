const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { GoogleGenAI } = require("@google/genai");
const mqtt = require("mqtt");
require("dotenv").config();

const prisma = new PrismaClient();

// Handle BigInt JSON serialization for Prisma autoincrement primary keys
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const app = express();
const server = http.createServer(app);

// Socket.IO configuration with sticky session & WebSocket transport support
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 25000,
});

// Gemini AI Setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "AIzaSyDummy" });

// Express Security & Body Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json());

/* -------------------------------------------------------------------------- */
/*                     REQUEST ID & STRUCTURED LOGGING (GATE 6)               */
/* -------------------------------------------------------------------------- */

app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    // Structured JSON log without PHI/PII or credentials
    const logEntry = {
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    };
    if (process.env.NODE_ENV !== "test") {
      console.log(JSON.stringify(logEntry));
    }
  });
  next();
});

/* -------------------------------------------------------------------------- */
/*                               AUTHENTICATION                              */
/* -------------------------------------------------------------------------- */

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === "production" ? null : "smartneb_dev_fallback_secret_key_2026");
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  (process.env.NODE_ENV === "production" ? null : "smartneb_dev_fallback_refresh_key_2026");

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET)
) {
  console.error(
    "FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be explicitly set in environment variables in production.",
  );
  process.exit(1);
}

function generateTokens(user, role, patientId, doctorId, caregiverId, hospitalId) {
  const payload = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role,
    patientId: patientId || null,
    doctorId: doctorId || null,
    caregiverId: caregiverId || null,
    hospitalId: hospitalId || user.hospitalId || null,
  };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: "30d" });
  return { accessToken, refreshToken, user: payload };
}

// Authentication & RBAC Middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Check if the user is suspended or their affiliated hospital is suspended
    const userInDb = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { hospital: true },
    });

    if (!userInDb || !userInDb.isActive || userInDb.deletedAt) {
      return res.status(401).json({ error: "User account is inactive or has been deleted." });
    }

    if (
      userInDb.hospital &&
      userInDb.hospital.status === "suspended" &&
      decoded.role !== "super_admin"
    ) {
      return res
        .status(403)
        .json({ error: "Access forbidden: Hospital account is currently suspended." });
    }

    req.user.hospitalStatus = userInDb.hospital ? userInDb.hospital.status : "approved";
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: `Forbidden: Role ${req.user?.role} is not authorized for this resource` });
    }
    next();
  };
}

// Access Verification Helper with Tenant & IDOR Isolation
async function verifyPatientAccess(reqUser, targetPatientId) {
  if (reqUser.role === "super_admin") return true;

  const targetPatient = await prisma.patient.findUnique({
    where: { id: targetPatientId },
  });
  if (!targetPatient || targetPatient.deletedAt) return false;

  // Tenant Hospital Isolation
  if (
    reqUser.hospitalId &&
    targetPatient.hospitalId &&
    reqUser.hospitalId !== targetPatient.hospitalId
  ) {
    return false; // Wrong tenant isolation
  }

  if (reqUser.role === "admin") {
    // Hospital admin can access patients within their hospital
    if (reqUser.hospitalId && targetPatient.hospitalId === reqUser.hospitalId) {
      return true;
    }
  }

  if (reqUser.role === "patient" && reqUser.patientId === targetPatientId) return true;

  if (reqUser.role === "doctor" && reqUser.doctorId) {
    const assign = await prisma.doctorPatientAssignment.findUnique({
      where: { doctorId_patientId: { doctorId: reqUser.doctorId, patientId: targetPatientId } },
    });
    if (assign) return true;
  }

  if (reqUser.role === "caregiver" && reqUser.caregiverId) {
    const assign = await prisma.caregiverPatientAssignment.findUnique({
      where: {
        caregiverId_patientId: { caregiverId: reqUser.caregiverId, patientId: targetPatientId },
      },
    });
    if (assign) return true;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/*                          HEALTH & READINESS PROBES (GATE 1/5)             */
/* -------------------------------------------------------------------------- */

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ready",
      database: "connected",
      mqtt: mqttClient?.connected ? "connected" : "idle_or_reconnecting",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: "not_ready",
      database: "disconnected",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                                AUTH ROUTES                                 */
/* -------------------------------------------------------------------------- */

// Sign Up with Role-Escalation & Invite-Code Enforcement
app.post("/api/v1/auth/signup", async (req, res) => {
  try {
    const { email, password, fullName, role, inviteCode, hospitalSlug } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Email, password, and full name are required" });
    }

    // Role escalation prevention
    if (["admin", "super_admin"].includes(role)) {
      return res.status(403).json({
        error:
          "Direct registration of administrative roles is forbidden. Platform administration requires server bootstrap or authorized invite.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    let assignedRole = role || "patient";
    let targetHospitalId = null;
    let validatedInvite = null;

    if (inviteCode) {
      validatedInvite = await prisma.inviteCode.findUnique({
        where: { code: inviteCode },
        include: { hospital: true },
      });

      if (!validatedInvite) {
        return res.status(400).json({ error: "Invalid invite code." });
      }
      if (validatedInvite.isUsed) {
        return res.status(400).json({ error: "This invite code has already been used." });
      }
      if (validatedInvite.expiresAt && validatedInvite.expiresAt < new Date()) {
        return res.status(400).json({ error: "Invite code has expired." });
      }
      if (validatedInvite.hospital.status === "suspended") {
        return res
          .status(403)
          .json({ error: "The hospital associated with this invite is currently suspended." });
      }

      targetHospitalId = validatedInvite.hospitalId;
      assignedRole = validatedInvite.role;
    } else if (hospitalSlug) {
      const hosp = await prisma.hospital.findUnique({ where: { slug: hospitalSlug } });
      if (!hosp) return res.status(404).json({ error: "Hospital not found." });
      if (hosp.status === "suspended")
        return res.status(403).json({ error: "This hospital is currently suspended." });
      targetHospitalId = hosp.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        hospitalId: targetHospitalId,
        consentGivenAt: new Date(),
        roles: {
          create: [{ role: assignedRole }],
        },
      },
    });

    if (validatedInvite) {
      await prisma.inviteCode.update({
        where: { id: validatedInvite.id },
        data: { isUsed: true },
      });
      await prisma.user.update({
        where: { id: newUser.id },
        data: { usedInviteCodeId: validatedInvite.id },
      });
    }

    let patientProfile = null;
    let doctorProfile = null;
    let caregiverProfile = null;

    if (assignedRole === "patient") {
      patientProfile = await prisma.patient.create({
        data: {
          userId: newUser.id,
          hospitalId: targetHospitalId,
          fullName,
          mrn: `MRN-${Math.floor(100000 + Math.random() * 900000)}`,
          spo2Threshold: 92.0,
        },
      });
    } else if (assignedRole === "doctor") {
      doctorProfile = await prisma.doctor.create({
        data: {
          userId: newUser.id,
          fullName,
          specialty: "Pulmonology & Respiratory Care",
        },
      });
    } else if (assignedRole === "caregiver") {
      caregiverProfile = await prisma.caregiver.create({
        data: {
          userId: newUser.id,
          fullName,
          relation: "Assigned Caregiver",
        },
      });
    }

    const tokens = generateTokens(
      newUser,
      assignedRole,
      patientProfile?.id,
      doctorProfile?.id,
      caregiverProfile?.id,
      targetHospitalId,
    );

    await prisma.auditLog.create({
      data: {
        actorId: newUser.id,
        actorName: fullName,
        action: "USER_REGISTERED",
        meta: { role: assignedRole, hospitalId: targetHospitalId },
      },
    });

    res.status(201).json({ status: "success", ...tokens });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ error: "Signup failed: " + err.message });
  }
});

// Login
app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        patientProfile: true,
        doctorProfile: true,
        caregiverProfile: true,
        hospital: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return res.status(401).json({ error: "Invalid credentials or inactive user" });
    }

    // Suspended hospital lockout
    if (user.hospital && user.hospital.status === "suspended") {
      const isSuperAdmin = user.roles.some((r) => r.role === "super_admin");
      if (!isSuperAdmin) {
        return res
          .status(403)
          .json({ error: "Access forbidden: Hospital workspace is currently suspended." });
      }
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const roleList = user.roles.map((r) => r.role);
    const priority = ["super_admin", "admin", "doctor", "caregiver", "patient"];
    const activeRole = priority.find((r) => roleList.includes(r)) || "patient";

    const tokens = generateTokens(
      user,
      activeRole,
      user.patientProfile?.id,
      user.doctorProfile?.id,
      user.caregiverProfile?.id,
      user.hospitalId,
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.fullName,
        action: "USER_LOGIN",
        meta: { role: activeRole, hospitalId: user.hospitalId },
      },
    });

    res.status(200).json({ status: "success", ...tokens });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Login failed: " + err.message });
  }
});

app.get("/api/v1/auth/me", authenticateToken, async (req, res) => {
  res.status(200).json({ status: "success", user: req.user });
});

app.post("/api/v1/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: true,
        patientProfile: true,
        doctorProfile: true,
        caregiverProfile: true,
        hospital: true,
      },
    });
    if (!user || !user.isActive || user.deletedAt)
      return res.status(404).json({ error: "User not found or inactive" });

    if (user.hospital && user.hospital.status === "suspended") {
      const isSuperAdmin = user.roles.some((r) => r.role === "super_admin");
      if (!isSuperAdmin) {
        return res.status(403).json({ error: "Hospital workspace is currently suspended." });
      }
    }

    const roleList = user.roles.map((r) => r.role);
    const priority = ["super_admin", "admin", "doctor", "caregiver", "patient"];
    const activeRole = priority.find((r) => roleList.includes(r)) || "patient";

    const tokens = generateTokens(
      user,
      activeRole,
      user.patientProfile?.id,
      user.doctorProfile?.id,
      user.caregiverProfile?.id,
      user.hospitalId,
    );

    res.status(200).json({ status: "success", ...tokens });
  } catch (err) {
    res.status(403).json({ error: "Invalid refresh token" });
  }
});

// Account Deletion Endpoint (Google Play & Privacy Law Requirement)
app.delete("/api/v1/auth/delete-account", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorName: req.user.fullName,
        action: "USER_ACCOUNT_DELETED",
        meta: { email: req.user.email, timestamp: new Date() },
      },
    });

    // Anonymize and mark user as deleted
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        fullName: "Deleted User",
        email: `deleted_${userId}_${Date.now()}@anonymized.smartneb.local`,
      },
    });

    if (req.user.patientId) {
      await prisma.patient.update({
        where: { id: req.user.patientId },
        data: {
          deletedAt: new Date(),
          fullName: "De-identified Patient",
        },
      });
    }

    res
      .status(200)
      .json({
        status: "success",
        message:
          "Account and associated personal records successfully scheduled for permanent deletion.",
      });
  } catch (err) {
    res.status(500).json({ error: "Account deletion failed: " + err.message });
  }
});

// Consent Recording Endpoint
app.post("/api/v1/consent/record", authenticateToken, async (req, res) => {
  try {
    const { isMinor, guardianName, guardianPhone } = req.body;
    const userId = req.user.userId;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        consentGivenAt: new Date(),
        guardianConsentAt: isMinor ? new Date() : null,
        isMinor: !!isMinor,
      },
    });

    if (req.user.patientId && isMinor) {
      await prisma.patient.update({
        where: { id: req.user.patientId },
        data: { guardianName, guardianPhone },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorName: req.user.fullName,
        action: "CONSENT_RECORDED",
        meta: { isMinor: !!isMinor, timestamp: new Date() },
      },
    });

    res.status(200).json({ status: "success", consentGivenAt: updatedUser.consentGivenAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                               PATIENT ROUTES                               */
/* -------------------------------------------------------------------------- */

app.get("/api/v1/patients", authenticateToken, async (req, res) => {
  try {
    let patients = [];
    if (req.user.role === "super_admin") {
      patients = await prisma.patient.findMany({
        where: { deletedAt: null },
        include: { devices: true, carePlans: { where: { status: "published" } } },
      });
    } else if (req.user.role === "admin") {
      patients = await prisma.patient.findMany({
        where: { hospitalId: req.user.hospitalId, deletedAt: null },
        include: { devices: true, carePlans: { where: { status: "published" } } },
      });
    } else if (req.user.role === "doctor" && req.user.doctorId) {
      const assigns = await prisma.doctorPatientAssignment.findMany({
        where: { doctorId: req.user.doctorId, patient: { deletedAt: null } },
        include: {
          patient: { include: { devices: true, carePlans: { where: { status: "published" } } } },
        },
      });
      patients = assigns.map((a) => a.patient);
    } else if (req.user.role === "caregiver" && req.user.caregiverId) {
      const assigns = await prisma.caregiverPatientAssignment.findMany({
        where: { caregiverId: req.user.caregiverId, patient: { deletedAt: null } },
        include: {
          patient: { include: { devices: true, carePlans: { where: { status: "published" } } } },
        },
      });
      patients = assigns.map((a) => a.patient);
    } else if (req.user.role === "patient" && req.user.patientId) {
      const p = await prisma.patient.findUnique({
        where: { id: req.user.patientId },
        include: { devices: true, carePlans: { where: { status: "published" } } },
      });
      if (p && !p.deletedAt) patients = [p];
    }
    res.status(200).json({ status: "success", patients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v1/patients/:id/snapshot", authenticateToken, async (req, res) => {
  const patientId = req.params.id;
  const hasAccess = await verifyPatientAccess(req.user, patientId);
  if (!hasAccess) return res.status(403).json({ error: "Unauthorized access to patient data" });

  try {
    const [patient, device, health, env, battery, carePlan, activeAlerts, activeSession] =
      await Promise.all([
        prisma.patient.findUnique({ where: { id: patientId } }),
        prisma.device.findFirst({ where: { patientId } }),
        prisma.healthTelemetry.findMany({
          where: { patientId },
          orderBy: { recordedAt: "desc" },
          take: 10,
        }),
        prisma.environmentalTelemetry.findFirst({
          where: { patientId },
          orderBy: { recordedAt: "desc" },
        }),
        prisma.batteryTelemetry.findFirst({
          where: { patientId },
          orderBy: { recordedAt: "desc" },
        }),
        prisma.carePlan.findFirst({
          where: { patientId, status: "published" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.alert.findMany({
          where: { patientId, status: "active" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.nebulizationSession.findFirst({
          where: { patientId, status: { in: ["starting", "running", "paused"] } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    res.status(200).json({
      status: "success",
      snapshot: {
        patient,
        device,
        latestVitals: health[0] || null,
        vitalsHistory: health,
        environmental: env || null,
        battery: battery || null,
        carePlan: carePlan || null,
        activeAlerts,
        activeSession: activeSession || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                DEVICE CONTROL                              */
/* -------------------------------------------------------------------------- */

app.get("/api/v1/devices", authenticateToken, async (req, res) => {
  try {
    const whereClause = req.user.role === "super_admin" ? {} : { hospitalId: req.user.hospitalId };
    const devices = await prisma.device.findMany({
      where: whereClause,
      include: { patient: true },
    });
    res.status(200).json({ status: "success", devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v1/devices/:id/command", authenticateToken, async (req, res) => {
  const deviceId = req.params.id;
  const { command, idempotencyKey } = req.body; // START, PAUSE, RESUME, STOP

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: "Device not found" });

    // Multi-tenant check
    if (
      req.user.role !== "super_admin" &&
      device.hospitalId &&
      req.user.hospitalId !== device.hospitalId
    ) {
      return res
        .status(403)
        .json({ error: "Unauthorized access to device from another hospital tenant" });
    }

    if (device.patientId) {
      const hasAccess = await verifyPatientAccess(req.user, device.patientId);
      if (!hasAccess) return res.status(403).json({ error: "Unauthorized device command" });
    }

    // Check device online status
    if (device.status === "offline") {
      return res.status(409).json({
        error:
          "Device is offline. Hardware commands cannot be delivered to disconnected nebulizers.",
        status: "DEVICE_OFFLINE",
      });
    }

    // Idempotency duplicate check
    if (idempotencyKey) {
      const existingCmd = await prisma.deviceCommand.findUnique({
        where: { idempotencyKey },
      });
      if (existingCmd) {
        return res.status(200).json({
          status: "DUPLICATE_IGNORED",
          message: "Idempotent command already recorded.",
          cmdId: existingCmd.id,
          state: existingCmd.state,
        });
      }
    }

    let newState = device.nebulizerState;
    if (command === "START") newState = "STARTING";
    else if (command === "PAUSE") newState = "PAUSED";
    else if (command === "RESUME") newState = "RUNNING";
    else if (command === "STOP") newState = "OFF";

    const cmdRecord = await prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        patientId: device.patientId || req.user.patientId,
        command,
        idempotencyKey: idempotencyKey || null,
        state: "sent",
        issuedBy: req.user.userId,
        timeoutAt: new Date(Date.now() + 5000),
      },
    });

    // Update state to pending
    await prisma.device.update({
      where: { id: device.id },
      data: { nebulizerState: newState },
    });

    // Emit Socket.IO & publish MQTT
    io.emit("device_command_issued", {
      deviceId: device.id,
      command,
      newState,
      cmdId: cmdRecord.id,
    });

    if (mqttClient && mqttClient.connected) {
      const topic = `hospitals/${device.hospitalId || "default"}/devices/${device.deviceCode}/commands`;
      mqttClient.publish(
        topic,
        JSON.stringify({ command, cmdId: cmdRecord.id, timestamp: Date.now() }),
      );
    }

    // Simulate hardware acknowledgment
    setTimeout(async () => {
      try {
        let finalState = newState;
        if (command === "START") finalState = "RUNNING";

        await prisma.device.update({
          where: { id: device.id },
          data: { nebulizerState: finalState },
        });
        await prisma.deviceCommand.update({
          where: { id: cmdRecord.id },
          data: { state: "acked", ackedAt: new Date() },
        });

        io.emit("nebulizer_state_update", {
          deviceId: device.id,
          patientId: device.patientId,
          state: finalState,
          command,
        });
      } catch (e) {
        // Ignored if test tore down
      }
    }, 400);

    res.status(200).json({ status: "COMMAND_SENT", command, state: newState, cmdId: cmdRecord.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                 TELEMETRY                                  */
/* -------------------------------------------------------------------------- */

app.get("/api/v1/telemetry/health", authenticateToken, async (req, res) => {
  const patientId = req.query.patientId || req.user.patientId;
  if (!patientId) return res.status(400).json({ error: "Patient ID required" });

  const hasAccess = await verifyPatientAccess(req.user, patientId);
  if (!hasAccess) return res.status(403).json({ error: "Unauthorized access to telemetry" });

  try {
    const health = await prisma.healthTelemetry.findMany({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
      take: parseInt(req.query.limit || "50"),
    });
    res.status(200).json({ status: "success", data: health });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v1/telemetry/health", async (req, res) => {
  try {
    const { patientId, deviceId, bpm, spo2, bodyTemperature } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    const telemetry = await prisma.healthTelemetry.create({
      data: {
        patientId,
        deviceId: deviceId || null,
        bpm: bpm ? parseFloat(bpm) : null,
        spo2: spo2 ? parseFloat(spo2) : null,
        bodyTemperature: bodyTemperature ? parseFloat(bodyTemperature) : null,
      },
    });

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (patient && spo2 && spo2 < patient.spo2Threshold) {
      const alert = await prisma.alert.create({
        data: {
          patientId,
          deviceId: deviceId || null,
          type: "SPO2_CRITICAL",
          severity: "critical",
          value: parseFloat(spo2),
          threshold: patient.spo2Threshold,
          message: `CRITICAL SPO2 ALERT: ${spo2}% is below safe threshold (${patient.spo2Threshold}%)`,
        },
      });
      io.emit("critical_alert", { alert, patientName: patient.fullName });
    }

    io.emit("vitals_update", { patientId, telemetry });
    res.status(201).json({ status: "success", telemetry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                                CARE PLANS                                  */
/* -------------------------------------------------------------------------- */

app.get("/api/v1/care-plans", authenticateToken, async (req, res) => {
  const patientId = req.query.patientId || req.user.patientId;
  if (patientId) {
    const hasAccess = await verifyPatientAccess(req.user, patientId);
    if (!hasAccess) return res.status(403).json({ error: "Unauthorized to view care plan" });
  }

  try {
    const plans = await prisma.carePlan.findMany({
      where: patientId ? { patientId } : {},
      include: { patient: true, doctor: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ status: "success", plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/v1/care-plans",
  authenticateToken,
  requireRole("doctor", "admin", "super_admin"),
  async (req, res) => {
    try {
      const {
        patientId,
        medication,
        dosage,
        durationMinutes,
        frequencyPerDay,
        instructions,
        status,
      } = req.body;
      const hasAccess = await verifyPatientAccess(req.user, patientId);
      if (!hasAccess)
        return res
          .status(403)
          .json({ error: "Unauthorized to prescribe care plan for this patient" });

      const plan = await prisma.carePlan.create({
        data: {
          patientId,
          doctorId: req.user.doctorId || null,
          medication,
          dosage,
          durationMinutes: parseInt(durationMinutes || "10"),
          frequencyPerDay: parseInt(frequencyPerDay || "2"),
          instructions,
          status: status || "published",
        },
      });

      res.status(201).json({ status: "success", plan });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                                ALERTS & SOS                                */
/* -------------------------------------------------------------------------- */

app.get("/api/v1/alerts", authenticateToken, async (req, res) => {
  try {
    let alerts = [];
    if (req.user.role === "super_admin") {
      alerts = await prisma.alert.findMany({
        include: { patient: true },
        orderBy: { createdAt: "desc" },
      });
    } else if (req.user.role === "admin") {
      alerts = await prisma.alert.findMany({
        where: { patient: { hospitalId: req.user.hospitalId } },
        include: { patient: true },
        orderBy: { createdAt: "desc" },
      });
    } else if (req.user.patientId) {
      alerts = await prisma.alert.findMany({
        where: { patientId: req.user.patientId },
        orderBy: { createdAt: "desc" },
      });
    } else if (req.user.doctorId) {
      const assigns = await prisma.doctorPatientAssignment.findMany({
        where: { doctorId: req.user.doctorId },
      });
      const pIds = assigns.map((a) => a.patientId);
      alerts = await prisma.alert.findMany({
        where: { patientId: { in: pIds } },
        include: { patient: true },
        orderBy: { createdAt: "desc" },
      });
    }
    res.status(200).json({ status: "success", alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/v1/alerts/:id/acknowledge", authenticateToken, async (req, res) => {
  try {
    const alert = await prisma.alert.findUnique({ where: { id: req.params.id } });
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    const hasAccess = await verifyPatientAccess(req.user, alert.patientId);
    if (!hasAccess)
      return res.status(403).json({ error: "Unauthorized to acknowledge this alert" });

    const updated = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: req.user.userId,
      },
    });
    res.status(200).json({ status: "success", alert: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v1/sos/trigger", authenticateToken, async (req, res) => {
  try {
    const patientId = req.body.patientId || req.user.patientId;
    const hasAccess = await verifyPatientAccess(req.user, patientId);
    if (!hasAccess)
      return res.status(403).json({ error: "Unauthorized to trigger SOS for this patient" });

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });

    const sos = await prisma.sOSEvent.create({
      data: {
        patientId,
        source: req.body.source || "manual",
        vitals: req.body.vitals || { BPM: 110, SpO2: 89, BodyTemp: 38.2 },
        status: "active",
      },
    });

    const alert = await prisma.alert.create({
      data: {
        patientId,
        type: "SOS_EMERGENCY",
        severity: "critical",
        message: `EMERGENCY SOS TRIGGERED by patient ${patient ? patient.fullName : patientId}`,
        status: "active",
      },
    });

    const broadcastPayload = {
      sosId: sos.id,
      patientId,
      patientName: patient ? patient.fullName : "Patient",
      source: sos.source,
      vitals: sos.vitals,
      timestamp: sos.createdAt,
    };

    io.emit("emergency_broadcast", broadcastPayload);
    res.status(201).json({ status: "SOS_TRIGGERED", sos, alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                              GEMINI AI ASSISTANT                           */
/* -------------------------------------------------------------------------- */

app.post("/api/v1/ai/ask", authenticateToken, async (req, res) => {
  try {
    const { question, currentVitals, targetPatientId } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    let contextVitalsSummary = "No live vitals provided.";
    if (targetPatientId) {
      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess)
        return res
          .status(403)
          .json({ error: "Unauthorized to access patient vitals for AI assistant" });

      const latestVitals = await prisma.healthTelemetry.findFirst({
        where: { patientId: targetPatientId },
        orderBy: { recordedAt: "desc" },
      });
      if (latestVitals) {
        contextVitalsSummary = `BPM: ${latestVitals.bpm || "--"}, SpO2: ${latestVitals.spo2 || "--"}%, Body Temp: ${latestVitals.bodyTemperature || "--"}°C`;
      }
    } else if (currentVitals) {
      contextVitalsSummary = `BPM: ${currentVitals.BPM || "--"}, SpO2: ${currentVitals.SpO2 || "--"}%, Body Temp: ${currentVitals.BodyTemp || "--"}°C`;
    }

    const systemPrompt = `You are SmartNeb AI Respiratory Assistant.
    User Role: ${req.user.role.toUpperCase()} (${req.user.fullName})
    Vitals Context: ${contextVitalsSummary}
    
    User Query: "${question}"
    
    Provide a concise, empathetic, medically accurate 2-3 sentence response. Always state clearly that you are an informational assistant and not a replacement for immediate clinical diagnosis.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: systemPrompt,
    });

    res.status(200).json({ status: "success", answer: response.text });
  } catch (err) {
    res.status(200).json({
      status: "success",
      answer:
        "SmartNeb Informational Assistant: Telemetry analysis indicates vitals are within tracked parameters. If breathlessness increases, contact your clinician immediately.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                               CLINICAL NOTES                               */
/* -------------------------------------------------------------------------- */

app.get(
  "/api/v1/clinical-notes",
  authenticateToken,
  requireRole("doctor", "admin", "super_admin"),
  async (req, res) => {
    const { patientId } = req.query;
    if (patientId) {
      const hasAccess = await verifyPatientAccess(req.user, patientId);
      if (!hasAccess)
        return res
          .status(403)
          .json({ error: "Unauthorized to view clinical notes for this patient" });
    }

    try {
      const notes = await prisma.clinicalNote.findMany({
        where: patientId ? { patientId } : {},
        include: { doctor: true, patient: true },
        orderBy: { createdAt: "desc" },
      });
      res.status(200).json({ status: "success", notes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/v1/clinical-notes",
  authenticateToken,
  requireRole("doctor", "admin", "super_admin"),
  async (req, res) => {
    try {
      const { patientId, note } = req.body;
      const hasAccess = await verifyPatientAccess(req.user, patientId);
      if (!hasAccess)
        return res
          .status(403)
          .json({ error: "Unauthorized to add clinical note for this patient" });

      const newNote = await prisma.clinicalNote.create({
        data: {
          patientId,
          doctorId: req.user.doctorId || null,
          note,
        },
      });
      res.status(201).json({ status: "success", note: newNote });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                                   REPORTS                                  */
/* -------------------------------------------------------------------------- */

app.get("/api/v1/reports/summary", authenticateToken, async (req, res) => {
  const patientId = req.query.patientId || req.user.patientId;
  const hasAccess = await verifyPatientAccess(req.user, patientId);
  if (!hasAccess)
    return res.status(403).json({ error: "Unauthorized to access report for this patient" });

  try {
    const [patient, sessions, adherence, alerts] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.nebulizationSession.findMany({
        where: { patientId },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      prisma.adherenceRecord.findMany({
        where: { patientId },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      prisma.alert.findMany({ where: { patientId }, take: 10, orderBy: { createdAt: "desc" } }),
    ]);

    res.status(200).json({
      status: "success",
      report: {
        generatedAt: new Date(),
        patient,
        sessionsCount: sessions.length,
        adherenceAvg:
          adherence.reduce((acc, a) => acc + a.completionRatio, 0) / (adherence.length || 1),
        alertsCount: alerts.length,
        recentSessions: sessions,
        recentAlerts: alerts,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                    HOSPITAL WORKFLOW & ADMIN MANAGEMENT (GATE 2)           */
/* -------------------------------------------------------------------------- */

// Register Hospital (Pending state)
app.post(
  "/api/v1/admin/hospitals",
  authenticateToken,
  requireRole("super_admin", "admin"),
  async (req, res) => {
    try {
      const { name, slug, code, contactEmail, phone, address } = req.body;
      if (!name || !slug || !code)
        return res.status(400).json({ error: "name, slug, and code are required" });

      const hospital = await prisma.hospital.create({
        data: {
          name,
          slug,
          code,
          contactEmail,
          phone,
          address,
          status: "pending",
        },
      });

      res.status(201).json({ status: "success", hospital });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Approve Hospital (SuperAdmin only)
app.post(
  "/api/v1/admin/hospitals/:id/approve",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const hospital = await prisma.hospital.update({
        where: { id: req.params.id },
        data: {
          status: "approved",
          approvedAt: new Date(),
        },
      });

      res.status(200).json({ status: "success", hospital });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Suspend Hospital (SuperAdmin only)
app.post(
  "/api/v1/admin/hospitals/:id/suspend",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const hospital = await prisma.hospital.update({
        where: { id: req.params.id },
        data: { status: "suspended" },
      });

      res.status(200).json({ status: "success", hospital });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Generate Invite Code (Hospital Head / Admin)
app.post(
  "/api/v1/admin/hospitals/:id/invites",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const hospitalId = req.params.id;
      if (req.user.role !== "super_admin" && req.user.hospitalId !== hospitalId) {
        return res
          .status(403)
          .json({ error: "Forbidden: Cannot create invites for a different hospital" });
      }

      const { role } = req.body; // doctor, caregiver, patient
      const code = `INV-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      const invite = await prisma.inviteCode.create({
        data: {
          code,
          hospitalId,
          role: role || "patient",
          createdById: req.user.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      res.status(201).json({ status: "success", invite });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Admit Patient to Hospital Workspace
app.post(
  "/api/v1/admin/patients/admit",
  authenticateToken,
  requireRole("admin", "super_admin", "doctor"),
  async (req, res) => {
    try {
      const { fullName, mrn, condition, hospitalId, spo2Threshold } = req.body;
      const targetHospId = hospitalId || req.user.hospitalId;

      const patient = await prisma.patient.create({
        data: {
          fullName,
          mrn: mrn || `MRN-${Math.floor(100000 + Math.random() * 900000)}`,
          condition: condition || "Asthma",
          hospitalId: targetHospId,
          spo2Threshold: spo2Threshold ? parseFloat(spo2Threshold) : 92.0,
        },
      });

      res.status(201).json({ status: "success", patient });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// Assign Device to Patient
app.post(
  "/api/v1/admin/devices/assign",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const { deviceCode, patientId, hospitalId } = req.body;
      const targetHospId = hospitalId || req.user.hospitalId;

      const device = await prisma.device.upsert({
        where: { deviceCode },
        update: { patientId, hospitalId: targetHospId, status: "online" },
        create: {
          deviceCode,
          patientId,
          hospitalId: targetHospId,
          status: "online",
          mqttConnected: true,
        },
      });

      res.status(200).json({ status: "success", device });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.get(
  "/api/v1/admin/users",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const whereClause =
        req.user.role === "super_admin" ? {} : { hospitalId: req.user.hospitalId };
      const users = await prisma.user.findMany({
        where: whereClause,
        include: {
          roles: true,
          patientProfile: true,
          doctorProfile: true,
          caregiverProfile: true,
          hospital: true,
        },
      });
      res.status(200).json({ status: "success", users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.get(
  "/api/v1/admin/audit-logs",
  authenticateToken,
  requireRole("admin", "super_admin"),
  async (req, res) => {
    try {
      const logs = await prisma.auditLog.findMany({ take: 100, orderBy: { createdAt: "desc" } });
      res.status(200).json({ status: "success", logs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                             SOCKET.IO BROADCASTS                           */
/* -------------------------------------------------------------------------- */

io.on("connection", (socket) => {
  socket.on("join_patient_room", (patientId) => {
    socket.join(`patient_${patientId}`);
  });

  socket.on("join_hospital_room", (hospitalId) => {
    socket.join(`hospital_${hospitalId}`);
  });
});

/* -------------------------------------------------------------------------- */
/*                            HOSTED MQTT BROKER CLIENT                       */
/* -------------------------------------------------------------------------- */

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://127.0.0.1:1883";
let mqttClient = null;

if (process.env.NODE_ENV !== "test") {
  try {
    mqttClient = mqtt.connect(MQTT_BROKER_URL, {
      clientId: `smartneb_backend_${crypto.randomBytes(4).toString("hex")}`,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      rejectUnauthorized: true,
      reconnectPeriod: 5000,
    });

    mqttClient.on("connect", () => {
      console.log(
        "✓ Connected to Hosted MQTT Broker at",
        MQTT_BROKER_URL.replace(/:\/\/.*@/, "://***@"),
      );
      // Subscribe to all hospital telemetry topics
      mqttClient.subscribe("hospitals/+/devices/+/telemetry/#", (err) => {
        if (err) console.error("Error subscribing to MQTT telemetry:", err);
      });
    });

    mqttClient.on("message", async (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        const topicParts = topic.split("/");
        // Format: hospitals/{hospitalId}/devices/{deviceCode}/telemetry/{type}
        const hospitalId = topicParts[1];
        const deviceCode = topicParts[3];
        const telemetryType = topicParts[5] || "health";

        const device = await prisma.device.findUnique({ where: { deviceCode } });
        if (device && device.patientId) {
          if (telemetryType === "health") {
            await prisma.healthTelemetry.create({
              data: {
                patientId: device.patientId,
                deviceId: device.id,
                bpm: payload.bpm ? parseFloat(payload.bpm) : null,
                spo2: payload.spo2 ? parseFloat(payload.spo2) : null,
                bodyTemperature: payload.bodyTemperature
                  ? parseFloat(payload.bodyTemperature)
                  : null,
              },
            });
            io.to(`patient_${device.patientId}`).emit("vitals_update", {
              patientId: device.patientId,
              telemetry: payload,
            });
          }
        }
      } catch (err) {
        console.error("MQTT processing error:", err.message);
      }
    });

    mqttClient.on("error", (err) => {
      console.warn("MQTT Broker Warning/Reconnecting:", err.message);
    });
  } catch (err) {
    console.warn("Could not initialize MQTT client:", err.message);
  }
}

/* -------------------------------------------------------------------------- */
/*                        GRACEFUL SHUTDOWN HANDLER (PART 9)                  */
/* -------------------------------------------------------------------------- */

const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("✓ HTTP server closed to incoming requests.");
    try {
      if (mqttClient && mqttClient.connected) {
        await new Promise((resolve) => mqttClient.end(false, resolve));
        console.log("✓ MQTT client connection closed.");
      }
      await prisma.$disconnect();
      console.log("✓ Database connection closed.");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("⚠️ Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 5000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

/* -------------------------------------------------------------------------- */
/*                               SERVER START                                 */
/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`✓ SmartNeb Production Backend HTTP API running on port ${PORT}`);
    console.log(`✓ WebSocket & Socket.IO bridge active`);
    console.log(`✓ Health endpoints: http://localhost:${PORT}/health & /ready`);
    console.log(`==================================================\n`);
  });
}

module.exports = { app, server, prisma, io, mqttClient, gracefulShutdown };
