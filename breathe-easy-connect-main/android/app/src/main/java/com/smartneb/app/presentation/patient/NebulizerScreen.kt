package com.smartneb.app.presentation.patient

import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.smartneb.app.R
import com.smartneb.app.data.model.Device
import com.smartneb.app.data.model.NebulizationSession
import com.smartneb.app.data.repository.SmartNebRepository
import com.smartneb.app.presentation.theme.CriticalRed
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.Instant

class NebulizerViewModel : ViewModel() {
    private val repository = SmartNebRepository()

    private val _patientId = MutableStateFlow<String?>(null)
    val patientId: StateFlow<String?> = _patientId

    private val _device = MutableStateFlow<Device?>(null)
    val device: StateFlow<Device?> = _device

    private val _activeSession = MutableStateFlow<NebulizationSession?>(null)
    val activeSession: StateFlow<NebulizationSession?> = _activeSession

    private val _elapsedSeconds = MutableStateFlow(0)
    val elapsedSeconds: StateFlow<Int> = _elapsedSeconds

    private val _chamberLevel = MutableStateFlow(50f) // slider control (0-100%)
    val chamberLevel: StateFlow<Float> = _chamberLevel

    private var timerJob: Job? = null
    private var heartbeatJob: Job? = null

    fun initialize(userId: String) {
        viewModelScope.launch {
            val resolvedId = repository.resolvePatientId(userId)
            _patientId.value = resolvedId
            if (resolvedId != null) {
                _device.value = repository.getDeviceByPatient(resolvedId)
                _chamberLevel.value = _device.value?.fluid_level?.toFloat() ?: 50f
                restoreActiveSession(resolvedId)
            }
        }
    }

    private suspend fun restoreActiveSession(pId: String) {
        // Look for running or paused sessions in DB
        val sessions = repository.supabase.postgrest["nebulization_sessions"]
            .select() {
                filter {
                    eq("patient_id", pId)
                    or {
                        eq("status", "running")
                        eq("status", "paused")
                    }
                }
                order("started_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(1)
            }
            .decodeList<NebulizationSession>()

        val active = sessions.firstOrNull()
        if (active != null) {
            _activeSession.value = active
            
            // Drift recovery catch-up:
            // elapsed_seconds = current_elapsed + (now - updated_at) if running
            if (active.status == "running") {
                val lastUpdate = Instant.parse(active.updated_at).toEpochMilli()
                val now = Instant.now().toEpochMilli()
                val drift = ((now - lastUpdate) / 1000).toInt()
                _elapsedSeconds.value = active.elapsed_seconds + drift
                startTimer()
                startHeartbeat()
            } else {
                _elapsedSeconds.value = active.elapsed_seconds
            }
        }
    }

    fun startSession(prescribedSeconds: Int = 600) {
        val pId = _patientId.value ?: return
        viewModelScope.launch {
            val session = repository.startSession(pId, "Salbutamol", "2.5mg", prescribedSeconds)
            _activeSession.value = session
            _elapsedSeconds.value = 0
            startTimer()
            startHeartbeat()
        }
    }

    fun pauseSession() {
        val session = _activeSession.value ?: return
        viewModelScope.launch {
            repository.updateSessionProgress(session.id, _elapsedSeconds.value, "paused")
            _activeSession.value = session.copy(status = "paused", elapsed_seconds = _elapsedSeconds.value)
            stopTimer()
        }
    }

    fun resumeSession() {
        val session = _activeSession.value ?: return
        viewModelScope.launch {
            repository.updateSessionProgress(session.id, _elapsedSeconds.value, "running")
            _activeSession.value = session.copy(status = "running")
            startTimer()
            startHeartbeat()
        }
    }

    fun stopSession() {
        val session = _activeSession.value ?: return
        viewModelScope.launch {
            repository.updateSessionProgress(session.id, _elapsedSeconds.value, "completed")
            _activeSession.value = null
            _elapsedSeconds.value = 0
            stopTimer()
            playCompletionChime()
        }
    }

    fun refillChamber(level: Float) {
        val pId = _patientId.value ?: return
        viewModelScope.launch {
            repository.refillChamber(pId, level.toDouble())
            _device.value = repository.getDeviceByPatient(pId)
            _chamberLevel.value = level
        }
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (true) {
                delay(1000)
                _elapsedSeconds.value += 1
            }
        }
    }

