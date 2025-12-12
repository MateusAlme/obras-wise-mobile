import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hiuagpzaelcocyxutgdt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdWFncHphZWxjb2N5eHV0Z2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDE1ODAsImV4cCI6MjA3NzMxNzU4MH0.sEp1yx9p_RGPWUIQ1bzE2aYx1YdPiKHFZJ-GnG4a-N8';

// Função para obter equipe logada
const getEquipeLogada = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('@equipe_logada');
  } catch {
    return null;
  }
};

// Função para obter role do usuário
const getUserRole = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('@user_role');
  } catch {
    return null;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: async () => {
      const equipe = await getEquipeLogada();
      const role = await getUserRole();

      const headers: Record<string, string> = {};
      if (equipe) headers['x-equipe'] = equipe;
      if (role) headers['x-role'] = role;

      return headers;
    },
  },
});
