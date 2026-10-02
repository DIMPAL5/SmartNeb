package com.smartneb.app.presentation.caregiver

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
import com.smartneb.app.R
import com.smartneb.app.data.model.CaregiverPatientAssignment
import com.smartneb.app.data.model.Patient
import com.smartneb.app.data.repository.SmartNebRepository
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class CaregiverViewModel : ViewModel() {
    private val repository = SmartNebRepository()

    private val _caregiverId = MutableStateFlow<String?>(null)
    val caregiverId: StateFlow<String?> = _caregiverId

    private val _patients = MutableStateFlow<List<Patient>>(emptyList())
    val patients: StateFlow<List<Patient>> = _patients

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    fun initialize(userId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val cgId = repository.resolveCaregiverId(userId)
                _caregiverId.value = cgId
                if (cgId != null) {
                    val assignments = repository.supabase.postgrest["caregiver_patient_assignments"]
                        .select() {
                            filter { eq("caregiver_id", cgId) }
                        }
                        .decodeList<CaregiverPatientAssignment>()

                    val pIds = assignments.map { it.patient_id }
                    if (pIds.isNotEmpty()) {
                        val list = repository.supabase.postgrest["patients"]
                            .select() {
                                // in list syntax
                            }
                            .decodeList<Patient>()
                        _patients.value = list
                    }
                }
            } catch (e: Exception) {
                // error logging
            } finally {
                _isLoading.value = false
            }
        }
    }
}

@Composable
fun CaregiverDashboardScreen(
    navController: NavController,
    userId: String,
    viewModel: CaregiverViewModel = viewModel()
) {
    val patients by viewModel.patients.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    LaunchedEffect(userId) {
        viewModel.initialize(userId)
    }

    Scaffold(
        topBar = {
            SmallTopAppBar(title = { Text(stringResource(R.string.caregiver_assigned)) })
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
                if (patients.isEmpty()) {
                    item { Text("No patients assigned to your care roster.") }
                } else {
                    items(patients) { p ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(text = p.full_name, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                Text(text = "MRN: ${p.mrn}")
                                Text(text = "Condition: ${p.condition ?: "Not specified"}")
                                
                                Divider()
                                // Caregivers can view patient parameters, but they are read-only
                                Text(text = "Clinical metrics are monitored by assigned doctors.", style = MaterialTheme.typography.bodyMedium, color = androidx.compose.ui.graphics.Color.Gray)
                            }
                        }
                    }
                }
            }
        }
    }
}
