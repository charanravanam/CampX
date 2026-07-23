import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Calendar,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import { OverallMetrics, TodaySessionInfo, SubjectMetrics } from '../types';

interface TodayTabProps {
  overallMetrics: OverallMetrics;
  todaySessions: TodaySessionInfo[];
  subjectMetricsMap: Record<string, SubjectMetrics>;
  currentDate: string;
  threshold: number;
  todayMarks: Record<string, 'attended' | 'missed'>;
  onMarkTodaySession: (
    subjectId: string,
    sessionKey: string,
    status: 'attended' | 'missed' | 'unmarked',
    periods: number
  ) => void;
  onNavigateToSubject?: (subjectId: string) => void;
  onNavigateToForecast?: () => void;
}

export const TodayTab: React.FC<TodayTabProps> = ({
  overallMetrics,
  todaySessions,
  subjectMetricsMap,
  currentDate,
  threshold,
  todayMarks,
  onMarkTodaySession,
  onNavigateToSubject,
  onNavigateToForecast,
}) => {
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState(false);

  const handleRefreshHome = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshToast(true);
      setTimeout(() => setRefreshToast(false), 2200);
    }, 500);
  };

  // Determine overall status color theme
  const getTheme = () => {
    if (overallMetrics.totalSafeToMiss >= 3 && overallMetrics.currentPercentage >= threshold * 100) {
      return {
        stroke: '#059669', // emerald-600
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300/80 shadow-2xs',
        icon: ShieldCheck,
        glow: 'from-emerald-500/10 to-teal-500/5',
      };
    } else if (overallMetrics.totalSafeToMiss > 0) {
      return {
        stroke: '#d97706', // amber-600
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-300/80 shadow-2xs',
        icon: AlertTriangle,
        glow: 'from-amber-500/10 to-orange-500/5',
      };
    } else {
      return {
        stroke: '#e11d48', // rose-600
        badgeBg: 'bg-rose-50 text-rose-800 border-rose-300/80 shadow-2xs',
        icon: AlertCircle,
        glow: 'from-rose-500/10 to-pink-500/5',
      };
    }
  };

  const theme = getTheme();
  const StatusIcon = theme.icon;

  // Circle SVG calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, overallMetrics.currentPercentage) / 100) * circumference;

  return (
    <div className="space-y-3.5 pb-24 font-sans">
      {/* OVERALL ATTENDANCE RING & ACTION HEADLINE CARD */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs relative overflow-hidden"
      >
        {/* Soft background ambient gradient glow */}
        <div className={`absolute -right-12 -top-12 w-48 h-48 rounded-full bg-gradient-to-br ${theme.glow} blur-2xl pointer-events-none`} />

        {/* Top Header Row with Refresh */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Attendance Snapshot</span>
          </div>
          <button
            type="button"
            onClick={handleRefreshHome}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-slate-200/80 hover:border-emerald-300 rounded-full text-[11px] font-bold transition active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{refreshToast ? 'Updated!' : 'Refresh'}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* Circular SVG Ring */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-34 h-34 transform -rotate-90">
              <circle
                cx="68"
                cy="68"
                r={radius}
                stroke="currentColor"
                strokeWidth="10"
                className="text-slate-100"
                fill="transparent"
              />
              <motion.circle
                cx="68"
                cy="68"
                r={radius}
                stroke={theme.stroke}
                strokeWidth="10"
                strokeLinecap="round"
                fill="transparent"
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ strokeDasharray: circumference }}
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {parseFloat(overallMetrics.currentPercentage.toFixed(2))}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Overall Rate
              </span>
            </div>
          </div>

          {/* Action Headline & Summary Details */}
          <div className="flex-1 text-center sm:text-left space-y-2.5">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${theme.badgeBg}`}
            >
              <StatusIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Target: {(threshold * 100).toFixed(0)}% Requirement</span>
            </div>

            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              {overallMetrics.headline}
            </h2>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="bg-slate-50/90 rounded-2xl p-2.5 border border-slate-100/90">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Safe Skips Right Now
                </div>
                <div className="text-sm font-black text-emerald-700">
                  {overallMetrics.totalSafeToMiss} periods
                </div>
              </div>

              <div className="bg-slate-50/90 rounded-2xl p-2.5 border border-slate-100/90">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Conducted So Far
                </div>
                <div className="text-sm font-black text-slate-800">
                  {overallMetrics.totalAttended} / {overallMetrics.totalPeriods}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable "How calculation works" */}
        <div className="mt-3 pt-2 border-t border-slate-100">
          <button
            onClick={() => setShowFormulaInfo(!showFormulaInfo)}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 transition py-0.5"
          >
            <span className="flex items-center gap-1.5 font-semibold text-[11px]">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>How safe skips & attendance are calculated</span>
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                showFormulaInfo ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showFormulaInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 text-xs text-slate-600 space-y-2 bg-slate-50 rounded-xl p-2.5 border border-slate-200/60"
            >
              <p className="font-mono text-[10px] text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                Safe Skips = floor((Attended - 75% × Conducted) / 75%)
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Safe skips reflect your <strong>current buffer right now</strong>. If you skip a
                class today, your buffer updates immediately.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* TODAY'S CHRONOLOGICAL SCHEDULE SECTION */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span>Today's Schedule</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {currentDate}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">Ordered chronologically from 09:10 AM to 16:00 PM</p>
          </div>

          {todaySessions.length > 0 && (
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {todaySessions.length} Class{todaySessions.length > 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {todaySessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center shadow-xs">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-500">
              <Calendar className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">No classes scheduled for today</h4>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              Check your weekly forecast to prepare for upcoming lectures & labs.
            </p>
            {onNavigateToForecast && (
              <button
                onClick={onNavigateToForecast}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                <span>View Weekly Forecast</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {todaySessions.map((ts, idx) => {
              const sm = subjectMetricsMap[ts.subject.id];
              const sessionKey = `${currentDate}_${ts.subject.id}_${ts.session.start || idx}`;
              const currentMark = todayMarks[sessionKey];

              // High attendance or buffer determining Must Attend vs Skippable
              const isMustAttend =
                !sm || sm.currentPercentage < threshold * 100 || sm.safeToMiss === 0 || !ts.isSafeToMiss;

              return (
                <motion.div
                  key={sessionKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`bg-white rounded-2xl p-3.5 border transition-all shadow-xs ${
                    currentMark === 'attended'
                      ? 'border-emerald-400 bg-emerald-50/20'
                      : currentMark === 'missed'
                      ? 'border-rose-400 bg-rose-50/20'
                      : isMustAttend
                      ? 'border-slate-200 border-l-4 border-l-rose-500'
                      : 'border-slate-200 border-l-4 border-l-emerald-500'
                  }`}
                >
                  {/* TOP HEADER: TIME + MUST ATTEND / SKIPPABLE BADGE */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{ts.time}</span>
                    </div>

                    {/* MUST ATTEND VS SKIPPABLE BADGE */}
                    <div>
                      {isMustAttend ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider">
                          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                          Must Attend
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          Skippable
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SUBJECT DETAILS */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {ts.subject.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            ts.subject.type === 'lab'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {ts.subject.type === 'lab' ? `${ts.periods} Periods Lab` : '1 Period Lecture'}
                        </span>
                      </div>

                      <h4
                        onClick={() => onNavigateToSubject && onNavigateToSubject(ts.subject.id)}
                        className="text-xs sm:text-sm font-bold text-slate-900 hover:text-emerald-700 cursor-pointer transition leading-snug line-clamp-2"
                      >
                        {ts.subject.name}
                      </h4>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{ts.room}</span>
                      </div>
                    </div>

                    {/* SUBJECT PERCENTAGE RATE */}
                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm sm:text-base font-extrabold ${
                          sm?.currentPercentage >= 75 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {sm ? parseFloat(sm.currentPercentage.toFixed(2)) : 0}%
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {sm?.attended ?? 0}/{sm?.total ?? 0} periods
                      </div>
                    </div>
                  </div>

                  {/* DAILY MARK ATTENDANCE ACTION BUTTONS */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                      Today's Status:
                    </span>

                    <div className="grid grid-cols-2 gap-2 flex-1 max-w-[220px]">
                      <button
                        type="button"
                        onClick={() =>
                          onMarkTodaySession(
                            ts.subject.id,
                            sessionKey,
                            currentMark === 'attended' ? 'unmarked' : 'attended',
                            ts.periods
                          )
                        }
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                          currentMark === 'attended'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{currentMark === 'attended' ? 'Attended' : 'Attended'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onMarkTodaySession(
                            ts.subject.id,
                            sessionKey,
                            currentMark === 'missed' ? 'unmarked' : 'missed',
                            ts.periods
                          )
                        }
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                          currentMark === 'missed'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{currentMark === 'missed' ? 'Missed' : 'Missed'}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
