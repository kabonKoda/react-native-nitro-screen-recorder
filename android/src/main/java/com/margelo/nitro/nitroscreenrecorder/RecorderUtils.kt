package com.margelo.nitro.nitroscreenrecorder.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.MediaMetadataRetriever
import android.media.MediaRecorder
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

private const val TAG = "RecorderUtils"

/**
 * A data class to hold screen dimension properties.
 */
data class ScreenMetrics(val width: Int, val height: Int, val density: Int)

/**
 * A singleton object containing utility functions for screen recording.
 */
object RecorderUtils {

  /**
   * Initializes and returns the screen metrics (width, height, density).
   */
  fun initializeScreenMetrics(context: Context): ScreenMetrics {
    Log.d(TAG, "📐 Initializing screen metrics...")
    val windowManager =
      context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val displayMetrics = DisplayMetrics()

    val width: Int
    val height: Int
    val density: Int

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val bounds = windowManager.currentWindowMetrics.bounds
      width = bounds.width()
      height = bounds.height()
      density = context.resources.displayMetrics.densityDpi
    } else {
      @Suppress("DEPRECATION")
      windowManager.defaultDisplay.getMetrics(displayMetrics)
      width = displayMetrics.widthPixels
      height = displayMetrics.heightPixels
      density = displayMetrics.densityDpi
    }

    Log.d(TAG, "📐 Screen metrics: ${width}x${height}, density: $density")
    return ScreenMetrics(width, height, density)
  }

  /**
   * Creates a notification channel for the recording service (required for Android O+).
   */
  fun createNotificationChannel(
    context: Context,
    channelId: String,
    channelName: String,
    channelDescription: String
  ) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Log.d(TAG, "🔔 Creating notification channel: $channelId")
      val channel = NotificationChannel(
        channelId,
        channelName,
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = channelDescription
        setSound(null, null)
      }

      val notificationManager =
        context.getSystemService(NotificationManager::class.java)
      notificationManager.createNotificationChannel(channel)
      Log.d(TAG, "✅ Notification channel '$channelId' created")
    }
  }

  /**
   * Creates a new video file in the specified directory.
   */
  fun createOutputFile(directory: File, prefix: String): File {
    Log.d(TAG, "📁 Creating output file with prefix '$prefix'...")
    if (!directory.exists()) {
      Log.d(TAG, "📁 Creating directory: ${directory.absolutePath}")
      directory.mkdirs()
    }

    val timestamp =
      SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
    val fileName = "${prefix}_$timestamp.mp4"
    val file = File(directory, fileName)
    Log.d(TAG, "📁 Created output file: ${file.absolutePath}")
    return file
  }

  /**
   * Retrieves the duration of a video file in milliseconds.
   */
  fun getVideoDuration(file: File): Double {
    if (!file.exists()) return 0.0
    return try {
      val retriever = MediaMetadataRetriever()
      retriever.setDataSource(file.absolutePath)
      val duration =
        retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
      retriever.release()
      duration?.toDouble() ?: 0.0
    } catch (e: Exception) {
      Log.w(TAG, "Could not get video duration: ${e.message}")
      0.0
    }
  }

  /**
   * Configures and returns a MediaRecorder instance.
   */
  fun setupMediaRecorder(
    context: Context,
    enableMicrophone: Boolean,
    outputFile: File,
    screenWidth: Int,
    screenHeight: Int,
    videoBitrate: Int
  ): MediaRecorder {
    Log.d(TAG, "🎬 Setting up MediaRecorder: enableMic=$enableMicrophone")

    val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      MediaRecorder(context)
    } else {
      @Suppress("DEPRECATION")
      MediaRecorder()
    }

    try {
      recorder.apply {
        setVideoSource(MediaRecorder.VideoSource.SURFACE)
        if (enableMicrophone) {
          setAudioSource(MediaRecorder.AudioSource.MIC)
        }

        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setVideoEncoder(MediaRecorder.VideoEncoder.H264)
        if (enableMicrophone) {
          setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        }

        setOutputFile(outputFile.absolutePath)
        setVideoSize(screenWidth, screenHeight)
        setVideoFrameRate(30)
        setVideoEncodingBitRate(videoBitrate) // e.g., 2 * 1024 * 1024 for 2 Mbps

        if (enableMicrophone) {
          setAudioEncodingBitRate(128000)
          setAudioSamplingRate(44100)
        }
      }
      Log.d(TAG, "✅ MediaRecorder setup complete")
    } catch (e: Exception) {
      Log.e(TAG, "❌ Error setting up MediaRecorder: ${e.message}")
      recorder.release()
      throw e
    }

    return recorder
  }

  /**
   * Deletes all .mp4 files in a given directory.
   */
  fun clearDirectory(directory: File) {
    Log.d(TAG, "🧹 Clearing directory: ${directory.absolutePath}")
    if (directory.exists() && directory.isDirectory) {
      directory.listFiles()?.forEach { file ->
        if (file.isFile && file.name.endsWith(".mp4")) {
          if (file.delete()) {
            Log.d(TAG, "🗑️ Deleted file: ${file.name}")
          } else {
            Log.w(TAG, "⚠️ Failed to delete file: ${file.name}")
          }
        }
      }
    } else {
      Log.d(TAG, "ℹ️ Directory does not exist, nothing to clear.")
    }
  }
}
