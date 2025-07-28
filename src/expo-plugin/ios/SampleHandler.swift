import AVFoundation
import ReplayKit
/*
    This file handles the main processing of the global broadcast
*/
class SampleHandler: RPBroadcastSampleHandler {

  let hostAppGroupIdentifier = "group.nitroscreenrecorderexample.example"
  let hostAppScheme = "nitroscreenrecorderexample"

  private var writer: BroadcastWriter?
  private let fileManager: FileManager = .default
  private let notificationCenter = UNUserNotificationCenter.current()
  private let nodeURL: URL

  private var sawMicBuffers = false

  override init() {
    nodeURL = fileManager.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension(for: .mpeg4Movie)

    // Clear only the temp file we’re about to use
    fileManager.removeFileIfExists(url: nodeURL)

    super.init()
  }

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    // (Optional) Enforce single-file policy by removing old .mp4s in the app-group docs dir
    if let docs = fileManager.containerURL(
      forSecurityApplicationGroupIdentifier: hostAppGroupIdentifier)?
      .appendingPathComponent("Library/Documents/", isDirectory: true)
    {
      do {
        let items = try fileManager.contentsOfDirectory(at: docs, includingPropertiesForKeys: nil)
        for u in items where u.pathExtension.lowercased() == "mp4" {
          try? fileManager.removeItem(at: u)
        }
      } catch {
        debugPrint("cleanup error:", error)
      }
    }

    let screen: UIScreen = .main
    do {
      writer = try .init(
        outputURL: nodeURL,
        screenSize: screen.bounds.size,
        screenScale: screen.scale
      )
      try writer?.start()
    } catch {
      assertionFailure(error.localizedDescription)
      finishBroadcastWithError(error)
    }
  }

  override func processSampleBuffer(
    _ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType
  ) {
    guard let writer = writer else {
      debugPrint("processSampleBuffer: Writer is nil")
      return
    }

    if sampleBufferType == .audioMic {
      sawMicBuffers = true
    }

    do {
      _ = try writer.processSampleBuffer(sampleBuffer, with: sampleBufferType)
    } catch {
      debugPrint("processSampleBuffer error:", error.localizedDescription)
    }
  }

  override func broadcastPaused() { writer?.pause() }
  override func broadcastResumed() { writer?.resume() }

  override func broadcastFinished() {
    guard let writer = writer else { return }

    let outputURL: URL
    do {
      outputURL = try writer.finish()
    } catch {
      debugPrint("writer failure", error)
      return
    }

    guard
      let containerURL =
        fileManager
        .containerURL(forSecurityApplicationGroupIdentifier: hostAppGroupIdentifier)?
        .appendingPathComponent("Library/Documents/", isDirectory: true)
    else {
      fatalError("no container directory")
    }
    do {
      try fileManager.createDirectory(at: containerURL, withIntermediateDirectories: true)
    } catch {
      debugPrint("error creating", containerURL, error)
    }

    let destination = containerURL.appendingPathComponent(outputURL.lastPathComponent)
    do {
      debugPrint("Moving", outputURL, "to:", destination)
      try self.fileManager.moveItem(at: outputURL, to: destination)
    } catch {
      debugPrint("ERROR moving:", error)
    }

    // Persist the mic flag for the *last* broadcast
    if let defaults = UserDefaults(suiteName: hostAppGroupIdentifier) {
      defaults.set(sawMicBuffers, forKey: "LastBroadcastMicrophoneWasEnabled")
    }

    debugPrint("FINISHED")
  }
}

extension FileManager {

  func removeFileIfExists(url: URL) {
    guard fileExists(atPath: url.path) else { return }
    do {
      try removeItem(at: url)
    } catch {
      print("error removing item \(url)", error)
    }
  }
}

