# Capacitor rules
-keep public class * extends com.getcapacitor.Plugin {
    public <methods>;
}
-keep @com.getcapacitor.annotation.CapacitorPlugin class * {
    public <methods>;
}
-keep class com.getcapacitor.** { *; }

# youtubedl-android and FFmpeg library rules
# These rely on JNI and reflection for mapping JSON to objects
-keep class com.yausername.youtubedl_android.** { *; }
-keep class com.yausername.ffmpeg.** { *; }

# Ensure native methods are not renamed or removed
-keepclasseswithmembernames class * {
    native <methods>;
}

# Preserve the specific plugin class
-keep class com.undodownloadmanager.app.plugins.YtDlpPlugin { *; }

# Keep line numbers for better crash reporting in production
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
