import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Sliders,
  Building,
  Calendar,
  BookOpen,
  Edit2,
  Save,
  LogOut,
  User,
} from 'lucide-react';

import {
  AttendWiseMetadata,
  SubjectInfo,
  StudentSubjectState,
  SubjectMetrics,
} from '../types';

interface ProfileTabProps {
  metadata: AttendWiseMetadata;
  subjects: SubjectInfo[];
  studentStates: Record<string, StudentSubjectState>;
  subjectMetricsList: SubjectMetrics[];
  threshold: number;
  onUpdateSubjectState: (subjectId: string, attended: number, total: number) => void;
  onUpdateThreshold: (newThreshold: number) => void;
  onResetData: () => void;
  onExportData?: () => void;
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

export const ProfileTab: React.FC<ProfileTabProps> = ({
  metadata,
  subjects,
  studentStates,
  threshold,
  onUpdateSubjectState,
  onUpdateThreshold,
  onResetData,
}) => {
  const sortedSubjects = React.useMemo(() => {
    return [...subjects].sort((a, b) => {
      const idxA = REQUESTED_SUBJECT_ORDER.indexOf(a.name);
      const idxB = REQUESTED_SUBJECT_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.name.localeCompare(b.name);
    });
  }, [subjects]);

  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [tempPct, setTempPct] = useState<number>(80);
  const [tempTotal, setTempTotal] = useState<number>(12);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const startEditing = (subj: SubjectInfo) => {
    const st = studentStates[subj.id] || { attended: subj.defaultAttended, total: subj.defaultTotal || 1 };
    const pct = st.total > 0 ? parseFloat(((st.attended / st.total) * 100).toFixed(2)) : 80;
    setEditingSubjectId(subj.id);
    setTempPct(pct);
    setTempTotal(st.total || 1);
  };

  const saveEditing = (subjectId: string) => {
    const total = Math.max(1, tempTotal);
    const attended = Math.min(total, Math.max(0, Math.round((tempPct / 100) * total)));
    onUpdateSubjectState(subjectId, attended, total);
    setEditingSubjectId(null);
  };

  return (
    <div className="space-y-3.5 pb-24 font-sans">
      {/* STUDENT PROFILE HEADER */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
            <User className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 leading-tight">Student Profile</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">{metadata.institution}</p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          Active
        </span>
      </div>

      {/* THRESHOLD CONFIGURATION */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Required Attendance Target
            </h3>
          </div>
          <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
            {(threshold * 100).toFixed(0)}%
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-0.5">
          {[0.70, 0.75, 0.80, 0.85].map((val) => {
            const isSelected = Math.abs(threshold - val) < 0.01;
            return (
              <button
                key={val}
                type="button"
                onClick={() => onUpdateThreshold(val)}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {(val * 100).toFixed(0)}%
              </button>
            );
          })}
        </div>
      </div>

      {/* SUBJECT SNAPSHOTS EDITOR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Subject Snapshots
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-400">{subjects.length} Subjects</span>
        </div>

        <div className="space-y-2">
          {sortedSubjects.map((subj) => {
            const st = studentStates[subj.id] || { attended: subj.defaultAttended, total: subj.defaultTotal };
            const isEditingThis = editingSubjectId === subj.id;

            return (
              <div
                key={subj.id}
                className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 text-xs transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-900 block truncate">{subj.name}</span>
                    <span className="text-[10px] font-semibold text-slate-400 block">{subj.code}</span>
                  </div>

                  {!isEditingThis ? (
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-700 block text-xs">
                          {((st.attended / (st.total || 1)) * 100).toFixed(
                            ((st.attended / (st.total || 1)) * 100) % 1 === 0 ? 0 : 1
                          )}
                          %
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {st.attended} / {st.total}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEditing(subj)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition active:scale-95"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={tempPct}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTempPct(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
                          }}
                          className="w-20 bg-white border border-slate-300 rounded-lg pr-5 pl-2 py-1 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-1.5 top-1 text-[11px] font-bold text-slate-400">
                          %
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveEditing(subj.id)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition active:scale-95"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* METADATA INFO */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <Building className="w-3.5 h-3.5" />
            <span>Institution</span>
          </span>
          <span className="font-bold text-slate-800">{metadata.institution}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <Calendar className="w-3.5 h-3.5" />
            <span>Semester Period</span>
          </span>
          <span className="font-bold text-slate-800">{metadata.startDate} – {metadata.endDate}</span>
        </div>
      </div>

      {/* LOGOUT ACTION */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold py-3 px-4 rounded-2xl border border-rose-200/90 flex items-center justify-center gap-2 text-xs transition active:scale-98 shadow-2xs"
        >
          <LogOut className="w-4 h-4 stroke-[2.5]" />
          <span>Logout</span>
        </button>
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-xl"
          >
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Logout & Reset Data?</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                This will reset your attendance session marks and return all snapshots to default values.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetData();
                  setShowLogoutConfirm(false);
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-xs"
              >
                Yes, Logout
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
