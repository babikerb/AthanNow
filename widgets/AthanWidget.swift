import WidgetKit
import SwiftUI

// MARK: - Shared data (written by the app to the App Group)

private let APP_GROUP = "group.com.bbabiker.AthanNow"
private let DATA_KEY = "athannow_widget"

struct PrayerTime: Codable {
  let name: String
  let time: Double // epoch seconds
}

struct WidgetData: Codable {
  let city: String
  let times: [PrayerTime]
  let use24Hour: Bool?
}

func loadWidgetData() -> WidgetData? {
  guard
    let defaults = UserDefaults(suiteName: APP_GROUP),
    let raw = defaults.string(forKey: DATA_KEY),
    let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(WidgetData.self, from: data)
}

func nextPrayer(_ data: WidgetData, now: Date) -> (name: String, date: Date)? {
  let t = now.timeIntervalSince1970
  if let p = data.times.first(where: { $0.time > t }) {
    return (p.name, Date(timeIntervalSince1970: p.time))
  }
  // All of today's passed: fall back to the first (next day) entry.
  if let p = data.times.first {
    return (p.name, Date(timeIntervalSince1970: p.time))
  }
  return nil
}

// MARK: - Gradient (mirrors prayerGradients in src/theme/colors.ts)

private extension Color {
  init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}

private let GRADIENTS: [String: [UInt32]] = [
  "fajr":    [0x0c0b1c, 0x18153a, 0x2c2258, 0x4e3348, 0x7a5560],
  "dhuhr":   [0x8eb2c4, 0x6090a8, 0x4a7090, 0x366078],
  "asr":     [0x1c3448, 0x2a4e68, 0x466880, 0x706258, 0x907040],
  "maghrib": [0x121024, 0x201846, 0x4a1e30, 0x783030, 0x9a5838, 0xa87840],
  "isha":    [0x070d18, 0x0b1522, 0x0f1828, 0x091220],
]

// The prayer stage we're currently *in*, used to pick the backdrop so the widget
// matches the Athan screen's sky. Based on the most recently passed prayer; before
// the day's first prayer (or after the last) we're in the night (isha) stage.
func currentStage(_ data: WidgetData, now: Date) -> String {
  let t = now.timeIntervalSince1970
  var stage = "isha"
  for p in data.times where p.time <= t {
    stage = p.name.lowercased()
  }
  return GRADIENTS[stage] != nil ? stage : "isha"
}

// Minutes before the next prayer when the sky starts shifting toward it (mirrors
// gradientShiftMinutes in src/theme/colors.ts). Widgets refresh on a coarse
// timeline so this reads as a gentle step-shift rather than a continuous slide.
private let SHIFT_MINUTES: [String: Double] = [
  "fajr": 35, "dhuhr": 50, "asr": 95, "maghrib": 45, "isha": 75,
]

private func rampRGB(_ hexes: [UInt32], _ p: Double) -> (Double, Double, Double) {
  func rgb(_ h: UInt32) -> (Double, Double, Double) {
    (Double((h >> 16) & 0xFF), Double((h >> 8) & 0xFF), Double(h & 0xFF))
  }
  let n = hexes.count
  if n == 1 { return rgb(hexes[0]) }
  let x = max(0, min(1, p)) * Double(n - 1)
  let i = Int(floor(x))
  if i >= n - 1 { return rgb(hexes[n - 1]) }
  let f = x - Double(i)
  let a = rgb(hexes[i]); let b = rgb(hexes[i + 1])
  return (a.0 + (b.0 - a.0) * f, a.1 + (b.1 - a.1) * f, a.2 + (b.2 - a.2) * f)
}

// The backdrop colors, blended from the current stage toward the next prayer's
// stage as its time approaches (within that stage's shift window).
func skyColors(_ data: WidgetData, now: Date) -> [Color] {
  let stage = currentStage(data, now: now)
  let curHexes = GRADIENTS[stage] ?? GRADIENTS["isha"]!
  guard
    let next = nextPrayer(data, now: now),
    let nextHexes = GRADIENTS[next.name.lowercased()]
  else { return curHexes.map { Color(hex: $0) } }

  let window = SHIFT_MINUTES[stage] ?? 45
  let mins = next.date.timeIntervalSince(now) / 60
  if mins < 0 || mins > window { return curHexes.map { Color(hex: $0) } }

  let t = 1 - mins / window
  let stops = 6
  return (0..<stops).map { s in
    let p = Double(s) / Double(stops - 1)
    let a = rampRGB(curHexes, p)
    let b = rampRGB(nextHexes, p)
    return Color(
      red: (a.0 + (b.0 - a.0) * t) / 255,
      green: (a.1 + (b.1 - a.1) * t) / 255,
      blue: (a.2 + (b.2 - a.2) * t) / 255
    )
  }
}

