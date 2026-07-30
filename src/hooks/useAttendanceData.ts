import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CampXData,
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
  calculateConductedPeriods,
} from '../utils/attendanceEngine';

const STORAGE_KEY_STATES = 'campx_ai_student_states_v2';
const OLD_STORAGE_KEY_STATES = 'attendwise_student_states_v2';

const STORAGE_KEY_THRESHOLD = 'campx_ai_threshold_v1';
const OLD_STORAGE_KEY_THRESHOLD = 'attendwise_threshold_v1';

const STORAGE_KEY_ONBOARDED = 'campx_ai_onboarded_v1';
const OLD_STORAGE_KEY_ONBOARDED = 'attendwise_onboarded_v1';

const STORAGE_KEY_TODAY_MARKS = 'campx_ai_today_marks_v1';
const OLD_STORAGE_KEY_TODAY_MARKS = 'attendwise_today_marks_v1';

function resolveCurrentDate(data: CampXData): string {
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
}

export function useAttendanceData() {
  const data: CampXData = rawData as CampXData;

  const currentDate = useMemo(() => resolveCurrentDate(data), [data]);
  const todayDate = currentDate;

  const [todayMarks, setTodayMarks] = useState<Record<string, 'attended' | 'missed' | 'exempt'>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TODAY_MARKS) || localStorage.getItem(OLD_STORAGE_KEY_TODAY_MARKS);
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
      const saved = localStorage.getItem(STORAGE_KEY_THRESHOLD) || localStorage.getItem(OLD_STORAGE_KEY_THRESHOLD);
      if (saved) return parseFloat(saved);
    } catch {
      // ignore
    }
    return data.metadata.defaultThreshold || 0.75;
  });

  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ONBOARDED) || localStorage.getItem(OLD_STORAGE_KEY_ONBOARDED);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [studentStates, setStudentStates] = useState<Record<string, StudentSubjectState>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATES) || localStorage.getItem(OLD_STORAGE_KEY_STATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }

    // Default snapshot calculated accurately from timetable up to currentDate
    const cDate = resolveCurrentDate(data);
    const initial: Record<string, StudentSubjectState> = {};
    data.subjects.forEach((subj) => {
      const total = calculateConductedPeriods(subj.id, cDate, data);
      const defaultPct = subj.defaultTotal && subj.defaultTotal > 0 ? (subj.defaultAttended / subj.defaultTotal) : 0.8;
      const attended = Math.round(defaultPct * total);
      initial[subj.id] = {
        subjectId: subj.id,
        attended,
        total,
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

  // Compute metrics per subject
  const subjectMetricsMap = useMemo(() => {
    const map: Record<string, SubjectMetrics> = {};
    data.subjects.forEach((subj) => {
      const calculatedTotal = calculateConductedPeriods(subj.id, currentDate, data);
      const defaultPct = subj.defaultTotal && subj.defaultTotal > 0 ? (subj.defaultAttended / subj.defaultTotal) : 0.8;
      const state = studentStates[subj.id] || {
        subjectId: subj.id,
        attended: Math.round(defaultPct * calculatedTotal),
        total: calculatedTotal,
      };
      const schedule = data.subjectSchedule[subj.id] || [];
      map[subj.id] = calculateSubjectMetrics(subj, state, schedule, currentDate, threshold, data.rawCalendar);
    });
    return map;
  }, [data, studentStates, currentDate, threshold]);

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
      todayDate,
      data.subjects,
      data.subjectSchedule,
      subjectMetricsMap,
      threshold,
      data.rawCalendar
    );
  }, [todayDate, data.subjects, data.subjectSchedule, subjectMetricsMap, threshold, data.rawCalendar]);

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

  const findOverlappingSessions = useCallback(
    (targetSessionKey: string, targetSubjectId: string) => {
      const parts = targetSessionKey.split('_');
      if (parts.length < 3) return [];

      const date = parts[0];
      const startTime = parts.slice(2).join('_');

      const daySessions = data.rawCalendar?.[date] || [];
      let targetStart = startTime;
      let targetEnd = '';

      const targetItem =
        daySessions.find(
          (item) => item.subjectId.toString() === targetSubjectId && item.start === startTime
        ) || daySessions.find((item) => item.subjectId.toString() === targetSubjectId);

      if (targetItem) {
        targetStart = targetItem.start;
        targetEnd = targetItem.end;
      }

      if (!targetEnd && data.subjectSchedule) {
        for (const [sId, sched] of Object.entries(data.subjectSchedule)) {
          if (sId === targetSubjectId) {
            const match = (sched as any[]).find((s) => s.date === date && (s.start === startTime || !startTime));
            if (match) {
              targetStart = match.start;
              targetEnd = match.end;
              break;
            }
          }
        }
      }

      if (!targetStart || !targetEnd) return [];

      const overlapping: { subjectId: string; sessionKey: string }[] = [];
      const seenSubjectIds = new Set<string>();

      daySessions.forEach((item) => {
        const sId = item.subjectId.toString();
        if (sId !== targetSubjectId && item.start === targetStart && item.end === targetEnd) {
          seenSubjectIds.add(sId);
          overlapping.push({
            subjectId: sId,
            sessionKey: `${date}_${sId}_${item.start}`,
          });
        }
      });

      if (data.subjectSchedule) {
        for (const [sId, sched] of Object.entries(data.subjectSchedule)) {
          if (sId !== targetSubjectId && !seenSubjectIds.has(sId)) {
            const matches = (sched as any[]).filter(
              (s) => s.date === date && s.start === targetStart && s.end === targetEnd
            );
            if (matches.length > 0) {
              seenSubjectIds.add(sId);
              overlapping.push({
                subjectId: sId,
                sessionKey: `${date}_${sId}_${targetStart}`,
              });
            }
          }
        }
      }

      return overlapping;
    },
    [data.rawCalendar, data.subjectSchedule]
  );

  const markTodaySession = useCallback(
    (subjectId: string, sessionKey: string, newStatus: 'attended' | 'missed' | 'unmarked') => {
      const oldStatus = todayMarks[sessionKey];
      if (oldStatus === newStatus) return;

      const overlappingList = findOverlappingSessions(sessionKey, subjectId);

      setTodayMarks((prevMarks) => {
        const nextMarks = { ...prevMarks };
        if (newStatus === 'unmarked') {
          delete nextMarks[sessionKey];
        } else {
          nextMarks[sessionKey] = newStatus;
        }

        if (newStatus === 'attended' || newStatus === 'missed') {
          overlappingList.forEach((item) => {
            nextMarks[item.sessionKey] = 'exempt';
          });
        } else {
          overlappingList.forEach((item) => {
            if (nextMarks[item.sessionKey] === 'exempt') {
              delete nextMarks[item.sessionKey];
            }
          });
        }

        return nextMarks;
      });

      setStudentStates((prevStates) => {
        const nextStates = { ...prevStates };

        // Extract date from sessionKey (e.g. "2026-07-29_1_09:10" -> "2026-07-29")
        const sessionDate = sessionKey.split('_')[0] || currentDate;

        const updateSubject = (sId: string, fromStatus?: string, toStatus?: string) => {
          const defaultSubj = data.subjects.find((s) => s.id === sId);
          const isDesignThinking = defaultSubj?.name.toLowerCase().includes('design thinking');
          const isLab = !isDesignThinking && (defaultSubj?.type === 'lab' || defaultSubj?.name.toLowerCase().includes('lab'));
          const sessionInDate = data.subjectSchedule?.[sId]?.find((s) => s.date === sessionDate) ||
            (data.rawCalendar?.[sessionDate]?.find((s) => String(s.subjectId) === String(sId)));
          const weight = isLab ? 2 : (sessionInDate?.periods || 1);
          const calculatedTotal = calculateConductedPeriods(sId, currentDate, data);
          const defaultPct = defaultSubj?.defaultTotal && defaultSubj.defaultTotal > 0 ? (defaultSubj.defaultAttended / defaultSubj.defaultTotal) : 0.8;
          const current = nextStates[sId] || {
            subjectId: sId,
            attended: Math.round(defaultPct * calculatedTotal),
            total: calculatedTotal,
          };
          let newAttended = current.attended;
          let newTotal = current.total;

          if (fromStatus === 'attended') {
            newAttended = Math.max(0, newAttended - weight);
            newTotal = Math.max(newAttended, newTotal - weight);
          } else if (fromStatus === 'missed') {
            newTotal = Math.max(newAttended, newTotal - weight);
          }

          if (toStatus === 'attended') {
            newAttended = newAttended + weight;
            newTotal = newTotal + weight;
          } else if (toStatus === 'missed') {
            newTotal = newTotal + weight;
          }

          nextStates[sId] = {
            subjectId: sId,
            attended: newAttended,
            total: Math.max(newAttended, newTotal),
          };
        };

        updateSubject(subjectId, oldStatus, newStatus);

        overlappingList.forEach((item) => {
          const otherOldStatus = todayMarks[item.sessionKey];
          if (newStatus === 'attended' || newStatus === 'missed') {
            if (otherOldStatus === 'attended' || otherOldStatus === 'missed') {
              updateSubject(item.subjectId, otherOldStatus, 'exempt');
            }
          }
        });

        return nextStates;
      });
    },
    [todayMarks, findOverlappingSessions, data.subjects]
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
    const cDate = resolveCurrentDate(data);
    const initial: Record<string, StudentSubjectState> = {};
    data.subjects.forEach((subj) => {
      const total = calculateConductedPeriods(subj.id, cDate, data);
      const defaultPct = subj.defaultTotal && subj.defaultTotal > 0 ? (subj.defaultAttended / subj.defaultTotal) : 0.8;
      const attended = Math.round(defaultPct * total);
      initial[subj.id] = {
        subjectId: subj.id,
        attended,
        total,
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
  }, [data]);

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
    link.download = `campx_ai_export_${new Date().toISOString().slice(0, 10)}.json`;
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
