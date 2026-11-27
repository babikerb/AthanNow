import CoreText
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
            guard item.count >= 4,
                  let s = (item[0] as? NSNumber)?.intValue,
                  let a = (item[1] as? NSNumber)?.intValue,
                  let w = (item[2] as? NSNumber)?.intValue,
                  let t = item[3] as? String else { continue }
            let word = MushafWord(surah: s, ayah: a, word: w, text: t, glyph: item.count > 4 ? (item[4] as? String ?? "") : "")
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
