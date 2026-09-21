# 🤖 راهنمای استفاده از تمپلیت برای هوش مصنوعی

## 📋 درباره این تمپلیت

این یک تمپلیت آماده برای ساخت اپلیکیشن‌های موبایل با تکنولوژی‌های زیر است:
- **Capacitor** (تبدیل وب به اپلیکیشن موبایل)
- **React** (فریم‌ورک UI)
- **TypeScript** (زبان برنامه‌نویسی)
- **Vite** (بیلد ابزار)
- **Tailwind CSS** (استایل‌دهی)
- **پرداخت درون برنامه‌ای** (پشتیبانی از کافه بازار و مایکت)

---

## 🎯 چک‌لیست شروع پروژه جدید

وقتی کاربر می‌خواهد یک پروژه جدید از این تمپلیت بسازد، **دقیقاً** این مراحل را طی کن:

### مرحله ۱: دریافت اطلاعات از کاربر

از کاربر این اطلاعات را **یکی یکی** بپرس و یادداشت کن:

- [ ] **نام برنامه** (مثلاً: "ابلاغ‌یار")
- [ ] **نام پکیج اندروید** (مثلاً: `ir.eblaghyar.app` یا `com.mycompany.myapp`)
- [ ] **انتخاب استور پرداخت**: "myket" یا "bazaar"
- [ ] **کلید RSA استور انتخابی** (از پنل توسعه‌دهندگان استور)
- [ ] **شناسه محصولات (SKU)** که در پنل استور ساخته (مثلاً: `coin_5_pack`, `premium_1year`)
- [ ] **آدرس Supabase** (در صورت استفاده)
- [ ] **کلید Supabase** (در صورت استفاده)
- [ ] **کلید Gemini API** (در صورت استفاده)

### مرحله ۲: ایجاد فایل `.env`

بر اساس اطلاعات کاربر، یک فایل `.env` در ریشه پروژه بساز. مثال:

```env
VITE_APP_NAME="نام برنامه"
VITE_APP_DESCRIPTION="توضیح کوتاه"

VITE_BILLING_PROVIDER="myket"  # یا "bazaar"

# اگر myket انتخاب شده:
VITE_MYKET_RSA_KEY="کلید_RSA_مایکت"

# اگر bazaar انتخاب شده:
VITE_BAZAAR_RSA_KEY="کلید_RSA_بازار"

VITE_PRODUCT_COIN_5="sku_product_1"
VITE_PRODUCT_COIN_15="sku_product_2"
VITE_PRODUCT_PREMIUM="sku_premium_product"

VITE_SUPABASE_URL="https://xxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGc..."

VITE_GEMINI_API_KEY="AIza..."

---

## 📺 تبلیغات درون برنامه‌ای (تپسل)

### فعال‌سازی تبلیغات

اگر کاربر می‌خواهد تبلیغات را فعال کند:

1. از کاربر بپرس:
   - [ ] آیا می‌خواهید تبلیغات تپسل را فعال کنید؟ (بله/خیر)
   - [ ] توکن تپسل (از پنل tapsell.ir)
   - [ ] شناسه Zone بنر
   - [ ] شناسه Zone بین صفحه‌ای
   - [ ] شناسه Zone جایزه‌ای

2. فایل `.env` را با مقادیر بالا پر کنید

3. در کامپوننت‌هایی که می‌خواهید تبلیغ نمایش داده شود، از توابع `src/services/ads.ts` استفاده کنید:
   - `showBannerAd(containerId)` - نمایش بنر
   - `hideBannerAd()` - مخفی کردن بنر
   - `showInterstitialAd()` - نمایش تبلیغ بین صفحه‌ای
   - `showRewardedAd()` - نمایش تبلیغ جایزه‌ای (با پاداش)

### نمونه استفاده

```typescript
import { showBannerAd, showRewardedAd } from '../services/ads';

// نمایش بنر
useEffect(() => {
  showBannerAd('banner-container');
}, []);

// نمایش تبلیغ جایزه‌ای
const handleWatchAd = async () => {
  const rewarded = await showRewardedAd();
  if (rewarded) {
    // کاربر پاداش گرفت
    // مثلاً: سکه اضافه کن
  }
};