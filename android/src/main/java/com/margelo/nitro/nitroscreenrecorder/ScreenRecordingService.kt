package com.margelo.nitro.nitroscreenrecorder

import android.app.*
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.media.ImageReader
import android.graphics.PixelFormat as AndroidPixelFormat
import android.os.Handler
import android.os.HandlerThread
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.margelo.nitro.core.*
import com.margelo.nitro.nitroscreenrecorder.utils.RecorderUtils
import java.io.File

class ScreenRecordingService : Service() {

  private var mediaProjection: MediaProjection? = null
  private var mediaRecorder: MediaRecorder? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var isRecording = false
  private var currentRecordingFile: File? = null
  private var enableMic = false

  private var screenWidth = 0
  private var screenHeight = 0
  private var screenDensity = 0
  private var startId: Int = -1
  
  // Recording configuration
  private var enableRecording = true
  private var enableStreaming = false
  private var bitrate: Int? = null // Optional bitrate, defaults to 8 Mbps if not set
  private var fps: Int = 60 // 60 FPS default
  
  // Frame streaming support
  private var frameStreamingEnabled = false
  private var imageReader: ImageReader? = null
  private var frameVirtualDisplay: VirtualDisplay? = null
  private var frameHandlerThread: HandlerThread? = null
  private var frameHandler: Handler? = null
  private var lastFrameTime: Long = 0
  private var minFrameIntervalMs: Long = 33 // ~30 FPS
  private var recordingStartTime: Long = 0

  private val binder = LocalBinder()

  private val mediaProjectionCallback = object : MediaProjection.Callback() {
    override fun onStop() {
      Log.d(TAG, "📱 MediaProjection stopped")
      if (isRecording) {
        stopRecording()
      }
    }
  }

  companion object {
    private const val TAG = "ScreenRecordingService"
    private const val NOTIFICATION_ID = 1001
    private const val CHANNEL_ID = "screen_recording_channel"
    const val ACTION_START_RECORDING = "START_RECORDING"
    const val ACTION_STOP_RECORDING = "STOP_RECORDING"
    const val EXTRA_RESULT_CODE = "RESULT_CODE"
    const val EXTRA_RESULT_DATA = "RESULT_DATA"
    const val EXTRA_ENABLE_MIC = "ENABLE_MIC"
    const val EXTRA_ENABLE_RECORDING = "ENABLE_RECORDING"
    const val EXTRA_ENABLE_STREAMING = "ENABLE_STREAMING"
    const val EXTRA_BITRATE = "BITRATE"
    const val EXTRA_FPS = "FPS"
  }

