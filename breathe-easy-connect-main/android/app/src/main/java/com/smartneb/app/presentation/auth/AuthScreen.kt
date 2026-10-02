package com.smartneb.app.presentation.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.smartneb.app.R
import com.smartneb.app.presentation.navigation.Screen

@Composable
fun AuthScreen(
    navController: NavController,
    viewModel: AuthViewModel = viewModel()
) {
    val email by viewModel.email.collectAsState()
    val password by viewModel.password.collectAsState()
    val fullName by viewModel.fullName.collectAsState()
    val selectedRole by viewModel.selectedRole.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val authSuccess by viewModel.authSuccess.collectAsState()

    var isSignUpMode by remember { mutableStateOf(false) }

    LaunchedEffect(authSuccess) {
        authSuccess?.let { role ->
            when (role) {
                "patient" -> navController.navigate(Screen.PatientDashboard.route) {
                    popUpTo(Screen.Auth.route) { inclusive = true }
                }
                "doctor" -> navController.navigate(Screen.DoctorDashboard.route) {
                    popUpTo(Screen.Auth.route) { inclusive = true }
                }
                "caregiver" -> navController.navigate(Screen.CaregiverDashboard.route) {
                    popUpTo(Screen.Auth.route) { inclusive = true }
                }
                "admin", "super_admin" -> navController.navigate(Screen.AdminDashboard.route) {
                    popUpTo(Screen.Auth.route) { inclusive = true }
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.primary
            )

            TabRow(selectedTabIndex = if (isSignUpMode) 1 else 0) {
                Tab(
                    selected = !isSignUpMode,
                    onClick = { isSignUpMode = false },
                    text = { Text(stringResource(R.string.sign_in)) }
                )
                Tab(
                    selected = isSignUpMode,
                    onClick = { isSignUpMode = true },
                    text = { Text(stringResource(R.string.sign_up)) }
                )
            }

            if (isSignUpMode) {
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { viewModel.setFullName(it) },
                    label = { Text(stringResource(R.string.full_name)) },
                    modifier = Modifier.fillMaxWidth()
                )
                
                // Role Picker Select
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = stringResource(R.string.role_selector))
                    var expanded by remember { mutableStateOf(false) }
                    Box {
                        Button(onClick = { expanded = true }) {
                            Text(selectedRole.uppercase())
                        }
                        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                            DropdownMenuItem(
                                text = { Text("PATIENT") },
                                onClick = { viewModel.setSelectedRole("patient"); expanded = false }
                            )
                            DropdownMenuItem(
                                text = { Text("DOCTOR") },
                                onClick = { viewModel.setSelectedRole("doctor"); expanded = false }
                            )
                            DropdownMenuItem(
                                text = { Text("CAREGIVER") },
                                onClick = { viewModel.setSelectedRole("caregiver"); expanded = false }
                            )
                        }
                    }
                }
            }

            OutlinedTextField(
                value = email,
                onValueChange = { viewModel.setEmail(it) },
                label = { Text(stringResource(R.string.email)) },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = password,
                onValueChange = { viewModel.setPassword(it) },
                label = { Text(stringResource(R.string.password)) },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )

            error?.let {
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            if (isLoading) {
                CircularProgressIndicator()
            } else {
                Button(
                    onClick = {
                        if (isSignUpMode) viewModel.handleSignUp() else viewModel.handleSignIn()
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = if (isSignUpMode) stringResource(R.string.sign_up) else stringResource(R.string.sign_in)
                    )
                }
            }
        }
    }
}
