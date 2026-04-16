import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, RefreshControl, Modal, Dimensions, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import type { PendingObra } from '../lib/offline-sync';
import { getLocalObraById, forceUpdateObraFromSupabase, syncLocalObra, checkInternetConnection } from '../lib/offline-sync';
import { getPhotosByObraWithFallback, type PhotoMetadata } from '../lib/photo-backup';
import { supabase } from '../lib/supabase';

type FotoInfo = {
  uri?: string;
  url?: string;
  latitude?: number | null;
  longitude?: number | null;
  utmX?: number | null;
  utmY?: number | null;
  utmZone?: string | null;
};

type OnlineObra = {
  id: string;
  data: string;
  created_at: string;
  obra: string;
  responsavel: string;
  equipe: string;
  tipo_servico: string;
  status?: 'em_aberto' | 'rascunho' | 'finalizada';
  finalizada_em?: string | null;
  fotos_antes?: FotoInfo[];
  fotos_durante?: FotoInfo[];
  fotos_depois?: FotoInfo[];
  fotos_abertura?: FotoInfo[];
  fotos_fechamento?: FotoInfo[];
  // DITAIS - 5 fotos
  fotos_ditais_abertura?: FotoInfo[];
  fotos_ditais_impedir?: FotoInfo[];
  fotos_ditais_testar?: FotoInfo[];
  fotos_ditais_aterrar?: FotoInfo[];
  fotos_ditais_sinalizar?: FotoInfo[];
  // BOOK ATERRAMENTO - 4 fotos
  fotos_aterramento_vala_aberta?: FotoInfo[];
  fotos_aterramento_hastes?: FotoInfo[];
  fotos_aterramento_vala_fechada?: FotoInfo[];
  fotos_aterramento_medicao?: FotoInfo[];
  // TRANSFORMADOR
  transformador_status?: string | null;
  fotos_transformador_laudo?: FotoInfo[];
  fotos_transformador_componente_instalado?: FotoInfo[];
  fotos_transformador_tombamento_instalado?: FotoInfo[];
  fotos_transformador_tape?: FotoInfo[];
  fotos_transformador_placa_instalado?: FotoInfo[];
  fotos_transformador_instalado?: FotoInfo[];
  fotos_transformador_conexoes_primarias_instalado?: FotoInfo[];
  fotos_transformador_conexoes_secundarias_instalado?: FotoInfo[];
  fotos_transformador_antes_retirar?: FotoInfo[];
  fotos_transformador_tombamento_retirado?: FotoInfo[];
  fotos_transformador_placa_retirado?: FotoInfo[];
  fotos_transformador_conexoes_primarias_retirado?: FotoInfo[];
  fotos_transformador_conexoes_secundarias_retirado?: FotoInfo[];
  // MEDIDOR - 5 fotos
  fotos_medidor_padrao?: FotoInfo[];
  fotos_medidor_leitura?: FotoInfo[];
  fotos_medidor_selo_born?: FotoInfo[];
  fotos_medidor_selo_caixa?: FotoInfo[];
  fotos_medidor_identificador_fase?: FotoInfo[];
  // CHECKLIST DE FISCALIZAÇÃO
  fotos_checklist_croqui?: FotoInfo[];
  fotos_checklist_panoramica_inicial?: FotoInfo[];
  fotos_checklist_chede?: FotoInfo[];
  fotos_checklist_aterramento_cerca?: FotoInfo[];
  fotos_checklist_padrao_geral?: FotoInfo[];
  fotos_checklist_padrao_interno?: FotoInfo[];
  fotos_checklist_frying?: FotoInfo[];
  fotos_checklist_abertura_fechamento_pulo?: FotoInfo[];
  fotos_checklist_panoramica_final?: FotoInfo[];
  fotos_checklist_postes?: FotoInfo[];
  fotos_checklist_seccionamentos?: FotoInfo[];
  // ALTIMETRIA - 4 fotos
  fotos_altimetria_lado_fonte?: FotoInfo[];
  fotos_altimetria_medicao_fonte?: FotoInfo[];
  fotos_altimetria_lado_carga?: FotoInfo[];
  fotos_altimetria_medicao_carga?: FotoInfo[];
  // VAZAMENTO E LIMPEZA DE TRANSFORMADOR - 7 fotos
  fotos_vazamento_evidencia?: FotoInfo[];
  fotos_vazamento_equipamentos_limpeza?: FotoInfo[];
  fotos_vazamento_tombamento_retirado?: FotoInfo[];
  fotos_vazamento_placa_retirado?: FotoInfo[];
  fotos_vazamento_tombamento_instalado?: FotoInfo[];
  fotos_vazamento_placa_instalado?: FotoInfo[];
  fotos_vazamento_instalacao?: FotoInfo[];
  // DOCUMENTAÇÃO - PDFs
  doc_cadastro_medidor?: FotoInfo[];
  doc_laudo_transformador?: FotoInfo[];
  doc_laudo_regulador?: FotoInfo[];
  doc_laudo_religador?: FotoInfo[];
  doc_apr?: FotoInfo[];
  doc_fvbt?: FotoInfo[];
  doc_termo_desistencia_lpt?: FotoInfo[];
  doc_autorizacao_passagem?: FotoInfo[];
  // POSTES DATA (Cava em Rocha, Linha Viva, etc)
  postes_data?: Array<{
    id: string;
    numero: number;
    fotos_antes: any[];
    fotos_durante: any[];
    fotos_depois: any[];
    fotos_medicao?: any[];
    observacao?: string;
  }>;
  // CHECKLIST DE FISCALIZAÇÃO - Structured Data (aceita strings ou objetos com {id, url})
  checklist_postes_data?: Array<{
    id: string;
    numero: string;
    status: string;
    isAditivo?: boolean;
    posteInteiro: (string | any)[];
    descricao: (string | any)[];
    engaste: (string | any)[];
    conexao1: (string | any)[];
    conexao2: (string | any)[];
    maiorEsforco: (string | any)[];
    menorEsforco: (string | any)[];
  }>;
  checklist_seccionamentos_data?: Array<{
    id: string;
    numero: number;
    tipo?: 'seccionamento' | 'emenda' | 'poda';
    posteInicio?: number | string | null;
    posteFim?: number | string | null;
    poste_inicio?: number | string | null;
    poste_fim?: number | string | null;
    fotos: (string | any)[];
  }>;
  checklist_aterramentos_cerca_data?: Array<{
    id: string;
    numero: number;
    fotos: (string | any)[];
  }>;
  checklist_hastes_termometros_data?: Array<{
    id: string;
    numero: string;
    isAditivo?: boolean;
    fotoHaste: (string | any)[];
    fotoTermometro: (string | any)[];
  }>;
  origem?: 'online';
};

type ObraPayload = (PendingObra & {
  origem?: 'offline';
  status?: 'em_aberto' | 'rascunho' | 'finalizada';
  finalizada_em?: string | null;
  fotos_antes?: FotoInfo[];
  fotos_durante?: FotoInfo[];
  fotos_depois?: FotoInfo[];
  fotos_abertura?: FotoInfo[];
  fotos_fechamento?: FotoInfo[];
  // DITAIS - 5 fotos
  fotos_ditais_abertura?: FotoInfo[];
  fotos_ditais_impedir?: FotoInfo[];
  fotos_ditais_testar?: FotoInfo[];
  fotos_ditais_aterrar?: FotoInfo[];
  fotos_ditais_sinalizar?: FotoInfo[];
  // BOOK ATERRAMENTO - 4 fotos
  fotos_aterramento_vala_aberta?: FotoInfo[];
  fotos_aterramento_hastes?: FotoInfo[];
  fotos_aterramento_vala_fechada?: FotoInfo[];
  fotos_aterramento_medicao?: FotoInfo[];
  // TRANSFORMADOR
  transformador_status?: string | null;
  fotos_transformador_laudo?: FotoInfo[];
  fotos_transformador_componente_instalado?: FotoInfo[];
  fotos_transformador_tombamento_instalado?: FotoInfo[];
  fotos_transformador_tape?: FotoInfo[];
  fotos_transformador_placa_instalado?: FotoInfo[];
  fotos_transformador_instalado?: FotoInfo[];
  fotos_transformador_antes_retirar?: FotoInfo[];
  fotos_transformador_tombamento_retirado?: FotoInfo[];
  fotos_transformador_placa_retirado?: FotoInfo[];
  fotos_transformador_conexoes_primarias_instalado?: FotoInfo[];
  fotos_transformador_conexoes_secundarias_instalado?: FotoInfo[];
  fotos_transformador_conexoes_primarias_retirado?: FotoInfo[];
  fotos_transformador_conexoes_secundarias_retirado?: FotoInfo[];
  // MEDIDOR - 5 fotos
  fotos_medidor_padrao?: FotoInfo[];
  fotos_medidor_leitura?: FotoInfo[];
  fotos_medidor_selo_born?: FotoInfo[];
  fotos_medidor_selo_caixa?: FotoInfo[];
  fotos_medidor_identificador_fase?: FotoInfo[];
  // CHECKLIST DE FISCALIZAÇÃO
  fotos_checklist_croqui?: FotoInfo[];
  fotos_checklist_panoramica_inicial?: FotoInfo[];
  fotos_checklist_chede?: FotoInfo[];
  fotos_checklist_aterramento_cerca?: FotoInfo[];
  fotos_checklist_padrao_geral?: FotoInfo[];
  fotos_checklist_padrao_interno?: FotoInfo[];
  fotos_checklist_frying?: FotoInfo[];
  fotos_checklist_abertura_fechamento_pulo?: FotoInfo[];
  fotos_checklist_panoramica_final?: FotoInfo[];
  fotos_checklist_postes?: FotoInfo[];
  fotos_checklist_seccionamentos?: FotoInfo[];
  // ALTIMETRIA - 4 fotos
  fotos_altimetria_lado_fonte?: FotoInfo[];
  fotos_altimetria_medicao_fonte?: FotoInfo[];
  fotos_altimetria_lado_carga?: FotoInfo[];
  fotos_altimetria_medicao_carga?: FotoInfo[];
  // VAZAMENTO E LIMPEZA DE TRANSFORMADOR - 7 fotos
  fotos_vazamento_evidencia?: FotoInfo[];
  fotos_vazamento_equipamentos_limpeza?: FotoInfo[];
  fotos_vazamento_tombamento_retirado?: FotoInfo[];
  fotos_vazamento_placa_retirado?: FotoInfo[];
  fotos_vazamento_tombamento_instalado?: FotoInfo[];
  fotos_vazamento_placa_instalado?: FotoInfo[];
  fotos_vazamento_instalacao?: FotoInfo[];
  // DOCUMENTAÇÃO - PDFs
  doc_cadastro_medidor?: FotoInfo[];
  doc_laudo_transformador?: FotoInfo[];
  doc_laudo_regulador?: FotoInfo[];
  doc_laudo_religador?: FotoInfo[];
  doc_apr?: FotoInfo[];
  doc_fvbt?: FotoInfo[];
  doc_termo_desistencia_lpt?: FotoInfo[];
  doc_autorizacao_passagem?: FotoInfo[];
  // POSTES DATA (Cava em Rocha, Linha Viva, etc)
  postes_data?: Array<{
    id: string;
    numero: number;
    fotos_antes: any[];
    fotos_durante: any[];
    fotos_depois: any[];
    fotos_medicao?: any[];
    observacao?: string;
  }>;
  // HASTES E TERMÔMETROS DATA (aceita strings ou objetos com {id, url})
  checklist_hastes_termometros_data?: Array<{
    id: string;
    numero: string;
    isAditivo?: boolean;
    fotoHaste: (string | any)[];
    fotoTermometro: (string | any)[];
  }>;
});

type ObraDetalheData = (OnlineObra | ObraPayload) & {
  origem?: 'online' | 'offline';
  sync_status?: PendingObra['sync_status'];
  error_message?: string;
  synced?: boolean;
  serverId?: string;
};

