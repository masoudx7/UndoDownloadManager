package com.undodownloadmanager.app;

import android.app.Application;
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

    @Override
    public void onCreate() {
        super.onCreate();
        initializeEngines();
    }

    private void initializeEngines() {
        try {
            Log.i(TAG, "Initializing YoutubeDL in Application.onCreate...");
            YoutubeDL.getInstance().init(this);
            Log.i(TAG, "YoutubeDL engine initialized successfully in Application.");
        } catch (Throwable t) {
            Log.e(TAG, "Failed to initialize YoutubeDL in Application.onCreate: " + t.getMessage(), t);
        }

        try {
            Log.i(TAG, "Initializing FFmpeg in Application.onCreate...");
            FFmpeg.getInstance().init(this);
            Log.i(TAG, "FFmpeg engine initialized successfully in Application.");
        } catch (Throwable t) {
            Log.w(TAG, "FFmpeg initialization warning in Application.onCreate: " + t.getMessage(), t);
        }
    }
}
