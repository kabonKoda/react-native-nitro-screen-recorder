import AVFoundation
import Foundation
import NitroModules
import ReplayKit
import UIKit

enum RecorderError: Error {
  case error(name: String, message: String)
}

typealias RecordingFinishedCallback = (ScreenRecordingFile) -> Void
typealias ScreenRecordingListener = (ScreenRecordingEvent) -> Void
typealias BroadcastPickerViewListener = (BroadcastPickerPresentationEvent) -> Void
typealias FrameListener = (ScreenFrame) -> Void

struct Listener<T> {
  let id: Double
  let callback: T
}

struct ScreenRecordingListenerType {
  let id: Double
  let callback: (ScreenRecordingEvent) -> Void
  let ignoreRecordingsInitiatedElsewhere: Bool
}

class NitroScreenRecorder: HybridNitroScreenRecorderSpec {

  let recorder = RPScreenRecorder.shared()
  private var inAppRecordingActive: Bool = false
  private var isGlobalRecordingActive: Bool = false
  private var globalRecordingInitiatedByThisPackage: Bool = false
  private var onInAppRecordingFinishedCallback: RecordingFinishedCallback?
  private var recordingEventListeners: [ScreenRecordingListenerType] = []
  public var broadcastPickerEventListeners: [Listener<BroadcastPickerViewListener>] = []
  private var frameListeners: [Listener<FrameListener>] = []
  private var nextListenerId: Double = 0
  private var frameObserver: CFNotificationCenter?
  private let frameNotificationName = "com.nitro.screenrecorder.frameAvailable" as CFString

  // App state tracking for broadcast modal
  private var isBroadcastModalShowing: Bool = false
  private var appStateObservers: [NSObjectProtocol] = []

  override init() {
    super.init()
    registerListener()
    setupAppStateObservers()
    setupFrameListener()
  }

  deinit {
    unregisterListener()
    removeAppStateObservers()
    removeFrameListener()
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

  private func setupAppStateObservers() {
    // Listen for when app becomes active (foreground)
    let willEnterForegroundObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willEnterForegroundNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.handleAppWillEnterForeground()
    }

    let didBecomeActiveObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.didBecomeActiveNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.handleAppDidBecomeActive()
    }

