import ReplayKit
import UIKit

class BroadcastSetupViewController: UIViewController {

  override func viewDidLoad() {
    super.viewDidLoad()
    setupMinimalUI()
    loadPreferences()

    // Auto-start after a brief delay to allow UI to appear
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
      self.autoStartRecording()
    }
  }

  private func setupMinimalUI() {
    view.backgroundColor = .systemBackground

    let titleLabel = UILabel()
    titleLabel.text = "Starting Screen Recording..."
    titleLabel.font = UIFont.systemFont(ofSize: 18, weight: .medium)
    titleLabel.textAlignment = .center
    titleLabel.textColor = .label
    titleLabel.translatesAutoresizingMaskIntoConstraints = false

    let activityIndicator = UIActivityIndicatorView(style: .medium)
    activityIndicator.startAnimating()
    activityIndicator.translatesAutoresizingMaskIntoConstraints = false

    let stack = UIStackView(arrangedSubviews: [titleLabel, activityIndicator])
    stack.axis = .vertical
    stack.spacing = 16
    stack.alignment = .center
    stack.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(stack)

    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])
  }

  private func loadPreferences() {
    // Keep your existing loadPreferences code
    guard
      let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId)
    else {
      return
    }

    let preferencesFile = containerURL.appendingPathComponent("recording_preferences.json")

    guard let jsonData = try? Data(contentsOf: preferencesFile),
      let preferences = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
    else {
      return
    }
  }

  private func autoStartRecording() {
    guard
      let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
      let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupId)
    else {
      completeWithError("Could not access app group")
      return
    }

    let preferencesFile = containerURL.appendingPathComponent("recording_preferences.json")

    var enableMic = true
    var enableCamera = false
    var recordingId = UUID().uuidString

    if let jsonData = try? Data(contentsOf: preferencesFile),
      let preferences = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
    {
      enableMic = preferences["enableMicrophone"] as? Bool ?? true
      enableCamera = preferences["enableCamera"] as? Bool ?? false
      recordingId = preferences["recordingId"] as? String ?? UUID().uuidString
    }

    let setupInfo: [String: NSCoding & NSObjectProtocol] = [
      "enableMicrophone": NSNumber(value: enableMic),
      "enableCamera": NSNumber(value: enableCamera),
      "recordingId": NSString(string: recordingId),
      "appGroupId": NSString(string: appGroupId),
    ]

    let broadcastURL = URL(string: "rtmp://localhost/live/stream")!

    extensionContext?.completeRequest(
      withBroadcast: broadcastURL,
      setupInfo: setupInfo
    )
  }

  private func completeWithError(_ message: String) {
    let error = NSError(
      domain: "BroadcastSetup",
      code: -2,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
    extensionContext?.cancelRequest(withError: error)
  }
}
