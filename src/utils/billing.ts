/**
 * Production-ready In-App Billing Service for Cafe Bazaar (Bazaar-Only Branch)
 * Powered by: @salarizadi/capacitor-cafebazaar-poolakey
 */

import { Capacitor } from '@capacitor/core';
import { CafebazaarPoolakey } from '@salarizadi/capacitor-cafebazaar-poolakey';
import { storageService } from '../services/storageService';

export type ProductType = 'inapp' | 'subs';
export type BillingProvider = 'bazaar';

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

const env = (import.meta as any).env || {};

export const SKUS = {
  COINS_10: env.VITE_PRODUCT_COIN_10 || 'coins_10_download',
  COINS_30: env.VITE_PRODUCT_COIN_30 || 'coins_30_download',
  UNLIMITED_1M: env.VITE_PRODUCT_UNLIMITED_1M || 'sub_unlimited_1m',
  UNLIMITED_3M: env.VITE_PRODUCT_UNLIMITED_3M || 'sub_unlimited_3m',
  UNLIMITED_1Y: env.VITE_PRODUCT_UNLIMITED_1Y || 'sub_unlimited_1y',
};

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

  public isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  public getStoreName(): string {
    if (!this.isNativeAndroid()) {
      return 'مرورگر وب (نسخه آزمایشی / فقط اندروید)';
    }
    return 'کافه بازار';
  }

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

      try {
        const rsaKey = env.VITE_BAZAAR_RSA_KEY || '';
        console.log('[Billing] Initializing Poolakey for Cafe Bazaar...');
        
        const initRes = await CafebazaarPoolakey.initialize({
          rsaPublicKey: rsaKey || undefined,
        });

        console.log('[Billing] Poolakey initialized:', initRes);
        this.isInitialized = true;
        return initRes.connected;
      } catch (err: any) {
        console.error(`[Billing] Initialization error:`, err);
        this.isInitialized = false;
        return false;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  public async purchase(sku: string): Promise<PurchaseResult> {
    const product = PRODUCTS[sku];
    if (!product) {
      return { success: false, sku, error: `شناسه محصول نامعتبر است: ${sku}` };
    }

    if (!this.isNativeAndroid()) {
      return {
        success: false,
        sku,
        isWebUnsupported: true,
        error: 'پرداخت درون‌برنامه‌ای کافه‌بازار فقط بر روی دستگاه‌های واقعی اندروید در دسترس است. لطفاً فایل APK را روی گوشی نصب نمایید.',
      };
    }

    if (!this.isInitialized) {
      const connected = await this.initBilling();
      if (!connected) {
        return {
          success: false,
          sku,
          error: `امکان برقراری ارتباط با سرویس پرداخت ${this.getStoreName()} وجود ندارد.`,
        };
      }
    }

    try {
      return await this.purchaseWithBazaar(product);
    } catch (err: any) {
      console.error(`[Billing] Purchase failed for ${sku}:`, err);
      return {
        success: false,
        sku,
        error: err.message || 'عملیات خرید لغو شد یا با خطا مواجه گردید.',
      };
    }
  }

  private async purchaseWithBazaar(product: ProductConfig): Promise<PurchaseResult> {
    console.log(`[Billing] Launching Bazaar purchase for ${product.sku}`);

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

    if (product.isConsumable && purchaseToken) {
      try {
        console.log(`[Billing] Consuming Bazaar purchase token: ${purchaseToken}`);
        await CafebazaarPoolakey.consumeProduct({ token: purchaseToken });
      } catch (consumeErr) {
        console.warn('[Billing] Warning: Failed to consume Bazaar purchase immediately:', consumeErr);
      }
    }

    return this.applyAndPersistPurchase(product, orderId, purchaseToken, 'bazaar');
  }

  private applyAndPersistPurchase(
    product: ProductConfig,
    orderId: string,
    purchaseToken: string,
    provider: BillingProvider
  ): PurchaseResult {
    try {
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

      if (product.isConsumable && product.coinsReward) {
        const currentCoins = storageService.getPurchasedCoins();
        storageService.setPurchasedCoins(currentCoins + product.coinsReward);

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

      if (product.durationDays) {
        const now = Date.now();
        const existingExpiry = storageService.getUnlimitedExpiry();
        const baseTime = (existingExpiry && existingExpiry > now) ? existingExpiry : now;
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

      return { success: true, sku: product.sku, orderId, purchaseToken, provider };
    } catch (e: any) {
      console.error('[Billing] Persistence error:', e);
      return { success: true, sku: product.sku, orderId, purchaseToken, provider };
    }
  }

  public async restorePurchases(): Promise<RestoreResult> {
    if (!this.isNativeAndroid()) {
      return { success: false, restoredSkus: [], activeUnlimited: false, message: 'بازیابی خریدها فقط در نسخه اندروید در دسترس است.' };
    }

    if (!this.isInitialized) {
      await this.initBilling();
    }

    const restoredSkus: string[] = [];
    let hasActiveUnlimited = false;

    try {
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

      return {
        success: true,
        restoredSkus,
        activeUnlimited: hasActiveUnlimited,
        unlimitedExpiry: hasActiveUnlimited ? storageService.getUnlimitedExpiryFormatted() || undefined : undefined,
        message: restoredSkus.length > 0 ? `تعداد ${restoredSkus.length} خرید قبلی بازیابی شد.` : 'هیچ خرید بازیابی‌نشده‌ای یافت نشد.',
      };
    } catch (err: any) {
      console.error('[Billing] Restore purchases failed:', err);
      return { success: false, restoredSkus: [], activeUnlimited: false, message: err.message || 'خطا در بازیابی خریدها.' };
    }
  }

  public isUnlimitedActive(): boolean {
    return storageService.isUnlimited();
  }

  public getUnlimitedExpiryFormatted(): string | null {
    return storageService.getUnlimitedExpiryFormatted();
  }
}

export const billingService = new IranianBillingService();
