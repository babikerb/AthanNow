import ExpoModulesCore
import MediaPlayer

/// The lock screen and Control Center player, for the Quran tab. The app plays surahs as joined
/// tracks, so what iOS should show (one ayah, its title and its own time) isn't the audio player's
/// item: this module owns the now playing info and every remote command, and expo-audio's lock
/// screen support stays switched off, since it rewrites the info from the player on each status.
public class LockScreenTrackControlsModule: Module {
  private var isEnabled = false

  public func definition() -> ModuleDefinition {
    Name("LockScreenTrackControls")

    Events("onNextTrack", "onPreviousTrack", "onPlay", "onPause", "onToggle", "onSeek")

    Function("enable") { [weak self] in
      self?.performOnMain { self?.enableOnMain() }
    }

    Function("disable") { [weak self] in
      self?.performOnMain { self?.disableOnMain() }
    }

    Function("setNowPlaying") { [weak self] (info: [String: Any]) in
      self?.performOnMain { self?.setNowPlayingOnMain(info) }
    }

    Function("clearNowPlaying") { [weak self] in
      self?.performOnMain { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil }
    }

    OnDestroy { [weak self] in
      self?.disableOnMain()
    }
  }

  private func performOnMain(_ block: @escaping () -> Void) {
    if Thread.isMainThread {
      block()
    } else {
      DispatchQueue.main.async(execute: block)
    }
  }

  private func setNowPlayingOnMain(_ info: [String: Any]) {
    func number(_ key: String) -> Double {
      (info[key] as? NSNumber)?.doubleValue ?? 0
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = [
      MPMediaItemPropertyTitle: info["title"] as? String ?? "",
      MPMediaItemPropertyArtist: info["artist"] as? String ?? "",
      MPMediaItemPropertyAlbumTitle: info["album"] as? String ?? "",
      MPMediaItemPropertyPlaybackDuration: number("duration"),
      MPNowPlayingInfoPropertyElapsedPlaybackTime: number("elapsed"),
      // iOS advances the bar itself from this, so nothing needs sending while an ayah plays.
      MPNowPlayingInfoPropertyPlaybackRate: number("rate"),
      MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue
    ]
  }

  // Idempotent: a second call can never register a second target and fire each press twice.
  private func enableOnMain() {
    guard !isEnabled else { return }
    isEnabled = true

    let center = MPRemoteCommandCenter.shared()
    let commands: [(MPRemoteCommand, String)] = [
      (center.nextTrackCommand, "onNextTrack"),
      (center.previousTrackCommand, "onPreviousTrack"),
      (center.playCommand, "onPlay"),
      (center.pauseCommand, "onPause"),
      (center.togglePlayPauseCommand, "onToggle")
    ]
    for (command, event) in commands {
      command.isEnabled = true
      command.addTarget { [weak self] _ in
        self?.sendEvent(event)
        return .success
      }
    }

    center.changePlaybackPositionCommand.isEnabled = true
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else {
        return .commandFailed
      }
      self?.sendEvent("onSeek", ["position": event.positionTime])
      return .success
    }
  }

  private func disableOnMain() {
    guard isEnabled else { return }
    isEnabled = false

    let center = MPRemoteCommandCenter.shared()
    let commands: [MPRemoteCommand] = [
      center.nextTrackCommand,
      center.previousTrackCommand,
      center.playCommand,
      center.pauseCommand,
      center.togglePlayPauseCommand,
      center.changePlaybackPositionCommand
    ]
    for command in commands {
      command.isEnabled = false
      command.removeTarget(nil)
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }
}
