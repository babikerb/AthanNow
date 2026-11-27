import ExpoModulesCore

/// The Quran reader: the Madani mushaf set word by word in KFGQPC Hafs, as a native SwiftUI view.
public class QuranReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QuranReader")

    OnCreate {
      MushafFont.register()
      DispatchQueue.global(qos: .userInitiated).async {
        MushafStore.shared.load()
      }
    }

    /// An ayah's text (KFGQPC Hafs) and its Saheeh International translation.
    Function("ayah") { (surah: Int, ayah: Int) -> [String: String] in
      MushafStore.shared.load()
      return [
        "arabic": MushafStore.shared.ayahText[surah * 1000 + ayah] ?? "",
        "translation": MushafStore.shared.translation(surah, ayah),
      ]
    }

    /// Shares an ayah through the share sheet: as the image card, or as text. `title` is the surah's
    /// English name; the colours are the app's, as #RRGGBB.
    Function("shareAyah") { (surah: Int, ayah: Int, title: String, asImage: Bool, background: String, ink: String, accent: String, dark: Bool) in
      MushafStore.shared.load()
      DispatchQueue.main.async {
        if asImage {
          let theme = ReaderTheme.app(background: background, ink: ink, accent: accent, recited: "", dark: dark)
          if let image = AyahShare.image(surah: surah, ayah: ayah, title: title, theme: theme) {
            AyahShare.present([image], delay: 0.05)
          }
        } else {
          AyahShare.present([AyahShare.text(surah: surah, ayah: ayah, title: title)], delay: 0.05)
        }
      }
    }

    View(QuranReaderView.self)

    View(AirPlayView.self) {
      ViewName("AirPlayView")
    }
  }
}
