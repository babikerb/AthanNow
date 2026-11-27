import CoreText
import SwiftUI
import Foundation
import UIKit

/// One word of the mushaf. `word` counts from 1 within its ayah; 0 is the ayah's end marker.
struct MushafWord: Hashable {
  let surah: Int
  let ayah: Int
  let word: Int
  let text: String
  /// The word's glyph in quran.com's QCF V2 font for its page (one to a few characters).
  let glyph: String
  /// The word's English meaning and transliteration (empty for an end marker).
  var meaning: String = ""
  var translit: String = ""

  /// Reading order across the whole Quran. The end marker comes after the ayah's words.
  var order: Int { MushafWord.order(surah, ayah, word) }

  static func order(_ surah: Int, _ ayah: Int, _ word: Int) -> Int {
    surah * 1_000_000 + ayah * 1000 + (word == 0 ? 999 : word)
  }

  var ayahKey: Int { surah * 1000 + ayah }
}

enum MushafLine {
  case header(Int)
  /// The Bismillah opening a surah (by number).
  case bismillah(Int)
  /// The words on the line, and their width in ems in the bundled font.
  case words([MushafWord], Double)
}

struct MushafPage: Identifiable {
  let number: Int
  let lines: [MushafLine]
  var id: Int { number }

  /// The page as its surah openings and its ayahs, each ayah's words together (pages hold whole ayahs).
  var blocks: [PageBlock] {
    var out: [PageBlock] = []
    for line in lines {
      switch line {
      case .header(let s): out.append(.header(s))
      case .bismillah(let s): out.append(.bismillah(s))
      case .words(let words, _):
        for word in words {
          if case .ayah(let key, let list) = out.last, key == word.ayahKey {
            out[out.count - 1] = .ayah(key, list + [word])
          } else {
            out.append(.ayah(word.ayahKey, [word]))
          }
        }
      }
    }
    return out
  }
}

enum PageBlock {
  case header(Int)
  case bismillah(Int)
  case ayah(Int, [MushafWord])
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

/// The bundled font, registered for this process: KFGQPC HAFS Uthmanic Script v18 (the text when
/// a page's own font isn't there yet, the Bismillah and the surah names).
enum MushafFont {
  private(set) static var name = "KFGQPCHAFSUthmanicScript-Regula"
  private static var registered = false

  static func register() {
    if registered { return }
    registered = true
    if let n = registerBundled("UthmanicHafs") { name = n }
  }

  private static func registerBundled(_ file: String) -> String? {
    guard let url = MushafResources.url(file, "ttf"),
          let provider = CGDataProvider(url: url as CFURL),
          let font = CGFont(provider),
          let postScript = font.postScriptName else { return nil }
    CTFontManagerRegisterGraphicsFont(font, nil)
    return postScript as String
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
  /// The page each ayah is printed on, by `ayahKey`.
  private(set) var ayahPage: [Int: Int] = [:]
  /// Saheeh International, every ayah in order (bundled translation.json), and where each surah's
  /// ayahs begin in it.
  private(set) var translations: [String] = []
  private var surahStart: [Int] = []
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
      var opening = 0
      for line in lines {
        if let surah = line["h"] as? NSNumber {
          opening = surah.intValue
          parsed.append(.header(surah.intValue))
        } else if line["b"] != nil {
          parsed.append(.bismillah(opening))
        } else {
          let list = (line["w"] as? [[Any]]) ?? []
          var lineWords: [MushafWord] = []
          lineWords.reserveCapacity(list.count)
          for item in list {
            guard item.count >= 4,
                  let s = (item[0] as? NSNumber)?.intValue,
                  let a = (item[1] as? NSNumber)?.intValue,
                  let w = (item[2] as? NSNumber)?.intValue,
                  let t = item[3] as? String else { continue }
            let word = MushafWord(
              surah: s, ayah: a, word: w, text: t,
              glyph: item.count > 4 ? (item[4] as? String ?? "") : "",
              meaning: item.count > 5 ? (item[5] as? String ?? "") : "",
              translit: item.count > 6 ? (item[6] as? String ?? "") : ""
            )
            lineWords.append(word)
            words[word.ayahKey, default: []].append(t)
            if ayahPage[word.ayahKey] == nil { ayahPage[word.ayahKey] = index + 1 }
          }
          parsed.append(.words(lineWords, (line["e"] as? NSNumber)?.doubleValue ?? 0))
        }
      }
      out.append(MushafPage(number: index + 1, lines: parsed))
    }
    ayahText = words.mapValues { $0.joined(separator: " ") }
    // Each surah's ayah count, from the highest ayah seen in it.
    var counts = [Int](repeating: 0, count: 115)
    for key in words.keys {
      let s = key / 1000
      if s >= 1 && s <= 114 { counts[s] = max(counts[s], key % 1000) }
    }
    var start = [Int](repeating: 0, count: 116)
    for s in 1...114 { start[s + 1] = start[s] + counts[s] }
    surahStart = start
    if let url = MushafResources.url("translation", "json"),
       let data = try? Data(contentsOf: url),
       let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
       let list = json["ayahs"] as? [String] {
      translations = list
    }
    if let first = words[1001] { bismillah = first.dropLast().joined(separator: " ") }
    pages = out
  }