const PHOTO_SECTIONS = [
  // 📋 DOCUMENTAÇÃO OBRIGATÓRIA (aparecem primeiro)
  { key: 'doc_laudo_transformador_servico', label: 'Laudo de Transformador' },
  { key: 'doc_cadastro_medidor_servico', label: 'Cadastro de Medidor' },
  // 📸 FOTOS BÁSICAS
  { key: 'fotos_antes', label: 'Fotos Antes' },
  { key: 'fotos_durante', label: 'Fotos Durante' },
  { key: 'fotos_depois', label: 'Fotos Depois' },
  { key: 'fotos_abertura', label: 'Fotos Abertura Chave' },
  { key: 'fotos_fechamento', label: 'Fotos Fechamento Chave' },
  // DITAIS
  { key: 'fotos_ditais_abertura', label: 'DITAIS - Abertura' },
  { key: 'fotos_ditais_impedir', label: 'DITAIS - Impedir' },
  { key: 'fotos_ditais_testar', label: 'DITAIS - Testar' },
  { key: 'fotos_ditais_aterrar', label: 'DITAIS - Aterrar' },
  { key: 'fotos_ditais_sinalizar', label: 'DITAIS - Sinalizar' },
  // BOOK ATERRAMENTO
  { key: 'fotos_aterramento_vala_aberta', label: 'Book Aterramento - Vala Aberta' },
  { key: 'fotos_aterramento_hastes', label: 'Book Aterramento - Hastes Aplicadas' },
  { key: 'fotos_aterramento_vala_fechada', label: 'Book Aterramento - Vala Fechada' },
  { key: 'fotos_aterramento_medicao', label: 'Book Aterramento - Medição Terrômetro' },
  // TRANSFORMADOR (Instalado)
  { key: 'fotos_transformador_componente_instalado', label: 'Transformador - Componente Instalado' },
  { key: 'fotos_transformador_tombamento_instalado', label: 'Transformador - Tombamento (Instalado)' },
  { key: 'fotos_transformador_tape', label: 'Transformador - Tape' },
  { key: 'fotos_transformador_placa_instalado', label: 'Transformador - Placa (Instalado)' },
  { key: 'fotos_transformador_instalado', label: 'Transformador - Instalado' },
  { key: 'fotos_transformador_conexoes_primarias_instalado', label: 'Transformador - Conexões Primárias (Instalado)' },
  { key: 'fotos_transformador_conexoes_secundarias_instalado', label: 'Transformador - Conexões Secundárias (Instalado)' },
  // TRANSFORMADOR (Retirado)
  { key: 'fotos_transformador_antes_retirar', label: 'Transformador - Antes de Retirar' },
  { key: 'fotos_transformador_tombamento_retirado', label: 'Transformador - Tombamento (Retirado)' },
  { key: 'fotos_transformador_placa_retirado', label: 'Transformador - Placa (Retirado)' },
  { key: 'fotos_transformador_conexoes_primarias_retirado', label: 'Transformador - Conexões Primárias (Retirado)' },
  { key: 'fotos_transformador_conexoes_secundarias_retirado', label: 'Transformador - Conexões Secundárias (Retirado)' },
  { key: 'fotos_medidor_padrao', label: 'Medidor - Padrão c/ Medidor Instalado' },
  { key: 'fotos_medidor_leitura', label: 'Medidor - Leitura c/ Medidor Instalado' },
  { key: 'fotos_medidor_selo_born', label: 'Medidor - Selo do Born do Medidor' },
  { key: 'fotos_medidor_selo_caixa', label: 'Medidor - Selo da Caixa' },
  { key: 'fotos_medidor_identificador_fase', label: 'Medidor - Identificador de Fase' },
  // CHECKLIST DE FISCALIZAÇÃO - Na ordem do formulário
  { key: 'fotos_checklist_croqui', label: '1️⃣ Croqui da Obra' },
  { key: 'fotos_checklist_panoramica_inicial', label: '2️⃣ Panorâmica Inicial' },
  { key: 'fotos_checklist_chede', label: '3️⃣ Chave com Componente' },
  { key: 'fotos_checklist_postes', label: '4️⃣ Registro dos Postes' },
  { key: 'fotos_checklist_seccionamentos', label: '5️⃣ Emenda / 6️⃣ Poda / 7️⃣ Seccionamento' },
  { key: 'fotos_checklist_aterramento_cerca', label: '6️⃣ Aterramento de Cerca' },
  { key: 'fotos_checklist_padrao_geral', label: '7️⃣ Padrão de Ligação - Vista Geral' },
  { key: 'fotos_checklist_padrao_interno', label: '8️⃣ Padrão de Ligação - Interno' },
  { key: 'fotos_checklist_frying', label: '9️⃣ Flying' },
  { key: 'fotos_checklist_abertura_fechamento_pulo', label: '🔟 Abertura e Fechamento de Pulo' },
  { key: 'fotos_checklist_hastes_termometros', label: '1️⃣1️⃣ Hastes Aplicadas e Medição do Termômetro' },
  { key: 'fotos_checklist_panoramica_final', label: '1️⃣2️⃣ Panorâmica Final' },
  { key: 'fotos_altimetria_lado_fonte', label: 'Altimetria - Lado Fonte' },
  { key: 'fotos_altimetria_medicao_fonte', label: 'Altimetria - Medição Fonte' },
  { key: 'fotos_altimetria_lado_carga', label: 'Altimetria - Lado Carga' },
  { key: 'fotos_altimetria_medicao_carga', label: 'Altimetria - Medição Carga' },
  { key: 'fotos_vazamento_evidencia', label: 'Vazamento - Evidência do Vazamento de Óleo' },
  { key: 'fotos_vazamento_equipamentos_limpeza', label: 'Vazamento - Equipamentos de Limpeza' },
  { key: 'fotos_vazamento_tombamento_retirado', label: 'Vazamento - Tombamento Transformador Retirado' },
  { key: 'fotos_vazamento_placa_retirado', label: 'Vazamento - Placa Transformador Retirado' },
  { key: 'fotos_vazamento_tombamento_instalado', label: 'Vazamento - Tombamento Transformador Instalado' },
  { key: 'fotos_vazamento_placa_instalado', label: 'Vazamento - Placa Transformador Instalado' },
  { key: 'fotos_vazamento_instalacao', label: 'Vazamento - Instalação do Transformador' },
  { key: 'doc_apr', label: 'Documentação - APR (Análise Preliminar de Risco)' },
  { key: 'doc_cadastro_medidor', label: 'Documentação - Cadastro de Medidor' },
  { key: 'doc_laudo_transformador', label: 'Documentação - Laudo de Transformador' },
  { key: 'doc_laudo_regulador', label: 'Documentação - Laudo de Regulador' },
  { key: 'doc_laudo_religador', label: 'Documentação - Laudo de Religador' },
  { key: 'doc_fvbt', label: 'Documentação - FVBT (Formulário de Vistoria de Baixa Tensão)' },
  { key: 'doc_termo_desistencia_lpt', label: 'Documentação - Termo de Desistência LPT' },
  { key: 'doc_autorizacao_passagem', label: 'Documentação - Autorização de Passagem' },
  { key: 'doc_materiais_previsto', label: 'Documentação - Materiais Previsto' },
  { key: 'doc_materiais_realizado', label: 'Documentação - Materiais Realizado' },
] as const;

const formatDate = (value?: string) => {
  if (!value) return '-';
  try {
    // Se a data está no formato YYYY-MM-DD, tratamos como data local
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [ano, mes, dia] = value.split('-').map(Number);
      const date = new Date(ano, mes - 1, dia);
      return date.toLocaleDateString('pt-BR');
    }
    // Para outros formatos (ISO com timezone), usa o construtor padrão
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
};

const getPhotoSource = (foto?: FotoInfo) => {
  if (!foto) return null;
  if (foto.url) {
    return { uri: foto.url };
  }
  if (foto.uri) {
    return { uri: foto.uri };
  }
  return null;
};

