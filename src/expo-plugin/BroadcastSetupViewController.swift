//
//  BroadcastSetupViewController.swift
//  broadcast-extensionSetupUI
//
//  Created by Christopher Gabba on 7/22/25.
//

import ReplayKit

class BroadcastSetupViewController: UIViewController {

  // Call this method when the user has finished interacting with the view controller and a broadcast stream can start
  func userDidFinishSetup() {
    // URL of the resource where broadcast can be viewed that will be returned to the application
    let broadcastURL = URL(string: "http://apple.com/broadcast/streamID")

    // Dictionary with setup information that will be provided to broadcast extension when broadcast is started
    let setupInfo: [String: NSCoding & NSObjectProtocol] = [
      "broadcastName": "example" as NSCoding & NSObjectProtocol
    ]

    // Tell ReplayKit that the extension is finished setting up and can begin broadcasting
    self.extensionContext?.completeRequest(withBroadcast: broadcastURL!, setupInfo: setupInfo)
  }

  func userDidCancelSetup() {
    let error = NSError(domain: "BroadcastSetup", code: -1, userInfo: nil)
    // Tell ReplayKit that the extension was cancelled by the user
    self.extensionContext?.cancelRequest(withError: error)
  }
}

// import UIKit
// import ReplayKit

// class BroadcastSetupViewController: UIViewController {

//   @IBOutlet weak var titleLabel: UILabel!
//   @IBOutlet weak var microphoneSwitch: UISwitch!
//   @IBOutlet weak var cameraSwitch: UISwitch!
//   @IBOutlet weak var startButton: UIButton!
//   @IBOutlet weak var cancelButton: UIButton!

//   override func viewDidLoad() {
//     super.viewDidLoad()
//     setupUI()
//   }

//   private func setupUI() {
//     view.backgroundColor = UIColor.systemBackground

//     // Title
//     titleLabel.text = "Screen Recording Setup"
//     titleLabel.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
//     titleLabel.textAlignment = .center

//     // Switches
//     microphoneSwitch.isOn = true
//     cameraSwitch.isOn = false

//     // Buttons
//     startButton.setTitle("Start Recording", for: .normal)
//     startButton.backgroundColor = UIColor.systemBlue
//     startButton.setTitleColor(.white, for: .normal)
//     startButton.layer.cornerRadius = 8

//     cancelButton.setTitle("Cancel", for: .normal)
//     cancelButton.setTitleColor(.systemRed, for: .normal)
//   }

//   @IBAction func startButtonTapped(_ sender: UIButton) {
//     // Create user info to pass to the upload extension
//     let userInfo: [String: Any] = [
//       "enableMicrophone": microphoneSwitch.isOn,
//       "enableCamera": cameraSwitch.isOn,
//       "recordingId": UUID().uuidString
//     ]

//     // Tell the system to start the broadcast upload extension
//     extensionContext?.completeRequest(withItemsFromExtension: [userInfo]) { _ in
//       // Setup completed, extension will start
//     }
//   }

//   @IBAction func cancelButtonTapped(_ sender: UIButton) {
//     // Cancel the broadcast setup
//     let error = NSError(domain: "BroadcastSetup", code: -1, userInfo: [NSLocalizedDescriptionKey: "User cancelled"])
//     extensionContext?.cancelRequest(withError: error)
//   }
// }
