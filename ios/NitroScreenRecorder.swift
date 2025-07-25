import AVFoundation
import Foundation
import NitroModules
import ReplayKit

enum RecorderError: Error {
  case error(name: String, message: String)
}

typealias RecordingFinishedCallback = (ScreenRecordingFile) -> Void

class NitroScreenRecorder: HybridNitroScreenRecorderSpec {

  private let recorder = RPScreenRecorder.shared()

  private var broadcastDelegate: BroadcastDelegate?
  private var activeBroadcastController: RPBroadcastController?

  private var onRecordingFinishedCallback: RecordingFinishedCallback?
  private var isGlobalRecording = false
  private var globalRecordingId: String?

  private var broadcastExtensionBundleID: String?

  // Polling timer for checking broadcast extension completion
  private var pollingTimer: Timer?

  override init() {
    super.init()
    self.broadcastExtensionBundleID = "nitroscreenrecorderexample.example.broadcast-extension"
  }

  deinit {
    stopPolling()
  }

  private func mapAVAuthorizationStatusToPermissionResponse(_ status: AVAuthorizationStatus)
    -> PermissionResponse
  {
    // -1 means that it never expires (default for iOS)
    switch status {
    case .authorized:
      return PermissionResponse(
        canAskAgain: false,
        granted: true,
        status: .granted,
        expiresAt: -1
      )
    case .denied:
      return PermissionResponse(
        canAskAgain: false,
        granted: false,
        status: .denied,
        expiresAt: -1
      )
    case .notDetermined:
      return PermissionResponse(
        canAskAgain: true,
        granted: false,
        status: .undetermined,
        expiresAt: -1
      )
    case .restricted:
      return PermissionResponse(
        canAskAgain: false,
        granted: false,
        status: .denied,
        expiresAt: -1
      )
    @unknown default:
      return PermissionResponse(
        canAskAgain: true,
        granted: false,
        status: .undetermined,
        expiresAt: -1
      )
    }
  }

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

  private func getAppGroupIdentifier() throws -> String {
    let appGroupIdentifier: String? =
      Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String

    guard let appGroupIdentifier = appGroupIdentifier else {
      throw RecorderError.error(
        name: "APP_GROUP_IDENTIFIER_MISSING",
        message: "appGroupIdentifier is nil"
      )
    }
    return appGroupIdentifier
  }
  
  private func getExtensionBundleId() throws -> String {
    let extensionBundleId: String? =
      Bundle.main.object(forInfoDictionaryKey: "CFBundleIdentifier") as? String

    guard let extensionBundleId = extensionBundleId else {
      throw RecorderError.error(
        name: "APP_GROUP_IDENTIFIER_MISSING",
        message: "appGroupIdentifier is nil"
      )
    }
    return extensionBundleId
  }

  func startInAppRecording(
    enableMic: Bool,
    enableCamera: Bool,
    onRecordingFinished: @escaping RecordingFinishedCallback
  ) throws {

    self.onRecordingFinishedCallback = onRecordingFinished
    self.isGlobalRecording = false

    guard self.recorder.isAvailable else {
      throw RecorderError.error(
        name: "SCREEN_RECORDER_UNAVAILABLE",
        message: "Screen recording is not available"
      )
    }

    recorder.isCameraEnabled = enableCamera
    recorder.isMicrophoneEnabled = enableMic
    recorder.startRecording { [weak self] error in
      if let error = error {
        print("Error starting in-app recording: \(error.localizedDescription)")
      }
    }
  }

  func startGlobalRecording(
    enableMic: Bool,
    enableCamera: Bool,
    onRecordingFinished: @escaping RecordingFinishedCallback
  ) throws {
    self.onRecordingFinishedCallback = onRecordingFinished
    self.isGlobalRecording = true
    self.globalRecordingId = UUID().uuidString

    guard recorder.isAvailable else {
      throw RecorderError.error(
        name: "SCREEN_RECORDER_UNAVAILABLE",
        message: "Screen recording not available"
      )
    }

    // Store preferences for the broadcast extension
    try storeRecordingPreferences(enableMic: enableMic, enableCamera: enableCamera)

    // Use direct broadcast controller creation
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      // Create the system broadcast picker
      let broadcastPicker = RPSystemBroadcastPickerView(
        frame: CGRect(x: 0, y: 0, width: 50, height: 50))

      // Set preferred extension if you have one
      if let bundleID = self.broadcastExtensionBundleID {
        broadcastPicker.preferredExtension = bundleID
      }

      // Style the picker (optional)
      broadcastPicker.showsMicrophoneButton = false

      // Add to the current view temporarily
      guard
        let window = UIApplication.shared
          .connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first?
          .windows
          .first(where: { $0.isKeyWindow })
      else {
        return
      }

      // Make it invisible but functional
      broadcastPicker.alpha = 0.01
      window.addSubview(broadcastPicker)

      // Programmatically trigger the picker
      // This will show the system broadcast interface immediately
      if let button = broadcastPicker.subviews.first(where: { $0 is UIButton }) as? UIButton {
        button.sendActions(for: .touchUpInside)
      }

      // Clean up the picker view after a short delay
      DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
        broadcastPicker.removeFromSuperview()
      }

