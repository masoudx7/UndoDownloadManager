#!/usr/bin/env bash
set -e

BIN_DIR="android/app/src/main/assets/bin"

echo "Creating binary assets directory: $BIN_DIR"
mkdir -p "$BIN_DIR"

echo "Downloading latest yt-dlp (linux_aarch64)..."
if curl -L --fail --output "$BIN_DIR/yt-dlp" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64"; then
    echo "yt-dlp downloaded successfully."
else
    echo "Error: Failed to download yt-dlp from GitHub releases."
    exit 1
fi

echo "Downloading static ffmpeg (arm64 static release from John Van Sickle)..."
TEMP_TAR="ffmpeg-release-arm64-static.tar.xz"
if curl -L --fail --output "$TEMP_TAR" "https://www.johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"; then
    echo "Extracting ffmpeg using Python..."
    python3 -c "
import tarfile, os
with tarfile.open('$TEMP_TAR', 'r:xz') as tar:
    for member in tar.getmembers():
        if member.name.endswith('/ffmpeg'):
            f = tar.extractfile(member)
            if f:
                with open('$BIN_DIR/ffmpeg', 'wb') as out:
                    out.write(f.read())
            break
"
    rm -f "$TEMP_TAR"
    echo "ffmpeg extracted successfully."
else
    echo "Warning: Failed to download ffmpeg static build. Proceeding with yt-dlp only."
    rm -f "$TEMP_TAR"
    touch "$BIN_DIR/ffmpeg"
fi

echo "Setting executable permissions (+x)..."
chmod +x "$BIN_DIR/yt-dlp"
if [ -f "$BIN_DIR/ffmpeg" ] && [ -s "$BIN_DIR/ffmpeg" ]; then
    chmod +x "$BIN_DIR/ffmpeg"
fi

echo "Binaries setup completed successfully in $BIN_DIR!"
ls -lh "$BIN_DIR"
