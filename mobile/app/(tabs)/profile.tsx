import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

export default function Profile() {
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
});
