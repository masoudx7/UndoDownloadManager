import { Capacitor } from '@capacitor/core';
import { DownloadItem, YtDlpMediaInfo, YtDlpProgressEvent } from '../types';
import { notificationService } from './notificationService';
import { fileManagerService } from './fileManagerService';
import { formatSpeed } from '../utils/formatters';

export interface YtDlpDownloadRequest {
  id: string;
  url: string;
  name: string;
  formatId?: string;
  audioOnly?: boolean;
}

class YtDlpService {
  private activeStreams: Map<string, EventSource> = new Map();
  private isNative: boolean = false;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  public isNativePlatform(): boolean {
    return this.isNative;
  }

  /**
   * Robustly wait for Capacitor native bridge and YtDlp plugin to be fully injected & ready.
   */
  private async getNativePlugin(): Promise<any> {
    const win = window as any;
    if (!this.isNative) return null;

    // Retry up to 30 times (6 seconds total) for the native plugin bridge to initialize upon app launch
    for (let i = 0; i < 30; i++) {
      if (win.Capacitor?.Plugins?.YtDlp) {
        return win.Capacitor.Plugins.YtDlp;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return win.Capacitor?.Plugins?.YtDlp || null;
  }

  public async extractInfo(url: string): Promise<YtDlpMediaInfo> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      throw new Error('لطفاً آدرس اینترنتی معتبر وارد کنید.');
    }

    // 1. Native Android Path: Try native plugin first
    if (this.isNative) {
      const plugin = await this.getNativePlugin();
      if (plugin) {
        try {
          const res = await plugin.extractInfo({ url: cleanUrl });
          if (res && res.mediaInfo) {
            return res.mediaInfo;
          }
        } catch (nativeErr: any) {
          console.warn('Native plugin extraction error, attempting backend proxy fallback:', nativeErr);
          // If native plugin failed (e.g. Linux binary execution unsupported on this Android CPU),
          // continue below to backend extraction fallback.
        }
      }
    }

    // 2. Web / Hybrid Fallback Path: call backend API /api/ytdlp/extract
    try {
      const response = await fetch('/api/ytdlp/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorMsg = errData.error || `خطا در استخراج اطلاعات (کد وضعیت: ${response.status})`;
        throw new Error(this.formatErrorMessage(errorMsg));
      }

      const data = await response.json();
      if (!data.success || !data.mediaInfo) {
        throw new Error(this.formatErrorMessage(data.error || 'اطلاعات ویدیو یافت نشد.'));
      }

      return data.mediaInfo;
    } catch (fetchErr: any) {
      if (fetchErr.message && fetchErr.message.includes('خطا')) {
        throw fetchErr;
      }
      throw new Error('امکان دریافت اطلاعات ویدیو وجود ندارد. لطفاً از اتصال اینترنت یا درستی آدرس اطمینان حاصل کنید.');
    }
  }

