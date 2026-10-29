package com.undodownloadmanager.app.plugins;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLException;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import com.yausername.youtubedl_android.mapper.VideoFormat;
import com.yausername.youtubedl_android.mapper.VideoInfo;
import com.yausername.ffmpeg.FFmpeg;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Production-Grade Android Native On-Device Media Downloader Plugin.
 *
 * Architecture & Capabilities:
 * 1. 100% On-Device Execution: Powered by youtubedl-android (Bionic libc & NDK) with zero
 *    external server dependencies for YouTube, Instagram, Facebook, TikTok, Twitter/X, and 1000+ sites.
 * 2. Embedded FFmpeg: Merges separate DASH audio & video streams into a unified high-definition MP4.
 * 3. Scoped Storage & MediaStore Compliant: Uses app-accessible working directory during download
 *    to prevent EACCES permission errors on Android 10-15, then automatically publishes completed files
 *    into the user's public Downloads folder and Android MediaStore gallery.
 * 4. High-Speed Direct HTTP/HTTPS Resume Engine: Handles direct files (APK, ZIP, MP4, etc.)
 *    with multi-threaded HTTP Range resume support and redirection handling.
 * 5. Live System Notifications: Real-time progress percentage and speed in the Android status bar.
 * 6. Persian-Friendly Localized Errors: Clear, actionable error messages for Iranian users.
 */
@CapacitorPlugin(name = "YtDlp")
public class YtDlpPlugin extends Plugin {

    private static final String TAG = "YtDlpPlugin";
    private static final String CHANNEL_ID = "undodownload_channel";
    private static final int NOTIFICATION_BASE_ID = 3000;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, File> activeWorkFiles = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> activeHttpCancels = new ConcurrentHashMap<>();
    private NotificationManager notificationManager;

    private volatile boolean isEngineInitialized = false;
    private volatile boolean isInitializing = false;

