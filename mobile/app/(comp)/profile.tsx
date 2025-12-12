import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;
const isMediumDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
const isLargeDevice = SCREEN_WIDTH >= 414;

export default function CompProfile() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [loginDate, setLoginDate] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userLogado = await AsyncStorage.getItem('@user_logado');
      const loginTimestamp = await AsyncStorage.getItem('@login_timestamp');

      setUser(userLogado || 'COMP');

      if (loginTimestamp) {
        const date = new Date(loginTimestamp);
        setLoginDate(date.toLocaleDateString('pt-BR'));
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair do aplicativo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                '@equipe_logada',
                '@user_logado',
                '@user_role',
                '@login_timestamp',
                '@cached_credentials',
              ]);
              router.replace('/login');
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
              Alert.alert('Erro', 'Não foi possível sair. Tente novamente.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons
              name="construct"
              size={isSmallDevice ? 40 : 48}
              color="#dc3545"
            />
          </View>
          <Text style={styles.userName}>{user}</Text>
          <Text style={styles.userRole}>Perfil: Compressor</Text>
          <Text style={styles.userService}>Cava em Rocha</Text>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="calendar-outline"
                size={isSmallDevice ? 20 : 24}
                color="#dc3545"
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Login realizado em</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {loginDate || 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={isSmallDevice ? 20 : 24}
                color="#dc3545"
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Tipo de Acesso</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                Exclusivo - Cava em Rocha
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="construct-outline"
                size={isSmallDevice ? 20 : 24}
                color="#dc3545"
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Permissões</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                Lançamento para todas as equipes
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons
              name="log-out-outline"
              size={isSmallDevice ? 20 : 24}
              color="#fff"
            />
            <Text style={styles.logoutButtonText}>Sair do Aplicativo</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Info - Oculto em dispositivos pequenos */}
        {!isSmallDevice && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Obras Wise Mobile</Text>
            <Text style={styles.footerVersion}>Versão 1.0.0</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingVertical: isSmallDevice ? 16 : 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: isSmallDevice ? 20 : isMediumDevice ? 22 : 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: SCREEN_WIDTH * 0.05,
    marginTop: isSmallDevice ? 16 : 20,
    paddingVertical: isSmallDevice ? 20 : 24,
    paddingHorizontal: isSmallDevice ? 16 : 24,
    borderRadius: isSmallDevice ? 12 : 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarContainer: {
    width: isSmallDevice ? 80 : isMediumDevice ? 90 : 100,
    height: isSmallDevice ? 80 : isMediumDevice ? 90 : 100,
    borderRadius: isSmallDevice ? 40 : isMediumDevice ? 45 : 50,
    backgroundColor: '#fff5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isSmallDevice ? 12 : 16,
    borderWidth: 3,
    borderColor: '#dc3545',
  },
  userName: {
    fontSize: isSmallDevice ? 20 : isMediumDevice ? 22 : 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  userRole: {
    fontSize: isSmallDevice ? 14 : 16,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  userService: {
    fontSize: isSmallDevice ? 12 : 14,
    color: '#dc3545',
    fontWeight: '600',
    textAlign: 'center',
  },
  infoSection: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingVertical: isSmallDevice ? 16 : 20,
    gap: isSmallDevice ? 10 : 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmallDevice ? 12 : 16,
    borderRadius: isSmallDevice ? 10 : 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    minHeight: isSmallDevice ? 60 : 72,
  },
  infoIcon: {
    width: isSmallDevice ? 40 : 48,
    height: isSmallDevice ? 40 : 48,
    borderRadius: isSmallDevice ? 20 : 24,
    backgroundColor: '#fff5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: isSmallDevice ? 12 : 16,
    flexShrink: 0,
  },
  infoContent: {
    flex: 1,
    paddingRight: 8,
  },
  infoLabel: {
    fontSize: isSmallDevice ? 11 : 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: isSmallDevice ? 14 : 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flexWrap: 'wrap',
  },
  actionsSection: {
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingTop: isSmallDevice ? 12 : 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isSmallDevice ? 8 : 12,
    backgroundColor: '#dc3545',
    paddingVertical: isSmallDevice ? 14 : 16,
    paddingHorizontal: 16,
    borderRadius: isSmallDevice ? 10 : 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    minHeight: 48,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: isSmallDevice ? 16 : 18,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingVertical: isSmallDevice ? 12 : 16,
    marginTop: isSmallDevice ? 12 : 16,
  },
  footerText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: '#999',
    marginBottom: 4,
    textAlign: 'center',
  },
  footerVersion: {
    fontSize: isSmallDevice ? 11 : 12,
    color: '#ccc',
    textAlign: 'center',
  },
});
