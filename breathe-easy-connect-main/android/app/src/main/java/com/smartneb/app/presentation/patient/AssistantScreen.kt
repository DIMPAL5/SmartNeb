package com.smartneb.app.presentation.patient

import android.speech.tts.TextToSpeech
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.smartneb.app.R
import com.smartneb.app.data.model.AIMessage
import com.smartneb.app.data.repository.SmartNebRepository
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import io.ktor.client.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.util.Locale

class AssistantViewModel : ViewModel() {
    private val repository = SmartNebRepository()
    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json()
        }
    }

    private val _messages = MutableStateFlow<List<AIMessage>>(emptyList())
    val messages: StateFlow<List<AIMessage>> = _messages

    private val _inputText = MutableStateFlow("")
    val inputText: StateFlow<String> = _inputText

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun initialize(userId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                // Fetch latest conversation messages from Supabase
                val list = repository.supabase.postgrest["ai_messages"]
                    .select() {
                        order("created_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
                    }
                    .decodeList<AIMessage>()
                _messages.value = list
            } catch (e: Exception) {
                _error.value = "Failed to load history: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun setInputText(value: String) { _inputText.value = value }

    fun askQuestion(text: String) {
        if (text.isBlank()) return
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            // Append temporary user message to UI immediately
            val tempUserMessage = AIMessage("", "", "user", text, "")
            _messages.value = _messages.value + tempUserMessage
            _inputText.value = ""

            try {
                // Call server proxy using user token headers
                val response = client.post("https://xaotsjwxodtnobilpmah.supabase.co/functions/v1/gemini-assistant") {
                    header("Authorization", "Bearer ${repository.supabase.auth.currentSessionOrNull()?.accessToken}")
                    setBody(mapOf("question" to text))
                }
                
                if (response.status.value == 200) {
                    val bodyText = response.bodyAsText()
                    // Extract model answer
                    val modelAnswer = Json.parseToJsonElement(bodyText)
                    val assistantMsg = AIMessage("", "", "assistant", bodyText, "")
                    _messages.value = _messages.value + assistantMsg
                } else if (response.status.value == 429) {
                    _error.value = "Hourly limit of 30 queries reached."
                } else {
                    _error.value = "Failed to receive response from assistant."
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to connect to gateway."
            } finally {
                _isLoading.value = false
            }
        }
    }
}

@Composable
fun AssistantScreen(
    navController: NavController,
    userId: String,
    viewModel: AssistantViewModel = viewModel()
) {
    val messages by viewModel.messages.collectAsState()
    val inputText by viewModel.inputText.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    val context = LocalContext.current
    var tts: TextToSpeech? by remember { mutableStateOf(null) }

    LaunchedEffect(userId) {
        viewModel.initialize(userId)
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.getDefault()
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            tts?.shutdown()
        }
    }

    Scaffold(
        bottomBar = { PatientBottomBar(navController) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.assistant_title),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // Medical Disclaimer Banner
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
            ) {
                Text(
                    text = stringResource(R.string.ai_disclaimer),
                    fontSize = 11.sp,
                    color = Color.DarkGray,
                    modifier = Modifier.padding(10.dp)
                )
            }

            // Message Stream
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(messages) { msg ->
                    val alignment = if (msg.role == "user") Alignment.CenterEnd else Alignment.CenterStart
                    val bubbleColor = if (msg.role == "user") MaterialTheme.colorScheme.primary else Color.LightGray
                    val textColor = if (msg.role == "user") Color.White else Color.Black
                    
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = alignment) {
                        Surface(
                            color = bubbleColor,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .widthIn(max = 280.dp)
                                .clickable {
                                    if (msg.role == "assistant") {
                                        tts?.speak(msg.content, TextToSpeech.QUEUE_FLUSH, null, null)
                                    }
                                }
                        ) {
                            Text(
                                text = msg.content,
                                color = textColor,
                                modifier = Modifier.padding(12.dp),
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }

            // Suggested pills selector
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                SuggestionPill(text = "How is my SpO2 today?") { viewModel.askQuestion("How is my SpO2 today?") }
                SuggestionPill(text = "Show my care plan.") { viewModel.askQuestion("Show my care plan.") }
            }

            if (isLoading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            error?.let {
                Text(text = it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 4.dp))
            }

            // Inputs row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { viewModel.setInputText(it) },
                    placeholder = { Text(stringResource(R.string.assistant_hint)) },
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Button(onClick = { viewModel.askQuestion(inputText) }) {
                    Text("Send")
                }
            }
        }
    }
}

@Composable
fun SuggestionPill(text: String, onClick: () -> Unit) {
    Card(
        modifier = Modifier.clickable { onClick() },
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(text = text, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), fontSize = 12.sp)
    }
}
