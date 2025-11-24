import React, { useEffect, useRef } from 'react';
import { UserAnswer, Question, QuestionType, HistoryItem, ExamConfig } from '../types';
import { CheckCircle, XCircle, Award, RotateCcw, BarChart2, BookOpen, Clock, Timer } from 'lucide-react';

interface ResultsViewProps {
  questions: Question[];
  answers: UserAnswer[];
  config: ExamConfig;
  timeSpent: number; // in seconds
  onRestart: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ questions, answers, config, timeSpent, onRestart }) => {
  const hasSavedRef = useRef(false);

  // Simple grading logic for MCQs (Code is already graded or marked pending)
  let score = 0;
  const gradedAnswers = answers.map(ans => {
    const q = questions.find(q => q.id === ans.questionId);
    if (!q) return ans;

    let isCorrect = false;
    if (q.type === QuestionType.MCQ) {
      isCorrect = ans.selectedOptionId === q.correctOptionId;
    } else {
      isCorrect = !!ans.isCorrect;
    }

    if (isCorrect) score += 1;
    return { ...ans, isCorrect };
  });

  const percentage = Math.round((score / questions.length) * 100);

  useEffect(() => {
    if (hasSavedRef.current) return;

    // Save result to localStorage
    const historyItem: HistoryItem = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      topic: config.topic,
      difficulty: config.difficulty,
      score: score,
      totalQuestions: questions.length,
      percentage: percentage,
      timeSpent: timeSpent
    };

    const existingHistory = JSON.parse(localStorage.getItem('codequest_history') || '[]');
    localStorage.setItem('codequest_history', JSON.stringify([historyItem, ...existingHistory]));
    hasSavedRef.current = true;
  }, [score, questions.length, config, percentage, timeSpent]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-full shadow-lg shadow-indigo-500/30 mb-6">
            <Award size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Assessment Complete</h1>
          <p className="text-slate-400">Here is your performance breakdown</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl flex flex-col items-center justify-center">
            <span className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Total Score</span>
            <span className="text-3xl font-bold text-white">{score} <span className="text-lg text-slate-500">/ {questions.length}</span></span>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl flex flex-col items-center justify-center">
            <span className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Percentage</span>
            <span className={`text-3xl font-bold ${percentage >= 70 ? 'text-green-400' : percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {percentage}%
            </span>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl flex flex-col items-center justify-center">
             <span className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Time Used</span>
             <span className="text-3xl font-bold text-blue-400 flex items-center gap-2">
               <Clock size={20} className="opacity-50" /> {formatDuration(timeSpent)}
             </span>
             {config.timeLimit > 0 && <span className="text-xs text-slate-500 mt-1">Limit: {config.timeLimit}m</span>}
          </div>
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl flex flex-col items-center justify-center">
            <span className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Rating</span>
            <span className="text-2xl font-bold text-indigo-400">
              {percentage >= 90 ? 'Expert' : percentage >= 70 ? 'Proficient' : percentage >= 50 ? 'Developing' : 'Novice'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <BarChart2 size={20}/> Detailed Analysis
          </h2>
          {questions.map((q, idx) => {
            const ans = gradedAnswers.find(a => a.questionId === q.id);
            const isCorrect = ans?.isCorrect;

            return (
              <div key={q.id} className={`bg-slate-800 border ${isCorrect ? 'border-green-900/50' : 'border-red-900/50'} rounded-lg p-6`}>
                <div className="flex items-start gap-4">
                  <div className={`mt-1 shrink-0 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                    {isCorrect ? <CheckCircle size={24} /> : <XCircle size={24} />}
                  </div>
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-500">Q{idx + 1} • {q.type}</span>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-4">{q.title}</h3>
                    
                    {q.type === QuestionType.MCQ && (
                       <div className="space-y-2">
                         {q.options?.map(opt => {
                           const isSelected = ans?.selectedOptionId === opt.id;
                           const isCorrectOption = opt.id === q.correctOptionId;
                           
                           let styles = "border-gray-700 opacity-50"; // Default dim
                           
                           if (isCorrectOption) {
                             styles = "border-green-500 bg-green-900/20 opacity-100 ring-1 ring-green-500/50";
                           } else if (isSelected && !isCorrectOption) {
                             styles = "border-red-500 bg-red-900/20 opacity-100 ring-1 ring-red-500/50";
                           } else if (isSelected) {
                              styles = "border-green-500 bg-green-900/20 opacity-100"; // Should be covered by first if, but purely safe fallback
                           }
                           
                           return (
                              <div key={opt.id} className={`p-3 rounded border flex items-center justify-between transition-all ${styles}`}>
                                 <span className="text-sm text-slate-200">{opt.text}</span>
                                 {isCorrectOption && <span className="text-xs text-green-400 font-bold flex items-center gap-1 shrink-0"><CheckCircle size={14}/> Correct</span>}
                                 {isSelected && !isCorrectOption && <span className="text-xs text-red-400 font-bold flex items-center gap-1 shrink-0"><XCircle size={14}/> Your Choice</span>}
                              </div>
                           )
                         })}
                       </div>
                    )}

                    {q.type === QuestionType.CODE && (
                      <div className="mt-4 space-y-4">
                        <div>
                            <div className="text-xs text-slate-500 mb-1">Your Solution:</div>
                            <div className="bg-black/30 rounded p-3 font-mono text-sm text-slate-300 overflow-x-auto border border-slate-700/50">
                            {ans?.code ? ans.code : '// No code submitted'}
                            </div>
                            {ans?.feedback && (
                            <div className="mt-2 text-sm text-blue-300 bg-blue-900/20 p-2 rounded">
                                <span className="font-bold">Feedback:</span> {ans.feedback}
                            </div>
                            )}
                        </div>

                        {q.referenceCode && (
                            <div className="border-t border-slate-700/50 pt-4">
                                <div className="text-xs text-green-500 mb-1 flex items-center gap-1"><BookOpen size={12}/> Reference Solution:</div>
                                <div className="bg-green-900/10 rounded p-3 font-mono text-sm text-green-100 overflow-x-auto border border-green-900/30">
                                    {q.referenceCode}
                                </div>
                            </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center pb-12">
          <button
            onClick={onRestart}
            className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 mx-auto"
          >
            <RotateCcw size={20}/> Start New Challenge
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;