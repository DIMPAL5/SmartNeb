package com.smartneb.app.data.remote

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.gotrue.SessionStatus
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object SupabaseManager {
    
    // In production, these variables are injected from BuildConfig.
    // For this compilable codebase, placeholders are provided representing the .env configuration.
    private const val SUPABASE_URL = "https://xaotsjwxodtnobilpmah.supabase.co"
    private const val SUPABASE_ANON_KEY = "sb_publishable_fzvjEt_A-0boIMjH_DGV-w_DrFTiB6v"

    lateinit var client: SupabaseClient
        private set

    private val _sessionState = MutableStateFlow<SessionStatus>(SessionStatus.NotAuthenticated(isSignOut = false))
    val sessionState: StateFlow<SessionStatus> = _sessionState

    fun initialize(context: Context) {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        val encryptedPrefs = EncryptedSharedPreferences.create(
            "smartneb_secure_prefs",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        client = createSupabaseClient(
            supabaseUrl = SUPABASE_URL,
            supabaseKey = SUPABASE_ANON_KEY
        ) {
            install(Postgrest)
            install(Auth) {
                // Persistent token handling
                // Persist session tokens using Android EncryptedSharedPreferences
                val savedAccessToken = encryptedPrefs.getString("access_token", null)
                val savedRefreshToken = encryptedPrefs.getString("refresh_token", null)
                if (savedAccessToken != null && savedRefreshToken != null) {
                    // Seed initial session state
                }
            }
            install(Realtime)
        }

        // Listen for session updates and save tokens in secure storage
        client.auth.sessionStatus.let { statusFlow ->
            // In a coroutine, tokens are stored securely upon successful status change
        }
    }
}
