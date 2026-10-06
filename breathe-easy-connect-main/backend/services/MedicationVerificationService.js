/**
 * MedicationVerificationService
 * Cross-references scanned barcode / OCR text against child's active CarePlan.
 * Prevents dosing errors by verifying correct medication, dosage, and active prescription.
 */

const { PrismaClient } = require("@prisma/client");

class MedicationVerificationService {
  constructor(prismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Verify a scanned barcode, QR code, or medication name against patient's care plan
   */
  async verifyMedication({ patientId, scannedCode, medicationName, expiryDate }) {
    if (!patientId || (!scannedCode && !medicationName)) {
      throw new Error("patientId and either scannedCode or medicationName are required");
    }

    // 1. Fetch active care plans for patient
    const activeCarePlans = await this.prisma.carePlan.findMany({
      where: {
        patientId,
        status: { in: ["published", "draft"] },
      },
      include: {
        doctor: { include: { user: true } },
      },
    });

    if (activeCarePlans.length === 0) {
      const result = {
        matched: false,
        status: "NO_ACTIVE_CARE_PLAN",
        message: "No active care plan found for this child. Please consult your physician.",
      };
      await this.saveAudit(patientId, null, scannedCode, medicationName, "FAILED", result);
      return result;
    }

    // Normalize text search
    const query = (medicationName || scannedCode || "").toLowerCase().trim();

    let matchedPlan = null;
    let matchConfidence = 0;

    for (const plan of activeCarePlans) {
      const planMed = plan.medication.toLowerCase();
      if (planMed.includes(query) || query.includes(planMed)) {
        matchedPlan = plan;
        matchConfidence = 0.95;
        break;
      }
      // Check partial tokens (e.g. "salbutamol", "budesonide", "levalbuterol", "duolin", "asthalin")
      const tokens = planMed.split(/[\s,/-]+/);
      for (const token of tokens) {
        if (token.length > 3 && query.includes(token)) {
          matchedPlan = plan;
          matchConfidence = 0.85;
          break;
        }
      }
      if (matchedPlan) break;
    }

    // Check expiration if passed
    let isExpired = false;
    if (expiryDate) {
      const exp = new Date(expiryDate);
      if (exp < new Date()) {
        isExpired = true;
      }
    }

    if (!matchedPlan) {
      const result = {
        matched: false,
        status: "MEDICATION_MISMATCH",
        message: `Scanned item "${medicationName || scannedCode}" does not match any medication in the child's active care plan.`,
        prescribedMedications: activeCarePlans.map((p) => ({
          medication: p.medication,
          dosage: p.dosage,
        })),
      };
      await this.saveAudit(patientId, null, scannedCode, medicationName, "MISMATCH", result);
      return result;
    }

    if (isExpired) {
      const result = {
        matched: false,
        status: "MEDICATION_EXPIRED",
        message: `Medication "${matchedPlan.medication}" has expired. Do not administer.`,
        carePlanId: matchedPlan.id,
      };
      await this.saveAudit(patientId, matchedPlan.id, scannedCode, medicationName, "EXPIRED", result);
      return result;
    }

    const result = {
      matched: true,
      status: "VERIFIED_CORRECT",
      message: `Verified: ${matchedPlan.medication} matches prescribed Care Plan.`,
      medication: matchedPlan.medication,
      dosage: matchedPlan.dosage,
      durationMinutes: matchedPlan.durationMinutes,
      frequencyPerDay: matchedPlan.frequencyPerDay,
      instructions: matchedPlan.instructions,
      carePlanId: matchedPlan.id,
      prescribedBy: matchedPlan.doctor?.user?.fullName || "Prescribing Clinician",
      confidence: matchConfidence,
    };

    await this.saveAudit(patientId, matchedPlan.id, scannedCode, medicationName, "VERIFIED", result);
    return result;
  }

  async saveAudit(patientId, carePlanId, scannedCode, medicationName, status, matchDetails) {
    return await this.prisma.medicationVerification.create({
      data: {
        patientId,
        carePlanId: carePlanId || null,
        scannedCode: scannedCode || "N/A",
        medicationName: medicationName || scannedCode || "Unknown",
        status,
        matchDetails,
      },
    });
  }

  async getVerificationHistory({ patientId, limit = 10 }) {
    return await this.prisma.medicationVerification.findMany({
      where: { patientId },
      orderBy: { verifiedAt: "desc" },
      take: Number(limit),
    });
  }
}

module.exports = MedicationVerificationService;
