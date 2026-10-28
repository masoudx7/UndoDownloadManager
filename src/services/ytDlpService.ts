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
  private nativeProcessSupported: boolean = true;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    if (this.isNative) {
      this.ensureEngineReady().catch(() => {});
    }
  }

  public async ensureEngineReady(): Promise<boolean> {
    if (!this.isNative) return true;
    try {
      const plugin = await this.getNativePlugin();
      if (plugin?.initEngine) {
        const res = await plugin.initEngine();
        return !!res?.ready;
      }
    } catch (e) {
      console.warn('ensureEngineReady warning:', e);
    }
    return true;
  }

  public isNativePlatform(): boolean {
    return this.isNative;
  }

  /**
   * Robustly wait for Capacitor native bridge and YtDlp plugin to be ready.
   */
  private async getNativePlugin(): Promise<any> {
    const win = window as any;
    if (!this.isNative) return null;

    for (let i = 0; i < 30; i++) {
      if (win.Capacitor?.Plugins?.YtDlp) {
        return win.Capacitor.Plugins.YtDlp;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return win.Capacitor?.Plugins?.YtDlp || null;
  }

  /**
   * Queries engine status from the on-device youtubedl-android plugin.
   */
  public async getEngineStatus(): Promise<{
    nativeProcessSupported: boolean;
    nativeDirectDownloaderAvailable: boolean;
    dualMode: boolean;
    engine?: string;
  }> {
    if (!this.isNative) {
      return {
        nativeProcessSupported: false,
        nativeDirectDownloaderAvailable: false,
        dualMode: true,
        engine: 'web-preview',
      };
    }

    try {
      const plugin = await this.getNativePlugin();
      if (plugin?.getEngineStatus) {
        const res = await plugin.getEngineStatus();
        this.nativeProcessSupported = !!res.ready || !!res.nativeProcessSupported;
        return {
          nativeProcessSupported: true,
          nativeDirectDownloaderAvailable: true,
          dualMode: false,
          engine: res.engine || 'youtubedl-android',
        };
      }
    } catch (e) {
      console.warn('Could not query engine status:', e);
    }

    return {
      nativeProcessSupported: true,
      nativeDirectDownloaderAvailable: true,
      dualMode: false,
      engine: 'youtubedl-android',
    };
  }

  private isDirectFile(url: string): boolean {
    if (!url) return false;
    const clean = url.toLowerCase().split('?')[0];
    return /\.(mp4|mkv|webm|mp3|wav|m4a|zip|rar|7z|apk|pdf|bin|iso|tar|gz)$/i.test(clean);
  }

  /**
   * Extracts media metadata (title, formats, thumbnail, duration).
   * Runs 100% on-device on Android without requiring a backend server.
   */
  public async extractInfo(url: string): Promise<YtDlpMediaInfo> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      throw new Error('لطفاً آدرس اینترنتی معتبر وارد کنید.');
    }

    // 1. Native Android Path: Always execute on-device via youtubedl-android
    if (this.isNative) {
      const plugin = await this.getNativePlugin();
      if (plugin) {
        try {
          const res = await plugin.extractInfo({ url: cleanUrl });
          if (res && res.mediaInfo) {
            return res.mediaInfo;
          }
        } catch (nativeErr: any) {
          const msg = nativeErr?.message || '';
          console.warn('Native on-device extraction failed:', msg);
          throw new Error(this.formatErrorMessage(msg || 'استخراج اطلاعات ویدیو در دستگاه با خطا مواجه شد'));
        }
      } else {
        throw new Error('موتور دانلود بومی روی دستگاه راه‌اندازی نشده است.');
      }
    }

    // 2. Web Preview / Dev Environment fallback
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

  /**
   * Starts a download.
   * Runs natively on Android device with local youtubedl-android & HTTP chunked resume engine.
   */
  public startDownload(
    item: DownloadItem,
    onProgress: (event: YtDlpProgressEvent) => void
  ): Promise<{ success: boolean; localPath?: string; error?: string }> {
    return new Promise(async (resolve, reject) => {
      const { id, url, name, formatId, directUrl, audioOnly } = item;

      this.cancelDownload(id);

      // 1. Native Android Path: Run via YtDlp native plugin on device
      if (this.isNative) {
        const plugin = await this.getNativePlugin();
        if (plugin) {
          const progressListener = await plugin.addListener('onProgress', async (event: YtDlpProgressEvent) => {
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
                reject(new Error(this.formatErrorMessage(event.error || 'خطا در دانلود')));
              }
            }
          });

          plugin.startDownload({
            id,
            url,
            directUrl: directUrl || '',
            filename: name,
            formatId: formatId || 'best',
            audioOnly: !!audioOnly,
          }).catch((err: any) => {
            progressListener.remove();
            reject(new Error(this.formatErrorMessage(err.message || 'خطا در شروع دانلود')));
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
        reject(new Error('ناتوان در ایجاد اتصال با موتور پیش‌نمایش.'));
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
        const friendlyError = 'ارتباط با موتور دانلود قطع شد یا در دسترس نیست.';
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

    try {
      await fetch('/api/ytdlp/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: downloadId }),
      });
      return true;
    } catch {
      return false;
    }
  }

  public async resumeDownload(item: DownloadItem, onProgress: (event: YtDlpProgressEvent) => void) {
    return this.startDownload(item, onProgress);
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

    try {
      await fetch('/api/ytdlp/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: downloadId }),
      });
      return true;
    } catch {
      return false;
    }
  }

  private cleanupStream(downloadId: string) {
    const stream = this.activeStreams.get(downloadId);
    if (stream) {
      stream.close();
      this.activeStreams.delete(downloadId);
    }
  }

  private formatErrorMessage(error: string): string {
    if (!error) return 'خطای نامشخص در عملیات دانلود.';

    if (error.includes('Video unavailable') || error.includes('Private video')) {
      return 'این ویدیو در دسترس نیست یا خصوصی است.';
    }
    if (error.includes('Sign in to confirm you’re not a bot') || error.includes('Sign in')) {
      return 'این ویدیو نیازمند تأیید هویت است یا توسط پلتفرم محدود شده است.';
    }
    if (error.includes('HTTP Error 403') || error.includes('Forbidden')) {
      return 'دسترسی به لینک دانلود توسط سرور مبدا مسدود شده است (خطای ۴۰۳).';
    }
    if (error.includes('HTTP Error 404') || error.includes('Not Found')) {
      return 'فایل یا ویدیوی مورد نظر در آدرس مشخص شده یافت نشد (خطای ۴۰۴).';
    }
    if (error.includes('Unsupported URL') || error.includes('is not a valid URL')) {
      return 'آدرس وارد شده پشتیبانی نمی‌شود یا نامعتبر است.';
    }
    if (error.includes('network') || error.includes('timed out') || error.includes('Connection refused')) {
      return 'خطا در اتصال به اینترنت یا سرور رسانه. لطفاً وضعیت شبکه را بررسی کنید.';
    }
    return error;
  }
}

export const ytDlpService = new YtDlpService();
