package com.smartneb.app.presentation.admin

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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.compose.ui.graphics.Color
import com.smartneb.app.R
import com.smartneb.app.data.model.AuditLog
import com.smartneb.app.data.model.Device
import com.smartneb.app.data.repository.SmartNebRepository
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AdminViewModel : ViewModel() {
    private val repository = SmartNebRepository()

    private val _devices = MutableStateFlow<List<Device>>(emptyList())
    val devices: StateFlow<List<Device>> = _devices

    private val _auditLogs = MutableStateFlow<List<AuditLog>>(emptyList())
    val auditLogs: StateFlow<List<AuditLog>> = _auditLogs

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    fun initialize() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                // Fetch registered devices
                val devList = repository.supabase.postgrest["devices"]
                    .select()
                    .decodeList<Device>()
                _devices.value = devList

                // Fetch audit logs
                val logs = repository.supabase.postgrest["audit_logs"]
                    .select() {
                        order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                        limit(50)
                    }
                    .decodeList<AuditLog>()
                _auditLogs.value = logs
            } catch (e: Exception) {
                // error handling
            } finally {
                _isLoading.value = false
            }
        }
    }
}

@Composable
fun AdminDashboardScreen(
    navController: NavController,
    viewModel: AdminViewModel = viewModel()
) {
    val devices by viewModel.devices.collectAsState()
    val auditLogs by viewModel.auditLogs.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var activeTab by remember { mutableStateOf(0) } // 0: Devices, 1: Audits

    LaunchedEffect(Unit) {
        viewModel.initialize()
    }

    Scaffold(
        topBar = {
            SmallTopAppBar(title = { Text(stringResource(R.string.admin_overview)) })
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            TabRow(selectedTabIndex = activeTab) {
                Tab(selected = activeTab == 0, onClick = { activeTab = 0 }, text = { Text("Devices") })
                Tab(selected = activeTab == 1, onClick = { activeTab = 1 }, text = { Text("Audits") })
            }

            if (isLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            LazyColumn(
                modifier = Modifier.fillMaxWidth().weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (activeTab == 0) {
                    items(devices) { d ->
                        Card(modifier = Modifier.fillParentMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(text = "Code: ${d.device_code}", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                                Text(text = "Firmware: ${d.firmware}")
                                Text(text = "Fluid Chamber: ${d.fluid_level.toInt()}%")
                                val isMqtt = d.mqtt_connected
                                Text(
                                    text = if (isMqtt) "MQTT linked" else "MQTT down",
                                    color = if (isMqtt) MaterialTheme.colorScheme.primary else Color.Gray,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                } else {
                    items(auditLogs) { log ->
                        Card(modifier = Modifier.fillParentMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(text = "Action: ${log.action}", fontWeight = FontWeight.Bold)
                                Text(text = "Actor ID: ${log.actor_id}", fontSize = 12.sp)
                                Text(text = "Time: ${log.created_at.take(19)}", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
