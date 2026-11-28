import SwiftUI

// Both layouts place words right to left themselves and are used under a left-to-right layout
// direction, so SwiftUI never mirrors them a second time.

/// A printed mushaf line: words spread to the full width, first word at the right. A line much
/// shorter than the width (the opening pages) is centred instead, at its natural spacing.
struct JustifiedLine: Layout {
  var gap: CGFloat
  var justify: Bool

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let height = subviews.map { $0.sizeThatFits(.unspecified).height }.max() ?? 0
    let natural = subviews.reduce(0) { $0 + $1.sizeThatFits(.unspecified).width } + gap * CGFloat(max(0, subviews.count - 1))
    return CGSize(width: proposal.width ?? natural, height: height)
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
    let total = sizes.reduce(0) { $0 + $1.width }
    let count = subviews.count
    let spread = justify && count > 1
    let space = spread ? max(0, (bounds.width - total) / CGFloat(count - 1)) : gap
    let used = total + space * CGFloat(max(0, count - 1))
    var x = spread ? bounds.maxX : bounds.midX + used / 2
    for (index, subview) in subviews.enumerated() {
      x -= sizes[index].width
      subview.place(at: CGPoint(x: x, y: bounds.midY), anchor: .leading, proposal: .unspecified)
      x -= space
    }
  }
}

/// Words flowing right to left into centred lines of a fixed height, for reading zoomed in.
struct FlowingLines: Layout {
  var gap: CGFloat
  var lineHeight: CGFloat

  private func rows(_ sizes: [CGSize], width: CGFloat) -> [[Int]] {
    var rows: [[Int]] = []
    var row: [Int] = []
    var used: CGFloat = 0
    for (index, size) in sizes.enumerated() {
      let needed = row.isEmpty ? size.width : used + gap + size.width
      if !row.isEmpty && needed > width {
        rows.append(row)
        row = [index]
        used = size.width
      } else {
        row.append(index)
        used = needed
      }
    }
    if !row.isEmpty { rows.append(row) }
    return rows
  }

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? 320
    let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
    return CGSize(width: width, height: CGFloat(rows(sizes, width: width).count) * lineHeight)
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
    for (r, row) in rows(sizes, width: bounds.width).enumerated() {
      let rowWidth = row.reduce(0) { $0 + sizes[$1].width } + gap * CGFloat(max(0, row.count - 1))
      var x = bounds.midX + rowWidth / 2
      let y = bounds.minY + lineHeight * (CGFloat(r) + 0.5)
      for index in row {
        x -= sizes[index].width
        subviews[index].place(at: CGPoint(x: x, y: y), anchor: .leading, proposal: .unspecified)
        x -= gap
      }
    }
  }
}

/// Words flowing right to left into centred rows, each row as tall as its tallest word (for words
/// with their meanings beneath, which can wrap onto two lines), with a space between rows.
struct FlowingRows: Layout {
  var gap: CGFloat
  var rowSpacing: CGFloat

  private func rows(_ sizes: [CGSize], width: CGFloat) -> [[Int]] {
    var rows: [[Int]] = []
    var row: [Int] = []
    var used: CGFloat = 0
    for (index, size) in sizes.enumerated() {
      let needed = row.isEmpty ? size.width : used + gap + size.width
      if !row.isEmpty && needed > width {
        rows.append(row)
        row = [index]
        used = size.width
      } else {
        row.append(index)
        used = needed
      }
    }
    if !row.isEmpty { rows.append(row) }
    return rows
  }

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? 320
    let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
    let all = rows(sizes, width: width)
    let height = all.reduce(CGFloat(0)) { $0 + ($1.map { sizes[$0].height }.max() ?? 0) } + rowSpacing * CGFloat(max(0, all.count - 1))
    return CGSize(width: width, height: height)
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
    var y = bounds.minY
    for row in rows(sizes, width: bounds.width) {
      let rowWidth = row.reduce(0) { $0 + sizes[$1].width } + gap * CGFloat(max(0, row.count - 1))
      let rowHeight = row.map { sizes[$0].height }.max() ?? 0
      var x = bounds.midX + rowWidth / 2
      for index in row {
        x -= sizes[index].width
        // Each word hangs from the top of its row, so the Arabic lines up across the row.
        subviews[index].place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: .unspecified)
        x -= gap
      }
      y += rowHeight + rowSpacing
    }
  }
}

