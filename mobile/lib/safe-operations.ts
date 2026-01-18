import { Alert } from 'react-native';

/**
 * Utilitários para operações seguras com tratamento de erros robusto
 * Previne crashes no app durante operações críticas
 */

interface SafeOperationOptions {
  /** Mensagem customizada de erro para o usuário */
  errorMessage?: string;
  /** Se deve mostrar alert em caso de erro */
  showAlert?: boolean;
  /** Valor padrão a retornar em caso de erro */
  defaultValue?: any;
  /** Callback executado em caso de erro */
  onError?: (error: Error) => void;
  /** Se deve logar o erro no console */
  silent?: boolean;
}

/**
 * Executa uma operação assíncrona com tratamento de erro robusto
 *
 * @param operation Função assíncrona a ser executada
 * @param options Opções de tratamento de erro
 * @returns Resultado da operação ou defaultValue em caso de erro
 *
 * @example
 * const result = await safeAsync(
 *   async () => await fetchData(),
 *   { errorMessage: 'Erro ao carregar dados', defaultValue: [] }
 * );
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  options: SafeOperationOptions = {}
): Promise<T | undefined> {
  const {
    errorMessage = 'Ocorreu um erro. Tente novamente.',
    showAlert = true,
    defaultValue,
    onError,
    silent = false,
  } = options;

  try {
    return await operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Logar erro (se não for silent)
    if (!silent) {
      console.error('🚨 safeAsync - Erro capturado:', err.message);
      console.error('📊 Stack:', err.stack);
    }

    // Callback de erro
    if (onError) {
      try {
        onError(err);
      } catch (callbackError) {
        console.error('❌ Erro no callback onError:', callbackError);
      }
    }

    // Mostrar alert se solicitado
    if (showAlert) {
      Alert.alert('Erro', errorMessage);
    }

    return defaultValue;
  }
}

/**
 * Executa uma operação síncrona com tratamento de erro robusto
 *
 * @param operation Função síncrona a ser executada
 * @param options Opções de tratamento de erro
 * @returns Resultado da operação ou defaultValue em caso de erro
 *
 * @example
 * const result = safeSync(
 *   () => JSON.parse(data),
 *   { errorMessage: 'Erro ao processar dados', defaultValue: {} }
 * );
 */
export function safeSync<T>(
  operation: () => T,
  options: SafeOperationOptions = {}
): T | undefined {
  const {
    errorMessage = 'Ocorreu um erro. Tente novamente.',
    showAlert = true,
    defaultValue,
    onError,
    silent = false,
  } = options;

  try {
    return operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Logar erro (se não for silent)
    if (!silent) {
      console.error('🚨 safeSync - Erro capturado:', err.message);
      console.error('📊 Stack:', err.stack);
    }

    // Callback de erro
    if (onError) {
      try {
        onError(err);
      } catch (callbackError) {
        console.error('❌ Erro no callback onError:', callbackError);
      }
    }

    // Mostrar alert se solicitado
    if (showAlert) {
      Alert.alert('Erro', errorMessage);
    }

    return defaultValue;
  }
}

/**
 * Executa múltiplas operações assíncronas em paralelo de forma segura
 * Se uma falhar, as outras continuam executando
 *
 * @param operations Array de funções assíncronas
 * @param options Opções de tratamento de erro
 * @returns Array de resultados (undefined para operações que falharam)
 *
 * @example
 * const [users, posts, comments] = await safeParallel([
 *   () => fetchUsers(),
 *   () => fetchPosts(),
 *   () => fetchComments(),
 * ], { silent: true });
 */
export async function safeParallel<T>(
  operations: (() => Promise<T>)[],
  options: SafeOperationOptions = {}
): Promise<(T | undefined)[]> {
  return Promise.all(
    operations.map(op => safeAsync(op, { ...options, showAlert: false }))
  );
}

/**
 * Tenta executar uma operação com retry automático
 *
 * @param operation Função assíncrona a ser executada
 * @param retries Número máximo de tentativas (padrão: 3)
 * @param delay Delay entre tentativas em ms (padrão: 1000)
 * @param options Opções de tratamento de erro
 * @returns Resultado da operação ou defaultValue após todas as tentativas
 *
 * @example
 * const data = await safeRetry(
 *   async () => await syncData(),
 *   3, // 3 tentativas
 *   2000, // 2 segundos entre tentativas
 *   { errorMessage: 'Falha ao sincronizar após 3 tentativas' }
 * );
 */
export async function safeRetry<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  options: SafeOperationOptions = {}
): Promise<T | undefined> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.warn(`⚠️ Tentativa ${attempt}/${retries} falhou:`, lastError.message);

      // Se não for a última tentativa, aguardar antes de tentar novamente
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Todas as tentativas falharam
  console.error(`❌ Todas as ${retries} tentativas falharam`);

  if (options.onError && lastError) {
    options.onError(lastError);
  }

  if (options.showAlert !== false) {
    Alert.alert(
      'Erro',
      options.errorMessage || `Operação falhou após ${retries} tentativas`
    );
  }

  return options.defaultValue;
}

/**
 * Valida se um valor não é null/undefined e lança erro com mensagem amigável
 *
 * @param value Valor a validar
 * @param fieldName Nome do campo para mensagem de erro
 * @throws Error se o valor for null/undefined
 *
 * @example
 * validateRequired(userId, 'ID do usuário');
 * validateRequired(photoUri, 'URI da foto');
 */
export function validateRequired<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Campo obrigatório ausente: ${fieldName}`);
  }
  return value;
}

/**
 * Valida se um array não está vazio
 *
 * @param array Array a validar
 * @param fieldName Nome do campo para mensagem de erro
 * @throws Error se o array estiver vazio
 */
export function validateNotEmpty<T>(array: T[], fieldName: string): T[] {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error(`${fieldName} não pode estar vazio`);
  }
  return array;
}

/**
 * Valida se uma string não está vazia
 *
 * @param value String a validar
 * @param fieldName Nome do campo para mensagem de erro
 * @throws Error se a string estiver vazia
 */
export function validateNotBlank(value: string, fieldName: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`${fieldName} não pode estar vazio`);
  }
  return value.trim();
}

/**
 * Cria um timeout seguro que não causa crash se cancelado
 *
 * @param callback Função a executar
 * @param delay Delay em ms
 * @returns Função de cancelamento
 */
export function safeTimeout(callback: () => void, delay: number): () => void {
  const timeoutId = setTimeout(() => {
    try {
      callback();
    } catch (error) {
      console.error('🚨 Erro no timeout:', error);
    }
  }, delay);

  return () => clearTimeout(timeoutId);
}

/**
 * Cria um interval seguro que não causa crash
 *
 * @param callback Função a executar
 * @param interval Intervalo em ms
 * @returns Função de cancelamento
 */
export function safeInterval(callback: () => void, interval: number): () => void {
  const intervalId = setInterval(() => {
    try {
      callback();
    } catch (error) {
      console.error('🚨 Erro no interval:', error);
    }
  }, interval);

  return () => clearInterval(intervalId);
}
