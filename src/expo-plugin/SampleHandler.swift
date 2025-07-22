//
//  SampleHandler.swift
//  broadcast-extension
//
//  Created by Christopher Gabba on 7/22/25.
//

import ReplayKit

class SampleHandler: RPBroadcastSampleHandler {

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    // User has requested to start the broadcast. Setup info from the UI extension can be supplied but optional.
  }

  override func broadcastPaused() {
    // User has requested to pause the broadcast. Samples will stop being delivered.
  }

  override func broadcastResumed() {
    // User has requested to resume the broadcast. Samples delivery will resume.
  }

  override func broadcastFinished() {
    // User has requested to finish the broadcast.
  }

  override func processSampleBuffer(
    _ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType
  ) {
    switch sampleBufferType {
    case RPSampleBufferType.video:
      // Handle video sample buffer
      break
    case RPSampleBufferType.audioApp:
      // Handle audio sample buffer for app audio
      break
    case RPSampleBufferType.audioMic:
      // Handle audio sample buffer for mic audio
      break
    @unknown default:
      // Handle other sample buffer types
      fatalError("Unknown type of sample buffer")
    }
  }
}

// import ReplayKit
// import AVFoundation
// import Foundation

// class BroadcastSampleHandler: RPBroadcastSampleHandler {

//   private var assetWriter: AVAssetWriter?
//   private var videoInput: AVAssetWriterInput?
//   private var audioAppInput: AVAssetWriterInput?
//   private var audioMicInput: AVAssetWriterInput?

//   private var isRecording = false
//   private var recordingURL: URL?
//   private var enableMicrophone = true
//   private var enableCamera = false
//   private var recordingId: String?

//   override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
//     // Get configuration from setup UI
//     if let setupInfo = setupInfo {
//       enableMicrophone = setupInfo["enableMicrophone"] as? Bool ?? true
//       enableCamera = setupInfo["enableCamera"] as? Bool ?? false
//       recordingId = setupInfo["recordingId"] as? String ?? UUID().uuidString
//     }

//     setupRecording()
//   }

//   override func broadcastPaused() {
//     // Handle broadcast pause
//     print("Broadcast paused")
//   }

//   override func broadcastResumed() {
//     // Handle broadcast resume
//     print("Broadcast resumed")
//   }

//   override func broadcastFinished() {
//     // Clean up recording
//     finishRecording()
//   }

//   override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
//     switch sampleBufferType {
//     case .video:
//       handleVideoSampleBuffer(sampleBuffer)
//     case .audioApp:
//       handleAudioAppSampleBuffer(sampleBuffer)
//     case .audioMic:
//       if enableMicrophone {
//         handleAudioMicSampleBuffer(sampleBuffer)
//       }
//     @unknown default:
//       break
//     }
//   }

//   private func setupRecording() {
//     // Create shared container URL
//     guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.your.app.screenrecorder") else {
//       finishBroadcastWithError(NSError(domain: "BroadcastSampleHandler", code: -1, userInfo: [NSLocalizedDescriptionKey: "Could not access shared container"]))
//       return
//     }

//     // Create recordings directory
//     let recordingsURL = containerURL.appendingPathComponent("recordings")
//     try? FileManager.default.createDirectory(at: recordingsURL, withIntermediateDirectories: true)

//     // Create output file
//     let fileName = "\(recordingId ?? UUID().uuidString)_\(Int(Date().timeIntervalSince1970)).mp4"
//     recordingURL = recordingsURL.appendingPathComponent(fileName)

//     guard let outputURL = recordingURL else {
//       finishBroadcastWithError(NSError(domain: "BroadcastSampleHandler", code: -2, userInfo: [NSLocalizedDescriptionKey: "Could not create output URL"]))
//       return
//     }

//     do {
//       // Create asset writer
//       assetWriter = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)

//       // Video settings
//       let videoSettings: [String: Any] = [
//         AVVideoCodecKey: AVVideoCodecType.h264,
//         AVVideoWidthKey: 1080, // You might want to get actual screen dimensions
//         AVVideoHeightKey: 1920,
//         AVVideoCompressionPropertiesKey: [
//           AVVideoAverageBitRateKey: 8000000,
//           AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
//         ]
//       ]