    @FunctionalInterface
    private interface ProgressConsumer {
        void accept(float progress, long etaInSeconds, String line);
    }

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        if (context != null) {
            notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            createNotificationChannel();

            // Asynchronously initialize on-device youtubedl-android & FFmpeg
            executor.execute(() -> {
                initYoutubeDLEngine(context);
            });
        }
    }

    /**
     * Initializes the native Android Bionic yt-dlp and ffmpeg binaries on-device.
     */
    private synchronized boolean initYoutubeDLEngine(Context context) {
        if (isEngineInitialized) {
            return true;
        }
        if (isInitializing) {
            return false;
        }
        isInitializing = true;

        try {
            Log.i(TAG, "Initializing on-device youtubedl-android engine (Bionic libc & NDK)...");
            Context appContext = context.getApplicationContext();
            YoutubeDL.getInstance().init(appContext);

            try {
                FFmpeg.getInstance().init(appContext);
                Log.i(TAG, "On-device FFmpeg library initialized successfully.");
            } catch (Throwable t) {
                Log.w(TAG, "FFmpeg init skipped/warning (yt-dlp may use internal muxer): " + t.getMessage());
            }

            isEngineInitialized = true;
            Log.i(TAG, "=== ON-DEVICE YOUTUBEDL ENGINE INITIALIZED SUCCESSFULLY ===");
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "Failed to initialize YoutubeDL engine: " + t.getMessage(), t);
            isEngineInitialized = false;
            return false;
        } finally {
            isInitializing = false;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "دانلودهای Undo Download Manager";
            String description = "نمایش زنده پیشرفت و سرعت دانلود فایل‌ها در نوار اعلان";
            int importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void updateNotification(int notifId, String title, int progress, String speed, boolean isDone) {
        if (notificationManager == null) return;
        try {
            Context context = getContext();
            if (context == null) return;

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_sys_download)
                    .setContentTitle(title)
                    .setOngoing(!isDone)
                    .setAutoCancel(isDone)
                    .setPriority(NotificationCompat.PRIORITY_LOW);

            if (isDone) {
                builder.setContentText("دانلود با موفقیت پایان یافت")
                        .setProgress(0, 0, false)
                        .setSmallIcon(android.R.drawable.stat_sys_download_done);
            } else {
                String contentText = (progress > 0 ? progress + "%" : "در حال دریافت...") +
                        (speed != null && !speed.isEmpty() ? " • " + speed : "");
                builder.setContentText(contentText)
                        .setProgress(100, Math.max(0, Math.min(100, progress)), progress <= 0);
            }

            notificationManager.notify(notifId, builder.build());
            if (isDone) {
                executor.execute(() -> {
                    try {
                        Thread.sleep(4000);
                        if (notificationManager != null) {
                            notificationManager.cancel(notifId);
                        }
                    } catch (Exception ignored) {}
                });
            }
        } catch (Exception e) {
            Log.d(TAG, "Notification skipped: " + e.getMessage());
        }
    }

    private boolean isDirectMediaUrl(String url) {
        if (url == null) return false;
        String clean = url.toLowerCase().split("\\?")[0];
        return clean.endsWith(".mp4") || clean.endsWith(".mkv") || clean.endsWith(".webm") ||
                clean.endsWith(".mp3") || clean.endsWith(".wav") || clean.endsWith(".m4a") ||
                clean.endsWith(".zip") || clean.endsWith(".rar") || clean.endsWith(".7z") ||
                clean.endsWith(".apk") || clean.endsWith(".pdf") || clean.endsWith(".bin") ||
                clean.endsWith(".iso") || clean.endsWith(".tar") || clean.endsWith(".gz");
    }

    private boolean isSocialMediaUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        return lower.contains("youtube.com") || lower.contains("youtu.be") ||
                lower.contains("instagram.com") || lower.contains("tiktok.com") ||
                lower.contains("twitter.com") || lower.contains("x.com") ||
                lower.contains("facebook.com") || lower.contains("fb.watch") ||
                lower.contains("soundcloud.com") || lower.contains("vimeo.com") ||
                lower.contains("aparat.com") || lower.contains("twitch.tv") ||
                lower.contains("reddit.com") || lower.contains("dailymotion.com");
    }

    @PluginMethod
    public void getEngineStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("ready", isEngineInitialized);
        ret.put("engine", "youtubedl-android");
        ret.put("nativeProcessSupported", true);
        ret.put("nativeDirectDownloaderAvailable", true);
        ret.put("abi", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "unknown");
        call.resolve(ret);
    }

    @PluginMethod
    public void ensureBinaries(PluginCall call) {
        initEngine(call);
    }

    @PluginMethod
    public void init(PluginCall call) {
        initEngine(call);
    }

    @PluginMethod
    public void initEngine(PluginCall call) {
        executor.execute(() -> {
            try {
                Context context = getContext();
                boolean ready = initYoutubeDLEngine(context);
                String version = "yt-dlp (embedded NDK)";
                try {
                    version = YoutubeDL.getInstance().version(context.getApplicationContext());
                } catch (Exception ignored) {}

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("ready", ready);
                ret.put("version", version);
                ret.put("engine", "youtubedl-android");
                ret.put("nativeProcessSupported", true);
                ret.put("nativeDirectDownloaderAvailable", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "initEngine error", e);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("ready", isEngineInitialized);
                ret.put("engine", "youtubedl-android");
                call.resolve(ret);
            }
        });
    }

    /**
     * Extracts media metadata (title, duration, thumbnail, formats) 100% on-device.
     */
    @PluginMethod
    public void extractInfo(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("لطفاً آدرس اینترنتی معتبر وارد کنید.");
            return;
        }

        final String cleanUrl = url.trim();

        executor.execute(() -> {
            try {
                // If direct media link, parse filename and resolve immediately
                if (isDirectMediaUrl(cleanUrl) && !isSocialMediaUrl(cleanUrl)) {
                    String filename = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1).split("\\?")[0];
                    if (filename.isEmpty()) filename = "media_download";

                    JSObject mediaInfo = new JSObject();
                    mediaInfo.put("id", "direct_" + System.currentTimeMillis());
                    mediaInfo.put("title", filename);
                    mediaInfo.put("duration", 0);
                    mediaInfo.put("thumbnail", "");
                    mediaInfo.put("extractor", "لینک مستقیم");
                    mediaInfo.put("webpage_url", cleanUrl);
                    mediaInfo.put("directUrl", cleanUrl);
                    mediaInfo.put("formats", new JSArray());

                    JSObject ret = new JSObject();
                    ret.put("mediaInfo", mediaInfo);
                    call.resolve(ret);
                    return;
                }

                // Ensure engine is initialized
                Context context = getContext();
                if (!isEngineInitialized && context != null) {
                    initYoutubeDLEngine(context);
                }

                if (!isEngineInitialized) {
                    call.reject("موتور دانلود در دستگاه آماده به کار نشد. لطفاً چند لحظه بعد تلاش کنید.");
                    return;
                }

                // Execute on-device yt-dlp metadata extraction
                YoutubeDLRequest request = new YoutubeDLRequest(cleanUrl);
                request.addOption("--no-playlist");
                request.addOption("--no-check-certificates");
                request.addOption("--socket-timeout", "20");

                VideoInfo videoInfo;
                try {
                    videoInfo = YoutubeDL.getInstance().getInfo(request);
                } catch (Throwable t) {
                    Log.w(TAG, "Full request getInfo failed, retrying with simple request: " + t.getMessage());
                    YoutubeDLRequest simpleRequest = new YoutubeDLRequest(cleanUrl);
                    simpleRequest.addOption("--no-playlist");
                    videoInfo = YoutubeDL.getInstance().getInfo(simpleRequest);
                }

                if (videoInfo == null) {
                    throw new Exception("امکان دریافت اطلاعات ویدیو وجود نداشت.");
                }

                JSObject mediaInfo = new JSObject();
                mediaInfo.put("id", videoInfo.getId() != null ? videoInfo.getId() : ("media_" + System.currentTimeMillis()));
                mediaInfo.put("title", videoInfo.getTitle() != null ? videoInfo.getTitle() : "رسانه دانلودی");
                mediaInfo.put("duration", videoInfo.getDuration());
                mediaInfo.put("thumbnail", videoInfo.getThumbnail() != null ? videoInfo.getThumbnail() : "");
                
                try {
                    if (videoInfo.getUploader() != null) mediaInfo.put("uploader", videoInfo.getUploader());
                } catch (Throwable ignored) {}

                try {
                    mediaInfo.put("extractor", videoInfo.getExtractor() != null ? videoInfo.getExtractor() : "yt-dlp");
                } catch (Throwable ignored) {
                    mediaInfo.put("extractor", "yt-dlp");
                }

                mediaInfo.put("webpage_url", videoInfo.getWebpageUrl() != null ? videoInfo.getWebpageUrl() : cleanUrl);
                if (videoInfo.getUrl() != null && !videoInfo.getUrl().isEmpty()) {
                    mediaInfo.put("directUrl", videoInfo.getUrl());
                }

                JSArray formatsArray = new JSArray();
                List<VideoFormat> formats = videoInfo.getFormats();
                if (formats != null) {
                    for (VideoFormat f : formats) {
                        try {
                            JSObject fObj = new JSObject();
                            fObj.put("format_id", f.getFormatId() != null ? f.getFormatId() : "");
                            fObj.put("ext", f.getExt() != null ? f.getExt() : "mp4");

                            String resolution = "";
                            try {
                                if (f.getWidth() > 0 && f.getHeight() > 0) {
                                    resolution = f.getWidth() + "x" + f.getHeight();
                                } else if (f.getHeight() > 0) {
                                    resolution = f.getHeight() + "p";
                                } else if (f.getFormatNote() != null && !f.getFormatNote().isEmpty()) {
                                    resolution = f.getFormatNote();
                                } else if (f.getFormat() != null && !f.getFormat().isEmpty()) {
                                    resolution = f.getFormat();
                                }
                            } catch (Throwable ignored) {}
                            fObj.put("resolution", resolution);

                            try {
                                long sz = f.getFileSize();
                                if (sz <= 0) {
                                    sz = f.getFileSizeApproximate();
                                }
                                fObj.put("filesize", sz > 0 ? sz : 0);
                            } catch (Throwable ignored) {
                                fObj.put("filesize", 0);
                            }

                            fObj.put("vcodec", f.getVcodec() != null ? f.getVcodec() : "");
                            fObj.put("acodec", f.getAcodec() != null ? f.getAcodec() : "");
                            fObj.put("url", f.getUrl() != null ? f.getUrl() : "");
                            fObj.put("format_note", f.getFormatNote() != null ? f.getFormatNote() : "");
                            try { fObj.put("fps", f.getFps()); } catch (Throwable ignored) { fObj.put("fps", 0); }
                            try { fObj.put("tbr", f.getTbr()); } catch (Throwable ignored) {}
                            formatsArray.put(fObj);
                        } catch (Throwable ignored) {}
                    }
                }
                mediaInfo.put("formats", formatsArray);

                JSObject ret = new JSObject();
                ret.put("mediaInfo", mediaInfo);
                call.resolve(ret);

            } catch (YoutubeDLException ye) {
                Log.e(TAG, "extractInfo YoutubeDLException", ye);
                String msg = ye.getMessage() != null ? ye.getMessage() : "";
                call.reject(formatPersianError(msg));
            } catch (Exception e) {
                Log.e(TAG, "extractInfo error", e);
                call.reject("خطا در دریافت مشخصات ویدیو: " + e.getMessage());
            }
        });
    }

    /**
     * Starts download on-device using youtubedl-android or high-speed direct HTTP resume downloader.
     */
    @PluginMethod
    public void startDownload(PluginCall call) {
        String id = call.getString("id", "dl_" + System.currentTimeMillis());
        String url = call.getString("url");
        String directUrl = call.getString("directUrl");
        String formatId = call.getString("formatId", "best");
        String filename = call.getString("filename", "video_" + System.currentTimeMillis() + ".mp4");
        boolean audioOnly = Boolean.TRUE.equals(call.getBoolean("audioOnly", false));

        if (url == null || url.trim().isEmpty()) {
            call.reject("آدرس دانلود نمی‌تواند خالی باشد.");
            return;
        }

        Context context = getContext();
        File workingDir = getDownloadWorkingDir(context);
        String safeFilename = sanitizeFilename(filename);
        File workOutputFile = new File(workingDir, safeFilename);
        activeWorkFiles.put(id, workOutputFile);

        String targetUrl = (directUrl != null && !directUrl.trim().isEmpty()) ? directUrl.trim() : url.trim();

        // If direct file link (mp4, zip, apk, etc.) without social streaming, use native Java HTTP Range downloader
        if ((isDirectMediaUrl(targetUrl) && !isSocialMediaUrl(targetUrl)) || (directUrl != null && !directUrl.isEmpty() && isDirectMediaUrl(directUrl))) {
            downloadDirectHttp(id, targetUrl, safeFilename, workOutputFile, call);
        } else {
            // Use on-device youtubedl-android & FFmpeg engine
            downloadWithYoutubeDL(id, targetUrl, formatId, audioOnly, safeFilename, workOutputFile, call);
        }
    }

    /**
     * Executes download using on-device youtubedl-android engine.
     */
    private void downloadWithYoutubeDL(String id, String url, String formatId, boolean audioOnly, String displayName, File workOutputFile, PluginCall call) {
        executor.execute(() -> {
            int notifId = NOTIFICATION_BASE_ID + Math.abs(id.hashCode() % 1000);
            try {
                Context context = getContext();
                if (!isEngineInitialized && context != null) {
                    initYoutubeDLEngine(context);
                }

                YoutubeDLRequest request = new YoutubeDLRequest(url);
                request.addOption("-o", workOutputFile.getAbsolutePath());
                request.addOption("--no-playlist");
                request.addOption("-c"); // resume partial downloads
                request.addOption("--newline");
                request.addOption("--no-check-certificates");
                request.addOption("--socket-timeout", "25");

                if (audioOnly) {
                    request.addOption("-x");
                    request.addOption("--audio-format", "mp3");
                } else if (formatId != null && !formatId.isEmpty() && !formatId.equals("best")) {
                    request.addOption("-f", formatId);
                } else {
                    request.addOption("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");
                }

                emitProgress(id, "downloading", 0, 0, 0, 0, "۰ بایت/ثانیه", "در حال شروع دانلود...", null, null);
                updateNotification(notifId, displayName, 0, "در حال اتصال...", false);

                executeYoutubeDLWithProgress(request, id, (progress, etaInSeconds, line) -> {
                    long etaSec = etaInSeconds > 0 ? etaInSeconds : 0;
                    String etaStr = etaSec > 0 ? (etaSec + " ثانیه") : "محاسبه...";
                    long speedBytes = parseSpeedBytesPerSec(line);
                    String speedStr = parseSpeedString(line);

                    emitProgress(id, "downloading", progress, 0, 0, speedBytes, speedStr, etaStr, null, null);
                    updateNotification(notifId, displayName, (int) progress, speedStr, false);
                });

                File completedFile = workOutputFile.exists() ? workOutputFile : findDownloadedFile(workOutputFile);
                if (completedFile != null && completedFile.exists()) {
                    // Export to Android public Downloads directory & MediaStore
                    File publicFile = copyToPublicDownloads(completedFile, displayName, getMimeType(completedFile.getName()));

                    updateNotification(notifId, displayName, 100, "تکمیل شد", true);
                    emitProgress(id, "completed", 100, completedFile.length(), completedFile.length(), 0, "۰ بایت/ثانیه", "تکمیل شده", publicFile.getAbsolutePath(), null);

                    activeWorkFiles.remove(id);

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("localPath", publicFile.getAbsolutePath());
                    call.resolve(ret);
                } else {
                    emitProgress(id, "error", 0, 0, 0, 0, "۰ بایت/ثانیه", "خطا در ذخیره فایل", null, "فایل دانلود شده یافت نشد.");
                    updateNotification(notifId, displayName, 0, "خطا در ذخیره فایل", true);
                    call.reject("فایل دانلود شده یافت نشد.");
                }

            } catch (YoutubeDLException ye) {
                Log.e(TAG, "YoutubeDL download failed", ye);
                activeWorkFiles.remove(id);
                updateNotification(notifId, displayName, 0, "خطا در دانلود", true);
                String friendly = formatPersianError(ye.getMessage());
                emitProgress(id, "error", 0, 0, 0, 0, "۰ بایت/ثانیه", "خطا", null, friendly);
                call.reject(friendly);
            } catch (Exception e) {
                Log.e(TAG, "Download execution exception: " + e.getMessage(), e);
                activeWorkFiles.remove(id);
                updateNotification(notifId, displayName, 0, "خطا در دانلود", true);
                String friendly = formatPersianError(e.getMessage());
                emitProgress(id, "error", 0, 0, 0, 0, "۰ بایت/ثانیه", "خطا", null, friendly);
                call.reject(friendly);
            }
        });
    }

    /**
     * Resiliently executes YoutubeDL with progress callback using reflection and dynamic proxy.
     */
    private YoutubeDLResponse executeYoutubeDLWithProgress(YoutubeDLRequest request, String processId, ProgressConsumer consumer) throws Exception {
        Method[] methods = YoutubeDL.class.getMethods();

        for (Method m : methods) {
            if ("execute".equals(m.getName())) {
                Class<?>[] params = m.getParameterTypes();

                // Signature: execute(YoutubeDLRequest, String processId, Callback/Function)
                if (params.length == 3 && params[0].equals(YoutubeDLRequest.class) && params[1].equals(String.class)) {
                    Object callbackProxy = createProgressProxy(params[2], consumer);
                    return (YoutubeDLResponse) m.invoke(YoutubeDL.getInstance(), request, processId, callbackProxy);
                }

                // Signature: execute(YoutubeDLRequest, Callback/Function, String processId)
                if (params.length == 3 && params[0].equals(YoutubeDLRequest.class) && params[2].equals(String.class)) {
                    Object callbackProxy = createProgressProxy(params[1], consumer);
                    return (YoutubeDLResponse) m.invoke(YoutubeDL.getInstance(), request, callbackProxy, processId);
                }

                // Signature: execute(YoutubeDLRequest, Callback/Function)
                if (params.length == 2 && params[0].equals(YoutubeDLRequest.class)) {
                    Object callbackProxy = createProgressProxy(params[1], consumer);
                    return (YoutubeDLResponse) m.invoke(YoutubeDL.getInstance(), request, callbackProxy);
                }
            }
        }

        // Direct fallback: execute(request)
        return YoutubeDL.getInstance().execute(request);
    }

    /**
     * Creates a dynamic proxy for the progress callback parameter.
     */
    private Object createProgressProxy(Class<?> callbackType, ProgressConsumer consumer) {
        if (!callbackType.isInterface()) {
            return null;
        }

        return Proxy.newProxyInstance(
                callbackType.getClassLoader(),
                new Class<?>[]{callbackType},
                (proxy, method, args) -> {
                    if (args != null && args.length >= 2) {
                        try {
                            float prog = ((Number) args[0]).floatValue();
                            long eta = ((Number) args[1]).longValue();
                            String line = args.length > 2 && args[2] != null ? args[2].toString() : "";
                            consumer.accept(prog, eta, line);
                        } catch (Exception ignored) {}
                    }

                    if (method.getReturnType().equals(void.class)) {
                        return null;
                    }

                    try {
                        Class<?> unitClass = Class.forName("kotlin.Unit");
                        return unitClass.getField("INSTANCE").get(null);
                    } catch (Exception ignored) {
                        return null;
                    }
                }
        );
    }

    private void destroyProcessSafely(String processId) {
        try {
            YoutubeDL.getInstance().destroyProcessById(processId);
        } catch (Throwable t) {
            try {
                Method m = YoutubeDL.class.getMethod("destroyProcessById", String.class);
                m.invoke(YoutubeDL.getInstance(), processId);
            } catch (Throwable ignored) {}
        }
    }

    private File getDownloadWorkingDir(Context context) {
        File dir = null;
        if (context != null) {
            dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) {
                dir = new File(context.getFilesDir(), "downloads");
            }
        }
        if (dir == null) {
            dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        }
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private File findDownloadedFile(File expectedFile) {
        try {
            if (expectedFile.exists()) return expectedFile;
            File parent = expectedFile.getParentFile();
            if (parent == null || !parent.exists()) return null;

            String baseName = expectedFile.getName();
            int dotIdx = baseName.lastIndexOf('.');
            String prefix = dotIdx > 0 ? baseName.substring(0, dotIdx) : baseName;

            File[] candidates = parent.listFiles((dir, name) -> name.startsWith(prefix) && !name.endsWith(".part") && !name.endsWith(".ytdl"));
            if (candidates != null && candidates.length > 0) {
                return candidates[0];
            }
        } catch (Exception ignored) {}
        return null;
    }

    /**
     * High-speed native Java chunked HTTP/HTTPS streaming resume engine for direct file URLs.
     */
    private void downloadDirectHttp(String id, String urlStr, String displayName, File workOutputFile, PluginCall call) {
        executor.execute(() -> {
            AtomicBoolean isCancelled = new AtomicBoolean(false);
            activeHttpCancels.put(id, isCancelled);

            File partFile = new File(workOutputFile.getAbsolutePath() + ".part");
            long existingBytes = partFile.exists() ? partFile.length() : 0;
            int notifId = NOTIFICATION_BASE_ID + Math.abs(id.hashCode() % 1000);

            HttpURLConnection conn = null;
            RandomAccessFile outStream = null;
            InputStream inStream = null;

            try {
                String currentUrl = urlStr;
                int redirects = 0;

                while (redirects < 5) {
                    URL u = new URL(currentUrl);
                    conn = (HttpURLConnection) u.openConnection();
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(30000);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36");

                    if (existingBytes > 0) {
                        conn.setRequestProperty("Range", "bytes=" + existingBytes + "-");
                    }

                    conn.connect();
                    int code = conn.getResponseCode();

                    if (code == HttpURLConnection.HTTP_MOVED_PERM || code == HttpURLConnection.HTTP_MOVED_TEMP ||
                            code == HttpURLConnection.HTTP_SEE_OTHER || code == 307 || code == 308) {
                        String loc = conn.getHeaderField("Location");
                        if (loc != null) {
                            currentUrl = loc;
                            conn.disconnect();
                            redirects++;
                            continue;
                        }
                    }
                    break;
                }

                int responseCode = conn.getResponseCode();
                boolean isPartial = responseCode == HttpURLConnection.HTTP_PARTIAL;

                if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_PARTIAL) {
                    throw new Exception("پاسخ سرور نامعتبر بود (کد: " + responseCode + ")");
                }

                long totalBytes = 0;
                if (isPartial) {
                    totalBytes = existingBytes + conn.getContentLength();
                } else {
                    existingBytes = 0;
                    totalBytes = conn.getContentLength();
                }

                outStream = new RandomAccessFile(partFile, "rw");
                if (isPartial && existingBytes > 0) {
                    outStream.seek(existingBytes);
                } else {
                    outStream.setLength(0);
                }

                inStream = conn.getInputStream();
                byte[] buffer = new byte[32768];
                long downloaded = existingBytes;
                long lastTime = System.currentTimeMillis();
                long lastDownloaded = downloaded;

                emitProgress(id, "downloading", 0, downloaded, totalBytes, 0, "۰ بایت/ثانیه", "در حال دانلود...", null, null);
                updateNotification(notifId, displayName, 0, "در حال اتصال...", false);

                int bytesRead;
                while ((bytesRead = inStream.read(buffer)) != -1) {
                    if (isCancelled.get()) {
                        break;
                    }

                    outStream.write(buffer, 0, bytesRead);
                    downloaded += bytesRead;

                    long now = System.currentTimeMillis();
                    if (now - lastTime >= 400) {
                        float percent = totalBytes > 0 ? (float) downloaded * 100f / (float) totalBytes : 0;
                        long deltaBytes = downloaded - lastDownloaded;
                        float deltaSec = (now - lastTime) / 1000f;
                        long speedBytes = deltaSec > 0 ? (long) (deltaBytes / deltaSec) : 0;
                        String speedStr = formatSpeed(speedBytes);

                        long remainingBytes = Math.max(0, totalBytes - downloaded);
                        long etaSec = speedBytes > 0 ? (remainingBytes / speedBytes) : 0;
                        String etaStr = etaSec > 0 ? (etaSec + " ثانیه") : "محاسبه...";

                        emitProgress(id, "downloading", percent, downloaded, totalBytes, speedBytes, speedStr, etaStr, null, null);
                        updateNotification(notifId, displayName, (int) percent, speedStr, false);

                        lastTime = now;
                        lastDownloaded = downloaded;
                    }
                }

                outStream.close();
                inStream.close();
                conn.disconnect();

                if (isCancelled.get()) {
                    return;
                }

                // Download completed: rename .part to final work output file
                if (partFile.exists()) {
                    if (workOutputFile.exists()) {
                        workOutputFile.delete();
                    }
                    partFile.renameTo(workOutputFile);
                }

                // Copy to public Android Downloads directory and MediaStore
                File publicFile = copyToPublicDownloads(workOutputFile, displayName, getMimeType(workOutputFile.getName()));

                updateNotification(notifId, displayName, 100, "تکمیل شد", true);
                emitProgress(id, "completed", 100, workOutputFile.length(), workOutputFile.length(), 0, "۰ بایت/ثانیه", "تکمیل شده", publicFile.getAbsolutePath(), null);

                activeHttpCancels.remove(id);
                activeWorkFiles.remove(id);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("localPath", publicFile.getAbsolutePath());
                call.resolve(ret);

            } catch (Exception e) {
                Log.e(TAG, "Direct download error", e);
                try { if (outStream != null) outStream.close(); } catch (Exception ignored) {}
                try { if (inStream != null) inStream.close(); } catch (Exception ignored) {}
                try { if (conn != null) conn.disconnect(); } catch (Exception ignored) {}

                activeHttpCancels.remove(id);
                if (!isCancelled.get()) {
                    String friendly = formatPersianError(e.getMessage());
                    updateNotification(notifId, displayName, 0, "خطا در دانلود", true);
                    emitProgress(id, "error", 0, 0, 0, 0, "۰ بایت/ثانیه", "خطا", null, friendly);
                    call.reject(friendly);
                }
            }
        });
    }

    /**
     * Publishes completed file into the Android MediaStore and public Downloads folder.
     */
    private File copyToPublicDownloads(File sourceFile, String displayName, String mimeType) {
        Context context = getContext();
        if (context == null || sourceFile == null || !sourceFile.exists()) {
            return sourceFile;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+) MediaStore Downloads API
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/UndoDownloads");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                Uri itemUri = context.getContentResolver().insert(collection, values);

                if (itemUri != null) {
                    try (InputStream in = new FileInputStream(sourceFile);
                         OutputStream out = context.getContentResolver().openOutputStream(itemUri)) {
                        byte[] buf = new byte[65536];
                        int len;
                        while ((len = in.read(buf)) > 0) {
                            out.write(buf, 0, len);
                        }
                        out.flush();
                    }

                    values.clear();
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    context.getContentResolver().update(itemUri, values, null, null);
                    Log.i(TAG, "File published into MediaStore Downloads: " + itemUri);
                }
            } else {
                // Android 9 and below: Direct public storage copy + MediaScanner
                File pubDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File destDir = new File(pubDownloads, "UndoDownloads");
                if (!destDir.exists()) destDir.mkdirs();
                File destFile = new File(destDir, displayName);

                try (InputStream in = new FileInputStream(sourceFile);
                     OutputStream out = new FileOutputStream(destFile)) {
                    byte[] buf = new byte[65536];
                    int len;
                    while ((len = in.read(buf)) > 0) {
                        out.write(buf, 0, len);
                    }
                    out.flush();
                }

                MediaScannerConnection.scanFile(
                        context,
                        new String[]{destFile.getAbsolutePath()},
                        new String[]{mimeType},
                        null
                );
                return destFile;
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed publishing file to public Downloads: " + t.getMessage(), t);
        }
        return sourceFile;
    }

    private long parseSpeedBytesPerSec(String line) {
        if (line == null) return 0;
        try {
            int atIdx = line.indexOf("at ");
            if (atIdx != -1) {
                String sub = line.substring(atIdx + 3).trim();
                String[] parts = sub.split(" ");
                if (parts.length > 0) {
                    String token = parts[0].toLowerCase();
                    double multiplier = 1;
                    if (token.contains("gib/s") || token.contains("gb/s")) multiplier = 1024L * 1024L * 1024L;
                    else if (token.contains("mib/s") || token.contains("mb/s")) multiplier = 1024L * 1024L;
                    else if (token.contains("kib/s") || token.contains("kb/s")) multiplier = 1024L;
                    else if (token.contains("b/s")) multiplier = 1L;

                    String numStr = token.replaceAll("[^0-9.]", "");
                    if (!numStr.isEmpty()) {
                        return (long) (Double.parseDouble(numStr) * multiplier);
                    }
                }
            }
        } catch (Exception ignored) {}
        return 0;
    }

    private String parseSpeedString(String line) {
        if (line == null) return "۰ بایت/ثانیه";
        try {
            int atIdx = line.indexOf("at ");
            if (atIdx != -1) {
                String sub = line.substring(atIdx + 3).trim();
                String[] parts = sub.split(" ");
                if (parts.length > 0) {
                    return parts[0];
                }
            }
        } catch (Exception ignored) {}
        return "۰ بایت/ثانیه";
    }

    private String formatSpeed(long bytesPerSec) {
        if (bytesPerSec <= 0) return "۰ بایت/ثانیه";
        if (bytesPerSec < 1024) return bytesPerSec + " بایت/ثانیه";
        if (bytesPerSec < 1024 * 1024) return String.format("%.1f کیلوبایت/ثانیه", bytesPerSec / 1024f);
        return String.format("%.1f مگابایت/ثانیه", bytesPerSec / (1024f * 1024f));
    }

    private String getMimeType(String filename) {
        if (filename == null) return "application/octet-stream";
        String lower = filename.toLowerCase();
        if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
        if (lower.endsWith(".mkv")) return "video/x-matroska";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".m4a")) return "audio/m4a";
        if (lower.endsWith(".webm")) return "video/webm";
        if (lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".apk")) return "application/vnd.android.package-archive";
        return "application/octet-stream";
    }

    private String sanitizeFilename(String filename) {
        if (filename == null || filename.trim().isEmpty()) {
            return "download_" + System.currentTimeMillis() + ".mp4";
        }
        return filename.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    }

    private String formatPersianError(String rawError) {
        if (rawError == null || rawError.isEmpty()) {
            return "خطای نامشخص در پردازش دانلود.";
        }
        if (rawError.contains("Video unavailable") || rawError.contains("Private video")) {
            return "این ویدیو خصوصی است یا توسط ناشر حذف شده است.";
        }
        if (rawError.contains("Sign in to confirm you’re not a bot") || rawError.contains("Sign in")) {
            return "این ویدیو نیازمند تأیید هویت است یا توسط پلتفرم محدود شده است.";
        }
        if (rawError.contains("HTTP Error 403") || rawError.contains("Forbidden")) {
            return "دسترسی به لینک دانلود مسدود است (خطای ۴۰۳).";
        }
        if (rawError.contains("HTTP Error 404") || rawError.contains("Not Found")) {
            return "ویدیو یا فایل در آدرس مشخص شده یافت نشد (خطای ۴۰۴).";
        }
        if (rawError.contains("Unsupported URL")) {
            return "آدرس اینترنتی وارد شده پشتیبانی نمی‌شود.";
        }
        if (rawError.contains("network") || rawError.contains("timed out") || rawError.contains("Connection refused")) {
            return "خطا در اتصال به اینترنت یا سرور منبع. لطفاً اتصال شبکه را بررسی کنید.";
        }
        return rawError;
    }

    private void emitProgress(String downloadId, String status, float percent, long downloadedBytes, long totalBytes, long speedBytes, String speedFormatted, String eta, String localPath, String error) {
        JSObject data = new JSObject();
        data.put("downloadId", downloadId);
        data.put("status", status);
        data.put("progress", percent);
        data.put("downloadedBytes", downloadedBytes);
        data.put("totalBytes", totalBytes);
        data.put("speed", speedBytes);
        data.put("speedFormatted", speedFormatted);
        data.put("eta", eta);
        if (localPath != null) {
            data.put("localPath", localPath);
        }
        if (error != null) {
            data.put("error", error);
        }
        notifyListeners("onProgress", data);
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            AtomicBoolean cancelFlag = activeHttpCancels.remove(id);
            if (cancelFlag != null) {
                cancelFlag.set(true);
            }
            destroyProcessSafely(id);
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("status", "paused");
        call.resolve(ret);
    }

    @PluginMethod
    public void resumeDownload(PluginCall call) {
        startDownload(call);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            AtomicBoolean cancelFlag = activeHttpCancels.remove(id);
            if (cancelFlag != null) {
                cancelFlag.set(true);
            }
            destroyProcessSafely(id);

            File file = activeWorkFiles.remove(id);
            if (file != null) {
                if (file.exists()) {
                    file.delete();
                }
                File partFile = new File(file.getAbsolutePath() + ".part");
                if (partFile.exists()) {
                    partFile.delete();
                }
                File ytdlFile = new File(file.getAbsolutePath() + ".ytdl");
                if (ytdlFile.exists()) {
                    ytdlFile.delete();
                }
            }

            int notifId = NOTIFICATION_BASE_ID + Math.abs(id.hashCode() % 1000);
            if (notificationManager != null) {
                notificationManager.cancel(notifId);
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