struct SkyBackground: View {
  let colors: [Color]
  var body: some View {
    LinearGradient(
      colors: colors,
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
    // Darkening scrim so white text stays legible on every stage — especially the
    // light "dhuhr" sky. Slightly stronger at the bottom where most text sits.
    .overlay(
      LinearGradient(
        colors: [Color.black.opacity(0.15), Color.black.opacity(0.32)],
        startPoint: .top,
        endPoint: .bottom
      )
    )
  }
}

// MARK: - Timeline

struct AthanEntry: TimelineEntry {
  let date: Date
  let data: WidgetData?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> AthanEntry {
    AthanEntry(date: Date(), data: loadWidgetData())
  }
  func getSnapshot(in context: Context, completion: @escaping (AthanEntry) -> Void) {
    completion(AthanEntry(date: Date(), data: loadWidgetData()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<AthanEntry>) -> Void) {
    let now = Date()
    let entry = AthanEntry(date: now, data: loadWidgetData())
    // Refresh at the next prayer (so the stage/gradient flips) or in 15 min, whichever is sooner.
    var refresh = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900)
    if let data = entry.data, let next = nextPrayer(data, now: now), next.date > now, next.date < refresh {
      refresh = next.date.addingTimeInterval(1)
    }
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }
}

// MARK: - Views

struct AthanWidgetView: View {
  @Environment(\.widgetFamily) var family
  var entry: AthanEntry

