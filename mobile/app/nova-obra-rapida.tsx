import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Modal, ActivityIndicator, Platform, Animated, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { saveObraLocal, getLocalObras } from '../lib/offline-sync';
import { createServico } from '../lib/servico-sync';
import { supabase } from '../lib/supabase';
import { TipoServico } from '../types/servico';
import {
  getAllowedServiceTypesForProfile,
  isCompressorProfile,
  isServiceTypeAllowedForProfile,
  isAdminOrSupervisor,
} from '../lib/profile-rules';

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  red:        '#dc2626',
  redDark:    '#b91c1c',
  redLight:   '#fef2f2',
  redBorder:  '#fecaca',
  slate900:   '#0f172a',
  slate700:   '#334155',
  slate500:   '#64748b',
  slate400:   '#94a3b8',
  slate300:   '#cbd5e1',
  slate200:   '#e2e8f0',
  slate100:   '#f1f5f9',
  slate50:    '#f8fafc',
  white:      '#ffffff',
  green:      '#16a34a',
  greenLight: '#f0fdf4',
  amber:      '#d97706',
  amberLight: '#fffbeb',
};

// ─── Tipos de serviço ─────────────────────────────────────────────────────────
const TIPOS_SERVICO: TipoServico[] = [
  'APR',
  'Abertura e Fechamento de Chave',
  'Altimetria',
  'Bandolamento',
  'Book de Aterramento',
  'Cava em Rocha',
  'Checklist de Fiscalização',
  'Ditais',
  'Documentação',
  'Emenda',
  'Fundação Especial',
  'Instalação do Medidor',
  'Linha Viva',
  'Poda',
  'Registro de Impedimento',
  'Transformador',
  'Vazamento e Limpeza de Transformador',
];

// ─── Helpers de data ──────────────────────────────────────────────────────────
const toIsoDate = (d: Date) => d.toISOString().split('T')[0];

const formatDateBR = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const formatDateShort = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const clampDate = (d: Date): Date => {
  const max = new Date(); max.setDate(max.getDate() + 1);
  return d > max ? max : d;
};

// ─── Validação do número da obra ──────────────────────────────────────────────
const validateObraNumero = (v: string): { ok: boolean; error?: string; warning?: string } => {
  const n = v.trim();
  if (!n) return { ok: false };
  if (!/^\d+$/.test(n)) return { ok: false, error: 'Apenas números são aceitos.' };
  if (n.length === 9) return { ok: false, error: '9 dígitos não é aceito. Use 8 ou 10.' };
  if (n.length !== 8 && n.length !== 10) {
    return { ok: false, error: `${n.length} dígitos. Use exatamente 8 ou 10.` };
  }
  return { ok: true };
};

