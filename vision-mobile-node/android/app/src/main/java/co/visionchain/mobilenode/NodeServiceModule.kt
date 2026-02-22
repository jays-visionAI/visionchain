package co.visionchain.mobilenode

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.util.Log

/**
 * React Native Native Module to control the Foreground Service from JS.
 *
 * Exposes start/stop methods and battery level to JavaScript.
 */
class NodeServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "NodeServiceModule"
        const val NAME = "NodeServiceModule"
    }

    override fun getName(): String = NAME

    /**
     * Start the foreground service.
     */
    @ReactMethod
    fun startService(promise: Promise) {
        try {
            Log.d(TAG, "Starting foreground service")
            NodeForegroundService.start(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start service: ${e.message}")
            promise.reject("SERVICE_START_ERROR", e.message, e)
        }
    }

    /**
     * Stop the foreground service.
     */
    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            Log.d(TAG, "Stopping foreground service")
            NodeForegroundService.stop(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop service: ${e.message}")
            promise.reject("SERVICE_STOP_ERROR", e.message, e)
        }
    }

    /**
     * Check if the foreground service is currently running.
     */
    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Get current battery level as a percentage (0-100).
     * Returns -1 if unable to determine.
     */
    @ReactMethod
    fun getBatteryLevel(promise: Promise) {
        try {
            val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { filter ->
                reactApplicationContext.registerReceiver(null, filter)
            }
            val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
            val pct = if (level >= 0 && scale > 0) (level * 100) / scale else -1
            promise.resolve(pct)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get battery level: ${e.message}")
            promise.resolve(-1)
        }
    }

    /**
     * Check if the device is currently charging.
     */
    @ReactMethod
    fun isCharging(promise: Promise) {
        try {
            val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { filter ->
                reactApplicationContext.registerReceiver(null, filter)
            }
            val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                             status == BatteryManager.BATTERY_STATUS_FULL
            promise.resolve(isCharging)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check charging status: ${e.message}")
            promise.resolve(false)
        }
    }
}
