import React from 'react';
import { DownloadItem } from '../types';
import { formatBytes, formatSpeed, getCategoryLabel } from '../utils/formatters';
import {
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Video,
  Music,
  FileText,
  Cpu,
  Archive,
  Folder,
  RotateCcw
} from 'lucide-react';

interface DownloadCardProps {
  item: DownloadItem;
  onPauseResume: (id: string) => void;
  onCancelDelete: (item: DownloadItem) => void;
  onRetry: (id: string) => void;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
  item,
  onPauseResume,
  onCancelDelete,
  onRetry,
}) => {
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
            در حال دانلود
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
            تکمیل شده
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
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        
        {/* Icon & Details */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
            {getCategoryIcon(item.category)}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-sm" title={item.name}>
                {item.name}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                {getCategoryLabel(item.category)}
              </span>
            </div>
            
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-lg font-mono" dir="ltr" title={item.url}>
              {item.url}
            </p>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="text-slate-700 dark:text-slate-300 font-semibold">{formatBytes(item.downloadedSize)} / {formatBytes(item.fileSize)}</span>
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
          <span className="text-slate-400">{item.status === 'completed' ? 'تکمیل‌شده' : `${item.progress}%`}</span>
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
                : 'bg-blue-600 animate-pulse'
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

          {item.status === 'paused' && (
            <button
              onClick={() => onPauseResume(item.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition cursor-pointer font-medium"
            >
              <Play className="w-3 h-3" />
              <span>ادامه</span>
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

          {item.status === 'completed' && (
            <button
              onClick={() => alert(`فایل ${item.name} باز شد.`)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer font-medium"
            >
              <ExternalLink className="w-3 h-3" />
              <span>اجرا</span>
            </button>
          )}

          <button
            onClick={copyUrlToClipboard}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer font-medium"
            title="کپی لینک"
          >
            <Copy className="w-3 h-3" />
            <span className="hidden sm:inline">کپی</span>
          </button>
        </div>

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

