import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { checkInternetConnection } from '../lib/offline-sync';
import { hashPassword, verifyPassword } from '../lib/crypto-utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login() {
  const router = useRouter();
  const [equipe, setEquipe] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEquipeModal, setShowEquipeModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [loadingEquipes, setLoadingEquipes] = useState(true);

  // Carregar equipes do banco de dados
  useEffect(() => {
    loadEquipes();
    checkInternetConnection().then(setIsOnline);
  }, []);

  async function loadEquipes(showLoading = true) {
    if (showLoading) {
      setLoadingEquipes(true);
    }

    try {
      const isConnected = await checkInternetConnection();

      if (isConnected) {
        // Buscar perfis de login ativos (equipe/admin/compressor)
        const { data, error } = await supabase
          .from('equipe_credenciais')
          .select('equipe_codigo, role')
          .eq('ativo', true);

        if (error) {
          console.error('❌ Erro ao carregar equipes do banco:', error);
          // Fallback para lista em cache ou padrão
          await loadEquipesFromCache();
        } else if (!data || data.length === 0) {
          console.warn('⚠️ Nenhuma equipe encontrada no banco, usando lista padrão');
          await loadEquipesFromCache();
        } else {
          console.log(`✅ ${data.length} equipes carregadas do banco`);
          const roleWeight: Record<string, number> = { admin: 0, compressor: 1, equipe: 2 };
          const equipesComPerfis = data
            .map((item: any) => ({
              codigo: String(item?.equipe_codigo || '').trim(),
              role: String(item?.role || 'equipe').trim().toLowerCase(),
            }))
            .filter(item => item.codigo.length > 0)
            .sort((a, b) => {
              const aWeight = roleWeight[a.role] ?? 99;
              const bWeight = roleWeight[b.role] ?? 99;
              if (aWeight !== bWeight) return aWeight - bWeight;
              return a.codigo.localeCompare(b.codigo);
            })
            .map(item => item.codigo);
          const listaFinal = Array.from(new Set(equipesComPerfis));
          setEquipes(listaFinal);
          console.log('📋 Equipes disponíveis:', listaFinal.slice(0, 5).join(', '), '...');
          // Salvar em cache para uso offline
          await AsyncStorage.setItem('@equipes_cache', JSON.stringify(listaFinal));
        }
      } else {
        // Modo offline - carregar do cache
        await loadEquipesFromCache();
      }
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
      await loadEquipesFromCache();
    } finally {
      setLoadingEquipes(false);
    }
  }

  async function loadEquipesFromCache() {
    try {
      const cached = await AsyncStorage.getItem('@equipes_cache');
      if (cached) {
        setEquipes(JSON.parse(cached));
      } else {
        // Fallback para lista padrão se não houver cache
        setEquipes([
          'ADMIN',
          'COM-CZ',
          'COM-PT',
          'CNT 01', 'CNT 02', 'CNT 03', 'CNT 04', 'CNT 06', 'CNT 07', 'CNT 10', 'CNT 11', 'CNT 12',
          'MNT 01', 'MNT 02', 'MNT 03', 'MNT 04', 'MNT 05', 'MNT 06',
          'LV 01 CJZ', 'LV 02 PTS', 'LV 03 JR PTS',
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar cache de equipes:', error);
      // Última opção: lista hardcoded
      setEquipes([
        'ADMIN',
        'COM-CZ',
        'COM-PT',
        'CNT 01', 'CNT 02', 'CNT 03', 'CNT 04', 'CNT 06', 'CNT 07', 'CNT 10', 'CNT 11', 'CNT 12',
        'MNT 01', 'MNT 02', 'MNT 03', 'MNT 04', 'MNT 05', 'MNT 06',
        'LV 01 CJZ', 'LV 02 PTS', 'LV 03 JR PTS',
      ]);
    }
  }

  const handleLogin = async () => {
    if (!equipe || !password) {
      Alert.alert('Erro', 'Por favor, selecione a equipe e digite a senha');
      return;
    }
    setLoading(true);
    const isOnline = await checkInternetConnection();
    try {
      if (isOnline) {
        // LOGIN ONLINE - Validar com servidor
        const { data, error } = await supabase.rpc('validar_login_equipe', {
          p_equipe_codigo: equipe,
          p_senha: password,
        });
        if (error) {
          console.error('Erro ao validar login:', error);
          Alert.alert('Erro', 'Erro ao validar credenciais. Tente novamente.');
          return;
        }
        const resultado = Array.isArray(data) ? data[0] : data;
        if (!resultado || !resultado.valido) {
          Alert.alert('Erro', 'Equipe ou senha incorretos');
          return;
        }
        const roleFromBackend = resultado?.role || 'equipe';
        const sessionTokenFromBackend = resultado?.session_token || null;
        const sessionExpiresAtFromBackend = resultado?.session_expires_at || null;
        if (!sessionTokenFromBackend) {
          Alert.alert(
            'Erro de Sessao',
            'Login validado, mas o servidor nao retornou token de sessao. Atualize o backend e tente novamente.'
          );
          return;
        }
        const passwordHash = await hashPassword(password);
        await AsyncStorage.setItem('@cached_credentials', JSON.stringify({
          equipe,
          password_hash: passwordHash,
          role: roleFromBackend,
          session_token: sessionTokenFromBackend,
          session_expires_at: sessionExpiresAtFromBackend,
          last_validated: new Date().toISOString(),
        }));
        await AsyncStorage.setItem('@equipe_logada', equipe);
        await AsyncStorage.setItem('@user_logado', equipe);
        await AsyncStorage.setItem('@user_role', roleFromBackend);
        await AsyncStorage.setItem('@equipe_id', resultado.equipe_id);
        await AsyncStorage.setItem('@session_token', sessionTokenFromBackend);
        if (sessionExpiresAtFromBackend) {
          await AsyncStorage.setItem('@session_expires_at', String(sessionExpiresAtFromBackend));
        } else {
          await AsyncStorage.removeItem('@session_expires_at');
        }
        await AsyncStorage.setItem('@login_timestamp', new Date().toISOString());
        console.log('Login online realizado com sucesso! Equipe:', equipe, 'Role:', roleFromBackend);
        router.replace('/(tabs)');
      } else {
        // LOGIN OFFLINE - Validar com cache
        const cachedCredentialsStr = await AsyncStorage.getItem('@cached_credentials');
        if (!cachedCredentialsStr) {
          Alert.alert(
            'Login offline indisponivel',
            'Voce precisa fazer login com internet pelo menos uma vez antes de usar o modo offline.'
          );
          return;
        }
        const cachedCredentials = JSON.parse(cachedCredentialsStr);
        const passwordMatches = await verifyPassword(password, cachedCredentials.password_hash);
        if (cachedCredentials.equipe === equipe && passwordMatches) {
          await AsyncStorage.setItem('@equipe_logada', equipe);
          await AsyncStorage.setItem('@user_logado', equipe);
          await AsyncStorage.setItem('@user_role', cachedCredentials.role || 'equipe');
          if (cachedCredentials.session_token) {
            await AsyncStorage.setItem('@session_token', cachedCredentials.session_token);
          } else {
            await AsyncStorage.removeItem('@session_token');
          }
          if (cachedCredentials.session_expires_at) {
            await AsyncStorage.setItem('@session_expires_at', String(cachedCredentials.session_expires_at));
          } else {
            await AsyncStorage.removeItem('@session_expires_at');
          }
          await AsyncStorage.setItem('@login_timestamp', new Date().toISOString());
          await AsyncStorage.setItem('@login_mode', 'offline');
          console.log('Login offline realizado com sucesso! Equipe:', equipe, 'Role:', cachedCredentials.role);
          const targetRoute = '/(tabs)';
          Alert.alert(
            'Modo Offline',
            'Login realizado com credenciais em cache. Conecte-se a internet para sincronizar.',
            [{ text: 'OK', onPress: () => router.replace(targetRoute) }]
          );
        } else {
          Alert.alert(
            'Credenciais incorretas',
            'Equipe ou senha nao correspondem as credenciais salvas.'
          );
        }
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../assets/images/t_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Sistema de Gestao de Obras</Text>

            {/* Indicador de conectividade */}
            {!isOnline && (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineBannerText}>
                  📡 Modo Offline - Use credenciais salvas
                </Text>
              </View>
            )}
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Equipe</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => {
                  loadEquipes(false); // Recarregar equipes sem mostrar loading
                  setShowEquipeModal(true);
                }}
                disabled={loading}
              >
                <Text style={[styles.dropdownButtonText, !equipe && styles.placeholder]}>
                  {equipe || 'Selecione sua equipe'}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite a senha da equipe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={true}
                editable={!loading}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            Login por equipe. Entre em contato com o administrador para obter ou alterar a senha.
          </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Seleção de Equipe */}
      <Modal
        visible={showEquipeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEquipeModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEquipeModal(false)}
        >
          <View style={styles.modalContent}>
            <Pressable>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Selecione sua Equipe</Text>
                <TouchableOpacity onPress={() => setShowEquipeModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalList} contentContainerStyle={{ paddingBottom: 30 }}>
                {loadingEquipes ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color="#FF0000" />
                    <Text style={styles.modalLoadingText}>Carregando equipes...</Text>
                  </View>
                ) : equipes.length === 0 ? (
                  <View style={styles.modalEmpty}>
                    <Text style={styles.modalEmptyText}>Nenhuma equipe disponível</Text>
                  </View>
                ) : (
                  equipes.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.modalItem,
                        equipe === item && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setEquipe(item);
                      setShowEquipeModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        equipe === item && styles.modalItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {equipe === item && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  logo: {
    width: 200,
    height: 60,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  button: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#f5a3aa',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#666',
  },
  linkBold: {
    color: '#dc3545',
    fontWeight: '600',
  },
  footer: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
  },
  dropdownButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  placeholder: {
    color: '#999',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 40, // Espaço extra para botões de navegação do Android
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    fontWeight: '300',
  },
  modalList: {
    maxHeight: 400,
    paddingBottom: 20, // Espaço extra para scroll até o último item
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemSelected: {
    backgroundColor: '#fff5f5',
  },
  modalItemText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  modalItemTextSelected: {
    color: '#dc3545',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#dc3545',
    fontWeight: 'bold',
  },
  offlineBanner: {
    backgroundColor: '#ff9800',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    width: '100%',
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  modalEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#999',
  },
});



