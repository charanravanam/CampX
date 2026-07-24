import {
  SubjectInfo,
  ScheduleSession,
  StudentSubjectState,
  SubjectMetrics,
  OverallMetrics,
  TodaySessionInfo,
  SimulationResult,
} from '../types';

/**
 * Calculates current attendance percentage (0..100)
 */
export function calculateCurrentAttendance(attended: number, total: number): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, (attended / total) * 100));
}

/**
 * Calculates safe periods to miss for a subject based on CURRENT conducted classes
 * Formula: floor((attended - threshold * total) / threshold)
 */
export function calculateSafeToMiss(
  attended: number,
  total: number,
  _remainingPeriods: number = 0,
  threshold: number = 0.75
): number {
  if (total <= 0) return 0;
  if (threshold <= 0 || threshold >= 1) threshold = 0.75;

  const currentBuffer = attended - threshold * total;
  if (currentBuffer < 0) return 0;

  const maxAllowedMisses = Math.floor(currentBuffer / threshold);
  return Math.max(0, maxAllowedMisses);
}

/**
 * Calculates consecutive recovery periods needed to reach threshold
 * Formula: ceil((threshold * total - attended) / (1 - threshold))
 */
export function calculateRecovery(
  attended: number,
  total: number,
  threshold: number = 0.75
): number {
  if (total <= 0) return 0;
  const currentRatio = attended / total;
  if (currentRatio >= threshold) return 0;

  const num = threshold * total - attended;
  const den = 1 - threshold;
  if (den <= 0) return 0;

  const needed = Math.ceil(num / den);
  return Math.max(0, needed);
}

/**
 * Calculates maximum achievable percentage if student attends all remaining periods
 * Formula: (attended + remaining_periods) / (total + remaining_periods)
 */
export function calculateMaxAchievable(
  attended: number,
  total: number,
  remainingPeriods: number
): number {
  const futureTotal = total + remainingPeriods;
  if (futureTotal <= 0) return 100;
  return Math.min(100, Math.max(0, ((attended + remainingPeriods) / futureTotal) * 100));
}

function formatTimeString(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const formattedH = String(h).padStart(2, '0');
  return `${formattedH}:${m} ${ampm}`;
}

/**
 * Calculates metrics for a single subject
 */
export function calculateSubjectMetrics(
  subject: SubjectInfo,
  state: StudentSubjectState,
  schedule: ScheduleSession[] = [],
  currentDate: string, // YYYY-MM-DD
  threshold: number = 0.75,
  rawCalendar?: Record<string, any[]>
): SubjectMetrics {
  const attended = Math.max(0, state.attended);
  const total = Math.max(attended, state.total);
  const currentPercentage = calculateCurrentAttendance(attended, total);

  // Total classes scheduled in the timetable for this subject across the whole semester
  const totalClassesInSchedule = schedule.reduce((acc, s) => acc + (typeof s.periods === 'number' && s.periods > 0 ? s.periods : 1), 0);

  // Remaining periods are total classes in schedule minus completed classes
  const futureSessions = schedule.filter((s) => s.date >= currentDate);
  const remainingPeriods = totalClassesInSchedule > 0
    ? Math.max(0, totalClassesInSchedule - total)
    : futureSessions.reduce((acc, s) => acc + (typeof s.periods === 'number' && s.periods > 0 ? s.periods : 1), 0);

  const safeToMiss = calculateSafeToMiss(attended, total, remainingPeriods, threshold);
  const recoveryPeriodsNeeded = calculateRecovery(attended, total, threshold);
  const maxAchievablePercentage = calculateMaxAchievable(attended, total, remainingPeriods);

  const isAchievable75 = maxAchievablePercentage >= threshold * 100;

  // Status classification
  let status: 'safe' | 'caution' | 'critical';
  if (currentPercentage < threshold * 100 || safeToMiss === 0) {
    status = 'critical';
  } else if (safeToMiss <= 2) {
    status = 'caution';
  } else {
    status = 'safe';
  }

  // Next session dynamically starting from currentDate
  let nextSession = futureSessions.length > 0 ? { ...futureSessions[0] } : undefined;

  // Enrich nextSession time if rawCalendar is provided
  if (nextSession && nextSession.date && rawCalendar && rawCalendar[nextSession.date]) {
    const dayList = rawCalendar[nextSession.date];
    const match = dayList.find(
      (ds: any) => String(ds.subjectId) === String(subject.id)
    );
    if (match && match.start && match.end) {
      nextSession.start = match.start;
      nextSession.end = match.end;
      nextSession.time = `${formatTimeString(match.start)} - ${formatTimeString(match.end)}`;
    }
  }

  // Impact if next session is missed
  let missImpactPercentage = currentPercentage;
  if (nextSession) {
    missImpactPercentage = calculateCurrentAttendance(attended, total + nextSession.periods);
  }

  return {
    subject,
    attended,
    total,
    currentPercentage,
    remainingPeriods,
    safeToMiss,
    recoveryPeriodsNeeded,
    maxAchievablePercentage,
    isAchievable75,
    status,
    nextSession,
    missImpactPercentage,
  };
}

