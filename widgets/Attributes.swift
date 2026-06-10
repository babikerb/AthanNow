import ActivityKit
import Foundation

// Required by react-native-widget-extension. Unused (no Live Activities), kept minimal.
@available(iOS 16.2, *)
struct AthanLiveActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {}
  var name: String = "AthanNow"
}
