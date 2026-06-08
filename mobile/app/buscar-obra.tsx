import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { checkInternetConnection, getLocalObras, saveLocalObras, type LocalObra } from '../lib/offline-sync';
import { isAdminOrSupervisor } from '../lib/profile-rules';

// Campos enxutos para a busca — evita trazer os JSONB pesados (fotos/checklist) só para listar.
const LEAN_FIELDS = 'id,obra,equipe,tipo_servico,responsavel,status,created_at';
const MAX_RESULTS = 50;

interface ObraGroup {
  numero: string;
  equipe: string;
  tipo_servico: string;
  responsavel: string;
  status: string;
  count: number;
  createdAt: string;
}

/** Mapeia uma linha do Supabase para o formato salvo no cache local (mesma forma usada na sincronização). */
const toLocalObra = (obra: any): LocalObra => ({
  ...obra,
  id: obra.id,
  synced: true,
  locallyModified: false,
  serverId: obra.id,
  origem: 'online',
  last_modified: obra.updated_at || obra.created_at,
  created_at: obra.created_at,
}) as LocalObra;

/** Agrupa linhas de obra por numero (uma obra pode ter varias linhas/servicos). */
const agruparPorNumero = (rows: any[]): ObraGroup[] => {
  const grupos = new Map<string, ObraGroup>();
  for (const row of rows) {
    const numero = String(row.obra || '').trim();
    if (!numero) continue;
    const existente = grupos.get(numero);
    if (existente) {
      existente.count += 1;
      continue;
    }
    grupos.set(numero, {
      numero,
      equipe: String(row.equipe || ''),
      tipo_servico: String(row.tipo_servico || ''),
      responsavel: String(row.responsavel || ''),
      status: String(row.status || ''),
      count: 1,
      createdAt: row.created_at || '',
    });
  }
  return Array.from(grupos.values());
};

