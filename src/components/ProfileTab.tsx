import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Download,
  RotateCcw,
  Sliders,
  Check,
  Building,
  Calendar,
  BookOpen,
  Edit2,
  Save,
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
  onExportData: () => void;
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
  subjectMetricsList,
  threshold,
  onUpdateSubjectState,
  onUpdateThreshold,
  onResetData,
  onExportData,
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const startEditing = (subj: SubjectInfo) => {
    const st = studentStates[subj.id] || { attended: subj.defaultAttended, total: subj.defaultTotal };
    const pct = st.total > 0 ? parseFloat(((st.attended / st.total) * 100).toFixed(2)) : 80;
    setEditingSubjectId(subj.id);
    setTempPct(pct);
    setTempTotal(st.total || subj.defaultTotal || 12);
  };

  const saveEditing = (subjectId: string) => {
    const total = Math.max(1, tempTotal);
    const attended = Math.min(total, Math.max(0, Math.round((tempPct / 100) * total)));
    onUpdateSubjectState(subjectId, attended, total);
    setEditingSubjectId(null);
  };

  return (
    <div className="space-y-4 pb-24 font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Student Profile & Settings</h2>
          <p className="text-xs text-slate-500">Configure thresholds, edit counts & backup data</p>
        </div>
      </div>

      {/* THRESHOLD CONFIGURATION CARD */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Minimum Required Threshold</h3>
          </div>
          <span className="text-base font-black text-emerald-600">
            {(threshold * 100).toFixed(0)}%
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Set your institution's attendance policy limit. All safe skips and recovery calculations adapt instantly.
        </p>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {[0.70, 0.75, 0.80, 0.85].map((val) => {
            const isSelected = Math.abs(threshold - val) < 0.01;
            return (
              <button
                key={val}
                onClick={() => onUpdateThreshold(val)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {(val * 100).toFixed(0)}%
              </button>
            );
          })}
        </div>
      </div>

      {/* SUBJECT SNAPSHOT QUICK EDITOR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Subject Attendance Snapshots</h3>
          </div>
          <span className="text-xs text-slate-500">{subjects.length} Subjects</span>
        </div>

        <div className="space-y-2">
          {sortedSubjects.map((subj) => {
            const st = studentStates[subj.id] || { attended: subj.defaultAttended, total: subj.defaultTotal };
            const isEditingThis = editingSubjectId === subj.id;

            return (
              <div
                key={subj.id}
                className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{subj.name}</span>
                    <span className="text-[10px] text-slate-500 block">{subj.code}</span>
                  </div>

                  {!isEditingThis ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-700">
                          {((st.attended / (st.total || 1)) * 100).toFixed(
                            ((st.attended / (st.total || 1)) * 100) % 1 === 0 ? 0 : 2
                          )}
                          %
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          ({st.attended} / {st.total} periods)
                        </span>
                      </div>
                      <button
                        onClick={() => startEditing(subj)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={tempPct}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTempPct(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
                          }}
                          className="w-22 bg-white border border-slate-300 rounded-lg pr-5 pl-2 py-1 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-1.5 top-1 text-[11px] font-extrabold text-slate-400">
                          %
                        </span>
                      </div>
                      <button
                        onClick={() => saveEditing(subj.id)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition"
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
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2 text-xs">
        <h3 className="font-bold text-slate-900 mb-2">Timetable Metadata</h3>
        <div className="flex items-center justify-between text-slate-700">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Building className="w-3.5 h-3.5" />
            <span>Institution</span>
          </span>
          <span className="font-semibold text-slate-900">{metadata.institution}</span>
        </div>
        <div className="flex items-center justify-between text-slate-700">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Semester Duration</span>
          </span>
          <span className="font-semibold text-slate-900">{metadata.startDate} to {metadata.endDate}</span>
        </div>
      </div>

      {/* EXPORT & RESET ACTIONS */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onExportData}
          className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-3 px-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center gap-2 text-xs transition"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Export Attendance Data (JSON)</span>
        </button>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3 px-4 rounded-2xl border border-rose-200 flex items-center justify-center gap-2 text-xs transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset All Attendance Snapshots</span>
        </button>
      </div>

      {/* RESET CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-900">Reset Local Data?</h3>
            <p className="text-xs text-slate-600">
              This will restore all attendance snapshots to the default timetable starting values.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetData();
                  setShowResetConfirm(false);
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition"
              >
                Yes, Reset
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