/**
 * Calculates overall attendance weighted strictly by periods across all subjects
 * Formula: sum(attended across all subjects) / sum(total across all subjects)
 */
export function calculateOverallAttendance(
  subjectMetricsList: SubjectMetrics[],
  threshold: number = 0.75
): OverallMetrics {
  const totalAttended = subjectMetricsList.reduce((acc, sm) => acc + sm.attended, 0);
  const totalPeriods = subjectMetricsList.reduce((acc, sm) => acc + sm.total, 0);
  const currentPercentage = calculateCurrentAttendance(totalAttended, totalPeriods);

  const totalSafeToMiss = subjectMetricsList.reduce((acc, sm) => acc + sm.safeToMiss, 0);
  const totalRecoveryNeeded = subjectMetricsList.reduce(
    (acc, sm) => acc + sm.recoveryPeriodsNeeded,
    0
  );

  let status: 'safe' | 'caution' | 'critical';
  if (currentPercentage < threshold * 100 || totalSafeToMiss === 0) {
    status = 'critical';
  } else if (totalSafeToMiss <= 2) {
    status = 'caution';
  } else {
    status = 'safe';
  }

  // Actionable headline generator (never just a raw %!)
  let headline = '';
  if (totalSafeToMiss >= 1) {
    headline = `You can safely miss ${totalSafeToMiss} period${
      totalSafeToMiss > 1 ? 's' : ''
    } right now without dropping below ${(threshold * 100).toFixed(0)}%.`;
  } else if (totalRecoveryNeeded > 0) {
    headline = `Action needed: Attend your next ${totalRecoveryNeeded} period${
      totalRecoveryNeeded > 1 ? 's' : ''
    } to reach ${(threshold * 100).toFixed(0)}% eligibility.`;
  } else {
    headline = `At threshold limit! Missing any class right now will drop attendance below ${(threshold * 100).toFixed(0)}%.`;
  }

  return {
    totalAttended,
    totalPeriods,
    currentPercentage,
    totalSafeToMiss,
    totalRecoveryNeeded,
    status,
    headline,
  };
}

/**
 * Evaluates whether a session is "Skippable" or "Must Attend" based on:
 * 1. Total classes in the whole semester & classes attended till date across the semester
 * 2. Possible implications on future attendance (required future attendance rate to reach threshold)
 * 3. Class Type Priority: Labs have far fewer total sessions in the semester (~12-15 labs vs ~45-60 lectures),
 *    so missing a lab has a higher weight and severity, making labs higher priority.
 */
