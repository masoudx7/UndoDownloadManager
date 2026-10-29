import React, { useState } from 'react';
import { DownloadItem } from '../types';
import { formatBytes, formatSpeed, getCategoryLabel } from '../utils/formatters';
import { fileManagerService } from '../services/fileManagerService';
import {
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Share2,
  Video,
  Music,
  FileText,
  Cpu,
  Archive,
  Folder,
  RotateCcw,
  Zap,
  Clock,
  Check
} from 'lucide-react';

interface DownloadCardProps {
  item: DownloadItem;
  onPauseResume: (id: string) => void;
  onCancelDelete: (item: DownloadItem) => void;
  onRetry: (id: string) => void;
  onOpen?: (item: DownloadItem) => void;
  onShare?: (item: DownloadItem) => void;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
  item,
  onPauseResume,
  onCancelDelete,
  onRetry,
}) => {
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'video':
        return <Video className="w-5 h-5 text-purple-500" />;
      case 'music':
        return <Music className="w-5 h-5 text-rose-500" />;
      case 'document':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'software':
        return <Cpu className="w-5 h-5 text-emerald-500" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-amber-500" />;
      default:
        return <Folder className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case 'downloading':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
            <span>در حال دانلود</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 font-mono">
              ⚡ {item.connections || 4}X
            </span>
          </span>
        );
      case 'queued':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>در صف دانلود</span>
            {item.queuePosition && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/60 font-mono">
                #{item.queuePosition}
              </span>
            )}
          </span>
        );
      case 'paused':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
            <Pause className="w-3 h-3" />
            متوقف شده
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تکمیل شد
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            خطا
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 font-semibold border border-slate-500/20">
            لغو شده
          </span>
        );
    }
  };

  const copyUrlToClipboard = () => {
    navigator.clipboard.writeText(item.url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleOpenFile = async () => {
    try {
      await fileManagerService.openFile(item);
    } catch (err: any) {
      setShareMessage(err?.message || 'خطا در باز کردن فایل');
      setTimeout(() => setShareMessage(null), 3500);
    }
  };

  const handleShareFile = async () => {
    const res = await fileManagerService.shareFile(item);
    if (res.message) {
      setShareMessage(res.message);
      setTimeout(() => setShareMessage(null), 3000);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        
        {/* Thumbnail / Icon & Details */}
        <div className="flex items-start gap-3 min-w-0">
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={item.name}
              className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
              {getCategoryIcon(item.category)}
            </div>
          )}

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-sm" title={item.name}>
                {item.name}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                {item.audioOnly ? 'صوتی MP3' : getCategoryLabel(item.category)}
              </span>
              {item.extractor && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-200 dark:border-indigo-900/40">
                  {item.extractor}
                </span>
              )}
            </div>
            
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-lg font-mono" dir="ltr" title={item.url}>
              {item.url}
            </p>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="text-slate-700 dark:text-slate-300 font-semibold">
                {formatBytes(item.downloadedSize)} / {item.fileSize > 0 ? formatBytes(item.fileSize) : 'نامشخص'}
              </span>
              <span>•</span>
              <span>{item.createdAt}</span>
              {item.status === 'downloading' && (
                <>
                  <span>•</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">{formatSpeed(item.speed)}</span>
                  <span>•</span>
                  <span className="text-slate-400">{item.eta}</span>
                </>
              )}
            </div>

            {item.errorMessage && item.status === 'error' && (
              <p className="text-xs text-rose-500 font-medium pt-1">
                علت خطا: {item.errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          {getStatusBadge()}
        </div>

      </div>

      {/* Progress Bar */}
      <div className="mt-3.5 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span className="text-slate-700 dark:text-slate-300">{item.progress}%</span>
          <span className="text-slate-400">{item.status === 'completed' ? 'تکمیل‌شده' : item.eta}</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              item.status === 'completed'
                ? 'bg-emerald-500'
                : item.status === 'error'
                ? 'bg-rose-500'
                : item.status === 'paused'
                ? 'bg-amber-500'
                : 'bg-blue-600'
            }`}
            style={{ width: `${item.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          {item.status === 'downloading' && (
            <button
              onClick={() => onPauseResume(item.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition cursor-pointer font-medium"
            >
              <Pause className="w-3 h-3" />
              <span>توقف</span>
            </button>
          )}

          {item.status === 'completed' && (
            <>
              <button
                onClick={handleOpenFile}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                <span>پخش / باز کردن</span>
              </button>

              <button
                onClick={handleShareFile}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition cursor-pointer font-medium"
                title="اشتراک‌گذاری فایل"
              >
                <Share2 className="w-3 h-3" />
                <span className="hidden sm:inline">اشتراک‌گذاری</span>
              </button>
            </>
          )}

          {(item.status === 'paused' || item.status === 'queued') && (
            <button
              onClick={() => onPauseResume(item.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition cursor-pointer font-medium"
            >
              <Play className="w-3 h-3" />
              <span>{item.status === 'queued' ? 'شروع نوبت فوری' : 'ادامه دانلود'}</span>
            </button>
          )}

          {item.status === 'error' && (
            <button
              onClick={() => onRetry(item.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>تلاش مجدد</span>
            </button>
          )}

          <button
            onClick={copyUrlToClipboard}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer font-medium"
            title="کپی لینک"
          >
            {copySuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">کپی شد!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="hidden sm:inline">کپی لینک</span>
              </>
            )}
          </button>
        </div>

        {shareMessage && (
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
            {shareMessage}
          </span>
        )}

        {/* Delete / Cancel */}
        <button
          onClick={() => onCancelDelete(item)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer font-medium"
          title="حذف"
        >
          <Trash2 className="w-3 h-3" />
          <span>حذف</span>
        </button>
      </div>

    </div>
  );
};
