import SwiftUI
import UIKit

/// Sharing an ayah: as text (the ayah, its meaning, and where it's from) or as an image card drawn in
/// the reader's colours, through the iOS share sheet.
enum AyahShare {
  /// "Al-Kahf 18:10".
  static func reference(_ word: MushafWord, title: String) -> String {
    "\(title) \(word.surah):\(word.ayah)"
  }

  static func text(_ word: MushafWord, title: String) -> String {
    let arabic = MushafStore.shared.ayahText[word.ayahKey] ?? ""
    let meaning = MushafStore.shared.translation(word.surah, word.ayah)
    return "\(arabic)\n\n\u{201C}\(meaning)\u{201D}\n\n\(reference(word, title: title))"
  }

  @MainActor
  static func image(_ word: MushafWord, title: String, theme: ReaderTheme) -> UIImage? {
    let renderer = ImageRenderer(content: ShareCard(word: word, title: title, theme: theme))
    renderer.scale = 3
    return renderer.uiImage
  }

  /// The share sheet, once the menu that asked for it has gone.
  static func present(_ items: [Any]) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
      let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
      guard var top = scene?.keyWindow?.rootViewController else { return }
      while let presented = top.presentedViewController { top = presented }
      let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
      sheet.popoverPresentationController?.sourceView = top.view
      top.present(sheet, animated: true)
    }
  }
}

/// The card an ayah is shared as: the surah's name in calligraphy, the ayah, its meaning, and where
/// it's from, in the reader's colours. 360 points wide (1080 pixels as rendered).
struct ShareCard: View {
  let word: MushafWord
  let title: String
  let theme: ReaderTheme

  var body: some View {
    let arabic = MushafStore.shared.ayahText[word.ayahKey] ?? word.text
    let meaning = MushafStore.shared.translation(word.surah, word.ayah)
    VStack(spacing: 18) {
      Text("سورة \(MushafStore.shared.name(word.surah))")
        .font(.custom(MushafFont.name, size: 24))
        .foregroundColor(theme.ink.opacity(0.8))

      Text(arabic)
        .font(.custom(MushafFont.name, size: arabic.count > 220 ? 22 : arabic.count > 120 ? 26 : 30))
        .foregroundColor(theme.ink)
        .multilineTextAlignment(.center)
        .lineSpacing(10)
        .environment(\.layoutDirection, .rightToLeft)
        .fixedSize(horizontal: false, vertical: true)

      Capsule().fill(theme.recited).frame(width: 36, height: 3)

      if !meaning.isEmpty {
        Text(meaning)
          .font(.system(size: meaning.count > 400 ? 13 : 15))
          .foregroundColor(theme.ink.opacity(0.85))
          .multilineTextAlignment(.center)
          .lineSpacing(3)
          .fixedSize(horizontal: false, vertical: true)
      }

      HStack {
        Text(AyahShare.reference(word, title: title).replacingOccurrences(of: " \(word.surah):", with: ", \(word.surah):"))
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(theme.ink.opacity(0.75))
        Spacer()
        Text("AthanNow")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(theme.recited)
      }
      .padding(.top, 6)
    }
    .padding(.horizontal, 28)
    .padding(.top, 30)
    .padding(.bottom, 22)
    .frame(width: 360)
    .background(theme.background)
  }
}
