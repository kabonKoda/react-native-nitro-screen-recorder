import AVFoundation
import Foundation
import NitroModules
import ReplayKit

extension UIViewController {
  func topMostViewController() -> UIViewController {
    if let p = presentedViewController {
      return p.topMostViewController()
    }
    if let nav = self as? UINavigationController,
       let v = nav.visibleViewController {
      return v.topMostViewController()
    }
    if let tab = self as? UITabBarController,
       let s = tab.selectedViewController {
      return s.topMostViewController()
    }
    return self
  }
}

enum RecorderError: Error {
  case error(name: String, message: String)
}

typealias RecordingFinishedCallback = (ScreenRecordingFile) -> Void

class NitroScreenRecorder: HybridNitroScreenRecorderSpec {

  private let recorder = RPScreenRecorder.shared()
  private var broadcastController: RPBroadcastController?
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

    // Store recording preferences in shared container for the broadcast extension
    storeRecordingPreferences(enableMic: enableMic, enableCamera: enableCamera)

    RPBroadcastActivityViewController.load { [weak self] picker, error in
      guard let self = self else { return }
      if let error = error {
        print("Picker load failed:", error)
        return
      }
      guard let picker = picker else {
        print("No picker")
        return
      }
//      picker.delegate = self
      
      // Present from top VC
      DispatchQueue.main.async {
        UIApplication.shared
          .connectedScenes
          .compactMap { $0 as? UIWindowScene }
          .first?
          .windows
          .first(where: { $0.isKeyWindow })?
          .rootViewController?
          .topMostViewController()
          .present(picker, animated: true)
      }
    }
  }
  
  private func storeRecordingPreferences(enableMic: Bool, enableCamera: Bool) {
    guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
          let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      print("Could not access shared container")
      return
    }
    
    let preferencesFile = containerURL.appendingPathComponent("recording_preferences.json")
    
    let preferences: [String: Any] = [
      "enableMicrophone": enableMic,
      "enableCamera": enableCamera,
      "recordingId": globalRecordingId ?? UUID().uuidString,
      "timestamp": Date().timeIntervalSince1970
    ]
    
    do {
      let jsonData = try JSONSerialization.data(withJSONObject: preferences)
      try jsonData.write(to: preferencesFile)
    } catch {
      print("Error storing recording preferences: \(error.localizedDescription)")
    }
  }

  @objc(broadcastActivityViewController:didFinishWithBroadcastController:error:)
  func broadcastActivityViewController(
    _ broadcastActivityViewController: RPBroadcastActivityViewController,
    didFinishWith broadcastController: RPBroadcastController?,
    error: Error?
  ) {
    broadcastActivityViewController.dismiss(animated: true) {
      if let err = error {
        print("Setup error:", err)
        return
      }
      guard let controller = broadcastController else {
        print("No controller returned")
        return
      }
      self.broadcastController = controller
//      controller.delegate = self
      controller.startBroadcast { [weak self] err in
        if let err = err {
          print("Broadcast start failed:", err.localizedDescription)
        } else {
          print("Global broadcast started")
          // Start polling for completion
          self?.startPollingForCompletion()
        }
      }
    }
  }
  
  // MARK: - RPBroadcastControllerDelegate
  
  func broadcastController(_ broadcastController: RPBroadcastController, didFinishWithError error: Error?) {
    print("Broadcast finished with error: \(error?.localizedDescription ?? "none")")
    // Stop polling and try to retrieve the file
    stopPolling()
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
      self?.retrieveRecordedFile()
    }
  }
  
  func broadcastController(_ broadcastController: RPBroadcastController, didUpdateServiceInfo serviceInfo: [String : NSCoding & NSObjectProtocol]) {
    print("Broadcast service info updated: \(serviceInfo)")
  }

  func stopRecording() throws {
    if isGlobalRecording {
      guard let controller = broadcastController else {
        throw RecorderError.error(
          name: "NO_BROADCAST",
          message: "Global broadcast not active"
        )
      }
      controller.finishBroadcast { [weak self] error in
        if let err = error {
          print("Finish broadcast failed:", err)
        } else {
          print("Broadcast finished successfully")
          // Stop polling and try to retrieve file after a delay
          self?.stopPolling()
          DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.retrieveRecordedFile()
          }
        }
      }
    } else {
      // Stop in-app recording
      guard recorder.isRecording else {
        throw RecorderError.error(
          name: "SCREEN_RECORDING_INACTIVE",
          message: "You called screen recording when it was not active."
        )
      }

      let name = UUID().uuidString + ".mov"
      let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)

      recorder.stopRecording(withOutput: url) { [weak self] error in
        if let error = error {
          print("Error stopping recording: \(error.localizedDescription)")
          return
        }

        let asset = AVURLAsset(url: url)
        let duration = CMTimeGetSeconds(asset.duration)

        self?.onRecordingFinishedCallback?(
          ScreenRecordingFile(
            path: url.absoluteString,
            duration: duration
          )
        )
      }
    }
  }
  
  // MARK: - Polling for Broadcast Extension Completion
  
  private func startPollingForCompletion() {
    stopPolling() // Stop any existing timer
    pollingTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
      self?.checkForRecordingCompletion()
    }
  }
  
  private func stopPolling() {
    pollingTimer?.invalidate()
    pollingTimer = nil
  }
  
  private func checkForRecordingCompletion() {
    guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
          let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      return
    }
    
    let notificationFile = containerURL.appendingPathComponent("latest_recording.json")
    
    // Check if notification file exists
    if FileManager.default.fileExists(atPath: notificationFile.path) {
      stopPolling()
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
        self?.retrieveRecordedFile()
      }
    }
  }

  private func retrieveRecordedFile() {
    guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
          let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      print("Could not access shared container")
      return
    }

    let notificationFile = containerURL.appendingPathComponent("latest_recording.json")
    
    // Read the notification file
    guard let jsonData = try? Data(contentsOf: notificationFile),
          let recordingInfo = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
          let filePath = recordingInfo["filePath"] as? String else {
      print("Could not read recording notification file")
      return
    }
    
    let fileURL = URL(fileURLWithPath: filePath)
    
    // Verify file exists
    guard FileManager.default.fileExists(atPath: filePath) else {
      print("Recording file does not exist at path: \(filePath)")
      return
    }
    
    // Get duration
    let asset = AVURLAsset(url: fileURL)
    let duration = CMTimeGetSeconds(asset.duration)
    
    // Call the callback
    onRecordingFinishedCallback?(
      ScreenRecordingFile(
        path: fileURL.absoluteString,
        duration: duration
      )
    )
    
    // Clean up notification file
    try? FileManager.default.removeItem(at: notificationFile)
  }

  func clearFiles() throws {
    // Clear both temporary files and shared container files
    let tempDir = FileManager.default.temporaryDirectory

    // Clear temp directory
    do {
      let tempFiles = try FileManager.default.contentsOfDirectory(
        at: tempDir, includingPropertiesForKeys: nil)
      for file in tempFiles where file.pathExtension == "mov" {
        try FileManager.default.removeItem(at: file)
      }
    } catch {
      print("Error clearing temp files: \(error.localizedDescription)")
    }

    // Clear shared container
    guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
          let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      return
    }
    
    let recordingsURL = containerURL.appendingPathComponent("recordings")
    do {
      let sharedFiles = try FileManager.default.contentsOfDirectory(
        at: recordingsURL, includingPropertiesForKeys: nil)
      for file in sharedFiles {
        try FileManager.default.removeItem(at: file)
      }
    } catch {
      print("Error clearing shared files: \(error.localizedDescription)")
    }
    
    // Clear preferences file
    let preferencesFile = containerURL.appendingPathComponent("recording_preferences.json")
    try? FileManager.default.removeItem(at: preferencesFile)
    
    // Clear notification file
    let notificationFile = containerURL.appendingPathComponent("latest_recording.json")
    try? FileManager.default.removeItem(at: notificationFile)
  }
}