  var body: some View {
    if let data = entry.data, !data.times.isEmpty {
      switch family {
      case .systemLarge: LargeView(data: data)
      case .systemMedium: MediumView(data: data)
      case .accessoryInline: InlineView(data: data)
      case .accessoryCircular: CircularView(data: data)
      case .accessoryRectangular: RectangularView(data: data)
      default: SmallView(data: data)
      }
    } else {
      VStack(spacing: 4) {
        Image(systemName: "moon.stars.fill").foregroundColor(.white)
        Text("Open AthanNow").font(.caption).foregroundColor(.white.opacity(0.7))
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .skyBackgroundCompat(colors: GRADIENTS["isha"]!.map { Color(hex: $0) })
    }
  }
}

private func timeString(_ date: Date, _ use24Hour: Bool) -> String {
  let f = DateFormatter()
  f.dateFormat = use24Hour ? "HH:mm" : "h:mm a"
  return f.string(from: date)
}

// Compact time without the AM/PM suffix, for tight multi-column lists.
private func shortTime(_ date: Date, _ use24Hour: Bool) -> String {
  let f = DateFormatter()
  f.dateFormat = use24Hour ? "HH:mm" : "h:mm"
  return f.string(from: date)
}

// The hero countdown, made unambiguous with a leading "in " so it never reads as
// a clock time. e.g. "in 2:07:07" rather than a bare "2:07:07".
private func countdownLabel(_ date: Date, size: CGFloat) -> some View {
  (Text("in ").font(.system(size: max(11, size * 0.42), weight: .medium)).foregroundColor(.white.opacity(0.75))
    + Text(date, style: .timer).font(.system(size: size, weight: .bold)).foregroundColor(.white))
    .monospacedDigit()
    .lineLimit(1)
}

struct SmallView: View {
  let data: WidgetData
  var body: some View {
    let next = nextPrayer(data, now: Date())
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 4) {
        Image(systemName: "location.fill").font(.system(size: 9)).foregroundColor(.white.opacity(0.7))
        Text(data.city).font(.system(size: 11)).foregroundColor(.white.opacity(0.7)).lineLimit(1)
      }
      Spacer()
      Text(next?.name.uppercased() ?? "").font(.system(size: 13, weight: .semibold)).foregroundColor(.white)
      if let n = next {
        countdownLabel(n.date, size: 22)
        Text("at " + timeString(n.date, data.use24Hour ?? false)).font(.system(size: 11)).foregroundColor(.white.opacity(0.7))
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .skyBackgroundCompat(colors: skyColors(data, now: Date()))
  }
}

struct MediumView: View {
  let data: WidgetData
  var body: some View {
    let next = nextPrayer(data, now: Date())
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 2) {
        Text(data.city).font(.system(size: 11)).foregroundColor(.white.opacity(0.7)).lineLimit(1)
        Spacer()
        Text(next?.name.uppercased() ?? "").font(.system(size: 13, weight: .semibold)).foregroundColor(.white)
        if let n = next {
          countdownLabel(n.date, size: 24)
          Text("at " + timeString(n.date, data.use24Hour ?? false)).font(.system(size: 11)).foregroundColor(.white.opacity(0.7))
        }
      }
      VStack(alignment: .leading, spacing: 5) {
        ForEach(data.times.prefix(5), id: \.name) { p in
          let isNext = p.name == next?.name
          HStack {
            Text(p.name).font(.system(size: 12, weight: isNext ? .bold : .regular))
            Spacer()
            Text(timeString(Date(timeIntervalSince1970: p.time), data.use24Hour ?? false))
              .font(.system(size: 12, weight: isNext ? .bold : .regular)).monospacedDigit()
          }
          .foregroundColor(isNext ? .white : .white.opacity(0.75))
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .skyBackgroundCompat(colors: skyColors(data, now: Date()))
  }
}

struct LargeView: View {
  let data: WidgetData
  var body: some View {
    let now = Date()
    let next = nextPrayer(data, now: now)
    VStack(alignment: .leading, spacing: 0) {
      // Header: location + next prayer hero
      HStack(spacing: 5) {
        Image(systemName: "location.fill").font(.system(size: 11)).foregroundColor(.white.opacity(0.7))
        Text(data.city).font(.system(size: 13)).foregroundColor(.white.opacity(0.7)).lineLimit(1)
      }
      Spacer(minLength: 8)
      Text(next?.name.uppercased() ?? "").font(.system(size: 15, weight: .semibold)).foregroundColor(.white)
      if let n = next {
        countdownLabel(n.date, size: 44)
        Text("at " + timeString(n.date, data.use24Hour ?? false)).font(.system(size: 12)).foregroundColor(.white.opacity(0.7))
      }
      Spacer(minLength: 10)
      Divider().overlay(Color.white.opacity(0.18))
      Spacer(minLength: 10)
      // Full prayer list
      VStack(spacing: 0) {
        ForEach(data.times.prefix(5), id: \.name) { p in
          let date = Date(timeIntervalSince1970: p.time)
          let isNext = p.name == next?.name
          let isPast = p.time <= now.timeIntervalSince1970 && !isNext
          HStack {
            Text(p.name).font(.system(size: 15, weight: isNext ? .bold : .regular))
            Spacer()
            Text(timeString(date, data.use24Hour ?? false)).font(.system(size: 15, weight: isNext ? .bold : .regular)).monospacedDigit()
          }
          .foregroundColor(isNext ? .white : .white.opacity(isPast ? 0.4 : 0.85))
          .padding(.vertical, 6)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .skyBackgroundCompat(colors: skyColors(data, now: now))
  }
}

// MARK: - Lock-screen (accessory) views
//
// Lock-screen widgets render monochrome/vibrant, so gradients and custom colors
// are ignored — the system tints everything. We keep these to crisp text and an
// AccessoryWidgetBackground, and rely on `.widgetAccentable()` for emphasis.

// Lock-screen widgets must still declare a container background on iOS 17+.
extension View {
  @ViewBuilder
  func accessoryContainer() -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(for: .widget) { Color.clear }
    } else {
      self
    }
  }
}

struct CircularView: View {
  let data: WidgetData
  var body: some View {
    let next = nextPrayer(data, now: Date())
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 1) {
        Text(next?.name ?? "—")
          .font(.system(size: 12, weight: .semibold))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
          .widgetAccentable()
        if let n = next {
          Text(shortTime(n.date, data.use24Hour ?? false))
            .font(.system(size: 13, weight: .bold))
            .monospacedDigit()
            .minimumScaleFactor(0.6)
            .lineLimit(1)
        }
      }
      .padding(2)
    }
    .accessoryContainer()
  }
}

struct RectangularView: View {
  let data: WidgetData
  var body: some View {
    let next = nextPrayer(data, now: Date())
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 3) {
        Image(systemName: "moon.stars.fill").font(.system(size: 11))
        Text(next?.name.uppercased() ?? "ATHAN").font(.system(size: 13, weight: .bold))
      }
      .widgetAccentable()
      if let n = next {
        Text(n.date, style: .timer)
          .font(.system(size: 22, weight: .semibold))
          .monospacedDigit()
          .lineLimit(1)
        Text("until " + timeString(n.date, data.use24Hour ?? false))
          .font(.system(size: 11))
          .foregroundColor(.secondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessoryContainer()
  }
}

struct InlineView: View {
  let data: WidgetData
  var body: some View {
    let next = nextPrayer(data, now: Date())
    Group {
      if let n = next {
        Label {
          Text("\(n.name) ") + Text(n.date, style: .timer)
        } icon: {
          Image(systemName: "moon.stars.fill")
        }
      } else {
        Label("AthanNow", systemImage: "moon.stars.fill")
      }
    }
    .accessoryContainer()
  }
}

// iOS 17 requires a container background; older versions just use padding.
// We paint the prayer-stage gradient as that background so it matches the app.
extension View {
  @ViewBuilder
  func skyBackgroundCompat(colors: [Color]) -> some View {
    // A soft drop shadow on all text keeps it readable over any stage's gradient.
    let shadowed = self.shadow(color: .black.opacity(0.45), radius: 1.5, x: 0, y: 1)
    if #available(iOS 17.0, *) {
      shadowed.padding(16).containerBackground(for: .widget) { SkyBackground(colors: colors) }
    } else {
      shadowed.padding(16).background(SkyBackground(colors: colors))
    }
  }
}

// MARK: - "Today's Prayers" lock-screen list (a separate, user-selectable widget)
//
// A rectangular accessory widget that shows all five of today's prayers at once,
// with the next one accented and the ones that already passed dimmed — the same
// at-a-glance read as the home-screen list. Offered as its own widget so it shows
// up alongside "Prayer Times" when adding a lock-screen widget.

struct TodayListRectangularView: View {
  let data: WidgetData
  var body: some View {
    let now = Date()
    let next = nextPrayer(data, now: now)
    HStack(spacing: 0) {
      ForEach(data.times.prefix(5), id: \.name) { p in
        let date = Date(timeIntervalSince1970: p.time)
        let isNext = p.name == next?.name
        let isPast = p.time <= now.timeIntervalSince1970 && !isNext
        VStack(spacing: 1) {
          Text(String(p.name.prefix(3)))
            .font(.system(size: 11, weight: isNext ? .bold : .regular))
          Text(shortTime(date, data.use24Hour ?? false))
            .font(.system(size: 12, weight: isNext ? .bold : .medium))
            .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .opacity(isPast ? 0.45 : 1)
        .widgetAccentable(isNext)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessoryContainer()
  }
}

struct AthanListWidgetView: View {
  var entry: AthanEntry
  var body: some View {
    if let data = entry.data, !data.times.isEmpty {
      TodayListRectangularView(data: data)
    } else {
      Label("Open AthanNow", systemImage: "moon.stars.fill").font(.caption2).accessoryContainer()
    }
  }
}

// MARK: - Widgets

struct AthanWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AthanWidget", provider: Provider()) { entry in
      AthanWidgetView(entry: entry)
    }
    .configurationDisplayName("Prayer Times")
    .description("Your next prayer at a glance.")
    .supportedFamilies([
      .systemSmall, .systemMedium, .systemLarge,
      .accessoryCircular, .accessoryRectangular, .accessoryInline,
    ])
  }
}

struct AthanListWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AthanListWidget", provider: Provider()) { entry in
      AthanListWidgetView(entry: entry)
    }
    .configurationDisplayName("Today's Prayers")
    .description("All of today's prayer times, with past ones dimmed.")
    .supportedFamilies([.accessoryRectangular])
  }
}

