import ExpoModulesCore
import SwiftUI
import UIKit

final class QuranReaderProps: ExpoSwiftUI.ViewProps {
  /// The page to show; applied whenever `pageNonce` changes (and on first show).
  @Field var page: Int = 1
  @Field var pageNonce: Int = 0
  @Field var dark: Bool = false
  /// While audio plays: words from `from` up to `cur` are recited, `cur` is under the glass.
  @Field var highlighting: Bool = false
  @Field var curSurah: Int = 0
  @Field var curAyah: Int = 0
  @Field var curWord: Int = 0
  /// The surah whose Bismillah is being recited, before its first ayah; 0 otherwise.
  @Field var bismillahSurah: Int = 0
  @Field var fromSurah: Int = 0
  @Field var fromAyah: Int = 0
  @Field var fromWord: Int = 0
  /// Zoomed in, keep the recited word in view.
  @Field var follow: Bool = true
  @Field var topInset: Double = 0
  @Field var bottomInset: Double = 0
  /// English surah names for the menus, Al-Fatihah first.
  @Field var surahTitles: [String] = []
  @Field var bookmarkedPages: [Int] = []
  /// Ayahs being explained (the Meaning sheet), from and to as surah * 1000 + ayah: a soft tint.
  @Field var focusFrom: Int = 0
  @Field var focusTo: Int = 0
  /// A still snapshot of the page's opening lines (the home screen's Continue card): no gestures or menus.
  @Field var preview: Bool = false
  /// "mushaf" (the printed page, pinch to zoom), "translation" (each ayah with its meaning under it)
  /// or "words" (each word with its meaning under it).
  @Field var view: String = "mushaf"
  /// "night", "charcoal", "sepia" or "paper"; empty follows `dark`.
  @Field var pageColor: String = ""
  /// "standard", "soft" or "warm".
  @Field var textTone: String = "standard"
  /// The flowing text's size (zoomed in, translation, words), 1 being the page's own.
  @Field var textScale: Double = 1.6
  @Field var showTranslit: Bool = false
  /// The app's own colours, as #RRGGBB: the page follows the app's appearance and its accent.
  /// When set, they take the place of `pageColor`.
  @Field var backgroundHex: String = ""
  @Field var inkHex: String = ""
  @Field var accentHex: String = ""
  /// Recited words; the accent is the highlight on the word being recited.
  @Field var recitedHex: String = ""
  var onTextScale = EventDispatcher()
  var onPageChange = EventDispatcher()
  var onTap = EventDispatcher()
  var onAction = EventDispatcher()
  var onZoomChange = EventDispatcher()
}

struct ReaderTheme {
  let dark: Bool
  let background: Color
  let ink: Color
  let quiet: Color
  let recited: Color
  /// The surah band: its lines, its fill, and its ornament.
  let frame: Color
  let band: Color
  let ornament: Color
  /// The highlight on the word being recited; the recited colour unless set.
  var highlightColor: Color? = nil
  var highlight: Color { highlightColor ?? recited }

  static func make(dark: Bool) -> ReaderTheme {
    make(color: dark ? "night" : "paper", tone: "standard")
  }

  /// The app's own colours: its background and text, and its accent for what's recited. The surah band
  /// and quieter text are drawn from the text colour.
  static func app(background: String, ink: String, accent: String, recited: String, dark: Bool) -> ReaderTheme {
    let inkColor = Color(hexString: ink)
    let accentColor = Color(hexString: accent)
    return ReaderTheme(dark: dark, background: Color(hexString: background), ink: inkColor, quiet: inkColor.opacity(0.38),
                       recited: recited.isEmpty ? accentColor : Color(hexString: recited),
                       frame: inkColor.opacity(0.3), band: inkColor.opacity(dark ? 0.07 : 0.05), ornament: inkColor.opacity(0.45),
                       highlightColor: accentColor)
  }

  /// A page colour and a text tone. Night and Charcoal are dark; Sepia and Paper are light.
  static func make(color: String, tone: String) -> ReaderTheme {
    switch color {
    case "night", "charcoal":
      let bg: UInt32 = color == "night" ? 0x000000 : 0x1C1C1F
      let ink: UInt32 = tone == "soft" ? 0xC9C6D3 : tone == "warm" ? 0xF1E3C8 : 0xF4F3F8
      return ReaderTheme(dark: true, background: Color(hex: bg), ink: Color(hex: ink), quiet: Color(hex: 0x6E6A7C), recited: Color(hex: 0xA5A1FF),
                         frame: Color(hex: 0x6B6779), band: Color(hex: color == "night" ? 0x1C1B22 : 0x2A2930), ornament: Color(hex: 0x8C889B))
    case "sepia":
      let ink: UInt32 = tone == "soft" ? 0x5E5244 : tone == "warm" ? 0x4A3220 : 0x2B2118
      return ReaderTheme(dark: false, background: Color(hex: 0xF4ECD8), ink: Color(hex: ink), quiet: Color(hex: 0xA79A82), recited: Color(hex: 0x4F3FB0),
                         frame: Color(hex: 0xC6B795), band: Color(hex: 0xEADFC4), ornament: Color(hex: 0x9C8A63))
    default:
      let ink: UInt32 = tone == "soft" ? 0x4A4756 : tone == "warm" ? 0x3B2A1E : 0x1D1B26
      return ReaderTheme(dark: false, background: Color(hex: 0xF8F8FC), ink: Color(hex: ink), quiet: Color(hex: 0xA6A2B4), recited: Color(hex: 0x4338CA),
                         frame: Color(hex: 0xB3AFC3), band: Color(hex: 0xECEAF3), ornament: Color(hex: 0x8F8AA3))
    }
  }
}

