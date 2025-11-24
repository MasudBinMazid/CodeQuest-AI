export enum Difficulty {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
  Mixed = 'Mixed'
}

export enum ExamType {
  Mixed = 'Mixed',
  MCQ = 'MCQ Only',
  CODE = 'Coding Challenge Only'
}

export enum QuestionType {
  MCQ = 'MCQ',
  CODE = 'CODE' // Includes Python, SQL
}

export enum CodeLanguage {
  PYTHON = 'python',
  SQL = 'sql'
}

export interface MCQOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description: string;
  difficulty: Difficulty;
  // Specific to MCQ
  options?: MCQOption[];
  correctOptionId?: string; // Only used internally for grading or revealed at end
  // Specific to Code
  language?: CodeLanguage;
  startingCode?: string;
  referenceCode?: string; // The correct solution code
  testCases?: string[]; // Descriptions of test cases
  hints?: string[];
}

export interface ExamConfig {
  topic: string;
  difficulty: Difficulty;
  questionCount: number;
  examType: ExamType;
  timeLimit: number; // in minutes. 0 implies no limit.
}

export interface UserAnswer {
  questionId: string;
  selectedOptionId?: string; // For MCQ
  code?: string; // For Coding
  isCorrect?: boolean; // Calculated after submission or check
  feedback?: string; // AI Feedback for code
  output?: string; // Execution output
  testInput?: string; // Generated test scenarios displayed in the Testcase tab
}

export interface GradingResult {
  passed: boolean;
  score: number;
  feedback: string;
  output: string;
}

export interface HistoryItem {
  id: string;
  date: string;
  topic: string;
  difficulty: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent: number; // in seconds
}

export enum AppState {
  SETUP,
  LOADING,
  EXAM,
  RESULTS,
  PROGRESS
}