/// The page offsets in the zoomed-in scroll, to tell which page is being read.
struct PageOffsetsKey: PreferenceKey {
  static let defaultValue: [Int: CGFloat] = [:]
  static func reduce(value: inout [Int: CGFloat], nextValue: () -> [Int: CGFloat]) {
    value.merge(nextValue()) { $1 }
  }
}

/// The bounds of the words being explained in the Meaning sheet, gathered so the page can draw one
/// band under each line's run of them instead of a bubble per word.
struct FocusRectsKey: PreferenceKey {
  static let defaultValue: [Anchor<CGRect>] = []
  static func reduce(value: inout [Anchor<CGRect>], nextValue: () -> [Anchor<CGRect>]) {
    value.append(contentsOf: nextValue())
  }
}

/// The bounds of the words of the ayah being held, for its grey band.
struct PressRectsKey: PreferenceKey {
  static let defaultValue: [Anchor<CGRect>] = []
  static func reduce(value: inout [Anchor<CGRect>], nextValue: () -> [Anchor<CGRect>]) {
    value.append(contentsOf: nextValue())
  }
}

/// One rounded band per line across a set of words' bounds.
private struct LineBands: View {
  let rects: [CGRect]
  let color: Color

  var body: some View {
    let lines: [CGRect] = rects.sorted { $0.midY < $1.midY }.reduce(into: []) { out, r in
      if let last = out.last, abs(last.midY - r.midY) < min(last.height, r.height) * 0.5 {
        out[out.count - 1] = last.union(r)
      } else {
        out.append(r)
      }
    }
    ForEach(Array(lines.enumerated()), id: \.offset) { _, r in
      let band = r.insetBy(dx: -r.height * 0.14, dy: r.height * 0.1)
      RoundedRectangle(cornerRadius: band.height * 0.32, style: .continuous)
        .fill(color)
        .frame(width: band.width, height: band.height)
        .position(x: band.midX, y: band.midY)
    }
  }
}

extension View {
  /// Draws, behind the page, one rounded band per line across the words being explained: the whole
  /// ayah (or passage) lit as one, in purple.
  func focusBands(dark: Bool) -> some View {
    backgroundPreferenceValue(FocusRectsKey.self) { anchors in
      GeometryReader { g in
        let rects = anchors.map { g[$0] }.sorted { $0.midY < $1.midY }
        // Words on one line share a middle; each line's run becomes one rectangle.
        let lines: [CGRect] = rects.reduce(into: []) { out, r in
          if let last = out.last, abs(last.midY - r.midY) < min(last.height, r.height) * 0.5 {
            out[out.count - 1] = last.union(r)
          } else {
            out.append(r)
          }
        }
        ForEach(Array(lines.enumerated()), id: \.offset) { _, r in
          let band = r.insetBy(dx: -r.height * 0.14, dy: r.height * 0.1)
          RoundedRectangle(cornerRadius: band.height * 0.32, style: .continuous)
            .fill(Color(red: 0.58, green: 0.45, blue: 0.86).opacity(dark ? 0.28 : 0.16))
            .frame(width: band.width, height: band.height)
            .position(x: band.midX, y: band.midY)
        }
      }
      .allowsHitTesting(false)
    }
    // The ayah being held: a grey band, shown at once.
    .backgroundPreferenceValue(PressRectsKey.self) { anchors in
      GeometryReader { g in
        LineBands(rects: anchors.map { g[$0] }, color: Color.gray.opacity(dark ? 0.28 : 0.2))
      }
      .allowsHitTesting(false)
    }
  }
}