export function evaluateSemesterSkippability(
  subject: SubjectInfo,
  periodsInSession: number,
  subjectsMetricsMap: Record<string, SubjectMetrics>,
  scheduleMap: Record<string, ScheduleSession[]>,
  threshold: number = 0.75
): { isSafeToMiss: boolean; reason: string } {
  const metricsList = Object.values(subjectsMetricsMap);
  const overall = calculateOverallAttendance(metricsList, threshold);

  // 1. Semester Totals Across All Subjects
  let totalSemesterPeriodsAll = 0;
  if (scheduleMap && Object.keys(scheduleMap).length > 0) {
    Object.keys(scheduleMap).forEach((subjId) => {
      const list = scheduleMap[subjId] || [];
      const sumPeriods = list.reduce((acc, sess) => acc + sess.periods, 0);
      totalSemesterPeriodsAll += sumPeriods > 0 ? sumPeriods : 45;
    });
  }

  if (totalSemesterPeriodsAll < overall.totalPeriods) {
    totalSemesterPeriodsAll = Math.max(overall.totalPeriods * 2, 300);
  }

  const attendedTillDate = overall.totalAttended;
  const conductedTillDate = overall.totalPeriods;
  const remainingSemesterPeriods = Math.max(0, totalSemesterPeriodsAll - conductedTillDate);

  // 2. Class Type Priority (Lab vs Lecture)
  // Labs have fewer total classes in a semester, so missing a lab consumes a larger fraction
  // of total lab classes and is significantly harder to recover from.
  const isLab = subject.type === 'lab';
  const typeWeight = isLab ? 2.2 : 1.0;

  // 3. Current Overall Buffer Check
  // Safe skips in overall periods = floor((Attended - threshold * Conducted) / threshold)
  const overallSafeBuffer = Math.floor(
    (attendedTillDate - threshold * conductedTillDate) / threshold
  );

  // Effective required buffer for this session type
  const requiredBufferForSession = Math.ceil(periodsInSession * typeWeight);

  // 4. Future Attendance Trajectory Implication
  // If student misses this class today:
  const newConductedIfMissed = conductedTillDate + periodsInSession;
  const newRemainingIfMissed = Math.max(0, remainingSemesterPeriods - periodsInSession);

  // Total target attended periods needed by end of semester to stay >= threshold%
  const targetEndAttended = Math.ceil(threshold * totalSemesterPeriodsAll);
  const remainingAttendedNeeded = Math.max(0, targetEndAttended - attendedTillDate);

  // Required future attendance percentage for all remaining semester classes
  const requiredFuturePctIfMissed =
    newRemainingIfMissed > 0
      ? (remainingAttendedNeeded / newRemainingIfMissed) * 100
      : 100;

  // Decision Logic:
  // Cannot skip if:
  // A. Overall current percentage is below threshold
  if (overall.currentPercentage < threshold * 100) {
    return {
      isSafeToMiss: false,
      reason: `Overall attendance (${overall.currentPercentage.toFixed(1)}%) is below ${(threshold * 100).toFixed(0)}% requirement.`,
    };
  }

  // B. Overall safe buffer is smaller than the weighted requirement for this class type
  if (overallSafeBuffer < requiredBufferForSession) {
    if (isLab) {
      return {
        isSafeToMiss: false,
        reason: `Lab Priority: Fewer semester lab classes. Needs ${requiredBufferForSession}+ period buffer (Current: ${Math.max(0, overallSafeBuffer)}).`,
      };
    }
    return {
      isSafeToMiss: false,
      reason: `Insufficient overall buffer (${Math.max(0, overallSafeBuffer)} period(s) available, ${requiredBufferForSession} needed).`,
    };
  }

  // C. Future attendance implication: If missing today forces future required attendance rate > 80%
  if (requiredFuturePctIfMissed > 80) {
    return {
      isSafeToMiss: false,
      reason: `Future Risk: Missing this forces ${requiredFuturePctIfMissed.toFixed(1)}% future attendance rate for rest of semester.`,
    };
  }

  // Otherwise, it's skippable!
  return {
    isSafeToMiss: true,
    reason: isLab
      ? `Skippable: Overall buffer (${overallSafeBuffer} periods) covers lab weight.`
      : `Skippable: Safe semester buffer (${overallSafeBuffer} periods) available.`,
  };
}

/**
 * Calculates today's classes and ranks them by priority
 * Rank formula: periods_in_session * drop_below_threshold_if_missed
 */