extension Color {
  /// "#RRGGBB" or "#RRGGBBAA"; clear if it can't be read.
  init(hexString: String) {
    var text = hexString.trimmingCharacters(in: .whitespaces)
    if text.hasPrefix("#") { text.removeFirst() }
    let value = UInt64(text, radix: 16) ?? 0
    if text.count == 8 {
      self.init(.sRGB, red: Double((value >> 24) & 0xFF) / 255, green: Double((value >> 16) & 0xFF) / 255, blue: Double((value >> 8) & 0xFF) / 255, opacity: Double(value & 0xFF) / 255)
    } else {
      self.init(.sRGB, red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255, opacity: text.count == 6 ? 1 : 0)
    }
  }

  init(hex: UInt32) {
    self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
  }
}

/// What every word needs to draw itself and its menu.
struct ReaderContext {
  let theme: ReaderTheme
  let playing: Bool
  let current: Int
  let from: Int
  /// The page the recited ayah is on: only that page shows what's recited and what's to come.
  let currentPage: Int
  /// The recited ayah (`ayahKey`), and whether the recording's timing goes down to the word. Without
  /// it the whole ayah is lit while it's recited.
  let currentAyah: Int
  let wordLevel: Bool
  /// The surah whose Bismillah is being recited (before ayah 1); 0 otherwise.
  let bismillah: Int
  /// Ayahs being explained, as `ayahKey`s; 0 for none.
  let focusFrom: Int
  let focusTo: Int

  func inFocus(_ word: MushafWord) -> Bool {
    focusFrom > 0 && word.ayahKey >= focusFrom && word.ayahKey <= focusTo
  }
  let ns: Namespace.ID
  let titles: [String]
  let bookmarked: Set<Int>
  let interactive: Bool
  let act: (String, MushafWord, Int) -> Void

  /// Whether this word is the one being recited (or, without word timing, in the ayah being recited).
  func isCurrent(_ word: MushafWord) -> Bool {
    playing && bismillah == 0 && wordLevel && word.order == current
  }

  func color(_ word: MushafWord, page: Int) -> Color {
    guard playing, page == currentPage else { return theme.ink }
    // The Bismillah is being recited: nothing of the surah is recited yet.
    if bismillah > 0 { return theme.ink }
    if !wordLevel {
      // Timed only by the ayah: the ayah being recited is lit in the recited colour, the rest plain.
      return word.ayahKey == currentAyah ? theme.recited : theme.ink
    }
    // Only the ayah being recited shows progress: its words already recited turn blue. The rest of
    // the page stays as it is.
    guard word.ayahKey == currentAyah else { return theme.ink }
    return word.order < current ? theme.recited : theme.ink
  }

  func title(_ surah: Int) -> String {
    surah >= 1 && surah <= titles.count ? titles[surah - 1] : "Surah \(surah)"
  }
}

/// The current word's bubble: Liquid Glass on iOS 26, frosted material before it.
struct GlassBubble: View {
  let dark: Bool

  var body: some View {
    if #available(iOS 26.0, *) {
#if compiler(>=6.2)
      Capsule().fill(Color.white.opacity(0.001)).glassEffect(.regular, in: Capsule())
#else
      fallback
#endif
    } else {
      fallback
    }
  }

  private var fallback: some View {
    Capsule()
      .fill(.ultraThinMaterial)
      .overlay(Capsule().stroke(Color.white.opacity(dark ? 0.18 : 0.7), lineWidth: 0.6))
  }
}

struct WordView: View {
  let word: MushafWord
  let page: Int
  let size: CGFloat
  let ctx: ReaderContext
  /// The page's QCF V2 font (the word's glyph), or KFGQPC Hafs (the word's text).
  var font: String = MushafFont.name
  var useGlyph: Bool = false

  var body: some View {
    if ctx.interactive {
      label
        .contextMenu {
          WordMenu(word: word, page: page, ctx: ctx)
        } preview: {
          AyahPreview(word: word, ctx: ctx)
        }
    } else {
      label
    }
  }

