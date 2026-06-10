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

/// Odświeża Live Activity tylko na pierwszym planie — w tle widget animuje się przez TimelineView.
@available(iOS 16.1, *)
private final class RadarLiveActivityHeartbeat {
  static let shared = RadarLiveActivityHeartbeat()

  /// 1 Hz — limit sensowny dla Live Activity; tylko gdy app jest active.
  private let tickInterval: TimeInterval = 1.0
  /// Po odblokowaniu telefonu — krótki burst pushy (nawet w tle), żeby iOS odmarzł widget.
  private let unlockBurstSeconds: TimeInterval = 45
  private var timer: DispatchSourceTimer?
  private var unlockBurstTimer: DispatchSourceTimer?
  private var unlockBurstEndsAt: Date?
  private var baseState: RadarLiveActivityAttributes.ContentState?
  private var currentTick: Int = 0
  private var epochMs: Int64 = 0
  private var isAppActive = UIApplication.shared.applicationState == .active
  private var lifecycleObservers: [NSObjectProtocol] = []

  private init() {
    let center = NotificationCenter.default
    lifecycleObservers = [
      center.addObserver(
        forName: UIApplication.willResignActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.pauseForBackground()
      },
      center.addObserver(
        forName: UIApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.resumeForForeground()
      },
      center.addObserver(
        forName: UIApplication.protectedDataDidBecomeAvailableNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.refreshOnDeviceUnlock()
      },
    ]
  }

  func shouldResetEpoch(for newState: RadarLiveActivityAttributes.ContentState) -> Bool {
    guard let prev = baseState else { return true }
    return prev.propertyType != newState.propertyType
      || prev.newMatchesCount != newState.newMatchesCount
      || prev.activeMatchesCount != newState.activeMatchesCount
      || prev.city != newState.city
      || prev.transactionType != newState.transactionType
      || prev.minMatchThreshold != newState.minMatchThreshold
      || prev.unreadDealroomMessagesCount != newState.unreadDealroomMessagesCount
  }

  func applySnapshot(_ state: RadarLiveActivityAttributes.ContentState, resetEpoch: Bool) {
    if resetEpoch || epochMs == 0 {
      epochMs = Int64(Date().timeIntervalSince1970 * 1000)
      currentTick = 0
    }
    var merged = state
    merged.animationEpochMs = epochMs
    merged.animationTick = currentTick
    merged.updatedAtIso = ISO8601DateFormatter().string(from: Date())
    baseState = merged
    if isAppActive {
      startTimerIfNeeded()
    } else {
      startUnlockBurst()
    }
    Task { await pushState(merged, force: true) }
  }

  func stop() {
    timer?.cancel()
    timer = nil
    unlockBurstTimer?.cancel()
    unlockBurstTimer = nil
    unlockBurstEndsAt = nil
    baseState = nil
    currentTick = 0
    epochMs = 0
  }

  private func pauseForBackground() {
    timer?.cancel()
    timer = nil
    isAppActive = false
    // Burst po odblokowaniu zostaje — krótko budzi animację na lock screenie.
    Task {
      guard var state = baseState else { return }
      state.updatedAtIso = ISO8601DateFormatter().string(from: Date())
      baseState = state
      await pushState(state, force: true)
    }
  }

  /// Odblokowanie telefonu (bez otwierania apki) — odśwież epoch + burst pushy 1 Hz.
  private func refreshOnDeviceUnlock() {
    guard baseState != nil else { return }
    epochMs = Int64(Date().timeIntervalSince1970 * 1000)
    currentTick = 0
    syncTickToWallClock()
    if isAppActive {
      startTimerIfNeeded()
    }
    startUnlockBurst()
    Task {
      guard var state = baseState else { return }
      state.animationEpochMs = epochMs
      state.animationTick = currentTick
      state.updatedAtIso = ISO8601DateFormatter().string(from: Date())
      baseState = state
      await pushState(state, force: true)
    }
  }

