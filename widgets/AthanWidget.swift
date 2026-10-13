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

// MARK: - Sky stage (selects the ramp from DesignTokens.swift: DTSky)

// The prayer stage we're currently *in*, used to pick the backdrop so the widget
// matches the Athan screen's sky. Based on the most recently passed prayer; before
// the day's first prayer (or after the last) we're in the night (isha) stage.
func currentStage(_ data: WidgetData, now: Date) -> String {
  let t = now.timeIntervalSince1970
  let known: Set<String> = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]
  var stage = "isha"
  for p in data.times where p.time <= t {
    let s = p.name.lowercased()
    if known.contains(s) { stage = s }
  }
  return stage
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

// The window the progress rule tracks: from the most recent prayer to the next one.
func prayerWindow(_ data: WidgetData, now: Date) -> ClosedRange<Date>? {
  let t = now.timeIntervalSince1970
  guard
    let next = data.times.first(where: { $0.time > t }),
    let prev = data.times.last(where: { $0.time <= t })
  else { return nil }
  return Date(timeIntervalSince1970: prev.time)...Date(timeIntervalSince1970: next.time)
}

private let ARABIC_NAMES: [String: String] = [
  "fajr": "الفجر", "sunrise": "الشروق", "dhuhr": "الظهر",
  "asr": "العصر", "maghrib": "المغرب", "isha": "العشاء",
]

// Sky ramp for the stage + the stage scrim (validated for text contrast in design/tokens.json).
struct SkyBackground: View {
  let stage: String
  var body: some View {
    LinearGradient(colors: DTSky.stops(stage), startPoint: .top, endPoint: .bottom)
      .overlay(
        LinearGradient(
          colors: [Color.black.opacity(0.05), Color.black.opacity(DTSky.scrim(stage))],
          startPoint: .top,
          endPoint: .bottom
        )
      )
  }
}

// iOS 17 requires a container background; older versions just use padding. The prayer-stage sky is that background.
// In tinted / clear Home Screen modes the system replaces it, so key shapes carry `.widgetAccentable()`.
extension View {
  @ViewBuilder
  func skyBackgroundCompat(stage: String) -> some View {
    if #available(iOS 17.0, *) {
      // iOS 17+ already insets widget content by the system content margin (~16pt); adding our own padding would double it.
      self.containerBackground(for: .widget) { SkyBackground(stage: stage) }
    } else {
      self.padding(16).background(SkyBackground(stage: stage))
    }
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
//
// Mirrors the in-app reference widgets (src/widgets): next prayer's countdown is the hero, the next prayer in the list
// is bold with a 3pt apricot tick, passed prayers are dimmed, and apricot appears only on the progress rule and the tick.
// WidgetKit constraints: no animation, the countdown is Text(date, style: .timer), the rule is ProgressView(timerInterval:).

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
        Image(systemName: "moon.stars").foregroundColor(DTNight.skyText)
        Text("No times yet. Open AthanNow to load them.")
          .font(DTFont.text(12))
          .foregroundColor(DTNight.skyTextSecondary)
          .multilineTextAlignment(.center)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .skyBackgroundCompat(stage: "isha")
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

// The hero countdown: tabular serif numerals, live via the system timer text.
private func countdown(_ date: Date, size: CGFloat) -> some View {
  Text(date, style: .timer)
    .font(DTFont.display(size))
    .monospacedDigit()
    .foregroundColor(DTNight.skyText)
    .lineLimit(1)
    .minimumScaleFactor(0.7)
    .multilineTextAlignment(.leading)
    .frame(maxWidth: .infinity, alignment: .leading)
}

private struct CityLabel: View {
  let city: String
  var size: CGFloat = 11
  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: "location.fill")
        .font(.system(size: size - 2))
        .foregroundColor(DTNight.skyTextSecondary)
      Text(city)
        .font(DTFont.text(size))
        .foregroundColor(DTNight.skyTextSecondary)
        .lineLimit(1)
    }
  }
}

// Thin apricot progress rule through the current prayer window (the one filled accent element).
private struct ProgressRule: View {
  let window: ClosedRange<Date>?
  let width: CGFloat
  var body: some View {
    if let w = window {
      ProgressView(timerInterval: w, countsDown: false, label: { EmptyView() }, currentValueLabel: { EmptyView() })
        .progressViewStyle(.linear)
        .tint(DTNight.accent)
        .frame(width: width)
        .widgetAccentable()
        .padding(.top, 8)
    } else {
      Color.clear.frame(width: width, height: 3).padding(.top, 8)
    }
  }
}

