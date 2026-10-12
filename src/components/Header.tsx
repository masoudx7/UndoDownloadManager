import React, { useState } from 'react';
import { Download, Moon, Sun, Plus, RefreshCw, Coins, Crown, Zap } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenAddModal: () => void;
  onOpenCoinShop: () => void;
  activeCount: number;
  completedCount: number;
  totalStorageUsed: string;
  freeDownloadsRemaining: number;
  purchasedCoins: number;
  isUnlimited: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  setDarkMode,
  onOpenAddModal,
  onOpenCoinShop,
  activeCount,
  completedCount,
  totalStorageUsed,
  freeDownloadsRemaining,
  purchasedCoins,
  isUnlimited,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateEngine = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/update-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message + (data.version ? ` (${data.version})` : ''));
      } else {
        alert(data.error || 'خطا در بروزرسانی موتور دانلود');
      }
    } catch (err: any) {
      alert(err.message || 'خطا در ارتباط با سرور');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
              آندو دانلودر
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              مدیر دانلود هوشمند
            </p>
          </div>
        </div>

        {/* Minimal stats */}
        <div className="hidden lg:flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          <span>فعال: <strong className="text-slate-900 dark:text-white">{activeCount}</strong></span>
          <span>•</span>
          <span>تکمیل: <strong className="text-slate-900 dark:text-white">{completedCount}</strong></span>
          <span>•</span>
          <span>حجم: <strong className="text-slate-900 dark:text-white">{totalStorageUsed}</strong></span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          
          {/* Coin Shop Button */}
          <button
            onClick={onOpenCoinShop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition text-xs font-bold cursor-pointer shadow-xs"
          >
            {isUnlimited ? (
              <Crown className="w-4 h-4 text-emerald-500" />
            ) : (
              <Coins className="w-4 h-4 text-amber-500" />
            )}
            <span>
              {isUnlimited ? 'نامحدود ♾️' : `رایگان: ${freeDownloadsRemaining} | سکه: ${purchasedCoins}`}
            </span>
          </button>

          <button
            onClick={handleUpdateEngine}
            disabled={isUpdating}
            title="بروزرسانی موتور دانلود"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'بروزرسانی...' : 'بروزرسانی موتور'}</span>
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label="تغییر تم"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            title="تغییر حالت تاریک/روشن"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium px-4 py-2 rounded-xl shadow-sm shadow-blue-600/20 transition text-xs sm:text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن لینک</span>
          </button>
        </div>

      </div>
    </header>
  );
};