  inner class LocalBinder : Binder() {
    fun getService(): ScreenRecordingService = this@ScreenRecordingService
  }

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "🚀 ScreenRecordingService onCreate called")
    RecorderUtils.createNotificationChannel(
      this,
      CHANNEL_ID,
      "Screen Recording",
      "Screen recording notification"
    )
    val metrics = RecorderUtils.initializeScreenMetrics(this)
    screenWidth = metrics.width
    screenHeight = metrics.height
    screenDensity = metrics.density
    Log.d(TAG, "✅ ScreenRecordingService created successfully")
  }

  override fun onBind(intent: Intent?): IBinder {
    Log.d(TAG, "🔗 onBind called")
    return binder
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d(TAG, "🚀 onStartCommand called with action: ${intent?.action}")

    this.startId = startId

    when (intent?.action) {
      ACTION_START_RECORDING -> {
        val resultCode =
          intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
        val resultData = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
        val enableMicrophone = intent.getBooleanExtra(EXTRA_ENABLE_MIC, false)
        val enableRec = intent.getBooleanExtra(EXTRA_ENABLE_RECORDING, true)
        val enableStream = intent.getBooleanExtra(EXTRA_ENABLE_STREAMING, false)
        val bitrateValue = if (intent.hasExtra(EXTRA_BITRATE)) intent.getIntExtra(EXTRA_BITRATE, 0) else null
        val fpsValue = intent.getIntExtra(EXTRA_FPS, 60)

        Log.d(
          TAG,
          "🎬 Start recording: resultCode=$resultCode, enableMic=$enableMicrophone, enableRecording=$enableRec, enableStreaming=$enableStream, bitrate=$bitrateValue, fps=$fpsValue"
        )

        if (resultData != null) {
          startRecording(resultCode, resultData, enableMicrophone, enableRec, enableStream, bitrateValue, fpsValue)
        } else {
          Log.e(TAG, "❌ ResultData is null, cannot start recording")
        }
      }
      ACTION_STOP_RECORDING -> {
        Log.d(TAG, "🛑 Stop recording action received")
        stopRecording()
      }
    }

    return START_NOT_STICKY
  }

  private fun createForegroundNotification(isRecording: Boolean): Notification {
    Log.d(TAG, "🔔 Creating foreground notification: isRecording=$isRecording")

    val stopIntent = Intent(this, ScreenRecordingService::class.java).apply {
      action = ACTION_STOP_RECORDING
    }
    val stopPendingIntent = PendingIntent.getService(
      this,
      0,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(if (isRecording) "Recording screen..." else "Screen recording")
      .setContentText(
        if (isRecording) "Tap to stop recording" else "Preparing to record"
      )
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .apply {
        if (isRecording) {
          addAction(android.R.drawable.ic_media_pause, "Stop", stopPendingIntent)
        }
      }
      .build()
  }

  fun startRecording(
    resultCode: Int,
    resultData: Intent,
    enableMicrophone: Boolean,
    enableRec: Boolean,
    enableStream: Boolean,
    bitrateValue: Int?,
    fpsValue: Int
  ) {
    Log.d(
      TAG,
      "🎬 startRecording called: resultCode=$resultCode, enableMic=$enableMicrophone, enableRecording=$enableRec, enableStreaming=$enableStream, bitrate=$bitrateValue, fps=$fpsValue"
    )

    if (isRecording) {
      Log.w(TAG, "⚠️ Already recording")
      return
    }

    try {
      this.enableMic = enableMicrophone
      this.enableRecording = enableRec
      this.enableStreaming = enableStream
      this.bitrate = bitrateValue
      this.fps = fpsValue
      this.minFrameIntervalMs = 1000L / fpsValue

      startForeground(NOTIFICATION_ID, createForegroundNotification(false))

      val mediaProjectionManager =
        getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      mediaProjection =
        mediaProjectionManager.getMediaProjection(resultCode, resultData)

      // Register the callback BEFORE creating VirtualDisplay
      mediaProjection?.registerCallback(mediaProjectionCallback, null)

      // Setup recording if enabled
      if (enableRecording) {
        // write into the app-specific external cache (no runtime READ_EXTERNAL_STORAGE needed)
        val base = applicationContext.externalCacheDir
          ?: applicationContext.filesDir
        val recordingsDir = File(base, "recordings")
        currentRecordingFile =
          RecorderUtils.createOutputFile(recordingsDir, "global_recording")

        val bitrateValue = bitrate ?: (8 * 1024 * 1024) // Default to 8 Mbps if not specified
        mediaRecorder = RecorderUtils.setupMediaRecorder(
          this,
          enableMicrophone,
          currentRecordingFile!!,
          screenWidth,
          screenHeight,
          bitrateValue,
          fps
        )
        mediaRecorder?.prepare()

        virtualDisplay = mediaProjection?.createVirtualDisplay(
          "GlobalScreenRecording",
          screenWidth,
          screenHeight,
          screenDensity,
          DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
          mediaRecorder?.surface,
          null,
          null
        )

        mediaRecorder?.start()
      }
      
      isRecording = true
      recordingStartTime = System.currentTimeMillis()
      
      // Initialize frame streaming if enabled
      if (enableStreaming) {
        setupFrameStreaming()
      }

      val notificationManager = getSystemService(NotificationManager::class.java)
      notificationManager.notify(NOTIFICATION_ID, createForegroundNotification(true))

      val event = ScreenRecordingEvent(
        type = RecordingEventType.GLOBAL,
        reason = RecordingEventReason.BEGAN
      )
      NitroScreenRecorder.notifyGlobalRecordingEvent(event)

      Log.d(TAG, "🎉 Global screen recording started successfully")

    } catch (e: Exception) {
      Log.e(TAG, "❌ Error starting global recording: ${e.message}")
      e.printStackTrace()
      val error = RecordingError(
        name = "RecordingStartError",
        message = e.message ?: "Failed to start recording"
      )
      NitroScreenRecorder.notifyGlobalRecordingError(error)
      cleanup()
      stopSelf(this.startId)
    }
  }

  fun stopRecording(): File? {
    Log.d(TAG, "🛑 stopRecording called")

    if (!isRecording) {
      Log.w(TAG, "⚠️ Not recording")
      return null
    }

    var recordingFile: File? = null

    try {
      mediaRecorder?.stop()
      isRecording = false
      recordingFile = currentRecordingFile

      val event = ScreenRecordingEvent(
        type = RecordingEventType.GLOBAL,
        reason = RecordingEventReason.ENDED
      )
      recordingFile?.let {
        NitroScreenRecorder.notifyGlobalRecordingFinished(it, event, enableMic)
      }

      Log.d(TAG, "🎉 Global screen recording stopped successfully")

    } catch (e: Exception) {
      Log.e(TAG, "❌ Error stopping global recording: ${e.message}")
      e.printStackTrace()
      val error = RecordingError(
        name = "RecordingStopError",
        message = e.message ?: "Failed to stop recording"
      )
      NitroScreenRecorder.notifyGlobalRecordingError(error)
    } finally {
      cleanup()
      stopForeground(true)
      stopSelf(this.startId)
    }

    return recordingFile
  }

  private fun cleanup() {
    Log.d(TAG, "🧹 cleanup() called")

    try {
      // Clean up frame streaming resources
      cleanupFrameStreaming()
      
      virtualDisplay?.release()
      virtualDisplay = null
      mediaRecorder?.release()
      mediaRecorder = null

      // Unregister callback before stopping MediaProjection
      mediaProjection?.unregisterCallback(mediaProjectionCallback)
      mediaProjection?.stop()
      mediaProjection = null

      Log.d(TAG, "✅ Cleanup completed")
    } catch (e: Exception) {
      Log.e(TAG, "❌ Error during cleanup: ${e.message}")
    }
  }

  fun isCurrentlyRecording(): Boolean = isRecording
  
  fun enableFrameStreaming(maxFps: Int) {
    Log.d(TAG, "🎞️ Frame streaming enabled with maxFps: $maxFps")
    frameStreamingEnabled = true
    minFrameIntervalMs = (1000.0 / maxFps).toLong()
    
    if (isRecording && frameVirtualDisplay == null) {
      setupFrameStreaming()
    }
  }
  
  fun disableFrameStreaming() {
    Log.d(TAG, "🎞️ Frame streaming disabled")
    frameStreamingEnabled = false
    
    if (frameVirtualDisplay != null) {
      cleanupFrameStreaming()
    }
  }
  
  private fun setupFrameStreaming() {
    try {
      Log.d(TAG, "🎞️ Setting up frame streaming")
      
      // Create HandlerThread for frame processing
      frameHandlerThread = HandlerThread("FrameStreamingThread").apply {
        start()
      }
      frameHandler = Handler(frameHandlerThread!!.looper)
      
      // Create ImageReader for frame capture
      imageReader = ImageReader.newInstance(
        screenWidth,
        screenHeight,
        AndroidPixelFormat.RGBA_8888,
        2 // Double buffering
      )
      
      // Set up frame listener
      imageReader?.setOnImageAvailableListener({ reader ->
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastFrameTime >= minFrameIntervalMs) {
          lastFrameTime = currentTime
          processFrame(reader, currentTime)
        } else {
          // Skip frame to maintain target frame rate
          reader.acquireLatestImage()?.close()
        }
      }, frameHandler)
      
      // Create separate VirtualDisplay for frame streaming
      frameVirtualDisplay = mediaProjection?.createVirtualDisplay(
        "FrameStreamingDisplay",
        screenWidth,
        screenHeight,
        screenDensity,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
        imageReader?.surface,
        null,
        frameHandler
      )
      
      Log.d(TAG, "✅ Frame streaming setup complete")
    } catch (e: Exception) {
      Log.e(TAG, "❌ Error setting up frame streaming: ${e.message}")
      e.printStackTrace()
    }
  }
  
  private fun processFrame(reader: ImageReader, timestamp: Long) {
    var image: android.media.Image? = null
    try {
      image = reader.acquireLatestImage()
      if (image != null) {
        val planes = image.planes
        val buffer = planes[0].buffer
        val pixelStride = planes[0].pixelStride
        val rowStride = planes[0].rowStride
        
        // Extract pixel data from buffer
        buffer.rewind()
        val size = buffer.remaining()
        val bytes = ByteArray(size)
        buffer.get(bytes)
        
        // Create ArrayBuffer from bytes
        val arrayBuffer = ArrayBuffer.allocate(size)
        val byteBuffer = arrayBuffer.getBuffer(false)
        byteBuffer.put(bytes)
        byteBuffer.rewind()
        
        // Create ScreenFrame object with correct parameters
        val frame = ScreenFrame(
          data = arrayBuffer,
          width = screenWidth.toDouble(),
          height = screenHeight.toDouble(),
          timestamp = timestamp.toDouble(),
          format = com.margelo.nitro.nitroscreenrecorder.PixelFormat.RGBA  // RGBA_8888 format from ImageReader
        )
        
        NitroScreenRecorder.notifyFrameAvailable(frame)
        
        Log.d(TAG, "📸 Frame captured: ${screenWidth}x${screenHeight}, size=$size bytes, timestamp=$timestamp ms")
      }
    } catch (e: Exception) {
      Log.e(TAG, "❌ Error processing frame: ${e.message}")
      e.printStackTrace()
    } finally {
      image?.close()
    }
  }
  
  private fun cleanupFrameStreaming() {
    try {
      Log.d(TAG, "🧹 Cleaning up frame streaming")
      
      frameVirtualDisplay?.release()
      frameVirtualDisplay = null
      
      imageReader?.close()
      imageReader = null
      
      frameHandlerThread?.quitSafely()
      frameHandlerThread = null
      frameHandler = null
      
      Log.d(TAG, "✅ Frame streaming cleanup complete")
    } catch (e: Exception) {
      Log.e(TAG, "❌ Error cleaning up frame streaming: ${e.message}")
    }
  }

  override fun onDestroy() {
    Log.d(TAG, "💀 onDestroy called")
    cleanup()
    super.onDestroy()
  }
}