  private var label: some View {
    let isCurrent = ctx.isCurrent(word)
    return Text(useGlyph ? word.glyph : word.text)
      .font(.custom(font, size: size))
      .foregroundColor(ctx.color(word, page: page))
      .fixedSize()
      .background {
        if isCurrent {
          // A soft pill of the recited colour behind the word: rounded all round, no outline.
          Capsule(style: .continuous)
            .fill(ctx.theme.highlight.opacity(ctx.theme.dark ? 0.26 : 0.16))
            .padding(.horizontal, -size * 0.2)
            .padding(.vertical, size * 0.16)
            .matchedGeometryEffect(id: "highlight", in: ctx.ns)
        } else if ctx.inFocus(word) {
          // Being explained in the Meaning sheet: fainter than the recitation's highlight.
          Capsule(style: .continuous)
            .fill(ctx.theme.recited.opacity(ctx.theme.dark ? 0.16 : 0.08))
            .padding(.horizontal, -size * 0.1)
            .padding(.vertical, size * 0.16)
        }
      }
  }
}

struct WordMenu: View {
  let word: MushafWord
  let page: Int
  let ctx: ReaderContext

  var body: some View {
    Section("\(ctx.title(word.surah)), Ayah \(word.ayah)") {
      Button { ctx.act("meaning", word, page) } label: { Label("Meaning", systemImage: "text.book.closed") }
      Button { ctx.act("play", word, page) } label: { Label("Play from here", systemImage: "play.fill") }
      Button { ctx.act("repeat", word, page) } label: { Label("Repeat this ayah", systemImage: "repeat.1") }
    }
    Button {
      UIPasteboard.general.string = MushafStore.shared.ayahText[word.ayahKey]
      UINotificationFeedbackGenerator().notificationOccurred(.success)
    } label: { Label("Copy ayah", systemImage: "doc.on.doc") }
    Menu {
      Button {
        let title = ctx.title(word.surah)
        if let image = AyahShare.image(word, title: title, theme: ctx.theme) {
          AyahShare.present([image])
        }
      } label: { Label("As image", systemImage: "photo") }
      Button {
        AyahShare.present([AyahShare.text(word, title: ctx.title(word.surah))])
      } label: { Label("As text", systemImage: "text.quote") }
    } label: { Label("Share ayah", systemImage: "square.and.arrow.up") }
    if ctx.bookmarked.contains(page) {
      Button(role: .destructive) { ctx.act("unbookmark", word, page) } label: { Label("Remove bookmark", systemImage: "bookmark.slash") }
    } else {
      Button { ctx.act("bookmark", word, page) } label: { Label("Bookmark this page", systemImage: "bookmark") }
    }
  }
}

/// The held ayah, whole, above the menu.
struct AyahPreview: View {
  let word: MushafWord
  let ctx: ReaderContext

  var body: some View {
    // Kept to a size the system never has to squeeze: iOS shrinks a preview that's too large by
    // clipping it, not by laying it out again. Longer ayahs get a smaller size and are cut short.
    let arabic = MushafStore.shared.ayahText[word.ayahKey] ?? word.text
    let size: CGFloat = arabic.count > 300 ? 20 : arabic.count > 180 ? 22 : arabic.count > 100 ? 25 : 28
    let width = min(UIScreen.main.bounds.width - 48, 340)
    VStack(spacing: 10) {
      Text(arabic)
        .font(.custom(MushafFont.name, size: size))
        .foregroundColor(ctx.theme.ink)
        .multilineTextAlignment(.center)
        .lineSpacing(4)
        .lineLimit(5)
        .truncationMode(.tail)
        .environment(\.layoutDirection, .rightToLeft)
        .fixedSize(horizontal: false, vertical: true)
      let meaning = MushafStore.shared.translation(word.surah, word.ayah)
      if !meaning.isEmpty {
        Text(meaning)
          .font(.callout)
          .foregroundColor(ctx.theme.ink.opacity(0.85))
          .multilineTextAlignment(.center)
          .lineLimit(4)
          .fixedSize(horizontal: false, vertical: true)
      }
      Text("\(ctx.title(word.surah)), Ayah \(word.ayah)")
        .font(.footnote)
        .foregroundColor(ctx.theme.quiet)
    }
    .padding(.horizontal, 20)
    .padding(.vertical, 18)
    .frame(width: width)
    .fixedSize(horizontal: false, vertical: true)
    .background(ctx.theme.background)
  }
}

/// A surah's opening line: its name (سورة and the name), centred, with no band around it. It keeps
/// the band's height so the printed page's lines stay where they were.
struct SurahHeader: View {
  let surah: Int
  let size: CGFloat
  let theme: ReaderTheme

  var body: some View {
    Text("سورة \(MushafStore.shared.name(surah))")
      .font(.custom(MushafFont.name, size: size * 0.95))
      .foregroundColor(theme.ink)
      .lineLimit(1)
      .minimumScaleFactor(0.6)
      .frame(maxWidth: .infinity)
      .frame(height: size * 1.55)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("Surah \(MushafStore.shared.name(surah))")
      .accessibilityAddTraits(.isHeader)
  }
}

