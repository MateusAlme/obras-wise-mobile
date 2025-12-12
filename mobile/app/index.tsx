import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      // Verificar se há login por equipe salvo
      const equipeLogada = await AsyncStorage.getItem('@equipe_logada');
      const userLogado = await AsyncStorage.getItem('@user_logado');
      const userRole = await AsyncStorage.getItem('@user_role');

      if (equipeLogada && userLogado) {
        // Verificar se é usuário COMP
        if (userRole === 'compressor' && equipeLogada === 'COMP') {
          router.replace('/(comp)');
        } else {
          // Usuário está logado via sistema de equipes normal
          router.replace('/(tabs)');
        }
      } else {
        // Não há login salvo, ir para tela de login
        router.replace('/login');
      }
    } catch (error) {
      console.error('Erro ao verificar login:', error);
      router.replace('/login');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
      <ActivityIndicator size="large" color="#0066cc" />
    </View>
  );
}
