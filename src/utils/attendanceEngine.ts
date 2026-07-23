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

/**
 * Calculates metrics for a single subject
 */
export function calculateSubjectMetrics(
  subject: SubjectInfo,
  state: StudentSubjectState,
  schedule: ScheduleSession[] = [],
  currentDate: string, // YYYY-MM-DD
  threshold: number = 0.75
): SubjectMetrics {
  const attended = Math.max(0, state.attended);
  const total = Math.max(attended, state.total);
  const currentPercentage = calculateCurrentAttendance(attended, total);

  // Remaining periods are those on or after currentDate in the schedule
  const futureSessions = schedule.filter((s) => s.date >= currentDate);
  const remainingPeriods = futureSessions.reduce((acc, s) => acc + s.periods, 0);

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

  // Next session
  const nextSession = futureSessions.length > 0 ? futureSessions[0] : undefined;

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

      const session: ScheduleSession = {
        date: todayDate,
        periods: calItem.periods,
        start: calItem.start,
        end: calItem.end,
        time: `${calItem.start} - ${calItem.end}`,
        room: subject.room,
      };

      // Simulate missing this session for overall attendance
      const simulatedSubjectMetricsList = Object.values(subjectsMetricsMap).map((m) => {
        if (m.subject.id === subject.id) {
          const newTotal = m.total + calItem.periods;
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

      result.push({
        subject,
        session,
        periods: calItem.periods,
        time: `${calItem.start} - ${calItem.end}`,
        room: subject.room,
        liveImpactPercentageIfMissed,
        overallDropIfMissed,
        priorityScore,
        safeToMissBefore: sm.safeToMiss,
        isSafeToMiss: sm.safeToMiss >= calItem.periods,
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
          isSafeToMiss: sm.safeToMiss >= session.periods,
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
