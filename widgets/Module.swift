import ExpoModulesCore

// Required by react-native-widget-extension. AthanNow uses a home-screen widget
// (not Live Activities), so these are minimal stubs that compile as the Expo module.
public class ReactNativeWidgetExtensionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReactNativeWidgetExtension")

    Function("areActivitiesEnabled") { () -> Bool in
      false
    }

    Function("startActivity") { () -> String in
      ""
    }

    Function("updateActivity") { () -> Void in
    }

    Function("endActivity") { () -> Void in
    }
  }
}
