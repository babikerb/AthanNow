import CoreText
import Foundation
import UIKit

/// One word of the mushaf. `word` counts from 1 within its ayah; 0 is the ayah's end marker.
struct MushafWord: Hashable {
  let surah: Int
  let ayah: Int
  let word: Int
  let text: String

  /// Reading order across the whole Quran. The end marker comes after the ayah's words.
  var order: Int { MushafWord.order(surah, ayah, word) }

  static func order(_ surah: Int, _ ayah: Int, _ word: Int) -> Int {
    surah * 1_000_000 + ayah * 1000 + (word == 0 ? 999 : word)
  }

  var ayahKey: Int { surah * 1000 + ayah }
}

enum MushafLine {
  case header(Int)
  case bismillah
  /// The words on the line, and their width in ems in the bundled font.
  case words([MushafWord], Double)
}

struct MushafPage: Identifiable {
  let number: Int
  let lines: [MushafLine]
  var id: Int { number }
}

/// Marker class for finding this module's resources.
final class MushafBundleMarker {}

enum MushafResources {
  static let bundle: Bundle = {
    for candidate in [Bundle(for: MushafBundleMarker.self), Bundle.main] {
      if let url = candidate.url(forResource: "QuranReaderResources", withExtension: "bundle"), let bundle = Bundle(url: url) {
        return bundle
      }
    }
    return Bundle.main
  }()

  static func url(_ name: String, _ ext: String) -> URL? {
    bundle.url(forResource: name, withExtension: ext) ?? Bundle.main.url(forResource: name, withExtension: ext)
  }
}

/// KFGQPC HAFS Uthmanic Script, version 18, registered for this process.
enum MushafFont {
  private(set) static var name = "KFGQPCHAFSUthmanicScript-Regula"
  private static var registered = false

  static func register() {
    if registered { return }
    registered = true
    guard let url = MushafResources.url("UthmanicHafs", "ttf"),
          let provider = CGDataProvider(url: url as CFURL),
          let font = CGFont(provider) else { return }
    if let postScript = font.postScriptName { name = postScript as String }
    CTFontManagerRegisterGraphicsFont(font, nil)
  }
}

/// All 604 pages, loaded once from the bundled mushaf.json (scripts/build-mushaf-words.py).
final class MushafStore {
  static let shared = MushafStore()

  private(set) var pages: [MushafPage] = []
  /// The line width (in ems, gaps included) pages are sized to.
  private(set) var ref: Double = 21.2
  private(set) var names: [String] = []
  /// Each ayah's words, joined, by `ayahKey`.
  private(set) var ayahText: [Int: String] = [:]
  private(set) var bismillah = "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ"
  private(set) var loaded = false
  private let lock = NSLock()

  func load() {
    lock.lock()
    defer { lock.unlock() }
    if loaded { return }
    defer { loaded = true }
    guard let url = MushafResources.url("mushaf", "json"),
          let data = try? Data(contentsOf: url),
          let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
    ref = (root["ref"] as? NSNumber)?.doubleValue ?? ref
    names = root["names"] as? [String] ?? []

    var words: [Int: [String]] = [:]
    var out: [MushafPage] = []
    let raw = root["pages"] as? [[[String: Any]]] ?? []
    for (index, lines) in raw.enumerated() {
      var parsed: [MushafLine] = []
      for line in lines {
        if let surah = line["h"] as? NSNumber {
          parsed.append(.header(surah.intValue))
        } else if line["b"] != nil {
          parsed.append(.bismillah)
        } else {
          let list = (line["w"] as? [[Any]]) ?? []
          var lineWords: [MushafWord] = []
          lineWords.reserveCapacity(list.count)
          for item in list {
            guard item.count == 4,
                  let s = (item[0] as? NSNumber)?.intValue,
                  let a = (item[1] as? NSNumber)?.intValue,
                  let w = (item[2] as? NSNumber)?.intValue,
                  let t = item[3] as? String else { continue }
            let word = MushafWord(surah: s, ayah: a, word: w, text: t)
            lineWords.append(word)
            words[word.ayahKey, default: []].append(t)
          }
          parsed.append(.words(lineWords, (line["e"] as? NSNumber)?.doubleValue ?? 0))
        }
      }
      out.append(MushafPage(number: index + 1, lines: parsed))
    }
    ayahText = words.mapValues { $0.joined(separator: " ") }
    if let first = words[1001] { bismillah = first.dropLast().joined(separator: " ") }
    pages = out
  }

  func page(_ number: Int) -> MushafPage? {
    number >= 1 && number <= pages.count ? pages[number - 1] : nil
  }

  func name(_ surah: Int) -> String {
    surah >= 1 && surah <= names.count ? names[surah - 1] : ""
  }
}
