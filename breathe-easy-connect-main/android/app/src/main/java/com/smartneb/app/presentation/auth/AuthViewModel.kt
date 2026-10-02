package com.smartneb.app.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartneb.app.data.remote.SupabaseManager
import com.smartneb.app.data.repository.SmartNebRepository
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AuthViewModel : ViewModel() {

    private val repository = SmartNebRepository()

    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password

    private val _fullName = MutableStateFlow("")
    val fullName: StateFlow<String> = _fullName

    private val _selectedRole = MutableStateFlow("patient") // patient, doctor, caregiver, admin
    val selectedRole: StateFlow<String> = _selectedRole

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _authSuccess = MutableStateFlow<String?>(null) // Contains resolved role on success
    val authSuccess: StateFlow<String?> = _authSuccess

    fun setEmail(value: String) { _email.value = value }
    fun setPassword(value: String) { _password.value = value }
    fun setFullName(value: String) { _fullName.value = value }
    fun setSelectedRole(value: String) { _selectedRole.value = value }

    fun handleSignIn() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                // Call Supabase GoTrue Auth
                SupabaseManager.client.auth.signInWith(Email, config = {
                    this.email = _email.value
                    this.password = _password.value
                })
                
                // Fetch logged-in user profile role
                val user = SupabaseManager.client.auth.currentUserOrNull()
                if (user != null) {
                    val profile = repository.getMe(user.id)
                    if (!profile.is_active) {
                        _error.value = "Your account is deactivated. Contact Admin."
                        SupabaseManager.client.auth.signOut()
                    } else {
                        val role = repository.getRole(user.id)
                        _authSuccess.value = role ?: "patient"
                    }
                } else {
                    _error.value = "Authentication failed."
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Authentication failed."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun handleSignUp() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                // SignUp using metadata mapping (role, full_name)
                SupabaseManager.client.auth.signUpWith(Email, config = {
                    this.email = _email.value
                    this.password = _password.value
                    this.data = buildJsonObject {
                        put("full_name", _fullName.value)
                        put("role", _selectedRole.value)
                    }
                })
                
                // Supabase trigger automatically populates profiles and user_roles tables.
                _error.value = "Signup successful. Verify your email to activate."
            } catch (e: Exception) {
                _error.value = e.message ?: "Signup failed."
            } finally {
                _isLoading.value = false
            }
        }
    }
}
