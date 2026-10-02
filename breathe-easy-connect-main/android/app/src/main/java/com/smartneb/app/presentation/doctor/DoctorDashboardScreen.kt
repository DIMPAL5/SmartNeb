package com.smartneb.app.presentation.doctor

import androidx.compose.foundation.clickable
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
import com.smartneb.app.presentation.navigation.Screen

@Composable
fun DoctorDashboardScreen(
    navController: NavController,
    userId: String,
    viewModel: DoctorViewModel = viewModel()
) {
    val patients by viewModel.assignedPatients.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(userId) {
        viewModel.initialize(userId)
    }

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = { Text(stringResource(R.string.doctor_patients_list)) },
                actions = {
                    TextButton(onClick = {
                        // Sign out handler
                    }) {
                        Text("Logout")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(innerPadding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text(stringResource(R.string.search_patient_hint)) },
                modifier = Modifier.fillMaxWidth()
            )

            if (isLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            val filteredPatients = patients.filter {
                it.full_name.contains(searchQuery, ignoreCase = true) ||
                it.mrn.contains(searchQuery, ignoreCase = true)
            }

            LazyColumn(
                modifier = Modifier.fillMaxWidth().weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (filteredPatients.isEmpty() && !isLoading) {
                    item {
                        Text("No assigned patients matching search criteria.")
                    }
                } else {
                    items(filteredPatients) { p ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    navController.navigate(Screen.DoctorPatientDetail.createRoute(p.id))
                                }
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(text = p.full_name, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                Text(text = "MRN: ${p.mrn}", style = MaterialTheme.typography.bodyMedium)
                                p.condition?.let {
                                    Text(text = "Condition: $it", style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
