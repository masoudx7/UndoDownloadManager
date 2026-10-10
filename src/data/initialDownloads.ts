import { DownloadItem } from '../types';

export const initialDownloads: DownloadItem[] = [
  {
    id: 'dl-1',
    name: 'Ubuntu_24.04_LTS_Desktop_AMD64.iso',
    url: 'https://releases.ubuntu.com/24.04/ubuntu-24.04-desktop-amd64.iso',
    category: 'software',
    fileSize: 5242880000, // ~5.0 GB
    downloadedSize: 3145728000, // ~3.0 GB
    progress: 60,
    speed: 4194304, // 4 MB/s
    status: 'downloading',
    createdAt: '۱۴۰۳/۰۷/۰۱ - ۱۰:۳۰',
    eta: '۸ دقیقه مانده',
  },
  {
    id: 'dl-2',
    name: 'React_19_Masterclass_Course_Part1.mp4',
    url: 'https://example.com/videos/react-19-masterclass-1.mp4',
    category: 'video',
    fileSize: 1258291200, // ~1.2 GB
    downloadedSize: 1258291200,
    progress: 100,
    speed: 0,
    status: 'completed',
    createdAt: '۱۴۰۳/۰۶/۳۰ - ۱۸:۱۵',
    eta: 'تکمیل شده',
  },
  {
    id: 'dl-3',
    name: 'Fullstack_Architecture_Blueprint.pdf',
    url: 'https://example.com/docs/architecture-blueprint-2026.pdf',
    category: 'document',
    fileSize: 25165824, // 24 MB
    downloadedSize: 12582912, // 12 MB
    progress: 50,
    speed: 1048576, // 1 MB/s
    status: 'paused',
    createdAt: '۱۴۰۳/۰۷/۰۲ - ۰۹:۰۰',
    eta: 'متوقف شده',
  },
  {
    id: 'dl-4',
    name: 'Ambient_Focus_LoFi_Album_FLAC.zip',
    url: 'https://example.com/music/lofi-focus-album-flac.zip',
    category: 'archive',
    fileSize: 450000000, // ~430 MB
    downloadedSize: 450000000,
    progress: 100,
    speed: 0,
    status: 'completed',
    createdAt: '۱۴۰۳/۰۶/۲۹ - ۲۲:۴۰',
    eta: 'تکمیل شده',
  },
  {
    id: 'dl-5',
    name: 'VSC_Extensions_Offline_Pack.vsix',
    url: 'https://example.com/tools/vsc-extensions-pack.vsix',
    category: 'software',
    fileSize: 180000000, // ~171 MB
    downloadedSize: 45000000, // ~42 MB
    progress: 25,
    speed: 2097152, // 2 MB/s
    status: 'downloading',
    createdAt: '۱۴۰۳/۰۷/۰۲ - ۱۱:۱۰',
    eta: '۱ دقیقه مانده',
  },
];
