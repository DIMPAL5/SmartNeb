package com.smartneb.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.smartneb.app.data.remote.SupabaseManager
import com.smartneb.app.presentation.auth.AuthScreen
import com.smartneb.app.presentation.navigation.Screen
import com.smartneb.app.presentation.patient.PatientDashboardScreen
import com.smartneb.app.presentation.patient.NebulizerScreen
import com.smartneb.app.presentation.patient.AssistantScreen
import com.smartneb.app.presentation.patient.ReportsScreen
import com.smartneb.app.presentation.patient.SettingsScreen
import com.smartneb.app.presentation.doctor.DoctorDashboardScreen
import com.smartneb.app.presentation.doctor.DoctorPatientDetailScreen
import com.smartneb.app.presentation.caregiver.CaregiverDashboardScreen
import com.smartneb.app.presentation.admin.AdminDashboardScreen
import com.smartneb.app.presentation.theme.SmartNebTheme
import io.github.jan.supabase.gotrue.auth

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Supabase SDK
        SupabaseManager.initialize(applicationContext)

        setContent {
            SmartNebTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    val navController = rememberNavController()
                    
                    // Enforce Initial Start Route based on session status
                    val currentUser = SupabaseManager.client.auth.currentUserOrNull()
                    val startRoute = if (currentUser != null) Screen.PatientDashboard.route else Screen.Auth.route

                    NavHost(
                        navController = navController,
                        startDestination = startRoute
                    ) {
                        composable(Screen.Auth.route) {
                            AuthScreen(navController)
                        }
                        
                        // Patient Screens
                        composable(Screen.PatientDashboard.route) {
                            val user = SupabaseManager.client.auth.currentUserOrNull()
                            PatientDashboardScreen(navController, user?.id ?: "")
                        }
                        composable(Screen.PatientNebulizer.route) {
                            val user = SupabaseManager.client.auth.currentUserOrNull()
                            NebulizerScreen(navController, user?.id ?: "")
                        }
                        composable(Screen.PatientAssistant.route) {
                            val user = SupabaseManager.client.auth.currentUserOrNull()
                            AssistantScreen(navController, user?.id ?: "")
                        }
                        composable(Screen.PatientReports.route) {
                            val user = SupabaseManager.client.auth.currentUserOrNull()
                            ReportsScreen(navController, user?.id ?: "")
                        }
                        composable(Screen.PatientSettings.route) {
                            val user = SupabaseManager.client.auth.currentUserOrNull()
                            SettingsScreen(navController, user?.id ?: "")
                        }

                        // Doctor Screens
                        composable(Screen.DoctorDashboard.route) {
                            val user = SupabaseManager.client.auth.currentUserOrNull()
                            DoctorDashboardScreen(navController, user?.id ?: "")
                        }
                        composable(Screen.DoctorPatientDetail.route) { backStackEntry ->
                            val patientId = backStackEntry.arguments?.getString("patientId") ?: ""
                            DoctorPatientDetailScreen(navController, patientId)
                        }

                        // Caregiver Screens
                        composable(Screen.CaregiverDashboard.route) {
                            val user = SupabaseManager.client.auth.currentUserOrNull()
                            CaregiverDashboardScreen(navController, user?.id ?: "")
                        }

                        // Admin Screens
                        composable(Screen.AdminDashboard.route) {
                            AdminDashboardScreen(navController)
                        }
                    }
                }
            }
        }
    }
}
