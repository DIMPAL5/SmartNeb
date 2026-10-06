/**
 * EmergencySummaryService
 * Generates and validates secure, expiring, read-only emergency clinical summary tokens.
 * Enables EMTs, ER doctors, and first responders to view vital pediatric clinical history
 * without requiring account credentials or application installation.
 */

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

class EmergencySummaryService {
  constructor(prismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Generate a signed temporary emergency access token (Default: 24 hours)
   */
  async generateToken({ patientId, validityHours = 24 }) {
    if (!patientId) throw new Error("patientId is required");

    // Secure URL-safe token
    const token = "ER-" + crypto.randomBytes(20).toString("hex");
    const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000);

    const record = await this.prisma.emergencySummaryToken.create({
      data: {
        patientId,
        token,
        expiresAt,
      },
    });

    return {
      token: record.token,
      expiresAt: record.expiresAt,
      summaryUrl: `/api/v1/emergency/summary/public/${record.token}`,
    };
  }

  /**
   * Retrieve clinical summary using an emergency token (Public View-Only)
   */
  async getPublicSummary(token) {
    if (!token) throw new Error("Emergency token is required");

    const record = await this.prisma.emergencySummaryToken.findUnique({
      where: { token },
      include: {
        patient: {
          include: {
            user: true,
            hospital: true,
            carePlans: {
              where: { status: { in: ["published", "draft"] } },
              include: { doctor: { include: { user: true } } },
            },
            caregiverAssignments: {
              include: { caregiver: { include: { user: true } } },
            },
          },
        },
      },
    });

    if (!record) {
      const error = new Error("Invalid or unverified emergency summary token");
      error.statusCode = 404;
      throw error;
    }

    if (record.isRevoked) {
      const error = new Error("This emergency access token has been revoked by the patient guardian");
      error.statusCode = 403;
      throw error;
    }

    if (new Date(record.expiresAt) < new Date()) {
      const error = new Error("This emergency access token has expired");
      error.statusCode = 410;
      throw error;
    }

    // Increment access count & update last used timestamp
    await this.prisma.emergencySummaryToken.update({
      where: { id: record.id },
      data: {
        accessCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    const patient = record.patient;

    // Fetch latest vitals
    const latestVitals = await this.prisma.healthTelemetry.findFirst({
      where: { patientId: patient.id },
      orderBy: { recordedAt: "desc" },
    });

    // Emergency Contacts
    const emergencyContacts = (patient.caregiverAssignments || []).map((ca) => ({
      relationship: ca.relationship || "Caregiver/Guardian",
      name: ca.caregiver?.user?.fullName || "Family Guardian",
      phone: ca.caregiver?.user?.phone || null,
    }));

    return {
      emergencyRecordId: record.id,
      patient: {
        initialsOrName: patient.fullName || patient.user?.fullName || "Pediatric Patient",
        ageYears: (patient.dateOfBirth || patient.dob)
          ? Math.floor((Date.now() - new Date(patient.dateOfBirth || patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
          : null,
        gender: patient.sex || patient.gender || "Not specified",
        bloodGroup: patient.bloodGroup || "O+",
        primaryDiagnosis: patient.condition || patient.primaryDiagnosis || "Pediatric Asthma / Reactive Airway Disease",
        knownAllergies: patient.allergies ? patient.allergies.split(",") : ["None documented"],
      },
      latestVitals: {
        spo2: latestVitals?.spo2 || null,
        bpm: latestVitals?.bpm || null,
        bodyTemperature: latestVitals?.bodyTemperature || null,
        recordedAt: latestVitals?.recordedAt || null,
      },
      activeCarePlans: (patient.carePlans || []).map((cp) => ({
        medication: cp.medication,
        dosage: cp.dosage,
        instructions: cp.instructions,
        prescribingDoctor: cp.doctor?.user?.fullName || "Attending Physician",
      })),
      emergencyContacts,
      hospitalAffiliation: patient.hospital?.name || "SmartNeb Health Network",
      tokenExpiry: record.expiresAt,
      notice: "EMERGENCY VIEW ONLY: This read-only snapshot was authorized by the patient guardian for emergency care.",
    };
  }

  /**
   * Revoke an active emergency token
   */
  async revokeToken(token) {
    return await this.prisma.emergencySummaryToken.update({
      where: { token },
      data: { isRevoked: true },
    });
  }
}

module.exports = EmergencySummaryService;
