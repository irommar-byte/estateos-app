import UserNotifications
import os.log

private let log = OSLog(subsystem: "pl.estateos.app.NotificationService", category: "thread")

/// Ustawia `threadIdentifier`, żeby iOS grupował push czatu per rozmówca / deal.
/// Expo Push API oficjalnie nie mapuje `thread-id` w `aps` — NSE musi to zrobić z `data`.
final class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

    guard let bestAttemptContent else {
      contentHandler(request.content)
      return
    }

    let userInfo = request.content.userInfo
    let resolved = Self.resolveThreadIdentifier(
      userInfo: userInfo,
      title: bestAttemptContent.title,
      subtitle: bestAttemptContent.subtitle
    )

    if let threadId = resolved, !threadId.isEmpty {
      bestAttemptContent.threadIdentifier = threadId
      if bestAttemptContent.summaryArgument.isEmpty {
        bestAttemptContent.summaryArgument = bestAttemptContent.title
      }
      os_log("threadIdentifier=%{public}@", log: log, type: .info, threadId)
    } else {
      os_log("threadIdentifier MISSING — keys=%{public}@", log: log, type: .error, Array(userInfo.keys).map { "\($0)" }.joined(separator: ","))
    }

    contentHandler(bestAttemptContent)
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler, let bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }

  // MARK: - Resolve

  private static func resolveThreadIdentifier(
    userInfo: [AnyHashable: Any],
    title: String,
    subtitle: String?
  ) -> String? {
    // 1) Już w aps (gdy Expo kiedyś zacznie mapować)
    if let aps = userInfo["aps"] as? [String: Any],
       let apsThread = stringValue(aps["thread-id"]),
       !apsThread.isEmpty {
      return apsThread
    }

    // 2) Jawne pola w całym drzewie userInfo
    let explicitKeys = ["threadIdentifier", "threadId", "iosThreadId", "groupId"]
    for key in explicitKeys {
      if let value = firstString(named: key, in: userInfo), !value.isEmpty {
        // `threadId` w data Contact = ID wątku DB (liczba) — nie używaj go jako APNs thread.
        if key == "threadId", value.allSatisfy(\.isNumber) {
          continue
        }
        if value.hasPrefix("estateos-") {
          return value
        }
        if key == "threadIdentifier" || key == "iosThreadId" {
          return value
        }
      }
    }

    let data = extractExpoData(userInfo)

    // 3) Contact: peerUserId → estateos-contact-peer-{id}
    if let peer = stringValue(data["peerUserId"]) ?? stringValue(data["senderUserId"]) ?? stringValue(data["senderId"]),
       !peer.isEmpty,
       isContactPayload(data: data, subtitle: subtitle) {
      return "estateos-contact-peer-\(peer)"
    }

    // 4) Dealroom: dealId
    if let deal = stringValue(data["dealId"]) ?? stringValue(data["targetId"]),
       !deal.isEmpty,
       isDealPayload(data: data, subtitle: subtitle) {
      return "estateos-deal-\(deal)"
    }

    // 5) Contact thread DB id (gdy brak peer)
    if let contactThread = stringValue(data["threadId"]),
       !contactThread.isEmpty,
       isContactPayload(data: data, subtitle: subtitle) {
      return "estateos-contact-thread-\(contactThread)"
    }

    // 6) Fallback po tytule (u nas title = imię nadawcy Contact)
    let sub = (subtitle ?? "").lowercased()
    let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedTitle.isEmpty, sub.contains("contact") || sub.contains("estateos") {
      let slug = trimmedTitle
        .folding(options: .diacriticInsensitive, locale: Locale(identifier: "en"))
        .lowercased()
        .replacingOccurrences(of: "\\s+", with: "-", options: .regularExpression)
      return "estateos-contact-title-\(slug)"
    }

    return nil
  }

  private static func isContactPayload(data: [String: Any], subtitle: String?) -> Bool {
    let type = (
      stringValue(data["notificationType"]) ??
      stringValue(data["targetType"]) ??
      stringValue(data["target"]) ??
      ""
    ).uppercased()
    if type.contains("CONTACT") { return true }
    let sub = (subtitle ?? "").lowercased()
    return sub.contains("contact")
  }

  private static func isDealPayload(data: [String: Any], subtitle: String?) -> Bool {
    let type = (
      stringValue(data["notificationType"]) ??
      stringValue(data["targetType"]) ??
      stringValue(data["target"]) ??
      stringValue(data["kind"]) ??
      ""
    ).uppercased()
    if type.contains("DEAL") { return true }
    let sub = (subtitle ?? "").lowercased()
    return sub.contains("transakcja") || sub.contains("dealroom")
  }

  /// Expo trzyma `data` w `userInfo["body"]` (dict lub JSON string).
  private static func extractExpoData(_ userInfo: [AnyHashable: Any]) -> [String: Any] {
    if let body = userInfo["body"] as? [String: Any] {
      return body
    }
    if let bodyStr = userInfo["body"] as? String,
       let raw = bodyStr.data(using: .utf8),
       let json = try? JSONSerialization.jsonObject(with: raw) as? [String: Any] {
      return json
    }
    if let data = userInfo["data"] as? [String: Any] {
      return data
    }
    // Spłaszczone klucze na root (bez aps)
    var flat: [String: Any] = [:]
    for (key, value) in userInfo {
      let k = "\(key)"
      if k == "aps" || k == "experienceId" || k == "scopeKey" || k == "projectId" { continue }
      flat[k] = value
    }
    return flat
  }

  private static func firstString(named key: String, in userInfo: [AnyHashable: Any]) -> String? {
    if let direct = stringValue(userInfo[key]), !direct.isEmpty {
      return direct
    }
    let data = extractExpoData(userInfo)
    if let nested = stringValue(data[key]), !nested.isEmpty {
      return nested
    }
    for (_, value) in userInfo {
      if let dict = value as? [String: Any], let nested = stringValue(dict[key]), !nested.isEmpty {
        return nested
      }
    }
    return nil
  }

  private static func stringValue(_ raw: Any?) -> String? {
    if let s = raw as? String {
      let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
      return t.isEmpty ? nil : t
    }
    if let n = raw as? NSNumber { return n.stringValue }
    if let i = raw as? Int { return String(i) }
    return nil
  }
}
