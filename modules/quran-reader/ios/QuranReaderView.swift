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
  /// A still snapshot of the page's opening lines (the home screen's Continue card): no gestures or menus.
  @Field var preview: Bool = false
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
  let frame: Color

  static func make(dark: Bool) -> ReaderTheme {
    dark
      ? ReaderTheme(dark: true, background: Color(hex: 0x111018), ink: Color(hex: 0xECE9F3), quiet: Color(hex: 0x6F6A80), recited: Color(hex: 0xA5A1FF), frame: Color(hex: 0x3A3550))
      : ReaderTheme(dark: false, background: Color(hex: 0xF8F8FC), ink: Color(hex: 0x1D1B26), quiet: Color(hex: 0xA6A2B4), recited: Color(hex: 0x4338CA), frame: Color(hex: 0xC9C6D6))
  }
}

extension Color {
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
  let ns: Namespace.ID
  let titles: [String]
  let bookmarked: Set<Int>
  let interactive: Bool
  let act: (String, MushafWord, Int) -> Void

  func color(_ word: MushafWord) -> Color {
    guard playing else { return theme.ink }
    let order = word.order
    if order == current { return theme.ink }
    if order > current { return theme.quiet }
    return order >= from ? theme.recited : theme.ink
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
    let isCurrent = ctx.playing && word.order == ctx.current
    return Text(useGlyph ? word.glyph : word.text)
      .font(.custom(font, size: size))
      .foregroundColor(ctx.color(word))
      .fixedSize()
      .background {
        if isCurrent {
          GlassBubble(dark: ctx.theme.dark)
            .padding(.horizontal, -size * 0.22)
            .padding(.vertical, size * 0.12)
            .matchedGeometryEffect(id: "glass", in: ctx.ns)
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
      Button { ctx.act("play", word, page) } label: { Label("Play from here", systemImage: "play.fill") }
      Button { ctx.act("repeat", word, page) } label: { Label("Repeat this ayah", systemImage: "repeat.1") }
    }
    Button {
      UIPasteboard.general.string = MushafStore.shared.ayahText[word.ayahKey]
      UINotificationFeedbackGenerator().notificationOccurred(.success)
    } label: { Label("Copy ayah", systemImage: "doc.on.doc") }
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
    VStack(spacing: 10) {
      Text(MushafStore.shared.ayahText[word.ayahKey] ?? word.text)
        .font(.custom(MushafFont.name, size: 30))
        .foregroundColor(ctx.theme.ink)
        .multilineTextAlignment(.center)
        .lineSpacing(6)
        .environment(\.layoutDirection, .rightToLeft)
      Text("\(ctx.title(word.surah)), Ayah \(word.ayah)")
        .font(.footnote)
        .foregroundColor(ctx.theme.quiet)
    }
    .padding(.horizontal, 22)
    .padding(.vertical, 18)
    .frame(width: min(UIScreen.main.bounds.width - 40, 380))
    .background(ctx.theme.background)
  }
}

struct SurahHeader: View {
  let surah: Int
  let size: CGFloat
  let theme: ReaderTheme

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: size * 0.35).stroke(theme.frame, lineWidth: 1)
      RoundedRectangle(cornerRadius: size * 0.25).stroke(theme.frame, lineWidth: 0.6).padding(3)
      Text("سورة \(MushafStore.shared.name(surah))")
        .font(.custom(MushafFont.name, size: size * 0.82))
        .foregroundColor(theme.ink)
    }
    .frame(height: size * 1.5)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Surah \(surah)")
    .accessibilityAddTraits(.isHeader)
  }
}

struct BismillahLine: View {
  let size: CGFloat
  let theme: ReaderTheme

