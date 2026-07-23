export type SubjectType = 'lecture' | 'lab';

export interface SubjectInfo {
  id: string;
  code: string;
  name: string;
  type: SubjectType;
  teacher: string;
  room: string;
  defaultTime: string;
  defaultAttended: number;
  defaultTotal: number;
}

export interface ScheduleSession {
  date?: string; // YYYY-MM-DD
  periods: number;
  time?: string;
  start?: string;
  end?: string;
  room?: string;
  subjectId?: number | string;
}

export interface CalendarDay {
  date: string;
  day: string;
  type: string;
  sessions?: ScheduleSession[];
}

export interface AttendWiseMetadata {
  appName: string;
  semester: string;
  startDate: string;
  endDate: string;
  currentDate: string;
  defaultThreshold: number;
  institution: string;
}

export interface AttendWiseData {
  metadata: AttendWiseMetadata;
  subjects: SubjectInfo[];
  calendar: CalendarDay[];
  subjectSchedule: Record<string, ScheduleSession[]>;
  rawCalendar?: Record<string, { subjectId: number | string; periods: number; start: string; end: string }[]>;
}

export interface StudentSubjectState {
  subjectId: string;
  attended: number;
  total: number;
}

export interface SubjectMetrics {
  subject: SubjectInfo;
  attended: number;
  total: number;
  currentPercentage: number; // 0..100
  remainingPeriods: number;
  safeToMiss: number;
  recoveryPeriodsNeeded: number;
  maxAchievablePercentage: number;
  isAchievable75: boolean;
  status: 'safe' | 'caution' | 'critical';
  nextSession?: ScheduleSession;
  missImpactPercentage: number; // percentage after missing 1 session
}

export interface OverallMetrics {
  totalAttended: number;
  totalPeriods: number;
  currentPercentage: number; // 0..100
  totalSafeToMiss: number;
  totalRecoveryNeeded: number;
  status: 'safe' | 'caution' | 'critical';
  headline: string;
}

export interface TodaySessionInfo {
  subject: SubjectInfo;
  session: ScheduleSession;
  periods: number;
  time: string;
  room: string;
  liveImpactPercentageIfMissed: number;
  overallDropIfMissed: number;
  priorityScore: number;
  safeToMissBefore: number;
  isSafeToMiss: boolean;
}

export interface DayForecast {
  date: string;
  dayName: string;
  sessions: {
    subject: SubjectInfo;
    session: ScheduleSession;
  }[];
  totalPeriods: number;
}

export interface SimulationResult {
  scenario: 'attend_all' | 'miss_all';
  overallPercentage: number;
  percentageChange: number;
  newSafeToMiss: number;
}
