import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AttendWiseData,
  StudentSubjectState,
  SubjectMetrics,
  OverallMetrics,
  TodaySessionInfo,
} from '../types';

import rawData from '../data/attendwise-data.json';
import {
  calculateSubjectMetrics,
  calculateOverallAttendance,
  calculateTodaySessions,
} from '../utils/attendanceEngine';

const STORAGE_KEY_STATES = 'attendwise_student_states_v2';
const STORAGE_KEY_THRESHOLD = 'attendwise_threshold_v1';
const STORAGE_KEY_ONBOARDED = 'attendwise_onboarded_v1';
const STORAGE_KEY_TODAY_MARKS = 'attendwise_today_marks_v1';

export function useAttendanceData() {
  const data: AttendWiseData = rawData as AttendWiseData;

  const [todayMarks, setTodayMarks] = useState<Record<string, 'attended' | 'missed'>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TODAY_MARKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [threshold, setThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THRESHOLD);
      if (saved) return parseFloat(saved);
    } catch {
      // ignore
    }
    return data.metadata.defaultThreshold || 0.75;
  });

  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ONBOARDED);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [studentStates, setStudentStates] = useState<Record<string, StudentSubjectState>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }

    // Default snapshot from JSON
    const initial: Record<string, StudentSubjectState> = {};
    data.subjects.forEach((subj) => {
      initial[subj.id] = {
        subjectId: subj.id,
        attended: subj.defaultAttended ?? 10,
        total: subj.defaultTotal ?? 12,
      };
    });
    return initial;
  });

  // Save states to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STATES, JSON.stringify(studentStates));
    } catch (e) {
      console.error('Failed to save student states', e);
    }
  }, [studentStates]);

  // Save threshold to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THRESHOLD, threshold.toString());
    } catch (e) {
      console.error('Failed to save threshold', e);
    }
  }, [threshold]);

  // Save onboarded status
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ONBOARDED, isOnboarded.toString());
    } catch (e) {
      console.error('Failed to save onboarded status', e);
    }
  }, [isOnboarded]);

  // Save today marks
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TODAY_MARKS, JSON.stringify(todayMarks));
    } catch (e) {
      console.error('Failed to save today marks', e);
    }
  }, [todayMarks]);

  const currentDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Check if todayStr exists in rawCalendar or subjectSchedule
    if (data.rawCalendar && data.rawCalendar[todayStr]) {
      return todayStr;
    }
    const hasSchedule = Object.values(data.subjectSchedule || {}).some((list) =>
      list.some((s) => s.date === todayStr)
    );
    if (hasSchedule) {
      return todayStr;
    }

    // Check if todayStr falls within semester range
    const startDate = data.metadata.startDate || '2026-07-06';
    const endDate = data.metadata.endDate || '2026-11-05';
    if (todayStr >= startDate && todayStr <= endDate) {
      return todayStr;
    }

    return data.metadata.currentDate || '2026-07-23';
  }, [data]);

  // Compute metrics per subject
  const subjectMetricsMap = useMemo(() => {
    const map: Record<string, SubjectMetrics> = {};
    data.subjects.forEach((subj) => {
      const state = studentStates[subj.id] || {
        subjectId: subj.id,
        attended: subj.defaultAttended ?? 10,
        total: subj.defaultTotal ?? 12,
      };
      const schedule = data.subjectSchedule[subj.id] || [];
      map[subj.id] = calculateSubjectMetrics(subj, state, schedule, currentDate, threshold, data.rawCalendar);
    });
    return map;
  }, [data.subjects, data.subjectSchedule, studentStates, currentDate, threshold, data.rawCalendar]);

  const subjectMetricsList = useMemo(() => {
    return data.subjects.map((s) => subjectMetricsMap[s.id]);
  }, [data.subjects, subjectMetricsMap]);

  // Overall metrics weighted by periods
  const overallMetrics: OverallMetrics = useMemo(() => {
    return calculateOverallAttendance(subjectMetricsList, threshold);
  }, [subjectMetricsList, threshold]);

  // Today's classes and impact
  const todaySessions: TodaySessionInfo[] = useMemo(() => {
    return calculateTodaySessions(
      currentDate,
      data.subjects,
      data.subjectSchedule,
      subjectMetricsMap,
      threshold,
      data.rawCalendar
    );
  }, [currentDate, data.subjects, data.subjectSchedule, subjectMetricsMap, threshold, data.rawCalendar]);

  const updateSubjectState = useCallback((subjectId: string, attended: number, total: number) => {
    setStudentStates((prev) => ({
      ...prev,
      [subjectId]: {
        subjectId,
        attended: Math.max(0, attended),
        total: Math.max(attended, total),
      },
    }));
  }, []);

  const markTodaySession = useCallback(
    (subjectId: string, sessionKey: string, newStatus: 'attended' | 'missed' | 'unmarked') => {
      setTodayMarks((prevMarks) => {
        const oldStatus = prevMarks[sessionKey];
        if (oldStatus === newStatus) return prevMarks;

        const nextMarks = { ...prevMarks };
        if (newStatus === 'unmarked') {
          delete nextMarks[sessionKey];
        } else {
          nextMarks[sessionKey] = newStatus;
        }

        setStudentStates((prevStates) => {
          const defaultSubj = data.subjects.find((s) => s.id === subjectId);
          const current = prevStates[subjectId] || {
            subjectId,
            attended: defaultSubj?.defaultAttended ?? 10,
            total: defaultSubj?.defaultTotal ?? 12,
          };
          let newAttended = current.attended;
          let newTotal = current.total;

          // Revert old mark (always fixed 1)
          if (oldStatus === 'attended') {
            newAttended = Math.max(0, newAttended - 1);
            newTotal = Math.max(newAttended, newTotal - 1);
          } else if (oldStatus === 'missed') {
            newTotal = Math.max(newAttended, newTotal - 1);
          }

          // Apply new mark (always fixed 1)
          if (newStatus === 'attended') {
            newAttended = newAttended + 1;
            newTotal = newTotal + 1;
          } else if (newStatus === 'missed') {
            newTotal = newTotal + 1;
          }

          return {
            ...prevStates,
            [subjectId]: {
              subjectId,
              attended: newAttended,
              total: Math.max(newAttended, newTotal),
            },
          };
        });

        return nextMarks;
      });
    },
    [data.subjects]
  );

  const batchUpdateSubjectStates = useCallback((states: StudentSubjectState[]) => {
    setStudentStates((prev) => {
      const next = { ...prev };
      states.forEach((s) => {
        next[s.subjectId] = {
          subjectId: s.subjectId,
          attended: Math.max(0, s.attended),
          total: Math.max(s.attended, s.total),
        };
      });
      return next;
    });
  }, []);

  const updateThresholdValue = useCallback((newVal: number) => {
    setThreshold(Math.min(0.95, Math.max(0.5, newVal)));
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsOnboarded(true);
  }, []);

  const resetData = useCallback(() => {
    const initial: Record<string, StudentSubjectState> = {};
    data.subjects.forEach((subj) => {
      initial[subj.id] = {
        subjectId: subj.id,
        attended: subj.defaultAttended ?? 10,
        total: subj.defaultTotal ?? 12,
      };
    });
    setStudentStates(initial);
    setThreshold(data.metadata.defaultThreshold || 0.75);
    setIsOnboarded(false);
    setTodayMarks({});
    localStorage.removeItem(STORAGE_KEY_STATES);
    localStorage.removeItem(STORAGE_KEY_THRESHOLD);
    localStorage.removeItem(STORAGE_KEY_ONBOARDED);
    localStorage.removeItem(STORAGE_KEY_TODAY_MARKS);
  }, [data.subjects, data.metadata.defaultThreshold]);

  const exportData = useCallback(() => {
    const exportObject = {
      exportDate: new Date().toISOString(),
      threshold,
      studentStates,
      overallMetrics,
      subjects: subjectMetricsList,
    };

    const blob = new Blob([JSON.stringify(exportObject, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendwise_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [threshold, studentStates, overallMetrics, subjectMetricsList]);

  return {
    data,
    currentDate,
    threshold,
    isOnboarded,
    studentStates,
    todayMarks,
    subjectMetricsMap,
    subjectMetricsList,
    overallMetrics,
    todaySessions,
    updateSubjectState,
    batchUpdateSubjectStates,
    markTodaySession,
    updateThreshold: updateThresholdValue,
    completeOnboarding,
    resetData,
    exportData,
  };
}
