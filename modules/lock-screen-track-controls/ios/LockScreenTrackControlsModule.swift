import ExpoModulesCore
import MediaPlayer

/// Adds "next track" / "previous track" remote commands to the lock screen
/// and Control Center — the two commands expo-audio's own MediaController
/// deliberately doesn't manage (it only wires play/pause/toggle/seek, since
/// its player always holds exactly one item, not a queue). Both commands
/// live on the same shared `MPRemoteCommandCenter` singleton expo-audio
/// already uses, so this coexists with it rather than replacing anything —
/// each module only touches the specific command properties it owns.
public class LockScreenTrackControlsModule: Module {
  private var isEnabled = false

  public func definition() -> ModuleDefinition {
    Name("LockScreenTrackControls")

    Events("onNextTrack", "onPreviousTrack")

    Function("enable") { [weak self] in
      self?.performOnMain { self?.enableOnMain() }
    }

    Function("disable") { [weak self] in
      self?.performOnMain { self?.disableOnMain() }
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

  // Idempotent — enable() commonly gets called once per app lifetime (see
  // the JS side), but guarding here means a second call can never register
  // a second target and start firing each press twice.
  private func enableOnMain() {
    guard !isEnabled else { return }
    isEnabled = true

    let center = MPRemoteCommandCenter.shared()

    center.nextTrackCommand.isEnabled = true
    center.nextTrackCommand.addTarget { [weak self] _ in
      self?.sendEvent("onNextTrack")
      return .success
    }

    center.previousTrackCommand.isEnabled = true
    center.previousTrackCommand.addTarget { [weak self] _ in
      self?.sendEvent("onPreviousTrack")
      return .success
    }
  }

  private func disableOnMain() {
    guard isEnabled else { return }
    isEnabled = false

    let center = MPRemoteCommandCenter.shared()
    center.nextTrackCommand.isEnabled = false
    center.nextTrackCommand.removeTarget(nil)
    center.previousTrackCommand.isEnabled = false
    center.previousTrackCommand.removeTarget(nil)
  }
}
