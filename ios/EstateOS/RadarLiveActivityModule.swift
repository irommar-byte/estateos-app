import Foundation
import React
import ActivityKit

private struct RadarLiveSnapshot: Decodable {
  let enabled: Bool
  let transactionType: String
  let city: String
  let minMatchThreshold: Int
  let activeMatchesCount: Int
  let updatedAtIso: String
}

@available(iOS 16.1, *)
struct RadarLiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var transactionType: String
    var city: String
    var minMatchThreshold: Int
    var activeMatchesCount: Int
    var updatedAtIso: String
  }

  var title: String
}

@available(iOS 16.1, *)
private enum RadarLiveActivityStore {
  static var activity: Activity<RadarLiveActivityAttributes>?
}

@objc(RadarLiveActivityModule)
final class RadarLiveActivityModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(startMonitoring:resolver:rejecter:)
  func startMonitoring(
    _ snapshotJson: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    upsert(snapshotJson: snapshotJson, resolver: resolve, rejecter: reject)
  }

  @objc(updateMonitoring:resolver:rejecter:)
  func updateMonitoring(
    _ snapshotJson: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    upsert(snapshotJson: snapshotJson, resolver: resolve, rejecter: reject)
  }

  @objc(stopMonitoring:rejecter:)
  func stopMonitoring(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(["status": "unsupported"])
      return
    }

    Task {
      if let activity = RadarLiveActivityStore.activity {
        await activity.end(dismissalPolicy: .immediate)
        RadarLiveActivityStore.activity = nil
      }
      resolve(["status": "stopped"])
    }
  }

  private func upsert(
    snapshotJson: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let data = snapshotJson.data(using: .utf8) else {
      reject("radar_live_activity_bad_input", "Snapshot is not valid UTF-8", nil)
      return
    }

    let decoder = JSONDecoder()
    let snapshot: RadarLiveSnapshot
    do {
      snapshot = try decoder.decode(RadarLiveSnapshot.self, from: data)
    } catch {
      reject("radar_live_activity_bad_payload", "Failed to decode radar live payload", error)
      return
    }

    if !snapshot.enabled {
      stopMonitoring(resolve, rejecter: reject)
      return
    }

    guard #available(iOS 16.1, *) else {
      resolve(["status": "unsupported"])
      return
    }

    Task {
      do {
        let nextState = RadarLiveActivityAttributes.ContentState(
          transactionType: snapshot.transactionType,
          city: snapshot.city,
          minMatchThreshold: snapshot.minMatchThreshold,
          activeMatchesCount: snapshot.activeMatchesCount,
          updatedAtIso: snapshot.updatedAtIso
        )

        if let activity = RadarLiveActivityStore.activity {
          await activity.update(using: nextState)
          resolve(["status": "updated"])
          return
        }

        let attributes = RadarLiveActivityAttributes(title: "Radar aktywny")
        let activity = try Activity.request(
          attributes: attributes,
          contentState: nextState,
          pushType: nil
        )
        RadarLiveActivityStore.activity = activity
        resolve(["status": "started"])
      } catch {
        reject("radar_live_activity_failed", "Unable to start or update Live Activity", error)
      }
    }
  }
}
