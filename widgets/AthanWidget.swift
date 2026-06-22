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
  // Every stored time is in the past — the data is stale (app not opened in days).
  // Return nil rather than the first (oldest) entry: a passed time would make the
  // `.timer` countdown count *up*, e.g. "Fajr in 56:00:00". The view shows an
  // "Open AthanNow" prompt instead so it never displays a bogus countdown.
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
    let s = p.name.lowercased()
    if GRADIENTS[s] != nil { stage = s } // skip stages with no gradient (e.g. Sunrise)
  }
  return GRADIENTS[stage] != nil ? stage : "isha"
}

// The six prayers for the day that `now` falls in. The app bakes a week of times
// (6 per day, ascending, each day starting at Fajr) so the widget keeps working
// while the app is unopened. Without this the list views froze on the day the data
// was written — so a few days later the hero countdown advanced correctly while the
// list kept showing the original day's (now all-past) times.
func dayPrayers(_ data: WidgetData, now: Date) -> ArraySlice<PrayerTime> {
  let t = now.timeIntervalSince1970
  // Pick the latest day-block whose Fajr (the block's first entry) has begun; before
  // the first Fajr we're still on the first block.
  var start = 0
  for i in stride(from: 0, to: data.times.count, by: 6) where data.times[i].time <= t {
    start = i
  }
  return data.times[start..<min(start + 6, data.times.count)]
}

// Whether `p` is the upcoming prayer. Compared by time, not name: prayer names
// repeat across the week of baked entries, so name-matching would light up an
// already-passed prayer (e.g. today's Fajr once next is tomorrow's Fajr).
func isUpcoming(_ p: PrayerTime, _ next: (name: String, date: Date)?) -> Bool {
  guard let next = next else { return false }
  return abs(p.time - next.date.timeIntervalSince1970) < 1
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
    let data = loadWidgetData()
    // One entry now, plus one at each upcoming prayer boundary. Each view renders
    // relative to its own entry.date, so the displayed prayer (and the sky stage)
    // advances exactly when each athan passes — without depending on iOS issuing a
    // just-in-time refresh. This is what stops the countdown from flipping to a
    // count-up ("Dhuhr in 1:27" rising) after a prayer's time has passed.
    var entries: [AthanEntry] = [AthanEntry(date: now, data: data)]
    if let data = data {
      let t = now.timeIntervalSince1970
      for p in data.times where p.time > t {
        entries.append(AthanEntry(date: Date(timeIntervalSince1970: p.time), data: data))
      }
    }
    // Reload once we run past the last baked entry (a week out), or in 15 min if we
    // had no data yet, so we pick up freshly written times.
    let policy: TimelineReloadPolicy =
      entries.count > 1 ? .atEnd : .after(now.addingTimeInterval(900))
    completion(Timeline(entries: entries, policy: policy))
  }
}

// MARK: - Views

struct AthanWidgetView: View {
  @Environment(\.widgetFamily) var family
  var entry: AthanEntry