/// A surah's Bismillah. While it's being recited it carries the recitation's highlight: the same
/// soft pill as the current word where the timing goes by the word, the recited colour otherwise.
struct BismillahLine: View {
  let surah: Int
  let size: CGFloat
  let ctx: ReaderContext

  var body: some View {
    let reciting = ctx.playing && ctx.bismillah == surah
    Text(MushafStore.shared.bismillah)
      .font(.custom(MushafFont.name, size: size))
      .foregroundColor(reciting && !ctx.wordLevel ? ctx.theme.recited : ctx.theme.ink)
      .fixedSize()
      .background {
        if reciting && ctx.wordLevel {
          Capsule(style: .continuous)
            .fill(ctx.theme.highlight.opacity(ctx.theme.dark ? 0.26 : 0.16))
            .padding(.horizontal, -size * 0.3)
            .padding(.vertical, size * 0.16)
            .matchedGeometryEffect(id: "highlight", in: ctx.ns)
        }
      }
      .accessibilityLabel("Bismillah")
  }
}

/// One printed page: its 15 lines (8 on the first two). With the page's QCF V2 font it is the
/// printed Madani page; until that font has downloaded, the same lines in KFGQPC Hafs.
struct PageView: View {
  let page: MushafPage
  let size: CGFloat
  let width: CGFloat
  let lineHeight: CGFloat
  let ctx: ReaderContext
  var qcf: PageFonts.Metrics? = nil

  /// Each line, with its index among the page's word lines (-1 for headers and Bismillahs).
  private var rows: [(line: MushafLine, index: Int)] {
    var n = -1
    return page.lines.map { (line: MushafLine) -> (line: MushafLine, index: Int) in
      if case .words = line {
        n += 1
        return (line: line, index: n)
      }
      return (line: line, index: -1)
    }
  }

  /// The QCF size that brings the widest line to the full width, kept within the line's height.
  private var qcfSize: CGFloat {
    guard let q = qcf else { return size }
    return min(width * 0.985 / max(q.widest, 1) * 100, lineHeight * 0.72)
  }

  var body: some View {
    VStack(spacing: 0) {
      ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
        lineView(row.line, row.index)
          .frame(width: width, height: lineHeight)
      }
    }
  }

  @ViewBuilder
  private func lineView(_ line: MushafLine, _ index: Int) -> some View {
    switch line {
    case .header(let surah):
      SurahHeader(surah: surah, size: size, theme: ctx.theme).frame(width: width)
    case .bismillah(let s):
      BismillahLine(surah: s, size: size, ctx: ctx)
    case .words(let words, let em):
      if let q = qcf, index >= 0, index < q.lines.count {
        // The printed page: each line's glyphs nearly fill it; the rest is shared between words.
        // Short lines (the opening pages, a surah's last line) sit in the middle, as printed.
        let qs = qcfSize
        let natural = q.lines[index] * qs / 100
        JustifiedLine(gap: qs * 0.06, justify: natural > width * 0.8) {
          ForEach(words, id: \.order) { word in
            WordView(word: word, page: page.number, size: qs, ctx: ctx, font: q.name, useGlyph: true)
          }
        }
        .frame(width: width)
        .accessibilityElement(children: .combine)
      } else {
        let gap = size * 0.25
        let natural = CGFloat(em) * size + gap * CGFloat(max(0, words.count - 1))
        let squeeze = natural > width ? width / natural : 1
        JustifiedLine(gap: gap, justify: natural > width * 0.72) {
          ForEach(words, id: \.order) { word in
            WordView(word: word, page: page.number, size: size * squeeze, ctx: ctx)
          }
        }
        .frame(width: width)
        .accessibilityElement(children: .combine)
      }
    }
  }
}

/// A page zoomed in: its words flowing into centred lines, its headers between them. In the page's
/// own QCF V2 font when it's there, larger; otherwise KFGQPC Hafs.
struct FlowPage: View {
  let page: MushafPage
  let size: CGFloat
  let width: CGFloat
  let ctx: ReaderContext
  var qcf: PageFonts.Metrics? = nil
  /// The QCF size for this zoom (the page's own size, times the zoom).
  var qcfSize: CGFloat = 0

  private enum Block {
    case header(Int)
    case bismillah(Int)
    case words([MushafWord])
  }

  private var blocks: [Block] {
    var out: [Block] = []
    var run: [MushafWord] = []
    for line in page.lines {
      switch line {
      case .header(let s):
        if !run.isEmpty { out.append(.words(run)); run = [] }
        out.append(.header(s))
      case .bismillah(let s):
        if !run.isEmpty { out.append(.words(run)); run = [] }
        out.append(.bismillah(s))
      case .words(let words, _):
        run.append(contentsOf: words)
      }
    }
    if !run.isEmpty { out.append(.words(run)) }
    return out
  }

