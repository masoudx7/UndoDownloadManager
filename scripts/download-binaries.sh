#!/usr/bin/env bash
# Undo Download Manager - Assets Preparation Script
#
# NOTE: The app now uses the native Android Bionic yt-dlp engine
# (io.github.junkfood02.youtubedl-android:library + ffmpeg) bundled via Gradle.
# No Linux ELF glibc binaries are required or downloaded here,
# ensuring the APK remains clean, lightweight, and fully Android Bionic compatible.

BIN_DIR="android/app/src/main/assets/bin"

mkdir -p "$BIN_DIR"
touch "$BIN_DIR/.gitkeep"

echo "✅ Binary assets directory initialized with .gitkeep"
echo "✅ On-device Android yt-dlp & FFmpeg engine is managed natively via Gradle AAR."
