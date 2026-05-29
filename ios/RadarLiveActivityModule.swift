import Foundation
import UIKit
import React
import ActivityKit

private struct RadarLiveSnapshot: Decodable {
  let enabled: Bool
  let transactionType: String
  let city: String
  let localityCountry: String?
  let localityCountryCode: String?
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
    var localityCountry: String
    var localityCountryCode: String
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
    var animationTick: Int
    var animationEpochMs: Int64
  }

  var title: String
}

@available(iOS 16.1, *)
private enum RadarLiveActivityStore {
  static var activity: Activity<RadarLiveActivityAttributes>?

  static func endAllRadarActivities() async {
    for activity in Activity<RadarLiveActivityAttributes>.activities {
      await activity.end(dismissalPolicy: .immediate)
    }
    activity = nil
  }
}

/// Odświeża Live Activity co 0,25 s (jak odliczanie Uber) — TimelineView na lock screen
/// nie animuje niezawodnie, więc stan musi się zmieniać z natywnego timera.
@available(iOS 16.1, *)
private final class RadarLiveActivityHeartbeat {
  static let shared = RadarLiveActivityHeartbeat()

  /// 1 Hz — zgodnie z limitem Apple dla Live Activity (jak odliczanie Uber).
  private let tickInterval: TimeInterval = 1.0
  private var timer: DispatchSourceTimer?
  private var baseState: RadarLiveActivityAttributes.ContentState?
  private var currentTick: Int = 0
  private var epochMs: Int64 = 0
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

  private func refreshBackgroundRuntime() {
    if backgroundTask != .invalid {
      UIApplication.shared.endBackgroundTask(backgroundTask)
    }
    backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "RadarLiveActivityHeartbeat") { [weak self] in
      guard let self else { return }
      if self.backgroundTask != .invalid {
        UIApplication.shared.endBackgroundTask(self.backgroundTask)
        self.backgroundTask = .invalid
      }
    }
  }

  func applySnapshot(_ state: RadarLiveActivityAttributes.ContentState, resetEpoch: Bool) {
    if resetEpoch || epochMs == 0 {
      epochMs = Int64(Date().timeIntervalSince1970 * 1000)
      currentTick = 0
    }
    var merged = state
    merged.animationEpochMs = epochMs
    merged.animationTick = currentTick
    baseState = merged
    startTimerIfNeeded()
    Task { await pushState(merged) }
  }

  func stop() {
    timer?.cancel()
    timer = nil
    baseState = nil
    currentTick = 0
    epochMs = 0
    if backgroundTask != .invalid {
      UIApplication.shared.endBackgroundTask(backgroundTask)
      backgroundTask = .invalid
    }
  }

  private func startTimerIfNeeded() {
    guard timer == nil else { return }

    let source = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
    source.schedule(deadline: .now() + tickInterval, repeating: tickInterval)
    source.setEventHandler { [weak self] in
      self?.fireTick()
    }
    source.resume()
    timer = source
  }

  private func pushState(_ state: RadarLiveActivityAttributes.ContentState) async {
    refreshBackgroundRuntime()
    let activity =
      RadarLiveActivityStore.activity
      ?? Activity<RadarLiveActivityAttributes>.activities.first
    guard let activity else { return }
    guard activity.activityState == .active else { return }
    RadarLiveActivityStore.activity = activity
    if #available(iOS 16.2, *) {
      let stale = Date().addingTimeInterval(tickInterval * 2)
      let content = ActivityContent(state: state, staleDate: stale)
      await activity.update(content)
    } else {
      await activity.update(using: state)
    }
  }

  private func fireTick() {
    Task {
      guard var state = baseState else {
        stop()
        return
      }

      let activity =
        RadarLiveActivityStore.activity
        ?? Activity<RadarLiveActivityAttributes>.activities.first

      guard let activity else {
        stop()
        return
      }

      guard activity.activityState == .active else {
        stop()
        return
      }

      RadarLiveActivityStore.activity = activity
      currentTick += 1
      state.animationTick = currentTick
      state.animationEpochMs = epochMs
      state.updatedAtIso = ISO8601DateFormatter().string(from: Date())
      baseState = state
      await pushState(state)
    }
  }
}

