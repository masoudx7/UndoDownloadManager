import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

class NotificationService {
  private hasPermission: boolean = false;
  private isNative: boolean = false;
  private lastNotificationTime: Map<string, number> = new Map();

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.init();
  }

  /**
   * Initialize notification channels and request permission
   */
  public async init(): Promise<void> {
    if (this.isNative) {
      try {
        const permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display === 'granted') {
          this.hasPermission = true;
        } else {
          const req = await LocalNotifications.requestPermissions();
          this.hasPermission = req.display === 'granted';
        }

        // Create Android Notification Channel
        await LocalNotifications.createChannel({
          id: 'undo_downloads',
          name: 'دانلودهای فعال',
          description: 'نمایش پیشرفت و وضعیت دانلودهای منیجر',
          importance: 4, // High importance for ongoing downloads
          visibility: 1,
          vibration: false,
          sound: undefined,
        }).catch(() => {});
      } catch (err) {
        console.warn('Local notifications init error:', err);
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        this.hasPermission = true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          this.hasPermission = permission === 'granted';
        }).catch(() => {});
      }
    }
  }

  /**
   * Convert string downloadId to numeric 32-bit integer for notification ID
   */
  private getNumericId(downloadId: string): number {
    let hash = 0;
    for (let i = 0; i < downloadId.length; i++) {
      hash = (hash << 5) - hash + downloadId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100000;
  }

  /**
   * Throttled progress notification (updates at most every 1.8 seconds per download)
   */
  public async notifyProgress(
    downloadId: string,
    filename: string,
    percent: number,
    speedFormatted: string,
    eta: string
  ): Promise<void> {
    const now = Date.now();
    const last = this.lastNotificationTime.get(downloadId) || 0;
    if (now - last < 1800) return; // throttle notifications
    this.lastNotificationTime.set(downloadId, now);

    const title = `دانلود: ${filename.slice(0, 30)}`;
    const body = `${percent}% • سرعت: ${speedFormatted} • ${eta}`;

    if (this.isNative && this.hasPermission) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: this.getNumericId(downloadId),
              title,
              body,
              channelId: 'undo_downloads',
              ongoing: true,
              autoCancel: false,
              summaryText: 'Undo Download Manager',
            },
          ],
        });
      } catch (e) {
        // Ignore native notification scheduling glitch
      }
    }
  }

  /**
   * Notify user when a download completes
   */
  public async notifyCompleted(downloadId: string, filename: string): Promise<void> {
    const id = this.getNumericId(downloadId);
    this.lastNotificationTime.delete(downloadId);

    const title = 'دانلود پایان یافت 🎉';
    const body = `فایل ${filename.slice(0, 35)} با موفقیت دریافت و ذخیره شد.`;

    if (this.isNative && this.hasPermission) {
      try {
        // Clear progress notification and show completed notification
        await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
        await LocalNotifications.schedule({
          notifications: [
            {
              id: id + 50000,
              title,
              body,
              channelId: 'undo_downloads',
              ongoing: false,
              autoCancel: true,
            },
          ],
        });
      } catch (e) {
        console.warn('Completed notification error:', e);
      }
    } else if (!this.isNative && this.hasPermission && 'Notification' in window) {
      try {
        new Notification(title, { body, icon: '/icon.png' });
      } catch (e) {}
    }
  }

  /**
   * Notify user when a download encounters an error
   */
  public async notifyError(downloadId: string, filename: string, errorMessage?: string): Promise<void> {
    const id = this.getNumericId(downloadId);
    this.lastNotificationTime.delete(downloadId);

    const title = 'خطا در دانلود ⚠️';
    const body = `دانلود ${filename.slice(0, 25)} متوقف شد: ${errorMessage || 'خطای اتصال'}`;

    if (this.isNative && this.hasPermission) {
      try {
        await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
        await LocalNotifications.schedule({
          notifications: [
            {
              id: id + 60000,
              title,
              body,
              channelId: 'undo_downloads',
              ongoing: false,
              autoCancel: true,
            },
          ],
        });
      } catch (e) {}
    }
  }

  /**
   * Clear active notification for a cancelled or paused download
   */
  public async clearNotification(downloadId: string): Promise<void> {
    this.lastNotificationTime.delete(downloadId);
    if (this.isNative) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: this.getNumericId(downloadId) }],
        }).catch(() => {});
      } catch (e) {}
    }
  }
}

export const notificationService = new NotificationService();
