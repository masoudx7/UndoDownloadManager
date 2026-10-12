import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DownloadItem, DownloadCategory, DownloadStatus, SortOption, UndoNotification, ScheduleSettings } from './types';
import { initialDownloads } from './data/initialDownloads';
import { Header } from './components/Header';
import { CategoryTabs } from './components/CategoryTabs';
import { SearchBar } from './components/SearchBar';
import { DownloadCard } from './components/DownloadCard';
import { AddDownloadModal } from './components/AddDownloadModal';
import { CoinShopModal } from './components/CoinShopModal';
import { UndoSnackbar } from './components/UndoSnackbar';
import { SchedulePanel } from './components/SchedulePanel';
import { Download, Sparkles, FolderOpen, Clock, ListFilter, Pause, Play, CheckCheck, Trash2 } from 'lucide-react';
import { formatBytes } from './utils/formatters';
import { billingService, PRODUCT_SKUS } from './utils/billing';

const STORAGE_KEY = 'undo_downloader_items_v1';
const DARK_MODE_KEY = 'undo_downloader_dark_mode';
const SCHEDULE_KEY = 'undo_downloader_schedule_v1';
const FREE_DOWNLOADS_KEY = 'undo_downloader_free_downloads_v1';
const PURCHASED_COINS_KEY = 'undo_downloader_purchased_coins_v1';
const UNLIMITED_KEY = 'undo_downloader_unlimited_v1';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(DARK_MODE_KEY);
      if (saved !== null) return JSON.parse(saved);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load downloads from localStorage', e);
    }
    return initialDownloads;
  });

  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>(() => {
    try {
      const saved = localStorage.getItem(SCHEDULE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      enabled: false,
      startTime: '02:00',
      endTime: '07:00',
    };
  });

  const [freeDownloadsRemaining, setFreeDownloadsRemaining] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(FREE_DOWNLOADS_KEY);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return 5; // 5 free downloads per month
  });

  const [purchasedCoins, setPurchasedCoins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(PURCHASED_COINS_KEY);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return 0;
  });

  const [isUnlimited, setIsUnlimited] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(UNLIMITED_KEY);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return false;
  });

  const [activeMainTab, setActiveMainTab] = useState<'active' | 'completed' | 'schedule'>('active');
  const [selectedCategory, setSelectedCategory] = useState<DownloadCategory>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCoinShopOpen, setIsCoinShopOpen] = useState<boolean>(false);
  const [undoNotification, setUndoNotification] = useState<UndoNotification | null>(null);
  const [isCurrentlyInScheduleWindow, setIsCurrentlyInScheduleWindow] = useState<boolean>(false);

  // Sync dark mode class with HTML document
  useEffect(() => {
    try {
      localStorage.setItem(DARK_MODE_KEY, JSON.stringify(darkMode));
    } catch (e) {}

    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Persist downloads to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
    } catch (e) {
      console.error('Failed to save downloads', e);
    }
  }, [downloads]);

  // Persist schedule to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduleSettings));
    } catch (e) {}
  }, [scheduleSettings]);

  // Persist user coins & downloads status
  useEffect(() => {
    try {
      localStorage.setItem(FREE_DOWNLOADS_KEY, JSON.stringify(freeDownloadsRemaining));
      localStorage.setItem(PURCHASED_COINS_KEY, JSON.stringify(purchasedCoins));
      localStorage.setItem(UNLIMITED_KEY, JSON.stringify(isUnlimited));
    } catch (e) {}
  }, [freeDownloadsRemaining, purchasedCoins, isUnlimited]);

  // Schedule time window checker & auto start/stop
  useEffect(() => {
    const checkWindow = () => {
      if (!scheduleSettings.enabled) {
        setIsCurrentlyInScheduleWindow(false);
        return;
      }
      const now = new Date();
      const currentH = now.getHours().toString().padStart(2, '0');
      const currentM = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentH}:${currentM}`;

      const { startTime, endTime } = scheduleSettings;
      let inWindow = false;
      if (startTime <= endTime) {
        inWindow = currentTimeStr >= startTime && currentTimeStr <= endTime;
      } else {
        inWindow = currentTimeStr >= startTime || currentTimeStr <= endTime;
      }

      setIsCurrentlyInScheduleWindow(inWindow);

      if (scheduleSettings.enabled) {
        setDownloads((prev) =>
          prev.map((item) => {
            if (inWindow) {
              if (item.status === 'paused' && (item.eta.includes('متوقف') || item.eta.includes('زمان‌بند'))) {
                return { ...item, status: 'downloading', speed: 2097152, eta: 'در حال دانلود (تایمر خودکار)' };
              }
            } else {
              if (item.status === 'downloading') {
                return { ...item, status: 'paused', speed: 0, eta: 'متوقف‌شده توسط زمان‌بند' };
              }
            }
            return item;
          })
        );
      }
    };

    checkWindow();
    const timer = setInterval(checkWindow, 15000);
    return () => clearInterval(timer);
  }, [scheduleSettings.enabled, scheduleSettings.startTime, scheduleSettings.endTime]);

  // Real-time download simulation loop
  useEffect(() => {
    const timer = setInterval(() => {
      setDownloads((prev) => {
        const updated = prev.map((item) => {
          if (item.status !== 'downloading') return item;

          const increment = Math.floor(Math.random() * 2097152) + 1048576; // 1MB to 3MB per tick
          const newDownloaded = Math.min(item.fileSize, item.downloadedSize + increment);
          const newProgress = Math.floor((newDownloaded / item.fileSize) * 100);

          if (newDownloaded >= item.fileSize) {
            return {
              ...item,
              downloadedSize: item.fileSize,
              progress: 100,
              speed: 0,
              status: 'completed' as DownloadStatus,
              eta: 'تکمیل شده',
            };
          }

          const remainingBytes = item.fileSize - newDownloaded;
          const secondsLeft = Math.ceil(remainingBytes / item.speed);
          const etaText = secondsLeft < 60 ? `${secondsLeft} ثانیه مانده` : `${Math.ceil(secondsLeft / 60)} دقیقه مانده`;

          return {
            ...item,
            downloadedSize: newDownloaded,
            progress: newProgress,
            eta: etaText,
          };
        });

        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handlers
  const handlePauseResume = (id: string) => {
    setDownloads((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.status === 'downloading') {
          return { ...item, status: 'paused', speed: 0, eta: 'متوقف شده' };
        }
        if (item.status === 'paused' || item.status === 'error') {
          return { ...item, status: 'downloading', speed: 2097152, eta: 'در حال محاسبه...' };
        }
        return item;
      })
    );
  };

  const handleRetry = (id: string) => {
    setDownloads((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return { ...item, status: 'downloading', speed: 2097152, eta: 'در حال شروع...' };
      })
    );
  };

  const handleCancelDelete = (itemToCancel: DownloadItem) => {
    setDownloads((prev) => prev.filter((d) => d.id !== itemToCancel.id));
    setUndoNotification({
      id: uuidv4(),
      message: `فایل ${itemToCancel.name} لغو و حذف شد`,
      item: itemToCancel,
      timestamp: Date.now(),
    });
  };

  const handleUndo = (itemToRestore: DownloadItem) => {
    setDownloads((prev) => [itemToRestore, ...prev]);
    setUndoNotification(null);
  };

  const handleAddDownload = (url: string, name: string, category: DownloadCategory, fileSize: number) => {
    if (!isUnlimited) {
      if (freeDownloadsRemaining > 0) {
        setFreeDownloadsRemaining((prev) => prev - 1);
      } else if (purchasedCoins > 0) {
        setPurchasedCoins((prev) => prev - 1);
      } else {
        setIsCoinShopOpen(true);
        alert('موجودی دانلود رایگان ماهانه و سکه‌های شما به پایان رسیده است. لطفاً بسته خرید سکه یا اشتراک تهیه کنید.');
        return;
      }
    }

    const newItem: DownloadItem = {
      id: uuidv4(),
      name,
      url,
      category,
      fileSize,
      downloadedSize: 0,
      progress: 0,
      speed: 3145728, // 3MB/s
      status: scheduleSettings.enabled && !isCurrentlyInScheduleWindow ? 'paused' : 'downloading',
      createdAt: new Date().toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      eta: scheduleSettings.enabled && !isCurrentlyInScheduleWindow ? 'متوقف‌شده توسط زمان‌بند' : 'محاسبه زمان...',
    };

    setDownloads((prev) => [newItem, ...prev]);
  };

  const handleBuyPackage = async (type: 'coins_10' | 'coins_30' | 'unlimited_1m' | 'unlimited_3m' | 'unlimited') => {
    let sku: string = PRODUCT_SKUS.COINS_10;
    if (type === 'coins_30') sku = PRODUCT_SKUS.COINS_30;
    else if (type === 'unlimited_1m') sku = PRODUCT_SKUS.UNLIMITED_1M;
    else if (type === 'unlimited_3m') sku = PRODUCT_SKUS.UNLIMITED_3M;
    else if (type === 'unlimited') sku = PRODUCT_SKUS.UNLIMITED_1Y;

    const result = await billingService.purchase(sku);
    if (!result.success) {
      alert(result.error || 'خرید ناموفق بود.');
      return;
    }

    if (type === 'coins_10') {
      setPurchasedCoins((prev) => prev + 10);
      alert('بسته ۱۰ تایی (۷۹,۰۰۰ تومان) با موفقیت خریداری شد و ۱۰ دانلود به حساب شما اضافه گردید!');
    } else if (type === 'coins_30') {
      setPurchasedCoins((prev) => prev + 30);
      alert('بسته ۳۰ تایی (۱۷۹,۰۰۰ تومان) با موفقیت خریداری شد و ۳۰ دانلود به حساب شما اضافه گردید!');
    } else if (type === 'unlimited_1m') {
      setIsUnlimited(true);
      alert('اشتراک ۱ ماهه نامحدود (۸۹,۰۰۰ تومان) با موفقیت فعال شد! اکنون به مدت ۳۰ روز می‌توانید به صورت نامحدود دانلود کنید.');
    } else if (type === 'unlimited_3m') {
      setIsUnlimited(true);
      alert('اشتراک ۳ ماهه نامحدود (۱۹۹,۰۰۰ تومان) با موفقیت فعال شد! اکنون به مدت ۹۰ روز می‌توانید به صورت نامحدود دانلود کنید.');
    } else if (type === 'unlimited') {
      setIsUnlimited(true);
      alert('اشتراک یکساله نامحدود (۳۹۹,۰۰۰ تومان) با موفقیت فعال شد! اکنون می‌توانید به صورت نامحدود دانلود کنید.');
    }
    setIsCoinShopOpen(false);
  };

  const handleClearCompleted = () => {
    setDownloads((prev) => prev.filter((d) => d.status !== 'completed'));
  };

  // Category counts
  const counts: Record<DownloadCategory, number> = {
    all: downloads.length,
    video: downloads.filter((d) => d.category === 'video').length,
    music: downloads.filter((d) => d.category === 'music').length,
    document: downloads.filter((d) => d.category === 'document').length,
    software: downloads.filter((d) => d.category === 'software').length,
    archive: downloads.filter((d) => d.category === 'archive').length,
    other: downloads.filter((d) => d.category === 'other').length,
  };

  const activeCount = downloads.filter((d) => d.status === 'downloading').length;
  const completedCount = downloads.filter((d) => d.status === 'completed').length;
  const totalStorageUsedBytes = downloads
    .filter((d) => d.status === 'completed')
    .reduce((acc, curr) => acc + curr.fileSize, 0);

  // Filter & Sort
  const filteredDownloads = downloads.filter((item) => {
    const isCompletedTab = activeMainTab === 'completed';
    const matchesTabStatus = isCompletedTab ? item.status === 'completed' : item.status !== 'completed';
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesTabStatus && matchesCategory;
  });

  const sortedDownloads = [...filteredDownloads].sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] transition-colors duration-200 pb-24">
      
      {/* Header */}
      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenCoinShop={() => setIsCoinShopOpen(true)}
        activeCount={activeCount}
        completedCount={completedCount}
        totalStorageUsed={formatBytes(totalStorageUsedBytes)}
        freeDownloadsRemaining={freeDownloadsRemaining}
        purchasedCoins={purchasedCoins}
        isUnlimited={isUnlimited}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {activeMainTab !== 'schedule' ? (
          <>
            {/* Categories Tabs */}
            <CategoryTabs
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              counts={counts}
            />

            {/* Clear Completed Bar if completed tab */}
            <SearchBar
              onClearCompleted={activeMainTab === 'completed' ? handleClearCompleted : undefined}
            />

            {/* Downloads List */}
            <div className="space-y-4">

              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  <span>{activeMainTab === 'completed' ? 'فایل‌های دانلود شده' : 'صف دانلود و در حال انجام'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {sortedDownloads.length}
                  </span>
                </h2>
              </div>

              {sortedDownloads.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 my-8 shadow-xs">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                    <Download className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {activeMainTab === 'completed' ? 'هیچ فایل دانلود‌شده‌ای وجود ندارد' : 'هیچ دانلود فعالی در صف نیست'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeMainTab === 'completed' ? 'پس از اتمام دانلودها، فایل‌ها در این بخش قرار می‌گیرند.' : 'می‌توانید با کلیک روی افزودن لینک، دانلود جدیدی را شروع کنید.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20 text-xs sm:text-sm transition cursor-pointer"
                  >
                    افزودن لینک دانلود جدید
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {sortedDownloads.map((item) => (
                    <DownloadCard
                      key={item.id}
                      item={item}
                      onPauseResume={handlePauseResume}
                      onCancelDelete={handleCancelDelete}
                      onRetry={handleRetry}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <SchedulePanel
              schedule={scheduleSettings}
              setSchedule={setScheduleSettings}
              isCurrentlyInScheduleWindow={isCurrentlyInScheduleWindow}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200 mb-16">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <p>آندو دانلودر © 2026 - مدیر دانلود هوشمند</p>
        </div>
      </footer>

      {/* Bottom Sticky Tab Bar (3 Tabs for Clean UI) */}
      <nav aria-label="منوی پایین صفحه" className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg py-2 px-4">
        <div className="max-w-xl mx-auto grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveMainTab('active')}
            className={`flex items-center justify-center gap-1.5 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeMainTab === 'active'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>در حال دانلود ({downloads.filter(d => d.status !== 'completed').length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab('completed')}
            className={`flex items-center justify-center gap-1.5 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer ${
              activeMainTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>فایل‌های دانلود شده ({completedCount})</span>
          </button>

          <button
            onClick={() => setActiveMainTab('schedule')}
            className={`flex items-center justify-center gap-1.5 py-3 rounded-2xl font-semibold text-xs transition-all cursor-pointer relative ${
              activeMainTab === 'schedule'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>تب زمان‌بندی</span>
            {scheduleSettings.enabled && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            )}
          </button>
        </div>
      </nav>

      {/* Add Download Modal */}
      <AddDownloadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddDownload={handleAddDownload}
      />

      {/* Coin Shop Modal */}
      <CoinShopModal
        isOpen={isCoinShopOpen}
        onClose={() => setIsCoinShopOpen(false)}
        freeDownloadsRemaining={freeDownloadsRemaining}
        purchasedCoins={purchasedCoins}
        isUnlimited={isUnlimited}
        onBuyPackage={handleBuyPackage}
      />

      {/* Undo Snackbar Notification */}
      <UndoSnackbar
        notification={undoNotification}
        onUndo={handleUndo}
        onDismiss={() => setUndoNotification(null)}
      />

    </div>
  );
}

