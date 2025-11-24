import React, { useState, useEffect } from 'react';
import { Difficulty, ExamConfig, ExamType } from '../types';
import { Terminal, BookOpen, Code, Zap, BarChart2, Layers, Clock, PlayCircle } from 'lucide-react';

interface SetupFormProps {
  onStart: (config: ExamConfig) => void;
  onResume: () => void;
  onViewProgress: () => void;
  isLoading: boolean;
}

const SetupForm: React.FC<SetupFormProps> = ({ onStart, onResume, onViewProgress, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Intermediate);
  const [examType, setExamType] = useState<ExamType>(ExamType.Mixed);
  const [questionCount, setQuestionCount] = useState(5);
  const [timeLimit, setTimeLimit] = useState(15); // Default 15 mins
  const [hasSavedExam, setHasSavedExam] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('codequest_saved_exam');
    if (saved) {
      setHasSavedExam(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ topic, difficulty, questionCount, examType, timeLimit });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black p-4">
      <div className="w-full max-w-lg bg-slate-900/50 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 mb-4">
            <Terminal size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">CodeQuest AI</h1>
          <p className="text-slate-400">Generate a custom coding contest or exam instantly.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <span className="flex items-center gap-2"><BookOpen size={16}/> Topic / Skill</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Python Lists, SQL Joins, Dynamic Programming"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                 <span className="flex items-center gap-2"><Zap size={16}/> Difficulty</span>
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {Object.values(Difficulty).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                 <span className="flex items-center gap-2"><Layers size={16}/> Type</span>
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {Object.values(ExamType).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          
           <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                   <span className="flex items-center gap-2"><Code size={16}/> Questions</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                   <span className="flex items-center gap-2"><Clock size={16}/> Time Limit</span>
                </label>
                <select
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value={0}>No Time Limit</option>
                  <option value={5}>5 Minutes</option>
                  <option value={10}>10 Minutes</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
            </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
              isLoading 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-indigo-500/25'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              'Start Challenge'
            )}
          </button>
          
          {hasSavedExam && !isLoading && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-lg font-bold text-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 hover:bg-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <PlayCircle size={20} /> Resume Saved Exam
            </button>
          )}

          {!isLoading && (
            <button
              type="button"
              onClick={onViewProgress}
              className="w-full py-3 rounded-lg font-medium text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <BarChart2 size={18} /> View My Progress
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default SetupForm;