// ─── Payload mínimo de obra ───────────────────────────────────────────────────
const EMPTY_ARRAYS = {
  fotos_antes: [], fotos_durante: [], fotos_depois: [],
  fotos_abertura: [], fotos_fechamento: [],
  fotos_ditais_abertura: [], fotos_ditais_impedir: [], fotos_ditais_testar: [],
  fotos_ditais_aterrar: [], fotos_ditais_sinalizar: [],
  fotos_aterramento_vala_aberta: [], fotos_aterramento_hastes: [],
  fotos_aterramento_vala_fechada: [], fotos_aterramento_medicao: [],
  fotos_transformador_laudo: [], fotos_transformador_componente_instalado: [],
  fotos_transformador_tombamento_instalado: [], fotos_transformador_tape: [],
  fotos_transformador_placa_instalado: [], fotos_transformador_instalado: [],
  fotos_transformador_antes_retirar: [], fotos_transformador_laudo_retirado: [],
  fotos_transformador_tombamento_retirado: [], fotos_transformador_placa_retirado: [],
  fotos_transformador_conexoes_primarias_instalado: [],
  fotos_transformador_conexoes_secundarias_instalado: [],
  fotos_transformador_conexoes_primarias_retirado: [],
  fotos_transformador_conexoes_secundarias_retirado: [],
  fotos_medidor_padrao: [], fotos_medidor_leitura: [], fotos_medidor_selo_born: [],
  fotos_medidor_selo_caixa: [], fotos_medidor_identificador_fase: [],
  fotos_checklist_croqui: [], fotos_checklist_panoramica_inicial: [],
  fotos_checklist_chede: [], fotos_checklist_aterramento_cerca: [],
  fotos_checklist_padrao_geral: [], fotos_checklist_padrao_interno: [],
  fotos_checklist_panoramica_final: [], fotos_checklist_postes: [],
  fotos_checklist_seccionamentos: [], fotos_checklist_frying: [],
  fotos_checklist_abertura_fechamento_pulo: [],
  fotos_altimetria_lado_fonte: [], fotos_altimetria_medicao_fonte: [],
  fotos_altimetria_lado_carga: [], fotos_altimetria_medicao_carga: [],
  fotos_vazamento_evidencia: [], fotos_vazamento_equipamentos_limpeza: [],
  fotos_vazamento_tombamento_retirado: [], fotos_vazamento_placa_retirado: [],
  fotos_vazamento_tombamento_instalado: [], fotos_vazamento_placa_instalado: [],
  fotos_vazamento_instalacao: [],
  doc_cadastro_medidor: [], doc_laudo_transformador: [], doc_laudo_regulador: [],
  doc_laudo_religador: [], doc_apr: [], doc_fvbt: [],
  doc_termo_desistencia_lpt: [], doc_autorizacao_passagem: [],
  doc_materiais_previsto: [], doc_materiais_realizado: [],
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function NovaObraRapida() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCompactLayout = windowWidth < 390;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [obraNumero, setObraNumero] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [tipoServico, setTipoServico] = useState<TipoServico | ''>('');
  const [equipe, setEquipe] = useState('');
  const [userRole, setUserRole] = useState('equipe');

  const [isAdminUser, setIsAdminUser] = useState(false);
  const [equipeExecutora, setEquipeExecutora] = useState('');
  const [equipesAdmin, setEquipesAdmin] = useState<string[]>([]);
  const [showEquipeModal, setShowEquipeModal] = useState(false);
  const [equipeBusca, setEquipeBusca] = useState('');

  const [showDateModal, setShowDateModal] = useState(false);
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Animação do botão
  const btnScale = useRef(new Animated.Value(1)).current;
  const animPress = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const allowedServiceTypes = useMemo(
    () => getAllowedServiceTypesForProfile(userRole, equipe),
    [userRole, equipe]
  );
  const visibleTiposServico = allowedServiceTypes || TIPOS_SERVICO;

  useEffect(() => {
    const loadSession = async () => {
      const [eq, role] = await Promise.all([
        AsyncStorage.getItem('@equipe_logada'),
        AsyncStorage.getItem('@user_role'),
      ]);
      const nextEquipe = eq || '';
      const nextRole = role || 'equipe';
      setEquipe(nextEquipe);
      setUserRole(nextRole);

      if (isAdminOrSupervisor(nextRole)) {
        setIsAdminUser(true);
        try {
          const cached = await AsyncStorage.getItem('@equipes_cache');
          if (cached) setEquipesAdmin(JSON.parse(cached));
          const { data: equipesData } = await supabase
            .from('equipe_credenciais')
            .select('equipe_codigo')
            .eq('ativo', true);
          if (equipesData && equipesData.length > 0) {
            const lista = Array.from(new Set(
              equipesData.map((x: any) => String(x.equipe_codigo || '').trim()).filter(Boolean)
            )).sort() as string[];
            setEquipesAdmin(lista);
            await AsyncStorage.setItem('@equipes_cache', JSON.stringify(lista));
          }
        } catch { /* usa cache ou lista vazia */ }
      }

      const allowed = getAllowedServiceTypesForProfile(nextRole, nextEquipe);
      if (allowed?.length === 1) {
        setTipoServico(allowed[0]);
      }
    };
    void loadSession();
  }, []);

  // Estado de validação do número
  const validation = validateObraNumero(obraNumero);
  const obraInputBorder = !obraNumero
    ? C.slate200
    : validation.ok
      ? C.green
      : C.red;

  // ── Date picker ──
  const adjustDate = useCallback((field: 'day' | 'month' | 'year', delta: number) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (field === 'day') d.setDate(d.getDate() + delta);
      else if (field === 'month') d.setMonth(d.getMonth() + delta);
      else d.setFullYear(d.getFullYear() + delta);
      return clampDate(d);
    });
  }, []);

  // ── Salvar ──
  const handleSalvar = useCallback(async () => {
    const num = obraNumero.trim();

    if (!num) { Alert.alert('Campo obrigatório', 'Informe o número da obra.'); return; }

    // Validação 8 ou 10 dígitos
    if (!/^\d+$/.test(num)) {
      Alert.alert('Número inválido', 'O número da obra deve conter apenas dígitos numéricos.');
      return;
    }
    if (num.length !== 8 && num.length !== 10) {
      Alert.alert(
        'Número inválido',
        `O número deve ter EXATAMENTE 8 ou 10 dígitos.\n\n✅ Aceito: 12345678 (8) ou 0032401637 (10)\n❌ Atual: ${num.length} dígitos`
      );
      return;
    }

    if (!responsavel.trim()) { Alert.alert('Campo obrigatório', 'Informe o nome do encarregado.'); return; }
    if (isAdminUser && !equipeExecutora) { Alert.alert('Campo obrigatório', 'Selecione a equipe do lançamento.'); return; }
    if (!tipoServico) { Alert.alert('Campo obrigatório', 'Selecione o tipo de serviço.'); return; }
    if (!isServiceTypeAllowedForProfile(tipoServico, userRole, equipe)) {
      Alert.alert('Serviço não permitido', 'Este perfil não pode criar esse tipo de serviço.');
      return;
    }

    // Verificar duplicidade
    try {
      const obrasLocais = await getLocalObras();
      const similar = obrasLocais.find(
        (o) =>
          o.obra?.trim() === num &&
          o.tipo_servico === tipoServico &&
          o.status !== 'finalizada'
      );
      if (similar) {
        Alert.alert(
          'Obra em andamento',
          `Já existe uma obra "${tipoServico}" com o número ${num} em andamento.\n\nAbre essa obra?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Abrir obra',
              onPress: () => router.replace({ pathname: '/obra-books', params: { obraNumero: num } }),
            },
          ]
        );
        return;
      }
    } catch { /* segue sem verificação de duplicidade */ }

    animPress();
    setSaving(true);
    try {
      const obraData: any = {
        obra: num,
        data: toIsoDate(selectedDate),
        responsavel: responsavel.trim(),
        equipe: isAdminUser ? (equipeExecutora || '') : (equipe || ''),
        tipo_servico: tipoServico,
        status: 'rascunho',
        origem: 'offline',
        created_at: new Date().toISOString(),
        creator_role: isCompressorProfile(userRole, equipe) ? 'compressor' : (isAdminOrSupervisor(userRole) ? 'admin' : 'equipe'),
        photos_uploaded: false,
        ...EMPTY_ARRAYS,
      };

      const obraId = await saveObraLocal(obraData);

      // Cria o primeiro serviço com o novo sistema (client_pk = svc_...)
      // para que obra-books abra no novo formulário em vez do legado.
      await createServico(obraId, tipoServico, responsavel.trim(), num);

      router.replace({ pathname: '/obra-books', params: { obraNumero: num } });
    } catch (err) {
      console.error('Erro ao criar obra:', err);
      Alert.alert('Erro', 'Não foi possível criar a obra. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }, [obraNumero, responsavel, tipoServico, selectedDate, equipe, equipeExecutora, isAdminUser, userRole, router]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={C.slate700} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nova Obra</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Hero banner ── */}
        <View style={s.heroBanner}>
          <View style={s.heroIcon}>
            <Ionicons name="construct" size={28} color={C.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Abertura de Obra</Text>
            <Text style={s.heroSub}>Preencha os dados e inicie os serviços</Text>
          </View>
        </View>

        {/* ── Card do formulário ── */}
        <View style={s.card}>

          {/* Data */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              <Ionicons name="calendar" size={13} color={C.slate500} /> {'  '}Data
            </Text>
            <TouchableOpacity style={[s.selectBtn, isCompactLayout && s.selectBtnCompact]} onPress={() => setShowDateModal(true)} activeOpacity={0.75}>
              <View style={s.selectBtnLeft}>
                <View style={[s.selectDot, { backgroundColor: C.red }]} />
                <Text style={s.selectBtnText}>{formatDateShort(selectedDate)}</Text>
              </View>
              <Text style={[s.selectBtnSub, isCompactLayout && s.selectBtnSubCompact]}>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* Número da Obra */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              <Ionicons name="keypad" size={13} color={C.slate500} /> {'  '}Número da Obra
            </Text>
            <View style={[s.inputWrap, { borderColor: obraInputBorder }]}>
              <TextInput
                style={s.textInput}
                placeholder="8 ou 10 dígitos (ex: 12345678)"
                placeholderTextColor={C.slate400}
                value={obraNumero}
                onChangeText={(t) => setObraNumero(t.replace(/\D/g, ''))}
                keyboardType="numeric"
                maxLength={10}
                returnKeyType="next"
              />
              {obraNumero.length > 0 && (
                <Ionicons
                  name={validation.ok ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={validation.ok ? C.green : C.red}
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>
            {!!obraNumero && !validation.ok && !!validation.error && (
              <Text style={s.inputError}>{validation.error}</Text>
            )}
            {validation.ok && (
              <Text style={s.inputOk}>✓ {obraNumero.length} dígitos — válido</Text>
            )}
          </View>

          <View style={s.divider} />

          {/* Encarregado */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              <Ionicons name="person" size={13} color={C.slate500} /> {'  '}Encarregado
            </Text>
            <View style={[s.inputWrap, { borderColor: responsavel ? C.slate200 : C.slate200 }]}>
              <TextInput
                style={s.textInput}
                placeholder="Nome do encarregado"
                placeholderTextColor={C.slate400}
                value={responsavel}
                onChangeText={setResponsavel}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={s.divider} />

          {/* Tipo de Serviço */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              <Ionicons name="layers" size={13} color={C.slate500} /> {'  '}Tipo de Serviço
            </Text>
            <TouchableOpacity
              style={[s.selectBtn, isCompactLayout && s.selectBtnCompact, tipoServico && s.selectBtnFilled]}
              onPress={() => setShowTipoModal(true)}
              activeOpacity={0.75}
            >
              <View style={s.selectBtnLeft}>
                {tipoServico
                  ? <View style={[s.selectDot, { backgroundColor: C.red }]} />
                  : <View style={[s.selectDot, { backgroundColor: C.slate300 }]} />
                }
                <Text style={[s.selectBtnText, !tipoServico && { color: C.slate400 }]}>
                  {tipoServico || 'Selecionar tipo de serviço...'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.slate400} />
            </TouchableOpacity>
          </View>

        </View>

        {/* ── Equipe ── */}
        {isAdminUser ? (
          <View style={[s.card, { marginBottom: 12 }]}>
            <View style={s.fieldGroup}>
              <Text style={s.label}>
                <Ionicons name="people" size={13} color={C.slate500} /> {'  '}Equipe de Lançamento *
              </Text>
              <TouchableOpacity
                style={[s.selectBtn, equipeExecutora && s.selectBtnFilled]}
                onPress={() => setShowEquipeModal(true)}
                activeOpacity={0.75}
              >
                <View style={s.selectBtnLeft}>
                  <View style={[s.selectDot, { backgroundColor: equipeExecutora ? C.red : C.slate300 }]} />
                  <Text style={[s.selectBtnText, !equipeExecutora && { color: C.slate400 }]}>
                    {equipeExecutora || 'Selecionar equipe...'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.slate400} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          !!equipe && (
            <View style={s.equipeChip}>
              <Ionicons name="people" size={14} color={C.slate500} />
              <Text style={s.equipeText}>Equipe: <Text style={{ fontWeight: '700' }}>{equipe}</Text></Text>
            </View>
          )
        )}

        {/* ── Botão Iniciar ── */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.iniciarBtn, saving && s.iniciarBtnDisabled]}
            onPress={handleSalvar}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <>
                <Ionicons name="rocket" size={20} color={C.white} style={{ marginRight: 10 }} />
                <Text style={s.iniciarBtnText}>Iniciar Obra</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <Text style={s.hint}>
          Após iniciar, adicione os serviços da obra na próxima tela.
        </Text>

      </ScrollView>

      {/* ══ Modal: Data ══ */}
      <Modal visible={showDateModal} animationType="slide" transparent statusBarTranslucent>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>

            <View style={s.modalHandle} />

            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Selecionar Data</Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color={C.slate500} />
              </TouchableOpacity>
            </View>

            {/* Preview grande */}
            <View style={s.datePreviewBox}>
              <Text style={s.datePreviewMain}>{formatDateShort(selectedDate)}</Text>
              <Text style={s.datePreviewSub}>{formatDateBR(selectedDate)}</Text>
            </View>

            {/* Controles */}
            {(['day', 'month', 'year'] as const).map((field) => {
              const labels = { day: 'Dia', month: 'Mês', year: 'Ano' };
              const values = {
                day: selectedDate.getDate().toString().padStart(2, '0'),
                month: (selectedDate.getMonth() + 1).toString().padStart(2, '0'),
                year: selectedDate.getFullYear().toString(),
              };
              return (
                <View key={field} style={s.dateRow}>
                  <Text style={s.dateRowLabel}>{labels[field]}</Text>
                  <View style={s.dateRowControls}>
                    <TouchableOpacity style={s.dateControlBtn} onPress={() => adjustDate(field, -1)}>
                      <Ionicons name="remove" size={18} color={C.red} />
                    </TouchableOpacity>
                    <Text style={s.dateControlValue}>{values[field]}</Text>
                    <TouchableOpacity style={s.dateControlBtn} onPress={() => adjustDate(field, 1)}>
                      <Ionicons name="add" size={18} color={C.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={s.modalConfirmBtn} onPress={() => setShowDateModal(false)}>
              <Text style={s.modalConfirmText}>Confirmar</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* ══ Modal: Tipo de Serviço ══ */}
      <Modal visible={showTipoModal} animationType="slide" transparent statusBarTranslucent>
        <View style={s.modalOverlay}>
          <View
            style={[
              s.modalBox,
              {
                maxHeight: Math.min(windowHeight * 0.88, windowHeight - Math.max(insets.top + 56, 84)),
                paddingBottom: Math.max(insets.bottom + 16, 36),
              },
            ]}
          >

            <View style={s.modalHandle} />

            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Tipo de Serviço</Text>
              <TouchableOpacity onPress={() => setShowTipoModal(false)} style={s.modalCloseBtn}>
                <Ionicons name="close" size={20} color={C.slate500} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.tipoList}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 56, 88) }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              keyboardShouldPersistTaps="handled"
            >
              {visibleTiposServico.map((tipo, idx) => {
                const selected = tipoServico === tipo;
                return (
                  <TouchableOpacity
                    key={tipo}
                    style={[
                      s.tipoItem,
                      idx === visibleTiposServico.length - 1 && { borderBottomWidth: 0 },
                      selected && s.tipoItemSelected,
                    ]}
                    onPress={() => { setTipoServico(tipo); setShowTipoModal(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[s.tipoItemDot, selected && { backgroundColor: C.red }]} />
                    <Text style={[s.tipoItemText, selected && s.tipoItemTextSelected]}>{tipo}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={18} color={C.red} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

          </View>
        </View>
      </Modal>

      {/* ══ Modal: Equipe de Lançamento (admin/supervisor) ══ */}
      <Modal
        visible={showEquipeModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => { setShowEquipeModal(false); setEquipeBusca(''); }}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          onPress={() => { setShowEquipeModal(false); setEquipeBusca(''); }}
          activeOpacity={1}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalBox}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Equipe de Lançamento</Text>
              <TouchableOpacity style={s.modalCloseBtn} onPress={() => { setShowEquipeModal(false); setEquipeBusca(''); }}>
                <Ionicons name="close" size={18} color={C.slate700} />
              </TouchableOpacity>
            </View>

            {/* Busca */}
            <View style={s.equipeSearchBox}>
              <Ionicons name="search-outline" size={16} color={C.slate400} />
              <TextInput
                style={s.equipeSearchInput}
                placeholder="Buscar equipe..."
                placeholderTextColor={C.slate400}
                value={equipeBusca}
                onChangeText={setEquipeBusca}
                autoCapitalize="characters"
                returnKeyType="done"
              />
              {equipeBusca.length > 0 && (
                <TouchableOpacity onPress={() => setEquipeBusca('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={C.slate300} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={s.tipoList}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 56, 88) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(() => {
                const busca = equipeBusca.trim().toUpperCase();
                const filtradas = equipesAdmin.filter(e => e.toUpperCase().includes(busca));
                if (filtradas.length === 0) {
                  return (
                    <Text style={{ textAlign: 'center', color: C.slate400, paddingVertical: 24, fontSize: 14 }}>
                      Nenhuma equipe encontrada
                    </Text>
                  );
                }
                const grupos: Record<string, string[]> = {};
                for (const e of filtradas) {
                  const prefixo = (e.match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
                  if (!grupos[prefixo]) grupos[prefixo] = [];
                  grupos[prefixo].push(e);
                }
                return Object.keys(grupos).sort().map((grupo) => (
                  <View key={grupo}>
                    <View style={s.equipeGrupoHeader}>
                      <Text style={s.equipeGrupoLabel}>{grupo}</Text>
                    </View>
                    {grupos[grupo].map((item, idx) => {
                      const selected = equipeExecutora === item;
                      const isLast = idx === grupos[grupo].length - 1;
                      return (
                        <TouchableOpacity
                          key={item}
                          style={[s.tipoItem, isLast && { borderBottomWidth: 0 }, selected && s.tipoItemSelected]}
                          onPress={() => { setEquipeExecutora(item); setShowEquipeModal(false); setEquipeBusca(''); }}
                          activeOpacity={0.7}
                        >
                          <View style={[s.tipoItemDot, selected && s.selectDotRed]} />
                          <Text style={[s.tipoItemText, selected && s.tipoItemTextSelected]}>{item}</Text>
                          {selected && <Ionicons name="checkmark-circle" size={18} color={C.red} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ));
              })()}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.slate50 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.slate200,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.slate900 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  // Hero
  heroBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.white,
    borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.redBorder,
    shadowColor: C.red, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  heroIcon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: C.redLight,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: C.slate900, marginBottom: 2 },
  heroSub: { fontSize: 13, color: C.slate500 },

  // Card
  card: {
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.slate200,
    overflow: 'hidden', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  fieldGroup: { paddingHorizontal: 16, paddingVertical: 14 },
  divider: { height: 1, backgroundColor: C.slate100, marginHorizontal: 16 },

  // Labels
  label: { fontSize: 12, fontWeight: '600', color: C.slate500, marginBottom: 8, letterSpacing: 0.3 },

  // Select button (data e tipo)
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.slate50, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: C.slate200,
  },
  selectBtnCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  selectBtnFilled: { borderColor: C.redBorder, backgroundColor: C.redLight },
  selectBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  selectDot: { width: 8, height: 8, borderRadius: 4 },
  selectBtnText: { fontSize: 15, color: C.slate900, fontWeight: '500', flex: 1 },
  selectBtnSub: { fontSize: 12, color: C.slate400 },
  selectBtnSubCompact: { alignSelf: 'flex-start' },

  // Input texto
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.slate50, borderRadius: 10,
    borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 2,
  },
  textInput: { flex: 1, fontSize: 15, color: C.slate900, paddingVertical: 9 },
  inputError: { fontSize: 12, color: C.red, marginTop: 5, marginLeft: 2 },
  inputOk: { fontSize: 12, color: C.green, marginTop: 5, marginLeft: 2, fontWeight: '600' },

  // Equipe
  equipeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.slate100, borderRadius: 20,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    marginBottom: 20,
  },
  equipeText: { fontSize: 13, color: C.slate500 },

  // Botão iniciar
  iniciarBtn: {
    backgroundColor: C.red, borderRadius: 14,
    paddingVertical: 17, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
    marginBottom: 12,
  },
  iniciarBtnDisabled: { opacity: 0.65 },
  iniciarBtnText: { color: C.white, fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  hint: { textAlign: 'center', fontSize: 12, color: C.slate400 },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: C.slate200, marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.slate900 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center',
  },
  modalConfirmBtn: {
    marginTop: 20, backgroundColor: C.red,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalConfirmText: { color: C.white, fontSize: 16, fontWeight: '700' },

  // Date modal
  datePreviewBox: {
    backgroundColor: C.redLight, borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: C.redBorder,
  },
  datePreviewMain: { fontSize: 22, fontWeight: '800', color: C.red },
  datePreviewSub: { fontSize: 13, color: C.redDark, marginTop: 2 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.slate100,
  },
  dateRowLabel: { fontSize: 14, fontWeight: '600', color: C.slate700, width: 50 },
  dateRowControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateControlBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.redLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.redBorder,
  },
  dateControlValue: { fontSize: 18, fontWeight: '700', color: C.slate900, minWidth: 44, textAlign: 'center' },

  // Tipo modal
  tipoList: {
    flexShrink: 1,
  },
  tipoItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 48,
    paddingVertical: 13, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.slate100,
  },
  tipoItemSelected: {
    backgroundColor: C.redLight, borderRadius: 10,
    paddingHorizontal: 10, marginHorizontal: -4,
  },
  tipoItemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.slate200 },
  tipoItemText: { flex: 1, fontSize: 15, color: C.slate700 },
  tipoItemTextSelected: { color: C.red, fontWeight: '700' },

  // utilidade
  selectDotRed: { backgroundColor: C.red },

  // Equipe search
  equipeSearchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.slate100, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 12,
  },
  equipeSearchInput: {
    flex: 1, fontSize: 14, color: C.slate900, padding: 0,
  },
  equipeGrupoHeader: {
    paddingTop: 14, paddingBottom: 4, paddingHorizontal: 4,
  },
  equipeGrupoLabel: {
    fontSize: 11, fontWeight: '700', color: C.slate400,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
});
