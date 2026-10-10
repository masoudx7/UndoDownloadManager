export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '۰ بایت';
  const k = 1024;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec === 0) return '۰ بایت/ثانیه';
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
