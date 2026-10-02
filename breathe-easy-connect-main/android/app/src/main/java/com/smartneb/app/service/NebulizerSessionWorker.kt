package com.smartneb.app.service

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.smartneb.app.data.repository.SmartNebRepository

class NebulizerSessionWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private val repository = SmartNebRepository()

    override suspend fun doWork(): Result {
        val sessionId = inputData.getString("SESSION_ID") ?: return Result.failure()
        val elapsedSeconds = inputData.getInt("ELAPSED_SECONDS", 0)

        return try {
            // Persist session heartbeats to Supabase
            val success = repository.updateSessionProgress(sessionId, elapsedSeconds, "running")
            if (success) Result.success() else Result.retry()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
