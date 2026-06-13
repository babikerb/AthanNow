import WidgetKit
import SwiftUI

// MARK: - Shared data (written by the app to the App Group)

private let APP_GROUP = "group.com.bbabiker.AthanNow"
private let DATA_KEY = "athannow_widget"
private let ACCENT = Color(red: 0x96 / 255, green: 0x69 / 255, blue: 0xb8 / 255)

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

struct SkyBackground: View {
  let stage: String
  var body: some View {
    let hexes = GRADIENTS[stage] ?? GRADIENTS["isha"]!
    LinearGradient(
      colors: hexes.map { Color(hex: $0) },
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
      .skyBackgroundCompat(stage: "isha")
    }
  }
}

private func timeString(_ date: Date, _ use24Hour: Bool) -> String {
  let f = DateFormatter()
  f.dateFormat = use24Hour ? "HH:mm" : "h:mm a"
  return f.string(from: date)
}

// Accent reads as a light lavender on the dark gradients.
private let ACCENT_ON_SKY = Color(red: 0xc9 / 255, green: 0xb0 / 255, blue: 0xdd / 255)

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
      Text(next?.name.uppercased() ?? "").font(.system(size: 13, weight: .semibold)).foregroundColor(ACCENT_ON_SKY)
      if let n = next {
        Text(n.date, style: .timer).font(.system(size: 22, weight: .bold)).monospacedDigit().foregroundColor(.white).lineLimit(1)
        Text(timeString(n.date, data.use24Hour ?? false)).font(.system(size: 11)).foregroundColor(.white.opacity(0.7))
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .skyBackgroundCompat(stage: currentStage(data, now: Date()))
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
        Text(next?.name.uppercased() ?? "").font(.system(size: 13, weight: .semibold)).foregroundColor(ACCENT_ON_SKY)
        if let n = next {
          Text(n.date, style: .timer).font(.system(size: 24, weight: .bold)).monospacedDigit().foregroundColor(.white).lineLimit(1)
          Text("until " + timeString(n.date, data.use24Hour ?? false)).font(.system(size: 11)).foregroundColor(.white.opacity(0.7))
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
          .foregroundColor(isNext ? ACCENT_ON_SKY : .white.opacity(0.85))
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .skyBackgroundCompat(stage: currentStage(data, now: Date()))
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
      Text(next?.name.uppercased() ?? "").font(.system(size: 15, weight: .semibold)).foregroundColor(ACCENT_ON_SKY)
      if let n = next {
        Text(n.date, style: .timer).font(.system(size: 44, weight: .bold)).monospacedDigit().foregroundColor(.white).lineLimit(1)
        Text("until " + timeString(n.date, data.use24Hour ?? false)).font(.system(size: 12)).foregroundColor(.white.opacity(0.7))
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
          .foregroundColor(isNext ? ACCENT_ON_SKY : .white.opacity(isPast ? 0.4 : 0.9))
          .padding(.vertical, 6)
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
  var body: some View {
    let next = nextPrayer(data, now: Date())
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 1) {
        Text(next?.name.prefix(3).uppercased() ?? "—")
          .font(.system(size: 11, weight: .semibold))
          .widgetAccentable()
        if let n = next {
          Text(timeString(n.date, data.use24Hour ?? false))
            .font(.system(size: 13, weight: .bold))
            .monospacedDigit()
            .minimumScaleFactor(0.6)
            .lineLimit(1)
        }
      }
      .padding(3)
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
  func skyBackgroundCompat(stage: String) -> some View {
    // A soft drop shadow on all text keeps it readable over any stage's gradient.
    let shadowed = self.shadow(color: .black.opacity(0.45), radius: 1.5, x: 0, y: 1)
    if #available(iOS 17.0, *) {
      shadowed.padding(16).containerBackground(for: .widget) { SkyBackground(stage: stage) }
    } else {
      shadowed.padding(16).background(SkyBackground(stage: stage))
    }
  }
}

// MARK: - Widget

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

@main
struct AthanWidgetBundle: WidgetBundle {
  var body: some Widget {
    AthanWidget()
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
      InlineView(data: SAMPLE).previewContext(WidgetPreviewContext(family: .accessoryInline)).previewDisplayName("Lock · Inline")
    }
  }
}
#endif
