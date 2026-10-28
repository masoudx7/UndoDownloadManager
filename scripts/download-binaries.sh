#!/usr/bin/env bash
set -e

BIN_DIR="android/app/src/main/assets/bin"

echo "Creating binary assets directory: $BIN_DIR"
mkdir -p "$BIN_DIR"
touch "$BIN_DIR/.gitkeep"

echo "Downloading latest yt-dlp (linux_aarch64)..."
if curl -L --connect-timeout 15 --max-time 120 --fail --output "$BIN_DIR/yt-dlp" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"; then
    echo "yt-dlp downloaded successfully."
    chmod +x "$BIN_DIR/yt-dlp" || true
else
    echo "Warning: Could not download yt-dlp binary during packaging. Plugin will use on-demand setup or direct engine."
fi

echo "Attempting to download static ffmpeg..."
TEMP_TAR="ffmpeg-release-arm64-static.tar.xz"
if curl -L --connect-timeout 15 --max-time 120 --fail --output "$TEMP_TAR" "https://www.johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"; then
    echo "Extracting ffmpeg using Python..."
    python3 -c "
import tarfile, os
try:
    with tarfile.open('$TEMP_TAR', 'r:xz') as tar:
        for member in tar.getmembers():
            if member.name.endswith('/ffmpeg'):
                f = tar.extractfile(member)
                if f:
                    with open('$BIN_DIR/ffmpeg', 'wb') as out:
                        out.write(f.read())
                break
except Exception as e:
    print('Failed extracting tar:', e)
" || true
    rm -f "$TEMP_TAR"
    if [ -f "$BIN_DIR/ffmpeg" ] && [ -s "$BIN_DIR/ffmpeg" ]; then
        chmod +x "$BIN_DIR/ffmpeg" || true
        echo "ffmpeg extracted successfully."
    fi
else
    echo "Notice: ffmpeg static build download skipped. Single-stream MP4 downloads will function normally."
    rm -f "$TEMP_TAR"
fi

touch "$BIN_DIR/.gitkeep"
echo "Binary assets directory verified:"
ls -lh "$BIN_DIR"
