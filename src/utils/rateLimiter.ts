export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  label: string;
}

export const MODEL_LIMITS: { [modelId: string]: RateLimitConfig } = {
  kaze: { limit: 100, windowMs: 1 * 60 * 60 * 1000, label: '1 hour' },
  amabie: { limit: 50, windowMs: 1 * 60 * 60 * 1000, label: '1 hour' },
  kodama: { limit: 10, windowMs: 5 * 60 * 60 * 1000, label: '5 hours' }
};

function getStorageKey(modelId: string): string {
  return `polarith_message_timestamps_v1_${modelId}`;
}

export function getMessageTimestamps(modelId: string): number[] {
  try {
    const data = localStorage.getItem(getStorageKey(modelId));
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'number');
    }
  } catch (e) {
    console.error(`Error parsing rate limit timestamps for ${modelId}:`, e);
  }
  return [];
}

export function saveMessageTimestamps(modelId: string, timestamps: number[]): void {
  try {
    localStorage.setItem(getStorageKey(modelId), JSON.stringify(timestamps));
  } catch (e) {
    console.error(`Error saving rate limit timestamps for ${modelId}:`, e);
  }
}

/**
 * Clean up timestamps older than the model's rate limit window and return active ones.
 */
export function getActiveTimestamps(modelId: string): number[] {
  const now = Date.now();
  const config = MODEL_LIMITS[modelId] || MODEL_LIMITS.kodama;
  const cutoff = now - config.windowMs;
  const timestamps = getMessageTimestamps(modelId);
  
  const active = timestamps.filter(ts => ts > cutoff);
  
  if (active.length !== timestamps.length) {
    saveMessageTimestamps(modelId, active);
  }
  
  return active;
}

/**
 * Checks if the user can send a message using the specified model.
 */
export function canSendMessage(modelId: string): boolean {
  const active = getActiveTimestamps(modelId);
  const config = MODEL_LIMITS[modelId] || MODEL_LIMITS.kodama;
  return active.length < config.limit;
}

/**
 * Registers a sent message by storing its timestamp for the specified model.
 * Returns the updated active count.
 */
export function registerMessage(modelId: string): number {
  const active = getActiveTimestamps(modelId);
  const now = Date.now();
  active.push(now);
  saveMessageTimestamps(modelId, active);
  return active.length;
}

/**
 * Returns the epoch timestamp when the user will be able to send their next message,
 * assuming they have hit the limit.
 */
export function getNextResetTime(modelId: string): number | null {
  const active = getActiveTimestamps(modelId);
  if (active.length === 0) return null;
  
  const config = MODEL_LIMITS[modelId] || MODEL_LIMITS.kodama;
  const sorted = [...active].sort((a, b) => a - b);
  const oldest = sorted[0];
  
  return oldest + config.windowMs;
}

/**
 * Gets the current limit state for the specified model.
 */
export function getRateLimitState(modelId: string = 'kodama') {
  const active = getActiveTimestamps(modelId);
  const config = MODEL_LIMITS[modelId] || MODEL_LIMITS.kodama;
  const isBlocked = active.length >= config.limit;
  const resetTime = isBlocked ? getNextResetTime(modelId) : null;
  
  return {
    remaining: Math.max(0, config.limit - active.length),
    limit: config.limit,
    windowHours: config.windowMs / (60 * 60 * 1000),
    resetTime,
    isBlocked
  };
}
