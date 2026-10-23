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
  // Every stored time is in the past, the data is stale (app not opened in days).
  // Return nil rather than the first (oldest) entry: a passed time would make the
  // `.timer` countdown count *up*, e.g. "Fajr in 56:00:00". The view shows an
  // "Open AthanNow" prompt instead so it never displays a bogus countdown.
  return nil
}

// MARK: - Sky stage

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
// was written, so a few days later the hero countdown advanced correctly while the
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

// Which illustrated sky to show: the prayer period we're in, or "night" between midnight and Fajr.
func scenePeriod(_ data: WidgetData, now: Date) -> String {
  let stage = currentStage(data, now: now)
  guard stage == "isha" else { return stage }
  let day = dayPrayers(data, now: now)
  if let first = day.first, now.timeIntervalSince1970 < first.time { return "night" }
  if let isha = day.last(where: { $0.name.lowercased() == "isha" }), isha.time <= now.timeIntervalSince1970,
     !Calendar.current.isDate(Date(timeIntervalSince1970: isha.time), inSameDayAs: now) {
    return "night"
  }
  return "isha"
}

// The sky band sits at the top of the widget and the rest is ink, like Home: text lives on the ink,
// never over the illustration (only the small city label sits in the sky's empty upper area).
struct SceneBackground: View {
  let period: String
  let band: CGFloat
  var body: some View {
    VStack(spacing: 0) {
      SkySceneView(period: period).frame(height: band)
      SKY_INK
    }
    .background(SKY_INK)
  }
}

extension View {
  @ViewBuilder
  func sceneBackground(period: String, band: CGFloat) -> some View {
    if #available(iOS 17.0, *) {
      // iOS 17+ insets content by the system margin; the background stays full-bleed.
      self.containerBackground(for: .widget) { SceneBackground(period: period, band: band) }
    } else {
      self.padding(16).background(SceneBackground(period: period, band: band))
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
    // advances exactly when each athan passes, without depending on iOS issuing a
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
// Next prayer's countdown is the hero; in the list the next prayer is bold with its time in apricot, passed prayers are
// dimmed, and apricot appears only on the progress rule and that time.
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
      Text("Open AthanNow to load prayer times.")
        .font(DTFont.text(12))
        .foregroundColor(DTNight.skyTextSecondary)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        .sceneBackground(period: "night", band: 70)
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
    Text(city)
      .font(DTFont.text(size, weight: .medium))
      .foregroundColor(DTNight.skyText)
      .lineLimit(1)
  }
}

// Thin apricot progress rule through the current prayer window (the one filled accent element).
private struct ProgressRule: View {
  let window: ClosedRange<Date>?
  var body: some View {
    if let w = window {
      ProgressView(timerInterval: w, countsDown: false, label: { EmptyView() }, currentValueLabel: { EmptyView() })
        .progressViewStyle(.linear)
        .tint(DTNight.accent)
        .widgetAccentable()
        .padding(.top, 6)
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
        .foregroundColor(isNext ? DTNight.accent : (isPast ? DTNight.skyTextSecondary : DTNight.skyText))
        .widgetAccentable(isNext)
    }
    .foregroundColor(isPast ? DTNight.skyTextSecondary : DTNight.skyText)
    .opacity(isPast ? 0.62 : 1)
  }
}

struct SmallView: View {
  let data: WidgetData
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
    VStack(alignment: .leading, spacing: 0) {
      CityLabel(city: data.city, size: 12)
      Spacer(minLength: 0)
      if let n = next {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(n.name).font(DTFont.text(13, weight: .semibold))
          Text("at " + timeString(n.date, data.use24Hour ?? false)).font(DTFont.text(11)).foregroundColor(DTNight.skyTextSecondary)
        }
        .foregroundColor(DTNight.skyText)
        .lineLimit(1)
        countdown(n.date, size: 30)
      }
      ProgressRule(window: prayerWindow(data, now: now))
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .sceneBackground(period: scenePeriod(data, now: now), band: 74)
  }
}

