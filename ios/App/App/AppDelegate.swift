import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Register the HealthKit custom Capacitor plugin.
        // Capacitor auto-discovers @objc classes that subclass CAPPlugin,
        // so explicit registration is handled by the plugin's CAP_PLUGIN macro
        // in the generated Objective-C bridging file.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state.
        // This can occur for certain types of temporary interruptions or when
        // the user quits the application and it begins the transition to the background.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused while the application was inactive.
    }
}
