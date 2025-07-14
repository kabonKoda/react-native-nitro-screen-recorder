import Foundation
import NitroModules
import ReplayKit

typealias RecordingFinishedCallback = (String) -> Void
typealias RecordingErrorCallback = (Error) -> Void

public struct RecordingOptions: Codable {
  public let enableMic: Bool
}

class NitroScreenRecorder: HybridNitroScreenRecorderSpec {
  let recorder = RPScreenRecorder.shared();
  
  func getCameraPermissionStatus() throws -> Promise<Void> {
    <#code#>
  }
  
  func getMicrophonePermissionStatus() throws -> Promise<Void> {
    <#code#>
  }
  
  func requestCameraPermission() throws -> Promise<Void> {
    <#code#>
  }
  
  func requestMicrophonePermission() throws -> Promise<Void> {
    <#code#>
  }
  
  func startRecording(
    options: RecordingOptions,
    onRecordingFinishedCallback: RecordingFinishedCallback,
    onRecordingErrorCallback: RecordingErrorCallback) throws {
    
  }
  
  func stopRecording() throws {
    <#code#>
  }
  
  func clearFiles() throws {
    <#code#>
  }
  
    public func multiply(a: Double, b: Double) throws -> Double {
        return a * b
    }
}
