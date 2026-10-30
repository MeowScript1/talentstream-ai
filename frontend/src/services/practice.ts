import api from '@/services/api';

export interface PracticeQuestion {
  question: string;
  why: string;
  tip: string;
}

export interface PracticeQuestions {
  /** 'ai' = written for this role; 'general' = a standard list shown when the AI isn't available */
  source: 'ai' | 'general';
  questions: PracticeQuestion[];
}

export interface PracticeFeedback {
  went_well: string[];
  improve: string[];
  stronger_answer: string;
}

export async function fetchPracticeQuestions(role: string): Promise<PracticeQuestions> {
  return (await api.post<PracticeQuestions>('/practice/questions', { role })).data;
}

export async function fetchPracticeFeedback(role: string, question: string, answer: string): Promise<PracticeFeedback> {
  return (await api.post<PracticeFeedback>('/practice/feedback', { role, question, answer })).data;
}
