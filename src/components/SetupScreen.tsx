import React, { useState, useEffect } from 'react';
import { Download, Cpu, ShieldCheck, RefreshCw, AlertCircle, HardDrive } from 'lucide-react';
import { binaryManager } from '../services/binaryManagerService';
import { formatBytes } from '../utils/formatters';

interface SetupScreenProps {
  onSetupComplete: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onSetupComplete }) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(39 * 1024 * 1024);
  const [error, setError] = useState<string | null>(null);

  const startDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await binaryManager.downloadBinaries((prog, downloaded, total) => {
        setProgress(prog);
        setDownloadedBytes(downloaded);
        setTotalBytes(total);
      });
      onSetupComplete();
    } catch (err: any) {
      setError(err.message || 'خطا در دانلود باینری‌ها. لطفاً اتصال اینترنت خود را بررسی کنید.');
      setDownloading(false);
    }
  };

  useEffect(() => {
    // Auto-start setup on mount
    startDownload();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-6 font-sans text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6 text-white">
          {downloading ? (
            <Download className="w-10 h-10 animate-bounce" />
          ) : error ? (
            <AlertCircle className="w-10 h-10" />
          ) : (
            <Cpu className="w-10 h-10" />
          )}
        </div>

        <h1 className="text-2xl font-black mb-2 tracking-tight text-white">راه‌اندازی موتور هوشمند</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          برای دانلود و پردازش پرسرعت ویدیوها و فایل‌ها، در حال آماده‌سازی و دریافت موتور بومی پردازشی هستیم. این کار فقط یک‌بار انجام می‌شود.
        </p>

        {/* Progress Section */}
        {downloading && (
          <div className="w-full space-y-3 mb-6">
            <div className="flex justify-between text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                در حال دریافت موتور پردازش...
              </span>
              <span className="text-cyan-400 font-bold">{progress}%</span>
            </div>

            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{formatBytes(downloadedBytes)} از {formatBytes(totalBytes)}</span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> فضای داخلی ایمن
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="w-full bg-red-950/40 border border-red-900/50 rounded-2xl p-4 mb-6 text-right">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-200 mb-1">خطا در راه‌اندازی</p>
                <p className="text-[11px] text-red-300/80 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!downloading && (
          <button
            onClick={startDownload}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            تلاش مجدد و ادامه
          </button>
        )}

        <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>امن، بهینه و بدون تبلیغات</span>
        </div>

      </div>
    </div>
  );
};
