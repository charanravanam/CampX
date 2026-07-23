/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { useAttendanceData } from './hooks/useAttendanceData';
import { OnboardingFlow } from './components/OnboardingFlow';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { TodayTab } from './components/TodayTab';
import { SubjectsTab } from './components/SubjectsTab';
import { ForecastTab } from './components/ForecastTab';
import { ProfileTab } from './components/ProfileTab';

export default function App() {
  const {
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
    updateThreshold,
    completeOnboarding,
    resetData,
    exportData,
  } = useAttendanceData();

  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [selectedSubjectForDetail, setSelectedSubjectForDetail] = useState<string | null>(null);

  const handleOnboardingSave = (updatedStates: any[]) => {
    batchUpdateSubjectStates(updatedStates);
    completeOnboarding();
  };

  const handleNavigateToSubject = (subjectId: string) => {
    setSelectedSubjectForDetail(subjectId);
    setActiveTab('subjects');
  };

  if (!isOnboarded) {
    return (
      <OnboardingFlow
        subjects={data.subjects}
        initialStates={studentStates}
        onSave={handleOnboardingSave}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased selection:bg-emerald-200 selection:text-emerald-900">
      {/* Mobile-first centered frame container */}
      <div className="max-w-md mx-auto sm:max-w-xl min-h-screen flex flex-col relative bg-white border-x border-slate-200 shadow-sm">
        <Header
          semesterName={data.metadata.semester}
          overallMetrics={overallMetrics}
          onQuickReset={resetData}
          onRefresh={() => {
            // Recalculates metrics and syncs state
          }}
        />

        <main className="flex-1 p-4 sm:p-5 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'today' && (
              <motion.div
                key="today"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <TodayTab
                  overallMetrics={overallMetrics}
                  todaySessions={todaySessions}
                  subjectMetricsMap={subjectMetricsMap}
                  currentDate={currentDate}
                  threshold={threshold}
                  todayMarks={todayMarks}
                  onMarkTodaySession={markTodaySession}
                  onNavigateToSubject={handleNavigateToSubject}
                  onNavigateToForecast={() => setActiveTab('forecast')}
                />
              </motion.div>
            )}

            {activeTab === 'subjects' && (
              <motion.div
                key="subjects"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <SubjectsTab
                  subjectMetricsList={subjectMetricsList}
                  threshold={threshold}
                  selectedSubjectId={selectedSubjectForDetail}
                  onSelectSubject={setSelectedSubjectForDetail}
                  onUpdateSubjectState={updateSubjectState}
                />
              </motion.div>
            )}

            {activeTab === 'forecast' && (
              <motion.div
                key="forecast"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <ForecastTab
                  subjects={data.subjects}
                  scheduleMap={data.subjectSchedule}
                  rawCalendar={data.rawCalendar}
                  subjectMetricsList={subjectMetricsList}
                  currentDate={currentDate}
                  threshold={threshold}
                />
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <ProfileTab
                  metadata={data.metadata}
                  subjects={data.subjects}
                  studentStates={studentStates}
                  subjectMetricsList={subjectMetricsList}
                  threshold={threshold}
                  onUpdateSubjectState={updateSubjectState}
                  onUpdateThreshold={updateThreshold}
                  onResetData={resetData}
                  onExportData={exportData}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}
