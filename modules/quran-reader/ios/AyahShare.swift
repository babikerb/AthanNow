import SwiftUI
import UIKit

/// Sharing an ayah: as text (the ayah, its meaning, and where it's from) or as an image card,
/// through the iOS share sheet.
enum AyahShare {
  /// "Al-Kahf 10".
  static func reference(surah: Int, ayah: Int, title: String) -> String {
    "\(title) \(ayah)"
  }

  static func text(surah: Int, ayah: Int, title: String) -> String {
    let arabic = MushafStore.shared.ayahText[surah * 1000 + ayah] ?? ""
    let meaning = MushafStore.shared.translation(surah, ayah)
    return "\(reference(surah: surah, ayah: ayah, title: title))\n\n\(arabic)\n\n\u{201C}\(meaning)\u{201D}\n\nShared from AthanNow, free on the App Store"
  }

  static func text(_ word: MushafWord, title: String) -> String {
    text(surah: word.surah, ayah: word.ayah, title: title)
  }

  @MainActor
  static func image(surah: Int, ayah: Int, title: String, theme: ReaderTheme) -> UIImage? {
    let renderer = ImageRenderer(content: ShareCard(surah: surah, ayah: ayah, title: title, theme: theme))
    renderer.scale = 3
    return renderer.uiImage
  }

  @MainActor
  static func image(_ word: MushafWord, title: String, theme: ReaderTheme) -> UIImage? {
    image(surah: word.surah, ayah: word.ayah, title: title, theme: theme)
  }

  /// The share sheet, once the menu that asked for it has gone.
  static func present(_ items: [Any], delay: Double = 0.35) {
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
      let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
      guard var top = scene?.keyWindow?.rootViewController else { return }
      while let presented = top.presentedViewController { top = presented }
      let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
      sheet.popoverPresentationController?.sourceView = top.view
      top.present(sheet, animated: true)
    }
  }

  /// The app's icon, for the card's foot.
  static let icon: UIImage? = {
    guard let url = MushafResources.url("ShareIcon", "png"), let data = try? Data(contentsOf: url) else { return nil }
    return UIImage(data: data)
  }()
}

/// The card an ayah is shared as: the surah and ayah, the ayah in Arabic, its meaning, and the app at
/// the foot. 360 points wide (1080 pixels as rendered).
struct ShareCard: View {
  let surah: Int
  let ayah: Int
  let title: String
  let theme: ReaderTheme

  var body: some View {
    let arabic = MushafStore.shared.ayahText[surah * 1000 + ayah] ?? ""
    let meaning = MushafStore.shared.translation(surah, ayah)
    VStack(spacing: 0) {
      Text(AyahShare.reference(surah: surah, ayah: ayah, title: title))
        .font(.system(size: 15, weight: .semibold))
        .foregroundColor(theme.ink.opacity(0.8))

      Text(arabic)
        .font(.custom(MushafFont.name, size: arabic.count > 220 ? 22 : arabic.count > 120 ? 26 : 30))
        .foregroundColor(theme.ink)
        .multilineTextAlignment(.center)
        .lineSpacing(10)
        .environment(\.layoutDirection, .rightToLeft)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.top, 22)

      if !meaning.isEmpty {
        Text(meaning)
          .font(.system(size: meaning.count > 400 ? 13 : 15))
          .foregroundColor(theme.ink.opacity(0.8))
          .multilineTextAlignment(.center)
          .lineSpacing(3)
          .fixedSize(horizontal: false, vertical: true)
          .padding(.top, 18)
      }

      Rectangle().fill(theme.ink.opacity(0.12)).frame(height: 1).padding(.top, 26)

      HStack(spacing: 10) {
        if let icon = AyahShare.icon {
          Image(uiImage: icon)
            .resizable()
            .frame(width: 34, height: 34)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        VStack(alignment: .leading, spacing: 1) {
          Text("AthanNow")
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(theme.ink)
          Text("Get it free on the App Store")
            .font(.system(size: 11))
            .foregroundColor(theme.ink.opacity(0.6))
        }
        Spacer(minLength: 0)
      }
      .padding(.top, 14)
    }
    .padding(.horizontal, 28)
    .padding(.top, 28)
    .padding(.bottom, 20)
    .frame(width: 360)
    .background(theme.background)
  }
}
