import AVFoundation
import ReplayKit

extension NitroScreenRecorder {
  func mapAVAuthorizationStatusToPermissionResponse(_ status: AVAuthorizationStatus)
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

  func getAppGroupIdentifier() throws -> String {
    let appGroupIdentifier: String? =
      Bundle.main.object(forInfoDictionaryKey: "BroadcastExtensionAppGroupIdentifier") as? String

    guard let appGroupIdentifier = appGroupIdentifier else {
      throw RecorderError.error(
        name: "APP_GROUP_IDENTIFIER_MISSING",
        message: "appGroupIdentifier is nil"
      )
    }
    return appGroupIdentifier
  }

func getBroadcastExtensionBundleId() -> String? {
  // First try to get the custom bundle identifier from Info.plist
  if let customBundleId = Bundle.main.object(forInfoDictionaryKey: "BroadcastExtensionBundleIdentifier") as? String {
    return customBundleId
  }
  
  // Fallback to the default pattern
  guard let mainAppBundleId = Bundle.main.object(forInfoDictionaryKey: "CFBundleIdentifier") as? String else {
    print("❌ Could not get main app bundle identifier")
    return nil
  }
  
  return "\(mainAppBundleId).BroadcastExtension"
}

  private func getCurrentViewController() -> UIViewController? {
    guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
      let window = windowScene.windows.first
    else {
      return nil
    }

    var currentViewController = window.rootViewController

    while let presentedViewController = currentViewController?.presentedViewController {
      currentViewController = presentedViewController
    }

    return currentViewController
  }

  func convertToRPCameraPosition(_ cameraDevice: CameraDevice) -> RPCameraPosition {
    switch cameraDevice {
    case .front:
      return .front
    case .back:
      return .back
    }
  }

  func setupAndDisplayCamera(style: RecorderCameraStyle) {
      guard let preview = recorder.cameraPreviewView else {
        print("⚠️ Camera preview view is not available")
        return
      }

      preview.frame = CGRect(
        x: style.left ?? 0,
        y: style.top ?? 0,
        width: style.width ?? 0,
        height: style.height ?? 0
      )
      preview.layer.cornerRadius = style.borderRadius ?? 0
      preview.layer.borderWidth = style.borderWidth ?? 0
      preview.layer.masksToBounds = true

      guard let parent = UIApplication.shared
        .connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .first?
        .windows
        .first(where: { $0.isKeyWindow }) else {
        return
      }

      if preview.superview == nil {
        parent.addSubview(preview)
      }
    }
  
}