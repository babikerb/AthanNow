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

    View(QuranReaderView.self)
  }
}
