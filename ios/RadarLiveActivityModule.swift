import Foundation
import React
import ActivityKit

private struct RadarLiveSnapshot: Decodable {
  let enabled: Bool
  let transactionType: String
  let city: String
  let districts: [String]?
  let propertyType: String?
  let maxPrice: Double?
  let minArea: Double?
  let minYear: Double?
  let areaRadiusKm: Double?
  let minMatchThreshold: Int
  let activeMatchesCount: Int
  let newMatchesCount: Int?
  let unreadDealroomMessagesCount: Int
  let requireBalcony: Bool?
  let requireGarden: Bool?
  let requireElevator: Bool?
  let requireParking: Bool?
  let requireFurnished: Bool?
  let updatedAtIso: String
}

@available(iOS 16.1, *)
struct RadarLiveActivityAttributes: ActivityAttributes {

  public struct ContentState: Codable, Hashable {
    var transactionType: String
    var city: String
    var districts: [String]
    var propertyType: String
    var maxPrice: Double
    var minArea: Double
    var minYear: Double
    var areaRadiusKm: Double
    var minMatchThreshold: Int
    var activeMatchesCount: Int
    var newMatchesCount: Int
    var unreadDealroomMessagesCount: Int
    var requireBalcony: Bool
    var requireGarden: Bool
    var requireElevator: Bool
    var requireParking: Bool
    var requireFurnished: Bool
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
      reject("bad_input", "Invalid UTF8", nil)
      return
    }

    let snapshot: RadarLiveSnapshot

    do {
      snapshot = try JSONDecoder().decode(RadarLiveSnapshot.self, from: data)
    } catch {
      reject("decode_failed", "Cannot decode snapshot", error)
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

        let contentState = RadarLiveActivityAttributes.ContentState(
          transactionType: snapshot.transactionType,
          city: snapshot.city,
          districts: snapshot.districts ?? [],
          propertyType: snapshot.propertyType ?? "ALL",
          maxPrice: snapshot.maxPrice ?? 0,
          minArea: snapshot.minArea ?? 0,
          minYear: snapshot.minYear ?? 0,
          areaRadiusKm: snapshot.areaRadiusKm ?? 0,
          minMatchThreshold: snapshot.minMatchThreshold,
          activeMatchesCount: snapshot.activeMatchesCount,
          newMatchesCount: snapshot.newMatchesCount ?? 0,
          unreadDealroomMessagesCount: snapshot.unreadDealroomMessagesCount,
          requireBalcony: snapshot.requireBalcony ?? false,
          requireGarden: snapshot.requireGarden ?? false,
          requireElevator: snapshot.requireElevator ?? false,
          requireParking: snapshot.requireParking ?? false,
          requireFurnished: snapshot.requireFurnished ?? false,
          updatedAtIso: snapshot.updatedAtIso
        )

        // Jeśli mamy zapamiętaną Activity, ale jej stan jest .dismissed/.ended,
        // traktujemy ją jak nieobecną — inaczej `update(using:)` poszedłby do trupa.
        if let existing = RadarLiveActivityStore.activity {
          let state = existing.activityState
          if state == .active {
            await existing.update(using: contentState)
            resolve(["status": "updated"])
            return
          } else {
            NSLog("[RadarLiveActivity] Istniejąca Activity jest \(state) — startuję świeżą.")
            await existing.end(dismissalPolicy: .immediate)
            RadarLiveActivityStore.activity = nil
          }
        }

        let attributes = RadarLiveActivityAttributes(
          title: "Radar aktywny"
        )

        let activity = try Activity.request(
          attributes: attributes,
          contentState: contentState,
          pushType: nil
        )

        RadarLiveActivityStore.activity = activity

        resolve([
          "status": "started",
          "id": activity.id
        ])

      } catch {
        NSLog("[RadarLiveActivity] Activity.request/update failed: \(error.localizedDescription)")
        reject("activity_failed", "Cannot start activity", error)
      }
    }
  }
}