  var body: some View {
    Text(MushafStore.shared.bismillah)
      .font(.custom(MushafFont.name, size: size))
      .foregroundColor(theme.ink)
      .fixedSize()
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
    case .bismillah:
      BismillahLine(size: size, theme: ctx.theme)
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

/// A page zoomed in: its words flowing into centred lines, its headers between them.
struct FlowPage: View {
  let page: MushafPage
  let size: CGFloat
  let width: CGFloat
  let ctx: ReaderContext

  private enum Block {
    case header(Int)
    case bismillah
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
      case .bismillah:
        if !run.isEmpty { out.append(.words(run)); run = [] }
        out.append(.bismillah)
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
        case .bismillah:
          BismillahLine(size: size * 0.8, theme: ctx.theme)
        case .words(let words):
          FlowingLines(gap: size * 0.3, lineHeight: size * 2.05) {
            ForEach(words, id: \.order) { word in
              WordView(word: word, page: page.number, size: size, ctx: ctx).id(word.order)
            }
          }
          .frame(width: width)
        }
      }
      Text("\(page.number)")
        .font(.caption)
        .foregroundColor(ctx.theme.quiet)
        .padding(.top, 4)
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
    let theme = ReaderTheme.make(dark: props.dark)
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
        } else if zoom <= 1.001 {
          pageMode(area: area, size: base, theme: theme, full: geo.size)
            .scaleEffect(pinch)
        } else {
          flowMode(area: area, size: base * zoom, theme: theme, full: geo.size)
            .scaleEffect(pinch)
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
    .onChange(of: props.pageNonce) { _ in
      let target = clampPage(props.page)
      if zoom > 1.001 {
        openFlow(at: target)
        flowTarget = target
      }
      page = target
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

  private var currentOrder: Int {
    props.highlighting ? MushafWord.order(props.curSurah, props.curAyah, props.curWord) : -1
  }

  private func context(_ theme: ReaderTheme) -> ReaderContext {
    ReaderContext(
      theme: theme,
      playing: props.highlighting,
      current: currentOrder,
      from: MushafWord.order(props.fromSurah, props.fromAyah, props.fromWord),
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

  private func flowMode(area: CGSize, size: CGFloat, theme: ReaderTheme, full: CGSize) -> some View {
    let ctx = context(theme)
    return ScrollViewReader { proxy in
      ScrollView(.vertical, showsIndicators: false) {
        LazyVStack(spacing: size * 1.2) {
          ForEach(flowPages) { p in
            FlowPage(page: p, size: size, width: area.width, ctx: ctx)
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
        .padding(.bottom, CGFloat(props.bottomInset) + 40)
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
        // The page whose top has most recently passed a third of the way down is the one being read.
        let line = full.height * 0.35
        if let reading = offsets.filter({ $0.value <= line }).max(by: { $0.value < $1.value })?.key, reading != page {
          page = reading
          props.onPageChange(["page": reading])
        }
      }
      .onAppear {
        // After the first layout pass, or the scroll has nothing to go to yet.
        let onWord = props.highlighting && props.follow
        let target: Int = onWord ? currentOrder : -page
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
          proxy.scrollTo(target, anchor: onWord ? .center : .top)
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { flowSettled = true }
        }
      }
      .onChange(of: currentOrder) { order in
        guard props.follow, order > 0 else { return }
        withAnimation(.spring(response: 0.45, dampingFraction: 0.9)) {
          proxy.scrollTo(order, anchor: .center)
        }
      }
      .onChange(of: flowTarget) { target in
        guard let target else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
          proxy.scrollTo(-target, anchor: .top)
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
        let next = zoom * value
        // Held a little past the ends, so the limits feel soft rather than stuck.
        let soft = next < 1 ? 1 - (1 - next) * 0.35 : next > maxZoom ? maxZoom + (next - maxZoom) * 0.3 : next
        pinch = soft / zoom
      }
      .onEnded { value in
        let next = min(max(zoom * value, 1), maxZoom)
        let wasZoomed = zoom > 1.001
        if !wasZoomed && next >= 1.12 { openFlow(at: page) }
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
