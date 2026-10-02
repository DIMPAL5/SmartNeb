package com.smartneb.app.presentation.doctor

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.smartneb.app.R

@Composable
fun DoctorPatientDetailScreen(
    navController: NavController,
    patientId: String,
    viewModel: DoctorViewModel = viewModel()
) {
    val patient by viewModel.selectedPatientDetail.collectAsState()
    val clinicalNotes by viewModel.clinicalNotes.collectAsState()
    val carePlans by viewModel.carePlans.collectAsState()
    val activeAlerts by viewModel.activeAlerts.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var noteText by remember { mutableStateOf("") }
    var medication by remember { mutableStateOf("") }
    var dosage by remember { mutableStateOf("") }
    var duration by remember { mutableStateOf("10") }
    var frequency by remember { mutableStateOf("2") }

    LaunchedEffect(patientId) {
        viewModel.selectPatient(patientId)
    }

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = { Text(patient?.full_name ?: "Patient Details") },
                navigationIcon = {
                    TextButton(onClick = { navController.popBackStack() }) {
                        Text("Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Patient stats summary
                patient?.let { p ->
                    item {
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(text = "Clinical Thresholds", fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Min SpO2: ${p.spo2_threshold.toInt()}%")
                                Text("Heart Rate: ${p.bpm_low_threshold.toInt()} - ${p.bpm_high_threshold.toInt()} bpm")
                            }
                        }
                    }
                }

                // Active alerts list
                item {
                    Text(text = "Active Alerts", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
                if (activeAlerts.isEmpty()) {
                    item { Text("No active alerts.") }
                } else {
                    items(activeAlerts) { alert ->
                        Card(modifier = Modifier.fillParentMaxWidth()) {
                            Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(text = alert.message, fontWeight = FontWeight.Bold)
                                    Text(text = "Severity: ${alert.severity}", fontSize = 12.sp)
                                }
                                Button(onClick = { viewModel.resolveAlert(alert.id) }) {
                                    Text("Resolve")
                                }
                            }
                        }
                    }
                }

                // Add Clinical Note Form
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(text = stringResource(R.string.clinical_note_add), fontWeight = FontWeight.Bold)
                            OutlinedTextField(
                                value = noteText,
                                onValueChange = { noteText = it },
                                label = { Text("Write notes…") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(onClick = {
                                viewModel.addNote(noteText)
                                noteText = ""
                            }) {
                                Text("Save Note")
                            }
                        }
                    }
                }

                // Clinical notes history logs
                item {
                    Text(text = "Notes Log History", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
                items(clinicalNotes) { note ->
                    Card(modifier = Modifier.fillParentMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(text = note.note)
                            Text(text = "Saved: ${note.created_at.take(16)}", fontSize = 11.sp, color = androidx.compose.ui.graphics.Color.Gray)
                        }
                    }
                }

                // Create Care Plan Form
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(text = stringResource(R.string.care_plan_new), fontWeight = FontWeight.Bold)
                            OutlinedTextField(
                                value = medication,
                                onValueChange = { medication = it },
                                label = { Text("Medication Name") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = dosage,
                                onValueChange = { dosage = it },
                                label = { Text("Dosage (e.g. 2.5mg)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(onClick = {
                                viewModel.publishCarePlan(medication, dosage, duration.toInt(), frequency.toInt())
                                medication = ""
                                dosage = ""
                            }) {
                                Text("Publish Care Plan")
                            }
                        }
                    }
                }
            }
        }
    }
}
