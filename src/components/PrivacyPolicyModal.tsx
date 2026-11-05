import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col transition-colors">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">سیاست حفظ حریم خصوصی</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300 text-sm leading-relaxed space-y-4">
          <p>
            <strong>آندو دانلودر</strong> به حریم خصوصی شما اهمیت می‌دهد و ما متعهد به محافظت از آن هستیم. این برنامه با رویکرد "اول محلی" (Local-First) طراحی شده است.
          </p>
          <ul className="list-disc list-inside space-y-2 text-xs">
            <li><strong>پردازش کاملاً محلی:</strong> تمامی عملیات دانلود و مدیریت فایل‌ها تنها بر روی دستگاه شما انجام می‌شود و هیچ فایلی به سرورهای ما ارسال نمی‌گردد.</li>
            <li><strong>عدم جمع‌آوری اطلاعات:</strong> ما هیچ‌گونه اطلاعات شخصی، تاریخچه وب‌گردی یا داده‌های دانلودهای شما را ذخیره یا جمع‌آوری نمی‌کنیم.</li>
            <li><strong>دسترسی به فایل‌ها:</strong> برنامه فقط برای ذخیره‌سازی فایل‌های دانلودشده در پوشه انتخابی شما، به فضای حافظه دسترسی دارد و به سایر فایل‌های شخصی شما دسترسی ندارد.</li>
            <li><strong>امنیت:</strong> به دلیل اجرای آفلاین و محلی، حریم خصوصی شما در بالاترین سطح ممکن حفظ می‌شود.</li>
          </ul>
          
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-2xl transition cursor-pointer"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
};
