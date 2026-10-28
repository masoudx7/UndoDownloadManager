package com.undodownloadmanager.app.plugins;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Advanced Production-Ready Capacitor Plugin for Android Media & File Downloading.
 * Supports:
 * 1. Native yt-dlp execution when compatible binary is available.
 * 2. High-speed native Java chunked HTTP/HTTPS streaming engine with resume support.
 * 3. MediaStore integration for saving directly to public Downloads folder.
 * 4. Real-time progress, pause, resume, and cancel capabilities.
 */
@CapacitorPlugin(name = "YtDlp")
public class YtDlpPlugin extends Plugin {

    private static final String TAG = "YtDlpPlugin";
    private static final String CHANNEL_ID = "ytdlp_download_channel";
    private static final String CDN_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
    
    private File binDir;
    private File ytDlpBin;
    private File ffmpegBin;
    
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, Process> activeProcesses = new ConcurrentHashMap<>();
    private final Map<String, File> activeOutputFiles = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> activeHttpCancels = new ConcurrentHashMap<>();
    private NotificationManager notificationManager;

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        
        // Setup internal binaries directory inside context.getFilesDir()
        binDir = new File(context.getFilesDir(), "bin");
        if (!binDir.exists()) {
            binDir.mkdirs();
        }
        
        ytDlpBin = new File(binDir, "yt-dlp");
        ffmpegBin = new File(binDir, "ffmpeg");
        
