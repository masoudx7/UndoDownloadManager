// src/components/AdsDemo.tsx

import React, { useEffect, useState } from 'react';
import { showBannerAd, hideBannerAd, showInterstitialAd, showRewardedAd } from '../services/ads';

export const AdsDemo: React.FC = () => {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [rewardEarned, setRewardEarned] = useState(false);

  useEffect(() => {
    // نمایش بنر هنگام لود شدن کامپوننت
    showBannerAd('banner-container');
    setBannerVisible(true);

    return () => {
      // مخفی کردن بنر هنگام خروج از کامپوننت
      hideBannerAd();
    };
  }, []);

  const handleShowInterstitial = async () => {
    const success = await showInterstitialAd();
    if (success) {
      alert('تبلیغ بین صفحه‌ای با موفقیت نمایش داده شد');
    }
  };

  const handleShowRewarded = async () => {
    const rewarded = await showRewardedAd();
    if (rewarded) {
      setRewardEarned(true);
      alert('🎉 تبریک! شما پاداش گرفتید');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">نمونه تبلیغات</h2>

      {/* محل نمایش بنر */}
      <div 
        id="banner-container" 
        className="w-full h-16 bg-gray-100 flex items-center justify-center"
      >
        {bannerVisible ? 'محل نمایش بنر تبلیغاتی' : 'بنر غیرفعال'}
      </div>

      {/* دکمه تبلیغ بین صفحه‌ای */}
      <button
        onClick={handleShowInterstitial}
        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        نمایش تبلیغ بین صفحه‌ای
      </button>

      {/* دکمه تبلیغ جایزه‌ای */}
      <button
        onClick={handleShowRewarded}
        className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
      >
        نمایش تبلیغ جایزه‌ای (دریافت پاداش)
      </button>

      {/* نمایش وضعیت پاداش */}
      {rewardEarned && (
        <div className="p-4 bg-green-100 text-green-800 rounded-lg">
          ✅ شما پاداش دریافت کرده‌اید!
        </div>
      )}
    </div>
  );
};