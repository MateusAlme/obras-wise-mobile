import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

export default function CompProfile() {
  const router = useRouter();
  const [equipe, setEquipe] = useState<string>('');
  const [user, setUser] = useState<string>('');
  const [loginDate, setLoginDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const equipeLogada = await AsyncStorage.getItem('@equipe_logada');
      const userLogado = await AsyncStorage.getItem('@user_logado');
      const loginTimestamp = await AsyncStorage.getItem('@login_timestamp');

      setEquipe(equipeLogada || 'Compressor');
      setUser(userLogado || 'Compressor');

      if (loginTimestamp) {
        const date = new Date(loginTimestamp);
        setLoginDate(date.toLocaleDateString('pt-BR'));
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await AsyncStorage.multiRemove([
              '@equipe_logada',
              '@user_logado',
              '@user_role',
              '@session_token',
              '@session_expires_at',
              '@login_timestamp',
              '@cached_credentials',
            ]);
            router.replace('/login');
          } catch (error) {
            console.error('Erro ao fazer logout:', error);
            Alert.alert('Erro', 'Não foi possível sair. Tente novamente.');
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{(equipe || 'C').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{equipe || 'Compressor'}</Text>
          <Text style={styles.email}>{user || 'Compressor'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações da Conta</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Equipe da sessão</Text>
            <Text style={styles.infoValue}>{equipe || 'Compressor'}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Perfil</Text>
            <Text style={styles.infoValue}>Compressor</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Serviço permitido</Text>
            <Text style={styles.infoValue}>Cava em Rocha</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Login realizado em</Text>
            <Text style={styles.infoValue}>{loginDate || '-'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regras do Perfil</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              O compressor inicia e finaliza o book de Cava em Rocha sem vincular equipe executora.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, loading && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={loading}
        >
          <Text style={styles.logoutButtonText}>{loading ? 'Saindo...' : 'Sair da Conta'}</Text>
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
  infoBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffe08a',
  },
  infoText: {
    fontSize: 14,
    color: '#7a5300',
    lineHeight: 20,
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
});
