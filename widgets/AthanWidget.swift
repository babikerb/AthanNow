import WidgetKit
import SwiftUI

// MARK: - Shared data (written by the app to the App Group)

private let APP_GROUP = "group.com.bbabiker.AthanNow"
private let DATA_KEY = "athannow_widget"
private let ACCENT = Color(red: 0x86 / 255, green: 0x60 / 255, blue: 0x99 / 255)

struct PrayerTime: Codable {
  let name: String
  let time: Double // epoch seconds
}

struct WidgetData: Codable {
  let city: String
  let times: [PrayerTime]
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
    let entry = AthanEntry(date: Date(), data: loadWidgetData())
    let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
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
      case .systemMedium: MediumView(data: data)
      default: SmallView(data: data)
      }
    } else {
      VStack(spacing: 4) {
        Image(systemName: "moon.stars.fill").foregroundColor(ACCENT)
        Text("Open AthanNow").font(.caption).foregroundColor(.secondary)
      }
    }
  }
}

private func timeString(_ date: Date) -> String {
  let f = DateFormatter()
  f.dateFormat = "h:mm a"
  return f.string(from: date)
}

struct SmallView: View {
  let data: WidgetData
  var body: some View {
    let next = nextPrayer(data, now: Date())
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 4) {
        Image(systemName: "location.fill").font(.system(size: 9)).foregroundColor(.secondary)
        Text(data.city).font(.system(size: 11)).foregroundColor(.secondary).lineLimit(1)
      }
      Spacer()
      Text(next?.name.uppercased() ?? "").font(.system(size: 13, weight: .semibold)).foregroundColor(ACCENT)
      if let n = next {
        Text(n.date, style: .timer).font(.system(size: 22, weight: .bold)).monospacedDigit().lineLimit(1)
        Text(timeString(n.date)).font(.system(size: 11)).foregroundColor(.secondary)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetBackgroundCompat()
  }
}

struct MediumView: View {
  let data: WidgetData
  var body: some View {
    let next = nextPrayer(data, now: Date())
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 2) {
        Text(data.city).font(.system(size: 11)).foregroundColor(.secondary).lineLimit(1)
        Spacer()
        Text(next?.name.uppercased() ?? "").font(.system(size: 13, weight: .semibold)).foregroundColor(ACCENT)
        if let n = next {
          Text(n.date, style: .timer).font(.system(size: 24, weight: .bold)).monospacedDigit().lineLimit(1)
          Text("until " + timeString(n.date)).font(.system(size: 11)).foregroundColor(.secondary)
        }
      }
      VStack(alignment: .leading, spacing: 5) {
        ForEach(data.times.prefix(5), id: \.name) { p in
          let isNext = p.name == next?.name
          HStack {
            Text(p.name).font(.system(size: 12, weight: isNext ? .bold : .regular))
            Spacer()
            Text(timeString(Date(timeIntervalSince1970: p.time)))
              .font(.system(size: 12, weight: isNext ? .bold : .regular)).monospacedDigit()
          }
          .foregroundColor(isNext ? ACCENT : .primary)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetBackgroundCompat()
  }
}

// iOS 17 requires a container background; older versions just use padding.
extension View {
  @ViewBuilder
  func widgetBackgroundCompat() -> some View {
    if #available(iOS 17.0, *) {
      self.padding(14).containerBackground(for: .widget) { Color(.systemBackground) }
    } else {
      self.padding(14)
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
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct AthanWidgetBundle: WidgetBundle {
  var body: some Widget {
    AthanWidget()
  }
}
