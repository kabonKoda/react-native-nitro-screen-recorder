package com.margelo.nitro.nitroscreenrecorder

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.*

data class Listener<T>(
  val id: Double,
  val callback: T
)

@DoNotStrip
class NitroScreenRecorder : HybridNitroScreenRecorderSpec() {

  private val screenRecordingListeners =
    mutableListOf<Listener<(ScreenRecordingEvent) -> Unit>>()
  private var nextListenerId = 0.0

  fun registerListener() {
    // Android-specific implementation would go here
    // For now, no-op since Android doesn't have equivalent to UIScreen.capturedDidChangeNotification
  }

  fun unregisterListener() {
    // Android-specific cleanup would go here
  }

  override fun addScreenRecordingListener(
    callback: (ScreenRecordingEvent) -> Unit
  ): Double {
    val id = nextListenerId++
    screenRecordingListeners += Listener(id, callback)
    return id
  }

  override fun removeScreenRecordingListener(id: Double) {
    screenRecordingListeners.removeAll { it.id == id }
  }

  override fun getCameraPermissionStatus(): PermissionStatus {
    // TODO: Implement Android camera permission check
    // Use ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
    return PermissionStatus.UNDETERMINED
  }

  override fun getMicrophonePermissionStatus(): PermissionStatus {
    // TODO: Implement Android microphone permission check
    // Use ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
    return PermissionStatus.UNDETERMINED
  }

  override fun requestCameraPermission(): Promise<PermissionResponse> {
    return Promise.async {
      // TODO: Implement Android camera permission request
      // Use ActivityCompat.requestPermissions()
      PermissionResponse(
        canAskAgain = true,
        granted = false,
        status = PermissionStatus.UNDETERMINED,
        expiresAt = 0.0 // Use 0.0 instead of null for Double type
      )
    }
  }

  override fun requestMicrophonePermission(): Promise<PermissionResponse> {
    return Promise.async {
      // TODO: Implement Android microphone permission request  
      // Use ActivityCompat.requestPermissions()
      PermissionResponse(
        canAskAgain = true,
        granted = false,
        status = PermissionStatus.UNDETERMINED,
        expiresAt = 0.0 // Use 0.0 instead of null for Double type
      )
    }
  }

  override fun startInAppRecording(
    enableMic: Boolean,
    enableCamera: Boolean,
    cameraPreviewStyle: RecorderCameraStyle,
    cameraDevice: CameraDevice,
    onRecordingFinished: (ScreenRecordingFile) -> Unit
  ) {
    // TODO: Implement Android screen recording
    // This is complex on Android - requires MediaProjection API
    // For now, no-op to allow compilation
  }

  override fun stopInAppRecording() {
    // TODO: Implement stopping Android screen recording
  }

  override fun cancelInAppRecording() {
    // TODO: Implement canceling Android screen recording
  }

  override fun startGlobalRecording() {
    // TODO: Android doesn't have equivalent to iOS broadcast extension
    // This might need to be implemented differently or throw an unsupported error
  }

  override fun getLastGlobalRecording(): ScreenRecordingFile? {
    // TODO: Implement getting last recording file from Android storage
    return null
  }

  override fun clearRecordingCache() {
    // TODO: Implement clearing Android recording cache
  }
}