// src/services/billing.ts

import { Myket } from '@salarizadi/capacitor-myket';
import { CafebazaarPoolakey } from '@salarizadi/capacitor-cafebazaar-poolakey';

// 🔑 انتخاب پلاگین بر اساس متغیر محیطی
const BILLING_PROVIDER = import.meta.env.VITE_BILLING_PROVIDER || 'myket';
const MYKET_RSA_KEY = import.meta.env.VITE_MYKET_RSA_KEY;
const BAZAAR_RSA_KEY = import.meta.env.VITE_BAZAAR_RSA_KEY;

// انتخاب پلاگین مناسب
const BillingPlugin = BILLING_PROVIDER === 'bazaar' ? CafebazaarPoolakey : Myket;
const RSA_PUBLIC_KEY = BILLING_PROVIDER === 'bazaar' ? BAZAAR_RSA_KEY : MYKET_RSA_KEY;

export const initBilling = async () => {
  // بررسی اینکه کلید تنظیم شده باشد
  if (!RSA_PUBLIC_KEY || RSA_PUBLIC_KEY === 'کلید_RSA_مایکت_شما' || RSA_PUBLIC_KEY === 'کلید_RSA_کافه_بازار_شما') {
    console.error(`❌ کلید RSA ${BILLING_PROVIDER === 'bazaar' ? 'کافه بازار' : 'مایکت'} در فایل .env تنظیم نشده است!`);
    return;
  }

  try {
    await BillingPlugin.initialize({ rsaPublicKey: RSA_PUBLIC_KEY });
    console.log(`✅ اتصال به ${BILLING_PROVIDER === 'bazaar' ? 'کافه بازار' : 'مایکت'} برقرار شد`);
  } catch (error) {
    console.error(`❌ خطا در اتصال به ${BILLING_PROVIDER === 'bazaar' ? 'کافه بازار' : 'مایکت'}:`, error);
  }
};

export const buyProduct = async (productId: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const listener = BillingPlugin.addListener('purchaseStateChanged', async (event: any) => {
      if (event.state === 'PURCHASED' && event.purchase?.productId === productId) {
        try {
          await BillingPlugin.consumeProduct({ token: event.purchase.purchaseToken });
          listener.remove();
          resolve(true);
        } catch (err) {
          listener.remove();
          reject(err);
        }
      } else if (event.state === 'CANCELLED') {
        listener.remove();
        reject(new Error('CANCELLED'));
      } else if (event.state === 'FAILED') {
        listener.remove();
        reject(new Error('FAILED'));
      }
    });

    BillingPlugin.purchaseProduct({
      productId: productId,
      payload: 'order_' + Date.now()
    }).catch((err) => {
      listener.remove();
      reject(err);
    });
  });
};