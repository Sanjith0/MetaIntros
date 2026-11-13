import AVFAudio
import ExpoModulesCore

/// Meta glasses camera for the Glance page embedded in Link (app/glance-embed.tsx).
/// The page asks for it through the camera shim (src/qu/glassesShim.ts); frames come back as onFrame events.
public final class GlanceGlassesModule: Module {
  private var routeObserver: NSObjectProtocol?

  @MainActor private static var shared: GlassesCamera?
  @MainActor static func camera() -> GlassesCamera {
    if let shared { return shared }
    let made = GlassesCamera()
    shared = made
    return made
  }

  public func definition() -> ModuleDefinition {
    Name("GlanceGlasses")
    Events("onFrame", "onFailure", "onPause", "onState")

    OnCreate {
      Task { @MainActor in
        GlanceGlassesModule.camera().onChange = { [weak self] in self?.sendState() }
      }
      // The glasses are also a Bluetooth headset. When the page records, iOS may move the microphone to them,
      // which switches the glasses into call audio while they stream video. Keep the iPhone microphone.
      routeObserver = NotificationCenter.default.addObserver(
        forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
      ) { _ in GlanceGlassesModule.preferBuiltInMicrophone() }
    }

    OnDestroy {
      if let routeObserver { NotificationCenter.default.removeObserver(routeObserver) }
      Task { @MainActor in GlanceGlassesModule.camera().stop() }
    }

    // Called from the JS thread: read the last snapshot, never touch the main-actor camera here.
    Function("getState") { () -> [String: Any] in
      GlanceGlassesModule.snapshot()
    }

    AsyncFunction("refresh") { () async -> [String: Any] in
      await MainActor.run { GlanceGlassesModule.camera().refresh() }
      try? await Task.sleep(nanoseconds: 300_000_000)
      return await MainActor.run { GlanceGlassesModule.state() }
    }

    AsyncFunction("register") { () async in
      await GlanceGlassesModule.camera().register()
    }

    AsyncFunction("allowCamera") { () async in
      await GlanceGlassesModule.camera().allowCamera()
    }

    AsyncFunction("handleURL") { (url: String) async in
      guard let parsed = URL(string: url) else { return }
      await GlanceGlassesModule.camera().handleURL(parsed)
    }

    AsyncFunction("start") { () async in
      let camera = await MainActor.run { GlanceGlassesModule.camera() }
      await camera.start(
        onFrame: { [weak self] base64 in self?.sendEvent("onFrame", ["data": base64]) },
        onFailure: { [weak self] message in self?.sendEvent("onFailure", ["message": message]) },
        onPause: { [weak self] paused in self?.sendEvent("onPause", ["paused": paused]) })
    }

    Function("stop") {
      Task { @MainActor in GlanceGlassesModule.camera().stop() }
    }
  }

  private static let lock = NSLock()
  nonisolated(unsafe) private static var last: [String: Any] = [
    "configured": false, "registered": false, "cameraAllowed": false, "streaming": false,
    "status": "Tap Connect Meta AI to set up your glasses.",
  ]
  static func snapshot() -> [String: Any] { lock.lock(); defer { lock.unlock() }; return last }

  @MainActor private static func state() -> [String: Any] {
    let camera = GlanceGlassesModule.camera()
    let value: [String: Any] = ["configured": camera.configured, "registered": camera.registered,
                                "cameraAllowed": camera.cameraAllowed, "streaming": camera.streaming, "status": camera.status]
    lock.lock(); last = value; lock.unlock()
    return value
  }

  private func sendState() {
    Task { @MainActor [weak self] in self?.sendEvent("onState", GlanceGlassesModule.state()) }
  }

  /// Best effort: record from the built-in microphone whenever a Bluetooth hands-free input took over.
  static func preferBuiltInMicrophone() {
    let session = AVAudioSession.sharedInstance()
    guard session.currentRoute.inputs.contains(where: { $0.portType == .bluetoothHFP }),
          let builtIn = session.availableInputs?.first(where: { $0.portType == .builtInMic }) else { return }
    try? session.setPreferredInput(builtIn)
  }
}

/// Meta AI returns to Link through link-glasses:// after registration and permission prompts.
public final class GlanceGlassesAppDelegate: ExpoAppDelegateSubscriber {
  public func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    guard url.scheme == "link-glasses" else { return false }
    Task { @MainActor in await GlanceGlassesModule.camera().handleURL(url) }
    return true
  }
}