  /// An ayah's Saheeh International translation.
  func translation(_ surah: Int, _ ayah: Int) -> String {
    guard surah >= 1, surah <= 114, surahStart.count > surah else { return "" }
    let index = surahStart[surah] + ayah - 1
    return index >= 0 && index < translations.count ? translations[index] : ""
  }

  func page(_ number: Int) -> MushafPage? {
    number >= 1 && number <= pages.count ? pages[number - 1] : nil
  }

  func name(_ surah: Int) -> String {
    surah >= 1 && surah <= names.count ? names[surah - 1] : ""
  }
}

/// quran.com's QCF V2 fonts, one per page, which draw the printed Madani page exactly: each word is
/// one glyph made to fill its line. Downloaded the first time a page is opened and kept in Caches;
/// until then the page is set in KFGQPC Hafs instead.
final class PageFonts: ObservableObject {
  static let shared = PageFonts()

  struct Metrics {
    let name: String
    /// Each word line's width at 100 pt, in the page's order.
    let lines: [CGFloat]
    var widest: CGFloat { lines.max() ?? 1 }
  }

  @Published private(set) var fonts: [Int: Metrics] = [:]
  private var loading = Set<Int>()
  private let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("qcf-v2", isDirectory: true)

  func metrics(_ page: Int) -> Metrics? { fonts[page] }

  /// This page and the ones either side, nearest first.
  func prepare(around page: Int) {
    for p in [page, page - 1, page + 1, page - 2, page + 2] { ensure(p) }
  }

  func ensure(_ page: Int) {
    guard page >= 1, page <= 604, fonts[page] == nil, !loading.contains(page) else { return }
    loading.insert(page)
    let file = dir.appendingPathComponent("p\(page).ttf")
    let dir = self.dir
    DispatchQueue.global(qos: .userInitiated).async {
      try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      if !FileManager.default.fileExists(atPath: file.path) {
        guard let url = URL(string: "https://verses.quran.foundation/fonts/quran/hafs/v2/ttf/p\(page).ttf"),
              let data = try? Data(contentsOf: url), data.count > 10_000 else {
          DispatchQueue.main.async { self.loading.remove(page) }
          return
        }
        try? data.write(to: file, options: .atomic)
      }
      let metrics = PageFonts.register(file, page: page)
      if metrics == nil { try? FileManager.default.removeItem(at: file) }
      DispatchQueue.main.async {
        self.loading.remove(page)
        if let metrics { self.fonts[page] = metrics }
      }
    }
  }

  private static func register(_ url: URL, page: Int) -> Metrics? {
    guard let provider = CGDataProvider(url: url as CFURL),
          let font = CGFont(provider),
          let postScript = font.postScriptName else { return nil }
    let name = postScript as String
    // Registering again (a second reader, a reload) fails harmlessly; the font is already there.
    CTFontManagerRegisterGraphicsFont(font, nil)
    guard let ui = UIFont(name: name, size: 100), let data = MushafStore.shared.page(page) else { return nil }
    var lines: [CGFloat] = []
    for line in data.lines {
      if case .words(let words, _) = line {
        let width = words.reduce(CGFloat(0)) { sum, word in
          sum + (word.glyph as NSString).size(withAttributes: [.font: ui]).width
        }
        lines.append(width)
      }
    }
    return Metrics(name: name, lines: lines)
  }
}
