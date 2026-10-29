import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Notification service completely disabled per user request:
 * Zero system/push notifications are sent for progress, completion, or errors.
 */
class NotificationService {
  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.removeAllDeliveredNotifications().catch(() => {});
        await LocalNotifications.cancel({ notifications: [] }).catch(() => {});
      }
    } catch {}
  }

  public async notifyProgress(
    _downloadId: string,
    _filename: string,
    _percent: number,
    _speedFormatted: string,
    _eta: string
  ): Promise<void> {
    // Disabled: zero notifications
  }

  public async notifyCompleted(_downloadId: string, _filename: string): Promise<void> {
    // Disabled: zero notifications
  }

  public async notifyError(_downloadId: string, _filename: string, _errorMessage?: string): Promise<void> {
    // Disabled: zero notifications
  }

  public async clearNotification(_downloadId: string): Promise<void> {
    // Disabled
  }
}

export const notificationService = new NotificationService();
