import { Capacitor } from '@capacitor/core';
import { DownloadItem, YtDlpMediaInfo, YtDlpProgressEvent, YtDlpFormat } from '../types';
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
  private abortControllers: Map<string, AbortController> = new Map();
  private isNative: boolean = false;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Check if running on native Capacitor Android platform
   */
  public isNativePlatform(): boolean {
    return this.isNative;
  }

  /**
   * Extract video / audio info, thumbnail, duration, and formats using yt-dlp
   */
  public async extractInfo(url: string): Promise<YtDlpMediaInfo> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      throw new Error('لطفاً آدرس اینترنتی معتبر وارد کنید.');
    }

    // If native Capacitor plugin is registered
    const win = window as any;
    if (this.isNative && win.Capacitor?.Plugins?.YtDlp) {
      try {
        const res = await win.Capacitor.Plugins.YtDlp.extractInfo({ url: cleanUrl });
        if (res && res.mediaInfo) {
          return res.mediaInfo;
        }
      } catch (nativeErr: any) {
        console.warn('Native YtDlp plugin extraction failed, falling back to backend:', nativeErr);
      }
    }

    // Call backend API /api/ytdlp/extract
    const response = await fetch('/api/ytdlp/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
  }

  /**
   * Start real download using yt-dlp / progressive multi-connection engine with real-time progress events
   */
  public startDownload(
    item: DownloadItem,
    onProgress: (event: YtDlpProgressEvent) => void
  ): Promise<{ success: boolean; localPath?: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const { id, url, name, formatId, audioOnly } = item;

      // Close previous stream for same id if exists
      this.cancelDownload(id);

      const win = window as any;

      // 1. If Native Android with Capacitor Plugin
      if (this.isNative && win.Capacitor?.Plugins?.YtDlp) {
        const plugin = win.Capacitor.Plugins.YtDlp;

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
              reject(new Error(event.error || 'خطا در دانلود بومی'));
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
          reject(err);
        });

        return;
      }

      // 2. Web / Local Engine Mode: Real Server-Sent Events (SSE) Stream
      const queryParams = new URLSearchParams({
        id,
        url,
        name: encodeURIComponent(name),
        formatId: formatId || '',
        audioOnly: audioOnly ? 'true' : 'false',
      });

      const sseUrl = `/api/ytdlp/stream?${queryParams.toString()}`;
      const eventSource = new EventSource(sseUrl);
      this.activeStreams.set(id, eventSource);

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
          console.error('Error parsing yt-dlp SSE message:', parseErr);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Stream error for download:', id, err);
        this.cleanupStream(id);
        const friendlyError = 'ارتباط با موتور دانلود قطع شد یا اتصال اینترنت متوقف گردید.';
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

  /**
   * Pause an active download
   */
  public async pauseDownload(downloadId: string): Promise<boolean> {
    this.cleanupStream(downloadId);

    const win = window as any;
    if (this.isNative && win.Capacitor?.Plugins?.YtDlp) {
      try {
        await win.Capacitor.Plugins.YtDlp.pauseDownload({ id: downloadId });
        return true;
      } catch (e) {
        console.error('Native pause error:', e);
      }
    }

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

  /**
   * Resume a paused or failed download
   */
  public async resumeDownload(
    item: DownloadItem,
    onProgress: (event: YtDlpProgressEvent) => void
  ): Promise<boolean> {
    const win = window as any;
    if (this.isNative && win.Capacitor?.Plugins?.YtDlp) {
      try {
        await win.Capacitor.Plugins.YtDlp.resumeDownload({ id: item.id });
        return true;
      } catch (e) {
        console.error('Native resume error:', e);
      }
    }

    // In web/server mode, starting the download with yt-dlp automatically uses `-c` (continue)
    try {
      this.startDownload(item, onProgress);
      return true;
    } catch (e) {
      console.error('Resume error:', e);
      return false;
    }
  }

  /**
   * Cancel and delete an in-progress download
   */
  public async cancelDownload(downloadId: string): Promise<boolean> {
    this.cleanupStream(downloadId);

    const win = window as any;
    if (this.isNative && win.Capacitor?.Plugins?.YtDlp) {
      try {
        await win.Capacitor.Plugins.YtDlp.cancelDownload({ id: downloadId });
        return true;
      } catch (e) {
        console.error('Native cancel error:', e);
      }
    }

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

  /**
   * Clean up event source stream
   */
  private cleanupStream(downloadId: string): void {
    notificationService.clearNotification(downloadId);
    const stream = this.activeStreams.get(downloadId);
    if (stream) {
      stream.close();
      this.activeStreams.delete(downloadId);
    }
  }

  /**
   * Translates common yt-dlp error codes to user-friendly Persian messages
   */
  private formatErrorMessage(error: string): string {
    const lower = error.toLowerCase();
    if (lower.includes('age-restricted') || lower.includes('sign in to confirm your age')) {
      return 'این ویدیو دارای محدودیت سنی (Age-Restricted) است و نیاز به ورود دارد.';
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
      return 'فرمت این آدرس اینترنتی توسط yt-dlp پشتیبانی نمی‌شود.';
    }
    if (lower.includes('timeout') || lower.includes('network') || lower.includes('connection')) {
      return 'خطا در ارتباط با سرور مبدأ یا قطعی اینترنت رخ داده است.';
    }
    return error;
  }
}

export const ytDlpService = new YtDlpService();