  /// Krótki 1 Hz burst po odblokowaniu — TimelineView czasem nie startuje sam po uśpieniu.
  private func startUnlockBurst() {
    unlockBurstTimer?.cancel()
    unlockBurstEndsAt = Date().addingTimeInterval(unlockBurstSeconds)

    let source = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
    source.schedule(deadline: .now() + tickInterval, repeating: tickInterval)
    source.setEventHandler { [weak self] in
      self?.fireUnlockBurstTick()
    }
    source.resume()
    unlockBurstTimer = source
  }

  private func fireUnlockBurstTick() {
    if let ends = unlockBurstEndsAt, Date() >= ends {
      unlockBurstTimer?.cancel()
      unlockBurstTimer = nil
      unlockBurstEndsAt = nil
      return
    }
    guard baseState != nil else {
      unlockBurstTimer?.cancel()
      unlockBurstTimer = nil
      return
    }
    syncTickToWallClock()
    Task {
      guard var state = baseState else { return }
      state.animationTick = currentTick
      state.animationEpochMs = epochMs
      state.updatedAtIso = ISO8601DateFormatter().string(from: Date())
      baseState = state
      await pushState(state, force: true)
    }
  }

  private func resumeForForeground() {
    isAppActive = true
    unlockBurstTimer?.cancel()
    unlockBurstTimer = nil
    unlockBurstEndsAt = nil
    guard baseState != nil else { return }
    epochMs = Int64(Date().timeIntervalSince1970 * 1000)
    currentTick = 0
    syncTickToWallClock()
    startTimerIfNeeded()
    Task {
      guard var state = baseState else { return }
      state.animationEpochMs = epochMs
      state.animationTick = currentTick
      state.updatedAtIso = ISO8601DateFormatter().string(from: Date())
      baseState = state
      await pushState(state)
    }
  }

  private func syncTickToWallClock() {
    guard epochMs > 0 else { return }
    let elapsed = Date().timeIntervalSince1970 - Double(epochMs) / 1000.0
    currentTick = max(0, Int(elapsed / tickInterval))
    if var state = baseState {
      state.animationTick = currentTick
      state.animationEpochMs = epochMs
      baseState = state
    }
  }

  private func startTimerIfNeeded() {
    guard isAppActive else { return }
    guard timer == nil else { return }

    let source = DispatchSource.makeTimerSource(queue: DispatchQueue.main)
    source.schedule(deadline: .now() + tickInterval, repeating: tickInterval)
    source.setEventHandler { [weak self] in
      self?.fireTick()
    }
    source.resume()
    timer = source
  }

  private func pushState(_ state: RadarLiveActivityAttributes.ContentState, force: Bool = false) async {
    if !force && !isAppActive { return }
    let activity =
      RadarLiveActivityStore.activity
      ?? Activity<RadarLiveActivityAttributes>.activities.first
    guard let activity else { return }
    guard activity.activityState == .active else { return }
    RadarLiveActivityStore.activity = activity
    if #available(iOS 16.2, *) {
      // nil staleDate — iOS nie zatrzymuje TimelineView na ekranie blokady.
      let content = ActivityContent(state: state, staleDate: nil)
      await activity.update(content)
    } else {
      await activity.update(using: state)
    }
  }

  private func fireTick() {
    guard isAppActive else { return }
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
        let resetEpoch = RadarLiveActivityHeartbeat.shared.shouldResetEpoch(for: contentState)
        RadarLiveActivityHeartbeat.shared.applySnapshot(contentState, resetEpoch: resetEpoch)
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
    let activity: Activity<RadarLiveActivityAttributes>
    if #available(iOS 16.2, *) {
      let content = ActivityContent(state: contentState, staleDate: nil)
      activity = try Activity.request(
        attributes: attributes,
        content: content,
        pushType: nil
      )
    } else {
      activity = try Activity.request(
        attributes: attributes,
        contentState: contentState,
        pushType: nil
      )
    }
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
