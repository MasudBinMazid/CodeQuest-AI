import React, { useState, useEffect, useRef } from 'react';
import { Question, QuestionType, UserAnswer, GradingResult } from '../types';
import { gradeCodeSubmission, generateTestCases } from '../services/geminiService';
import { ChevronLeft, ChevronRight, Play, CheckCircle, Clock, FileCode, Lightbulb, PanelLeftClose, PanelLeftOpen, Hourglass, Save, FlaskConical, RotateCcw, Maximize2, Terminal, ChevronDown, CheckCircle2, Lock } from 'lucide-react';
import { parse } from 'marked';
import Editor, { OnMount } from '@monaco-editor/react';

interface ExamInterfaceProps {
  questions: Question[];
  onComplete: (answers: UserAnswer[], timeSpent: number) => void;
  onSave: (answers: UserAnswer[], timeSpent: number, currentIdx: number) => void;
  topic: string;
  timeLimit: number; // in minutes
  initialAnswers?: UserAnswer[];
  initialTimeSpent?: number;
  initialCurrentIdx?: number;
}

// Helper function to ensure SQL schemas are formatted as tables
// This acts as a fallback if the AI generates a plain list instead of a Markdown table
const preprocessDescription = (question: Question): string => {
  let desc = question.description;
  
  if (question.language === 'sql') {
    // Regex to find table definitions that are NOT already in markdown table format
    // Looks for "Table: Name" or "Table `Name`" followed by a list of columns
    // We avoid matching if we see pipe characters nearby indicating an existing table
    const schemaRegex = /(?:Table|Schema)(?:\s+Name)?:\s*[`']?(\w+)[`']?\s*(?:\(.*\))?\s*\n+((?:(?:\s*[-*•]?\s*\w+.*\n?)+))/gi;

    desc = desc.replace(schemaRegex, (match, tableName, body) => {
      // Check if it's already a table
      if (match.includes('|') || match.includes('+---')) return match;
      
      const lines = body.split('\n').filter((l: string) => l.trim().length > 0);
      // Heuristic: If lines don't look like column definitions, abort
      if (lines.length === 0) return match;

      let tableRows = '';
      let validLines = 0;

      for (const line of lines) {
        const cleanLine = line.trim().replace(/^[-*•]\s*/, '');
        // Match "col_name type description" or "col_name (type) description"
        // 1: Name, 2: Type (optional), 3: Description (optional)
        // This is a loose regex to capture standard SQL text descriptions
        const parts = cleanLine.match(/^(\w+)\s+(?:[:\s]\s*)?([a-zA-Z0-9(),]+)(?:\s+(.*))?$/);
        
        if (parts) {
            validLines++;
            const col = parts[1];
            const type = parts[2] || '-';
            const descText = parts[3] || '';
            tableRows += `| ${col} | ${type} | ${descText} |\n`;
        }
      }
      
      if (validLines < lines.length * 0.5) {
         // If fewer than half the lines matched our column pattern, assume it's just text, not a schema list
         return match; 
      }

      return `\n### Table: ${tableName}\n\n| Column Name | Type | Description |\n| :--- | :--- | :--- |\n${tableRows}\n`;
    });
  }
  return desc;
};

const ExamInterface: React.FC<ExamInterfaceProps> = ({ 
  questions, 
  onComplete, 
  onSave,
  topic, 
  timeLimit,
  initialAnswers,
  initialTimeSpent,
  initialCurrentIdx
}) => {
  const [currentIdx, setCurrentIdx] = useState(initialCurrentIdx || 0);
  const [answers, setAnswers] = useState<Map<string, UserAnswer>>(() => {
    if (initialAnswers) {
      return new Map(initialAnswers.map(a => [a.questionId, a]));
    }
    return new Map();
  });
  
  const [elapsed, setElapsed] = useState(initialTimeSpent || 0);
  const [isGrading, setIsGrading] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Auto-hide sidebar on mobile devices
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024; // lg breakpoint
    }
    return true;
  });
  
  // 'testcase' shows the input data, 'result' shows the output/feedback
  const [activeTab, setActiveTab] = useState<'testcase' | 'result'>('testcase');

  const editorRef = useRef<any>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const currentQuestion = questions[currentIdx];

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => {
        if (timeLimit > 0 && prev >= timeLimit * 60) {
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLimit]);

  useEffect(() => {
    if (timeLimit > 0 && elapsed >= timeLimit * 60) {
      setTimeout(() => {
        handleSubmitAll();
      }, 0);
    }
  }, [elapsed, timeLimit]);

  // Reset active tab when switching questions
  useEffect(() => {
    const ans = answers.get(questions[currentIdx].id);
    if (ans?.output) {
      setActiveTab('result');
    } else {
      setActiveTab('testcase');
    }
  }, [currentIdx, questions, answers]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerDisplay = () => {
    if (timeLimit === 0) {
      return formatTime(elapsed);
    }
    const remaining = Math.max(0, (timeLimit * 60) - elapsed);
    return formatTime(remaining);
  };

  const handleOptionSelect = (optId: string) => {
    const ans: UserAnswer = {
      questionId: currentQuestion.id,
      selectedOptionId: optId
    };
    const newAnswers = new Map(answers).set(currentQuestion.id, ans);
    setAnswers(newAnswers);
  };

  const handleCodeChange = (code: string) => {
    const existing = answers.get(currentQuestion.id) || { questionId: currentQuestion.id };
    const ans: UserAnswer = { ...existing, code };
    const newAnswers = new Map(answers).set(currentQuestion.id, ans);
    setAnswers(newAnswers);
  };

  const handleRunCode = async () => {
    if (editorRef.current) {
      // Trigger auto-format
      await editorRef.current.getAction('editor.action.formatDocument').run();
    }

    // Get value from editor after format
    const userCode = editorRef.current ? editorRef.current.getValue() : (answers.get(currentQuestion.id)?.code || '');
    
    if (!userCode.trim()) return;

    setIsGrading(true);
    setActiveTab('result'); // Switch to result tab to show loading/output

    const result: GradingResult = await gradeCodeSubmission(currentQuestion, userCode);
    
    const existing = answers.get(currentQuestion.id) || { questionId: currentQuestion.id };
    const ans: UserAnswer = {
      ...existing,
      code: userCode,
      isCorrect: result.passed,
      feedback: result.feedback,
      output: result.output
    };
    const newAnswers = new Map(answers).set(currentQuestion.id, ans);
    setAnswers(newAnswers);
    setIsGrading(false);
  };

  const handleResetCode = () => {
    if (window.confirm("Are you sure you want to reset your code to the beginning?")) {
        const existing = answers.get(currentQuestion.id) || { questionId: currentQuestion.id };
        const ans: UserAnswer = {
            ...existing,
            code: currentQuestion.startingCode || (currentQuestion.language === 'sql' ? '-- Start your code here' : '# Start your code here')
        };
        const newAnswers = new Map(answers).set(currentQuestion.id, ans);
        setAnswers(newAnswers);
        if (editorRef.current) {
            editorRef.current.setValue(ans.code);
        }
    }
  };

  const handleGenerateTestCases = async () => {
    if (isGeneratingTests) return;
    setIsGeneratingTests(true);
    setActiveTab('testcase');

    const existing = answers.get(currentQuestion.id) || { questionId: currentQuestion.id };
    
    try {
      const cases = await generateTestCases(currentQuestion);
      const formattedInput = cases.map((c, i) => `Case ${i+1}:\n${c}`).join('\n\n');
      
      const ans: UserAnswer = {
        ...existing,
        testInput: formattedInput
      };
      const newAnswers = new Map(answers).set(currentQuestion.id, ans);
      setAnswers(newAnswers);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingTests(false);
    }
  };

  const handleSubmitAll = () => {
    onComplete(Array.from(answersRef.current.values()), elapsed);
  };

  const handleSave = () => {
    onSave(Array.from(answersRef.current.values()), elapsed, currentIdx);
  };

  const toggleHint = () => {
    const newSet = new Set(hintsRevealed);
    if (newSet.has(currentQuestion.id)) {
      newSet.delete(currentQuestion.id);
    } else {
      newSet.add(currentQuestion.id);
    }
    setHintsRevealed(newSet);
  };

  const isAnswered = (qId: string) => {
    const a = answers.get(qId);
    if (!a) return false;
    return a.selectedOptionId !== undefined || (a.code !== undefined && a.code.length > 5);
  };

  const getEditorValue = () => {
    const ans = answers.get(currentQuestion.id);
    if (ans && ans.code !== undefined) return ans.code;
    
    if (currentQuestion.startingCode) return currentQuestion.startingCode;
    return currentQuestion.language === 'sql' ? '-- Start your code here' : '# Start your code here';
  };

  const isTimeCritical = timeLimit > 0 && (timeLimit * 60 - elapsed) < 300;
  const currentAnswer = answers.get(currentQuestion.id);

  return (
    <div className="flex flex-col h-screen bg-ide-bg text-ide-fg font-sans overflow-hidden">
      <header className="h-14 bg-ide-sidebar border-b border-gray-700 flex items-center justify-between px-2 sm:px-4 shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded hover:bg-gray-800 relative"
            title={isSidebarOpen ? "Collapse Question List" : "Expand Question List"}
          >
             {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
             <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
               {Array.from(answers.values()).filter(a => a.selectedOptionId || (a.code && a.code.length > 10)).length}
             </span>
          </button>
          <span className="font-bold text-white text-base sm:text-lg tracking-tight">CodeQuest</span>
          <span className="hidden sm:inline bg-gray-800 text-xs px-2 py-1 rounded text-gray-400 border border-gray-700">{topic}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 sm:gap-2 text-gray-400 hover:text-white transition-colors p-1.5"
            title="Save progress and exit to menu"
          >
            <Save size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="hidden md:inline text-sm font-medium">Save & Exit</span>
          </button>
          
          <div className="hidden sm:block h-6 w-px bg-gray-700 mx-2"></div>

          <div className={`flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-mono ${isTimeCritical ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
            {timeLimit === 0 ? <Clock size={14} className="sm:w-4 sm:h-4" /> : <Hourglass size={14} className="sm:w-4 sm:h-4" />}
            {getTimerDisplay()}
          </div>
          <button
            onClick={handleSubmitAll}
            className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-lg shadow-green-900/20"
          >
            <span className="hidden sm:inline">Submit Exam</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside 
          className={`bg-ide-sidebar border-r border-gray-700 flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            isSidebarOpen ? 'w-48 sm:w-56 md:w-64 opacity-100' : 'w-0 opacity-0 border-none'
          }`}
        >
          <div className="w-48 sm:w-56 md:w-64 flex flex-col h-full">
            <div className="p-3 sm:p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Questions</div>
            <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded text-sm flex items-center justify-between group transition-all whitespace-nowrap ${
                    currentIdx === idx 
                      ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500' 
                      : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {q.type === QuestionType.CODE ? <FileCode size={14}/> : <CheckCircle size={14}/>}
                    <span className="truncate">{idx + 1}. {q.title}</span>
                  </div>
                  {isAnswered(q.id) && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Question Description Panel */}
          <div className={`flex-1 flex flex-col border-b lg:border-r lg:border-b-0 border-gray-700 bg-ide-bg overflow-y-auto ${
            currentQuestion.type === QuestionType.CODE ? 'lg:max-w-[45%]' : 'max-w-full'
          }`}>
            <div className="p-4 sm:p-6 lg:p-8 w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    currentQuestion.difficulty === 'Beginner' ? 'bg-green-500/20 text-green-400' :
                    currentQuestion.difficulty === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {currentQuestion.difficulty}
                  </span>
                  <span className="text-xs text-gray-500">
                    {currentQuestion.type === QuestionType.CODE ? `${currentQuestion.language?.toUpperCase()} Challenge` : 'Multiple Choice'}
                  </span>
                </div>
                {currentQuestion.hints && currentQuestion.hints.length > 0 && (
                  <button 
                    onClick={toggleHint}
                    className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    <Lightbulb size={14} />
                    <span className="hidden sm:inline">{hintsRevealed.has(currentQuestion.id) ? 'Hide Hint' : 'Show Hint'}</span>
                    <span className="sm:hidden">Hint</span>
                  </button>
                )}
              </div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">{currentQuestion.title}</h2>
              
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: parse(preprocessDescription(currentQuestion)) as string }}
              />

              {hintsRevealed.has(currentQuestion.id) && currentQuestion.hints && (
                <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <Lightbulb size={20} className="text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-yellow-500 font-bold text-sm mb-1">Hint</h4>
                      <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                        {currentQuestion.hints.map((hint, i) => (
                          <li key={i}>{hint}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {currentQuestion.type === QuestionType.MCQ && (
                <div className="space-y-3">
                  {currentQuestion.options?.map((opt) => {
                     const isSelected = answers.get(currentQuestion.id)?.selectedOptionId === opt.id;
                     return (
                      <button
                        key={opt.id}
                        onClick={() => handleOptionSelect(opt.id)}
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-500'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white"/>}
                          </div>
                          {opt.text}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="mt-8 sm:mt-12 flex items-center justify-between pt-4 sm:pt-6 border-t border-gray-800">
                <button 
                  onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                  className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 hover:text-white disabled:opacity-50"
                >
                  <ChevronLeft size={16}/> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
                </button>
                <button 
                  onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
                  disabled={currentIdx === questions.length - 1}
                  className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 hover:text-white disabled:opacity-50"
                >
                  Next <ChevronRight size={16}/>
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Editor & Test Results */}
          {currentQuestion.type === QuestionType.CODE && (
            <div className="flex-1 flex flex-col bg-[#1e1e1e] min-h-[50vh] lg:min-h-0">
              
              {/* Minimal Editor Header */}
              <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-[#333] bg-[#1e1e1e]">
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-1 text-sm font-medium text-gray-300 bg-[#2d2d2d] px-2 py-1 rounded cursor-pointer hover:bg-[#3d3d3d] transition-colors">
                      <span className="text-green-400 font-bold">{currentQuestion.language === 'sql' ? 'SQL' : 'Python'}</span>
                      <ChevronDown size={12} className="text-gray-500" />
                   </div>
                   <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Lock size={12} /> Auto
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <button onClick={handleResetCode} className="text-gray-500 hover:text-white transition-colors" title="Reset Code">
                      <RotateCcw size={15} />
                   </button>
                   <button className="text-gray-500 hover:text-white transition-colors" title="Fullscreen">
                       <Maximize2 size={15} />
                   </button>
                </div>
              </div>
              
              {/* Editor Area */}
              <div className="flex-1 relative overflow-hidden">
                <Editor
                  height="100%"
                  language={currentQuestion.language || 'python'}
                  value={getEditorValue()}
                  theme="vs-dark"
                  onMount={handleEditorDidMount}
                  onChange={(value) => handleCodeChange(value || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    readOnly: false,
                    automaticLayout: true,
                    padding: { top: 16 },
                    wordWrap: 'on',
                    tabSize: 4,
                    // Completely disable all IntelliSense and suggestions
                    quickSuggestions: false,
                    suggestOnTriggerCharacters: false,
                    suggest: { showWords: false, showSnippets: false },
                    parameterHints: { enabled: false },
                    snippetSuggestions: "none",
                    wordBasedSuggestions: "off",
                    hover: { enabled: false },
                    codeLens: false,
                    lightbulb: { enabled: false },
                    inlayHints: { enabled: "off" },
                    links: false,
                    contextmenu: false,
                    occurrencesHighlight: "off",
                    selectionHighlight: false,
                    acceptSuggestionOnEnter: "off",
                    tabCompletion: "off",
                    renderValidationDecorations: 'on',
                    bracketPairColorization: { enabled: true },
                    fontFamily: "'JetBrains Mono', monospace",
                    // Additional settings to ensure clean editor
                    acceptSuggestionOnCommitCharacter: false,
                    autoClosingBrackets: "never",
                    autoClosingQuotes: "never",
                    autoSurround: "never",
                    formatOnPaste: false,
                    formatOnType: false
                  }}
                  loading={<div className="text-gray-500 p-4">Loading Editor...</div>}
                />
              </div>

              {/* Bottom Panel (Tabs) */}
              <div className="h-[35%] sm:h-[40%] flex flex-col border-t border-[#333] bg-[#1e1e1e]">
                {/* Tabs Header */}
                <div className="flex items-center gap-1 px-2 pt-2 border-b border-[#333] bg-[#1e1e1e] select-none overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('testcase')}
                    className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-t-lg transition-colors relative top-[1px] whitespace-nowrap ${
                      activeTab === 'testcase' 
                        ? 'bg-[#1e1e1e] text-white border-b-2 border-green-500' 
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <div className={`p-0.5 rounded ${activeTab === 'testcase' ? 'bg-green-900/50 text-green-500' : 'text-gray-500'}`}>
                      <CheckCircle2 size={14} />
                    </div>
                    <span className="hidden sm:inline">Testcase</span>
                    <span className="sm:hidden">Tests</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('result')}
                    className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-t-lg transition-colors relative top-[1px] whitespace-nowrap ${
                      activeTab === 'result' 
                        ? 'bg-[#1e1e1e] text-white border-b-2 border-green-500' 
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <div className={`p-0.5 rounded ${activeTab === 'result' ? 'bg-green-900/50 text-green-500' : 'text-gray-500'}`}>
                      <Terminal size={14} />
                    </div>
                    <span className="hidden sm:inline">Test Result</span>
                    <span className="sm:hidden">Result</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto p-2 sm:p-4 font-mono text-xs sm:text-sm">
                  {activeTab === 'testcase' ? (
                    <div className="h-full">
                       {currentAnswer?.testInput ? (
                          <div className="space-y-4">
                             <pre className="text-gray-300 whitespace-pre-wrap font-mono bg-[#252526] p-4 rounded-md border border-[#333]">{currentAnswer.testInput}</pre>
                             <div className="flex justify-end">
                                <button onClick={handleGenerateTestCases} disabled={isGeneratingTests} className="text-xs text-gray-500 hover:text-gray-300 underline">
                                  {isGeneratingTests ? 'Regenerating...' : 'Regenerate Test Cases'}
                                </button>
                             </div>
                          </div>
                       ) : (
                          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                             <FlaskConical size={32} className="opacity-20" />
                             <p>No test cases generated yet.</p>
                             <button
                               onClick={handleGenerateTestCases}
                               disabled={isGeneratingTests}
                               className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white rounded border border-[#444] text-sm transition-all flex items-center gap-2"
                             >
                                {isGeneratingTests ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <FlaskConical size={14}/>}
                                Generate Test Cases
                             </button>
                          </div>
                       )}
                    </div>
                  ) : (
                    <div className="h-full">
                      {isGrading ? (
                         <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                            <div className="w-8 h-8 border-4 border-gray-600 border-t-green-500 rounded-full animate-spin"/>
                            <p className="animate-pulse">Running your code...</p>
                         </div>
                      ) : currentAnswer?.output ? (
                        <div className="space-y-4">
                          <div className={`flex items-center gap-2 font-bold ${currentAnswer.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                            {currentAnswer.isCorrect ? <CheckCircle size={18} /> : <div className="text-red-500 font-bold text-lg">×</div>}
                            {currentAnswer.isCorrect ? 'Accepted' : 'Wrong Answer'}
                          </div>
                          
                          <div className="bg-[#252526] p-4 rounded-md border border-[#333] space-y-2">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Output</div>
                            <pre className="text-gray-300 whitespace-pre-wrap font-mono">{currentAnswer.output}</pre>
                          </div>

                          {currentAnswer.feedback && (
                            <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-md">
                               <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-2">
                                  <Lightbulb size={12}/> AI Feedback
                               </div>
                               <p className="text-blue-200/80">{currentAnswer.feedback}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                           <Play size={32} className="opacity-20" />
                           <p>Run your code to see results.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Editor Footer Actions */}
              <div className="px-2 sm:px-4 py-2 sm:py-3 bg-[#1e1e1e] border-t border-[#333] flex items-center justify-between">
                  <button className="text-gray-500 hover:text-gray-300 text-xs sm:text-sm flex items-center gap-1 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-gray-600"></div> <span className="hidden sm:inline">Console</span>
                  </button>
                  <div className="flex gap-2">
                      <button 
                        onClick={handleRunCode}
                        disabled={isGrading}
                        className="bg-[#333] hover:bg-[#444] text-white px-3 sm:px-5 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors border border-[#444] flex items-center gap-2"
                      >
                         <Play size={14} className={isGrading ? 'hidden' : ''} />
                         {isGrading ? 'Running...' : 'Run'}
                      </button>
                      <button 
                        onClick={handleRunCode}
                        disabled={isGrading}
                        className="bg-green-700 hover:bg-green-600 text-white px-3 sm:px-5 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-lg shadow-green-900/20"
                      >
                        Submit
                      </button>
                  </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ExamInterface;