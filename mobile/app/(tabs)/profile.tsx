import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { getStorageStats, cleanupUploadedPhotos } from '../../lib/photo-backup';
import { syncAllPendingObras, checkInternetConnection } from '../../lib/offline-sync';

export default function Profile() {
  const router = useRouter();
  const [equipe, setEquipe] = useState<string>('');
  const [user, setUser] = useState<string>('');
  const [loginDate, setLoginDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Estados para sincronização
  const [syncing, setSyncing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [stats, setStats] = useState({
    totalPhotos: 0,
    pendingPhotos: 0,
    uploadedPhotos: 0,
    totalSize: 0,
    pendingSize: 0,
  });

  useEffect(() => {
    loadUserData();
    loadStats();
  }, []);

  // Recarregar stats quando tela ganhar foco
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats();
    }, 5000); // Atualizar a cada 5 segundos

    return () => clearInterval(interval);
  }, []);

  const loadUserData = async () => {
    try {
      const equipeLogada = await AsyncStorage.getItem('@equipe_logada');
      const userLogado = await AsyncStorage.getItem('@user_logado');
      const loginTimestamp = await AsyncStorage.getItem('@login_timestamp');

      setEquipe(equipeLogada || '');
      setUser(userLogado || '');

      if (loginTimestamp) {
        const date = new Date(loginTimestamp);
        setLoginDate(date.toLocaleDateString('pt-BR'));
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  const loadStats = async () => {
    try {
      const storageStats = await getStorageStats();
      setStats(storageStats);

      // ℹ️ Limpeza de cache agora é automática após sincronização
      // Não precisa mais avisar o usuário
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      console.log('🔄 Iniciando sincronização manual...');

      // Verificar conexão com internet
      const isOnline = await checkInternetConnection();
      if (!isOnline) {
        Alert.alert(
          'Sem Internet',
          'Você precisa estar conectado à internet para sincronizar.'
        );
        return;
      }

      // Sincronizar obras pendentes
      const result = await syncAllPendingObras();

      // Mostrar resultado
      Alert.alert(
        'Sincronização Concluída',
        `✅ ${result.success} obra(s) sincronizada(s)\n` +
        `❌ ${result.failed} falha(s)\n\n` +
        (result.failed === 0
          ? 'Agora você pode limpar o cache com segurança.'
          : 'Algumas obras falharam. Tente sincronizar novamente.')
      );

      // Atualizar estatísticas
      await loadStats();
    } catch (error: any) {
      console.error('❌ Erro ao sincronizar:', error);
      Alert.alert(
        'Erro',
        error.message || 'Erro desconhecido ao sincronizar.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleCleanCache = async () => {
    try {
      // Verificar se há fotos pendentes
      if (stats.pendingPhotos > 0) {
        Alert.alert(
          'Atenção',
          `Ainda existem ${stats.pendingPhotos} foto(s) pendentes de sincronização.\n\n` +
          `Sincronize antes de limpar o cache para não perder dados.`,
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Sincronizar Agora',
              onPress: handleSync,
            },
          ]
        );
        return;
      }

      // Confirmar limpeza
      Alert.alert(
        'Limpar Cache',
        `Isso irá remover ${stats.uploadedPhotos} foto(s) já sincronizada(s) (${formatBytes(stats.totalSize - stats.pendingSize)}).\n\n` +
        `Tem certeza?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Limpar',
            style: 'destructive',
            onPress: async () => {
              try {
                setCleaning(true);
                console.log('🗑️ Limpando cache de fotos sincronizadas...');

                const deletedCount = await cleanupUploadedPhotos();

                Alert.alert(
                  'Cache Limpo',
                  `✅ ${deletedCount} foto(s) removida(s) com sucesso!`
                );

                // Atualizar estatísticas
                await loadStats();
              } catch (error: any) {
                console.error('❌ Erro ao limpar cache:', error);
                Alert.alert('Erro', 'Não foi possível limpar o cache.');
              } finally {
                setCleaning(false);
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Erro ao verificar cache:', error);
      Alert.alert('Erro', 'Não foi possível verificar o cache.');
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      try {
        setLoading(true);
        await AsyncStorage.clear();

        // Usar setTimeout para garantir que o estado é limpo antes da navegação
        setTimeout(() => {
          router.replace('/login' as any);
        }, 100);
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
        if (Platform.OS === 'web') {
          alert('Não foi possível sair. Tente novamente.');
        } else {
          Alert.alert('Erro', 'Não foi possível sair. Tente novamente.');
        }
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Tem certeza que deseja sair?')) {
        await doLogout();
      }
    } else {
      Alert.alert(
        'Sair',
        'Tem certeza que deseja sair?',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Sair',
            style: 'destructive',
            onPress: doLogout,
          },
        ]
      );
    }
  };

  // Função auxiliar para formatar bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {equipe ? equipe.charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
          <Text style={styles.name}>
            {equipe || 'Equipe'}
          </Text>
          <Text style={styles.email}>{user || 'Usuário'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações da Conta</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Equipe</Text>
            <Text style={styles.infoValue}>{equipe || '-'}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Usuário</Text>
            <Text style={styles.infoValue}>
              {user || '-'}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Login realizado em</Text>
            <Text style={styles.infoValue}>
              {loginDate || '-'}
            </Text>
          </View>
        </View>

        {/* Seção de Estatísticas de Cache */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estatísticas de Cache</Text>

          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Fotos em Cache</Text>
              <Text style={styles.statValue}>{stats.totalPhotos}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Pendentes de Sincronização</Text>
              <Text style={[styles.statValue, stats.pendingPhotos > 0 && styles.statPending]}>
                {stats.pendingPhotos}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Já Sincronizadas</Text>
              <Text style={[styles.statValue, styles.statSynced]}>
                {stats.uploadedPhotos}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Tamanho do Cache</Text>
              <Text style={styles.statValue}>{formatBytes(stats.totalSize)}</Text>
            </View>
          </View>

          {/* Aviso informativo sobre sincronização automática */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              A sincronização é feita através do botão em "Obras". O cache é limpo automaticamente após sincronização bem-sucedida.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, loading && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={loading}
        >
          <Text style={styles.logoutButtonText}>
            {loading ? 'Saindo...' : 'Sair da Conta'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.version}>Versão 1.0.0</Text>
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
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#ffe6e6',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#dc3545',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonDisabled: {
    backgroundColor: '#f5a3aa',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 24,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statPending: {
    color: '#ff9800',
  },
  statSynced: {
    color: '#4caf50',
  },
  syncButton: {
    backgroundColor: '#0066cc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  syncButtonDisabled: {
    backgroundColor: '#b3d9ff',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cleanButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  cleanButtonDisabled: {
    backgroundColor: '#fafafa',
    borderColor: '#e8e8e8',
  },
  cleanButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196f3',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#0d47a1',
    lineHeight: 18,
  },
});
