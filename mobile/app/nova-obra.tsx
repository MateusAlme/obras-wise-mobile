import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
  BackHandler,
  AppState,
  AppStateStatus,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import {
  checkInternetConnection,
  saveObraOffline,
  syncAllPendingObras,
  getPendingObras,
  getLocalObras,
  startAutoSync,
  updateObraOffline,
  saveObraLocal,
} from '../lib/offline-sync';
import type { PendingObra, LocalObra } from '../lib/offline-sync';
import {
  backupPhoto,
  getPhotosByObra,
  getPhotosByObraWithFallback,
  getAllPhotoMetadata,
  updatePhotosObraId,
} from '../lib/photo-backup';
import { processObraPhotos, addToUploadQueue } from '../lib/photo-queue';
import { PlacaScanner } from '../components/PlacaScanner';
import type { PlacaInfo } from '../lib/placa-parser';
import { PhotoWithPlaca } from '../components/PhotoWithPlaca';
import { renderPhotoWithPlacaBurnedIn } from '../lib/photo-with-placa';
import { useToast } from '../components/Toast';
// Import dinâmico (lazy) para evitar erro no web
// import { renderPhotoWithPlacaBurnedIn } from '../lib/photo-with-placa';

const TIPOS_SERVICO = [
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
  'Transformador',
  'Vazamento e Limpeza de Transformador',
];

// Fallback estático (usado apenas se Supabase e cache falharem)
const EQUIPES_FALLBACK = [
  'CNT 01', 'CNT 02', 'CNT 03', 'CNT 04', 'CNT 06', 'CNT 07', 'CNT 10', 'CNT 11', 'CNT 12',
  'MNT 01', 'MNT 02', 'MNT 03', 'MNT 04', 'MNT 05', 'MNT 06',
  'LV 01 CJZ', 'LV 02 PTS', 'LV 03 JR PTS',
];

const sanitizeObrasPayload = <T extends Record<string, any>>(payload: T): T => {
  const sanitized = { ...payload } as Record<string, any>;
  // Compatibilidade com backend sem esta migration aplicada.
  delete sanitized.fotos_transformador_laudo_retirado;
  return sanitized as T;
};

export default function NovaObra() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editMode?: string; obraData?: string }>();
  const { showToast, toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Modo de edição
  const isEditMode = params.editMode === 'true';
  const [obraId, setObraId] = useState<string | null>(null);

  // Detectar se é usuário COMP
  const [isCompUser, setIsCompUser] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLinhaVivaUser, setIsLinhaVivaUser] = useState(false);

  // Equipes disponíveis para seleção do admin (carregadas dinamicamente)
  const [equipesAdmin, setEquipesAdmin] = useState<string[]>(EQUIPES_FALLBACK);

  // Dados da obra
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [obra, setObra] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [equipe, setEquipe] = useState('');
  const [equipeExecutora, setEquipeExecutora] = useState(''); // Apenas admin seleciona
  const [tipoServico, setTipoServico] = useState<string>('');

  // Tipo para fotos com localização UTM
  type FotoData = {
    uri: string;
    latitude: number | null;
    longitude: number | null;
    utmX?: number | null;
    utmY?: number | null;
    utmZone?: string | null;
    photoId?: string;
  };

  // Fotos com localização e backup (agora com photoId e UTM)
  const [fotosAntes, setFotosAntes] = useState<FotoData[]>([]);
  const [fotosDurante, setFotosDurante] = useState<FotoData[]>([]);
  const [fotosDepois, setFotosDepois] = useState<FotoData[]>([]);
  const [fotosAbertura, setFotosAbertura] = useState<FotoData[]>([]);
  const [fotosFechamento, setFotosFechamento] = useState<FotoData[]>([]);

  // Fotos DITAIS (5 campos)
  const [fotosDitaisAbertura, setFotosDitaisAbertura] = useState<FotoData[]>([]);
  const [fotosDitaisImpedir, setFotosDitaisImpedir] = useState<FotoData[]>([]);
  const [fotosDitaisTestar, setFotosDitaisTestar] = useState<FotoData[]>([]);
  const [fotosDitaisAterrar, setFotosDitaisAterrar] = useState<FotoData[]>([]);
  const [fotosDitaisSinalizar, setFotosDitaisSinalizar] = useState<FotoData[]>([]);

  // Fotos BOOK ATERRAMENTO (4 campos)
  const [fotosAterramentoValaAberta, setFotosAterramentoValaAberta] = useState<FotoData[]>([]);
  const [fotosAterramentoHastes, setFotosAterramentoHastes] = useState<FotoData[]>([]);
  const [fotosAterramentoValaFechada, setFotosAterramentoValaFechada] = useState<FotoData[]>([]);
  const [fotosAterramentoMedicao, setFotosAterramentoMedicao] = useState<FotoData[]>([]);

  // Fotos TRANSFORMADOR
  const [transformadorStatus, setTransformadorStatus] = useState<'Instalado' | 'Retirado' | null>(null);
  const [fotosTransformadorLaudo, setFotosTransformadorLaudo] = useState<FotoData[]>([]);
  const [fotosTransformadorComponenteInstalado, setFotosTransformadorComponenteInstalado] = useState<FotoData[]>([]);
  const [fotosTransformadorTombamentoInstalado, setFotosTransformadorTombamentoInstalado] = useState<FotoData[]>([]);
  const [fotosTransformadorTape, setFotosTransformadorTape] = useState<FotoData[]>([]);
  const [fotosTransformadorPlacaInstalado, setFotosTransformadorPlacaInstalado] = useState<FotoData[]>([]);
  const [fotosTransformadorInstalado, setFotosTransformadorInstalado] = useState<FotoData[]>([]);
  const [fotosTransformadorConexoesPrimariasInstalado, setFotosTransformadorConexoesPrimariasInstalado] = useState<FotoData[]>([]);
  const [fotosTransformadorConexoesSecundariasInstalado, setFotosTransformadorConexoesSecundariasInstalado] = useState<FotoData[]>([]);
  const [fotosTransformadorAntesRetirar, setFotosTransformadorAntesRetirar] = useState<FotoData[]>([]);
  const [fotosTransformadorLaudoRetirado, setFotosTransformadorLaudoRetirado] = useState<FotoData[]>([]);
  const [fotosTransformadorTombamentoRetirado, setFotosTransformadorTombamentoRetirado] = useState<FotoData[]>([]);
  const [fotosTransformadorPlacaRetirado, setFotosTransformadorPlacaRetirado] = useState<FotoData[]>([]);
  const [fotosTransformadorConexoesPrimariasRetirado, setFotosTransformadorConexoesPrimariasRetirado] = useState<FotoData[]>([]);
  const [fotosTransformadorConexoesSecundariasRetirado, setFotosTransformadorConexoesSecundariasRetirado] = useState<FotoData[]>([]);

  // Fotos INSTALAÇÃO DO MEDIDOR (5 campos)
  const [fotosMedidorPadrao, setFotosMedidorPadrao] = useState<FotoData[]>([]);
  const [fotosMedidorLeitura, setFotosMedidorLeitura] = useState<FotoData[]>([]);
  const [fotosMedidorSeloBorn, setFotosMedidorSeloBorn] = useState<FotoData[]>([]);
  const [fotosMedidorSeloCaixa, setFotosMedidorSeloCaixa] = useState<FotoData[]>([]);
  const [fotosMedidorIdentificadorFase, setFotosMedidorIdentificadorFase] = useState<FotoData[]>([]);

  // Fotos CHECKLIST DE FISCALIZAÇÃO
  // Fotos fixas (não dinâmicas)
  const [fotosChecklistCroqui, setFotosChecklistCroqui] = useState<FotoData[]>([]);
  const [fotosChecklistPanoramicaInicial, setFotosChecklistPanoramicaInicial] = useState<FotoData[]>([]);
  const [fotosChecklistChaveComponente, setFotosChecklistChaveComponente] = useState<FotoData[]>([]);
  const [fotosChecklistPadraoGeral, setFotosChecklistPadraoGeral] = useState<FotoData[]>([]);
  const [fotosChecklistPadraoInterno, setFotosChecklistPadraoInterno] = useState<FotoData[]>([]);
  const [fotosChecklistFrying, setFotosChecklistFrying] = useState<FotoData[]>([]);
  const [fotosChecklistAberturaFechamentoPulo, setFotosChecklistAberturaFechamentoPulo] = useState<FotoData[]>([]);
  const [fotosChecklistPanoramicaFinal, setFotosChecklistPanoramicaFinal] = useState<FotoData[]>([]);

  // Estados dinâmicos para Postes (cada poste tem status e fotos)
  const [numPostes, setNumPostes] = useState(1);
  const [fotosPostes, setFotosPostes] = useState<Array<{
    numero: string; // Número/identificador do poste
    status: 'instalado' | 'retirado' | 'existente' | ''; // Status do poste
    isAditivo?: boolean; // Se é poste aditivo (não previsto no croqui)
    posteInteiro: FotoData[];
    descricao: FotoData[];
    engaste: FotoData[];
    conexao1: FotoData[];
    conexao2: FotoData[];
    maiorEsforco: FotoData[];
    menorEsforco: FotoData[];
  }>>([{
    numero: '', // Sem número inicial
    status: '', // Sem status inicial
    isAditivo: false, // Não é aditivo por padrão
    posteInteiro: [],
    descricao: [],
    engaste: [],
    conexao1: [],
    conexao2: [],
    maiorEsforco: [],
    menorEsforco: [],
  }]);

  type PontoChecklistLinear = {
    numero: string; // Numero do ponto (ex: "1", "4") para exibir com prefixo
    posteInicio: string; // Poste de referencia inicial (ex: "1" para P1)
    posteFim: string; // Poste de referencia final (ex: "2" para P2)
    fotos: FotoData[];
  };

  // Estados dinamicos para Seccionamento (cada ponto tem 1 foto)
  const [numSeccionamentos, setNumSeccionamentos] = useState(0);
  const [fotosSeccionamentos, setFotosSeccionamentos] = useState<Array<PontoChecklistLinear>>([]);

  // Estados dinamicos para Emenda (cada ponto tem 1 foto)
  const [numEmendas, setNumEmendas] = useState(0);
  const [fotosEmendas, setFotosEmendas] = useState<Array<PontoChecklistLinear>>([]);

  // Estados dinamicos para Poda (cada ponto tem 1 foto)
  const [numPodas, setNumPodas] = useState(0);
  const [fotosPodas, setFotosPodas] = useState<Array<PontoChecklistLinear>>([]);

  // Estados dinamicos para Aterramento de Cerca (cada ponto tem 1 foto) - OPCIONAL
  const [numAterramentosCerca, setNumAterramentosCerca] = useState(0);
  const [fotosAterramentosCerca, setFotosAterramentosCerca] = useState<Array<{
    numero: string; // Número do aterramento (ex: "1", "3") para exibir como A1, A3
    fotos: FotoData[];
  }>>([]);

  // Estados dinâmicos para Hastes e Termômetros (estrutura unificada por ponto) - OPCIONAL
  // Cada ponto (P1, P2, P3...) contém 1 foto de haste + 1 foto de termômetro
  const [numPontosHastesTermometros, setNumPontosHastesTermometros] = useState(0);
  const [pontosHastesTermometros, setPontosHastesTermometros] = useState<Array<{
    numero: string; // Número do ponto (ex: "1", "2", "3") para exibir como P1, P2, P3
    isAditivo: boolean; // Se é aditivo (não previsto no croqui)
    fotoHaste: FotoData[]; // 1 foto da haste aplicada
    fotoTermometro: FotoData[]; // 1 foto da medição do termômetro
  }>>([]);

  // Fotos ALTIMETRIA (4 campos)
  const [fotosAltimetriaLadoFonte, setFotosAltimetriaLadoFonte] = useState<FotoData[]>([]);
  const [fotosAltimetriaMedicaoFonte, setFotosAltimetriaMedicaoFonte] = useState<FotoData[]>([]);
  const [fotosAltimetriaLadoCarga, setFotosAltimetriaLadoCarga] = useState<FotoData[]>([]);
  const [fotosAltimetriaMedicaoCarga, setFotosAltimetriaMedicaoCarga] = useState<FotoData[]>([]);

  // Fotos VAZAMENTO E LIMPEZA DE TRANSFORMADOR (7 campos)
  const [fotosVazamentoEvidencia, setFotosVazamentoEvidencia] = useState<FotoData[]>([]);
  const [fotosVazamentoEquipamentosLimpeza, setFotosVazamentoEquipamentosLimpeza] = useState<FotoData[]>([]);
  const [fotosVazamentoTombamentoRetirado, setFotosVazamentoTombamentoRetirado] = useState<FotoData[]>([]);
  const [fotosVazamentoPlacaRetirado, setFotosVazamentoPlacaRetirado] = useState<FotoData[]>([]);
  const [fotosVazamentoTombamentoInstalado, setFotosVazamentoTombamentoInstalado] = useState<FotoData[]>([]);
  const [fotosVazamentoPlacaInstalado, setFotosVazamentoPlacaInstalado] = useState<FotoData[]>([]);
  const [fotosVazamentoInstalacao, setFotosVazamentoInstalacao] = useState<FotoData[]>([]);

  // Documentos PDF (DOCUMENTAÇÃO)
  const [docCadastroMedidor, setDocCadastroMedidor] = useState<FotoData[]>([]);
  const [docLaudoTransformador, setDocLaudoTransformador] = useState<FotoData[]>([]);
  const [docLaudoRegulador, setDocLaudoRegulador] = useState<FotoData[]>([]);
  const [docLaudoReligador, setDocLaudoReligador] = useState<FotoData[]>([]);
  const [docApr, setDocApr] = useState<FotoData[]>([]);
  const [docFvbt, setDocFvbt] = useState<FotoData[]>([]);
  const [docTermoDesistenciaLpt, setDocTermoDesistenciaLpt] = useState<FotoData[]>([]);
  const [docAutorizacaoPassagem, setDocAutorizacaoPassagem] = useState<FotoData[]>([]);
  const [docMateriaisPrevisto, setDocMateriaisPrevisto] = useState<FotoData[]>([]);
  const [docMateriaisRealizado, setDocMateriaisRealizado] = useState<FotoData[]>([]);

  // Identificação de Postes (Book de Aterramento, Fundação Especial)
  type PosteIdentificado = {
    numero: number;
    isAditivo: boolean;
  };
  const [posteNumeroInput, setPosteNumeroInput] = useState('');
  const [posteIsAditivo, setPosteIsAditivo] = useState(false);
  const [postesIdentificados, setPostesIdentificados] = useState<PosteIdentificado[]>([]);

  // Estados para Linha Viva / Cava em Rocha - Sistema de Múltiplos Postes
  type Poste = {
    id: string;
    numero: number;
    isAditivo: boolean;
    fotosAntes: FotoData[];
    fotosDurante: FotoData[];
    fotosDepois: FotoData[];
    fotosMedicao: FotoData[];
  };

  const [postesData, setPostesData] = useState<Poste[]>([
    {
      id: 'P1',
      numero: 1,
      isAditivo: false,
      fotosAntes: [],
      fotosDurante: [],
      fotosDepois: [],
      fotosMedicao: [],
    },
  ]);
  const [proximoNumeroPoste, setProximoNumeroPoste] = useState(2);

  const getPosteCodigo = (poste: Poste): string => {
    const numeroValido = Number.isFinite(poste.numero) && poste.numero > 0;
    const prefixo = poste.isAditivo ? 'AD-P' : 'P';
    return numeroValido ? `${prefixo}${poste.numero}` : `${prefixo}?`;
  };

  const getPosteIdPersistencia = (poste: Poste): string => {
    const codigo = getPosteCodigo(poste);
    return codigo.includes('?') ? poste.id : codigo;
  };


  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tempObraId, setTempObraId] = useState<string>(`temp_${Date.now()}`);
  const autoSaveObraIdRef = useRef<string>(`local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`);
  const [pendingObras, setPendingObras] = useState<PendingObra[]>([]);
  const [syncingPending, setSyncingPending] = useState(false);
  // ✅ Guardar serverId para não perder quando salvar novamente
  const [currentServerId, setCurrentServerId] = useState<string | null>(null);

  // Quando em modo de edição, usar o obraId real para salvar fotos corretamente
  const backupObraId = isEditMode && obraId ? obraId : tempObraId;

  const renderUtmBadge = (foto: FotoData) => {
    if (!foto.utmX || !foto.utmY) return null;
    return (
      <Text style={styles.photoLocationBadge} numberOfLines={1}>
        📍 UTM: X={foto.utmX.toFixed(0)} Y={foto.utmY.toFixed(0)} ({foto.utmZone})
      </Text>
    );
  };

  // Modals
  const [showServicoModal, setShowServicoModal] = useState(false);
  const [showEquipeModal, setShowEquipeModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPlacaScanner, setShowPlacaScanner] = useState(false);

  // Placa Overlay - para mostrar após tirar foto
  const [showPlacaOverlay, setShowPlacaOverlay] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    tipo: string;
    location: { latitude: number | null; longitude: number | null };
    photoMetadata: any;
    posteIndex?: number;
    seccionamentoIndex?: number;
    aterramentoCercaIndex?: number;
    pontoIndex?: number;
    emendaIndex?: number;
    podaIndex?: number;
  } | null>(null);

  // Modal de visualização de foto em tela cheia
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedPhotoForView, setSelectedPhotoForView] = useState<FotoData | null>(null);

  // Modal de confirmação de saída
  const [exitModalVisible, setExitModalVisible] = useState(false);

  // ✅ AUTO-SAVE: Ref para guardar função de salvamento silencioso
  // Usamos ref para evitar closures stale no callback do AppState
  const autoSaveRef = useRef<(() => Promise<void>) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // ✅ SCROLL: Ref para controlar scroll automático ao adicionar itens
  const scrollViewRef = useRef<ScrollView>(null);
  const [sectionLayouts, setSectionLayouts] = useState<{
    postes?: number;
    emendas?: number;
    podas?: number;
    seccionamentos?: number;
    aterramentos?: number;
  }>({});

  // Formatar data para exibição (DD/MM/AAAA)
  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'Selecione a data';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatReferenciaEntrePostes = (posteInicio?: string, posteFim?: string): string => {
    const inicio = posteInicio && posteInicio.trim() ? `P${posteInicio}` : 'P?';
    const fim = posteFim && posteFim.trim() ? `P${posteFim}` : 'P?';
    return `${inicio} - ${fim}`;
  };

  // Gerar dias do mês
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Abrir date picker e sincronizar com data atual
  const openDatePicker = () => {
    if (data) {
      const [year, month, day] = data.split('-');
      setSelectedDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
    }
    setShowDatePicker(true);
  };

  // Confirmar seleção de data
  const handleDateConfirm = () => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    setData(`${year}-${month}-${day}`);
    setShowDatePicker(false);
  };

  // Alterar componente da data (dia/mês/ano)
  const updateDateComponent = (component: 'day' | 'month' | 'year', value: number) => {
    const newDate = new Date(selectedDate);
    if (component === 'day') {
      newDate.setDate(value);
    } else if (component === 'month') {
      newDate.setMonth(value);
    } else {
      newDate.setFullYear(value);
    }
    setSelectedDate(newDate);
  };

  const handleTipoServicoSelect = (tipo: string) => {
    setTipoServico(tipo);
    setShowServicoModal(false);
  };

  // Handler para quando a placa for escaneada
  const handlePlacaDetected = (placaInfo: PlacaInfo) => {
    // Preencher campos automaticamente
    if (placaInfo.data) {
      // Converter DD.MM.YYYY para YYYY-MM-DD
      const [day, month, year] = placaInfo.data.split('.');
      if (day && month && year) {
        setData(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      }
    }

    if (placaInfo.obra) {
      setObra(placaInfo.obra);
    }

    setShowPlacaScanner(false);

    // Notificar usuário do sucesso
    Alert.alert(
      'Informações Capturadas!',
      `Obra: ${placaInfo.obra}\n` +
      `Data: ${placaInfo.data || 'Não detectada'}\n` +
      `Localização: ${placaInfo.localizacao || 'Não detectada'}\n` +
      `Município: ${placaInfo.municipio || 'Não detectado'}\n` +
      `Estado: ${placaInfo.estado || 'Não detectado'}\n\n` +
      'Verifique e complete os demais campos.',
      [{ text: 'OK' }]
    );
  };

  // Verificar tipo de serviço selecionado
  const isServicoChave = tipoServico === 'Abertura e Fechamento de Chave';
  const isServicoDitais = tipoServico === 'Ditais';
  const isServicoBookAterramento = tipoServico === 'Book de Aterramento';
  const isServicoTransformador = tipoServico === 'Transformador';
  const isServicoMedidor = tipoServico === 'Instalação do Medidor';
  const isServicoChecklist = tipoServico === 'Checklist de Fiscalização';
  const isServicoDocumentacao = tipoServico === 'Documentação';
  const isServicoAltimetria = tipoServico === 'Altimetria';
  const isServicoVazamento = tipoServico === 'Vazamento e Limpeza de Transformador';
  const isServicoLinhaViva = tipoServico === 'Linha Viva';
  const isServicoCavaRocha = tipoServico === 'Cava em Rocha';
  const isServicoFundacaoEspecial = tipoServico === 'Fundação Especial';
  const isServicoPostesIdentificacao = ['Book de Aterramento (legado)', 'Fundação Especial (legado)'].includes(tipoServico);
  const isServicoPostesComFotos = isServicoCavaRocha || isServicoLinhaViva || isServicoBookAterramento || isServicoFundacaoEspecial;
  const isServicoPadrao = !isServicoChave && !isServicoDitais && !isServicoBookAterramento && !isServicoFundacaoEspecial && !isServicoTransformador && !isServicoMedidor && !isServicoChecklist && !isServicoDocumentacao && !isServicoAltimetria && !isServicoVazamento && !isServicoPostesComFotos;

  const getPostePhotoSections = () => {
    if (isServicoBookAterramento) {
      return {
        primeira: 'Vala Aberta',
        segunda: 'Hastes',
        terceira: 'Vala Fechada',
        quarta: 'Medição Terrômetro',
      };
    }

    return {
      primeira: 'Antes',
      segunda: 'Durante',
      terceira: 'Depois',
      quarta: null,
    } as const;
  };

  // Carregar equipe da sessão automaticamente
  useEffect(() => {
    const loadEquipeLogada = async () => {
      try {
        const equipeLogada = await AsyncStorage.getItem('@equipe_logada');
        const userRole = await AsyncStorage.getItem('@user_role');

        const linhaVivaRegex = /^LV\b/i;

        // Detectar perfis especiais
        if (userRole === 'compressor') {
          setIsCompUser(true);
          setEquipe(equipeLogada || '');
          setEquipeExecutora('');
          setTipoServico('Cava em Rocha'); // Fixar serviço
        } else if (userRole === 'admin') {
          setIsAdminUser(true);
          setEquipe('');
          // Em modo de edição, não limpar equipeExecutora aqui — loadObraDataAsync vai restaurar da obra salva
          if (!isEditMode) setEquipeExecutora('');
          // Carregar equipes dinamicamente do Supabase
          try {
            const cached = await AsyncStorage.getItem('@equipes_cache');
            if (cached) setEquipesAdmin(JSON.parse(cached));

            const { data: equipesData } = await supabase
              .from('equipe_credenciais')
              .select('equipe_codigo, role')
              .eq('ativo', true);

            if (equipesData && equipesData.length > 0) {
              const roleWeight: Record<string, number> = { admin: 0, compressor: 1, equipe: 2 };
              const lista = Array.from(new Set(
                equipesData
                  .map((item: any) => String(item?.equipe_codigo || '').trim())
                  .filter(c => c.length > 0)
                  .sort((a: string, b: string) => {
                    const ra = equipesData.find((x: any) => x.equipe_codigo === a)?.role || 'equipe';
                    const rb = equipesData.find((x: any) => x.equipe_codigo === b)?.role || 'equipe';
                    const wa = roleWeight[ra] ?? 99;
                    const wb = roleWeight[rb] ?? 99;
                    return wa !== wb ? wa - wb : a.localeCompare(b);
                  })
              )) as string[];
              setEquipesAdmin(lista);
              await AsyncStorage.setItem('@equipes_cache', JSON.stringify(lista));
            }
          } catch {
            // Mantém lista atual (cache ou fallback)
          }
        } else if (equipeLogada) {
          setEquipe(equipeLogada);
          if (linhaVivaRegex.test(equipeLogada.trim())) {
            setIsLinhaVivaUser(true);
            setTipoServico('Linha Viva'); // Fixar serviço para perfis LV
          }
        } else {
          // Se não houver equipe logada, redirecionar para login
          Alert.alert('Sessão expirada', 'Por favor, faça login novamente.');
          router.replace('/login');
        }
      } catch (error) {
        console.error('Erro ao carregar equipe logada:', error);
      }
    };
    loadEquipeLogada();
  }, []);

  // ✅ AUTO-SAVE: Salvar automaticamente quando app vai para background
  // Isso evita perda de fotos quando o SO mata o processo
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // Detectar quando app vai para background ou inactive
      if (
        appStateRef.current === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        console.log('📱 App indo para background - executando auto-save...');

        // Chamar a função de salvamento silencioso
        if (autoSaveRef.current && autoSaveEnabled) {
          try {
            await autoSaveRef.current();
            console.log('✅ Auto-save concluído com sucesso');
          } catch (error) {
            console.error('❌ Erro no auto-save:', error);
          }
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [autoSaveEnabled]);

  // ✅ AUTO-SAVE PERIÓDICO: Salvar a cada 2 minutos automaticamente
  // Isso garante que dados não sejam perdidos mesmo se o app crashar
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const AUTO_SAVE_INTERVAL = 2 * 60 * 1000; // 2 minutos

    const intervalId = setInterval(async () => {
      console.log('⏰ Auto-save periódico disparado (2 minutos)');

      if (autoSaveRef.current) {
        try {
          await autoSaveRef.current();
          console.log('✅ Auto-save periódico concluído');
        } catch (error) {
          console.error('❌ Erro no auto-save periódico:', error);
        }
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      clearInterval(intervalId);
      console.log('🛑 Auto-save periódico cancelado');
    };
  }, [autoSaveEnabled]);

  // ✅ AUTO-SAVE: Atualizar função de salvamento silencioso sempre que os estados mudarem
  // Usamos useCallback para criar uma função estável que acessa os valores atuais
  const performAutoSave = useCallback(async () => {
    // Número de obra é obrigatório para salvar rascunho (evita criar entradas vazias no histórico)
    if (!obra) {
      console.log('⚠️ Auto-save ignorado: número de obra não preenchido');
      return;
    }

    // ✅ Verificar se há QUALQUER informação para salvar (muito menos restritivo)
    const hasAnyData =
      tipoServico ||
      fotosAntes.length > 0 ||
      fotosDurante.length > 0 ||
      fotosDepois.length > 0 ||
      fotosAbertura.length > 0 ||
      fotosFechamento.length > 0 ||
      fotosDitaisAbertura.length > 0 ||
      fotosTransformadorLaudo.length > 0 ||
      docCadastroMedidor.length > 0 ||
      fotosPostes.some(p => p.posteInteiro.length > 0 || p.descricao.length > 0 || p.engaste.length > 0 || p.conexao1.length > 0 || p.conexao2.length > 0 || p.maiorEsforco.length > 0 || p.menorEsforco.length > 0) ||
      fotosSeccionamentos.some(s => s.fotos.length > 0) ||
      fotosEmendas.some(e => e.fotos.length > 0) ||
      fotosPodas.some(p => p.fotos.length > 0) ||
      fotosAterramentosCerca.some(a => a.fotos.length > 0) ||
      pontosHastesTermometros.some(p => p.fotoHaste.length > 0 || p.fotoTermometro.length > 0) ||
      numPostes > 0 ||
      numSeccionamentos > 0 ||
      numEmendas > 0 ||
      numPodas > 0 ||
      numAterramentosCerca > 0;

    if (!hasAnyData) {
      console.log('⚠️ Auto-save ignorado: nenhum dado preenchido');
      return;
    }

    console.log('💾 Executando auto-save silencioso...');
    console.log('   Data:', data);
    console.log('   Obra:', obra);
    console.log('   Responsável:', responsavel);
    console.log('   Tipo:', tipoServico);
    console.log('   Fotos antes:', fotosAntes.length);
    console.log('   Fotos durante:', fotosDurante.length);
    console.log('   Fotos depois:', fotosDepois.length);

    const finalObraId = isEditMode && obraId
      ? obraId
      : autoSaveObraIdRef.current;

    const extractPhotoDataFull = (fotos: FotoData[]) => {
      return fotos.map(f => {
        if ((f as any)._originalData) {
          return (f as any)._originalData;
        }
        return {
          id: f.photoId,
          latitude: f.latitude,
          longitude: f.longitude,
          utmX: f.utmX,
          utmY: f.utmY,
          utmZone: f.utmZone
        };
      }).filter(Boolean);
    };

    // Extrair photoIds de todos os arrays de fotos
    const photoIds = {
      fotos_antes: fotosAntes.map(f => f.photoId).filter(Boolean),
      fotos_durante: fotosDurante.map(f => f.photoId).filter(Boolean),
      fotos_depois: fotosDepois.map(f => f.photoId).filter(Boolean),
      fotos_abertura: fotosAbertura.map(f => f.photoId).filter(Boolean),
      fotos_fechamento: fotosFechamento.map(f => f.photoId).filter(Boolean),
      fotos_ditais_abertura: fotosDitaisAbertura.map(f => f.photoId).filter(Boolean),
      fotos_ditais_impedir: fotosDitaisImpedir.map(f => f.photoId).filter(Boolean),
      fotos_ditais_testar: fotosDitaisTestar.map(f => f.photoId).filter(Boolean),
      fotos_ditais_aterrar: fotosDitaisAterrar.map(f => f.photoId).filter(Boolean),
      fotos_ditais_sinalizar: fotosDitaisSinalizar.map(f => f.photoId).filter(Boolean),
      fotos_aterramento_vala_aberta: fotosAterramentoValaAberta.map(f => f.photoId).filter(Boolean),
      fotos_aterramento_hastes: fotosAterramentoHastes.map(f => f.photoId).filter(Boolean),
      fotos_aterramento_vala_fechada: fotosAterramentoValaFechada.map(f => f.photoId).filter(Boolean),
      fotos_aterramento_medicao: fotosAterramentoMedicao.map(f => f.photoId).filter(Boolean),
      fotos_transformador_laudo: fotosTransformadorLaudo.map(f => f.photoId).filter(Boolean),
      fotos_transformador_componente_instalado: fotosTransformadorComponenteInstalado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_tombamento_instalado: fotosTransformadorTombamentoInstalado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_tape: fotosTransformadorTape.map(f => f.photoId).filter(Boolean),
      fotos_transformador_placa_instalado: fotosTransformadorPlacaInstalado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_instalado: fotosTransformadorInstalado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_conexoes_primarias_instalado: fotosTransformadorConexoesPrimariasInstalado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_conexoes_secundarias_instalado: fotosTransformadorConexoesSecundariasInstalado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_antes_retirar: fotosTransformadorAntesRetirar.map(f => f.photoId).filter(Boolean),
      fotos_transformador_laudo_retirado: fotosTransformadorLaudoRetirado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_tombamento_retirado: fotosTransformadorTombamentoRetirado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_placa_retirado: fotosTransformadorPlacaRetirado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_conexoes_primarias_retirado: fotosTransformadorConexoesPrimariasRetirado.map(f => f.photoId).filter(Boolean),
      fotos_transformador_conexoes_secundarias_retirado: fotosTransformadorConexoesSecundariasRetirado.map(f => f.photoId).filter(Boolean),
      fotos_medidor_padrao: fotosMedidorPadrao.map(f => f.photoId).filter(Boolean),
      fotos_medidor_leitura: fotosMedidorLeitura.map(f => f.photoId).filter(Boolean),
      fotos_medidor_selo_born: fotosMedidorSeloBorn.map(f => f.photoId).filter(Boolean),
      fotos_medidor_selo_caixa: fotosMedidorSeloCaixa.map(f => f.photoId).filter(Boolean),
      fotos_medidor_identificador_fase: fotosMedidorIdentificadorFase.map(f => f.photoId).filter(Boolean),
      fotos_checklist_croqui: fotosChecklistCroqui.map(f => f.photoId).filter(Boolean),
      fotos_checklist_panoramica_inicial: fotosChecklistPanoramicaInicial.map(f => f.photoId).filter(Boolean),
      fotos_checklist_chede: fotosChecklistChaveComponente.map(f => f.photoId).filter(Boolean),
      fotos_checklist_aterramento_cerca: fotosAterramentosCerca.flatMap(aterr => aterr.fotos.map(f => f.photoId).filter(Boolean) as string[]),
      fotos_checklist_padrao_geral: fotosChecklistPadraoGeral.map(f => f.photoId).filter(Boolean),
      fotos_checklist_padrao_interno: fotosChecklistPadraoInterno.map(f => f.photoId).filter(Boolean),
      fotos_checklist_frying: fotosChecklistFrying.map(f => f.photoId).filter(Boolean),
      fotos_checklist_abertura_fechamento_pulo: fotosChecklistAberturaFechamentoPulo.map(f => f.photoId).filter(Boolean),
      fotos_checklist_panoramica_final: fotosChecklistPanoramicaFinal.map(f => f.photoId).filter(Boolean),
      fotos_checklist_postes: fotosPostes.flatMap(poste => [
        ...poste.posteInteiro.map(f => f.photoId).filter(Boolean) as string[],
        ...poste.descricao.map(f => f.photoId).filter(Boolean) as string[],
        ...poste.engaste.map(f => f.photoId).filter(Boolean) as string[],
        ...poste.conexao1.map(f => f.photoId).filter(Boolean) as string[],
        ...poste.conexao2.map(f => f.photoId).filter(Boolean) as string[],
        ...poste.maiorEsforco.map(f => f.photoId).filter(Boolean) as string[],
        ...poste.menorEsforco.map(f => f.photoId).filter(Boolean) as string[],
      ]),
      fotos_checklist_seccionamentos: [
        ...fotosSeccionamentos.flatMap(sec => sec.fotos.map(f => f.photoId).filter(Boolean) as string[]),
        ...fotosEmendas.flatMap(emenda => emenda.fotos.map(f => f.photoId).filter(Boolean) as string[]),
        ...fotosPodas.flatMap(poda => poda.fotos.map(f => f.photoId).filter(Boolean) as string[]),
      ],
      fotos_altimetria_lado_fonte: fotosAltimetriaLadoFonte.map(f => f.photoId).filter(Boolean),
      fotos_altimetria_medicao_fonte: fotosAltimetriaMedicaoFonte.map(f => f.photoId).filter(Boolean),
      fotos_altimetria_lado_carga: fotosAltimetriaLadoCarga.map(f => f.photoId).filter(Boolean),
      fotos_altimetria_medicao_carga: fotosAltimetriaMedicaoCarga.map(f => f.photoId).filter(Boolean),
      fotos_vazamento_evidencia: fotosVazamentoEvidencia.map(f => f.photoId).filter(Boolean),
      fotos_vazamento_equipamentos_limpeza: fotosVazamentoEquipamentosLimpeza.map(f => f.photoId).filter(Boolean),
      fotos_vazamento_tombamento_retirado: fotosVazamentoTombamentoRetirado.map(f => f.photoId).filter(Boolean),
      fotos_vazamento_placa_retirado: fotosVazamentoPlacaRetirado.map(f => f.photoId).filter(Boolean),
      fotos_vazamento_tombamento_instalado: fotosVazamentoTombamentoInstalado.map(f => f.photoId).filter(Boolean),
      fotos_vazamento_placa_instalado: fotosVazamentoPlacaInstalado.map(f => f.photoId).filter(Boolean),
      fotos_vazamento_instalacao: fotosVazamentoInstalacao.map(f => f.photoId).filter(Boolean),
      doc_cadastro_medidor: docCadastroMedidor.map(f => f.photoId).filter(Boolean),
      doc_laudo_transformador: docLaudoTransformador.map(f => f.photoId).filter(Boolean),
      doc_laudo_regulador: docLaudoRegulador.map(f => f.photoId).filter(Boolean),
      doc_laudo_religador: docLaudoReligador.map(f => f.photoId).filter(Boolean),
      doc_apr: docApr.map(f => f.photoId).filter(Boolean),
      doc_fvbt: docFvbt.map(f => f.photoId).filter(Boolean),
      doc_termo_desistencia_lpt: docTermoDesistenciaLpt.map(f => f.photoId).filter(Boolean),
      doc_autorizacao_passagem: docAutorizacaoPassagem.map(f => f.photoId).filter(Boolean),
      doc_materiais_previsto: docMateriaisPrevisto.map(f => f.photoId).filter(Boolean),
      doc_materiais_realizado: docMateriaisRealizado.map(f => f.photoId).filter(Boolean),
    };

    const obraData: any = {
      id: finalObraId,
      ...((isEditMode && currentServerId) && { serverId: currentServerId }),
      obra: obra?.trim() || '',
      data: data || '',
      responsavel: isCompUser ? (equipe || 'COM-CZ') : (responsavel || ''),
      equipe: isAdminUser ? (equipeExecutora || '') : (equipe || ''),
      tipo_servico: tipoServico || '',
      status: 'rascunho' as const,
      origem: 'offline' as const,
      created_at: new Date().toISOString(),
      creator_role: isCompUser ? 'compressor' : (isAdminUser ? 'admin' : 'equipe'),
      created_by_admin: isAdminUser ? equipe : null, // Salva código do admin (ex: Admin-Pereira)
      transformador_status: transformadorStatus,
      num_postes: numPostes,
      num_seccionamentos: numSeccionamentos,
      num_aterramento_cerca: numAterramentosCerca,
      auto_saved: true, // Marcar como auto-save para identificação
      ...photoIds,
      ...(isServicoPostesIdentificacao && postesIdentificados.length > 0 && {
        postes_data: postesIdentificados.map(poste => ({
          id: poste.isAditivo ? `AD-P${poste.numero}` : `P${poste.numero}`,
          numero: poste.numero,
          isAditivo: poste.isAditivo,
          fotos_antes: [],
          fotos_durante: [],
          fotos_depois: [],
          fotos_medicao: [],
          observacao: '',
        })),
      }),
      ...(isServicoPostesComFotos && {
        postes_data: postesData.map(poste => ({
          id: getPosteIdPersistencia(poste),
          numero: poste.numero,
          isAditivo: poste.isAditivo || false,
          fotos_antes: poste.fotosAntes.map(f => f.photoId).filter(Boolean),
          fotos_durante: poste.fotosDurante.map(f => f.photoId).filter(Boolean),
          fotos_depois: poste.fotosDepois.map(f => f.photoId).filter(Boolean),
          fotos_medicao: poste.fotosMedicao.map(f => f.photoId).filter(Boolean),
        })),
      }),
      ...(isServicoChecklist && {
        checklist_postes_data: fotosPostes.map((poste, index) => ({
          id: `poste_${index + 1}`,
          numero: poste.numero,
          status: poste.status,
          isAditivo: poste.isAditivo || false,
          posteInteiro: extractPhotoDataFull(poste.posteInteiro),
          descricao: extractPhotoDataFull(poste.descricao),
          engaste: extractPhotoDataFull(poste.engaste),
          conexao1: extractPhotoDataFull(poste.conexao1),
          conexao2: extractPhotoDataFull(poste.conexao2),
          maiorEsforco: extractPhotoDataFull(poste.maiorEsforco),
          menorEsforco: extractPhotoDataFull(poste.menorEsforco),
        })),
        checklist_seccionamentos_data: [
          ...fotosSeccionamentos.map((sec, index) => ({
            id: `seccionamento_${index + 1}`,
            tipo: 'seccionamento',
            numero: parseInt(sec.numero) || (index + 1),
            fotos: extractPhotoDataFull(sec.fotos),
          })),
          ...fotosEmendas.map((emenda, index) => ({
            id: `emenda_${index + 1}`,
            tipo: 'emenda',
            numero: parseInt(emenda.numero) || (index + 1),
            posteInicio: parseInt(emenda.posteInicio) || null,
            posteFim: parseInt(emenda.posteFim) || null,
            fotos: extractPhotoDataFull(emenda.fotos),
          })),
          ...fotosPodas.map((poda, index) => ({
            id: `poda_${index + 1}`,
            tipo: 'poda',
            numero: parseInt(poda.numero) || (index + 1),
            posteInicio: parseInt(poda.posteInicio) || null,
            posteFim: parseInt(poda.posteFim) || null,
            fotos: extractPhotoDataFull(poda.fotos),
          })),
        ],
        checklist_aterramentos_cerca_data: fotosAterramentosCerca.map((aterr, index) => ({
          id: `aterramento_${index + 1}`,
          numero: parseInt(aterr.numero) || (index + 1),
          fotos: extractPhotoDataFull(aterr.fotos),
        })),
        checklist_hastes_termometros_data: pontosHastesTermometros.map((ponto, index) => ({
          id: `ponto_${index + 1}`,
          numero: ponto.numero || `${index + 1}`,
          isAditivo: ponto.isAditivo || false,
          fotoHaste: extractPhotoDataFull(ponto.fotoHaste),
          fotoTermometro: extractPhotoDataFull(ponto.fotoTermometro),
        })),
      }),
    };

    try {
      const savedObraId = await saveObraLocal(obraData);
      console.log(`✅ Auto-save concluído: ${savedObraId}`);

      // Atualizar obraId das fotos no photo-backup se necessário
      if (backupObraId !== savedObraId) {
        try {
          const qtd = await updatePhotosObraId(backupObraId, savedObraId);
          console.log(`✅ ${qtd} foto(s) atualizadas com novo obraId`);
        } catch (error) {
          console.error('❌ Erro ao atualizar obraId das fotos:', error);
        }
      }

      // ✅ Mostrar feedback visual discreto
      const totalFotosPostes = isServicoPostesComFotos
        ? postesData.reduce(
            (acc, poste) =>
              acc +
              poste.fotosAntes.length +
              poste.fotosDurante.length +
              poste.fotosDepois.length +
              (isServicoBookAterramento ? poste.fotosMedicao.length : 0),
            0
          )
        : 0;
      const totalFotos = Object.values(photoIds).reduce((acc, arr) => acc + arr.length, 0) + totalFotosPostes;
      const mensagem = totalFotos > 0
        ? `Rascunho salvo automaticamente (${totalFotos} foto${totalFotos > 1 ? 's' : ''})`
        : 'Rascunho salvo automaticamente';

      showToast(mensagem, 'info');

    } catch (error) {
      console.error('❌ Erro no auto-save:', error);
      // Não mostrar erro para usuário, apenas logar
      throw error;
    }
  }, [
    showToast, // Adicionar showToast às dependências
    data, obra, responsavel, equipe, equipeExecutora, tipoServico, isCompUser, isAdminUser, isEditMode, obraId,
    currentServerId, transformadorStatus, numPostes, numSeccionamentos, numEmendas, numPodas, numAterramentosCerca,
    backupObraId,
    isServicoChecklist, isServicoCavaRocha, isServicoBookAterramento, isServicoPostesIdentificacao,
    postesData, postesIdentificados,
    fotosAntes, fotosDurante, fotosDepois, fotosAbertura, fotosFechamento,
    fotosDitaisAbertura, fotosDitaisImpedir, fotosDitaisTestar, fotosDitaisAterrar, fotosDitaisSinalizar,
    fotosAterramentoValaAberta, fotosAterramentoHastes, fotosAterramentoValaFechada, fotosAterramentoMedicao,
    fotosTransformadorLaudo, fotosTransformadorComponenteInstalado, fotosTransformadorTombamentoInstalado,
    fotosTransformadorTape, fotosTransformadorPlacaInstalado, fotosTransformadorInstalado,
    fotosTransformadorConexoesPrimariasInstalado, fotosTransformadorConexoesSecundariasInstalado,
    fotosTransformadorAntesRetirar, fotosTransformadorLaudoRetirado, fotosTransformadorTombamentoRetirado,
    fotosTransformadorPlacaRetirado, fotosTransformadorConexoesPrimariasRetirado, fotosTransformadorConexoesSecundariasRetirado,
    fotosMedidorPadrao, fotosMedidorLeitura, fotosMedidorSeloBorn, fotosMedidorSeloCaixa, fotosMedidorIdentificadorFase,
    fotosChecklistCroqui, fotosChecklistPanoramicaInicial, fotosChecklistChaveComponente, fotosChecklistPadraoGeral,
    fotosChecklistPadraoInterno, fotosChecklistFrying, fotosChecklistAberturaFechamentoPulo, fotosChecklistPanoramicaFinal,
    fotosAltimetriaLadoFonte, fotosAltimetriaMedicaoFonte, fotosAltimetriaLadoCarga, fotosAltimetriaMedicaoCarga,
    fotosVazamentoEvidencia, fotosVazamentoEquipamentosLimpeza, fotosVazamentoTombamentoRetirado,
    fotosVazamentoPlacaRetirado, fotosVazamentoTombamentoInstalado, fotosVazamentoPlacaInstalado, fotosVazamentoInstalacao,
    fotosPostes, fotosSeccionamentos, fotosEmendas, fotosPodas, fotosAterramentosCerca, pontosHastesTermometros,
    docCadastroMedidor, docLaudoTransformador, docLaudoRegulador, docLaudoReligador,
    docApr, docFvbt, docTermoDesistenciaLpt, docAutorizacaoPassagem, docMateriaisPrevisto, docMateriaisRealizado,
  ]);

  // Atualizar a referência sempre que a função mudar
  useEffect(() => {
    autoSaveRef.current = performAutoSave;
  }, [performAutoSave]);

  // Evita reaproveitar serverId de uma edição anterior ao iniciar novo book.
  useEffect(() => {
    if (!isEditMode) {
      setCurrentServerId(null);
    }
  }, [isEditMode]);

  // Carregar dados da obra em modo de edição
  useEffect(() => {
    if (isEditMode && params.obraData) {
      const loadObraDataAsync = async () => {
        try {
          const obraData = JSON.parse(params.obraData);

          // DEBUG: Mostrar o que está sendo carregado
          console.log('🔍 DEBUG loadObraDataAsync - Dados recebidos:');
          console.log('   obraData.id:', obraData.id);
          console.log('   obraData.tipo_servico:', obraData.tipo_servico);
          console.log('   obraData.fotos_antes:', obraData.fotos_antes?.length || 0, obraData.fotos_antes);
          console.log('   obraData.fotos_durante:', obraData.fotos_durante?.length || 0, obraData.fotos_durante);
          console.log('   obraData.fotos_depois:', obraData.fotos_depois?.length || 0, obraData.fotos_depois);
          console.log('   obraData.fotos_ditais_abertura:', obraData.fotos_ditais_abertura?.length || 0, obraData.fotos_ditais_abertura);
          console.log('   obraData.fotos_transformador_laudo:', obraData.fotos_transformador_laudo?.length || 0, obraData.fotos_transformador_laudo);
          console.log('   obraData.fotos_medidor_padrao:', obraData.fotos_medidor_padrao?.length || 0, obraData.fotos_medidor_padrao);
          console.log('   🔍 CHECKLIST DATA:');
          console.log('   obraData.checklist_postes_data:', obraData.checklist_postes_data);
          console.log('   obraData.checklist_seccionamentos_data:', obraData.checklist_seccionamentos_data);
          console.log('   obraData.checklist_aterramentos_cerca_data:', obraData.checklist_aterramentos_cerca_data);

          setObraId(obraData.id);
          setData(obraData.data);
          setObra(obraData.obra);
          setResponsavel(obraData.responsavel);
          setTipoServico(obraData.tipo_servico);
          if (obraData.equipe) {
            setEquipeExecutora(obraData.equipe);
          }

          // ✅ CRÍTICO: Guardar serverId para não criar duplicatas ao salvar
          if (obraData.serverId) {
            setCurrentServerId(obraData.serverId);
            console.log('📌 ServerId carregado:', obraData.serverId);
          }

          // ✅ Carregar fotos do photo-backup usando os IDs salvos na obra
          console.log('📸 Buscando fotos da obra:', obraData.id);

          // Coletar todos os IDs de fotos na obra para o fallback
          const allPhotoIds: string[] = [
            // Fotos padrão
            ...(obraData.fotos_antes || []),
            ...(obraData.fotos_durante || []),
            ...(obraData.fotos_depois || []),
            ...(obraData.fotos_abertura || []),
            ...(obraData.fotos_fechamento || []),
            // DITAIS
            ...(obraData.fotos_ditais_abertura || []),
            ...(obraData.fotos_ditais_impedir || []),
            ...(obraData.fotos_ditais_testar || []),
            ...(obraData.fotos_ditais_aterrar || []),
            ...(obraData.fotos_ditais_sinalizar || []),
            // Aterramento
            ...(obraData.fotos_aterramento_vala_aberta || []),
            ...(obraData.fotos_aterramento_hastes || []),
            ...(obraData.fotos_aterramento_vala_fechada || []),
            ...(obraData.fotos_aterramento_medicao || []),
            // Transformador
            ...(obraData.fotos_transformador_laudo || []),
            ...(obraData.fotos_transformador_componente_instalado || []),
            ...(obraData.fotos_transformador_tombamento_instalado || []),
            ...(obraData.fotos_transformador_tape || []),
            ...(obraData.fotos_transformador_placa_instalado || []),
            ...(obraData.fotos_transformador_instalado || []),
            ...(obraData.fotos_transformador_conexoes_primarias_instalado || []),
            ...(obraData.fotos_transformador_conexoes_secundarias_instalado || []),
            ...(obraData.fotos_transformador_antes_retirar || []),
            ...(obraData.fotos_transformador_laudo_retirado || []),
            ...(obraData.fotos_transformador_tombamento_retirado || []),
            ...(obraData.fotos_transformador_placa_retirado || []),
            ...(obraData.fotos_transformador_conexoes_primarias_retirado || []),
            ...(obraData.fotos_transformador_conexoes_secundarias_retirado || []),
            // Medidor
            ...(obraData.fotos_medidor_padrao || []),
            ...(obraData.fotos_medidor_leitura || []),
            ...(obraData.fotos_medidor_selo_born || []),
            ...(obraData.fotos_medidor_selo_caixa || []),
            ...(obraData.fotos_medidor_identificador_fase || []),
            // Checklist de Fiscalização
            ...(obraData.fotos_checklist_croqui || []),
            ...(obraData.fotos_checklist_panoramica_inicial || []),
            ...(obraData.fotos_checklist_chede || []),
            ...(obraData.fotos_checklist_padrao_geral || []),
            ...(obraData.fotos_checklist_padrao_interno || []),
            ...(obraData.fotos_checklist_panoramica_final || []),
            ...(obraData.fotos_checklist_postes || []),
            ...(obraData.fotos_checklist_seccionamentos || []),
            ...(obraData.fotos_checklist_aterramento_cerca || []),
            // Altimetria
            ...(obraData.fotos_altimetria_lado_fonte || []),
            ...(obraData.fotos_altimetria_medicao_fonte || []),
            ...(obraData.fotos_altimetria_lado_carga || []),
            ...(obraData.fotos_altimetria_medicao_carga || []),
            // Vazamento
            ...(obraData.fotos_vazamento_evidencia || []),
            ...(obraData.fotos_vazamento_equipamentos_limpeza || []),
            ...(obraData.fotos_vazamento_tombamento_retirado || []),
            ...(obraData.fotos_vazamento_placa_retirado || []),
            ...(obraData.fotos_vazamento_tombamento_instalado || []),
            ...(obraData.fotos_vazamento_placa_instalado || []),
            ...(obraData.fotos_vazamento_instalacao || []),
            // Documentação
            ...(obraData.doc_laudo_transformador || []),
            ...(obraData.doc_cadastro_medidor || []),
            ...(obraData.doc_apr || []),
            ...(obraData.doc_laudo_regulador || []),
            ...(obraData.doc_laudo_religador || []),
            ...(obraData.doc_fvbt || []),
            ...(obraData.doc_termo_desistencia_lpt || []),
            ...(obraData.doc_autorizacao_passagem || []),
            // Postes checklist (extrair IDs das estruturas)
            ...(obraData.checklist_postes_data || []).flatMap((poste: any) => [
              ...(poste.posteInteiro || []),
              ...(poste.engaste || []),
              ...(poste.conexao1 || []),
              ...(poste.conexao2 || []),
              ...(poste.maiorEsforco || []),
              ...(poste.menorEsforco || []),
            ]),
            ...(obraData.checklist_seccionamentos_data || []).flatMap((sec: any) => sec.fotos || []),
            ...(obraData.checklist_aterramentos_cerca_data || []).flatMap((aterr: any) => aterr.fotos || []),
            // Linha Viva / Cava em Rocha (postes_data)
            ...(obraData.postes_data || []).flatMap((poste: any) => [
              ...(poste.fotos_antes || []),
              ...(poste.fotos_durante || []),
              ...(poste.fotos_depois || []),
              ...(poste.fotos_medicao || []),
            ]),
          ].filter(id => typeof id === 'string');

          let localPhotos: any[] = [];

          try {
            // Usar função com fallback para encontrar fotos mesmo quando obraId mudou
            // IMPORTANTE: Passar serverId para buscar fotos que foram atualizadas após sync
            localPhotos = await getPhotosByObraWithFallback(obraData.id, allPhotoIds, obraData.serverId);
            console.log(`✅ ${localPhotos.length} foto(s) encontradas no photo-backup (obraId: ${obraData.id}, serverId: ${obraData.serverId || 'nenhum'})`);
          } catch (err: any) {
            console.error('❌ Erro ao carregar fotos:', err);
            console.warn('⚠️ Continuando sem fotos. Você pode adicionar novas fotos normalmente.');

            // NÃO lançar erro - permitir que a obra abra sem fotos
            Alert.alert(
              'Aviso',
              'Não foi possível carregar as fotos existentes.\n\nVocê pode continuar editando e adicionar novas fotos.',
              [{ text: 'OK' }]
            );
          }

          // Helper para buscar foto por ID com fallback
          const findPhotoById = (photoId: string): any | null => {
            // Busca direta pelo ID
            let photo = localPhotos.find(p => p.id === photoId);
            if (photo) return photo;

            // Se não encontrou, pode ser que o obraId no ID da foto é diferente do obraId atual
            // Tentar buscar por tipo e index extraídos do ID
            // Formato do ID: obraId_tipo_index_timestamp
            const match = photoId.match(/^(.+)_(\d+)_(\d+)$/);
            if (match) {
              const prefixWithType = match[1];
              const photoIndex = parseInt(match[2], 10);

              // Buscar tipo de forma dinâmica para cobrir todos os módulos (incluindo aterramento)
              const availableTypes = Array.from(
                new Set(localPhotos.map(p => p.type).filter(Boolean))
              ).sort((a, b) => b.length - a.length);

              const matchedType = availableTypes.find(
                (type) => prefixWithType === type || prefixWithType.endsWith(`_${type}`)
              );

              if (matchedType) {
                photo = localPhotos.find(p => p.type === matchedType && p.index === photoIndex);
                if (photo) {
                  console.log(`🔄 [mapPhotos] Encontrou foto por tipo+index: ${matchedType}[${photoIndex}]`);
                  return photo;
                }
              }
            }

            return null;
          };

          // Helper: Converter IDs ou Objetos em FotoData
          const mapPhotos = (photoIds: string[] | any[], fieldName: string = 'fotos') => {
            try {
              if (!Array.isArray(photoIds) || photoIds.length === 0) {
                return [];
              }

              const result = photoIds.map((item, index) => {
                try {
                  // CASO 1: String (ID) - buscar no photo-backup
                  if (typeof item === 'string') {
                    const photo = findPhotoById(item);
                    if (photo) {
                      // Priorizar URL do Supabase
                      const uri = photo.supabaseUrl || photo.compressedPath || photo.originalPath;
                      if (uri) {
                        return {
                          uri,
                          latitude: photo.latitude,
                          longitude: photo.longitude,
                          utmX: photo.utmX,
                          utmY: photo.utmY,
                          utmZone: photo.utmZone,
                          photoId: photo.id,
                        };
                      }
                    }
                    // ✅ CRÍTICO: Preservar photoId mesmo quando não encontra a foto
                    // Isso evita perder o ID ao pausar a obra novamente
                    console.warn(`⚠️ [mapPhotos] Foto não encontrada para ${fieldName}: ${item}`);
                    console.warn(`   ℹ️ Mantendo photoId para não perder a referência`);
                    return {
                      uri: '', // URI vazia - foto não será exibida
                      latitude: null,
                      longitude: null,
                      utmX: null,
                      utmY: null,
                      utmZone: null,
                      photoId: item, // ✅ Preservar o ID original
                      _notFound: true, // Flag indicando que a foto não foi encontrada
                    };
                  }

                  // CASO 2: Objeto com URL (foto sincronizada do banco)
                  if (typeof item === 'object' && item !== null && item.url) {
                    // Criar um ID temporário baseado na URL para poder refazer referência
                    const tempId = `synced_${item.url.split('/').pop()}`;
                    return {
                      uri: item.url,
                      latitude: item.latitude || null,
                      longitude: item.longitude || null,
                      utmX: item.utmX || null,
                      utmY: item.utmY || null,
                      utmZone: item.utmZone || null,
                      photoId: tempId,
                      _originalData: item, // Guardar dados originais para resalvar
                    };
                  }

                  // CASO 3: Objeto com ID - buscar no photo-backup
                  if (typeof item === 'object' && item !== null && item.id) {
                    const photo = findPhotoById(item.id);
                    if (photo) {
                      const uri = photo.supabaseUrl || photo.compressedPath || photo.originalPath;
                      if (uri) {
                        return {
                          uri,
                          latitude: photo.latitude,
                          longitude: photo.longitude,
                          utmX: photo.utmX,
                          utmY: photo.utmY,
                          utmZone: photo.utmZone,
                          photoId: photo.id,
                        };
                      }
                    }
                    // ✅ CRÍTICO: Preservar ID do objeto mesmo quando não encontra
                    console.warn(`⚠️ [mapPhotos] Foto não encontrada por item.id: ${item.id}`);
                    return {
                      uri: '',
                      latitude: null,
                      longitude: null,
                      utmX: null,
                      utmY: null,
                      utmZone: null,
                      photoId: item.id,
                      _notFound: true,
                    };
                  }

                  return null;
                } catch (err) {
                  return null;
                }
              }).filter(Boolean) as FotoData[];

              return result;
            } catch (err) {
              console.error(`❌ Erro ao mapear ${fieldName}:`, err);
              return [];
            }
          };

          // Carregar fotos existentes (arrays de IDs) - COM TRATAMENTO DE ERRO INDIVIDUAL
          try {
            if (obraData.fotos_antes?.length) setFotosAntes(mapPhotos(obraData.fotos_antes, 'fotos_antes'));
            if (obraData.fotos_durante?.length) setFotosDurante(mapPhotos(obraData.fotos_durante, 'fotos_durante'));
            if (obraData.fotos_depois?.length) setFotosDepois(mapPhotos(obraData.fotos_depois, 'fotos_depois'));
            if (obraData.fotos_abertura?.length) setFotosAbertura(mapPhotos(obraData.fotos_abertura, 'fotos_abertura'));
            if (obraData.fotos_fechamento?.length) setFotosFechamento(mapPhotos(obraData.fotos_fechamento, 'fotos_fechamento'));
          } catch (err) {
            console.error('❌ Erro ao carregar fotos padrão:', err);
          }

          // Carregar fotos DITAIS
          try {
            if (obraData.fotos_ditais_abertura?.length) setFotosDitaisAbertura(mapPhotos(obraData.fotos_ditais_abertura, 'fotos_ditais_abertura'));
            if (obraData.fotos_ditais_impedir?.length) setFotosDitaisImpedir(mapPhotos(obraData.fotos_ditais_impedir, 'fotos_ditais_impedir'));
            if (obraData.fotos_ditais_testar?.length) setFotosDitaisTestar(mapPhotos(obraData.fotos_ditais_testar, 'fotos_ditais_testar'));
            if (obraData.fotos_ditais_aterrar?.length) setFotosDitaisAterrar(mapPhotos(obraData.fotos_ditais_aterrar, 'fotos_ditais_aterrar'));
            if (obraData.fotos_ditais_sinalizar?.length) setFotosDitaisSinalizar(mapPhotos(obraData.fotos_ditais_sinalizar, 'fotos_ditais_sinalizar'));
          } catch (err) {
            console.error('❌ Erro ao carregar fotos DITAIS:', err);
          }

          // Carregar fotos de aterramento
          try {
            if (obraData.fotos_aterramento_vala_aberta?.length) setFotosAterramentoValaAberta(mapPhotos(obraData.fotos_aterramento_vala_aberta, 'fotos_aterramento_vala_aberta'));
            if (obraData.fotos_aterramento_hastes?.length) setFotosAterramentoHastes(mapPhotos(obraData.fotos_aterramento_hastes, 'fotos_aterramento_hastes'));
            if (obraData.fotos_aterramento_vala_fechada?.length) setFotosAterramentoValaFechada(mapPhotos(obraData.fotos_aterramento_vala_fechada, 'fotos_aterramento_vala_fechada'));
            if (obraData.fotos_aterramento_medicao?.length) setFotosAterramentoMedicao(mapPhotos(obraData.fotos_aterramento_medicao, 'fotos_aterramento_medicao'));
          } catch (err) {
            console.error('❌ Erro ao carregar fotos de aterramento:', err);
          }

          // Transformador
          try {
            if (obraData.transformador_status) setTransformadorStatus(obraData.transformador_status);
            if (obraData.fotos_transformador_laudo?.length) setFotosTransformadorLaudo(mapPhotos(obraData.fotos_transformador_laudo, 'fotos_transformador_laudo'));
            if (obraData.fotos_transformador_componente_instalado?.length) setFotosTransformadorComponenteInstalado(mapPhotos(obraData.fotos_transformador_componente_instalado, 'fotos_transformador_componente_instalado'));
            if (obraData.fotos_transformador_tombamento_instalado?.length) setFotosTransformadorTombamentoInstalado(mapPhotos(obraData.fotos_transformador_tombamento_instalado, 'fotos_transformador_tombamento_instalado'));
            if (obraData.fotos_transformador_tape?.length) setFotosTransformadorTape(mapPhotos(obraData.fotos_transformador_tape, 'fotos_transformador_tape'));
            if (obraData.fotos_transformador_placa_instalado?.length) setFotosTransformadorPlacaInstalado(mapPhotos(obraData.fotos_transformador_placa_instalado, 'fotos_transformador_placa_instalado'));
            if (obraData.fotos_transformador_instalado?.length) setFotosTransformadorInstalado(mapPhotos(obraData.fotos_transformador_instalado, 'fotos_transformador_instalado'));
            if (obraData.fotos_transformador_conexoes_primarias_instalado?.length) setFotosTransformadorConexoesPrimariasInstalado(mapPhotos(obraData.fotos_transformador_conexoes_primarias_instalado, 'fotos_transformador_conexoes_primarias_instalado'));
            if (obraData.fotos_transformador_conexoes_secundarias_instalado?.length) setFotosTransformadorConexoesSecundariasInstalado(mapPhotos(obraData.fotos_transformador_conexoes_secundarias_instalado, 'fotos_transformador_conexoes_secundarias_instalado'));
            if (obraData.fotos_transformador_antes_retirar?.length) setFotosTransformadorAntesRetirar(mapPhotos(obraData.fotos_transformador_antes_retirar, 'fotos_transformador_antes_retirar'));
            if (obraData.fotos_transformador_laudo_retirado?.length) setFotosTransformadorLaudoRetirado(mapPhotos(obraData.fotos_transformador_laudo_retirado, 'fotos_transformador_laudo_retirado'));
            if (obraData.fotos_transformador_tombamento_retirado?.length) setFotosTransformadorTombamentoRetirado(mapPhotos(obraData.fotos_transformador_tombamento_retirado, 'fotos_transformador_tombamento_retirado'));
            if (obraData.fotos_transformador_placa_retirado?.length) setFotosTransformadorPlacaRetirado(mapPhotos(obraData.fotos_transformador_placa_retirado, 'fotos_transformador_placa_retirado'));
            if (obraData.fotos_transformador_conexoes_primarias_retirado?.length) setFotosTransformadorConexoesPrimariasRetirado(mapPhotos(obraData.fotos_transformador_conexoes_primarias_retirado, 'fotos_transformador_conexoes_primarias_retirado'));
            if (obraData.fotos_transformador_conexoes_secundarias_retirado?.length) setFotosTransformadorConexoesSecundariasRetirado(mapPhotos(obraData.fotos_transformador_conexoes_secundarias_retirado, 'fotos_transformador_conexoes_secundarias_retirado'));
          } catch (err) {
            console.error('❌ Erro ao carregar fotos do transformador:', err);
          }

          // Medidor
          try {
            if (obraData.fotos_medidor_padrao?.length) setFotosMedidorPadrao(mapPhotos(obraData.fotos_medidor_padrao, 'fotos_medidor_padrao'));
            if (obraData.fotos_medidor_leitura?.length) setFotosMedidorLeitura(mapPhotos(obraData.fotos_medidor_leitura, 'fotos_medidor_leitura'));
            if (obraData.fotos_medidor_selo_born?.length) setFotosMedidorSeloBorn(mapPhotos(obraData.fotos_medidor_selo_born, 'fotos_medidor_selo_born'));
            if (obraData.fotos_medidor_selo_caixa?.length) setFotosMedidorSeloCaixa(mapPhotos(obraData.fotos_medidor_selo_caixa, 'fotos_medidor_selo_caixa'));
            if (obraData.fotos_medidor_identificador_fase?.length) setFotosMedidorIdentificadorFase(mapPhotos(obraData.fotos_medidor_identificador_fase, 'fotos_medidor_identificador_fase'));
          } catch (err) {
            console.error('❌ Erro ao carregar fotos do medidor:', err);
          }

          // Checklist
          try {
            if (obraData.fotos_checklist_croqui?.length) setFotosChecklistCroqui(mapPhotos(obraData.fotos_checklist_croqui, 'fotos_checklist_croqui'));
            if (obraData.fotos_checklist_panoramica_inicial?.length) setFotosChecklistPanoramicaInicial(mapPhotos(obraData.fotos_checklist_panoramica_inicial, 'fotos_checklist_panoramica_inicial'));
            if (obraData.fotos_checklist_chede?.length) setFotosChecklistChaveComponente(mapPhotos(obraData.fotos_checklist_chede, 'fotos_checklist_chede'));
            if (obraData.fotos_checklist_padrao_geral?.length) setFotosChecklistPadraoGeral(mapPhotos(obraData.fotos_checklist_padrao_geral, 'fotos_checklist_padrao_geral'));
            if (obraData.fotos_checklist_padrao_interno?.length) setFotosChecklistPadraoInterno(mapPhotos(obraData.fotos_checklist_padrao_interno, 'fotos_checklist_padrao_interno'));
            if (obraData.fotos_checklist_frying?.length) setFotosChecklistFrying(mapPhotos(obraData.fotos_checklist_frying, 'fotos_checklist_frying'));
            if (obraData.fotos_checklist_abertura_fechamento_pulo?.length) setFotosChecklistAberturaFechamentoPulo(mapPhotos(obraData.fotos_checklist_abertura_fechamento_pulo, 'fotos_checklist_abertura_fechamento_pulo'));
            if (obraData.fotos_checklist_panoramica_final?.length) setFotosChecklistPanoramicaFinal(mapPhotos(obraData.fotos_checklist_panoramica_final, 'fotos_checklist_panoramica_final'));

            // Carregar estrutura dos postes do Checklist
            console.log('📊 Verificando checklist_postes_data...', obraData.checklist_postes_data);
            if (obraData.checklist_postes_data?.length) {
              console.log('✅ Carregando', obraData.checklist_postes_data.length, 'poste(s) do checklist');
              const postesCarregados = obraData.checklist_postes_data.map((poste: any) => ({
                numero: poste.numero || '',
                status: poste.status || '',
                isAditivo: poste.isAditivo || false,
                posteInteiro: mapPhotos(poste.posteInteiro || [], 'checklist_poste_inteiro'),
                descricao: mapPhotos(poste.descricao || [], 'checklist_poste_descricao'),
                engaste: mapPhotos(poste.engaste || [], 'checklist_poste_engaste'),
                conexao1: mapPhotos(poste.conexao1 || [], 'checklist_poste_conexao1'),
                conexao2: mapPhotos(poste.conexao2 || [], 'checklist_poste_conexao2'),
                maiorEsforco: mapPhotos(poste.maiorEsforco || [], 'checklist_poste_maior_esforco'),
                menorEsforco: mapPhotos(poste.menorEsforco || [], 'checklist_poste_menor_esforco'),
              }));
              setFotosPostes(postesCarregados);
              setNumPostes(postesCarregados.length);
              console.log('✅ Postes carregados:', postesCarregados);
            } else {
              console.log('⚠️ Nenhum poste encontrado em checklist_postes_data');
            }

            // Carregar estrutura dos seccionamentos do Checklist
            console.log('📊 Verificando checklist_seccionamentos_data...', obraData.checklist_seccionamentos_data);
            if (obraData.checklist_seccionamentos_data?.length) {
              console.log('✅ Carregando', obraData.checklist_seccionamentos_data.length, 'ponto(s) lineares do checklist');

              const seccionamentosCarregados = obraData.checklist_seccionamentos_data
                .filter((sec: any) => !sec?.tipo || sec.tipo === 'seccionamento')
                .map((sec: any) => ({
                  numero: String(sec.numero || ''),
                  posteInicio: '',
                  posteFim: '',
                  fotos: mapPhotos(sec.fotos || [], 'checklist_seccionamento')
                }));

              const emendasCarregadas = obraData.checklist_seccionamentos_data
                .filter((sec: any) => sec?.tipo === 'emenda')
                .map((sec: any) => ({
                  numero: String(sec.numero || ''),
                  posteInicio: String(sec.posteInicio ?? sec.poste_inicio ?? ''),
                  posteFim: String(sec.posteFim ?? sec.poste_fim ?? ''),
                  fotos: mapPhotos(sec.fotos || [], 'checklist_emenda')
                }));

              const podasCarregadas = obraData.checklist_seccionamentos_data
                .filter((sec: any) => sec?.tipo === 'poda')
                .map((sec: any) => ({
                  numero: String(sec.numero || ''),
                  posteInicio: String(sec.posteInicio ?? sec.poste_inicio ?? ''),
                  posteFim: String(sec.posteFim ?? sec.poste_fim ?? ''),
                  fotos: mapPhotos(sec.fotos || [], 'checklist_poda')
                }));

              setFotosSeccionamentos(seccionamentosCarregados);
              setNumSeccionamentos(seccionamentosCarregados.length);
              setFotosEmendas(emendasCarregadas);
              setNumEmendas(emendasCarregadas.length);
              setFotosPodas(podasCarregadas);
              setNumPodas(podasCarregadas.length);
              console.log('✅ Seccionamentos carregados:', seccionamentosCarregados);
            } else {
              console.log('⚠️ Nenhum seccionamento encontrado em checklist_seccionamentos_data');
            }

            // Carregar estrutura dos aterramentos de cerca do Checklist
            if (obraData.checklist_aterramentos_cerca_data?.length) {
              const aterramentosCarregados = obraData.checklist_aterramentos_cerca_data.map((aterr: any) => ({
                numero: String(aterr.numero || ''),
                fotos: mapPhotos(aterr.fotos || [], 'checklist_aterramento_cerca')
              }));
              setFotosAterramentosCerca(aterramentosCarregados);
              setNumAterramentosCerca(aterramentosCarregados.length);
            }

            // Carregar estrutura unificada de hastes e termômetros do Checklist
            if (obraData.checklist_hastes_termometros_data?.length) {
              console.log('✅ Carregando', obraData.checklist_hastes_termometros_data.length, 'ponto(s) de hastes/termômetros do checklist');
              const pontosCarregados = obraData.checklist_hastes_termometros_data.map((ponto: any) => ({
                numero: String(ponto.numero || ''),
                isAditivo: ponto.isAditivo || false,
                fotoHaste: mapPhotos(ponto.fotoHaste || [], 'checklist_ponto_haste'),
                fotoTermometro: mapPhotos(ponto.fotoTermometro || [], 'checklist_ponto_termometro')
              }));
              setPontosHastesTermometros(pontosCarregados);
              setNumPontosHastesTermometros(pontosCarregados.length);
              console.log('✅ Pontos de hastes/termômetros carregados:', pontosCarregados);
            } else {
              console.log('⚠️ Nenhum ponto de hastes/termômetros encontrado em checklist_hastes_termometros_data');
            }
          } catch (err) {
            console.error('❌ Erro ao carregar fotos do checklist:', err);
          }

          // Serviços com múltiplos postes e fotos
          try {
            if (
              ['Linha Viva', 'Cava em Rocha', 'Book de Aterramento', 'Fundação Especial'].includes(obraData.tipo_servico) &&
              Array.isArray(obraData.postes_data) &&
              obraData.postes_data.length > 0
            ) {
              const postesCarregados = obraData.postes_data.map((poste: any, index: number) => {
                const numero = typeof poste?.numero === 'number'
                  ? poste.numero
                  : parseInt(
                      String(poste?.numero ?? poste?.id ?? '').replace(/[^0-9]/g, ''),
                      10
                    ) || (index + 1);
                const isAditivo = poste?.isAditivo === true || String(poste?.id || '').toUpperCase().startsWith('AD-P');
                const fallbackBookValaAberta =
                  obraData.tipo_servico === 'Book de Aterramento' && index === 0
                    ? (obraData.fotos_aterramento_vala_aberta || [])
                    : [];
                const fallbackBookHastes =
                  obraData.tipo_servico === 'Book de Aterramento' && index === 0
                    ? (obraData.fotos_aterramento_hastes || [])
                    : [];
                const fallbackBookValaFechada =
                  obraData.tipo_servico === 'Book de Aterramento' && index === 0
                    ? (obraData.fotos_aterramento_vala_fechada || [])
                    : [];
                const fallbackBookMedicao =
                  obraData.tipo_servico === 'Book de Aterramento' && index === 0
                    ? (obraData.fotos_aterramento_medicao || [])
                    : [];
                const fotosAntesOrigem =
                  Array.isArray(poste?.fotos_antes) && poste.fotos_antes.length > 0
                    ? poste.fotos_antes
                    : fallbackBookValaAberta;
                const fotosDuranteOrigem =
                  Array.isArray(poste?.fotos_durante) && poste.fotos_durante.length > 0
                    ? poste.fotos_durante
                    : fallbackBookHastes;
                const fotosDepoisOrigem =
                  Array.isArray(poste?.fotos_depois) && poste.fotos_depois.length > 0
                    ? poste.fotos_depois
                    : fallbackBookValaFechada;
                const fotosMedicaoOrigem =
                  Array.isArray(poste?.fotos_medicao) && poste.fotos_medicao.length > 0
                    ? poste.fotos_medicao
                    : fallbackBookMedicao;
                return {
                  id: `poste_${index + 1}_${Date.now()}`,
                  numero,
                  isAditivo,
                  fotosAntes: mapPhotos(fotosAntesOrigem, `postes_${numero}_antes`),
                  fotosDurante: mapPhotos(fotosDuranteOrigem, `postes_${numero}_durante`),
                  fotosDepois: mapPhotos(fotosDepoisOrigem, `postes_${numero}_depois`),
                  fotosMedicao: mapPhotos(fotosMedicaoOrigem, `postes_${numero}_medicao`),
                };
              });

              setPostesData(postesCarregados);
              const maxNumero = postesCarregados.reduce((max, p) => Math.max(max, p.numero || 0), 0);
              setProximoNumeroPoste(maxNumero + 1);

            } else if (
              obraData.tipo_servico === 'Book de Aterramento' &&
              (
                (obraData.fotos_aterramento_vala_aberta?.length || 0) > 0 ||
                (obraData.fotos_aterramento_hastes?.length || 0) > 0 ||
                (obraData.fotos_aterramento_vala_fechada?.length || 0) > 0 ||
                (obraData.fotos_aterramento_medicao?.length || 0) > 0
              )
            ) {
              setPostesData([
                {
                  id: `poste_legacy_${Date.now()}`,
                  numero: 1,
                  isAditivo: false,
                  fotosAntes: mapPhotos(obraData.fotos_aterramento_vala_aberta || [], 'postes_1_antes'),
                  fotosDurante: mapPhotos(obraData.fotos_aterramento_hastes || [], 'postes_1_durante'),
                  fotosDepois: mapPhotos(obraData.fotos_aterramento_vala_fechada || [], 'postes_1_depois'),
                  fotosMedicao: mapPhotos(obraData.fotos_aterramento_medicao || [], 'postes_1_medicao'),
                },
              ]);
              setProximoNumeroPoste(2);
            }
          } catch (err) {
            console.error('❌ Erro ao carregar postes_data (serviços com múltiplos postes):', err);
          }

          // Altimetria
          try {
            if (obraData.fotos_altimetria_lado_fonte?.length) setFotosAltimetriaLadoFonte(mapPhotos(obraData.fotos_altimetria_lado_fonte, 'fotos_altimetria_lado_fonte'));
            if (obraData.fotos_altimetria_medicao_fonte?.length) setFotosAltimetriaMedicaoFonte(mapPhotos(obraData.fotos_altimetria_medicao_fonte, 'fotos_altimetria_medicao_fonte'));
            if (obraData.fotos_altimetria_lado_carga?.length) setFotosAltimetriaLadoCarga(mapPhotos(obraData.fotos_altimetria_lado_carga, 'fotos_altimetria_lado_carga'));
            if (obraData.fotos_altimetria_medicao_carga?.length) setFotosAltimetriaMedicaoCarga(mapPhotos(obraData.fotos_altimetria_medicao_carga, 'fotos_altimetria_medicao_carga'));
          } catch (err) {
            console.error('❌ Erro ao carregar fotos de altimetria:', err);
          }

          // Vazamento e Limpeza
          try {
            if (obraData.fotos_vazamento_evidencia?.length) setFotosVazamentoEvidencia(mapPhotos(obraData.fotos_vazamento_evidencia, 'fotos_vazamento_evidencia'));
            if (obraData.fotos_vazamento_equipamentos_limpeza?.length) setFotosVazamentoEquipamentosLimpeza(mapPhotos(obraData.fotos_vazamento_equipamentos_limpeza, 'fotos_vazamento_equipamentos_limpeza'));
            if (obraData.fotos_vazamento_tombamento_retirado?.length) setFotosVazamentoTombamentoRetirado(mapPhotos(obraData.fotos_vazamento_tombamento_retirado, 'fotos_vazamento_tombamento_retirado'));
            if (obraData.fotos_vazamento_placa_retirado?.length) setFotosVazamentoPlacaRetirado(mapPhotos(obraData.fotos_vazamento_placa_retirado, 'fotos_vazamento_placa_retirado'));
            if (obraData.fotos_vazamento_tombamento_instalado?.length) setFotosVazamentoTombamentoInstalado(mapPhotos(obraData.fotos_vazamento_tombamento_instalado, 'fotos_vazamento_tombamento_instalado'));
            if (obraData.fotos_vazamento_placa_instalado?.length) setFotosVazamentoPlacaInstalado(mapPhotos(obraData.fotos_vazamento_placa_instalado, 'fotos_vazamento_placa_instalado'));
            if (obraData.fotos_vazamento_instalacao?.length) setFotosVazamentoInstalacao(mapPhotos(obraData.fotos_vazamento_instalacao, 'fotos_vazamento_instalacao'));
          } catch (err) {
            console.error('❌ Erro ao carregar fotos de vazamento:', err);
          }

          // Documentação
          try {
            if (obraData.doc_cadastro_medidor?.length) setDocCadastroMedidor(mapPhotos(obraData.doc_cadastro_medidor, 'doc_cadastro_medidor'));
            if (obraData.doc_laudo_transformador?.length) setDocLaudoTransformador(mapPhotos(obraData.doc_laudo_transformador, 'doc_laudo_transformador'));
            if (obraData.doc_laudo_regulador?.length) setDocLaudoRegulador(mapPhotos(obraData.doc_laudo_regulador, 'doc_laudo_regulador'));
            if (obraData.doc_laudo_religador?.length) setDocLaudoReligador(mapPhotos(obraData.doc_laudo_religador, 'doc_laudo_religador'));
            if (obraData.doc_apr?.length) setDocApr(mapPhotos(obraData.doc_apr, 'doc_apr'));
            if (obraData.doc_fvbt?.length) setDocFvbt(mapPhotos(obraData.doc_fvbt, 'doc_fvbt'));
            if (obraData.doc_termo_desistencia_lpt?.length) setDocTermoDesistenciaLpt(mapPhotos(obraData.doc_termo_desistencia_lpt, 'doc_termo_desistencia_lpt'));
            if (obraData.doc_autorizacao_passagem?.length) setDocAutorizacaoPassagem(mapPhotos(obraData.doc_autorizacao_passagem, 'doc_autorizacao_passagem'));
            if (obraData.doc_materiais_previsto?.length) setDocMateriaisPrevisto(mapPhotos(obraData.doc_materiais_previsto, 'doc_materiais_previsto'));
            if (obraData.doc_materiais_realizado?.length) setDocMateriaisRealizado(mapPhotos(obraData.doc_materiais_realizado, 'doc_materiais_realizado'));
          } catch (err) {
            console.error('❌ Erro ao carregar documentação:', err);
          }

          console.log('✅ Fotos carregadas com sucesso em modo de edição');
        } catch (error: any) {
          console.error('❌ Erro ao carregar dados da obra:', error);

          // Mensagem específica dependendo do erro
          let errorMessage = 'Não foi possível carregar os dados da obra.';
          if (error.message?.includes('módulo de fotos')) {
            errorMessage = error.message + '\n\nDica: Limpe o cache com:\n1. Feche o app\n2. No terminal: npx expo start -c';
          } else if (error.message?.includes('LoadBundle')) {
            errorMessage = 'Erro ao carregar módulos do servidor.\n\nTente:\n1. Reiniciar o servidor Expo\n2. Limpar cache: npx expo start -c';
          }

          Alert.alert('Erro ao Carregar Obra', errorMessage);
        }
      };

      // PROTEÇÃO: Executar com tratamento de erro
      loadObraDataAsync().catch((error: any) => {
        console.error('🚨 Erro CRÍTICO ao carregar dados da obra:', error);
        console.error('📊 Stack:', error?.stack || 'N/A');

        Alert.alert(
          'Erro ao Carregar Obra',
          'Não foi possível carregar os dados da obra. Por favor, tente novamente.',
          [
            { text: 'Voltar', onPress: () => router.back() },
            { text: 'Tentar Novamente', onPress: () => loadObraDataAsync() }
          ]
        );
      });
    }
  }, [isEditMode, params.obraData]);

  const loadPendingObras = async () => {
    try {
      const obras = await getPendingObras();
      setPendingObras(obras);
    } catch (error) {
      console.error('Erro ao carregar obras pendentes:', error);
    }
  };

  const normalizeComparableValue = (value?: string | null) => (value || '').trim().toLowerCase();

  const findSimilarOpenObra = async (
    obraNumero: string,
    tipoServicoAtual: string
  ): Promise<PendingObra | LocalObra | null> => {
    const [obrasLocais, obrasPendentes] = await Promise.all([getLocalObras(), getPendingObras()]);
    const currentEquipe = normalizeComparableValue(isAdminUser ? equipeExecutora : equipe);
    const idsIgnorados = new Set(
      [backupObraId, obraId, currentServerId].filter((value): value is string => Boolean(value))
    );

    const obrasConhecidas = [
      ...obrasLocais,
      ...obrasPendentes.filter((obraPendente) => !obrasLocais.some((obraLocal) => obraLocal.id === obraPendente.id)),
    ];

    const obrasSemelhantes = obrasConhecidas
      .filter((obraExistente) => {
        const mesmoNumero =
          normalizeComparableValue(obraExistente.obra) === normalizeComparableValue(obraNumero);
        const mesmoTipo =
          normalizeComparableValue(obraExistente.tipo_servico) === normalizeComparableValue(tipoServicoAtual);
        const mesmaEquipe =
          !currentEquipe || normalizeComparableValue(obraExistente.equipe) === currentEquipe;
        const aberta = normalizeComparableValue(obraExistente.status) !== 'finalizada';
        const mesmoRegistro =
          idsIgnorados.has(obraExistente.id) ||
          ('serverId' in obraExistente &&
            typeof obraExistente.serverId === 'string' &&
            idsIgnorados.has(obraExistente.serverId));

        return mesmoNumero && mesmoTipo && mesmaEquipe && aberta && !mesmoRegistro;
      })
      .sort((a, b) => {
        const prioridadeA = a.status === 'rascunho' ? 0 : 1;
        const prioridadeB = b.status === 'rascunho' ? 0 : 1;
        if (prioridadeA !== prioridadeB) {
          return prioridadeA - prioridadeB;
        }

        const dataA = new Date((a as any).created_at || a.data || 0).getTime();
        const dataB = new Date((b as any).created_at || b.data || 0).getTime();
        return dataB - dataA;
      });

    return obrasSemelhantes[0] || null;
  };

  const getSyncStatusLabel = (status: PendingObra['sync_status']) => {
    if (status === 'syncing') return 'Sincronizando';
    if (status === 'failed') return 'Falhou';
    return 'Pendente';
  };

  useEffect(() => {
    loadPendingObras();
  }, []);

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
    const unsubscribe = startAutoSync(async result => {
      await loadPendingObras();

      if (result.success > 0 && result.failed === 0) {
        Alert.alert('Sincronizacao concluida', `${result.success} obra(s) sincronizadas com sucesso.`);
      } else if (result.failed > 0) {
        Alert.alert(
          'Sincronizacao incompleta',
          `${result.failed} obra(s) nao foram sincronizadas. Verifique e tente novamente.`
        );
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // 🔙 Interceptar botão de voltar nativo (Android)
  useEffect(() => {
    const backAction = () => {
      // Verificar se há dados não salvos (obra iniciada)
      const hasData = obra.trim() !== '' ||
                      fotosAntes.length > 0 ||
                      fotosDurante.length > 0 ||
                      fotosDepois.length > 0 ||
                      fotosAbertura.length > 0 ||
                      fotosFechamento.length > 0 ||
                      fotosPostes.length > 0 ||
                      fotosSeccionamentos.length > 0 ||
                      fotosEmendas.length > 0 ||
                      fotosPodas.length > 0 ||
                      fotosAterramentosCerca.length > 0 ||
                      pontosHastesTermometros.length > 0 ||
                      fotosChecklistCroqui.length > 0 ||
                      fotosChecklistPanoramicaInicial.length > 0 ||
                      fotosChecklistPanoramicaFinal.length > 0;

      if (hasData) {
        setExitModalVisible(true);
        return true; // Previne o comportamento padrão do back
      }

      return false; // Permite o comportamento padrão se não houver dados
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [obra, fotosAntes, fotosDurante, fotosDepois, fotosAbertura, fotosFechamento, fotosPostes, fotosSeccionamentos, fotosEmendas, fotosPodas, fotosAterramentosCerca, pontosHastesTermometros, fotosChecklistCroqui, fotosChecklistPanoramicaInicial, fotosChecklistPanoramicaFinal]);

  // Função para sair descartando
  const handleExitDiscard = () => {
    setExitModalVisible(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // Função para salvar e sair
  const handleExitSave = () => {
    setExitModalVisible(false);
    handlePausar();
  };

  const selectImageSource = (): Promise<'camera' | 'gallery' | null> => {
    return new Promise((resolve) => {
      let resolved = false;
      const finish = (value: 'camera' | 'gallery' | null) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      Alert.alert(
        'Adicionar Foto',
        'Escolha a origem da imagem:',
        [
          { text: 'Câmera', onPress: () => finish('camera') },
          { text: 'Galeria', onPress: () => finish('gallery') },
          { text: 'Cancelar', style: 'cancel', onPress: () => finish(null) },
        ],
        {
          cancelable: true,
          onDismiss: () => finish(null),
        }
      );
    });
  };

  const requestPermissions = async (
    source: 'camera' | 'gallery',
    needsLocation: boolean
  ) => {
    try {
      // PROTEÇÃO: Timeout de 30 segundos para solicitação de permissões
      const mediaPermissionPromise = source === 'camera'
        ? ImagePicker.requestCameraPermissionsAsync()
        : ImagePicker.requestMediaLibraryPermissionsAsync();
      const permissionsPromise = needsLocation
        ? Promise.all([mediaPermissionPromise, Location.requestForegroundPermissionsAsync()])
        : Promise.all([mediaPermissionPromise]);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de permissões')), 30000)
      );

      const permissionResults = await Promise.race([
        permissionsPromise,
        timeoutPromise
      ]);
      const mediaResult = permissionResults[0];
      const locationResult = needsLocation ? permissionResults[1] : null;

      if (mediaResult.status !== 'granted') {
        Alert.alert(
          source === 'camera' ? 'Permissão de Câmera Negada' : 'Permissão da Galeria Negada',
          source === 'camera'
            ? 'É necessário permitir o acesso à câmera para tirar fotos.\n\nVá em Configurações > Permissões para habilitar.'
            : 'É necessário permitir o acesso à galeria para selecionar fotos.\n\nVá em Configurações > Permissões para habilitar.'
        );
        return false;
      }

      if (needsLocation && locationResult?.status !== 'granted') {
        Alert.alert(
          'Permissão de Localização Negada',
          'É necessário permitir o acesso à localização para registrar as coordenadas.\n\nAs fotos serão salvas sem localização GPS.'
        );
        // Permite continuar sem GPS
        return true;
      }

      return true;
    } catch (error: any) {
      // PROTEÇÃO ROBUSTA: Nunca crashar ao solicitar permissões
      console.error('🚨 Erro ao solicitar permissões:', error);

      if (error?.message?.includes('Timeout')) {
        Alert.alert(
          'Timeout',
          'Tempo esgotado ao solicitar permissões. Por favor, tente novamente.'
        );
      } else {
        Alert.alert(
          'Erro de Permissões',
          'Não foi possível solicitar permissões. Verifique as configurações do dispositivo.'
        );
      }

      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      // RÁPIDO: Usar última posição conhecida (retorna instantaneamente, sem esperar novo fix GPS)
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000, // Aceitar posição de até 5 minutos atrás
        requiredAccuracy: 100,  // Precisão máxima aceitável: 100 metros
      });

      if (lastKnown?.coords?.latitude && lastKnown?.coords?.longitude) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
      }

      // FALLBACK: Se não há posição recente, tentar uma leitura rápida com timeout curto
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS timeout')), 3000)
        )
      ]);

      if (!location?.coords?.latitude || !location?.coords?.longitude) {
        throw new Error('Coordenadas inválidas');
      }

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error: any) {
      console.warn('⚠️ GPS indisponível:', error?.message || error);
      return { latitude: null, longitude: null };
    }
  };

  // Funções para gerenciar postes (Linha Viva / Cava em Rocha)
  const adicionarPoste = () => {
    setProximoNumeroPoste(prev => {
      const novoNumero = prev;
      const novoPoste: Poste = {
        id: `poste_${Date.now()}_${novoNumero}`,
        numero: novoNumero,
        isAditivo: false,
        fotosAntes: [],
        fotosDurante: [],
        fotosDepois: [],
        fotosMedicao: [],
      };
      setPostesData(prevPostes => [...prevPostes, novoPoste]);

      // ✅ Aviso simples
      showToast('Poste adicionado! Role a tela para baixo para ver o novo poste.', 'success');

      return prev + 1;
    });
  };

  // Identificação guiada de postes (sem fotos)
  const adicionarPosteIdentificado = () => {
    const numero = parseInt(posteNumeroInput.replace(/[^0-9]/g, ''), 10);
    if (!numero || numero <= 0) {
      Alert.alert('Atenção', 'Informe apenas o número do poste. Ex: 3');
      return;
    }
    // Verificar duplicatas considerando numero + isAditivo
    if (postesIdentificados.find(p => p.numero === numero && p.isAditivo === posteIsAditivo)) {
      const prefixo = posteIsAditivo ? 'AD-P' : 'P';
      Alert.alert('Atenção', `O poste ${prefixo}${numero} já foi adicionado.`);
      return;
    }
    const novoPoste: PosteIdentificado = {
      numero,
      isAditivo: posteIsAditivo,
    };
    setPostesIdentificados(prev => [...prev, novoPoste].sort((a, b) => {
      // Ordenar: primeiro por número, depois por aditivo (não-aditivo primeiro)
      if (a.numero !== b.numero) return a.numero - b.numero;
      return a.isAditivo === b.isAditivo ? 0 : a.isAditivo ? 1 : -1;
    }));
    setPosteNumeroInput('');
    setPosteIsAditivo(false); // Reset checkbox após adicionar
  };

  const removerPosteIdentificado = (numero: number, isAditivo: boolean) => {
    setPostesIdentificados(prev => prev.filter(p => !(p.numero === numero && p.isAditivo === isAditivo)));
  };

  const removerPoste = (posteId: string) => {
    setPostesData(prevPostes => {
      if (prevPostes.length === 1) {
        Alert.alert('Atenção', 'É necessário manter pelo menos 1 poste.');
        return prevPostes;
      }
      const posteRemovido = prevPostes.find(p => p.id === posteId);
      const nomePoste = posteRemovido ? getPosteCodigo(posteRemovido) : posteId;
      Alert.alert(
        'Confirmar Remoção',
        `Deseja remover o poste ${nomePoste}? Todas as fotos dele serão perdidas.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Remover',
            style: 'destructive',
            onPress: () => {
              setPostesData(prev => prev.filter(p => p.id !== posteId));
            },
          },
        ]
      );
      return prevPostes;
    });
  };

  const getPosteStatus = (poste: Poste): 'completo' | 'parcial' | 'pendente' => {
    const temAntes = poste.fotosAntes.length > 0;
    const temDurante = poste.fotosDurante.length > 0;
    const temDepois = poste.fotosDepois.length > 0;
    const temMedicao = poste.fotosMedicao.length > 0;
    const exigeMedicao = isServicoBookAterramento;

    if (temAntes && temDurante && temDepois && (!exigeMedicao || temMedicao)) return 'completo';
    if (temAntes || temDurante || temDepois || (exigeMedicao && temMedicao)) return 'parcial';
    return 'pendente';
  };

  const takePicturePoste = async (
    posteId: string,
    secao: 'fotosAntes' | 'fotosDurante' | 'fotosDepois' | 'fotosMedicao'
  ) => {
    const source = await selectImageSource();
    if (!source) return;

    const hasPermission = await requestPermissions(source, true);
    if (!hasPermission) return;

    setUploadingPhoto(true);

    try {
      const pickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.4,
        allowsEditing: false,
        aspect: [4, 3] as [number, number],
        exif: false,
      };

      // Iniciar GPS em paralelo com a câmera
      const locationPromise = getCurrentLocation();

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled) {
        setUploadingPhoto(false);
        return;
      }

      const photoUri = result.assets[0].uri;
      const location = await locationPromise;

      const posteAtual = postesData.find(p => p.id === posteId);
      const identificacaoPoste = posteAtual ? getPosteCodigo(posteAtual) : posteId;

      const placaData = {
        obraNumero: obra || tempObraId.substring(0, 8),
        tipoServico: tipoServico || 'Linha Viva',
        equipe: isAdminUser ? equipeExecutora : equipe,
        dataHora: new Date().toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        latitude: location.latitude,
        longitude: location.longitude,
        posteId: identificacaoPoste, // Adicionar identificação padronizada na placa
      };

      let finalPhotoUri = photoUri;
      try {
        finalPhotoUri = await renderPhotoWithPlacaBurnedIn(photoUri, placaData);
      } catch (error) {
        console.warn('Erro ao adicionar placa, continuando com foto original:', error);
      }

      // Mapear seção para tipo de foto do backup
      const tipoFotoMap: Record<typeof secao, 'antes' | 'durante' | 'depois' | 'aterramento_medicao'> = {
        'fotosAntes': 'antes',
        'fotosDurante': 'durante',
        'fotosDepois': 'depois',
        'fotosMedicao': 'aterramento_medicao',
      };
      const tipoFoto = tipoFotoMap[secao];

      // Obter índice atual de fotos nesta seção para este poste
      const indexFoto = posteAtual ? posteAtual[secao].length : 0;

      // Fazer backup da foto
      const photoMetadata = await backupPhoto(
        finalPhotoUri,
        backupObraId,
        tipoFoto,
        indexFoto,
        location.latitude,
        location.longitude
      );

      const fotoData: FotoData = {
        uri: finalPhotoUri,
        latitude: location.latitude,
        longitude: location.longitude,
        utmX: photoMetadata?.utmX || null,
        utmY: photoMetadata?.utmY || null,
        utmZone: photoMetadata?.utmZone || null,
        photoId: photoMetadata?.id || `temp_${Date.now()}`,
      };

      // Atualizar o poste específico (usar forma funcional para evitar problemas de estado)
      setPostesData(prevPostes => prevPostes.map(p => {
        if (p.id === posteId) {
          return {
            ...p,
            [secao]: [...p[secao], fotoData],
          };
        }
        return p;
      }));

      setUploadingPhoto(false);
      console.log(`✅ Foto adicionada ao ${identificacaoPoste} - ${secao}`);
    } catch (error) {
      console.error('❌ Erro ao adicionar foto do poste:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('espaço') || message.toLowerCase().includes('insuficiente') || message.toLowerCase().includes('storage') || message.toLowerCase().includes('disk')) {
        Alert.alert('Espaço insuficiente', 'Libere espaço no dispositivo e tente novamente.');
      } else {
        Alert.alert('Erro', 'Não foi possível adicionar a foto. Tente novamente.');
      }
      setUploadingPhoto(false);
    }
  };

  const removeFotoPoste = (
    posteId: string,
    secao: 'fotosAntes' | 'fotosDurante' | 'fotosDepois' | 'fotosMedicao',
    fotoIndex: number
  ) => {
    setPostesData(prevPostes => prevPostes.map(p => {
      if (p.id === posteId) {
        return {
          ...p,
          [secao]: p[secao].filter((_, i) => i !== fotoIndex),
        };
      }
      return p;
    }));
  };

  const takePicture = async (
    tipo: 'antes' | 'durante' | 'depois' | 'abertura' | 'fechamento' |
    'ditais_abertura' | 'ditais_impedir' | 'ditais_testar' | 'ditais_aterrar' | 'ditais_sinalizar' |
    'aterramento_vala_aberta' | 'aterramento_hastes' | 'aterramento_vala_fechada' | 'aterramento_medicao' |
    'transformador_laudo' | 'transformador_componente_instalado' | 'transformador_tombamento_instalado' |
    'transformador_tape' | 'transformador_placa_instalado' | 'transformador_instalado' |
    'transformador_conexoes_primarias_instalado' | 'transformador_conexoes_secundarias_instalado' |
    'transformador_antes_retirar' | 'transformador_laudo_retirado' | 'transformador_tombamento_retirado' | 'transformador_placa_retirado' |
    'transformador_conexoes_primarias_retirado' | 'transformador_conexoes_secundarias_retirado' |
    'medidor_padrao' | 'medidor_leitura' | 'medidor_selo_born' | 'medidor_selo_caixa' | 'medidor_identificador_fase' |
    'altimetria_lado_fonte' | 'altimetria_medicao_fonte' | 'altimetria_lado_carga' | 'altimetria_medicao_carga' |
    'vazamento_evidencia' | 'vazamento_equipamentos_limpeza' | 'vazamento_tombamento_retirado' | 'vazamento_placa_retirado' |
    'vazamento_tombamento_instalado' | 'vazamento_placa_instalado' | 'vazamento_instalacao' |
    'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' |
    'checklist_padrao_geral' | 'checklist_padrao_interno' | 'checklist_frying' | 'checklist_abertura_fechamento_pulo' |
    'checklist_ponto_haste' | 'checklist_ponto_termometro' | 'checklist_panoramica_final' |
    'checklist_poste_inteiro' | 'checklist_poste_descricao' | 'checklist_poste_engaste' | 'checklist_poste_conexao1' | 'checklist_poste_conexao2' |
    'checklist_poste_maior_esforco' | 'checklist_poste_menor_esforco' |
    'checklist_seccionamento' | 'checklist_emenda' | 'checklist_poda' | 'checklist_aterramento_cerca' |
    'doc_materiais_previsto' | 'doc_materiais_realizado' |
    'doc_apr' | 'doc_cadastro_medidor' | 'doc_laudo_transformador' |
    'doc_laudo_regulador' | 'doc_laudo_religador' | 'doc_fvbt' |
    'doc_termo_desistencia_lpt' | 'doc_autorizacao_passagem',
    posteIndex?: number,
    seccionamentoIndex?: number,
    aterramentoCercaIndex?: number,
    pontoIndex?: number,
    emendaIndex?: number,
    podaIndex?: number
  ) => {
    try {
      // Verificar se é foto de documento (scanner mode)
      const isDocument =
        tipo === 'doc_materiais_previsto' ||
        tipo === 'doc_materiais_realizado' ||
        tipo === 'doc_cadastro_medidor' ||
        tipo === 'doc_laudo_transformador' ||
        tipo === 'doc_laudo_regulador' ||
        tipo === 'doc_laudo_religador' ||
        tipo === 'doc_apr' ||
        tipo === 'doc_fvbt' ||
        tipo === 'doc_termo_desistencia_lpt' ||
        tipo === 'doc_autorizacao_passagem';

      const source = await selectImageSource();
      if (!source) return;

      const hasPermission = await requestPermissions(source, !isDocument);
      if (!hasPermission) return;

      setUploadingPhoto(true);

      // Configurações de câmera baseadas no tipo
      const pickerOptions = isDocument
        ? {
            // 📄 MODO SCANNER: Alta qualidade para documentos
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1.0, // 100% de qualidade para documentos (scanner)
            allowsEditing: true, // Permitir crop/ajuste para documentos
            aspect: undefined, // Sem restrição de aspecto (livre)
            exif: true, // Manter EXIF para documentos
          }
        : {
            // 📷 MODO FOTO NORMAL: Otimizado para rapidez
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.4, // 40% de qualidade (processamento rápido)
            allowsEditing: false,
            aspect: [4, 3] as [number, number],
            exif: false,
          };

      // Iniciar GPS em paralelo com a câmera (fotos normais)
      // Enquanto o usuário enquadra a foto, o GPS já resolve em background
      const locationPromise = isDocument
        ? Promise.resolve({ latitude: null, longitude: null })
        : getCurrentLocation();

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled) {
        setUploadingPhoto(false);
        return;
      }

      let photoUri = result.assets[0].uri;
      console.log(`📸 ${isDocument ? '📄 DOCUMENTO' : '📷 FOTO'} - URI ORIGINAL:`, photoUri);

      // GPS já deve estar resolvido (rodou em paralelo com a câmera)
      const location = await locationPromise;

      // Para documentos, NÃO adicionar placa
      if (isDocument) {
        console.log('📄 Modo Scanner: Sem placa, sem GPS, qualidade máxima (100%)');
        // Pular placa completamente
      } else {
        // Para fotos normais: adicionar placa
        const placaData = {
          obraNumero: obra || tempObraId.substring(0, 8),
          tipoServico: Array.isArray(tipoServico) ? tipoServico[0] : tipoServico || 'Obra',
          equipe: equipe || equipeExecutora || 'Equipe',
          dataHora: new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          latitude: location.latitude,
          longitude: location.longitude,
        };

        try {
          // Renderizar foto com placa gravada
          const photoWithPlaca = await renderPhotoWithPlacaBurnedIn(photoUri, placaData);
          photoUri = photoWithPlaca;
          console.log('✅ Placa gravada na foto');
          console.log('📸 URI COM PLACA:', photoUri);
        } catch (error) {
          console.error('❌ ERRO ao gravar placa:', error);
          console.warn('⚠️ Erro ao gravar placa, usando foto original:', error);
          // Continua com foto original
        }
      }

      // ❌ REMOVIDO: Salvar na galeria (desnecessário, já temos backup em pasta dedicada)
      // As fotos são automaticamente salvas em backupPhoto() na pasta permanente
      // Não precisamos solicitar permissão de galeria nem duplicar as fotos

      // Obter índice da próxima foto
      let index = 0;
      if (tipo === 'antes') index = fotosAntes.length;
      else if (tipo === 'durante') index = fotosDurante.length;
      else if (tipo === 'depois') index = fotosDepois.length;
      else if (tipo === 'abertura') index = fotosAbertura.length;
      else if (tipo === 'fechamento') index = fotosFechamento.length;
      else if (tipo === 'ditais_abertura') index = fotosDitaisAbertura.length;
      else if (tipo === 'ditais_impedir') index = fotosDitaisImpedir.length;
      else if (tipo === 'ditais_testar') index = fotosDitaisTestar.length;
      else if (tipo === 'ditais_aterrar') index = fotosDitaisAterrar.length;
      else if (tipo === 'ditais_sinalizar') index = fotosDitaisSinalizar.length;
      else if (tipo === 'aterramento_vala_aberta') index = fotosAterramentoValaAberta.length;
      else if (tipo === 'aterramento_hastes') index = fotosAterramentoHastes.length;
      else if (tipo === 'aterramento_vala_fechada') index = fotosAterramentoValaFechada.length;
      else if (tipo === 'aterramento_medicao') index = fotosAterramentoMedicao.length;
      else if (tipo === 'transformador_laudo') index = fotosTransformadorLaudo.length;
      else if (tipo === 'transformador_componente_instalado') index = fotosTransformadorComponenteInstalado.length;
      else if (tipo === 'transformador_tombamento_instalado') index = fotosTransformadorTombamentoInstalado.length;
      else if (tipo === 'transformador_tape') index = fotosTransformadorTape.length;
      else if (tipo === 'transformador_placa_instalado') index = fotosTransformadorPlacaInstalado.length;
      else if (tipo === 'transformador_instalado') index = fotosTransformadorInstalado.length;
      else if (tipo === 'transformador_antes_retirar') index = fotosTransformadorAntesRetirar.length;
      else if (tipo === 'transformador_laudo_retirado') index = fotosTransformadorLaudoRetirado.length;
      else if (tipo === 'transformador_tombamento_retirado') index = fotosTransformadorTombamentoRetirado.length;
      else if (tipo === 'transformador_placa_retirado') index = fotosTransformadorPlacaRetirado.length;
      else if (tipo === 'medidor_padrao') index = fotosMedidorPadrao.length;
      else if (tipo === 'medidor_leitura') index = fotosMedidorLeitura.length;
      else if (tipo === 'medidor_selo_born') index = fotosMedidorSeloBorn.length;
      else if (tipo === 'medidor_selo_caixa') index = fotosMedidorSeloCaixa.length;
      else if (tipo === 'medidor_identificador_fase') index = fotosMedidorIdentificadorFase.length;
      // Altimetria - 4 fotos
      else if (tipo === 'altimetria_lado_fonte') index = fotosAltimetriaLadoFonte.length;
      else if (tipo === 'altimetria_medicao_fonte') index = fotosAltimetriaMedicaoFonte.length;
      else if (tipo === 'altimetria_lado_carga') index = fotosAltimetriaLadoCarga.length;
      else if (tipo === 'altimetria_medicao_carga') index = fotosAltimetriaMedicaoCarga.length;
      // Vazamento e Limpeza - 7 fotos
      else if (tipo === 'vazamento_evidencia') index = fotosVazamentoEvidencia.length;
      else if (tipo === 'vazamento_equipamentos_limpeza') index = fotosVazamentoEquipamentosLimpeza.length;
      else if (tipo === 'vazamento_tombamento_retirado') index = fotosVazamentoTombamentoRetirado.length;
      else if (tipo === 'vazamento_placa_retirado') index = fotosVazamentoPlacaRetirado.length;
      else if (tipo === 'vazamento_tombamento_instalado') index = fotosVazamentoTombamentoInstalado.length;
      else if (tipo === 'vazamento_placa_instalado') index = fotosVazamentoPlacaInstalado.length;
      else if (tipo === 'vazamento_instalacao') index = fotosVazamentoInstalacao.length;
      // Checklist - fotos fixas
      else if (tipo === 'checklist_croqui') index = fotosChecklistCroqui.length;
      else if (tipo === 'checklist_panoramica_inicial') index = fotosChecklistPanoramicaInicial.length;
      else if (tipo === 'checklist_chede') index = fotosChecklistChaveComponente.length;
      else if (tipo === 'checklist_padrao_geral') index = fotosChecklistPadraoGeral.length;
      else if (tipo === 'checklist_padrao_interno') index = fotosChecklistPadraoInterno.length;
      else if (tipo === 'checklist_frying') index = fotosChecklistFrying.length;
      else if (tipo === 'checklist_abertura_fechamento_pulo') index = fotosChecklistAberturaFechamentoPulo.length;
      else if (tipo === 'checklist_panoramica_final') index = fotosChecklistPanoramicaFinal.length;
      // Checklist - fotos dinâmicas (postes)
      else if (tipo === 'checklist_poste_inteiro' && posteIndex !== undefined) index = fotosPostes[posteIndex].posteInteiro.length;
      else if (tipo === 'checklist_poste_descricao' && posteIndex !== undefined) index = fotosPostes[posteIndex].descricao.length;
      else if (tipo === 'checklist_poste_engaste' && posteIndex !== undefined) index = fotosPostes[posteIndex].engaste.length;
      else if (tipo === 'checklist_poste_conexao1' && posteIndex !== undefined) index = fotosPostes[posteIndex].conexao1.length;
      else if (tipo === 'checklist_poste_conexao2' && posteIndex !== undefined) index = fotosPostes[posteIndex].conexao2.length;
      else if (tipo === 'checklist_poste_maior_esforco' && posteIndex !== undefined) index = fotosPostes[posteIndex].maiorEsforco.length;
      else if (tipo === 'checklist_poste_menor_esforco' && posteIndex !== undefined) index = fotosPostes[posteIndex].menorEsforco.length;
      // Checklist - seccionamento
      else if (tipo === 'checklist_seccionamento' && seccionamentoIndex !== undefined) index = fotosSeccionamentos[seccionamentoIndex].fotos.length;
      // Checklist - emenda
      else if (tipo === 'checklist_emenda' && emendaIndex !== undefined) index = fotosEmendas[emendaIndex].fotos.length;
      // Checklist - poda
      else if (tipo === 'checklist_poda' && podaIndex !== undefined) index = fotosPodas[podaIndex].fotos.length;
      // Checklist - aterramento de cerca
      else if (tipo === 'checklist_aterramento_cerca' && aterramentoCercaIndex !== undefined) index = fotosAterramentosCerca[aterramentoCercaIndex].fotos.length;
      // Checklist - ponto haste
      else if (tipo === 'checklist_ponto_haste' && pontoIndex !== undefined) index = pontosHastesTermometros[pontoIndex].fotoHaste.length;
      // Checklist - ponto termômetro
      else if (tipo === 'checklist_ponto_termometro' && pontoIndex !== undefined) index = pontosHastesTermometros[pontoIndex].fotoTermometro.length;
      // Documentos - Materiais
      else if (tipo === 'doc_materiais_previsto') index = docMateriaisPrevisto.length;
      else if (tipo === 'doc_materiais_realizado') index = docMateriaisRealizado.length;
      // Documentos - Laudos e Cadastros
      else if (tipo === 'doc_cadastro_medidor') index = docCadastroMedidor.length;
      else if (tipo === 'doc_laudo_transformador') index = docLaudoTransformador.length;
      else if (tipo === 'doc_laudo_regulador') index = docLaudoRegulador.length;
      else if (tipo === 'doc_laudo_religador') index = docLaudoReligador.length;
      else if (tipo === 'doc_apr') index = docApr.length;
      else if (tipo === 'doc_fvbt') index = docFvbt.length;
      else if (tipo === 'doc_termo_desistencia_lpt') index = docTermoDesistenciaLpt.length;
      else if (tipo === 'doc_autorizacao_passagem') index = docAutorizacaoPassagem.length;

      // FAZER BACKUP PERMANENTE DA FOTO (já com placa gravada)
      const photoMetadata = await backupPhoto(
        photoUri,
        backupObraId,
        tipo,
        index,
        location.latitude,
        location.longitude
      );

      const photoData: FotoData = {
        uri: photoUri,
        latitude: location.latitude,
        longitude: location.longitude,
        utmX: photoMetadata.utmX,
        utmY: photoMetadata.utmY,
        utmZone: photoMetadata.utmZone,
        photoId: photoMetadata.id, // Guardar ID do backup
      };

      // Adicionar foto ao array correspondente (usando forma funcional para evitar stale closure)
      if (tipo === 'antes') {
        setFotosAntes(prev => [...prev, photoData]);
      } else if (tipo === 'durante') {
        setFotosDurante(prev => [...prev, photoData]);
      } else if (tipo === 'depois') {
        setFotosDepois(prev => [...prev, photoData]);
      } else if (tipo === 'abertura') {
        setFotosAbertura(prev => [...prev, photoData]);
      } else if (tipo === 'fechamento') {
        setFotosFechamento(prev => [...prev, photoData]);
      } else if (tipo === 'ditais_abertura') {
        setFotosDitaisAbertura(prev => [...prev, photoData]);
      } else if (tipo === 'ditais_impedir') {
        setFotosDitaisImpedir(prev => [...prev, photoData]);
      } else if (tipo === 'ditais_testar') {
        setFotosDitaisTestar(prev => [...prev, photoData]);
      } else if (tipo === 'ditais_aterrar') {
        setFotosDitaisAterrar(prev => [...prev, photoData]);
      } else if (tipo === 'ditais_sinalizar') {
        setFotosDitaisSinalizar(prev => [...prev, photoData]);
      } else if (tipo === 'aterramento_vala_aberta') {
        setFotosAterramentoValaAberta(prev => [...prev, photoData]);
      } else if (tipo === 'aterramento_hastes') {
        setFotosAterramentoHastes(prev => [...prev, photoData]);
      } else if (tipo === 'aterramento_vala_fechada') {
        setFotosAterramentoValaFechada(prev => [...prev, photoData]);
      } else if (tipo === 'aterramento_medicao') {
        setFotosAterramentoMedicao(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_laudo') {
        setFotosTransformadorLaudo(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_componente_instalado') {
        setFotosTransformadorComponenteInstalado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_tombamento_instalado') {
        setFotosTransformadorTombamentoInstalado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_tape') {
        setFotosTransformadorTape(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_placa_instalado') {
        setFotosTransformadorPlacaInstalado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_instalado') {
        setFotosTransformadorInstalado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_conexoes_primarias_instalado') {
        setFotosTransformadorConexoesPrimariasInstalado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_conexoes_secundarias_instalado') {
        setFotosTransformadorConexoesSecundariasInstalado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_antes_retirar') {
        setFotosTransformadorAntesRetirar(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_laudo_retirado') {
        setFotosTransformadorLaudoRetirado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_tombamento_retirado') {
        setFotosTransformadorTombamentoRetirado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_placa_retirado') {
        setFotosTransformadorPlacaRetirado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_conexoes_primarias_retirado') {
        setFotosTransformadorConexoesPrimariasRetirado(prev => [...prev, photoData]);
      } else if (tipo === 'transformador_conexoes_secundarias_retirado') {
        setFotosTransformadorConexoesSecundariasRetirado(prev => [...prev, photoData]);
      } else if (tipo === 'medidor_padrao') {
        setFotosMedidorPadrao(prev => [...prev, photoData]);
      } else if (tipo === 'medidor_leitura') {
        setFotosMedidorLeitura(prev => [...prev, photoData]);
      } else if (tipo === 'medidor_selo_born') {
        setFotosMedidorSeloBorn(prev => [...prev, photoData]);
      } else if (tipo === 'medidor_selo_caixa') {
        setFotosMedidorSeloCaixa(prev => [...prev, photoData]);
      } else if (tipo === 'medidor_identificador_fase') {
        setFotosMedidorIdentificadorFase(prev => [...prev, photoData]);
      } else if (tipo === 'altimetria_lado_fonte') {
        setFotosAltimetriaLadoFonte(prev => [...prev, photoData]);
      } else if (tipo === 'altimetria_medicao_fonte') {
        setFotosAltimetriaMedicaoFonte(prev => [...prev, photoData]);
      } else if (tipo === 'altimetria_lado_carga') {
        setFotosAltimetriaLadoCarga(prev => [...prev, photoData]);
      } else if (tipo === 'altimetria_medicao_carga') {
        setFotosAltimetriaMedicaoCarga(prev => [...prev, photoData]);
      } else if (tipo === 'vazamento_evidencia') {
        setFotosVazamentoEvidencia(prev => [...prev, photoData]);
      } else if (tipo === 'vazamento_equipamentos_limpeza') {
        setFotosVazamentoEquipamentosLimpeza(prev => [...prev, photoData]);
      } else if (tipo === 'vazamento_tombamento_retirado') {
        setFotosVazamentoTombamentoRetirado(prev => [...prev, photoData]);
      } else if (tipo === 'vazamento_placa_retirado') {
        setFotosVazamentoPlacaRetirado(prev => [...prev, photoData]);
      } else if (tipo === 'vazamento_tombamento_instalado') {
        setFotosVazamentoTombamentoInstalado(prev => [...prev, photoData]);
      } else if (tipo === 'vazamento_placa_instalado') {
        setFotosVazamentoPlacaInstalado(prev => [...prev, photoData]);
      } else if (tipo === 'vazamento_instalacao') {
        setFotosVazamentoInstalacao(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_croqui') {
        setFotosChecklistCroqui(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_panoramica_inicial') {
        setFotosChecklistPanoramicaInicial(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_chede') {
        setFotosChecklistChaveComponente(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_padrao_geral') {
        setFotosChecklistPadraoGeral(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_padrao_interno') {
        setFotosChecklistPadraoInterno(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_frying') {
        setFotosChecklistFrying(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_abertura_fechamento_pulo') {
        setFotosChecklistAberturaFechamentoPulo(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_panoramica_final') {
        setFotosChecklistPanoramicaFinal(prev => [...prev, photoData]);
      } else if (tipo === 'checklist_poste_inteiro' && posteIndex !== undefined) {
        setFotosPostes(prev => {
          const updated = [...prev];
          updated[posteIndex] = {
            ...updated[posteIndex],
            posteInteiro: [...updated[posteIndex].posteInteiro, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_poste_descricao' && posteIndex !== undefined) {
        setFotosPostes(prev => {
          const updated = [...prev];
          updated[posteIndex] = {
            ...updated[posteIndex],
            descricao: [...updated[posteIndex].descricao, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_poste_engaste' && posteIndex !== undefined) {
        setFotosPostes(prev => {
          const updated = [...prev];
          updated[posteIndex] = {
            ...updated[posteIndex],
            engaste: [...updated[posteIndex].engaste, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_poste_conexao1' && posteIndex !== undefined) {
        setFotosPostes(prev => {
          const updated = [...prev];
          updated[posteIndex] = {
            ...updated[posteIndex],
            conexao1: [...updated[posteIndex].conexao1, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_poste_conexao2' && posteIndex !== undefined) {
        setFotosPostes(prev => {
          const updated = [...prev];
          updated[posteIndex] = {
            ...updated[posteIndex],
            conexao2: [...updated[posteIndex].conexao2, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_poste_maior_esforco' && posteIndex !== undefined) {
        setFotosPostes(prev => {
          const updated = [...prev];
          updated[posteIndex] = {
            ...updated[posteIndex],
            maiorEsforco: [...updated[posteIndex].maiorEsforco, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_poste_menor_esforco' && posteIndex !== undefined) {
        setFotosPostes(prev => {
          const updated = [...prev];
          updated[posteIndex] = {
            ...updated[posteIndex],
            menorEsforco: [...updated[posteIndex].menorEsforco, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_seccionamento' && seccionamentoIndex !== undefined) {
        setFotosSeccionamentos(prev => {
          const updated = [...prev];
          updated[seccionamentoIndex] = {
            ...updated[seccionamentoIndex],
            fotos: [...updated[seccionamentoIndex].fotos, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_emenda' && emendaIndex !== undefined) {
        setFotosEmendas(prev => {
          const updated = [...prev];
          updated[emendaIndex] = {
            ...updated[emendaIndex],
            fotos: [...updated[emendaIndex].fotos, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_poda' && podaIndex !== undefined) {
        setFotosPodas(prev => {
          const updated = [...prev];
          updated[podaIndex] = {
            ...updated[podaIndex],
            fotos: [...updated[podaIndex].fotos, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_aterramento_cerca' && aterramentoCercaIndex !== undefined) {
        setFotosAterramentosCerca(prev => {
          const updated = [...prev];
          updated[aterramentoCercaIndex] = {
            ...updated[aterramentoCercaIndex],
            fotos: [...updated[aterramentoCercaIndex].fotos, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_ponto_haste' && pontoIndex !== undefined) {
        setPontosHastesTermometros(prev => {
          const updated = [...prev];
          updated[pontoIndex] = {
            ...updated[pontoIndex],
            fotoHaste: [...updated[pontoIndex].fotoHaste, photoData]
          };
          return updated;
        });
      } else if (tipo === 'checklist_ponto_termometro' && pontoIndex !== undefined) {
        setPontosHastesTermometros(prev => {
          const updated = [...prev];
          updated[pontoIndex] = {
            ...updated[pontoIndex],
            fotoTermometro: [...updated[pontoIndex].fotoTermometro, photoData]
          };
          return updated;
        });
      } else if (tipo === 'doc_materiais_previsto') {
        setDocMateriaisPrevisto(prev => [...prev, photoData]);
      } else if (tipo === 'doc_materiais_realizado') {
        setDocMateriaisRealizado(prev => [...prev, photoData]);
      } else if (tipo === 'doc_cadastro_medidor') {
        setDocCadastroMedidor(prev => [...prev, photoData]);
      } else if (tipo === 'doc_laudo_transformador') {
        setDocLaudoTransformador(prev => [...prev, photoData]);
      } else if (tipo === 'doc_laudo_regulador') {
        setDocLaudoRegulador(prev => [...prev, photoData]);
      } else if (tipo === 'doc_laudo_religador') {
        setDocLaudoReligador(prev => [...prev, photoData]);
      } else if (tipo === 'doc_apr') {
        setDocApr(prev => [...prev, photoData]);
      } else if (tipo === 'doc_fvbt') {
        setDocFvbt(prev => [...prev, photoData]);
      } else if (tipo === 'doc_termo_desistencia_lpt') {
        setDocTermoDesistenciaLpt(prev => [...prev, photoData]);
      } else if (tipo === 'doc_autorizacao_passagem') {
        setDocAutorizacaoPassagem(prev => [...prev, photoData]);
      }

      // Feedback silencioso via toast (sem pop-up)
      showToast(
        photoMetadata.utmX && photoMetadata.utmY
          ? '📍 Foto salva com localização'
          : '📷 Foto salva',
        'success'
      );

    } catch (error: any) {
      // PROTEÇÃO ROBUSTA contra crashes
      console.error('🚨 Erro CRÍTICO ao tirar foto:', error);
      console.error('📊 Stack trace:', error?.stack || 'N/A');
      console.error('📍 Tipo de foto:', tipo);

      // Mensagem amigável baseada no tipo de erro
      let errorMessage = 'Não foi possível tirar a foto. Tente novamente.';

      if (error?.message?.includes('permission')) {
        errorMessage = 'Permissão de câmera negada. Verifique as configurações do app.';
      } else if (error?.message?.includes('location')) {
        errorMessage = 'Erro ao obter localização GPS. A foto será salva sem coordenadas.';
      } else if (error?.message?.includes('storage') || error?.message?.includes('disk') || error?.message?.toLowerCase()?.includes('espaço') || error?.message?.toLowerCase()?.includes('insuficiente')) {
        errorMessage = 'Espaço de armazenamento insuficiente. Libere espaço e tente novamente.';
      } else if (error?.message?.includes('memory')) {
        errorMessage = 'Memória insuficiente. Feche outros apps e tente novamente.';
      }

      Alert.alert(
        'Erro ao Tirar Foto',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      // GARANTIR que o estado sempre seja resetado, mesmo em caso de erro
      try {
        setUploadingPhoto(false);
      } catch (err) {
        console.error('❌ Erro ao resetar uploadingPhoto:', err);
      }
    }
  };

  // Confirmar foto após visualizar placa
  const handlePlacaConfirm = () => {
    if (!pendingPhoto) return;

    const { tipo, location, photoMetadata, posteIndex, seccionamentoIndex, aterramentoCercaIndex, pontoIndex, emendaIndex, podaIndex } = pendingPhoto;

    const photoData: FotoData = {
      uri: pendingPhoto.uri,
      latitude: location.latitude,
      longitude: location.longitude,
      utmX: photoMetadata.utmX,
      utmY: photoMetadata.utmY,
      utmZone: photoMetadata.utmZone,
      photoId: photoMetadata.id,
    };

    // Adicionar foto ao array correspondente
    if (tipo === 'antes') {
      setFotosAntes(prev => [...prev, photoData]);
    } else if (tipo === 'durante') {
      setFotosDurante(prev => [...prev, photoData]);
    } else if (tipo === 'depois') {
      setFotosDepois(prev => [...prev, photoData]);
    } else if (tipo === 'abertura') {
      setFotosAbertura(prev => [...prev, photoData]);
    } else if (tipo === 'fechamento') {
      setFotosFechamento(prev => [...prev, photoData]);
    } else if (tipo === 'ditais_abertura') {
      setFotosDitaisAbertura(prev => [...prev, photoData]);
    } else if (tipo === 'ditais_impedir') {
      setFotosDitaisImpedir(prev => [...prev, photoData]);
    } else if (tipo === 'ditais_testar') {
      setFotosDitaisTestar(prev => [...prev, photoData]);
    } else if (tipo === 'ditais_aterrar') {
      setFotosDitaisAterrar(prev => [...prev, photoData]);
    } else if (tipo === 'ditais_sinalizar') {
      setFotosDitaisSinalizar(prev => [...prev, photoData]);
    } else if (tipo === 'aterramento_vala_aberta') {
      setFotosAterramentoValaAberta(prev => [...prev, photoData]);
    } else if (tipo === 'aterramento_hastes') {
      setFotosAterramentoHastes(prev => [...prev, photoData]);
    } else if (tipo === 'aterramento_vala_fechada') {
      setFotosAterramentoValaFechada(prev => [...prev, photoData]);
    } else if (tipo === 'aterramento_medicao') {
      setFotosAterramentoMedicao(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_laudo') {
      setFotosTransformadorLaudo(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_componente_instalado') {
      setFotosTransformadorComponenteInstalado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_tombamento_instalado') {
      setFotosTransformadorTombamentoInstalado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_tape') {
      setFotosTransformadorTape(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_placa_instalado') {
      setFotosTransformadorPlacaInstalado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_instalado') {
      setFotosTransformadorInstalado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_conexoes_primarias_instalado') {
      setFotosTransformadorConexoesPrimariasInstalado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_conexoes_secundarias_instalado') {
      setFotosTransformadorConexoesSecundariasInstalado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_antes_retirar') {
      setFotosTransformadorAntesRetirar(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_laudo_retirado') {
      setFotosTransformadorLaudoRetirado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_tombamento_retirado') {
      setFotosTransformadorTombamentoRetirado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_placa_retirado') {
      setFotosTransformadorPlacaRetirado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_conexoes_primarias_retirado') {
      setFotosTransformadorConexoesPrimariasRetirado(prev => [...prev, photoData]);
    } else if (tipo === 'transformador_conexoes_secundarias_retirado') {
      setFotosTransformadorConexoesSecundariasRetirado(prev => [...prev, photoData]);
    } else if (tipo === 'medidor_padrao') {
      setFotosMedidorPadrao(prev => [...prev, photoData]);
    } else if (tipo === 'medidor_leitura') {
      setFotosMedidorLeitura(prev => [...prev, photoData]);
    } else if (tipo === 'medidor_selo_born') {
      setFotosMedidorSeloBorn(prev => [...prev, photoData]);
    } else if (tipo === 'medidor_selo_caixa') {
      setFotosMedidorSeloCaixa(prev => [...prev, photoData]);
    } else if (tipo === 'medidor_identificador_fase') {
      setFotosMedidorIdentificadorFase(prev => [...prev, photoData]);
    } else if (tipo === 'altimetria_lado_fonte') {
      setFotosAltimetriaLadoFonte(prev => [...prev, photoData]);
    } else if (tipo === 'altimetria_medicao_fonte') {
      setFotosAltimetriaMedicaoFonte(prev => [...prev, photoData]);
    } else if (tipo === 'altimetria_lado_carga') {
      setFotosAltimetriaLadoCarga(prev => [...prev, photoData]);
    } else if (tipo === 'altimetria_medicao_carga') {
      setFotosAltimetriaMedicaoCarga(prev => [...prev, photoData]);
    } else if (tipo === 'vazamento_evidencia') {
      setFotosVazamentoEvidencia(prev => [...prev, photoData]);
    } else if (tipo === 'vazamento_equipamentos_limpeza') {
      setFotosVazamentoEquipamentosLimpeza(prev => [...prev, photoData]);
    } else if (tipo === 'vazamento_tombamento_retirado') {
      setFotosVazamentoTombamentoRetirado(prev => [...prev, photoData]);
    } else if (tipo === 'vazamento_placa_retirado') {
      setFotosVazamentoPlacaRetirado(prev => [...prev, photoData]);
    } else if (tipo === 'vazamento_tombamento_instalado') {
      setFotosVazamentoTombamentoInstalado(prev => [...prev, photoData]);
    } else if (tipo === 'vazamento_placa_instalado') {
      setFotosVazamentoPlacaInstalado(prev => [...prev, photoData]);
    } else if (tipo === 'vazamento_instalacao') {
      setFotosVazamentoInstalacao(prev => [...prev, photoData]);
    } else if (tipo === 'checklist_croqui') {
      setFotosChecklistCroqui(prev => [...prev, photoData]);
    } else if (tipo === 'checklist_panoramica_inicial') {
      setFotosChecklistPanoramicaInicial(prev => [...prev, photoData]);
    } else if (tipo === 'checklist_chede') {
      setFotosChecklistChaveComponente(prev => [...prev, photoData]);
    } else if (tipo === 'checklist_padrao_geral') {
      setFotosChecklistPadraoGeral(prev => [...prev, photoData]);
    } else if (tipo === 'checklist_padrao_interno') {
      setFotosChecklistPadraoInterno(prev => [...prev, photoData]);
    } else if (tipo === 'checklist_panoramica_final') {
      setFotosChecklistPanoramicaFinal(prev => [...prev, photoData]);
    } else if (tipo === 'checklist_poste_inteiro' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          posteInteiro: [...updated[posteIndex].posteInteiro, photoData],
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_descricao' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          descricao: [...updated[posteIndex].descricao, photoData],
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_engaste' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          engaste: [...updated[posteIndex].engaste, photoData],
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_conexao1' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          conexao1: [...updated[posteIndex].conexao1, photoData],
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_conexao2' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          conexao2: [...updated[posteIndex].conexao2, photoData],
        };
        return updated;
      });
    } else if (tipo === 'checklist_seccionamento' && seccionamentoIndex !== undefined) {
      setFotosSeccionamentos(prev => {
        const updated = [...prev];
        updated[seccionamentoIndex] = {
          ...updated[seccionamentoIndex],
          fotos: [...updated[seccionamentoIndex].fotos, photoData]
        };
        return updated;
      });
    } else if (tipo === 'checklist_emenda' && emendaIndex !== undefined) {
      setFotosEmendas(prev => {
        const updated = [...prev];
        updated[emendaIndex] = {
          ...updated[emendaIndex],
          fotos: [...updated[emendaIndex].fotos, photoData]
        };
        return updated;
      });
    } else if (tipo === 'checklist_poda' && podaIndex !== undefined) {
      setFotosPodas(prev => {
        const updated = [...prev];
        updated[podaIndex] = {
          ...updated[podaIndex],
          fotos: [...updated[podaIndex].fotos, photoData]
        };
        return updated;
      });
    } else if (tipo === 'checklist_aterramento_cerca' && aterramentoCercaIndex !== undefined) {
      setFotosAterramentosCerca(prev => {
        const updated = [...prev];
        updated[aterramentoCercaIndex] = {
          ...updated[aterramentoCercaIndex],
          fotos: [...updated[aterramentoCercaIndex].fotos, photoData]
        };
        return updated;
      });
    } else if (tipo === 'checklist_ponto_haste' && pontoIndex !== undefined) {
      setPontosHastesTermometros(prev => {
        const updated = [...prev];
        updated[pontoIndex] = {
          ...updated[pontoIndex],
          fotoHaste: [...updated[pontoIndex].fotoHaste, photoData]
        };
        return updated;
      });
    } else if (tipo === 'checklist_ponto_termometro' && pontoIndex !== undefined) {
      setPontosHastesTermometros(prev => {
        const updated = [...prev];
        updated[pontoIndex] = {
          ...updated[pontoIndex],
          fotoTermometro: [...updated[pontoIndex].fotoTermometro, photoData]
        };
        return updated;
      });
    }

    // Limpar estado e fechar overlay
    setPendingPhoto(null);
    setShowPlacaOverlay(false);

    Alert.alert('✅ Foto salva!', 'Foto registrada com localização e dados da obra.');
  };

  // Refazer foto - chama takePicture novamente
  const handlePlacaRetake = () => {
    if (!pendingPhoto) return;

    const { tipo, posteIndex, seccionamentoIndex, aterramentoCercaIndex, pontoIndex, emendaIndex, podaIndex } = pendingPhoto;

    // Fechar overlay
    setShowPlacaOverlay(false);
    setPendingPhoto(null);

    // Tirar nova foto
    setTimeout(() => {
      takePicture(tipo as any, posteIndex, seccionamentoIndex, aterramentoCercaIndex, pontoIndex, emendaIndex, podaIndex);
    }, 300);
  };

  // Abrir foto em tela cheia
  const openPhotoFullscreen = (foto: FotoData) => {
    setSelectedPhotoForView(foto);
    setPhotoModalVisible(true);
  };

  // Fechar modal de foto
  const closePhotoModal = () => {
    setPhotoModalVisible(false);
    setSelectedPhotoForView(null);
  };

  // Função para selecionar documentos PDF
  const selectDocument = async (
    tipo: 'doc_cadastro_medidor' | 'doc_laudo_transformador' | 'doc_laudo_regulador' |
    'doc_laudo_religador' | 'doc_apr' | 'doc_fvbt' | 'doc_termo_desistencia_lpt' | 'doc_autorizacao_passagem' |
    'doc_materiais_previsto' | 'doc_materiais_realizado'
  ) => {
    setUploadingPhoto(true);

    try {
      // Aceitar PDF e imagens (JPG/PNG como alternativa ao scanner)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const docMimeType = asset.mimeType || 'application/pdf';

      // Obter localização (sem GPS para documentos)
      const location = { latitude: null, longitude: null };

      // Obter índice do próximo documento
      let index = 0;
      if (tipo === 'doc_cadastro_medidor') index = docCadastroMedidor.length;
      else if (tipo === 'doc_laudo_transformador') index = docLaudoTransformador.length;
      else if (tipo === 'doc_laudo_regulador') index = docLaudoRegulador.length;
      else if (tipo === 'doc_laudo_religador') index = docLaudoReligador.length;
      else if (tipo === 'doc_apr') index = docApr.length;
      else if (tipo === 'doc_fvbt') index = docFvbt.length;
      else if (tipo === 'doc_termo_desistencia_lpt') index = docTermoDesistenciaLpt.length;
      else if (tipo === 'doc_autorizacao_passagem') index = docAutorizacaoPassagem.length;
      else if (tipo === 'doc_materiais_previsto') index = docMateriaisPrevisto.length;
      else if (tipo === 'doc_materiais_realizado') index = docMateriaisRealizado.length;

      // Fazer backup permanente do documento com MIME type correto
      const docMetadata = await backupPhoto(
        asset.uri,
        backupObraId,
        tipo,
        index,
        location.latitude,
        location.longitude,
        docMimeType
      );

      const docData: FotoData = {
        uri: asset.uri, // URI local para exibição (será vazio para PDFs no render)
        latitude: location.latitude,
        longitude: location.longitude,
        utmX: docMetadata.utmX,
        utmY: docMetadata.utmY,
        utmZone: docMetadata.utmZone,
        photoId: docMetadata.id,
      };

      // Adicionar à fila de upload vinculando à obra
      await addToUploadQueue(docMetadata.id, backupObraId);

      // Atualizar estado
      if (tipo === 'doc_cadastro_medidor') setDocCadastroMedidor(prev => [...prev, docData]);
      else if (tipo === 'doc_laudo_transformador') setDocLaudoTransformador(prev => [...prev, docData]);
      else if (tipo === 'doc_laudo_regulador') setDocLaudoRegulador(prev => [...prev, docData]);
      else if (tipo === 'doc_laudo_religador') setDocLaudoReligador(prev => [...prev, docData]);
      else if (tipo === 'doc_apr') setDocApr(prev => [...prev, docData]);
      else if (tipo === 'doc_fvbt') setDocFvbt(prev => [...prev, docData]);
      else if (tipo === 'doc_termo_desistencia_lpt') setDocTermoDesistenciaLpt(prev => [...prev, docData]);
      else if (tipo === 'doc_autorizacao_passagem') setDocAutorizacaoPassagem(prev => [...prev, docData]);
      else if (tipo === 'doc_materiais_previsto') setDocMateriaisPrevisto(prev => [...prev, docData]);
      else if (tipo === 'doc_materiais_realizado') setDocMateriaisRealizado(prev => [...prev, docData]);

      showToast(
        docMimeType === 'application/pdf' ? '📄 PDF salvo com backup local' : '📷 Imagem salva com backup local',
        'success'
      );

    } catch (error: any) {
      console.error('Erro ao selecionar documento:', error);
      Alert.alert('Erro', 'Não foi possível selecionar o documento. Tente novamente.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (
    tipo: 'antes' | 'durante' | 'depois' | 'abertura' | 'fechamento' |
    'ditais_abertura' | 'ditais_impedir' | 'ditais_testar' | 'ditais_aterrar' | 'ditais_sinalizar' |
    'aterramento_vala_aberta' | 'aterramento_hastes' | 'aterramento_vala_fechada' | 'aterramento_medicao' |
    'transformador_laudo' | 'transformador_componente_instalado' | 'transformador_tombamento_instalado' |
    'transformador_tape' | 'transformador_placa_instalado' | 'transformador_instalado' |
    'transformador_conexoes_primarias_instalado' | 'transformador_conexoes_secundarias_instalado' |
    'transformador_antes_retirar' | 'transformador_laudo_retirado' | 'transformador_tombamento_retirado' | 'transformador_placa_retirado' |
    'transformador_conexoes_primarias_retirado' | 'transformador_conexoes_secundarias_retirado' |
    'medidor_padrao' | 'medidor_leitura' | 'medidor_selo_born' | 'medidor_selo_caixa' | 'medidor_identificador_fase' |
    'altimetria_lado_fonte' | 'altimetria_medicao_fonte' | 'altimetria_lado_carga' | 'altimetria_medicao_carga' |
    'vazamento_evidencia' | 'vazamento_equipamentos_limpeza' | 'vazamento_tombamento_retirado' | 'vazamento_placa_retirado' |
    'vazamento_tombamento_instalado' | 'vazamento_placa_instalado' | 'vazamento_instalacao' |
    'checklist_croqui' | 'checklist_panoramica_inicial' | 'checklist_chede' |
    'checklist_padrao_geral' | 'checklist_padrao_interno' | 'checklist_frying' | 'checklist_abertura_fechamento_pulo' |
    'checklist_ponto_haste' | 'checklist_ponto_termometro' | 'checklist_panoramica_final' |
    'checklist_poste_inteiro' | 'checklist_poste_descricao' | 'checklist_poste_engaste' | 'checklist_poste_conexao1' | 'checklist_poste_conexao2' |
    'checklist_poste_maior_esforco' | 'checklist_poste_menor_esforco' |
    'checklist_seccionamento' | 'checklist_emenda' | 'checklist_poda' | 'checklist_aterramento_cerca' |
    'doc_cadastro_medidor' | 'doc_laudo_transformador' | 'doc_laudo_regulador' |
    'doc_laudo_religador' | 'doc_apr' | 'doc_fvbt' | 'doc_termo_desistencia_lpt' | 'doc_autorizacao_passagem' |
    'doc_materiais_previsto' | 'doc_materiais_realizado',
    index: number,
    posteIndex?: number,
    seccionamentoIndex?: number,
    aterramentoCercaIndex?: number,
    pontoIndex?: number,
    emendaIndex?: number,
    podaIndex?: number
  ) => {
    try {
      // PROTEÇÃO: Validar parâmetros antes de remover
      if (typeof index !== 'number' || index < 0) {
        console.warn('⚠️ Índice inválido para removePhoto:', index);
        return;
      }
    if (tipo === 'antes') {
      setFotosAntes(fotosAntes.filter((_, i) => i !== index));
    } else if (tipo === 'durante') {
      setFotosDurante(fotosDurante.filter((_, i) => i !== index));
    } else if (tipo === 'depois') {
      setFotosDepois(fotosDepois.filter((_, i) => i !== index));
    } else if (tipo === 'abertura') {
      setFotosAbertura(fotosAbertura.filter((_, i) => i !== index));
    } else if (tipo === 'fechamento') {
      setFotosFechamento(fotosFechamento.filter((_, i) => i !== index));
    } else if (tipo === 'ditais_abertura') {
      setFotosDitaisAbertura(fotosDitaisAbertura.filter((_, i) => i !== index));
    } else if (tipo === 'ditais_impedir') {
      setFotosDitaisImpedir(fotosDitaisImpedir.filter((_, i) => i !== index));
    } else if (tipo === 'ditais_testar') {
      setFotosDitaisTestar(fotosDitaisTestar.filter((_, i) => i !== index));
    } else if (tipo === 'ditais_aterrar') {
      setFotosDitaisAterrar(fotosDitaisAterrar.filter((_, i) => i !== index));
    } else if (tipo === 'ditais_sinalizar') {
      setFotosDitaisSinalizar(fotosDitaisSinalizar.filter((_, i) => i !== index));
    } else if (tipo === 'aterramento_vala_aberta') {
      setFotosAterramentoValaAberta(fotosAterramentoValaAberta.filter((_, i) => i !== index));
    } else if (tipo === 'aterramento_hastes') {
      setFotosAterramentoHastes(fotosAterramentoHastes.filter((_, i) => i !== index));
    } else if (tipo === 'aterramento_vala_fechada') {
      setFotosAterramentoValaFechada(fotosAterramentoValaFechada.filter((_, i) => i !== index));
    } else if (tipo === 'aterramento_medicao') {
      setFotosAterramentoMedicao(fotosAterramentoMedicao.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_laudo') {
      setFotosTransformadorLaudo(fotosTransformadorLaudo.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_componente_instalado') {
      setFotosTransformadorComponenteInstalado(fotosTransformadorComponenteInstalado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_tombamento_instalado') {
      setFotosTransformadorTombamentoInstalado(fotosTransformadorTombamentoInstalado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_tape') {
      setFotosTransformadorTape(fotosTransformadorTape.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_placa_instalado') {
      setFotosTransformadorPlacaInstalado(fotosTransformadorPlacaInstalado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_instalado') {
      setFotosTransformadorInstalado(fotosTransformadorInstalado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_conexoes_primarias_instalado') {
      setFotosTransformadorConexoesPrimariasInstalado(fotosTransformadorConexoesPrimariasInstalado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_conexoes_secundarias_instalado') {
      setFotosTransformadorConexoesSecundariasInstalado(fotosTransformadorConexoesSecundariasInstalado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_antes_retirar') {
      setFotosTransformadorAntesRetirar(fotosTransformadorAntesRetirar.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_laudo_retirado') {
      setFotosTransformadorLaudoRetirado(fotosTransformadorLaudoRetirado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_tombamento_retirado') {
      setFotosTransformadorTombamentoRetirado(fotosTransformadorTombamentoRetirado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_placa_retirado') {
      setFotosTransformadorPlacaRetirado(fotosTransformadorPlacaRetirado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_conexoes_primarias_retirado') {
      setFotosTransformadorConexoesPrimariasRetirado(fotosTransformadorConexoesPrimariasRetirado.filter((_, i) => i !== index));
    } else if (tipo === 'transformador_conexoes_secundarias_retirado') {
      setFotosTransformadorConexoesSecundariasRetirado(fotosTransformadorConexoesSecundariasRetirado.filter((_, i) => i !== index));
    } else if (tipo === 'medidor_padrao') {
      setFotosMedidorPadrao(fotosMedidorPadrao.filter((_, i) => i !== index));
    } else if (tipo === 'medidor_leitura') {
      setFotosMedidorLeitura(fotosMedidorLeitura.filter((_, i) => i !== index));
    } else if (tipo === 'medidor_selo_born') {
      setFotosMedidorSeloBorn(fotosMedidorSeloBorn.filter((_, i) => i !== index));
    } else if (tipo === 'medidor_selo_caixa') {
      setFotosMedidorSeloCaixa(fotosMedidorSeloCaixa.filter((_, i) => i !== index));
    } else if (tipo === 'medidor_identificador_fase') {
      setFotosMedidorIdentificadorFase(fotosMedidorIdentificadorFase.filter((_, i) => i !== index));
    } else if (tipo === 'altimetria_lado_fonte') {
      setFotosAltimetriaLadoFonte(fotosAltimetriaLadoFonte.filter((_, i) => i !== index));
    } else if (tipo === 'altimetria_medicao_fonte') {
      setFotosAltimetriaMedicaoFonte(fotosAltimetriaMedicaoFonte.filter((_, i) => i !== index));
    } else if (tipo === 'altimetria_lado_carga') {
      setFotosAltimetriaLadoCarga(fotosAltimetriaLadoCarga.filter((_, i) => i !== index));
    } else if (tipo === 'altimetria_medicao_carga') {
      setFotosAltimetriaMedicaoCarga(fotosAltimetriaMedicaoCarga.filter((_, i) => i !== index));
    } else if (tipo === 'vazamento_evidencia') {
      setFotosVazamentoEvidencia(fotosVazamentoEvidencia.filter((_, i) => i !== index));
    } else if (tipo === 'vazamento_equipamentos_limpeza') {
      setFotosVazamentoEquipamentosLimpeza(fotosVazamentoEquipamentosLimpeza.filter((_, i) => i !== index));
    } else if (tipo === 'vazamento_tombamento_retirado') {
      setFotosVazamentoTombamentoRetirado(fotosVazamentoTombamentoRetirado.filter((_, i) => i !== index));
    } else if (tipo === 'vazamento_placa_retirado') {
      setFotosVazamentoPlacaRetirado(fotosVazamentoPlacaRetirado.filter((_, i) => i !== index));
    } else if (tipo === 'vazamento_tombamento_instalado') {
      setFotosVazamentoTombamentoInstalado(fotosVazamentoTombamentoInstalado.filter((_, i) => i !== index));
    } else if (tipo === 'vazamento_placa_instalado') {
      setFotosVazamentoPlacaInstalado(fotosVazamentoPlacaInstalado.filter((_, i) => i !== index));
    } else if (tipo === 'vazamento_instalacao') {
      setFotosVazamentoInstalacao(fotosVazamentoInstalacao.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_croqui') {
      setFotosChecklistCroqui(fotosChecklistCroqui.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_panoramica_inicial') {
      setFotosChecklistPanoramicaInicial(fotosChecklistPanoramicaInicial.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_chede') {
      setFotosChecklistChaveComponente(fotosChecklistChaveComponente.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_padrao_geral') {
      setFotosChecklistPadraoGeral(fotosChecklistPadraoGeral.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_padrao_interno') {
      setFotosChecklistPadraoInterno(fotosChecklistPadraoInterno.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_frying') {
      setFotosChecklistFrying(fotosChecklistFrying.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_abertura_fechamento_pulo') {
      setFotosChecklistAberturaFechamentoPulo(fotosChecklistAberturaFechamentoPulo.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_panoramica_final') {
      setFotosChecklistPanoramicaFinal(fotosChecklistPanoramicaFinal.filter((_, i) => i !== index));
    } else if (tipo === 'checklist_poste_inteiro' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          posteInteiro: updated[posteIndex].posteInteiro.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_descricao' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          descricao: updated[posteIndex].descricao.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_engaste' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          engaste: updated[posteIndex].engaste.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_conexao1' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          conexao1: updated[posteIndex].conexao1.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_conexao2' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          conexao2: updated[posteIndex].conexao2.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_maior_esforco' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          maiorEsforco: updated[posteIndex].maiorEsforco.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_poste_menor_esforco' && posteIndex !== undefined) {
      setFotosPostes(prev => {
        const updated = [...prev];
        updated[posteIndex] = {
          ...updated[posteIndex],
          menorEsforco: updated[posteIndex].menorEsforco.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_seccionamento' && seccionamentoIndex !== undefined) {
      setFotosSeccionamentos(prev => {
        const updated = [...prev];
        updated[seccionamentoIndex] = {
          ...updated[seccionamentoIndex],
          fotos: updated[seccionamentoIndex].fotos.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_emenda' && emendaIndex !== undefined) {
      setFotosEmendas(prev => {
        const updated = [...prev];
        updated[emendaIndex] = {
          ...updated[emendaIndex],
          fotos: updated[emendaIndex].fotos.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_poda' && podaIndex !== undefined) {
      setFotosPodas(prev => {
        const updated = [...prev];
        updated[podaIndex] = {
          ...updated[podaIndex],
          fotos: updated[podaIndex].fotos.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_aterramento_cerca' && aterramentoCercaIndex !== undefined) {
      setFotosAterramentosCerca(prev => {
        const updated = [...prev];
        updated[aterramentoCercaIndex] = {
          ...updated[aterramentoCercaIndex],
          fotos: updated[aterramentoCercaIndex].fotos.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_ponto_haste' && pontoIndex !== undefined) {
      setPontosHastesTermometros(prev => {
        const updated = [...prev];
        updated[pontoIndex] = {
          ...updated[pontoIndex],
          fotoHaste: updated[pontoIndex].fotoHaste.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'checklist_ponto_termometro' && pontoIndex !== undefined) {
      setPontosHastesTermometros(prev => {
        const updated = [...prev];
        updated[pontoIndex] = {
          ...updated[pontoIndex],
          fotoTermometro: updated[pontoIndex].fotoTermometro.filter((_, i) => i !== index)
        };
        return updated;
      });
    } else if (tipo === 'doc_cadastro_medidor') {
      setDocCadastroMedidor(docCadastroMedidor.filter((_, i) => i !== index));
    } else if (tipo === 'doc_laudo_transformador') {
      setDocLaudoTransformador(docLaudoTransformador.filter((_, i) => i !== index));
    } else if (tipo === 'doc_laudo_regulador') {
      setDocLaudoRegulador(docLaudoRegulador.filter((_, i) => i !== index));
    } else if (tipo === 'doc_laudo_religador') {
      setDocLaudoReligador(docLaudoReligador.filter((_, i) => i !== index));
    } else if (tipo === 'doc_apr') {
      setDocApr(docApr.filter((_, i) => i !== index));
    } else if (tipo === 'doc_fvbt') {
      setDocFvbt(docFvbt.filter((_, i) => i !== index));
    } else if (tipo === 'doc_termo_desistencia_lpt') {
      setDocTermoDesistenciaLpt(docTermoDesistenciaLpt.filter((_, i) => i !== index));
    } else if (tipo === 'doc_autorizacao_passagem') {
      setDocAutorizacaoPassagem(docAutorizacaoPassagem.filter((_, i) => i !== index));
    } else if (tipo === 'doc_materiais_previsto') {
      setDocMateriaisPrevisto(docMateriaisPrevisto.filter((_, i) => i !== index));
    } else if (tipo === 'doc_materiais_realizado') {
      setDocMateriaisRealizado(docMateriaisRealizado.filter((_, i) => i !== index));
    }
    } catch (error: any) {
      // PROTEÇÃO ROBUSTA: Nunca crashar ao remover foto
      console.error('🚨 Erro ao remover foto:', error);
      console.error('📍 Tipo:', tipo, 'Index:', index);

      // Não mostrar alert para não interromper fluxo
      // Apenas logar o erro
      console.warn('⚠️ Foto não foi removida, mas app continua funcionando');
    }
  };

  const handleSyncPendingObras = async () => {
    if (pendingObras.length === 0) {
      return;
    }

    setSyncingPending(true);
    try {
      const result = await syncAllPendingObras();
      await loadPendingObras();

      if (result.success === 0 && result.failed === 0) {
        Alert.alert('Sem conexao', 'Conecte-se a internet para sincronizar as obras pendentes.');
        return;
      }

      if (result.failed > 0) {
        Alert.alert('Atencao', `${result.failed} obra(s) ainda nao foram sincronizadas. Tente novamente em instantes.`);
      } else {
        Alert.alert('Sincronizado', `${result.success} obra(s) sincronizadas com sucesso!`);
      }
    } catch (error: any) {
      // PROTEÇÃO ROBUSTA: Nunca crashar na sincronização
      console.error('🚨 Erro ao sincronizar obras pendentes:', error);
      console.error('📊 Stack:', error?.stack || 'N/A');

      Alert.alert(
        'Erro na Sincronização',
        'Não foi possível sincronizar. As obras permanecem salvas localmente e serão sincronizadas depois.',
        [{ text: 'OK' }]
      );
    } finally {
      // GARANTIR que o estado seja resetado
      try {
        setSyncingPending(false);
      } catch (err) {
        console.error('❌ Erro ao resetar syncingPending:', err);
      }
    }
  };

  const handleSalvarObra = async () => {
    // ===== VALIDAÇÕES BÁSICAS OBRIGATÓRIAS (SEMPRE) =====

    // 1. Data da obra
    if (!data) {
      Alert.alert('❌ Campo Obrigatório', 'Selecione a data da obra');
      return;
    }

    // 2. Número da obra
    if (!obra || obra.trim() === '') {
      Alert.alert('❌ Campo Obrigatório', 'Digite o número da obra');
      return;
    }

    // 3. Responsável (Encarregado)
    if (!responsavel || responsavel.trim() === '') {
      Alert.alert('❌ Campo Obrigatório', 'Digite o nome do encarregado/responsável');
      return;
    }

    // 4. Tipo de Serviço
    if (!tipoServico) {
      Alert.alert('❌ Campo Obrigatório', 'Selecione o tipo de serviço');
      return;
    }

    // Perfil Linha Viva: serviço fixo
    if (isLinhaVivaUser && tipoServico !== 'Linha Viva') {
      Alert.alert('Erro', 'Para perfil Linha Viva, o tipo de serviço deve ser "Linha Viva".');
      return;
    }

    // Validação específica para COMP
    if (isAdminUser && !equipeExecutora) {
      Alert.alert('Erro', 'Selecione a equipe do lançamento');
      return;
    }

    // Validação para equipes normais
    if (!isAdminUser && !equipe) {
      Alert.alert('Erro', 'Equipe não identificada. Faça login novamente.');
      return;
    }

    // Linha Viva / Cava em Rocha - validar nomenclatura de postes (P / AD-P)
    if (isServicoPostesComFotos) {
      const codigos = new Set<string>();

      for (let i = 0; i < postesData.length; i++) {
        const poste = postesData[i];
        if (!poste.numero || poste.numero <= 0) {
          Alert.alert('Erro', `Informe o número do poste ${i + 1}.`);
          return;
        }

        const codigo = getPosteCodigo(poste);
        if (codigos.has(codigo)) {
          Alert.alert('Erro', `Identificação duplicada: ${codigo}. Ajuste número/aditivo dos postes.`);
          return;
        }
        codigos.add(codigo);
      }
    }

    // Validar número da obra (EXATAMENTE 8 ou 10 dígitos numéricos)
    const obraNumero = obra.trim();

    // Verificar se contém apenas números
    if (!/^\d+$/.test(obraNumero)) {
      Alert.alert(
        'Número da Obra Inválido',
        'O número da obra deve conter apenas números.\n\n❌ Atual: ' + obraNumero
      );
      return;
    }

    // Verificar se tem EXATAMENTE 8 ou 10 dígitos (não aceita 9!)
    if (obraNumero.length !== 8 && obraNumero.length !== 10) {
      Alert.alert(
        'Número da Obra Inválido',
        'O número da obra deve ter EXATAMENTE 8 ou 10 dígitos.\n\n✅ Aceito: 8 dígitos (ex: 12345678) ou 10 dígitos (ex: 0032401637)\n❌ Atual: ' + obraNumero.length + ' dígitos (' + obraNumero + ')'
      );
      return;
    }

    // Verificar obra semelhante já existente (mesmo número + tipo de serviço)
    if (!isEditMode) {
      const obraSemelhante = await findSimilarOpenObra(obraNumero, tipoServico);
      if (obraSemelhante) {
        Alert.alert(
          '⚠️ Obra Semelhante Encontrada',
          `Já existe uma obra "${tipoServico}" com o número ${obraNumero} em andamento.\n\nDeseja continuar de onde parou ou abrir uma nova obra?`,
          [
            {
              text: 'Continuar obra existente',
              onPress: () => {
                try {
                  const payload = encodeURIComponent(JSON.stringify(obraSemelhante));
                  router.push({ pathname: '/obra-detalhe', params: { data: payload } });
                } catch {
                  router.back();
                }
              },
            },
            {
              text: 'Abrir nova obra',
              onPress: () => prosseguirSalvamento(),
            },
            { text: 'Cancelar', style: 'cancel' },
          ]
        );
        return;
      }
    }

    // TRANSFORMADOR - Status e Laudo são obrigatórios
    if (isServicoTransformador) {
      if (!transformadorStatus) {
        Alert.alert('Erro', 'Selecione se o transformador foi Instalado ou Retirado');
        return;
      }

      // ⚡ LAUDO TRANSFORMADOR - OBRIGATÓRIO quando Transformador (exceto Documentação)
      if (isServicoTransformador && !isServicoDocumentacao && docLaudoTransformador.length === 0) {
        Alert.alert(
          '⚡ Laudo de Transformador Obrigatório',
          'O Laudo do Transformador é obrigatório para finalizar a obra.\n\nPor favor, anexe o laudo antes de salvar.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Validar fotos de conexões (avisar se incompleto, mas permitir salvar)
      if (transformadorStatus === 'Instalado') {
        const primariasOk = fotosTransformadorConexoesPrimariasInstalado.length >= 2;
        const secundariasOk = fotosTransformadorConexoesSecundariasInstalado.length >= 2;

        if (!primariasOk || !secundariasOk) {
          const mensagens = [];
          if (!primariasOk) {
            mensagens.push(`📸 Conexões Primárias Instalado: ${fotosTransformadorConexoesPrimariasInstalado.length}/2 fotos`);
          }
          if (!secundariasOk) {
            mensagens.push(`📸 Conexões Secundárias Instalado: ${fotosTransformadorConexoesSecundariasInstalado.length}/2 fotos`);
          }

          Alert.alert(
            '⚠️ Transformador Instalado - Fotos Faltando',
            `A obra será salva, mas está INCOMPLETA.\n\n❌ Faltam fotos obrigatórias do transformador instalado:\n\n${mensagens.join('\n')}\n\n💡 Você pode editar a obra depois para adicionar as fotos faltantes.`,
            [
              { text: 'Cancelar e Adicionar Fotos', style: 'cancel' },
              { text: 'Salvar Incompleta', onPress: () => prosseguirSalvamento() }
            ]
          );
          return;
        }
      }

      if (transformadorStatus === 'Retirado') {
        const primariasOk = fotosTransformadorConexoesPrimariasRetirado.length >= 2;
        const secundariasOk = fotosTransformadorConexoesSecundariasRetirado.length >= 2;

        if (!primariasOk || !secundariasOk) {
          const mensagens = [];
          if (!primariasOk) {
            mensagens.push(`📸 Conexões Primárias Retirado: ${fotosTransformadorConexoesPrimariasRetirado.length}/2 fotos`);
          }
          if (!secundariasOk) {
            mensagens.push(`📸 Conexões Secundárias Retirado: ${fotosTransformadorConexoesSecundariasRetirado.length}/2 fotos`);
          }

          Alert.alert(
            '⚠️ Transformador Retirado - Fotos Faltando',
            `A obra será salva, mas está INCOMPLETA.\n\n❌ Faltam fotos obrigatórias do transformador retirado:\n\n${mensagens.join('\n')}\n\n💡 Você pode editar a obra depois para adicionar as fotos faltantes.`,
            [
              { text: 'Cancelar e Adicionar Fotos', style: 'cancel' },
              { text: 'Salvar Incompleta', onPress: () => prosseguirSalvamento() }
            ]
          );
          return;
        }
      }
    }

    // 📋 MEDIDOR - CADASTRO OBRIGATÓRIO (exceto Documentação)
    if (!isServicoDocumentacao && isServicoMedidor && docCadastroMedidor.length === 0) {
      Alert.alert(
        '📋 Cadastro de Medidor Obrigatório',
        'O Cadastro de Medidor é obrigatório para finalizar a obra.\n\nPor favor, anexe o cadastro antes de salvar.',
        [{ text: 'OK' }]
      );
      return;
    }

    // DOCUMENTAÇÃO - todos os documentos são opcionais, o usuário envia apenas o necessário

    // CHECKLIST - Validar fotos dos postes (Maior Esforço e Menor Esforço - 2 fotos cada)
    if (isServicoChecklist && numPostes > 0) {
      const postesIncompletos = [];
      fotosPostes.forEach((poste, index) => {
        const faltaMaiorEsforco = poste.maiorEsforco.length < 2;
        const faltaMenorEsforco = poste.menorEsforco.length < 2;

        if (faltaMaiorEsforco || faltaMenorEsforco) {
          const mensagens = [];
          if (faltaMaiorEsforco) {
            mensagens.push(`  - Maior Esforço: ${poste.maiorEsforco.length}/2 fotos`);
          }
          if (faltaMenorEsforco) {
            mensagens.push(`  - Menor Esforço: ${poste.menorEsforco.length}/2 fotos`);
          }
          postesIncompletos.push(`Poste ${index + 1}:\n${mensagens.join('\n')}`);
        }
      });

      if (postesIncompletos.length > 0) {
        Alert.alert(
          '⚠️ Checklist - Postes Incompletos',
          `A obra será salva, mas está INCOMPLETA.\n\n❌ Faltam fotos obrigatórias em ${postesIncompletos.length} poste(s):\n\n${postesIncompletos.join('\n\n')}\n\n💡 Você pode editar a obra depois para adicionar as fotos faltantes.`,
          [
            { text: 'Cancelar e Adicionar Fotos', style: 'cancel' },
            { text: 'Salvar Incompleta', onPress: () => prosseguirSalvamento() }
          ]
        );
        return;
      }
    }

    // CHECKLIST DE FISCALIZAÇÃO - Validação de status e fotos dos postes
    if (isServicoChecklist) {
      // Validar cada poste
      for (let i = 0; i < fotosPostes.length; i++) {
        const poste = fotosPostes[i];

        // Verificar se status foi selecionado
        if (!poste.status) {
          Alert.alert(
            'Status Obrigatório',
            `Selecione o status (Instalado, Retirado ou Existente) para o Poste ${i + 1}`
          );
          return;
        }

        // Se RETIRADO: mínimo 2 fotos de Poste Inteiro
        if (poste.status === 'retirado') {
          if (poste.posteInteiro.length < 2) {
            Alert.alert(
              'Fotos Obrigatórias',
              `Poste ${i + 1} (Retirado): Adicione pelo menos 2 fotos do Poste Inteiro.\n\nAtual: ${poste.posteInteiro.length}/2`
            );
            return;
          }
        }

        // Se INSTALADO: todas as fotos obrigatórias
        if (poste.status === 'instalado') {
          if (poste.posteInteiro.length < 1) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1}: Adicione foto do Poste Inteiro`);
            return;
          }
          if (poste.descricao.length < 1) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1}: Adicione foto da Descrição`);
            return;
          }
          if (poste.engaste.length < 1) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1}: Adicione foto do Engaste`);
            return;
          }
          if (poste.conexao1.length < 1) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1}: Adicione foto da Conexão 1`);
            return;
          }
          if (poste.conexao2.length < 1) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1}: Adicione foto da Conexão 2`);
            return;
          }
          if (poste.maiorEsforco.length < 2) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1}: Adicione 2 fotos do Maior Esforço (${poste.maiorEsforco.length}/2)`);
            return;
          }
          if (poste.menorEsforco.length < 2) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1}: Adicione 2 fotos do Menor Esforço (${poste.menorEsforco.length}/2)`);
            return;
          }
        }

        // Se EXISTENTE: fotos obrigatórias (poste inteiro, conexão 1 e 2)
        if (poste.status === 'existente') {
          if (poste.posteInteiro.length < 1) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1} (Existente): Adicione foto do Poste Inteiro`);
            return;
          }
          if (poste.conexao1.length < 1) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1} (Existente): Adicione foto da Conexão 1`);
            return;
          }
          if (poste.conexao2.length < 1) {
            Alert.alert('Fotos Obrigatórias', `Poste ${i + 1} (Existente): Adicione foto da Conexão 2`);
            return;
          }
        }
      }
    }

    // FOTOS AGORA SÃO OPCIONAIS - Obras parciais são permitidas
    // Apenas avisar se não houver nenhuma foto
    const totalFotos = fotosAntes.length + fotosDurante.length + fotosDepois.length +
      fotosAbertura.length + fotosFechamento.length +
      fotosDitaisAbertura.length + fotosDitaisImpedir.length + fotosDitaisTestar.length +
      fotosDitaisAterrar.length + fotosDitaisSinalizar.length +
      fotosAterramentoValaAberta.length + fotosAterramentoHastes.length +
      fotosAterramentoValaFechada.length + fotosAterramentoMedicao.length +
      fotosTransformadorLaudo.length + fotosTransformadorComponenteInstalado.length +
      fotosTransformadorTombamentoInstalado.length + fotosTransformadorTape.length +
      fotosTransformadorPlacaInstalado.length + fotosTransformadorInstalado.length +
      fotosTransformadorConexoesPrimariasInstalado.length + fotosTransformadorConexoesSecundariasInstalado.length +
      fotosTransformadorAntesRetirar.length + fotosTransformadorLaudoRetirado.length +
      fotosTransformadorTombamentoRetirado.length + fotosTransformadorPlacaRetirado.length +
      fotosTransformadorConexoesPrimariasRetirado.length + fotosTransformadorConexoesSecundariasRetirado.length +
      fotosMedidorPadrao.length + fotosMedidorLeitura.length + fotosMedidorSeloBorn.length +
      fotosMedidorSeloCaixa.length + fotosMedidorIdentificadorFase.length +
      fotosChecklistCroqui.length + fotosChecklistPanoramicaInicial.length +
      fotosChecklistChaveComponente.length + fotosChecklistPadraoGeral.length +
      fotosChecklistPadraoInterno.length + fotosChecklistFrying.length +
      fotosChecklistAberturaFechamentoPulo.length + fotosChecklistPanoramicaFinal.length +
      fotosPostes.reduce((acc, p) => acc + p.posteInteiro.length + p.descricao.length + p.engaste.length + p.conexao1.length + p.conexao2.length + p.maiorEsforco.length + p.menorEsforco.length, 0) +
      fotosSeccionamentos.reduce((acc, s) => acc + s.fotos.length, 0) +
      fotosEmendas.reduce((acc, e) => acc + e.fotos.length, 0) +
      fotosPodas.reduce((acc, p) => acc + p.fotos.length, 0) +
      fotosAterramentosCerca.reduce((acc, a) => acc + a.fotos.length, 0) +
      pontosHastesTermometros.reduce((acc, p) => acc + p.fotoHaste.length + p.fotoTermometro.length, 0) +
      fotosAltimetriaLadoFonte.length + fotosAltimetriaMedicaoFonte.length +
      fotosAltimetriaLadoCarga.length + fotosAltimetriaMedicaoCarga.length +
      fotosVazamentoEvidencia.length + fotosVazamentoEquipamentosLimpeza.length +
      fotosVazamentoTombamentoRetirado.length + fotosVazamentoPlacaRetirado.length +
      fotosVazamentoTombamentoInstalado.length + fotosVazamentoPlacaInstalado.length +
      fotosVazamentoInstalacao.length +
      postesData.reduce(
        (acc, p) =>
          acc +
          p.fotosAntes.length +
          p.fotosDurante.length +
          p.fotosDepois.length +
          (isServicoBookAterramento ? p.fotosMedicao.length : 0),
        0
      );

    if (totalFotos === 0 && !isServicoDocumentacao) {
      // Apenas avisar, mas permitir salvar
      Alert.alert(
        'Obra Sem Fotos',
        'Você está salvando uma obra sem nenhuma foto. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salvar Assim Mesmo', onPress: () => prosseguirSalvamento() }
        ]
      );
      return;
    }

    // Se tem fotos ou é documentação, prossegue diretamente
    await prosseguirSalvamento();
  };

  const prosseguirSalvamento = async () => {
    setLoading(true);

    try {
      const isConnected = await checkInternetConnection();
      setIsOnline(isConnected);

      const createdAt = new Date().toISOString();

      // Helper: extrair photoId (local) ou objeto original (sincronizada)
      const extractPhotoData = (fotos: FotoData[]) => {
        return fotos.map(f => {
          // Se tem _originalData, é foto sincronizada - manter objeto completo
          if ((f as any)._originalData) {
            return (f as any)._originalData;
          }
          // Foto local - retornar apenas ID
          return f.photoId;
        }).filter(Boolean);
      };

      // Helper: extrair dados completos da foto (para estruturas JSONB)
      const extractPhotoDataFull = (fotos: FotoData[]) => {
        return fotos.map(f => {
          // Se tem _originalData, é foto sincronizada - manter objeto completo
          if ((f as any)._originalData) {
            return (f as any)._originalData;
          }
          // Foto local - salvar apenas o ID
          // O processo de sync converterá para URL pública quando necessário
          return {
            id: f.photoId,
            latitude: f.latitude,
            longitude: f.longitude,
            utmX: f.utmX,
            utmY: f.utmY,
            utmZone: f.utmZone
          };
        }).filter(Boolean);
      };

      // ✅ CORREÇÃO CRÍTICA: Salvar TODAS as fotos que estão no estado
      // Removidas as condicionais (isServicoPadrao, isServicoChave, etc.)
      // O estado só terá fotos se o usuário tirou fotos naquela seção
      const photoIds = {
        // Fotos padrão (Emenda, Poda, etc.)
        antes: extractPhotoData(fotosAntes),
        durante: extractPhotoData(fotosDurante),
        depois: extractPhotoData(fotosDepois),
        // Chave
        abertura: extractPhotoData(fotosAbertura),
        fechamento: extractPhotoData(fotosFechamento),
        // DITAIS
        ditais_abertura: extractPhotoData(fotosDitaisAbertura) as string[],
        ditais_impedir: extractPhotoData(fotosDitaisImpedir) as string[],
        ditais_testar: extractPhotoData(fotosDitaisTestar) as string[],
        ditais_aterrar: extractPhotoData(fotosDitaisAterrar) as string[],
        ditais_sinalizar: extractPhotoData(fotosDitaisSinalizar) as string[],
        // Aterramento
        aterramento_vala_aberta: extractPhotoData(fotosAterramentoValaAberta) as string[],
        aterramento_hastes: extractPhotoData(fotosAterramentoHastes) as string[],
        aterramento_vala_fechada: extractPhotoData(fotosAterramentoValaFechada) as string[],
        aterramento_medicao: extractPhotoData(fotosAterramentoMedicao) as string[],
        // Transformador
        transformador_laudo: extractPhotoData(fotosTransformadorLaudo) as string[],
        transformador_componente_instalado: extractPhotoData(fotosTransformadorComponenteInstalado) as string[],
        transformador_tombamento_instalado: extractPhotoData(fotosTransformadorTombamentoInstalado) as string[],
        transformador_tape: extractPhotoData(fotosTransformadorTape) as string[],
        transformador_placa_instalado: extractPhotoData(fotosTransformadorPlacaInstalado) as string[],
        transformador_instalado: extractPhotoData(fotosTransformadorInstalado) as string[],
        transformador_conexoes_primarias_instalado: extractPhotoData(fotosTransformadorConexoesPrimariasInstalado) as string[],
        transformador_conexoes_secundarias_instalado: extractPhotoData(fotosTransformadorConexoesSecundariasInstalado) as string[],
        transformador_antes_retirar: extractPhotoData(fotosTransformadorAntesRetirar) as string[],
        transformador_laudo_retirado: extractPhotoData(fotosTransformadorLaudoRetirado) as string[],
        transformador_tombamento_retirado: extractPhotoData(fotosTransformadorTombamentoRetirado) as string[],
        transformador_placa_retirado: extractPhotoData(fotosTransformadorPlacaRetirado) as string[],
        transformador_conexoes_primarias_retirado: extractPhotoData(fotosTransformadorConexoesPrimariasRetirado) as string[],
        transformador_conexoes_secundarias_retirado: extractPhotoData(fotosTransformadorConexoesSecundariasRetirado) as string[],
        // Medidor
        medidor_padrao: extractPhotoData(fotosMedidorPadrao) as string[],
        medidor_leitura: extractPhotoData(fotosMedidorLeitura) as string[],
        medidor_selo_born: extractPhotoData(fotosMedidorSeloBorn) as string[],
        medidor_selo_caixa: extractPhotoData(fotosMedidorSeloCaixa) as string[],
        medidor_identificador_fase: extractPhotoData(fotosMedidorIdentificadorFase) as string[],
        // Altimetria
        altimetria_lado_fonte: extractPhotoData(fotosAltimetriaLadoFonte) as string[],
        altimetria_medicao_fonte: extractPhotoData(fotosAltimetriaMedicaoFonte) as string[],
        altimetria_lado_carga: extractPhotoData(fotosAltimetriaLadoCarga) as string[],
        altimetria_medicao_carga: extractPhotoData(fotosAltimetriaMedicaoCarga) as string[],
        // Vazamento
        vazamento_evidencia: extractPhotoData(fotosVazamentoEvidencia) as string[],
        vazamento_equipamentos_limpeza: extractPhotoData(fotosVazamentoEquipamentosLimpeza) as string[],
        vazamento_tombamento_retirado: extractPhotoData(fotosVazamentoTombamentoRetirado) as string[],
        vazamento_placa_retirado: extractPhotoData(fotosVazamentoPlacaRetirado) as string[],
        vazamento_tombamento_instalado: extractPhotoData(fotosVazamentoTombamentoInstalado) as string[],
        vazamento_placa_instalado: extractPhotoData(fotosVazamentoPlacaInstalado) as string[],
        vazamento_instalacao: extractPhotoData(fotosVazamentoInstalacao) as string[],
        // Checklist
        checklist_croqui: extractPhotoData(fotosChecklistCroqui) as string[],
        checklist_panoramica_inicial: extractPhotoData(fotosChecklistPanoramicaInicial) as string[],
        checklist_chede: extractPhotoData(fotosChecklistChaveComponente) as string[],
        checklist_padrao_geral: extractPhotoData(fotosChecklistPadraoGeral) as string[],
        checklist_padrao_interno: extractPhotoData(fotosChecklistPadraoInterno) as string[],
        checklist_panoramica_final: extractPhotoData(fotosChecklistPanoramicaFinal) as string[],
        checklist_postes: fotosPostes.flatMap((poste, index) => [
          ...extractPhotoData(poste.posteInteiro),
          ...extractPhotoData(poste.descricao),
          ...extractPhotoData(poste.engaste),
          ...extractPhotoData(poste.conexao1),
          ...extractPhotoData(poste.conexao2),
          ...extractPhotoData(poste.maiorEsforco),
          ...extractPhotoData(poste.menorEsforco),
        ]),
        checklist_seccionamentos: [
          ...fotosSeccionamentos.flatMap(sec => extractPhotoData(sec.fotos)),
          ...fotosEmendas.flatMap(emenda => extractPhotoData(emenda.fotos)),
          ...fotosPodas.flatMap(poda => extractPhotoData(poda.fotos)),
        ],
        checklist_aterramento_cerca: fotosAterramentosCerca.flatMap(aterr => extractPhotoData(aterr.fotos)),
        // Documentação
        doc_apr: extractPhotoData(docApr) as string[],
        doc_cadastro_medidor: extractPhotoData(docCadastroMedidor) as string[],
        doc_laudo_transformador: extractPhotoData(docLaudoTransformador) as string[],
        doc_laudo_regulador: extractPhotoData(docLaudoRegulador) as string[],
        doc_laudo_religador: extractPhotoData(docLaudoReligador) as string[],
        doc_fvbt: extractPhotoData(docFvbt) as string[],
        doc_termo_desistencia_lpt: extractPhotoData(docTermoDesistenciaLpt) as string[],
        doc_autorizacao_passagem: extractPhotoData(docAutorizacaoPassagem) as string[],
        doc_materiais_previsto: extractPhotoData(docMateriaisPrevisto) as string[],
        doc_materiais_realizado: extractPhotoData(docMateriaisRealizado) as string[],
      };

      const obraData: any = {
        data,
        obra,
        // Para compressor, registrar o código de login (ex: COM-CZ / COM-PT)
        responsavel: isCompUser ? (equipe || 'COM-CZ') : responsavel,
        equipe: isAdminUser ? equipeExecutora : equipe, // Admin escolhe equipe; compressor usa equipe da sessao
        tipo_servico: tipoServico,
        transformador_status: isServicoTransformador ? transformadorStatus : null,
        created_at: createdAt,
        data_abertura: createdAt, // Data de início do serviço
        data_fechamento: null, // NULL = Em aberto, será preenchido quando finalizar
        // Linha Viva / Cava em Rocha - Dados dos postes
        ...(isServicoPostesComFotos && {
          postes_data: postesData.map(poste => ({
            id: getPosteIdPersistencia(poste),
            numero: poste.numero,
            isAditivo: poste.isAditivo || false,
            fotos_antes: poste.fotosAntes.map(f => f.photoId).filter(Boolean),
            fotos_durante: poste.fotosDurante.map(f => f.photoId).filter(Boolean),
            fotos_depois: poste.fotosDepois.map(f => f.photoId).filter(Boolean),
            fotos_medicao: poste.fotosMedicao.map(f => f.photoId).filter(Boolean),
          })),
        }),
        ...(isServicoPostesIdentificacao && {
          postes_data: postesIdentificados.map(poste => ({
            id: poste.isAditivo ? `AD-P${poste.numero}` : `P${poste.numero}`,
            numero: poste.numero,
            isAditivo: poste.isAditivo,
            fotos_antes: [],
            fotos_durante: [],
            fotos_depois: [],
            fotos_medicao: [],
            observacao: '',
          })),
        }),
        // Checklist de Fiscalização - Estrutura dos postes, seccionamentos e aterramentos
        ...(isServicoChecklist && {
          checklist_postes_data: fotosPostes.map((poste, index) => ({
            id: `poste_${index + 1}`,
            numero: poste.numero,
            status: poste.status,
            isAditivo: poste.isAditivo || false,
            posteInteiro: extractPhotoDataFull(poste.posteInteiro),
            descricao: extractPhotoDataFull(poste.descricao),
            engaste: extractPhotoDataFull(poste.engaste),
            conexao1: extractPhotoDataFull(poste.conexao1),
            conexao2: extractPhotoDataFull(poste.conexao2),
            maiorEsforco: extractPhotoDataFull(poste.maiorEsforco),
            menorEsforco: extractPhotoDataFull(poste.menorEsforco),
          })),
          checklist_seccionamentos_data: [
            ...fotosSeccionamentos.map((sec, index) => ({
              id: `seccionamento_${index + 1}`,
              tipo: 'seccionamento',
              numero: parseInt(sec.numero) || (index + 1),
              fotos: extractPhotoDataFull(sec.fotos),
            })),
            ...fotosEmendas.map((emenda, index) => ({
              id: `emenda_${index + 1}`,
              tipo: 'emenda',
              numero: parseInt(emenda.numero) || (index + 1),
              posteInicio: parseInt(emenda.posteInicio) || null,
              posteFim: parseInt(emenda.posteFim) || null,
              fotos: extractPhotoDataFull(emenda.fotos),
            })),
            ...fotosPodas.map((poda, index) => ({
              id: `poda_${index + 1}`,
              tipo: 'poda',
              numero: parseInt(poda.numero) || (index + 1),
              posteInicio: parseInt(poda.posteInicio) || null,
              posteFim: parseInt(poda.posteFim) || null,
              fotos: extractPhotoDataFull(poda.fotos),
            })),
          ],
          checklist_aterramentos_cerca_data: fotosAterramentosCerca.map((aterr, index) => ({
            id: `aterramento_${index + 1}`,
            numero: parseInt(aterr.numero) || (index + 1),
            fotos: extractPhotoDataFull(aterr.fotos),
          })),
          checklist_hastes_termometros_data: pontosHastesTermometros.map((ponto, index) => ({
            id: `ponto_${index + 1}`,
            numero: ponto.numero || `${index + 1}`,
            isAditivo: ponto.isAditivo || false,
            fotoHaste: extractPhotoDataFull(ponto.fotoHaste),
            fotoTermometro: extractPhotoDataFull(ponto.fotoTermometro),
          })),
        }),
      };

      // Adicionar campos created_by e creator_role apenas se as colunas existirem no banco
      // NOTA: Esses campos requerem a migration 20250213_comp_role.sql
      // Por enquanto, comentados para funcionar sem a migration
      // obraData.created_by = isCompUser ? 'COMP' : equipe;
      // obraData.creator_role = isCompUser ? 'compressor' : (isAdminUser ? 'admin' : 'equipe');

      if (!isConnected) {
        // MODO OFFLINE: Salvar obra com IDs das fotos
        // DEBUG: Verificar postes antes de salvar offline
        console.log('🪧 DEBUG OFFLINE SAVE - postesIdentificados:', postesIdentificados);
        console.log('🪧 DEBUG OFFLINE SAVE - obraData.postes_data:', JSON.stringify(obraData.postes_data));

        await saveObraOffline(obraData, photoIds, backupObraId);
        await loadPendingObras();

        const totalFotos = photoIds.antes.length + photoIds.durante.length + photoIds.depois.length +
          photoIds.abertura.length + photoIds.fechamento.length +
          photoIds.ditais_abertura.length + photoIds.ditais_impedir.length + photoIds.ditais_testar.length +
          photoIds.ditais_aterrar.length + photoIds.ditais_sinalizar.length +
          photoIds.aterramento_vala_aberta.length + photoIds.aterramento_hastes.length +
          photoIds.aterramento_vala_fechada.length + photoIds.aterramento_medicao.length +
          photoIds.transformador_laudo.length + photoIds.transformador_componente_instalado.length +
          photoIds.transformador_tombamento_instalado.length + photoIds.transformador_tape.length +
          photoIds.transformador_placa_instalado.length + photoIds.transformador_instalado.length +
          photoIds.transformador_antes_retirar.length + photoIds.transformador_tombamento_retirado.length +
          photoIds.transformador_placa_retirado.length +
          photoIds.medidor_padrao.length + photoIds.medidor_leitura.length + photoIds.medidor_selo_born.length +
          photoIds.medidor_selo_caixa.length + photoIds.medidor_identificador_fase.length +
          photoIds.altimetria_lado_fonte.length + photoIds.altimetria_medicao_fonte.length +
          photoIds.altimetria_lado_carga.length + photoIds.altimetria_medicao_carga.length +
          photoIds.vazamento_evidencia.length + photoIds.vazamento_equipamentos_limpeza.length +
          photoIds.vazamento_tombamento_retirado.length + photoIds.vazamento_placa_retirado.length +
          photoIds.vazamento_tombamento_instalado.length + photoIds.vazamento_placa_instalado.length +
          photoIds.vazamento_instalacao.length +
          photoIds.checklist_croqui.length + photoIds.checklist_panoramica_inicial.length + photoIds.checklist_chede.length +
          photoIds.checklist_aterramento_cerca.length + photoIds.checklist_padrao_geral.length + photoIds.checklist_padrao_interno.length +
          photoIds.checklist_panoramica_final.length + photoIds.checklist_postes.length + photoIds.checklist_seccionamentos.length +
          photoIds.doc_cadastro_medidor.length + photoIds.doc_laudo_transformador.length + photoIds.doc_laudo_regulador.length +
          photoIds.doc_laudo_religador.length + photoIds.doc_apr.length + photoIds.doc_fvbt.length + photoIds.doc_termo_desistencia_lpt.length +
          photoIds.doc_autorizacao_passagem.length +
          (isServicoPostesComFotos
            ? postesData.reduce(
                (acc, poste) =>
                  acc +
                  poste.fotosAntes.length +
                  poste.fotosDurante.length +
                  poste.fotosDepois.length +
                  (isServicoBookAterramento ? poste.fotosMedicao.length : 0),
                0
              )
            : 0);

        const tipoArquivo = isServicoDocumentacao ? 'arquivo(s)' : 'foto(s)';
        Alert.alert(
          '📱 Salvo Offline',
          `Obra salva localmente com ${totalFotos} ${tipoArquivo} protegida(s).\n\n✅ Todos os arquivos têm backup permanente\n🔄 Será sincronizada automaticamente quando houver internet`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      // MODO ONLINE: Fazer upload e salvar
      // Login por equipe - não precisa verificar supabase.auth

      // Adicionar fotos à fila de upload e processar
      const allPhotoIds = [
        ...photoIds.antes,
        ...photoIds.durante,
        ...photoIds.depois,
        ...photoIds.abertura,
        ...photoIds.fechamento,
        ...photoIds.ditais_abertura,
        ...photoIds.ditais_impedir,
        ...photoIds.ditais_testar,
        ...photoIds.ditais_aterrar,
        ...photoIds.ditais_sinalizar,
        ...photoIds.aterramento_vala_aberta,
        ...photoIds.aterramento_hastes,
        ...photoIds.aterramento_vala_fechada,
        ...photoIds.aterramento_medicao,
        ...photoIds.transformador_laudo,
        ...photoIds.transformador_componente_instalado,
        ...photoIds.transformador_tombamento_instalado,
        ...photoIds.transformador_tape,
        ...photoIds.transformador_placa_instalado,
        ...photoIds.transformador_instalado,
        ...photoIds.transformador_antes_retirar,
        ...photoIds.transformador_tombamento_retirado,
        ...photoIds.transformador_placa_retirado,
        ...photoIds.medidor_padrao,
        ...photoIds.medidor_leitura,
        ...photoIds.medidor_selo_born,
        ...photoIds.medidor_selo_caixa,
        ...photoIds.medidor_identificador_fase,
        ...photoIds.altimetria_lado_fonte,
        ...photoIds.altimetria_medicao_fonte,
        ...photoIds.altimetria_lado_carga,
        ...photoIds.altimetria_medicao_carga,
        ...photoIds.vazamento_evidencia,
        ...photoIds.vazamento_equipamentos_limpeza,
        ...photoIds.vazamento_tombamento_retirado,
        ...photoIds.vazamento_placa_retirado,
        ...photoIds.vazamento_tombamento_instalado,
        ...photoIds.vazamento_placa_instalado,
        ...photoIds.vazamento_instalacao,
        ...photoIds.checklist_croqui,
        ...photoIds.checklist_panoramica_inicial,
        ...photoIds.checklist_chede,
        ...photoIds.checklist_aterramento_cerca,
        ...photoIds.checklist_padrao_geral,
        ...photoIds.checklist_padrao_interno,
        ...photoIds.checklist_panoramica_final,
        ...photoIds.checklist_postes,
        ...photoIds.checklist_seccionamentos,
        ...photoIds.doc_cadastro_medidor,
        ...photoIds.doc_laudo_transformador,
        ...photoIds.doc_laudo_regulador,
        ...photoIds.doc_laudo_religador,
        ...photoIds.doc_apr,
        ...photoIds.doc_fvbt,
        ...photoIds.doc_termo_desistencia_lpt,
        ...photoIds.doc_autorizacao_passagem,
        ...photoIds.doc_materiais_previsto,
        ...photoIds.doc_materiais_realizado,
        ...(isServicoPostesComFotos
          ? postesData.flatMap(poste => [
              ...poste.fotosAntes.map(f => f.photoId).filter(Boolean) as string[],
              ...poste.fotosDurante.map(f => f.photoId).filter(Boolean) as string[],
              ...poste.fotosDepois.map(f => f.photoId).filter(Boolean) as string[],
              ...(isServicoBookAterramento ? poste.fotosMedicao.map(f => f.photoId).filter(Boolean) as string[] : []),
            ])
          : [])
      ];

      // Processar uploads (a função já adiciona à fila internamente)
      const uploadResult = await processObraPhotos(backupObraId, undefined, allPhotoIds);

      if (uploadResult.failed > 0) {
        const totalPhotos = uploadResult.success + uploadResult.failed;

        Alert.alert(
          '⚠️ Atenção - Fotos não enviadas',
          `${uploadResult.failed} de ${totalPhotos} foto(s) não puderam ser enviadas.\n\nO que deseja fazer?`,
          [
            {
              text: 'Tentar Novamente',
              onPress: async () => {
                setLoading(false);
                handleSalvarObra(); // Retry
              }
            },
            {
              text: 'Salvar Offline',
              onPress: async () => {
                await saveObraOffline(obraData, photoIds, backupObraId);
                await loadPendingObras();
                const tipoArquivoMsg = isServicoDocumentacao ? 'Documentos' : 'Fotos';
                Alert.alert(
                  'Salvo Offline',
                  `Obra salva. ${tipoArquivoMsg} serão enviados posteriormente.`,
                  [{ text: 'OK', onPress: () => router.back() }]
                );
                setLoading(false);
              }
            },
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => setLoading(false)
            }
          ]
        );
        return;
      }

      // Todas as fotos foram uploadadas - obter URLs
      console.log('📸 Obtendo metadados das fotos...');
      const allPhotos = await getAllPhotoMetadata();
      console.log(`✅ ${allPhotos.length} foto(s) com metadados carregados`);

      const fotosAntesUploaded = allPhotos.filter(p =>
        photoIds.antes.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosDuranteUploaded = allPhotos.filter(p =>
        photoIds.durante.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosDepoisUploaded = allPhotos.filter(p =>
        photoIds.depois.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Processar fotos dos postes (Linha Viva / Cava em Rocha)
      const postesDataUploaded = isServicoPostesComFotos ? postesData.map(poste => {
        const fotosAntesIds = poste.fotosAntes.map(f => f.photoId).filter(Boolean);
        const fotosDuranteIds = poste.fotosDurante.map(f => f.photoId).filter(Boolean);
        const fotosDepoisIds = poste.fotosDepois.map(f => f.photoId).filter(Boolean);
        const fotosMedicaoIds = poste.fotosMedicao.map(f => f.photoId).filter(Boolean);

        return {
          id: getPosteIdPersistencia(poste),
          numero: poste.numero,
          isAditivo: poste.isAditivo || false,
          fotos_antes: allPhotos.filter(p => fotosAntesIds.includes(p.id) && p.uploaded).map(p => ({
            url: p.uploadUrl!,
            latitude: p.latitude,
            longitude: p.longitude
          })),
          fotos_durante: allPhotos.filter(p => fotosDuranteIds.includes(p.id) && p.uploaded).map(p => ({
            url: p.uploadUrl!,
            latitude: p.latitude,
            longitude: p.longitude
          })),
          fotos_depois: allPhotos.filter(p => fotosDepoisIds.includes(p.id) && p.uploaded).map(p => ({
            url: p.uploadUrl!,
            latitude: p.latitude,
            longitude: p.longitude
          })),
          fotos_medicao: allPhotos.filter(p => fotosMedicaoIds.includes(p.id) && p.uploaded).map(p => ({
            url: p.uploadUrl!,
            latitude: p.latitude,
            longitude: p.longitude
          })),
        };
      }) : null;

      const fotosAberturaUploaded = allPhotos.filter(p =>
        photoIds.abertura.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosFechamentoUploaded = allPhotos.filter(p =>
        photoIds.fechamento.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos DITAIS
      const fotosDitaisAberturaUploaded = allPhotos.filter(p =>
        photoIds.ditais_abertura.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosDitaisImpedirUploaded = allPhotos.filter(p =>
        photoIds.ditais_impedir.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosDitaisTestarUploaded = allPhotos.filter(p =>
        photoIds.ditais_testar.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosDitaisAterrarUploaded = allPhotos.filter(p =>
        photoIds.ditais_aterrar.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosDitaisSinalizarUploaded = allPhotos.filter(p =>
        photoIds.ditais_sinalizar.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos BOOK ATERRAMENTO
      const fotosAterramentoValaAbertaUploaded = allPhotos.filter(p =>
        photoIds.aterramento_vala_aberta.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosAterramentoHastesUploaded = allPhotos.filter(p =>
        photoIds.aterramento_hastes.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosAterramentoValaFechadaUploaded = allPhotos.filter(p =>
        photoIds.aterramento_vala_fechada.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosAterramentoMedicaoUploaded = allPhotos.filter(p =>
        photoIds.aterramento_medicao.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos TRANSFORMADOR
      const fotosTransformadorLaudoUploaded = allPhotos.filter(p =>
        photoIds.transformador_laudo.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorComponenteInstaladoUploaded = allPhotos.filter(p =>
        photoIds.transformador_componente_instalado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorTombamentoInstaladoUploaded = allPhotos.filter(p =>
        photoIds.transformador_tombamento_instalado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorTapeUploaded = allPhotos.filter(p =>
        photoIds.transformador_tape.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorPlacaInstaladoUploaded = allPhotos.filter(p =>
        photoIds.transformador_placa_instalado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorInstaladoUploaded = allPhotos.filter(p =>
        photoIds.transformador_instalado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorAntesRetirarUploaded = allPhotos.filter(p =>
        photoIds.transformador_antes_retirar.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorLaudoRetiradoUploaded = allPhotos.filter(p =>
        photoIds.transformador_laudo_retirado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorTombamentoRetiradoUploaded = allPhotos.filter(p =>
        photoIds.transformador_tombamento_retirado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorPlacaRetiradoUploaded = allPhotos.filter(p =>
        photoIds.transformador_placa_retirado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos de Conexões do Transformador (Instalado)
      const fotosTransformadorConexoesPrimariasInstaladoUploaded = allPhotos.filter(p =>
        photoIds.transformador_conexoes_primarias_instalado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorConexoesSecundariasInstaladoUploaded = allPhotos.filter(p =>
        photoIds.transformador_conexoes_secundarias_instalado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos de Conexões do Transformador (Retirado)
      const fotosTransformadorConexoesPrimariasRetiradoUploaded = allPhotos.filter(p =>
        photoIds.transformador_conexoes_primarias_retirado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosTransformadorConexoesSecundariasRetiradoUploaded = allPhotos.filter(p =>
        photoIds.transformador_conexoes_secundarias_retirado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos Instalação de Medidor
      const fotosMedidorPadraoUploaded = allPhotos.filter(p =>
        photoIds.medidor_padrao.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosMedidorLeituraUploaded = allPhotos.filter(p =>
        photoIds.medidor_leitura.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosMedidorSeloBornUploaded = allPhotos.filter(p =>
        photoIds.medidor_selo_born.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosMedidorSeloCaixaUploaded = allPhotos.filter(p =>
        photoIds.medidor_selo_caixa.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosMedidorIdentificadorFaseUploaded = allPhotos.filter(p =>
        photoIds.medidor_identificador_fase.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos Altimetria
      const fotosAltimetriaLadoFonteUploaded = allPhotos.filter(p =>
        photoIds.altimetria_lado_fonte.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosAltimetriaMedicaoFonteUploaded = allPhotos.filter(p =>
        photoIds.altimetria_medicao_fonte.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosAltimetriaLadoCargaUploaded = allPhotos.filter(p =>
        photoIds.altimetria_lado_carga.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosAltimetriaMedicaoCargaUploaded = allPhotos.filter(p =>
        photoIds.altimetria_medicao_carga.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos Vazamento e Limpeza
      const fotosVazamentoEvidenciaUploaded = allPhotos.filter(p =>
        photoIds.vazamento_evidencia.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosVazamentoEquipamentosLimpezaUploaded = allPhotos.filter(p =>
        photoIds.vazamento_equipamentos_limpeza.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosVazamentoTombamentoRetiradoUploaded = allPhotos.filter(p =>
        photoIds.vazamento_tombamento_retirado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosVazamentoPlacaRetiradoUploaded = allPhotos.filter(p =>
        photoIds.vazamento_placa_retirado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosVazamentoTombamentoInstaladoUploaded = allPhotos.filter(p =>
        photoIds.vazamento_tombamento_instalado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosVazamentoPlacaInstaladoUploaded = allPhotos.filter(p =>
        photoIds.vazamento_placa_instalado.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosVazamentoInstalacaoUploaded = allPhotos.filter(p =>
        photoIds.vazamento_instalacao.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Fotos Checklist de Fiscalização
      const fotosChecklistCroquiUploaded = allPhotos.filter(p =>
        photoIds.checklist_croqui.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosChecklistPanoramicaInicialUploaded = allPhotos.filter(p =>
        photoIds.checklist_panoramica_inicial.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosChecklistChaveComponenteUploaded = allPhotos.filter(p =>
        photoIds.checklist_chede.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosChecklistPadraoGeralUploaded = allPhotos.filter(p =>
        photoIds.checklist_padrao_geral.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosChecklistPadraoInternoUploaded = allPhotos.filter(p =>
        photoIds.checklist_padrao_interno.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosChecklistPanoramicaFinalUploaded = allPhotos.filter(p =>
        photoIds.checklist_panoramica_final.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosChecklistPostesUploaded = allPhotos.filter(p =>
        photoIds.checklist_postes.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosChecklistSeccionamentosUploaded = allPhotos.filter(p =>
        photoIds.checklist_seccionamentos.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const fotosChecklistAterramentoCercaUploaded = allPhotos.filter(p =>
        photoIds.checklist_aterramento_cerca.includes(p.id) && p.uploaded
      ).map(p => ({
        url: p.uploadUrl!,
        latitude: p.latitude,
        longitude: p.longitude
      }));

      // Salvar ou atualizar obra no Supabase
      let error;

      if (isEditMode && obraId) {
        // MODO DE EDIÇÃO: Se offline, salvar alterações localmente
        if (!isConnected) {
          // MODO OFFLINE: Salvar edições localmente com a função updateObraOffline
          await updateObraOffline(obraId, obraData, photoIds);
          await loadPendingObras();

          Alert.alert(
            '📱 Alterações Salvas Offline',
            'Obra atualizada localmente.\n\nSerá sincronizada quando houver internet',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          setLoading(false);
          return;
        }

        // MODO ONLINE: Mesclar novas fotos com as existentes
        // Primeiro buscar a obra atual para pegar fotos existentes
        const { data: obraAtual, error: fetchError } = await supabase
          .from('obras')
          .select('*')
          .eq('id', obraId)
          .single();

        if (fetchError) {
          console.error('Erro ao buscar obra atual:', fetchError);
          Alert.alert('Erro', 'Não foi possível carregar a obra para atualização.');
          return;
        }

        // Mesclar fotos antigas com novas (sem duplicar)
        const mergePhotos = (existing: any[] = [], newPhotos: any[] = []) => {
          return [...(existing || []), ...newPhotos];
        };

        const { error: updateError } = await supabase
          .from('obras')
          .update(sanitizeObrasPayload({
            fotos_antes: mergePhotos(obraAtual.fotos_antes, fotosAntesUploaded),
            fotos_durante: mergePhotos(obraAtual.fotos_durante, fotosDuranteUploaded),
            fotos_depois: mergePhotos(obraAtual.fotos_depois, fotosDepoisUploaded),
            fotos_abertura: mergePhotos(obraAtual.fotos_abertura, fotosAberturaUploaded),
            fotos_fechamento: mergePhotos(obraAtual.fotos_fechamento, fotosFechamentoUploaded),
            fotos_ditais_abertura: mergePhotos(obraAtual.fotos_ditais_abertura, fotosDitaisAberturaUploaded),
            fotos_ditais_impedir: mergePhotos(obraAtual.fotos_ditais_impedir, fotosDitaisImpedirUploaded),
            fotos_ditais_testar: mergePhotos(obraAtual.fotos_ditais_testar, fotosDitaisTestarUploaded),
            fotos_ditais_aterrar: mergePhotos(obraAtual.fotos_ditais_aterrar, fotosDitaisAterrarUploaded),
            fotos_ditais_sinalizar: mergePhotos(obraAtual.fotos_ditais_sinalizar, fotosDitaisSinalizarUploaded),
            fotos_aterramento_vala_aberta: mergePhotos(obraAtual.fotos_aterramento_vala_aberta, fotosAterramentoValaAbertaUploaded),
            fotos_aterramento_hastes: mergePhotos(obraAtual.fotos_aterramento_hastes, fotosAterramentoHastesUploaded),
            fotos_aterramento_vala_fechada: mergePhotos(obraAtual.fotos_aterramento_vala_fechada, fotosAterramentoValaFechadaUploaded),
            fotos_aterramento_medicao: mergePhotos(obraAtual.fotos_aterramento_medicao, fotosAterramentoMedicaoUploaded),
            fotos_transformador_laudo: mergePhotos(obraAtual.fotos_transformador_laudo, fotosTransformadorLaudoUploaded),
            fotos_transformador_componente_instalado: mergePhotos(obraAtual.fotos_transformador_componente_instalado, fotosTransformadorComponenteInstaladoUploaded),
            fotos_transformador_tombamento_instalado: mergePhotos(obraAtual.fotos_transformador_tombamento_instalado, fotosTransformadorTombamentoInstaladoUploaded),
            fotos_transformador_tape: mergePhotos(obraAtual.fotos_transformador_tape, fotosTransformadorTapeUploaded),
            fotos_transformador_placa_instalado: mergePhotos(obraAtual.fotos_transformador_placa_instalado, fotosTransformadorPlacaInstaladoUploaded),
            fotos_transformador_instalado: mergePhotos(obraAtual.fotos_transformador_instalado, fotosTransformadorInstaladoUploaded),
            fotos_transformador_antes_retirar: mergePhotos(obraAtual.fotos_transformador_antes_retirar, fotosTransformadorAntesRetirarUploaded),
            fotos_transformador_laudo_retirado: mergePhotos(obraAtual.fotos_transformador_laudo_retirado, fotosTransformadorLaudoRetiradoUploaded),
            fotos_transformador_tombamento_retirado: mergePhotos(obraAtual.fotos_transformador_tombamento_retirado, fotosTransformadorTombamentoRetiradoUploaded),
            fotos_transformador_placa_retirado: mergePhotos(obraAtual.fotos_transformador_placa_retirado, fotosTransformadorPlacaRetiradoUploaded),
            fotos_medidor_padrao: mergePhotos(obraAtual.fotos_medidor_padrao, fotosMedidorPadraoUploaded),
            fotos_medidor_leitura: mergePhotos(obraAtual.fotos_medidor_leitura, fotosMedidorLeituraUploaded),
            fotos_medidor_selo_born: mergePhotos(obraAtual.fotos_medidor_selo_born, fotosMedidorSeloBornUploaded),
            fotos_medidor_selo_caixa: mergePhotos(obraAtual.fotos_medidor_selo_caixa, fotosMedidorSeloCaixaUploaded),
            fotos_medidor_identificador_fase: mergePhotos(obraAtual.fotos_medidor_identificador_fase, fotosMedidorIdentificadorFaseUploaded),
            fotos_altimetria_lado_fonte: mergePhotos(obraAtual.fotos_altimetria_lado_fonte, fotosAltimetriaLadoFonteUploaded),
            fotos_altimetria_medicao_fonte: mergePhotos(obraAtual.fotos_altimetria_medicao_fonte, fotosAltimetriaMedicaoFonteUploaded),
            fotos_altimetria_lado_carga: mergePhotos(obraAtual.fotos_altimetria_lado_carga, fotosAltimetriaLadoCargaUploaded),
            fotos_altimetria_medicao_carga: mergePhotos(obraAtual.fotos_altimetria_medicao_carga, fotosAltimetriaMedicaoCargaUploaded),
            fotos_vazamento_evidencia: mergePhotos(obraAtual.fotos_vazamento_evidencia, fotosVazamentoEvidenciaUploaded),
            fotos_vazamento_equipamentos_limpeza: mergePhotos(obraAtual.fotos_vazamento_equipamentos_limpeza, fotosVazamentoEquipamentosLimpezaUploaded),
            fotos_vazamento_tombamento_retirado: mergePhotos(obraAtual.fotos_vazamento_tombamento_retirado, fotosVazamentoTombamentoRetiradoUploaded),
            fotos_vazamento_placa_retirado: mergePhotos(obraAtual.fotos_vazamento_placa_retirado, fotosVazamentoPlacaRetiradoUploaded),
            fotos_vazamento_tombamento_instalado: mergePhotos(obraAtual.fotos_vazamento_tombamento_instalado, fotosVazamentoTombamentoInstaladoUploaded),
            fotos_vazamento_placa_instalado: mergePhotos(obraAtual.fotos_vazamento_placa_instalado, fotosVazamentoPlacaInstaladoUploaded),
            fotos_vazamento_instalacao: mergePhotos(obraAtual.fotos_vazamento_instalacao, fotosVazamentoInstalacaoUploaded),
            fotos_checklist_croqui: mergePhotos(obraAtual.fotos_checklist_croqui, fotosChecklistCroquiUploaded),
            fotos_checklist_panoramica_inicial: mergePhotos(obraAtual.fotos_checklist_panoramica_inicial, fotosChecklistPanoramicaInicialUploaded),
            fotos_checklist_chede: mergePhotos(obraAtual.fotos_checklist_chede, fotosChecklistChaveComponenteUploaded),
            fotos_checklist_padrao_geral: mergePhotos(obraAtual.fotos_checklist_padrao_geral, fotosChecklistPadraoGeralUploaded),
            fotos_checklist_padrao_interno: mergePhotos(obraAtual.fotos_checklist_padrao_interno, fotosChecklistPadraoInternoUploaded),
            fotos_checklist_panoramica_final: mergePhotos(obraAtual.fotos_checklist_panoramica_final, fotosChecklistPanoramicaFinalUploaded),
            fotos_checklist_postes: mergePhotos(obraAtual.fotos_checklist_postes, fotosChecklistPostesUploaded),
            fotos_checklist_seccionamentos: mergePhotos(obraAtual.fotos_checklist_seccionamentos, fotosChecklistSeccionamentosUploaded),
            fotos_checklist_aterramento_cerca: mergePhotos(obraAtual.fotos_checklist_aterramento_cerca, fotosChecklistAterramentoCercaUploaded),
            // Estrutura dos postes, seccionamentos e aterramentos do Checklist
            ...(isServicoChecklist && {
              checklist_postes_data: fotosPostes.map((poste, index) => ({
                id: `poste_${index + 1}`,
                numero: poste.numero,
                status: poste.status,
                isAditivo: poste.isAditivo || false,
                posteInteiro: extractPhotoDataFull(poste.posteInteiro),
                descricao: extractPhotoDataFull(poste.descricao),
                engaste: extractPhotoDataFull(poste.engaste),
                conexao1: extractPhotoDataFull(poste.conexao1),
                conexao2: extractPhotoDataFull(poste.conexao2),
                maiorEsforco: extractPhotoDataFull(poste.maiorEsforco),
                menorEsforco: extractPhotoDataFull(poste.menorEsforco),
              })),
              checklist_seccionamentos_data: [
                ...fotosSeccionamentos.map((sec, index) => ({
                  id: `seccionamento_${index + 1}`,
                  tipo: 'seccionamento',
                  numero: parseInt(sec.numero) || (index + 1),
                  fotos: extractPhotoDataFull(sec.fotos),
                })),
                ...fotosEmendas.map((emenda, index) => ({
                  id: `emenda_${index + 1}`,
                  tipo: 'emenda',
                  numero: parseInt(emenda.numero) || (index + 1),
                  posteInicio: parseInt(emenda.posteInicio) || null,
                  posteFim: parseInt(emenda.posteFim) || null,
                  fotos: extractPhotoDataFull(emenda.fotos),
                })),
                ...fotosPodas.map((poda, index) => ({
                  id: `poda_${index + 1}`,
                  tipo: 'poda',
                  numero: parseInt(poda.numero) || (index + 1),
                  posteInicio: parseInt(poda.posteInicio) || null,
                  posteFim: parseInt(poda.posteFim) || null,
                  fotos: extractPhotoDataFull(poda.fotos),
                })),
              ],
              checklist_aterramentos_cerca_data: fotosAterramentosCerca.map((aterr, index) => ({
                id: `aterramento_${index + 1}`,
                numero: parseInt(aterr.numero) || (index + 1),
                fotos: extractPhotoDataFull(aterr.fotos),
              })),
              checklist_hastes_termometros_data: pontosHastesTermometros.map((ponto, index) => ({
                id: `ponto_${index + 1}`,
                numero: ponto.numero || `${index + 1}`,
                isAditivo: ponto.isAditivo || false,
                fotoHaste: extractPhotoDataFull(ponto.fotoHaste),
                fotoTermometro: extractPhotoDataFull(ponto.fotoTermometro),
              })),
            }),
          }))
          .eq('id', obraId);

        error = updateError;
      } else {
        // MODO NOVO: Fazer INSERT
        // DEBUG: Verificar postes_data antes do INSERT
        console.log('🪧 DEBUG INSERT - postesIdentificados:', postesIdentificados);
        console.log('🪧 DEBUG INSERT - obraData.postes_data:', JSON.stringify(obraData.postes_data));
        console.log('🪧 DEBUG INSERT - isServicoPostesIdentificacao:', isServicoPostesIdentificacao);

        const { error: insertError } = await supabase
          .from('obras')
          .insert([
            sanitizeObrasPayload({
              ...obraData,
              ...(isServicoPostesComFotos && postesDataUploaded && {
                postes_data: postesDataUploaded,
              }),
              fotos_antes: fotosAntesUploaded,
              fotos_durante: fotosDuranteUploaded,
              fotos_depois: fotosDepoisUploaded,
              fotos_abertura: fotosAberturaUploaded,
              fotos_fechamento: fotosFechamentoUploaded,
              fotos_ditais_abertura: fotosDitaisAberturaUploaded,
              fotos_ditais_impedir: fotosDitaisImpedirUploaded,
              fotos_ditais_testar: fotosDitaisTestarUploaded,
              fotos_ditais_aterrar: fotosDitaisAterrarUploaded,
              fotos_ditais_sinalizar: fotosDitaisSinalizarUploaded,
              fotos_aterramento_vala_aberta: fotosAterramentoValaAbertaUploaded,
              fotos_aterramento_hastes: fotosAterramentoHastesUploaded,
              fotos_aterramento_vala_fechada: fotosAterramentoValaFechadaUploaded,
              fotos_aterramento_medicao: fotosAterramentoMedicaoUploaded,
              fotos_transformador_laudo: fotosTransformadorLaudoUploaded,
              fotos_transformador_componente_instalado: fotosTransformadorComponenteInstaladoUploaded,
              fotos_transformador_tombamento_instalado: fotosTransformadorTombamentoInstaladoUploaded,
              fotos_transformador_tape: fotosTransformadorTapeUploaded,
              fotos_transformador_placa_instalado: fotosTransformadorPlacaInstaladoUploaded,
              fotos_transformador_instalado: fotosTransformadorInstaladoUploaded,
              fotos_transformador_antes_retirar: fotosTransformadorAntesRetirarUploaded,
              fotos_transformador_laudo_retirado: fotosTransformadorLaudoRetiradoUploaded,
              fotos_transformador_tombamento_retirado: fotosTransformadorTombamentoRetiradoUploaded,
              fotos_transformador_placa_retirado: fotosTransformadorPlacaRetiradoUploaded,
              fotos_transformador_conexoes_primarias_instalado: fotosTransformadorConexoesPrimariasInstaladoUploaded,
              fotos_transformador_conexoes_secundarias_instalado: fotosTransformadorConexoesSecundariasInstaladoUploaded,
              fotos_transformador_conexoes_primarias_retirado: fotosTransformadorConexoesPrimariasRetiradoUploaded,
              fotos_transformador_conexoes_secundarias_retirado: fotosTransformadorConexoesSecundariasRetiradoUploaded,
              fotos_medidor_padrao: fotosMedidorPadraoUploaded,
              fotos_medidor_leitura: fotosMedidorLeituraUploaded,
              fotos_medidor_selo_born: fotosMedidorSeloBornUploaded,
              fotos_medidor_selo_caixa: fotosMedidorSeloCaixaUploaded,
              fotos_medidor_identificador_fase: fotosMedidorIdentificadorFaseUploaded,
              fotos_altimetria_lado_fonte: fotosAltimetriaLadoFonteUploaded,
              fotos_altimetria_medicao_fonte: fotosAltimetriaMedicaoFonteUploaded,
              fotos_altimetria_lado_carga: fotosAltimetriaLadoCargaUploaded,
              fotos_altimetria_medicao_carga: fotosAltimetriaMedicaoCargaUploaded,
              fotos_vazamento_evidencia: fotosVazamentoEvidenciaUploaded,
              fotos_vazamento_equipamentos_limpeza: fotosVazamentoEquipamentosLimpezaUploaded,
              fotos_vazamento_tombamento_retirado: fotosVazamentoTombamentoRetiradoUploaded,
              fotos_vazamento_placa_retirado: fotosVazamentoPlacaRetiradoUploaded,
              fotos_vazamento_tombamento_instalado: fotosVazamentoTombamentoInstaladoUploaded,
              fotos_vazamento_placa_instalado: fotosVazamentoPlacaInstaladoUploaded,
              fotos_vazamento_instalacao: fotosVazamentoInstalacaoUploaded,
              fotos_checklist_croqui: fotosChecklistCroquiUploaded,
              fotos_checklist_panoramica_inicial: fotosChecklistPanoramicaInicialUploaded,
              fotos_checklist_chede: fotosChecklistChaveComponenteUploaded,
              fotos_checklist_padrao_geral: fotosChecklistPadraoGeralUploaded,
              fotos_checklist_padrao_interno: fotosChecklistPadraoInternoUploaded,
              fotos_checklist_panoramica_final: fotosChecklistPanoramicaFinalUploaded,
              fotos_checklist_postes: fotosChecklistPostesUploaded,
              fotos_checklist_seccionamentos: fotosChecklistSeccionamentosUploaded,
              fotos_checklist_aterramento_cerca: fotosChecklistAterramentoCercaUploaded,
              user_id: null,
            }),
          ]);

        error = insertError;
      }

      if (error) {
        console.error('Erro ao salvar obra:', error);
        Alert.alert('Erro', 'Não foi possível salvar a obra no banco de dados. Tente novamente.');
        return;
      }

      // ⭐ Salvar obra completa em cache para permitir edição offline futura
      console.log('💾 Salvando obra completa no cache para permitir edição offline...');
      try {
        const obraCompleta = {
          id: obraId || obraData.obra, // ID da obra
          ...obraData,
          fotos_antes: fotosAntesUploaded,
          fotos_durante: fotosDuranteUploaded,
          fotos_depois: fotosDepoisUploaded,
          fotos_abertura: fotosAberturaUploaded,
          fotos_fechamento: fotosFechamentoUploaded,
          status: 'finalizada',
          cached_at: new Date().toISOString(),
          has_online_photos: allPhotoIds.length > 0, // Flag indicando que há fotos no servidor
        };

        // Buscar cache atual
        const cacheKey = '@obras_finalizadas_cache';
        const cacheStr = await AsyncStorage.getItem(cacheKey);
        const cache = cacheStr ? JSON.parse(cacheStr) : {};

        // Adicionar/atualizar obra no cache
        cache[obraCompleta.id] = obraCompleta;

        // Salvar cache atualizado
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
        console.log(`📝 Obra ${obraCompleta.obra} adicionada ao cache (status: finalizada)`);
        console.log(`✅ Cache atualizado - obra pode ser editada offline futuramente`);
      } catch (cacheError) {
        console.error('⚠️ Erro ao salvar cache da obra:', cacheError);
        // Não bloquear o fluxo se cache falhar
      }

      const tipoArquivoFinal = isServicoDocumentacao ? 'documento(s)' : 'foto(s)';
      const mensagemSucesso = isEditMode
        ? `Fotos adicionadas com sucesso! ${allPhotoIds.length} ${tipoArquivoFinal} enviado(s).`
        : `Obra cadastrada com ${allPhotoIds.length} ${tipoArquivoFinal} enviado(s)!`;

      Alert.alert(
        '✅ Sucesso!',
        mensagemSucesso,
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (err: any) {
      // PROTEÇÃO ROBUSTA contra crashes no salvamento
      console.error('🚨 Erro CRÍTICO ao salvar obra:', err);
      console.error('📊 Stack trace:', err?.stack || 'N/A');
      console.error('📍 Obra:', obra);
      console.error('📍 Tipo Serviço:', tipoServico);

      // Mensagem amigável baseada no tipo de erro
      let errorMessage = 'Ocorreu um erro ao salvar. Seus dados estão protegidos localmente.';
      let errorTitle = 'Erro ao Salvar';

      if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
        errorMessage = 'Erro de conexão. A obra foi salva localmente e será sincronizada depois.';
        errorTitle = 'Problema de Conexão';
      } else if (err?.message?.includes('storage') || err?.message?.includes('quota')) {
        errorMessage = 'Espaço de armazenamento insuficiente. Libere espaço e tente novamente.';
        errorTitle = 'Armazenamento Cheio';
      } else if (err?.message?.includes('photo') || err?.message?.includes('image')) {
        errorMessage = 'Erro ao processar fotos. Verifique se as fotos não estão corrompidas.';
        errorTitle = 'Erro nas Fotos';
      } else if (err?.message?.includes('permission') || err?.message?.includes('denied')) {
        errorMessage = 'Permissão negada. Verifique as configurações do app.';
        errorTitle = 'Permissão Negada';
      }

      Alert.alert(
        errorTitle,
        `${errorMessage}\n\n💾 Suas fotos estão protegidas no backup local.\n\nDeseja tentar salvar novamente?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Tentar Novamente',
            onPress: () => {
              // Tentar salvar novamente
              prosseguirSalvamento().catch(e => {
                console.error('❌ Segunda tentativa falhou:', e);
                Alert.alert('Erro Persistente', 'Não foi possível salvar. Contate o suporte.');
              });
            }
          }
        ]
      );
    } finally {
      // GARANTIR que o estado sempre seja resetado
      try {
        setLoading(false);
      } catch (err) {
        console.error('❌ Erro ao resetar loading:', err);
      }
    }
  };

  // ✅ NOVA FUNÇÃO: Calcular se pode finalizar obra
  const calcularPodeFinalizar = (): boolean => {
    // NOTA: Botão "Finalizar" fica sempre habilitado se campos básicos estão preenchidos
    // As validações de fotos obrigatórias ocorrem ao clicar (com opção de salvar parcial)

    // 1. Validar apenas campos básicos obrigatórios
    if (!data || !obra || !responsavel || !tipoServico) {
      return false;
    }

    // 2. Validar número da obra (EXATAMENTE 8 ou 10 dígitos)
    const obraNumero = obra.trim();
    if (!/^\d+$/.test(obraNumero)) {
      return false; // Não é só números
    }
    if (obraNumero.length !== 8 && obraNumero.length !== 10) {
      return false; // Não tem 8 nem 10 dígitos (bloqueia 9!)
    }

    // 3. Para transformador, exigir seleção de status (Instalado/Retirado)
    if (isServicoTransformador && !transformadorStatus) {
      return false;
    }

    // 3. Para checklist, exigir que todos os postes tenham status selecionado
    if (isServicoChecklist && numPostes > 0) {
      for (const poste of fotosPostes) {
        if (!poste.status) {
          return false; // Poste sem status selecionado
        }
      }
    }

    // ✅ Campos básicos OK - botão habilitado
    // Validações de fotos serão feitas ao clicar "Finalizar"
    return true;
  };

  // ✅ NOVA FUNÇÃO: Pausar obra (salvar rascunho)
  const handlePausar = async () => {
    // ===== VALIDAÇÕES BÁSICAS OBRIGATÓRIAS (SEMPRE) =====

    // 0. Equipe obrigatória para admin (validar primeiro, campo visível no topo do form)
    if (isAdminUser && !equipeExecutora) {
      Alert.alert('❌ Campo Obrigatório', 'Selecione a equipe do lançamento antes de salvar.');
      return;
    }

    // Validação para equipes normais
    if (!isAdminUser && !equipe) {
      Alert.alert('Erro', 'Equipe não identificada. Faça login novamente.');
      return;
    }

    // 1. Data da obra
    if (!data) {
      Alert.alert('❌ Campo Obrigatório', 'Selecione a data da obra');
      return;
    }

    // 2. Número da obra
    if (!obra || obra.trim() === '') {
      Alert.alert('❌ Campo Obrigatório', 'Digite o número da obra');
      return;
    }

    // Validar número da obra (EXATAMENTE 8 ou 10 dígitos numéricos)
    const obraNumero = obra.trim();

    // Verificar se contém apenas números
    if (!/^\d+$/.test(obraNumero)) {
      Alert.alert(
        'Número da Obra Inválido',
        'O número da obra deve conter apenas números.\n\n❌ Atual: ' + obraNumero
      );
      return;
    }

    // Verificar se tem EXATAMENTE 8 ou 10 dígitos (não aceita 9!)
    if (obraNumero.length !== 8 && obraNumero.length !== 10) {
      Alert.alert(
        'Número da Obra Inválido',
        'O número da obra deve ter EXATAMENTE 8 ou 10 dígitos.\n\n✅ Aceito: 8 dígitos (ex: 12345678) ou 10 dígitos (ex: 0032401637)\n❌ Atual: ' + obraNumero.length + ' dígitos (' + obraNumero + ')'
      );
      return;
    }

    // 3. Responsável (Encarregado)
    if (!responsavel || responsavel.trim() === '') {
      Alert.alert('❌ Campo Obrigatório', 'Digite o nome do encarregado/responsável');
      return;
    }

    // 4. Tipo de Serviço
    if (!tipoServico) {
      Alert.alert('❌ Campo Obrigatório', 'Selecione o tipo de serviço');
      return;
    }

    // Perfil Linha Viva: serviço fixo
    if (isLinhaVivaUser && tipoServico !== 'Linha Viva') {
      Alert.alert('Erro', 'Para perfil Linha Viva, o tipo de serviço deve ser "Linha Viva".');
      return;
    }

    setLoading(true);
    try {
      console.log('💾 Pausando obra como rascunho...');
      console.log('🔍 DEBUG handlePausar - Tipo de serviço:', tipoServico);
      console.log('🔍 DEBUG handlePausar - isServicoPadrao:', isServicoPadrao);
      console.log('🔍 DEBUG handlePausar - isServicoDitais:', isServicoDitais);
      console.log('🔍 DEBUG handlePausar - isServicoTransformador:', isServicoTransformador);
      console.log('🔍 DEBUG handlePausar - isServicoMedidor:', isServicoMedidor);
      console.log('🔍 DEBUG handlePausar - isServicoChecklist:', isServicoChecklist);
      console.log('🔍 DEBUG handlePausar - isServicoAltimetria:', isServicoAltimetria);
      console.log('🔍 DEBUG handlePausar - isServicoVazamento:', isServicoVazamento);

      // DEBUG: Mostrar estado atual das fotos
      console.log('📸 DEBUG handlePausar - Estado das fotos:');
      console.log('   fotosAntes:', fotosAntes.length, 'fotos', fotosAntes.map(f => f.photoId));
      console.log('   fotosDurante:', fotosDurante.length, 'fotos', fotosDurante.map(f => f.photoId));
      console.log('   fotosDepois:', fotosDepois.length, 'fotos', fotosDepois.map(f => f.photoId));
      console.log('   fotosDitaisAbertura:', fotosDitaisAbertura.length, 'fotos', fotosDitaisAbertura.map(f => f.photoId));
      console.log('   fotosDitaisImpedir:', fotosDitaisImpedir.length, 'fotos', fotosDitaisImpedir.map(f => f.photoId));
      console.log('   fotosTransformadorLaudo:', fotosTransformadorLaudo.length, 'fotos', fotosTransformadorLaudo.map(f => f.photoId));
      console.log('   fotosMedidorPadrao:', fotosMedidorPadrao.length, 'fotos', fotosMedidorPadrao.map(f => f.photoId));

      // Helper: extrair photoId (local) ou objeto original (sincronizada)
      const extractPhotoData = (fotos: FotoData[]) => {
        return fotos.map(f => {
          // Se tem _originalData, é foto sincronizada - manter objeto completo
          if ((f as any)._originalData) {
            return (f as any)._originalData;
          }
          // Foto local - retornar apenas ID
          return f.photoId;
        }).filter(Boolean);
      };

      // Helper: extrair dados completos da foto (para estruturas JSONB)
      const extractPhotoDataFull = (fotos: FotoData[]) => {
        return fotos.map(f => {
          // Se tem _originalData, é foto sincronizada - manter objeto completo
          if ((f as any)._originalData) {
            return (f as any)._originalData;
          }
          // Foto local - salvar apenas o ID
          // O processo de sync converterá para URL pública quando necessário
          return {
            id: f.photoId,
            latitude: f.latitude,
            longitude: f.longitude,
            utmX: f.utmX,
            utmY: f.utmY,
            utmZone: f.utmZone
          };
        }).filter(Boolean);
      };

      // ✅ CORREÇÃO CRÍTICA: Salvar TODAS as fotos que estão no estado
      // Removidas as condicionais (isServicoPadrao, isServicoChave, etc.)
      // O estado só terá fotos se o usuário tirou fotos naquela seção
      // Isso evita perder fotos quando o tipo de serviço é interpretado incorretamente
      const photoIds = {
        // Fotos padrão (Emenda, Poda, etc.)
        fotos_antes: extractPhotoData(fotosAntes) as string[],
        fotos_durante: extractPhotoData(fotosDurante) as string[],
        fotos_depois: extractPhotoData(fotosDepois) as string[],
        // Chave
        fotos_abertura: extractPhotoData(fotosAbertura) as string[],
        fotos_fechamento: extractPhotoData(fotosFechamento) as string[],
        // DITAIS
        fotos_ditais_abertura: extractPhotoData(fotosDitaisAbertura) as string[],
        fotos_ditais_impedir: extractPhotoData(fotosDitaisImpedir) as string[],
        fotos_ditais_testar: extractPhotoData(fotosDitaisTestar) as string[],
        fotos_ditais_aterrar: extractPhotoData(fotosDitaisAterrar) as string[],
        fotos_ditais_sinalizar: extractPhotoData(fotosDitaisSinalizar) as string[],
        // Aterramento
        fotos_aterramento_vala_aberta: extractPhotoData(fotosAterramentoValaAberta) as string[],
        fotos_aterramento_hastes: extractPhotoData(fotosAterramentoHastes) as string[],
        fotos_aterramento_vala_fechada: extractPhotoData(fotosAterramentoValaFechada) as string[],
        fotos_aterramento_medicao: extractPhotoData(fotosAterramentoMedicao) as string[],
        // Transformador
        fotos_transformador_laudo: extractPhotoData(fotosTransformadorLaudo) as string[],
        fotos_transformador_componente_instalado: extractPhotoData(fotosTransformadorComponenteInstalado) as string[],
        fotos_transformador_tombamento_instalado: extractPhotoData(fotosTransformadorTombamentoInstalado) as string[],
        fotos_transformador_tape: extractPhotoData(fotosTransformadorTape) as string[],
        fotos_transformador_placa_instalado: extractPhotoData(fotosTransformadorPlacaInstalado) as string[],
        fotos_transformador_instalado: extractPhotoData(fotosTransformadorInstalado) as string[],
        fotos_transformador_conexoes_primarias_instalado: extractPhotoData(fotosTransformadorConexoesPrimariasInstalado) as string[],
        fotos_transformador_conexoes_secundarias_instalado: extractPhotoData(fotosTransformadorConexoesSecundariasInstalado) as string[],
        fotos_transformador_antes_retirar: extractPhotoData(fotosTransformadorAntesRetirar) as string[],
        fotos_transformador_laudo_retirado: extractPhotoData(fotosTransformadorLaudoRetirado) as string[],
        fotos_transformador_tombamento_retirado: extractPhotoData(fotosTransformadorTombamentoRetirado) as string[],
        fotos_transformador_placa_retirado: extractPhotoData(fotosTransformadorPlacaRetirado) as string[],
        fotos_transformador_conexoes_primarias_retirado: extractPhotoData(fotosTransformadorConexoesPrimariasRetirado) as string[],
        fotos_transformador_conexoes_secundarias_retirado: extractPhotoData(fotosTransformadorConexoesSecundariasRetirado) as string[],
        // Medidor
        fotos_medidor_padrao: extractPhotoData(fotosMedidorPadrao) as string[],
        fotos_medidor_leitura: extractPhotoData(fotosMedidorLeitura) as string[],
        fotos_medidor_selo_born: extractPhotoData(fotosMedidorSeloBorn) as string[],
        fotos_medidor_selo_caixa: extractPhotoData(fotosMedidorSeloCaixa) as string[],
        fotos_medidor_identificador_fase: extractPhotoData(fotosMedidorIdentificadorFase) as string[],
        // Altimetria
        fotos_altimetria_lado_fonte: extractPhotoData(fotosAltimetriaLadoFonte) as string[],
        fotos_altimetria_medicao_fonte: extractPhotoData(fotosAltimetriaMedicaoFonte) as string[],
        fotos_altimetria_lado_carga: extractPhotoData(fotosAltimetriaLadoCarga) as string[],
        fotos_altimetria_medicao_carga: extractPhotoData(fotosAltimetriaMedicaoCarga) as string[],
        // Vazamento
        fotos_vazamento_evidencia: extractPhotoData(fotosVazamentoEvidencia) as string[],
        fotos_vazamento_equipamentos_limpeza: extractPhotoData(fotosVazamentoEquipamentosLimpeza) as string[],
        fotos_vazamento_tombamento_retirado: extractPhotoData(fotosVazamentoTombamentoRetirado) as string[],
        fotos_vazamento_placa_retirado: extractPhotoData(fotosVazamentoPlacaRetirado) as string[],
        fotos_vazamento_tombamento_instalado: extractPhotoData(fotosVazamentoTombamentoInstalado) as string[],
        fotos_vazamento_placa_instalado: extractPhotoData(fotosVazamentoPlacaInstalado) as string[],
        fotos_vazamento_instalacao: extractPhotoData(fotosVazamentoInstalacao) as string[],
        // Checklist
        fotos_checklist_croqui: extractPhotoData(fotosChecklistCroqui) as string[],
        fotos_checklist_panoramica_inicial: extractPhotoData(fotosChecklistPanoramicaInicial) as string[],
        fotos_checklist_chede: extractPhotoData(fotosChecklistChaveComponente) as string[],
        fotos_checklist_aterramento_cerca: fotosAterramentosCerca.flatMap(aterr => aterr.fotos.map(f => f.photoId).filter(Boolean) as string[]),
        fotos_checklist_padrao_geral: extractPhotoData(fotosChecklistPadraoGeral) as string[],
        fotos_checklist_padrao_interno: extractPhotoData(fotosChecklistPadraoInterno) as string[],
        fotos_checklist_frying: extractPhotoData(fotosChecklistFrying) as string[],
        fotos_checklist_abertura_fechamento_pulo: extractPhotoData(fotosChecklistAberturaFechamentoPulo) as string[],
        fotos_checklist_panoramica_final: extractPhotoData(fotosChecklistPanoramicaFinal) as string[],
        fotos_checklist_postes: fotosPostes.flatMap((poste, index) => [
          ...poste.posteInteiro.map(f => f.photoId).filter(Boolean) as string[],
          ...poste.descricao.map(f => f.photoId).filter(Boolean) as string[],
          ...poste.engaste.map(f => f.photoId).filter(Boolean) as string[],
          ...poste.conexao1.map(f => f.photoId).filter(Boolean) as string[],
          ...poste.conexao2.map(f => f.photoId).filter(Boolean) as string[],
          ...poste.maiorEsforco.map(f => f.photoId).filter(Boolean) as string[],
          ...poste.menorEsforco.map(f => f.photoId).filter(Boolean) as string[],
        ]),
        fotos_checklist_seccionamentos: [
          ...fotosSeccionamentos.flatMap(sec => sec.fotos.map(f => f.photoId).filter(Boolean) as string[]),
          ...fotosEmendas.flatMap(emenda => emenda.fotos.map(f => f.photoId).filter(Boolean) as string[]),
          ...fotosPodas.flatMap(poda => poda.fotos.map(f => f.photoId).filter(Boolean) as string[]),
        ],
        // Documentação - sempre salvar o que tiver no estado
        doc_apr: extractPhotoData(docApr) as string[],
        doc_cadastro_medidor: extractPhotoData(docCadastroMedidor) as string[],
        doc_laudo_transformador: extractPhotoData(docLaudoTransformador) as string[],
        doc_laudo_regulador: extractPhotoData(docLaudoRegulador) as string[],
        doc_laudo_religador: extractPhotoData(docLaudoReligador) as string[],
        doc_fvbt: extractPhotoData(docFvbt) as string[],
        doc_termo_desistencia_lpt: extractPhotoData(docTermoDesistenciaLpt) as string[],
        doc_autorizacao_passagem: extractPhotoData(docAutorizacaoPassagem) as string[],
        doc_materiais_previsto: extractPhotoData(docMateriaisPrevisto) as string[],
        doc_materiais_realizado: extractPhotoData(docMateriaisRealizado) as string[],
        // Linha Viva / Cava em Rocha - Dados dos postes (condicional pois é estrutura diferente)
        ...(isServicoPostesComFotos && {
          postes_data: postesData.map(poste => ({
            id: getPosteIdPersistencia(poste),
            numero: poste.numero,
            isAditivo: poste.isAditivo || false,
            fotos_antes: poste.fotosAntes.map(f => f.photoId).filter(Boolean),
            fotos_durante: poste.fotosDurante.map(f => f.photoId).filter(Boolean),
            fotos_depois: poste.fotosDepois.map(f => f.photoId).filter(Boolean),
            fotos_medicao: poste.fotosMedicao.map(f => f.photoId).filter(Boolean),
          })),
        }),
        // Book de Aterramento e Fundação Especial - Identificação de Postes
        ...(isServicoPostesIdentificacao && postesIdentificados.length > 0 && {
          postes_data: postesIdentificados.map(poste => ({
            id: poste.isAditivo ? `AD-P${poste.numero}` : `P${poste.numero}`,
            numero: poste.numero,
            isAditivo: poste.isAditivo,
            fotos_antes: [],
            fotos_durante: [],
            fotos_depois: [],
            fotos_medicao: [],
            observacao: '',
          })),
        }),
      };

      // Montar dados da obra (ZERO validações - aceita qualquer estado)
      // ✅ CRÍTICO: Se está editando, usar ID existente. Se está criando, gerar novo ID.
      const finalObraId = isEditMode && obraId
        ? obraId  // Reutilizar ID ao editar
        : `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`; // Novo ID ao criar

      const obraData: any = {
        id: finalObraId,
        // ✅ CRÍTICO: Preservar serverId se já foi sincronizada (evita duplicação)
        ...((isEditMode && currentServerId) && { serverId: currentServerId }),
        obra: obra?.trim() || '',
        data: data || '',
        responsavel: isCompUser ? (equipe || 'COM-CZ') : (responsavel || ''),
        equipe: isAdminUser ? (equipeExecutora || '') : (equipe || ''),
        tipo_servico: tipoServico || '',
        status: 'rascunho' as const,
        origem: 'offline' as const,
        created_at: new Date().toISOString(), // ✅ Campo obrigatório para sincronização
        creator_role: isCompUser ? 'compressor' : (isAdminUser ? 'admin' : 'equipe'),
      created_by_admin: isAdminUser ? equipe : null, // Salva código do admin (ex: Admin-Pereira) // ✅ Identificador permanente do criador
        transformador_status: transformadorStatus,
        num_postes: numPostes,
        num_seccionamentos: numSeccionamentos,
        num_aterramento_cerca: numAterramentosCerca,
        ...photoIds,
        // Postes identificados (Book de Aterramento, Fundação Especial)
        ...(isServicoPostesIdentificacao && postesIdentificados.length > 0 && {
          postes_data: postesIdentificados.map(poste => ({
            id: poste.isAditivo ? `AD-P${poste.numero}` : `P${poste.numero}`,
            numero: poste.numero,
            isAditivo: poste.isAditivo,
            fotos_antes: [],
            fotos_durante: [],
            fotos_depois: [],
            fotos_medicao: [],
            observacao: '',
          })),
        }),
        // Linha Viva / Cava em Rocha - Dados dos postes com fotos
        ...(isServicoPostesComFotos && {
          postes_data: postesData.map(poste => ({
            id: getPosteIdPersistencia(poste),
            numero: poste.numero,
            isAditivo: poste.isAditivo || false,
            fotos_antes: poste.fotosAntes.map(f => f.photoId).filter(Boolean),
            fotos_durante: poste.fotosDurante.map(f => f.photoId).filter(Boolean),
            fotos_depois: poste.fotosDepois.map(f => f.photoId).filter(Boolean),
            fotos_medicao: poste.fotosMedicao.map(f => f.photoId).filter(Boolean),
          })),
        }),
        // Checklist de Fiscalização - Estrutura dos postes, seccionamentos e aterramentos
        ...(isServicoChecklist && {
          checklist_postes_data: fotosPostes.map((poste, index) => ({
            id: `poste_${index + 1}`,
            numero: poste.numero,
            status: poste.status,
            isAditivo: poste.isAditivo || false,
            posteInteiro: extractPhotoDataFull(poste.posteInteiro),
            descricao: extractPhotoDataFull(poste.descricao),
            engaste: extractPhotoDataFull(poste.engaste),
            conexao1: extractPhotoDataFull(poste.conexao1),
            conexao2: extractPhotoDataFull(poste.conexao2),
            maiorEsforco: extractPhotoDataFull(poste.maiorEsforco),
            menorEsforco: extractPhotoDataFull(poste.menorEsforco),
          })),
          checklist_seccionamentos_data: [
            ...fotosSeccionamentos.map((sec, index) => ({
              id: `seccionamento_${index + 1}`,
              tipo: 'seccionamento',
              numero: parseInt(sec.numero) || (index + 1),
              fotos: extractPhotoDataFull(sec.fotos),
            })),
            ...fotosEmendas.map((emenda, index) => ({
              id: `emenda_${index + 1}`,
              tipo: 'emenda',
              numero: parseInt(emenda.numero) || (index + 1),
              posteInicio: parseInt(emenda.posteInicio) || null,
              posteFim: parseInt(emenda.posteFim) || null,
              fotos: extractPhotoDataFull(emenda.fotos),
            })),
            ...fotosPodas.map((poda, index) => ({
              id: `poda_${index + 1}`,
              tipo: 'poda',
              numero: parseInt(poda.numero) || (index + 1),
              posteInicio: parseInt(poda.posteInicio) || null,
              posteFim: parseInt(poda.posteFim) || null,
              fotos: extractPhotoDataFull(poda.fotos),
            })),
          ],
          checklist_aterramentos_cerca_data: fotosAterramentosCerca.map((aterr, index) => ({
            id: `aterramento_${index + 1}`,
            numero: parseInt(aterr.numero) || (index + 1),
            fotos: extractPhotoDataFull(aterr.fotos),
          })),
          checklist_hastes_termometros_data: pontosHastesTermometros.map((ponto, index) => ({
            id: `ponto_${index + 1}`,
            numero: ponto.numero || `${index + 1}`,
            isAditivo: ponto.isAditivo || false,
            fotoHaste: extractPhotoDataFull(ponto.fotoHaste),
            fotoTermometro: extractPhotoDataFull(ponto.fotoTermometro),
          })),
        }),
      };

      // DEBUG: Mostrar o que vai ser salvo
      console.log('💾 DEBUG handlePausar - PhotoIds que serão salvos:');
      console.log('   fotos_antes:', obraData.fotos_antes?.length || 0, obraData.fotos_antes);
      console.log('   fotos_durante:', obraData.fotos_durante?.length || 0, obraData.fotos_durante);
      console.log('   fotos_depois:', obraData.fotos_depois?.length || 0, obraData.fotos_depois);
      console.log('   fotos_ditais_abertura:', obraData.fotos_ditais_abertura?.length || 0, obraData.fotos_ditais_abertura);
      console.log('   fotos_transformador_laudo:', obraData.fotos_transformador_laudo?.length || 0, obraData.fotos_transformador_laudo);
      console.log('   fotos_medidor_padrao:', obraData.fotos_medidor_padrao?.length || 0, obraData.fotos_medidor_padrao);

      const savedObraId = await saveObraLocal(obraData);

      console.log(`✅ Obra pausada com ID: ${savedObraId}`);

      // ✅ CRÍTICO: Atualizar obraId das fotos no photo-backup
      // As fotos foram salvas com backupObraId (tempObraId ou obraId antigo)
      // Precisamos atualizar para o novo ID da obra salva
      if (backupObraId !== savedObraId) {
        console.log(`🔄 Atualizando obraId das fotos de ${backupObraId} para ${savedObraId}`);
        try {
          const qtd = await updatePhotosObraId(backupObraId, savedObraId);
          console.log(`✅ ${qtd} foto(s) atualizadas com novo obraId`);
        } catch (error) {
          console.error('❌ Erro ao atualizar obraId das fotos:', error);
          console.warn('⚠️ Continuando sem atualizar IDs das fotos. As fotos podem não aparecer ao reabrir a obra.');
        }
      }

      Alert.alert(
        '💾 Obra Pausada',
        'Obra salva como rascunho.\n\nVocê pode continuar editando depois na lista de obras.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Erro ao pausar obra:', error);
      Alert.alert('Erro', 'Não foi possível pausar a obra. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View
            style={[
              styles.connectionCard,
              isOnline ? styles.connectionCardOnline : styles.connectionCardOffline,
            ]}
          >
            <View style={styles.connectionInfo}>
              <View
                style={[
                  styles.connectionDot,
                  isOnline ? styles.connectionDotOnline : styles.connectionDotOffline,
                ]}
              />
              <View style={styles.connectionTextWrapper}>
                <Text style={styles.connectionTitle}>
                  {isOnline ? 'Voce esta online' : 'Modo offline'}
                </Text>
                <Text style={styles.connectionSubtitle}>
                  {isOnline
                    ? pendingObras.length > 0
                      ? `${pendingObras.length} obra(s) aguardando sincronizacao`
                      : 'Tudo sincronizado'
                    : 'As obras serao salvas no dispositivo e sincronizadas depois'}
                </Text>
              </View>
            </View>
            {pendingObras.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.connectionAction,
                  (!isOnline || syncingPending) && styles.connectionActionDisabled,
                ]}
                onPress={handleSyncPendingObras}
                disabled={!isOnline || syncingPending}
              >
                {syncingPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.connectionActionText}>Sincronizar agora</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {pendingObras.length > 0 && (
            <View style={styles.pendingContainer}>
              <View style={styles.pendingHeader}>
                <Text style={styles.pendingTitle}>Obras pendentes</Text>
                <Text style={styles.pendingCount}>{`${pendingObras.length} itens`}</Text>
              </View>

              {pendingObras.map((obra, index) => (
                <View
                  key={obra.id}
                  style={[styles.pendingItem, index === 0 && styles.pendingItemFirst]}
                >
                  <View
                    style={[
                      styles.pendingStatusBadge,
                      obra.sync_status === 'failed'
                        ? styles.pendingStatusFailed
                        : obra.sync_status === 'syncing'
                        ? styles.pendingStatusSyncing
                        : styles.pendingStatusPending,
                    ]}
                  >
                    <Text style={styles.pendingStatusText}>
                      {getSyncStatusLabel(obra.sync_status)}
                    </Text>
                  </View>
                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingObraName}>{obra.obra || 'Obra sem titulo'}</Text>
                    <Text style={styles.pendingMeta}>
                      {(obra.responsavel || 'Sem responsavel') + ' - ' + formatDateForDisplay(obra.data)}
                    </Text>
                    {obra.error_message ? (
                      <Text style={styles.pendingErrorText}>{obra.error_message}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.title}>{isEditMode ? 'Continuar Obra' : 'Nova Obra'}</Text>

          {/* Data */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data *</Text>
            <TouchableOpacity
              style={[styles.dropdownButton, isEditMode && styles.inputDisabled]}
              onPress={openDatePicker}
              disabled={loading || isEditMode}
            >
              <Text style={styles.dropdownButtonText}>
                {formatDateForDisplay(data)}
              </Text>
              <Text style={styles.dropdownIcon}>📅</Text>
            </TouchableOpacity>
          </View>

          {/* Obra */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número da Obra *</Text>
            <TextInput
              style={[styles.input, isEditMode && styles.inputDisabled]}
              value={obra}
              onChangeText={(text) => {
                // Remover caracteres não numéricos
                const numericOnly = text.replace(/[^0-9]/g, '');
                // Limitar a 10 dígitos
                const limited = numericOnly.slice(0, 10);
                setObra(limited);
              }}
              placeholder="Ex: 0032401637"
              editable={!loading && !isEditMode}
              keyboardType="numeric"
              maxLength={10}
            />
            <Text style={styles.hint}>
              Digite apenas números (8 ou 10 dígitos)
            </Text>
          </View>

          {/* Encarregado */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Encarregado *</Text>
            <TextInput
              style={[styles.input, isEditMode && styles.inputDisabled]}
              value={responsavel}
              onChangeText={setResponsavel}
              placeholder="Nome do responsável"
              editable={!loading && !isEditMode}
            />
          </View>

          {/* Tipo de Serviço */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de Serviço *</Text>
            <TouchableOpacity
              style={[styles.dropdownButton, (isEditMode || isCompUser || isLinhaVivaUser) && styles.inputDisabled]}
              onPress={() => setShowServicoModal(true)}
              disabled={loading || isEditMode || isCompUser || isLinhaVivaUser}
            >
              <Text style={styles.dropdownButtonText}>
                {!tipoServico ? 'Selecione o serviço' : tipoServico}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>
            {isCompUser && (
              <Text style={styles.hint}>
                Fixado em "Cava em Rocha" para perfil compressor
              </Text>
            )}
            {isLinhaVivaUser && (
              <Text style={styles.hint}>
                Fixado em "Linha Viva" para perfil Linha Viva
              </Text>
            )}
          </View>

          {/* Equipe de Lançamento - apenas Admin */}
          {isAdminUser && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Equipe de Lançamento *</Text>
              <TouchableOpacity
                style={[styles.dropdownButton, isEditMode && styles.inputDisabled]}
                onPress={() => setShowEquipeModal(true)}
                disabled={loading || isEditMode}
              >
                <Text style={[styles.dropdownButtonText, !equipeExecutora && { color: '#999' }]}>
                  {equipeExecutora || 'Selecione a equipe'}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>Perfil administrativo: selecione a equipe para lançar o book.</Text>
            </View>
          )}

          {/* APR - Opcional (disponível apenas em Documentação) */}
          {isServicoDocumentacao && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                📋 APR - Análise Preliminar de Risco (Opcional)
              </Text>
              <Text style={styles.hint}>
                Você pode anexar a APR aqui. Use o modo scanner para melhor qualidade.
              </Text>

              <View style={styles.docSection}>
                {/* Botão: Apenas Tirar Foto (sem PDF) */}
                <TouchableOpacity
                  style={styles.docButton}
                  onPress={() => takePicture('doc_apr')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Tirar Foto da APR'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {docApr.length > 0 && (
                  <View style={styles.docList}>
                    {docApr.map((doc, index) => (
                      <View key={index} style={styles.docItem}>
                        {doc.uri ? (
                          <>
                            <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                            <Text style={styles.docFileName}>📷 APR Foto {index + 1}</Text>
                          </>
                        ) : (
                          <Text style={styles.docFileName}>📄 APR Documento {index + 1}</Text>
                        )}
                        <TouchableOpacity
                          style={styles.docRemoveButton}
                          onPress={() => removePhoto('doc_apr', index)}
                        >
                          <Text style={styles.docRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* CADASTRO DE MEDIDOR - OBRIGATÓRIO QUANDO INSTALAÇÃO DO MEDIDOR */}
          {isServicoMedidor && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                📋 Cadastro de Medidor (OBRIGATÓRIO)
              </Text>
              <Text style={styles.hint}>
                É obrigatório anexar o cadastro do medidor para finalizar a obra. Use o modo scanner para melhor qualidade.
              </Text>

              <View style={styles.docSection}>
                {/* Botões lado a lado: Foto + PDF */}
                <View style={styles.docButtonRow}>
                  <TouchableOpacity
                    style={[styles.docButton, styles.docButtonHalf]}
                    onPress={() => takePicture('doc_cadastro_medidor')}
                    disabled={loading || uploadingPhoto}
                  >
                    <View style={styles.photoButtonContent}>
                      <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                      <Text style={styles.photoButtonText}>
                        {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.docButton, styles.docButtonHalf]}
                    onPress={() => selectDocument('doc_cadastro_medidor')}
                    disabled={loading || uploadingPhoto}
                  >
                    <View style={styles.photoButtonContent}>
                      <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                      <Text style={styles.photoButtonText}>
                        {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {docCadastroMedidor.length > 0 && (
                  <View style={styles.docList}>
                    {docCadastroMedidor.map((doc, index) => (
                      <View key={index} style={styles.docItem}>
                        {doc.uri ? (
                          <>
                            <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                            <Text style={styles.docFileName}>📷 Cadastro {index + 1}</Text>
                          </>
                        ) : (
                          <Text style={styles.docFileName}>📄 Cadastro {index + 1}</Text>
                        )}
                        <TouchableOpacity
                          style={styles.docRemoveButton}
                          onPress={() => removePhoto('doc_cadastro_medidor', index)}
                        >
                          <Text style={styles.docRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* LAUDO TRANSFORMADOR - OBRIGATÓRIO QUANDO TRANSFORMADOR INSTALADO */}
          {isServicoTransformador && transformadorStatus === 'Instalado' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                ⚡ Laudo de Transformador (OBRIGATÓRIO)
              </Text>
              <Text style={styles.hint}>
                É obrigatório anexar o laudo do transformador instalado para finalizar a obra. Use o modo scanner para melhor qualidade.
              </Text>

              <View style={styles.docSection}>
                {/* Botões lado a lado: Foto + PDF */}
                <View style={styles.docButtonRow}>
                  <TouchableOpacity
                    style={[styles.docButton, styles.docButtonHalf]}
                    onPress={() => takePicture('doc_laudo_transformador')}
                    disabled={loading || uploadingPhoto}
                  >
                    <View style={styles.photoButtonContent}>
                      <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                      <Text style={styles.photoButtonText}>
                        {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.docButton, styles.docButtonHalf]}
                    onPress={() => selectDocument('doc_laudo_transformador')}
                    disabled={loading || uploadingPhoto}
                  >
                    <View style={styles.photoButtonContent}>
                      <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                      <Text style={styles.photoButtonText}>
                        {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {docLaudoTransformador.length > 0 && (
                  <View style={styles.docList}>
                    {docLaudoTransformador.map((doc, index) => (
                      <View key={index} style={styles.docItem}>
                        {doc.uri ? (
                          <>
                            <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                            <Text style={styles.docFileName}>📷 Laudo {index + 1}</Text>
                          </>
                        ) : (
                          <Text style={styles.docFileName}>📄 Laudo {index + 1}</Text>
                        )}
                        <TouchableOpacity
                          style={styles.docRemoveButton}
                          onPress={() => removePhoto('doc_laudo_transformador', index)}
                        >
                          <Text style={styles.docRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Fotos - Apenas mostrar quando um serviço for selecionado */}
          {tipoServico && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fotos</Text>
              <Text style={styles.hint}>
                {isServicoChave
                  ? 'Fotos opcionais: Abertura e Fechamento da Chave'
                  : isServicoDitais
                  ? 'Fotos opcionais: DITAIS (Desligar, Impedir, Testar, Aterrar, Sinalizar)'
                  : isServicoBookAterramento
                  ? 'Registre os postes (P/AD-P) com fotos por poste em: Vala Aberta, Hastes, Vala Fechada e Medicao Terrometro.'
                  : isServicoFundacaoEspecial
                  ? 'Registre os postes (P/AD-P) com fotos por poste.'
                  : isServicoTransformador
                  ? 'Selecione o status do transformador. Fotos são opcionais'
                  : isServicoMedidor
                  ? 'Fotos opcionais: Padrão, Leitura, Selos e Identificador de Fase'
                  : isServicoAltimetria
                  ? 'Fotos opcionais: Lado Fonte, Medição Fonte, Lado Carga, Medição Carga'
                  : isServicoVazamento
                  ? 'Fotos opcionais: Evidência, Limpeza, Tombamentos, Placas e Instalação'
                  : isServicoPostesComFotos
                  ? 'Adicione múltiplos postes e anexe fotos por poste (Antes, Durante e Depois).'
                  : isServicoChecklist
                  ? 'Fotos opcionais: Croqui, Panorâmicas, Postes, etc. Obras parciais permitidas'
                  : isServicoDocumentacao
                  ? 'Anexe documentos conforme necessário'
                  : 'Fotos opcionais: Antes, Durante e Depois. Obras parciais permitidas'}
              </Text>

              {/* Resumo GERAL de Documentos e Fotos Faltantes */}
              {(() => {
                const missing: string[] = [];

                // Fotos do serviço padrão
                if (isServicoPadrao) {
                  if (fotosAntes.length === 0) missing.push('📷 Fotos Antes');
                  if (fotosDurante.length === 0) missing.push('📷 Fotos Durante');
                  if (fotosDepois.length === 0) missing.push('📷 Fotos Depois');
                }

                if (isServicoPostesComFotos) {
                  const totalFotosPostes = postesData.reduce(
                    (acc, poste) =>
                      acc +
                      poste.fotosAntes.length +
                      poste.fotosDurante.length +
                      poste.fotosDepois.length +
                      (isServicoBookAterramento ? poste.fotosMedicao.length : 0),
                    0
                  );
                  if (totalFotosPostes === 0) {
                    missing.push('📋 Registro de Postes (sem fotos)');
                  }
                }

                // Fotos Abertura/Fechamento
                if (isServicoChave) {
                  if (fotosAbertura.length === 0) missing.push('📷 Abertura');
                  if (fotosFechamento.length === 0) missing.push('📷 Fechamento');
                }

                // Fotos Ditais
                if (isServicoDitais) {
                  if (fotosDitaisAbertura.length === 0) missing.push('📷 Desligar');
                  if (fotosDitaisImpedir.length === 0) missing.push('📷 Impedir');
                  if (fotosDitaisTestar.length === 0) missing.push('📷 Testar');
                  if (fotosDitaisAterrar.length === 0) missing.push('📷 Aterrar');
                  if (fotosDitaisSinalizar.length === 0) missing.push('📷 Sinalizar');
                }

                return missing.length > 0 ? (
                  <View style={styles.missingPhotosCard}>
                    <Text style={styles.missingPhotosTitle}>⚠️ Faltando ({missing.length}):</Text>
                    {missing.map((item, index) => (
                      <Text key={index} style={styles.missingPhotoItem}>• {item}</Text>
                    ))}
                  </View>
                ) : null;
              })()}

              {/* Identificação de Postes (Book de Aterramento, Fundação Especial) */}
              {isServicoPostesIdentificacao && (
                <View style={styles.posteIdentificacaoSection}>
                  <Text style={styles.sectionTitle}>🪧 Identificação de Postes</Text>
                  <Text style={styles.sectionSubtitle}>
                    Digite o número do poste. O prefixo é adicionado automaticamente.
                  </Text>

                  {/* Checkbox Aditivo - Acima do input */}
                  <TouchableOpacity
                    style={styles.posteAditivoRow}
                    onPress={() => setPosteIsAditivo(!posteIsAditivo)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.posteAditivoCheckbox, posteIsAditivo && styles.posteAditivoCheckboxChecked]}>
                      {posteIsAditivo && <Text style={styles.posteAditivoCheckmark}>✓</Text>}
                    </View>
                    <Text style={[styles.posteAditivoLabel, posteIsAditivo && styles.posteAditivoLabelActive]}>
                      Poste de Aditivo (AD-)
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.posteInputRow}>
                    <View style={[styles.postePrefixBox, posteIsAditivo && styles.postePrefixBoxAditivo]}>
                      <Text style={[styles.postePrefixText, posteIsAditivo && styles.postePrefixTextAditivo]}>
                        {posteIsAditivo ? 'AD-P' : 'P'}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.posteNumeroInput}
                      value={posteNumeroInput}
                      onChangeText={(text) => setPosteNumeroInput(text.replace(/[^0-9]/g, '').slice(0, 4))}
                      placeholder="Número"
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <TouchableOpacity
                      style={[styles.posteAddButton, !posteNumeroInput.trim() && styles.posteAddButtonDisabled]}
                      onPress={adicionarPosteIdentificado}
                      disabled={!posteNumeroInput.trim()}
                    >
                      <Text style={styles.posteAddButtonText}>Adicionar</Text>
                    </TouchableOpacity>
                  </View>

                  {postesIdentificados.length > 0 && (
                    <View style={styles.posteTagsContainer}>
                      {postesIdentificados.map((poste) => (
                        <View key={`${poste.isAditivo ? 'AD-' : ''}P${poste.numero}`} style={[styles.posteTag, poste.isAditivo && styles.posteTagAditivo]}>
                          <Text style={[styles.posteTagText, poste.isAditivo && styles.posteTagTextAditivo]}>
                            {poste.isAditivo ? `AD-P${poste.numero}` : `P${poste.numero}`}
                          </Text>
                          <TouchableOpacity
                            style={[styles.posteTagRemove, poste.isAditivo && styles.posteTagRemoveAditivo]}
                            onPress={() => removerPosteIdentificado(poste.numero, poste.isAditivo)}
                          >
                            <Text style={styles.posteTagRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Linha Viva / Cava em Rocha - Sistema de Múltiplos Postes */}
              {isServicoPostesComFotos && (
                <View
                  style={styles.checklistSection}
                  onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  setSectionLayouts(prev => ({ ...prev, postes: y }));
                  }}
                >
                  <Text style={styles.checklistSectionTitle}>
                    {isServicoLinhaViva
                      ? '4️⃣ Registro dos Postes - Linha Viva'
                      : isServicoCavaRocha
                      ? '4️⃣ Registro dos Postes - Cava em Rocha'
                      : isServicoBookAterramento
                      ? '4️⃣ Registro dos Postes - Book de Aterramento'
                      : '4️⃣ Registro dos Postes - Fundação Especial'}
                  </Text>
                  <Text style={styles.checklistHint}>
                    {isServicoBookAterramento
                      ? 'Recomendado: 4 categorias por poste (Vala Aberta, Hastes, Vala Fechada e Medicao Terrometro).'
                      : 'Recomendado: 3 fotos por poste (Antes, Durante e Depois).'}
                  </Text>

                  <View style={styles.posteControls}>
                    <Text style={styles.posteCount}>Pontos: {postesData.length}</Text>
                    <TouchableOpacity style={styles.posteAddButton} onPress={adicionarPoste}>
                      <Text style={styles.posteButtonText}>➕ Adicionar Poste</Text>
                    </TouchableOpacity>
                  </View>

                  {postesData.map((poste, index) => {
                    const status = getPosteStatus(poste);
                    const secoesPoste = getPostePhotoSections();
                    const totalFotosPoste =
                      poste.fotosAntes.length +
                      poste.fotosDurante.length +
                      poste.fotosDepois.length +
                      (isServicoBookAterramento ? poste.fotosMedicao.length : 0);
                    const identificacaoPoste = getPosteCodigo(poste);

                    return (
                      <View key={poste.id} style={styles.posteCard}>
                        <Text style={styles.posteTitle}>
                          Poste {index + 1}{poste.numero > 0 ? ` - ${identificacaoPoste}` : ''}
                          {status === 'completo' && ' ✓'}
                        </Text>

                        <View style={styles.posteNumeroSection}>
                          <Text style={styles.posteNumeroLabel}>🪧 Número do Poste *</Text>
                          <TextInput
                            style={styles.posteNumeroInput}
                            placeholder="Ex: 5, 12, 23..."
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={poste.numero > 0 ? String(poste.numero) : ''}
                            onChangeText={(text) => {
                              const valorNumerico = text.replace(/[^0-9]/g, '');
                              const novoNumero = valorNumerico ? parseInt(valorNumerico, 10) : 0;
                              setPostesData(prevPostes => prevPostes.map(p =>
                                p.id === poste.id ? { ...p, numero: novoNumero } : p
                              ));
                            }}
                          />
                          {!poste.numero && (
                            <Text style={styles.hint}>Informe o número para identificar como P1, P2, etc.</Text>
                          )}
                        </View>

                        <TouchableOpacity
                          style={styles.posteAditivoCheckbox}
                          onPress={() => {
                            setPostesData(prevPostes => prevPostes.map(p =>
                              p.id === poste.id ? { ...p, isAditivo: !p.isAditivo } : p
                            ));
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.checkbox, poste.isAditivo && styles.checkboxChecked]}>
                            {poste.isAditivo && <Text style={styles.checkboxCheck}>✓</Text>}
                          </View>
                          <Text style={styles.posteAditivoLabel}>🔧 Poste Aditivo (não previsto no croqui)</Text>
                        </TouchableOpacity>

                        {!!poste.numero && (
                          <Text style={styles.hint}>Identificação: {identificacaoPoste}</Text>
                        )}

                        <Text style={styles.hint}>
                          Fotos: {totalFotosPoste} | Status: {status === 'completo' ? 'Completo' : status === 'parcial' ? 'Parcial' : 'Pendente'}
                        </Text>

                        {/* Fotos Antes */}
                        <View style={styles.postePhotoSection}>
                          <Text style={styles.postePhotoLabel}>
                            📸 {secoesPoste.primeira} ({poste.fotosAntes.length}) {poste.fotosAntes.length > 0 && '✓'}
                          </Text>
                          <TouchableOpacity
                            style={styles.photoButtonSmall}
                            onPress={() => takePicturePoste(poste.id, 'fotosAntes')}
                            disabled={loading || uploadingPhoto}
                          >
                            <Text style={styles.photoButtonTextSmall}>
                              {poste.fotosAntes.length > 0 ? '+ Adicionar Mais Fotos' : '+ Adicionar Foto'}
                            </Text>
                          </TouchableOpacity>
                          {poste.fotosAntes.length > 0 && (
                            <View style={styles.photoGrid}>
                              {poste.fotosAntes.map((foto, fotoIndex) => (
                                <View key={fotoIndex} style={styles.photoCard}>
                                  <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                    <PhotoWithPlaca
                                      uri={foto.uri}
                                      obraNumero={obra}
                                      tipoServico={tipoServico}
                                      equipe={isAdminUser ? equipeExecutora : equipe}
                                      latitude={foto.latitude}
                                      longitude={foto.longitude}
                                      utmX={foto.utmX}
                                      utmY={foto.utmY}
                                      utmZone={foto.utmZone}
                                      style={styles.photoThumbnail}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.photoRemoveButton}
                                    onPress={() => removeFotoPoste(poste.id, 'fotosAntes', fotoIndex)}
                                  >
                                    <Text style={styles.photoRemoveText}>×</Text>
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>

                        {/* Fotos Durante */}
                        <View style={styles.postePhotoSection}>
                          <Text style={styles.postePhotoLabel}>
                            📸 {secoesPoste.segunda} ({poste.fotosDurante.length}) {poste.fotosDurante.length > 0 && '✓'}
                          </Text>
                          <TouchableOpacity
                            style={styles.photoButtonSmall}
                            onPress={() => takePicturePoste(poste.id, 'fotosDurante')}
                            disabled={loading || uploadingPhoto}
                          >
                            <Text style={styles.photoButtonTextSmall}>
                              {poste.fotosDurante.length > 0 ? '+ Adicionar Mais Fotos' : '+ Adicionar Foto'}
                            </Text>
                          </TouchableOpacity>
                          {poste.fotosDurante.length > 0 && (
                            <View style={styles.photoGrid}>
                              {poste.fotosDurante.map((foto, fotoIndex) => (
                                <View key={fotoIndex} style={styles.photoCard}>
                                  <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                    <PhotoWithPlaca
                                      uri={foto.uri}
                                      obraNumero={obra}
                                      tipoServico={tipoServico}
                                      equipe={isAdminUser ? equipeExecutora : equipe}
                                      latitude={foto.latitude}
                                      longitude={foto.longitude}
                                      utmX={foto.utmX}
                                      utmY={foto.utmY}
                                      utmZone={foto.utmZone}
                                      style={styles.photoThumbnail}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.photoRemoveButton}
                                    onPress={() => removeFotoPoste(poste.id, 'fotosDurante', fotoIndex)}
                                  >
                                    <Text style={styles.photoRemoveText}>×</Text>
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>

                        {/* Fotos Depois */}
                        <View style={styles.postePhotoSection}>
                          <Text style={styles.postePhotoLabel}>
                            📸 {secoesPoste.terceira} ({poste.fotosDepois.length}) {poste.fotosDepois.length > 0 && '✓'}
                          </Text>
                          <TouchableOpacity
                            style={styles.photoButtonSmall}
                            onPress={() => takePicturePoste(poste.id, 'fotosDepois')}
                            disabled={loading || uploadingPhoto}
                          >
                            <Text style={styles.photoButtonTextSmall}>
                              {poste.fotosDepois.length > 0 ? '+ Adicionar Mais Fotos' : '+ Adicionar Foto'}
                            </Text>
                          </TouchableOpacity>
                          {poste.fotosDepois.length > 0 && (
                            <View style={styles.photoGrid}>
                              {poste.fotosDepois.map((foto, fotoIndex) => (
                                <View key={fotoIndex} style={styles.photoCard}>
                                  <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                    <PhotoWithPlaca
                                      uri={foto.uri}
                                      obraNumero={obra}
                                      tipoServico={tipoServico}
                                      equipe={isAdminUser ? equipeExecutora : equipe}
                                      latitude={foto.latitude}
                                      longitude={foto.longitude}
                                      utmX={foto.utmX}
                                      utmY={foto.utmY}
                                      utmZone={foto.utmZone}
                                      style={styles.photoThumbnail}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.photoRemoveButton}
                                    onPress={() => removeFotoPoste(poste.id, 'fotosDepois', fotoIndex)}
                                  >
                                    <Text style={styles.photoRemoveText}>×</Text>
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>

                        {isServicoBookAterramento && (
                          <View style={styles.postePhotoSection}>
                            <Text style={styles.postePhotoLabel}>
                              📸 {secoesPoste.quarta} ({poste.fotosMedicao.length}) {poste.fotosMedicao.length > 0 && '✓'}
                            </Text>
                            <TouchableOpacity
                              style={styles.photoButtonSmall}
                              onPress={() => takePicturePoste(poste.id, 'fotosMedicao')}
                              disabled={loading || uploadingPhoto}
                            >
                              <Text style={styles.photoButtonTextSmall}>
                                {poste.fotosMedicao.length > 0 ? '+ Adicionar Mais Fotos' : '+ Adicionar Foto'}
                              </Text>
                            </TouchableOpacity>
                            {poste.fotosMedicao.length > 0 && (
                              <View style={styles.photoGrid}>
                                {poste.fotosMedicao.map((foto, fotoIndex) => (
                                  <View key={fotoIndex} style={styles.photoCard}>
                                    <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                      <PhotoWithPlaca
                                        uri={foto.uri}
                                        obraNumero={obra}
                                        tipoServico={tipoServico}
                                        equipe={isAdminUser ? equipeExecutora : equipe}
                                        latitude={foto.latitude}
                                        longitude={foto.longitude}
                                        utmX={foto.utmX}
                                        utmY={foto.utmY}
                                        utmZone={foto.utmZone}
                                        style={styles.photoThumbnail}
                                      />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.photoRemoveButton}
                                      onPress={() => removeFotoPoste(poste.id, 'fotosMedicao', fotoIndex)}
                                    >
                                      <Text style={styles.photoRemoveText}>×</Text>
                                    </TouchableOpacity>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        )}

                        {/* Botão Remover Poste */}
                        {postesData.length > 1 && (
                          <TouchableOpacity
                            style={styles.posteRemoveButton}
                            onPress={() => removerPoste(poste.id)}
                          >
                            <Text style={styles.posteButtonText}>🗑️ Remover Poste</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                </View>
              )}

              {isServicoPadrao && (
              <>
                {/* Fotos Antes */}
                <Text style={styles.photoSectionLabel}>
                  📷 Fotos Antes ({fotosAntes.length})
                  {fotosAntes.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => takePicture('antes')}
              disabled={loading || uploadingPhoto}
            >
              <View style={styles.photoButtonContent}>
                <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                <Text style={styles.photoButtonText}>
                  {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Antes'}
                </Text>
              </View>
            </TouchableOpacity>
            {fotosAntes.length > 0 && (
              <View style={styles.photoGrid}>
                {fotosAntes.map((foto, index) => (
                  <View key={index} style={styles.photoCard}>
                    <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoRemoveButton}
                      onPress={() => removePhoto('antes', index)}
                    >
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Fotos Durante */}
            <Text style={styles.photoSectionLabel}>
              📷 Fotos Durante ({fotosDurante.length})
              {fotosDurante.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
            </Text>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => takePicture('durante')}
              disabled={loading || uploadingPhoto}
            >
              <View style={styles.photoButtonContent}>
                <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                <Text style={styles.photoButtonText}>
                  {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Durante'}
                </Text>
              </View>
            </TouchableOpacity>
            {fotosDurante.length > 0 && (
              <View style={styles.photoGrid}>
                {fotosDurante.map((foto, index) => (
                  <View key={index} style={styles.photoCard}>
                    <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoRemoveButton}
                      onPress={() => removePhoto('durante', index)}
                    >
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Fotos Depois */}
            <Text style={styles.photoSectionLabel}>
              📷 Fotos Depois ({fotosDepois.length})
              {fotosDepois.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
            </Text>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => takePicture('depois')}
              disabled={loading || uploadingPhoto}
            >
              <View style={styles.photoButtonContent}>
                <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                <Text style={styles.photoButtonText}>
                  {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Depois'}
                </Text>
              </View>
            </TouchableOpacity>
            {fotosDepois.length > 0 && (
              <View style={styles.photoGrid}>
                {fotosDepois.map((foto, index) => (
                  <View key={index} style={styles.photoCard}>
                    <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoRemoveButton}
                      onPress={() => removePhoto('depois', index)}
                    >
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
              </>
            )}

            {isServicoChave && (
              <>
                {/* Fotos Abertura */}
                <Text style={styles.photoSectionLabel}>
                  🔓 Fotos Abertura ({fotosAbertura.length})
                  {fotosAbertura.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('abertura')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Abertura'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAbertura.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAbertura.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('abertura', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Fotos Fechamento */}
                <Text style={styles.photoSectionLabel}>
                  🔒 Fotos Fechamento ({fotosFechamento.length})
                  {fotosFechamento.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('fechamento')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Fechamento'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosFechamento.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosFechamento.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('fechamento', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* SEÇÃO DITAIS - 5 FOTOS */}
            {isServicoDitais && (
              <>
                {/* Ditais - Desligar */}
                <Text style={styles.photoSectionLabel}>
                  🔌 Ditais - Desligar ({fotosDitaisAbertura.length})
                  {fotosDitaisAbertura.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('ditais_abertura')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Desligar'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosDitaisAbertura.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosDitaisAbertura.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('ditais_abertura', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Ditais - Impedir */}
                <Text style={styles.photoSectionLabel}>
                  🚫 Ditais - Impedir ({fotosDitaisImpedir.length})
                  {fotosDitaisImpedir.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('ditais_impedir')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Impedir'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosDitaisImpedir.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosDitaisImpedir.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('ditais_impedir', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Ditais - Testar */}
                <Text style={styles.photoSectionLabel}>
                  🔍 Ditais - Testar ({fotosDitaisTestar.length})
                  {fotosDitaisTestar.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('ditais_testar')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Testar'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosDitaisTestar.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosDitaisTestar.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('ditais_testar', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Ditais - Aterrar */}
                <Text style={styles.photoSectionLabel}>
                  ⚡ Ditais - Aterrar ({fotosDitaisAterrar.length})
                  {fotosDitaisAterrar.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('ditais_aterrar')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Aterrar'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosDitaisAterrar.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosDitaisAterrar.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('ditais_aterrar', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Ditais - Sinalizar */}
                <Text style={styles.photoSectionLabel}>
                  ⚠️ Ditais - Sinalizar ({fotosDitaisSinalizar.length})
                  {fotosDitaisSinalizar.length === 0 && <Text style={styles.missingPhotoIndicator}> ⚠️ Faltando</Text>}
                </Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('ditais_sinalizar')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Sinalizar'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosDitaisSinalizar.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosDitaisSinalizar.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('ditais_sinalizar', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* SEÇÃO BOOK DE ATERRAMENTO - 4 FOTOS */}
            {isServicoBookAterramento && !isServicoPostesComFotos && (
              <>
                {/* Aterramento - Vala Aberta */}
                <Text style={styles.photoSectionLabel}>🕳️ Vala Aberta ({fotosAterramentoValaAberta.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('aterramento_vala_aberta')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Vala Aberta'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAterramentoValaAberta.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAterramentoValaAberta.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('aterramento_vala_aberta', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Aterramento - Hastes Aplicadas */}
                <Text style={styles.photoSectionLabel}>🔩 Hastes Aplicadas ({fotosAterramentoHastes.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('aterramento_hastes')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Hastes'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAterramentoHastes.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAterramentoHastes.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('aterramento_hastes', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Aterramento - Vala Fechada */}
                <Text style={styles.photoSectionLabel}>✅ Vala Fechada ({fotosAterramentoValaFechada.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('aterramento_vala_fechada')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Vala Fechada'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAterramentoValaFechada.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAterramentoValaFechada.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('aterramento_vala_fechada', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Aterramento - Medição Terrômetro */}
                <Text style={styles.photoSectionLabel}>📊 Medição Terrômetro ({fotosAterramentoMedicao.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('aterramento_medicao')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Medição'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAterramentoMedicao.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAterramentoMedicao.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('aterramento_medicao', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* SEÇÃO TRANSFORMADOR */}
            {isServicoTransformador && (
              <>
                {/* Seleção de Status do Transformador */}
                <Text style={styles.sectionLabel}>Status do Transformador *</Text>
                <View style={styles.statusContainer}>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      transformadorStatus === 'Instalado' && styles.statusButtonActive
                    ]}
                    onPress={() => setTransformadorStatus('Instalado')}
                  >
                    <Text style={[
                      styles.statusButtonText,
                      transformadorStatus === 'Instalado' && styles.statusButtonTextActive
                    ]}>
                      ✅ Instalado
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      transformadorStatus === 'Retirado' && styles.statusButtonActive
                    ]}
                    onPress={() => setTransformadorStatus('Retirado')}
                  >
                    <Text style={[
                      styles.statusButtonText,
                      transformadorStatus === 'Retirado' && styles.statusButtonTextActive
                    ]}>
                      ❌ Retirado
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* FOTOS TRANSFORMADOR INSTALADO */}
                {transformadorStatus === 'Instalado' && (
                  <>
                    {/* Componente Instalado */}
                    <Text style={styles.photoSectionLabel}>🔧 Componente Instalado * ({fotosTransformadorComponenteInstalado.length})</Text>
                    <Text style={styles.photoHint}>Obrigatório: Mínimo 1 foto - Componente do transformador instalado</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_componente_instalado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Componente'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorComponenteInstalado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorComponenteInstalado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_componente_instalado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Tombamento */}
                    <Text style={styles.photoSectionLabel}>🏷️ Tombamento * ({fotosTransformadorTombamentoInstalado.length})</Text>
                    <Text style={styles.photoHint}>Obrigatório: Mínimo 1 foto - Plaqueta de identificação/tombamento</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_tombamento_instalado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Tombamento'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorTombamentoInstalado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorTombamentoInstalado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_tombamento_instalado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Tape do Transformador */}
                    <Text style={styles.photoSectionLabel}>📏 Tape do Transformador * ({fotosTransformadorTape.length})</Text>
                    <Text style={styles.photoHint}>Obrigatório: Mínimo 1 foto - Posição do tape no transformador</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_tape')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Tape'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorTape.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorTape.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_tape', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Placa do Transformador */}
                    <Text style={styles.photoSectionLabel}>🪧 Placa do Transformador * ({fotosTransformadorPlacaInstalado.length})</Text>
                    <Text style={styles.photoHint}>Obrigatório: Mínimo 1 foto - Placa de identificação do transformador</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_placa_instalado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Placa'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorPlacaInstalado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorPlacaInstalado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_placa_instalado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Transformador Instalado - 2 fotos */}
                    <Text style={styles.photoSectionLabel}>⚡ Transformador Instalado * ({fotosTransformadorInstalado.length})</Text>
                    <Text style={styles.photoHint}>Obrigatório: Mínimo 1 foto - Vista geral do transformador instalado</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_instalado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Transformador Instalado'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorInstalado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorInstalado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_instalado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Conexões Primárias do Transformador Instalado */}
                    <Text style={styles.photoSectionLabel}>📸 Conexões Primárias * ({fotosTransformadorConexoesPrimariasInstalado.length}/2)</Text>
                    <Text style={styles.photoHint}>Obrigatório: 2 fotos - Conexões primárias do transformador</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_conexoes_primarias_instalado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto das Conexões Primárias'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorConexoesPrimariasInstalado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorConexoesPrimariasInstalado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_conexoes_primarias_instalado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Conexões Secundárias do Transformador Instalado */}
                    <Text style={styles.photoSectionLabel}>📸 Conexões Secundárias * ({fotosTransformadorConexoesSecundariasInstalado.length}/2)</Text>
                    <Text style={styles.photoHint}>Obrigatório: 2 fotos - Conexões secundárias do transformador</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_conexoes_secundarias_instalado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto das Conexões Secundárias'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorConexoesSecundariasInstalado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorConexoesSecundariasInstalado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_conexoes_secundarias_instalado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}

                {/* FOTOS TRANSFORMADOR RETIRADO */}
                {transformadorStatus === 'Retirado' && (
                  <>
                    {/* Antes de Retirar */}
                    <Text style={styles.photoSectionLabel}>📸 Antes de Retirar * ({fotosTransformadorAntesRetirar.length})</Text>
                    <Text style={styles.photoHint}>Obrigatório: Mínimo 1 foto - Transformador antes da retirada</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_antes_retirar')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto Antes de Retirar'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorAntesRetirar.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorAntesRetirar.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_antes_retirar', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Laudo Transformador Retirado */}
                    <Text style={styles.photoSectionLabel}>⚡ Laudo do Transformador Retirado ({fotosTransformadorLaudoRetirado.length})</Text>
                    <Text style={styles.photoHint}>Laudo do transformador retirado</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_laudo_retirado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Laudo do Retirado'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorLaudoRetirado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorLaudoRetirado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_laudo_retirado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Tombamento */}
                    <Text style={styles.photoSectionLabel}>🏷️ Tombamento * ({fotosTransformadorTombamentoRetirado.length})</Text>
                    <Text style={styles.photoHint}>Obrigatório: Mínimo 1 foto - Plaqueta de identificação/tombamento do retirado</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_tombamento_retirado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Tombamento'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorTombamentoRetirado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorTombamentoRetirado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_tombamento_retirado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Placa do Transformador */}
                    <Text style={styles.photoSectionLabel}>🪧 Placa do Transformador * ({fotosTransformadorPlacaRetirado.length})</Text>
                    <Text style={styles.photoHint}>Obrigatório: Mínimo 1 foto - Placa de identificação do transformador retirado</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_placa_retirado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Placa'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorPlacaRetirado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorPlacaRetirado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_placa_retirado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Conexões Primárias do Transformador Retirado */}
                    <Text style={styles.photoSectionLabel}>📸 Conexões Primárias * ({fotosTransformadorConexoesPrimariasRetirado.length}/2)</Text>
                    <Text style={styles.photoHint}>Obrigatório: 2 fotos - Conexões primárias do transformador</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_conexoes_primarias_retirado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto das Conexões Primárias'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorConexoesPrimariasRetirado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorConexoesPrimariasRetirado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_conexoes_primarias_retirado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Conexões Secundárias do Transformador Retirado */}
                    <Text style={styles.photoSectionLabel}>📸 Conexões Secundárias * ({fotosTransformadorConexoesSecundariasRetirado.length}/2)</Text>
                    <Text style={styles.photoHint}>Obrigatório: 2 fotos - Conexões secundárias do transformador</Text>
                    <TouchableOpacity
                      style={styles.photoButton}
                      onPress={() => takePicture('transformador_conexoes_secundarias_retirado')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Adicionar Foto das Conexões Secundárias'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {fotosTransformadorConexoesSecundariasRetirado.length > 0 && (
                      <View style={styles.photoGrid}>
                        {fotosTransformadorConexoesSecundariasRetirado.map((foto, index) => (
                          <View key={index} style={styles.photoCard}>
                            <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.photoRemoveButton}
                              onPress={() => removePhoto('transformador_conexoes_secundarias_retirado', index)}
                            >
                              <Text style={styles.photoRemoveText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            {/* SEÇÃO INSTALAÇÃO DO MEDIDOR - 5 FOTOS */}
            {isServicoMedidor && (
              <>
                {/* Padrão c/ Medidor Instalado */}
                <Text style={styles.photoSectionLabel}>📸 Padrão c/ Medidor Instalado ({fotosMedidorPadrao.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('medidor_padrao')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Padrão'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosMedidorPadrao.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosMedidorPadrao.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('medidor_padrao', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Leitura c/ Medidor Instalado */}
                <Text style={styles.photoSectionLabel}>📊 Leitura c/ Medidor Instalado ({fotosMedidorLeitura.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('medidor_leitura')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Leitura'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosMedidorLeitura.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosMedidorLeitura.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('medidor_leitura', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Selo do Born do Medidor */}
                <Text style={styles.photoSectionLabel}>🔒 Selo do Born do Medidor ({fotosMedidorSeloBorn.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('medidor_selo_born')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Selo do Born'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosMedidorSeloBorn.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosMedidorSeloBorn.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('medidor_selo_born', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Selo da Caixa */}
                <Text style={styles.photoSectionLabel}>🔐 Selo da Caixa ({fotosMedidorSeloCaixa.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('medidor_selo_caixa')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Selo da Caixa'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosMedidorSeloCaixa.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosMedidorSeloCaixa.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('medidor_selo_caixa', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Identificador de Fase */}
                <Text style={styles.photoSectionLabel}>🏷️ Identificador de Fase ({fotosMedidorIdentificadorFase.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('medidor_identificador_fase')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Identificador'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosMedidorIdentificadorFase.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosMedidorIdentificadorFase.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('medidor_identificador_fase', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* ALTIMETRIA - 4 FOTOS */}
            {isServicoAltimetria && (
              <>
                <Text style={styles.sectionTitle}>📏 Altimetria - Medições</Text>

                {/* Lado Fonte */}
                <Text style={styles.photoSectionLabel}>📍 Lado Fonte ({fotosAltimetriaLadoFonte.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('altimetria_lado_fonte')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Lado Fonte'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAltimetriaLadoFonte.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAltimetriaLadoFonte.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('altimetria_lado_fonte', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Medição Fonte */}
                <Text style={styles.photoSectionLabel}>📐 Medição Fonte ({fotosAltimetriaMedicaoFonte.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('altimetria_medicao_fonte')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Medição Fonte'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAltimetriaMedicaoFonte.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAltimetriaMedicaoFonte.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('altimetria_medicao_fonte', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Lado Carga */}
                <Text style={styles.photoSectionLabel}>📍 Lado Carga ({fotosAltimetriaLadoCarga.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('altimetria_lado_carga')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Lado Carga'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAltimetriaLadoCarga.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAltimetriaLadoCarga.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('altimetria_lado_carga', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Medição Carga */}
                <Text style={styles.photoSectionLabel}>📐 Medição Carga ({fotosAltimetriaMedicaoCarga.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('altimetria_medicao_carga')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Medição Carga'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosAltimetriaMedicaoCarga.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosAltimetriaMedicaoCarga.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('altimetria_medicao_carga', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* VAZAMENTO E LIMPEZA DE TRANSFORMADOR - 7 FOTOS */}
            {isServicoVazamento && (
              <>
                <Text style={styles.sectionTitle}>🛢️ Vazamento e Limpeza de Transformador</Text>

                {/* Evidência do Vazamento */}
                <Text style={styles.photoSectionLabel}>⚠️ Evidência do Vazamento de Óleo ({fotosVazamentoEvidencia.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('vazamento_evidencia')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Evidência'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosVazamentoEvidencia.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosVazamentoEvidencia.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('vazamento_evidencia', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Equipamentos de Limpeza */}
                <Text style={styles.photoSectionLabel}>🧹 Equipamentos de Limpeza (contendo o óleo) ({fotosVazamentoEquipamentosLimpeza.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('vazamento_equipamentos_limpeza')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto dos Equipamentos'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosVazamentoEquipamentosLimpeza.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosVazamentoEquipamentosLimpeza.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('vazamento_equipamentos_limpeza', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Tombamento Transformador Retirado */}
                <Text style={styles.photoSectionLabel}>📦 Tombamento do Transformador Retirado ({fotosVazamentoTombamentoRetirado.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('vazamento_tombamento_retirado')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Tombamento (Retirado)'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosVazamentoTombamentoRetirado.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosVazamentoTombamentoRetirado.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('vazamento_tombamento_retirado', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Placa Transformador Retirado */}
                <Text style={styles.photoSectionLabel}>🪧 Placa do Transformador Retirado ({fotosVazamentoPlacaRetirado.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('vazamento_placa_retirado')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Placa (Retirado)'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosVazamentoPlacaRetirado.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosVazamentoPlacaRetirado.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('vazamento_placa_retirado', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Tombamento Transformador Instalado */}
                <Text style={styles.photoSectionLabel}>📦 Tombamento do Transformador Instalado ({fotosVazamentoTombamentoInstalado.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('vazamento_tombamento_instalado')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto do Tombamento (Instalado)'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosVazamentoTombamentoInstalado.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosVazamentoTombamentoInstalado.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('vazamento_tombamento_instalado', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Placa Transformador Instalado */}
                <Text style={styles.photoSectionLabel}>🪧 Placa do Transformador Instalado ({fotosVazamentoPlacaInstalado.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('vazamento_placa_instalado')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Placa (Instalado)'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosVazamentoPlacaInstalado.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosVazamentoPlacaInstalado.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('vazamento_placa_instalado', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Instalação do Transformador */}
                <Text style={styles.photoSectionLabel}>⚡ Instalação do Transformador ({fotosVazamentoInstalacao.length})</Text>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => takePicture('vazamento_instalacao')}
                  disabled={loading || uploadingPhoto}
                >
                  <View style={styles.photoButtonContent}>
                    <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '+'}</Text>
                    <Text style={styles.photoButtonText}>
                      {uploadingPhoto ? 'Processando...' : 'Adicionar Foto da Instalação'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {fotosVazamentoInstalacao.length > 0 && (
                  <View style={styles.photoGrid}>
                    {fotosVazamentoInstalacao.map((foto, index) => (
                      <View key={index} style={styles.photoCard}>
                        <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => removePhoto('vazamento_instalacao', index)}
                        >
                          <Text style={styles.photoRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* CHECKLIST DE FISCALIZAÇÃO */}
            {isServicoChecklist && (
              <>
                <Text style={styles.sectionTitle}>📋 Checklist de Fiscalização - Registro Fotográfico</Text>

                {/* 1. Croqui da Obra */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>
                    1️⃣ Croqui da Obra {fotosChecklistCroqui.length > 0 && `(${fotosChecklistCroqui.length})`}
                  </Text>
                  <Text style={styles.checklistHint}>Croqui atualizado da obra - pode adicionar várias fotos (opcional)</Text>

                  <TouchableOpacity
                    style={styles.photoButtonSmall}
                    onPress={() => takePicture('checklist_croqui')}
                    disabled={loading || uploadingPhoto}
                  >
                    <Text style={styles.photoButtonTextSmall}>
                      {fotosChecklistCroqui.length > 0 ? '+ Adicionar Mais Fotos do Croqui' : '+ Adicionar Foto do Croqui'}
                    </Text>
                  </TouchableOpacity>

                  {fotosChecklistCroqui.length > 0 && (
                    <View style={styles.photoGrid}>
                      {fotosChecklistCroqui.map((foto, index) => (
                        <View key={index} style={styles.photoCard}>
                          <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => removePhoto('checklist_croqui', index)}
                          >
                            <Text style={styles.photoRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 2. Panorâmica Inicial */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>2️⃣ Panorâmica Inicial {fotosChecklistPanoramicaInicial.length >= 2 && '✓'}</Text>
                  <Text style={styles.checklistHint}>Recomendado: 2 fotos - Vista geral antes de iniciar</Text>

                  <TouchableOpacity
                    style={styles.photoButtonSmall}
                    onPress={() => takePicture('checklist_panoramica_inicial')}
                    disabled={loading || uploadingPhoto}
                  >
                    <Text style={styles.photoButtonTextSmall}>
                      + Adicionar Foto ({fotosChecklistPanoramicaInicial.length})
                    </Text>
                  </TouchableOpacity>

                  {fotosChecklistPanoramicaInicial.length > 0 && (
                    <View style={styles.photoGrid}>
                      {fotosChecklistPanoramicaInicial.map((foto, index) => (
                        <View key={index} style={styles.photoCard}>
                          <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => removePhoto('checklist_panoramica_inicial', index)}
                          >
                            <Text style={styles.photoRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 3. Foto da Chave com Componente - OPCIONAL */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>3️⃣ Foto da Chave com Componente (Opcional) {fotosChecklistChaveComponente.length >= 1 && '✓'}</Text>
                  <Text style={styles.checklistHint}>Opcional - Chave com componente visível</Text>

                  <TouchableOpacity
                    style={styles.photoButtonSmall}
                    onPress={() => takePicture('checklist_chede')}
                    disabled={loading || uploadingPhoto || fotosChecklistChaveComponente.length >= 1}
                  >
                    <Text style={styles.photoButtonTextSmall}>
                      {fotosChecklistChaveComponente.length > 0 ? '✓ Adicionada' : '+ Adicionar Foto da Chave'}
                    </Text>
                  </TouchableOpacity>

                  {fotosChecklistChaveComponente.length > 0 && (
                    <View style={styles.photoGrid}>
                      {fotosChecklistChaveComponente.map((foto, index) => (
                        <View key={index} style={styles.photoCard}>
                          <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => removePhoto('checklist_chede', index)}
                          >
                            <Text style={styles.photoRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 4. Postes - Seção Dinâmica */}
                <View
                  style={styles.checklistSection}
                  onLayout={(event) => {
                    const { y } = event.nativeEvent.layout;
                    setSectionLayouts(prev => ({ ...prev, postes: y }));
                  }}
                >
                  <Text style={styles.checklistSectionTitle}>4️⃣ Registro dos Postes</Text>
                  <Text style={styles.checklistHint}>Recomendado: 4 fotos por poste</Text>

                  <View style={styles.posteControls}>
                    <Text style={styles.posteCount}>Pontos: {numPostes}</Text>
                    <TouchableOpacity
                      style={styles.posteAddButton}
                      onPress={() => {
                        setNumPostes(prev => prev + 1);
                        setFotosPostes(prev => {
                          const proximoNumero = prev.reduce((max, poste) => {
                            const numero = parseInt(poste.numero || '0', 10);
                            return Number.isFinite(numero) ? Math.max(max, numero) : max;
                          }, 0) + 1;
                          return [{
                          numero: String(proximoNumero),
                          status: '', // Novo poste sem status
                          isAditivo: false, // Não é aditivo por padrão
                          posteInteiro: [],
                          descricao: [],
                          engaste: [],
                          conexao1: [],
                          conexao2: [],
                          maiorEsforco: [],
                          menorEsforco: [],
                        }, ...prev];
                        });
                        showToast('Poste adicionado abaixo do botao.', 'success');
                      }}
                    >
                      <Text style={styles.posteButtonText}>➕ Adicionar Poste</Text>
                    </TouchableOpacity>
                  </View>

                  {fotosPostes.map((poste, posteIndex) => (
                    <View key={posteIndex} style={styles.posteCard}>
                      <Text style={styles.posteTitle}>
                        Poste {poste.numero || (posteIndex + 1)}{poste.numero ? ` - ${poste.isAditivo ? 'AD-' : ''}P${poste.numero}` : ''}
                        {poste.status === 'instalado' && poste.posteInteiro.length > 0 && poste.descricao.length > 0 && poste.engaste.length > 0 &&
                         poste.conexao1.length > 0 && poste.conexao2.length > 0 &&
                         poste.maiorEsforco.length >= 2 && poste.menorEsforco.length >= 2 && ' ✓'}
                        {poste.status === 'retirado' && poste.posteInteiro.length >= 2 && ' ✓'}
                        {poste.status === 'existente' && poste.posteInteiro.length > 0 &&
                         poste.conexao1.length > 0 && poste.conexao2.length > 0 && ' ✓'}
                      </Text>

                      {/* Campo para identificar o número do poste */}
                      <View style={styles.posteNumeroSection}>
                        <Text style={styles.posteNumeroLabel}>🪧 Número do Poste *</Text>
                        <TextInput
                          style={styles.posteNumeroInput}
                          placeholder="Ex: 5, 12, 23..."
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                          value={poste.numero}
                          onChangeText={(text) => {
                            const newPostes = [...fotosPostes];
                            newPostes[posteIndex].numero = text.replace(/[^0-9]/g, '');
                            setFotosPostes(newPostes);
                          }}
                        />
                        {!poste.numero && (
                          <Text style={styles.hint}>Informe o número do poste para identificação</Text>
                        )}
                      </View>

                      {/* Checkbox: Poste Aditivo */}
                      <TouchableOpacity
                        style={styles.posteAditivoCheckbox}
                        onPress={() => {
                          const newPostes = [...fotosPostes];
                          newPostes[posteIndex].isAditivo = !poste.isAditivo;
                          setFotosPostes(newPostes);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, poste.isAditivo && styles.checkboxChecked]}>
                          {poste.isAditivo && <Text style={styles.checkboxCheck}>✓</Text>}
                        </View>
                        <Text style={styles.posteAditivoLabel}>
                          🔧 Poste Aditivo (não previsto no croqui)
                        </Text>
                      </TouchableOpacity>
                      {poste.isAditivo && (
                        <Text style={styles.hint}>Este poste será identificado como AD-P{poste.numero || '?'}</Text>
                      )}

                      {/* Seleção de Status: Instalado ou Retirado */}
                      <View style={styles.posteStatusSection}>
                        <Text style={styles.posteStatusLabel}>Status do Poste *</Text>
                        <View style={styles.posteStatusButtons}>
                          <TouchableOpacity
                            style={[
                              styles.posteStatusButton,
                              poste.status === 'instalado' && styles.posteStatusButtonActive
                            ]}
                            onPress={() => {
                              const newPostes = [...fotosPostes];
                              newPostes[posteIndex].status = 'instalado';
                              setFotosPostes(newPostes);
                            }}
                          >
                            <Text style={[
                              styles.posteStatusButtonText,
                              poste.status === 'instalado' && styles.posteStatusButtonTextActive
                            ]}>
                              🔧 Instalado
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.posteStatusButton,
                              poste.status === 'retirado' && styles.posteStatusButtonActive
                            ]}
                            onPress={() => {
                              const newPostes = [...fotosPostes];
                              newPostes[posteIndex].status = 'retirado';
                              setFotosPostes(newPostes);
                            }}
                          >
                            <Text style={[
                              styles.posteStatusButtonText,
                              poste.status === 'retirado' && styles.posteStatusButtonTextActive
                            ]}>
                              🔨 Retirado
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.posteStatusButton,
                              poste.status === 'existente' && styles.posteStatusButtonActive
                            ]}
                            onPress={() => {
                              const newPostes = [...fotosPostes];
                              newPostes[posteIndex].status = 'existente';
                              setFotosPostes(newPostes);
                            }}
                          >
                            <Text style={[
                              styles.posteStatusButtonText,
                              poste.status === 'existente' && styles.posteStatusButtonTextActive
                            ]}>
                              📍 Existente
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {!poste.status && (
                          <Text style={styles.hint}>Selecione o status antes de adicionar fotos</Text>
                        )}
                      </View>

                      {/* Poste Inteiro */}
                      {poste.status && (
                        <View style={styles.postePhotoSection}>
                          <Text style={styles.postePhotoLabel}>
                            📸 Poste Inteiro ({poste.posteInteiro.length}/{poste.status === 'retirado' ? '2' : '1'})
                            {poste.status === 'retirado' && poste.posteInteiro.length >= 2 && ' ✓'}
                            {poste.status === 'instalado' && poste.posteInteiro.length >= 1 && ' ✓'}
                            {poste.status === 'existente' && poste.posteInteiro.length >= 1 && ' ✓'}
                          </Text>
                          <TouchableOpacity
                            style={styles.photoButtonSmall}
                            onPress={() => takePicture('checklist_poste_inteiro', posteIndex)}
                            disabled={loading || uploadingPhoto ||
                              (poste.status === 'retirado' ? poste.posteInteiro.length >= 2 : poste.posteInteiro.length >= 1)}
                          >
                            <Text style={styles.photoButtonTextSmall}>
                              {poste.status === 'retirado'
                                ? (poste.posteInteiro.length >= 2 ? '✓ Completo (2/2)' : `+ Adicionar (${poste.posteInteiro.length}/2)`)
                                : (poste.posteInteiro.length >= 1 ? '✓ Adicionada' : '+ Adicionar')
                              }
                            </Text>
                          </TouchableOpacity>
                        {poste.posteInteiro.length > 0 && (
                          <View style={styles.photoGrid}>
                            {poste.posteInteiro.map((foto, fotoIndex) => (
                              <View key={fotoIndex} style={styles.photoCard}>
                                <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                  <PhotoWithPlaca
                                    uri={foto.uri}
                                    obraNumero={obra}
                                    tipoServico={tipoServico}
                                    equipe={isAdminUser ? equipeExecutora : equipe}
                                    latitude={foto.latitude}
                                    longitude={foto.longitude}
                                    utmX={foto.utmX}
                                    utmY={foto.utmY}
                                    utmZone={foto.utmZone}
                                    style={styles.photoThumbnail}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.photoRemoveButton}
                                  onPress={() => removePhoto('checklist_poste_inteiro', fotoIndex, posteIndex)}
                                >
                                  <Text style={styles.photoRemoveText}>×</Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                        </View>
                      )}

                      {/* Descrição - apenas para INSTALADO */}
                      {poste.status === 'instalado' && (
                        <View style={styles.postePhotoSection}>
                          <Text style={styles.postePhotoLabel}>
                            📸 Descrição {poste.descricao.length > 0 && '✓'}
                          </Text>
                          <TouchableOpacity
                            style={styles.photoButtonSmall}
                            onPress={() => takePicture('checklist_poste_descricao', posteIndex)}
                            disabled={loading || uploadingPhoto || poste.descricao.length >= 1}
                          >
                            <Text style={styles.photoButtonTextSmall}>
                              {poste.descricao.length > 0 ? '✓ Adicionada' : '+ Adicionar'}
                            </Text>
                          </TouchableOpacity>
                          {poste.descricao.length > 0 && (
                            <View style={styles.photoGrid}>
                              {poste.descricao.map((foto, fotoIndex) => (
                                <View key={fotoIndex} style={styles.photoCard}>
                                  <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                    <PhotoWithPlaca
                                      uri={foto.uri}
                                      obraNumero={obra}
                                      tipoServico={tipoServico}
                                      equipe={isAdminUser ? equipeExecutora : equipe}
                                      latitude={foto.latitude}
                                      longitude={foto.longitude}
                                      utmX={foto.utmX}
                                      utmY={foto.utmY}
                                      utmZone={foto.utmZone}
                                      style={styles.photoThumbnail}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.photoRemoveButton}
                                    onPress={() => removePhoto('checklist_poste_descricao', fotoIndex, posteIndex)}
                                  >
                                    <Text style={styles.photoRemoveText}>×</Text>
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Engaste - apenas para INSTALADO */}
                      {poste.status === 'instalado' && (
                        <View style={styles.postePhotoSection}>
                          <Text style={styles.postePhotoLabel}>
                            📸 Engaste {poste.engaste.length > 0 && '✓'}
                          </Text>
                          <TouchableOpacity
                            style={styles.photoButtonSmall}
                            onPress={() => takePicture('checklist_poste_engaste', posteIndex)}
                            disabled={loading || uploadingPhoto || poste.engaste.length >= 1}
                          >
                            <Text style={styles.photoButtonTextSmall}>
                              {poste.engaste.length > 0 ? '✓ Adicionada' : '+ Adicionar'}
                            </Text>
                          </TouchableOpacity>
                          {poste.engaste.length > 0 && (
                            <View style={styles.photoGrid}>
                              {poste.engaste.map((foto, fotoIndex) => (
                                <View key={fotoIndex} style={styles.photoCard}>
                                  <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                    <PhotoWithPlaca
                                      uri={foto.uri}
                                      obraNumero={obra}
                                      tipoServico={tipoServico}
                                      equipe={isAdminUser ? equipeExecutora : equipe}
                                      latitude={foto.latitude}
                                      longitude={foto.longitude}
                                      utmX={foto.utmX}
                                      utmY={foto.utmY}
                                      utmZone={foto.utmZone}
                                      style={styles.photoThumbnail}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.photoRemoveButton}
                                    onPress={() => removePhoto('checklist_poste_engaste', fotoIndex, posteIndex)}
                                  >
                                    <Text style={styles.photoRemoveText}>×</Text>
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Conexões - para INSTALADO e EXISTENTE */}
                      {(poste.status === 'instalado' || poste.status === 'existente') && (
                        <>
                      {/* Conexão 1 */}
                      <View style={styles.postePhotoSection}>
                        <Text style={styles.postePhotoLabel}>
                          📸 Conexão 1 {poste.conexao1.length > 0 && '✓'}
                        </Text>
                        <TouchableOpacity
                          style={styles.photoButtonSmall}
                          onPress={() => takePicture('checklist_poste_conexao1', posteIndex)}
                          disabled={loading || uploadingPhoto || poste.conexao1.length >= 1}
                        >
                          <Text style={styles.photoButtonTextSmall}>
                            {poste.conexao1.length > 0 ? '✓ Adicionada' : '+ Adicionar'}
                          </Text>
                        </TouchableOpacity>
                        {poste.conexao1.length > 0 && (
                          <View style={styles.photoGrid}>
                            {poste.conexao1.map((foto, fotoIndex) => (
                              <View key={fotoIndex} style={styles.photoCard}>
                                <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                  <PhotoWithPlaca
                                    uri={foto.uri}
                                    obraNumero={obra}
                                    tipoServico={tipoServico}
                                    equipe={isAdminUser ? equipeExecutora : equipe}
                                    latitude={foto.latitude}
                                    longitude={foto.longitude}
                                    utmX={foto.utmX}
                                    utmY={foto.utmY}
                                    utmZone={foto.utmZone}
                                    style={styles.photoThumbnail}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.photoRemoveButton}
                                  onPress={() => removePhoto('checklist_poste_conexao1', fotoIndex, posteIndex)}
                                >
                                  <Text style={styles.photoRemoveText}>×</Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Conexão 2 */}
                      <View style={styles.postePhotoSection}>
                        <Text style={styles.postePhotoLabel}>
                          📸 Conexão 2 {poste.conexao2.length > 0 && '✓'}
                        </Text>
                        <TouchableOpacity
                          style={styles.photoButtonSmall}
                          onPress={() => takePicture('checklist_poste_conexao2', posteIndex)}
                          disabled={loading || uploadingPhoto || poste.conexao2.length >= 1}
                        >
                          <Text style={styles.photoButtonTextSmall}>
                            {poste.conexao2.length > 0 ? '✓ Adicionada' : '+ Adicionar'}
                          </Text>
                        </TouchableOpacity>
                        {poste.conexao2.length > 0 && (
                          <View style={styles.photoGrid}>
                            {poste.conexao2.map((foto, fotoIndex) => (
                              <View key={fotoIndex} style={styles.photoCard}>
                                <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                  <PhotoWithPlaca
                                    uri={foto.uri}
                                    obraNumero={obra}
                                    tipoServico={tipoServico}
                                    equipe={isAdminUser ? equipeExecutora : equipe}
                                    latitude={foto.latitude}
                                    longitude={foto.longitude}
                                    utmX={foto.utmX}
                                    utmY={foto.utmY}
                                    utmZone={foto.utmZone}
                                    style={styles.photoThumbnail}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.photoRemoveButton}
                                  onPress={() => removePhoto('checklist_poste_conexao2', fotoIndex, posteIndex)}
                                >
                                  <Text style={styles.photoRemoveText}>×</Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                        </>
                      )}

                      {/* Esforços - apenas para INSTALADO */}
                      {poste.status === 'instalado' && (
                        <>
                      {/* Maior Esforço */}
                      <View style={styles.postePhotoSection}>
                        <Text style={styles.postePhotoLabel}>
                          📸 Maior Esforço ({poste.maiorEsforco.length}/2) {poste.maiorEsforco.length >= 2 && '✓'}
                        </Text>
                        <TouchableOpacity
                          style={styles.photoButtonSmall}
                          onPress={() => takePicture('checklist_poste_maior_esforco', posteIndex)}
                          disabled={loading || uploadingPhoto || poste.maiorEsforco.length >= 2}
                        >
                          <Text style={styles.photoButtonTextSmall}>
                            {poste.maiorEsforco.length >= 2 ? '✓ Completo' : `+ Adicionar (${poste.maiorEsforco.length}/2)`}
                          </Text>
                        </TouchableOpacity>
                        {poste.maiorEsforco.length > 0 && (
                          <View style={styles.photoGrid}>
                            {poste.maiorEsforco.map((foto, fotoIndex) => (
                              <View key={fotoIndex} style={styles.photoCard}>
                                <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                  <PhotoWithPlaca
                                    uri={foto.uri}
                                    obraNumero={obra}
                                    tipoServico={tipoServico}
                                    equipe={isAdminUser ? equipeExecutora : equipe}
                                    latitude={foto.latitude}
                                    longitude={foto.longitude}
                                    utmX={foto.utmX}
                                    utmY={foto.utmY}
                                    utmZone={foto.utmZone}
                                    style={styles.photoThumbnail}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.photoRemoveButton}
                                  onPress={() => removePhoto('checklist_poste_maior_esforco', fotoIndex, posteIndex)}
                                >
                                  <Text style={styles.photoRemoveText}>×</Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Menor Esforço */}
                      <View style={styles.postePhotoSection}>
                        <Text style={styles.postePhotoLabel}>
                          📸 Menor Esforço ({poste.menorEsforco.length}/2) {poste.menorEsforco.length >= 2 && '✓'}
                        </Text>
                        <TouchableOpacity
                          style={styles.photoButtonSmall}
                          onPress={() => takePicture('checklist_poste_menor_esforco', posteIndex)}
                          disabled={loading || uploadingPhoto || poste.menorEsforco.length >= 2}
                        >
                          <Text style={styles.photoButtonTextSmall}>
                            {poste.menorEsforco.length >= 2 ? '✓ Completo' : `+ Adicionar (${poste.menorEsforco.length}/2)`}
                          </Text>
                        </TouchableOpacity>
                        {poste.menorEsforco.length > 0 && (
                          <View style={styles.photoGrid}>
                            {poste.menorEsforco.map((foto, fotoIndex) => (
                              <View key={fotoIndex} style={styles.photoCard}>
                                <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                  <PhotoWithPlaca
                                    uri={foto.uri}
                                    obraNumero={obra}
                                    tipoServico={tipoServico}
                                    equipe={isAdminUser ? equipeExecutora : equipe}
                                    latitude={foto.latitude}
                                    longitude={foto.longitude}
                                    utmX={foto.utmX}
                                    utmY={foto.utmY}
                                    utmZone={foto.utmZone}
                                    style={styles.photoThumbnail}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.photoRemoveButton}
                                  onPress={() => removePhoto('checklist_poste_menor_esforco', fotoIndex, posteIndex)}
                                >
                                  <Text style={styles.photoRemoveText}>×</Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                        </>
                      )}

                      {/* Botão Remover Poste */}
                      <TouchableOpacity
                        style={styles.posteRemoveButton}
                        onPress={() => {
                          setNumPostes(numPostes - 1);
                          setFotosPostes(fotosPostes.filter((_, i) => i !== posteIndex));
                        }}
                      >
                        <Text style={styles.posteButtonText}>🗑️ Remover Poste</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* 5. Emenda - Secao Dinamica */}
                <View
                  style={styles.checklistSection}
                  onLayout={(event) => {
                    const { y } = event.nativeEvent.layout;
                    setSectionLayouts(prev => ({ ...prev, emendas: y }));
                  }}
                >
                  <Text style={styles.checklistSectionTitle}>5️⃣ Emenda (Opcional)</Text>
                  <Text style={styles.checklistHint}>Pode adicionar varias fotos por ponto. Cada emenda deve indicar o trecho entre dois postes de referencia.</Text>

                  <View style={styles.posteControls}>
                    <Text style={styles.posteCount}>Pontos: {numEmendas}</Text>
                    <TouchableOpacity
                      style={styles.posteAddButton}
                      onPress={() => {
                        setNumEmendas(prev => prev + 1);
                        setFotosEmendas(prev => {
                          const proximoNumero = prev.reduce((max, emenda) => {
                            const numero = parseInt(emenda.numero || '0', 10);
                            return Number.isFinite(numero) ? Math.max(max, numero) : max;
                          }, 0) + 1;
                          return [{ numero: String(proximoNumero), posteInicio: '', posteFim: '', fotos: [] }, ...prev];
                        });
                        showToast('Ponto de emenda adicionado abaixo do botao.', 'success');
                      }}
                    >
                      <Text style={styles.posteButtonText}>➕ Adicionar Ponto</Text>
                    </TouchableOpacity>
                  </View>

                  {fotosEmendas.map((emenda, emendaIndex) => (
                    <View key={emendaIndex} style={styles.seccionamentoCard}>
                      <Text style={styles.seccionamentoTitle}>
                        E{emenda.numero || (emendaIndex + 1)} entre {formatReferenciaEntrePostes(emenda.posteInicio, emenda.posteFim)} {emenda.fotos.length > 0 && '✓'}
                      </Text>

                      <View style={styles.posteNumeroSection}>
                        <Text style={styles.posteNumeroLabel}>🔢 Numero da Emenda *</Text>
                        <TextInput
                          style={styles.posteNumeroInput}
                          placeholder="Ex: 1, 2, 3..."
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                          value={emenda.numero}
                          onChangeText={(text) => {
                            const novasEmendas = [...fotosEmendas];
                            novasEmendas[emendaIndex].numero = text.replace(/[^0-9]/g, '');
                            setFotosEmendas(novasEmendas);
                          }}
                        />
                      </View>

                      <View style={styles.posteNumeroSection}>
                        <Text style={styles.posteNumeroLabel}>🪧 Trecho entre postes *</Text>
                        <View style={styles.referenciaPostesRow}>
                          <TextInput
                            style={[styles.posteNumeroInput, styles.referenciaPosteInput]}
                            placeholder="P inicial"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={emenda.posteInicio}
                            onChangeText={(text) => {
                              const novasEmendas = [...fotosEmendas];
                              novasEmendas[emendaIndex].posteInicio = text.replace(/[^0-9]/g, '');
                              setFotosEmendas(novasEmendas);
                            }}
                          />
                          <Text style={styles.referenciaPostesSeparator}>-</Text>
                          <TextInput
                            style={[styles.posteNumeroInput, styles.referenciaPosteInput]}
                            placeholder="P final"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={emenda.posteFim}
                            onChangeText={(text) => {
                              const novasEmendas = [...fotosEmendas];
                              novasEmendas[emendaIndex].posteFim = text.replace(/[^0-9]/g, '');
                              setFotosEmendas(novasEmendas);
                            }}
                          />
                        </View>
                        {(!emenda.posteInicio || !emenda.posteFim) && (
                          <Text style={styles.hint}>Exemplo: Emenda E{emenda.numero || '?'} entre P1 - P2.</Text>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.photoButtonSmall}
                        onPress={() => takePicture('checklist_emenda', undefined, undefined, undefined, undefined, emendaIndex)}
                        disabled={loading || uploadingPhoto}
                      >
                        <Text style={styles.photoButtonTextSmall}>
                          + Adicionar Foto ({emenda.fotos.length})
                        </Text>
                      </TouchableOpacity>
                      {emenda.fotos.length > 0 && (
                        <View style={styles.photoGrid}>
                          {emenda.fotos.map((foto, fotoIndex) => (
                            <View key={fotoIndex} style={styles.photoCard}>
                              <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                <PhotoWithPlaca
                                  uri={foto.uri}
                                  obraNumero={obra}
                                  tipoServico={tipoServico}
                                  equipe={isAdminUser ? equipeExecutora : equipe}
                                  latitude={foto.latitude}
                                  longitude={foto.longitude}
                                  utmX={foto.utmX}
                                  utmY={foto.utmY}
                                  utmZone={foto.utmZone}
                                  style={styles.photoThumbnail}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.photoRemoveButton}
                                onPress={() => removePhoto('checklist_emenda', fotoIndex, undefined, undefined, undefined, undefined, emendaIndex)}
                              >
                                <Text style={styles.photoRemoveText}>×</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.posteRemoveButton}
                        onPress={() => {
                          setNumEmendas(numEmendas - 1);
                          setFotosEmendas(fotosEmendas.filter((_, i) => i !== emendaIndex));
                        }}
                      >
                        <Text style={styles.posteButtonText}>🗑️ Remover Ponto</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* 6. Poda - Secao Dinamica */}
                <View
                  style={styles.checklistSection}
                  onLayout={(event) => {
                    const { y } = event.nativeEvent.layout;
                    setSectionLayouts(prev => ({ ...prev, podas: y }));
                  }}
                >
                  <Text style={styles.checklistSectionTitle}>6️⃣ Poda (Opcional)</Text>
                  <Text style={styles.checklistHint}>Pode adicionar varias fotos por ponto. Cada poda deve indicar o trecho entre dois postes de referencia.</Text>

                  <View style={styles.posteControls}>
                    <Text style={styles.posteCount}>Pontos: {numPodas}</Text>
                    <TouchableOpacity
                      style={styles.posteAddButton}
                      onPress={() => {
                        setNumPodas(prev => prev + 1);
                        setFotosPodas(prev => {
                          const proximoNumero = prev.reduce((max, poda) => {
                            const numero = parseInt(poda.numero || '0', 10);
                            return Number.isFinite(numero) ? Math.max(max, numero) : max;
                          }, 0) + 1;
                          return [{ numero: String(proximoNumero), posteInicio: '', posteFim: '', fotos: [] }, ...prev];
                        });
                        showToast('Ponto de poda adicionado abaixo do botao.', 'success');
                      }}
                    >
                      <Text style={styles.posteButtonText}>➕ Adicionar Ponto</Text>
                    </TouchableOpacity>
                  </View>

                  {fotosPodas.map((poda, podaIndex) => (
                    <View key={podaIndex} style={styles.seccionamentoCard}>
                      <Text style={styles.seccionamentoTitle}>
                        PD{poda.numero || (podaIndex + 1)} entre {formatReferenciaEntrePostes(poda.posteInicio, poda.posteFim)} {poda.fotos.length > 0 && '✓'}
                      </Text>

                      <View style={styles.posteNumeroSection}>
                        <Text style={styles.posteNumeroLabel}>🔢 Numero da Poda *</Text>
                        <TextInput
                          style={styles.posteNumeroInput}
                          placeholder="Ex: 1, 2, 3..."
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                          value={poda.numero}
                          onChangeText={(text) => {
                            const novasPodas = [...fotosPodas];
                            novasPodas[podaIndex].numero = text.replace(/[^0-9]/g, '');
                            setFotosPodas(novasPodas);
                          }}
                        />
                      </View>

                      <View style={styles.posteNumeroSection}>
                        <Text style={styles.posteNumeroLabel}>🪧 Trecho entre postes *</Text>
                        <View style={styles.referenciaPostesRow}>
                          <TextInput
                            style={[styles.posteNumeroInput, styles.referenciaPosteInput]}
                            placeholder="P inicial"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={poda.posteInicio}
                            onChangeText={(text) => {
                              const novasPodas = [...fotosPodas];
                              novasPodas[podaIndex].posteInicio = text.replace(/[^0-9]/g, '');
                              setFotosPodas(novasPodas);
                            }}
                          />
                          <Text style={styles.referenciaPostesSeparator}>-</Text>
                          <TextInput
                            style={[styles.posteNumeroInput, styles.referenciaPosteInput]}
                            placeholder="P final"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={poda.posteFim}
                            onChangeText={(text) => {
                              const novasPodas = [...fotosPodas];
                              novasPodas[podaIndex].posteFim = text.replace(/[^0-9]/g, '');
                              setFotosPodas(novasPodas);
                            }}
                          />
                        </View>
                        {(!poda.posteInicio || !poda.posteFim) && (
                          <Text style={styles.hint}>Exemplo: Poda PD{poda.numero || '?'} entre P1 - P2.</Text>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.photoButtonSmall}
                        onPress={() => takePicture('checklist_poda', undefined, undefined, undefined, undefined, undefined, podaIndex)}
                        disabled={loading || uploadingPhoto}
                      >
                        <Text style={styles.photoButtonTextSmall}>
                          + Adicionar Foto ({poda.fotos.length})
                        </Text>
                      </TouchableOpacity>

                      {poda.fotos.length > 0 && (
                        <View style={styles.photoGrid}>
                          {poda.fotos.map((foto, fotoIndex) => (
                            <View key={fotoIndex} style={styles.photoCard}>
                              <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                <PhotoWithPlaca
                                  uri={foto.uri}
                                  obraNumero={obra}
                                  tipoServico={tipoServico}
                                  equipe={isAdminUser ? equipeExecutora : equipe}
                                  latitude={foto.latitude}
                                  longitude={foto.longitude}
                                  utmX={foto.utmX}
                                  utmY={foto.utmY}
                                  utmZone={foto.utmZone}
                                  style={styles.photoThumbnail}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.photoRemoveButton}
                                onPress={() => removePhoto('checklist_poda', fotoIndex, undefined, undefined, undefined, undefined, undefined, podaIndex)}
                              >
                                <Text style={styles.photoRemoveText}>×</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.posteRemoveButton}
                        onPress={() => {
                          setNumPodas(numPodas - 1);
                          setFotosPodas(fotosPodas.filter((_, i) => i !== podaIndex));
                        }}
                      >
                        <Text style={styles.posteButtonText}>🗑️ Remover Ponto</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* 7. Seccionamento de Cerca */}
                <View
                  style={styles.checklistSection}
                  onLayout={(event) => {
                    const { y } = event.nativeEvent.layout;
                    setSectionLayouts(prev => ({ ...prev, seccionamentos: y }));
                  }}
                >
                  <Text style={styles.checklistSectionTitle}>7️⃣ Seccionamento de Cerca (Opcional)</Text>
                  <Text style={styles.checklistHint}>1 foto por ponto de seccionamento</Text>

                  <View style={styles.posteControls}>
                    <Text style={styles.posteCount}>Pontos: {numSeccionamentos}</Text>
                    <TouchableOpacity
                      style={styles.posteAddButton}
                      onPress={() => {
                        setNumSeccionamentos(prev => prev + 1);
                        setFotosSeccionamentos(prev => {
                          const proximoNumero = prev.reduce((max, sec) => {
                            const numero = parseInt(sec.numero || '0', 10);
                            return Number.isFinite(numero) ? Math.max(max, numero) : max;
                          }, 0) + 1;
                          return [{ numero: String(proximoNumero), posteInicio: '', posteFim: '', fotos: [] }, ...prev];
                        });
                        // ✅ Aviso simples
                        showToast('Ponto de seccionamento adicionado abaixo do botao.', 'success');
                      }}
                    >
                      <Text style={styles.posteButtonText}>➕ Adicionar Ponto</Text>
                    </TouchableOpacity>
                  </View>

                  {fotosSeccionamentos.map((sec, secIndex) => (
                    <View key={secIndex} style={styles.seccionamentoCard}>
                      <Text style={styles.seccionamentoTitle}>
                        S{sec.numero || (secIndex + 1)} {sec.fotos.length > 0 && '✓'}
                      </Text>

                      {/* Campo para digitar o número do seccionamento */}
                      <View style={styles.posteNumeroSection}>
                        <Text style={styles.posteNumeroLabel}>🔢 Número do Seccionamento *</Text>
                        <TextInput
                          style={styles.posteNumeroInput}
                          placeholder="Ex: 1, 4, 7..."
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                          value={sec.numero}
                          onChangeText={(text) => {
                            const newSecs = [...fotosSeccionamentos];
                            newSecs[secIndex].numero = text.replace(/[^0-9]/g, '');
                            setFotosSeccionamentos(newSecs);
                          }}
                        />
                        {!sec.numero && (
                          <Text style={styles.hint}>Informe o número para exibir como S1, S4, etc.</Text>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.photoButtonSmall}
                        onPress={() => takePicture('checklist_seccionamento', undefined, secIndex)}
                        disabled={loading || uploadingPhoto || sec.fotos.length >= 1}
                      >
                        <Text style={styles.photoButtonTextSmall}>
                          {sec.fotos.length > 0 ? '✓ Adicionada' : '+ Adicionar Foto'}
                        </Text>
                      </TouchableOpacity>
                      {sec.fotos.length > 0 && (
                        <View style={styles.photoGrid}>
                          {sec.fotos.map((foto, fotoIndex) => (
                            <View key={fotoIndex} style={styles.photoCard}>
                              <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                <PhotoWithPlaca
                                  uri={foto.uri}
                                  obraNumero={obra}
                                  tipoServico={tipoServico}
                                  equipe={isAdminUser ? equipeExecutora : equipe}
                                  latitude={foto.latitude}
                                  longitude={foto.longitude}
                                  utmX={foto.utmX}
                                  utmY={foto.utmY}
                                  utmZone={foto.utmZone}
                                  style={styles.photoThumbnail}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.photoRemoveButton}
                                onPress={() => removePhoto('checklist_seccionamento', fotoIndex, undefined, secIndex)}
                              >
                                <Text style={styles.photoRemoveText}>×</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.posteRemoveButton}
                        onPress={() => {
                          setNumSeccionamentos(numSeccionamentos - 1);
                          setFotosSeccionamentos(fotosSeccionamentos.filter((_, i) => i !== secIndex));
                        }}
                      >
                        <Text style={styles.posteButtonText}>🗑️ Remover Ponto</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* 8. Aterramento de Cerca - Seção Dinâmica (OPCIONAL) */}
                <View
                  style={styles.checklistSection}
                  onLayout={(event) => {
                    const { y } = event.nativeEvent.layout;
                    setSectionLayouts(prev => ({ ...prev, aterramentos: y }));
                  }}
                >
                  <Text style={styles.checklistSectionTitle}>8️⃣ Aterramento de Cerca (Opcional)</Text>
                  <Text style={styles.checklistHint}>1 foto por ponto de aterramento - Detalhar haste, condutor e fixação</Text>

                  <View style={styles.posteControls}>
                    <Text style={styles.posteCount}>Pontos: {numAterramentosCerca}</Text>
                    <TouchableOpacity
                      style={styles.posteAddButton}
                      onPress={() => {
                        setNumAterramentosCerca(prev => {
                          setFotosAterramentosCerca(curr => {
                            const proximoNumero = curr.reduce((max, aterr) => {
                              const numero = parseInt(aterr.numero || '0', 10);
                              return Number.isFinite(numero) ? Math.max(max, numero) : max;
                            }, 0) + 1;
                            return [{ numero: String(proximoNumero), fotos: [] }, ...curr];
                          });
                          // ✅ Aviso simples
                          showToast('Ponto de aterramento adicionado abaixo do botao.', 'success');
                          return prev + 1;
                        });
                      }}
                    >
                      <Text style={styles.posteButtonText}>➕ Adicionar Ponto</Text>
                    </TouchableOpacity>
                  </View>

                  {fotosAterramentosCerca.map((aterr, aterrIndex) => (
                    <View key={aterrIndex} style={styles.seccionamentoCard}>
                      <Text style={styles.seccionamentoTitle}>
                        A{aterr.numero || (aterrIndex + 1)} {aterr.fotos.length > 0 && '✓'}
                      </Text>

                      {/* Campo para digitar o número do aterramento */}
                      <View style={styles.posteNumeroSection}>
                        <Text style={styles.posteNumeroLabel}>🔢 Número do Aterramento *</Text>
                        <TextInput
                          style={styles.posteNumeroInput}
                          placeholder="Ex: 1, 3, 5..."
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                          value={aterr.numero}
                          onChangeText={(text) => {
                            const newAterrs = [...fotosAterramentosCerca];
                            newAterrs[aterrIndex].numero = text.replace(/[^0-9]/g, '');
                            setFotosAterramentosCerca(newAterrs);
                          }}
                        />
                        {!aterr.numero && (
                          <Text style={styles.hint}>Informe o número para exibir como A1, A3, etc.</Text>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.photoButtonSmall}
                        onPress={() => takePicture('checklist_aterramento_cerca', undefined, undefined, aterrIndex)}
                        disabled={loading || uploadingPhoto || aterr.fotos.length >= 1}
                      >
                        <Text style={styles.photoButtonTextSmall}>
                          {aterr.fotos.length > 0 ? '✓ Adicionada' : '+ Adicionar Foto'}
                        </Text>
                      </TouchableOpacity>

                      {aterr.fotos.length > 0 && (
                        <View style={styles.photoGrid}>
                          {aterr.fotos.map((foto, fotoIndex) => (
                            <View key={fotoIndex} style={styles.photoCard}>
                              <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                <PhotoWithPlaca
                                  uri={foto.uri}
                                  obraNumero={obra}
                                  tipoServico={tipoServico}
                                  equipe={isAdminUser ? equipeExecutora : equipe}
                                  latitude={foto.latitude}
                                  longitude={foto.longitude}
                                  utmX={foto.utmX}
                                  utmY={foto.utmY}
                                  utmZone={foto.utmZone}
                                  style={styles.photoThumbnail}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.photoRemoveButton}
                                onPress={() => removePhoto('checklist_aterramento_cerca', fotoIndex, undefined, undefined, aterrIndex)}
                              >
                                <Text style={styles.photoRemoveText}>×</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.posteRemoveButton}
                        onPress={() => {
                          setNumAterramentosCerca(numAterramentosCerca - 1);
                          setFotosAterramentosCerca(fotosAterramentosCerca.filter((_, i) => i !== aterrIndex));
                        }}
                      >
                        <Text style={styles.posteButtonText}>🗑️ Remover Ponto</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* 9. Padrão de Ligação - Vista Geral - OPCIONAL */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>9️⃣ Padrão de Ligação - Vista Geral (Opcional) {fotosChecklistPadraoGeral.length >= 1 && '✓'}</Text>
                  <Text style={styles.checklistHint}>Opcional - Vista geral do padrão</Text>

                  <TouchableOpacity
                    style={styles.photoButtonSmall}
                    onPress={() => takePicture('checklist_padrao_geral')}
                    disabled={loading || uploadingPhoto || fotosChecklistPadraoGeral.length >= 1}
                  >
                    <Text style={styles.photoButtonTextSmall}>
                      {fotosChecklistPadraoGeral.length > 0 ? '✓ Adicionada' : '+ Adicionar Foto do Padrão'}
                    </Text>
                  </TouchableOpacity>

                  {fotosChecklistPadraoGeral.length > 0 && (
                    <View style={styles.photoGrid}>
                      {fotosChecklistPadraoGeral.map((foto, index) => (
                        <View key={index} style={styles.photoCard}>
                          <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => removePhoto('checklist_padrao_geral', index)}
                          >
                            <Text style={styles.photoRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 10. Padrão de Ligação - Interno - OPCIONAL */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>🔟 Padrão de Ligação - Interno (Opcional) {fotosChecklistPadraoInterno.length >= 1 && '✓'}</Text>
                  <Text style={styles.checklistHint}>Opcional - Disjuntores, barramentos e identificação</Text>

                  <TouchableOpacity
                    style={styles.photoButtonSmall}
                    onPress={() => takePicture('checklist_padrao_interno')}
                    disabled={loading || uploadingPhoto || fotosChecklistPadraoInterno.length >= 1}
                  >
                    <Text style={styles.photoButtonTextSmall}>
                      {fotosChecklistPadraoInterno.length > 0 ? '✓ Adicionada' : '+ Adicionar Foto Interna'}
                    </Text>
                  </TouchableOpacity>

                  {fotosChecklistPadraoInterno.length > 0 && (
                    <View style={styles.photoGrid}>
                      {fotosChecklistPadraoInterno.map((foto, index) => (
                        <View key={index} style={styles.photoCard}>
                          <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => removePhoto('checklist_padrao_interno', index)}
                          >
                            <Text style={styles.photoRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 11. Flying - OPCIONAL */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>1️⃣1️⃣ Flying (Opcional) {fotosChecklistFrying.length >= 2 && '✓'}</Text>
                  <Text style={styles.checklistHint}>Opcional - 2 fotos recomendadas</Text>

                  <TouchableOpacity
                    style={styles.photoButtonSmall}
                    onPress={() => takePicture('checklist_frying')}
                    disabled={loading || uploadingPhoto}
                  >
                    <Text style={styles.photoButtonTextSmall}>
                      + Adicionar Foto ({fotosChecklistFrying.length})
                    </Text>
                  </TouchableOpacity>

                  {fotosChecklistFrying.length > 0 && (
                    <View style={styles.photoGrid}>
                      {fotosChecklistFrying.map((foto, index) => (
                        <View key={index} style={styles.photoCard}>
                          <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => removePhoto('checklist_frying', index)}
                          >
                            <Text style={styles.photoRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 12. Abertura e Fechamento de Pulo - OPCIONAL */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>1️⃣2️⃣ Abertura e Fechamento de Pulo (Opcional) {fotosChecklistAberturaFechamentoPulo.length >= 2 && '✓'}</Text>
                  <Text style={styles.checklistHint}>Opcional - 2 fotos recomendadas</Text>

                  <TouchableOpacity
                    style={styles.photoButtonSmall}
                    onPress={() => takePicture('checklist_abertura_fechamento_pulo')}
                    disabled={loading || uploadingPhoto}
                  >
                    <Text style={styles.photoButtonTextSmall}>
                      + Adicionar Foto ({fotosChecklistAberturaFechamentoPulo.length})
                    </Text>
                  </TouchableOpacity>

                  {fotosChecklistAberturaFechamentoPulo.length > 0 && (
                    <View style={styles.photoGrid}>
                      {fotosChecklistAberturaFechamentoPulo.map((foto, index) => (
                        <View key={index} style={styles.photoCard}>
                          <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => removePhoto('checklist_abertura_fechamento_pulo', index)}
                          >
                            <Text style={styles.photoRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 13. Hastes Aplicadas e Medição do Termômetro - Seção Dinâmica */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>1️⃣3️⃣ Hastes Aplicadas e Medição do Termômetro (Opcional)</Text>
                  <Text style={styles.checklistHint}>Cada ponto (P1, P2...) contém 1 foto de haste aplicada + 1 foto de medição do termômetro</Text>

                  <View style={styles.posteControls}>
                    <Text style={styles.posteCount}>Pontos: {numPontosHastesTermometros}</Text>
                    <TouchableOpacity
                      style={styles.posteAddButton}
                      onPress={() => {
                        setNumPontosHastesTermometros(prev => prev + 1);
                        setPontosHastesTermometros(prev => {
                          const proximoNumero = prev.reduce((max, ponto) => {
                            const numero = parseInt(ponto.numero || '0', 10);
                            return Number.isFinite(numero) ? Math.max(max, numero) : max;
                          }, 0) + 1;
                          return [{
                          numero: String(proximoNumero),
                          isAditivo: false,
                          fotoHaste: [],
                          fotoTermometro: [],
                        }, ...prev];
                        });
                        showToast('Ponto adicionado abaixo do botao.', 'success');
                      }}
                    >
                      <Text style={styles.posteButtonText}>➕ Adicionar Ponto</Text>
                    </TouchableOpacity>
                  </View>

                  {pontosHastesTermometros.map((ponto, pontoIndex) => (
                    <View key={pontoIndex} style={styles.posteCard}>
                      <Text style={styles.posteTitle}>
                        Ponto {ponto.numero || (pontoIndex + 1)}{ponto.numero ? ` - ${ponto.isAditivo ? 'AD-' : ''}P${ponto.numero}` : ''}
                        {ponto.fotoHaste.length > 0 && ponto.fotoTermometro.length > 0 && ' ✓'}
                      </Text>

                      {/* Campo para identificar o número do ponto */}
                      <View style={styles.posteNumeroSection}>
                        <Text style={styles.posteNumeroLabel}>🪧 Número do Ponto *</Text>
                        <TextInput
                          style={styles.posteNumeroInput}
                          placeholder="Ex: 1, 2, 3..."
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                          value={ponto.numero}
                          onChangeText={(text) => {
                            const newPontos = [...pontosHastesTermometros];
                            newPontos[pontoIndex].numero = text.replace(/[^0-9]/g, '');
                            setPontosHastesTermometros(newPontos);
                          }}
                        />
                      </View>

                      {/* Checkbox Aditivo */}
                      <TouchableOpacity
                        style={styles.aditivoCheckboxContainer}
                        onPress={() => {
                          const newPontos = [...pontosHastesTermometros];
                          newPontos[pontoIndex].isAditivo = !newPontos[pontoIndex].isAditivo;
                          setPontosHastesTermometros(newPontos);
                        }}
                      >
                        <View style={[styles.aditivoCheckbox, ponto.isAditivo && styles.aditivoCheckboxChecked]}>
                          {ponto.isAditivo && <Text style={styles.aditivoCheckmark}>✓</Text>}
                        </View>
                        <Text style={styles.aditivoCheckboxLabel}>
                          Este ponto é de Aditivo (será marcado como AD-P{ponto.numero || '?'})
                        </Text>
                      </TouchableOpacity>

                      {/* Botões de Fotos */}
                      <View style={styles.pontoFotosContainer}>
                        {/* Foto da Haste */}
                        <View style={styles.pontoFotoSection}>
                          <Text style={styles.pontoFotoLabel}>
                            📸 Haste Aplicada {ponto.fotoHaste.length > 0 && '✓'}
                          </Text>
                          <TouchableOpacity
                            style={styles.pontoFotoButton}
                            onPress={() => takePicture('checklist_ponto_haste', undefined, undefined, undefined, pontoIndex)}
                            disabled={loading || uploadingPhoto || ponto.fotoHaste.length >= 1}
                          >
                            <Text style={styles.pontoFotoButtonText}>
                              {ponto.fotoHaste.length > 0 ? '✓ Adicionada' : '+ Adicionar'}
                            </Text>
                          </TouchableOpacity>
                          {ponto.fotoHaste.length > 0 && (
                            <View style={styles.pontoPhotoPreview}>
                              {ponto.fotoHaste.map((foto, fotoIndex) => (
                                <View key={fotoIndex} style={styles.photoCard}>
                                  <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                    <PhotoWithPlaca
                                      uri={foto.uri}
                                      obraNumero={obra}
                                      tipoServico={tipoServico}
                                      equipe={isAdminUser ? equipeExecutora : equipe}
                                      latitude={foto.latitude}
                                      longitude={foto.longitude}
                                      utmX={foto.utmX}
                                      utmY={foto.utmY}
                                      utmZone={foto.utmZone}
                                      style={styles.photoThumbnailSmall}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.photoRemoveButton}
                                    onPress={() => removePhoto('checklist_ponto_haste', fotoIndex, undefined, undefined, undefined, pontoIndex)}
                                  >
                                    <Text style={styles.photoRemoveText}>×</Text>
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>

                        {/* Foto do Termômetro */}
                        <View style={styles.pontoFotoSection}>
                          <Text style={styles.pontoFotoLabel}>
                            🌡️ Medição do Termômetro {ponto.fotoTermometro.length > 0 && '✓'}
                          </Text>
                          <TouchableOpacity
                            style={styles.pontoFotoButton}
                            onPress={() => takePicture('checklist_ponto_termometro', undefined, undefined, undefined, pontoIndex)}
                            disabled={loading || uploadingPhoto || ponto.fotoTermometro.length >= 1}
                          >
                            <Text style={styles.pontoFotoButtonText}>
                              {ponto.fotoTermometro.length > 0 ? '✓ Adicionada' : '+ Adicionar'}
                            </Text>
                          </TouchableOpacity>
                          {ponto.fotoTermometro.length > 0 && (
                            <View style={styles.pontoPhotoPreview}>
                              {ponto.fotoTermometro.map((foto, fotoIndex) => (
                                <View key={fotoIndex} style={styles.photoCard}>
                                  <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                                    <PhotoWithPlaca
                                      uri={foto.uri}
                                      obraNumero={obra}
                                      tipoServico={tipoServico}
                                      equipe={isAdminUser ? equipeExecutora : equipe}
                                      latitude={foto.latitude}
                                      longitude={foto.longitude}
                                      utmX={foto.utmX}
                                      utmY={foto.utmY}
                                      utmZone={foto.utmZone}
                                      style={styles.photoThumbnailSmall}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.photoRemoveButton}
                                    onPress={() => removePhoto('checklist_ponto_termometro', fotoIndex, undefined, undefined, undefined, pontoIndex)}
                                  >
                                    <Text style={styles.photoRemoveText}>×</Text>
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Botão para remover ponto */}
                      <TouchableOpacity
                        style={styles.posteRemoveButton}
                        onPress={() => {
                          const newPontos = pontosHastesTermometros.filter((_, i) => i !== pontoIndex);
                          setPontosHastesTermometros(newPontos);
                          setNumPontosHastesTermometros(numPontosHastesTermometros - 1);
                        }}
                      >
                        <Text style={styles.posteRemoveText}>🗑️ Remover Ponto</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* 14. Panorâmica Final */}
                <View style={styles.checklistSection}>
                  <Text style={styles.checklistSectionTitle}>1️⃣4️⃣ Panorâmica Final {fotosChecklistPanoramicaFinal.length >= 2 && '✓'}</Text>
                  <Text style={styles.checklistHint}>Recomendado: 2 fotos - Obra finalizada e limpa</Text>

                  <TouchableOpacity
                    style={styles.photoButtonSmall}
                    onPress={() => takePicture('checklist_panoramica_final')}
                    disabled={loading || uploadingPhoto}
                  >
                    <Text style={styles.photoButtonTextSmall}>
                      + Adicionar Foto ({fotosChecklistPanoramicaFinal.length})
                    </Text>
                  </TouchableOpacity>

                  {fotosChecklistPanoramicaFinal.length > 0 && (
                    <View style={styles.photoGrid}>
                      {fotosChecklistPanoramicaFinal.map((foto, index) => (
                        <View key={index} style={styles.photoCard}>
                          <TouchableOpacity onPress={() => openPhotoFullscreen(foto)} activeOpacity={0.8}>
                      <PhotoWithPlaca
                        uri={foto.uri}
                        obraNumero={obra}
                        tipoServico={tipoServico}
                        equipe={isAdminUser ? equipeExecutora : equipe}
                        latitude={foto.latitude}
                        longitude={foto.longitude}
                        utmX={foto.utmX}
                        utmY={foto.utmY}
                        utmZone={foto.utmZone}
                        style={styles.photoThumbnail}
                      />
                    </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => removePhoto('checklist_panoramica_final', index)}
                          >
                            <Text style={styles.photoRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* DOCUMENTAÇÃO */}
            {isServicoDocumentacao && (
              <>
                <Text style={styles.sectionTitle}>📄 Documentação (Opcional)</Text>
                <Text style={styles.docHint}>Anexe documentos conforme necessário. Você pode tirar foto ou selecionar PDF. Todos os documentos são opcionais.</Text>

                {/* 1. Cadastro de Medidor */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionTitle}>📋 Cadastro de Medidor {docCadastroMedidor.length > 0 && '✅'}</Text>

                  {/* Botões lado a lado: Foto + PDF */}
                  <View style={styles.docButtonRow}>
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => takePicture('doc_cadastro_medidor')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => selectDocument('doc_cadastro_medidor')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {docCadastroMedidor.length > 0 && (
                    <View style={styles.docList}>
                      {docCadastroMedidor.map((doc, index) => (
                        <View key={index} style={styles.docItem}>
                          {doc.uri ? (
                            <>
                              <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                              <Text style={styles.docFileName}>📷 Foto {index + 1}</Text>
                            </>
                          ) : (
                            <Text style={styles.docFileName}>📄 Documento {index + 1}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.docRemoveButton}
                            onPress={() => removePhoto('doc_cadastro_medidor', index)}
                          >
                            <Text style={styles.docRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 2. Laudo de Transformador */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionTitle}>⚡ Laudo de Transformador {docLaudoTransformador.length > 0 && '✅'}</Text>

                  {/* Botões lado a lado: Foto + PDF */}
                  <View style={styles.docButtonRow}>
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => takePicture('doc_laudo_transformador')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => selectDocument('doc_laudo_transformador')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {docLaudoTransformador.length > 0 && (
                    <View style={styles.docList}>
                      {docLaudoTransformador.map((doc, index) => (
                        <View key={index} style={styles.docItem}>
                          {doc.uri ? (
                            <>
                              <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                              <Text style={styles.docFileName}>📷 Foto {index + 1}</Text>
                            </>
                          ) : (
                            <Text style={styles.docFileName}>📄 Documento {index + 1}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.docRemoveButton}
                            onPress={() => removePhoto('doc_laudo_transformador', index)}
                          >
                            <Text style={styles.docRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 3. Laudo de Regulador */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionTitle}>🔧 Laudo de Regulador {docLaudoRegulador.length > 0 && '✅'}</Text>

                  {/* Botões lado a lado: Foto + PDF */}
                  <View style={styles.docButtonRow}>
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => takePicture('doc_laudo_regulador')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => selectDocument('doc_laudo_regulador')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {docLaudoRegulador.length > 0 && (
                    <View style={styles.docList}>
                      {docLaudoRegulador.map((doc, index) => (
                        <View key={index} style={styles.docItem}>
                          {doc.uri ? (
                            <>
                              <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                              <Text style={styles.docFileName}>📷 Foto {index + 1}</Text>
                            </>
                          ) : (
                            <Text style={styles.docFileName}>📄 Documento {index + 1}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.docRemoveButton}
                            onPress={() => removePhoto('doc_laudo_regulador', index)}
                          >
                            <Text style={styles.docRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 4. Laudo de Religador */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionTitle}>🔌 Laudo de Religador {docLaudoReligador.length > 0 && '✅'}</Text>

                  {/* Botões lado a lado: Foto + PDF */}
                  <View style={styles.docButtonRow}>
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => takePicture('doc_laudo_religador')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => selectDocument('doc_laudo_religador')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {docLaudoReligador.length > 0 && (
                    <View style={styles.docList}>
                      {docLaudoReligador.map((doc, index) => (
                        <View key={index} style={styles.docItem}>
                          {doc.uri ? (
                            <>
                              <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                              <Text style={styles.docFileName}>📷 Foto {index + 1}</Text>
                            </>
                          ) : (
                            <Text style={styles.docFileName}>📄 Documento {index + 1}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.docRemoveButton}
                            onPress={() => removePhoto('doc_laudo_religador', index)}
                          >
                            <Text style={styles.docRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 5. FVBT - Formulário de Vistoria de Baixa Tensão */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionTitle}>📝 Formulário de Vistoria de Baixa Tensão (FVBT) {docFvbt.length > 0 && '✅'}</Text>

                  {/* Botões lado a lado: Foto + PDF */}
                  <View style={styles.docButtonRow}>
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => takePicture('doc_fvbt')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => selectDocument('doc_fvbt')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {docFvbt.length > 0 && (
                    <View style={styles.docList}>
                      {docFvbt.map((doc, index) => (
                        <View key={index} style={styles.docItem}>
                          {doc.uri ? (
                            <>
                              <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                              <Text style={styles.docFileName}>📷 Foto {index + 1}</Text>
                            </>
                          ) : (
                            <Text style={styles.docFileName}>📄 Documento {index + 1}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.docRemoveButton}
                            onPress={() => removePhoto('doc_fvbt', index)}
                          >
                            <Text style={styles.docRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 6. Termo de Desistência - LPT */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionTitle}>📋 Termo de Desistência - LPT {docTermoDesistenciaLpt.length > 0 && '✅'}</Text>

                  {/* Botões lado a lado: Foto + PDF */}
                  <View style={styles.docButtonRow}>
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => takePicture('doc_termo_desistencia_lpt')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => selectDocument('doc_termo_desistencia_lpt')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {docTermoDesistenciaLpt.length > 0 && (
                    <View style={styles.docList}>
                      {docTermoDesistenciaLpt.map((doc, index) => (
                        <View key={index} style={styles.docItem}>
                          {doc.uri ? (
                            <>
                              <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                              <Text style={styles.docFileName}>📷 Foto {index + 1}</Text>
                            </>
                          ) : (
                            <Text style={styles.docFileName}>📄 Documento {index + 1}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.docRemoveButton}
                            onPress={() => removePhoto('doc_termo_desistencia_lpt', index)}
                          >
                            <Text style={styles.docRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 7. Autorização de Passagem */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionTitle}>🚧 Autorização de Passagem {docAutorizacaoPassagem.length > 0 && '✅'}</Text>

                  {/* Botões lado a lado: Foto + PDF */}
                  <View style={styles.docButtonRow}>
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => takePicture('doc_autorizacao_passagem')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => selectDocument('doc_autorizacao_passagem')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {docAutorizacaoPassagem.length > 0 && (
                    <View style={styles.docList}>
                      {docAutorizacaoPassagem.map((doc, index) => (
                        <View key={index} style={styles.docItem}>
                          {doc.uri ? (
                            <>
                              <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                              <Text style={styles.docFileName}>📷 Foto {index + 1}</Text>
                            </>
                          ) : (
                            <Text style={styles.docFileName}>📄 Documento {index + 1}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.docRemoveButton}
                            onPress={() => removePhoto('doc_autorizacao_passagem', index)}
                          >
                            <Text style={styles.docRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* 8. Materiais Previsto/Realizado */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionTitle}>
                    📋 Materiais Previsto/Realizado ({docMateriaisPrevisto.length}) {docMateriaisPrevisto.length > 0 && '✅'}
                  </Text>

                  {/* Botões lado a lado: Foto + PDF */}
                  <View style={styles.docButtonRow}>
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => takePicture('doc_materiais_previsto')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Processando...' : 'Tirar Foto'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonHalf]}
                      onPress={() => selectDocument('doc_materiais_previsto')}
                      disabled={loading || uploadingPhoto}
                    >
                      <View style={styles.photoButtonContent}>
                        <Text style={styles.photoButtonIcon}>{uploadingPhoto ? '⏳' : '📁'}</Text>
                        <Text style={styles.photoButtonText}>
                          {uploadingPhoto ? 'Selecionando...' : 'Selecionar PDF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {docMateriaisPrevisto.length > 0 && (
                    <View style={styles.docList}>
                      {docMateriaisPrevisto.map((doc, index) => (
                        <View key={index} style={styles.docItem}>
                          {doc.uri ? (
                            <>
                              <Image source={{ uri: doc.uri }} style={styles.docThumbnail} />
                              <Text style={styles.docFileName}>📷 Documento {index + 1}</Text>
                            </>
                          ) : (
                            <Text style={styles.docFileName}>📄 Documento {index + 1}</Text>
                          )}
                          <TouchableOpacity
                            style={styles.docRemoveButton}
                            onPress={() => removePhoto('doc_materiais_previsto', index)}
                          >
                            <Text style={styles.docRemoveText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
            </View>
          )}

          {/* Botões - UX SIMPLIFICADA */}
          <View style={styles.buttonContainer}>
            {(() => {
              const podeFinalizarObra = calcularPodeFinalizar();
              const isRascunhoLocal = isEditMode && obraId?.startsWith('local_');
              const isObraExistente = isEditMode && !isRascunhoLocal;

              // ===== CENÁRIO 1: NOVA OBRA (não é edição) =====
              if (!isEditMode) {
                return (
                  <>
                    {/* Botão principal: Salvar (como rascunho) */}
                    <TouchableOpacity
                      style={[styles.saveButton, loading && styles.buttonDisabled, { marginBottom: 0 }]}
                      onPress={handlePausar}
                      disabled={loading}
                    >
                      <Text style={styles.saveButtonText}>
                        {loading ? 'Salvando...' : '💾 Salvar'}
                      </Text>
                    </TouchableOpacity>

                    {/* Botão secundário: Voltar */}
                    <TouchableOpacity
                      style={[styles.backButton, { marginBottom: 0 }]}
                      onPress={() => {
                        if (router.canGoBack()) {
                          router.back();
                        } else {
                          router.replace('/(tabs)');
                        }
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.backButtonText}>← Voltar</Text>
                    </TouchableOpacity>
                  </>
                );
              }

              // ===== CENÁRIO 2: EDITANDO RASCUNHO LOCAL =====
              // NOTA: Botão "Finalizar" foi REMOVIDO do formulário
              // Agora só aparece nos DETALHES da obra (tela separada)
              if (isRascunhoLocal) {
                return (
                  <>
                    {/* Botão principal: Salvar alterações */}
                    <TouchableOpacity
                      style={[styles.saveButton, loading && styles.buttonDisabled, { marginBottom: 0 }]}
                      onPress={handlePausar}
                      disabled={loading}
                    >
                      <Text style={styles.saveButtonText}>
                        {loading ? 'Salvando...' : '💾 Salvar'}
                      </Text>
                    </TouchableOpacity>

                    {/* Botão secundário: Voltar */}
                    <TouchableOpacity
                      style={[styles.backButton, { marginBottom: 0 }]}
                      onPress={() => {
                        if (router.canGoBack()) {
                          router.back();
                        } else {
                          router.replace('/(tabs)');
                        }
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.backButtonText}>← Voltar</Text>
                    </TouchableOpacity>
                  </>
                );
              }

              // ===== CENÁRIO 3: EDITANDO OBRA JÁ FINALIZADA =====
              if (isObraExistente) {
                return (
                  <>
                    {/* Botão principal: Adicionar Fotos */}
                    <TouchableOpacity
                      style={[styles.addPhotosButton, loading && styles.buttonDisabled]}
                      onPress={handleSalvarObra}
                      disabled={loading}
                    >
                      <Text style={styles.buttonText}>
                        {loading ? '📸 Adicionando...' : '📸 Adicionar Fotos'}
                      </Text>
                    </TouchableOpacity>

                    {/* Botão secundário: Voltar */}
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => {
                        if (router.canGoBack()) {
                          router.back();
                        } else {
                          router.replace('/(tabs)');
                        }
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.backButtonText}>← Voltar</Text>
                    </TouchableOpacity>
                  </>
                );
              }

              return null;
            })()}
          </View>
        </View>
      </ScrollView>

      {/* Modal de Seleção de Serviços */}
      <Modal
        visible={showServicoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowServicoModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowServicoModal(false)}
        >
          <View style={styles.modalContent}>
            <Pressable>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tipo de Serviço</Text>
                <TouchableOpacity onPress={() => setShowServicoModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>Selecione apenas um serviço</Text>

              <ScrollView style={styles.modalList}>
                {TIPOS_SERVICO.map((tipo) => (
                  <TouchableOpacity
                    key={tipo}
                    style={[
                      styles.modalItem,
                      tipoServico === tipo && styles.modalItemActive,
                    ]}
                    onPress={() => handleTipoServicoSelect(tipo)}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        tipoServico === tipo && styles.modalItemTextActive,
                      ]}
                    >
                      {tipo}
                    </Text>
                    {tipoServico === tipo && (
                      <Text style={styles.modalCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de Seleção de Equipe de Lançamento (Admin) */}
      {isAdminUser && (
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
                  <Text style={styles.modalTitle}>
                    Selecione a Equipe do Lançamento
                  </Text>
                  <TouchableOpacity onPress={() => setShowEquipeModal(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalList}>
                  {equipesAdmin.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.modalItem,
                        equipeExecutora === item && styles.modalItemSelected,
                      ]}
                      onPress={() => {
                        setEquipeExecutora(item);
                        setShowEquipeModal(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalItemText,
                          equipeExecutora === item && styles.modalItemTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                      {equipeExecutora === item && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Modal de Seleção de Data */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDatePicker(false)}
        >
          <View style={styles.modalContent}>
            <Pressable>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Selecionar Data</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerContainer}>
                {/* Display da data selecionada */}
                <View style={styles.dateDisplay}>
                  <Text style={styles.dateDisplayText}>
                    {selectedDate.toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                </View>

                {/* Controles de Data */}
                <View style={styles.dateControls}>
                  {/* Dia */}
                  <View style={styles.dateControl}>
                    <Text style={styles.dateControlLabel}>Dia</Text>
                    <View style={styles.dateControlButtons}>
                      <TouchableOpacity
                        style={styles.dateControlButton}
                        onPress={() => {
                          const newDay = selectedDate.getDate() - 1;
                          if (newDay >= 1) updateDateComponent('day', newDay);
                        }}
                      >
                        <Text style={styles.dateControlButtonText}>▲</Text>
                      </TouchableOpacity>
                      <Text style={styles.dateControlValue}>{selectedDate.getDate()}</Text>
                      <TouchableOpacity
                        style={styles.dateControlButton}
                        onPress={() => {
                          const maxDays = getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth());
                          const newDay = selectedDate.getDate() + 1;
                          if (newDay <= maxDays) updateDateComponent('day', newDay);
                        }}
                      >
                        <Text style={styles.dateControlButtonText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Mês */}
                  <View style={styles.dateControl}>
                    <Text style={styles.dateControlLabel}>Mês</Text>
                    <View style={styles.dateControlButtons}>
                      <TouchableOpacity
                        style={styles.dateControlButton}
                        onPress={() => {
                          const newMonth = selectedDate.getMonth() - 1;
                          if (newMonth >= 0) updateDateComponent('month', newMonth);
                        }}
                      >
                        <Text style={styles.dateControlButtonText}>▲</Text>
                      </TouchableOpacity>
                      <Text style={styles.dateControlValue}>{selectedDate.getMonth() + 1}</Text>
                      <TouchableOpacity
                        style={styles.dateControlButton}
                        onPress={() => {
                          const newMonth = selectedDate.getMonth() + 1;
                          if (newMonth <= 11) updateDateComponent('month', newMonth);
                        }}
                      >
                        <Text style={styles.dateControlButtonText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Ano */}
                  <View style={styles.dateControl}>
                    <Text style={styles.dateControlLabel}>Ano</Text>
                    <View style={styles.dateControlButtons}>
                      <TouchableOpacity
                        style={styles.dateControlButton}
                        onPress={() => updateDateComponent('year', selectedDate.getFullYear() - 1)}
                      >
                        <Text style={styles.dateControlButtonText}>▲</Text>
                      </TouchableOpacity>
                      <Text style={styles.dateControlValue}>{selectedDate.getFullYear()}</Text>
                      <TouchableOpacity
                        style={styles.dateControlButton}
                        onPress={() => updateDateComponent('year', selectedDate.getFullYear() + 1)}
                      >
                        <Text style={styles.dateControlButtonText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Botões de ação rápida */}
                <View style={styles.dateQuickActions}>
                  <TouchableOpacity
                    style={styles.dateQuickButton}
                    onPress={() => setSelectedDate(new Date())}
                  >
                    <Text style={styles.dateQuickButtonText}>Hoje</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleDateConfirm}
              >
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de Scanner de Placa */}
      <PlacaScanner
        visible={showPlacaScanner}
        onClose={() => setShowPlacaScanner(false)}
        onPlacaDetected={handlePlacaDetected}
      />

      {/* Modal de Visualização de Foto em Tela Cheia */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePhotoModal}
      >
        <View style={styles.photoModalContainer}>
          <TouchableOpacity
            style={styles.photoModalCloseButton}
            onPress={closePhotoModal}
            activeOpacity={0.8}
          >
            <Text style={styles.photoModalCloseText}>✕</Text>
          </TouchableOpacity>

          {selectedPhotoForView && (
            <PhotoWithPlaca
              uri={selectedPhotoForView.uri}
              obraNumero={obra}
              tipoServico={tipoServico}
              equipe={isAdminUser ? equipeExecutora : equipe}
              latitude={selectedPhotoForView.latitude}
              longitude={selectedPhotoForView.longitude}
              utmX={selectedPhotoForView.utmX}
              utmY={selectedPhotoForView.utmY}
              utmZone={selectedPhotoForView.utmZone}
              style={styles.photoModalImage}
            />
          )}
        </View>
      </Modal>

      {/* Modal de Confirmação de Saída */}
      <Modal
        visible={exitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitModalVisible(false)}
      >
        <View style={styles.exitModalOverlay}>
          <View style={styles.exitModalContainer}>
            {/* Ícone de aviso */}
            <View style={styles.exitModalIconContainer}>
              <Text style={styles.exitModalIcon}>⚠️</Text>
            </View>

            {/* Título */}
            <Text style={styles.exitModalTitle}>Sair da Obra?</Text>

            {/* Descrição */}
            <Text style={styles.exitModalDescription}>
              Você tem dados não salvos. O que deseja fazer com as alterações?
            </Text>

            {/* Botões */}
            <View style={styles.exitModalButtons}>
              {/* Botão Salvar */}
              <TouchableOpacity
                style={styles.exitModalButtonSave}
                onPress={handleExitSave}
                activeOpacity={0.8}
              >
                <Text style={styles.exitModalButtonSaveIcon}>💾</Text>
                <Text style={styles.exitModalButtonSaveText}>Salvar</Text>
              </TouchableOpacity>

              {/* Botão Descartar */}
              <TouchableOpacity
                style={styles.exitModalButtonDiscard}
                onPress={handleExitDiscard}
                activeOpacity={0.8}
              >
                <Text style={styles.exitModalButtonDiscardIcon}>🗑️</Text>
                <Text style={styles.exitModalButtonDiscardText}>Descartar</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Cancelar */}
            <TouchableOpacity
              style={styles.exitModalButtonCancel}
              onPress={() => setExitModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.exitModalButtonCancelText}>Continuar Editando</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Toast de notificações */}
      {toast}
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
    paddingBottom: 40,
  },
  content: {
    padding: 20,
  },
  connectionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  connectionCardOnline: {
    backgroundColor: '#f1f8e9',
    borderColor: '#dcedc8',
  },
  connectionCardOffline: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffe0b2',
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  connectionTextWrapper: {
    flex: 1,
  },
  connectionDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  connectionDotOnline: {
    backgroundColor: '#2e7d32',
  },
  connectionDotOffline: {
    backgroundColor: '#ff6f00',
  },
  connectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  connectionSubtitle: {
    fontSize: 13,
    color: '#4a4a4a',
    marginTop: 2,
    lineHeight: 18,
    flexShrink: 1,
  },
  connectionAction: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  connectionActionDisabled: {
    opacity: 0.5,
  },
  connectionActionText: {
    color: '#fff',
    fontWeight: '600',
  },
  pendingContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    marginBottom: 32,
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  pendingCount: {
    fontSize: 13,
    color: '#888',
  },
  pendingItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  pendingItemFirst: {
    borderTopWidth: 0,
    paddingTop: 4,
  },
  pendingStatusBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pendingStatusPending: {
    backgroundColor: '#fff3e0',
  },
  pendingStatusSyncing: {
    backgroundColor: '#e3f2fd',
  },
  pendingStatusFailed: {
    backgroundColor: '#ffebee',
  },
  pendingStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingObraName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  pendingMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  pendingErrorText: {
    fontSize: 12,
    color: '#c62828',
    marginTop: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    color: '#999',
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
  textArea: {
    minHeight: 100,
    paddingTop: 12,
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
    color: '#333',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#999',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  dropdownButtonDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  lockIcon: {
    fontSize: 16,
    color: '#999',
  },
  selectedItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  selectedBadge: {
    backgroundColor: '#ffe6e6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedBadgeText: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: '600',
  },
  removeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBadgeText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  radioButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  radioButtonActive: {
    backgroundColor: '#dc3545',
    borderColor: '#dc3545',
  },
  radioText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  radioTextActive: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalClose: {
    fontSize: 28,
    color: '#999',
    fontWeight: '300',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  modalList: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  modalItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemActive: {
    backgroundColor: '#ffe6e6',
    borderWidth: 2,
    borderColor: '#dc3545',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemTextActive: {
    color: '#dc3545',
    fontWeight: '600',
  },
  modalItemSelected: {
    backgroundColor: '#ffe6e6',
    borderWidth: 2,
    borderColor: '#dc3545',
  },
  modalItemTextSelected: {
    color: '#dc3545',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#dc3545',
    fontWeight: 'bold',
  },
  modalCheckmark: {
    fontSize: 20,
    color: '#dc3545',
    fontWeight: 'bold',
  },
  modalButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dc3545',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  photoButtonSuccess: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
    borderWidth: 2,
  },
  photoButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  photoButtonIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    backgroundColor: '#dc3545',
    width: 36,
    height: 36,
    borderRadius: 18,
    textAlign: 'center',
    lineHeight: 36,
    overflow: 'hidden',
  },
  scanPlacaButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  scanPlacaButtonIcon: {
    fontSize: 24,
  },
  scanPlacaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoButtonText: {
    fontSize: 15,
    color: '#dc3545',
    fontWeight: '600',
  },
  photoSectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  missingPhotoIndicator: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ff6f00',
    fontStyle: 'italic',
  },
  missingPhotosCard: {
    backgroundColor: '#fff8e1',
    borderLeftWidth: 4,
    borderLeftColor: '#ff6f00',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  missingPhotosTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6f00',
    marginBottom: 6,
  },
  missingPhotoItem: {
    fontSize: 13,
    color: '#4a4a4a',
    marginLeft: 4,
    marginTop: 2,
  },
  photoHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    marginTop: -4,
    fontStyle: 'italic',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  photoCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  photoRemoveText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  photoLocationBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 9,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Container dos botões
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  // Botão Pausar (AMARELO/LARANJA)
  pauseButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pauseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Botão Finalizar (VERDE)
  finalizarButton: {
    flex: 2,
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#6b7280',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // ===== NOVOS ESTILOS UX SIMPLIFICADA =====
  // Botão Salvar (principal para nova obra e rascunhos)
  saveButton: {
    backgroundColor: '#10b981', // Verde
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  // Botão Voltar (secundário)
  backButton: {
    backgroundColor: '#f3f4f6', // Cinza claro
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  backButtonText: {
    color: '#374151', // Cinza escuro
    fontSize: 16,
    fontWeight: '600',
  },
  // Botão Adicionar Fotos (para obra existente)
  addPhotosButton: {
    backgroundColor: '#3b82f6', // Azul
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  datePickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dateDisplay: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  dateDisplayText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  dateControl: {
    alignItems: 'center',
  },
  dateControlLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  dateControlButtons: {
    alignItems: 'center',
  },
  dateControlButton: {
    width: 50,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginVertical: 4,
  },
  dateControlButtonText: {
    fontSize: 18,
    color: '#dc3545',
    fontWeight: 'bold',
  },
  dateControlValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    paddingVertical: 8,
    minWidth: 50,
    textAlign: 'center',
  },
  dateQuickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  dateQuickButton: {
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  dateQuickButtonText: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: '600',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countBadge: {
    backgroundColor: '#ff9800',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 14,
    paddingRight: 45,
    fontSize: 15,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchClearButton: {
    position: 'absolute',
    right: 28,
    top: '50%',
    transform: [{ translateY: -6 }],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchClearText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  // Estilos do Transformador
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statusButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#007AFF',
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  statusButtonTextActive: {
    color: '#007AFF',
  },
  // Estilos do Checklist de Fiscalização
  checklistSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  checklistSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  checklistHint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  posteControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  posteCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  posteButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  posteAddButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  posteRemoveButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  posteButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  posteCard: {
    marginTop: 12,
    padding: 18,
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    borderLeftWidth: 5,
    borderLeftColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  posteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 14,
  },
  posteNumeroSection: {
    marginBottom: 16,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  posteNumeroLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  posteNumeroInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  referenciaPostesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  referenciaPosteInput: {
    flex: 1,
  },
  referenciaPostesSeparator: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  posteAditivoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  posteAditivoCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
    marginBottom: 4,
  },
  posteAditivoCheckboxChecked: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  posteAditivoCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  posteAditivoLabel: {
    fontSize: 14,
    color: '#dc2626',
    marginLeft: 10,
    fontWeight: '500',
    flex: 1,
  },
  posteAditivoLabelActive: {
    color: '#dc2626',
    fontWeight: '600',
  },
  posteAddButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  posteTagRemoveAditivo: {
    backgroundColor: '#dc2626',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff6b6b',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  posteStatusSection: {
    marginBottom: 16,
  },
  posteStatusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 10,
  },
  posteStatusButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  posteStatusButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  posteStatusButtonActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 3,
  },
  posteStatusButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  posteStatusButtonTextActive: {
    color: '#78350f',
    fontWeight: '800',
  },
  posteCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  postePhotoSection: {
    marginTop: 12,
  },
  postePhotoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 10,
  },
  photoButtonSmall: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  photoButtonTextSmall: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  seccionamentoCard: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#0ea5e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  seccionamentoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#075985',
    marginBottom: 12,
  },
  // Estilos dos Pontos de Hastes/Termômetros
  pontoFotosContainer: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  pontoFotoSection: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pontoFotoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pontoFotoButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  pontoFotoButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pontoPhotoPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbnailSmall: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  aditivoCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  aditivoCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d97706',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  aditivoCheckboxChecked: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  aditivoCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  aditivoCheckboxLabel: {
    fontSize: 14,
    color: '#78350f',
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },
  posteRemoveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  // Estilos do Documentação
  docHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  docSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  docSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  docSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 8,
    marginTop: 4,
  },
  docButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  docButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  docButtonHalf: {
    flex: 1,
    marginBottom: 0,
  },
  docList: {
    marginTop: 12,
  },
  docItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  docFileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    flex: 1,
    marginLeft: 8,
  },
  docThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  docRemoveButton: {
    backgroundColor: '#ef4444',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docRemoveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  // Estilos do APR (obrigatório)
  aprHint: {
    fontSize: 13,
    color: '#d97706',
    marginBottom: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '600',
  },
  aprSection: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  aprButtonRequired: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  aprWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  aprWarningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  aprWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
  },
  // Modal de visualização de foto
  photoModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalCloseText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  photoModalImage: {
    width: '100%',
    height: '80%',
  },
  photoModalInfoCard: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  photoModalInfoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  photoModalInfoTextSmall: {
    color: '#d1d5db',
    fontSize: 12,
    marginTop: 4,
  },
  // Identificação de Postes (Book de Aterramento, Fundação Especial)
  posteIdentificacaoSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  posteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postePrefixBox: {
    minWidth: 44,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postePrefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  posteAddButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  posteTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  posteTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#bae6fd',
  },
  posteTagText: {
    color: '#0369a1',
    fontWeight: '700',
    fontSize: 14,
    marginRight: 8,
  },
  posteTagRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posteTagRemoveText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  // Estilos para Aditivo em Postes Identificação
  posteTagAditivo: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  posteTagTextAditivo: {
    color: '#dc2626',
  },
  postePrefixBoxAditivo: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  postePrefixTextAditivo: {
    color: '#dc2626',
  },
  // Estilos do Modal de Confirmação de Saída
  exitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exitModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  exitModalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  exitModalIcon: {
    fontSize: 36,
  },
  exitModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  exitModalDescription: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  exitModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  exitModalButtonSave: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exitModalButtonSaveIcon: {
    fontSize: 18,
  },
  exitModalButtonSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  exitModalButtonDiscard: {
    flex: 1,
    backgroundColor: '#fee2e2',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  exitModalButtonDiscardIcon: {
    fontSize: 18,
  },
  exitModalButtonDiscardText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '700',
  },
  exitModalButtonCancel: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    width: '100%',
  },
  exitModalButtonCancelText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});




