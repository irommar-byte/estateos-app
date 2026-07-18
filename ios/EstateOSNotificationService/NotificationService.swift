import UserNotifications

/// Ustawia `threadIdentifier` z payloadu Expo, żeby iOS grupował push czatu per rozmówca / deal.
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

    if let threadId = Self.resolveThreadIdentifier(userInfo: request.content.userInfo), !threadId.isEmpty {
      bestAttemptContent.threadIdentifier = threadId
      if bestAttemptContent.summaryArgument.isEmpty {
        bestAttemptContent.summaryArgument = bestAttemptContent.title
      }
    }

    contentHandler(bestAttemptContent)
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler, let bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }

  private static func resolveThreadIdentifier(userInfo: [AnyHashable: Any]) -> String? {
    if let direct = stringValue(userInfo["threadIdentifier"]), !direct.isEmpty {
      return direct
    }

    if let body = userInfo["body"] as? [String: Any],
       let nested = stringValue(body["threadIdentifier"]),
       !nested.isEmpty {
      return nested
    }

    if let bodyStr = userInfo["body"] as? String,
       let data = bodyStr.data(using: .utf8),
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let nested = stringValue(json["threadIdentifier"]),
       !nested.isEmpty {
      return nested
    }

    for (_, value) in userInfo {
      if let dict = value as? [String: Any],
         let nested = stringValue(dict["threadIdentifier"]),
         !nested.isEmpty {
        return nested
      }
    }

    return nil
  }

  private static func stringValue(_ raw: Any?) -> String? {
    if let s = raw as? String { return s }
    if let n = raw as? NSNumber { return n.stringValue }
    return nil
  }
}
