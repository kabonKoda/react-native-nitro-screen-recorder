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
  private var enableMicrophone = false
  private var recordingId: String?
  private var startTime: Date?

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    NSLog("🚀 [Ext] broadcastStarted: setupInfo=\(setupInfo ?? [:])")
    startTime = Date()

    enableMicrophone =
      (setupInfo?["RPBroadcastProcessExtensionMicrophoneEnabled"] as? Bool) ?? false
    recordingId = UUID().uuidString
    NSLog("✅ [Ext] mic=\(enableMicrophone), recordingId=\(recordingId!)")

    guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String
    else {
      NSLog("❌ [Ext] Missing AppGroupIdentifier in Info.plist")
      finishBroadcastWithError(NSError(domain: "", code: -1, userInfo: nil))
      return
    }
    NSLog("🔍 [Ext] AppGroupIdentifier=\(appGroupId)")

    setupRecording()
  }

  private func setupRecording() {
    NSLog("🔍 [Ext] setupRecording()")
    guard
      let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId)
    else {
      NSLog("❌ [Ext] Cannot access app group container")
      finishBroadcastWithError(NSError(domain: "", code: -2, userInfo: nil))
      return
    }

    let recordingsDir = containerURL.appendingPathComponent("recordings")
    NSLog("🔍 [Ext] recordingsDir=\(recordingsDir.path)")
    try? FileManager.default.createDirectory(at: recordingsDir, withIntermediateDirectories: true)
    recordingURL = recordingsDir.appendingPathComponent("\(recordingId!).mp4")
    NSLog("🔍 [Ext] recordingURL=\(recordingURL!.path)")

    do {
      assetWriter = try AVAssetWriter(outputURL: recordingURL!, fileType: .mp4)

      // Video
      let screenSize = UIScreen.main.bounds.size
      let scale = UIScreen.main.scale
      let width = Int(screenSize.width * scale)
      let height = Int(screenSize.height * scale)
      let videoSettings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
      ]
      videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
      videoInput?.expectsMediaDataInRealTime = true
      if let v = videoInput, assetWriter!.canAdd(v) {
        assetWriter!.add(v)
        NSLog("✅ [Ext] Added videoInput")
      }

      // App audio
      let audioAppSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: 44100,
        AVNumberOfChannelsKey: 2,
      ]
      audioAppInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioAppSettings)
      audioAppInput?.expectsMediaDataInRealTime = true
      if let a = audioAppInput, assetWriter!.canAdd(a) {
        assetWriter!.add(a)
        NSLog("✅ [Ext] Added audioAppInput")
      }

      // Mic audio
      if enableMicrophone {
        let audioMicSettings: [String: Any] = [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVSampleRateKey: 44100,
          AVNumberOfChannelsKey: 1,
        ]
        audioMicInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioMicSettings)
        audioMicInput?.expectsMediaDataInRealTime = true
        if let m = audioMicInput, assetWriter!.canAdd(m) {
          assetWriter!.add(m)
          NSLog("✅ [Ext] Added audioMicInput")
        }
      }

      isRecording = true
      NSLog("✅ [Ext] setupRecording complete")
    } catch {
      NSLog("❌ [Ext] setupRecording error: \(error.localizedDescription)")
      finishBroadcastWithError(error as NSError)
    }
  }

  override func processSampleBuffer(
    _ sampleBuffer: CMSampleBuffer,
    with sampleBufferType: RPSampleBufferType
  ) {
    guard isRecording, let writer = assetWriter else { return }

    switch sampleBufferType {
    case .video:
      if writer.status == .unknown {
        writer.startWriting()
        writer.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
        NSLog(
          "📸 [Ext] Asset writer started at \(CMSampleBufferGetPresentationTimeStamp(sampleBuffer))")
      }
      if let vIn = videoInput, vIn.isReadyForMoreMediaData {
        let success = vIn.append(sampleBuffer)
        NSLog(
          success
            ? "🎞 [Ext] Appended video buffer"
            : "⚠️ [Ext] Failed to append video buffer")
      }

    case .audioApp:
      if let aIn = audioAppInput, aIn.isReadyForMoreMediaData {
        let success = aIn.append(sampleBuffer)
        NSLog(
          success
            ? "🔊 [Ext] Appended app-audio buffer"
            : "⚠️ [Ext] Failed to append app-audio buffer")
      }

    case .audioMic:
      if enableMicrophone, let mIn = audioMicInput, mIn.isReadyForMoreMediaData {
        let success = mIn.append(sampleBuffer)
        NSLog(
          success
            ? "🎤 [Ext] Appended mic-audio buffer"
            : "⚠️ [Ext] Failed to append mic-audio buffer")
      }

    @unknown default:
      NSLog("⚠️ [Ext] Unknown sampleBufferType: \(sampleBufferType)")
    }
  }

  override func broadcastFinished() {
    NSLog("🛑 [Ext] broadcastFinished()")
    finishRecording()
  }

  private func finishRecording() {
    guard isRecording else { return }
    isRecording = false
    NSLog("🔚 [Ext] finishRecording() - marking inputs finished")

    videoInput?.markAsFinished()
    audioAppInput?.markAsFinished()
    audioMicInput?.markAsFinished()

    assetWriter?.finishWriting { [weak self] in
      guard let self = self else { return }
      NSLog("🔍 [Ext] finishWriting callback; status=\(self.assetWriter?.status.rawValue ?? -1)")
      if self.assetWriter?.status == .completed {
        NSLog("✅ [Ext] Asset writer completed successfully")
        self.createRecordingMetadata()
      } else if let err = self.assetWriter?.error {
        NSLog("❌ [Ext] Asset writer error: \(err.localizedDescription)")
        self.finishBroadcastWithError(err as NSError)
      }
    }
  }

  private func createRecordingMetadata() {
    NSLog("🔍 [Ext] createRecordingMetadata() for URL=\(recordingURL?.path ?? "nil")")
    guard
      let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId),
      let recURL = recordingURL,
      let start = startTime
    else {
      NSLog("❌ [Ext] createRecordingMetadata: missing prerequisites")
      return
    }

    let recordingsDir = containerURL.appendingPathComponent("recordings")
    let metadataFile = recordingsDir.appendingPathComponent(
      "\(recordingId! )_metadata.json"
    )

    let metadata: [String: Any] = [
      "recordingId": recordingId!,
      "path": recURL.path,
      "name": recURL.lastPathComponent,
      "size": (try? FileManager.default.attributesOfItem(atPath: recURL.path)[.size] as? Int) ?? 0,
      "duration": Date().timeIntervalSince(start),
      "timestampCreated": start.timeIntervalSince1970,
      "timestampFinished": Date().timeIntervalSince1970,
      "enabledMicrophone": enableMicrophone,
      "status": "completed",
    ]

    do {
      let jsonData = try JSONSerialization.data(withJSONObject: metadata, options: .prettyPrinted)
      try jsonData.write(to: metadataFile)
      NSLog("✅ [Ext] Wrote metadata to \(metadataFile.path)")

      let dirList = try FileManager.default.contentsOfDirectory(atPath: recordingsDir.path)
      NSLog("🔍 [Ext] recordingsDir now contains: \(dirList)")
    } catch {
      NSLog("❌ [Ext] createRecordingMetadata error: \(error.localizedDescription)")
    }
  }
}
