package com.misteo.mxu

import android.app.Activity
import android.content.pm.ActivityInfo
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class DisplayLeaseArgs { var token: Int = 0 }

/** Restore only this editor's display changes; ignore stale releases. */
@TauriPlugin
class SkillDisplayPlugin(private val activity: Activity) : Plugin(activity) {
    private data class Previous(val orientation: Int, val behavior: Int,
                                val statusVisible: Boolean, val navigationVisible: Boolean)
    private var previous: Previous? = null
    private var generation = 0
    private val controller get() = WindowCompat.getInsetsController(activity.window, activity.window.decorView)

    @Command
    fun enter(invoke: Invoke) {
        activity.runOnUiThread {
            try {
                if (previous == null) {
                    val insets = ViewCompat.getRootWindowInsets(activity.window.decorView)
                    previous = Previous(activity.requestedOrientation, controller.systemBarsBehavior,
                        insets?.isVisible(WindowInsetsCompat.Type.statusBars()) ?: true,
                        insets?.isVisible(WindowInsetsCompat.Type.navigationBars()) ?: true)
                }
                generation += 1
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                immerse()
                invoke.resolve(JSObject().put("token", generation))
            } catch (error: Exception) {
                restore()
                invoke.reject(error.message)
            }
        }
    }

    @Command
    fun leave(invoke: Invoke) {
        val token = invoke.parseArgs(DisplayLeaseArgs::class.java).token
        activity.runOnUiThread {
            if (token == generation) restore()
            invoke.resolve()
        }
    }

    private fun immerse() {
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    private fun restore() {
        val saved = previous ?: return
        previous = null
        activity.requestedOrientation = saved.orientation
        controller.systemBarsBehavior = saved.behavior
        if (saved.statusVisible) controller.show(WindowInsetsCompat.Type.statusBars())
        else controller.hide(WindowInsetsCompat.Type.statusBars())
        if (saved.navigationVisible) controller.show(WindowInsetsCompat.Type.navigationBars())
        else controller.hide(WindowInsetsCompat.Type.navigationBars())
    }

    override fun onResume() { if (previous != null) immerse() }
    override fun onDestroy() { restore() }
}
