package co.visionchain.mobilenode

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * HeadlessJS Task Service for running JavaScript code in the background.
 *
 * This service is triggered by NodeForegroundService to execute
 * heartbeat and block verification logic on the JS thread.
 */
class VisionHeadlessTaskService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val taskData = Arguments.createMap()

        return HeadlessJsTaskConfig(
            "VisionNodeHeartbeat",
            taskData,
            5000L,   // timeout: 5 seconds
            true     // allow in foreground
        )
    }
}
