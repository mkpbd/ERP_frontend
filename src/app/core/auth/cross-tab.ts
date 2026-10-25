/**
 * Runs `task` while holding a lock shared by every tab of this origin. The backend treats two concurrent
 * refreshes with the same refresh token as token reuse and revokes the session, so tabs must refresh one
 * at a time. Falls back to running immediately where the Web Locks API is unavailable.
 */
export function withCrossTabLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request(name, task) : task();
}

const CHANNEL = 'erp-auth';
export type AuthBroadcast = 'logout';

/** Tells other tabs about sign-out so they drop their in-memory session too. */
export function createAuthChannel(onMessage: (message: AuthBroadcast) => void): {
  post(message: AuthBroadcast): void;
  close(): void;
} {
  if (typeof BroadcastChannel === 'undefined') return { post: () => undefined, close: () => undefined };
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<AuthBroadcast>) => onMessage(event.data);
  return { post: (message) => channel.postMessage(message), close: () => channel.close() };
}
