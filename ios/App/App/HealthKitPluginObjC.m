// Objective-C bridging file for the HealthKit Capacitor plugin.
//
// Capacitor discovers native plugins via the CAP_PLUGIN macro, which registers
// the plugin class under a name that the JS runtime calls. The HealthKitPlugin
// Swift class is annotated @objc(HealthKitPlugin) so it's visible to Obj-C;
// this file wires it into Capacitor's plugin registry.

#import <Capacitor/Capacitor.h>

// Define the plugin using the Capacitor macro. The name "HealthKit" must match
// the string passed to registerPlugin() in the TypeScript layer.
CAP_PLUGIN(HealthKitPlugin, "HealthKit",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getAuthorizationStatus, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(fetchWorkouts, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(fetchSteps, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(fetchDistanceWalkingRunning, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(fetchDistanceCycling, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(fetchSleep, CAPPluginReturnPromise);
)
