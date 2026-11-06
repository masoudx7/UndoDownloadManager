# Capacitor rules
-keep public class * extends com.getcapacitor.Plugin {
    public <methods>;
}
-keep @com.getcapacitor.annotation.CapacitorPlugin class * {
    public <methods>;
}
-keep class com.getcapacitor.** { *; }

# Application and Plugin classes
-keep class com.undodownloadmanager.app.UndoApplication { *; }
-keep class com.undodownloadmanager.app.MainActivity { *; }
-keep class com.undodownloadmanager.app.plugins.YtDlpPlugin { *; }

# youtubedl-android and FFmpeg library rules
-keep class com.yausername.** { *; }
-keep interface com.yausername.** { *; }
-keep class io.github.junkfood02.** { *; }
-keep interface io.github.junkfood02.** { *; }
-dontwarn com.yausername.**
-dontwarn io.github.junkfood02.**

# Ensure native methods are not renamed or removed
-keepclasseswithmembernames class * {
    native <methods>;
}
-keepclassmembers class * {
    native <methods>;
}

# Keep line numbers and annotations for debugging and reflection
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,EnclosingMethod
-renamesourcefileattribute SourceFile
