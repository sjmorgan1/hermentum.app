import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hermentum.app",
  appName: "Hermentum",
  webDir: "dist",
  ios: {
    contentInset: "always",
    backgroundColor: "#FAF8F5",
  scrollEnabled: false,
  limitsNavigationsToAppBoundDomains: true,
  preferredContentMode: "mobile",
  // HealthKit usage description shown in the iOS permission dialog.
    // Required by Apple: explains *why* Hermentum needs Health data.
    infoPlist: {
      NSHealthShareUsageDescription:
        "Hermentum reads the workouts, walks, runs, cycling and sleep your phone or Apple Watch already records, so they can become part of your private record automatically. Hermentum does not read your location, heart rate, or any other health detail.",
      UIRequiresFullScreen: false,
      UIStatusBarStyle: "UIStatusBarStyleDefault",
    },
  },
  plugins: {
    HealthKit: {
      // READ access only. No write types are ever requested.
      readTypes: [
        "HKWorkoutType",
        "HKQuantityTypeIdentifierStepCount",
        "HKQuantityTypeIdentifierDistanceWalkingRunning",
        "HKQuantityTypeIdentifierDistanceCycling",
        "HKCategoryTypeIdentifierSleepAnalysis",
      ],
      writeTypes: [],
    },
  },
};

export default config;
