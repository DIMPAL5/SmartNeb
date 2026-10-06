/**
 * TelehealthService
 * Manages WebRTC pediatric telehealth consultations and synchronizes live vitals overlay.
 */

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

class TelehealthService {
  constructor(prismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Create or schedule a WebRTC consultation session
   */
  async createSession({ patientId, doctorId, scheduledTime }) {
    if (!patientId || !doctorId) {
      throw new Error("patientId and doctorId are required to start a telehealth consultation");
    }

    const roomName = `smartneb-room-${crypto.randomBytes(8).toString("hex")}`;
    const token = crypto.randomBytes(32).toString("hex");

    const session = await this.prisma.telehealthSession.create({
      data: {
        patientId,
        doctorId,
        roomName,
        token,
        status: "scheduled",
        startedAt: scheduledTime ? new Date(scheduledTime) : new Date(),
        consentGiven: true,
      },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });

    return {
      id: session.id,
      roomName: session.roomName,
      token: session.token,
      status: session.status,
      patientName: session.patient?.user?.fullName,
      doctorName: session.doctor?.user?.fullName,
      startedAt: session.startedAt,
    };
  }

  /**
   * Get session details with live vitals telemetry snapshot
   */
  async getSessionDetails(sessionId) {
    const session = await this.prisma.telehealthSession.findUnique({
      where: { id: sessionId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });

    if (!session) throw new Error("Telehealth session not found");

    // Fetch latest vitals for consultation overlay
    const latestVitals = await this.prisma.healthTelemetry.findFirst({
      where: { patientId: session.patientId },
      orderBy: { recordedAt: "desc" },
    });

    // Fetch latest nebulizer state
    const latestDevice = await this.prisma.device.findFirst({
      where: { patientId: session.patientId },
    });

    return {
      session: {
        id: session.id,
        roomName: session.roomName,
        token: session.token,
        status: session.status,
        patientId: session.patientId,
        doctorId: session.doctorId,
        patientName: session.patient?.user?.fullName,
        doctorName: session.doctor?.user?.fullName,
        startedAt: session.startedAt,
      },
      liveVitalsOverlay: {
        spo2: latestVitals?.spo2 || null,
        bpm: latestVitals?.bpm || null,
        bodyTemperature: latestVitals?.bodyTemperature || null,
        recordedAt: latestVitals?.recordedAt || null,
        deviceOnline: latestDevice?.status === "online",
      },
    };
  }

  /**
   * End session
   */
  async endSession(sessionId) {
    return await this.prisma.telehealthSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        endedAt: new Date(),
      },
    });
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions({ patientId, doctorId }) {
    const where = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;

    return await this.prisma.telehealthSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });
  }
}

module.exports = TelehealthService;
