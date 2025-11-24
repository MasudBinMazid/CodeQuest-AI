import React, { useEffect, useState } from 'react';
import { HistoryItem } from '../types';
import { ArrowLeft, TrendingUp, Calendar, Trophy, Zap } from 'lucide-react';

interface ProgressViewProps {
  onBack: () => void;
}

const ProgressView: React.FC<ProgressViewProps> = ({ onBack }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('codequest_history');
    if (stored) {
      setHistory(JSON.parse(stored));
    }
  }, []);

  const totalExams = history.length;
  const avgScore = totalExams > 0 
    ? Math.round(history.reduce((acc, curr) => acc + curr.percentage, 0) / totalExams) 
    : 0;
  
  const topScore = totalExams > 0
    ? Math.max(...history.map(h => h.percentage))
    : 0;

  // Prepare data for chart (last 10 attempts)
  const chartData = history.slice(0, 10).reverse();
  
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back to Setup
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="bg-indigo-600/20 p-3 rounded-lg text-indigo-400">
             <TrendingUp size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Your Progress</h1>
            <p className="text-slate-400">Track your coding journey over time</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
             <div className="flex items-center gap-3 mb-2 text-slate-400">
               <Trophy size={18} /> Total Challenges
             </div>
             <div className="text-3xl font-bold text-white">{totalExams}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
             <div className="flex items-center gap-3 mb-2 text-slate-400">
               <Zap size={18} /> Average Score
             </div>
             <div className={`text-3xl font-bold ${avgScore >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>{avgScore}%</div>
          </div>
           <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
             <div className="flex items-center gap-3 mb-2 text-slate-400">
               <TrendingUp size={18} /> Best Performance
             </div>
             <div className="text-3xl font-bold text-indigo-400">{topScore}%</div>
          </div>
        </div>

        {/* Simple SVG Chart */}
        {chartData.length > 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-12">
            <h3 className="text-lg font-semibold mb-6">Recent Performance History</h3>
            <div className="h-64 w-full flex items-end justify-between gap-2">
              {chartData.map((item, idx) => (
                <div key={item.id} className="flex-1 flex flex-col items-center gap-2 group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10">
                    {item.topic} ({item.difficulty}) - {item.percentage}%
                  </div>
                  
                  <div 
                    className={`w-full max-w-[40px] rounded-t transition-all hover:brightness-110 ${
                      item.percentage >= 80 ? 'bg-green-500' : item.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} 
                    style={{ height: `${Math.max(item.percentage, 5)}%` }}
                  ></div>
                  <span className="text-xs text-slate-500 truncate w-full text-center">
                    {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed mb-12">
            <p className="text-slate-400">Complete a challenge to see your stats here!</p>
          </div>
        )}

        {/* Detailed List */}
        <h3 className="text-xl font-bold mb-4">History Log</h3>
        <div className="space-y-3">
          {history.length === 0 && <p className="text-slate-500 italic">No history available.</p>}
          {history.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
              <div>
                <h4 className="font-medium text-white">{item.topic}</h4>
                <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    item.difficulty === 'Beginner' ? 'bg-green-900/30 text-green-400' : 
                    item.difficulty === 'Intermediate' ? 'bg-yellow-900/30 text-yellow-400' : 
                    'bg-red-900/30 text-red-400'
                  }`}>{item.difficulty}</span>
                  <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(item.date).toLocaleString()}</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xl font-bold ${
                  item.percentage >= 70 ? 'text-green-400' : item.percentage >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {item.percentage}%
                </span>
                <div className="text-xs text-slate-500">{item.score}/{item.totalQuestions} Correct</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressView;