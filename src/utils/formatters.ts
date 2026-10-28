export const formatBytes = (bytes: number | string): string => {
  const num = typeof bytes === 'number' ? bytes : parseFloat(String(bytes).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return '۰ بایت';
  const k = 1024;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  const safeIdx = Math.min(i, sizes.length - 1);
  return parseFloat((num / Math.pow(k, safeIdx)).toFixed(1)) + ' ' + sizes[safeIdx];
};

export const formatSpeed = (bytesPerSec: number | string): string => {
  if (!bytesPerSec || bytesPerSec === 0 || bytesPerSec === '0') return '۰ بایت/ثانیه';
  if (typeof bytesPerSec === 'string' && (bytesPerSec.includes('/s') || bytesPerSec.includes('ثانیه'))) {
    return bytesPerSec;
  }
  return formatBytes(bytesPerSec) + '/ثانیه';
};

export const getCategoryLabel = (category: string): string => {
  switch (category) {
    case 'video':
      return 'ویدیو';
    case 'music':
      return 'موسیقی';
    case 'document':
      return 'اسناد';
    case 'software':
      return 'نرم‌افزار';
    case 'archive':
      return 'فایل فشرده';
    case 'other':
      return 'سایر';
    default:
      return 'همه';
  }
};

export const detectCategory = (urlOrName: string): 'video' | 'music' | 'document' | 'software' | 'archive' | 'other' => {
  const lower = urlOrName.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.avi') || lower.includes('video')) return 'video';
  if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.flac') || lower.includes('music')) return 'music';
  if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.xlsx') || lower.endsWith('.txt') || lower.includes('doc')) return 'document';
  if (lower.endsWith('.exe') || lower.endsWith('.msi') || lower.endsWith('.dmg') || lower.endsWith('.vsix') || lower.endsWith('.apk')) return 'software';
  if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z') || lower.endsWith('.tar') || lower.endsWith('.iso')) return 'archive';
  return 'other';
};
