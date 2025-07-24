import ReplayKit
import UIKit

class BroadcastPickerViewController: UIViewController {

  override func viewDidLoad() {
    super.viewDidLoad()

    // Immediately select this extension and dismiss the picker.
    // This is how you achieve a "no UI" setup flow.
    self.extensionContext?.completeRequest(
      withBroadcast: URL(string: "http://example.com")!, setupInfo: nil)
  }
}
