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

import kotlin.Unit;
import kotlin.jvm.functions.Function3;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
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
 * This plugin uses the youtubedl-android library directly without reflection.
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

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        if (context != null) {
            notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            createNotificationChannel();
            executor.execute(() -> initYoutubeDLEngine(context));
        }
    }

    private synchronized boolean initYoutubeDLEngine(Context context) {
        if (isEngineInitialized) return true;
        if (isInitializing) return false;
        isInitializing = true;

        try {
            Log.i(TAG, "Initializing on-device engine...");
            Context appContext = context.getApplicationContext();
            YoutubeDL.getInstance().init(appContext);
            try {
                FFmpeg.getInstance().init(appContext);
            } catch (Throwable t) {
                Log.w(TAG, "FFmpeg init warning: " + t.getMessage());
            }
            isEngineInitialized = true;
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "Failed to initialize engine", t);
            return false;
        } finally {
            isInitializing = false;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Undo Download Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
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
        ret.put("abi", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "unknown");
        call.resolve(ret);
    }

    @PluginMethod
    public void initEngine(PluginCall call) {
        executor.execute(() -> {
            boolean ready = initYoutubeDLEngine(getContext());
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("ready", ready);
            call.resolve(ret);
        });
    }

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
                if (isDirectMediaUrl(cleanUrl) && !isSocialMediaUrl(cleanUrl)) {
                    String filename = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1).split("\\?")[0];
                    if (filename.isEmpty()) filename = "media_download";

                    JSObject mediaInfo = new JSObject();
                    mediaInfo.put("id", "direct_" + System.currentTimeMillis());
                    mediaInfo.put("title", filename);
                    mediaInfo.put("directUrl", cleanUrl);
                    mediaInfo.put("extractor", "لینک مستقیم");
                    mediaInfo.put("formats", new JSArray());

                    JSObject ret = new JSObject();
                    ret.put("mediaInfo", mediaInfo);
                    call.resolve(ret);
                    return;
                }

                if (!isEngineInitialized) initYoutubeDLEngine(getContext());
                if (!isEngineInitialized) {
                    call.reject("موتور دانلود آماده نشد.");
                    return;
                }

                YoutubeDLRequest request = new YoutubeDLRequest(cleanUrl);
                request.addOption("--no-playlist");
                request.addOption("--no-check-certificates");
                
                VideoInfo videoInfo = YoutubeDL.getInstance().getInfo(request);
                
                JSObject mediaInfo = new JSObject();
                mediaInfo.put("id", videoInfo.getId() != null ? videoInfo.getId() : "media_" + System.currentTimeMillis());
                mediaInfo.put("title", videoInfo.getTitle() != null ? videoInfo.getTitle() : "رسانه دانلودی");
                mediaInfo.put("duration", videoInfo.getDuration());
                mediaInfo.put("thumbnail", videoInfo.getThumbnail() != null ? videoInfo.getThumbnail() : "");
                mediaInfo.put("extractor", videoInfo.getExtractor() != null ? videoInfo.getExtractor() : "yt-dlp");
                mediaInfo.put("webpage_url", videoInfo.getWebpageUrl() != null ? videoInfo.getWebpageUrl() : cleanUrl);

                JSArray formatsArray = new JSArray();
                List<VideoFormat> formats = videoInfo.getFormats();
                if (formats != null) {
                    for (VideoFormat f : formats) {
                        JSObject fObj = new JSObject();
                        fObj.put("format_id", f.getFormatId());
                        fObj.put("ext", f.getExt());
                        fObj.put("url", f.getUrl());
                        fObj.put("format_note", f.getFormatNote());
                        formatsArray.put(fObj);
                    }
                }
                mediaInfo.put("formats", formatsArray);

                JSObject ret = new JSObject();
                ret.put("mediaInfo", mediaInfo);
                call.resolve(ret);

            } catch (Exception e) {
                Log.e(TAG, "extractInfo error", e);
                call.reject(formatPersianError(e.getMessage()));
            }
        });
    }

    private String formatPersianError(String rawError) {
        if (rawError == null || rawError.isEmpty()) return "خطای نامشخص در پردازش دانلود.";
        if (rawError.contains("Video unavailable") || rawError.contains("Private video")) return "این ویدیو خصوصی است یا توسط ناشر حذف شده است.";
        if (rawError.contains("Sign in to confirm you’re not a bot") || rawError.contains("Sign in")) return "این ویدیو نیازمند تأیید هویت است یا توسط پلتفرم محدود شده است.";
        if (rawError.contains("HTTP Error 403") || rawError.contains("Forbidden")) return "دسترسی به لینک دانلود مسدود است (خطای ۴۰۳).";
        if (rawError.contains("HTTP Error 404") || rawError.contains("Not Found")) return "ویدیو یا فایل در آدرس مشخص شده یافت نشد (خطای ۴۰۴).";
        if (rawError.contains("Unsupported URL")) return "آدرس اینترنتی وارد شده پشتیبانی نمی‌شود.";
        if (rawError.contains("network") || rawError.contains("timed out") || rawError.contains("Connection refused")) return "خطا در اتصال به اینترنت یا سرور منبع. لطفاً اتصال شبکه را بررسی کنید.";
        return rawError;
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        String id = call.getString("id", "dl_" + System.currentTimeMillis());
        String url = call.getString("url");
        String directUrl = call.getString("directUrl");
        String formatId = call.getString("formatId", "best");
        String filename = call.getString("filename", "download.mp4");
        boolean audioOnly = Boolean.TRUE.equals(call.getBoolean("audioOnly", false));

        if (url == null || url.trim().isEmpty()) {
            call.reject("آدرس دانلود خالی است.");
            return;
        }

        File workingDir = getDownloadWorkingDir(getContext());
        File workOutputFile = new File(workingDir, filename);
        activeWorkFiles.put(id, workOutputFile);

        String targetUrl = (directUrl != null && !directUrl.trim().isEmpty()) ? directUrl.trim() : url.trim();

        if (isDirectMediaUrl(targetUrl) && !isSocialMediaUrl(targetUrl)) {
            downloadDirectHttp(id, targetUrl, filename, workOutputFile, call);
        } else {
            downloadWithYoutubeDL(id, targetUrl, formatId, audioOnly, filename, workOutputFile, call);
        }
    }

    private void downloadWithYoutubeDL(String id, String url, String formatId, boolean audioOnly, String displayName, File workOutputFile, PluginCall call) {
        executor.execute(() -> {
            try {
                if (!isEngineInitialized) initYoutubeDLEngine(getContext());
                
                YoutubeDLRequest request = new YoutubeDLRequest(url);
                request.addOption("-o", workOutputFile.getAbsolutePath());
                request.addOption("--newline");
                if (audioOnly) {
                    request.addOption("-x");
                    request.addOption("--audio-format", "mp3");
                } else if (formatId != null && !formatId.equals("best")) {
                    request.addOption("-f", formatId);
                }

                YoutubeDL.getInstance().execute(request, id, new Function3<Float, Long, String, Unit>() {
                    @Override
                    public Unit invoke(Float progress, Long etaInSeconds, String line) {
                        long speedBytes = parseSpeedBytesPerSec(line);
                        String speedStr = parseSpeedString(line);
                        String etaStr = etaInSeconds > 0 ? (etaInSeconds + " ثانیه") : "";
                        emitProgress(id, "downloading", progress, 0, 0, speedBytes, speedStr, etaStr, null, null);
                        return Unit.INSTANCE;
                    }
                });

                if (workOutputFile.exists()) {
                    File publicFile = copyToPublicDownloads(workOutputFile, displayName, "video/mp4");
                    emitProgress(id, "completed", 100, workOutputFile.length(), workOutputFile.length(), 0, "", "", publicFile.getAbsolutePath(), null);
                    activeWorkFiles.remove(id);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } else {
                    call.reject("فایل یافت نشد.");
                }
            } catch (Exception e) {
                Log.e(TAG, "Download error", e);
                call.reject(formatPersianError(e.getMessage()));
            }
        });
    }

    private void destroyProcessSafely(String processId) {
        try {
            YoutubeDL.getInstance().destroyProcessById(processId);
        } catch (Throwable t) {
            Log.e(TAG, "Destroy failed", t);
        }
    }

    private File getDownloadWorkingDir(Context context) {
        File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) dir = new File(context.getFilesDir(), "downloads");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private void downloadDirectHttp(String id, String urlStr, String displayName, File workOutputFile, PluginCall call) {
        executor.execute(() -> {
            AtomicBoolean isCancelled = new AtomicBoolean(false);
            activeHttpCancels.put(id, isCancelled);
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.connect();
                InputStream in = conn.getInputStream();
                FileOutputStream out = new FileOutputStream(workOutputFile);
                byte[] buffer = new byte[8192];
                int len;
                while ((len = in.read(buffer)) != -1) {
                    if (isCancelled.get()) break;
                    out.write(buffer, 0, len);
                }
                out.close();
                in.close();
                if (!isCancelled.get()) {
                    File publicFile = copyToPublicDownloads(workOutputFile, displayName, "application/octet-stream");
                    emitProgress(id, "completed", 100, workOutputFile.length(), workOutputFile.length(), 0, "", "", publicFile.getAbsolutePath(), null);
                    call.resolve(new JSObject().put("success", true));
                }
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    private File copyToPublicDownloads(File sourceFile, String displayName, String mimeType) {
        Context context = getContext();
        if (context == null || sourceFile == null || !sourceFile.exists()) {
            return sourceFile;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
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
                    }
                    values.clear();
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    context.getContentResolver().update(itemUri, values, null, null);
                    return new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "UndoDownloads/" + displayName);
                }
            } else {
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
                }
                MediaScannerConnection.scanFile(context, new String[]{destFile.getAbsolutePath()}, new String[]{mimeType}, null);
                return destFile;
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed publishing file: " + t.getMessage());
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
                    if (!numStr.isEmpty()) return (long) (Double.parseDouble(numStr) * multiplier);
                }
            }
        } catch (Exception ignored) {}
        return 0;
    }

    private String parseSpeedString(String line) {
        if (line == null) return "";
        try {
            int atIdx = line.indexOf("at ");
            if (atIdx != -1) {
                String sub = line.substring(atIdx + 3).trim();
                String[] parts = sub.split(" ");
                if (parts.length > 0) return parts[0];
            }
        } catch (Exception ignored) {}
        return "";
    }

    private void emitProgress(String downloadId, String status, float percent, long downloadedBytes, long totalBytes, long speedBytes, String speedFormatted, String eta, String localPath, String error) {
        JSObject data = new JSObject();
        data.put("downloadId", downloadId);
        data.put("status", status);
        data.put("progress", percent);
        data.put("speed", speedBytes);
        data.put("speedFormatted", speedFormatted);
        data.put("eta", eta);
        if (localPath != null) data.put("localPath", localPath);
        if (error != null) data.put("error", error);
        notifyListeners("onProgress", data);
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        String id = call.getString("id");
        if (id != null) destroyProcessSafely(id);
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            destroyProcessSafely(id);
            AtomicBoolean cancel = activeHttpCancels.remove(id);
            if (cancel != null) cancel.set(true);
        }
        call.resolve(new JSObject().put("success", true));
    }
}
