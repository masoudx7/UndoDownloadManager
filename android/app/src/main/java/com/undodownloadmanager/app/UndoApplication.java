package com.undodownloadmanager.app;

import android.app.Application;
import android.content.Context;
import android.util.Log;

import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;

/**
 * Custom Application class for Undo Download Manager.
 * Initializes the on-device youtubedl-android and FFmpeg engines at the earliest
 * possible moment in the application lifecycle, preventing "instance not initialized" errors.
 */
public class UndoApplication extends Application {

    private static final String TAG = "UndoApplication";

    public static volatile boolean isYoutubeDLInitialized = false;
    public static volatile boolean isFFmpegInitialized = false;
    public static volatile String lastError = null;

    @Override
    public void onCreate() {
        super.onCreate();
        initializeEngines(this);
        triggerSilentBackgroundEngineUpdate(this);
    }

    public static synchronized boolean initializeEngines(Context context) {
        if (isYoutubeDLInitialized) {
            return true;
        }

        Context appContext = context != null ? context.getApplicationContext() : null;
        if (appContext == null) {
            Log.e(TAG, "initializeEngines: Context is null");
            lastError = "کانتکست اپلیکیشن در دسترس نیست";
            return false;
        }

        try {
            Log.i(TAG, "Initializing YoutubeDL on device...");
            YoutubeDL.getInstance().init(appContext);
            isYoutubeDLInitialized = true;
            lastError = null;
            Log.i(TAG, "YoutubeDL engine initialized successfully in Application.");
        } catch (Throwable t) {
            String msg = t.getMessage();
            Log.e(TAG, "YoutubeDL initialization notice: " + msg, t);
            if (msg != null && (msg.toLowerCase().contains("already initialized") || msg.toLowerCase().contains("initialized"))) {
                isYoutubeDLInitialized = true;
                lastError = null;
            } else {
                lastError = msg != null ? msg : t.toString();
            }
        }

        try {
            Log.i(TAG, "Initializing FFmpeg on device...");
            FFmpeg.getInstance().init(appContext);
            isFFmpegInitialized = true;
            Log.i(TAG, "FFmpeg engine initialized successfully in Application.");
        } catch (Throwable t) {
            Log.w(TAG, "FFmpeg initialization notice: " + t.getMessage(), t);
        }

        return isYoutubeDLInitialized;
    }

    /**
     * Silently checks and updates the yt-dlp binary in a background thread on every app run.
     * Runs with low priority, without interrupting the user, blocking the UI, or showing dialogs.
     */
    public static void triggerSilentBackgroundEngineUpdate(Context context) {
        if (context == null) return;
        final Context appContext = context.getApplicationContext();

        new Thread(() -> {
            try {
                // Brief 4-second delay so app startup, UI rendering, and database calls finish smoothly
                Thread.sleep(4000);

                if (!isYoutubeDLInitialized) {
                    initializeEngines(appContext);
                }

                if (isYoutubeDLInitialized) {
                    Log.i(TAG, "Starting silent background yt-dlp engine update check...");
                    YoutubeDL.UpdateStatus status = YoutubeDL.getInstance().updateYoutubeDL(appContext, YoutubeDL.UpdateChannel._STABLE);
                    Log.i(TAG, "Silent background engine update check completed with status: " + status);
                }
            } catch (Throwable t) {
                // Completely silent: ignore network/offline errors without interrupting the user
                Log.d(TAG, "Silent background engine update check skipped or failed: " + t.getMessage());
            }
        }, "SilentEngineUpdater").start();
    }
}
