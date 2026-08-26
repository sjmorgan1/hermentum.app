import Foundation
import Capacitor

// Capacitor plugin registration for HealthKit.
@objc(HealthKitPlugin)
public class HealthKitPluginRegistration: NSObject {
    public static func register() {
        // The actual plugin class is HealthKitPlugin (defined in HealthKitPlugin.swift).
        // Capacitor discovers @objc classes that conform to CAPPlugin.
    }
}
