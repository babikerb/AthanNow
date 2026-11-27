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

    View(QuranReaderView.self)

    View(AirPlayView.self) {
      ViewName("AirPlayView")
    }
  }
}