    private fun stopTimer() {
        timerJob?.cancel()
        heartbeatJob?.cancel()
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = viewModelScope.launch {
            while (true) {
                delay(15000) // 15-second heartbeat persistence
                val session = _activeSession.value
                if (session != null) {
                    repository.updateSessionProgress(session.id, _elapsedSeconds.value, "running")
                }
            }
        }
    }

    private fun playCompletionChime() {
        try {
            // Plays dual tone (880Hz -> 1174Hz equivalent sine)
            val toneGen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 200) // first beep
            Thread.sleep(300)
            toneGen.startTone(ToneGenerator.TONE_PROP_ACK, 250) // completion beep
        } catch (e: Exception) {
            // fallback if tone generator fails
        }
    }

    override fun onCleared() {
        stopTimer()
        super.onCleared()
    }
}

@Composable
fun NebulizerScreen(
    navController: NavController,
    userId: String,
    viewModel: NebulizerViewModel = viewModel()
) {
    val device by viewModel.device.collectAsState()
    val activeSession by viewModel.activeSession.collectAsState()
    val elapsedSeconds by viewModel.elapsedSeconds.collectAsState()
    val chamberLevel by viewModel.chamberLevel.collectAsState()

    LaunchedEffect(userId) {
        viewModel.initialize(userId)
    }

    Scaffold(
        bottomBar = { PatientBottomBar(navController) }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            item {
                Text(
                    text = stringResource(R.string.nav_nebulizer),
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            // Chamber Fluid Level control
            item {
                Card(modifier = Modifier.fillParentMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = stringResource(R.string.chamber_fluid), fontWeight = FontWeight.SemiBold)
                        Text(text = "${chamberLevel.toInt()}%", fontSize = 48.sp, color = MaterialTheme.colorScheme.primary)
                        
                        Slider(
                            value = chamberLevel,
                            onValueChange = { viewModel.refillChamber(it) },
                            valueRange = 0f..100f,
                            modifier = Modifier.fillMaxWidth()
                        )
                        
                        Button(onClick = { viewModel.refillChamber(100f) }) {
                            Text(stringResource(R.string.chamber_refill))
                        }
                    }
                }
            }

            // Session timer control
            item {
                Card(modifier = Modifier.fillParentMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        val sessionStatus = activeSession?.status ?: "READY"
                        Text(text = "STATUS: ${sessionStatus.uppercase()}", fontWeight = FontWeight.Bold)

                        val minutes = elapsedSeconds / 60
                        val seconds = elapsedSeconds % 60
                        Text(
                            text = String.format("%02d:%02d", minutes, seconds),
                            fontSize = 64.sp,
                            fontWeight = FontWeight.Light
                        )

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            if (activeSession == null) {
                                Button(onClick = { viewModel.startSession() }) {
                                    Text(stringResource(R.string.start_session))
                                }
                            } else {
                                if (activeSession?.status == "running") {
                                    Button(onClick = { viewModel.pauseSession() }) {
                                        Text(stringResource(R.string.pause_session))
                                    }
                                } else {
                                    Button(onClick = { viewModel.resumeSession() }) {
                                        Text(stringResource(R.string.resume_session))
                                    }
                                }
                                Button(
                                    onClick = { viewModel.stopSession() },
                                    colors = ButtonDefaults.buttonColors(containerColor = CriticalRed)
                                ) {
                                    Text(stringResource(R.string.stop_session))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
