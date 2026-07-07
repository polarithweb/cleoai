export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  status?: 'sending' | 'success' | 'error';
  errorMessage?: string;
  image?: string; // base64 data URL
}

export interface RateLimitState {
  remaining: number;
  limit: number;
  windowHours: number;
  resetTime: number | null;
  isBlocked: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  type: 'free' | 'paid';
}