//       videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
//       videoInput?.expectsMediaDataInRealTime = true

//       if let videoInput = videoInput, assetWriter!.canAdd(videoInput) {
//         assetWriter!.add(videoInput)
//       }

//       // Audio app settings
//       let audioAppSettings: [String: Any] = [
//         AVFormatIDKey: kAudioFormatMPEG4AAC,
//         AVSampleRateKey: 44100,
//         AVNumberOfChannelsKey: 2,
//         AVEncoderBitRateKey: 128000
//       ]

//       audioAppInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioAppSettings)
//       audioAppInput?.expectsMediaDataInRealTime = true

//       if let audioAppInput = audioAppInput, assetWriter!.canAdd(audioAppInput) {
//         assetWriter!.add(audioAppInput)
//       }

//       // Audio mic settings (if enabled)
//       if enableMicrophone {
//         let audioMicSettings: [String: Any] = [
//           AVFormatIDKey: kAudioFormatMPEG4AAC,
//           AVSampleRateKey: 44100,
//           AVNumberOfChannelsKey: 1,
//           AVEncoderBitRateKey: 64000
//         ]

//         audioMicInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioMicSettings)
//         audioMicInput?.expectsMediaDataInRealTime = true

//         if let audioMicInput = audioMicInput, assetWriter!.canAdd(audioMicInput) {
//           assetWriter!.add(audioMicInput)
//         }
//       }

//       isRecording = true

//     } catch {
//       finishBroadcastWithError(error)
//     }
//   }

//   private func handleVideoSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
//     guard isRecording else { return }

//     if assetWriter?.status == .unknown {
//       assetWriter?.startWriting()
//       assetWriter?.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
//     }

//     if let videoInput = videoInput,
//        videoInput.isReadyForMoreMediaData,
//        assetWriter?.status == .writing {
//       videoInput.append(sampleBuffer)
//     }
//   }

//   private func handleAudioAppSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
//     guard isRecording else { return }

//     if let audioAppInput = audioAppInput,
//        audioAppInput.isReadyForMoreMediaData,
//        assetWriter?.status == .writing {
//       audioAppInput.append(sampleBuffer)
//     }
//   }

//   private func handleAudioMicSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
//     guard isRecording, enableMicrophone else { return }

//     if let audioMicInput = audioMicInput,
//        audioMicInput.isReadyForMoreMediaData,
//        assetWriter?.status == .writing {
//       audioMicInput.append(sampleBuffer)
//     }
//   }

//   private func finishRecording() {
//     guard isRecording else { return }

//     isRecording = false

//     videoInput?.markAsFinished()
//     audioAppInput?.markAsFinished()
//     audioMicInput?.markAsFinished()

//     assetWriter?.finishWriting { [weak self] in
//       guard let self = self else { return }

//       if self.assetWriter?.status == .completed {
//         // Notify the main app that recording is complete
//         self.notifyMainApp()
//       } else if let error = self.assetWriter?.error {
//         self.finishBroadcastWithError(error)
//       }
//     }
//   }

//   private func notifyMainApp() {
//     // Send notification to main app through shared container
//     guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.your.app.screenrecorder"),
//           let recordingURL = recordingURL else { return }

//     let notificationFile = containerURL.appendingPathComponent("latest_recording.json")

//     let recordingInfo: [String: Any] = [
//       "filePath": recordingURL.path,
//       "fileName": recordingURL.lastPathComponent,
//       "timestamp": Date().timeIntervalSince1970,
//       "recordingId": recordingId ?? "unknown"
//     ]

//     do {
//       let jsonData = try JSONSerialization.data(withJSONObject: recordingInfo)
//       try jsonData.write(to: notificationFile)

//       // Send Darwin notification to main app
//       CFNotificationCenterPostNotification(
//         CFNotificationCenterGetDarwinCenter(),
//         CFNotificationName("com.yourapp.recording.completed" as CFString),
//         nil,
//         nil,
//         true
//       )
//     } catch {
//       print("Error notifying main app: \(error.localizedDescription)")
//     }
//   }
// }
