import AVFoundation
import ReplayKit
import UserNotifications
import Darwin

@_silgen_name("finishBroadcastGracefully")
func finishBroadcastGracefully(_ handler: RPBroadcastSampleHandler)

/*
 Handles the main processing of the global broadcast.
 The app-group identifier is fetched from the extension's Info.plist
 ("BroadcastExtensionAppGroupIdentifier" key) so you don't have to hard-code it here.
 */
final class SampleHandler: RPBroadcastSampleHandler {

  // MARK: – Properties

  private func appGroupIDFromPlist() -> String? {
    guard let value = Bundle.main.object(forInfoDictionaryKey: "BroadcastExtensionAppGroupIdentifier") as? String,
      !value.isEmpty
    else {
      return nil
    }
    return value
  }
  
  // Store both the CFString and CFNotificationName versions
  private static let stopNotificationString = "com.nitroscreenrecorder.stopBroadcast" as CFString
  private static let stopNotificationName = CFNotificationName(stopNotificationString)

  private lazy var hostAppGroupIdentifier: String? = {
    return appGroupIDFromPlist()
  }()

  private var writer: BroadcastWriter?
  private let fileManager: FileManager = .default
  private let nodeURL: URL
  private var sawMicBuffers = false
  
  // Frame streaming support
  private var frameStreamingEnabled = false
  private var recordingStartTime: CMTime?
  private var lastFrameTime: TimeInterval = 0
  private let minFrameInterval: TimeInterval = 1.0 / 30.0 // 30 FPS max

  // MARK: – Init
  override init() {
    nodeURL = fileManager.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension(for: .mpeg4Movie)

    fileManager.removeFileIfExists(url: nodeURL)
    super.init()
  }
  
