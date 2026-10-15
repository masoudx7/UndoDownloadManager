# راهنمای بسته‌بندی و اجرای موتور yt-dlp در اندروید با Capacitor
## (Android yt-dlp Packaging & Native Bridge Architecture)

این سند نحوه اجرای کاملاً بومی (Native) موتور قدرتمند **yt-dlp** بر روی دستگاه‌های اندرویدی در پروژه Capacitor را تشریح می‌کند.

---

### ۱. معماری کلی سیستم دانلود

سیستم دانلود از دو لایه هماهنگ تشکیل شده است:

1. **لایه وب / توسعه (Web & Dev Fallback):**
   - اتصال از طریق `EventSource` (Server-Sent Events) به اندپوینت `/api/ytdlp/stream`.
   - اجرای فرآیند واقعی `yt-dlp` با سوییچ `--progress-template` برای استخراج بایت‌ها، سرعت لحظه‌ای و زمان تخمینی (ETA).
   - امکان دانلود مستقیم انواع فایل‌ها با متد Chunked Streaming و پشتیبانی از هدر Range برای توقف/ادامه (Pause/Resume).

2. **لایه نیتیو اندروید (Capacitor Native Bridge):**
   - پلاگین بومی `YtDlpPlugin.java` ثبت‌شده در `MainActivity.java`.
   - دریافت رویدادهای پیشرفت در فرانت‌اند React با `plugin.addListener('onProgress', ...)`.
   - ذخیره‌سازی خودکار در پوشه عمومی دانلودهای گوشی (`/storage/emulated/0/Download`) با استفاده از `DownloadManager` و `@capacitor/filesystem`.
   - سرویس پیش‌زمینه (Foreground Service) و اعلان‌های نوار وضعیت گوشی (Notification Progress Bar) برای دانلود در پس‌زمینه بدون بسته‌شدن توسط سیستم‌عامل.

---

### ۲. نحوه قرار دادن باینری yt-dlp درون APK اندروید

برای اینکه برنامه بدون نیاز به هیچ سرور خارجی، مستقیماً روی گوشی فایل اجرایی yt-dlp را صدا بزند، دو روش استاندارد در اندروید وجود دارد:

#### روش اول: باینری کامپایل‌شده مستقل (Stand-alone ELF / Python Executable)
1. باینری مستقل پایتون یا نسخه کامپایل‌شده yt-dlp برای معماری‌های ARM (`arm64-v8a` و `armeabi-v7a`) را دانلود کنید:
   ```bash
   # مسیر قرارگیری باینری در پروژه اندروید:
   android/app/src/main/assets/bin/yt-dlp
   android/app/src/main/assets/bin/ffmpeg
   ```
2. در زمان اجرای اولیه برنامه، پلاگین جاوا فایل باینری را از پوشه `assets` به مسیر محلی اجرایی برنامه کپی می‌کند:
   ```java
   File internalBin = new File(context.getFilesDir(), "yt-dlp");
   // کپی از AssetManager و اعطای مجوز اجرا
   internalBin.setExecutable(true, false);
   ```
3. سپس با `ProcessBuilder` یا `Runtime.getRuntime().exec(...)` دستور دانلود مستقیماً اجرا می‌شود.

#### روش دوم: استفاده از Chaquopy (کامپایلر رسمی پایتون برای اندروید)
در فایل `android/app/build.gradle`:
```gradle
plugins {
    id 'com.android.application'
    id 'com.chaquo.python'
}

android {
    defaultConfig {
        ndk {
            abiFilters "arm64-v8a", "armeabi-v7a", "x86_64"
        }
        python {
            pip {
                install "yt-dlp"
            }
        }
    }
}
```
سپس در کد جاوا مستقیماً ماژول فراخوانی می‌شود:
```java
Python py = Python.getInstance();
PyObject ytDlpModule = py.getModule("yt_dlp");
PyObject ydl = ytDlpModule.callAttr("YoutubeDL", optionsMap);
ydl.callAttr("download", new Object[]{ videoUrl });
```

---

### ۳. مجوزهای اندروید (Android Permissions)
مجوزهای لازم در `android/app/src/main/AndroidManifest.xml` اضافه شده‌اند:
- `android.permission.INTERNET`: دسترسی کامل به اینترنت
- `android.permission.FOREGROUND_SERVICE`: اجرای فرآیند دانلود در پس‌زمینه
- `android.permission.FOREGROUND_SERVICE_DATA_SYNC`: سینک و دانلود دیتا طبق استانداردهای اندروید ۱۴+
- `android.permission.POST_NOTIFICATIONS`: نمایش پروگرس بار در نوار اعلان گوشی
- `android.permission.WRITE_EXTERNAL_STORAGE`: ذخیره در گالری و پوشه دانلودهای عمومی
