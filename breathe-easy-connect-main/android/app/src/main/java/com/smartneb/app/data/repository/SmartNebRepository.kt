package com.smartneb.app.data.repository

import com.smartneb.app.data.model.*
import com.smartneb.app.data.remote.SupabaseManager
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.decodeRecord
import io.github.jan.supabase.realtime.PostgresAction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Instant

class SmartNebRepository {

    val supabase get() = SupabaseManager.client

    /* ------------------------------------------------------------------ */
    /* Identity & Role Management                                         */
    /* ------------------------------------------------------------------ */

    suspend fun getMe(userId: String): Profile {
        return supabase.postgrest["profiles"]
            .select() {
                filter {
                    eq("id", userId)
                }
            }
            .decodeSingle<Profile>()
    }

    suspend fun getRole(userId: String): String? {
        val roles = supabase.postgrest["user_roles"]
            .select() {
                filter {
                    eq("user_id", userId)
                }
            }
            .decodeList<UserRole>()
        return roles.firstOrNull()?.role
    }

    suspend fun resolvePatientId(userId: String): String? {
        val patients = supabase.postgrest["patients"]
            .select() {
                filter {
                    eq("user_id", userId)
                }
            }
            .decodeList<Patient>()
        return patients.firstOrNull()?.id
    }

    suspend fun resolveDoctorId(userId: String): String? {
        val doctors = supabase.postgrest["doctors"]
            .select() {
                filter {
                    eq("user_id", userId)
                }
            }
            .decodeList<Doctor>()
        return doctors.firstOrNull()?.id
    }

    suspend fun resolveCaregiverId(userId: String): String? {
        val caregivers = supabase.postgrest["caregivers"]
            .select() {
                filter {
                    eq("user_id", userId)
                }
            }
            .decodeList<Caregiver>()
        return caregivers.firstOrNull()?.id
    }

    /* ------------------------------------------------------------------ */
    /* Telemetry & Vitals                                                 */
    /* ------------------------------------------------------------------ */

    suspend fun getLatestTelemetry(patientId: String): HealthTelemetry? {
        val list = supabase.postgrest["health_telemetry"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                }
                order("recorded_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(1)
            }
            .decodeList<HealthTelemetry>()
        return list.firstOrNull()
    }

    suspend fun getTelemetrySeries(patientId: String, limit: Int = 100): List<HealthTelemetry> {
        return supabase.postgrest["health_telemetry"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                }
                order("recorded_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList<HealthTelemetry>()
    }

    suspend fun getLatestBattery(patientId: String): BatteryTelemetry? {
        val list = supabase.postgrest["battery_telemetry"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                }
                order("recorded_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(1)
            }
            .decodeList<BatteryTelemetry>()
        return list.firstOrNull()
    }

    /* ------------------------------------------------------------------ */
    /* Nebulizer Sessions                                                 */
    /* ------------------------------------------------------------------ */

    suspend fun startSession(patientId: String, medication: String?, dosage: String?, prescribedSeconds: Int): NebulizationSession {
        val newSession = NebulizationSession(
            id = java.util.UUID.randomUUID().toString(),
            patient_id = patientId,
            care_plan_id = null,
            status = "running",
            medication = medication,
            dosage = dosage,
            prescribed_seconds = prescribedSeconds,
            elapsed_seconds = 0,
            started_at = Instant.now().toString(),
            updated_at = Instant.now().toString(),
            ended_at = null
        )
        supabase.postgrest["nebulization_sessions"].insert(newSession)
        return newSession
    }

    suspend fun updateSessionProgress(sessionId: String, elapsedSeconds: Int, status: String): Boolean {
        supabase.postgrest["nebulization_sessions"].update({
            set("elapsed_seconds", elapsedSeconds)
            set("status", status)
            set("updated_at", Instant.now().toString())
            if (status == "completed" || status == "stopped") {
                set("ended_at", Instant.now().toString())
            }
        }) {
            filter {
                eq("id", sessionId)
            }
        }
        return true
    }

    suspend fun refillChamber(patientId: String, levelAfter: Double): Boolean {
        // Fetch current level first to calculate level_before
        val currentDevice = getDeviceByPatient(patientId)
        val levelBefore = currentDevice?.fluid_level ?: 0.0

        val refill = FluidRefill(
            id = java.util.UUID.randomUUID().toString(),
            patient_id = patientId,
            device_id = currentDevice?.id,
            level_before = levelBefore,
            level_after = levelAfter,
            created_at = Instant.now().toString()
        )
        supabase.postgrest["fluid_refills"].insert(refill)

        if (currentDevice != null) {
            supabase.postgrest["devices"].update({
                set("fluid_level", levelAfter)
                set("last_seen_at", Instant.now().toString())
            }) {
                filter { eq("id", currentDevice.id) }
            }
        }
        return true
    }

    suspend fun getDeviceByPatient(patientId: String): Device? {
        val list = supabase.postgrest["devices"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                }
            }
            .decodeList<Device>()
        return list.firstOrNull()
    }

