import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DownloadItem, DownloadCategory, DownloadStatus, ScheduleSettings, UndoNotification } from './types';
import { initialDownloads } from './data/initialDownloads';
import { Header } from './components/Header';
import { CategoryTabs } from './components/CategoryTabs';
import { SearchBar } from './components/SearchBar';
import { DownloadCard } from './components/DownloadCard';
import { AddDownloadModal, AddDownloadOptions } from './components/AddDownloadModal';
import { CoinShopModal } from './components/CoinShopModal';
import { UndoSnackbar } from './components/UndoSnackbar';
import { SchedulePanel } from './components/SchedulePanel';
import { Download, FolderOpen, Clock, ListFilter, WifiOff, AlertTriangle, Link2, Plus } from 'lucide-react';
import { formatBytes } from './utils/formatters';
import { billingService } from './utils/billing';
import { ytDlpService } from './services/ytDlpService';
import { storageService } from './services/storageService';
import { downloadQueueManager } from './services/downloadQueueManager';
import { networkService } from './services/networkService';
import { SetupScreen } from './components/SetupScreen';
import { binaryManager } from './services/binaryManagerService';

export default function App() {
  const [isBinariesReady, setIsBinariesReady] = useState<boolean | null>(null);

  useEffect(() => {
    const checkBinariesOnStart = async () => {
      try {
        const status = await binaryManager.checkBinaries();
        setIsBinariesReady(status.installed);
      } catch (e) {
        setIsBinariesReady(true);
      }
    };
    checkBinariesOnStart();
  }, []);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return storageService.getDarkMode();
  });

  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    return downloadQueueManager.sanitizeItemsOnStartup(storageService.getDownloads());
  });

  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>(() => {
    return storageService.getSchedule();
  });

  const [freeDownloadsRemaining, setFreeDownloadsRemaining] = useState<number>(() => {
    return storageService.getFreeDownloads();
  });

  const [purchasedCoins, setPurchasedCoins] = useState<number>(() => {
    return storageService.getPurchasedCoins();
  });

  const [isUnlimited, setIsUnlimited] = useState<boolean>(() => {
    return storageService.isUnlimited();
  });

  const [unlimitedExpiry, setUnlimitedExpiry] = useState<string | undefined>(() => {
    return storageService.getUnlimitedExpiryFormatted() || undefined;
  });

  const [concurrentLimit, setConcurrentLimit] = useState<number>(() => {
    return downloadQueueManager.getMaxConcurrent();
  });

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return networkService.getOnlineStatus();
  });

  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [quickUrl, setQuickUrl] = useState('');
  const [initialModalUrl, setInitialModalUrl] = useState('');

  const refreshBillingState = () => {
    setPurchasedCoins(storageService.getPurchasedCoins());
    setIsUnlimited(storageService.isUnlimited());
    setUnlimitedExpiry(storageService.getUnlimitedExpiryFormatted() || undefined);
    setFreeDownloadsRemaining(storageService.getFreeDownloads());
  };

  // Ref to hold latest downloads and schedule for timer and network callbacks
  const downloadsRef = useRef(downloads);
  downloadsRef.current = downloads;

  const scheduleRef = useRef(scheduleSettings);
  scheduleRef.current = scheduleSettings;

  // Bootstrap persistent Capacitor storage & auto-restore purchases on app start
  useEffect(() => {
    let isMounted = true;

    const bootstrapStorageAndPurchases = async () => {
      try {
        const snapshot = await storageService.init();
        if (!isMounted) return;

        const sanitized = downloadQueueManager.sanitizeItemsOnStartup(snapshot.downloads);
        setDownloads(sanitized);
        setDarkMode(snapshot.darkMode);
        setScheduleSettings(snapshot.schedule);
        setFreeDownloadsRemaining(snapshot.freeDownloads);
        setPurchasedCoins(snapshot.purchasedCoins);
        setIsUnlimited(snapshot.isUnlimited);
        setUnlimitedExpiry(storageService.getUnlimitedExpiryFormatted() || undefined);

        const restoreRes = await billingService.restorePurchases();
        if (restoreRes.success && restoreRes.restoredSkus.length > 0 && isMounted) {
          refreshBillingState();
        }

        // Auto-start any queued items if network is online
        setTimeout(() => {
          checkAndAdvanceQueue();
        }, 800);
      } catch (err) {
        console.warn('Storage or billing bootstrap warning:', err);
      }
    };

    bootstrapStorageAndPurchases();

    // Listen to network status changes (disconnect / reconnect)
    const unsubscribeNetwork = networkService.subscribe((online) => {
      setIsOnline(online);
      if (!online) {
        // Automatically pause active downloads on disconnect
        setDownloads((prev) =>
          prev.map((d) => {
            if (d.status === 'downloading') {
              ytDlpService.pauseDownload(d.id);
              return {
                ...d,
                status: 'paused',
                speed: 0,
                eta: 'اینترنت قطع شد - در انتظار اتصال مجدد...',
              };
            }
            return d;
          })
        );
      } else {
        // Automatically resume when connection returns
        setTimeout(() => {
          checkAndAdvanceQueue();
        }, 1000);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeNetwork();
    };
  }, []);

  const [activeMainTab, setActiveMainTab] = useState<'active' | 'completed' | 'schedule'>('active');
  const [selectedCategory, setSelectedCategory] = useState<DownloadCategory>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCoinShopOpen, setIsCoinShopOpen] = useState<boolean>(false);
  const [undoNotification, setUndoNotification] = useState<UndoNotification | null>(null);
  const [isCurrentlyInScheduleWindow, setIsCurrentlyInScheduleWindow] = useState<boolean>(() => {
    return downloadQueueManager.isInsideScheduleWindow(storageService.getSchedule());
  });

  // Sync dark mode class with HTML document and persistent Preferences
  useEffect(() => {
    storageService.setDarkMode(darkMode);

    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Persist downloads to Capacitor Preferences
  useEffect(() => {
    storageService.setDownloads(downloads);
  }, [downloads]);

  // Persist schedule to Capacitor Preferences
  useEffect(() => {
    storageService.setSchedule(scheduleSettings);
  }, [scheduleSettings]);

  // Start real download with progress and automatic queue advancement on completion
  const startRealDownload = (item: DownloadItem) => {
    ytDlpService.startDownload(item, (event) => {
      setDownloads((prev) =>
        prev.map((d) => {
          if (d.id !== event.downloadId) return d;
          return {
            ...d,
            progress: event.progress,
            downloadedSize: event.downloadedBytes,
            fileSize: event.totalBytes > 0 ? event.totalBytes : d.fileSize,
            speed: event.speed,
            connections: event.connections || 4,
            eta: event.eta,
            status: event.status,
            localPath: event.localPath || d.localPath,
            errorMessage: event.error,
          };
        })
      );

      // When a download completes or errors, immediately advance the queue
      if (event.status === 'completed' || event.status === 'error') {
        setTimeout(() => {
          checkAndAdvanceQueue();
        }, 300);
      }
    }).catch((err) => {
      setDownloads((prev) =>
        prev.map((d) => {
          if (d.id !== item.id) return d;
          return {
            ...d,
            status: 'error',
            speed: 0,
            eta: 'خطا در دانلود',
            errorMessage: err.message,
          };
        })
      );

      setTimeout(() => {
        checkAndAdvanceQueue();
      }, 300);
    });
  };

  // Check queue and advance queued items up to max concurrent limit
  const checkAndAdvanceQueue = () => {
    const currentList = downloadsRef.current;
    const schedule = scheduleRef.current;

    const { updatedDownloads, itemsToStart, itemsToPause } = downloadQueueManager.evaluateQueue(
      currentList,
      schedule
    );

    // Pause items that should not run
    itemsToPause.forEach((id) => {
      ytDlpService.pauseDownload(id);
    });

    if (itemsToStart.length > 0 || itemsToPause.length > 0) {
      setDownloads(updatedDownloads);
      itemsToStart.forEach((item) => {
        startRealDownload(item);
      });
    }
  };

  // Schedule time window checker & auto start/stop
  useEffect(() => {
    const checkSchedule = () => {
      const schedule = scheduleRef.current;
      const inWindow = downloadQueueManager.isInsideScheduleWindow(schedule);
      setIsCurrentlyInScheduleWindow(inWindow);

      if (schedule.enabled) {
        checkAndAdvanceQueue();
      }
    };

    checkSchedule();
    const timer = setInterval(checkSchedule, 10000);
    return () => clearInterval(timer);
  }, [scheduleSettings.enabled, scheduleSettings.startTime, scheduleSettings.endTime]);

  // Handlers
  const handlePauseResume = async (id: string) => {
    const item = downloads.find((d) => d.id === id);
    if (!item) return;

    if (item.status === 'downloading') {
      await ytDlpService.pauseDownload(id);
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'paused', speed: 0, eta: 'متوقف شده' } : d))
      );
      // Let next queued item start
      setTimeout(() => checkAndAdvanceQueue(), 200);
    } else if (item.status === 'paused' || item.status === 'queued') {
      // Check schedule window
      if (scheduleSettings.enabled && !isCurrentlyInScheduleWindow) {
        setScheduleNotice(`زمان‌بند فعال است. دانلودها بین ساعت ${scheduleSettings.startTime} تا ${scheduleSettings.endTime} خودکار شروع می‌شوند.`);
        setTimeout(() => setScheduleNotice(null), 4000);
        return;
      }

      // Check concurrent limit
      const activeCount = downloads.filter((d) => d.status === 'downloading').length;
      if (activeCount >= concurrentLimit) {
        // Enqueue with top priority
        setDownloads((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: 'queued', eta: 'در صف انتظار (در نوبت بعدی)' } : d))
        );
      } else {
        setDownloads((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: 'downloading', eta: 'در حال شروع دانلود...' } : d))
        );
        startRealDownload({ ...item, status: 'downloading' });
      }
    }
  };

  const handleRetry = (id: string) => {
    const item = downloads.find((d) => d.id === id);
    if (!item) return;

    if (scheduleSettings.enabled && !isCurrentlyInScheduleWindow) {
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'queued', speed: 0, eta: `در انتظار زمان‌بند (${scheduleSettings.startTime})`, errorMessage: undefined } : d))
      );
      return;
    }

    const activeCount = downloads.filter((d) => d.status === 'downloading').length;
    if (activeCount >= concurrentLimit) {
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'queued', speed: 0, eta: 'در صف انتظار برای تلاش مجدد', errorMessage: undefined } : d))
      );
    } else {
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'downloading', speed: 0, eta: 'در حال شروع مجدد...', errorMessage: undefined } : d))
      );
      startRealDownload({ ...item, status: 'downloading' });
    }
  };

  const handleCancelDelete = async (itemToCancel: DownloadItem) => {
    await ytDlpService.cancelDownload(itemToCancel.id);
    setDownloads((prev) => prev.filter((d) => d.id !== itemToCancel.id));
    setUndoNotification({
      id: uuidv4(),
      message: `فایل ${itemToCancel.name} لغو و حذف شد`,
      item: itemToCancel,
      timestamp: Date.now(),
    });
    // Slot freed, advance queue
    setTimeout(() => checkAndAdvanceQueue(), 200);
  };

  const handleUndo = (itemToRestore: DownloadItem) => {
    setDownloads((prev) => [itemToRestore, ...prev]);
    setUndoNotification(null);
    if (itemToRestore.status === 'downloading') {
      startRealDownload(itemToRestore);
    } else {
      setTimeout(() => checkAndAdvanceQueue(), 200);
    }
  };

  const handleAddDownload = async (opts: AddDownloadOptions) => {
    const quota = await storageService.consumeQuota();
    if (!quota.allowed) {
      setIsCoinShopOpen(true);
      return;
    }

    setFreeDownloadsRemaining(quota.remainingFree);
    setPurchasedCoins(quota.remainingCoins);

    const initialStatus = downloadQueueManager.getInitialStatusForNewDownload(downloads, scheduleSettings);

    const newItem: DownloadItem = {
      id: uuidv4(),
      name: opts.name,
      url: opts.url,
      category: opts.category,
      fileSize: opts.fileSize,
      downloadedSize: 0,
      progress: 0,
      speed: 0,
      status: initialStatus.status,
      createdAt: new Date().toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      eta: initialStatus.eta,
      thumbnail: opts.thumbnail,
      formatId: opts.formatId,
      directUrl: opts.directUrl,
      audioOnly: opts.audioOnly,
      extractor: opts.extractor,
      duration: opts.duration,
      connections: 4,
      queuePosition: initialStatus.queuePosition,
    };

    setDownloads((prev) => [newItem, ...prev]);

    if (initialStatus.status === 'downloading') {
      startRealDownload(newItem);
    }
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

  if (isBinariesReady === false) {
    return <SetupScreen onSetupComplete={() => setIsBinariesReady(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] transition-colors duration-200 pb-24">
      
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-300 py-2.5 px-4 text-xs flex items-center justify-center gap-2 font-medium">
          <WifiOff className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
          <span>اتصال اینترنت قطع شده است. دانلودهای فعال متوقف شدند و به محض برقراری اتصال خودکار ادامه خواهند یافت.</span>
        </div>
      )}

      {/* Schedule Warning Banner */}
      {scheduleNotice && (
        <div className="bg-blue-500/15 border-b border-blue-500/30 text-blue-800 dark:text-blue-300 py-2.5 px-4 text-xs flex items-center justify-center gap-2 font-medium animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-blue-500" />
          <span>{scheduleNotice}</span>
        </div>
      )}

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
        unlimitedExpiry={unlimitedExpiry}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {activeMainTab !== 'schedule' ? (
          <>
            {/* Quick Link Input Bar for effortless downloads */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full flex items-center">
                <Link2 className="absolute right-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="url"
                  dir="ltr"
                  placeholder="لینک ویدیو (اینستاگرام، یوتیوب، آپارات...) یا فایل را بچسبانید..."
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickUrl.trim()) {
                      setInitialModalUrl(quickUrl.trim());
                      setIsAddModalOpen(true);
                      setQuickUrl('');
                    }
                  }}
                  className="w-full pr-10 pl-24 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator.clipboard?.readText) {
                        const text = await navigator.clipboard.readText();
                        if (text && text.trim().startsWith('http')) {
                          setQuickUrl(text.trim());
                        }
                      }
                    } catch {}
                  }}
                  className="absolute left-2.5 text-[11px] font-medium px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
                >
                  چسباندن
                </button>
              </div>
              <button
                onClick={() => {
                  if (quickUrl.trim()) {
                    setInitialModalUrl(quickUrl.trim());
                    setQuickUrl('');
                  } else {
                    setInitialModalUrl('');
                  }
                  setIsAddModalOpen(true);
                }}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold px-6 py-3 rounded-2xl shadow-md shadow-blue-500/25 text-xs sm:text-sm cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                <span>دانلود سریع</span>
              </button>
            </div>

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
                  <span>{activeMainTab === 'completed' ? 'فایل‌های دانلود شده' : 'صف دانلودهای فعال'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
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
                      {activeMainTab === 'completed' ? 'هیچ فایل دانلود‌شده‌ای وجود ندارد' : 'هیچ دانلودی در صف نیست'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeMainTab === 'completed' ? 'فایل‌های دانلودشده در این بخش ذخیره و مدیریت می‌شوند.' : 'برای شروع، آدرس اینترنتی ویدیو یا فایل را در کادر بالا وارد کرده یا دکمه زیر را لمس کنید.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setInitialModalUrl('');
                      setIsAddModalOpen(true);
                    }}
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
              concurrentLimit={concurrentLimit}
              onConcurrentLimitChange={(limit) => {
                setConcurrentLimit(limit);
                downloadQueueManager.setMaxConcurrent(limit);
              }}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200 mb-16">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <p>آندو دانلودر © 2026 - مدیر دانلود هوشمند، پرسرعت و چنداتصاله</p>
        </div>
      </footer>

      {/* Bottom Sticky Tab Bar */}
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
        initialUrl={initialModalUrl}
        onClose={() => {
          setIsAddModalOpen(false);
          setInitialModalUrl('');
        }}
        onAddDownload={handleAddDownload}
      />

      {/* Coin Shop Modal */}
      <CoinShopModal
        isOpen={isCoinShopOpen}
        onClose={() => setIsCoinShopOpen(false)}
        freeDownloadsRemaining={freeDownloadsRemaining}
        purchasedCoins={purchasedCoins}
        isUnlimited={isUnlimited}
        unlimitedExpiry={unlimitedExpiry}
        onRefreshBillingState={refreshBillingState}
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