private struct PrayerRowView: View {
  let p: PrayerTime
  let isNext: Bool
  let isPast: Bool
  let use24Hour: Bool
  let size: CGFloat
  var showArabic: Bool = false
  var body: some View {
    HStack(spacing: 6) {
      Text(p.name).font(DTFont.text(size, weight: isNext ? .semibold : .regular))
      if showArabic, let ar = ARABIC_NAMES[p.name.lowercased()] {
        Text(ar).font(DTFont.text(size - 2)).foregroundColor(DTNight.skyTextSecondary)
      }
      Spacer(minLength: 4)
      Text(timeString(Date(timeIntervalSince1970: p.time), use24Hour))
        .font(DTFont.text(size, weight: isNext ? .semibold : .regular))
        .monospacedDigit()
    }
    .foregroundColor(isPast ? DTNight.skyTextSecondary : DTNight.skyText)
    .opacity(isPast ? 0.62 : 1)
    .padding(.leading, 8)
    .overlay(alignment: .leading) {
      if isNext {
        RoundedRectangle(cornerRadius: 1.5)
          .fill(DTNight.accent)
          .frame(width: 3)
          .widgetAccentable()
      }
    }
  }
}

struct SmallView: View {
  let data: WidgetData
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
    VStack(alignment: .leading, spacing: 0) {
      CityLabel(city: data.city)
      Spacer(minLength: 0)
      if let n = next {
        Text(n.name).font(DTFont.text(13, weight: .medium)).foregroundColor(DTNight.skyText)
        countdown(n.date, size: 34)
        Text("at " + timeString(n.date, data.use24Hour ?? false))
          .font(DTFont.text(12))
          .foregroundColor(DTNight.skyTextSecondary)
      }
      ProgressRule(window: prayerWindow(data, now: now), width: 64)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .skyBackgroundCompat(stage: currentStage(data, now: now))
  }
}

struct MediumView: View {
  let data: WidgetData
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 0) {
        CityLabel(city: data.city)
        Spacer(minLength: 0)
        if let n = next {
          Text(n.name).font(DTFont.text(13, weight: .medium)).foregroundColor(DTNight.skyText)
          countdown(n.date, size: 30)
          Text("at " + timeString(n.date, data.use24Hour ?? false))
            .font(DTFont.text(12))
            .foregroundColor(DTNight.skyTextSecondary)
        }
        ProgressRule(window: prayerWindow(data, now: now), width: 56)
      }
      VStack(alignment: .leading, spacing: 5) {
        ForEach(dayPrayers(data, now: now), id: \.name) { p in
          let isNext = isUpcoming(p, next)
          PrayerRowView(
            p: p,
            isNext: isNext,
            isPast: p.time <= now.timeIntervalSince1970 && !isNext,
            use24Hour: data.use24Hour ?? false,
            size: 13
          )
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .skyBackgroundCompat(stage: currentStage(data, now: now))
  }
}

struct LargeView: View {
  let data: WidgetData
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
    VStack(alignment: .leading, spacing: 0) {
      CityLabel(city: data.city, size: 13)
      Color.clear.frame(height: 14)
      if let n = next {
        Text(n.name).font(DTFont.text(15, weight: .medium)).foregroundColor(DTNight.skyText)
        countdown(n.date, size: 48)
        Text("at " + timeString(n.date, data.use24Hour ?? false))
          .font(DTFont.text(13))
          .foregroundColor(DTNight.skyTextSecondary)
      }
      ProgressRule(window: prayerWindow(data, now: now), width: 96)
      Rectangle().fill(DTNight.skyHairline).frame(height: 0.5).padding(.top, 14).padding(.bottom, 8)
      VStack(alignment: .leading, spacing: 8) {
        ForEach(dayPrayers(data, now: now), id: \.name) { p in
          let isNext = isUpcoming(p, next)
          PrayerRowView(
            p: p,
            isNext: isNext,
            isPast: p.time <= now.timeIntervalSince1970 && !isNext,
            use24Hour: data.use24Hour ?? false,
            size: 15,
            showArabic: true
          )
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .skyBackgroundCompat(stage: currentStage(data, now: now))
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
        Text(next?.name ?? "Athan").font(.system(size: 13, weight: .bold))
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
    if let data = entry.data, nextPrayer(data, now: entry.date) != nil {
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