    appStateObservers = [willEnterForegroundObserver, didBecomeActiveObserver]
  }

  private func removeAppStateObservers() {
    appStateObservers.forEach { observer in
      NotificationCenter.default.removeObserver(observer)
    }
    appStateObservers.removeAll()
  }

  private func handleAppWillEnterForeground() {

    if isBroadcastModalShowing {
      // The modal was showing and now we're coming back to foreground
      // This likely means the user dismissed the modal or started/cancelled broadcasting
      // Small delay to ensure any system UI transitions are complete
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
        self?.handleBroadcastModalDismissed()
      }
    }
  }

  private func handleAppDidBecomeActive() {
    // Additional check when app becomes fully active
    if isBroadcastModalShowing {
      // Double-check that we're actually back and the modal is gone
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
        guard let self = self else { return }

        // Check if there are any presented view controllers
        guard
          let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene }).first,
          let window = windowScene.windows.first(where: { $0.isKeyWindow }),
          let rootVC = window.rootViewController
        else {
          return
        }

        var currentVC = rootVC
        var hasModal = false

        while let presentedVC = currentVC.presentedViewController {
          currentVC = presentedVC
          hasModal = true
        }

        // If we thought the modal was showing but there's no modal, it was dismissed
        if !hasModal && self.isBroadcastModalShowing {
          self.handleBroadcastModalDismissed()
        }
      }
    }
  }

  private func handleBroadcastModalDismissed() {
    guard isBroadcastModalShowing else { return }
    isBroadcastModalShowing = false

    // Notify all listeners that the modal was dismissed
    broadcastPickerEventListeners.forEach { $0.callback(.dismissed) }
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
        globalRecordingInitiatedByThisPackage = false // Reset when global recording ends
      }
    }
    
    let event = ScreenRecordingEvent(type: type, reason: reason)
    
    // Filter listeners based on their ignore preference
    recordingEventListeners.forEach { listener in
      let isExternalGlobalRecording = type == .global && !globalRecordingInitiatedByThisPackage
      let shouldIgnore = listener.ignoreRecordingsInitiatedElsewhere && isExternalGlobalRecording
      
      if !shouldIgnore {
        listener.callback(event)
      }
    }
  }

  func addScreenRecordingListener(
    ignoreRecordingsInitiatedElsewhere: Bool,
    callback: @escaping (ScreenRecordingEvent) -> Void
  ) throws -> Double {
    let listener = ScreenRecordingListenerType(
      id: nextListenerId,
      callback: callback,
      ignoreRecordingsInitiatedElsewhere: ignoreRecordingsInitiatedElsewhere
    )
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
              path: outputURL.absoluteString,
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

  func addBroadcastPickerListener(callback: @escaping (BroadcastPickerPresentationEvent) -> Void)
    throws
    -> Double
  {
    let listener = Listener(id: nextListenerId, callback: callback)
    broadcastPickerEventListeners.append(listener)
    nextListenerId += 1
    return listener.id
  }

  func removeBroadcastPickerListener(id: Double) throws {
    broadcastPickerEventListeners.removeAll { $0.id == id }
  }

  /**
   Attaches a micro PickerView button off-screen and presses that button to open the broadcast.
   */
  func presentGlobalBroadcastModal(enableMicrophone: Bool = true) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      let broadcastPicker = RPSystemBroadcastPickerView(
        frame: CGRect(x: 2000, y: 2000, width: 1, height: 1)
      )
      broadcastPicker.preferredExtension = getBroadcastExtensionBundleId()
      broadcastPicker.showsMicrophoneButton = enableMicrophone

      // ① insert off-screen
      guard
        let windowScene = UIApplication.shared
          .connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first,
        let window = windowScene
          .windows
          .first(where: { $0.isKeyWindow })
      else {
        print("❌ No key window found, cannot present broadcast picker")
        return
      }

      // Make the picker invisible but functional
      broadcastPicker.alpha = 0.01
      window.addSubview(broadcastPicker)

      // ② tap the hidden button to bring up the system modal
      if let btn = broadcastPicker
        .subviews
        .compactMap({ $0 as? UIButton })
        .first
      {
        btn.sendActions(for: .touchUpInside)

        // Mark that we're showing the modal
        self.isBroadcastModalShowing = true
        print("🎯 Broadcast modal marked as showing")

        // Notify listeners
        self.broadcastPickerEventListeners.forEach { $0.callback(.showing) }
      }

      // ③ cleanup the picker after some time
      DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
        broadcastPicker.removeFromSuperview()
        print("🎯 Broadcast picker view removed from superview")
      }
    }
  }

  func startGlobalRecording(
    enableMic: Bool,
    enableRecording: Bool,
    enableStreaming: Bool,
    bitrate: Double,
    fps: Double,
    onRecordingError: @escaping (RecordingError) -> Void
  ) throws {
    guard !isGlobalRecordingActive else {
      print("⚠️ Attempted to start a global recording, but one is already active.")
      let error = RecordingError(
        name: "BROADCAST_ALREADY_ACTIVE",
        message: "A screen recording session is already in progress."
      )
      onRecordingError(error)
      return
    }

    // Validate that at least one mode is enabled
    guard enableRecording || enableStreaming else {
      let error = RecordingError(
        name: "INVALID_CONFIGURATION",
        message: "At least one of enableRecording or enableStreaming must be true"
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

    // Store configuration in UserDefaults for the broadcast extension to read
    if let sharedDefaults = UserDefaults(suiteName: appGroupId) {
      sharedDefaults.set(enableRecording, forKey: "enableRecording")
      sharedDefaults.set(enableStreaming, forKey: "enableStreaming")
      sharedDefaults.set(bitrate > 0 ? Int(bitrate) : 0, forKey: "bitrate")
      sharedDefaults.set(fps > 0 ? Int(fps) : 30, forKey: "fps")
      sharedDefaults.synchronize()
      print("📝 Global recording config saved: recording=\(enableRecording), streaming=\(enableStreaming), bitrate=\(bitrate), fps=\(fps)")
    }

    // Present the broadcast picker
    presentGlobalBroadcastModal(enableMicrophone: enableMic)
    
    // This is sort of a hack to try and track if the user opened the broadcast modal first
    // may not be that reliable, because technically they can open this modal and close it without starting a broadcast
    globalRecordingInitiatedByThisPackage = true

  }
  // This is a hack I learned through:
  // https://mehmetbaykar.com/posts/how-to-gracefully-stop-a-broadcast-upload-extension/
  // Basically you send a kill command through Darwin and you suppress
  // the system error
  func stopGlobalRecording(settledTimeMs: Double) throws -> Promise<ScreenRecordingFile?> {
    return Promise.async {
      guard self.isGlobalRecordingActive else {
        print("⚠️ stopGlobalRecording called but no active global recording.")
        do {
          return try self.retrieveLastGlobalRecording()
        } catch {
          print("❌ retrieveLastGlobalRecording failed after stop:", error)
          return nil
        }
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
      self.globalRecordingInitiatedByThisPackage = false

      // Wait for the specified settle time to allow the broadcast to finish writing the file.
      let settleTimeNanoseconds = UInt64(settledTimeMs * 1_000_000)  // Convert ms to nanoseconds
      try? await Task.sleep(nanoseconds: settleTimeNanoseconds)

      do {
        return try self.retrieveLastGlobalRecording()
      } catch {
        print("❌ retrieveLastGlobalRecording failed after stop:", error)
        return nil
      }
    }
  }

  func retrieveLastGlobalRecording() throws -> ScreenRecordingFile? {
    // Resolve app group documents directory
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

    // Ensure directory exists (in case first run)
    let fm = FileManager.default
    if !fm.fileExists(atPath: docsURL.path) {
      try fm.createDirectory(
        at: docsURL, withIntermediateDirectories: true, attributes: nil
      )
    }

    // Expect at most one .mp4; pick it if present
    let contents = try fm.contentsOfDirectory(
      at: docsURL,
      includingPropertiesForKeys: nil,
      options: [.skipsHiddenFiles]
    )

    let mp4s = contents.filter { $0.pathExtension.lowercased() == "mp4" }

    // If none, return nil
    guard let sourceURL = mp4s.first else { return nil }

    // If there are multiple (unexpected), pick the first and optionally clean extras
    // You could uncomment the following to delete extras:
    // for extra in mp4s.dropFirst() { try? fm.removeItem(at: extra) }

    // Prepare local caches destination
    let cachesURL = try fm.url(
      for: .cachesDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let recordingsDir = cachesURL.appendingPathComponent(
      "ScreenRecordings", isDirectory: true
    )
    if !fm.fileExists(atPath: recordingsDir.path) {
      try fm.createDirectory(
        at: recordingsDir, withIntermediateDirectories: true, attributes: nil
      )
    }

    // Destination file (use same name; avoid collision by appending timestamp)
    var destinationURL =
      recordingsDir.appendingPathComponent(sourceURL.lastPathComponent)
    if fm.fileExists(atPath: destinationURL.path) {
      let ts = Int(Date().timeIntervalSince1970)
      let base = sourceURL.deletingPathExtension().lastPathComponent
      destinationURL = recordingsDir.appendingPathComponent("\(base)-\(ts).mp4")
    }

    // Copy into caches
    try fm.copyItem(at: sourceURL, to: destinationURL)

    // Build ScreenRecordingFile from the local copy
    let attrs = try fm.attributesOfItem(atPath: destinationURL.path)
    let size = (attrs[.size] as? NSNumber)?.doubleValue ?? 0.0

    let asset = AVURLAsset(url: destinationURL)
    let duration = CMTimeGetSeconds(asset.duration)

    let micEnabled =
      UserDefaults(suiteName: appGroupId)?
      .bool(forKey: "LastBroadcastMicrophoneWasEnabled") ?? false

    return ScreenRecordingFile(
      path: destinationURL.absoluteString,
      name: destinationURL.lastPathComponent,
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

  // MARK: - Frame Streaming
  
  private func setupFrameListener() {
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    
    let observer = Unmanaged.passUnretained(self).toOpaque()
    
    CFNotificationCenterAddObserver(
      center,
      observer,
      { (center, observer, name, object, userInfo) in
        guard let observer = observer else { return }
        let mySelf = Unmanaged<NitroScreenRecorder>.fromOpaque(observer).takeUnretainedValue()
        mySelf.handleFrameAvailable()
      },
      frameNotificationName,
      nil,
      .deliverImmediately
    )
  }
  
  private func removeFrameListener() {
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    let observer = Unmanaged.passUnretained(self).toOpaque()
    
    CFNotificationCenterRemoveObserver(
      center,
      observer,
      CFNotificationName(frameNotificationName),
      nil
    )
  }
  
  private func handleFrameAvailable() {
    guard !frameListeners.isEmpty else { return }
    
    // Read frame data from UserDefaults in app group
    guard let appGroupId = try? getAppGroupIdentifier(),
          let userDefaults = UserDefaults(suiteName: appGroupId),
          let frameData = userDefaults.dictionary(forKey: "lastFrameMetadata") else {
      return
    }
    
    // Parse frame metadata
    guard let width = frameData["width"] as? Double,
          let height = frameData["height"] as? Double,
          let bytesPerRow = frameData["bytesPerRow"] as? Double,
          let timestamp = frameData["timestamp"] as? Double,
          let relativeTimestamp = frameData["relativeTimestamp"] as? Double,
          let format = frameData["format"] as? String else {
      return
    }
    
    let frame = ScreenFrame(
      width: width,
      height: height,
      bytesPerRow: bytesPerRow,
      timestamp: timestamp,
      relativeTimestamp: relativeTimestamp,
      format: format
    )
    
    // Notify all frame listeners
    frameListeners.forEach { $0.callback(frame) }
  }
  
  func addFrameListener(callback: @escaping (ScreenFrame) -> Void) throws -> Double {
    let listener = Listener(id: nextListenerId, callback: callback)
    frameListeners.append(listener)
    nextListenerId += 1
    return listener.id
  }
  
  func removeFrameListener(id: Double) throws {
    frameListeners.removeAll { $0.id == id }
  }
  
  func enableFrameStreaming(config: FrameStreamConfig) throws {
    guard let appGroupId = try? getAppGroupIdentifier() else {
      throw RecorderError.error(
        name: "APP_GROUP_NOT_CONFIGURED",
        message: "App group identifier not configured"
      )
    }
    
    // Store config in UserDefaults
    let userDefaults = UserDefaults(suiteName: appGroupId)
    userDefaults?.set(config.targetFps, forKey: "frameStreamTargetFps")
    userDefaults?.set(config.downscaleFactor, forKey: "frameStreamDownscale")
    userDefaults?.set(config.quality, forKey: "frameStreamQuality")
    userDefaults?.synchronize()
    
    // Send Darwin notification to enable frame streaming in broadcast extension
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    CFNotificationCenterPostNotification(
      center,
      CFNotificationName("com.nitro.screenrecorder.enableFrameStreaming" as CFString),
      nil,
      nil,
      true
    )
    
    print("✅ Frame streaming enabled with config: fps=\(config.targetFps), downscale=\(config.downscaleFactor), quality=\(config.quality)")
  }
  
  func disableFrameStreaming() throws {
    // Send Darwin notification to disable frame streaming in broadcast extension
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    CFNotificationCenterPostNotification(
      center,
      CFNotificationName("com.nitro.screenrecorder.disableFrameStreaming" as CFString),
      nil,
      nil,
      true
    )
    
    print("✅ Frame streaming disabled")
  }
}

  func clearRecordingCache() throws {
    try safelyClearGlobalRecordingFiles()
    safelyClearInAppRecordingFiles()
  }
}
