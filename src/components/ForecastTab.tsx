import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Target,
} from 'lucide-react';

import {
  SubjectInfo,
  ScheduleSession,
  SubjectMetrics,
  OverallMetrics,
} from '../types';

import {
  simulateAttendanceScenarios,
  calculateTargetAttendanceDate,
} from '../utils/attendanceEngine';

interface ForecastTabProps {
  subjects: SubjectInfo[];
  scheduleMap: Record<string, ScheduleSession[]>;
  rawCalendar?: Record<string, { subjectId: number | string; periods: number; start: string; end: string }[]>;
  calendar?: Array<{ date: string; type?: string; status?: string; isHoliday?: boolean }>;
  subjectMetricsList: SubjectMetrics[];
  currentDate: string; // YYYY-MM-DD
  threshold: number;
}

export const ForecastTab: React.FC<ForecastTabProps> = ({
  subjects,
  scheduleMap,
  rawCalendar,
  calendar,
  subjectMetricsList,
  currentDate,
  threshold,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [scenarioMode, setScenarioMode] = useState<'attend' | 'miss'>('attend');

  // Sync selectedDate when currentDate changes
  React.useEffect(() => {
    setSelectedDate(currentDate);
  }, [currentDate]);

  // Dynamically calculate date to reach required attendance
  const targetDateInfo = useMemo(() => {
    return calculateTargetAttendanceDate(
      subjectMetricsList,
      {
        subjects,
        subjectSchedule: scheduleMap,
        rawCalendar,
        calendar,
      },
      currentDate,
      threshold
    );
  }, [subjectMetricsList, subjects, scheduleMap, rawCalendar, calendar, currentDate, threshold]);

  // Collect all unique dates in schedule sorted
  const allDates = useMemo(() => {
    if (rawCalendar && Object.keys(rawCalendar).length > 0) {
      const keys = new Set(Object.keys(rawCalendar));
      keys.add(currentDate);
      return Array.from(keys).sort();
    }
    const set = new Set<string>();
    Object.values(scheduleMap).forEach((list: ScheduleSession[]) => {
      list.forEach((s) => set.add(s.date));
    });
    set.add(currentDate);
    return Array.from(set).sort();
  }, [scheduleMap, rawCalendar, currentDate]);

  // Current selected day index
  const currentIndex = allDates.indexOf(selectedDate);

  const handlePrevDay = () => {
    if (currentIndex > 0) setSelectedDate(allDates[currentIndex - 1]);
  };

  const handleNextDay = () => {
    if (currentIndex < allDates.length - 1) setSelectedDate(allDates[currentIndex + 1]);
  };

  // Sessions on selected date sorted strictly chronologically (09:10 to 16:00)
  const daySessions = useMemo(() => {
    const list: { subject: SubjectInfo; session: ScheduleSession }[] = [];
    const calSessions = rawCalendar?.[selectedDate];

    if (calSessions && calSessions.length > 0) {
      calSessions.forEach((item) => {
        const subj = subjects.find((s) => s.id === item.subjectId.toString());
        if (subj) {
          const isDesignThinking = subj.name.toLowerCase().includes('design thinking');
          const isLab = !isDesignThinking && (subj.type === 'lab' || subj.name.toLowerCase().includes('lab'));
          list.push({
            subject: subj,
            session: {
              date: selectedDate,
              periods: isLab ? 2 : (item.periods || 1),
              start: item.start,
              end: item.end,
              time: `${item.start} - ${item.end}`,
              room: subj.room,
            },
          });
        }
      });
    } else {
      subjects.forEach((subj) => {
        const subjSchedule = scheduleMap[subj.id] || [];
        const match = subjSchedule.filter((s) => s.date === selectedDate);
        match.forEach((session) => {
          list.push({ subject: subj, session });
        });
      });
    }

    const parseMinutes = (startStr?: string) => {
      if (!startStr) return 9999;
      const match = startStr.match(/(\d{1,2}):(\d{2})/);
      if (!match) return 9999;
      let hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      if (startStr.toLowerCase().includes('pm') && hours < 12) hours += 12;
      if (startStr.toLowerCase().includes('am') && hours === 12) hours = 0;
      return hours * 60 + mins;
    };

    return list.sort((a, b) => {
      const timeA = parseMinutes(a.session.start || a.session.time || a.subject.defaultTime);
      const timeB = parseMinutes(b.session.start || b.session.time || b.subject.defaultTime);
      return timeA - timeB;
    });
  }, [subjects, scheduleMap, rawCalendar, selectedDate]);

  // Total periods scheduled on selected day
  const totalDayPeriods = daySessions.reduce((acc, item) => acc + item.session.periods, 0);

  // Simulations for selected date
  const sessionsToSimulate = daySessions.map((item) => ({
    subjectId: item.subject.id,
    periods: item.session.periods,
  }));

  const simulation = useMemo(() => {
    return simulateAttendanceScenarios(subjectMetricsList, sessionsToSimulate, threshold);
  }, [subjectMetricsList, sessionsToSimulate, threshold]);

  const activeScenario = scenarioMode === 'attend' ? simulation.attendAll : simulation.missAll;

  // Format date readable
  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 pb-24 font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Attendance Forecast</h2>
          <p className="text-xs text-slate-500">Simulate upcoming schedule impacts instantly</p>
        </div>
      </div>

      {/* CONTINUOUS ATTENDANCE TARGET SECTION */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50/60 to-indigo-50/50 border border-emerald-200/80 rounded-2xl p-3.5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5 shadow-xs">
            <Target className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 inline-block">
              Continuous Target Milestone
            </span>
            <p className="text-xs sm:text-sm font-medium text-slate-800 leading-snug">
              If you attend every remaining class continuously, you will reach the required attendance on:{' '}
              <span className="font-extrabold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded border border-emerald-300 inline-block mt-0.5">
                {targetDateInfo.formattedDate}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* DAY SELECTOR BAR */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center justify-between shadow-xs">
        <button
          onClick={handlePrevDay}
          disabled={currentIndex <= 0}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1.5">
            <CalendarIcon className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {totalDayPeriods} Period{totalDayPeriods !== 1 ? 's' : ''} Scheduled
          </div>
        </div>

        <button
          onClick={handleNextDay}
          disabled={currentIndex >= allDates.length - 1}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* QUICK DATE CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {allDates.slice(Math.max(0, currentIndex - 3), currentIndex + 5).map((d) => {
          const isSelected = d === selectedDate;
          const dObj = new Date(d);
          const dayName = dObj.toLocaleDateString('en-US', { weekday: 'narrow' });
          const dayNum = dObj.getDate();

          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`shrink-0 py-2 px-3 rounded-xl border text-center transition ${
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">{dayName}</div>
              <div className="text-sm font-bold">{dayNum}</div>
            </button>
          );
        })}
      </div>

      {/* SCENARIO TOGGLE BUTTONS */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          onClick={() => setScenarioMode('attend')}
          className={`py-3 px-3 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            scenarioMode === 'attend'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4.5 h-4.5" />
          <span>Attend All ({totalDayPeriods} periods)</span>
        </button>

        <button
          onClick={() => setScenarioMode('miss')}
          className={`py-3 px-3 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            scenarioMode === 'miss'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <XCircle className="w-4.5 h-4.5" />
          <span>Miss All ({totalDayPeriods} periods)</span>
        </button>
      </div>

      {/* SIMULATION RESULT DISPLAY CARD */}
      <motion.div
        key={`${selectedDate}_${scenarioMode}`}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-4 border transition ${
          scenarioMode === 'attend'
            ? 'bg-emerald-50 border-emerald-200 text-slate-900'
            : 'bg-rose-50 border-rose-200 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">
              Resulting Overall Attendance
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {activeScenario.overallPercentage.toFixed(1)}%
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-xs font-extrabold inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${
                activeScenario.percentageChange >= 0
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-rose-100 text-rose-800 border-rose-200'
              }`}
            >
              {activeScenario.percentageChange >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {activeScenario.percentageChange >= 0 ? '+' : ''}
              {activeScenario.percentageChange.toFixed(2)}%
            </span>
            <div className="text-[11px] text-slate-600 mt-1">
              New Safe Skips: <strong className="text-slate-900">{activeScenario.newSafeToMiss}</strong>
            </div>
          </div>
        </div>
      </motion.div>

      {/* SCHEDULED CLASSES ON THIS DAY */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-slate-900">Classes on {formattedDate}</h3>

        {daySessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-500 text-xs shadow-xs">
            No classes scheduled on this date.
          </div>
        ) : (
          daySessions.map(({ subject, session }, idx) => {
            const isLab = subject.type === 'lab';

            return (
              <div
                key={`${subject.id}_${idx}`}
                className={`rounded-2xl border transition shadow-xs ${
                  isLab
                    ? 'p-5 bg-amber-50/40 border-amber-300 border-l-4 border-l-amber-500'
                    : 'p-3.5 bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {subject.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isLab
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isLab ? 'Lab • 2 Periods' : 'Lecture • 1 Period'}
                      </span>
                    </div>

                    <h4 className={`font-bold text-slate-900 ${isLab ? 'text-base' : 'text-sm'}`}>
                      {subject.name}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {session.time || subject.defaultTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {session.room || subject.room}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-700">
                      {session.periods} Period{session.periods > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