export default function ObraDetalhe() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data?: string }>();
  const [obra, setObra] = useState<ObraDetalheData | null>(null);
  const [localPhotos, setLocalPhotos] = useState<PhotoMetadata[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<FotoInfo | null>(null);
  const [selectedPhotoSection, setSelectedPhotoSection] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [isSincronizando, setIsSincronizando] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 390;
  const isVerySmallScreen = screenWidth < 350;
  const contentPaddingHorizontal = isSmallScreen ? 14 : 20;
  const actionButtonsStacked = screenWidth < 400;
  const headerPlaceholderWidth = isVerySmallScreen ? 40 : 72;
  const thumbSize = screenWidth < 360 ? 78 : screenWidth < 430 ? 84 : 90;

  // Monitor internet connection
  useEffect(() => {
    let isMounted = true;

    checkInternetConnection().then(online => {
      if (isMounted) {
        setIsOnline(online);
      }
    });

    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable === true;
      setIsOnline(online);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    loadObraData();
  }, [data]);

  // Auto-refresh quando a tela recebe foco (volta da tela de edição)
  useFocusEffect(
    useCallback(() => {
      if (data && obra?.id) {
        refreshObraData();
      }
    }, [data, obra?.id])
  );

  const loadObraData = async () => {
    if (!data) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(data));

      // OFFLINE-FIRST: Sempre buscar do AsyncStorage primeiro
      if (parsed.id) {
        const localObra = await getLocalObraById(parsed.id);

        if (localObra) {
          // Obra encontrada no AsyncStorage (fonte primária)
          console.log('📱 Carregando obra do AsyncStorage:', parsed.id);

          // ✅ AUTO-CORREÇÃO: Se campos críticos estão faltando ou têm URLs locais, buscar do Supabase
          const hasLocalUrls = (data: any): boolean => {
            if (!data || !Array.isArray(data)) return false;
            return data.some((item: any) => {
              if (!item) return false;
              // Verificar todos os campos que são arrays de fotos
              const photoFields = Object.keys(item).filter(key => Array.isArray(item[key]));
              return photoFields.some(field => {
                const photos = item[field];
                return photos.some((photo: any) => {
                  if (typeof photo === 'string') return photo.startsWith('file:///');
                  if (typeof photo === 'object' && photo?.url) return photo.url.startsWith('file:///');
                  return false;
                });
              });
            });
          };

          // Verificar se arrays estruturados estão vazios mas há fotos flat
          const temArraysVazios = (localObra.tipo_servico === 'Checklist de Fiscalização' && (
            (!hasRealPhotos(localObra.checklist_postes_data) && (localObra as any).fotos_checklist_postes?.length > 0) ||
            (!hasRealPhotos(localObra.checklist_seccionamentos_data) && (localObra as any).fotos_checklist_seccionamentos?.length > 0) ||
            (!hasRealPhotos(localObra.checklist_aterramentos_cerca_data) && (localObra as any).fotos_checklist_aterramento_cerca?.length > 0)
          ));

          const precisaCorrecao = !localObra.origem || !localObra.status ||
            temArraysVazios ||
            (localObra.tipo_servico === 'Checklist de Fiscalização' && (
              localObra.checklist_postes_data === undefined ||
              localObra.checklist_seccionamentos_data === undefined ||
              localObra.checklist_aterramentos_cerca_data === undefined ||
              hasLocalUrls(localObra.checklist_postes_data) ||
              hasLocalUrls(localObra.checklist_seccionamentos_data) ||
              hasLocalUrls(localObra.checklist_aterramentos_cerca_data) ||
              hasLocalUrls(localObra.checklist_hastes_termometros_data)
            ));

          const deveAtualizarDoServidor = !!localObra.synced && (precisaCorrecao || isOnline);

          if (deveAtualizarDoServidor) {
            console.log('🔄 Obra sincronizada - atualizando do Supabase para refletir mudanças recentes...');
            // Usar serverId se disponível, caso contrário usar o ID local
            const idParaBuscar = (localObra as any).serverId || parsed.id;
            console.log('🔍 Buscando obra do Supabase com ID:', idParaBuscar);
            const corrigida = await forceUpdateObraFromSupabase(idParaBuscar);

            if (corrigida) {
              console.log('✅ Obra atualizada automaticamente do Supabase');
              // Recarregar obra atualizada
              const obraAtualizada = await getLocalObraById(idParaBuscar);
              if (obraAtualizada) {
                setObra({ ...obraAtualizada, origem: obraAtualizada.origem || 'offline' } as ObraDetalheData);
                loadLocalPhotos(obraAtualizada.id, obraAtualizada);
                return;
              }
            }
          }

          // ✅ CORREÇÃO: Preservar origem do AsyncStorage (pode ser 'online' ou 'offline')
          setObra({ ...localObra, origem: localObra.origem || 'offline' } as ObraDetalheData);
          loadLocalPhotos(parsed.id, localObra);
          return;
        }
      }

      // Fallback: Se não encontrou no AsyncStorage, usa dados passados
      console.log('⚠️ Obra não encontrada no AsyncStorage, usando dados passados');
      setObra(parsed);

      // Carregar fotos locais se for offline
      if (parsed.id && parsed.origem === 'offline') {
        loadLocalPhotos(parsed.id, parsed);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes da obra:', error);
      setObra(null);
    }
  };

  const refreshObraData = async () => {
    if (!obra?.id) return;

    try {
      setRefreshing(true);

      // OFFLINE-FIRST: Sempre buscar do AsyncStorage primeiro
      const localObra = await getLocalObraById(obra.id);

      if (localObra) {
        if (isOnline && localObra.synced) {
          const idParaBuscar = (localObra as any).serverId || localObra.id;
          await forceUpdateObraFromSupabase(idParaBuscar);
          const obraAtualizada = await getLocalObraById(idParaBuscar);
          if (obraAtualizada) {
            setObra({ ...obraAtualizada, origem: obraAtualizada.origem || 'online' } as ObraDetalheData);
            loadLocalPhotos(obraAtualizada.id, obraAtualizada);
            return;
          }
        }

        console.log('🔄 Atualizando obra do AsyncStorage:', obra.id);
        // ✅ CORREÇÃO: Preservar origem do AsyncStorage (pode ser 'online' ou 'offline')
        setObra({ ...localObra, origem: localObra.origem || 'offline' } as ObraDetalheData);
        loadLocalPhotos(localObra.id, localObra);
      } else {
        // Fallback: Se não encontrou no AsyncStorage, tenta Supabase
        console.log('⚠️ Obra não está no AsyncStorage, buscando do Supabase...');

        // Se ID é temp_, buscar pelo número da obra
        let updatedObra = null;
        let error = null;

        if (obra.id.startsWith('temp_')) {
          console.log(`📋 ID temporário detectado, buscando pelo número: ${obra.obra}`);
          let query = supabase
            .from('obras')
            .select('*')
            .eq('obra', obra.obra)
            .eq('equipe', obra.equipe);

          if ((obra as any).tipo_servico) {
            query = query.eq('tipo_servico', (obra as any).tipo_servico);
          }
          if ((obra as any).created_at) {
            query = query.eq('created_at', (obra as any).created_at);
          }

          const response = await query
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          updatedObra = response.data;
          error = response.error;
        } else {
          const response = await supabase
            .from('obras')
            .select('*')
            .eq('id', obra.id)
            .single();

          updatedObra = response.data;
          error = response.error;
        }

        if (error) throw error;

        if (updatedObra) {
          setObra({ ...updatedObra, origem: 'online' });
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar obra:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    refreshObraData();
  };

  const openPhotoModal = (foto: FotoInfo, sectionKey?: string) => {
    setSelectedPhoto(foto);
    setSelectedPhotoSection(sectionKey || null);
    setModalVisible(true);
  };

  const closePhotoModal = () => {
    setModalVisible(false);
    setSelectedPhoto(null);
    setSelectedPhotoSection(null);
  };

  const handleRefazerFoto = () => {
    if (!obra || !selectedPhotoSection) return;

    Alert.alert(
      'Refazer Foto',
      'Deseja tirar uma nova foto para substituir esta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Tirar Nova Foto',
          onPress: () => {
            closePhotoModal();
            // Redirecionar para nova-obra em modo de edição
            router.push({
              pathname: '/nova-obra',
              params: {
                editMode: 'true',
                obraData: JSON.stringify(obra),
                focusField: selectedPhotoSection // Campo para focar
              }
            });
          }
        }
      ]
    );
  };

  const loadLocalPhotos = async (obraId: string, obraData?: any) => {
    try {
      // Coletar todos os IDs de fotos da obra para o fallback
      const sourceObra = obraData || obra;
      const allPhotoIds: string[] = sourceObra ? [
        ...(sourceObra.fotos_antes || []),
        ...(sourceObra.fotos_durante || []),
        ...(sourceObra.fotos_depois || []),
        ...(sourceObra.fotos_abertura || []),
        ...(sourceObra.fotos_fechamento || []),
        ...(sourceObra.fotos_ditais_abertura || []),
        ...(sourceObra.fotos_ditais_impedir || []),
        ...(sourceObra.fotos_ditais_testar || []),
        ...(sourceObra.fotos_ditais_aterrar || []),
        ...(sourceObra.fotos_ditais_sinalizar || []),
        ...(sourceObra.fotos_aterramento_vala_aberta || []),
        ...(sourceObra.fotos_aterramento_hastes || []),
        ...(sourceObra.fotos_aterramento_vala_fechada || []),
        ...(sourceObra.fotos_aterramento_medicao || []),
        ...(sourceObra.fotos_transformador_laudo || []),
        ...(sourceObra.fotos_transformador_componente_instalado || []),
        ...(sourceObra.fotos_transformador_tombamento_instalado || []),
        ...(sourceObra.fotos_transformador_tape || []),
        ...(sourceObra.fotos_transformador_placa_instalado || []),
        ...(sourceObra.fotos_transformador_instalado || []),
        ...(sourceObra.fotos_transformador_antes_retirar || []),
        ...(sourceObra.fotos_transformador_tombamento_retirado || []),
        ...(sourceObra.fotos_transformador_placa_retirado || []),
        ...(sourceObra.fotos_transformador_conexoes_primarias_instalado || []),
        ...(sourceObra.fotos_transformador_conexoes_secundarias_instalado || []),
        ...(sourceObra.fotos_transformador_conexoes_primarias_retirado || []),
        ...(sourceObra.fotos_transformador_conexoes_secundarias_retirado || []),
        ...(sourceObra.doc_laudo_transformador || []),
        ...(sourceObra.doc_cadastro_medidor || []),
        ...(sourceObra.doc_apr || []),
        ...(sourceObra.doc_laudo_regulador || []),
        ...(sourceObra.doc_laudo_religador || []),
        ...(sourceObra.doc_fvbt || []),
        ...(sourceObra.doc_materiais_previsto || []),
        ...(sourceObra.doc_materiais_realizado || []),
        // Adicionar photoIds de postes_data
        ...(sourceObra.postes_data || []).flatMap((poste: any) => [
          ...(poste.fotos_antes || []),
          ...(poste.fotos_durante || []),
          ...(poste.fotos_depois || []),
          ...(poste.fotos_medicao || []),
        ]),
        // Adicionar photoIds de checklist_postes_data
        ...(sourceObra.checklist_postes_data || []).flatMap((poste: any) => [
          ...(poste.posteInteiro || []),
          ...(poste.descricao || []),
          ...(poste.engaste || []),
          ...(poste.conexao1 || []),
          ...(poste.conexao2 || []),
          ...(poste.maiorEsforco || []),
          ...(poste.menorEsforco || []),
        ]),
        // Adicionar photoIds de checklist_seccionamentos_data
        ...(sourceObra.checklist_seccionamentos_data || []).flatMap((sec: any) => [
          ...(sec.fotos || []),
        ]),
        // Adicionar photoIds de checklist_aterramentos_cerca_data
        ...(sourceObra.checklist_aterramentos_cerca_data || []).flatMap((aterr: any) => [
          ...(aterr.fotos || []),
        ]),
        // Adicionar photoIds de checklist_hastes_termometros_data
        ...(sourceObra.checklist_hastes_termometros_data || []).flatMap((ponto: any) => [
          ...(ponto.fotoHaste || []),
          ...(ponto.fotoTermometro || []),
        ]),
      ].map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.id || item.photoId;
        return undefined;
      }).filter((id): id is string => typeof id === 'string') : [];

      // Usar função com fallback para encontrar fotos mesmo quando obraId mudou
      // IMPORTANTE: Passar serverId para buscar fotos que foram atualizadas após sync
      const serverId = sourceObra?.serverId;
      const photos = await getPhotosByObraWithFallback(obraId, allPhotoIds, serverId);
      console.log(`📸 [loadLocalPhotos] Carregou ${photos.length} foto(s) para obra ${obraId} (serverId: ${serverId || 'nenhum'})`);
      setLocalPhotos(photos);

      // 🔧 AUTO-CORREÇÃO: Reconstruir checklist_hastes_termometros_data se estiver vazio mas tiver fotos
      if (sourceObra?.tipo_servico === 'Checklist de Fiscalização' && 
          (!sourceObra.checklist_hastes_termometros_data || sourceObra.checklist_hastes_termometros_data.length === 0)) {
        
        // Buscar fotos de hastes e termômetros pelo tipo
        const hastePhotos = photos.filter(p => p.type?.includes('checklist_ponto_haste'));
        const termometroPhotos = photos.filter(p => p.type?.includes('checklist_ponto_termometro'));
        
        if (hastePhotos.length > 0 || termometroPhotos.length > 0) {
          console.log(`🔧 [loadLocalPhotos] Reconstruindo checklist_hastes_termometros_data: ${hastePhotos.length} hastes, ${termometroPhotos.length} termômetros`);
          
          // Agrupar fotos por pontoIndex (baseado no padrão do ID: ..._checklist_ponto_haste_{pontoIndex}_...)
          const pontosMap = new Map<number, { fotoHaste: string[], fotoTermometro: string[], isAditivo: boolean, numero: string }>();
          
          // Processar fotos de haste
          hastePhotos.forEach(foto => {
            // Extrair pontoIndex do ID (ex: temp_xxx_checklist_ponto_haste_0_xxx)
            const match = foto.id?.match(/checklist_ponto_haste_(\d+)_/);
            const pontoIndex = match ? parseInt(match[1]) : 0;
            
            if (!pontosMap.has(pontoIndex)) {
              pontosMap.set(pontoIndex, { fotoHaste: [], fotoTermometro: [], isAditivo: false, numero: `${pontoIndex + 1}` });
            }
            if (foto.id) pontosMap.get(pontoIndex)!.fotoHaste.push(foto.id);
          });
          
          // Processar fotos de termômetro
          termometroPhotos.forEach(foto => {
            const match = foto.id?.match(/checklist_ponto_termometro_(\d+)_/);
            const pontoIndex = match ? parseInt(match[1]) : 0;
            
            if (!pontosMap.has(pontoIndex)) {
              pontosMap.set(pontoIndex, { fotoHaste: [], fotoTermometro: [], isAditivo: false, numero: `${pontoIndex + 1}` });
            }
            if (foto.id) pontosMap.get(pontoIndex)!.fotoTermometro.push(foto.id);
          });
          
          // Converter para array e atualizar obra
          const reconstruido = Array.from(pontosMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([index, data]) => ({
              id: `ponto_${index + 1}`,
              numero: data.numero,
              isAditivo: data.isAditivo,
              fotoHaste: data.fotoHaste,
              fotoTermometro: data.fotoTermometro,
            }));
          
          console.log(`✅ [loadLocalPhotos] Reconstruído ${reconstruido.length} ponto(s) de hastes/termômetros`);
          
          // Atualizar o estado da obra com os dados reconstruídos
          setObra(prev => prev ? {
            ...prev,
            checklist_hastes_termometros_data: reconstruido,
          } as ObraDetalheData : prev);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar fotos locais:', error);
    }
  };

  // Helper para verificar se campos estruturados têm fotos reais
  const hasRealPhotos = (structuredData: any[] | undefined): boolean => {
    if (!structuredData || !Array.isArray(structuredData) || structuredData.length === 0) {
      return false;
    }
    // Verificar se algum item tem fotos reais em seus arrays
    return structuredData.some((item: any) => {
      if (!item) return false;
      // Verificar todos os campos que podem conter fotos
      const photoFields = ['posteInteiro', 'descricao', 'engaste', 'conexao1', 'conexao2', 'maiorEsforco', 'menorEsforco', 'fotos', 'fotoHaste', 'fotoTermometro'];
      return photoFields.some(field => {
        const value = item[field];
        return Array.isArray(value) && value.length > 0;
      });
    });
  };

  const isChecklistPostesDataSuspicious = (postesData: any[] | undefined): boolean => {
    if (!postesData || !Array.isArray(postesData) || postesData.length === 0) return false;

    return postesData.some((poste: any) => {
      const posteInteiro = Array.isArray(poste?.posteInteiro) ? poste.posteInteiro.length : 0;
      const descricao = Array.isArray(poste?.descricao) ? poste.descricao.length : 0;
      const engaste = Array.isArray(poste?.engaste) ? poste.engaste.length : 0;
      const conexao1 = Array.isArray(poste?.conexao1) ? poste.conexao1.length : 0;
      const conexao2 = Array.isArray(poste?.conexao2) ? poste.conexao2.length : 0;
      const maiorEsforco = Array.isArray(poste?.maiorEsforco) ? poste.maiorEsforco.length : 0;
      const menorEsforco = Array.isArray(poste?.menorEsforco) ? poste.menorEsforco.length : 0;

      return (
        posteInteiro > 2 ||
        descricao > 1 ||
        engaste > 1 ||
        conexao1 > 1 ||
        conexao2 > 1 ||
        maiorEsforco > 2 ||
        menorEsforco > 2
      );
    });
  };

  const clearChecklistPostesPhotos = (postesData: any[] | undefined): any[] | undefined => {
    if (!postesData || !Array.isArray(postesData)) return postesData;

    return postesData.map((poste: any) => ({
      ...poste,
      posteInteiro: [],
      descricao: [],
      engaste: [],
      conexao1: [],
      conexao2: [],
      maiorEsforco: [],
      menorEsforco: []
    }));
  };

  const getChecklistPostesForDisplay = (
    postesData: any[] | undefined,
    _flatPhotos: FotoInfo[] | undefined
  ): any[] | undefined => {
    if (!postesData || !Array.isArray(postesData) || postesData.length === 0) return postesData;

    // Evita remapeamento heurístico por timestamp (causa mistura entre postes).
    // Se a estrutura não tiver fotos, deixamos o fallback para renderização genérica da seção.
    return postesData;
  };

  /**
   * Mescla fotos do array flat (fotos_checklist_postes) com a estrutura de postes (checklist_postes_data)
   * Extrai o tipo de foto e associa ao poste correto baseado na sequência temporal
   */
  const mergePostesPhotosWithStructure = (
    postesData: any[] | undefined,
    flatPhotos: FotoInfo[] | undefined
  ): any[] | undefined => {
    if (!postesData || postesData.length === 0) return postesData;
    if (!flatPhotos || flatPhotos.length === 0) return postesData;

    const extractPhotoInfo = (url: string) => {
      const filename = url.split('/').pop() || '';
      const match = filename.match(/checklist_poste_([a-z_]+\d?)_(\d+)_/);
      if (!match) return null;
      return {
        tipo: match[1],
        timestamp: parseInt(match[2])
      };
    };

    const tipoToField: Record<string, string> = {
      'inteiro': 'posteInteiro',
      'descricao': 'descricao',
      'engaste': 'engaste',
      'conexao1': 'conexao1',
      'conexao2': 'conexao2',
      'maior_esforco': 'maiorEsforco',
      'menor_esforco': 'menorEsforco'
    };

    const parsedPhotos = flatPhotos
      .map(photo => {
        const url = photo.url || photo.uri || '';
        const info = extractPhotoInfo(url);
        if (!info || !tipoToField[info.tipo]) return null;
        return { photo, info };
      })
      .filter(Boolean) as Array<{ photo: FotoInfo; info: { tipo: string; timestamp: number } }>;

    if (parsedPhotos.length === 0) return postesData;

    const sortedPhotos = [...parsedPhotos].sort((a, b) => a.info.timestamp - b.info.timestamp);

    // Mapeamento confiável: precisa de um marcador "inteiro" por poste.
    const inteiroTimestamps = sortedPhotos
      .filter(item => item.info.tipo === 'inteiro')
      .map(item => item.info.timestamp);

    if (inteiroTimestamps.length !== postesData.length) {
      return postesData;
    }

    // Agrupar fotos por poste baseado nos timestamps "inteiro"
    const photoGroups: { posteIndex: number; tipo: string; photo: FotoInfo }[] = [];

    for (const item of sortedPhotos) {
      const { photo, info } = item;

      // Determinar a qual poste esta foto pertence
      // Encontrar o índice do último "inteiro" que veio ANTES ou NO MESMO timestamp desta foto
      let posteIndex = 0;
      for (let i = 0; i < inteiroTimestamps.length; i++) {
        if (info.timestamp >= inteiroTimestamps[i]) {
          posteIndex = i;
        } else {
          break;
        }
      }

      // Garantir que não exceda o número de postes disponíveis
      if (posteIndex < postesData.length) {
        photoGroups.push({
          posteIndex,
          tipo: info.tipo,
          photo
        });
      }
    }

    // Criar cópia dos postes e adicionar as fotos
    const mergedPostes = postesData.map((poste, index) => {
      const mergedPoste = {
        ...poste,
        posteInteiro: [...(poste.posteInteiro || [])],
        descricao: [...(poste.descricao || [])],
        engaste: [...(poste.engaste || [])],
        conexao1: [...(poste.conexao1 || [])],
        conexao2: [...(poste.conexao2 || [])],
        maiorEsforco: [...(poste.maiorEsforco || [])],
        menorEsforco: [...(poste.menorEsforco || [])]
      };

      for (const group of photoGroups) {
        if (group.posteIndex === index) {
          const field = tipoToField[group.tipo];
          if (field && mergedPoste[field]) {
            const photoUrl = group.photo.url || group.photo.uri || '';
            const exists = mergedPoste[field].some((f: any) => (f.url || f.uri || f) === photoUrl || f === photoUrl);
            if (!exists) {
              mergedPoste[field].push(group.photo);
            }
          }
        }
      }

      return mergedPoste;
    });

    return mergedPostes;
  };

  // Helper para buscar fotos pelos IDs (aceita strings ou objetos com {id, url})
  const getPhotosByIds = (photoIds: (string | any)[]): FotoInfo[] => {
    if (!photoIds || photoIds.length === 0) return [];

    const fotos: FotoInfo[] = [];
    for (const item of photoIds) {
      // Se já é um objeto com URL/URI, usar diretamente
      if (typeof item === 'object' && item !== null && (item.url || item.uri)) {
        fotos.push({
          url: item.url || undefined,
          uri: item.uri || undefined,
          latitude: item.latitude || null,
          longitude: item.longitude || null,
          utmX: item.utmX || null,
          utmY: item.utmY || null,
          utmZone: item.utmZone || null,
        });
        continue;
      }

      // Se é uma string (ID ou URL)
      const photoId = typeof item === 'string' ? item : (item?.id || item?.photoId);
      if (!photoId) continue;

      // Buscar nos metadados locais
      const metadata = localPhotos.find(p => p.id === photoId);
      if (metadata) {
        fotos.push({
          url: metadata.supabaseUrl || metadata.uploadUrl,
          uri: (metadata.supabaseUrl || metadata.uploadUrl) ? undefined : metadata.compressedPath,
          latitude: metadata.latitude,
          longitude: metadata.longitude,
          utmX: metadata.utmX,
          utmY: metadata.utmY,
          utmZone: metadata.utmZone,
        });
      } else if (typeof photoId === 'string' && (photoId.startsWith('http') || photoId.startsWith('file://'))) {
        // Se for URL completa (remota ou local), usar diretamente
        fotos.push(photoId.startsWith('http') ? { url: photoId } : { uri: photoId });
      }
    }
    return fotos;
  };

  // Mescla fotos do banco com fotos locais - SIMPLIFICADO
  const getPhotosForSection = (sectionKey: string): FotoInfo[] => {
    if (!obra) return [];

    // Mapear chaves especiais para campos do banco
    const keyMapping: Record<string, string> = {
      'doc_laudo_transformador_servico': 'doc_laudo_transformador',
      'doc_cadastro_medidor_servico': 'doc_cadastro_medidor',
    };

    // Usar chave mapeada ou a original
    const dbKey = keyMapping[sectionKey] || sectionKey;

    // Mapeamento unificado de seção para tipo de foto
    const typeMap: Record<string, string | string[]> = {
      'fotos_antes': 'antes',
      'fotos_durante': 'durante',
      'fotos_depois': 'depois',
      'fotos_abertura': 'abertura',
      'fotos_fechamento': 'fechamento',
      'fotos_ditais_abertura': 'ditais_abertura',
      'fotos_ditais_impedir': 'ditais_impedir',
      'fotos_ditais_testar': 'ditais_testar',
      'fotos_ditais_aterrar': 'ditais_aterrar',
      'fotos_ditais_sinalizar': 'ditais_sinalizar',
      'fotos_aterramento_vala_aberta': 'aterramento_vala_aberta',
      'fotos_aterramento_hastes': 'aterramento_hastes',
      'fotos_aterramento_vala_fechada': 'aterramento_vala_fechada',
      'fotos_aterramento_medicao': 'aterramento_medicao',
      'fotos_transformador_laudo': 'transformador_laudo',
      'fotos_transformador_componente_instalado': 'transformador_componente_instalado',
      'fotos_transformador_tombamento_instalado': 'transformador_tombamento_instalado',
      'fotos_transformador_tape': 'transformador_tape',
      'fotos_transformador_placa_instalado': 'transformador_placa_instalado',
      'fotos_transformador_instalado': 'transformador_instalado',
      'fotos_transformador_antes_retirar': 'transformador_antes_retirar',
      'fotos_transformador_tombamento_retirado': 'transformador_tombamento_retirado',
      'fotos_transformador_placa_retirado': 'transformador_placa_retirado',
      'fotos_transformador_conexoes_primarias_instalado': 'transformador_conexoes_primarias_instalado',
      'fotos_transformador_conexoes_secundarias_instalado': 'transformador_conexoes_secundarias_instalado',
      'fotos_transformador_conexoes_primarias_retirado': 'transformador_conexoes_primarias_retirado',
      'fotos_transformador_conexoes_secundarias_retirado': 'transformador_conexoes_secundarias_retirado',
      'fotos_medidor_padrao': 'medidor_padrao',
      'fotos_medidor_leitura': 'medidor_leitura',
      'fotos_medidor_selo_born': 'medidor_selo_born',
      'fotos_medidor_selo_caixa': 'medidor_selo_caixa',
      'fotos_medidor_identificador_fase': 'medidor_identificador_fase',
      'fotos_checklist_croqui': 'checklist_croqui',
      'fotos_checklist_panoramica_inicial': 'checklist_panoramica_inicial',
      'fotos_checklist_chede': 'checklist_chede',
      'fotos_checklist_aterramento_cerca': 'checklist_aterramento_cerca',
      'fotos_checklist_padrao_geral': 'checklist_padrao_geral',
      'fotos_checklist_padrao_interno': 'checklist_padrao_interno',
      'fotos_checklist_frying': 'checklist_frying',
      'fotos_checklist_abertura_fechamento_pulo': 'checklist_abertura_fechamento_pulo',
      'fotos_checklist_panoramica_final': 'checklist_panoramica_final',
      'fotos_checklist_postes': [
        'checklist_poste_inteiro',
        'checklist_poste_descricao',
        'checklist_poste_engaste',
        'checklist_poste_conexao1',
        'checklist_poste_conexao2',
        'checklist_poste_maior_esforco',
        'checklist_poste_menor_esforco',
      ],
      'fotos_checklist_seccionamentos': ['checklist_seccionamento', 'checklist_emenda', 'checklist_poda'],
      'fotos_altimetria_lado_fonte': 'altimetria_lado_fonte',
      'fotos_altimetria_medicao_fonte': 'altimetria_medicao_fonte',
      'fotos_altimetria_lado_carga': 'altimetria_lado_carga',
      'fotos_altimetria_medicao_carga': 'altimetria_medicao_carga',
      'fotos_vazamento_evidencia': 'vazamento_evidencia',
      'fotos_vazamento_equipamentos_limpeza': 'vazamento_equipamentos_limpeza',
      'fotos_vazamento_tombamento_retirado': 'vazamento_tombamento_retirado',
      'fotos_vazamento_placa_retirado': 'vazamento_placa_retirado',
      'fotos_vazamento_tombamento_instalado': 'vazamento_tombamento_instalado',
      'fotos_vazamento_placa_instalado': 'vazamento_placa_instalado',
      'fotos_vazamento_instalacao': 'vazamento_instalacao',
      'doc_cadastro_medidor': 'doc_cadastro_medidor',
      'doc_laudo_transformador': 'doc_laudo_transformador',
      'doc_laudo_regulador': 'doc_laudo_regulador',
      'doc_laudo_religador': 'doc_laudo_religador',
      'doc_apr': 'doc_apr',
      'doc_fvbt': 'doc_fvbt',
      'doc_termo_desistencia_lpt': 'doc_termo_desistencia_lpt',
      'doc_autorizacao_passagem': 'doc_autorizacao_passagem',
      'doc_materiais_previsto': 'doc_materiais_previsto',
      'doc_materiais_realizado': 'doc_materiais_realizado',
    };

    // Pegar fotos do banco (URL) ou IDs (AsyncStorage offline-first)
    const dbPhotos = (obra as any)[dbKey];

    // 1. Se dbPhotos é array de objetos com URL/URI, usar diretamente
    if (Array.isArray(dbPhotos) && dbPhotos.length > 0 && typeof dbPhotos[0] === 'object') {
      return (dbPhotos as FotoInfo[]).filter(f => f.url || f.uri);
    }

    // 2. Se dbPhotos é array de strings (IDs), buscar nos metadados locais
    if (Array.isArray(dbPhotos) && dbPhotos.length > 0 && typeof dbPhotos[0] === 'string') {
      const photoIds = dbPhotos as string[];
      const fotos: FotoInfo[] = [];

      for (const photoId of photoIds) {
        const metadata = localPhotos.find(p => p.id === photoId);
        if (metadata) {
          fotos.push({
            url: metadata.supabaseUrl || metadata.uploadUrl,
            uri: (metadata.supabaseUrl || metadata.uploadUrl) ? undefined : metadata.compressedPath,
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            utmX: metadata.utmX,
            utmY: metadata.utmY,
            utmZone: metadata.utmZone,
          });
        }
      }

      if (fotos.length > 0) {
        return fotos;
      }
    }

    // 3. Fallback: buscar por tipo no localPhotos
    const photoType = typeMap[sectionKey] || typeMap[dbKey];
    if (!photoType) return [];

    const typeList = Array.isArray(photoType) ? photoType : [photoType];
    const localPhotosForType = localPhotos.filter(p => typeList.includes(p.type));

    return localPhotosForType.map(p => ({
      url: p.supabaseUrl || p.uploadUrl,
      uri: (p.supabaseUrl || p.uploadUrl) ? undefined : p.compressedPath,
      latitude: p.latitude,
      longitude: p.longitude,
      utmX: p.utmX,
      utmY: p.utmY,
      utmZone: p.utmZone,
    }));
  };

  // Helper para obter fotos de um poste específico
  const getPhotosForPoste = (
    poste: any,
    secao: 'fotos_antes' | 'fotos_durante' | 'fotos_depois' | 'fotos_medicao'
  ): FotoInfo[] => {
    if (!poste || !poste[secao]) return [];

    const photoData = poste[secao];

    // Se é array de objetos com URL/URI, usar diretamente
    if (Array.isArray(photoData) && photoData.length > 0 && typeof photoData[0] === 'object') {
      return (photoData as FotoInfo[]).filter(f => f.url || f.uri);
    }

    // Se é array de strings (photoIds), buscar nos metadados locais
    if (Array.isArray(photoData) && photoData.length > 0 && typeof photoData[0] === 'string') {
      const photoIds = photoData as string[];
      const fotos: FotoInfo[] = [];

      for (const photoId of photoIds) {
        const metadata = localPhotos.find(p => p.id === photoId);
        if (metadata) {
          fotos.push({
            url: metadata.supabaseUrl || metadata.uploadUrl,
            uri: (metadata.supabaseUrl || metadata.uploadUrl) ? undefined : metadata.compressedPath,
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            utmX: metadata.utmX,
            utmY: metadata.utmY,
            utmZone: metadata.utmZone,
          });
        }
      }

      return fotos;
    }

    return [];
  };

  // Calcular fotos faltantes por tipo de serviço
  const calcularFotosFaltantes = (): { total: number; detalhes: string[] } => {
    if (!obra) return { total: 0, detalhes: [] };

    const tiposServico = obra.tipo_servico.split(',').map(t => t.trim());
    const faltantes: string[] = [];

    // APR é opcional; não bloquear por ausência

    tiposServico.forEach(tipo => {
      switch (tipo) {
        case 'Abertura e Fechamento de Chave':
          if (!getPhotosForSection('fotos_abertura').length) faltantes.push('Abertura');
          if (!getPhotosForSection('fotos_fechamento').length) faltantes.push('Fechamento');
          break;
        case 'Ditais':
          if (!getPhotosForSection('fotos_ditais_abertura').length) faltantes.push('DITAIS - Abertura');
          if (!getPhotosForSection('fotos_ditais_impedir').length) faltantes.push('DITAIS - Impedir');
          if (!getPhotosForSection('fotos_ditais_testar').length) faltantes.push('DITAIS - Testar');
          if (!getPhotosForSection('fotos_ditais_aterrar').length) faltantes.push('DITAIS - Aterrar');
          if (!getPhotosForSection('fotos_ditais_sinalizar').length) faltantes.push('DITAIS - Sinalizar');
          break;
        case 'Book de Aterramento':
          if (Array.isArray(obra.postes_data) && obra.postes_data.length > 0) {
            const totalValaAberta = obra.postes_data.reduce((acc, poste: any) => acc + getPhotosForPoste(poste, 'fotos_antes').length, 0);
            const totalHastes = obra.postes_data.reduce((acc, poste: any) => acc + getPhotosForPoste(poste, 'fotos_durante').length, 0);
            const totalValaFechada = obra.postes_data.reduce((acc, poste: any) => acc + getPhotosForPoste(poste, 'fotos_depois').length, 0);
            const totalMedicao = obra.postes_data.reduce((acc, poste: any) => acc + getPhotosForPoste(poste, 'fotos_medicao').length, 0);

            if (totalValaAberta === 0) faltantes.push('Vala Aberta');
            if (totalHastes === 0) faltantes.push('Hastes');
            if (totalValaFechada === 0) faltantes.push('Vala Fechada');
            if (totalMedicao === 0) faltantes.push('Medicao');
          } else {
            if (!getPhotosForSection('fotos_aterramento_vala_aberta').length) faltantes.push('Vala Aberta');
            if (!getPhotosForSection('fotos_aterramento_hastes').length) faltantes.push('Hastes');
            if (!getPhotosForSection('fotos_aterramento_vala_fechada').length) faltantes.push('Vala Fechada');
            if (!getPhotosForSection('fotos_aterramento_medicao').length) faltantes.push('Medicao');
          }
          break;
        case 'Linha Viva':
        case 'Cava em Rocha':
        case 'Fundação Especial':
          if (Array.isArray(obra.postes_data) && obra.postes_data.length > 0) {
            const totalAntes = obra.postes_data.reduce((acc, poste: any) => acc + getPhotosForPoste(poste, 'fotos_antes').length, 0);
            const totalDurante = obra.postes_data.reduce((acc, poste: any) => acc + getPhotosForPoste(poste, 'fotos_durante').length, 0);
            const totalDepois = obra.postes_data.reduce((acc, poste: any) => acc + getPhotosForPoste(poste, 'fotos_depois').length, 0);

            if (totalAntes === 0) faltantes.push('Antes');
            if (totalDurante === 0) faltantes.push('Durante');
            if (totalDepois === 0) faltantes.push('Depois');
          } else {
            if (!getPhotosForSection('fotos_antes').length) faltantes.push('Antes');
            if (!getPhotosForSection('fotos_durante').length) faltantes.push('Durante');
            if (!getPhotosForSection('fotos_depois').length) faltantes.push('Depois');
          }
          break;
        case 'Transformador':
          // ⚡ LAUDO TRANSFORMADOR - OBRIGATÓRIO
          if (!getPhotosForSection('doc_laudo_transformador_servico').length) {
            faltantes.push('Laudo de Transformador');
          }
          // Validar apenas campos específicos com base no status
          if (obra.transformador_status === 'Instalado') {
            if (!getPhotosForSection('fotos_transformador_componente_instalado').length) faltantes.push('Componente Instalado');
            if (!getPhotosForSection('fotos_transformador_tombamento_instalado').length) faltantes.push('Tombamento (Instalado)');
            if (!getPhotosForSection('fotos_transformador_tape').length) faltantes.push('Tape');
            if (!getPhotosForSection('fotos_transformador_placa_instalado').length) faltantes.push('Placa (Instalado)');
            if (!getPhotosForSection('fotos_transformador_instalado').length) faltantes.push('Transformador Instalado');
            // Validar Conexões (2 fotos obrigatórias cada)
            const conexoesPrimariasInstalado = getPhotosForSection('fotos_transformador_conexoes_primarias_instalado');
            const conexoesSecundariasInstalado = getPhotosForSection('fotos_transformador_conexoes_secundarias_instalado');
            if (conexoesPrimariasInstalado.length < 2) {
              faltantes.push(`Conexões Primárias (Instalado) - ${2 - conexoesPrimariasInstalado.length} foto(s)`);
            }
            if (conexoesSecundariasInstalado.length < 2) {
              faltantes.push(`Conexões Secundárias (Instalado) - ${2 - conexoesSecundariasInstalado.length} foto(s)`);
            }
          } else if (obra.transformador_status === 'Retirado') {
            if (!getPhotosForSection('fotos_transformador_antes_retirar').length) faltantes.push('Antes de Retirar');
            if (!getPhotosForSection('fotos_transformador_tombamento_retirado').length) faltantes.push('Tombamento (Retirado)');
            if (!getPhotosForSection('fotos_transformador_placa_retirado').length) faltantes.push('Placa (Retirado)');
            // Validar Conexões (2 fotos obrigatórias cada)
            const conexoesPrimariasRetirado = getPhotosForSection('fotos_transformador_conexoes_primarias_retirado');
            const conexoesSecundariasRetirado = getPhotosForSection('fotos_transformador_conexoes_secundarias_retirado');
            if (conexoesPrimariasRetirado.length < 2) {
              faltantes.push(`Conexões Primárias (Retirado) - ${2 - conexoesPrimariasRetirado.length} foto(s)`);
            }
            if (conexoesSecundariasRetirado.length < 2) {
              faltantes.push(`Conexões Secundárias (Retirado) - ${2 - conexoesSecundariasRetirado.length} foto(s)`);
            }
          }
          // Laudo é opcional
          break;
        case 'Instalação do Medidor':
          // 📋 CADASTRO DE MEDIDOR - OBRIGATÓRIO
          if (!getPhotosForSection('doc_cadastro_medidor_servico').length) {
            faltantes.push('Cadastro de Medidor');
          }
          if (!getPhotosForSection('fotos_medidor_padrao').length) faltantes.push('Padrão');
          if (!getPhotosForSection('fotos_medidor_leitura').length) faltantes.push('Leitura');
          if (!getPhotosForSection('fotos_medidor_selo_born').length) faltantes.push('Selo Born');
          if (!getPhotosForSection('fotos_medidor_selo_caixa').length) faltantes.push('Selo Caixa');
          if (!getPhotosForSection('fotos_medidor_identificador_fase').length) faltantes.push('Identificador de Fase');
          break;
        case 'Checklist de Fiscalização':
          if (!getPhotosForSection('fotos_checklist_croqui').length) faltantes.push('Croqui');
          if (!getPhotosForSection('fotos_checklist_panoramica_inicial').length) faltantes.push('Panorâmica Inicial');
          if (!getPhotosForSection('fotos_checklist_panoramica_final').length) faltantes.push('Panorâmica Final');
          // Outros campos do checklist são opcionais
          break;
        case 'Altimetria':
          if (!getPhotosForSection('fotos_altimetria_lado_fonte').length) faltantes.push('Lado Fonte');
          if (!getPhotosForSection('fotos_altimetria_medicao_fonte').length) faltantes.push('Medição Fonte');
          if (!getPhotosForSection('fotos_altimetria_lado_carga').length) faltantes.push('Lado Carga');
          if (!getPhotosForSection('fotos_altimetria_medicao_carga').length) faltantes.push('Medição Carga');
          break;
        case 'Vazamento e Limpeza de Transformador':
          if (!getPhotosForSection('fotos_vazamento_evidencia').length) faltantes.push('Evidência');
          if (!getPhotosForSection('fotos_vazamento_equipamentos_limpeza').length) faltantes.push('Equipamentos');
          // Outros campos são opcionais
          break;
        case 'Documentação':
          // Todos os documentos do book de documentação são opcionais
          break;
        default:
          // Serviços padrão (Emenda, Poda, Cava em Rocha, etc)
          if (!getPhotosForSection('fotos_antes').length) faltantes.push('Antes');
          if (!getPhotosForSection('fotos_durante').length) faltantes.push('Durante');
          if (!getPhotosForSection('fotos_depois').length) faltantes.push('Depois');
          break;
      }
    });

    return { total: faltantes.length, detalhes: faltantes };
  };

  // ✅ NOVA FUNÇÃO: Sincronizar obra sem finalizar (para acompanhamento no web)
  const handleSincronizar = async () => {
    if (!obra || !obra.id) return;

    // Verificar se está online
    if (!isOnline) {
      Alert.alert(
        'Sem Conexão',
        'É necessário estar conectado à internet para sincronizar a obra.',
        [{ text: 'OK' }]
      );
      return;
    }

    // ✅ CORRIGIDO: Permitir re-sincronização se a obra foi modificada após sync
    // synced=false indica que há alterações pendentes, mesmo se serverId existir
    const hasServerId = !!obra.serverId;
    const isLocal = obra.id.startsWith('local_');
    const needsSync = !obra.synced; // synced=false significa alterações pendentes

    console.log(`🔍 handleSincronizar - hasServerId: ${hasServerId}, isLocal: ${isLocal}, synced: ${obra.synced}, needsSync: ${needsSync}`);

    // Se já está sincronizada E não tem alterações pendentes, não precisa sincronizar
    if (hasServerId && !needsSync) {
      Alert.alert('Info', 'Esta obra já está sincronizada com o servidor.\n\nNão há alterações pendentes.');
      return;
    }

    // Determinar mensagem baseado no estado
    const isReSync = hasServerId && needsSync;
    const message = isReSync
      ? 'Esta obra foi modificada desde a última sincronização.\n\nAs alterações serão enviadas para o servidor.'
      : 'A obra será enviada para o servidor para acompanhamento.\n\nO status continuará "Em Aberto" até você finalizar.';

    Alert.alert(
      isReSync ? 'Atualizar Obra' : 'Sincronizar Obra',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isReSync ? 'Atualizar' : 'Sincronizar',
          onPress: async () => {
            try {
              setIsSincronizando(true);
              console.log(isReSync ? '🔄 Re-sincronizando obra:' : '📤 Sincronizando rascunho local:', obra.id);

              const success = await syncLocalObra(obra.id);

              if (!success) {
                throw new Error('Erro ao sincronizar obra');
              }

              // Buscar o novo serverId
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              const LOCAL_OBRAS_KEY = '@obras_local';
              const obrasJson = await AsyncStorage.getItem(LOCAL_OBRAS_KEY);

              if (obrasJson) {
                const obras = JSON.parse(obrasJson);
                const obraAtualizada = obras.find((o: any) => o.id === obra.id);
                if (obraAtualizada?.serverId) {
                  // Atualizar estado local respeitando sync parcial (não forçar synced=true)
                  setObra((prev: any) => prev ? {
                    ...prev,
                    serverId: obraAtualizada.serverId,
                    synced: obraAtualizada.synced,
                    sync_status: obraAtualizada.sync_status,
                  } : prev);
                }
              }

              const AsyncStorage2 = (await import('@react-native-async-storage/async-storage')).default;
              const obrasJson2 = await AsyncStorage2.getItem(LOCAL_OBRAS_KEY);
              const obraSincronizada = obrasJson2
                ? JSON.parse(obrasJson2).find((o: any) => o.id === obra.id)
                : null;
              const syncCompleta = obraSincronizada?.synced !== false;

              if (syncCompleta) {
                console.log('✅ Obra sincronizada com sucesso!');
                Alert.alert(
                  'Sucesso',
                  isReSync
                    ? 'Alterações enviadas para o servidor com sucesso!'
                    : 'Obra sincronizada! Agora ela pode ser acompanhada no sistema web.\n\nQuando terminar, clique em "Finalizar" para concluir.',
                  [{ text: 'OK' }]
                );
              } else {
                console.warn('⚠️ Sincronização parcial: ainda há fotos pendentes de upload');
                Alert.alert(
                  'Sincronização Parcial',
                  'A obra foi enviada, mas ainda existem fotos pendentes de sincronização.\n\nSincronize novamente antes de finalizar.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error: any) {
              console.error('❌ Erro ao sincronizar obra:', error);
              Alert.alert('Erro', `Não foi possível sincronizar a obra: ${error.message}`);
            } finally {
              setIsSincronizando(false);
            }
          },
        },
      ]
    );
  };

  const handleFinalizarObra = async () => {
    if (!obra || !obra.id) return;

    // Verificar se está online
    if (!isOnline) {
      Alert.alert(
        'Sem Conexão',
        'É necessário estar conectado à internet para finalizar a obra.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Verificar se é rascunho local não sincronizado
    const isLocalDraft = obra.id.startsWith('local_');
    if (isLocalDraft && !obra.serverId) {
      Alert.alert(
        'Sincronize Primeiro',
        'Esta obra precisa ser sincronizada antes de finalizar.\n\nClique em "Sincronizar" primeiro.',
        [{ text: 'OK' }]
      );
      return;
    }

    const syncPendente = obra.origem === 'offline' && (
      obra.synced === false ||
      (obra as any).sync_status === 'pending' ||
      (obra as any).sync_status === 'failed' ||
      (obra as any).sync_status === 'partial' ||
      (obra as any).sync_status === 'syncing'
    );

    if (syncPendente) {
      Alert.alert(
        'Sincronize Primeiro',
        'Existem alterações/fotos pendentes de sincronização.\n\nClique em "Sincronizar" e depois finalize a obra.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Verificar fotos faltantes
    const { total, detalhes } = calcularFotosFaltantes();

    if (total > 0) {
      Alert.alert(
        'Fotos Faltantes',
        `Esta obra ainda tem ${total} foto(s) obrigatória(s) faltando:\n\n${detalhes.join('\n')}\n\nComplete as fotos antes de finalizar a obra.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Finalizar Obra',
      'Todas as fotos obrigatórias foram anexadas. Deseja marcar esta obra como finalizada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsFinalizando(true);
              const dataFechamento = new Date().toISOString();

              // Determinar qual ID usar (serverId se for local sincronizado, ou id direto)
              const idParaFinalizar = (isLocalDraft && obra.serverId) ? obra.serverId : obra.id;

              console.log('📤 Finalizando obra:', idParaFinalizar);

              const { error } = await supabase
                .from('obras')
                .update({
                  status: 'finalizada',
                  finalizada_em: dataFechamento,
                  data_fechamento: dataFechamento,
                })
                .eq('id', idParaFinalizar);

              if (error) throw error;

              // Atualizar AsyncStorage local com novo status
              console.log('✅ Obra finalizada no Supabase, atualizando AsyncStorage...');
              try {
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                const LOCAL_OBRAS_KEY = '@obras_local';

                const obrasJson = await AsyncStorage.getItem(LOCAL_OBRAS_KEY);
                if (obrasJson) {
                  const obras = JSON.parse(obrasJson);
                  const obraIndex = obras.findIndex((o: any) => o.id === obra.id);

                  if (obraIndex !== -1) {
                    obras[obraIndex] = {
                      ...obras[obraIndex],
                      status: 'finalizada',
                      finalizada_em: dataFechamento,
                      data_fechamento: dataFechamento,
                    };
                    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(obras));
                    console.log('✅ AsyncStorage atualizado com status finalizada');
                  }
                }
              } catch (storageError) {
                console.error('⚠️ Erro ao atualizar AsyncStorage:', storageError);
              }

              Alert.alert('Sucesso', 'Obra finalizada com sucesso!', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error: any) {
              console.error('❌ Erro ao finalizar obra:', error);
              Alert.alert('Erro', `Não foi possível finalizar a obra: ${error.message}`);
            } finally {
              setIsFinalizando(false);
            }
          },
        },
      ]
    );
  };

  const statusInfo = useMemo(() => {
    if (!obra || obra.origem !== 'offline') {
      return null;
    }

    // Se já foi sincronizada (tem serverId e synced=true), não mostrar badge
    if (obra.serverId && obra.synced !== false) {
      return null;
    }

    if (obra.sync_status === 'failed') {
      return { label: 'Falha ao sincronizar', style: styles.statusFailed };
    }

    if (obra.sync_status === 'syncing') {
      return { label: 'Sincronizando...', style: styles.statusSyncing };
    }

    return { label: 'Aguardando sincronização', style: styles.statusPending };
  }, [obra]);

  if (!obra) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Não foi possível carregar esta obra.</Text>
          <TouchableOpacity style={styles.emptyBackButton} onPress={() => router.back()}>
            <Text style={styles.emptyBackButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={[styles.header, isSmallScreen && styles.headerCompact]}>
        <TouchableOpacity
          style={[styles.backButton, isSmallScreen && styles.backButtonCompact]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#0f172a" />
          {!isVerySmallScreen && (
            <Text style={[styles.backButtonText, isSmallScreen && styles.backButtonTextCompact]}>
              Voltar
            </Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isSmallScreen && styles.headerTitleCompact]} numberOfLines={1}>
          Detalhes da Obra
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {obra.origem !== 'offline' && (
            <TouchableOpacity
              style={[styles.refreshButton, isSmallScreen && styles.refreshButtonCompact]}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.7}
            >
              <Ionicons
                name={refreshing ? "hourglass-outline" : "refresh"}
                size={20}
                color={refreshing ? "#999" : "#007bff"}
              />
            </TouchableOpacity>
          )}
          {obra.origem === 'offline' && (
            <View style={[styles.headerActionPlaceholder, { width: headerPlaceholderWidth }]} />
          )}
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: contentPaddingHorizontal,
            paddingBottom: 40 + insets.bottom,
          },
        ]}
        refreshControl={
          obra.origem !== 'offline' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007bff"
              colors={['#007bff']}
            />
          ) : undefined
        }
      >
        <View style={styles.card}>
          <Text style={[styles.cardTitle, isSmallScreen && styles.cardTitleCompact]}>Obra {obra.obra || '-'}</Text>
          <Text style={[styles.cardSubtitle, isSmallScreen && styles.cardSubtitleCompact]}>
            Criada em {formatDate(obra.created_at || obra.data)}
          </Text>
          {statusInfo && (
            <View style={[styles.statusBadge, statusInfo.style]}>
              <Text style={styles.statusBadgeText}>{statusInfo.label}</Text>
            </View>
          )}
          {!statusInfo && obra.origem !== 'offline' && (
            <View style={[styles.statusBadge, styles.statusSynced]}>
              <Text style={styles.statusBadgeText}>Sincronizada</Text>
            </View>
          )}
          {obra.error_message ? (
            <Text style={styles.statusError}>{obra.error_message}</Text>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Data" value={formatDate(obra.data)} />
          <InfoRow label="Encarregado" value={obra.responsavel || '-'} />
          <InfoRow label="Equipe" value={obra.equipe || '-'} />
          <InfoRow label="Tipo de serviço" value={obra.tipo_servico || '-'} />
          {obra.transformador_status && (
            <InfoRow label="Status do Transformador" value={obra.transformador_status} />
          )}
        </View>

        {/* Botões de ação */}
        {obra.status !== 'finalizada' && (() => {
          const { total: fotosFaltantes, detalhes: fotosFaltantesDetalhes } = calcularFotosFaltantes();
          const isLocalDraft = obra.id.startsWith('local_');
          // ✅ CORRIGIDO: Verificar serverId (indica que já foi sincronizado com Supabase)
          const jaSincronizada = !isLocalDraft || !!obra.serverId;

          // Finalizar: só habilitado se já sincronizada E sem fotos faltantes E online
          const podeFinalizar = jaSincronizada && isOnline && fotosFaltantes === 0;

          // ✅ CORRIGIDO: Sincronizar aparece se:
          // 1. É rascunho local E NÃO tem serverId (primeira sync)
          // 2. OU tem serverId MAS synced=false (foi editada após sync)
          const primeiraSync = isLocalDraft && !obra.serverId;
          const reSync = obra.serverId && obra.synced === false;
          const syncStatus = (obra as any).sync_status;
          const syncEmAndamento = syncStatus === 'syncing';
          const syncPendenteStatus = syncStatus === 'pending' || syncStatus === 'failed' || syncStatus === 'partial' || syncStatus === 'syncing';
          const syncPendente = primeiraSync || reSync || syncPendenteStatus || syncEmAndamento;
          const podeSincronizar = isOnline && (primeiraSync || reSync);
          const textoSincronizar = reSync ? '🔄 Atualizar' : '📤 Sincronizar';

          return (
            <View>
              {/* Lista de fotos faltantes */}
              {fotosFaltantes > 0 && (
                <View style={styles.fotosFaltantesContainer}>
                  <Text style={styles.fotosFaltantesTitle}>
                    📋 Fotos obrigatórias faltantes ({fotosFaltantes}):
                  </Text>
                  {fotosFaltantesDetalhes.map((foto, index) => (
                    <Text key={index} style={styles.fotosFaltantesItem}>
                      • {foto}
                    </Text>
                  ))}
                </View>
              )}

              {/* Primeira linha de botões: Adicionar Fotos */}
              <View style={[styles.actionButtons, actionButtonsStacked && styles.actionButtonsStacked]}>
                <TouchableOpacity
                  style={[
                    styles.continuarButton,
                    { flex: 1 },
                    actionButtonsStacked && styles.actionButtonFullWidth,
                  ]}
                  onPress={() => {
                    router.push({
                      pathname: '/nova-obra',
                      params: {
                        editMode: 'true',
                        obraData: JSON.stringify(obra)
                      }
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.continuarButtonText}>📷 Adicionar Fotos</Text>
                </TouchableOpacity>
              </View>

              {/* Segunda linha de botões: Sincronizar e/ou Finalizar */}
              <View style={[styles.actionButtons, { marginTop: 8 }, actionButtonsStacked && styles.actionButtonsStacked]}>
                {/* Botão SINCRONIZAR - aparece para primeira sync OU re-sync após edição */}
                {(primeiraSync || reSync) && (
                  <TouchableOpacity
                    style={[
                      styles.sincronizarButton,
                      { flex: 1 },
                      actionButtonsStacked && styles.actionButtonFullWidth,
                      (!podeSincronizar || isSincronizando) && styles.sincronizarButtonDisabled
                    ]}
                    onPress={handleSincronizar}
                    activeOpacity={podeSincronizar && !isSincronizando ? 0.7 : 1}
                    disabled={!podeSincronizar || isSincronizando}
                  >
                    {isSincronizando ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.sincronizarButtonText}>
                          {isOnline ? textoSincronizar : '📵 Sem conexão'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Botão FINALIZAR */}
                <TouchableOpacity
                  style={[
                    styles.finalizarButton,
                    { flex: 1 },
                    actionButtonsStacked && styles.actionButtonFullWidth,
                    (!(podeFinalizar && !syncPendente) || isFinalizando) && styles.finalizarButtonDisabled
                  ]}
                  onPress={handleFinalizarObra}
                  activeOpacity={podeFinalizar && !syncPendente && !isFinalizando ? 0.7 : 1}
                  disabled={!podeFinalizar || syncPendente || isFinalizando}
                >
                  {isFinalizando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={podeFinalizar && !syncPendente ? "checkmark-circle" : "alert-circle"}
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.finalizarButtonText}>
                        {!jaSincronizada
                          ? '⏳ Sincronize primeiro'
                          : syncPendente
                            ? '🔄 Sincronize atualizações'
                          : fotosFaltantes > 0
                            ? `Faltam ${fotosFaltantes} foto(s)`
                            : '✅ Finalizar Obra'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Dica para o usuário */}
              {isLocalDraft && !obra.serverId && (
                <Text style={styles.dicaText}>
                  💡 Sincronize para acompanhar no sistema web
                </Text>
              )}
            </View>
          );
        })()}

        {/* Checklist/Identificação de Postes (Cava em Rocha, Linha Viva, etc) */}
        {obra?.postes_data && obra.postes_data.length > 0 && (
          (() => {
            const isBookAterramentoPostes = obra?.tipo_servico === 'Book de Aterramento';
            const allSemFotos = obra.postes_data.every((poste: any) =>
              (poste?.fotos_antes?.length || 0) === 0 &&
              (poste?.fotos_durante?.length || 0) === 0 &&
              (poste?.fotos_depois?.length || 0) === 0 &&
              (!isBookAterramentoPostes || (poste?.fotos_medicao?.length || 0) === 0)
            );

            if (allSemFotos) {
              return (
                <>
                  <Text style={[styles.photoSectionTitle, { paddingHorizontal: contentPaddingHorizontal, marginTop: 8 }]}>
                    🏷️ Postes Identificados
                  </Text>
                  <View style={styles.posteIdentificacaoCard}>
                    <View style={styles.posteIdentificacaoList}>
                      {obra.postes_data.map((poste: any, index: number) => {
                        const numero = typeof poste?.numero === 'number'
                          ? poste.numero
                          : parseInt(String(poste?.id || '').replace(/[^0-9]/g, ''), 10);
                        const isAditivo = poste?.isAditivo === true;
                        const prefixo = isAditivo ? 'AD-P' : 'P';
                        const label = numero ? `${prefixo}${numero}` : String(poste?.id || `P${index + 1}`);
                        return (
                          <View key={`${label}-${index}`} style={[styles.posteIdentificacaoItem, isAditivo && styles.posteIdentificacaoItemAditivo]}>
                            <Text style={[styles.posteIdentificacaoText, isAditivo && styles.posteIdentificacaoTextAditivo]}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </>
              );
            }

            return (
              <>
                <Text style={[styles.photoSectionTitle, { paddingHorizontal: contentPaddingHorizontal, marginTop: 8 }]}>
                  📋 Checklist de Postes
                </Text>
                {obra.postes_data.map((poste: any) => {
                  const fotosAntes = getPhotosForPoste(poste, 'fotos_antes');
                  const fotosDurante = getPhotosForPoste(poste, 'fotos_durante');
                  const fotosDepois = getPhotosForPoste(poste, 'fotos_depois');
                  const fotosMedicao = getPhotosForPoste(poste, 'fotos_medicao');
                  const totalFotos = fotosAntes.length + fotosDurante.length + fotosDepois.length + (isBookAterramentoPostes ? fotosMedicao.length : 0);
                  const statusCompleto = isBookAterramentoPostes
                    ? fotosAntes.length > 0 && fotosDurante.length > 0 && fotosDepois.length > 0 && fotosMedicao.length > 0
                    : fotosAntes.length > 0 && fotosDurante.length > 0 && fotosDepois.length > 0;
                  const statusParcial = totalFotos > 0 && !statusCompleto;
                  const statusIcon = statusCompleto ? '✓' : statusParcial ? '◐' : '○';
                  const statusColor = statusCompleto ? '#28a745' : statusParcial ? '#ffc107' : '#999';
                  const labelAntes = isBookAterramentoPostes ? 'Vala Aberta' : 'Antes';
                  const labelDurante = isBookAterramentoPostes ? 'Hastes' : 'Durante';
                  const labelDepois = isBookAterramentoPostes ? 'Vala Fechada' : 'Depois';

                  return (
                    <View key={poste.id} style={styles.posteCard}>
                      {/* Header do Poste */}
                      <View style={[styles.posteHeader, { borderLeftColor: statusColor }]}>
                        <View style={styles.posteHeaderLeft}>
                          <View style={[styles.posteStatusIcon, { backgroundColor: statusColor }]}>
                            <Text style={styles.posteStatusIconText}>{statusIcon}</Text>
                          </View>
                          <View>
                            <Text style={styles.posteHeaderTitle}>Poste {poste.id}</Text>
                            <Text style={styles.posteHeaderSubtitle}>
                              {totalFotos} foto(s) • {fotosAntes.length} {labelAntes} • {fotosDurante.length} {labelDurante} • {fotosDepois.length} {labelDepois}
                              {isBookAterramentoPostes ? ` • ${fotosMedicao.length} Medicao` : ''}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Conteúdo do Poste */}
                      <View style={styles.posteContent}>
                        {/* Seção: Fotos Antes */}
                        <View style={styles.posteSection}>
                          <Text style={styles.posteSectionTitle}>📸 Fotos {labelAntes} ({fotosAntes.length})</Text>
                          {fotosAntes.length > 0 ? (
                            <View style={styles.photoGrid}>
                              {fotosAntes.map((foto, index) => {
                                const source = getPhotoSource(foto);
                                if (!source) return null;
                                return (
                                  <TouchableOpacity
                                    key={`${poste.id}-antes-${index}`}
                                    onPress={() => openPhotoModal(foto, `poste_${poste.id}_antes`)}
                                    activeOpacity={0.8}
                                  >
                                    <Image source={source} style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]} />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ) : (
                            <Text style={styles.noPhotosHint}>Nenhuma foto adicionada</Text>
                          )}
                        </View>

                        {/* Seção: Fotos Durante */}
                        <View style={styles.posteSection}>
                          <Text style={styles.posteSectionTitle}>🔨 Fotos {labelDurante} ({fotosDurante.length})</Text>
                          {fotosDurante.length > 0 ? (
                            <View style={styles.photoGrid}>
                              {fotosDurante.map((foto, index) => {
                                const source = getPhotoSource(foto);
                                if (!source) return null;
                                return (
                                  <TouchableOpacity
                                    key={`${poste.id}-durante-${index}`}
                                    onPress={() => openPhotoModal(foto, `poste_${poste.id}_durante`)}
                                    activeOpacity={0.8}
                                  >
                                    <Image source={source} style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]} />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ) : (
                            <Text style={styles.noPhotosHint}>Nenhuma foto adicionada</Text>
                          )}
                        </View>

                        {/* Seção: Fotos Depois */}
                        <View style={styles.posteSection}>
                          <Text style={styles.posteSectionTitle}>✅ Fotos {labelDepois} ({fotosDepois.length})</Text>
                          {fotosDepois.length > 0 ? (
                            <View style={styles.photoGrid}>
                              {fotosDepois.map((foto, index) => {
                                const source = getPhotoSource(foto);
                                if (!source) return null;
                                return (
                                  <TouchableOpacity
                                    key={`${poste.id}-depois-${index}`}
                                    onPress={() => openPhotoModal(foto, `poste_${poste.id}_depois`)}
                                    activeOpacity={0.8}
                                  >
                                    <Image source={source} style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]} />
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ) : (
                            <Text style={styles.noPhotosHint}>Nenhuma foto adicionada</Text>
                          )}
                        </View>

                        {isBookAterramentoPostes && (
                          <View style={styles.posteSection}>
                            <Text style={styles.posteSectionTitle}>Fotos Medicao Terrometro ({fotosMedicao.length})</Text>
                            {fotosMedicao.length > 0 ? (
                              <View style={styles.photoGrid}>
                                {fotosMedicao.map((foto, index) => {
                                  const source = getPhotoSource(foto);
                                  if (!source) return null;
                                  return (
                                    <TouchableOpacity
                                      key={`${poste.id}-medicao-${index}`}
                                      onPress={() => openPhotoModal(foto, `poste_${poste.id}_medicao`)}
                                      activeOpacity={0.8}
                                    >
                                      <Image source={source} style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]} />
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            ) : (
                              <Text style={styles.noPhotosHint}>Nenhuma foto adicionada</Text>
                            )}
                          </View>
                        )}

                        {/* Observação do Poste */}
                        {poste.observacao && (
                          <View style={styles.posteObservacao}>
                            <Text style={styles.posteObservacaoLabel}>Observação:</Text>
                            <Text style={styles.posteObservacaoText}>{poste.observacao}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            );
          })()
        )}

        {(() => {
          // Filtrar seções relevantes baseado no tipo de serviço
          const tipoServico = obra?.tipo_servico || '';
          const isServicoChave = tipoServico === 'Abertura e Fechamento de Chave';
          const isServicoDitais = tipoServico === 'Ditais';
          const isServicoBookAterramento = tipoServico === 'Book de Aterramento';
          const isServicoFundacaoEspecial = tipoServico === 'Fundação Especial';
          const isServicoLinhaViva = tipoServico === 'Linha Viva';
          const isServicoTransformador = tipoServico === 'Transformador';
          const isServicoMedidor = tipoServico === 'Instalação do Medidor';
          const isServicoChecklist = tipoServico === 'Checklist de Fiscalização';
          const isServicoDocumentacao = tipoServico === 'Documentação';
          const isServicoAltimetria = tipoServico === 'Altimetria';
          const isServicoVazamento = tipoServico === 'Vazamento e Limpeza de Transformador';
          const isServicoCavaRocha = tipoServico === 'Cava em Rocha';
          const isServicoPostesData = isServicoCavaRocha || isServicoLinhaViva || isServicoBookAterramento || isServicoFundacaoEspecial;
          const hasPostesData = Array.isArray(obra?.postes_data) && obra.postes_data.length > 0;
          const usarPostesDataComoPrimario = isServicoPostesData && hasPostesData;
          const isServicoPadrao = !isServicoChave && !isServicoDitais && !isServicoBookAterramento &&
            !isServicoTransformador && !isServicoMedidor && !isServicoChecklist &&
            !isServicoDocumentacao && !isServicoAltimetria && !isServicoVazamento &&
            (!isServicoPostesData || !usarPostesDataComoPrimario);

          const relevantSections = PHOTO_SECTIONS.filter(section => {
            // Serviço Padrão: Antes, Durante, Depois
            if (isServicoPadrao && ['fotos_antes', 'fotos_durante', 'fotos_depois'].includes(section.key)) {
              return true;
            }
            // Chave: Abertura, Fechamento
            if (isServicoChave && ['fotos_abertura', 'fotos_fechamento'].includes(section.key)) {
              return true;
            }
            // Ditais: 5 fotos
            if (isServicoDitais && section.key.startsWith('fotos_ditais_')) {
              return true;
            }
            // Book Aterramento: 4 fotos
            if (isServicoBookAterramento && section.key.startsWith('fotos_aterramento_')) {
              return !usarPostesDataComoPrimario;
            }
            // Transformador - Filtrar por status (Instalado/Retirado)
            if (isServicoTransformador && section.key.startsWith('fotos_transformador_')) {
              // Fotos comuns (independente do status)
              if (['fotos_transformador_laudo', 'fotos_transformador_tape', 'fotos_transformador_instalado'].includes(section.key)) {
                return true;
              }
              // Fotos específicas do status Instalado
              if (obra.transformador_status === 'Instalado') {
                if (section.key.includes('_instalado')) {
                  return true;
                }
              }
              // Fotos específicas do status Retirado
              if (obra.transformador_status === 'Retirado') {
                if (section.key.includes('_retirado')) {
                  return true;
                }
              }
              return false;
            }
            // Laudo Transformador - Aparece quando Transformador
            if (isServicoTransformador && section.key === 'doc_laudo_transformador_servico') {
              return true;
            }
            // Medidor
            if (isServicoMedidor && section.key.startsWith('fotos_medidor_')) {
              return true;
            }
            // Cadastro Medidor - Aparece quando Medidor
            if (isServicoMedidor && section.key === 'doc_cadastro_medidor_servico') {
              return true;
            }
            // Checklist
            if (isServicoChecklist && section.key.startsWith('fotos_checklist_')) {
              return true;
            }
            // Documentação - Todos os docs aparecem no book Documentação
            // Excluir entradas _servico (são específicas de outros tipos de serviço)
            if (isServicoDocumentacao && section.key.startsWith('doc_') && !section.key.endsWith('_servico')) {
              return true;
            }
            // Altimetria
            if (isServicoAltimetria && section.key.startsWith('fotos_altimetria_')) {
              return true;
            }
            // Vazamento
            if (isServicoVazamento && section.key.startsWith('fotos_vazamento_')) {
              return true;
            }
            return false;
          });

          const allPhotos = relevantSections.map(section => {
            return getPhotosForSection(section.key);
          }).flat();

          if (allPhotos.length === 0 && relevantSections.length === 0 && !usarPostesDataComoPrimario) {
            return (
              <View style={styles.infoCard}>
                <Text style={styles.noPhotosTitle}>Nenhuma foto disponível</Text>
                <Text style={styles.noPhotosText}>
                  As fotos desta obra ainda não foram sincronizadas ou não foram tiradas.
                </Text>
              </View>
            );
          }

          return (
            <>
              {relevantSections.map((section) => {
            const photos = getPhotosForSection(section.key);

            // 🎯 RENDERIZAÇÃO ESPECIAL PARA POSTES DO CHECKLIST
            if (section.key === 'fotos_checklist_postes') {
              const mergedPostes = getChecklistPostesForDisplay(
                obra.checklist_postes_data,
                (obra as any).fotos_checklist_postes
              );

              const temFotosReais = hasRealPhotos(mergedPostes);
              console.log('🔍 [DEBUG POSTES]', {
                temEstrutura: !!obra.checklist_postes_data,
                qtdItens: obra.checklist_postes_data?.length || 0,
                temFotosReais,
                usouMesclagem: mergedPostes !== obra.checklist_postes_data,
                primeiroItem: mergedPostes?.[0]
              });

              if (temFotosReais && mergedPostes) {
                return (
                  <View key={section.key} style={styles.infoCard}>
                    <Text style={styles.photoSectionTitle}>{section.label}</Text>
                    {mergedPostes.map((poste, posteIndex) => {
                      const categoriasPoste = [
                        { label: '📸 Poste Inteiro', fotos: poste.posteInteiro || [] },
                        { label: '📋 Descrição', fotos: poste.descricao || [] },
                        { label: '🔩 Engaste', fotos: poste.engaste || [] },
                        { label: '🔌 Conexão 1', fotos: poste.conexao1 || [] },
                        { label: '🔌 Conexão 2', fotos: poste.conexao2 || [] },
                        { label: '💪 Maior Esforço', fotos: poste.maiorEsforco || [] },
                        { label: '👌 Menor Esforço', fotos: poste.menorEsforco || [] },
                      ];

                      const totalFotos = categoriasPoste.reduce((sum, cat) => sum + cat.fotos.length, 0);

                      return (
                        <View key={poste.id || posteIndex} style={{ marginBottom: 16, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: poste.isAditivo ? '#ff6b6b' : '#007bff' }}>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                            {poste.isAditivo ? 'AD-' : ''}P{poste.numero} - {poste.status} ({totalFotos} fotos)
                            {poste.isAditivo && <Text style={{ fontSize: 12, color: '#ff6b6b', marginLeft: 8 }}>(Aditivo)</Text>}
                          </Text>
                          {categoriasPoste.map((categoria, catIndex) => {
                            // Sempre normalizar para garantir preview quando a estrutura vem com {id}/{photoId}
                            const fotosCarregadas = getPhotosByIds(categoria.fotos);
                            if (fotosCarregadas.length === 0) return null;

                            return (
                              <View key={catIndex} style={{ marginBottom: 12 }}>
                                <Text style={{ fontSize: 14, color: '#666', marginBottom: 6, marginLeft: 8 }}>
                                  {categoria.label} ({fotosCarregadas.length})
                                </Text>
                                <View style={styles.photoGrid}>
                                  {fotosCarregadas.map((foto, fotoIndex) => {
                                    const source = getPhotoSource(foto);
                                    if (!source) return null;

                                    return (
                                    <TouchableOpacity
                                      key={`${poste.id}-${catIndex}-${fotoIndex}`}
                                      onPress={() => openPhotoModal(foto, section.key)}
                                      activeOpacity={0.8}
                                    >
                                      <Image
                                        source={source}
                                        style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]}
                                      />
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              );
              }
            }

            // 🎯 RENDERIZAÇÃO ESPECIAL PARA SECCIONAMENTOS DO CHECKLIST
            if (section.key === 'fotos_checklist_seccionamentos' && hasRealPhotos(obra.checklist_seccionamentos_data)) {
              return (
                <View key={section.key} style={styles.infoCard}>
                  <Text style={styles.photoSectionTitle}>{section.label}</Text>
                  {obra.checklist_seccionamentos_data.map((sec, secIndex) => {
                    const fotosCarregadas = getPhotosByIds(sec.fotos || []);
                    if (fotosCarregadas.length === 0) return null;
                    const tipo = sec.tipo || 'seccionamento';
                    const prefixo = tipo === 'emenda' ? 'E' : tipo === 'poda' ? 'PD' : 'S';
                    const posteInicio = sec.posteInicio ?? sec.poste_inicio;
                    const posteFim = sec.posteFim ?? sec.poste_fim;
                    const trecho =
                      tipo === 'emenda' || tipo === 'poda'
                        ? ` entre P${posteInicio ?? '?'} - P${posteFim ?? '?'}`
                        : '';

                    return (
                      <View key={sec.id || secIndex} style={{ marginBottom: 16, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: '#28a745' }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                          {prefixo}{sec.numero ?? (secIndex + 1)}{trecho} ({fotosCarregadas.length} fotos)
                        </Text>
                        <View style={styles.photoGrid}>
                          {fotosCarregadas.map((foto, fotoIndex) => {
                            const source = getPhotoSource(foto);
                            if (!source) return null;

                            return (
                              <TouchableOpacity
                                key={`${sec.id}-${fotoIndex}`}
                                onPress={() => openPhotoModal(foto, section.key)}
                                activeOpacity={0.8}
                              >
                                <Image
                                  source={source}
                                  style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]}
                                />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            }

            // 🎯 RENDERIZAÇÃO ESPECIAL PARA ATERRAMENTOS DE CERCA DO CHECKLIST
            if (section.key === 'fotos_checklist_aterramento_cerca' && hasRealPhotos(obra.checklist_aterramentos_cerca_data)) {
              return (
                <View key={section.key} style={styles.infoCard}>
                  <Text style={styles.photoSectionTitle}>{section.label}</Text>
                  {obra.checklist_aterramentos_cerca_data.map((aterr, aterrIndex) => {
                    const fotosCarregadas = getPhotosByIds(aterr.fotos || []);
                    if (fotosCarregadas.length === 0) return null;

                    return (
                      <View key={aterr.id || aterrIndex} style={{ marginBottom: 16, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: '#ffc107' }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                          A{aterr.numero ?? (aterrIndex + 1)} ({fotosCarregadas.length} fotos)
                        </Text>
                        <View style={styles.photoGrid}>
                          {fotosCarregadas.map((foto, fotoIndex) => {
                            const source = getPhotoSource(foto);
                            if (!source) return null;

                            return (
                              <TouchableOpacity
                                key={`${aterr.id}-${fotoIndex}`}
                                onPress={() => openPhotoModal(foto, section.key)}
                                activeOpacity={0.8}
                              >
                                <Image
                                  source={source}
                                  style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]}
                                />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            }

            // 🎯 RENDERIZAÇÃO ESPECIAL PARA HASTES APLICADAS E MEDIÇÃO DO TERMÔMETRO
            if (section.key === 'fotos_checklist_hastes_termometros' && hasRealPhotos(obra.checklist_hastes_termometros_data)) {
              return (
                <View key={section.key} style={styles.infoCard}>
                  <Text style={styles.photoSectionTitle}>{section.label}</Text>
                  {obra.checklist_hastes_termometros_data.map((ponto, pontoIndex) => {
                    const categoriasHaste = [
                      { label: '📸 Haste Aplicada', fotos: ponto.fotoHaste || [] },
                      { label: '🌡️ Medição do Termômetro', fotos: ponto.fotoTermometro || [] },
                    ];

                    const totalFotos = categoriasHaste.reduce((sum, cat) => sum + cat.fotos.length, 0);
                    if (totalFotos === 0) return null;

                    return (
                      <View key={ponto.id || pontoIndex} style={{ marginBottom: 16, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: ponto.isAditivo ? '#ff6b6b' : '#17a2b8' }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                          {ponto.isAditivo ? 'AD-' : ''}P{ponto.numero} ({totalFotos} fotos)
                          {ponto.isAditivo && <Text style={{ fontSize: 12, color: '#ff6b6b', marginLeft: 8 }}> (Aditivo)</Text>}
                        </Text>
                        {categoriasHaste.map((categoria, catIndex) => {
                          const fotosCarregadas = getPhotosByIds(categoria.fotos);
                          if (fotosCarregadas.length === 0) return null;

                          return (
                            <View key={catIndex} style={{ marginBottom: 12 }}>
                              <Text style={{ fontSize: 14, color: '#666', marginBottom: 6, marginLeft: 8 }}>
                                {categoria.label} ({fotosCarregadas.length})
                              </Text>
                              <View style={styles.photoGrid}>
                                {fotosCarregadas.map((foto, fotoIndex) => {
                                  const source = getPhotoSource(foto);
                                  if (!source) return null;

                                  return (
                                    <TouchableOpacity
                                      key={`${ponto.id}-${catIndex}-${fotoIndex}`}
                                      onPress={() => openPhotoModal(foto, section.key)}
                                      activeOpacity={0.8}
                                    >
                                      <Image
                                        source={source}
                                        style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]}
                                      />
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              );
            }

            // Renderização padrão para outras seções
            return (
              <View key={section.key} style={styles.infoCard}>
                <Text style={styles.photoSectionTitle}>
                  {section.label} ({photos.length})
                </Text>
                {photos.length > 0 ? (
                  <View style={styles.photoGrid}>
                    {photos.map((foto, index) => {
                      const source = getPhotoSource(foto);
                      if (!source) return null;

                      return (
                        <TouchableOpacity
                          key={`${section.key}-${index}`}
                          onPress={() => openPhotoModal(foto, section.key)}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={source}
                            style={[styles.photoThumb, { width: thumbSize, height: thumbSize }]}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noPhotosHint}>Nenhuma foto adicionada</Text>
                )}
              </View>
            );
          })}
          </>
        );
      })()}
      </ScrollView>

      {/* Modal de visualização de foto em tela cheia */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closePhotoModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={closePhotoModal}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>

          {selectedPhoto && (
            <Image
              source={getPhotoSource(selectedPhoto)!}
              style={styles.modalPhoto}
              resizeMode="contain"
            />
          )}

          {/* Botão para refazer foto (apenas para obras não finalizadas) */}
          {obra?.status !== 'finalizada' && obra?.origem !== 'offline' && (
            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.modalRefazerButton}
                onPress={handleRefazerFoto}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.modalRefazerButtonText}>Refazer Foto</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedPhoto && (selectedPhoto.utmX || selectedPhoto.utmY) && (
            <View style={styles.modalInfoCard}>
              <Text style={styles.modalInfoText}>
                UTM: {selectedPhoto.utmX?.toFixed(2)} E, {selectedPhoto.utmY?.toFixed(2)} N
              </Text>
              {selectedPhoto.utmZone && (
                <Text style={styles.modalInfoText}>
                  Zona: {selectedPhoto.utmZone}
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
    backgroundColor: '#fff',
  },
  headerCompact: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#edeff5',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  backButtonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  backButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 15,
  },
  backButtonTextCompact: {
    fontSize: 13,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  headerTitleCompact: {
    fontSize: 16,
    marginHorizontal: 6,
  },
  headerActionPlaceholder: {
    width: 72,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#edeff5',
  },
  refreshButtonCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardTitleCompact: {
    fontSize: 19,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#777',
  },
  cardSubtitleCompact: {
    fontSize: 13,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: '#fff3cd',
  },
  statusSyncing: {
    backgroundColor: '#d1ecf1',
  },
  statusFailed: {
    backgroundColor: '#f8d7da',
  },
  statusSynced: {
    backgroundColor: '#e0f7e9',
  },
  statusBadgeText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  statusError: {
    color: '#b71c1c',
    marginTop: 8,
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flexShrink: 1,
  },
  section: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 15,
    color: '#333',
  },
  photoSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  noPhotosHint: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  noPhotosTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  noPhotosText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  tag: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    color: '#555',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyBackButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBackButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  fotosFaltantesContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  fotosFaltantesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 8,
  },
  fotosFaltantesItem: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  actionButtonsStacked: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButtonFullWidth: {
    width: '100%',
  },
  continuarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007bff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  continuarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  finalizarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#28a745',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  finalizarButtonDisabled: {
    backgroundColor: '#9e9e9e',
    shadowOpacity: 0,
    elevation: 0,
  },
  finalizarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  // Estilos do botão Sincronizar
  sincronizarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sincronizarButtonDisabled: {
    backgroundColor: '#90CAF9',
    shadowOpacity: 0,
    elevation: 0,
  },
  sincronizarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  dicaText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalPhoto: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  modalInfoCard: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  modalActionButtons: {
    position: 'absolute',
    bottom: 120,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  modalRefazerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ff9800',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  modalRefazerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  posteCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  posteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderLeftWidth: 4,
    backgroundColor: '#fafafa',
  },
  posteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  posteStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posteStatusIconText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  posteHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  posteHeaderSubtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  posteContent: {
    padding: 16,
  },
  posteSection: {
    marginBottom: 16,
  },
  posteSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  posteObservacao: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007bff',
  },
  posteObservacaoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  posteObservacaoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  posteIdentificacaoCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  posteIdentificacaoList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  posteIdentificacaoItem: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  posteIdentificacaoItemAditivo: {
    backgroundColor: '#dc2626',
  },
  posteIdentificacaoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  posteIdentificacaoTextAditivo: {
    color: '#fff',
  },
});