export default function BuscarObra() {
  const router = useRouter();
  const [equipe, setEquipe] = useState('');
  const [role, setRole] = useState('equipe');
  const [termo, setTermo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [puxandoNumero, setPuxandoNumero] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ObraGroup[]>([]);
  const [jaBuscou, setJaBuscou] = useState(false);

  useEffect(() => {
    (async () => {
      const eq = (await AsyncStorage.getItem('@equipe_logada')) || '';
      const r = (await AsyncStorage.getItem('@user_role')) || 'equipe';
      setEquipe(eq);
      setRole(r);
    })();
  }, []);

  const buscar = useCallback(async () => {
    const term = termo.trim();
    if (!term) return;
    Keyboard.dismiss();

    setBuscando(true);
    setJaBuscou(true);
    try {
      const online = await checkInternetConnection();

      if (!online) {
        // OFFLINE: busca no cache local de obras ja baixadas.
        const termLower = term.toLowerCase();
        const locais = await getLocalObras();
        const filtradas = locais.filter((o) => {
          if (!isAdminOrSupervisor(role) && o.equipe !== equipe) return false;
          return String(o.obra || '').toLowerCase().includes(termLower);
        });
        setResultados(agruparPorNumero(filtradas));
        return;
      }

      let query = supabase.from('obras').select(LEAN_FIELDS);
      if (!isAdminOrSupervisor(role)) {
        query = query.eq('equipe', equipe);
      }
      query = query.ilike('obra', `%${term}%`).order('created_at', { ascending: false }).limit(MAX_RESULTS);

      const { data, error } = await query;
      if (error) {
        Alert.alert('Erro na busca', error.message);
        setResultados([]);
        return;
      }

      setResultados(agruparPorNumero((data || []) as any[]));
    } catch (err) {
      Alert.alert('Erro na busca', err instanceof Error ? err.message : String(err));
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, [termo, equipe, role]);

  const puxarObra = useCallback(async (grupo: ObraGroup) => {
    const online = await checkInternetConnection();
    setPuxandoNumero(grupo.numero);
    try {
      if (!online) {
        // OFFLINE: a obra ja deve estar no cache local (a busca veio de la). So abre.
        const locais = await getLocalObras();
        const existe = locais.some(
          (o) =>
            String(o.obra || '').trim() === grupo.numero &&
            (isAdminOrSupervisor(role) || o.equipe === equipe)
        );
        if (!existe) {
          Alert.alert(
            'Indisponível offline',
            'Esta obra não está salva no dispositivo. Conecte-se à internet para baixá-la.'
          );
          return;
        }
        router.replace({ pathname: '/obra-books', params: { obraNumero: grupo.numero } });
        return;
      }

      // Puxa todas as linhas completas daquele número (todos os serviços/books).
      let query = supabase.from('obras').select('*').eq('obra', grupo.numero);
      if (!isAdminOrSupervisor(role)) {
        query = query.eq('equipe', equipe);
      }
      const { data, error } = await query;
      if (error) {
        Alert.alert('Erro ao puxar obra', error.message);
        return;
      }
      if (!data || data.length === 0) {
        Alert.alert('Obra não encontrada', 'Não foi possível carregar os dados desta obra.');
        return;
      }

      // Mescla no cache local sem duplicar (substitui linhas com o mesmo id).
      const locais = await getLocalObras();
      const porId = new Map(locais.map((o) => [o.id, o]));
      for (const row of data as any[]) {
        porId.set(row.id, toLocalObra(row));
      }
      await saveLocalObras(Array.from(porId.values()));

      router.replace({ pathname: '/obra-books', params: { obraNumero: grupo.numero } });
    } catch (err) {
      Alert.alert('Erro ao puxar obra', err instanceof Error ? err.message : String(err));
    } finally {
      setPuxandoNumero(null);
    }
  }, [equipe, role, router]);

  const renderItem = useCallback(({ item }: { item: ObraGroup }) => {
    const carregando = puxandoNumero === item.numero;
    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => puxarObra(item)}
        disabled={!!puxandoNumero}
        activeOpacity={0.7}
      >
        <View style={styles.resultInfo}>
          <Text style={styles.resultNumero}>Obra {item.numero}</Text>
          <Text style={styles.resultMeta} numberOfLines={1}>
            {[item.equipe, item.responsavel].filter(Boolean).join(' • ') || '—'}
          </Text>
          <Text style={styles.resultMetaSecundaria} numberOfLines={1}>
            {item.count > 1 ? `${item.count} serviços` : (item.tipo_servico || '1 serviço')}
          </Text>
        </View>
        {carregando ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : (
          <Text style={styles.resultPuxar}>Puxar ›</Text>
        )}
      </TouchableOpacity>
    );
  }, [puxarObra, puxandoNumero]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backButtonText}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Buscar obra</Text>
        <Text style={styles.subtitle}>
          Digite o número da obra para abri-la e dar continuidade. Online busca no servidor; offline busca nas obras já salvas no aparelho.
        </Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Número da obra"
          value={termo}
          onChangeText={setTermo}
          autoCorrect={false}
          autoCapitalize="characters"
          returnKeyType="search"
          onSubmitEditing={buscar}
        />
        <TouchableOpacity
          style={[styles.searchButton, (buscando || !termo.trim()) && styles.searchButtonDisabled]}
          onPress={buscar}
          disabled={buscando || !termo.trim()}
        >
          {buscando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.searchButtonText}>Buscar</Text>}
        </TouchableOpacity>
      </View>

      <FlatList
        data={resultados}
        keyExtractor={(item) => item.numero}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          buscando ? null : (
            <View style={styles.emptyCard}>
              {jaBuscou ? (
                <>
                  <Text style={styles.emptyTitle}>Nenhuma obra encontrada</Text>
                  <Text style={styles.emptyText}>Confira o número e tente novamente.</Text>
                </>
              ) : (
                <Text style={styles.emptyText}>Digite o número da obra e toque em Buscar.</Text>
              )}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backButton: { marginBottom: 8 },
  backButtonText: { color: '#1d4ed8', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, borderWidth: 1, borderColor: '#e5e7eb', color: '#111827',
  },
  searchButton: {
    backgroundColor: '#1d4ed8', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center',
    minWidth: 88,
  },
  searchButtonDisabled: { backgroundColor: '#9ca3af' },
  searchButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  resultCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e7eb',
  },
  resultInfo: { flex: 1, marginRight: 12 },
  resultNumero: { fontSize: 16, fontWeight: '700', color: '#111827' },
  resultMeta: { fontSize: 13, color: '#374151', marginTop: 2 },
  resultMetaSecundaria: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  resultPuxar: { color: '#1d4ed8', fontWeight: '700', fontSize: 15 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center', marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});
