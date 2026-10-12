import React, { useState } from 'react';
import { X, Coins, Sparkles, CheckCircle2, ShieldCheck, Zap, Crown, Loader2 } from 'lucide-react';

interface CoinShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  freeDownloadsRemaining: number;
  purchasedCoins: number;
  isUnlimited: boolean;
  unlimitedExpiry?: string;
  onBuyPackage: (type: 'coins_10' | 'coins_30' | 'unlimited_1m' | 'unlimited_3m' | 'unlimited') => Promise<void> | void;
}

export const CoinShopModal: React.FC<CoinShopModalProps> = ({
  isOpen,
  onClose,
  freeDownloadsRemaining,
  purchasedCoins,
  isUnlimited,
  unlimitedExpiry,
  onBuyPackage,
}) => {
  const [loadingSku, setLoadingSku] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBuy = async (type: 'coins_10' | 'coins_30' | 'unlimited_1m' | 'unlimited_3m' | 'unlimited', skuKey: string) => {
    try {
      setLoadingSku(skuKey);
      await onBuyPackage(type);
    } finally {
      setLoadingSku(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-950/20 dark:to-orange-950/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">خرید سکه و اشتراک دانلود</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">افزایش اعتبار و دانلود نامحدود فایل‌ها</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* User Status Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-center space-y-1">
              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>رایگان این ماه</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {freeDownloadsRemaining} <span className="text-xs font-normal">از ۵</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-center space-y-1">
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                <span>سکه‌های باقی‌مانده</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {purchasedCoins} <span className="text-xs font-normal">عدد</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center space-y-1">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                <span>وضعیت اشتراک</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white pt-1">
                {isUnlimited ? 'نامحدود (فعال)' : 'عادی'}
              </div>
            </div>
          </div>

          {/* Packages List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              بسته‌های پیشنهادی خرید سکه و اشتراک:
            </h3>

            {/* Package 1: 10 downloads */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between hover:border-amber-500 transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    ۱۰
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">بسته ۱۰ تایی دانلود</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">مناسب برای دانلود ویدیو و فایل‌های متوسط</p>
              </div>
              <div className="text-left space-y-2">
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  ۷۹,۰۰۰ <span className="text-[10px] font-normal text-slate-500">تومان</span>
                </div>
                <button
                  onClick={() => handleBuy('coins_10', 'coins_10')}
                  disabled={loadingSku !== null}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center gap-1.5 min-w-[90px] justify-center"
                >
                  {loadingSku === 'coins_10' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال پرداخت</span>
                    </>
                  ) : (
                    <span>خرید بسته</span>
                  )}
                </button>
              </div>
            </div>

            {/* Package 2: 30 downloads */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between hover:border-amber-500 transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    ۳۰
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">بسته ۳۰ تایی دانلود</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">مقرون‌به‌صرفه برای کاربران پرکار</p>
              </div>
              <div className="text-left space-y-2">
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  ۱۷۹,۰۰۰ <span className="text-[10px] font-normal text-slate-500">تومان</span>
                </div>
                <button
                  onClick={() => handleBuy('coins_30', 'coins_30')}
                  disabled={loadingSku !== null}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center gap-1.5 min-w-[90px] justify-center"
                >
                  {loadingSku === 'coins_30' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال پرداخت</span>
                    </>
                  ) : (
                    <span>خرید بسته</span>
                  )}
                </button>
              </div>
            </div>

            {/* Package 3: 1 Month Unlimited */}
            <div className="p-4 rounded-2xl border border-blue-500/50 bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                    ۱M
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">اشتراک ۱ ماهه نامحدود</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">دانلود نامحدود برای مدت ۳۰ روز</p>
              </div>
              <div className="text-left space-y-2">
                <div className="text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400">
                  ۸۹,۰۰۰ <span className="text-[10px] font-normal text-slate-500">تومان</span>
                </div>
                <button
                  onClick={() => handleBuy('unlimited_1m', 'unlimited_1m')}
                  disabled={loadingSku !== null}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-md shadow-blue-600/20 transition cursor-pointer flex items-center gap-1.5 min-w-[90px] justify-center"
                >
                  {loadingSku === 'unlimited_1m' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال پرداخت</span>
                    </>
                  ) : (
                    <span>خرید اشتراک</span>
                  )}
                </button>
              </div>
            </div>

            {/* Package 4: 3 Months Unlimited */}
            <div className="p-4 rounded-2xl border border-purple-500/50 bg-purple-50/40 dark:bg-purple-950/20 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                    ۳M
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">اشتراک ۳ ماهه نامحدود</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">دانلود نامحدود برای مدت ۹۰ روز</p>
              </div>
              <div className="text-left space-y-2">
                <div className="text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400">
                  ۱۹۹,۰۰۰ <span className="text-[10px] font-normal text-slate-500">تومان</span>
                </div>
                <button
                  onClick={() => handleBuy('unlimited_3m', 'unlimited_3m')}
                  disabled={loadingSku !== null}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-md shadow-purple-600/20 transition cursor-pointer flex items-center gap-1.5 min-w-[90px] justify-center"
                >
                  {loadingSku === 'unlimited_3m' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال پرداخت</span>
                    </>
                  ) : (
                    <span>خرید اشتراک</span>
                  )}
                </button>
              </div>
            </div>

            {/* Package 5: 1 Year Unlimited */}
            <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-br-xl">
                پیشنهاد ویژه
              </div>
              <div className="space-y-1 pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    ♾️
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">اشتراک یکساله نامحدود</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">دانلود نامحدود بدون هیچ‌گونه محدودیت تعداد برای ۱ سال</p>
              </div>
              <div className="text-left space-y-2 pt-2">
                <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                  ۳۹۹,۰۰۰ <span className="text-[10px] font-normal text-slate-500">تومان</span>
                </div>
                <button
                  onClick={() => handleBuy('unlimited', 'unlimited')}
                  disabled={loadingSku !== null}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5 min-w-[90px] justify-center"
                >
                  {loadingSku === 'unlimited' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال پرداخت</span>
                    </>
                  ) : (
                    <span>خرید اشتراک</span>
                  )}
                </button>
              </div>
            </div>

          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>پرداخت امن از طریق درگاه بانکی / پرداخت درون‌برنامه‌ای بازار و مایکت</span>
          </div>

        </div>

      </div>
    </div>
  );
};

