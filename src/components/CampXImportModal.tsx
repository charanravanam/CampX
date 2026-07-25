import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Loader2,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
  SlidersHorizontal,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
  Check
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { SubjectInfo } from '../types';
import {
  parseCampXOCRText,
  OCRExtractedSubject,
  OCRWordBoundingBox
} from '../utils/ocrParser';
import { preprocessImageForOCR } from '../utils/imagePreprocessing';

interface CampXImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: SubjectInfo[];
  subjectTotals: Record<string, number>;
  onApply: (extractedPcts: Record<string, number>, avgPct: number) => void;
}

export const CampXImportModal: React.FC<CampXImportModalProps> = ({
  isOpen,
  onClose,
  subjects,
  subjectTotals,
  onApply,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'review' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing OCR...');
  const [results, setResults] = useState<OCRExtractedSubject[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & UI state
  const [filterLowConfidence, setFilterLowConfidence] = useState<boolean>(false);
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);
  const [showImagePreviewModal, setShowImagePreviewModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setStatus('idle');
      setProgress(0);
      setResults([]);
      setErrorMessage(null);
      setFilterLowConfidence(false);
      setExpandedSnippetId(null);
      setShowImagePreviewModal(false);
    }
  }, [isOpen]);

  const processImage = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setStatus('processing');
    setProgress(5);
    setStatusMessage('Preprocessing image (Scaling 2x, Grayscale & Contrast boost)...');
    setErrorMessage(null);

    let worker: any = null;

    try {
      // Step 1: Image Preprocessing (Pass 1 Canvas)
      const preprocessedCanvas = await preprocessImageForOCR(file, {
        scaleFactor: 2.0,
        contrast: 1.45,
        brightness: 10,
        sharpen: true,
      });

      setProgress(20);
      setStatusMessage('Initializing Tesseract client-side engine...');

      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const p = Math.round((m.progress || 0) * 100);
            setProgress(25 + Math.round(p * 0.5));
            setStatusMessage(`Pass 1: Scanning preprocessed image (${p}%)...`);
          } else if (m.status === 'loading language traineddata') {
            setProgress(22);
            setStatusMessage('Loading OCR dictionaries...');
          }
        },
      });

      // Pass 1: Perform OCR on Preprocessed Canvas
      setStatusMessage('Pass 1: Extracting spatial layout & bounding boxes...');
      const pass1Result = await worker.recognize(preprocessedCanvas);

      const pass1Words: OCRWordBoundingBox[] = (pass1Result.data?.words || []).map((w: any) => ({
        text: w.text || '',
        bbox: {
          x0: w.bbox?.x0 || 0,
          y0: w.bbox?.y0 || 0,
          x1: w.bbox?.x1 || 0,
          y1: w.bbox?.y1 || 0,
        },
        confidence: w.confidence || 0,
      }));

      const pass1Text = pass1Result.data?.text || '';

      // Check Pass 1 results
      let initialResults = parseCampXOCRText(
        { words: pass1Words, rawText: pass1Text },
        subjects,
        subjectTotals
      );

      const pass1LowConf = initialResults.filter((r) => r.confidence === 'low').length;

      // Pass 2: Multi-pass execution on original image if pass 1 missed any subjects
      if (pass1LowConf > 0) {
        setProgress(80);
        setStatusMessage('Pass 2: Running secondary validation pass on original image...');
        const pass2Result = await worker.recognize(file);
        const pass2Text = pass2Result.data?.text || '';

        // Combine multi-pass results
        initialResults = parseCampXOCRText(
          [pass1Text, pass2Text],
          subjects,
          subjectTotals
        );
      }

      setProgress(98);
      setStatusMessage('Finalizing subject matching & attendance totals...');

      setResults(initialResults);
      setStatus('review');
    } catch (err: any) {
      console.error('OCR processing error:', err);
      setStatus('error');
      setErrorMessage(
        'Could not complete OCR scan. Please ensure the screenshot is clear and legible, or input values manually.'
      );
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          // ignore cleanup
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
  };

  const handlePctChange = (subjectId: string, val: string) => {
    const num = parseFloat(val);
    const safeNum = isNaN(num) ? 0 : Math.min(100, Math.max(0, num));

    setResults((prev) =>
      prev.map((item) => {
        if (item.subjectId === subjectId) {
          const tot = item.extractedTotal || subjectTotals[subjectId] || 1;
          const att = Math.round((safeNum / 100) * tot);
          return {
            ...item,
            extractedPercentage: safeNum,
            extractedAttended: Math.min(tot, Math.max(0, att)),
            isConfirmedByUser: true,
            confidence: 'high', // Mark user confirmed items as high
          };
        }
        return item;
      })
    );
  };

  const handleApplyAll = () => {
    const extractedMap: Record<string, number> = {};
    let totalPctSum = 0;

    results.forEach((r) => {
      extractedMap[r.subjectId] = r.extractedPercentage;
      totalPctSum += r.extractedPercentage;
    });

    const avgPct =
      results.length > 0 ? parseFloat((totalPctSum / results.length).toFixed(2)) : 80;

    onApply(extractedMap, avgPct);
    onClose();
  };

  if (!isOpen) return null;

  const matchedCount = results.filter((r) => r.confidence !== 'low').length;
  const lowCount = results.filter((r) => r.confidence === 'low').length;
  const totalCount = results.length;

  const displayedResults = filterLowConfidence
    ? results.filter((r) => r.confidence === 'low')
    : results;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]"
        >
          {/* MODAL HEADER */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                  Enhanced CampX OCR Import
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Client-side multi-pass OCR with spatial layout & fuzzy matching
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto py-4 flex-1 space-y-4">
            {/* IDLE STATE: FILE UPLOAD ZONE */}
            {status === 'idle' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 transition rounded-2xl p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition shadow-2xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-900 block mb-0.5">
                      Upload CampX Attendance Screenshot
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Drag & drop screenshot or tap to upload
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-200">
                      Auto-Preprocessing Enabled
                    </span>
                  </div>
                </div>

                {/* ADVANCED PIPELINE FEATURES INFO */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-2 text-slate-600">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Accuracy Enhancements Included:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                      <strong className="text-slate-800 block mb-0.5">🎨 Image Preprocessing</strong>
                      <span className="text-slate-500">2x Upscaling, Grayscale & Contrast sharpening</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                      <strong className="text-slate-800 block mb-0.5">📐 Layout-Aware OCR</strong>
                      <span className="text-slate-500">Spatial word bounding box row alignment</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                      <strong className="text-slate-800 block mb-0.5">🔍 Fuzzy Match Engine</strong>
                      <span className="text-slate-500">Levenshtein code & name distance metrics</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                      <strong className="text-slate-800 block mb-0.5">🔄 Multi-Pass Scan</strong>
                      <span className="text-slate-500">Dual-pass validation for low-confidence fields</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PROCESSING STATE: PROGRESS BAR & STATUS */}
            {status === 'processing' && (
              <div className="py-8 text-center space-y-4">
                {imagePreview && (
                  <div className="relative w-28 h-28 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-200 shadow-md">
                    <img
                      src={imagePreview}
                      alt="Screenshot preview"
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-white animate-spin" />
                    </div>
                  </div>
                )}

                <div className="max-w-xs mx-auto space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
                    <span className="truncate pr-2">{statusMessage}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                    <motion.div
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Running Tesseract.js client-side OCR inside browser memory. Your images never leave your device.
                </p>
              </div>
            )}

            {/* ERROR STATE */}
            {status === 'error' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">OCR Processing Issue</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {errorMessage || 'Unable to scan image.'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('idle')}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Try Another Image
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    Enter Manually
                  </button>
                </div>
              </div>
            )}

            {/* REVIEW STATE: EXTRACTED SUBJECTS LIST */}
            {status === 'review' && (
              <div className="space-y-3">
                {/* MATCHED SUMMARY BANNER & IMAGE PREVIEW BUTTON */}
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-extrabold text-emerald-900 block truncate">
                        Matched {matchedCount} of {totalCount} subjects
                      </span>
                      <span className="text-[10px] text-emerald-700 block truncate">
                        {lowCount > 0
                          ? `${lowCount} item(s) need review (highlighted in amber)`
                          : 'High confidence match across all subjects'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => setShowImagePreviewModal(!showImagePreviewModal)}
                        className="text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200 flex items-center gap-1 transition"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>Screenshot</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStatus('idle')}
                      className="text-[10px] font-bold text-emerald-800 hover:underline flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-emerald-200 transition"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  </div>
                </div>

                {/* ORIGINAL SCREENSHOT EXPANDABLE PREVIEW */}
                {showImagePreviewModal && imagePreview && (
                  <div className="bg-slate-900/90 rounded-2xl p-2 relative text-center">
                    <img
                      src={imagePreview}
                      alt="Original screenshot"
                      className="max-h-52 mx-auto rounded-xl object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImagePreviewModal(false)}
                      className="absolute top-3 right-3 bg-slate-800/80 hover:bg-slate-800 text-white p-1 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* FILTER / LOW CONFIDENCE TOGGLE */}
                {lowCount > 0 && (
                  <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Review required for {lowCount} low-confidence subject(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => setFilterLowConfidence(!filterLowConfidence)}
                      className="text-[10px] font-extrabold text-amber-800 underline hover:text-amber-950"
                    >
                      {filterLowConfidence ? 'Show All Subjects' : 'Filter Low-Confidence Only'}
                    </button>
                  </div>
                )}

                {/* SUBJECT LIST */}
                <div className="space-y-2.5">
                  {displayedResults.map((item) => {
                    const isHigh = item.confidence === 'high';
                    const isMed = item.confidence === 'medium';
                    const isLow = item.confidence === 'low';
                    const isSnippetExpanded = expandedSnippetId === item.subjectId;

                    return (
                      <div
                        key={item.subjectId}
                        className={`p-3 rounded-2xl border transition ${
                          isLow
                            ? 'bg-amber-50/60 border-amber-300/80 shadow-2xs'
                            : 'bg-white border-slate-200/90 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {/* BADGES & CONFIDENCE */}
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {item.subjectCode}
                              </span>

                              {item.isConfirmedByUser ? (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Confirmed
                                </span>
                              ) : isHigh ? (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  High Confidence ({item.matchedBy})
                                </span>
                              ) : isMed ? (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                  Medium Confidence ({item.matchedBy})
                                </span>
                              ) : (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                  Check Percentage
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 leading-tight">
                              {item.subjectName}
                            </h4>

                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                              <span>
                                Conducted: <strong className="text-slate-800">{item.extractedTotal}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Attended: <strong className="text-slate-800">{item.extractedAttended}</strong>
                              </span>

                              {item.rawSnippet && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSnippetId(
                                      isSnippetExpanded ? null : item.subjectId
                                    )
                                  }
                                  className="text-[9px] font-bold text-slate-400 hover:text-slate-700 underline ml-auto flex items-center gap-0.5"
                                >
                                  <span>Snippet</span>
                                  {isSnippetExpanded ? (
                                    <ChevronUp className="w-2.5 h-2.5" />
                                  ) : (
                                    <ChevronDown className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* EXPANDABLE OCR RAW SNIPPET FOR DEBUG/VERIFICATION */}
                            {isSnippetExpanded && item.rawSnippet && (
                              <div className="mt-2 p-2 bg-slate-900 text-slate-200 rounded-xl text-[10px] font-mono leading-tight border border-slate-800">
                                <span className="text-slate-500 block mb-0.5 font-sans font-bold">
                                  Detected OCR Snippet:
                                </span>
                                {item.rawSnippet}
                              </div>
                            )}
                          </div>

                          {/* PERCENTAGE INPUT FIELD */}
                          <div className="shrink-0 text-right">
                            <div className="relative inline-block w-[88px]">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={item.extractedPercentage}
                                onChange={(e) => handlePctChange(item.subjectId, e.target.value)}
                                className={`w-full text-right text-xs sm:text-sm font-extrabold pr-4 pl-1.5 py-1 rounded-xl border focus:outline-none transition ${
                                  isLow
                                    ? 'bg-amber-100/90 text-amber-950 border-amber-400 focus:border-amber-600'
                                    : 'bg-emerald-50/80 text-emerald-800 border-emerald-300 focus:border-emerald-500'
                                }`}
                              />
                              <span className="absolute right-1.5 top-1 text-xs font-bold text-slate-500">
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* MODAL FOOTER */}
          {status === 'review' && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAll}
                className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-[0.98]"
              >
                <span>Apply Extracted Values</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
