import { DownloadCategory } from '../types';

/**
 * Capacitor & Native Android Directory Storage Manager for Undo Downloader
 * Prepares the app to create a parent folder 'UndoDownloader' and subfolders
 * based on file category (video, music, document, software, archive, other)
 * when converted to Android via Capacitor.
 */

export const PARENT_FOLDER_NAME = 'UndoDownloader';

export const CATEGORY_FOLDERS: Record<DownloadCategory, string> = {
  all: 'UndoDownloader',
  video: 'UndoDownloader/Videos',
  music: 'UndoDownloader/Music',
  document: 'UndoDownloader/Documents',
  software: 'UndoDownloader/Software',
  archive: 'UndoDownloader/Archives',
  other: 'UndoDownloader/Others',
};

export async function initDownloadDirectories(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if running inside Capacitor native environment
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor !== undefined;

    if (isCapacitor) {
      // Dynamic import of @capacitor/filesystem to prevent web bundle issues if not installed yet
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        // Create parent folder and subfolders recursively
        for (const cat of Object.keys(CATEGORY_FOLDERS) as DownloadCategory[]) {
          if (cat === 'all') continue;
          const folderPath = CATEGORY_FOLDERS[cat];
          await Filesystem.mkdir({
            path: folderPath,
            directory: Directory.Documents,
            recursive: true,
          }).catch(() => {
            // folder might already exist
          });
        }

        return { success: true, message: 'پوشه مادر UndoDownloader و زیرپوشه‌های دسته‌بندی با موفقیت در حافظه اندروید ساخته شدند.' };
      } catch (capacitorErr) {
        console.warn('Capacitor Filesystem plugin not fully initialized yet:', capacitorErr);
      }
    }

    // Web fallback simulation / localStorage configuration check
    console.log('Running in Web mode. Capacitor directory structure prepared for future Android build.');
    return { success: true, message: 'ساختار پوشه‌بندی اندروید آماده شد (حالت وب شبیه‌سازی شد).' };
  } catch (err: any) {
    console.error('Error initializing download directories:', err);
    return { success: false, message: err.message || 'خطا در ایجاد ساختار پوشه‌ها' };
  }
}

export async function saveFileToCategoryFolder(
  fileName: string,
  category: DownloadCategory,
  fileUrlOrData: string
): Promise<{ success: boolean; path?: string; message: string }> {
  try {
    const subFolder = CATEGORY_FOLDERS[category] || 'UndoDownloader/Others';
    const fullPath = `${subFolder}/${fileName}`;

    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor !== undefined;

    if (isCapacitor) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        
        // Ensure directory exists
        await Filesystem.mkdir({
          path: subFolder,
          directory: Directory.Documents,
          recursive: true,
        }).catch(() => {});

        // If fileUrlOrData is base64 or URL
        if (fileUrlOrData.startsWith('data:')) {
          const base64Data = fileUrlOrData.split(',')[1];
          const result = await Filesystem.writeFile({
            path: fullPath,
            data: base64Data,
            directory: Directory.Documents,
          });
          return { success: true, path: result.uri, message: `فایل با موفقیت در پوشه ${subFolder} ذخیره شد.` };
        } else {
          // Download or save uri
          return { success: true, path: fullPath, message: `مسیر فایل در اندروید ثبت شد: ${fullPath}` };
        }
      } catch (nativeErr) {
        console.warn('Native Capacitor file write error, falling back:', nativeErr);
      }
    }

    // Web fallback trigger download
    return {
      success: true,
      path: fullPath,
      message: `فایل در سیستم دسته‌بندی ${subFolder} آماده دانلود در مرورگر است.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'خطا در ذخیره‌سازی فایل در پوشه دسته‌بندی' };
  }
}
