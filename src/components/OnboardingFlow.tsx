import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ArrowRight, Sparkles, Sliders, CheckCircle2, Info, ArrowLeftRight } from 'lucide-react';
import { SubjectInfo, StudentSubjectState } from '../types';

interface OnboardingFlowProps {
  subjects: SubjectInfo[];
  initialStates: Record<string, StudentSubjectState>;
  onSave: (states: StudentSubjectState[]) => void;
}

const REQUESTED_SUBJECT_ORDER = [
  'Probability, Statistics and Complex Variables',
  'Fluid Mechanics and Hydraulic Machines Lab',
  'Fluid Mechanics and Hydraulic Machines',
  'Computational Mathematics Lab',
  'Design Thinking and Ideation',
  'Production Technology Lab',
  'Material Science and Metallurgy',
  'Production Technology',
  'Material Science and Mechanics of Solids Lab',
  'Mechanics of Solids',
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  subjects,
  initialStates,
  onSave,
}) => {
  const sortedSubjects = React.useMemo(() => {
    return [...subjects].sort((a, b) => {
      const idxA = REQUESTED_SUBJECT_ORDER.indexOf(a.name);
      const idxB = REQUESTED_SUBJECT_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.name.localeCompare(b.name);
    });
  }, [subjects]);

  // Store form states by subjectId: percentage, total conducted, and manual edit mode
  const [subjectPcts, setSubjectPcts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    sortedSubjects.forEach((subj) => {
      const state = initialStates[subj.id];
      const total = state?.total ?? subj.defaultTotal ?? 12;
      const attended = state?.attended ?? subj.defaultAttended ?? 10;
      const pct = total > 0 ? (attended / total) * 100 : 80;
      init[subj.id] = parseFloat(pct.toFixed(2));
    });
    return init;
  });

  const [subjectTotals, setSubjectTotals] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    sortedSubjects.forEach((subj) => {
      const state = initialStates[subj.id];
      init[subj.id] = state?.total ?? subj.defaultTotal ?? 12;
    });
    return init;
  });

  const [overallInput, setOverallInput] = useState<string>('80');
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});
  
  // Modal state for side-by-side comparison
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [pendingStates, setPendingStates] = useState<StudentSubjectState[] | null>(null);
  const [calculatedAttendwisePct, setCalculatedAttendwisePct] = useState<number>(80);

  const handlePctChange = (subjectId: string, val: string) => {
    const num = parseFloat(val);
    const safeNum = isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
    setSubjectPcts((prev) => ({ ...prev, [subjectId]: safeNum }));
  };

  const handleTotalChange = (subjectId: string, val: string) => {
    const num = parseInt(val, 10);
    const safeNum = isNaN(num) ? 1 : Math.max(1, num);
    setSubjectTotals((prev) => ({ ...prev, [subjectId]: safeNum }));
  };

  const handleQuickPreset = (pct: number) => {
    setOverallInput(pct.toString());
    setSubjectPcts((prev) => {
      const next = { ...prev };
      subjects.forEach((s) => {
        next[s.id] = pct;
      });
      return next;
    });
  };

  const handleOverallApply = () => {
    const num = parseFloat(overallInput);
    if (!isNaN(num)) {
      const safeNum = Math.min(100, Math.max(0, num));
      handleQuickPreset(safeNum);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let totalAttendedSum = 0;
    let totalPeriodsSum = 0;

    const updatedStates: StudentSubjectState[] = subjects.map((subj) => {
      const pct = subjectPcts[subj.id] ?? 80;
      const total = subjectTotals[subj.id] ?? subj.defaultTotal ?? 12;
      const attended = Math.round((pct / 100) * total);
      const safeAttended = Math.min(total, Math.max(0, attended));

      totalAttendedSum += safeAttended;
      totalPeriodsSum += total;

      return {
        subjectId: subj.id,
        attended: safeAttended,
        total,
      };
    });

    const attendwisePct = totalPeriodsSum > 0 ? (totalAttendedSum / totalPeriodsSum) * 100 : 80;
    setCalculatedAttendwisePct(parseFloat(attendwisePct.toFixed(2)));
    setPendingStates(updatedStates);
    setShowComparisonModal(true);
  };

  const handleConfirmModal = () => {
    if (pendingStates) {
      onSave(pendingStates);
    }
  };

  const campXValue = parseFloat(overallInput) || 80;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-3.5 sm:p-6 font-sans relative">
      <div className="max-w-md mx-auto w-full pt-2 pb-20">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-5"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold mb-2">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Attendance Planning Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
            Welcome to <span className="text-emerald-600">AttendWise</span>
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Enter your current attendance percentage for each subject from your portal.
          </p>
        </motion.div>

        {/* OVERALL QUICK PRESET SECTION */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs mb-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Current CampX / Portal Total Attendance (%)
            </span>
            <span className="text-[10px] text-slate-400">Portal Overall</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={overallInput}
                onChange={(e) => setOverallInput(e.target.value)}
                placeholder="e.g. 80.5"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
            </div>
            <button
              type="button"
              onClick={handleOverallApply}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shrink-0"
            >
              Fill All Subjects
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[85, 80, 75, 70].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleQuickPreset(pct)}
                className="py-1.5 px-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 rounded-xl text-xs font-bold transition text-slate-700"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {sortedSubjects.map((subj, index) => {
            const pct = subjectPcts[subj.id] ?? 80;
            const total = subjectTotals[subj.id] ?? subj.defaultTotal ?? 12;
            const estAttended = Math.round((pct / 100) * total);
            const isSafe = pct >= 75;
            const isAdv = showAdvanced[subj.id] || false;

            return (
              <motion.div
                key={subj.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {subj.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          subj.type === 'lab'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {subj.type === 'lab' ? 'Lab (2 periods)' : 'Lecture (1 period)'}
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      {subj.name}
                    </h3>
                  </div>

                  {/* PERCENTAGE INPUT BADGE */}
                  <div className="shrink-0 text-right">
                    <div className="relative inline-block w-[96px]">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={pct}
                        onChange={(e) => handlePctChange(subj.id, e.target.value)}
                        className={`w-full text-right text-sm sm:text-base font-extrabold pr-5 pl-2 py-1 rounded-xl border focus:outline-none transition ${
                          isSafe
                            ? 'bg-emerald-50/80 text-emerald-800 border-emerald-300 focus:border-emerald-500'
                            : 'bg-rose-50/80 text-rose-800 border-rose-300 focus:border-rose-500'
                        }`}
                      />
                      <span className="absolute right-2 top-1.5 text-xs font-extrabold text-slate-500">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* ESTIMATED PERIODS FOOTER */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
                  <span>
                    Est. <strong className="text-slate-800 font-bold">{estAttended}</strong> / {total} periods attended
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setShowAdvanced((prev) => ({ ...prev, [subj.id]: !prev[subj.id] }))
                    }
                    className="text-[10px] text-emerald-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Sliders className="w-3 h-3" />
                    {isAdv ? 'Hide Periods' : 'Edit Periods'}
                  </button>
                </div>

                {/* ADVANCED PERIODS EDIT */}
                {isAdv && (
                  <div className="pt-2 grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/80 p-2.5 rounded-xl">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Conducted So Far
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={total}
                        onChange={(e) => handleTotalChange(subj.id, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Calculated Attended
                      </label>
                      <div className="py-1 px-2 text-xs font-bold text-slate-800 bg-slate-100 rounded-lg">
                        {estAttended} periods
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          <div className="pt-3">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-5 rounded-2xl shadow-xs flex items-center justify-center gap-2 text-sm transition active:scale-[0.99]"
            >
              <span>Save Profile & Compare Attendance</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* SIDE-BY-SIDE ATTENDANCE COMPARISON POPUP MODAL */}
      <AnimatePresence>
        {showComparisonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  Attendance Verification
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Side-by-side breakdown of your entered portal data vs core calculation:
                </p>
              </div>

              {/* Side-by-Side Comparison Cards */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-center space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    CampX Attendance
                  </span>
                  <div className="text-xl font-black text-slate-800">
                    {campXValue.toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Entered Portal Rate
                  </span>
                </div>

                <div className="bg-emerald-50/80 rounded-2xl p-3 border border-emerald-200 text-center space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                    AttendWise Rate
                  </span>
                  <div className="text-xl font-black text-emerald-700">
                    {calculatedAttendwisePct.toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold block">
                    Core Calculated
                  </span>
                </div>
              </div>

              {/* Calculated Difference Display */}
              {(() => {
                const diff = calculatedAttendwisePct - campXValue;
                const formattedDiff = (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%';
                const isWithinExpectedRange = Math.abs(diff) <= 1.5;

                return (
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/90 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      Calculated Difference:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                        isWithinExpectedRange
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {formattedDiff}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Required Note Banner */}
              <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2 text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed font-semibold">
                  Calculated with full decimal precision. Minor differences (±0.5–1%) are normal.
                </p>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleConfirmModal}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl shadow-xs text-xs flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Proceed to Dashboard</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