    /* ------------------------------------------------------------------ */
    /* SOS Alarms                                                         */
    /* ------------------------------------------------------------------ */

    suspend fun triggerSOS(patientId: String, vitalsJson: String?): SOSEvent {
        val sos = SOSEvent(
            id = java.util.UUID.randomUUID().toString(),
            patient_id = patientId,
            source = "app",
            status = "active",
            vitals = vitalsJson,
            severity = "critical",
            created_at = Instant.now().toString(),
            acknowledged_at = null,
            acknowledged_by = null,
            resolved_at = null,
            resolved_by = null
        )
        supabase.postgrest["sos_events"].insert(sos)
        return sos
    }

    suspend fun respondToSOS(sosId: String, action: String, responderId: String): Boolean {
        val now = Instant.now().toString()
        supabase.postgrest["sos_events"].update({
            set("status", if (action == "resolve") "resolved" else "acknowledged")
            if (action == "resolve") {
                set("resolved_at", now)
                set("resolved_by", responderId)
            } else {
                set("acknowledged_at", now)
                set("acknowledged_by", responderId)
            }
        }) {
            filter {
                eq("id", sosId)
            }
        }
        return true
    }

    /* ------------------------------------------------------------------ */
    /* Alerts                                                             */
    /* ------------------------------------------------------------------ */

    suspend fun getActiveAlerts(patientId: String): List<Alert> {
        return supabase.postgrest["alerts"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                    eq("status", "active")
                }
            }
            .decodeList<Alert>()
    }

    suspend fun getAlertHistory(patientId: String): List<Alert> {
        return supabase.postgrest["alerts"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                }
                order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            }
            .decodeList<Alert>()
    }

    suspend fun acknowledgeAlert(alertId: String, clinicianId: String): Boolean {
        supabase.postgrest["alerts"].update({
            set("status", "acknowledged")
            set("acknowledged_at", Instant.now().toString())
            set("acknowledged_by", clinicianId)
        }) {
            filter {
                eq("id", alertId)
            }
        }
        return true
    }

    /* ------------------------------------------------------------------ */
    /* Care Plans                                                         */
    /* ------------------------------------------------------------------ */

    suspend fun listCarePlans(patientId: String): List<CarePlan> {
        return supabase.postgrest["care_plans"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                }
                order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            }
            .decodeList<CarePlan>()
    }

    suspend fun createCarePlan(plan: CarePlan): Boolean {
        supabase.postgrest["care_plans"].insert(plan)
        return true
    }

    suspend fun setCarePlanStatus(planId: String, status: String): Boolean {
        supabase.postgrest["care_plans"].update({
            set("status", status)
        }) {
            filter {
                eq("id", planId)
            }
        }
        return true
    }

    /* ------------------------------------------------------------------ */
    /* Notes                                                              */
    /* ------------------------------------------------------------------ */

    suspend fun getClinicalNotes(patientId: String): List<ClinicalNote> {
        return supabase.postgrest["clinical_notes"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                }
                order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            }
            .decodeList<ClinicalNote>()
    }

    suspend fun addClinicalNote(note: ClinicalNote): Boolean {
        supabase.postgrest["clinical_notes"].insert(note)
        return true
    }

    suspend fun getCaregiverNotes(patientId: String): List<CaregiverNote> {
        return supabase.postgrest["caregiver_notes"]
            .select() {
                filter {
                    eq("patient_id", patientId)
                }
                order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            }
            .decodeList<CaregiverNote>()
    }

    suspend fun addCaregiverNote(note: CaregiverNote): Boolean {
        supabase.postgrest["caregiver_notes"].insert(note)
        return true
    }

    /* ------------------------------------------------------------------ */
    /* Realtime Subscriptions (Dynamic Flows)                              */
    /* ------------------------------------------------------------------ */

    fun subscribeToVitals(patientId: String): Flow<HealthTelemetry> {
        val channel = supabase.realtime.channel("patient-vitals-$patientId")
        val vitalsFlow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "health_telemetry"
            filter = "patient_id=eq.$patientId"
        }.map { changeAction ->
            when (changeAction) {
                is PostgresAction.Insert -> changeAction.decodeRecord<HealthTelemetry>()
                is PostgresAction.Update -> changeAction.decodeRecord<HealthTelemetry>()
                else -> throw IllegalStateException("Unsupported realtime database change action")
            }
        }
        return vitalsFlow
    }
}
