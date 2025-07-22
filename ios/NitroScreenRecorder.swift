import AVFoundation
import Foundation
import NitroModules
import ReplayKit

enum RecorderError: Error {
  case error(name: String, message: String)
}

typealias RecordingFinishedCallback = (ScreenRecordingFile) -> Void
//typealias RecordingErrorCallback = (String) -> Void

class NitroScreenRecorder: HybridNitroScreenRecorderSpec {

  let recorder = RPScreenRecorder.shared()

  private var onRecordingFinishedCallback: RecordingFinishedCallback?
  private var isGlobalRecording = false
  //  private var onRecordingErrorCallback: RecordingErrorCallback?

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

    // Get your broadcast extension bundle ID
    let extensionBundleID = Bundle.main.bundleIdentifier! + ".BroadcastUploadExtension"

    RPBroadcastController.showSetupViewController(extensionBundleID: extensionBundleID) {
      [weak self] controller, error in
      if let error = error {
        print("Error setting up broadcast: \(error.localizedDescription)")
        return
      }

      guard let controller = controller else {
        print("No broadcast controller returned")
        return
      }

      self?.broadcastController = controller
      controller.delegate = self

      // Start broadcasting
      controller.startBroadcast { error in
        if let error = error {
          print("Error starting broadcast: \(error.localizedDescription)")
        } else {
          print("Global recording started successfully")
        }
      }
    }
  }

  func stopRecording() throws {
    if isGlobalRecording {
      // Stop global recording
      broadcastController?.finishBroadcast { [weak self] error in
        if let error = error {
          print("Error stopping broadcast: \(error.localizedDescription)")
        } else {
          // Broadcast stopped, get the recorded file from shared container
          self?.retrieveRecordedFile()
        }
      }
    } else {
      // Stop in-app recording (your current implementation)
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

  private func retrieveRecordedFile() {
    // Access the shared container where the extension saved the recording
    guard
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.your.app.screenrecorder")
    else {
      print("Could not access shared container")
      return
    }

    let recordingsURL = containerURL.appendingPathComponent("recordings")

    do {
      let files = try FileManager.default.contentsOfDirectory(
        at: recordingsURL, includingPropertiesForKeys: [.creationDateKey], options: [])

      // Get the most recent recording
      let sortedFiles = files.sorted { file1, file2 in
        let date1 =
          (try? file1.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date.distantPast
        let date2 =
          (try? file2.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date.distantPast
        return date1 > date2
      }

      if let latestFile = sortedFiles.first {
        let asset = AVURLAsset(url: latestFile)
        let duration = CMTimeGetSeconds(asset.duration)

        onRecordingFinishedCallback?(
          ScreenRecordingFile(
            path: latestFile.absoluteString,
            duration: duration
          )
        )
      }
    } catch {
      print("Error retrieving recorded file: \(error.localizedDescription)")
    }
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
    if let containerURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.your.app.screenrecorder")
    {
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
    }
  }

  //
  //
  //      // Store callbacks and recording mode
  //      self.onRecordingFinished = onRecordingFinishedCallback
  //      self.onRecordingError = onRecordingErrorCallback
  //      self.isSystemWideRecording = options.systemWideRecording
  //
  //      // Check if recording is available

  //
  //      // Set up recording options
  //      self.recorder.isCameraEnabled = options.enableCamera
  //      self.recorder.isMicrophoneEnabled = options.enableMic
  //
  //      if options.systemWideRecording {
  //        // System-wide recording (records entire screen, including other apps)
  //        self.recorder.startRecording { [weak self] (error) in
  //          guard let self = self else { return }
  //
  //          if let error = error {
  //            DispatchQueue.main.async {
  //              self.onRecordingError?(error)
  //            }
  //          }
  //          // Recording started successfully - continues when switching apps
  //        }
  //      } else {
  //        // App-only recording (records only this app's content)
  //        // Create output URL for local recording
  //        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
  //        let outputURL = documentsPath.appendingPathComponent("recording_\(Date().timeIntervalSince1970).mp4")
  //        self.outputURL = outputURL
  //
  //        // Start recording with capture handler for app-only recording
  //        self.recorder.startCapture(handler: { [weak self] (sampleBuffer, bufferType, error) in
  //          guard let self = self else { return }
  //
  //          if let error = error {
  //            DispatchQueue.main.async {
  //              self.onRecordingError?(error)
  //            }
  //            return
  //          }
  //
  //          // Process the sample buffer
  //          self.processSampleBuffer(sampleBuffer, bufferType: bufferType)
  //
  //        }) { [weak self] (error) in
  //          guard let self = self else { return }
  //
  //          if let error = error {
  //            DispatchQueue.main.async {
  //              self.onRecordingError?(error)
  //            }
  //          }
  //        }
  //      }
  //    }

  //   public func stopRecording() throws {

  //        guard recorder.isRecording else {
  //            let error = NSError(domain: "ScreenRecorder", code: 2, userInfo: [NSLocalizedDescriptionKey: "Recording is not active"])
  //            throw error
  //        }
  //
  //        if isSystemWideRecording {
  //            // Stop system-wide recording
  //            recorder.stopRecording { [weak self] (previewViewController, error) in
  //                guard let self = self else { return }
  //
  //                if let error = error {
  //                    DispatchQueue.main.async {
  //                        self.onRecordingError?(error)
  //                    }
  //                    return
  //                }
  //
  //                // The recording is automatically saved to Photos
  ////                if let previewVC = previewViewController {
  ////                    // Set up delegate using a helper class
  ////                    let delegateHelper = PreviewControllerDelegateHelper()
  ////                    previewVC.previewControllerDelegate = delegateHelper
  ////
  ////                    DispatchQueue.main.async {
  ////                        // Return success message for system recording
  ////                        self.onRecordingFinished?("Recording saved to Photos")
  ////                    }
  ////                }
  //            }
  //        } else {
  //            // Stop app-only recording
  //            recorder.stopCapture { [weak self] (error) in
  //                guard let self = self else { return }
  //
  //                if let error = error {
  //                    DispatchQueue.main.async {
  //                        self.onRecordingError?(error)
  //                    }
  //                    return
  //                }
  //
  //                // Finalize the local recording
  //                self.finalizeRecording()
  //            }
  //        }
  //        return
  //   }

  //   public func clearFiles() throws {
  //        if isSystemWideRecording {
  //            // With system recording, files are saved to Photos by default
  //            // You can't directly delete them from Photos via API
  //            print("System recordings are saved to Photos and cannot be programmatically deleted")
  //        } else {
  //            // Clear local app recording files
  //            let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
  //            let fileManager = FileManager.default
  //
  //            do {
  //                let files = try fileManager.contentsOfDirectory(at: documentsPath, includingPropertiesForKeys: nil)
  //                for file in files {
  //                    if file.pathExtension == "mp4" && file.lastPathComponent.hasPrefix("recording_") {
  //                        try fileManager.removeItem(at: file)
  //                    }
  //                }
  //            } catch {
  //                throw error
  //            }
  //        }
  //        return
  //   }

}
//
//// MARK: - Private Methods (for app-only recording)
//extension NitroScreenRecorder {
//
//    private func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, bufferType: RPSampleBufferType) {
//        guard let assetWriter = assetWriter, assetWriter.status == .writing else {
//            setupAssetWriter()
//            return
//        }
//
//        switch bufferType {
//        case .video:
//            if let videoInput = videoInput, videoInput.isReadyForMoreMediaData {
//                videoInput.append(sampleBuffer)
//            }
//        case .audioApp, .audioMic:
//            if let audioInput = audioInput, audioInput.isReadyForMoreMediaData {
//                audioInput.append(sampleBuffer)
//            }
//        @unknown default:
//            break
//        }
//    }
//
//    private func setupAssetWriter() {
//        guard let outputURL = outputURL else { return }
//
//        do {
//            assetWriter = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
//
//            // Video input settings
//            let videoSettings: [String: Any] = [
//                AVVideoCodecKey: AVVideoCodecType.h264,
//                AVVideoWidthKey: UIScreen.main.bounds.width * UIScreen.main.scale,
//                AVVideoHeightKey: UIScreen.main.bounds.height * UIScreen.main.scale,
//                AVVideoCompressionPropertiesKey: [
//                    AVVideoAverageBitRateKey: 6000000
//                ]
//            ]
//
//            videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
//            videoInput?.expectsMediaDataInRealTime = true
//
//            if let videoInput = videoInput, assetWriter?.canAdd(videoInput) == true {
//                assetWriter?.add(videoInput)
//            }
//
//            // Audio input settings (if microphone is enabled)
//            if recorder.isMicrophoneEnabled {
//                let audioSettings: [String: Any] = [
//                    AVFormatIDKey: kAudioFormatMPEG4AAC,
//                    AVSampleRateKey: 44100,
//                    AVNumberOfChannelsKey: 2,
//                    AVEncoderBitRateKey: 128000
//                ]
//
//                audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
//                audioInput?.expectsMediaDataInRealTime = true
//
//                if let audioInput = audioInput, assetWriter?.canAdd(audioInput) == true {
//                    assetWriter?.add(audioInput)
//                }
//            }
//
//            assetWriter?.startWriting()
//            assetWriter?.startSession(atSourceTime: CMTime.zero)
//
//        } catch {
//            DispatchQueue.main.async { [weak self] in
//                self?.onRecordingError?(error)
//            }
//        }
//    }
//
//    private func finalizeRecording() {
//        guard let assetWriter = assetWriter else { return }
//
//        assetWriter.finishWriting { [weak self] in
//            guard let self = self else { return }
//
//            DispatchQueue.main.async {
//                if assetWriter.status == .completed {
//                    if let outputURL = self.outputURL {
//                      self.onRecordingFinished?(ScreenRecordingFile(filePath: outputURL.path))
//                    }
//                } else {
//                    let error = assetWriter.error ?? NSError(domain: "ScreenRecorder", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to finalize recording"])
//                    self.onRecordingError?(error)
//                }
//            }
//        }
//
//        // Clean up
//        self.assetWriter = nil
//        self.videoInput = nil
//        self.audioInput = nil
//        self.outputURL = nil
//    }
//

//}
