import { DownloadItem } from '../types';

export const initialDownloads: DownloadItem[] = [
  {
    id: 'dl-completed-1',
    name: 'Instagram_Creative_Reel.mp4',
    url: 'https://www.instagram.com/reel/C34_sample/',
    category: 'video',
    fileSize: 18874368, // ~18 MB
    downloadedSize: 18874368,
    progress: 100,
    speed: 0,
    status: 'completed',
    createdAt: '۱۴۰۳/۰۷/۱۰ - ۱۲:۳۰',
    eta: 'تکمیل شده',
    thumbnail: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&auto=format&fit=crop&q=80',
    extractor: 'Instagram',
  },
  {
    id: 'dl-completed-2',
    name: 'LoFi_Relaxing_Soundtrack.mp3',
    url: 'https://soundcloud.com/sample/lofi-relax',
    category: 'music',
    fileSize: 8388608, // ~8 MB
    downloadedSize: 8388608,
    progress: 100,
    speed: 0,
    status: 'completed',
    createdAt: '۱۴۰۳/۰۷/۰۹ - ۱۸:۴۵',
    eta: 'تکمیل شده',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    audioOnly: true,
    extractor: 'SoundCloud',
  },
];
