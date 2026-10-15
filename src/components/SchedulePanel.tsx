import React, { useState } from 'react';
import { ScheduleSettings } from '../types';
import { Clock, PlayCircle, PauseCircle, FolderTree, CheckCircle2, Sparkles, RefreshCw, Zap } from 'lucide-react';
import { initDownloadDirectories, CATEGORY_FOLDERS } from '../utils/capacitorStorageService';

interface SchedulePanelProps {
  schedule: ScheduleSettings;
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleSettings>>;
  isCurrentlyInScheduleWindow: boolean;
  concurrentLimit?: number;
  onConcurrentLimitChange?: (limit: number) => void;
}

export const SchedulePanel: React.FC<SchedulePanelProps> = ({
  schedule,
  setSchedule,
  isCurrentlyInScheduleWindow,
  concurrentLimit = 2,
  onConcurrentLimitChange,
}) => {
  const [folderStatus, setFolderStatus] = useState<string | null>(null);
  const [isInitializingFolders, setIsInitializingFolders] = useState<boolean>(false);

  const [isUpdatingEngine, setIsUpdatingEngine] = useState<boolean>(false);
  const [updateEngineResult, setUpdateEngineResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);

  const handleToggle = () => {
    setSchedule((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSchedule((prev) => ({ ...prev, startTime: e.target.value }));
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSchedule((prev) => ({ ...prev, endTime: e.target.value }));
  };

  const handleInitFolders = async () => {
    setIsInitializingFolders(true);
    setFolderStatus(null);
    const res = await initDownloadDirectories();
    setIsInitializingFolders(false);
    setFolderStatus(res.message);
  };

  const handleUpdateEngine = async () => {
    setIsUpdatingEngine(true);
    setUpdateEngineResult(null);
    try {
      const res = await fetch('/api/update-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setUpdateEngineResult({
          success: true,
          message: data.message,
          version: data.version,
        });
      } else {
        setUpdateEngineResult({
          success: false,
          message: data.error || 'خطا در بروزرسانی موتور دانلود',
        });
      }
    } catch (err: any) {
      setUpdateEngineResult({
        success: false,
        message: err.message || 'خطا در ارتباط با سرور بروزرسانی',
      });
    } finally {
      setIsUpdatingEngine(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md transition-all duration-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          {/* Title & Description */}
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl shrink-0 ${schedule.enabled ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">زمان‌بند هوشمند دانلود (تایمر اتوماتیک)</h2>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${schedule.enabled ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  {schedule.enabled ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                برنامه به‌طور خودکار در بازه زمانی تعیین‌شده دانلودها را شروع و متوقف می‌کند.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              schedule.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                schedule.enabled ? 'translate-x-0' : '-translate-x-7'
              }`}
            />
          </button>

        </div>

        {/* Time Pickers & Status Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          {/* Start Time */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <PlayCircle className="w-4 h-4 text-emerald-500" />
              <span>ساعت شروع اتوماتیک</span>
            </label>
            <input
              type="time"
              value={schedule.startTime}
              onChange={handleStartTimeChange}
              disabled={!schedule.enabled}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <PauseCircle className="w-4 h-4 text-amber-500" />
              <span>ساعت توقف اتوماتیک</span>
            </label>
            <input
              type="time"
              value={schedule.endTime}
              onChange={handleEndTimeChange}
              disabled={!schedule.enabled}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Current Schedule Status Indicator */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shrink-0 ${schedule.enabled && isCurrentlyInScheduleWindow ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">وضعیت زمان‌بند:</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {!schedule.enabled
                  ? 'غیرفعال'
                  : isCurrentlyInScheduleWindow
                  ? '🟢 در بازه مجاز دانلود'
                  : '🔴 خارج از بازه زمانی'}
              </p>
            </div>
          </div>

        </div>

        {/* Concurrent Downloads Limit Selector */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>محدودیت دانلودهای همزمان (Concurrent Queue)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold font-mono">
                {concurrentLimit} دانلود فعال
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              دانلودهای بیشتر در صف انتظار قرار گرفته و با پایان هر دانلود، نوبت بعدی خودکار شروع می‌شود.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onConcurrentLimitChange && onConcurrentLimitChange(num)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  concurrentLimit === num
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Download Engine Update Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md transition-all duration-200 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>بروزرسانی هسته دانلود</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold">Core v2026</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              با فشردن دکمه زیر، موتور استخراج و دانلود ویدیو و لینک‌ها به آخرین نسخه پایدار بروزرسانی می‌شود تا سازگاری کامل با تغییرات جدید پلتفرم‌ها حفظ گردد.
            </p>
          </div>
        </div>

        {updateEngineResult && (
          <div className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${updateEngineResult.success ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'}`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">{updateEngineResult.success ? 'بروزرسانی موفقیت‌آمیز' : 'خطا در بروزرسانی'}</p>
              <p className="mt-0.5">{updateEngineResult.message}</p>
              {updateEngineResult.version && <p className="mt-1 font-mono text-[11px] opacity-80">نسخه فعلی: {updateEngineResult.version}</p>}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleUpdateEngine}
            disabled={isUpdatingEngine}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/25 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdatingEngine ? 'animate-spin' : ''}`} />
            <span>{isUpdatingEngine ? 'در حال بروزرسانی هسته...' : 'بروزرسانی موتور دانلود'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


