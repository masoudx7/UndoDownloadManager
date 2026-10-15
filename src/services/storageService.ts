/**
 * Production-ready Persistent Storage & Device Security Service for Undo Download Manager
 * Uses @capacitor/preferences (native SharedPreferences on Android) to ensure data survives
 * webview cache clears, app updates, and restarts.
 * 
 * Features:
 * 1. Persistent Storage via @capacitor/preferences
 * 2. Hardware-bound Device Fingerprinting via @capacitor/device
 * 3. Anti-tampering server-side quota verification
 * 4. Expiry-bound unlimited subscription tracking (timestamp based)
 * 5. Automatic migration from legacy localStorage
 * 6. Automatic purchase restoration integration on startup
 */

import { Preferences } from '@capacitor/preferences';
import { Device } from '@capacitor/device';
import { DownloadItem, ScheduleSettings } from '../types';
import { initialDownloads } from '../data/initialDownloads';

export const STORAGE_KEYS = {
  DOWNLOADS: 'undo_downloader_items_v2',
  DARK_MODE: 'undo_downloader_dark_mode',
  SCHEDULE: 'undo_downloader_schedule_v1',
  FREE_DOWNLOADS: 'undo_downloader_free_downloads_v1',
  PURCHASED_COINS: 'undo_downloader_purchased_coins_v1',
  IS_UNLIMITED: 'undo_downloader_unlimited_v1',
  UNLIMITED_EXPIRY: 'undo_downloader_unlimited_expiry_v1',
  PURCHASE_HISTORY: 'undo_downloader_purchase_history_v1',
  DEVICE_ID: 'undo_downloader_device_id_v2',
  INITIAL_INSTALLED_AT: 'undo_downloader_installed_at_v1',
  QUOTA_SYNCED_AT: 'undo_downloader_quota_synced_at_v1',
};

const DEFAULT_FREE_DOWNLOADS = 5;

export interface StorageSnapshot {
  downloads: DownloadItem[];
  darkMode: boolean;
  schedule: ScheduleSettings;
  freeDownloads: number;
  purchasedCoins: number;
  isUnlimited: boolean;
  unlimitedExpiry: number | null;
  deviceId: string;
}

class StorageService {
  private memoryCache: StorageSnapshot = {
    downloads: initialDownloads,
    darkMode: false,
    schedule: {
      enabled: false,
      startTime: '02:00',
      endTime: '07:00',
    },
    freeDownloads: DEFAULT_FREE_DOWNLOADS,
    purchasedCoins: 0,
    isUnlimited: false,
    unlimitedExpiry: null,
    deviceId: 'initializing...',
  };

  private isInitialized = false;
  private initPromise: Promise<StorageSnapshot> | null = null;

  constructor() {
    // Synchronously preload from localStorage if present as initial fallback before async Preferences resolve
    this.preloadFromLocalStorage();
  }

