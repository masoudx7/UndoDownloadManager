// src/services/ads.ts

import { Capacitor } from '@capacitor/core';

// 🔑 متغیرهای محیطی برای تپسل
const TAPSELL_TOKEN = import.meta.env.VITE_TAPSELL_TOKEN;
const TAPSELL_BANNER_ZONE = import.meta.env.VITE_TAPSELL_BANNER_ZONE;
const TAPSELL_INTERSTITIAL_ZONE = import.meta.env.VITE_TAPSELL_INTERSTITIAL_ZONE;
const TAPSELL_REWARDED_ZONE = import.meta.env.VITE_TAPSELL_REWARDED_ZONE;

// بررسی اینکه در محیط موبایل هستیم
const isNative = Capacitor.isNativePlatform();

/**
 * مقداردهی اولیه تپسل
 */
export const initAds = async () => {
  if (!isNative) {
    console.log('⚠️ تبلیغات فقط در محیط موبایل فعال هستند');
    return;
  }

  if (!TAPSELL_TOKEN || TAPSELL_TOKEN === 'your_tapsell_token_here') {
    console.error('❌ توکن تپسل در فایل .env تنظیم نشده است!');
    return;
  }

  try {
    // مقداردهی اولیه تپسل
    const Tapsell = (window as any).TapsellPlus;
    if (Tapsell) {
      await Tapsell.initialize(TAPSELL_TOKEN);
      console.log('✅ تبلیغات تپسل با موفقیت مقداردهی شد');
    }
  } catch (error) {
    console.error('❌ خطا در مقداردهی تپسل:', error);
  }
};

/**
 * نمایش تبلیغ بنری
 * @param containerId شناسه المان HTML برای نمایش بنر
 */
export const showBannerAd = async (containerId: string) => {
  if (!isNative || !TAPSELL_BANNER_ZONE) return;

  try {
    const Tapsell = (window as any).TapsellPlus;
    if (Tapsell) {
      await Tapsell.showStandardBanner(TAPSELL_BANNER_ZONE, containerId);
      console.log('✅ بنر تبلیغاتی نمایش داده شد');
    }
  } catch (error) {
    console.error('❌ خطا در نمایش بنر:', error);
  }
};

/**
 * مخفی کردن تبلیغ بنری
 */
export const hideBannerAd = async () => {
  if (!isNative) return;

  try {
    const Tapsell = (window as any).TapsellPlus;
    if (Tapsell) {
      await Tapsell.hideBanner();
      console.log('✅ بنر تبلیغاتی مخفی شد');
    }
  } catch (error) {
    console.error('❌ خطا در مخفی کردن بنر:', error);
  }
};

/**
 * نمایش تبلیغ بین صفحه‌ای (Interstitial)
 */
export const showInterstitialAd = async (): Promise<boolean> => {
  if (!isNative || !TAPSELL_INTERSTITIAL_ZONE) return false;

  return new Promise((resolve) => {
    try {
      const Tapsell = (window as any).TapsellPlus;
      if (Tapsell) {
        Tapsell.showInterstitial(TAPSELL_INTERSTITIAL_ZONE, {
          onOpened: () => console.log('📺 تبلیغ بین صفحه‌ای باز شد'),
          onClosed: () => {
            console.log('📺 تبلیغ بین صفحه‌ای بسته شد');
            resolve(true);
          },
          onError: (error: any) => {
            console.error('❌ خطا در تبلیغ بین صفحه‌ای:', error);
            resolve(false);
          }
        });
      } else {
        resolve(false);
      }
    } catch (error) {
      console.error('❌ خطا در نمایش تبلیغ بین صفحه‌ای:', error);
      resolve(false);
    }
  });
};

/**
 * نمایش تبلیغ جایزه‌ای (Rewarded)
 * @returns true اگر کاربر تبلیغ را کامل دید، false در غیر این صورت
 */
export const showRewardedAd = async (): Promise<boolean> => {
  if (!isNative || !TAPSELL_REWARDED_ZONE) return false;

  return new Promise((resolve) => {
    try {
      const Tapsell = (window as any).TapsellPlus;
      if (Tapsell) {
        Tapsell.showRewardedVideo(TAPSELL_REWARDED_ZONE, {
          onOpened: () => console.log('🎁 تبلیغ جایزه‌ای باز شد'),
          onClosed: () => console.log('🎁 تبلیغ جایزه‌ای بسته شد'),
          onRewarded: () => {
            console.log('✅ کاربر پاداش گرفت');
            resolve(true);
          },
          onError: (error: any) => {
            console.error('❌ خطا در تبلیغ جایزه‌ای:', error);
            resolve(false);
          }
        });
      } else {
        resolve(false);
      }
    } catch (error) {
      console.error('❌ خطا در نمایش تبلیغ جایزه‌ای:', error);
      resolve(false);
    }
  });
};