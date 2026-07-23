import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Clock,
  MapPin,
  X,
  ChevronRight,
  HelpCircle,
  ChevronDown,
  TrendingUp,
  RotateCcw,
  BookOpen,
} from 'lucide-react';

import { SubjectMetrics } from '../types';

interface SubjectsTabProps {
  subjectMetricsList: SubjectMetrics[];
  threshold: number;
  selectedSubjectId?: string | null;
  onSelectSubject?: (subjectId: string | null) => void;
  onUpdateSubjectState?: (subjectId: string, attended: number, total: number) => void;
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

export const SubjectsTab: React.FC<SubjectsTabProps> = ({
  subjectMetricsList,
  threshold,
  selectedSubjectId,
  onSelectSubject,
  onUpdateSubjectState,
}) => {
  const sortedSubjectMetricsList = React.useMemo(() => {
    return [...subjectMetricsList].sort((a, b) => {
      const idxA = REQUESTED_SUBJECT_ORDER.indexOf(a.subject.name);
      const idxB = REQUESTED_SUBJECT_ORDER.indexOf(b.subject.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.subject.name.localeCompare(b.subject.name);
    });
  }, [subjectMetricsList]);

  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(
    selectedSubjectId || null
  );

  const selectedMetrics = sortedSubjectMetricsList.find((sm) => sm.subject.id === activeSubjectId);

  const handleOpenDetail = (id: string) => {
    setActiveSubjectId(id);
    if (onSelectSubject) onSelectSubject(id);
  };

  const handleCloseDetail = () => {
    setActiveSubjectId(null);
    if (onSelectSubject) onSelectSubject(null);
  };

  return (
    <div className="space-y-4 pb-24 font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Course Subjects</h2>
          <p className="text-xs text-slate-500">
            {subjectMetricsList.length} subjects • Threshold {(threshold * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Subject Cards List */}
      <div className="space-y-3">
        {sortedSubjectMetricsList.map((sm, index) => {
          const isSafe = sm.currentPercentage >= threshold * 100;
          const statusBg =
            sm.status === 'safe'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : sm.status === 'caution'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200';

          const progressColor =
            sm.status === 'safe'
              ? 'bg-emerald-500'
              : sm.status === 'caution'
              ? 'bg-amber-500'
              : 'bg-rose-500';

          return (
            <motion.div
              key={sm.subject.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => handleOpenDetail(sm.subject.id)}
              className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition shadow-xs cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {sm.subject.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        sm.subject.type === 'lab'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {sm.subject.type === 'lab' ? 'Lab (2 periods)' : 'Lecture'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition">
                    {sm.subject.name}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-lg font-black ${isSafe ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {parseFloat(sm.currentPercentage.toFixed(2))}%
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusBg}`}>
                    {sm.status === 'safe'
                      ? 'Safe'
                      : sm.status === 'caution'
                      ? 'Caution'
                      : 'Critical'}
                  </span>
                </div>
              </div>

              {/* Progress bar toward 75% threshold */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>
                    {sm.attended} / {sm.total} periods
                  </span>
                  <span className="font-medium text-slate-700">
                    {sm.safeToMiss > 0
                      ? `${sm.safeToMiss} safe skip${sm.safeToMiss > 1 ? 's' : ''}`
                      : `${sm.recoveryPeriodsNeeded} recovery needed`}
                  </span>
                </div>

                <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <motion.div
                    className={`h-full rounded-full ${progressColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, sm.currentPercentage)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                  {/* Threshold marker line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10"
                    style={{ left: `${threshold * 100}%` }}
                    title={`Target ${(threshold * 100).toFixed(0)}%`}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* SUBJECT DETAIL MODAL */}
      <AnimatePresence>
        {selectedMetrics && (
          <SubjectDetailModal
            metrics={selectedMetrics}
            threshold={threshold}
            onClose={handleCloseDetail}
            onUpdateState={onUpdateSubjectState}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface SubjectDetailModalProps {
  metrics: SubjectMetrics;
  threshold: number;
  onClose: () => void;
  onUpdateState?: (subjectId: string, attended: number, total: number) => void;
}

const SubjectDetailModal: React.FC<SubjectDetailModalProps> = ({
  metrics,
  threshold,
  onClose,
  onUpdateState,
}) => {
  const [showFormula, setShowFormula] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editAttended, setEditAttended] = useState(metrics.attended);
  const [editTotal, setEditTotal] = useState(metrics.total);

  const handleSaveEdit = () => {
    if (onUpdateState) {
      onUpdateState(metrics.subject.id, editAttended, editTotal);
    }
    setIsEditing(false);
  };

  const isBelowThreshold = metrics.currentPercentage < threshold * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 text-slate-900 shadow-xl font-sans"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {metrics.subject.code}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                {metrics.subject.type === 'lab' ? 'Lab (2 periods)' : 'Lecture'}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">{metrics.subject.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Teacher: {metrics.subject.teacher} • Room: {metrics.subject.room}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Attendance Rate Display */}
        <div className="my-5 bg-slate-50/80 rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Current Attendance
              </span>
              <div className="text-3xl font-black text-slate-900 mt-0.5">
                {metrics.currentPercentage.toFixed(1)}%
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500">Periods Snapshot</span>
              <div className="text-base font-extrabold text-slate-800 mt-0.5">
                {metrics.attended} / {metrics.total}
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-[11px] font-bold text-emerald-600 hover:underline mt-1 block"
              >
                {isEditing ? 'Cancel Edit' : 'Edit Snapshot'}
              </button>
            </div>
          </div>

          {/* Inline Editor */}
          {isEditing && (
            <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1 font-semibold">
                  Attended Periods
                </label>
                <input
                  type="number"
                  min={0}
                  max={editTotal}
                  value={editAttended}
                  onChange={(e) => setEditAttended(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1 font-semibold">
                  Total Conducted
                </label>
                <input
                  type="number"
                  min={editAttended}
                  value={editTotal}
                  onChange={(e) => setEditTotal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="col-span-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition"
                >
                  Save New Snapshot
                </button>
              </div>
            </div>
          )}
        </div>

        {/* METRICS & PLANS GRID */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Safe To Miss
            </span>
            <div className="text-xl font-extrabold text-emerald-600 mt-1">
              {metrics.safeToMiss} periods
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Without dropping below 75%</p>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Semester Remaining
            </span>
            <div className="text-xl font-extrabold text-slate-800 mt-1">
              {metrics.remainingPeriods} periods
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Scheduled until Nov 05</p>
          </div>
        </div>

        {/* RECOVERY PLAN / MAX ACHIEVABLE SECTION */}
        {isBelowThreshold || metrics.safeToMiss === 0 ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 my-4">
            <div className="flex items-center gap-2 text-rose-700 font-extrabold text-sm mb-1">
              <AlertCircle className="w-4 h-4" />
              <span>Recovery Strategy Required</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              You need to attend your next{' '}
              <strong className="text-rose-800 font-bold">{metrics.recoveryPeriodsNeeded} consecutive periods</strong>{' '}
              without missing any class to reach the {(threshold * 100).toFixed(0)}% requirement.
            </p>

            {/* Mathematically Unreachable Check */}
            {!metrics.isAchievable75 && (
              <div className="mt-3 pt-3 border-t border-rose-200 bg-white p-3 rounded-xl">
                <span className="text-xs font-bold text-amber-700 block mb-1">
                  Honest Assessment:
                </span>
                <p className="text-xs text-slate-600">
                  Reaching 75% this semester is mathematically impossible because only{' '}
                  {metrics.remainingPeriods} periods remain.
                </p>
                <div className="mt-2 text-sm font-extrabold text-amber-800">
                  Maximum Achievable: {metrics.maxAchievablePercentage.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 my-4">
            <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Comfortable Safety Buffer</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              You can safely miss up to <strong className="text-emerald-800">{metrics.safeToMiss} periods</strong> and still remain eligible for exams above {(threshold * 100).toFixed(0)}%.
            </p>
          </div>
        )}

        {/* NEXT CLASS & MISS IMPACT */}
        {metrics.nextSession && (
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 my-4 space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Next Scheduled Class</span>
              <span className="text-[11px] text-emerald-700 font-semibold">{metrics.nextSession.date}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{metrics.nextSession.time || metrics.subject.defaultTime}</span>
              <span>{metrics.nextSession.periods} Period{metrics.nextSession.periods > 1 ? 's' : ''}</span>
            </div>
            <div className="text-xs text-slate-700 pt-1 border-t border-slate-200 flex items-center justify-between">
              <span>If next class is missed:</span>
              <span className="font-bold text-rose-600">
                Rate becomes {metrics.missImpactPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* EXPANDABLE "WHY THIS NUMBER?" */}
        <div className="pt-2">
          <button
            onClick={() => setShowFormula(!showFormula)}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 transition py-2"
          >
            <span className="flex items-center gap-1.5 font-bold">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>Why this number? Formula breakdown</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                showFormula ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showFormula && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 mt-2 font-mono"
            >
              <div>
                <span className="text-slate-400 block">Current Rate:</span>
                <span className="text-emerald-700 font-bold">
                  {metrics.attended} / {metrics.total} = {metrics.currentPercentage.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Safe To Miss Formula:</span>
                <span className="text-slate-700">
                  floor(({metrics.attended} + {metrics.remainingPeriods}) - {threshold} × ({metrics.total} + {metrics.remainingPeriods})) ={' '}
                  <strong className="text-emerald-700">{metrics.safeToMiss}</strong>
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Recovery Formula:</span>
                <span className="text-slate-700">
                  ceil(({threshold} × {metrics.total} - {metrics.attended}) / (1 - {threshold})) ={' '}
                  <strong className="text-rose-600">{metrics.recoveryPeriodsNeeded}</strong>
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
