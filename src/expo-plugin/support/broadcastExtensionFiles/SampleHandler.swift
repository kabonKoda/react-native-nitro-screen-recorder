import AVFoundation
import ReplayKit
import UserNotifications  // already imported earlier via UNUserNotificationCenter

/*
 Handles the main processing of the global broadcast.
 The app-group identifier is fetched from the extension’s Info.plist
 (“AppGroupIdentifier” key) so you don’t have to hard-code it here.
 */
final class SampleHandler: RPBroadcastSampleHandler {

  // MARK: – Properties

  /// Still hard-coded; add a plist entry if you’d like this dynamic as well.
  private func appGroupIDFromPlist() -> String? {
    guard let value = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
      !value.isEmpty
    else {
      debugPrint("[SampleHandler] ❌ AppGroupIdentifier missing or empty")
      return nil
    }
    return value
  }

  private lazy var hostAppGroupIdentifier: String? = {
    return appGroupIDFromPlist()
  }()

  private var writer: BroadcastWriter?
  private let fileManager: FileManager = .default
  private let notificationCenter = UNUserNotificationCenter.current()
  private let nodeURL: URL
  private var sawMicBuffers = false

  // MARK: – Init
  override init() {
    nodeURL = fileManager.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension(for: .mpeg4Movie)

    // Clear only the temp file we’re about to use
    fileManager.removeFileIfExists(url: nodeURL)

    super.init()
  }

  // MARK: – Broadcast lifecycle
  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    // (Optional) Enforce single-file policy by removing old .mp4s in the app-group docs dir

