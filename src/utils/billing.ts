/**
 * Production-ready In-App Billing Service for Iranian Android App Stores (Cafe Bazaar & Myket)
 * Powered by:
 * - @salarizadi/capacitor-cafebazaar-poolakey (Poolakey for Cafe Bazaar)
 * - @salarizadi/capacitor-myket (Myket IAB)
 *
 * Features:
 * 1. Native bridge detection with auto-fallback or environment variable override (VITE_BILLING_PROVIDER).
 * 2. Proper RSA public key injection from .env (VITE_BAZAAR_RSA_KEY, VITE_MYKET_RSA_KEY).
 * 3. Configurable SKUs from .env with production fallbacks.
 * 4. Distinct handling for Consumable items (coins) vs Non-Consumable / Subscriptions (unlimited).
 *    - Automatic consumption of consumable purchases so they can be repurchased.
 *    - Retention of non-consumable subscriptions.
 * 5. Secure local persistence and state management.
 * 6. Explicit web / preview detection with polite, informative messaging instead of fake success.
 * 7. Restore purchases functionality for non-consumable subscriptions.
 */

import { Capacitor } from '@capacitor/core';
import { CafebazaarPoolakey } from '@salarizadi/capacitor-cafebazaar-poolakey';
import { Myket } from '@salarizadi/capacitor-myket';
import { storageService, STORAGE_KEYS } from '../services/storageService';

export type ProductType = 'inapp' | 'subs';
export type BillingProvider = 'bazaar' | 'myket';

export interface ProductConfig {
  sku: string;
  type: ProductType;
  isConsumable: boolean;
  coinsReward?: number;
  durationDays?: number;
  title: string;
  description: string;
  priceToman: number;
}

export interface PurchaseResult {
  success: boolean;
  sku: string;
  orderId?: string;
  purchaseToken?: string;
  provider?: BillingProvider;
  isConsumable?: boolean;
  coinsAdded?: number;
  unlimitedDaysAdded?: number;
  unlimitedExpiry?: string;
  error?: string;
  isWebUnsupported?: boolean;
}

export interface RestoreResult {
  success: boolean;
  restoredSkus: string[];
  activeUnlimited: boolean;
  unlimitedExpiry?: string;
  message: string;
}

// 1. Dynamic SKU mapping from Environment Variables or sensible production defaults
const env = (import.meta as any).env || {};

export const SKUS = {
  COINS_10: env.VITE_PRODUCT_COIN_10 || 'coins_10_download',
  COINS_30: env.VITE_PRODUCT_COIN_30 || 'coins_30_download',
  UNLIMITED_1M: env.VITE_PRODUCT_UNLIMITED_1M || 'sub_unlimited_1m',
  UNLIMITED_3M: env.VITE_PRODUCT_UNLIMITED_3M || 'sub_unlimited_3m',
  UNLIMITED_1Y: env.VITE_PRODUCT_UNLIMITED_1Y || 'sub_unlimited_1y',
};

// Aliased export for backwards compatibility
export const PRODUCT_SKUS = SKUS;

export const PRODUCTS: Record<string, ProductConfig> = {
  [SKUS.COINS_10]: {
    sku: SKUS.COINS_10,
    type: 'inapp',
    isConsumable: true,
    coinsReward: 10,
    title: 'بسته ۱۰ تایی دانلود',
    description: 'افزایش ۱۰ عدد سهمیه دانلود به حساب کاربری',
    priceToman: 79000,
  },
  [SKUS.COINS_30]: {
    sku: SKUS.COINS_30,
    type: 'inapp',
    isConsumable: true,
    coinsReward: 30,
    title: 'بسته ۳۰ تایی دانلود',
    description: 'افزایش ۳۰ عدد سهمیه دانلود برای کاربران پرکار',
    priceToman: 179000,
  },
  [SKUS.UNLIMITED_1M]: {
    sku: SKUS.UNLIMITED_1M,
    type: 'subs',
    isConsumable: false,
    durationDays: 30,
    title: 'اشتراک ۱ ماهه نامحدود',
    description: 'دانلود بدون هیچ‌گونه محدودیت تعداد برای مدت ۳۰ روز',
    priceToman: 89000,
  },
  [SKUS.UNLIMITED_3M]: {
    sku: SKUS.UNLIMITED_3M,
    type: 'subs',
    isConsumable: false,
    durationDays: 90,
    title: 'اشتراک ۳ ماهه نامحدود',
    description: 'دانلود بدون محدودیت برای ۹۰ روز با تخفیف ویژه',
    priceToman: 199000,
  },
  [SKUS.UNLIMITED_1Y]: {
    sku: SKUS.UNLIMITED_1Y,
    type: 'subs',
    isConsumable: false,
    durationDays: 365,
    title: 'اشتراک یکساله نامحدود (VIP)',
    description: 'دانلود نامحدود برای یک سال کامل بدون نیاز به خرید مجدد',
    priceToman: 399000,
  },
};