      // Start polling for completion
      self.startPollingForCompletion()
    }
  }

  private func storeRecordingPreferences(enableMic: Bool, enableCamera: Bool) throws {
    let appGroupId = try getAppGroupIdentifier()

    guard
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId
      )
    else {
      throw RecorderError.error(
        name: "APP_GROUP_ACCESS_FAILED",
        message: "Could not access app group container"
      )
    }

    let preferencesFile = containerURL.appendingPathComponent("recording_preferences.json")

    let preferences: [String: Any] = [
      "enableMicrophone": enableMic,
      "enableCamera": enableCamera,
      "recordingId": globalRecordingId ?? UUID().uuidString,
      "timestamp": Date().timeIntervalSince1970,
    ]

    do {
      let jsonData = try JSONSerialization.data(withJSONObject: preferences)
      try jsonData.write(to: preferencesFile)
      print("Recording preferences stored successfully")
    } catch {
      throw RecorderError.error(
        name: "PREFERENCES_WRITE_FAILED",
        message: "Failed to store recording preferences: \(error.localizedDescription)"
      )
    }
  }

  func handleBroadcastControllerReceived(_ broadcastController: RPBroadcastController) {
    self.activeBroadcastController = broadcastController
    print("Made it here")
    // Start the broadcast immediately
    broadcastController.startBroadcast { [weak self] error in
      if let error = error {
        print("Failed to start broadcast:", error)
        self?.handleBroadcastError(error)
      } else {
        print("Broadcast started successfully!")
        let url = broadcastController.broadcastURL
        print("Broadcast URL: \(url)")
        self?.startPollingForCompletion()
      }
    }
  }

  func handleBroadcastCancelled(error: Error?) {
    print("Broadcast was cancelled")
    broadcastDelegate = nil
    activeBroadcastController = nil
    isGlobalRecording = false
  }

  func handleBroadcastError(_ error: Error) {
    print("Broadcast error:", error)
    // Call callback with error
    let errorFile = ScreenRecordingFile(
      path: "",
      duration: 0,
    )
    onRecordingFinishedCallback?(errorFile)
  }

  func stopRecording() {
    activeBroadcastController?.finishBroadcast { [weak self] error in
      if let error = error {
        print("Error stopping broadcast:", error)
      } else {
        print("Broadcast stopped successfully")
      }
      self?.cleanupRecording()
    }
  }

  private func cleanupRecording() {
    activeBroadcastController = nil
    broadcastDelegate = nil
    isGlobalRecording = false
  }

  func clearFiles() throws {
    return
  }

  private func startPollingForCompletion() {
    // Poll for completion notification from broadcast extension
    Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] timer in
      guard let self = self, self.isGlobalRecording else {
        timer.invalidate()
        return
      }

      self.checkForCompletedRecording { completed in
        if completed {
          timer.invalidate()
        }
      }
    }
  }

  private func stopPolling() {
    pollingTimer?.invalidate()
    pollingTimer = nil
  }

  private func checkForCompletedRecording(completion: @escaping (Bool) -> Void) {
    guard let appGroupId = try? getAppGroupIdentifier(),
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId)
    else {
      completion(false)
      return
    }

    let notificationFile = containerURL.appendingPathComponent("latest_recording.json")

    guard let jsonData = try? Data(contentsOf: notificationFile),
      let recordingInfo = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
      let filePath = recordingInfo["filePath"] as? String,
      let fileName = recordingInfo["fileName"] as? String,
      let timestamp = recordingInfo["timestamp"] as? TimeInterval
    else {
      completion(false)
      return
    }

    // Check if this is a new recording (within last 5 seconds of when we started)
    let recordingDate = Date(timeIntervalSince1970: timestamp)
    let now = Date()

    if now.timeIntervalSince(recordingDate) < 5 {
      // Get file size and duration
      let fileURL = URL(fileURLWithPath: filePath)
      let fileSize =
        (try? FileManager.default.attributesOfItem(atPath: filePath)[.size] as? Int64) ?? 0

      let recordingFile = ScreenRecordingFile(
        path: filePath,
        duration: 0,
      )

      onRecordingFinishedCallback?(recordingFile)
      cleanupRecording()

      // Clean up notification file
      try? FileManager.default.removeItem(at: notificationFile)

      completion(true)
    } else {
      completion(false)
    }
  }
}

private class BroadcastDelegate: NSObject, RPBroadcastActivityViewControllerDelegate {
  weak var recorder: NitroScreenRecorder?

  init(recorder: NitroScreenRecorder) {
    self.recorder = recorder
    super.init()
  }

  func broadcastActivityViewController(
    _ broadcastActivityViewController: RPBroadcastActivityViewController,
    didFinishWith broadcastController: RPBroadcastController?,
    error: Error?
  ) {
    broadcastActivityViewController.dismiss(animated: true)

    if let error = error {
      print("User cancelled or error occurred:", error)
      recorder?.handleBroadcastCancelled(error: error)
      return
    }

    guard let broadcastController = broadcastController else {
      print("No broadcast controller received")
      recorder?.handleBroadcastCancelled(error: nil)
      return
    }

    recorder?.handleBroadcastControllerReceived(broadcastController)
  }
}

// MARK: - Extensions

extension UIViewController {
  func topMostViewController() -> UIViewController {
    if let presented = presentedViewController {
      return presented.topMostViewController()
    }
    if let navigation = self as? UINavigationController {
      return navigation.visibleViewController?.topMostViewController() ?? self
    }
    if let tab = self as? UITabBarController {
      return tab.selectedViewController?.topMostViewController() ?? self
    }
    return self
  }
}