    guard let groupID = hostAppGroupIdentifier else {
      finishBroadcastWithError(
        NSError(
          domain: "SampleHandler", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Missing app group identifier"]))
      return
    }

    if let docs = fileManager.containerURL(
      forSecurityApplicationGroupIdentifier: groupID)?
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
    _ sampleBuffer: CMSampleBuffer,
    with sampleBufferType: RPSampleBufferType
  ) {
    guard let writer else {
      debugPrint("processSampleBuffer: Writer is nil")
      return
    }

    if sampleBufferType == .audioMic { sawMicBuffers = true }

    do {
      _ = try writer.processSampleBuffer(sampleBuffer, with: sampleBufferType)
    } catch {
      debugPrint("processSampleBuffer error:", error.localizedDescription)
    }
  }

  override func broadcastPaused() { writer?.pause() }
  override func broadcastResumed() { writer?.resume() }

  override func broadcastFinished() {
    guard let writer else { return }

    let outputURL: URL
    do {
      outputURL = try writer.finish()
    } catch {
      debugPrint("writer failure", error)
      return
    }

    guard let groupID = hostAppGroupIdentifier else {
      finishBroadcastWithError(
        NSError(
          domain: "SampleHandler", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Missing app group identifier"]))
      return
    }

    guard
      let containerURL =
        fileManager
        .containerURL(forSecurityApplicationGroupIdentifier: groupID)?
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
      try fileManager.moveItem(at: outputURL, to: destination)
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

// MARK: – Helpers
extension FileManager {
  fileprivate func removeFileIfExists(url: URL) {
    guard fileExists(atPath: url.path) else { return }
    do { try removeItem(at: url) } catch { print("error removing item \(url)", error) }
  }
}


// //
// //  SampleHandler.swift
// //  ScreenRecorderBroadcastExtension
// //
// //  Complete, self-contained version that compiles with the Darwin-notification
// //  stop mechanism and the Objective-C shim (`finishBroadcastGracefully()`).
// //

// import AVFoundation
// import Darwin  // for the CFNotification APIs
// import ReplayKit
// import UserNotifications

// // MARK: – C shim imported from BroadcastHelper.m
// @_silgen_name("finishBroadcastGracefully")
// func finishBroadcastGracefully(_ handler: RPBroadcastSampleHandler)

// /// Handles the main processing of the global broadcast.
// final class SampleHandler: RPBroadcastSampleHandler {

//   // MARK: – Static identifiers
//   /// Darwin notification name sent by the host app to stop the broadcast.
//   private static let stopNotificationName = CFNotificationName(
//     "com.nitroscreenrecorder.stopBroadcast" as CFString
//   )

//   // MARK: – Stored properties
//   private lazy var hostAppGroupIdentifier: String? = {
//     Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String
//   }()

//   private var writer: BroadcastWriter?
//   private let fileManager: FileManager = .default
//   private let nodeURL: URL
//   private var sawMicBuffers = false

//   // MARK: – Init
//   override init() {
//     nodeURL = fileManager
//       .temporaryDirectory
//       .appendingPathComponent(UUID().uuidString)
//       .appendingPathExtension(for: .mpeg4Movie)

//     fileManager.removeFileIfExists(url: nodeURL)
//     super.init()
//   }

//   // MARK: – Broadcast lifecycle
//   override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
//     startListeningForStopSignal()  // 👂 wait for host-app "stop" command

//     guard let groupID = hostAppGroupIdentifier else {
//       finishBroadcastWithError(
//         NSError(
//           domain: "SampleHandler",
//           code: 1,
//           userInfo: [NSLocalizedDescriptionKey: "Missing app-group identifier"]
//         )
//       )
//       return
//     }

//     // ───── Optional: purge stale .mp4s in the App-Group container ─────
//     if let docs = fileManager.containerURL(forSecurityApplicationGroupIdentifier: groupID)?
//       .appendingPathComponent("Library/Documents/", isDirectory: true)
//     {
//       do {
//         let items = try fileManager.contentsOfDirectory(
//           at: docs,
//           includingPropertiesForKeys: nil)
//         for u in items where u.pathExtension.lowercased() == "mp4" {
//           try? fileManager.removeItem(at: u)
//         }
//       } catch {
//         debugPrint("[SampleHandler] ⚠️ Cleanup error: \(error.localizedDescription)")
//       }
//     }

//     // ───── Start writer ─────
//     do {
//       let screen = UIScreen.main
//       writer = try .init(
//         outputURL: nodeURL,
//         screenSize: screen.bounds.size,
//         screenScale: screen.scale)
//       try writer?.start()
//     } catch {
//       finishBroadcastWithError(error)
//     }
//   }

//   override func processSampleBuffer(
//     _ sampleBuffer: CMSampleBuffer,
//     with type: RPSampleBufferType
//   ) {
//     if type == .audioMic { sawMicBuffers = true }
//     try? writer?.processSampleBuffer(sampleBuffer, with: type)
//   }

//   override func broadcastPaused() { writer?.pause() }
//   override func broadcastResumed() { writer?.resume() }

//   override func broadcastFinished() {
//     // 1. Stop the writer and get the temp file
//     guard
//       let writer,
//       let outputURL = try? writer.finish(),
//       let groupID = hostAppGroupIdentifier,
//       let container =
//         fileManager
//         .containerURL(forSecurityApplicationGroupIdentifier: groupID)?
//         .appendingPathComponent("Library/Documents/", isDirectory: true)
//     else { return }

//     // 2. Move the file into the shared container
//     try? fileManager.createDirectory(at: container, withIntermediateDirectories: true)
//     let dest = container.appendingPathComponent(outputURL.lastPathComponent)
//     try? fileManager.moveItem(at: outputURL, to: dest)

//     // 3. Persist whether mic was on
//     UserDefaults(suiteName: groupID)?
//       .set(sawMicBuffers, forKey: "LastBroadcastMicrophoneWasEnabled")
//   }

//   // MARK: – Graceful stop handling
//   private func startListeningForStopSignal() {
//     let center = CFNotificationCenterGetDarwinNotifyCenter()

//     CFNotificationCenterAddObserver(
//       center,
//       UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
//       { _, observer, name, _, _ in
//         guard
//           let observer,
//           let name,
//           name == SampleHandler.stopNotificationName
//         else { return }

//         let me = Unmanaged<SampleHandler>
//           .fromOpaque(observer)
//           .takeUnretainedValue()
//         me.stopBroadcastGracefully()
//       },
//       (SampleHandler.stopNotificationName as! CFString),  // ✅ Use the CFNotificationName
//       nil,
//       .deliverImmediately
//     )
//   }

//   /// Wrapper around the Obj-C shim.
//   private func stopBroadcastGracefully() {
//     finishBroadcastGracefully(self)  // triggers `broadcastFinished()`
//   }

//   deinit {
//     CFNotificationCenterRemoveObserver(
//       CFNotificationCenterGetDarwinNotifyCenter(),
//       UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
//       SampleHandler.stopNotificationName,  // ✅ Use the CFNotificationName property
//       nil
//     )
//   }
// }

// // MARK: – Tiny FileManager helper
// extension FileManager {
//   fileprivate func removeFileIfExists(url: URL) {
//     if fileExists(atPath: url.path) { try? removeItem(at: url) }
//   }
// }
