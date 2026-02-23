import { useState, useEffect, useRef } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { checkInternetConnection } from '../lib/offline-sync';
import { hashPassword, verifyPassword } from '../lib/crypto-utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [equipe, setEquipe] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          console.error('Erro ao carregar equipes do banco:', error);
          // Fallback para lista em cache ou padrão
          await loadEquipesFromCache();
        } else if (!data || data.length === 0) {
          console.warn('Nenhuma equipe encontrada no banco, usando lista padrão');
          await loadEquipesFromCache();
        } else {
          console.log(`${data.length} equipes carregadas do banco`);
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
          console.log('Equipes disponíveis:', listaFinal.slice(0, 5).join(', '), '...');
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
    const isOnlineNow = await checkInternetConnection();

    try {
      if (isOnlineNow) {
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
            'Erro de Sessão',
            'Login validado, mas o servidor não retornou token de sessão. Atualize o backend e tente novamente.'
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
            'Login offline indisponível',
            'Você precisa fazer login com internet pelo menos uma vez antes de usar o modo offline.'
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
            'Login realizado com credenciais em cache. Conecte-se à internet para sincronizar.',
            [{ text: 'OK', onPress: () => router.replace(targetRoute) }]
          );
        } else {
          Alert.alert(
            'Credenciais incorretas',
            'Equipe ou senha não correspondem às credenciais salvas.'
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
      <View pointerEvents="none" style={styles.bgTopBlob} />
      <View pointerEvents="none" style={styles.bgBottomBlob} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 24}
        style={styles.container}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Image
                source={require('../assets/images/logo_teccel.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Acesso ao sistema</Text>
              <Text style={styles.subtitle}>Sistema de Gestão de Obras</Text>
            </View>

            <View style={styles.formCard}>
              {!isOnline && (
                <View style={styles.offlineBanner}>
                  <Text style={styles.offlineBannerText}>
                    Modo offline ativo. Use credenciais salvas.
                  </Text>
                </View>
              )}

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Equipe</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => {
                      loadEquipes(false);
                      setShowEquipeModal(true);
                    }}
                    disabled={loading}
                  >
                    <Text style={[styles.dropdownButtonText, !equipe && styles.placeholder]}>
                      {equipe || 'Selecione sua equipe'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Senha</Text>
                  <View style={styles.passwordInputWrapper}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Digite a senha da equipe"
                      placeholderTextColor="#8c9ab0"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 150);
                      }}
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowPassword(prev => !prev)}
                      disabled={loading}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={22}
                        color="#6C7A90"
                      />
                    </TouchableOpacity>
                  </View>
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
                  <Text style={styles.modalClose}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalList} contentContainerStyle={{ paddingBottom: 30 }}>
                {loadingEquipes ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color="#D53445" />
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
                        <Text style={styles.checkmark}>OK</Text>
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
    backgroundColor: '#EEF3F8',
  },
  container: {
    flex: 1,
  },
  bgTopBlob: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#E6394650',
    top: -140,
    right: -80,
  },
  bgBottomBlob: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#0A1F4420',
    bottom: -120,
    left: -80,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 28,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  logo: {
    width: 190,
    height: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F2342',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#52627A',
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EAF3',
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#0F2342',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 7,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#42536D',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: '#D4DEEB',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#0F2342',
  },
  passwordInputWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 52,
  },
  passwordToggle: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#D53445',
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#A31D2A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#EDA6AE',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    fontSize: 13,
    color: '#5D6E86',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  dropdownButton: {
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: '#D4DEEB',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#0F2342',
  },
  placeholder: {
    color: '#8C9AB0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 18, 33, 0.48)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F2342',
  },
  modalClose: {
    fontSize: 28,
    color: '#6C7A90',
    fontWeight: '300',
  },
  modalList: {
    maxHeight: 400,
    paddingBottom: 20,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemSelected: {
    backgroundColor: '#FFF5F5',
  },
  modalItemText: {
    fontSize: 16,
    color: '#0F2342',
  },
  modalItemTextSelected: {
    color: '#D53445',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#D53445',
    fontWeight: 'bold',
  },
  offlineBanner: {
    backgroundColor: '#FFF4E7',
    borderColor: '#FFD39A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  offlineBannerText: {
    color: '#8F5808',
    fontSize: 13,
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