  var body: some View {
    VStack(spacing: size * 0.5) {
      ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
        switch block {
        case .header(let s):
          SurahHeader(surah: s, size: size * 0.8, theme: ctx.theme).frame(width: width)
        case .bismillah(let s):
          BismillahLine(surah: s, size: size * 0.8, ctx: ctx)
        case .words(let words):
          if let q = qcf, qcfSize > 0 {
            FlowingLines(gap: qcfSize * 0.12, lineHeight: qcfSize * 1.75) {
              ForEach(words, id: \.order) { word in
                WordView(word: word, page: page.number, size: qcfSize, ctx: ctx, font: q.name, useGlyph: true).id(word.order)
              }
            }
            .frame(width: width)
          } else {
            FlowingLines(gap: size * 0.3, lineHeight: size * 2.05) {
              ForEach(words, id: \.order) { word in
                WordView(word: word, page: page.number, size: size, ctx: ctx).id(word.order)
              }
            }
            .frame(width: width)
          }
        }
      }
      Text("\(page.number)")
        .font(.caption)
        .foregroundColor(ctx.theme.quiet)
        .padding(.top, 4)
    }
  }
}

/// Translation: each ayah in large flowing text (the page's own font), its meaning beneath, and a way
/// into its commentary; surah openings between, as on the page.
struct TranslationPage: View {
  let page: MushafPage
  let size: CGFloat
  let width: CGFloat
  let zoom: CGFloat
  let ctx: ReaderContext
  var qcf: PageFonts.Metrics? = nil
  var qcfSize: CGFloat = 0

  var body: some View {
    let meaningSize = min(16 * max(1, zoom * 0.62), 24)
    VStack(spacing: size * 0.6) {
      ForEach(Array(page.blocks.enumerated()), id: \.offset) { _, block in
        switch block {
        case .header(let s):
          SurahHeader(surah: s, size: size * 0.8, theme: ctx.theme).frame(width: width)
        case .bismillah(let s):
          BismillahLine(surah: s, size: size * 0.8, ctx: ctx)
        case .ayah(let key, let words):
          VStack(spacing: 10) {
            if let q = qcf, qcfSize > 0 {
              FlowingLines(gap: qcfSize * 0.12, lineHeight: qcfSize * 1.75) {
                ForEach(words, id: \.order) { word in
                  WordView(word: word, page: page.number, size: qcfSize, ctx: ctx, font: q.name, useGlyph: true).id(word.order)
                }
              }
              .frame(width: width)
            } else {
              FlowingLines(gap: size * 0.3, lineHeight: size * 2.05) {
                ForEach(words, id: \.order) { word in
                  WordView(word: word, page: page.number, size: size, ctx: ctx).id(word.order)
                }
              }
              .frame(width: width)
            }
            Text(MushafStore.shared.translation(key / 1000, key % 1000))
              .font(.system(size: meaningSize))
              .lineSpacing(3)
              .foregroundColor(ctx.theme.ink.opacity(0.82))
              .fixedSize(horizontal: false, vertical: true)
              .frame(width: width, alignment: .leading)
            if let first = words.first {
              Button {
                ctx.act("meaning", first, page.number)
              } label: {
                Label("Meaning", systemImage: "text.book.closed")
                  .font(.footnote.weight(.semibold))
                  .foregroundColor(ctx.theme.recited)
              }
              .frame(width: width, alignment: .leading)
            }
            Rectangle().fill(ctx.theme.frame.opacity(0.35)).frame(width: width, height: 0.5).padding(.top, 6)
          }
          .frame(width: width)
        }
      }
    }
  }
}

/// Word by word: every word with its English meaning (and, if chosen, its transliteration) beneath it,
/// flowing right to left into centred lines.
struct WordsPage: View {
  let page: MushafPage
  let size: CGFloat
  let width: CGFloat
  let zoom: CGFloat
  let ctx: ReaderContext
  var qcf: PageFonts.Metrics? = nil
  var qcfSize: CGFloat = 0
  var translit: Bool = false

  var body: some View {
    let glyphSize = qcf != nil && qcfSize > 0 ? qcfSize : size
    let gloss = min(12 * max(1, zoom * 0.55), 18)
    VStack(spacing: size * 0.6) {
      ForEach(Array(page.blocks.enumerated()), id: \.offset) { _, block in
        switch block {
        case .header(let s):
          SurahHeader(surah: s, size: size * 0.8, theme: ctx.theme).frame(width: width)
        case .bismillah(let s):
          BismillahLine(surah: s, size: size * 0.8, ctx: ctx)
        case .ayah(_, let words):
          FlowingRows(gap: glyphSize * 0.45, rowSpacing: gloss * 0.9) {
            ForEach(words, id: \.order) { word in
              VStack(spacing: 2) {
                if let q = qcf, qcfSize > 0 {
                  WordView(word: word, page: page.number, size: qcfSize, ctx: ctx, font: q.name, useGlyph: true)
                } else {
                  WordView(word: word, page: page.number, size: size, ctx: ctx)
                }
                if word.word > 0 {
                  Text(word.meaning)
                    .font(.system(size: gloss))
                    .foregroundColor(ctx.theme.ink.opacity(0.75))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: max(glyphSize * 3.2, 90))
                    .fixedSize(horizontal: false, vertical: true)
                  if translit {
                    Text(word.translit)
                      .font(.system(size: gloss * 0.92).italic())
                      .foregroundColor(ctx.theme.quiet)
                      .lineLimit(1)
                  }
                }
              }
              .id(word.order)
            }
          }
          .frame(width: width)
        }
      }
    }
  }
}

