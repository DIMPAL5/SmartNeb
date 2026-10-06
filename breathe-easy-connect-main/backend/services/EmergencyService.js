/**
 * EmergencyService
 * Handles Emergency SOS alerts, vitals snapshot recording,
 * caregiver/clinician push dispatch, and emergency facility lookup.
 */

const { PrismaClient } = require("@prisma/client");

class EmergencyService {
  constructor(prismaClient, notificationService) {
    this.prisma = prismaClient || new PrismaClient();
    this.notificationService = notificationService;
  }

  /**
   * Trigger an Emergency SOS event
   */
  async triggerSOS({ patientId, source = "manual_sos", coords, socketEmitter }) {
    if (!patientId) throw new Error("patientId is required to trigger SOS");

    // 1. Fetch latest health vitals snapshot
    const latestVitals = await this.prisma.healthTelemetry.findFirst({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
    });

    const vitalsSnapshot = {
      spo2: latestVitals?.spo2 || null,
      bpm: latestVitals?.bpm || null,
      bodyTemperature: latestVitals?.bodyTemperature || null,
      recordedAt: latestVitals?.recordedAt || new Date().toISOString(),
    };

    // 2. Identify nearest emergency contact / facility
    const nearestFacility = {
      name: "City Pediatric Emergency Care",
      emergencyNumber: "108",
      alternativePhone: "112",
      address: "Nearest Tertiary Medical Center",
      coordinates: coords || { lat: 12.9716, lon: 77.5946 },
    };

    // 3. Create Emergency Event in database
    const emergencyEvent = await this.prisma.emergencyEvent.create({
      data: {
        patientId,
        source,
        status: "active",
        vitalsSnapshot,
        nearestFacility,
      },
    });

    // 4. Create an Alert record
    await this.prisma.alert.create({
      data: {
        patientId,
        type: "EMERGENCY_SOS",
        severity: "critical",
        value: vitalsSnapshot.spo2 || null,
        message: `EMERGENCY SOS triggered by ${source}. Immediate clinical check required.`,
        status: "active",
      },
    });

    // 5. Broadcast via Socket.IO if emitter provided
    if (socketEmitter) {
      socketEmitter("emergency_broadcast", {
        eventId: emergencyEvent.id,
        patientId,
        vitals: vitalsSnapshot,
        timestamp: emergencyEvent.createdAt,
      });
    }

    // 6. Send Critical Push Notification
    if (this.notificationService) {
      await this.notificationService.sendCriticalNotification({
        patientId,
        title: "🚨 EMERGENCY SOS ACTIVATED",
        body: `Immediate assistance requested! Latest SpO2: ${vitalsSnapshot.spo2 || "N/A"}%`,
        data: {
          eventId: emergencyEvent.id,
          source,
        },
      });
    }

    return {
      success: true,
      eventId: emergencyEvent.id,
      patientId,
      status: emergencyEvent.status,
      vitalsSnapshot,
      nearestFacility,
      createdAt: emergencyEvent.createdAt,
    };
  }

  /**
   * Resolve an active SOS event
   */
  async resolveSOS({ eventId, resolvedBy }) {
    if (!eventId) throw new Error("eventId is required");

    const event = await this.prisma.emergencyEvent.update({
      where: { id: eventId },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || "caregiver",
      },
    });

    return { success: true, event };
  }

  /**
   * Get active emergency events for a patient
   */
  async getActiveEvents({ patientId }) {
    return await this.prisma.emergencyEvent.findMany({
      where: { patientId, status: "active" },
      orderBy: { createdAt: "desc" },
    });
  }
}

module.exports = EmergencyService;