@main
struct AthanWidgetBundle: WidgetBundle {
  var body: some Widget {
    AthanWidget()
    AthanListWidget()
  }
}

// MARK: - Xcode canvas previews (DEBUG only — stripped from release builds)
//
// Open this file in Xcode (after `npx expo prebuild`) and use the canvas (⌥⌘↵)
// to see every size — including the lock-screen accessory widgets — with sample
// data, without an EAS build or a device.

#if DEBUG
private let SAMPLE = WidgetData(
  city: "San Francisco",
  times: [
    PrayerTime(name: "Fajr", time: Date().addingTimeInterval(-7200).timeIntervalSince1970),
    PrayerTime(name: "Dhuhr", time: Date().addingTimeInterval(1500).timeIntervalSince1970),
    PrayerTime(name: "Asr", time: Date().addingTimeInterval(9000).timeIntervalSince1970),
    PrayerTime(name: "Maghrib", time: Date().addingTimeInterval(18000).timeIntervalSince1970),
    PrayerTime(name: "Isha", time: Date().addingTimeInterval(25200).timeIntervalSince1970),
  ],
  use24Hour: false
)

struct AthanWidget_Previews: PreviewProvider {
  static var previews: some View {
    Group {
      SmallView(data: SAMPLE).previewContext(WidgetPreviewContext(family: .systemSmall)).previewDisplayName("Small")
      MediumView(data: SAMPLE).previewContext(WidgetPreviewContext(family: .systemMedium)).previewDisplayName("Medium")
      LargeView(data: SAMPLE).previewContext(WidgetPreviewContext(family: .systemLarge)).previewDisplayName("Large")
      CircularView(data: SAMPLE).previewContext(WidgetPreviewContext(family: .accessoryCircular)).previewDisplayName("Lock · Circular")
      RectangularView(data: SAMPLE).previewContext(WidgetPreviewContext(family: .accessoryRectangular)).previewDisplayName("Lock · Rectangular")
      TodayListRectangularView(data: SAMPLE).previewContext(WidgetPreviewContext(family: .accessoryRectangular)).previewDisplayName("Lock · Today's Prayers")
      InlineView(data: SAMPLE).previewContext(WidgetPreviewContext(family: .accessoryInline)).previewDisplayName("Lock · Inline")
    }
  }
}
#endif
