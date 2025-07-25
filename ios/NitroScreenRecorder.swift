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
  private var activeBroadcastController: RPBroadcastController?

  private var onRecordingFinishedCallback: RecordingFinishedCallback?
  private var isGlobalRecording = false
  private var globalRecordingId: String?

  // Polling timer for checking broadcast extension completion
  private var pollingTimer: Timer?

  override init() {
    super.init()
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

  private func getBroadcastExtensionBundleId() -> String? {
    guard
      let mainAppBundleId = Bundle.main.object(forInfoDictionaryKey: "CFBundleIdentifier")
        as? String
    else {
      return nil
    }
    return "\(mainAppBundleId).broadcast-extension"
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

  func startGlobalRecording() throws {

    self.isGlobalRecording = true
    self.globalRecordingId = UUID().uuidString

    guard recorder.isAvailable else {
      throw RecorderError.error(
        name: "SCREEN_RECORDER_UNAVAILABLE",
        message: "Screen recording not available"
      )
    }

    // Use direct broadcast controller creation
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }

      // Create the system broadcast picker
      let broadcastPicker = RPSystemBroadcastPickerView(
        frame: CGRect(x: 0, y: 0, width: 50, height: 50))

      // Set preferred extension if you have one
      if let bundleID = getBroadcastExtensionBundleId() {
        broadcastPicker.preferredExtension = bundleID
      }

      // Style the picker (optional)
      broadcastPicker.showsMicrophoneButton = true

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

  func stopInAppRecording() {
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
