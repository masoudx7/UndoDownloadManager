export type DownloadCategory = 'all' | 'video' | 'music' | 'document' | 'software' | 'archive' | 'other';

export type DownloadStatus = 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';

export interface DownloadItem {
  id: string;
  name: string;
  url: string;
  category: DownloadCategory;
  fileSize: number; // in bytes
  downloadedSize: number; // in bytes
  progress: number; // 0 to 100
  speed: number; // bytes per second
  status: DownloadStatus;
  createdAt: string;
  eta: string; // Estimated time remaining
  thumbnail?: string;
}

export interface UndoNotification {
  id: string;
  message: string;
  item: DownloadItem;
  timestamp: number;
}

export type SortOption = 'date_desc' | 'date_asc' | 'name' | 'size' | 'progress';

export interface ScheduleSettings {
  enabled: boolean;
  startTime: string; // e.g. "02:00"
  endTime: string;   // e.g. "07:00"
}