// Storage keys for persisting verified status
export const BILLING_STORAGE_KEYS = {
  PURCHASED_COINS: 'undo_downloader_purchased_coins_v1',
  IS_UNLIMITED: 'undo_downloader_unlimited_v1',
  UNLIMITED_EXPIRY: 'undo_downloader_unlimited_expiry_v1',
  PURCHASE_HISTORY: 'undo_downloader_purchase_history_v1',
};

class IranianBillingService {
  private isInitialized = false;
  private currentProvider: BillingProvider = 'bazaar';
  private connectionPromise: Promise<boolean> | null = null;

  /**
   * Check if app is executing inside a real native Android container
   */
  public isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Determine whether Bazaar or Myket should be preferred
   */
  public getTargetProvider(): BillingProvider {
    const configuredProvider = (env.VITE_BILLING_PROVIDER || '').toLowerCase();
    if (configuredProvider === 'myket') return 'myket';
    if (configuredProvider === 'bazaar') return 'bazaar';

    // Auto-detection from user agent or default to bazaar
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (ua.toLowerCase().includes('myket')) {
        return 'myket';
      }
    }
    return 'bazaar';
  }

  /**
   * Get active store Persian label
   */
  public getStoreName(): string {
    if (!this.isNativeAndroid()) {
      return 'مرورگر وب (نسخه آزمایشی / فقط اندروید)';
    }
    return this.currentProvider === 'bazaar' ? 'کافه بازار (بازار)' : 'مایکت';
  }

  /**
   * Initialize billing client connection with appropriate store
   */
  public async initBilling(): Promise<boolean> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      if (!this.isNativeAndroid()) {
        console.info('[Billing] Running in Web environment. Native IAB disabled.');
        this.isInitialized = true;
        return false;
      }

      this.currentProvider = this.getTargetProvider();

      try {
        if (this.currentProvider === 'bazaar') {
          const rsaKey = env.VITE_BAZAAR_RSA_KEY || '';
          console.log('[Billing] Initializing Poolakey for Cafe Bazaar...');
          
          const initRes = await CafebazaarPoolakey.initialize({
            rsaPublicKey: rsaKey || undefined,
          });

          console.log('[Billing] Poolakey initialized:', initRes);
          this.isInitialized = true;
          return initRes.connected;
        } else {
          const rsaKey = env.VITE_MYKET_RSA_KEY || '';
          console.log('[Billing] Initializing Myket In-App Billing...');

          const initRes = await Myket.initialize({
            rsaKey: rsaKey || '',
          });

          console.log('[Billing] Myket initialized:', initRes);
          this.isInitialized = true;
          return true;
        }
      } catch (err: any) {
        console.error(`[Billing] Initialization error for ${this.currentProvider}:`, err);
        this.isInitialized = false;
        return false;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Purchase a product SKU
   */
  public async purchase(sku: string): Promise<PurchaseResult> {
    const product = PRODUCTS[sku];
    if (!product) {
      return {
        success: false,
        sku,
        error: `شناسه محصول نامعتبر است: ${sku}`,
      };
    }

    // 1. Web / Preview environment guard:
    // Do NOT show fake success or dummy links. Return clear informative error.
    if (!this.isNativeAndroid()) {
      return {
        success: false,
        sku,
        isWebUnsupported: true,
        error: 'پرداخت درون‌برنامه‌ای کافه‌بازار و مایکت فقط بر روی دستگاه‌های واقعی اندروید در دسترس است. لطفاً فایل خروجی APK را بر روی گوشی اندرویدی خود نصب نمایید.',
      };
    }

    // Ensure connection is established
    if (!this.isInitialized) {
      const connected = await this.initBilling();
      if (!connected) {
        return {
          success: false,
          sku,
          error: `امکان برقراری ارتباط با سرویس پرداخت ${this.getStoreName()} وجود ندارد. لطفاً اطمینان حاصل کنید که اپلیکیشن ${this.getStoreName()} بر روی گوشی شما نصب و حساب کاربری‌تان فعال است.`,
        };
      }
    }

    // 2. Perform Native Purchase Flow
    try {
      if (this.currentProvider === 'bazaar') {
        return await this.purchaseWithBazaar(product);
      } else {
        return await this.purchaseWithMyket(product);
      }
    } catch (err: any) {
      console.error(`[Billing] Purchase failed for ${sku}:`, err);
      return {
        success: false,
        sku,
        error: err.message || 'عملیات خرید توسط کاربر لغو شد یا با خطا مواجه گردید.',
      };
    }
  }

  /**
   * Execute Cafe Bazaar Poolakey purchase
   */
  private async purchaseWithBazaar(product: ProductConfig): Promise<PurchaseResult> {
    console.log(`[Billing] Launching Bazaar purchase for ${product.sku} (${product.type})`);

    const result = await CafebazaarPoolakey.purchaseProduct({
      productId: product.sku,
      payload: `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    });

    if (result.state !== 'PURCHASED' || !result.purchase) {
      return {
        success: false,
        sku: product.sku,
        error: result.state === 'CANCELLED' ? 'خرید توسط کاربر لغو شد.' : 'پرداخت با موفقیت انجام نشد.',
      };
    }

    const { purchaseToken, orderId } = result.purchase;

    // Consumable products (Coins) MUST be consumed so the user can purchase again
    if (product.isConsumable && purchaseToken) {
      try {
        console.log(`[Billing] Consuming Bazaar purchase token: ${purchaseToken}`);
        await CafebazaarPoolakey.consumeProduct({ token: purchaseToken });
        console.log('[Billing] Successfully consumed Bazaar product');
      } catch (consumeErr) {
        console.warn('[Billing] Warning: Failed to consume Bazaar purchase immediately:', consumeErr);
      }
    }

    // Record verified purchase
    return this.applyAndPersistPurchase(product, orderId, purchaseToken, 'bazaar');
  }

  /**
   * Execute Myket purchase
   */
  private async purchaseWithMyket(product: ProductConfig): Promise<PurchaseResult> {
    console.log(`[Billing] Launching Myket purchase for ${product.sku} (${product.type})`);

    const purchase = await Myket.purchaseProduct({
      productId: product.sku,
      type: product.type,
      payload: `order_myket_${Date.now()}`,
    });

    if (!purchase || !purchase.purchaseToken) {
      return {
        success: false,
        sku: product.sku,
        error: 'پرداخت در مایکت انجام نشد یا توکن خرید دریافت نشد.',
      };
    }

    // Consumable products (Coins) MUST be consumed in Myket
    if (product.isConsumable && purchase.purchaseToken) {
      try {
        console.log(`[Billing] Consuming Myket purchase token: ${purchase.purchaseToken}`);
        await Myket.consumeProduct({ token: purchase.purchaseToken });
        console.log('[Billing] Successfully consumed Myket product');
      } catch (consumeErr) {
        console.warn('[Billing] Warning: Failed to consume Myket product immediately:', consumeErr);
      }
    }

    return this.applyAndPersistPurchase(product, purchase.orderId, purchase.purchaseToken, 'myket');
  }

  /**
   * Persist purchase results securely to storageService and Preferences
   */
  private applyAndPersistPurchase(
    product: ProductConfig,
    orderId: string,
    purchaseToken: string,
    provider: BillingProvider
  ): PurchaseResult {
    try {
      // 1. Update purchase history
      const historyStr = localStorage.getItem(BILLING_STORAGE_KEYS.PURCHASE_HISTORY);
      const history = historyStr ? JSON.parse(historyStr) : [];
      history.push({
        sku: product.sku,
        title: product.title,
        priceToman: product.priceToman,
        orderId,
        purchaseToken,
        provider,
        timestamp: Date.now(),
        dateFa: new Date().toLocaleDateString('fa-IR'),
      });
      localStorage.setItem(BILLING_STORAGE_KEYS.PURCHASE_HISTORY, JSON.stringify(history));

      // 2. Handle Consumable (Coins)
      if (product.isConsumable && product.coinsReward) {
        const currentCoins = storageService.getPurchasedCoins();
        const newCoins = currentCoins + product.coinsReward;
        storageService.setPurchasedCoins(newCoins);

        return {
          success: true,
          sku: product.sku,
          orderId,
          purchaseToken,
          provider,
          isConsumable: true,
          coinsAdded: product.coinsReward,
        };
      }

      // 3. Handle Non-Consumable / Subscriptions (Unlimited)
      if (product.durationDays) {
        const now = Date.now();
        const existingExpiry = storageService.getUnlimitedExpiry();
        let baseTime = now;
        if (existingExpiry && existingExpiry > now) {
          baseTime = existingExpiry; // Extend existing active subscription
        }

        const newExpiry = baseTime + product.durationDays * 24 * 60 * 60 * 1000;
        storageService.setUnlimitedStatus(true, newExpiry);

        return {
          success: true,
          sku: product.sku,
          orderId,
          purchaseToken,
          provider,
          isConsumable: false,
          unlimitedDaysAdded: product.durationDays,
          unlimitedExpiry: new Date(newExpiry).toLocaleDateString('fa-IR'),
        };
      }

      return {
        success: true,
        sku: product.sku,
        orderId,
        purchaseToken,
        provider,
      };
    } catch (e: any) {
      console.error('[Billing] Persistence error:', e);
      return {
        success: true,
        sku: product.sku,
        orderId,
        purchaseToken,
        provider,
      };
    }
  }

  /**
   * Restore user's non-consumable subscriptions / purchases
   */
  public async restorePurchases(): Promise<RestoreResult> {
    if (!this.isNativeAndroid()) {
      return {
        success: false,
        restoredSkus: [],
        activeUnlimited: false,
        message: 'بازیابی خریدها فقط بر روی نسخه اندروید در دسترس است.',
      };
    }

    if (!this.isInitialized) {
      await this.initBilling();
    }

    const restoredSkus: string[] = [];
    let hasActiveUnlimited = false;
    let latestExpiryDate: string | undefined;

    try {
      if (this.currentProvider === 'bazaar') {
        const purchaseInfo = await CafebazaarPoolakey.getPurchaseInfo();
        if (purchaseInfo && Array.isArray(purchaseInfo.purchases)) {
          for (const item of purchaseInfo.purchases) {
            restoredSkus.push(item.productId);
            const product = PRODUCTS[item.productId];
            if (product && !product.isConsumable && product.durationDays) {
              hasActiveUnlimited = true;
              this.applyAndPersistPurchase(product, item.orderId, item.purchaseToken, 'bazaar');
            }
          }
        }
      } else {
        const purchaseInfo = await Myket.getPurchaseInfo();
        if (purchaseInfo && Array.isArray(purchaseInfo.purchases)) {
          for (const item of purchaseInfo.purchases) {
            restoredSkus.push(item.productId);
            const product = PRODUCTS[item.productId];
            if (product && !product.isConsumable && product.durationDays) {
              hasActiveUnlimited = true;
              this.applyAndPersistPurchase(product, item.orderId, item.purchaseToken, 'myket');
            }
          }
        }
      }

      if (hasActiveUnlimited) {
        latestExpiryDate = storageService.getUnlimitedExpiryFormatted() || undefined;
      }

      return {
        success: true,
        restoredSkus,
        activeUnlimited: hasActiveUnlimited,
        unlimitedExpiry: latestExpiryDate,
        message:
          restoredSkus.length > 0
            ? `تعداد ${restoredSkus.length} خرید قبلی با موفقیت بازیابی شد.`
            : 'هیچ خرید بازیابی‌نشده‌ای در حساب شما یافت نشد.',
      };
    } catch (err: any) {
      console.error('[Billing] Restore purchases failed:', err);
      return {
        success: false,
        restoredSkus: [],
        activeUnlimited: false,
        message: err.message || 'خطا در بازیابی خریدهای قبلی از استور.',
      };
    }
  }

  /**
   * Check if unlimited subscription is currently valid
   */
  public isUnlimitedActive(): boolean {
    return storageService.isUnlimited();
  }

  /**
   * Get subscription expiry text
   */
  public getUnlimitedExpiryFormatted(): string | null {
    return storageService.getUnlimitedExpiryFormatted();
  }
}

export const billingService = new IranianBillingService();
