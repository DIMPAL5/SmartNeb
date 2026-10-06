/**
 * OfflineSyncService
 * High-reliability idempotent synchronization service for offline-cached telemetry,
 * treatment sessions, PEF records, and alerts.
 */

const { PrismaClient } = require("@prisma/client");

class OfflineSyncService {
  constructor(prismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Process a batch of offline-recorded items idempotently
   * @param {Object} params
   * @param {string} params.patientId
   * @param {Array} params.records
   */
  async syncBatch({ patientId, records }) {
    if (!patientId) {
      throw new Error("patientId is required for offline synchronization");
    }

    if (!Array.isArray(records) || records.length === 0) {
      return { processed: 0, duplicatesSkipped: 0, errors: [] };
    }

    let processed = 0;
    let duplicatesSkipped = 0;
    const errors = [];

    for (const item of records) {
      const { idempotencyKey, recordType, payload, recordedAt, deviceId } = item;

      if (!idempotencyKey) {
        errors.push({ error: "Missing idempotencyKey in record", item });
        continue;
      }

      // Check if already synced
      const existing = await this.prisma.offlineSyncRecord.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        duplicatesSkipped++;
        continue;
      }

      try {
        const timestamp = recordedAt ? new Date(recordedAt) : new Date();

        switch (recordType) {
          case "health_telemetry":
            await this.prisma.healthTelemetry.create({
              data: {
                patientId,
                deviceId: deviceId || null,
                bpm: payload?.bpm !== undefined ? Number(payload.bpm) : null,
                spo2: payload?.spo2 !== undefined ? Number(payload.spo2) : null,
                bodyTemperature: payload?.bodyTemperature !== undefined ? Number(payload.bodyTemperature) : null,
                recordedAt: timestamp,
              },
            });
            break;

          case "nebulization_session":
            await this.prisma.nebulizationSession.create({
              data: {
                id: payload?.id || undefined,
                patientId,
                deviceId: deviceId || null,
                medication: payload?.medication || null,
                dosage: payload?.dosage || null,
                prescribedSeconds: Number(payload?.prescribedSeconds || 600),
                elapsedSeconds: Number(payload?.elapsedSeconds || 0),
                status: payload?.status || "completed",
                startedAt: payload?.startedAt ? new Date(payload.startedAt) : timestamp,
                endedAt: payload?.endedAt ? new Date(payload.endedAt) : timestamp,
              },
            });
            break;

          case "pef_reading":
            await this.prisma.pEFReading.create({
              data: {
                patientId,
                value: Number(payload.value),
                baselineValue: Number(payload.baselineValue || payload.value),
                ratioPercent: Number(payload.ratioPercent || 100),
                zone: payload.zone || "Green",
                symptoms: payload.symptoms || null,
                note: payload.note || null,
                recordedAt: timestamp,
              },
            });
            break;

          case "environmental_telemetry":
            await this.prisma.environmentalTelemetry.create({
              data: {
                patientId,
                deviceId: deviceId || null,
                ambientTemperature: payload?.ambientTemperature !== undefined ? Number(payload.ambientTemperature) : null,
                humidity: payload?.humidity !== undefined ? Number(payload.humidity) : null,
                aqi: payload?.aqi !== undefined ? Number(payload.aqi) : null,
                recordedAt: timestamp,
              },
            });
            break;

          default:
            // Generic offline telemetry or event
            break;
        }

        // Record offline sync log
        await this.prisma.offlineSyncRecord.create({
          data: {
            patientId,
            deviceId: deviceId || null,
            idempotencyKey,
            recordType: recordType || "unknown",
            payload: payload || {},
            syncedAt: new Date(),
          },
        });

        processed++;
      } catch (err) {
        errors.push({ idempotencyKey, error: err.message });
      }
    }

    return {
      success: true,
      processed,
      duplicatesSkipped,
      errors,
      syncedAt: new Date().toISOString(),
    };
  }
}

module.exports = OfflineSyncService;
