import AVFoundation
import Foundation
import ReplayKit

class SampleHandler: RPBroadcastSampleHandler {

  private var assetWriter: AVAssetWriter?
  private var videoInput: AVAssetWriterInput?
  private var audioAppInput: AVAssetWriterInput?
  private var audioMicInput: AVAssetWriterInput?

  private var isRecording = false
  private var recordingURL: URL?
  private var enableMicrophone = true
  private var enableCamera = false
  private var recordingId: String?

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    print("=== Broadcast Extension Started ===")
    print("Setup info: \(setupInfo ?? [:])")

    // Validate app group access first
    guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String
    else {
      let error = NSError(
        domain: "BroadcastSampleHandler", code: -1,
        userInfo: [NSLocalizedDescriptionKey: "AppGroupIdentifier not found in Info.plist"])
      print("❌ AppGroupIdentifier missing from broadcast extension Info.plist")
      finishBroadcastWithError(error)
      return
    }

    guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) != nil
    else {
      let error = NSError(
        domain: "BroadcastSampleHandler", code: -2,
        userInfo: [NSLocalizedDescriptionKey: "Cannot access app group container: \(appGroupId)"])
      print("❌ Cannot access app group: \(appGroupId)")
      finishBroadcastWithError(error)
      return
    }

    print("✅ App group access verified: \(appGroupId)")

    // Read preferences from shared container
    readRecordingPreferences()

    print("✅ Broadcast started with mic: \(enableMicrophone), camera: \(enableCamera)")
    setupRecording()
  }

  private func readRecordingPreferences() {
    guard
      let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId)
    else {
      print("Could not access shared container for preferences - using defaults")
      enableMicrophone = true
      enableCamera = false
      recordingId = UUID().uuidString
      return
    }

    let preferencesFile = containerURL.appendingPathComponent("recording_preferences.json")

    guard let jsonData = try? Data(contentsOf: preferencesFile),
      let preferences = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
    else {
      print("Could not read recording preferences - using defaults")
      enableMicrophone = true
      enableCamera = false
      recordingId = UUID().uuidString
      return
    }

    enableMicrophone = preferences["enableMicrophone"] as? Bool ?? true
    enableCamera = preferences["enableCamera"] as? Bool ?? false
    recordingId = preferences["recordingId"] as? String ?? UUID().uuidString

    print(
      "Read preferences: mic=\(enableMicrophone), camera=\(enableCamera), id=\(recordingId ?? "none")"
    )
  }

  override func broadcastPaused() {
    print("Broadcast paused")
  }

  override func broadcastResumed() {
    print("Broadcast resumed")
  }

  override func broadcastFinished() {
    print("Broadcast finished")
    finishRecording()
  }

  override func processSampleBuffer(
    _ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType
  ) {
    switch sampleBufferType {
    case .video:
      handleVideoSampleBuffer(sampleBuffer)
    case .audioApp:
      handleAudioAppSampleBuffer(sampleBuffer)
    case .audioMic:
      if enableMicrophone {
        handleAudioMicSampleBuffer(sampleBuffer)
      }
    @unknown default:
      break
    }
  }

  private func setupRecording() {
    guard
      let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId)
    else {
      finishBroadcastWithError(
        NSError(
          domain: "BroadcastSampleHandler", code: -1,
          userInfo: [NSLocalizedDescriptionKey: "Could not access shared container"]))
      return
    }

    // Create recordings directory
    let recordingsURL = containerURL.appendingPathComponent("recordings")
    do {
      try FileManager.default.createDirectory(at: recordingsURL, withIntermediateDirectories: true)
    } catch {
      print("Error creating recordings directory: \(error)")
      finishBroadcastWithError(error)
      return
    }

    // Create output file
    let fileName = "\(recordingId ?? UUID().uuidString)_\(Int(Date().timeIntervalSince1970)).mp4"
    recordingURL = recordingsURL.appendingPathComponent(fileName)

    guard let outputURL = recordingURL else {
      finishBroadcastWithError(
        NSError(
          domain: "BroadcastSampleHandler", code: -2,
          userInfo: [NSLocalizedDescriptionKey: "Could not create output URL"]))
      return
    }

    do {
      // Create asset writer
      assetWriter = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)

      // Video settings - Get actual screen dimensions
      let screenSize = UIScreen.main.bounds.size
      let scale = UIScreen.main.scale
      let width = Int(screenSize.width * scale)
      let height = Int(screenSize.height * scale)

      let videoSettings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: 8_000_000,
          AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ],
      ]

      videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
      videoInput?.expectsMediaDataInRealTime = true

      if let videoInput = videoInput, assetWriter!.canAdd(videoInput) {
        assetWriter!.add(videoInput)
      }

      // Audio app settings
      let audioAppSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: 44100,
        AVNumberOfChannelsKey: 2,
        AVEncoderBitRateKey: 128000,
      ]

      audioAppInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioAppSettings)
      audioAppInput?.expectsMediaDataInRealTime = true

      if let audioAppInput = audioAppInput, assetWriter!.canAdd(audioAppInput) {
        assetWriter!.add(audioAppInput)
      }

      // Audio mic settings (if enabled)
      if enableMicrophone {
        let audioMicSettings: [String: Any] = [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVSampleRateKey: 44100,
          AVNumberOfChannelsKey: 1,
          AVEncoderBitRateKey: 64000,
        ]

        audioMicInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioMicSettings)
        audioMicInput?.expectsMediaDataInRealTime = true

        if let audioMicInput = audioMicInput, assetWriter!.canAdd(audioMicInput) {
          assetWriter!.add(audioMicInput)
        }
      }

      isRecording = true
      print("✅ Recording setup completed successfully")

    } catch {
      print("❌ Error setting up recording: \(error.localizedDescription)")
      finishBroadcastWithError(error)
    }
  }

  private func handleVideoSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
    guard isRecording else { return }

    if assetWriter?.status == .unknown {
      assetWriter?.startWriting()
      assetWriter?.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
      print("Asset writer started")
    }

    if let videoInput = videoInput,
      videoInput.isReadyForMoreMediaData,
      assetWriter?.status == .writing
    {
      videoInput.append(sampleBuffer)
    }
  }

  private func handleAudioAppSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
    guard isRecording else { return }

    if let audioAppInput = audioAppInput,
      audioAppInput.isReadyForMoreMediaData,
      assetWriter?.status == .writing
    {
      audioAppInput.append(sampleBuffer)
    }
  }

  private func handleAudioMicSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
    guard isRecording, enableMicrophone else { return }

    if let audioMicInput = audioMicInput,
      audioMicInput.isReadyForMoreMediaData,
      assetWriter?.status == .writing
    {
      audioMicInput.append(sampleBuffer)
    }
  }

  private func finishRecording() {
    guard isRecording else { return }

    isRecording = false
    print("Finishing recording...")

    videoInput?.markAsFinished()
    audioAppInput?.markAsFinished()
    audioMicInput?.markAsFinished()

    assetWriter?.finishWriting { [weak self] in
      guard let self = self else { return }

      if self.assetWriter?.status == .completed {
        print("✅ Recording completed successfully")
        self.notifyMainApp()
      } else if let error = self.assetWriter?.error {
        print("❌ Recording failed with error: \(error.localizedDescription)")
        self.finishBroadcastWithError(error)
      }
    }
  }

  private func notifyMainApp() {
    guard
      let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId),
      let recordingURL = recordingURL
    else {
      print("Could not access shared container for notification")
      return
    }

    let notificationFile = containerURL.appendingPathComponent("latest_recording.json")

    let recordingInfo: [String: Any] = [
      "filePath": recordingURL.path,
      "fileName": recordingURL.lastPathComponent,
      "timestamp": Date().timeIntervalSince1970,
      "recordingId": recordingId ?? "unknown",
    ]

    do {
      let jsonData = try JSONSerialization.data(withJSONObject: recordingInfo)
      try jsonData.write(to: notificationFile)
      print("✅ Notification file written successfully - main app will detect via polling")
    } catch {
      print("❌ Error notifying main app: \(error.localizedDescription)")
    }
  }
}