  deinit {
    CFNotificationCenterRemoveObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
      SampleHandler.stopNotificationName,
      nil
    )
  }
  
  private func startListeningForStopSignal() {
    let center = CFNotificationCenterGetDarwinNotifyCenter()

    CFNotificationCenterAddObserver(
      center,
      UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
      { _, observer, name, _, _ in
        guard
          let observer,
          let name,
          name == SampleHandler.stopNotificationName
        else { return }

        let me = Unmanaged<SampleHandler>
          .fromOpaque(observer)
          .takeUnretainedValue()
        me.stopBroadcastGracefully()
      },
      SampleHandler.stopNotificationString,
      nil,
      .deliverImmediately
    )
    
    // Listen for frame streaming control
    let enableStreamingNotification = CFNotificationName("com.nitroscreenrecorder.enableFrameStreaming" as CFString)
    CFNotificationCenterAddObserver(
      center,
      UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
      { _, observer, name, _, _ in
        guard let observer else { return }
        let handler = Unmanaged<SampleHandler>.fromOpaque(observer).takeUnretainedValue()
        handler.enableFrameStreaming(true)
      },
      enableStreamingNotification.rawValue,
      nil,
      .deliverImmediately
    )
    
    let disableStreamingNotification = CFNotificationName("com.nitroscreenrecorder.disableFrameStreaming" as CFString)
    CFNotificationCenterAddObserver(
      center,
      UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
      { _, observer, name, _, _ in
        guard let observer else { return }
        let handler = Unmanaged<SampleHandler>.fromOpaque(observer).takeUnretainedValue()
        handler.enableFrameStreaming(false)
      },
      disableStreamingNotification.rawValue,
      nil,
      .deliverImmediately
    )
  }

  // MARK: – Broadcast lifecycle
  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    startListeningForStopSignal()

    guard let groupID = hostAppGroupIdentifier else {
      finishBroadcastWithError(
        NSError(
          domain: "SampleHandler", 
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Missing app group identifier"]
        )
      )
      return
    }

    // Read recording configuration from UserDefaults
    let defaults = UserDefaults(suiteName: groupID)
    let enableRecording = defaults?.bool(forKey: "enableRecording") ?? true
    let enableStreaming = defaults?.bool(forKey: "enableStreaming") ?? false
    let bitrate = defaults?.integer(forKey: "bitrate") ?? 0 // 0 means use default
    let fps = defaults?.integer(forKey: "fps") ?? 60
    
    // Store streaming configuration
    frameStreamingEnabled = enableStreaming

    // Clean up old recordings
    cleanupOldRecordings(in: groupID)

    // Start recording if enabled
    if enableRecording {
      let screen: UIScreen = .main
      do {
        writer = try .init(
          outputURL: nodeURL,
          screenSize: screen.bounds.size,
          screenScale: screen.scale,
          bitrate: bitrate > 0 ? bitrate : nil,
          frameRate: fps
        )
        try writer?.start()
      } catch {
        finishBroadcastWithError(error)
      }
    }
  }

  private func cleanupOldRecordings(in groupID: String) {
    guard let docs = fileManager.containerURL(
      forSecurityApplicationGroupIdentifier: groupID)?
      .appendingPathComponent("Library/Documents/", isDirectory: true)
    else { return }

    do {
      let items = try fileManager.contentsOfDirectory(at: docs, includingPropertiesForKeys: nil)
      for url in items where url.pathExtension.lowercased() == "mp4" {
        try? fileManager.removeItem(at: url)
      }
    } catch {
      // Non-critical error, continue with broadcast
    }
  }

  override func processSampleBuffer(
    _ sampleBuffer: CMSampleBuffer,
    with sampleBufferType: RPSampleBufferType
  ) {
    guard let writer else { return }

    if sampleBufferType == .audioMic { 
      sawMicBuffers = true 
    }

    // Extract frame if streaming is enabled and this is a video buffer
    if frameStreamingEnabled && sampleBufferType == .video {
      extractAndSendFrame(from: sampleBuffer)
    }

    do {
      _ = try writer.processSampleBuffer(sampleBuffer, with: sampleBufferType)
    } catch {
      finishBroadcastWithError(error)
    }
  }

  override func broadcastPaused() { 
    writer?.pause() 
  }
  
  override func broadcastResumed() { 
    writer?.resume() 
  }

  private func stopBroadcastGracefully() {
    finishBroadcastGracefully(self)
  }
  
  override func broadcastFinished() {
    guard let writer else { return }

    // Finish writing
    let outputURL: URL
    do {
      outputURL = try writer.finish()
    } catch {
      // Writer failed, but we can't call finishBroadcastWithError here
      // as we're already in the finish process
      return
    }

    guard let groupID = hostAppGroupIdentifier else { return }

    // Get container directory
    guard let containerURL = fileManager
      .containerURL(forSecurityApplicationGroupIdentifier: groupID)?
      .appendingPathComponent("Library/Documents/", isDirectory: true)
    else { return }

    // Create directory if needed
    do {
      try fileManager.createDirectory(at: containerURL, withIntermediateDirectories: true)
    } catch {
      return
    }

    // Move file to shared container
    let destination = containerURL.appendingPathComponent(outputURL.lastPathComponent)
    do {
      try fileManager.moveItem(at: outputURL, to: destination)
    } catch {
      // File move failed, but we can't error out at this point
      return
    }

    // Persist microphone state
    UserDefaults(suiteName: groupID)?
      .set(sawMicBuffers, forKey: "LastBroadcastMicrophoneWasEnabled")
  }
}

  // MARK: - Frame Extraction
  
  private func extractAndSendFrame(from sampleBuffer: CMSampleBuffer) {
    // Throttle frame extraction based on configured interval
    let currentTime = CACurrentMediaTime()
    guard currentTime - lastFrameTime >= minFrameInterval else { return }
    lastFrameTime = currentTime
    
    guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    
    // Lock the base address of the pixel buffer
    CVPixelBufferLockBaseAddress(imageBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(imageBuffer, .readOnly) }
    
    // Get pixel buffer info
    let width = CVPixelBufferGetWidth(imageBuffer)
    let height = CVPixelBufferGetHeight(imageBuffer)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(imageBuffer)
    
    guard let baseAddress = CVPixelBufferGetBaseAddress(imageBuffer) else { return }
    
    // Get presentation timestamp
    let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    let timestampSeconds = CMTimeGetSeconds(timestamp)
    
    // Calculate relative timestamp from recording start
    let relativeTimestamp: Double
    if let startTime = recordingStartTime {
      relativeTimestamp = CMTimeGetSeconds(timestamp - startTime)
    } else {
      recordingStartTime = timestamp
      relativeTimestamp = 0.0
    }
    
    // Create frame data dictionary
    let frameData: [String: Any] = [
      "width": width,
      "height": height,
      "bytesPerRow": bytesPerRow,
      "timestamp": timestampSeconds,
      "relativeTimestamp": relativeTimestamp,
      "format": "BGRA"
    ]
    
    // Send notification with frame metadata
    if let groupID = hostAppGroupIdentifier {
      let defaults = UserDefaults(suiteName: groupID)
      
      // Store frame metadata
      if let jsonData = try? JSONSerialization.data(withJSONObject: frameData),
         let jsonString = String(data: jsonData, encoding: .utf8) {
        defaults?.set(jsonString, forKey: "LastFrameMetadata")
        defaults?.set(Date().timeIntervalSince1970, forKey: "LastFrameTime")
      }
      
      // Send Darwin notification that a frame is available
      let frameNotification = CFNotificationName("com.nitroscreenrecorder.frameAvailable" as CFString)
      CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        frameNotification,
        nil,
        nil,
        true
      )
    }
  }
  
  private func enableFrameStreaming(_ enabled: Bool) {
    frameStreamingEnabled = enabled
    if enabled {
      recordingStartTime = nil
      lastFrameTime = 0
    }
  }
}

// MARK: – Helpers
extension FileManager {
  fileprivate func removeFileIfExists(url: URL) {
    guard fileExists(atPath: url.path) else { return }
    try? removeItem(at: url)
  }
}