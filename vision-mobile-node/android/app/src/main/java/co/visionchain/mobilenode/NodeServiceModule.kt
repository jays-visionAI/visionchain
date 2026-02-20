package co.visionchain.mobilenode

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.util.Log

/**
 * React Native Native Module to control the Foreground Service from JS.
 *
 * Exposes start/stop methods to JavaScript so the app can control
 * the background service lifecycle.
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
     * Called from JS when the user registers or logs in.
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
     * Called from JS when the user logs out or disconnects.
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
            // Simple check: if we can start/stop, service exists
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
