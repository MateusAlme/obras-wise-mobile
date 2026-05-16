type LogModule =
  | 'photos'
  | 'sync'
  | 'servico'
  | 'obra'
  | 'storage'
  | 'debug';

const ENABLED_LOGS: Record<LogModule, boolean> = {
  photos: true,
  sync: true,
  servico: true,
  obra: false,
  storage: false,
  debug: true,
};

const isDev = __DEV__;

function print(module: LogModule, emoji: string, label: string, ...args: any[]) {
  if (!isDev) return;
  if (!ENABLED_LOGS[module]) return;

  console.log(`${emoji} [${label}]`, ...args);
}

export const logger = {
  photos: (...args: any[]) => print('photos', '📸', 'PHOTOS', ...args),
  sync: (...args: any[]) => print('sync', '☁️', 'SYNC', ...args),
  servico: (...args: any[]) => print('servico', '🧩', 'SERVICO', ...args),
  obra: (...args: any[]) => print('obra', '🏗️', 'OBRA', ...args),
  storage: (...args: any[]) => print('storage', '🗂️', 'STORAGE', ...args),
  debug: (...args: any[]) => print('debug', '🔎', 'DEBUG', ...args),

  warn: (...args: any[]) => {
    if (__DEV__) console.warn('⚠️ [WARN]', ...args);
  },

  error: (...args: any[]) => {
    if (__DEV__) console.error('🔥 [ERROR]', ...args);
  },
};