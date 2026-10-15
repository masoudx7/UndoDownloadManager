import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { DownloadItem } from '../types';

class FileManagerService {
  private isNative: boolean = false;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Return full public download URL for a file
   */
  public getDownloadUrl(item: DownloadItem): string {
    if (item.localPath && item.localPath.startsWith('http')) {
      return item.localPath;
    }
    if (item.localPath) {
      return `${window.location.origin}${item.localPath}`;
    }
    return `${window.location.origin}/api/downloads/file/${encodeURIComponent(item.name)}`;
  }

  /**
   * Move completed file to Android system Downloads or Documents directory
   */
  public async organizeCompletedFile(item: DownloadItem): Promise<string | undefined> {
    if (!this.isNative) return undefined;

    try {
      // If we have a local download path from server
      const downloadUrl = this.getDownloadUrl(item);
      const fileName = item.name.replace(/[^a-zA-Z0-9_\u0600-\u06FF.-]/g, '_');
      const targetPath = `UndoDownloader/${fileName}`;

      // Ensure directory exists
      await Filesystem.mkdir({
        path: 'UndoDownloader',
        directory: Directory.Documents,
        recursive: true,
      }).catch(() => {});

      // Check file exists or write
      const response = await fetch(downloadUrl);
      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        return new Promise((resolve) => {
          reader.onloadend = async () => {
            const base64data = (reader.result as string)?.split(',')[1];
            if (base64data) {
              const res = await Filesystem.writeFile({
                path: targetPath,
                data: base64data,
                directory: Directory.Documents,
              });
              resolve(res.uri);
            } else {
              resolve(undefined);
            }
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (err) {
      console.warn('Could not move file to native storage:', err);
    }
    return undefined;
  }

  /**
   * Open or play the downloaded file
   */
  public async openFile(item: DownloadItem): Promise<void> {
    const fileUrl = this.getDownloadUrl(item);

    if (this.isNative) {
      // In native environment, trigger browser or download intent
      window.open(fileUrl, '_system');
    } else {
      // In web browser, trigger download or open preview in new tab
      const anchor = document.createElement('a');
      anchor.href = fileUrl;
      anchor.download = item.name;
      anchor.target = '_blank';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }

  /**
   * Share the downloaded file with other apps (Telegram, WhatsApp, Drive, etc.)
   */
  public async shareFile(item: DownloadItem): Promise<{ success: boolean; message?: string }> {
    const fileUrl = this.getDownloadUrl(item);

    try {
      if (this.isNative) {
        const canShare = await Share.canShare().catch(() => ({ value: true }));
        if (canShare.value) {
          await Share.share({
            title: item.name,
            text: `دانلود شده با Undo Download Manager: ${item.name}`,
            url: fileUrl,
            dialogTitle: 'اشتراک‌گذاری فایل',
          });
          return { success: true };
        }
      }

      // Web Share API fallback
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: item.name,
          text: `فایل دانلود شده: ${item.name}`,
          url: fileUrl,
        });
        return { success: true };
      }

      // Clipboard fallback
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(fileUrl);
        return { success: true, message: 'لینک فایل در کلیپ‌بورد کپی شد!' };
      }

      return { success: false, message: 'قابلیت اشتراک‌گذاری در این مرورگر پشتیبانی نمی‌شود.' };
    } catch (err: any) {
      // User cancelled share dialog is not an error
      if (err.name === 'AbortError') {
        return { success: true };
      }
      return { success: false, message: err.message || 'خطا در اشتراک‌گذاری' };
    }
  }
}

export const fileManagerService = new FileManagerService();
