export type DownloadCategory = 'all' | 'video' | 'music' | 'document' | 'software' | 'archive' | 'other';

export type DownloadStatus = 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled' | 'queued';

export interface YtDlpFormat {
  format_id: string;
  ext: string;
  resolution?: string;
  format_note?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  vcodec?: string;
  acodec?: string;
  is_audio_only?: boolean;
  url?: string;
  direct_url?: string;
}

export interface YtDlpMediaInfo {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  duration_string?: string;
  uploader?: string;
  extractor?: string;
  webpage_url?: string;
  formats: YtDlpFormat[];
  is_playlist?: boolean;
  playlist_count?: number;
}

export interface YtDlpProgressEvent {
  downloadId: string;
  status: DownloadStatus;
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  speedFormatted?: string;
  eta: string;
  filename?: string;
  localPath?: string;
  error?: string;
  connections?: number;
}

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
  formatId?: string;
  directUrl?: string;
  audioOnly?: boolean;
  localPath?: string;
  errorMessage?: string;
  duration?: string;
  extractor?: string;
  connections?: number;
  retryCount?: number;
  queuePosition?: number;
  resumable?: boolean;
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
