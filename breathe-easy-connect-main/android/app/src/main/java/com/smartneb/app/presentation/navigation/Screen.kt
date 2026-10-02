package com.smartneb.app.presentation.navigation

sealed class Screen(val route: String) {
    object Auth : Screen("auth")
    object ResetPassword : Screen("reset_password")
    
    // Patient Screens
    object PatientDashboard : Screen("patient_dashboard")
    object PatientNebulizer : Screen("patient_nebulizer")
    object PatientMonitoring : Screen("patient_monitoring")
    object PatientHistory : Screen("patient_history")
    object PatientAssistant : Screen("patient_assistant")
    object PatientReports : Screen("patient_reports")
    object PatientSettings : Screen("patient_settings")
    
    // Doctor Screens
    object DoctorDashboard : Screen("doctor_dashboard")
    object DoctorPatientDetail : Screen("doctor_patient_detail/{patientId}") {
        fun createRoute(patientId: String) = "doctor_patient_detail/$patientId"
    }
    
    // Caregiver Screens
    object CaregiverDashboard : Screen("caregiver_dashboard")
    
    // Admin Screens
    object AdminDashboard : Screen("admin_dashboard")
}