struct QuranReaderView: ExpoSwiftUI.View {
  @ObservedObject var props: QuranReaderProps
  @Namespace private var ns
  @State private var ready = MushafStore.shared.loaded
  @State private var page = 1
  @State private var zoom: CGFloat = 1
  @State private var pinch: CGFloat = 1
  @State private var flowTarget: Int? = nil
  @ObservedObject private var fonts = PageFonts.shared
  /// The pages laid out when zoomed in: a couple before the page being read and more after it, grown
  /// as the reader scrolls on. All 604 at once can't be scrolled to reliably.
  @State private var flowFirst = 1
  @State private var flowLast = 8
  /// Page reports from the zoomed scroll are ignored until it has reached the page being read.
  @State private var flowSettled = false

  private let maxZoom: CGFloat = 3.2
  private let sidePadding: CGFloat = 14

  init(props: QuranReaderProps) {
    self.props = props
  }

  var body: some View {
    let theme = !props.backgroundHex.isEmpty
      ? ReaderTheme.app(background: props.backgroundHex, ink: props.inkHex, accent: props.accentHex, recited: props.recitedHex, dark: props.dark)
      : props.pageColor.isEmpty ? ReaderTheme.make(dark: props.dark) : ReaderTheme.make(color: props.pageColor, tone: props.textTone)
    let flowing = props.view != "mushaf"
    GeometryReader { geo in
      let area = CGSize(
        width: geo.size.width - sidePadding * 2,
        height: max(200, geo.size.height - CGFloat(props.topInset) - CGFloat(props.bottomInset))
      )
      let base = baseSize(area)
      ZStack {
        theme.background.ignoresSafeArea()
        if !ready {
          ProgressView()
        } else if props.preview {
          previewPage(width: geo.size.width - 28, theme: theme)
        } else if !flowing && zoom <= 1.001 {
          pageMode(area: area, size: base, theme: theme, full: geo.size)
            .scaleEffect(pinch)
        } else {
          let z = flowing ? CGFloat(props.textScale) : zoom
          flowMode(area: area, size: base * z, zoom: z, theme: theme, full: geo.size)
            .scaleEffect(pinch)
            .id("flow-\(props.view)")
        }
      }
      .simultaneousGesture(magnify)
    }
    .ignoresSafeArea()
    .animation(.spring(response: 0.32, dampingFraction: 0.86), value: currentOrder)
    .onAppear {
      page = clampPage(props.page)
      if ready {
        PageFonts.shared.prepare(around: page)
      } else {
        DispatchQueue.global(qos: .userInitiated).async {
          MushafStore.shared.load()
          DispatchQueue.main.async {
            ready = true
            PageFonts.shared.prepare(around: page)
          }
        }
      }
    }
    .onChange(of: props.view) { newValue in
      if newValue != "mushaf" { openFlow(at: recitedPage ?? page) }
      zoom = 1
    }
    .onChange(of: props.pageNonce) { _ in
      let target = clampPage(props.page)
      if zoom > 1.001 || props.view != "mushaf" {
        openFlow(at: target)
        flowTarget = target
        page = target
      } else if abs(target - page) <= 2 {
        // The next page or so (the recitation moving on): turned gently, like a page.
        withAnimation(.easeInOut(duration: 0.55)) { page = target }
      } else {
        page = target
      }
      if ready { PageFonts.shared.prepare(around: target) }
    }
  }

  // MARK: Sizing

  /// The size a line of text takes up: the page's lines fill the width, and all 15 fit the height.
  private func baseSize(_ area: CGSize) -> CGFloat {
    let byWidth = area.width / CGFloat(MushafStore.shared.ref)
    let byHeight = area.height / 15 / 1.42
    return max(10, min(byWidth, byHeight))
  }

  private func clampPage(_ n: Int) -> Int { min(max(n, 1), 604) }

  /// The page the recited ayah is on, during a recitation.
  private var recitedPage: Int? {
    props.highlighting ? MushafStore.shared.ayahPage[props.curSurah * 1000 + props.curAyah] : nil
  }

  private var currentOrder: Int {
    props.highlighting ? MushafWord.order(props.curSurah, props.curAyah, props.curWord) : -1
  }