  var body: some View {
    // Require a real upcoming prayer, not just non-empty data: if every stored time
    // has passed (stale data), fall through to the "Open AthanNow" prompt rather than
    // rendering a count-up from an old time.
    if let data = entry.data, nextPrayer(data, now: entry.date) != nil {
      switch family {
      case .systemLarge: LargeView(data: data, now: entry.date)
      case .systemMedium: MediumView(data: data, now: entry.date)
      case .accessoryInline: InlineView(data: data, now: entry.date)
      case .accessoryCircular: CircularView(data: data, now: entry.date)
      case .accessoryRectangular: RectangularView(data: data, now: entry.date)
      default: SmallView(data: data, now: entry.date)
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
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
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
    .skyBackgroundCompat(colors: skyColors(data, now: now))
  }
}

struct MediumView: View {
  let data: WidgetData
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
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
        ForEach(dayPrayers(data, now: now), id: \.name) { p in
          let isNext = isUpcoming(p, next)
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
    .skyBackgroundCompat(colors: skyColors(data, now: now))
  }
}

struct LargeView: View {
  let data: WidgetData
  let now: Date
  var body: some View {
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
        ForEach(dayPrayers(data, now: now), id: \.name) { p in
          let date = Date(timeIntervalSince1970: p.time)
          let isNext = isUpcoming(p, next)
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
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
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
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
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
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
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

// MARK: - Split lock-screen widgets (a pair, meant to be added side by side)
//
// One widget covers the morning trio (Fajr, Sunrise, Dhuhr), the other the
// afternoon/evening trio (Asr, Maghrib, Isha). Stacked on the Lock Screen they
// show the whole day. Next prayer accented, passed ones dimmed.

private let MORNING_IDS: Set<String> = ["fajr", "sunrise", "dhuhr"]
private let EVENING_IDS: Set<String> = ["asr", "maghrib", "isha"]

struct PrayerGroupRectangularView: View {
  let data: WidgetData
  let ids: Set<String>
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
    // Today's prayers (the day-block `now` falls in) that belong to this group.
    let rows = dayPrayers(data, now: now).filter { ids.contains($0.name.lowercased()) }
    VStack(alignment: .leading, spacing: 2) {
      ForEach(rows, id: \.name) { p in
        let date = Date(timeIntervalSince1970: p.time)
        let isNext = isUpcoming(p, next)
        let isPast = p.time <= now.timeIntervalSince1970 && !isNext
        HStack {
          Text(p.name).font(.system(size: 13, weight: isNext ? .bold : .regular))
          Spacer()
          Text(shortTime(date, data.use24Hour ?? false))
            .font(.system(size: 13, weight: isNext ? .bold : .medium))
            .monospacedDigit()
        }
        .opacity(isPast ? 0.45 : 1)
        .widgetAccentable(isNext)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessoryContainer()
  }
}

struct AthanGroupWidgetView: View {
  var entry: AthanEntry
  let ids: Set<String>
  var body: some View {
    if let data = entry.data, !data.times.isEmpty {
      PrayerGroupRectangularView(data: data, ids: ids, now: entry.date)
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

struct AthanMorningWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AthanMorningWidget", provider: Provider()) { entry in
      AthanGroupWidgetView(entry: entry, ids: MORNING_IDS)
    }
    .configurationDisplayName("1/2 Prayers")
    .description("Fajr, Sunrise and Dhuhr. Pair with 2/2 Prayers for the full day.")
    .supportedFamilies([.accessoryRectangular])
  }
}

struct AthanEveningWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AthanEveningWidget", provider: Provider()) { entry in
      AthanGroupWidgetView(entry: entry, ids: EVENING_IDS)
    }
    .configurationDisplayName("2/2 Prayers")
    .description("Asr, Maghrib and Isha. Pair with 1/2 Prayers for the full day.")
    .supportedFamilies([.accessoryRectangular])
  }
}

@main
struct AthanWidgetBundle: WidgetBundle {
  var body: some Widget {
    AthanWidget()
    AthanMorningWidget()
    AthanEveningWidget()
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
    PrayerTime(name: "Sunrise", time: Date().addingTimeInterval(-5400).timeIntervalSince1970),
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
      SmallView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .systemSmall)).previewDisplayName("Small")
      MediumView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .systemMedium)).previewDisplayName("Medium")
      LargeView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .systemLarge)).previewDisplayName("Large")
      CircularView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryCircular)).previewDisplayName("Lock · Circular")
      RectangularView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryRectangular)).previewDisplayName("Lock · Rectangular")
      PrayerGroupRectangularView(data: SAMPLE, ids: MORNING_IDS, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryRectangular)).previewDisplayName("Lock · 1/2 Prayers")
      PrayerGroupRectangularView(data: SAMPLE, ids: EVENING_IDS, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryRectangular)).previewDisplayName("Lock · 2/2 Prayers")
      InlineView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryInline)).previewDisplayName("Lock · Inline")
    }
  }
}
#endif
