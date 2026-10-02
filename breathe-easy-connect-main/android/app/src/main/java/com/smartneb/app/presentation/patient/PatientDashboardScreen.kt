package com.smartneb.app.presentation.patient

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.smartneb.app.presentation.theme.PrimaryTeal
import com.smartneb.app.R
import com.smartneb.app.data.model.HealthTelemetry
import com.smartneb.app.presentation.navigation.Screen
import com.smartneb.app.presentation.theme.CriticalRed
import com.smartneb.app.presentation.theme.VitalGreen
import com.smartneb.app.presentation.theme.WarnYellow

@Composable
fun PatientDashboardScreen(
    navController: NavController,
    userId: String,
    viewModel: PatientViewModel = viewModel()
) {
    val vitals by viewModel.vitals.collectAsState()
    val vitalsHistory by viewModel.vitalsHistory.collectAsState()
    val battery by viewModel.battery.collectAsState()
    val activeAlerts by viewModel.activeAlerts.collectAsState()
    val device by viewModel.device.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    var showSOSConfirmation by remember { mutableStateOf(false) }

    LaunchedEffect(userId) {
        viewModel.initialize(userId)
    }

    Scaffold(
        bottomBar = { PatientBottomBar(navController) }
    ) { innerPadding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (error != null) {
            Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
                Text(text = error ?: "", color = MaterialTheme.colorScheme.error)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text(
                        text = "SmartNeb Command Center",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                // SOS Trigger Panel
                item {
                    Button(
                        onClick = { showSOSConfirmation = true },
                        colors = ButtonDefaults.buttonColors(containerColor = CriticalRed),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(64.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.sos_alarm),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }

                // Device Connectivity Status
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = stringResource(R.string.device_status))
                            val isOnline = device?.mqtt_connected == true
                            val statusColor = if (isOnline) VitalGreen else WarnYellow
                            val statusText = if (isOnline) "MQTT Linked" else "MQTT Down (Offline Sim)"
                            
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .background(statusColor, shape = RoundedCornerShape(5.dp))
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(text = statusText, color = statusColor, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }

                // Vitals metrics grid
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        VitalCard(
                            title = stringResource(R.string.vitals_spo2),
                            value = vitals?.spo2?.let { "${it.toInt()}%" } ?: "--",
                            statusColor = resolveSpo2Status(vitals?.spo2),
                            modifier = Modifier.weight(1f)
                        )
                        VitalCard(
                            title = stringResource(R.string.vitals_bpm),
                            value = vitals?.bpm?.let { "${it.toInt()} bpm" } ?: "--",
                            statusColor = resolveBpmStatus(vitals?.bpm),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // Analytics Vitals Graph Drawing via Canvas
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth().height(180.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(text = "24h Oxygen Saturation Trend (%)", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(16.dp))
                            ComposeTelemetryChart(data = vitalsHistory)
                        }
                    }
                }

                // Battery metrics
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = stringResource(R.string.device_battery))
                            Text(
                                text = battery?.percentage?.let { "${it.toInt()}%" } ?: "--",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Active alerts banner lists
                if (activeAlerts.isNotEmpty()) {
                    item {
                        Text(text = "Active Warnings", fontWeight = FontWeight.SemiBold, color = WarnYellow)
                    }
                    items(activeAlerts) { alert ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                        ) {
                            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = CriticalRed)
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(text = alert.type.uppercase(), fontWeight = FontWeight.Bold, color = CriticalRed)
                                    Text(text = alert.message, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showSOSConfirmation) {
        AlertDialog(
            onDismissRequest = { showSOSConfirmation = false },
            title = { Text(stringResource(R.string.sos_confirm_title)) },
            text = { Text(stringResource(R.string.sos_confirm_desc)) },
            dismissButton = {
                TextButton(onClick = { showSOSConfirmation = false }) {
                    Text(stringResource(R.string.sos_cancel))
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.triggerSOS()
                        showSOSConfirmation = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CriticalRed)
                ) {
                    Text(stringResource(R.string.sos_trigger))
                }
            }
        )
    }
}

@Composable
fun VitalCard(title: String, value: String, statusColor: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(text = title, style = MaterialTheme.typography.bodyMedium, color = Color.Gray)
            Text(text = value, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = statusColor)
        }
    }
}

@Composable
fun ComposeTelemetryChart(data: List<HealthTelemetry>) {
    Canvas(modifier = Modifier.fillMaxSize()) {
        if (data.size < 2) return@Canvas
        val width = size.width
        val height = size.height
        val maxPoints = data.size
        
        val points = data.mapIndexed { idx, item ->
            val valX = width - (idx * (width / (maxPoints - 1)))
            val spo2 = item.spo2 ?: 95.0
            val valY = height - (((spo2 - 80) / 20) * height).toFloat()
            Offset(valX, valY.coerceIn(0f, height))
        }

        val path = Path().apply {
            moveTo(points.first().x, points.first().y)
            for (i in 1 until points.size) {
                lineTo(points[i].x, points[i].y)
            }
        }
        drawPath(path, color = PrimaryTeal, style = Stroke(width = 4f))
    }
}

@Composable
fun PatientBottomBar(navController: NavController) {
    NavigationBar {
        NavigationBarItem(
            selected = true,
            onClick = { navController.navigate(Screen.PatientDashboard.route) },
            icon = { Text("Dash") }
        )
        NavigationBarItem(
            selected = false,
            onClick = { navController.navigate(Screen.PatientNebulizer.route) },
            icon = { Text("Neb") }
        )
        NavigationBarItem(
            selected = false,
            onClick = { navController.navigate(Screen.PatientAssistant.route) },
            icon = { Text("AI") }
        )
        NavigationBarItem(
            selected = false,
            onClick = { navController.navigate(Screen.PatientSettings.route) },
            icon = { Text("Settings") }
        )
    }
}

fun resolveSpo2Status(spo2: Double?): Color {
    if (spo2 == null) return Color.Gray
    return when {
        spo2 >= 92.0 -> VitalGreen
        spo2 >= 89.0 -> WarnYellow
        else -> CriticalRed
    }
}

fun resolveBpmStatus(bpm: Double?): Color {
    if (bpm == null) return Color.Gray
    return when {
        bpm in 55.0..120.0 -> VitalGreen
        bpm in 45.0..135.0 -> WarnYellow
        else -> CriticalRed
    }
}
