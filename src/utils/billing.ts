import { CafeBazaar } from '@salarizadi/capacitor-cafebazaar-poolakey';

// کلید RSA را از متغیرهای محیطی (.env) می‌خواند
const RSA_KEY = import.meta.env.VITE_BAZAAR_RSA_KEY || '';

// شناسه محصولات تعریف شده
const PRODUCT_IDS = [
  'coins_10',
  'coins_30',
  'unlimited_1m',
  'unlimited_3m',
  'unlimited_1y'
];

/**
 * اتصال به سرویس پرداخت کافه‌بازار
 */
export const initBilling = async () => {
  try {
    if (!RSA_KEY) {
      console.warn('RSA Key for Bazaar is not set in environment variables.');
    }
    await CafeBazaar.connect({ rsaKey: RSA_KEY });
    console.log('✅ CafeBazaar connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to CafeBazaar:', error);
  }
};

/**
 * دریافت اطلاعات محصولات از کافه‌بازار
 */
export const getProducts = async () => {
  try {
    const response = await CafeBazaar.getProducts({ productIds: PRODUCT_IDS });
    return response.products || [];
  } catch (error) {
    console.error('❌ Failed to get products:', error);
    return [];
  }
};

/**
 * شروع فرآیند خرید یک محصول
 */
export const purchaseProduct = async (productId: string) => {
  try {
    const response = await CafeBazaar.purchase({ productId });
    return response;
  } catch (error) {
    console.error('❌ Purchase failed:', error);
    throw error;
  }
};

/**
 * مصرف محصول (مخصوص آیتم‌های مصرفی مثل سکه)
 */
export const consumePurchase = async (purchaseToken: string) => {
  try {
    await CafeBazaar.consume({ purchaseToken });
    console.log('✅ Purchase consumed successfully');
  } catch (error) {
    console.error('❌ Consume failed:', error);
  }
};

/**
 * قطع اتصال از سرویس پرداخت
 */
export const disconnectBilling = async () => {
  try {
    await CafeBazaar.disconnect();
  } catch (error) {
    console.error('❌ Failed to disconnect:', error);
  }
};
