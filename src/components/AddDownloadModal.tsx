import React, { useState } from 'react';
import { X, Plus, Download, Link, FileText, Video, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { DownloadCategory } from '../types';
import { detectCategory } from '../utils/formatters';

interface AddDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDownload: (url: string, name: string, category: DownloadCategory, fileSize: number) => void;
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
  onAddDownload,
}) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DownloadCategory>('video');
  const [fileSizeMb, setFileSizeMb] = useState('45');

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [extractError, setExtractError] = useState('');

  if (!isOpen) return null;

  const handleUrlChange = (val: string) => {
    setUrl(val);
    setExtractedData(null);
    setExtractError('');
    if (val) {
      try {
        const urlObj = new URL(val);
        const segments = urlObj.pathname.split('/');
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && !name) {
          const decoded = decodeURIComponent(lastSegment);
          setName(decoded);
          setCategory(detectCategory(decoded));
        }
      } catch (e) {
        // invalid url yet
      }
    }
  };

  const handleYtDlpExtract = async () => {
    if (!url.trim()) return;
    setIsExtracting(true);
    setExtractError('');
    try {
      const res = await fetch('/api/ytdlp-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setExtractedData(data.video);
        if (data.video.title) {
          setName(`${data.video.title}.mp4`);
        }
        setCategory('video');
      } else {
        setExtractError(data.error || 'خطا در استخراج اطلاعات ویدیو');
      }
    } catch (err: any) {
      setExtractError(err.message || 'خطا در اتصال به سرور yt-dlp');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const finalName = name.trim() || 'video_instagram.mp4';
    const bytes = parseFloat(fileSizeMb || '40') * 1024 * 1024;

    onAddDownload(url.trim(), finalName, category, bytes);
    setUrl('');
    setName('');
    setExtractedData(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">افزودن لینک دانلود</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">لینک مستقیم یا ویدیو</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              لینک پست یا ریلز اینستاگرام / یوتیوب / فایل *
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <Link className="w-4 h-4" />
                </span>
                <input
                  type="url"
                  required
                  dir="ltr"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://www.instagram.com/reel/... یا https://youtube.com/..."
                  className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <button
                type="button"
                onClick={handleYtDlpExtract}
                disabled={isExtracting || !url.trim()}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-4 py-3 rounded-xl text-xs sm:text-sm transition cursor-pointer shrink-0 shadow-sm"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>بررسی...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>استخراج yt-dlp</span>
                  </>
                )}
              </button>
            </div>
            {extractError && <p className="text-xs text-rose-500 mt-1">{extractError}</p>}
          </div>

          {/* Extracted Video Preview Card */}
          {extractedData && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-3 animate-fade-in">
              <img
                src={extractedData.thumbnail}
                alt="Thumbnail"
                className="w-16 h-16 rounded-xl object-cover shrink-0 border border-indigo-200 dark:border-indigo-800"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>اطلاعات ویدیو با موفقیت استخراج شد (yt-dlp)</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={extractedData.title}>
                  {extractedData.title}
                </h4>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>کانال: {extractedData.uploader}</span>
                  <span>•</span>
                  <span>زمان: {extractedData.duration}</span>
                </div>
              </div>
            </div>
          )}

          {/* Formats Selection if extracted */}
          {extractedData && extractedData.formats && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                انتخاب کیفیت و فرمت MP4:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {extractedData.formats.map((fmt: any, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFileSizeMb(Math.round(fmt.filesize / (1024 * 1024)).toString());
                      if (fmt.format_id === 'mp3') {
                        setCategory('music');
                      } else {
                        setCategory('video');
                      }
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-500 text-center cursor-pointer transition"
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{fmt.resolution}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{Math.round(fmt.filesize / (1024 * 1024))} مگابایت</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              نام خروجی فایل
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام فایل.mp4"
                className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                دسته‌بندی
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DownloadCategory)}
                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="video">ویدیو (MP4)</option>
                <option value="music">موسیقی (MP3)</option>
                <option value="document">اسناد</option>
                <option value="software">نرم‌افزار</option>
                <option value="archive">فایل فشرده</option>
                <option value="other">سایر</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                حجم (مگابایت)
              </label>
              <input
                type="number"
                min="1"
                max="50000"
                value={fileSizeMb}
                onChange={(e) => setFileSizeMb(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-md shadow-blue-600/20 text-xs sm:text-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>شروع دانلود MP4</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
