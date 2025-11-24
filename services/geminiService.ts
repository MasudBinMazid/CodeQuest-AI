import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Difficulty, Question, QuestionType, CodeLanguage, GradingResult, ExamType } from '../types';

const getAiClient = () => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// Schema definitions for structured output
const questionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    type: { type: Type.STRING, enum: [QuestionType.MCQ, QuestionType.CODE] },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    difficulty: { type: Type.STRING, enum: ['Beginner', 'Intermediate', 'Advanced'] },
    options: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING }
        },
        required: ['id', 'text']
      }
    },
    correctOptionId: { type: Type.STRING },
    language: { type: Type.STRING, enum: ['python', 'sql'], nullable: true },
    startingCode: { type: Type.STRING, nullable: true },
    referenceCode: { type: Type.STRING, nullable: true, description: "A correct, working solution code for the problem (for coding questions)." },
    testCases: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
    hints: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }
  },
  required: ['id', 'type', 'title', 'description', 'difficulty']
};

export const generateExamQuestions = async (topic: string, difficulty: Difficulty, count: number, examType: ExamType): Promise<Question[]> => {
  const ai = getAiClient();
  
  const difficultyPrompt = difficulty === Difficulty.Mixed 
    ? "a mix of Beginner, Intermediate, and Advanced difficulty levels" 
    : `${difficulty} difficulty`;

  let typeStrategy = "";
  if (examType === ExamType.MCQ) {
    typeStrategy = "Generate 100% Multiple Choice Questions (MCQ).";
  } else if (examType === ExamType.CODE) {
    typeStrategy = "Generate 100% Coding Challenges (Python or SQL based on the topic).";
  } else {
    typeStrategy = "Mix: Generate roughly 40% Multiple Choice Questions (MCQ) and 60% Coding Challenges (Python or SQL).";
  }

  const prompt = `
    Generate a coding exam/contest about "${topic}".
    Difficulty Strategy: Generate questions with ${difficultyPrompt}.
    Total Questions: ${count}.
    Exam Type Strategy: ${typeStrategy}
    
    IMPORTANT FORMATTING INSTRUCTIONS:
    - The 'description' field MUST be formatted in Markdown.
    - If the question involves a database schema or table (especially for SQL), YOU MUST USE MARKDOWN TABLES to present the schema data clearly.
    - DO NOT use simple lists for schemas. ALWAYS use a proper Markdown table.
      
      Example Schema Format:
      ### Table: Users
      | Column Name | Type | Description |
      | :--- | :--- | :--- |
      | id | INT | Primary Key |
      | name | VARCHAR | User name |

    - Use code blocks for examples.

    REQUIRED FOR CODING CHALLENGES:
    - For SQL: Include a section "### Example Input" with small markdown tables showing sample data for relevant tables.
    - For SQL: Include a section "### Example Output" with a markdown table showing the expected result.
    - For Python: Include "### Example 1", "### Example 2" etc. with clear Input/Output.

    For Coding Challenges:
    - Provide a LeetCode style description in Markdown.
    - Provide 'startingCode' function stub.
    - Provide 'referenceCode' which is the correct solution.
    - Provide 'testCases' descriptions.
    
    For MCQs:
    - Provide 4 options.
    - Provide the 'correctOptionId'.

    CRITICAL: For EVERY question, provide 1-2 helpful 'hints' in the hints array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: questionSchema
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as Question[];
  } catch (error) {
    console.error("Failed to generate exam:", error);
    throw error;
  }
};

export const gradeCodeSubmission = async (question: Question, userCode: string): Promise<GradingResult> => {
  const ai = getAiClient();

  const prompt = `
    Act as a strict Code Judge (Compiler/Runtime).
    
    Question: ${question.description}
    Language: ${question.language}
    
    User Submitted Code:
    \`\`\`${question.language}
    ${userCode}
    \`\`\`
    
    Task:
    1. Analyze the code for syntax errors.
    2. Mentally run the code against the implied test cases of the question.
    3. Determine if it solves the problem correctly.
    4. Provide the simulated output or error message.
    
    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            passed: { type: Type.BOOLEAN, description: "True if code is correct and optimized" },
            score: { type: Type.INTEGER, description: "Score from 0 to 100" },
            output: { type: Type.STRING, description: "Simulated stdout or error log" },
            feedback: { type: Type.STRING, description: "Brief constructive feedback" }
          },
          required: ['passed', 'score', 'output', 'feedback']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No grading response");
    
    return JSON.parse(text) as GradingResult;
  } catch (error) {
    return {
      passed: false,
      score: 0,
      output: "Error connecting to Judge AI.",
      feedback: "System error during grading."
    };
  }
};

export const generateTestCases = async (question: Question): Promise<string[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Generate 3 distinct and diverse test cases for the following coding problem.
    The goal is to help the user test their code.
    
    Language: ${question.language}
    Problem: ${question.description}
    Reference Solution: 
    ${question.referenceCode || "Not provided, infer from description"}
    
    ${question.language === 'sql' 
      ? "Describe 3 distinct data scenarios (rows in tables) and the expected result set for each." 
      : "Provide 3 distinct input/output examples including edge cases (e.g. empty input, large numbers, etc)."}

    Output Format:
    Return a JSON object with a 'testCases' property containing an array of strings. 
    Each string should be a formatted test case description (e.g. "Input: ... \nExpected Output: ...").
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            testCases: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return ["Could not generate test cases."];
    
    const data = JSON.parse(text);
    return data.testCases || ["No test cases returned."];
  } catch (error) {
    console.error("Failed to generate test cases:", error);
    return ["Error generating test cases. Please try again."];
  }
};
