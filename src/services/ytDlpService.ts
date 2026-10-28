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
  directUrl?: string;
  audioOnly?: boolean;
}

class YtDlpService {
  private activeStreams: Map<string, EventSource> = new Map();
  private isNative: boolean = false;
  private nativeProcessSupported: boolean | null = null;

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

    for (let i = 0; i < 30; i++) {
      if (win.Capacitor?.Plugins?.YtDlp) {
        return win.Capacitor.Plugins.YtDlp;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return win.Capacitor?.Plugins?.YtDlp || null;
  }

  /**
   * Queries the native plugin to check whether on-device yt-dlp binary process
   * can execute or if dual-mode fallback to backend extraction is active.
   */
  public async getEngineStatus(): Promise<{
    nativeProcessSupported: boolean;
    nativeDirectDownloaderAvailable: boolean;
    dualMode: boolean;
  }> {
    if (!this.isNative) {
      return {
        nativeProcessSupported: false,
        nativeDirectDownloaderAvailable: false,
        dualMode: true,
      };
    }

    try {
      const plugin = await this.getNativePlugin();
      if (plugin?.getEngineStatus) {
        const res = await plugin.getEngineStatus();
        this.nativeProcessSupported = !!res.nativeProcessSupported;
        return {
          nativeProcessSupported: !!res.nativeProcessSupported,
          nativeDirectDownloaderAvailable: !!res.nativeDirectDownloaderAvailable,
          dualMode: true,
        };
      }
    } catch (e) {
      console.warn('Could not query engine status:', e);
    }

    return {
      nativeProcessSupported: false,
      nativeDirectDownloaderAvailable: true,
      dualMode: true,
    };
  }

  private isDirectFile(url: string): boolean {
    if (!url) return false;
    const clean = url.toLowerCase().split('?')[0];
    return /\.(mp4|mkv|webm|mp3|wav|m4a|zip|rar|7z|apk|pdf|bin|iso|tar|gz)$/i.test(clean);
  }

  public async extractInfo(url: string): Promise<YtDlpMediaInfo> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      throw new Error('لطفاً آدرس اینترنتی معتبر وارد کنید.');
    }

    // 1. Native Android Path: Try native plugin if process support is not already marked false
    if (this.isNative && this.nativeProcessSupported !== false) {
      const plugin = await this.getNativePlugin();
      if (plugin) {
        try {
          const res = await plugin.extractInfo({ url: cleanUrl });
          if (res && res.mediaInfo) {
            this.nativeProcessSupported = true;
            return res.mediaInfo;
          }
        } catch (nativeErr: any) {
          // Native binary cannot run (Exec format error / Bionic libc). Mark process unsupported and fall back immediately.
          this.nativeProcessSupported = false;
          console.info('Native yt-dlp process unsupported on device; falling back to backend extraction:', nativeErr?.message);
        }
      }
    }

    // 2. Hybrid Fallback Path: call backend API /api/ytdlp/extract
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
      const { id, url, name, formatId, directUrl, audioOnly } = item;

      this.cancelDownload(id);

      // 1. Native Android Path: Run via YtDlp native plugin (Direct HTTP streaming engine or process)
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

          // Resolve full direct URL for native Java downloader
          let targetDirectUrl = directUrl;
          if (!targetDirectUrl && !this.isDirectFile(url) && this.nativeProcessSupported === false) {
            // If native process cannot execute and no direct URL was extracted, proxy through download-stream
            const streamPath = `/api/ytdlp/download-stream?url=${encodeURIComponent(url)}&formatId=${encodeURIComponent(formatId || 'best')}&audioOnly=${audioOnly ? 'true' : 'false'}&name=${encodeURIComponent(name)}`;
            try {
              targetDirectUrl = new URL(streamPath, window.location.origin).href;
            } catch (e) {
              targetDirectUrl = streamPath;
            }
          } else if (targetDirectUrl && targetDirectUrl.startsWith('/')) {
            try {
              targetDirectUrl = new URL(targetDirectUrl, window.location.origin).href;
            } catch (e) {}
          }

          plugin.startDownload({
            id,
            url,
            directUrl: targetDirectUrl || '',
            filename: name,
            formatId: formatId || 'best',
            audioOnly: !!audioOnly,
          }).catch((err: any) => {
            progressListener.remove();
            reject(new Error(this.formatErrorMessage(err.message || 'خطا در شروع دانلود بومی')));
          });

          return;
        } else {
          const msg = 'پلاگین بومی روی این دستگاه در دسترس نیست. لطفاً فایل نصبی به‌روز APK را نصب کنید.';
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
