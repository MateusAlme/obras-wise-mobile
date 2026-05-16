/**
 * Configuração do Sentry para Monitoramento de Erros (DESABILITADO)
 *
 * NOTA: O Sentry foi temporariamente desabilitado.
 * Este arquivo exporta funções vazias para manter compatibilidade com o código existente.
 */

/**
 * Inicializa o Sentry (desabilitado)
 */
export const initSentry = () => {
  console.log('🔍 [Sentry] Desabilitado');
};

const NETWORK_ERROR_PATTERNS = [
  'unable to resolve host',
  'no address associated with hostname',
  'network request failed',
  'failed to fetch',
  'failed to connect',
  'network is unreachable',
  'software caused connection abort',
  'connection timed out',
  'timeout',
];

const isExpectedNetworkIssue = (message?: string): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

/**
 * Captura erro manualmente com contexto adicional (apenas console.log)
 */
export const captureError = (
  error: Error,
  context?: {
    type?: 'photo' | 'sync' | 'network' | 'storage' | 'upload' | 'other';
    obraId?: string;
    photoId?: string;
    metadata?: Record<string, any>;
  }
) => {
  const message = error?.message || 'Erro desconhecido';
  const isNetworkIssue = context?.type === 'network' || isExpectedNetworkIssue(message);

  if (isNetworkIssue) {
    console.warn('🟡 [Network]', message, context);
    if (__DEV__) {
      console.warn(error);
    }
    return;
  }

  console.error('🔴 [Error]', message, context);
  if (__DEV__) {
    console.error(error);
  }
};

/**
 * Adiciona breadcrumb (rastro de ação do usuário) - apenas console.log
 */
export const addBreadcrumb = (
  message: string,
  category: 'navigation' | 'user_action' | 'photo' | 'sync' | 'network' | 'ui' | 'storage' | 'upload',
  data?: Record<string, any>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
) => {
  if (__DEV__) {
    console.log(`📍 [Breadcrumb] ${category}: ${message}`, data);
  }
};

/**
 * Define usuário logado para rastreamento (desabilitado)
 */
export const setSentryUser = (user: {
  id: string;
  username?: string;
  email?: string;
  equipe?: string;
}) => {
  // Desabilitado
};

/**
 * Remove usuário ao fazer logout (desabilitado)
 */
export const clearSentryUser = () => {
  // Desabilitado
};

/**
 * Captura mensagem de log - apenas console.log
 */
export const captureMessage = (
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
) => {
  console.log(`📝 [${level.toUpperCase()}]`, message, context);
};

/**
 * Inicia transação de performance (para medir tempo de operações)
 */
export const startTransaction = (
  name: string,
  operation: 'photo.upload' | 'sync.obras' | 'db.query' | 'ui.render' | 'network.request'
) => {
  const startTime = Date.now();
  return {
    finish: () => {
      console.log(`⏱️ [Performance] ${name}: ${Date.now() - startTime}ms`);
    },
  };
};

/**
 * Wrapper para executar código com captura automática de erros
 */
export const withSentry = async <T>(
  fn: () => Promise<T>,
  errorContext?: Parameters<typeof captureError>[1]
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    captureError(error as Error, errorContext);
    throw error;
  }
};

// Exportar objeto vazio para compatibilidade
export const Sentry = {};
