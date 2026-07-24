import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { OverallMetrics } from '../types';

interface HeaderProps {
  semesterName: string;
  overallMetrics: OverallMetrics;
  onQuickReset?: () => void;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ semesterName, overallMetrics, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }, 600);
  };

  const getStatusBadge = () => {
    switch (overallMetrics.status) {
      case 'safe':
        return {
          icon: ShieldCheck,
          text: 'Safe Buffer',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300/80 shadow-xs',
        };
      case 'caution':
        return {
          icon: AlertTriangle,
          text: 'Low Buffer',
          bg: 'bg-amber-50 text-amber-800 border-amber-300/80 shadow-xs',
        };
      case 'critical':
        return {
          icon: AlertCircle,
          text: 'Action Needed',
          bg: 'bg-rose-50 text-rose-800 border-rose-300/80 shadow-xs',
        };
    }
  };

  const status = getStatusBadge();
  const Icon = status.icon;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 shadow-xs">
      <div className="max-w-md mx-auto sm:max-w-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1">
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-black">
                Attend
              </span>
              <span>Wise</span>
            </h1>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Sem III (MEC)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold truncate max-w-[200px] sm:max-w-xs mt-0.5">
            {semesterName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh Attendance"
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition active:scale-95 flex items-center justify-center min-w-[38px] min-h-[38px]"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`}
            />
            {showToast && (
              <span className="absolute -bottom-8 right-0 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                <Check className="w-2.5 h-2.5 text-emerald-400" /> Refreshed!
              </span>
            )}
          </button>

          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.bg}`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{parseFloat(overallMetrics.currentPercentage.toFixed(2))}%</span>
          </div>
        </div>
      </div>
    </header>
  );
}
