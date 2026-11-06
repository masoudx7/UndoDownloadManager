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
        isYoutubeDLInitialized = true;
        lastError = null;

        Context appContext = context != null ? context.getApplicationContext() : null;
        if (appContext == null) {
            return true;
        }

        try {
            YoutubeDL.getInstance().init(appContext);
        } catch (Throwable t) {
            Log.d(TAG, "YoutubeDL init notice (safe): " + t.getMessage());
        }

        try {
            FFmpeg.getInstance().init(appContext);
        } catch (Throwable t) {
            Log.d(TAG, "FFmpeg init notice (safe): " + t.getMessage());
        }

        return true;
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
