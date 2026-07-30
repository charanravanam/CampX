import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Calendar,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';

import { OverallMetrics, TodaySessionInfo, SubjectMetrics, SubjectInfo, ScheduleSession } from '../types';
import { calculateTodaySessions } from '../utils/attendanceEngine';

interface TodayTabProps {
  overallMetrics: OverallMetrics;
  todaySessions: TodaySessionInfo[];
  subjectMetricsMap: Record<string, SubjectMetrics>;
  currentDate: string;
  threshold: number;
  todayMarks: Record<string, 'attended' | 'missed' | 'exempt' | string>;
  onMarkTodaySession: (
    subjectId: string,
    sessionKey: string,
    status: 'attended' | 'missed' | 'unmarked'
  ) => void;
  onNavigateToSubject?: (subjectId: string) => void;
  onNavigateToForecast?: () => void;
  subjects?: SubjectInfo[];
  scheduleMap?: Record<string, ScheduleSession[]>;
  rawCalendar?: Record<string, { subjectId: number | string; periods: number; start: string; end: string }[]>;
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
  subjects,
  scheduleMap,
  rawCalendar,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);

  // Array of past 7 days up to currentDate (8 days total: today - 7 days to today)
  const past7Days = useMemo(() => {
    const parts = currentDate.split('-');
    if (parts.length !== 3) return [currentDate];
    const base = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const result: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      result.push(`${y}-${m}-${day}`);
    }
    return result;
  }, [currentDate]);

  const currentIndex = useMemo(() => {
    const idx = past7Days.indexOf(selectedDate);
    return idx >= 0 ? idx : past7Days.length - 1;
  }, [past7Days, selectedDate]);

  const handlePrevDay = () => {
    if (currentIndex > 0) {
      setSelectedDate(past7Days[currentIndex - 1]);
    }
  };

  const handleNextDay = () => {
    if (currentIndex < past7Days.length - 1) {
      setSelectedDate(past7Days[currentIndex + 1]);
    }
  };

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const formatted = dObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        return selectedDate === currentDate ? `Today • ${formatted}` : formatted;
      }
      return selectedDate;
    } catch {
      return selectedDate;
    }
  }, [selectedDate, currentDate]);

  const activeSessions = useMemo(() => {
    if (selectedDate === currentDate && todaySessions) {
      return todaySessions;
    }
    if (subjects && scheduleMap) {
      return calculateTodaySessions(
        selectedDate,
        subjects,
        scheduleMap,
        subjectMetricsMap,
        threshold,
        rawCalendar
      );
    }
    return todaySessions;
  }, [selectedDate, currentDate, todaySessions, subjects, scheduleMap, subjectMetricsMap, threshold, rawCalendar]);

  const totalDayPeriods = useMemo(() => {
    return activeSessions.reduce((sum, s) => sum + (s.session.periods || 1), 0);
  }, [activeSessions]);

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
        className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs relative overflow-hidden"
      >
        {/* Soft background ambient gradient glow */}
        <div className={`absolute -right-12 -top-12 w-48 h-48 rounded-full bg-gradient-to-br ${theme.glow} blur-2xl pointer-events-none`} />

        {/* Top Header Row with Refresh */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Attendance Snapshot</span>
          </div>
          <button
            type="button"
            onClick={handleRefreshHome}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-slate-200/80 hover:border-emerald-300 rounded-full text-[11px] font-bold transition active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{refreshToast ? 'Updated!' : 'Refresh'}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
          {/* Sleek Gradient SVG Progress Gauge */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-32 h-32 transform -rotate-90">
              <defs>
                <linearGradient id="snapshotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={overallMetrics.isAboveThreshold ? '#059669' : '#e11d48'} />
                  <stop offset="100%" stopColor={overallMetrics.isAboveThreshold ? '#0d9488' : '#f43f5e'} />
                </linearGradient>
              </defs>
              <circle
                cx="64"
                cy="64"
                r={56}
                stroke="#f1f5f9"
                strokeWidth="8"
                fill="transparent"
              />
              <motion.circle
                cx="64"
                cy="64"
                r={56}
                stroke="url(#snapshotGrad)"
                strokeWidth="8"
                strokeLinecap="round"
                fill="transparent"
                initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 56 - (Math.min(100, overallMetrics.currentPercentage) / 100) * (2 * Math.PI * 56) }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ strokeDasharray: 2 * Math.PI * 56 }}
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                {overallMetrics.currentPercentage.toFixed(2)}%
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                overallMetrics.isAboveThreshold ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {overallMetrics.isAboveThreshold ? 'On Track' : 'Low Attendance'}
              </span>
            </div>
          </div>

          {/* Minimal Headline & Clean Stats Grid */}
          <div className="flex-1 text-center sm:text-left space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              {overallMetrics.headline}
            </h2>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                  Safe Skips
                </div>
                <div className="text-base font-extrabold text-emerald-700">
                  {overallMetrics.totalSafeToMiss} <span className="text-xs font-semibold text-slate-500">periods</span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                  Conducted
                </div>
                <div className="text-base font-extrabold text-slate-800">
                  {overallMetrics.totalAttended} <span className="text-xs font-normal text-slate-400">/ {overallMetrics.totalPeriods}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* DAY SELECTOR BAR & QUICK DATE CHIPS */}
      <div className="space-y-2">
        <div className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center justify-between shadow-xs">
          <button
            type="button"
            onClick={handlePrevDay}
            disabled={currentIndex <= 0}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>{formattedSelectedDate}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {totalDayPeriods} Period{totalDayPeriods !== 1 ? 's' : ''} Scheduled
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            disabled={currentIndex >= past7Days.length - 1}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* QUICK DATE CHIPS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {past7Days.map((d) => {
            const isSelected = d === selectedDate;
            const isToday = d === currentDate;
            const dObj = new Date(d);
            const dayName = isToday ? 'TODAY' : dObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dayNum = dObj.getDate();

            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={`shrink-0 py-2 px-3 rounded-xl border text-center transition ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-[10px] font-bold tracking-wider">{dayName}</div>
                <div className="text-sm font-bold">{dayNum}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CHRONOLOGICAL SCHEDULE SECTION */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span>{selectedDate === currentDate ? "Today's Schedule" : "Schedule"}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                {selectedDate}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              {selectedDate === currentDate
                ? 'Ordered chronologically from 09:10 AM to 16:00 PM'
                : `Mark or edit attendance records for ${selectedDate}`}
            </p>
          </div>

          {activeSessions.length > 0 && (
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {activeSessions.length} Class{activeSessions.length > 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {activeSessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center shadow-xs">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-500">
              <Calendar className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              {selectedDate === currentDate ? 'No classes scheduled for today' : `No classes scheduled for ${selectedDate}`}
            </h4>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              Check your weekly forecast to prepare for upcoming lectures & labs.
            </p>
            {onNavigateToForecast && (
              <button
                type="button"
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
            {activeSessions.map((ts, idx) => {
              const sm = subjectMetricsMap[ts.subject.id];
              const sessionKey = `${selectedDate}_${ts.subject.id}_${ts.session.start || idx}`;
              const currentMark = todayMarks[sessionKey];

              // Evaluated by semester-wide equation considering total semester classes, attended till date, future implications, and lab priority
              const isMustAttend = !ts.isSafeToMiss;

              return (
                <motion.div
                  key={sessionKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`bg-white rounded-2xl p-4 border transition-all shadow-xs ${
                    currentMark === 'attended'
                      ? 'border-emerald-500 bg-emerald-50/20'
                      : currentMark === 'missed'
                      ? 'border-rose-500 bg-rose-50/20'
                      : currentMark === 'exempt'
                      ? 'border-blue-300 bg-blue-50/30'
                      : isMustAttend
                      ? 'border-slate-200 border-l-4 border-l-rose-500'
                      : 'border-slate-200 border-l-4 border-l-emerald-500'
                  }`}
                >
                  {/* TOP HEADER: TIME + MUST ATTEND / SKIPPABLE / EXEMPT BADGE */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{ts.time}</span>
                    </div>

                    {/* MUST ATTEND VS SKIPPABLE VS EXEMPT BADGE */}
                    <div>
                      {currentMark === 'exempt' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                          <Users className="w-4 h-4 text-blue-600 shrink-0" />
                          Exempt (Group Split)
                        </span>
                      ) : isMustAttend ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          Must Attend
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          Skippable
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SUBJECT DETAILS */}
                  <div className="flex items-start justify-between gap-3 my-1">
                    <div className="flex-1 min-w-0">
                      <h4
                        onClick={() => onNavigateToSubject && onNavigateToSubject(ts.subject.id)}
                        className="text-base sm:text-lg font-extrabold text-slate-900 hover:text-emerald-700 cursor-pointer transition leading-snug"
                      >
                        {ts.subject.name}
                      </h4>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1.5">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{ts.room}</span>
                      </div>
                    </div>

                    {/* SUBJECT PERCENTAGE RATE */}
                    <div className="text-right shrink-0">
                      <div
                        className={`text-base sm:text-lg font-black ${
                          sm?.currentPercentage >= 75 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {sm ? parseFloat(sm.currentPercentage.toFixed(2)) : 0}%
                      </div>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">
                        {sm?.attended ?? 0}/{sm?.total ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* DAILY MARK ATTENDANCE ACTION BUTTONS */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
                      {selectedDate === currentDate ? 'Today:' : 'Status:'}
                    </span>

                    {currentMark === 'exempt' ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 flex-1 bg-blue-50/90 border border-blue-200/90 rounded-xl px-3 py-2 text-xs font-bold text-blue-900">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Users className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="truncate">Group Split (Exempt)</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => onMarkTodaySession(ts.subject.id, sessionKey, 'attended')}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 shrink-0 transition"
                          >
                            Mark Attended
                          </button>
                          <button
                            type="button"
                            onClick={() => onMarkTodaySession(ts.subject.id, sessionKey, 'missed')}
                            className="text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-white hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 shrink-0 transition"
                          >
                            Mark Missed
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5 flex-1 max-w-[240px]">
                        <button
                          type="button"
                          onClick={() =>
                            onMarkTodaySession(
                              ts.subject.id,
                              sessionKey,
                              currentMark === 'attended' ? 'unmarked' : 'attended'
                            )
                          }
                          className={`py-2.5 px-3 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 active:scale-95 ${
                            currentMark === 'attended'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/80'
                          }`}
                        >
                          <Check className="w-4.5 h-4.5 stroke-[2.5]" />
                          <span>Attended</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onMarkTodaySession(
                              ts.subject.id,
                              sessionKey,
                              currentMark === 'missed' ? 'unmarked' : 'missed'
                            )
                          }
                          className={`py-2.5 px-3 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 active:scale-95 ${
                            currentMark === 'missed'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800 border border-slate-200/80'
                          }`}
                        >
                          <X className="w-4.5 h-4.5 stroke-[2.5]" />
                          <span>Missed</span>
                        </button>
                      </div>
                    )}
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
