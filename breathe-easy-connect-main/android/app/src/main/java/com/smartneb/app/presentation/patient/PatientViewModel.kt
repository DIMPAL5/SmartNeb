package com.smartneb.app.presentation.patient

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartneb.app.data.model.*
import com.smartneb.app.data.remote.SupabaseManager
import com.smartneb.app.data.repository.SmartNebRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class PatientViewModel : ViewModel() {

    private val repository = SmartNebRepository()

    private val _patientId = MutableStateFlow<String?>(null)
    val patientId: StateFlow<String?> = _patientId

    private val _vitals = MutableStateFlow<HealthTelemetry?>(null)
    val vitals: StateFlow<HealthTelemetry?> = _vitals

    private val _vitalsHistory = MutableStateFlow<List<HealthTelemetry>>(emptyList())
    val vitalsHistory: StateFlow<List<HealthTelemetry>> = _vitalsHistory

    private val _battery = MutableStateFlow<BatteryTelemetry?>(null)
    val battery: StateFlow<BatteryTelemetry?> = _battery

    private val _activeAlerts = MutableStateFlow<List<Alert>>(emptyList())
    val activeAlerts: StateFlow<List<Alert>> = _activeAlerts

    private val _device = MutableStateFlow<Device?>(null)
    val device: StateFlow<Device?> = _device

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun initialize(userId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resolvedId = repository.resolvePatientId(userId)
                _patientId.value = resolvedId
                if (resolvedId != null) {
                    loadDashboardData(resolvedId)
                    subscribeToRealtimeChanges(resolvedId)
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to resolve patient."
            } finally {
                _isLoading.value = false
            }
        }
    }

    private suspend fun loadDashboardData(pId: String) {
        _vitals.value = repository.getLatestTelemetry(pId)
        _vitalsHistory.value = repository.getTelemetrySeries(pId, limit = 50)
        _battery.value = repository.getLatestBattery(pId)
        _activeAlerts.value = repository.getActiveAlerts(pId)
        _device.value = repository.getDeviceByPatient(pId)
    }

    private fun subscribeToRealtimeChanges(pId: String) {
        viewModelScope.launch {
            repository.subscribeToVitals(pId).collect { telemetry ->
                _vitals.value = telemetry
                // Prepend telemetry updates to local series history
                _vitalsHistory.value = listOf(telemetry) + _vitalsHistory.value.take(49)
            }
        }
    }

    fun triggerSOS() {
        val pId = _patientId.value ?: return
        viewModelScope.launch {
            try {
                // Snap vitals as a JSON payload for SOS event tracking
                val vitalsSnap = _vitals.value?.let {
                    "{\"spo2\": ${it.spo2}, \"bpm\": ${it.bpm}, \"temp\": ${it.body_temperature}}"
                }
                repository.triggerSOS(pId, vitalsSnap)
                loadDashboardData(pId)
            } catch (e: Exception) {
                _error.value = "Failed to dispatch SOS: ${e.message}"
            }
        }
    }
}
