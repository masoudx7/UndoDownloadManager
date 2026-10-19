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
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Advanced Capacitor Plugin for Real Android yt-dlp & ffmpeg Execution.
 * Manages asset binary unpacking, execution, progress streaming, real pause/resume/cancel,
 * and saving to public Downloads or MediaStore.
 */
@CapacitorPlugin(name = "YtDlp")
public class YtDlpPlugin extends Plugin {

    private static final String TAG = "YtDlpPlugin";
    private static final String CHANNEL_ID = "ytdlp_download_channel";
    
    private File binDir;
    private File ytDlpBin;
    private File ffmpegBin;
    
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, Process> activeProcesses = new HashMap<>();
    private final Map<String, File> activeOutputFiles = new HashMap<>();
    private NotificationManager notificationManager;

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        
        // Setup internal binaries directory
        binDir = new File(context.getFilesDir(), "bin");
        if (!binDir.exists()) {
            binDir.mkdirs();
        }
        
        ytDlpBin = new File(binDir, "yt-dlp");
        ffmpegBin = new File(binDir, "ffmpeg");
        
        // Unpack binaries from assets on first run or update
        unpackBinariesIfNeeded(context);
    }

    private void unpackBinariesIfNeeded(Context context) {
        try {
            // Unpack yt-dlp
            if (!ytDlpBin.exists() || ytDlpBin.length() == 0) {
                copyAssetBinary(context, "bin/yt-dlp", ytDlpBin);
            }
            if (ytDlpBin.exists()) {
                ytDlpBin.setExecutable(true, false);
                ytDlpBin.setReadable(true, false);
                ytDlpBin.setWritable(true, false);
            }

            // Unpack ffmpeg
            if (!ffmpegBin.exists() || ffmpegBin.length() == 0) {
                try {
                    copyAssetBinary(context, "bin/ffmpeg", ffmpegBin);
                } catch (Exception e) {
                    Log.w(TAG, "ffmpeg binary not found in assets, skipping: " + e.getMessage());
                }
            }
            if (ffmpegBin.exists()) {
                ffmpegBin.setExecutable(true, false);
                ffmpegBin.setReadable(true, false);
                ffmpegBin.setWritable(true, false);
            }
            
            Log.i(TAG, "Binaries unpacked successfully. yt-dlp path: " + ytDlpBin.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "Failed to unpack native binaries", e);
        }
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
            CharSequence name = "دانلودهای هوشمند yt-dlp";
            String description = "گزارش پیشرفت دانلودهای در حال انجام";
            int importance = NotificationManager.IMPORTANCE_LOW;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @PluginMethod
    public void extractInfo(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        executor.execute(() -> {
            try {
                if (!ytDlpBin.exists() || !ytDlpBin.canExecute()) {
                    unpackBinariesIfNeeded(getContext());
                }

                ProcessBuilder pb = new ProcessBuilder(
                        ytDlpBin.getAbsolutePath(),
                        "--dump-single-json",
                        "--no-playlist",
                        url
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
                    mediaInfo.put("title", jsonObj.optString("title", "رسانه ویدیوئی"));
                    mediaInfo.put("duration", jsonObj.optDouble("duration", 0));
                    mediaInfo.put("thumbnail", jsonObj.optString("thumbnail", ""));
                    mediaInfo.put("extractor", jsonObj.optString("extractor", "yt-dlp"));
                    mediaInfo.put("webpage_url", url);

                    JSObject ret = new JSObject();
                    ret.put("mediaInfo", mediaInfo);
                    call.resolve(ret);
                } else {
                    call.reject("Failed to extract video info. Exit code: " + exitCode);
                }
            } catch (Exception e) {
                Log.e(TAG, "extractInfo error", e);
                call.reject("Extraction error: " + e.getMessage());
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

        if (url == null || url.isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs();
        }
        File outputFile = new File(downloadsDir, filename);
        activeOutputFiles.put(id, outputFile);

        executor.execute(() -> {
            try {
                if (!ytDlpBin.exists() || !ytDlpBin.canExecute()) {
                    unpackBinariesIfNeeded(getContext());
                }

                // Build yt-dlp arguments with resume support (-c)
                ProcessBuilder pb = new ProcessBuilder(
                        ytDlpBin.getAbsolutePath(),
                        "-c", // Resume interrupted downloads from .part file
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
                Process process = pb.start();
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
                    // Register file in MediaStore so it appears in gallery / file manager immediately
                    scanFileIntoMediaStore(outputFile);
                    emitProgress(id, "completed", 100, outputFile.length(), "0 B/s", "تکمیل شد", outputFile.getAbsolutePath());
                } else {
                    // If process was destroyed/paused, don't trigger error event
                    if (exitCode != 0 && activeOutputFiles.containsKey(id)) {
                        emitProgress(id, "error", 0, 0, "0 B/s", "خطا در دانلود (کد: " + exitCode + ")", null);
                    }
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "startDownload error", e);
                activeProcesses.remove(id);
                emitProgress(id, "error", 0, 0, "0 B/s", e.getMessage(), null);
                call.reject("Download failed: " + e.getMessage());
            }
        });
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
            Log.w(TAG, "Failed to scan file into MediaStore: " + e.getMessage());
        }
    }

    private String getMimeType(String filename) {
        if (filename.endsWith(".mp4") || filename.endsWith(".m4v")) return "video/mp4";
        if (filename.endsWith(".mp3")) return "audio/mpeg";
        if (filename.endsWith(".m4a")) return "audio/m4a";
        if (filename.endsWith(".webm")) return "video/webm";
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
                // Clean non-numeric characters
                percentStr = percentStr.replaceAll("[^0-9.]", "");
                try {
                    percent = Float.parseFloat(percentStr);
                } catch (Exception ignored) {}
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
            Log.d(TAG, "Parse error: " + e.getMessage());
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
            Process p = activeProcesses.remove(id);
            if (p != null) {
                p.destroy(); // Gracefully stop yt-dlp process while retaining .part file for resume
            }
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("status", "paused");
        call.resolve(ret);
    }

    @PluginMethod
    public void resumeDownload(PluginCall call) {
        // Resume invokes startDownload; yt-dlp -c automatically picks up the .part file
        startDownload(call);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            Process p = activeProcesses.remove(id);
            if (p != null) {
                p.destroyForcibly();
            }

            File file = activeOutputFiles.remove(id);
            if (file != null) {
                if (file.exists()) {
                    file.delete();
                }
                // Delete .part or .ytdl partial files
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
