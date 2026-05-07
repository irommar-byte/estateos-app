#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(RadarLiveActivityModule, NSObject)

RCT_EXTERN_METHOD(
  startMonitoring:(NSString *)snapshotJson
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  updateMonitoring:(NSString *)snapshotJson
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  stopMonitoring:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
