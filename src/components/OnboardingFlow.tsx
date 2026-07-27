import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Camera,
  Upload,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  SlidersHorizontal,
  Calendar,
  Check
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { SubjectInfo, StudentSubjectState, CampXData } from '../types';
import rawData from '../data/attendwise-data.json';
import { calculateConductedPeriods } from '../utils/attendanceEngine';
import { preprocessImageForOCR } from '../utils/imagePreprocessing';
import { parseCampXOCRText, OCRExtractedSubject } from '../utils/ocrParser';

interface OnboardingFlowProps {
  subjects: SubjectInfo[];
  initialStates: Record<string, StudentSubjectState>;
  onSave: (states: StudentSubjectState[]) => void;
  currentDate?: string;
  data?: CampXData;
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
  currentDate,
  data,
}) => {
  const appData = data || (rawData as CampXData);
  const resolvedDate = currentDate || (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const startDate = appData.metadata?.startDate || '2026-07-06';
    const endDate = appData.metadata?.endDate || '2026-11-05';
    if (todayStr >= startDate && todayStr <= endDate) {
      return todayStr;
    }
    return appData.metadata?.currentDate || '2026-07-23';
  })();

  const sortedSubjects = React.useMemo(() => {
    return [...subjects].sort((a, b) => {
      const idxA = REQUESTED_SUBJECT_ORDER.indexOf(a.name);
      const idxB = REQUESTED_SUBJECT_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.name.localeCompare(b.name);
    });
  }, [subjects]);

  // Default conducted periods calculated dynamically from timetable
  const subjectTotals = React.useMemo(() => {
    const map: Record<string, number> = {};
    sortedSubjects.forEach((subj) => {
      map[subj.id] = calculateConductedPeriods(subj.id, resolvedDate, appData);
    });
    return map;
  }, [sortedSubjects, resolvedDate, appData]);

  // Form percentages by subjectId
  const [subjectPcts, setSubjectPcts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    sortedSubjects.forEach((subj) => {
      const state = initialStates[subj.id];
      if (state && state.total > 0 && typeof state.attended === 'number') {
        const pct = (state.attended / state.total) * 100;
        init[subj.id] = parseFloat(pct.toFixed(2));
      } else {
        const defaultPct = subj.defaultTotal && subj.defaultTotal > 0 ? (subj.defaultAttended / subj.defaultTotal) * 100 : 80;
        init[subj.id] = parseFloat(defaultPct.toFixed(2));
      }
    });
    return init;
  });

  // Hero OCR State
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatusMessage, setOcrStatusMessage] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedSubjects, setExtractedSubjects] = useState<OCRExtractedSubject[]>([]);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Manual entry toggle
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [overallInput, setOverallInput] = useState<string>('80');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processOCRImage = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setOcrStatus('processing');
    setOcrProgress(5);
    setOcrStatusMessage('Preprocessing image (Scaling 2x, Grayscale & Contrast boost)...');
    setOcrError(null);

    let worker: any = null;

    try {
      // Step 1: Preprocess Image
      const preprocessedCanvas = await preprocessImageForOCR(file, {
        scaleFactor: 2.0,
        contrast: 1.45,
        brightness: 10,
        sharpen: true,
      });

      setOcrProgress(25);
      setOcrStatusMessage('Initializing client-side Tesseract OCR...');

      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const p = Math.round((m.progress || 0) * 100);
            setOcrProgress(25 + Math.round(p * 0.6));
            setOcrStatusMessage(`Scanning CampX attendance table (${p}%)...`);
          }
        },
      });

      setOcrProgress(40);
      setOcrStatusMessage('Extracting percentages top-to-bottom...');
      const pass1Result = await worker.recognize(preprocessedCanvas);
      const pass1Text = pass1Result.data?.text || '';

      let results = parseCampXOCRText(pass1Text, sortedSubjects, subjectTotals);

      // Check if any subject got missed or defaulted
      const hasLowConf = results.some((r) => r.confidence === 'low');
      if (hasLowConf) {
        setOcrProgress(80);
        setOcrStatusMessage('Pass 2: Running secondary validation pass on original image...');
        const pass2Result = await worker.recognize(file);
        const pass2Text = pass2Result.data?.text || '';
        results = parseCampXOCRText([pass1Text, pass2Text], sortedSubjects, subjectTotals);
      }

      setOcrProgress(100);
      setOcrStatusMessage('Matching subjects by top-to-bottom order...');

      // Update subjectPcts state
      const newPcts: Record<string, number> = {};
      results.forEach((r) => {
        newPcts[r.subjectId] = r.extractedPercentage;
      });

      setSubjectPcts((prev) => ({ ...prev, ...newPcts }));
      setExtractedSubjects(results);
      setOcrStatus('success');
    } catch (err: any) {
      console.error('OCR error:', err);
      setOcrStatus('error');
      setOcrError('Could not process the screenshot clearly. Please ensure the image shows your CampX attendance table or try manual setup.');
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          // cleanup
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processOCRImage(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processOCRImage(file);
    }
  };

  const handlePctChange = (subjectId: string, val: string) => {
    const num = parseFloat(val);
    const safeNum = isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
    setSubjectPcts((prev) => ({ ...prev, [subjectId]: safeNum }));
  };

  const handleQuickPreset = (pct: number) => {
    setOverallInput(pct.toString());
    setSubjectPcts((prev) => {
      const next = { ...prev };
      sortedSubjects.forEach((s) => {
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

  const handleLaunchApp = () => {
    const updatedStates: StudentSubjectState[] = sortedSubjects.map((subj) => {
      const ext = extractedSubjects.find((r) => r.subjectId === subj.id);
      const userPct = subjectPcts[subj.id];
      const pct = typeof userPct === 'number' ? userPct : (ext?.extractedPercentage ?? 80);
      const total = subjectTotals[subj.id] || calculateConductedPeriods(subj.id, resolvedDate, appData);
      const attended = Math.round((pct / 100) * total);
      const safeAttended = Math.min(total, Math.max(0, attended));

      return {
        subjectId: subj.id,
        attended: safeAttended,
        total,
      };
    });

    onSave(updatedStates);
  };

  // Calculate overall average percentage for summary display
  const averagePct = React.useMemo(() => {
    let sumPcts = 0;
    sortedSubjects.forEach((s) => {
      sumPcts += subjectPcts[s.id] ?? 80;
    });
    return (sumPcts / sortedSubjects.length).toFixed(2);
  }, [sortedSubjects, subjectPcts]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-3.5 sm:p-6 font-sans relative">
      <div className="max-w-md mx-auto w-full pt-2 pb-16">
        {/* HEADER SECTION */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-5"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold mb-2">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>CampX AI • Instant OCR Setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-1">
            Welcome to <span className="text-emerald-600">CampX AI</span>
          </h1>
          <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
            Upload your CampX attendance screenshot to automatically import all 10 subject percentages in 1 second.
          </p>
        </motion.div>

        {/* HERO OCR IMPORT CARD */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-md mb-5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {ocrStatus === 'idle' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group relative border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-gradient-to-b from-emerald-50/50 to-teal-50/20 hover:from-emerald-50 hover:to-teal-50 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Camera className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-0.5">
                  Import CampX Screenshot
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Tap to upload or drag & drop screenshot here
                </p>
              </div>

              <div className="w-full pt-1">
                <button
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs transition active:scale-[0.99]"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Image File</span>
                </button>
              </div>

              {/* 3 Step Instruction Pills */}
              <div className="grid grid-cols-3 gap-1.5 pt-2 w-full text-[10px]">
                <div className="bg-white/80 border border-slate-200 rounded-lg p-1.5 text-center font-semibold text-slate-700">
                  <span className="block text-emerald-600 font-bold">1. Capture</span>
                  CampX Table
                </div>
                <div className="bg-white/80 border border-slate-200 rounded-lg p-1.5 text-center font-semibold text-slate-700">
                  <span className="block text-emerald-600 font-bold">2. Upload</span>
                  Screenshot
                </div>
                <div className="bg-white/80 border border-slate-200 rounded-lg p-1.5 text-center font-semibold text-slate-700">
                  <span className="block text-emerald-600 font-bold">3. Auto Sync</span>
                  10 Subjects
                </div>
              </div>
            </div>
          )}

          {ocrStatus === 'processing' && (
            <div className="py-8 px-4 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                <Sparkles className="w-5 h-5 text-teal-500 absolute" />
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1">
                  Scanning CampX Attendance Table...
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {ocrStatusMessage}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden max-w-xs mx-auto border border-slate-200">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            </div>
          )}

          {ocrStatus === 'error' && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs text-rose-900 font-medium leading-relaxed">
                {ocrError}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-4 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
              >
                Try Another Screenshot
              </button>
            </div>
          )}

          {ocrStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* SUCCESS HEADER */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-emerald-950">
                      10 Subjects Extracted Successfully!
                    </h3>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Auto-mapped in top-to-bottom reading order
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                    Overall Rate
                  </span>
                  <span className="text-base font-black text-emerald-800">
                    {averagePct}%
                  </span>
                </div>
              </div>

              {/* EXTRACTED SUBJECT PREVIEW LIST */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {sortedSubjects.map((subj) => {
                  const ext = extractedSubjects.find((r) => r.subjectId === subj.id);
                  const userPct = subjectPcts[subj.id];
                  const pct = typeof userPct === 'number' ? userPct : (ext?.extractedPercentage ?? 80);
                  const total = subjectTotals[subj.id] || calculateConductedPeriods(subj.id, resolvedDate, appData);
                  const attended = Math.round((pct / 100) * total);

                  return (
                    <div
                      key={subj.id}
                      className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200">
                            {subj.code}
                          </span>
                          <span className="text-[11px] font-bold text-slate-900 truncate">
                            {subj.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Attended {attended}/{total} periods
                        </span>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleLaunchApp}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-sm flex items-center justify-center gap-2 text-sm transition active:scale-[0.99]"
                >
                  <span>Confirm & Launch CampX AI</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-upload Different Screenshot</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* COLLAPSIBLE MANUAL FALLBACK ENTRY */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowManualFallback(!showManualFallback)}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              <span>Don't have a screenshot? Enter percentages manually</span>
            </div>
            {showManualFallback ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <AnimatePresence>
            {showManualFallback && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-3.5 border-t border-slate-100 space-y-3 bg-slate-50/50"
              >
                {/* OVERALL QUICK PRESET SECTION */}
                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Overall Percentage Preset
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={overallInput}
                        onChange={(e) => setOverallInput(e.target.value)}
                        placeholder="e.g. 80"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOverallApply}
                      className="py-1.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shrink-0"
                    >
                      Apply All
                    </button>
                  </div>
                </div>

                {/* MANUAL SUBJECT INPUT LIST */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {sortedSubjects.map((subj) => {
                    const pct = subjectPcts[subj.id] ?? 80;
                    const total = subjectTotals[subj.id] || 14;
                    const estAttended = Math.round((pct / 100) * total);

                    return (
                      <div
                        key={subj.id}
                        className="bg-white rounded-xl p-2.5 border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 mr-1.5">
                              {subj.code}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {subj.name}
                            </span>
                          </div>

                          <div className="shrink-0 relative w-20">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={pct}
                              onChange={(e) => handlePctChange(subj.id, e.target.value)}
                              className="w-full text-right text-xs font-bold pr-4 pl-1 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                            />
                            <span className="absolute right-1.5 top-1 text-[10px] text-slate-400 font-bold">
                              %
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-500 flex items-center justify-between">
                          <span>Attended {estAttended}/{total} periods</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleLaunchApp}
                  className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <span>Save Manual Attendance & Launch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