        // Synchronously check or unpack native binaries
        executor.execute(() -> {
            try {
                ensureBinariesReadySync(context);
            } catch (Exception e) {
                Log.w(TAG, "Initial binary setup deferred: " + e.getMessage());
            }
        });
    }

    /**
     * Synchronously prepares binaries from assets or CDN with thread safety
     */
    private synchronized boolean ensureBinariesReadySync(Context context) {
        try {
            if (!binDir.exists()) {
                binDir.mkdirs();
            }

            // 1. Check or unpack yt-dlp
            if (!ytDlpBin.exists() || ytDlpBin.length() < 1024) {
                try {
                    copyAssetBinary(context, "bin/yt-dlp", ytDlpBin);
                    Log.i(TAG, "yt-dlp unpacked from APK assets.");
                } catch (Exception assetEx) {
                    Log.i(TAG, "yt-dlp not present in APK assets, downloading from CDN...");
                    downloadBinaryFromUrl(CDN_BASE + "/yt-dlp_linux_aarch64", ytDlpBin, "yt-dlp");
                }
            }

            if (ytDlpBin.exists() && ytDlpBin.length() > 0) {
                ytDlpBin.setExecutable(true);
                ytDlpBin.setExecutable(true, false);
                ytDlpBin.setReadable(true, false);
                ytDlpBin.setWritable(true, false);
            }

            // 2. Check or unpack ffmpeg
            if (!ffmpegBin.exists() || ffmpegBin.length() < 1024) {
                try {
                    copyAssetBinary(context, "bin/ffmpeg", ffmpegBin);
                    Log.i(TAG, "ffmpeg unpacked from APK assets.");
                } catch (Exception ignored) {
                    // ffmpeg is optional for direct streams
                }
            }

            if (ffmpegBin.exists() && ffmpegBin.length() > 0) {
                ffmpegBin.setExecutable(true);
                ffmpegBin.setExecutable(true, false);
                ffmpegBin.setReadable(true, false);
                ffmpegBin.setWritable(true, false);
            }

            Log.i(TAG, "=== BINARY VERIFICATION ===");
            Log.i(TAG, "Absolute path: " + ytDlpBin.getAbsolutePath());
            Log.i(TAG, "Exists: " + ytDlpBin.exists());
            Log.i(TAG, "Size: " + ytDlpBin.length() + " bytes");
            Log.i(TAG, "Can execute: " + ytDlpBin.canExecute());
            Log.i(TAG, "===========================");

            return ytDlpBin.exists() && ytDlpBin.canExecute();
        } catch (Exception e) {
            Log.e(TAG, "Error in ensureBinariesReadySync", e);
            return false;
        }
    }

    private void downloadBinaryFromUrl(String fileUrl, File outputFile, String binaryName) {
        try {
            Log.i(TAG, "Starting On-Demand download for " + binaryName + " from " + fileUrl);
            URL url = new URL(fileUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.connect();

            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                Log.w(TAG, "Failed downloading " + binaryName + ", HTTP: " + responseCode);
                return;
            }

            int fileLength = connection.getContentLength();
            try (InputStream input = connection.getInputStream();
                 OutputStream output = new FileOutputStream(outputFile)) {
                byte[] data = new byte[8192];
                long total = 0;
                int count;
                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);
                    if (fileLength > 0) {
                        int progress = (int) (total * 100 / fileLength);
                        emitBinaryProgress(binaryName, progress, total, fileLength);
                    }
                }
                output.flush();
            }

            outputFile.setExecutable(true);
            outputFile.setExecutable(true, false);
            outputFile.setReadable(true, false);
            outputFile.setWritable(true, false);
            Log.i(TAG, binaryName + " downloaded and set executable successfully.");
        } catch (Exception e) {
            Log.w(TAG, "Could not download " + binaryName + ": " + e.getMessage());
        }
    }

    private void emitBinaryProgress(String binaryName, int percent, long downloaded, long total) {
        JSObject data = new JSObject();
        data.put("binaryName", binaryName);
        data.put("progress", percent);
        data.put("downloadedBytes", downloaded);
        data.put("totalBytes", total);
        notifyListeners("onBinaryProgress", data);
    }

    private void copyAssetBinary(Context context, String assetPath, File outFile) throws Exception {
        try (InputStream in = context.getAssets().open(assetPath);
             OutputStream out = new FileOutputStream(outFile)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "دانلودهای هوشمند";
            String description = "گزارش پیشرفت دانلودهای در حال انجام";
            int importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Checks if a given URL is a direct media/file URL
     */
    private boolean isDirectMediaUrl(String url) {
        if (url == null) return false;
        String clean = url.toLowerCase().split("\\?")[0];
        return clean.endsWith(".mp4") || clean.endsWith(".mkv") || clean.endsWith(".webm") ||
               clean.endsWith(".mp3") || clean.endsWith(".wav") || clean.endsWith(".m4a") ||
               clean.endsWith(".zip") || clean.endsWith(".rar") || clean.endsWith(".7z") ||
               clean.endsWith(".apk") || clean.endsWith(".pdf") || clean.endsWith(".bin") ||
               clean.endsWith(".iso") || clean.endsWith(".tar") || clean.endsWith(".gz");
    }

    @PluginMethod
    public void ensureBinaries(PluginCall call) {
        executor.execute(() -> {
            try {
                Context context = getContext();
                boolean ready = ensureBinariesReadySync(context);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("ready", ready);
                ret.put("path", ytDlpBin.getAbsolutePath());
                ret.put("canExecute", ytDlpBin.canExecute());
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "ensureBinaries failed", e);
                call.reject("Setup failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void extractInfo(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        final String cleanUrl = url.trim();

        executor.execute(() -> {
            try {
                // If it is already a direct file link, resolve immediately without needing yt-dlp
                if (isDirectMediaUrl(cleanUrl)) {
                    String filename = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1).split("\\?")[0];
                    if (filename.isEmpty()) filename = "media_download";
                    String ext = filename.contains(".") ? filename.substring(filename.lastIndexOf('.') + 1) : "mp4";

                    JSObject mediaInfo = new JSObject();
                    mediaInfo.put("id", "direct_" + System.currentTimeMillis());
                    mediaInfo.put("title", filename);
                    mediaInfo.put("duration", 0);
                    mediaInfo.put("thumbnail", "");
                    mediaInfo.put("extractor", "Direct Link");
                    mediaInfo.put("webpage_url", cleanUrl);

                    JSObject ret = new JSObject();
                    ret.put("mediaInfo", mediaInfo);
                    call.resolve(ret);
                    return;
                }

                // Make sure binaries are prepared
                boolean ready = ensureBinariesReadySync(getContext());
                if (!ready) {
                    call.reject("NATIVE_EXECUTION_UNSUPPORTED: موتور بومی لینوکس در این دستگاه اجرا نشد.");
                    return;
                }

                ProcessBuilder pb = new ProcessBuilder(
                        ytDlpBin.getAbsolutePath(),
                        "--dump-single-json",
                        "--no-playlist",
                        cleanUrl
                );
                pb.redirectErrorStream(true);
                Process process = pb.start();

                BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                StringBuilder jsonOutput = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    jsonOutput.append(line);
                }
                int exitCode = process.waitFor();

                if (exitCode == 0 && jsonOutput.length() > 0) {
                    JSONObject jsonObj = new JSONObject(jsonOutput.toString());
                    JSObject mediaInfo = new JSObject();
                    mediaInfo.put("id", jsonObj.optString("id", "ytdlp_" + System.currentTimeMillis()));
                    mediaInfo.put("title", jsonObj.optString("title", "رسانه ویدیویی"));
                    mediaInfo.put("duration", jsonObj.optDouble("duration", 0));
                    mediaInfo.put("thumbnail", jsonObj.optString("thumbnail", ""));
                    mediaInfo.put("extractor", jsonObj.optString("extractor", "yt-dlp"));
                    mediaInfo.put("webpage_url", cleanUrl);

                    JSObject ret = new JSObject();
                    ret.put("mediaInfo", mediaInfo);
                    call.resolve(ret);
                } else {
                    call.reject("NATIVE_EXTRACTION_FAILED: " + (jsonOutput.length() > 0 ? jsonOutput.toString() : "exit code " + exitCode));
                }
            } catch (Exception e) {
                Log.w(TAG, "extractInfo native execution issue: " + e.getMessage());
                call.reject("NATIVE_EXECUTION_UNSUPPORTED: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        String id = call.getString("id", "dl_" + System.currentTimeMillis());
        String url = call.getString("url");
        String formatId = call.getString("formatId", "best");
        String filename = call.getString("filename", "video_" + System.currentTimeMillis() + ".mp4");
        Integer connections = call.getInt("connections", 4);

        if (url == null || url.trim().isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs();
        }
        File outputFile = new File(downloadsDir, filename);
        activeOutputFiles.put(id, outputFile);

        // If direct file link OR if yt-dlp binary is missing/not executable, use Native Java HTTP streaming engine
        boolean useDirectEngine = isDirectMediaUrl(url) || !ytDlpBin.exists() || !ytDlpBin.canExecute();

        if (useDirectEngine) {
            downloadDirectHttp(id, url, outputFile, call);
        } else {
            downloadWithYtDlpProcess(id, url, formatId, connections, outputFile, call);
        }
    }

    /**
     * High-speed native Java chunked HTTP/HTTPS streaming download engine.
     * Supports resume from .part file and direct saving to MediaStore.
     */
    private void downloadDirectHttp(String id, String urlStr, File outputFile, PluginCall call) {
        executor.execute(() -> {
            AtomicBoolean isCancelled = new AtomicBoolean(false);
            activeHttpCancels.put(id, isCancelled);

            File partFile = new File(outputFile.getAbsolutePath() + ".part");
            long existingBytes = partFile.exists() ? partFile.length() : 0;

            HttpURLConnection conn = null;
            RandomAccessFile outStream = null;
            InputStream inStream = null;

            try {
                URL url = new URL(urlStr);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36");

                if (existingBytes > 0) {
                    conn.setRequestProperty("Range", "bytes=" + existingBytes + "-");
                }

                conn.connect();

                int responseCode = conn.getResponseCode();
                boolean isPartial = responseCode == HttpURLConnection.HTTP_PARTIAL;

                if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_PARTIAL) {
                    throw new Exception("سرور پاسخ نامعتبر داد (کد: " + responseCode + ")");
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
                byte[] buffer = new byte[16384];
                long downloaded = existingBytes;
                long lastTime = System.currentTimeMillis();
                long lastDownloaded = downloaded;

                emitProgress(id, "downloading", 0, downloaded, "0 B/s", "در حال دانلود...", null);

                int bytesRead;
                while ((bytesRead = inStream.read(buffer)) != -1) {
                    if (isCancelled.get()) {
                        break;
                    }

                    outStream.write(buffer, 0, bytesRead);
                    downloaded += bytesRead;

                    long now = System.currentTimeMillis();
                    if (now - lastTime >= 500) {
                        float percent = totalBytes > 0 ? (float) downloaded * 100f / (float) totalBytes : 0;
                        long deltaBytes = downloaded - lastDownloaded;
                        float deltaSec = (now - lastTime) / 1000f;
                        long speedBytes = deltaSec > 0 ? (long) (deltaBytes / deltaSec) : 0;
                        String speedStr = formatSpeed(speedBytes);

                        long remainingBytes = Math.max(0, totalBytes - downloaded);
                        long etaSec = speedBytes > 0 ? (remainingBytes / speedBytes) : 0;
                        String etaStr = etaSec > 0 ? (etaSec + " ثانیه") : "محاسبه...";

                        emitProgress(id, "downloading", percent, downloaded, speedStr, etaStr, null);
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

                // Download completed: rename .part to final output file
                if (partFile.exists()) {
                    if (outputFile.exists()) {
                        outputFile.delete();
                    }
                    partFile.renameTo(outputFile);
                }

                scanFileIntoMediaStore(outputFile);
                emitProgress(id, "completed", 100, outputFile.length(), "0 B/s", "تکمیل شد", outputFile.getAbsolutePath());

                activeHttpCancels.remove(id);
                activeOutputFiles.remove(id);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("localPath", outputFile.getAbsolutePath());
                call.resolve(ret);

            } catch (Exception e) {
                Log.e(TAG, "Direct download error", e);
                try { if (outStream != null) outStream.close(); } catch (Exception ignored) {}
                try { if (inStream != null) inStream.close(); } catch (Exception ignored) {}
                try { if (conn != null) conn.disconnect(); } catch (Exception ignored) {}

                activeHttpCancels.remove(id);
                emitProgress(id, "error", 0, 0, "0 B/s", e.getMessage(), null);
                call.reject("Download failed: " + e.getMessage());
            }
        });
    }

    /**
     * Process-based download using yt-dlp binary with fallback to direct engine
     */
    private void downloadWithYtDlpProcess(String id, String url, String formatId, int connections, File outputFile, PluginCall call) {
        executor.execute(() -> {
            try {
                ProcessBuilder pb = new ProcessBuilder(
                        ytDlpBin.getAbsolutePath(),
                        "-c",
                        "--continue",
                        "--newline",
                        "-f", formatId,
                        "-N", String.valueOf(connections),
                        "-o", outputFile.getAbsolutePath(),
                        url
                );
                
                if (ffmpegBin.exists()) {
                    pb.environment().put("PATH", binDir.getAbsolutePath() + ":" + System.getenv("PATH"));
                }

                pb.redirectErrorStream(true);
                Process process;
                try {
                    process = pb.start();
                } catch (Exception startEx) {
                    Log.w(TAG, "yt-dlp process could not start, falling back to direct engine: " + startEx.getMessage());
                    downloadDirectHttp(id, url, outputFile, call);
                    return;
                }

                activeProcesses.put(id, process);

                BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                String line;
                
                emitProgress(id, "downloading", 0, 0, "0 B/s", "در حال دانلود...", null);

                while ((line = reader.readLine()) != null) {
                    if (line.contains("[download]")) {
                        parseAndEmitProgress(id, line);
                    }
                }

                int exitCode = process.waitFor();
                activeProcesses.remove(id);

                if (exitCode == 0 && outputFile.exists()) {
                    scanFileIntoMediaStore(outputFile);
                    emitProgress(id, "completed", 100, outputFile.length(), "0 B/s", "تکمیل شد", outputFile.getAbsolutePath());
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } else {
                    if (activeOutputFiles.containsKey(id)) {
                        emitProgress(id, "error", 0, 0, "0 B/s", "خطا در دانلود (کد: " + exitCode + ")", null);
                    }
                    call.reject("Download process exited with code " + exitCode);
                }
            } catch (Exception e) {
                Log.e(TAG, "Process download error", e);
                activeProcesses.remove(id);
                // Fallback to direct HTTP
                downloadDirectHttp(id, url, outputFile, call);
            }
        });
    }

    private String formatSpeed(long bytesPerSec) {
        if (bytesPerSec <= 0) return "0 B/s";
        if (bytesPerSec < 1024) return bytesPerSec + " B/s";
        if (bytesPerSec < 1024 * 1024) return String.format("%.1f KB/s", bytesPerSec / 1024f);
        return String.format("%.1f MB/s", bytesPerSec / (1024f * 1024f));
    }

    private void scanFileIntoMediaStore(File file) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, file.getName());
                values.put(MediaStore.MediaColumns.MIME_TYPE, getMimeType(file.getName()));
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            } else {
                Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                intent.setData(Uri.fromFile(file));
                context.sendBroadcast(intent);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed scanning into MediaStore: " + e.getMessage());
        }
    }

    private String getMimeType(String filename) {
        if (filename.endsWith(".mp4") || filename.endsWith(".m4v")) return "video/mp4";
        if (filename.endsWith(".mp3")) return "audio/mpeg";
        if (filename.endsWith(".m4a")) return "audio/m4a";
        if (filename.endsWith(".webm")) return "video/webm";
        if (filename.endsWith(".zip")) return "application/zip";
        if (filename.endsWith(".apk")) return "application/vnd.android.package-archive";
        return "application/octet-stream";
    }

    private void parseAndEmitProgress(String downloadId, String line) {
        try {
            float percent = 0;
            long downloadedBytes = 0;
            String speed = "0 B/s";
            String eta = "محاسبه...";

            if (line.contains("%")) {
                int percentIndex = line.indexOf("%");
                int startIndex = Math.max(0, percentIndex - 6);
                String percentStr = line.substring(startIndex, percentIndex).trim();
                percent = Float.parseFloat(percentStr);
            }

            if (line.contains("at ")) {
                try {
                    String speedPart = line.substring(line.indexOf("at ") + 3);
                    speed = speedPart.split(" ")[0] + "/s";
                } catch (Exception ignored) {}
            }

            if (line.contains("ETA ")) {
                try {
                    eta = line.substring(line.indexOf("ETA ") + 4).trim();
                } catch (Exception ignored) {}
            }

            emitProgress(downloadId, "downloading", percent, downloadedBytes, speed, eta, null);
        } catch (Exception e) {
            Log.d(TAG, "Parse progress warning: " + e.getMessage());
        }
    }

    private void emitProgress(String downloadId, String status, float percent, long downloadedBytes, String speed, String eta, String localPath) {
        JSObject data = new JSObject();
        data.put("downloadId", downloadId);
        data.put("status", status);
        data.put("progress", percent);
        data.put("downloadedBytes", downloadedBytes);
        data.put("speed", speed);
        data.put("eta", eta);
        if (localPath != null) {
            data.put("localPath", localPath);
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

            Process p = activeProcesses.remove(id);
            if (p != null) {
                p.destroy();
            }
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

            Process p = activeProcesses.remove(id);
            if (p != null) {
                p.destroyForcibly();
            }

            File file = activeOutputFiles.remove(id);
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
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
