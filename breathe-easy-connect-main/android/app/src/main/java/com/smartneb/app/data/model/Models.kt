package com.smartneb.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Profile(
    val id: String,
    val email: String?,
    val full_name: String,
    val phone: String?,
    val is_active: Boolean = true,
    val created_at: String
)

@Serializable
data class UserRole(
    val id: String,
    val user_id: String,
    val role: String,
    val created_at: String
)

@Serializable
data class Patient(
    val id: String,
    val user_id: String?,
    val full_name: String,
    val mrn: String,
    val condition: String?,
    val date_of_birth: String?,
    val sex: String?,
    val spo2_threshold: Double,
    val bpm_low_threshold: Double,
    val bpm_high_threshold: Double,
    val temp_threshold: Double,
    val created_at: String
)

@Serializable
data class Doctor(
    val id: String,
    val user_id: String?,
    val full_name: String,
    val specialty: String?,
    val created_at: String
)

@Serializable
data class Caregiver(
    val id: String,
    val user_id: String?,
    val full_name: String,
    val relation: String?,
    val created_at: String
)

@Serializable
data class DoctorPatientAssignment(
    val id: String,
    val doctor_id: String,
    val patient_id: String,
    val created_at: String
)

@Serializable
data class CaregiverPatientAssignment(
    val id: String,
    val caregiver_id: String,
    val patient_id: String,
    val created_at: String
)

@Serializable
data class Device(
    val id: String,
    val patient_id: String?,
    val device_code: String,
    val status: String,
    val firmware: String,
    val mqtt_connected: Boolean,
    val cloud_connected: Boolean,
    val fluid_level: Double,
    val nebulizer_state: String,
    val last_seen_at: String?,
    val registered_at: String
)

@Serializable
data class HealthTelemetry(
    val id: String,
    val patient_id: String,
    val device_id: String?,
    val bpm: Double?,
    val spo2: Double?,
    val body_temperature: Double?,
    val recorded_at: String
)

@Serializable
data class EnvironmentalTelemetry(
    val id: String,
    val patient_id: String,
    val device_id: String?,
    val ambient_temperature: Double?,
    val humidity: Double?,
    val aqi: Double?,
    val recorded_at: String
)

@Serializable
data class BatteryTelemetry(
    val id: String,
    val patient_id: String,
    val device_id: String?,
    val percentage: Double?,
    val voltage: Double?,
    val current: Double?,
    val cell_temperature: Double?,
    val charging: Boolean,
    val recorded_at: String
)

@Serializable
data class CarePlan(
    val id: String,
    val patient_id: String,
    val doctor_id: String?,
    val medication: String,
    val dosage: String,
    val duration_minutes: Int,
    val frequency_per_day: Int,
    val instructions: String?,
    val start_date: String,
    val end_date: String?,
    val time_slots: List<String> = emptyList(),
    val status: String, // published, paused, ended, draft
    val created_at: String
)

@Serializable
data class NebulizationSession(
    val id: String,
    val patient_id: String,
    val care_plan_id: String?,
    val status: String, // pending, starting, running, paused, completed, stopped
    val medication: String?,
    val dosage: String?,
    val prescribed_seconds: Int,
    val elapsed_seconds: Int,
    val started_at: String,
    val updated_at: String,
    val ended_at: String?,
    val simulated: Boolean = false
)

@Serializable
data class AdherenceRecord(
    val id: String,
    val patient_id: String,
    val care_plan_id: String,
    val scheduled_for: String, // YYYY-MM-DD
    val status: String, // completed, partial, missed, pending
    val completion_ratio: Double,
    val created_at: String
)

@Serializable
data class FluidRefill(
    val id: String,
    val patient_id: String,
    val device_id: String?,
    val level_before: Double,
    val level_after: Double,
    val created_at: String
)

@Serializable
data class DeviceCommand(
    val id: String,
    val device_id: String,
    val command: String,
    val status: String,
    val payload: String?,
    val created_at: String
)

@Serializable
data class Alert(
    val id: String,
    val patient_id: String,
    val device_id: String?,
    val type: String, // vital_spo2, vital_bpm, battery, connectivity, fluid
    val severity: String, // critical, warning, info
    val status: String, // active, acknowledged, resolved
    val message: String,
    val value: Double?,
    val threshold: Double?,
    val created_at: String,
    val acknowledged_at: String?,
    val acknowledged_by: String?,
    val resolved_at: String?,
    val resolved_by: String?
)

@Serializable
data class SOSEvent(
    val id: String,
    val patient_id: String,
    val source: String, // app, physical_button
    val status: String, // active, acknowledged, resolved
    val vitals: String?, // JSON serialized vital snaps at trigger
    val severity: String,
    val created_at: String,
    val acknowledged_at: String?,
    val acknowledged_by: String?,
    val resolved_at: String?,
    val resolved_by: String?
)

@Serializable
data class Notification(
    val id: String,
    val user_id: String,
    val patient_id: String?,
    val type: String, // care_plan, alert, sos
    val title: String,
    val body: String?,
    val read_at: String?,
    val created_at: String
)

@Serializable
data class ClinicalNote(
    val id: String,
    val patient_id: String,
    val doctor_id: String,
    val note: String,
    val created_at: String
)

@Serializable
class CaregiverNote(
    val id: String,
    val patient_id: String,
    val caregiver_id: String,
    val author_id: String,
    val note: String,
    val created_at: String
)

@Serializable
data class Report(
    val id: String,
    val patient_id: String,
    val requested_by: String,
    val range_start: String?,
    val range_end: String?,
    val kind: String,
    val format: String,
    val payload: String?, // JSON clinical summary data
    val created_at: String
)

@Serializable
data class AuditLog(
    val id: String,
    val actor_id: String,
    val action: String,
    val target_type: String?,
    val target_id: String?,
    val meta: String?, // JSON details
    val created_at: String
)

@Serializable
data class AIConversation(
    val id: String,
    val user_id: String,
    val created_at: String
)

@Serializable
data class AIMessage(
    val id: String,
    val conversation_id: String,
    val role: String, // user, assistant
    val content: String,
    val created_at: String
)
