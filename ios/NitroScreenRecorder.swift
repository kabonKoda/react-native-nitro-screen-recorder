import AVFoundation
import Foundation
import NitroModules
import ReplayKit

enum RecorderError: Error {
  case error(name: String, message: String)
}

typealias RecordingFinishedCallback = (ScreenRecordingFile) -> Void
typealias ScreenRecordingListener = (ScreenRecordingEvent) -> Void

struct Listener<T> {
  let id: Double
  let callback: T
}

class NitroScreenRecorder: HybridNitroScreenRecorderSpec {

  let recorder = RPScreenRecorder.shared()
  private var inAppRecordingActive: Bool = false

  private var onInAppRecordingFinishedCallback: RecordingFinishedCallback?
  private var recordingEventListeners: [Listener<ScreenRecordingListener>] = []
  private var nextListenerId: Double = 0

  override init() {
    super.init()
    registerListener()
  }

  deinit {
    unregisterListener()
  }

  func registerListener() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleScreenRecordingChange),
      name: UIScreen.capturedDidChangeNotification,
      object: nil
    )
  }

  func unregisterListener() {
    NotificationCenter.default.removeObserver(
      self,
      name: UIScreen.capturedDidChangeNotification,
      object: nil
    )
  }

  @objc private func handleScreenRecordingChange() {
    let type: RecordingEventType
    let reason: RecordingEventReason
    if UIScreen.main.isCaptured {
      reason = .began
      if inAppRecordingActive {
        type = .withinapp
      } else {
        type = .global
      }
    } else {
      reason = .ended
      if inAppRecordingActive {
        type = .withinapp
      } else {
        type = .global
      }
    }
    let event = ScreenRecordingEvent(type: type, reason: reason)
    recordingEventListeners.forEach { $0.callback(event) }
  }

  func addScreenRecordingListener(callback: @escaping (ScreenRecordingEvent) -> Void) throws
    -> Double
  {
    let listener = Listener(id: nextListenerId, callback: callback)
    recordingEventListeners.append(listener)
    nextListenerId += 1
    return listener.id
  }

  func removeScreenRecordingListener(id: Double) throws {
    recordingEventListeners.removeAll { $0.id == id }
  }

  // MARK: - Permission Methods
  public func getCameraPermissionStatus() throws -> PermissionStatus {
    let status = AVCaptureDevice.authorizationStatus(for: .video)
    return self.mapAVAuthorizationStatusToPermissionResponse(status).status
  }

  public func getMicrophonePermissionStatus() throws -> PermissionStatus {
    let status = AVCaptureDevice.authorizationStatus(for: .audio)
    return self.mapAVAuthorizationStatusToPermissionResponse(status).status
  }

  public func requestCameraPermission() throws -> Promise<PermissionResponse> {
    return Promise.async {
      return await withCheckedContinuation { continuation in
        AVCaptureDevice.requestAccess(for: .video) { granted in
          let status = AVCaptureDevice.authorizationStatus(for: .video)
          let result = self.mapAVAuthorizationStatusToPermissionResponse(status)
          continuation.resume(returning: result)
        }
      }
    }
  }

  public func requestMicrophonePermission() throws -> Promise<PermissionResponse> {
    return Promise.async {
      return await withCheckedContinuation { continuation in
        AVCaptureDevice.requestAccess(for: .audio) { granted in
          let status = AVCaptureDevice.authorizationStatus(for: .audio)
          let result = self.mapAVAuthorizationStatusToPermissionResponse(status)
          continuation.resume(returning: result)
        }
      }
    }
  }

  // MARK: - In-App Recording
  func startInAppRecording(
    enableMic: Bool,
    enableCamera: Bool,
    cameraPreviewStyle: RecorderCameraStyle,
    cameraDevice: CameraDevice,
    onRecordingFinished: @escaping RecordingFinishedCallback
  ) throws {
    safelyClearInAppRecordingFiles()

    guard recorder.isAvailable else {
      throw RecorderError.error(
        name: "SCREEN_RECORDER_UNAVAILABLE",
        message: "Screen recording is not available"
      )
    }

    if recorder.isRecording {
      print("Recorder is already recording.")
      return
    }

    if enableCamera {
      let camStatus = AVCaptureDevice.authorizationStatus(for: .video)
      guard camStatus == .authorized else {
        throw RecorderError.error(
          name: "CAMERA_PERMISSION_DENIED",
          message: "Camera access is not authorized"
        )
      }
    }
    if enableMic {
      let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
      guard micStatus == .authorized else {
        throw RecorderError.error(
          name: "MIC_PERMISSION_DENIED",
          message: "Microphone access is not authorized"
        )
      }
    }

    self.onInAppRecordingFinishedCallback = onRecordingFinished
    recorder.isMicrophoneEnabled = enableMic
    recorder.isCameraEnabled = enableCamera

    if enableCamera {
      let device: RPCameraPosition = (cameraDevice == .front) ? .front : .back
      recorder.cameraPosition = device
    }
    inAppRecordingActive = true
    recorder.startRecording { [weak self] error in
      guard let self = self else { return }
      if let error = error {
        print("❌ Error starting in-app recording:", error.localizedDescription)
        inAppRecordingActive = false
        return
      }
      print("✅ In-app recording started (mic:\(enableMic) camera:\(enableCamera))")

      if enableCamera {
        DispatchQueue.main.async {
          self.setupAndDisplayCamera(style: cameraPreviewStyle)
        }
      }
    }
  }

  public func stopInAppRecording() throws {
    // build a unique temp URL
    let fileName = "screen_capture_\(UUID().uuidString).mp4"
    let outputURL = FileManager.default.temporaryDirectory
      .appendingPathComponent(fileName)

    // remove any existing file
    try? FileManager.default.removeItem(at: outputURL)

    // call the new API
    recorder.stopRecording(withOutput: outputURL) { [weak self] error in
      guard let self = self else { return }

      if let error = error {
        print("❌ Error writing recording to \(outputURL):", error.localizedDescription)
        return
      }

      do {
        // read file attributes
        let attrs = try FileManager.default.attributesOfItem(atPath: outputURL.path)
        let asset = AVURLAsset(url: outputURL)
        let duration = CMTimeGetSeconds(asset.duration)

        // build your ScreenRecordingFile
        let file = ScreenRecordingFile(
          path: outputURL.path,
          name: outputURL.lastPathComponent,
          size: attrs[.size] as? Double ?? 0,
          duration: duration,
          enabledMicrophone: self.recorder.isMicrophoneEnabled,
        )

        print("✅ Recording finished and saved to:", outputURL.path)
        // invoke your callback
        self.onInAppRecordingFinishedCallback?(file)
      } catch {
        print("⚠️ Failed to build ScreenRecordingFile:", error.localizedDescription)
      }
    }
  }

  public func cancelInAppRecording() throws {
    // If a recording session is in progress, stop it and write out to a temp URL
    if recorder.isRecording {
      let tempURL = FileManager.default.temporaryDirectory
        .appendingPathComponent("canceled_\(UUID().uuidString).mp4")
      recorder.stopRecording(withOutput: tempURL) { error in
        if let error = error {
          print("⚠️ Error stopping recording during cancel:", error.localizedDescription)
        } else {
          print("🗑️ In‑app recording stopped and wrote to temp URL (canceled):\(tempURL.path)")
        }
      }
    }

    safelyClearInAppRecordingFiles()
    print("🛑 In‑app recording canceled and buffers cleared")
  }

  /**
   Attaches a micro PickerView button off-screen screen and presses that button to open the broadcast.
   */
  func presentGlobalBroadcastModal(enableMicrophone: Bool = true) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      print("📱 Creating broadcast picker...")

      let broadcastPicker = RPSystemBroadcastPickerView(
        frame: CGRect(x: 2000, y: 2000, width: 1, height: 1))

      let bundleID = getBroadcastExtensionBundleId()
      print("🎯 Preferred extension bundle ID: \(bundleID ?? "none")")

      if let bundleID = bundleID {
        broadcastPicker.preferredExtension = bundleID
      } else {
        print("⚠️ No broadcast extension bundle ID found - user will see all available extensions")
      }

      // Show microphone button - user can choose to enable/disable mic in the system picker
      broadcastPicker.showsMicrophoneButton = enableMicrophone

      guard
        let window = UIApplication.shared
          .connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first?
          .windows
          .first(where: { $0.isKeyWindow })
      else {
        print("❌ Could not find key window")
        // Could potentially call error callback here if we stored it
        return
      }

      // Make the picker invisible but functional
      broadcastPicker.alpha = 0.01
      window.addSubview(broadcastPicker)

      // Trigger the picker programmatically
      if let button = broadcastPicker.subviews.first(where: { $0 is UIButton }) as? UIButton {
        print("✅ Found button, triggering...")
        button.sendActions(for: .touchUpInside)
      } else {
        print("❌ No button found in broadcast picker")
        // Could potentially call error callback here if we stored it
      }

      // Clean up the picker after a delay
      DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
        print("🧹 Cleaning up broadcast picker")
        broadcastPicker.removeFromSuperview()
      }
    }
  }

  func startGlobalRecording(enableMic: Bool, onRecordingError: @escaping (RecordingError) -> Void)
    throws
  {
    // Validate that we can access the app group (needed for global recordings)
    guard let appGroupId = try? getAppGroupIdentifier() else {
      let error = RecordingError(
        name: "APP_GROUP_ACCESS_FAILED",
        message: "Could not access app group identifier required for global recording. Something is wrong with your entitlements."
      )
      onRecordingError(error)
      return
    }

    guard
      FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: appGroupId) != nil
    else {
      let error = RecordingError(
        name: "APP_GROUP_CONTAINER_FAILED",
        message: "Could not access app group container required for global recording. Something is wrong with your entitlements."
      )
      onRecordingError(error)
      return
    }

    // Present the broadcast picker
    presentGlobalBroadcastModal(enableMicrophone: enableMic)


  }

  func stopGlobalRecording() throws {
    // no-op
  }

  func getLastGlobalRecording() throws -> ScreenRecordingFile? {
    // 1) Resolve app group doc dir
    guard let appGroupId = try? getAppGroupIdentifier(),
      let docsURL = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?
        .appendingPathComponent("Library/Documents/", isDirectory: true)
    else {
      throw RecorderError.error(
        name: "APP_GROUP_ACCESS_FAILED",
        message: "Could not access app group container"
      )
    }

    // 2) Find the newest .mp4
    let keys: [URLResourceKey] = [
      .contentModificationDateKey, .creationDateKey, .isRegularFileKey, .fileSizeKey,
    ]
    let contents = try FileManager.default.contentsOfDirectory(
      at: docsURL,
      includingPropertiesForKeys: keys,
      options: [.skipsHiddenFiles]
    )

    let mp4s = contents.filter { $0.pathExtension.lowercased() == "mp4" }

    guard
      let latestURL = try mp4s.max(by: { a, b in
        let va = try a.resourceValues(forKeys: Set(keys))
        let vb = try b.resourceValues(forKeys: Set(keys))
        let da = va.contentModificationDate ?? va.creationDate ?? .distantPast
        let db = vb.contentModificationDate ?? vb.creationDate ?? .distantPast
        return da < db
      })
    else {
      // Nothing there yet
      return nil
    }

    // 3) Build ScreenRecordingFile
    let attrs = try FileManager.default.attributesOfItem(atPath: latestURL.path)
    let size = (attrs[.size] as? NSNumber)?.doubleValue ?? 0.0
    let asset = AVURLAsset(url: latestURL)
    let duration = CMTimeGetSeconds(asset.duration)

    // Read mic flag saved by the extension
    let micEnabled =
      UserDefaults(suiteName: appGroupId)?
      .bool(forKey: "LastBroadcastMicrophoneWasEnabled") ?? false

    return ScreenRecordingFile(
      path: latestURL.path,
      name: latestURL.lastPathComponent,
      size: size,
      duration: duration,
      enabledMicrophone: micEnabled
    )
  }

  func safelyClearGlobalRecordingFiles() throws {
    let fm = FileManager.default

    guard let appGroupId = try? getAppGroupIdentifier(),
      let docsURL =
        fm
        .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?
        .appendingPathComponent("Library/Documents/", isDirectory: true)
    else {
      throw RecorderError.error(
        name: "APP_GROUP_ACCESS_FAILED",
        message: "Could not access app group container"
      )
    }

    do {
      guard fm.fileExists(atPath: docsURL.path) else { return }
      let items = try fm.contentsOfDirectory(at: docsURL, includingPropertiesForKeys: nil)
      for fileURL in items where fileURL.pathExtension.lowercased() == "mp4" {
        try fm.removeItem(at: fileURL)
        print("🗑️ Deleted: \(fileURL.lastPathComponent)")
      }
      print("✅ All recording files cleared in \(docsURL.path)")
    } catch {
      throw RecorderError.error(
        name: "CLEANUP_FAILED",
        message: "Could not clear recording files: \(error.localizedDescription)"
      )
    }
  }

  func safelyClearInAppRecordingFiles() {
    recorder.discardRecording {
      print("✅ In‑app recording discarded")
    }
  }

  func clearRecordingCache() throws {
    try safelyClearGlobalRecordingFiles()
    safelyClearInAppRecordingFiles()
  }
}
