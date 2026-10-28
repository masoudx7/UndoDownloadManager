#!/usr/bin/env bash
# Undo Download Manager - Binary Assets Packager
#
# DUAL-MODE ARCHITECTURE NOTE:
# Linux ELF binaries compiled against glibc (like yt-dlp_linux_aarch64) may fail
# runtime execution on Android devices due to Bionic libc.
# The mobile app implements a production-grade dual-mode architecture:
# - Native Java HTTP chunked stream engine with Range resume & MediaStore for direct on-device downloading.
# - High-performance backend API for metadata & direct stream extraction.
# Assets bundled here are optional and best-effort; builds will never fail if binaries are absent.

BIN_DIR="android/app/src/main/assets/bin"

echo "=== Initializing Binary Assets Directory ==="
mkdir -p "$BIN_DIR"
touch "$BIN_DIR/.gitkeep"

# Best-effort packaging of binaries if network permits (timeout safely after 15s)
echo "Checking optional yt-dlp asset download..."
if curl -L --connect-timeout 15 --max-time 60 --fail --output "$BIN_DIR/yt-dlp" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"; then
    echo "yt-dlp downloaded to assets."
    chmod +x "$BIN_DIR/yt-dlp" || true
else
    echo "Notice: yt-dlp asset skipped or unavailable. App will use native Java HTTP engine + backend extraction."
fi

# Ensure .gitkeep is kept so git tracks the folder structure
touch "$BIN_DIR/.gitkeep"
echo "Binary assets directory verified:"
ls -lh "$BIN_DIR"
