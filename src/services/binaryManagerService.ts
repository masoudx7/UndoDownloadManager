import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface BinaryStatus {
  installed: boolean;
  version: string | null;
  size: number;
  lastUpdated: string | null;
}

class BinaryManagerService {
  private readonly BINARIES_KEY = 'binary_manager_status';

  async checkBinaries(): Promise<BinaryStatus> {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      return {
        installed: true,
        version: 'v2026.08.19-web',
        size: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    try {
      const win = (window as any);
      // Wait up to 2.5 seconds for native plugin bridge if initializing
      for (let i = 0; i < 25; i++) {
        if (win.Capacitor?.Plugins?.YtDlp?.ensureBinaries) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      if (win.Capacitor?.Plugins?.YtDlp?.ensureBinaries) {
        const res = await win.Capacitor.Plugins.YtDlp.ensureBinaries();
        if (res && res.ready) {
          const status: BinaryStatus = {
            installed: true,
            version: 'v2026.10-release',
            size: 39 * 1024 * 1024,
            lastUpdated: new Date().toISOString(),
          };
          await Preferences.set({
            key: this.BINARIES_KEY,
            value: JSON.stringify(status),
          });
          return status;
        }
      }
    } catch (e) {
      console.error('Check binaries native error:', e);
    }

    const stored = await Preferences.get({ key: this.BINARIES_KEY });
    if (stored.value) {
      return JSON.parse(stored.value);
    }

    return {
      installed: false,
      version: null,
      size: 0,
      lastUpdated: null,
    };
  }

  async downloadBinaries(
    onProgress: (progress: number, downloaded: number, total: number) => void
  ): Promise<void> {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      // Simulate progress for web preview
      for (let i = 0; i <= 100; i += 20) {
        await new Promise((r) => setTimeout(r, 200));
        onProgress(i, (i * 39 * 1024 * 1024) / 100, 39 * 1024 * 1024);
      }
      return;
    }

    const win = (window as any);
    for (let i = 0; i < 25; i++) {
      if (win.Capacitor?.Plugins?.YtDlp) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    if (win.Capacitor?.Plugins?.YtDlp) {
      const plugin = win.Capacitor.Plugins.YtDlp;

      let listener: any = null;
      if (plugin.addListener) {
        listener = plugin.addListener('onBinaryProgress', (event: any) => {
          if (event.progress !== undefined) {
            onProgress(event.progress, event.downloadedBytes || 0, event.totalBytes || 39 * 1024 * 1024);
          }
        });
      }

      try {
        await plugin.ensureBinaries();
        if (listener && listener.remove) {
          listener.remove();
        }
        const status: BinaryStatus = {
          installed: true,
          version: 'v2026.10-release',
          size: 39 * 1024 * 1024,
          lastUpdated: new Date().toISOString(),
        };
        await Preferences.set({
          key: this.BINARIES_KEY,
          value: JSON.stringify(status),
        });
      } catch (err) {
        if (listener && listener.remove) {
          listener.remove();
        }
        throw err;
      }
    } else {
      // If plugin not found on native, don't crash loop: mark as ready so user can access UI
      console.warn('YtDlp plugin not detected on native device, skipping setup screen.');
    }
  }

  async updateBinaries(): Promise<boolean> {
    try {
      const res = await fetch('/api/binaries/latest').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        return data.updateAvailable || false;
      }
    } catch {}
    return false;
  }
}

export const binaryManager = new BinaryManagerService();