export function calculateTodaySessions(
  todayDate: string,
  subjects: SubjectInfo[],
  scheduleMap: Record<string, ScheduleSession[]>,
  subjectsMetricsMap: Record<string, SubjectMetrics>,
  threshold: number = 0.75,
  rawCalendar?: Record<string, { subjectId: number | string; periods: number; start: string; end: string }[]>
): TodaySessionInfo[] {
  const overallBefore = calculateOverallAttendance(Object.values(subjectsMetricsMap), threshold);

  const result: TodaySessionInfo[] = [];

  // Check if rawCalendar has today's schedule
  const todayCalendarSessions = rawCalendar?.[todayDate] || [];

  if (todayCalendarSessions.length > 0) {
    for (const calItem of todayCalendarSessions) {
      const subject = subjects.find((s) => s.id === calItem.subjectId.toString());
      if (!subject) continue;
      const sm = subjectsMetricsMap[subject.id];
      if (!sm) continue;

      const sessionPeriods = 1;
      const session: ScheduleSession = {
        date: todayDate,
        periods: sessionPeriods,
        start: calItem.start,
        end: calItem.end,
        time: `${calItem.start} - ${calItem.end}`,
        room: subject.room,
      };

      // Simulate missing this session for overall attendance
      const simulatedSubjectMetricsList = Object.values(subjectsMetricsMap).map((m) => {
        if (m.subject.id === subject.id) {
          const newTotal = m.total + sessionPeriods;
          const newAttended = m.attended;
          return {
            ...m,
            total: newTotal,
            attended: newAttended,
            currentPercentage: calculateCurrentAttendance(newAttended, newTotal),
          };
        }
        return m;
      });

      const overallAfter = calculateOverallAttendance(simulatedSubjectMetricsList, threshold);
      const liveImpactPercentageIfMissed = overallAfter.currentPercentage;
      const overallDropIfMissed = overallBefore.currentPercentage - liveImpactPercentageIfMissed;

      let priorityScore = calItem.periods * 10;
      if (sm.safeToMiss === 0) priorityScore += 50;
      else if (sm.safeToMiss <= 2) priorityScore += 25;

      const distFromThreshold = threshold * 100 - sm.currentPercentage;
      if (distFromThreshold > 0) priorityScore += distFromThreshold * 2;
      priorityScore += overallDropIfMissed * 15;

      // Calculate semester-wide skippability evaluation
      const skippableEval = evaluateSemesterSkippability(
        subject,
        sessionPeriods,
        subjectsMetricsMap,
        scheduleMap,
        threshold
      );

      result.push({
        subject,
        session,
        periods: sessionPeriods,
        time: `${calItem.start} - ${calItem.end}`,
        room: subject.room,
        liveImpactPercentageIfMissed,
        overallDropIfMissed,
        priorityScore,
        safeToMissBefore: sm.safeToMiss,
        isSafeToMiss: skippableEval.isSafeToMiss,
        skippableReason: skippableEval.reason,
      });
    }
  } else {
    for (const subject of subjects) {
      const subjectSchedule = scheduleMap[subject.id] || [];
      const todaySessions = subjectSchedule.filter((s) => s.date === todayDate);

      const sm = subjectsMetricsMap[subject.id];
      if (!sm) continue;

      for (const session of todaySessions) {
        const simulatedSubjectMetricsList = Object.values(subjectsMetricsMap).map((m) => {
          if (m.subject.id === subject.id) {
            const newTotal = m.total + session.periods;
            const newAttended = m.attended;
            return {
              ...m,
              total: newTotal,
              attended: newAttended,
              currentPercentage: calculateCurrentAttendance(newAttended, newTotal),
            };
          }
          return m;
        });

        const overallAfter = calculateOverallAttendance(simulatedSubjectMetricsList, threshold);
        const liveImpactPercentageIfMissed = overallAfter.currentPercentage;
        const overallDropIfMissed = overallBefore.currentPercentage - liveImpactPercentageIfMissed;

        let priorityScore = session.periods * 10;
        if (sm.safeToMiss === 0) priorityScore += 50;
        else if (sm.safeToMiss <= 2) priorityScore += 25;

        const distFromThreshold = threshold * 100 - sm.currentPercentage;
        if (distFromThreshold > 0) priorityScore += distFromThreshold * 2;
        priorityScore += overallDropIfMissed * 15;

        const formattedTime = session.start && session.end ? `${session.start} - ${session.end}` : (session.time || subject.defaultTime);

        // Calculate semester-wide skippability evaluation
        const skippableEval = evaluateSemesterSkippability(
          subject,
          session.periods,
          subjectsMetricsMap,
          scheduleMap,
          threshold
        );

        result.push({
          subject,
          session,
          periods: session.periods,
          time: formattedTime,
          room: session.room || subject.room,
          liveImpactPercentageIfMissed,
          overallDropIfMissed,
          priorityScore,
          safeToMissBefore: sm.safeToMiss,
          isSafeToMiss: skippableEval.isSafeToMiss,
          skippableReason: skippableEval.reason,
        });
      }
    }
  }

  // Sort chronologically by class start time (from 09:10 AM to 16:00 PM)
  return result.sort((a, b) => {
    const timeA = a.session.start || a.time || '';
    const timeB = b.session.start || b.time || '';
    return timeA.localeCompare(timeB);
  });
}

