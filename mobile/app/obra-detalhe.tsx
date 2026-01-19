import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, RefreshControl, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import type { PendingObra, LocalObra } from '../lib/offline-sync';
import { getLocalObraById, restoreObraPhotos, forceUpdateObraFromSupabase, syncObra, checkInternetConnection } from '../lib/offline-sync';
import { getPhotosByObra, getPhotoMetadatasByIds, type PhotoMetadata } from '../lib/photo-backup';
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
  status?: 'em_aberto' | 'finalizada';
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
  origem?: 'online';
};

type ObraPayload = (PendingObra & {
  origem?: 'offline';
  status?: 'em_aberto' | 'finalizada';
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
});

type ObraDetalheData = (OnlineObra | ObraPayload) & {
  origem?: 'online' | 'offline';
  sync_status?: PendingObra['sync_status'];
  error_message?: string;
};

const PHOTO_SECTIONS = [
  { key: 'fotos_antes', label: 'Fotos Antes' },
  { key: 'fotos_durante', label: 'Fotos Durante' },
  { key: 'fotos_depois', label: 'Fotos Depois' },
  { key: 'fotos_abertura', label: 'Fotos Abertura Chave' },
  { key: 'fotos_fechamento', label: 'Fotos Fechamento Chave' },
  { key: 'fotos_ditais_abertura', label: 'DITAIS - Abertura' },
  { key: 'fotos_ditais_impedir', label: 'DITAIS - Impedir' },
  { key: 'fotos_ditais_testar', label: 'DITAIS - Testar' },
  { key: 'fotos_ditais_aterrar', label: 'DITAIS - Aterrar' },
  { key: 'fotos_ditais_sinalizar', label: 'DITAIS - Sinalizar' },
  { key: 'fotos_aterramento_vala_aberta', label: 'Book Aterramento - Vala Aberta' },
  { key: 'fotos_aterramento_hastes', label: 'Book Aterramento - Hastes Aplicadas' },
  { key: 'fotos_aterramento_vala_fechada', label: 'Book Aterramento - Vala Fechada' },
  { key: 'fotos_aterramento_medicao', label: 'Book Aterramento - Medição Terrômetro' },
  { key: 'fotos_transformador_laudo', label: 'Transformador - Laudo' },
  { key: 'fotos_transformador_componente_instalado', label: 'Transformador - Componente Instalado' },
  { key: 'fotos_transformador_tombamento_instalado', label: 'Transformador - Tombamento (Instalado)' },
  { key: 'fotos_transformador_tape', label: 'Transformador - Tape' },
  { key: 'fotos_transformador_placa_instalado', label: 'Transformador - Placa (Instalado)' },
  { key: 'fotos_transformador_instalado', label: 'Transformador - Instalado' },
  { key: 'fotos_transformador_antes_retirar', label: 'Transformador - Antes de Retirar' },
  { key: 'fotos_transformador_tombamento_retirado', label: 'Transformador - Tombamento (Retirado)' },
  { key: 'fotos_transformador_placa_retirado', label: 'Transformador - Placa (Retirado)' },
  { key: 'fotos_medidor_padrao', label: 'Medidor - Padrão c/ Medidor Instalado' },
  { key: 'fotos_medidor_leitura', label: 'Medidor - Leitura c/ Medidor Instalado' },
  { key: 'fotos_medidor_selo_born', label: 'Medidor - Selo do Born do Medidor' },
  { key: 'fotos_medidor_selo_caixa', label: 'Medidor - Selo da Caixa' },
  { key: 'fotos_medidor_identificador_fase', label: 'Medidor - Identificador de Fase' },
  { key: 'fotos_checklist_croqui', label: 'Checklist - Croqui' },
  { key: 'fotos_checklist_panoramica_inicial', label: 'Checklist - Foto Panorâmica Inicial' },
  { key: 'fotos_checklist_chede', label: 'Checklist - CHEDE' },
  { key: 'fotos_checklist_aterramento_cerca', label: 'Checklist - Aterramento de Cerca' },
  { key: 'fotos_checklist_padrao_geral', label: 'Checklist - Padrão Geral' },
  { key: 'fotos_checklist_padrao_interno', label: 'Checklist - Padrão Interno' },
  { key: 'fotos_checklist_panoramica_final', label: 'Checklist - Foto Panorâmica Final' },
  { key: 'fotos_checklist_postes', label: 'Checklist - Postes' },
  { key: 'fotos_checklist_seccionamentos', label: 'Checklist - Seccionamentos' },
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
  { key: 'doc_cadastro_medidor', label: 'Documentação - Cadastro de Medidor' },
  { key: 'doc_laudo_transformador', label: 'Documentação - Laudo de Transformador' },
  { key: 'doc_laudo_regulador', label: 'Documentação - Laudo de Regulador' },
  { key: 'doc_laudo_religador', label: 'Documentação - Laudo de Religador' },
  { key: 'doc_fvbt', label: 'Documentação - FVBT (Formulário de Vistoria de Baixa Tensão)' },
  { key: 'doc_termo_desistencia_lpt', label: 'Documentação - Termo de Desistência LPT' },
  { key: 'doc_autorizacao_passagem', label: 'Documentação - Autorização de Passagem' },
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
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isFinalizando, setIsFinalizando] = useState(false);
  const insets = useSafeAreaInsets();

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

          // ✅ AUTO-CORREÇÃO: Se campos críticos estão faltando, buscar do Supabase
          const precisaCorrecao = !localObra.origem || !localObra.status;

          if (precisaCorrecao && localObra.synced) {
            console.log('⚠️ Obra sincronizada mas campos faltando - buscando do Supabase...');
            const corrigida = await forceUpdateObraFromSupabase(parsed.id);

            if (corrigida) {
              console.log('✅ Obra corrigida automaticamente');
              // Recarregar obra atualizada
              const obraAtualizada = await getLocalObraById(parsed.id);
              if (obraAtualizada) {
                setObra({ ...obraAtualizada, origem: obraAtualizada.origem || 'offline' });
                loadLocalPhotos(parsed.id);
                return;
              }
            }
          }

          // ✅ CORREÇÃO: Preservar origem do AsyncStorage (pode ser 'online' ou 'offline')
          setObra({ ...localObra, origem: localObra.origem || 'offline' });
          loadLocalPhotos(parsed.id);
          return;
        }
      }

      // Fallback: Se não encontrou no AsyncStorage, usa dados passados
      console.log('⚠️ Obra não encontrada no AsyncStorage, usando dados passados');
      setObra(parsed);

      // Carregar fotos locais se for offline
      if (parsed.id && parsed.origem === 'offline') {
        loadLocalPhotos(parsed.id);
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
        console.log('🔄 Atualizando obra do AsyncStorage:', obra.id);
        // ✅ CORREÇÃO: Preservar origem do AsyncStorage (pode ser 'online' ou 'offline')
        setObra({ ...localObra, origem: localObra.origem || 'offline' });
        loadLocalPhotos(localObra.id);
      } else {
        // Fallback: Se não encontrou no AsyncStorage, tenta Supabase
        console.log('⚠️ Obra não está no AsyncStorage, buscando do Supabase...');

        // Se ID é temp_, buscar pelo número da obra
        let updatedObra = null;
        let error = null;

        if (obra.id.startsWith('temp_')) {
          console.log(`📋 ID temporário detectado, buscando pelo número: ${obra.obra}`);
          const response = await supabase
            .from('obras')
            .select('*')
            .eq('obra', obra.obra)
            .eq('equipe', obra.equipe)
            .single();

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

  const openPhotoModal = (foto: FotoInfo, sectionKey?: string, photoIndex?: number) => {
    setSelectedPhoto(foto);
    setSelectedPhotoSection(sectionKey || null);
    setSelectedPhotoIndex(photoIndex !== undefined ? photoIndex : null);
    setModalVisible(true);
  };

  const closePhotoModal = () => {
    setModalVisible(false);
    setSelectedPhoto(null);
    setSelectedPhotoSection(null);
    setSelectedPhotoIndex(null);
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

  const loadLocalPhotos = async (obraId: string) => {
    try {
      const photos = await getPhotosByObra(obraId);
      setLocalPhotos(photos);
    } catch (error) {
      console.error('Erro ao carregar fotos locais:', error);
    }
  };

  // Mescla fotos do banco com fotos locais
  const getPhotosForSection = (sectionKey: string): FotoInfo[] => {
    if (!obra) return [];

    // Pegar fotos do banco (URL) ou IDs (AsyncStorage offline-first)
    const dbPhotos = (obra as any)[sectionKey];

    // ✅ CORREÇÃO: Se dbPhotos é array de strings (IDs), buscar URIs dos metadados locais
    // Isso garante que fotos apareçam mesmo após sincronização
    if (Array.isArray(dbPhotos) && dbPhotos.length > 0 && typeof dbPhotos[0] === 'string') {
      // IDs de fotos - buscar URIs do photo-backup usando localPhotos
      const photoIds = dbPhotos as string[];
      const fotosFromIds: FotoInfo[] = [];

      for (const photoId of photoIds) {
        const metadata = localPhotos.find(p => p.id === photoId);
        if (metadata) {
          fotosFromIds.push({
            uri: metadata.compressedPath,
            url: metadata.supabaseUrl,  // Pode ter URL se já foi sincronizada
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            utmX: metadata.utmX,
            utmY: metadata.utmY,
            utmZone: metadata.utmZone,
          });
        }
      }

      if (fotosFromIds.length > 0) {
        return fotosFromIds;
      }
    }

    // Se dbPhotos é array de objetos (FotoInfo com URL), usar
    const validDbPhotos = Array.isArray(dbPhotos) && dbPhotos.length > 0 && typeof dbPhotos[0] === 'object'
      ? (dbPhotos as FotoInfo[]).filter(f => f.url || f.uri)
      : [];

    // Combinar fotos do banco com fotos locais (para obras online e offline)
    // - Fotos do banco têm prioridade (já possuem URL)
    // - Fotos locais (backups) também devem ser exibidas para suportar edição offline
    const typeMap: Record<string, PhotoMetadata['type'] | PhotoMetadata['type'][]> = {
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
      'fotos_transformador_conexoes_primarias_instalado': 'transformador_conexoes_primarias_instalado',
      'fotos_transformador_conexoes_secundarias_instalado': 'transformador_conexoes_secundarias_instalado',
      'fotos_transformador_antes_retirar': 'transformador_antes_retirar',
      'fotos_transformador_tombamento_retirado': 'transformador_tombamento_retirado',
      'fotos_transformador_placa_retirado': 'transformador_placa_retirado',
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
      'fotos_checklist_panoramica_final': 'checklist_panoramica_final',
      'fotos_checklist_postes': [
        'checklist_poste_inteiro',
        'checklist_poste_engaste',
        'checklist_poste_conexao1',
        'checklist_poste_conexao2',
        'checklist_poste_maior_esforco',
        'checklist_poste_menor_esforco',
      ],
      'fotos_checklist_seccionamentos': 'checklist_seccionamento',
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

    const photoType = typeMap[sectionKey];
    if (!photoType) return [];

    const typeList = Array.isArray(photoType) ? photoType : [photoType];
    const localPhotosForType = localPhotos.filter(p => typeList.includes(p.type));

    // ✅ CORREÇÃO: Evitar duplicação de fotos
    // Se já temos fotos do banco (validDbPhotos), não adicionar fotos locais duplicadas
    if (validDbPhotos.length > 0) {
      // Já temos fotos do banco, não adicionar locais
      return validDbPhotos;
    }

    // Se não temos fotos do banco, usar apenas fotos locais
    const localFotoInfos = localPhotosForType.map(p => ({
      uri: p.compressedPath,
      url: p.supabaseUrl, // Incluir URL se já foi sincronizada
      latitude: p.latitude,
      longitude: p.longitude,
      utmX: p.utmX,
      utmY: p.utmY,
      utmZone: p.utmZone,
    }));

    return localFotoInfos;
  };

  // Calcular fotos faltantes por tipo de serviço
  const calcularFotosFaltantes = (): { total: number; detalhes: string[] } => {
    if (!obra) return { total: 0, detalhes: [] };

    const tiposServico = obra.tipo_servico.split(',').map(t => t.trim());
    const faltantes: string[] = [];

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
          if (!getPhotosForSection('fotos_aterramento_vala_aberta').length) faltantes.push('Vala Aberta');
          if (!getPhotosForSection('fotos_aterramento_hastes').length) faltantes.push('Hastes');
          if (!getPhotosForSection('fotos_aterramento_vala_fechada').length) faltantes.push('Vala Fechada');
          if (!getPhotosForSection('fotos_aterramento_medicao').length) faltantes.push('Medição');
          break;
        case 'Transformador':
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

              // ✅ CRÍTICO: Detectar se é rascunho local (ID começa com 'local_')
              const isLocalDraft = obra.id.startsWith('local_');

              if (isLocalDraft) {
                // Para rascunhos locais, usar syncObra que cria no Supabase
                console.log('📤 Finalizando rascunho local:', obra.id);

                const result = await syncObra(obra.id);

                if (!result.success) {
                  throw new Error(result.error || 'Erro ao sincronizar obra');
                }

                console.log('✅ Rascunho sincronizado com sucesso!');
              } else {
                // Para obras já no Supabase, fazer UPDATE direto
                console.log('📤 Finalizando obra existente:', obra.id);

                const { error } = await supabase
                  .from('obras')
                  .update({
                    status: 'finalizada',
                    finalizada_em: dataFechamento,
                    data_fechamento: dataFechamento,
                  })
                  .eq('id', obra.id);

                if (error) throw error;
              }

              // ✅ CRÍTICO: Atualizar AsyncStorage local com novo status
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
                // Não bloquear o fluxo se falhar atualização local
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#0f172a" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Detalhes da Obra
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {obra.origem !== 'offline' && (
            <TouchableOpacity
              style={styles.refreshButton}
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
          {obra.origem === 'offline' && <View style={styles.headerActionPlaceholder} />}
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
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
          <Text style={styles.cardTitle}>Obra {obra.obra || '-'}</Text>
          <Text style={styles.cardSubtitle}>Criada em {formatDate(obra.created_at || obra.data)}</Text>
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
          const { total: fotosFaltantes } = calcularFotosFaltantes();

          // ✅ CRÍTICO: Obras rascunho locais não podem ser finalizadas diretamente
          // Elas precisam primeiro ser convertidas em obras online (com UUID válido)
          const isLocalDraft = obra.status === 'rascunho' && obra.id?.startsWith('local_');
          // NOVA LÓGICA: Botão Finalizar aparece para RASCUNHOS também
          // Mas só fica habilitado se tiver fotos suficientes
          const podeFinalizar = isOnline && fotosFaltantes === 0;
          const isObraJaFinalizada = obra.status === 'finalizada';

          return (
            <View style={styles.actionButtons}>
              {/* Botão Adicionar Fotos - SEMPRE visível */}
              <TouchableOpacity
                style={[styles.continuarButton, { flex: 1 }]}
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
                <Text style={styles.continuarButtonText}>Adicionar Fotos</Text>
              </TouchableOpacity>

              {/* Botão Finalizar Obra - Aparece para RASCUNHOS e OBRAS EM ABERTO */}
              {/* NÃO aparece para obras já finalizadas */}
              {!isObraJaFinalizada && (
                <TouchableOpacity
                  style={[
                    styles.finalizarButton,
                    { flex: 1 },
                    (!podeFinalizar || isFinalizando) && styles.finalizarButtonDisabled
                  ]}
                  onPress={handleFinalizarObra}
                  activeOpacity={podeFinalizar && !isFinalizando ? 0.7 : 1}
                  disabled={!podeFinalizar || isFinalizando}
                >
                  {isFinalizando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={podeFinalizar ? "checkmark-circle" : "alert-circle"}
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.finalizarButtonText}>
                        {podeFinalizar ? '📤 Finalizar Obra' : `Faltam ${fotosFaltantes} foto(s)`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {(() => {
          // Filtrar seções relevantes baseado no tipo de serviço
          const tipoServico = obra?.tipo_servico || '';
          const isServicoChave = tipoServico === 'Abertura e Fechamento de Chave';
          const isServicoDitais = tipoServico === 'Ditais';
          const isServicoBookAterramento = tipoServico === 'Book de Aterramento';
          const isServicoTransformador = tipoServico === 'Transformador';
          const isServicoMedidor = tipoServico === 'Instalação do Medidor';
          const isServicoChecklist = tipoServico === 'Checklist de Fiscalização';
          const isServicoDocumentacao = tipoServico === 'Documentação';
          const isServicoAltimetria = tipoServico === 'Altimetria';
          const isServicoVazamento = tipoServico === 'Vazamento e Limpeza de Transformador';
          const isServicoPadrao = !isServicoChave && !isServicoDitais && !isServicoBookAterramento &&
            !isServicoTransformador && !isServicoMedidor && !isServicoChecklist &&
            !isServicoDocumentacao && !isServicoAltimetria && !isServicoVazamento;

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
              return true;
            }
            // Transformador
            if (isServicoTransformador && section.key.startsWith('fotos_transformador_')) {
              return true;
            }
            // Medidor
            if (isServicoMedidor && section.key.startsWith('fotos_medidor_')) {
              return true;
            }
            // Checklist
            if (isServicoChecklist && section.key.startsWith('fotos_checklist_')) {
              return true;
            }
            // Documentação
            if (isServicoDocumentacao && section.key.startsWith('doc_')) {
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

          if (allPhotos.length === 0 && relevantSections.length === 0) {
            return (
              <View style={styles.infoCard}>
                <Text style={styles.noPhotosTitle}>Nenhuma foto disponível</Text>
                <Text style={styles.noPhotosText}>
                  As fotos desta obra ainda não foram sincronizadas ou não foram tiradas.
                </Text>
              </View>
            );
          }

          // Card de resumo de fotos faltantes
          const missingPhotos = relevantSections.filter(section => {
            const photos = getPhotosForSection(section.key);
            return photos.length === 0;
          });

          // Verificar documentos obrigatórios faltantes
          const missingDocs: string[] = [];

          // APR é obrigatória em TODOS os serviços
          const docApr = obra?.doc_apr || [];
          if (docApr.length === 0) {
            missingDocs.push('⚠️ APR - Análise Preliminar de Risco');
          }

          // Laudo Transformador obrigatório quando Transformador Instalado
          const isTransformadorInstalado = obra?.tipo_servico === 'Transformador' && obra?.transformador_status === 'Instalado';
          if (isTransformadorInstalado) {
            const docLaudo = obra?.doc_laudo_transformador || [];
            if (docLaudo.length === 0) {
              missingDocs.push('⚡ Laudo de Transformador');
            }
          }

          // Cadastro Medidor obrigatório quando Instalação do Medidor
          const isMedidor = obra?.tipo_servico === 'Instalação do Medidor';
          if (isMedidor) {
            const docCadastro = obra?.doc_cadastro_medidor || [];
            if (docCadastro.length === 0) {
              missingDocs.push('📋 Cadastro de Medidor');
            }
          }

          const totalFaltando = missingPhotos.length + missingDocs.length;

          return (
            <>
              {totalFaltando > 0 && (
                <View style={styles.missingPhotosCard}>
                  <Text style={styles.missingPhotosTitle}>⚠️ Faltando ({totalFaltando}):</Text>
                  {missingDocs.map((doc, index) => (
                    <Text key={`doc-${index}`} style={styles.missingPhotoItem}>• {doc}</Text>
                  ))}
                  {missingPhotos.map(section => (
                    <Text key={section.key} style={styles.missingPhotoItem}>• {section.label}</Text>
                  ))}
                </View>
              )}

              {relevantSections.map((section) => {
            const photos = getPhotosForSection(section.key);

            // Sempre mostrar a seção, mesmo sem fotos
            return (
              <View key={section.key} style={styles.infoCard}>
                <Text style={styles.photoSectionTitle}>
                  {section.label} ({photos.length})
                  {photos.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
                {photos.length > 0 ? (
                  <View style={styles.photoGrid}>
                    {photos.map((foto, index) => {
                      const source = getPhotoSource(foto);
                      if (!source) return null;

                      return (
                        <TouchableOpacity
                          key={`${section.key}-${index}`}
                          onPress={() => openPhotoModal(foto, section.key, index)}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={source}
                            style={styles.photoThumb}
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
  backButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 15,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
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
  cardSubtitle: {
    fontSize: 14,
    color: '#777',
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
  missingPhotoIndicator: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ff6f00',
    fontStyle: 'italic',
  },
  noPhotosHint: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  missingPhotosCard: {
    backgroundColor: '#fff8e1',
    borderLeftWidth: 4,
    borderLeftColor: '#ff6f00',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  missingPhotosTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff6f00',
    marginBottom: 8,
  },
  missingPhotoItem: {
    fontSize: 14,
    color: '#4a4a4a',
    marginLeft: 4,
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
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
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
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '600',
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
});
