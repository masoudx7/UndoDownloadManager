import { DownloadItem, ScheduleSettings } from '../types';

export interface QueueCheckResult {
  updatedDownloads: DownloadItem[];
  itemsToStart: DownloadItem[];
  itemsToPause: string[];
}

export class DownloadQueueManager {
  private maxConcurrent: number = 2; // Default 2 simultaneous downloads

  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = maxConcurrent;
  }

  public setMaxConcurrent(limit: number): void {
    if (limit >= 1 && limit <= 5) {
      this.maxConcurrent = limit;
    }
  }

  public getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  /**
   * Check if the current time falls inside the schedule window
   */
  public isInsideScheduleWindow(schedule: ScheduleSettings): boolean {
    if (!schedule.enabled) return true;

    const now = new Date();
    const currentH = now.getHours().toString().padStart(2, '0');
    const currentM = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentH}:${currentM}`;

    const { startTime, endTime } = schedule;
    if (startTime <= endTime) {
      return currentTimeStr >= startTime && currentTimeStr <= endTime;
    } else {
      // Overnight window (e.g. 23:00 to 07:00)
      return currentTimeStr >= startTime || currentTimeStr <= endTime;
    }
  }

  /**
   * Evaluate queue state and decide which downloads should start or pause
   */
  public evaluateQueue(
    downloads: DownloadItem[],
    schedule: ScheduleSettings
  ): QueueCheckResult {
    const inScheduleWindow = this.isInsideScheduleWindow(schedule);
    const itemsToStart: DownloadItem[] = [];
    const itemsToPause: string[] = [];

    // Case 1: Outside schedule window while schedule is active
    if (schedule.enabled && !inScheduleWindow) {
      const updatedDownloads = downloads.map((item) => {
        if (item.status === 'downloading') {
          itemsToPause.push(item.id);
          return {
            ...item,
            status: 'queued' as const,
            speed: 0,
            eta: `در انتظار زمان‌بند (شروع در ${schedule.startTime})`,
          };
        }
        return item;
      });

      return {
        updatedDownloads,
        itemsToStart,
        itemsToPause,
      };
    }

    // Case 2: Schedule window is open (or disabled)
    let currentActive = downloads.filter((d) => d.status === 'downloading').length;
    let availableSlots = Math.max(0, this.maxConcurrent - currentActive);

    // Numbering queued items
    let queueCounter = 1;
    const updatedDownloads = downloads.map((item) => {
      if (item.status === 'queued') {
        if (availableSlots > 0) {
          availableSlots--;
          currentActive++;
          itemsToStart.push({
            ...item,
            status: 'downloading',
            eta: 'در حال شروع دانلود چنداتصاله...',
          });
          return {
            ...item,
            status: 'downloading' as const,
            eta: 'در حال شروع دانلود چنداتصاله...',
          };
        } else {
          return {
            ...item,
            queuePosition: queueCounter++,
            eta: `در صف انتظار (نوبت #${queueCounter - 1})`,
          };
        }
      }
      return item;
    });

    return {
      updatedDownloads,
      itemsToStart,
      itemsToPause,
    };
  }

  /**
   * Determine initial state for a newly added download
   */
  public getInitialStatusForNewDownload(
    downloads: DownloadItem[],
    schedule: ScheduleSettings
  ): { status: 'downloading' | 'queued'; eta: string; queuePosition?: number } {
    if (schedule.enabled && !this.isInsideScheduleWindow(schedule)) {
      return {
        status: 'queued',
        eta: `در انتظار زمان‌بند (شروع در ${schedule.startTime})`,
      };
    }

    const activeCount = downloads.filter((d) => d.status === 'downloading').length;
    if (activeCount >= this.maxConcurrent) {
      const queuedCount = downloads.filter((d) => d.status === 'queued').length;
      return {
        status: 'queued',
        eta: `در صف انتظار (نوبت #${queuedCount + 1})`,
        queuePosition: queuedCount + 1,
      };
    }

    return {
      status: 'downloading',
      eta: 'در حال اتصال به سرور...',
    };
  }

  /**
   * Sanitize persisted items on app launch (recovers killed downloads gracefully)
   */
  public sanitizeItemsOnStartup(downloads: DownloadItem[]): DownloadItem[] {
    return downloads.map((item) => {
      if (item.status === 'downloading') {
        // App was closed while downloading; mark as queued/paused with resume capability
        return {
          ...item,
          status: 'queued' as const,
          speed: 0,
          eta: 'آماده برای ادامه دانلود',
          resumable: true,
        };
      }
      return item;
    });
  }
}

export const downloadQueueManager = new DownloadQueueManager(2);
