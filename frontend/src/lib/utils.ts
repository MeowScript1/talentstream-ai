import { isAxiosError } from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shape of FastAPI errors: a string, or validation errors whose msg the backend already labels. */
interface ApiErrorBody {
  detail?: string | { msg?: string }[];
}

/** Pull a readable message out of an API error, falling back to a default. */
export function getApiError(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    const first = Array.isArray(detail) ? detail[0]?.msg : undefined;
    if (first) return first;
  }
  return fallback;
}
