import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureError, addBreadcrumb } from '../lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  resetKey: number;
}

/**
 * Error Boundary para proteger o app de crashes
 *
 * Uso:
 * <ErrorBoundary>
 *   <SeuComponente />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      resetKey: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Atualizar estado para exibir UI de fallback
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Logar erro para debug
    console.error('🚨 ErrorBoundary capturou erro:', error);
    console.error('📊 Informações do erro:', errorInfo);

    // 🔍 Enviar erro para o Sentry
    captureError(error, {
      type: 'other',
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });

    // Adicionar breadcrumb para contexto
    addBreadcrumb('ErrorBoundary capturou erro', 'ui', {
      errorMessage: error.message,
    }, 'error');

    // Salvar erro no AsyncStorage para análise posterior
    this.logErrorToStorage(error, errorInfo);

    // Callback customizado se fornecido
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  private async logErrorToStorage(error: Error, errorInfo: ErrorInfo) {
    // Hardenizado contra OOM: trunca strings grandes e descarta logs antigos
    // se o parse falhar. Nunca pode lançar — esse é o último ponto de defesa.
    const MAX_STACK_BYTES = 2_000;
    const MAX_COMPONENT_STACK_BYTES = 2_000;
    const MAX_TOTAL_LOGS_BYTES = 30_000;

    const truncate = (value: string | null | undefined, max: number): string => {
      if (!value) return '';
      return value.length > max ? `${value.slice(0, max)}…` : value;
    };

    const errorLog = {
      timestamp: new Date().toISOString(),
      message: truncate(error.message, 500),
      stack: truncate(error.stack, MAX_STACK_BYTES),
      componentStack: truncate(errorInfo.componentStack, MAX_COMPONENT_STACK_BYTES),
    };

    let logs: any[] = [];
    try {
      const existingLogs = await AsyncStorage.getItem('@error_logs');
      if (existingLogs) {
        try {
          const parsed = JSON.parse(existingLogs);
          if (Array.isArray(parsed)) logs = parsed;
        } catch {
          // JSON corrompido — descarta logs antigos
          logs = [];
        }
      }
    } catch {
      logs = [];
    }

    logs.push(errorLog);
    let recentLogs = logs.slice(-10);

    // Garante que o payload total caiba em MAX_TOTAL_LOGS_BYTES
    let serialized = '';
    try {
      serialized = JSON.stringify(recentLogs);
      while (serialized.length > MAX_TOTAL_LOGS_BYTES && recentLogs.length > 1) {
        recentLogs = recentLogs.slice(1);
        serialized = JSON.stringify(recentLogs);
      }
    } catch {
      // Stringify falhou (memória apertada) — tenta salvar só o erro atual
      try {
        serialized = JSON.stringify([errorLog]);
      } catch {
        return;
      }
    }

    try {
      await AsyncStorage.setItem('@error_logs', serialized);
    } catch (err) {
      console.error('❌ Falha ao salvar log de erro:', err);
    }
  }

  handleReset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      // UI customizada se fornecida
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI padrão de erro
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>⚠️ Ops! Algo deu errado</Text>
            <Text style={styles.message}>
              Ocorreu um erro inesperado, mas seus dados estão protegidos.
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Detalhes do Erro (Dev Mode):</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.error.stack && (
                  <Text style={styles.stackText}>{this.state.error.stack}</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Tentar Novamente</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Se o problema persistir, tente fechar e reabrir o aplicativo.
            </Text>
          </ScrollView>
        </View>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorDetails: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#d32f2f',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  stackText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});
