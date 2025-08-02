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
  private var isGlobalRecordingActive: Bool = false
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
        isGlobalRecordingActive = true
      }
    } else {
      reason = .ended
      if inAppRecordingActive {
        type = .withinapp
      } else {
        type = .global
        isGlobalRecordingActive = false
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

  public func stopInAppRecording() throws -> Promise<ScreenRecordingFile?> {
    return Promise.async {
      return await withCheckedContinuation { continuation in
        // build a unique temp URL
        let fileName = "screen_capture_\(UUID().uuidString).mp4"
        let outputURL = FileManager.default.temporaryDirectory
          .appendingPathComponent(fileName)

        // remove any existing file
        try? FileManager.default.removeItem(at: outputURL)

        // call the new API
        self.recorder.stopRecording(withOutput: outputURL) { [weak self] error in
          guard let self = self else {
            print("❌ stopInAppRecording: self went away before completion")
            continuation.resume(returning: nil)
            return
          }

          if let error = error {
            print("❌ Error writing recording to \(outputURL):", error.localizedDescription)
            continuation.resume(returning: nil)
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
              enabledMicrophone: self.recorder.isMicrophoneEnabled
            )

            print("✅ Recording finished and saved to:", outputURL.path)
            self.onInAppRecordingFinishedCallback?(file)
            continuation.resume(returning: file)
          } catch {
            print("⚠️ Failed to build ScreenRecordingFile:", error.localizedDescription)
            continuation.resume(returning: nil)
          }
        }
      }
    }
  }

  public func cancelInAppRecording() throws -> Promise<Void> {
    return Promise.async {
      return await withCheckedContinuation { continuation in
        // If a recording session is in progress, stop it and write out to a temp URL
        if self.recorder.isRecording {
          let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("canceled_\(UUID().uuidString).mp4")
          self.recorder.stopRecording(withOutput: tempURL) { error in
            if let error = error {
              print("⚠️ Error stopping recording during cancel:", error.localizedDescription)
            } else {
              print("🗑️ In-app recording stopped and wrote to temp URL (canceled):\(tempURL.path)")
            }

            self.safelyClearInAppRecordingFiles()
            print("🛑 In-app recording canceled and buffers cleared")
            continuation.resume(returning: ())
          }
        } else {
          // Not recording, just clear
          self.safelyClearInAppRecordingFiles()
          print("🛑 In-app recording canceled and buffers cleared (no active recording)")
          continuation.resume(returning: ())
        }
      }
    }
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
    guard !isGlobalRecordingActive else {
      print("⚠️ Attempted to start a global recording, but one is already active.")
      let error = RecordingError(
        name: "BROADCAST_ALREADY_ACTIVE",
        message: "A screen recording session is already in progress."
      )
      onRecordingError(error)
      return
    }

    // Validate that we can access the app group (needed for global recordings)
    guard let appGroupId = try? getAppGroupIdentifier() else {
      let error = RecordingError(
        name: "APP_GROUP_ACCESS_FAILED",
        message:
          "Could not access app group identifier required for global recording. Something is wrong with your entitlements."
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
        message:
          "Could not access app group container required for global recording. Something is wrong with your entitlements."
      )
      onRecordingError(error)
      return
    }

    // Present the broadcast picker
    presentGlobalBroadcastModal(enableMicrophone: enableMic)

  }
  // This is a hack I learned through:
  // https://mehmetbaykar.com/posts/how-to-gracefully-stop-a-broadcast-upload-extension/
  // Basically you send a kill command through Darwin and you suppress
  // the system error
  func stopGlobalRecording() throws -> Promise<ScreenRecordingFile?> {
    return Promise.async {
      guard self.isGlobalRecordingActive else {
        print("⚠️ stopGlobalRecording called but no active global recording.")
        return nil
      }

      let notif = "com.nitroscreenrecorder.stopBroadcast" as CFString
      CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName(notif),
        nil,
        nil,
        true
      )
      // Reflect intent locally.
      self.isGlobalRecordingActive = false

      // Small grace period for the broadcast to wind down.
      try? await Task.sleep(nanoseconds: 500_000_000)

      do {
        return try self.getLastGlobalRecording()
      } catch {
        print("❌ getLastGlobalRecording failed after stop:", error)
        return nil
      }
    }
  }

  func getLastGlobalRecording() throws -> ScreenRecordingFile? {
    print("🎬 getLastGlobalRecording: Starting function")

    // 1) Resolve app group doc dir
    print("📁 Attempting to get app group identifier...")
    guard let appGroupId = try? getAppGroupIdentifier() else {
      print("❌ Failed to get app group identifier")
      throw RecorderError.error(
        name: "APP_GROUP_ACCESS_FAILED",
        message: "Could not get app group identifier"
      )
    }
    print("✅ App group ID: \(appGroupId)")

    guard
      let docsURL = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?
        .appendingPathComponent("Library/Documents/", isDirectory: true)
    else {
      print("❌ Failed to access app group container for ID: \(appGroupId)")
      throw RecorderError.error(
        name: "APP_GROUP_ACCESS_FAILED",
        message: "Could not access app group container"
      )
    }
    print("✅ Documents URL: \(docsURL.path)")

    // Check if directory exists, create if needed
    if !FileManager.default.fileExists(atPath: docsURL.path) {
      print("📁 Documents directory doesn't exist, creating it...")
      do {
        try FileManager.default.createDirectory(
          at: docsURL, withIntermediateDirectories: true, attributes: nil)
        print("✅ Created Documents directory")
      } catch {
        print("❌ Failed to create Documents directory: \(error)")
        throw RecorderError.error(
          name: "DIRECTORY_CREATION_FAILED",
          message: "Could not create Documents directory: \(error.localizedDescription)"
        )
      }
    } else {
      print("✅ Documents directory already exists")
    }

    // 2) Find the newest .mp4
    print("🔍 Scanning directory for .mp4 files...")
    let keys: [URLResourceKey] = [
      .contentModificationDateKey, .creationDateKey, .isRegularFileKey, .fileSizeKey,
    ]

    let contents: [URL]
    do {
      contents = try FileManager.default.contentsOfDirectory(
        at: docsURL,
        includingPropertiesForKeys: keys,
        options: [.skipsHiddenFiles]
      )
      print("📂 Found \(contents.count) total files in directory")
    } catch {
      print("❌ Failed to read directory contents: \(error)")
      throw error
    }

    let mp4s = contents.filter { $0.pathExtension.lowercased() == "mp4" }
    print("🎥 Found \(mp4s.count) .mp4 files")

    if mp4s.isEmpty {
      print("⚠️ No .mp4 files found, returning nil")
      return nil
    }

    // Log all mp4 files found
    for (index, mp4) in mp4s.enumerated() {
      print("📄 MP4 #\(index + 1): \(mp4.lastPathComponent)")
    }

    guard
      let latestURL = try mp4s.max(by: { a, b in
        do {
          let va = try a.resourceValues(forKeys: Set(keys))
          let vb = try b.resourceValues(forKeys: Set(keys))
          let da = va.contentModificationDate ?? va.creationDate ?? .distantPast
          let db = vb.contentModificationDate ?? vb.creationDate ?? .distantPast

          print("📅 Comparing dates:")
          print("   \(a.lastPathComponent): \(da)")
          print("   \(b.lastPathComponent): \(db)")
          print("   Result: \(a.lastPathComponent) \(da < db ? "<" : ">=") \(b.lastPathComponent)")

          return da < db
        } catch {
          print("❌ Error getting resource values for comparison: \(error)")
          throw error
        }
      })
    else {
      print("❌ Failed to find latest file (this shouldn't happen if mp4s is not empty)")
      return nil
    }

    print("🏆 Latest file selected: \(latestURL.lastPathComponent)")

    // 3) Build ScreenRecordingFile
    print("📊 Getting file attributes...")
    let attrs: [FileAttributeKey: Any]
    do {
      attrs = try FileManager.default.attributesOfItem(atPath: latestURL.path)
      print("✅ Successfully got file attributes")
    } catch {
      print("❌ Failed to get file attributes: \(error)")
      throw error
    }

    let size = (attrs[.size] as? NSNumber)?.doubleValue ?? 0.0
    print("📏 File size: \(size) bytes (\(size / 1024 / 1024) MB)")

    print("🎵 Creating AVURLAsset for duration...")
    let asset = AVURLAsset(url: latestURL)
    let duration = CMTimeGetSeconds(asset.duration)
    print("⏱️ Duration: \(duration) seconds")

    // Read mic flag saved by the extension
    print("🎤 Checking microphone setting...")
    let micEnabled =
      UserDefaults(suiteName: appGroupId)?
      .bool(forKey: "LastBroadcastMicrophoneWasEnabled") ?? false
    print("🎤 Microphone was enabled: \(micEnabled)")

    let result = ScreenRecordingFile(
      path: latestURL.path,
      name: latestURL.lastPathComponent,
      size: size,
      duration: duration,
      enabledMicrophone: micEnabled
    )

    print("✅ Successfully created ScreenRecordingFile:")
    print("   Path: \(result.path)")
    print("   Name: \(result.name)")
    print("   Size: \(result.size)")
    print("   Duration: \(result.duration)")
    print("   Mic: \(result.enabledMicrophone)")
    print("🎬 getLastGlobalRecording: Function completed successfully")

    return result
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
