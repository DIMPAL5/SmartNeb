/**
 * RespiratoryRiskService
 * Transparent, rule-based clinical risk calculation engine for pediatric respiratory monitoring.
 * Discloses exact contributing factors. Does NOT claim autonomous diagnosis.
 * Structured to allow drop-in ML model score integration in the future.
 */

const { PrismaClient } = require("@prisma/client");

class RespiratoryRiskService {
  constructor(prismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Evaluate comprehensive respiratory risk for a patient
   */
  async evaluateRisk({ patientId, aqiOverride }) {
    if (!patientId) throw new Error("patientId is required for risk assessment");

    // 1. Fetch recent health telemetry (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentVitals = await this.prisma.healthTelemetry.findMany({
      where: { patientId, recordedAt: { gte: twoHoursAgo } },
      orderBy: { recordedAt: "desc" },
      take: 20,
    });

    // 2. Fetch latest active alerts (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeAlerts = await this.prisma.alert.findMany({
      where: { patientId, createdAt: { gte: oneDayAgo }, status: "active" },
    });

    // 3. Fetch latest PEF reading
    const latestPef = await this.prisma.pEFReading.findFirst({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
    });

    // 4. Fetch latest Environmental reading
    const latestEnv = await this.prisma.environmentalReading.findFirst({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
    });

    // 5. Evaluate Rule Factors
    const factors = [];
    let score = 0; // 0 to 100

    // Factor A: SpO2 Level & Trend
    const latestVitalsRecord = recentVitals[0];
    if (latestVitalsRecord?.spo2) {
      const curSpo2 = latestVitalsRecord.spo2;
      if (curSpo2 < 88) {
        score += 45;
        factors.push({
          factor: "CRITICAL_SPO2",
          points: 45,
          detail: `Current SpO2 is critically low at ${curSpo2}% (threshold < 88%)`,
        });
      } else if (curSpo2 < 92) {
        score += 25;
        factors.push({
          factor: "LOW_SPO2",
          points: 25,
          detail: `Current SpO2 is below standard baseline at ${curSpo2}% (threshold < 92%)`,
        });
      }

      // Check drop in SpO2 over last hour
      const olderRecord = recentVitals[recentVitals.length - 1];
      if (olderRecord && olderRecord.spo2 && recentVitals.length > 3) {
        const delta = olderRecord.spo2 - curSpo2;
        if (delta >= 4) {
          score += 15;
          factors.push({
            factor: "RAPID_SPO2_DECLINE",
            points: 15,
            detail: `SpO2 decreased by ${delta.toFixed(1)}% over the observation window`,
          });
        }
      }
    }

    // Factor B: Heart Rate (Tachycardia for pediatrics)
    if (latestVitalsRecord?.bpm) {
      const bpm = latestVitalsRecord.bpm;
      if (bpm > 140) {
        score += 15;
        factors.push({
          factor: "ELEVATED_HEART_RATE",
          points: 15,
          detail: `Elevated heart rate (${bpm} BPM), indicating potential respiratory compensation`,
        });
      }
    }

    // Factor C: Body Temperature
    if (latestVitalsRecord?.bodyTemperature && latestVitalsRecord.bodyTemperature > 38.0) {
      score += 10;
      factors.push({
        factor: "FEBRILE_STATE",
        points: 10,
        detail: `Body temperature is elevated (${latestVitalsRecord.bodyTemperature}°C)`,
      });
    }

    // Factor D: Active Unresolved Alerts
    if (activeAlerts.length > 0) {
      const criticalAlerts = activeAlerts.filter((a) => a.severity === "critical");
      const warningAlerts = activeAlerts.filter((a) => a.severity === "warning");
      const alertPoints = criticalAlerts.length * 15 + warningAlerts.length * 8;
      if (alertPoints > 0) {
        score += Math.min(30, alertPoints);
        factors.push({
          factor: "ACTIVE_CLINICAL_ALERTS",
          points: Math.min(30, alertPoints),
          detail: `${criticalAlerts.length} critical and ${warningAlerts.length} warning active alert(s) on file`,
        });
      }
    }

    // Factor E: Peak Expiratory Flow Zone
    if (latestPef) {
      if (latestPef.zone === "Red") {
        score += 30;
        factors.push({
          factor: "PEF_RED_ZONE",
          points: 30,
          detail: `Latest PEF (${latestPef.value} L/min) is in Red Zone (<50% baseline)`,
        });
      } else if (latestPef.zone === "Yellow") {
        score += 15;
        factors.push({
          factor: "PEF_YELLOW_ZONE",
          points: 15,
          detail: `Latest PEF (${latestPef.value} L/min) is in Yellow Zone (50%-79% baseline)`,
        });
      }
    }

    // Factor F: Environmental Air Quality
    const aqi = aqiOverride !== undefined ? Number(aqiOverride) : (latestEnv?.aqi || 45);
    if (aqi > 150) {
      score += 15;
      factors.push({
        factor: "VERY_POOR_AQI",
        points: 15,
        detail: `Ambient Air Quality Index is very poor (${aqi})`,
      });
    } else if (aqi > 100) {
      score += 8;
      factors.push({
        factor: "POOR_AQI",
        points: 8,
        detail: `Ambient Air Quality Index is elevated (${aqi})`,
      });
    }

    // Determine Final Level
    let riskLevel = "LOW RISK";
    let color = "#10B981";
    let advice = "Vitals and respiratory metrics are stable. Maintain standard daily care plan schedule.";

    if (score >= 60) {
      riskLevel = "HIGH RISK";
      color = "#EF4444";
      advice = "Elevated risk signals detected. Conduct an immediate caregiver check, verify vitals, follow doctor emergency instructions, and prepare rescue inhaler/nebulizer.";
    } else if (score >= 25) {
      riskLevel = "MODERATE RISK";
      color = "#F59E0B";
      advice = "Mild respiratory risk factors observed. Monitor child closely and follow clinician's yellow action plan.";
    }

    // Transparent Summary Explanation
    const factorSummaries = factors.map((f) => f.detail).join("; ");
    const explanation = factors.length > 0
      ? `Risk assessed based on: ${factorSummaries}.`
      : "All respiratory vitals and environmental metrics are within safe baseline ranges.";

    // Persist assessment
    const saved = await this.prisma.riskAssessment.create({
      data: {
        patientId,
        riskLevel,
        score: Math.min(100, score),
        factors,
        explanation,
        advice,
      },
    });

    return {
      id: saved.id,
      patientId,
      riskLevel,
      score: saved.score,
      color,
      factors,
      explanation,
      advice,
      evaluatedAt: saved.evaluatedAt,
      disclaimer: "Transparent clinical intelligence indicator to assist caregiver/physician review. Not an autonomous diagnostic device.",
    };
  }

  /**
   * Get historical risk evaluations
   */
  async getHistory({ patientId, limit = 10 }) {
    return await this.prisma.riskAssessment.findMany({
      where: { patientId },
      orderBy: { evaluatedAt: "desc" },
      take: Number(limit),
    });
  }
}

module.exports = RespiratoryRiskService;
