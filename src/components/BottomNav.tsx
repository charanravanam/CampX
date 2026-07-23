import React from 'react';
import { motion } from 'motion/react';
import { CalendarCheck, BookOpen, TrendingUp, User } from 'lucide-react';

export type TabType = 'today' | 'subjects' | 'forecast' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'today' as TabType, label: 'Today', icon: CalendarCheck },
    { id: 'subjects' as TabType, label: 'Subjects', icon: BookOpen },
    { id: 'forecast' as TabType, label: 'Forecast', icon: TrendingUp },
    { id: 'profile' as TabType, label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-4 py-2 pb-safe">
      <div className="max-w-md mx-auto sm:max-w-xl flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center py-1.5 px-3 rounded-2xl transition-all duration-150 ${
                isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 text-emerald-600' : 'scale-100 text-slate-500'}`} />
                {isActive && (
                  <motion.div
                    layoutId="activeTabGlow"
                    className="absolute -inset-1.5 bg-emerald-100/80 rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>

              <span className="text-[11px] font-semibold mt-1 tracking-tight">{tab.label}</span>

              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 w-8 h-0.5 bg-emerald-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
