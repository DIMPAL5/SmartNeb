package com.smartneb.app.presentation.patient

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.smartneb.app.R
import com.smartneb.app.data.model.Report
import com.smartneb.app.data.repository.SmartNebRepository
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.File

class ReportsViewModel : ViewModel() {
    private val repository = SmartNebRepository()

    private val _reports = MutableStateFlow<List<Report>>(emptyList())
    val reports: StateFlow<List<Report>> = _reports

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun initialize(userId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resolvedId = repository.resolvePatientId(userId)
                if (resolvedId != null) {
                    val list = repository.supabase.postgrest["reports"]
                        .select() {
                            filter { eq("patient_id", resolvedId) }
                            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                        }
                        .decodeList<Report>()
                    _reports.value = list
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to resolve reports."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun shareCSV(context: Context, report: Report) {
        viewModelScope.launch {
            try {
                val cachePath = File(context.cacheDir, "reports")
                cachePath.mkdirs()
                val csvFile = File(cachePath, "SmartNeb_Report_${report.id.take(6)}.csv")
                
                // Write clinical metrics in CSV layout
                val data = "Report ID,Patient ID,Type,Created At\n${report.id},${report.patient_id},${report.kind},${report.created_at}"
                csvFile.writeText(data)

                val contentUri: Uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    csvFile
                )

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/csv"
                    putExtra(Intent.EXTRA_STREAM, contentUri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(intent, "Share Clinical CSV"))
            } catch (e: Exception) {
                // error handling
            }
        }
    }
}

@Composable
fun ReportsScreen(
    navController: NavController,
    userId: String,
    viewModel: ReportsViewModel = viewModel()
) {
    val reports by viewModel.reports.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val context = LocalContext.current

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
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text(
                        text = stringResource(R.string.nav_reports),
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (reports.isEmpty()) {
                    item {
                        Text(text = "No saved clinical reports.")
                    }
                } else {
                    items(reports) { r ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(text = "Report: ${r.kind.uppercase()}", fontWeight = FontWeight.Bold)
                                Text(text = "Created: ${r.created_at.take(10)}", style = MaterialTheme.typography.bodyMedium)
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(onClick = { viewModel.shareCSV(context, r) }) {
                                        Text("Export CSV")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
