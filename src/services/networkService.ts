import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

export type NetworkStatusCallback = (isOnline: boolean) => void;

class NetworkService {
  private isOnline: boolean = true;
  private listeners: Set<NetworkStatusCallback> = new Set();

  constructor() {
    this.init();
  }

  private async init() {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Network.getStatus();
        this.isOnline = status.connected;

        Network.addListener('networkStatusChange', (status) => {
          this.isOnline = status.connected;
          this.notifyListeners(status.connected);
        });
      } catch (e) {
        console.warn('Capacitor Network plugin initialization failed:', e);
      }
    } else if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners(true);
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners(false);
      });
    }
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  public subscribe(callback: NetworkStatusCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach((callback) => {
      try {
        callback(isOnline);
      } catch (err) {
        console.error('Network listener callback error:', err);
      }
    });
  }
}

export const networkService = new NetworkService();