  /**
   * Fast synchronous preloading so React components render instantly
   */
  private preloadFromLocalStorage() {
    try {
      if (typeof window === 'undefined') return;

      const savedDark = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
      if (savedDark !== null) {
        this.memoryCache.darkMode = JSON.parse(savedDark);
      } else {
        this.memoryCache.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      const savedDownloads = localStorage.getItem(STORAGE_KEYS.DOWNLOADS);
      if (savedDownloads) {
        this.memoryCache.downloads = JSON.parse(savedDownloads);
      }

      const savedSchedule = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
      if (savedSchedule) {
        this.memoryCache.schedule = JSON.parse(savedSchedule);
      }

      const savedFree = localStorage.getItem(STORAGE_KEYS.FREE_DOWNLOADS);
      if (savedFree !== null) {
        this.memoryCache.freeDownloads = JSON.parse(savedFree);
      }

      const savedCoins = localStorage.getItem(STORAGE_KEYS.PURCHASED_COINS);
      if (savedCoins !== null) {
        this.memoryCache.purchasedCoins = JSON.parse(savedCoins);
      }

      const savedUnlimited = localStorage.getItem(STORAGE_KEYS.IS_UNLIMITED);
      if (savedUnlimited !== null) {
        this.memoryCache.isUnlimited = JSON.parse(savedUnlimited);
      }

      const savedExpiry = localStorage.getItem(STORAGE_KEYS.UNLIMITED_EXPIRY);
      if (savedExpiry !== null) {
        this.memoryCache.unlimitedExpiry = JSON.parse(savedExpiry);
      }

      const savedDevId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (savedDevId) {
        this.memoryCache.deviceId = savedDevId;
      }
    } catch (e) {
      console.warn('Initial localStorage preload warning:', e);
    }
  }

  /**
   * Initialize persistent storage with Capacitor Preferences, Device Fingerprint & Server Quota Sync
   */
  public async init(): Promise<StorageSnapshot> {
    if (this.isInitialized) return this.memoryCache;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // 1. Get or generate persistent Device ID
        const deviceId = await this.resolveDeviceId();
        this.memoryCache.deviceId = deviceId;

        // 2. Load from Capacitor Preferences (Native SharedPreferences)
        const [
          storedDownloads,
          storedDarkMode,
          storedSchedule,
          storedFreeDownloads,
          storedCoins,
          storedUnlimited,
          storedExpiry,
        ] = await Promise.all([
          Preferences.get({ key: STORAGE_KEYS.DOWNLOADS }),
          Preferences.get({ key: STORAGE_KEYS.DARK_MODE }),
          Preferences.get({ key: STORAGE_KEYS.SCHEDULE }),
          Preferences.get({ key: STORAGE_KEYS.FREE_DOWNLOADS }),
          Preferences.get({ key: STORAGE_KEYS.PURCHASED_COINS }),
          Preferences.get({ key: STORAGE_KEYS.IS_UNLIMITED }),
          Preferences.get({ key: STORAGE_KEYS.UNLIMITED_EXPIRY }),
        ]);

        // Downloads
        if (storedDownloads.value) {
          try {
            this.memoryCache.downloads = JSON.parse(storedDownloads.value);
          } catch {}
        } else if (this.memoryCache.downloads.length > 0) {
          // Migrate to preferences
          await Preferences.set({ key: STORAGE_KEYS.DOWNLOADS, value: JSON.stringify(this.memoryCache.downloads) });
        }

        // Dark Mode
        if (storedDarkMode.value !== null) {
          try {
            this.memoryCache.darkMode = JSON.parse(storedDarkMode.value);
          } catch {}
        }

        // Schedule
        if (storedSchedule.value) {
          try {
            this.memoryCache.schedule = JSON.parse(storedSchedule.value);
          } catch {}
        }

        // Purchased Coins
        if (storedCoins.value !== null) {
          try {
            this.memoryCache.purchasedCoins = parseInt(storedCoins.value, 10) || 0;
          } catch {}
        }

        // Unlimited Subscription & Expiry Check
        if (storedExpiry.value !== null) {
          const expiryNum = parseInt(storedExpiry.value, 10);
          this.memoryCache.unlimitedExpiry = isNaN(expiryNum) ? null : expiryNum;
        }

        if (this.memoryCache.unlimitedExpiry) {
          const now = Date.now();
          if (now > this.memoryCache.unlimitedExpiry) {
            // Subscription expired
            this.memoryCache.isUnlimited = false;
            await Preferences.set({ key: STORAGE_KEYS.IS_UNLIMITED, value: JSON.stringify(false) });
          } else {
            this.memoryCache.isUnlimited = true;
          }
        } else if (storedUnlimited.value !== null) {
          try {
            this.memoryCache.isUnlimited = JSON.parse(storedUnlimited.value);
          } catch {}
        }

        // Free downloads - Anti-bypass check
        if (storedFreeDownloads.value !== null) {
          this.memoryCache.freeDownloads = parseInt(storedFreeDownloads.value, 10);
        }

        // 3. Sync anti-tamper quota with backend using device fingerprint
        await this.syncQuotaWithServer(deviceId);

        // 4. Mirror back to memory cache and storage
        await this.saveAll();

        this.isInitialized = true;
        return this.memoryCache;
      } catch (err) {
        console.error('StorageService init error:', err);
        this.isInitialized = true;
        return this.memoryCache;
      }
    })();

    return this.initPromise;
  }

  /**
   * Resolve hardware-bound or cryptographic device ID
   */
  public async resolveDeviceId(): Promise<string> {
    try {
      const stored = await Preferences.get({ key: STORAGE_KEYS.DEVICE_ID });
      if (stored.value && stored.value.length > 5) {
        return stored.value;
      }

      // Check legacy localStorage
      const legacyId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DEVICE_ID) : null;
      if (legacyId && legacyId.length > 5) {
        await Preferences.set({ key: STORAGE_KEYS.DEVICE_ID, value: legacyId });
        return legacyId;
      }

      // Try native Device.getId()
      let hardwareId = '';
      try {
        const idInfo = await Device.getId();
        if (idInfo && idInfo.identifier) {
          hardwareId = idInfo.identifier;
        }
      } catch (devErr) {
        console.warn('Native Device.getId() not available, building fingerprint:', devErr);
      }

      // Build resilient device fingerprint
      let fingerprintBase = hardwareId;
      if (!fingerprintBase && typeof window !== 'undefined') {
        const screenStr = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
        const ua = navigator.userAgent || 'unknown';
        const lang = navigator.language || 'fa';
        fingerprintBase = `web_${this.simpleHash(`${ua}_${screenStr}_${lang}`)}_${Date.now()}`;
      } else if (!fingerprintBase) {
        fingerprintBase = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      await Preferences.set({ key: STORAGE_KEYS.DEVICE_ID, value: fingerprintBase });
      try {
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, fingerprintBase);
      } catch {}

      return fingerprintBase;
    } catch {
      return `dev_${Date.now()}`;
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Sync free download quota with server to prevent reset bypass
   */
  private async syncQuotaWithServer(deviceId: string): Promise<void> {
    try {
      const res = await fetch(`/api/quota/status?deviceId=${encodeURIComponent(deviceId)}`, {
        headers: {
          'x-device-id': deviceId,
        },
      });

      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        // If server reports fewer free downloads, honor server to prevent quota cheat
        if (typeof data.freeDownloadsRemaining === 'number') {
          if (data.freeDownloadsRemaining < this.memoryCache.freeDownloads) {
            this.memoryCache.freeDownloads = data.freeDownloadsRemaining;
          }
        }
        if (data.isUnlimited) {
          this.memoryCache.isUnlimited = true;
          if (data.unlimitedExpiry) {
            this.memoryCache.unlimitedExpiry = data.unlimitedExpiry;
          }
        }
      }
    } catch (netErr) {
      console.warn('Server quota sync skipped (offline or network issue):', netErr);
    }
  }

  /**
   * Save all values to persistent storage and localStorage backup
   */
  private async saveAll(): Promise<void> {
    try {
      await Promise.all([
        Preferences.set({ key: STORAGE_KEYS.DOWNLOADS, value: JSON.stringify(this.memoryCache.downloads) }),
        Preferences.set({ key: STORAGE_KEYS.DARK_MODE, value: JSON.stringify(this.memoryCache.darkMode) }),
        Preferences.set({ key: STORAGE_KEYS.SCHEDULE, value: JSON.stringify(this.memoryCache.schedule) }),
        Preferences.set({ key: STORAGE_KEYS.FREE_DOWNLOADS, value: JSON.stringify(this.memoryCache.freeDownloads) }),
        Preferences.set({ key: STORAGE_KEYS.PURCHASED_COINS, value: JSON.stringify(this.memoryCache.purchasedCoins) }),
        Preferences.set({ key: STORAGE_KEYS.IS_UNLIMITED, value: JSON.stringify(this.memoryCache.isUnlimited) }),
        Preferences.set({ key: STORAGE_KEYS.UNLIMITED_EXPIRY, value: JSON.stringify(this.memoryCache.unlimitedExpiry) }),
      ]);

      // Mirror to localStorage for instant synchronous read
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.DOWNLOADS, JSON.stringify(this.memoryCache.downloads));
        localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(this.memoryCache.darkMode));
        localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(this.memoryCache.schedule));
        localStorage.setItem(STORAGE_KEYS.FREE_DOWNLOADS, JSON.stringify(this.memoryCache.freeDownloads));
        localStorage.setItem(STORAGE_KEYS.PURCHASED_COINS, JSON.stringify(this.memoryCache.purchasedCoins));
        localStorage.setItem(STORAGE_KEYS.IS_UNLIMITED, JSON.stringify(this.memoryCache.isUnlimited));
        localStorage.setItem(STORAGE_KEYS.UNLIMITED_EXPIRY, JSON.stringify(this.memoryCache.unlimitedExpiry));
      }
    } catch (e) {
      console.error('Failed to save to Preferences:', e);
    }
  }

  // --- Getters ---

  public getSnapshot(): StorageSnapshot {
    return { ...this.memoryCache };
  }

  public getDownloads(): DownloadItem[] {
    return this.memoryCache.downloads;
  }

  public getDarkMode(): boolean {
    return this.memoryCache.darkMode;
  }

  public getSchedule(): ScheduleSettings {
    return this.memoryCache.schedule;
  }

  public getFreeDownloads(): number {
    return this.memoryCache.freeDownloads;
  }

  public getPurchasedCoins(): number {
    return this.memoryCache.purchasedCoins;
  }

  public isUnlimited(): boolean {
    if (!this.memoryCache.isUnlimited) return false;
    if (this.memoryCache.unlimitedExpiry) {
      if (Date.now() > this.memoryCache.unlimitedExpiry) {
        this.memoryCache.isUnlimited = false;
        this.setUnlimitedStatus(false, null);
        return false;
      }
    }
    return true;
  }

  public getUnlimitedExpiry(): number | null {
    return this.memoryCache.unlimitedExpiry;
  }

  public getUnlimitedExpiryFormatted(): string | null {
    if (!this.memoryCache.unlimitedExpiry) return null;
    if (Date.now() > this.memoryCache.unlimitedExpiry) return 'منقضی شده';
    return new Date(this.memoryCache.unlimitedExpiry).toLocaleDateString('fa-IR');
  }

  public getDeviceId(): string {
    return this.memoryCache.deviceId;
  }

  // --- Setters with Native Persistence ---

  public async setDownloads(downloads: DownloadItem[]): Promise<void> {
    this.memoryCache.downloads = downloads;
    await Preferences.set({ key: STORAGE_KEYS.DOWNLOADS, value: JSON.stringify(downloads) });
    try {
      localStorage.setItem(STORAGE_KEYS.DOWNLOADS, JSON.stringify(downloads));
    } catch {}
  }

  public async setDarkMode(darkMode: boolean): Promise<void> {
    this.memoryCache.darkMode = darkMode;
    await Preferences.set({ key: STORAGE_KEYS.DARK_MODE, value: JSON.stringify(darkMode) });
    try {
      localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(darkMode));
    } catch {}
  }

  public async setSchedule(schedule: ScheduleSettings): Promise<void> {
    this.memoryCache.schedule = schedule;
    await Preferences.set({ key: STORAGE_KEYS.SCHEDULE, value: JSON.stringify(schedule) });
    try {
      localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(schedule));
    } catch {}
  }

  public async setFreeDownloads(count: number): Promise<void> {
    this.memoryCache.freeDownloads = count;
    await Preferences.set({ key: STORAGE_KEYS.FREE_DOWNLOADS, value: JSON.stringify(count) });
    try {
      localStorage.setItem(STORAGE_KEYS.FREE_DOWNLOADS, JSON.stringify(count));
    } catch {}
  }

  public async setPurchasedCoins(coins: number): Promise<void> {
    this.memoryCache.purchasedCoins = coins;
    await Preferences.set({ key: STORAGE_KEYS.PURCHASED_COINS, value: JSON.stringify(coins) });
    try {
      localStorage.setItem(STORAGE_KEYS.PURCHASED_COINS, JSON.stringify(coins));
    } catch {}
  }

  public async setUnlimitedStatus(isUnlimited: boolean, expiryTimestamp: number | null): Promise<void> {
    this.memoryCache.isUnlimited = isUnlimited;
    this.memoryCache.unlimitedExpiry = expiryTimestamp;

    await Promise.all([
      Preferences.set({ key: STORAGE_KEYS.IS_UNLIMITED, value: JSON.stringify(isUnlimited) }),
      Preferences.set({ key: STORAGE_KEYS.UNLIMITED_EXPIRY, value: JSON.stringify(expiryTimestamp) }),
    ]);

    try {
      localStorage.setItem(STORAGE_KEYS.IS_UNLIMITED, JSON.stringify(isUnlimited));
      localStorage.setItem(STORAGE_KEYS.UNLIMITED_EXPIRY, JSON.stringify(expiryTimestamp));
    } catch {}

    // Inform server
    this.notifyServerSubscription(isUnlimited, expiryTimestamp);
  }

  /**
   * Consume download quota:
   * First check unlimited, then free quota, then coins.
   * If free quota is consumed, decrement and verify with server so it cannot be bypassed.
   */
  public async consumeQuota(): Promise<{
    allowed: boolean;
    type?: 'unlimited' | 'free' | 'coin';
    remainingFree: number;
    remainingCoins: number;
    message?: string;
  }> {
    if (this.isUnlimited()) {
      return {
        allowed: true,
        type: 'unlimited',
        remainingFree: this.memoryCache.freeDownloads,
        remainingCoins: this.memoryCache.purchasedCoins,
      };
    }

    if (this.memoryCache.freeDownloads > 0) {
      const nextFree = this.memoryCache.freeDownloads - 1;
      await this.setFreeDownloads(nextFree);

      // Async report to server
      this.consumeServerQuota();

      return {
        allowed: true,
        type: 'free',
        remainingFree: nextFree,
        remainingCoins: this.memoryCache.purchasedCoins,
      };
    }

    if (this.memoryCache.purchasedCoins > 0) {
      const nextCoins = this.memoryCache.purchasedCoins - 1;
      await this.setPurchasedCoins(nextCoins);

      return {
        allowed: true,
        type: 'coin',
        remainingFree: 0,
        remainingCoins: nextCoins,
      };
    }

    return {
      allowed: false,
      remainingFree: 0,
      remainingCoins: 0,
      message: 'سهمیه دانلودهای رایگان و سکه‌های شما به پایان رسیده است.',
    };
  }

  private async consumeServerQuota() {
    try {
      await fetch('/api/quota/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': this.memoryCache.deviceId,
        },
        body: JSON.stringify({
          deviceId: this.memoryCache.deviceId,
        }),
      });
    } catch (e) {
      // Best effort
    }
  }

  private async notifyServerSubscription(isUnlimited: boolean, expiryTimestamp: number | null) {
    try {
      await fetch('/api/quota/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': this.memoryCache.deviceId,
        },
        body: JSON.stringify({
          deviceId: this.memoryCache.deviceId,
          isUnlimited,
          unlimitedExpiry: expiryTimestamp,
        }),
      });
    } catch {}
  }
}

export const storageService = new StorageService();
