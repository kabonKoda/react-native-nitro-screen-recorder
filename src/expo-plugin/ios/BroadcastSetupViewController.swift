import ReplayKit
import UIKit

class BroadcastSetupViewController: UIViewController {
  // MARK: - UI Elements

  private let titleLabel = UILabel()
  private let messageLabel = UILabel()
  private let startButton = UIButton(type: .system)
  private let cancelButton = UIButton(type: .system)

  // MARK: - View Lifecycle

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
    loadPreferences()
  }

  // MARK: - UI Setup

  private func setupUI() {
    view.backgroundColor = .systemBackground

    // Title
    titleLabel.text = "Screen Recording"
    titleLabel.font = UIFont.systemFont(ofSize: 20, weight: .bold)
    titleLabel.textAlignment = .center

    // Message
    messageLabel.text = "Ready to start screen recording with your app settings."
    messageLabel.font = UIFont.systemFont(ofSize: 16)
    messageLabel.textAlignment = .center
    messageLabel.numberOfLines = 0
    messageLabel.textColor = .secondaryLabel

    // Start Button
    startButton.setTitle("Start Recording", for: .normal)
    startButton.backgroundColor = .systemBlue
    startButton.setTitleColor(.white, for: .normal)
    startButton.layer.cornerRadius = 12
    startButton.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .medium)
    startButton.addTarget(self, action: #selector(startButtonTapped), for: .touchUpInside)

    // Cancel Button
    cancelButton.setTitle("Cancel", for: .normal)
    cancelButton.setTitleColor(.systemRed, for: .normal)
    cancelButton.titleLabel?.font = UIFont.systemFont(ofSize: 16)
    cancelButton.addTarget(self, action: #selector(cancelButtonTapped), for: .touchUpInside)

    // Stack View
    let stack = UIStackView(arrangedSubviews: [
      titleLabel,
      messageLabel,
      startButton,
      cancelButton,
    ])
    stack.axis = .vertical
    stack.spacing = 24
    stack.alignment = .fill
    stack.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(stack)

    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
      stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
      startButton.heightAnchor.constraint(equalToConstant: 50),
      cancelButton.heightAnchor.constraint(equalToConstant: 44),
    ])
  }
  
  private func loadPreferences() {
    guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
          let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      return
    }
    
    let preferencesFile = containerURL.appendingPathComponent("recording_preferences.json")
    
    guard let jsonData = try? Data(contentsOf: preferencesFile),
          let preferences = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
      return
    }
    
    let enableMic = preferences["enableMicrophone"] as? Bool ?? true
    let enableCamera = preferences["enableCamera"] as? Bool ?? false
    
    var settingsText = "Settings: "
    var components: [String] = []
    
    if enableMic {
      components.append("Microphone")
    }
    if enableCamera {
      components.append("Camera")
    }
    
    if components.isEmpty {
      components.append("Screen only")
    }
    
    settingsText += components.joined(separator: " + ")
    messageLabel.text = "Ready to start screen recording.\n\n\(settingsText)"
  }

  // MARK: - Actions

  @objc private func startButtonTapped() {
    // Read preferences from shared container
    guard let appGroupId = Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String,
          let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
      completeWithError("Could not access app group")
      return
    }
    
    let preferencesFile = containerURL.appendingPathComponent("recording_preferences.json")
    
    var enableMic = true
    var enableCamera = false
    var recordingId = UUID().uuidString
    
    // Read preferences if they exist
    if let jsonData = try? Data(contentsOf: preferencesFile),
       let preferences = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
      enableMic = preferences["enableMicrophone"] as? Bool ?? true
      enableCamera = preferences["enableCamera"] as? Bool ?? false
      recordingId = preferences["recordingId"] as? String ?? UUID().uuidString
    }

    // Build setup info dictionary
    let setupInfo: [String: NSCoding & NSObjectProtocol] = [
      "enableMicrophone": NSNumber(value: enableMic),
      "enableCamera": NSNumber(value: enableCamera),
      "recordingId": NSString(string: recordingId),
      "appGroupId": NSString(string: appGroupId),
    ]

    // Dummy broadcast URL (required by the API but not actually used)
    let broadcastURL = URL(string: "rtmp://localhost/live/stream")!

    // Complete setup and start the broadcast
    extensionContext?.completeRequest(
      withBroadcast: broadcastURL,
      setupInfo: setupInfo
    )
  }

  @objc private func cancelButtonTapped() {
    let error = NSError(
      domain: "BroadcastSetup", 
      code: -1, 
      userInfo: [NSLocalizedDescriptionKey: "User cancelled recording"]
    )
    extensionContext?.cancelRequest(withError: error)
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