import React from 'react';
import { DownloadCategory } from '../types';
import { LayoutGrid, Video, Music, FileText, Cpu, Archive, Folder } from 'lucide-react';

interface CategoryTabsProps {
  selectedCategory: DownloadCategory;
  onSelectCategory: (cat: DownloadCategory) => void;
  counts: Record<DownloadCategory, number>;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  selectedCategory,
  onSelectCategory,
  counts,
}) => {
  const categories: { id: DownloadCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'همه فایل‌ها', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'video', label: 'ویدیو', icon: <Video className="w-4 h-4" /> },
    { id: 'music', label: 'موسیقی', icon: <Music className="w-4 h-4" /> },
    { id: 'document', label: 'اسناد', icon: <FileText className="w-4 h-4" /> },
    { id: 'software', label: 'نرم‌افزار', icon: <Cpu className="w-4 h-4" /> },
    { id: 'archive', label: 'فایل فشرده', icon: <Archive className="w-4 h-4" /> },
    { id: 'other', label: 'سایر', icon: <Folder className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.id;
        const count = counts[cat.id] || 0;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer shrink-0 ${
              isSelected
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 scale-102'
                : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 backdrop-blur-sm'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