/**
 * Simulates scenarios for a given set of sessions (e.g. today or this week)
 */
export function simulateAttendanceScenarios(
  subjectMetricsList: SubjectMetrics[],
  sessionsToSimulate: { subjectId: string; periods: number }[],
  threshold: number = 0.75
): { attendAll: SimulationResult; missAll: SimulationResult } {
  const currentOverall = calculateOverallAttendance(subjectMetricsList, threshold);

  // Attend All Scenario
  const attendAllMetrics = subjectMetricsList.map((m) => {
    const matchingSessions = sessionsToSimulate.filter((s) => s.subjectId === m.subject.id);
    const addedPeriods = matchingSessions.reduce((acc, s) => acc + s.periods, 0);
    if (addedPeriods === 0) return m;

    const newAttended = m.attended + addedPeriods;
    const newTotal = m.total + addedPeriods;
    const newRem = Math.max(0, m.remainingPeriods - addedPeriods);

    return {
      ...m,
      attended: newAttended,
      total: newTotal,
      currentPercentage: calculateCurrentAttendance(newAttended, newTotal),
      safeToMiss: calculateSafeToMiss(newAttended, newTotal, newRem, threshold),
    };
  });

  const attendAllOverall = calculateOverallAttendance(attendAllMetrics, threshold);

  // Miss All Scenario
  const missAllMetrics = subjectMetricsList.map((m) => {
    const matchingSessions = sessionsToSimulate.filter((s) => s.subjectId === m.subject.id);
    const addedPeriods = matchingSessions.reduce((acc, s) => acc + s.periods, 0);
    if (addedPeriods === 0) return m;

    const newAttended = m.attended; // 0 added to attended
    const newTotal = m.total + addedPeriods;
    const newRem = Math.max(0, m.remainingPeriods - addedPeriods);

    return {
      ...m,
      attended: newAttended,
      total: newTotal,
      currentPercentage: calculateCurrentAttendance(newAttended, newTotal),
      safeToMiss: calculateSafeToMiss(newAttended, newTotal, newRem, threshold),
    };
  });

  const missAllOverall = calculateOverallAttendance(missAllMetrics, threshold);

  return {
    attendAll: {
      scenario: 'attend_all',
      overallPercentage: attendAllOverall.currentPercentage,
      percentageChange: attendAllOverall.currentPercentage - currentOverall.currentPercentage,
      newSafeToMiss: attendAllOverall.totalSafeToMiss,
    },
    missAll: {
      scenario: 'miss_all',
      overallPercentage: missAllOverall.currentPercentage,
      percentageChange: missAllOverall.currentPercentage - currentOverall.currentPercentage,
      newSafeToMiss: missAllOverall.totalSafeToMiss,
    },
  };
}
