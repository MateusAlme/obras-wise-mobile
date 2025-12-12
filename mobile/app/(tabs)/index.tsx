import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import {
  checkInternetConnection,
  getPendingObras,
  syncAllPendingObras,
  startAutoSync,
} from '../../lib/offline-sync';
import type { PendingObra } from '../../lib/offline-sync';

export default function Dashboard() {
  const router = useRouter();
  const [totalObras, setTotalObras] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingObras, setPendingObras] = useState<PendingObra[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingPending, setSyncingPending] = useState(false);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  useEffect(() => {
    loadPendingObras();
  }, []);

  useEffect(() => {
    let isMounted = true;

    checkInternetConnection().then(online => {
      if (isMounted) {
        setIsOnline(online);
      }
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable === true;
      setIsOnline(online);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = startAutoSync(async result => {
      if (result.success > 0 || result.failed > 0) {
        await loadPendingObras();
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const carregarEstatisticas = async () => {
    try {
      // Login por equipe - não precisa verificar supabase.auth
      // Carrega todas as obras (filtro por equipe é feito via RLS)
      const { count, error } = await supabase
        .from('obras')
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        setTotalObras(count);
      }
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingObras = async () => {
    try {
      const obras = await getPendingObras();
      setPendingObras(obras);
    } catch (error) {
      console.error('Erro ao carregar pendencias:', error);
    }
  };

  const handleSyncPendingObras = async () => {
    if (pendingObras.length === 0) return;

    setSyncingPending(true);
    try {
      const result = await syncAllPendingObras();
      await loadPendingObras();

      if (result.success === 0 && result.failed === 0) {
        Alert.alert('Sem conexao', 'Precisamos de internet para enviar as obras.');
        return;
      }

      if (result.failed > 0) {
        Alert.alert('Aten�ʣo', `${result.failed} obra(s) ainda estao na fila. Tente novamente.`);
      } else {
        Alert.alert('Pronto!', `${result.success} obra(s) sincronizadas.`);
      }
    } catch (error) {
      console.error('Erro ao sincronizar pendencias:', error);
      Alert.alert('Erro', 'Nao foi possivel sincronizar agora. Tente novamente.');
    } finally {
      setSyncingPending(false);
    }
  };

  const pendingMessage = isOnline
    ? pendingObras.length > 0
      ? `${pendingObras.length} obra(s) aguardando sincronizacao`
      : 'Tudo sincronizado'
    : 'Cadastros ficam guardados e sincronizam assim que voltar a conexao';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.statusCard,
            isOnline ? styles.statusCardOnline : styles.statusCardOffline,
          ]}
        >
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isOnline ? styles.statusDotOnline : styles.statusDotOffline,
              ]}
            />
            <View style={styles.statusTexts}>
              <Text style={styles.statusTitle}>
                {isOnline ? 'Voce esta online' : 'Modo offline'}
              </Text>
              <Text style={styles.statusSubtitle}>{pendingMessage}</Text>
            </View>
          </View>

          {pendingObras.length > 0 && (
            <TouchableOpacity
              style={[
                styles.statusButton,
                (!isOnline || syncingPending) && styles.statusButtonDisabled,
              ]}
              onPress={handleSyncPendingObras}
              disabled={!isOnline || syncingPending}
            >
              {syncingPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.statusButtonText}>Sincronizar agora</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Bem-vindo ao Obras Teccel</Text>

        {/* Botão Principal - Nova Obra */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/nova-obra')}
        >
          <View style={styles.primaryButtonContent}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>+</Text>
            </View>
            <Text style={styles.primaryButtonText}>Iniciar Nova Obra</Text>
          </View>
        </TouchableOpacity>

        {/* Card Unificado - Obras */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏗️ Obras Cadastradas</Text>
          <Text style={styles.statsNumber}>{totalObras}</Text>
          <Text style={styles.cardText}>
            {totalObras === 0
              ? 'Nenhuma obra cadastrada ainda'
              : `${totalObras} obra${totalObras > 1 ? 's' : ''} registrada${totalObras > 1 ? 's' : ''} no sistema`
            }
          </Text>
        </View>

        {/* Botão Histórico */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)/obras')}
        >
          <Text style={styles.secondaryButtonText}>
            📋 Ver Histórico Completo
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#dc3545',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#dc3545',
    lineHeight: 32,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#dc3545',
  },
  secondaryButtonText: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  statsNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginVertical: 12,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ececec',
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  statusCardOnline: {
    backgroundColor: '#f1f8e9',
    borderColor: '#dcedc8',
  },
  statusCardOffline: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffe0b2',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  statusDotOnline: {
    backgroundColor: '#2e7d32',
  },
  statusDotOffline: {
    backgroundColor: '#ff6f00',
  },
  statusTexts: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#4a4a4a',
    marginTop: 2,
    lineHeight: 18,
  },
  statusButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statusButtonDisabled: {
    opacity: 0.5,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
