package co.visionchain.mobilenode

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments

/**
 * Android Foreground Service for Vision Mobile Node.
 *
 * Keeps the app alive in the background to:
 * 1. Send periodic heartbeats to the backend
 * 2. Verify block headers via WebSocket (when on WiFi)
 * 3. Relay messages for the on-chain messenger
 *
 * Shows a persistent notification so Android doesn't kill the process.
 */
class NodeForegroundService : Service() {

    companion object {
        private const val TAG = "NodeForegroundService"
        private const val CHANNEL_ID = "vision_node_channel"
        private const val CHANNEL_NAME = "Vision Node"
        private const val NOTIFICATION_ID = 1001
        private const val HEADLESS_TASK_NAME = "VisionNodeHeartbeat"
        private const val HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000L // 5 minutes (adjusted by JS side)

        fun start(context: Context) {
            val intent = Intent(context, NodeForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, NodeForegroundService::class.java)
            context.stopService(intent)
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var heartbeatThread: Thread? = null
    private var isRunning = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service started")

        // Show persistent notification
        val notification = buildNotification("Vision Node is running", "Verifying blocks and earning rewards")
        startForeground(NOTIFICATION_ID, notification)

        // Acquire wake lock to prevent CPU from sleeping
        acquireWakeLock()

        // Start heartbeat loop
        startHeartbeatLoop()

        isRunning = true

        // Restart if killed
        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "Service destroyed")
        isRunning = false
        heartbeatThread?.interrupt()
        heartbeatThread = null
        releaseWakeLock()
        super.onDestroy()
    }

    /**
     * Create notification channel (required for Android O+)
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW // Low = no sound, shows in status bar
            ).apply {
                description = "Vision Chain node background service"
                setShowBadge(false)
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * Build the persistent notification shown in the status bar
     */
    private fun buildNotification(title: String, body: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    /**
     * Update the notification text (e.g., show verified block count)
     */
    fun updateNotification(title: String, body: String) {
        val notification = buildNotification(title, body)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    /**
     * Start the heartbeat loop that triggers HeadlessJS tasks
     */
    private fun startHeartbeatLoop() {
        heartbeatThread = Thread {
            while (isRunning && !Thread.currentThread().isInterrupted) {
                try {
                    // Trigger a HeadlessJS task to run heartbeat + block verification logic
                    triggerHeadlessTask()

                    // Wait for next heartbeat interval
                    Thread.sleep(HEARTBEAT_INTERVAL_MS)
                } catch (e: InterruptedException) {
                    Log.d(TAG, "Heartbeat loop interrupted")
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat error: ${e.message}")
                    try {
                        Thread.sleep(30_000) // Wait 30s on error before retrying
                    } catch (ie: InterruptedException) {
                        break
                    }
                }
            }
        }.apply {
            isDaemon = true
            start()
        }
    }

    /**
     * Trigger a HeadlessJS task that runs the heartbeat/verification logic
     * on the JS thread even when the app is in the background.
     */
    private fun triggerHeadlessTask() {
        val serviceIntent = Intent(applicationContext, VisionHeadlessTaskService::class.java)
        val taskData = Arguments.createMap().apply {
            putString("taskName", HEADLESS_TASK_NAME)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        serviceIntent.putExtras(android.os.Bundle().apply {
            putString("taskData", taskData.toString())
        })

        try {
            applicationContext.startService(serviceIntent)
            Log.d(TAG, "HeadlessJS task triggered")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to trigger HeadlessJS task: ${e.message}")
        }
    }

    /**
     * Acquire a partial wake lock to keep the CPU running
     */
    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "VisionNode::HeartbeatWakeLock"
        ).apply {
            acquire(10 * 60 * 1000L) // 10 minutes, renewed each heartbeat cycle
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
            }
        }
        wakeLock = null
    }
}
