import AVKit
import ExpoModulesCore
import SwiftUI

final class AirPlayProps: ExpoSwiftUI.ViewProps {
  /// The icon's colour, as #RRGGBB.
  @Field var tintHex: String = "#FFFFFF"
}

/// Apple's AirPlay route picker: tap to send the recitation to a speaker, headphones or a TV.
struct AirPlayView: ExpoSwiftUI.View {
  @ObservedObject var props: AirPlayProps

  init(props: AirPlayProps) {
    self.props = props
  }

  var body: some View {
    RoutePicker(tint: UIColor(Color(hexString: props.tintHex)))
      .frame(width: 44, height: 44)
      .accessibilityLabel("AirPlay")
  }
}

private struct RoutePicker: UIViewRepresentable {
  let tint: UIColor

  func makeUIView(context: Context) -> AVRoutePickerView {
    let view = AVRoutePickerView()
    view.prioritizesVideoDevices = false
    view.tintColor = tint
    view.activeTintColor = tint
    return view
  }

  func updateUIView(_ view: AVRoutePickerView, context: Context) {
    view.tintColor = tint
    view.activeTintColor = tint
  }
}