  /// A word to scroll to for the recitation: the word being recited, or the first word of the ayah
  /// where the timing goes only by the ayah (or the Bismillah is still being recited).
  private var recitedWord: Int {
    guard props.highlighting else { return -1 }
    return MushafWord.order(props.curSurah, props.curAyah, props.bismillahSurah > 0 ? 1 : max(props.curWord, 1))
  }

  private func context(_ theme: ReaderTheme) -> ReaderContext {
    ReaderContext(
      theme: theme,
      playing: props.highlighting,
      current: currentOrder,
      from: MushafWord.order(props.fromSurah, props.fromAyah, props.fromWord),
      currentPage: props.highlighting ? (MushafStore.shared.ayahPage[props.curSurah * 1000 + props.curAyah] ?? -1) : -1,
      currentAyah: props.curSurah * 1000 + props.curAyah,
      wordLevel: props.curWord > 0,
      bismillah: props.highlighting ? props.bismillahSurah : 0,
      focusFrom: props.focusFrom,
      focusTo: props.focusTo,
      ns: ns,
      titles: props.surahTitles,
      bookmarked: Set(props.bookmarkedPages),
      interactive: !props.preview,
      act: { action, word, page in
        props.onAction(["action": action, "surah": word.surah, "ayah": word.ayah, "page": page])
      }
    )
  }

  // MARK: Preview

  /// The page's opening lines at a comfortable size, from the top.
  private func previewPage(width: CGFloat, theme: ReaderTheme) -> some View {
    let size = width / CGFloat(MushafStore.shared.ref)
    return VStack(spacing: 0) {
      if let p = MushafStore.shared.page(clampPage(props.page)) {
        PageView(page: p, size: size, width: width, lineHeight: size * 1.9, ctx: context(theme), qcf: fonts.metrics(p.number))
      }
      Spacer(minLength: 0)
    }
    .padding(.top, 10)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .clipped()
    .allowsHitTesting(false)
  }

  // MARK: Page by page

  private func pageMode(area: CGSize, size: CGFloat, theme: ReaderTheme, full: CGSize) -> some View {
    let ctx = context(theme)
    let lineHeight = area.height / 15
    return TabView(selection: $page) {
      ForEach(MushafStore.shared.pages) { p in
        VStack(spacing: 0) {
          Spacer(minLength: 0)
          PageView(page: p, size: size, width: area.width, lineHeight: lineHeight, ctx: ctx, qcf: fonts.metrics(p.number))
          Spacer(minLength: 0)
        }
        .padding(.top, CGFloat(props.topInset))
        .padding(.bottom, CGFloat(props.bottomInset))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture { props.onTap() }
        .environment(\.layoutDirection, .leftToRight)
        .ignoresSafeArea()
        .tag(p.number)
      }
    }
    .tabViewStyle(.page(indexDisplayMode: .never))
    .ignoresSafeArea()
    .frame(width: full.width, height: full.height)
    .environment(\.layoutDirection, .rightToLeft)
    .onChange(of: page) { newValue in
      props.onPageChange(["page": newValue])
      PageFonts.shared.prepare(around: newValue)
    }
  }

  /// Lays out the zoomed scroll around a page, from a little before it.
  private func openFlow(at target: Int) {
    flowFirst = max(1, target - 2)
    flowLast = min(604, target + 6)
    flowSettled = false
  }

  // MARK: Zoomed in

  private var flowPages: [MushafPage] {
    let all = MushafStore.shared.pages
    guard !all.isEmpty else { return [] }
    let first = max(1, min(flowFirst, all.count))
    let last = max(first, min(flowLast, all.count))
    return Array(all[(first - 1)..<last])
  }

