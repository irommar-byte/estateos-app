export type WebNotificationPermissionState = NotificationPermission | "unsupported";

export function canUseWebNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getWebNotificationPermission(): WebNotificationPermissionState {
  if (!canUseWebNotifications()) return "unsupported";
  return Notification.permission;
}

export async function requestWebNotificationPermission(): Promise<WebNotificationPermissionState> {
  if (!canUseWebNotifications()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

const WEB_NOTIFY_DISMISS_KEY = "estateos_web_notify_dismissed_v1";

export function isWebNotificationPromptDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(WEB_NOTIFY_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissWebNotificationPrompt(): void {
  try {
    window.localStorage.setItem(WEB_NOTIFY_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function showWebNotification(
  title: string,
  options?: NotificationOptions & { onClickPath?: string },
): void {
  if (!canUseWebNotifications() || Notification.permission !== "granted") return;
  const onClickPath = options?.onClickPath;
  const notifyOptions: NotificationOptions = { ...(options || {}) };
  delete (notifyOptions as { onClickPath?: string }).onClickPath;

  try {
    const notification = new Notification(title, {
      icon: "/apple-touch-icon.png",
      badge: "/apple-touch-icon.png",
      lang: "pl",
      ...notifyOptions,
    });
    notification.onclick = () => {
      window.focus();
      if (onClickPath) {
        window.location.href = onClickPath;
      }
      notification.close();
    };
  } catch {
    /* Safari / blokada — ignoruj */
  }
}
