import React from 'react';
import { Trash2 } from 'lucide-react';

interface SearchBarProps {
  onClearCompleted?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onClearCompleted,
}) => {
  if (!onClearCompleted) return null;

  return (
    <div className="flex items-center justify-end bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
      <button
        onClick={onClearCompleted}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs sm:text-sm hover:bg-rose-100 dark:hover:bg-rose-900/60 transition cursor-pointer font-semibold shadow-xs"
        title="پاکسازی لیست تکمیل‌شده‌ها"
      >
        <Trash2 className="w-4 h-4" />
        <span>پاکسازی تکمیل‌شده‌ها</span>
      </button>
    </div>
  );
};

