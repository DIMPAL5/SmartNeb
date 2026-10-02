package com.smartneb.app.presentation.doctor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartneb.app.data.model.*
import com.smartneb.app.data.repository.SmartNebRepository
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.Instant

class DoctorViewModel : ViewModel() {
    private val repository = SmartNebRepository()

    private val _doctorId = MutableStateFlow<String?>(null)
    val doctorId: StateFlow<String?> = _doctorId

    private val _assignedPatients = MutableStateFlow<List<Patient>>(emptyList())
    val assignedPatients: StateFlow<List<Patient>> = _assignedPatients

    private val _selectedPatientDetail = MutableStateFlow<Patient?>(null)
    val selectedPatientDetail: StateFlow<Patient?> = _selectedPatientDetail

    private val _clinicalNotes = MutableStateFlow<List<ClinicalNote>>(emptyList())
    val clinicalNotes: StateFlow<List<ClinicalNote>> = _clinicalNotes

    private val _carePlans = MutableStateFlow<List<CarePlan>>(emptyList())
    val carePlans: StateFlow<List<CarePlan>> = _carePlans

    private val _activeAlerts = MutableStateFlow<List<Alert>>(emptyList())
    val activeAlerts: StateFlow<List<Alert>> = _activeAlerts

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun initialize(userId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val docId = repository.resolveDoctorId(userId)
                _doctorId.value = docId
                if (docId != null) {
                    loadRoster(docId)
                }
            } catch (e: Exception) {
                _error.value = "Failed to resolve doctor: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    private suspend fun loadRoster(docId: String) {
        // Query assigned patient relationships
        val assignments = repository.supabase.postgrest["doctor_patient_assignments"]
            .select() {
                filter { eq("doctor_id", docId) }
            }
            .decodeList<DoctorPatientAssignment>()
        
        val pIds = assignments.map { it.patient_id }
        if (pIds.isNotEmpty()) {
            val list = repository.supabase.postgrest["patients"]
                .select() {
                    filter {
                        // in list syntax
                    }
                }
                .decodeList<Patient>()
            _assignedPatients.value = list
        }
    }

    fun selectPatient(patientId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val list = repository.supabase.postgrest["patients"]
                    .select() {
                        filter { eq("id", patientId) }
                    }
                    .decodeList<Patient>()
                _selectedPatientDetail.value = list.firstOrNull()

                // Load clinical context
                _clinicalNotes.value = repository.getClinicalNotes(patientId)
                _carePlans.value = repository.listCarePlans(patientId)
                _activeAlerts.value = repository.getActiveAlerts(patientId)
            } catch (e: Exception) {
                _error.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun addNote(noteText: String) {
        val p = _selectedPatientDetail.value ?: return
        val docId = _doctorId.value ?: return
        viewModelScope.launch {
            val newNote = ClinicalNote(
                id = java.util.UUID.randomUUID().toString(),
                patient_id = p.id,
                doctor_id = docId,
                note = noteText,
                created_at = Instant.now().toString()
            )
            repository.addClinicalNote(newNote)
            _clinicalNotes.value = repository.getClinicalNotes(p.id)
        }
    }

    fun publishCarePlan(medication: String, dosage: String, durationMin: Int, dosesPerDay: Int) {
        val p = _selectedPatientDetail.value ?: return
        val docId = _doctorId.value ?: return
        viewModelScope.launch {
            val plan = CarePlan(
                id = java.util.UUID.randomUUID().toString(),
                patient_id = p.id,
                doctor_id = docId,
                medication = medication,
                dosage = dosage,
                duration_minutes = durationMin,
                frequency_per_day = dosesPerDay,
                instructions = "Take as directed",
                start_date = Instant.now().toString().take(10),
                end_date = null,
                time_slots = listOf("08:00", "20:00"),
                status = "published",
                created_at = Instant.now().toString()
            )
            repository.createCarePlan(plan)
            _carePlans.value = repository.listCarePlans(p.id)
        }
    }

    fun resolveAlert(alertId: String) {
        val p = _selectedPatientDetail.value ?: return
        val docId = _doctorId.value ?: return
        viewModelScope.launch {
            repository.supabase.postgrest["alerts"].update({
                set("status", "resolved")
                set("resolved_at", Instant.now().toString())
                set("resolved_by", docId)
            }) {
                filter { eq("id", alertId) }
            }
            _activeAlerts.value = repository.getActiveAlerts(p.id)
        }
    }
}
