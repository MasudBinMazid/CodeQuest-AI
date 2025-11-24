import React, { useState } from 'react';
import SetupForm from './components/SetupForm';
import ExamInterface from './components/ExamInterface';
import ResultsView from './components/ResultsView';
import ProgressView from './components/ProgressView';
import { generateExamQuestions } from './services/geminiService';
import { AppState, ExamConfig, Question, UserAnswer } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SETUP);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [config, setConfig] = useState<ExamConfig | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);

  // Resume State
  const [initialAnswers, setInitialAnswers] = useState<UserAnswer[]>([]);
  const [initialTimeSpent, setInitialTimeSpent] = useState(0);
  const [initialIdx, setInitialIdx] = useState(0);

  const handleStartExam = async (examConfig: ExamConfig) => {
    setConfig(examConfig);
    setAppState(AppState.LOADING);
    
    // Clear any previous resume state
    setInitialAnswers([]);
    setInitialTimeSpent(0);
    setInitialIdx(0);

    try {
      const generatedQuestions = await generateExamQuestions(
        examConfig.topic, 
        examConfig.difficulty, 
        examConfig.questionCount,
        examConfig.examType
      );
      setQuestions(generatedQuestions);
      setAppState(AppState.EXAM);
    } catch (error) {
      console.error("Error generating questions:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to generate questions: ${errorMessage}\n\nPlease check:\n1. Your API key is valid\n2. You have API quota remaining\n3. The topic is appropriate`);
      setAppState(AppState.SETUP);
    }
  };

  const handleExamComplete = (answers: UserAnswer[], duration: number) => {
    setUserAnswers(answers);
    setTimeSpent(duration);
    setAppState(AppState.RESULTS);
    localStorage.removeItem('codequest_saved_exam'); // Clear saved exam on completion
  };

  const handleSaveExam = (answers: UserAnswer[], timeSpent: number, currentIdx: number) => {
    if (!config) return;
    const savedState = {
      config,
      questions,
      answers,
      timeSpent,
      currentIdx,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('codequest_saved_exam', JSON.stringify(savedState));
    setAppState(AppState.SETUP);
    setConfig(null);
    setQuestions([]);
    setUserAnswers([]);
  };

  const handleResumeExam = () => {
    const saved = localStorage.getItem('codequest_saved_exam');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setConfig(parsed.config);
      setQuestions(parsed.questions);
      setInitialAnswers(parsed.answers);
      setInitialTimeSpent(parsed.timeSpent);
      setInitialIdx(parsed.currentIdx);
      setAppState(AppState.EXAM);
    } catch (e) {
      console.error("Failed to parse saved exam", e);
      alert("Could not resume saved exam. Data might be corrupted.");
    }
  };

  const handleRestart = () => {
    setAppState(AppState.SETUP);
    setQuestions([]);
    setUserAnswers([]);
    setConfig(null);
    setTimeSpent(0);
    setInitialAnswers([]);
    setInitialTimeSpent(0);
    setInitialIdx(0);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {appState === AppState.SETUP && (
        <SetupForm 
          onStart={handleStartExam}
          onResume={handleResumeExam} 
          onViewProgress={() => setAppState(AppState.PROGRESS)}
          isLoading={false} 
        />
      )}

      {appState === AppState.LOADING && (
        <SetupForm 
          onStart={() => {}} 
          onResume={() => {}}
          onViewProgress={() => {}}
          isLoading={true} 
        />
      )}

      {appState === AppState.EXAM && config && (
        <ExamInterface 
          questions={questions} 
          onComplete={handleExamComplete}
          onSave={handleSaveExam}
          topic={config.topic}
          timeLimit={config.timeLimit}
          initialAnswers={initialAnswers}
          initialTimeSpent={initialTimeSpent}
          initialCurrentIdx={initialIdx}
        />
      )}

      {appState === AppState.RESULTS && config && (
        <ResultsView 
          questions={questions} 
          answers={userAnswers} 
          config={config}
          timeSpent={timeSpent}
          onRestart={handleRestart} 
        />
      )}

      {appState === AppState.PROGRESS && (
        <ProgressView 
          onBack={() => setAppState(AppState.SETUP)}
        />
      )}
    </div>
  );
};

export default App;