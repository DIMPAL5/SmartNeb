package com.smartneb.app.presentation.patient

import android.app.Activity
import android.content.res.Configuration
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.compose.ui.graphics.Color
import com.smartneb.app.R
import com.smartneb.app.data.model.Patient
import com.smartneb.app.data.repository.SmartNebRepository
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.Locale

class SettingsViewModel : ViewModel() {
    private val repository = SmartNebRepository()

    private val _patient = MutableStateFlow<Patient?>(null)
    val patient: StateFlow<Patient?> = _patient

    private val _voiceWarningEnabled = MutableStateFlow(true)
    val voiceWarningEnabled: StateFlow<Boolean> = _voiceWarningEnabled

    private val _currentLanguage = MutableStateFlow("en") // en, hi, kn
    val currentLanguage: StateFlow<String> = _currentLanguage

    fun initialize(userId: String) {
        viewModelScope.launch {
            val resolvedId = repository.resolvePatientId(userId)
            if (resolvedId != null) {
                val list = repository.supabase.postgrest["patients"]
                    .select() {
                        filter { eq("id", resolvedId) }
                    }
                    .decodeList<Patient>()
                _patient.value = list.firstOrNull()
            }
        }
    }

    fun updateThresholds(spo2: Double, bpmLow: Double, bpmHigh: Double) {
        val p = _patient.value ?: return
        viewModelScope.launch {
            repository.supabase.postgrest["patients"].update({
                set("spo2_threshold", spo2)
                set("bpm_low_threshold", bpmLow)
                set("bpm_high_threshold", bpmHigh)
            }) {
                filter { eq("id", p.id) }
            }
            _patient.value = p.copy(
                spo2_threshold = spo2,
                bpm_low_threshold = bpmLow,
                bpm_high_threshold = bpmHigh
            )
        }
    }

    fun setVoiceWarning(enabled: Boolean) {
        _voiceWarningEnabled.value = enabled
    }

    fun setLanguage(lang: String) {
        _currentLanguage.value = lang
    }
}

@Composable
fun SettingsScreen(
    navController: NavController,
    userId: String,
    viewModel: SettingsViewModel = viewModel()
) {
    val patient by viewModel.patient.collectAsState()
    val voiceWarning by viewModel.voiceWarningEnabled.collectAsState()
    val language by viewModel.currentLanguage.collectAsState()

    val context = LocalContext.current

    LaunchedEffect(userId) {
        viewModel.initialize(userId)
    }

    Scaffold(
        bottomBar = { PatientBottomBar(navController) }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            item {
                Text(
                    text = stringResource(R.string.nav_settings),
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            // Language Selector
            item {
                Card(modifier = Modifier.fillParentMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(text = "App Language / भाषा / ಭಾಷೆ", fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            LanguageButton(label = "English", selected = language == "en") {
                                viewModel.setLanguage("en")
                                setLocale(context as Activity, "en")
                            }
                            LanguageButton(label = "हिंदी", selected = language == "hi") {
                                viewModel.setLanguage("hi")
                                setLocale(context as Activity, "hi")
                            }
                            LanguageButton(label = "ಕನ್ನಡ", selected = language == "kn") {
                                viewModel.setLanguage("kn")
                                setLocale(context as Activity, "kn")
                            }
                        }
                    }
                }
            }

            // Voice Alerts preferences
            item {
                Card(modifier = Modifier.fillParentMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "Enable Voice Warning announcements")
                        Switch(checked = voiceWarning, onCheckedChange = { viewModel.setVoiceWarning(it) })
                    }
                }
            }

            // Vital Threshold Sliders
            patient?.let { p ->
                item {
                    Card(modifier = Modifier.fillParentMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(text = "Oxygen Threshold Alerts", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(text = "Min SpO2: ${p.spo2_threshold.toInt()}%", fontSize = 18.sp)
                            Slider(
                                value = p.spo2_threshold.toFloat(),
                                onValueChange = { viewModel.updateThresholds(it.toDouble(), p.bpm_low_threshold, p.bpm_high_threshold) },
                                valueRange = 85f..96f
                            )
                        }
                    }
                }

                item {
                    Card(modifier = Modifier.fillParentMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(text = "Heart Rate Range Alerts", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(text = "Range: ${p.bpm_low_threshold.toInt()} - ${p.bpm_high_threshold.toInt()} bpm", fontSize = 18.sp)
                            
                            // Low slider
                            Slider(
                                value = p.bpm_low_threshold.toFloat(),
                                onValueChange = { viewModel.updateThresholds(p.spo2_threshold, it.toDouble(), p.bpm_high_threshold) },
                                valueRange = 40f..70f
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LanguageButton(label: String, selected: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primary else Color.LightGray
        )
    ) {
        Text(text = label, color = if (selected) Color.White else Color.Black)
    }
}

fun setLocale(activity: Activity, langCode: String) {
    val locale = Locale(langCode)
    Locale.setDefault(locale)
    val config = Configuration(activity.resources.configuration)
    config.setLocale(locale)
    activity.resources.updateConfiguration(config, activity.resources.displayMetrics)
    activity.recreate() // Recreates activity to apply localizations instantly
}
