import React, { useState } from 'react';
import { X, Plus, Link, FileText, Video, Sparkles, Loader2, CheckCircle2, Music, AlertCircle, Layers } from 'lucide-react';
import { DownloadCategory, YtDlpFormat, YtDlpMediaInfo } from '../types';
import { detectCategory } from '../utils/formatters';
import { ytDlpService } from '../services/ytDlpService';

export interface AddDownloadOptions {
  url: string;
  name: string;
  category: DownloadCategory;
  fileSize: number;
  formatId?: string;
  directUrl?: string;
  audioOnly?: boolean;
  thumbnail?: string;
  extractor?: string;
  duration?: string;
}

interface AddDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDownload: (options: AddDownloadOptions) => void;
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
  onAddDownload,
}) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DownloadCategory>('video');
  const [fileSizeMb, setFileSizeMb] = useState('35');
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [selectedDirectUrl, setSelectedDirectUrl] = useState<string>('');
  const [isAudioOnly, setIsAudioOnly] = useState<boolean>(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<YtDlpMediaInfo | null>(null);
  const [extractError, setExtractError] = useState('');

  if (!isOpen) return null;

  const handleUrlChange = (val: string) => {
    setUrl(val);
    setExtractedData(null);
    setExtractError('');
    setSelectedFormatId('');
    setSelectedDirectUrl('');
    setIsAudioOnly(false);

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
        // partial URL
      }
    }
  };

  const handleYtDlpExtract = async () => {
    if (!url.trim()) return;
    setIsExtracting(true);
    setExtractError('');

    try {
      const mediaInfo = await ytDlpService.extractInfo(url.trim());
      setExtractedData(mediaInfo);

      if (mediaInfo.title) {
        const ext = isAudioOnly ? 'mp3' : 'mp4';
        setName(`${mediaInfo.title}.${ext}`);
      }

      // Default to first video format or audio
      if (mediaInfo.formats && mediaInfo.formats.length > 0) {
        const firstFmt = mediaInfo.formats[0];
        setSelectedFormatId(firstFmt.format_id);
        setSelectedDirectUrl(firstFmt.direct_url || firstFmt.url || '');
        if (firstFmt.filesize) {
          setFileSizeMb(Math.round(firstFmt.filesize / (1024 * 1024)).toString());
        }
        setIsAudioOnly(!!firstFmt.is_audio_only);
        setCategory(firstFmt.is_audio_only ? 'music' : 'video');
      }
    } catch (err: any) {
      setExtractError(err.message || 'خطا در استخراج اطلاعات ویدیو');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSelectFormat = (fmt: YtDlpFormat) => {
    setSelectedFormatId(fmt.format_id);
    setSelectedDirectUrl(fmt.direct_url || fmt.url || '');
    const audio = !!fmt.is_audio_only;
    setIsAudioOnly(audio);
    setCategory(audio ? 'music' : 'video');

    if (fmt.filesize) {
      setFileSizeMb(Math.round(fmt.filesize / (1024 * 1024)).toString());
    }

    if (extractedData?.title) {
      const ext = audio ? 'mp3' : 'mp4';
      setName(`${extractedData.title}.${ext}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const ext = isAudioOnly ? '.mp3' : '.mp4';
    let finalName = name.trim();
    if (!finalName) {
      finalName = `media_download_${Date.now()}${ext}`;
    } else if (!finalName.includes('.')) {
      finalName = `${finalName}${ext}`;
    }

    const bytes = Math.max(1024 * 1024, parseFloat(fileSizeMb || '30') * 1024 * 1024);

    onAddDownload({
      url: url.trim(),
      name: finalName,
      category,
      fileSize: bytes,
      formatId: selectedFormatId,
      directUrl: selectedDirectUrl || undefined,
      audioOnly: isAudioOnly,
      thumbnail: extractedData?.thumbnail,
      extractor: extractedData?.extractor,
      duration: extractedData?.duration_string,
    });

    setUrl('');
    setName('');
    setSelectedDirectUrl('');
    setExtractedData(null);
    setExtractError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">افزودن لینک دانلود هوشمند</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">پشتیبانی از ۱۰۰۰+ سایت (اینستاگرام، یوتیوب، تیک‌تاک و فایل مستقیم)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              آدرس اینترنتی (URL) ویدیو یا فایل مستقیم *
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
                    <span>تحلیل...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>بررسی با yt-dlp</span>
                  </>
                )}
              </button>
            </div>
            {extractError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-500 mt-2 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{extractError}</span>
              </div>
            )}
          </div>

          {/* Extracted Video Preview Card */}
          {extractedData && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-center gap-3 animate-fade-in">
              {extractedData.thumbnail && (
                <img
                  src={extractedData.thumbnail}
                  alt="Thumbnail"
                  className="w-16 h-16 rounded-xl object-cover shrink-0 border border-indigo-200 dark:border-indigo-800"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>اطلاعات استخراج شد ({extractedData.extractor})</span>
                  {extractedData.is_playlist && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                      <Layers className="w-3 h-3" />
                      پلی‌لیست ({extractedData.playlist_count || 'چندتایی'})
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={extractedData.title}>
                  {extractedData.title}
                </h4>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>کانال: {extractedData.uploader}</span>
                  {extractedData.duration_string && (
                    <>
                      <span>•</span>
                      <span>مدت: {extractedData.duration_string}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Formats Selection */}
          {extractedData && extractedData.formats && extractedData.formats.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                انتخاب کیفیت و فرمت (ویدیو MP4 یا صوتی MP3):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {extractedData.formats.map((fmt: YtDlpFormat, idx: number) => {
                  const isSelected = selectedFormatId === fmt.format_id;
                  const isAudio = !!fmt.is_audio_only;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectFormat(fmt)}
                      className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{fmt.resolution || (isAudio ? 'MP3 صوتی' : 'MP4 ویدیو')}</span>
                        {isAudio ? <Music className="w-3.5 h-3.5 text-rose-500" /> : <Video className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {fmt.filesize ? `${Math.round(fmt.filesize / (1024 * 1024))} مگابایت` : fmt.format_note || 'حجم متغیر'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              نام ذخیره فایل
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="media.mp4"
                className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                نوع محتوا
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DownloadCategory)}
                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="video">ویدیو (MP4)</option>
                <option value="music">موسیقی / صوت (MP3)</option>
                <option value="document">اسناد</option>
                <option value="software">نرم‌افزار</option>
                <option value="archive">فایل فشرده</option>
                <option value="other">سایر</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                تخمین حجم (مگابایت)
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
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
              <span>شروع دانلود واقعی</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
