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
  private var onGlobalRecordingFinishedCallback: RecordingFinishedCallback?
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
        if(inAppRecordingActive) {
          type = .withinapp
        } else {
          type = .global
        }
      } else {
        reason = .ended
        if(inAppRecordingActive) {
          type = .withinapp
        } else {
          type = .global
        }
      }
      let event = ScreenRecordingEvent(type: type, reason: reason)
      recordingEventListeners.forEach { $0.callback(event) }
  }
  
  func addScreenRecordingListener(callback: @escaping (ScreenRecordingEvent) -> Void) throws -> Double {
    let listener = Listener(id: nextListenerId, callback: callback)
    recordingEventListeners.append(listener)
    nextListenerId += 1
    return listener.id
  }
  
  func removeScreenRecordingListener(id: Double) throws {
    recordingEventListeners.removeAll { $0.id == id }
  }
  
  // MARK: - Permission Methods
  public func getCameraPermissionStatus() throws -> Promise<PermissionResponse> {
    return Promise.async {
      let status = AVCaptureDevice.authorizationStatus(for: .video)
      return self.mapAVAuthorizationStatusToPermissionResponse(status)
    }
  }

  public func getMicrophonePermissionStatus() throws -> Promise<PermissionResponse> {
    return Promise.async {
      let status = AVCaptureDevice.authorizationStatus(for: .audio)
      return self.mapAVAuthorizationStatusToPermissionResponse(status)
    }
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
          recordingId: UUID().uuidString,
          path: outputURL.path,
          name: outputURL.lastPathComponent,
          size: attrs[.size] as? Double ?? 0,
          duration: duration,
          timestampCreated: Date(),
          timestampFinished: Date(),
          enabledMicrophone: self.recorder.isMicrophoneEnabled,
          status: "completed"
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
      ----------- GLOBAL RECORDING SECTION ------------------
   1. Generate a url to store the recording the app group in the JSON format:
    {
     path: `appGroupContainerUrl/uuid/screen_recording.mp4`,
     timestampCreated: xx/xx/xxxx,
     timestampFinished: xx/xx/xxx
    },
   2. When the user hits `Start Broadcast` in the Picker, the `SampleHandler.swift` finds the url with
   the most recent `dateCreated` field and uses that path to store the recording in.
   3. When the recording is finished (user taps on the red circle), the `SampleHandler.swift` updates the dateFinished.
   4  (Alternatively) User calls stop global recording, which returns the path.
   5. You then call the `getLatestGlobalRecording` and it will fetch that file.
   6. When the user is done with the file, he can call clean files.
   */

  func presentGlobalBroadcastModal() {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      print("📱 Creating broadcast picker...")

      let broadcastPicker = RPSystemBroadcastPickerView(
        frame: CGRect(x: 2000, y: 2000, width: 1, height: 1))

      let bundleID = getBroadcastExtensionBundleId()
      print("🎯 Preferred extension bundle ID: \(bundleID ?? "none")")

      if let bundleID = bundleID {
        broadcastPicker.preferredExtension = bundleID
      }

      // Show microphone button - user can choose to enable/disable mic in the system picker
      broadcastPicker.showsMicrophoneButton = true

      guard
        let window = UIApplication.shared
          .connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first?
          .windows
          .first(where: { $0.isKeyWindow })
      else {
        print("❌ Could not find key window")
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
      }

      // Clean up the picker after a delay
      DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
        print("🧹 Cleaning up broadcast picker")
        broadcastPicker.removeFromSuperview()
      }

    }
  }

  func startGlobalRecording(onRecordingFinished: @escaping RecordingFinishedCallback) throws {
    //    try? safelyClearGlobalRecordingFiles()
    self.onGlobalRecordingFinishedCallback = onRecordingFinished
    presentGlobalBroadcastModal()
  }

  func stopGlobalRecording() throws -> ScreenRecordingFile? {
    print("🛑 Stopping global recording...")

    return try getLatestGlobalRecording()
  }

  func getLatestGlobalRecording() throws -> ScreenRecordingFile? {
    // 1️⃣ Resolve container
    guard let appGroupId = try? getAppGroupIdentifier(),
      let containerURL = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
    else {
      throw RecorderError.error(
        name: "APP_GROUP_ACCESS_FAILED",
        message: "Could not access app group container"
      )
    }

    let recordingsDir = containerURL.appendingPathComponent("recordings")

    // 🚨 Debug dump
    print("🔍 [App] App Group ID: \(appGroupId)")
    print("🔍 [App] Container URL: \(containerURL.path)")
    print(
      "🔍 [App] recordingsDir.exists: \(FileManager.default.fileExists(atPath: recordingsDir.path))")
    do {
      let rawNames = try FileManager.default.contentsOfDirectory(atPath: recordingsDir.path)
      print("🔍 [App] recordingsDir listing: \(rawNames)")
    } catch {
      print("❌ [App] Failed to list recordingsDir: \(error)")
    }

    // 2️⃣ Find metadata files
    let contents = try FileManager.default.contentsOfDirectory(
      at: recordingsDir,
      includingPropertiesForKeys: [.creationDateKey, .fileSizeKey]
    )

    let metadataFiles = contents.filter {
      $0.lastPathComponent.hasSuffix("_metadata.json")
    }
    print("🔍 [App] metadataFiles found: \(metadataFiles.map { $0.lastPathComponent })")

    guard
      let latestMetaURL = metadataFiles.max(by: { a, b in
        let d1 = (try? a.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .distantPast
        let d2 = (try? b.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .distantPast
        return d1 < d2
      })
    else {
      print("ℹ️ [App] No metadata to parse")
      return nil
    }
    print("🔍 [App] Using metadata: \(latestMetaURL.path)")

    // 3️⃣ Read & log metadata contents
    let data = try Data(contentsOf: latestMetaURL)
    guard let metadata = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw RecorderError.error(name: "INVALID_METADATA", message: "Could not parse JSON")
    }
    print("🔍 [App] Parsed metadata dict: \(metadata)")

    // 4️⃣ Check video file
    let videoPath = metadata["path"] as? String ?? ""
    print("🔍 [App] Video path in metadata: \(videoPath)")
    let exists = FileManager.default.fileExists(atPath: videoPath)
    print("🔍 [App] FileManager.exists(videoPath): \(exists)")
    if exists {
      let attrs = try FileManager.default.attributesOfItem(atPath: videoPath)
      print("🔍 [App] Video attributes: \(attrs)")
    }

    let recordingFile = ScreenRecordingFile(
      recordingId: metadata["recordingId"] as? String ?? "unknown",
      path: metadata["path"] as? String ?? "",
      name: metadata["name"] as? String ?? "",
      size: metadata["size"] as? Double ?? 0,
      duration: metadata["duration"] as? Double ?? 0.0,
      timestampCreated: Date(
        timeIntervalSince1970: metadata["timestampCreated"] as? TimeInterval ?? 0),
      timestampFinished: Date(
        timeIntervalSince1970: metadata["timestampFinished"] as? TimeInterval ?? 0),
      enabledMicrophone: metadata["enabledMicrophone"] as? Bool ?? false,
      status: metadata["status"] as? String ?? "unknown"
    )

    // Verify the actual video file exists
    if FileManager.default.fileExists(atPath: recordingFile.path) {
      return recordingFile
    } else {
      print("⚠️ Metadata found but video file missing at: \(recordingFile.path)")
      return nil
    }
  }

  func safelyClearGlobalRecordingFiles() throws {
    guard let appGroupId = try? getAppGroupIdentifier(),
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId)
    else {
      throw RecorderError.error(
        name: "APP_GROUP_ACCESS_FAILED",
        message: "Could not access app group container"
      )
    }

    let recordingsDir = containerURL.appendingPathComponent("recordings")

    do {
      if FileManager.default.fileExists(atPath: recordingsDir.path) {
        let contents = try FileManager.default.contentsOfDirectory(
          at: recordingsDir, includingPropertiesForKeys: nil)

        for fileURL in contents {
          try FileManager.default.removeItem(at: fileURL)
          print("🗑️ Deleted: \(fileURL.lastPathComponent)")
        }

        print("✅ All recording files cleared")
      }
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