struct MediumView: View {
  let data: WidgetData
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
    VStack(alignment: .leading, spacing: 0) {
      CityLabel(city: data.city, size: 12)
      Spacer(minLength: 0)
      if let n = next {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text(n.name).font(DTFont.text(13, weight: .semibold)).foregroundColor(DTNight.skyText)
          Text(n.date, style: .timer)
            .font(DTFont.display(22))
            .monospacedDigit()
            .foregroundColor(DTNight.skyText)
            .lineLimit(1)
          Spacer(minLength: 0)
        }
      }
      HStack(alignment: .top, spacing: 0) {
        ForEach(dayPrayers(data, now: now), id: \.name) { p in
          let isNext = isUpcoming(p, next)
          let isPast = p.time <= now.timeIntervalSince1970 && !isNext
          VStack(alignment: .leading, spacing: 1) {
            Text(p.name).font(DTFont.text(10)).foregroundColor(DTNight.skyTextSecondary)
            Text(shortTime(Date(timeIntervalSince1970: p.time), data.use24Hour ?? false))
              .font(DTFont.text(13, weight: isNext ? .semibold : .regular))
              .monospacedDigit()
              .foregroundColor(isNext ? DTNight.accent : DTNight.skyText)
              .widgetAccentable(isNext)
          }
          .opacity(isPast ? 0.55 : 1)
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
      .padding(.top, 8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .sceneBackground(period: scenePeriod(data, now: now), band: 72)
  }
}

struct LargeView: View {
  let data: WidgetData
  let now: Date
  var body: some View {
    let next = nextPrayer(data, now: now)
    let rows = Array(dayPrayers(data, now: now))
    VStack(alignment: .leading, spacing: 0) {
      CityLabel(city: data.city, size: 13)
      Spacer(minLength: 0)
      if let n = next {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(n.name).font(DTFont.text(15, weight: .semibold))
          Text("at " + timeString(n.date, data.use24Hour ?? false)).font(DTFont.text(13)).foregroundColor(DTNight.skyTextSecondary)
        }
        .foregroundColor(DTNight.skyText)
        countdown(n.date, size: 44)
      }
      ProgressRule(window: prayerWindow(data, now: now))
      VStack(alignment: .leading, spacing: 0) {
        ForEach(rows.indices, id: \.self) { i in
          let p = rows[i]
          let isNext = isUpcoming(p, next)
          PrayerRowView(
            p: p,
            isNext: isNext,
            isPast: p.time <= now.timeIntervalSince1970 && !isNext,
            use24Hour: data.use24Hour ?? false,
            size: 14,
            showArabic: true
          )
          .frame(height: 22)
          .overlay(alignment: .top) {
            if i > 0 { Rectangle().fill(DTNight.skyHairline).frame(height: 0.5) }
          }
        }
      }
      .padding(.top, 12)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .sceneBackground(period: scenePeriod(data, now: now), band: 118)
  }
}

// MARK: - Lock-screen (accessory) views
//
// Lock-screen widgets render monochrome/vibrant, so gradients and custom colors
// are ignored, the system tints everything. We keep these to crisp text and an
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
        Text(next?.name ?? "--")
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
        Text("at " + timeString(n.date, data.use24Hour ?? false))
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

// MARK: - Xcode canvas previews (DEBUG only, stripped from release builds)
//
// Open this file in Xcode (after `npx expo prebuild`) and use the canvas (⌥⌘↵)
// to see every size, including the lock-screen accessory widgets, with sample
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
      CircularView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryCircular)).previewDisplayName("Lock, Circular")
      RectangularView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryRectangular)).previewDisplayName("Lock, Rectangular")
      PrayerGroupRectangularView(data: SAMPLE, ids: MORNING_IDS, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryRectangular)).previewDisplayName("Lock, 1/2 Prayers")
      PrayerGroupRectangularView(data: SAMPLE, ids: EVENING_IDS, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryRectangular)).previewDisplayName("Lock, 2/2 Prayers")
      InlineView(data: SAMPLE, now: Date()).previewContext(WidgetPreviewContext(family: .accessoryInline)).previewDisplayName("Lock, Inline")
    }
  }
}
#endif
