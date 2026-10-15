import React, { useState } from 'react';
import {
  X,
  Coins,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Crown,
  Loader2,
  Smartphone,
  AlertTriangle,
  RotateCcw,
  Check,
  ExternalLink,
} from 'lucide-react';
import { billingService, PRODUCTS, SKUS, RestoreResult } from '../utils/billing';

interface CoinShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  freeDownloadsRemaining: number;
  purchasedCoins: number;
  isUnlimited: boolean;
  unlimitedExpiry?: string;
  onRefreshBillingState: () => void;
}

export const CoinShopModal: React.FC<CoinShopModalProps> = ({
  isOpen,
  onClose,
  freeDownloadsRemaining,
  purchasedCoins,
  isUnlimited,
  unlimitedExpiry,
  onRefreshBillingState,
}) => {
  const [loadingSku, setLoadingSku] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  if (!isOpen) return null;

  const isNative = billingService.isNativeAndroid();
  const storeName = billingService.getStoreName();

  const handleBuy = async (sku: string) => {
    setFeedback(null);
    setLoadingSku(sku);

    try {
      const result = await billingService.purchase(sku);

      if (!result.success) {
        if (result.isWebUnsupported) {
          setFeedback({
            type: 'info',
            message:
              '⚠️ شما در حال حاضر در مرورگر وب هستید. پرداخت درون‌برنامه‌ای کافه‌بازار و مایکت صرفاً روی اپلیکیشن نصب‌شده در گوشی اندروید با اتصال به بازار/مایکت فعال است. برای فعال‌سازی خرید، لطفاً APK نهایی را روی گوشی خود اجرا فرمایید.',
          });
        } else {
          setFeedback({
            type: 'error',
            message: result.error || 'عملیات خرید انجام نشد یا توسط کاربر لغو گردید.',
          });
        }
        return;
      }

      // Success
      if (result.isConsumable && result.coinsAdded) {
        setFeedback({
          type: 'success',
          message: `🎉 تبریک! بسته با موفقیت خریداری شد و ${result.coinsAdded} سکه به حسابتان اضافه گردید.`,
        });
      } else if (result.unlimitedDaysAdded) {
        setFeedback({
          type: 'success',
          message: `🎉 تبریک! اشتراک نامحدود ${result.unlimitedDaysAdded} روزه با موفقیت فعال گردید (انقضا: ${result.unlimitedExpiry || '۳۰ روز دیگر'}).`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: 'پرداخت با موفقیت انجام شد و وضعیت حساب شما ارتقا یافت.',
        });
      }

      onRefreshBillingState();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'خطای غیرمنتظره در ارتباط با درگاه پرداخت.',
      });
    } finally {
      setLoadingSku(null);
    }
  };

  const handleRestore = async () => {
    setFeedback(null);
    setIsRestoring(true);

    try {
      const res: RestoreResult = await billingService.restorePurchases();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message,
        });
        onRefreshBillingState();
      } else {
        setFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'خطا در بازیابی خریدها.',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-['Vazirmatn',sans-serif]">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-950/20 dark:to-orange-950/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">فروشگاه سکه و اشتراک دانلود</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                پرداخت امن درون‌برنامه‌ای {storeName}
              </p>
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Web Environment Notice if not native */}
          {!isNative && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-800 dark:text-amber-300">
              <Smartphone className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="text-xs space-y-1">
                <span className="font-bold block">محیط پیش‌نمایش وب (Web Preview)</span>
                <p className="leading-relaxed opacity-90 text-[11px]">
                  این برنامه برای پرداخت امن درون‌برنامه‌ای به پلاگین‌های رسمی کافه‌بازار (Poolakey) و مایکت متصل است. در محیط مرورگر، پرداخت به درستی فعال نمی‌شود تا خرید صوری یا تقلبی رخ ندهد. برای آزمایش تراکنش واقعی، خروجی APK را روی تلفن هوشمند اندرویدی خود اجرا کنید.
                </p>
              </div>
            </div>
          )}

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl text-xs leading-relaxed border flex items-start gap-2.5 animate-fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : feedback.type === 'info'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/30 text-blue-800 dark:text-blue-300'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-500/30 text-red-800 dark:text-red-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              )}
              <div className="flex-1">{feedback.message}</div>
            </div>
          )}

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
                <span>سکه‌های مصرفی</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {purchasedCoins} <span className="text-xs font-normal">سکه</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center space-y-1">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                <span>وضعیت اشتراک</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white pt-1">
                {isUnlimited ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">
                    نامحدود فعال
                  </span>
                ) : (
                  'عادی'
                )}
              </div>
              {unlimitedExpiry && isUnlimited && (
                <div className="text-[10px] text-slate-500">تا تاریخ: {unlimitedExpiry}</div>
              )}
            </div>
          </div>

          {/* Packages List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                بسته‌های سکه (مصرفی) و اشتراک نامحدود:
              </h3>
              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="بازیابی خریدهای قبلی اشتراک از کافه‌بازار یا مایکت"
              >
                <RotateCcw className={`w-3 h-3 ${isRestoring ? 'animate-spin' : ''}`} />
                <span>بازیابی خریدها</span>
              </button>
            </div>

            {/* Render all products configured in billing service */}
            {Object.values(PRODUCTS).map((prod) => {
              const isSub = prod.type === 'subs';
              const isBestOffer = prod.sku === SKUS.UNLIMITED_1Y;

              return (
                <div
                  key={prod.sku}
                  className={`p-4 rounded-2xl border transition relative overflow-hidden flex items-center justify-between gap-3 ${
                    isBestOffer
                      ? 'border-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : isSub
                      ? 'border-blue-500/40 bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-500'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-amber-500'
                  }`}
                >
                  {isBestOffer && (
                    <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-br-xl">
                      بهترین ارزش خرید (VIP)
                    </div>
                  )}

                  <div className={`space-y-1 ${isBestOffer ? 'pt-2' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isSub
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                            : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {prod.coinsReward ? prod.coinsReward : isBestOffer ? '♾️' : `${prod.durationDays}D`}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {prod.title}
                      </h4>
                      {isSub && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium">
                          غیر مصرفی
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{prod.description}</p>
                  </div>

                  <div className={`text-left space-y-2 shrink-0 ${isBestOffer ? 'pt-2' : ''}`}>
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      {prod.priceToman.toLocaleString('fa-IR')}{' '}
                      <span className="text-[10px] font-normal text-slate-500">تومان</span>
                    </div>

                    <button
                      onClick={() => handleBuy(prod.sku)}
                      disabled={loadingSku !== null}
                      className={`font-semibold px-4 py-2 rounded-xl text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 min-w-[100px] justify-center disabled:opacity-50 text-white ${
                        isBestOffer
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                          : isSub
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                          : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                      }`}
                    >
                      {loadingSku === prod.sku ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>اتصال...</span>
                        </>
                      ) : (
                        <span>{isSub ? 'خرید اشتراک' : 'خرید بسته'}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>تضمین امنیت با پرداخت رسمی درون‌برنامه‌ای کافه‌بازار و مایکت</span>
          </div>

        </div>

      </div>
    </div>
  );
};
