/**
 * PEFService
 * Peak Expiratory Flow (PEF) tracking and asthma zone management.
 * Computes Green, Yellow, and Red zones based on clinician-configured personal best baseline.
 */

const { PrismaClient } = require("@prisma/client");

class PEFService {
  constructor(prismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Determine Asthma Action Plan Zone
   * Green: >= 80% (Well controlled)
   * Yellow: 50% - 79% (Caution / airway narrowing)
   * Red: < 50% (Medical alert / Emergency)
   */
  evaluateZone(ratioPercent) {
    if (ratioPercent >= 80) {
      return {
        zone: "Green",
        label: "Good Control (≥80%)",
        color: "#10B981",
        guidance: "Breathing is well-controlled. Continue regular maintenance care plan.",
      };
    } else if (ratioPercent >= 50) {
      return {
        zone: "Yellow",
        label: "Caution (50% - 79%)",
        color: "#F59E0B",
        guidance: "Airway narrowing detected. Follow clinician's Yellow Zone action instructions and monitor closely.",
      };
    } else {
      return {
        zone: "Red",
        label: "Medical Alert (<50%)",
        color: "#EF4444",
        guidance: "Severe airway limitation. Administer quick-relief medication immediately and seek medical attention as advised by your doctor.",
      };
    }
  }

  /**
   * Record a new Peak Expiratory Flow reading
   */
  async recordReading({ patientId, value, baselineOverride, symptoms, note, recordedAt }) {
    if (!patientId || value === undefined || value === null) {
      throw new Error("patientId and PEF value are required");
    }

    const pefValue = Number(value);
    if (pefValue <= 0 || pefValue > 900) {
      throw new Error("PEF reading must be between 1 and 900 L/min");
    }

    // Determine baseline: Clinician-specified baseline or patient's personal best reading
    let baseline = baselineOverride ? Number(baselineOverride) : null;

    if (!baseline) {
      const bestRecord = await this.prisma.pEFReading.findFirst({
        where: { patientId },
        orderBy: { value: "desc" },
      });
      baseline = bestRecord ? Math.max(bestRecord.value, pefValue) : pefValue;
    }

    const ratioPercent = Math.round((pefValue / baseline) * 100);
    const zoneAssessment = this.evaluateZone(ratioPercent);

    const record = await this.prisma.pEFReading.create({
      data: {
        patientId,
        value: pefValue,
        baselineValue: baseline,
        ratioPercent,
        zone: zoneAssessment.zone,
        symptoms: symptoms || null,
        note: note || null,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      },
    });

    return {
      id: record.id,
      patientId: record.patientId,
      value: record.value,
      baselineValue: record.baselineValue,
      ratioPercent: record.ratioPercent,
      zone: record.zone,
      zoneDetails: zoneAssessment,
      symptoms: record.symptoms,
      note: record.note,
      recordedAt: record.recordedAt,
    };
  }

  /**
   * Retrieve PEF readings and trend analysis
   */
  async getHistory({ patientId, limit = 30 }) {
    if (!patientId) throw new Error("patientId is required");

    const readings = await this.prisma.pEFReading.findMany({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
      take: Number(limit),
    });

    const values = readings.map((r) => r.value);
    const personalBest = values.length > 0 ? Math.max(...values) : 0;
    const average = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

    return {
      patientId,
      personalBest,
      average,
      totalEntries: readings.length,
      readings,
    };
  }
}

module.exports = PEFService;