  public startDownload(
    item: DownloadItem,
    onProgress: (event: YtDlpProgressEvent) => void
  ): Promise<{ success: boolean; localPath?: string; error?: string }> {
    return new Promise(async (resolve, reject) => {
      const { id, url, name, formatId, audioOnly } = item;

      this.cancelDownload(id);

      // 1. Native Android Path: Run via YtDlp native plugin (process or native Java HTTP engine)
      if (this.isNative) {
        const plugin = await this.getNativePlugin();
        if (plugin) {
          const progressListener = plugin.addListener('onProgress', async (event: YtDlpProgressEvent) => {
            if (event.downloadId === id) {
              onProgress(event);
              if (event.status === 'downloading') {
                notificationService.notifyProgress(
                  id,
                  name,
                  event.progress,
                  formatSpeed(event.speed),
                  event.eta
                );
              } else if (event.status === 'completed') {
                progressListener.remove();
                await notificationService.notifyCompleted(id, name);
                await fileManagerService.organizeCompletedFile({ ...item, localPath: event.localPath });
                resolve({ success: true, localPath: event.localPath });
              } else if (event.status === 'error') {
                progressListener.remove();
                notificationService.notifyError(id, name, event.error);
                reject(new Error(this.formatErrorMessage(event.error || 'خطا در دانلود بومی')));
              }
            }
          });

          plugin.startDownload({
            id,
            url,
            filename: name,
            formatId: formatId || 'best',
            audioOnly: !!audioOnly,
          }).catch((err: any) => {
            progressListener.remove();
            reject(new Error(this.formatErrorMessage(err.message || 'خطا در شروع دانلود بومی')));
          });

          return;
        } else {
          // If native plugin is not loaded, notify with actionable message
          const msg = 'پلاگین بومی روی این دستگاه در دسترس نیست. لطفاً آخرین نسخه نصبی APK را نصب کنید.';
          reject(new Error(msg));
          return;
        }
      }

      // 2. Web / Preview Path: Server-Sent Events (SSE) Stream
      const queryParams = new URLSearchParams({
        id,
        url,
        name: encodeURIComponent(name),
        formatId: formatId || '',
        audioOnly: audioOnly ? 'true' : 'false',
      });

      const sseUrl = `/api/ytdlp/stream?${queryParams.toString()}`;
      let eventSource: EventSource;

      try {
        eventSource = new EventSource(sseUrl);
        this.activeStreams.set(id, eventSource);
      } catch (err: any) {
        reject(new Error('ناتوان در ایجاد اتصال با سرور.'));
        return;
      }

      eventSource.onmessage = async (e) => {
        try {
          const event: YtDlpProgressEvent = JSON.parse(e.data);

          if (event.downloadId === id) {
            onProgress(event);

            if (event.status === 'downloading') {
              notificationService.notifyProgress(
                id,
                name,
                event.progress,
                formatSpeed(event.speed),
                event.eta
              );
            } else if (event.status === 'completed') {
              this.cleanupStream(id);
              await notificationService.notifyCompleted(id, name);
              await fileManagerService.organizeCompletedFile({ ...item, localPath: event.localPath });
              resolve({ success: true, localPath: event.localPath });
            } else if (event.status === 'error') {
              this.cleanupStream(id);
              notificationService.notifyError(id, name, event.error);
              reject(new Error(this.formatErrorMessage(event.error || 'خطای نامشخص در دانلود')));
            }
          }
        } catch (parseErr) {
          console.error('Error parsing download message:', parseErr);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Stream error for download:', id, err);
        this.cleanupStream(id);
        const friendlyError = 'ارتباط با موتور دانلود قطع شد یا سرور در دسترس نیست.';
        notificationService.notifyError(id, name, friendlyError);
        onProgress({
          downloadId: id,
          status: 'error',
          progress: item.progress || 0,
          downloadedBytes: item.downloadedSize || 0,
          totalBytes: item.fileSize || 0,
          speed: 0,
          eta: 'خطا در دانلود',
          error: friendlyError,
        });
        reject(new Error(friendlyError));
      };
    });
  }

  public async pauseDownload(downloadId: string): Promise<boolean> {
    this.cleanupStream(downloadId);

    if (this.isNative) {
      const plugin = await this.getNativePlugin();
      if (plugin) {
        try {
          await plugin.pauseDownload({ id: downloadId });
          return true;
        } catch (e) {
          console.error('Native pause error:', e);
          return false;
        }
      }
    }

    if (!this.isNative) {
      try {
        await fetch('/api/ytdlp/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: downloadId }),
        });
        return true;
      } catch (e) {
        console.warn('Pause API call error:', e);
        return false;
      }
    }

    return false;
  }

  public async resumeDownload(
    item: DownloadItem,
    onProgress: (event: YtDlpProgressEvent) => void
  ): Promise<boolean> {
    if (this.isNative) {
      const plugin = await this.getNativePlugin();
      if (plugin) {
        try {
          await plugin.resumeDownload({ id: item.id });
          return true;
        } catch (e) {
          console.error('Native resume error:', e);
          return false;
        }
      }
    }

    try {
      this.startDownload(item, onProgress);
      return true;
    } catch (e) {
      console.error('Resume error:', e);
      return false;
    }
  }

  public async cancelDownload(downloadId: string): Promise<boolean> {
    this.cleanupStream(downloadId);

    if (this.isNative) {
      const plugin = await this.getNativePlugin();
      if (plugin) {
        try {
          await plugin.cancelDownload({ id: downloadId });
          return true;
        } catch (e) {
          console.error('Native cancel error:', e);
          return false;
        }
      }
    }

    if (!this.isNative) {
      try {
        await fetch('/api/ytdlp/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: downloadId }),
        });
        return true;
      } catch (e) {
        console.warn('Cancel API call error:', e);
        return false;
      }
    }

    return false;
  }

  private cleanupStream(downloadId: string): void {
    notificationService.clearNotification(downloadId);
    const stream = this.activeStreams.get(downloadId);
    if (stream) {
      stream.close();
      this.activeStreams.delete(downloadId);
    }
  }

  private formatErrorMessage(error: string): string {
    const lower = error.toLowerCase();
    if (lower.includes('age-restricted') || lower.includes('sign in to confirm your age')) {
      return 'این ویدیو دارای محدودیت سنی (Age-Restricted) است.';
    }
    if (lower.includes('private video') || lower.includes('this video is private')) {
      return 'این ویدیو خصوصی (Private) است و امکان دانلود آن وجود ندارد.';
    }
    if (lower.includes('unavailable') || lower.includes('video is unavailable')) {
      return 'ویدیو در دسترس نیست یا توسط سازنده حذف شده است.';
    }
    if (lower.includes('geo-blocked') || lower.includes('not available in your country')) {
      return 'این محتوا برای منطقه جغرافیایی فعلی مسدود است (Geo-Blocked).';
    }
    if (lower.includes('unsupported url')) {
      return 'فرمت این آدرس اینترنتی پشتیبانی نمی‌شود.';
    }
    if (lower.includes('timeout') || lower.includes('network') || lower.includes('connection')) {
      return 'خطا در ارتباط با سرور یا قطعی اینترنت رخ داده است.';
    }
    return error;
  }
}

export const ytDlpService = new YtDlpService();