  private func flowMode(area: CGSize, size: CGFloat, zoom: CGFloat, theme: ReaderTheme, full: CGSize) -> some View {
    let ctx = context(theme)
    let lineHeight = area.height / 15
    return ScrollViewReader { proxy in
      ScrollView(.vertical, showsIndicators: false) {
        LazyVStack(spacing: size * 1.2) {
          ForEach(flowPages) { p in
            let metrics = fonts.metrics(p.number)
            let qs = metrics.map { min(area.width * 0.985 / max($0.widest, 1) * 100, lineHeight * 0.72) * zoom } ?? 0
            Group {
              if props.view == "translation" {
                TranslationPage(page: p, size: size, width: area.width, zoom: zoom, ctx: ctx, qcf: metrics, qcfSize: qs)
              } else if props.view == "words" {
                WordsPage(page: p, size: size, width: area.width, zoom: zoom, ctx: ctx, qcf: metrics, qcfSize: qs, translit: props.showTranslit)
              } else {
                FlowPage(page: p, size: size, width: area.width, ctx: ctx, qcf: metrics, qcfSize: qs)
              }
            }
              .id(-p.number)
              .onAppear {
                // Near the end of what's laid out: lay out more.
                if p.number >= flowLast - 1 && flowLast < 604 { flowLast = min(604, flowLast + 6) }
              }
              .background(
                GeometryReader { g in
                  Color.clear.preference(key: PageOffsetsKey.self, value: [p.number: g.frame(in: .named("flow")).minY])
                }
              )
          }
        }
        .padding(.top, CGFloat(props.topInset) + 8)
        .padding(.bottom, CGFloat(props.bottomInset) + 120)
        .frame(width: full.width)
        .contentShape(Rectangle())
        .onTapGesture { props.onTap() }
      }
      .ignoresSafeArea()
      .frame(width: full.width, height: full.height)
      .coordinateSpace(name: "flow")
      .environment(\.layoutDirection, .leftToRight)
      .onPreferenceChange(PageOffsetsKey.self) { offsets in
        guard flowSettled else { return }
        // The page whose top has most recently passed a third of the way down is the one being read;
        // while following a recitation, the recited page whenever it's on screen around the middle.
        let line = full.height * 0.35
        var found = offsets.filter({ $0.value <= line }).max(by: { $0.value < $1.value })?.key
        if props.follow, let recited = recitedPage, let top = offsets[recited], top < full.height * 0.6,
           (offsets[recited + 1] ?? .infinity) > full.height * 0.4 {
          found = recited
        }
        if let reading = found, reading != page {
          page = reading
          props.onPageChange(["page": reading])
          PageFonts.shared.prepare(around: reading)
        }
      }
      .onAppear {
        // Straight to the word being recited, if a recitation is on; otherwise the page's top. The
        // pages are built lazily, so first the recited page (always reachable), which builds its
        // words; then the word itself, again once the pages around it have settled their heights.
        if let recited = recitedPage {
          let word = recitedWord
          DispatchQueue.main.async {
            proxy.scrollTo(-recited, anchor: .top)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
              proxy.scrollTo(word, anchor: .center)
              DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                proxy.scrollTo(recitedWord, anchor: .center)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { flowSettled = true }
              }
            }
          }
        } else {
          let target = -page
          DispatchQueue.main.async {
            proxy.scrollTo(target, anchor: .top)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
              proxy.scrollTo(target, anchor: .top)
              DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { flowSettled = true }
            }
          }
        }
      }
      .onChange(of: recitedWord) { word in
        guard props.follow, word > 0 else { return }
        withAnimation(.spring(response: 0.45, dampingFraction: 0.9)) {
          proxy.scrollTo(word, anchor: .center)
        }
      }
      .onChange(of: recitedPage) { recited in
        // Onto a page that may not be built yet: reach the page, then the word on it.
        guard props.follow, let recited else { return }
        if recited > flowLast - 1 { flowLast = min(604, recited + 4) }
        if recited < flowFirst { flowFirst = max(1, recited - 2) }
        proxy.scrollTo(-recited, anchor: .top)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
          withAnimation(.spring(response: 0.45, dampingFraction: 0.9)) {
            proxy.scrollTo(recitedWord, anchor: .center)
          }
        }
      }
      .onChange(of: flowTarget) { target in
        guard let target else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
          proxy.scrollTo(-target, anchor: .top)
          // Brought back to the recitation: on to the word being recited, not the page's top.
          if target == recitedPage {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { proxy.scrollTo(recitedWord, anchor: .center) }
          }
          flowTarget = nil
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { flowSettled = true }
        }
      }
    }
  }

  // MARK: Pinch

  private var magnify: some Gesture {
    MagnificationGesture()
      .onChanged { value in
        let current = props.view != "mushaf" ? CGFloat(props.textScale) : zoom
        if props.view != "mushaf" {
          pinch = min(max(current * value, 0.9), maxZoom + 0.3) / current
          return
        }
        let next = zoom * value
        // Held a little past the ends, so the limits feel soft rather than stuck.
        let soft = next < 1 ? 1 - (1 - next) * 0.35 : next > maxZoom ? maxZoom + (next - maxZoom) * 0.3 : next
        pinch = soft / zoom
      }
      .onEnded { value in
        if props.view != "mushaf" {
          let scale = min(max(CGFloat(props.textScale) * value, 1), maxZoom)
          withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { pinch = 1 }
          props.onTextScale(["scale": Double(scale)])
          return
        }
        let next = min(max(zoom * value, 1), maxZoom)
        let wasZoomed = zoom > 1.001
        // Zooming in during a recitation opens on the page being recited.
        if !wasZoomed && next >= 1.12 { openFlow(at: recitedPage ?? page) }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
          zoom = next < 1.12 ? 1 : next
          pinch = 1
        }
        let isZoomed = zoom > 1.001
        if isZoomed != wasZoomed {
          UIImpactFeedbackGenerator(style: .light).impactOccurred()
          props.onZoomChange(["zoomed": isZoomed])
        }
      }
  }
}
