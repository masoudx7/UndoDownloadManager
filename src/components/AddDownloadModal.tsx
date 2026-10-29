import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Link2,
  FileText,
  Video,
  Sparkles,
  Loader2,
  CheckCircle2,
  Music,
  AlertCircle,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
  initialUrl?: string;
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
  onAddDownload,
  initialUrl = '',
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DownloadCategory>('video');
  const [fileSizeMb, setFileSizeMb] = useState('35');
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [selectedDirectUrl, setSelectedDirectUrl] = useState<string>('');
  const [isAudioOnly, setIsAudioOnly] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<YtDlpMediaInfo | null>(null);
  const [extractError, setExtractError] = useState('');

  useEffect(() => {
    if (initialUrl && isOpen) {
      handleUrlChange(initialUrl);
      extractMediaInfo(initialUrl);
    }
  }, [initialUrl, isOpen]);

  if (!isOpen) return null;

  const handleUrlChange = (val: string) => {
    setUrl(val);
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
        // partial URL
      }
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().startsWith('http')) {
          handleUrlChange(text.trim());
          extractMediaInfo(text.trim());
        }
      }
    } catch (e) {
      console.warn('Clipboard read error:', e);
    }
  };

  const extractMediaInfo = async (targetUrl: string) => {
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl || !cleanUrl.startsWith('http')) return;

    setIsExtracting(true);
    setExtractError('');

    try {
      const mediaInfo = await ytDlpService.extractInfo(cleanUrl);
      setExtractedData(mediaInfo);

      if (mediaInfo.title) {
        const ext = isAudioOnly ? 'mp3' : 'mp4';
        setName(`${mediaInfo.title}.${ext}`);
      }

      // Default to best MP4 video or audio
      if (mediaInfo.formats && mediaInfo.formats.length > 0) {
        // Find best video format
        const bestVideo = mediaInfo.formats.find(f => !f.is_audio_only) || mediaInfo.formats[0];
        setSelectedFormatId(bestVideo.format_id);
        setSelectedDirectUrl(bestVideo.direct_url || bestVideo.url || '');
        if (bestVideo.filesize) {
          setFileSizeMb(Math.round(bestVideo.filesize / (1024 * 1024)).toString());
        }
        setIsAudioOnly(!!bestVideo.is_audio_only);
        setCategory(bestVideo.is_audio_only ? 'music' : 'video');
      }
    } catch (err: any) {
      setExtractError(err.message || 'امکان دریافت خودکار مشخصات وجود نداشت، اما می‌توانید مستقیماً دکمه دانلود را بزنید.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    const ext = isAudioOnly ? '.mp3' : '.mp4';
    let finalName = name.trim();
    if (!finalName) {
      finalName = `media_${Date.now()}${ext}`;
    } else if (!finalName.includes('.')) {
      finalName = `${finalName}${ext}`;
    }

    const bytes = Math.max(1024 * 1024, parseFloat(fileSizeMb || '30') * 1024 * 1024);

    onAddDownload({
      url: cleanUrl,
      name: finalName,
      category,
      fileSize: bytes,
      formatId: selectedFormatId || 'best',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">دانلود ویدیو یا فایل جدید</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">اینستاگرام، یوتیوب، آپارات، تلگرام، تیک‌تاک یا لینک مستقیم</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* URL Input Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              آدرس اینترنتی (لینک دانلود)
            </label>
            <div className="space-y-2">
              <div className="relative flex items-center">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <Link2 className="w-4 h-4" />
                </span>
                <input
                  type="url"
                  required
                  dir="ltr"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://..."
                  className="w-full pr-10 pl-24 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner"
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="absolute left-2.5 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>چسباندن</span>
                </button>
              </div>

              {/* Action row under input */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">پشتیبانی از تمام فرمت‌ها و وب‌سایت‌ها</span>
                <button
                  type="button"
                  onClick={() => extractMediaInfo(url)}
                  disabled={isExtracting || !url.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال شناسایی کیفیت‌ها...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>شناسایی کیفیت‌ها</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {extractError && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 mt-2 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200 dark:border-amber-900/40">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{extractError}</span>
              </div>
            )}
          </div>

          {/* Extracted Preview Card */}
          {extractedData && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 flex items-center gap-3 animate-fade-in shadow-xs">
              {extractedData.thumbnail ? (
                <img
                  src={extractedData.thumbnail}
                  alt="Thumbnail"
                  className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Video className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ویدیو آماده دانلود است</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={extractedData.title}>
                  {extractedData.title}
                </h4>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  {extractedData.uploader && <span>کانال: {extractedData.uploader}</span>}
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
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                کیفیت دلخواه برای دانلود:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {extractedData.formats.slice(0, 6).map((fmt: YtDlpFormat, idx: number) => {
                  const isSelected = selectedFormatId === fmt.format_id;
                  const isAudio = !!fmt.is_audio_only;
                  const label = fmt.resolution || (isAudio ? 'MP3 صوتی' : 'MP4 ویدیویی');
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectFormat(fmt)}
                      className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{label}</span>
                        {isAudio ? (
                          <Music className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <Video className="w-3.5 h-3.5 text-blue-500" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>{fmt.ext.toUpperCase()}</span>
                        <span>{fmt.filesize ? `${Math.round(fmt.filesize / (1024 * 1024))} مگابایت` : 'کیفیت برتر'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* File Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              نام فایل
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام دلخواه فایل..."
                className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          {/* Optional Advanced Settings Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer font-medium"
            >
              <span>تنظیمات پیشرفته دسته‌بندی</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    دسته‌بندی
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DownloadCategory)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="video">ویدیو (MP4)</option>
                    <option value="music">موسیقی (MP3)</option>
                    <option value="document">اسناد</option>
                    <option value="software">نرم‌افزار</option>
                    <option value="archive">فشرده</option>
                    <option value="other">سایر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    حجم تقریبی (مگابایت)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={fileSizeMb}
                    onChange={(e) => setFileSizeMb(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={!url.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-2xl shadow-lg shadow-blue-600/25 text-xs sm:text-sm transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>شروع دانلود</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
