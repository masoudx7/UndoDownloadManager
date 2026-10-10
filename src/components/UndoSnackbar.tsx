import React, { useEffect, useState } from 'react';
import { UndoNotification } from '../types';
import { RotateCcw, X, Trash2 } from 'lucide-react';

interface UndoSnackbarProps {
  notification: UndoNotification | null;
  onUndo: (item: UndoNotification['item']) => void;
  onDismiss: () => void;
  durationMs?: number;
}

export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({
  notification,
  onUndo,
  onDismiss,
  durationMs = 6000,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) {
      setProgress(100);
      return;
    }

    const intervalTime = 50;
    const step = (intervalTime / durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [notification, durationMs, onDismiss]);

  if (!notification) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 dark:bg-slate-800 text-white shadow-2xl rounded-2xl border border-slate-800 dark:border-slate-700 overflow-hidden animate-slide-up">
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold truncate">لغو و حذف فایل</p>
            <p className="text-xs text-slate-400 truncate mt-0.5" title={notification.item.name}>
              {notification.item.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              onUndo(notification.item);
              onDismiss();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-md shadow-blue-600/30 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازگردانی (Undo)</span>
          </button>
          
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Countdown Progress Line */}
      <div className="w-full bg-slate-800 h-1">
        <div
          className="bg-blue-500 h-full transition-all duration-50"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};