/// Serializuje start/update Live Activity — równoległe wywołania z JS powodowały wyścigi i crashy.
@available(iOS 16.1, *)
private actor RadarLiveActivityCoordinator {
  static let shared = RadarLiveActivityCoordinator()

  func upsert(contentState: RadarLiveActivityAttributes.ContentState) async throws -> [String: Any] {
    let systemActivities = Activity<RadarLiveActivityAttributes>.activities
    if systemActivities.count > 1 {
      await RadarLiveActivityStore.endAllRadarActivities()
    }

    var resetEpoch = false

    if let existing = RadarLiveActivityStore.activity ?? systemActivities.first {
      RadarLiveActivityStore.activity = existing
      let state = existing.activityState
      if state == .active {
        for orphan in Activity<RadarLiveActivityAttributes>.activities where orphan.id != existing.id {
          await orphan.end(dismissalPolicy: .immediate)
        }
        RadarLiveActivityHeartbeat.shared.applySnapshot(contentState, resetEpoch: false)
        return ["status": "updated"]
      }

      await existing.end(dismissalPolicy: .immediate)
      RadarLiveActivityStore.activity = nil
      resetEpoch = true
    } else {
      resetEpoch = true
    }

    await RadarLiveActivityStore.endAllRadarActivities()

    let attributes = RadarLiveActivityAttributes(title: "Radar aktywny")
    let activity = try Activity.request(
      attributes: attributes,
      contentState: contentState,
      pushType: nil
    )
    RadarLiveActivityStore.activity = activity
    RadarLiveActivityHeartbeat.shared.applySnapshot(contentState, resetEpoch: resetEpoch)
    return ["status": "started", "id": activity.id]
  }

  func stopAll() async {
    RadarLiveActivityHeartbeat.shared.stop()
    await RadarLiveActivityStore.endAllRadarActivities()
  }
}

@objc(RadarLiveActivityModule)
final class RadarLiveActivityModule: NSObject {

  private var upsertTask: Task<Void, Never>?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
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
      DispatchQueue.main.async { resolve(["status": "unsupported"]) }
      return
    }

    upsertTask?.cancel()
    upsertTask = Task {
      await RadarLiveActivityCoordinator.shared.stopAll()
      DispatchQueue.main.async { resolve(["status": "stopped"]) }
    }
  }

  private func upsert(
    snapshotJson: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let data = snapshotJson.data(using: .utf8) else {
      DispatchQueue.main.async { reject("bad_input", "Invalid UTF8", nil) }
      return
    }

    let snapshot: RadarLiveSnapshot
    do {
      snapshot = try JSONDecoder().decode(RadarLiveSnapshot.self, from: data)
    } catch {
      DispatchQueue.main.async { reject("decode_failed", "Cannot decode snapshot", error) }
      return
    }

    if !snapshot.enabled {
      stopMonitoring(resolve, rejecter: reject)
      return
    }

    guard #available(iOS 16.1, *) else {
      DispatchQueue.main.async { resolve(["status": "unsupported"]) }
      return
    }

    let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
    let contentState = RadarLiveActivityAttributes.ContentState(
      transactionType: snapshot.transactionType,
      city: snapshot.city,
      localityCountry: snapshot.localityCountry ?? "Polska",
      localityCountryCode: snapshot.localityCountryCode ?? "PL",
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
      updatedAtIso: snapshot.updatedAtIso,
      animationTick: 0,
      animationEpochMs: nowMs
    )

    upsertTask?.cancel()
    upsertTask = Task {
      do {
        let result = try await RadarLiveActivityCoordinator.shared.upsert(contentState: contentState)
        DispatchQueue.main.async { resolve(result) }
      } catch {
        NSLog("[RadarLiveActivity] upsert failed: \(error.localizedDescription)")
        DispatchQueue.main.async { reject("activity_failed", "Cannot start activity", error) }
      }
    }
  }
}
