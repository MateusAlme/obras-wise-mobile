import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  Image,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';
import { Servico, TipoServico, FotoInfo, StatusServico, SyncStatusServico, SERVICO_PHOTO_MAP } from '../types/servico';
import { getVisiblePhotoCategories, validateServicoCompletion } from '../lib/servico-rules';

// ==================== COLORS & STYLES ====================
const colors = {
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryBorder: '#BFDBFE',
  secondary: '#6C757D',
  success: '#059669',
  successLight: '#ECFDF5',
  successBorder: '#6EE7B7',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  neutral: '#9CA3AF',
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F8FAFC',
  bgTertiary: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  borderLight: '#E2E8F0',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// ==================== SHARED COMPONENTS ====================

/**
 * Status Badge - mostra status visual do servico
 */
interface StatusBadgeProps {
  status: StatusServico;
  size?: 'sm' | 'lg';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'completo':
        return { bg: '#D1FAE5', text: '#065F46', dot: '#059669', label: 'Completo' };
      case 'em_progresso':
        return { bg: '#FEF3C7', text: '#92400E', dot: '#D97706', label: 'Em progresso' };
      case 'rascunho':
        return { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8', label: 'Rascunho' };
      default:
        return { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8', label: status };
    }
  };

  const c = getStatusColor();
  const fontSize = size === 'sm' ? 11 : 13;

  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: c.dot }]} />
      <Text style={[styles.statusBadgeText, { color: c.text, fontSize }]}>
        {c.label}
      </Text>
    </View>
  );
};

/**
 * Sync Status Badge - mostra status de sincronizacao
 */
interface SyncBadgeProps {
  syncStatus: SyncStatusServico;
  size?: number;
}

const SyncBadge: React.FC<SyncBadgeProps> = ({ syncStatus, size = 20 }) => {
  const getIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return { icon: 'checkmark-circle', color: colors.success };
      case 'syncing':
        return { icon: 'time', color: colors.warning };
      case 'error':
        return { icon: 'alert-circle', color: colors.danger };
      case 'offline':
        return { icon: 'cloud-offline', color: colors.warning };
      default:
        return { icon: 'help-circle', color: colors.textTertiary };
    }
  };

  const { icon, color } = getIcon();

  return (
    <Ionicons name={icon as any} size={size} color={color} />
  );
};

// ==================== ObraContainer ====================
/**
 * Card principal da obra com resumo (colapsado)
 */
export interface ObraContainerProps {
  obraId: string;
  obraData: string;
  obraTitle: string;
  responsavel: string;
  equipe: string;
  status: 'em_aberto' | 'rascunho' | 'finalizada';
  servicos: Servico[];
  isExpanded?: boolean;
  onToggleExpand: (obraId: string) => void;
  onAddService: (obraId: string) => void;
}

export const ObraContainer: React.FC<ObraContainerProps> = ({
  obraId,
  obraData,
  obraTitle,
  responsavel,
  equipe,
  status,
  servicos,
  isExpanded = false,
  onToggleExpand,
  onAddService,
}) => {
  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'em_aberto':
        return { bg: '#EFF6FF', text: '#1D4ED8', accent: '#2563EB', label: 'Em Aberto' };
      case 'finalizada':
        return { bg: '#ECFDF5', text: '#065F46', accent: '#059669', label: 'Finalizada' };
      case 'rascunho':
        return { bg: '#F8FAFC', text: '#475569', accent: '#94A3B8', label: 'Rascunho' };
      default:
        return { bg: '#F8FAFC', text: '#475569', accent: '#94A3B8', label: s };
    }
  };

  const sc = getStatusConfig(status);
  const completeCount = servicos.filter((s) => s.status === 'completo').length;
  const errorCount = servicos.filter((s) => s.sync_status === 'error').length;

  return (
    <View style={[styles.obraContainer, { borderTopColor: sc.accent }]}>
      {/* Header touchable */}
      <TouchableOpacity
        style={styles.obraHeader}
        onPress={() => onToggleExpand(obraId)}
        activeOpacity={0.75}
      >
        <View style={styles.obraHeaderContent}>
          {/* Icon + Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color={colors.textTertiary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {obraTitle}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.obraTitle} numberOfLines={1}>
            Obra {obraData}
          </Text>

          {/* Meta info */}
          <Text style={styles.metaText} numberOfLines={1}>
            {responsavel} | {equipe}
          </Text>
        </View>

        {/* Right: status + chevron */}
        <View style={styles.obraHeaderRight}>
          <View style={[styles.statusBadge_, { backgroundColor: sc.bg }]}>
            <View style={[styles.statusDot_, { backgroundColor: sc.accent }]} />
            <Text style={[styles.statusBadgeText_, { color: sc.text }]}>{sc.label}</Text>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>

      {/* Service Pills (visible when collapsed) */}
      {!isExpanded && servicos.length > 0 && (
        <View style={styles.servicePillsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {servicos.map((svc, idx) => {
              const done = svc.status === 'completo';
              return (
                <View key={idx} style={[styles.servicePill, done ? styles.servicePillDone : styles.servicePillPending]}>
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'time-outline'}
                    size={11}
                    color={done ? '#065F46' : '#92400E'}
                  />
                  <Text style={[styles.servicePillText, { color: done ? '#065F46' : '#92400E' }]} numberOfLines={1}>
                    {svc.tipo_servico}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary, { flex: 1 }]}
          onPress={() => onToggleExpand(obraId)}
          activeOpacity={0.8}
        >
          <Ionicons name={isExpanded ? 'chevron-up-circle' : 'chevron-down-circle'} size={18} color="#FFFFFF" />
          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
            {isExpanded ? 'Recolher' : 'Expandir'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary, { flex: 1, marginLeft: spacing.sm }]}
          onPress={() => onAddService(obraId)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={18} color={colors.success} />
          <Text style={[styles.actionButtonText, { color: colors.success }]}>
            + Servico
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats when collapsed */}
      {!isExpanded && servicos.length > 0 && (
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            {completeCount}/{servicos.length} completos
            {errorCount > 0 && ` | ${errorCount} com erro`}
          </Text>
        </View>
      )}
    </View>
  );
};

// ==================== ServiceCard ====================
/**
 * Card do servico (pode estar collapsed ou expanded)
 */
// ==================== Legacy helpers ====================

function hasLegacyData(service: Servico, legacyData?: Record<string, any>): boolean {
  const sources: Array<Record<string, any>> = [service as any];
  if (legacyData) sources.push(legacyData);
  for (const src of sources) {
    if ((src?.checklist_postes_data?.length || 0) > 0) return true;
    if ((src?.checklist_seccionamentos_data?.length || 0) > 0) return true;
    if ((src?.checklist_aterramentos_cerca_data?.length || 0) > 0) return true;
    if ((src?.checklist_hastes_termometros_data?.length || 0) > 0) return true;
    if ((src?.postes_data?.length || 0) > 0) return true;
    for (const [key, val] of Object.entries(src)) {
      if (!Array.isArray(val) || val.length === 0) continue;
      if (key === 'postes_data' || key === 'checklist_postes_data' || key === 'checklist_seccionamentos_data' || key === 'checklist_aterramentos_cerca_data' || key === 'checklist_hastes_termometros_data') {
        continue;
      }
      if (key.startsWith('fotos_') || key.startsWith('doc_')) return true;
      // Compatibilidade legada: algumas versões salvaram arrays de mídia sem prefixo fotos_/doc_
      return true;
    }
  }
  return false;
}

type LegacyMediaSummaryItem = {
  key: string;
  label: string;
  count: number;
  kind: 'foto' | 'arquivo';
};

type LegacyPosteSectionSummary = {
  key: string;
  label: string;
  count: number;
};

type LegacyPosteSummary = {
  key: string;
  title: string;
  status?: string;
  isAditivo: boolean;
  sections: LegacyPosteSectionSummary[];
  total: number;
  requirementDone: number;
  requirementTotal: number;
  missingRequirements: string[];
};

type LegacySimpleSummary = {
  label: string;
  value: string;
};

const LEGACY_MEDIA_LABELS: Record<string, string> = {
  fotos_checklist_croqui: 'Croqui',
  fotos_checklist_panoramica_inicial: 'Panoramica inicial',
  fotos_checklist_panoramica_final: 'Panoramica final',
  fotos_checklist_chede: 'CHEDE',
  fotos_checklist_postes: 'Postes',
  fotos_checklist_seccionamentos: 'Seccionamentos',
  fotos_checklist_aterramento_cerca: 'Aterramento da cerca',
  fotos_checklist_padrao_geral: 'Padrao geral',
  fotos_checklist_padrao_interno: 'Padrao interno',
  fotos_checklist_frying: 'Frying',
  fotos_checklist_abertura_fechamento_pulo: 'Abertura/fechamento pulo',
  fotos_aterramento_vala_aberta: 'Vala aberta',
  fotos_aterramento_hastes: 'Hastes instaladas',
  fotos_aterramento_vala_fechada: 'Vala fechada',
  fotos_aterramento_medicao: 'Medicao',
  fotos_transformador_laudo: 'Laudo transformador',
  fotos_transformador_componente_instalado: 'Componente instalado',
  fotos_transformador_tombamento_instalado: 'Tombamento instalado',
  fotos_transformador_tape: 'Tape',
  fotos_transformador_placa_instalado: 'Placa instalada',
  fotos_transformador_instalado: 'Transformador instalado',
  fotos_transformador_conexoes_primarias_instalado: 'Conexoes primarias instaladas',
  fotos_transformador_conexoes_secundarias_instalado: 'Conexoes secundarias instaladas',
  fotos_transformador_antes_retirar: 'Antes de retirar',
  fotos_transformador_laudo_retirado: 'Laudo retirado',
  fotos_transformador_tombamento_retirado: 'Tombamento retirado',
  fotos_transformador_placa_retirado: 'Placa retirada',
  fotos_transformador_conexoes_primarias_retirado: 'Conexoes primarias retiradas',
  fotos_transformador_conexoes_secundarias_retirado: 'Conexoes secundarias retiradas',
  fotos_vazamento_evidencia: 'Evidencia de vazamento',
  fotos_vazamento_equipamentos_limpeza: 'Equipamentos de limpeza',
  fotos_vazamento_tombamento_retirado: 'Vazamento tombamento retirado',
  fotos_vazamento_placa_retirado: 'Vazamento placa retirada',
  fotos_vazamento_tombamento_instalado: 'Vazamento tombamento instalado',
  fotos_vazamento_placa_instalado: 'Vazamento placa instalada',
  fotos_vazamento_instalacao: 'Instalacao do transformador',
  fotos_medidor_padrao: 'Padrao com medidor',
  fotos_medidor_leitura: 'Leitura com medidor',
  fotos_medidor_selo_born: 'Selo do born',
  fotos_medidor_selo_caixa: 'Selo da caixa',
  fotos_medidor_identificador_fase: 'Identificador de fase',
  doc_cadastro_medidor: 'Cadastro de medidor',
  doc_laudo_transformador: 'Laudo de transformador',
  doc_laudo_regulador: 'Laudo de regulador',
  doc_laudo_religador: 'Laudo de religador',
  doc_autorizacao_passagem: 'Autorizacao de passagem',
  doc_materiais_previsto: 'Materiais previsto',
  doc_materiais_realizado: 'Materiais realizado',
  doc_apr: 'APR',
  doc_fvbt: 'FVBT',
  doc_termo_desistencia_lpt: 'Termo de desistencia LPT',
  fotos_antes: 'Antes',
  fotos_durante: 'Durante',
  fotos_depois: 'Depois',
};

const LEGACY_POSTE_SECTION_LABELS: Record<string, string> = {
  posteInteiro: 'Poste foto inteiro',
  descricao: 'Descricao',
  engaste: 'Engaste',
  conexao1: 'Conexao 1',
  conexao2: 'Conexao 2',
  maiorEsforco: 'Maior esforco',
  menorEsforco: 'Menor esforco',
  fotoHaste: 'Foto haste',
  fotoTermometro: 'Foto termometro',
  fotos_medicao: 'Medicao',
  fotos_antes: 'Antes',
  fotos_durante: 'Durante',
  fotos_depois: 'Depois',
  fotos: 'Fotos',
};

const LEGACY_POSTE_REQUIREMENTS: Record<string, Array<{ field: string; label: string; min: number }>> = {
  instalado: [
    { field: 'posteInteiro', label: 'Poste foto inteiro', min: 1 },
    { field: 'descricao', label: 'Descricao', min: 1 },
    { field: 'engaste', label: 'Engaste', min: 1 },
    { field: 'conexao1', label: 'Conexao 1', min: 1 },
    { field: 'conexao2', label: 'Conexao 2', min: 1 },
    { field: 'maiorEsforco', label: 'Maior esforco', min: 2 },
    { field: 'menorEsforco', label: 'Menor esforco', min: 2 },
  ],
  retirado: [
    { field: 'posteInteiro', label: 'Poste foto inteiro', min: 2 },
  ],
  existente: [
    { field: 'posteInteiro', label: 'Poste foto inteiro', min: 1 },
    { field: 'conexao1', label: 'Conexao 1', min: 1 },
    { field: 'conexao2', label: 'Conexao 2', min: 1 },
  ],
};

const CHECKLIST_TIPO = 'Checklist de Fiscalização';

// Serviços que usam a tela genérica de postes (postes-registro) em vez de fotos flat
const SERVICOS_COM_POSTES_UI = new Set(['Cava em Rocha', 'Linha Viva', 'Book de Aterramento', 'Fundação Especial']);

// Todos os serviços com tela dedicada (postes + transformador + checklist)
const SERVICOS_COM_TELA_PROPRIA = new Set([...Array.from(SERVICOS_COM_POSTES_UI), 'Transformador', CHECKLIST_TIPO]);

const getRelevantLegacyPhotoFields = (tipoServico?: string): Set<string> | null => {
  if (!tipoServico) return null;
  const mapped = SERVICO_PHOTO_MAP[tipoServico as TipoServico] || [];
  const fields = new Set(mapped.map((item) => String(item.field)));
  if (tipoServico === 'Transformador') {
    fields.add('doc_laudo_transformador');
  }
  if (!fields.size) return null;
  return fields;
};

const hasRelevantLegacyDataByServiceType = (source: Record<string, any>, tipoServico?: string): boolean => {
  if (!source || typeof source !== 'object') return false;

  const relevantFields = getRelevantLegacyPhotoFields(tipoServico);
  if (relevantFields) {
    for (const field of relevantFields) {
      const value = source[field];
      if (Array.isArray(value) && value.length > 0) return true;
    }
  }

  if ((source?.postes_data?.length || 0) > 0) return true;
  if ((source?.checklist_postes_data?.length || 0) > 0) return true;
  if ((source?.checklist_seccionamentos_data?.length || 0) > 0) return true;
  if ((source?.checklist_aterramentos_cerca_data?.length || 0) > 0) return true;
  if ((source?.checklist_hastes_termometros_data?.length || 0) > 0) return true;

  return false;
};

const getArrayCount = (value: unknown): number => {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => item !== null && item !== undefined).length;
};

const getLegacyArrayRichness = (value: unknown): number => {
  if (!Array.isArray(value) || value.length === 0) return 0;
  return value.reduce<number>((score, item) => {
    if (item === null || item === undefined) return score;
    if (typeof item === 'string') {
      const isUriLike =
        item.startsWith('http://') ||
        item.startsWith('https://') ||
        item.startsWith('file://') ||
        item.startsWith('content://') ||
        item.startsWith('/');
      return score + (isUriLike ? 4 : 2);
    }
    if (typeof item === 'object') {
      const obj = item as Record<string, any>;
      const hasUrl = typeof obj.url === 'string' && obj.url.length > 0;
      const hasUri = typeof obj.uri === 'string' && obj.uri.length > 0;
      const hasId = typeof obj.id === 'string' && obj.id.length > 0;
      return score + (hasUrl ? 4 : 0) + (hasUri ? 3 : 0) + (hasId ? 2 : 1);
    }
    return score + 1;
  }, 0);
};

const pickRicherLegacyArray = (serviceValue: unknown, legacyValue: unknown): unknown => {
  const serviceArray = Array.isArray(serviceValue) ? serviceValue : [];
  const legacyArray = Array.isArray(legacyValue) ? legacyValue : [];
  if (serviceArray.length === 0) return legacyValue;
  if (legacyArray.length === 0) return serviceValue;

  if (legacyArray.length !== serviceArray.length) {
    return legacyArray.length > serviceArray.length ? legacyValue : serviceValue;
  }

  const legacyScore = getLegacyArrayRichness(legacyArray);
  const serviceScore = getLegacyArrayRichness(serviceArray);
  return legacyScore >= serviceScore ? legacyValue : serviceValue;
};

const mergeLegacySummarySource = (service: Servico, legacyData?: Record<string, any>): Record<string, any> => {
  const serviceSource = (service || {}) as Record<string, any>;
  const legacySource = (legacyData || {}) as Record<string, any>;
  const merged: Record<string, any> = { ...serviceSource, ...legacySource };

  const keys = new Set([...Object.keys(serviceSource), ...Object.keys(legacySource)]);
  keys.forEach((key) => {
    const serviceValue = serviceSource[key];
    const legacyValue = legacySource[key];

    if (Array.isArray(serviceValue) || Array.isArray(legacyValue)) {
      merged[key] = pickRicherLegacyArray(serviceValue, legacyValue);
      return;
    }

    if (key === 'dados_adicionais') {
      const serviceObj = serviceValue && typeof serviceValue === 'object' ? serviceValue : {};
      const legacyObj = legacyValue && typeof legacyValue === 'object' ? legacyValue : {};
      const mergedObj = { ...serviceObj, ...legacyObj } as Record<string, any>;

      if (Array.isArray(serviceObj.pontos_referencia) || Array.isArray(legacyObj.pontos_referencia)) {
        mergedObj.pontos_referencia = pickRicherLegacyArray(serviceObj.pontos_referencia, legacyObj.pontos_referencia);
      }
      merged[key] = mergedObj;
      return;
    }

    if (legacyValue === undefined || legacyValue === null || legacyValue === '') {
      merged[key] = serviceValue;
      return;
    }
    if (serviceValue === undefined || serviceValue === null || serviceValue === '') {
      merged[key] = legacyValue;
      return;
    }
    merged[key] = legacyValue;
  });

  return merged;
};

const humanizeLegacyField = (field: string): string => {
  const cleaned = field.replace(/^fotos_/, '').replace(/^doc_/, '');
  return cleaned
    .split('_')
    .filter(Boolean)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(' ');
};

const formatLegacyPosteStatus = (value: unknown): string | undefined => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'instalado') return 'Instalado';
  if (raw === 'retirado') return 'Retirado';
  if (raw === 'existente') return 'Existente';
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
};

const isLegacyStructuredField = (key: string): boolean => {
  return (
    key === 'postes_data' ||
    key === 'checklist_postes_data' ||
    key === 'checklist_seccionamentos_data' ||
    key === 'checklist_aterramentos_cerca_data' ||
    key === 'checklist_hastes_termometros_data' ||
    key === 'dados_adicionais'
  );
};

const isLikelyLegacyMediaArray = (key: string, value: unknown): boolean => {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (isLegacyStructuredField(key)) return false;
  if (key.startsWith('fotos_') || key.startsWith('doc_')) return true;

  // Compatibilidade legada: aceita array de strings/objetos quando não é campo estruturado.
  return value.some((item) => {
    if (typeof item === 'string') return item.trim().length > 0;
    if (!item || typeof item !== 'object') return false;
    const obj = item as Record<string, any>;
    return Boolean(obj.id || obj.url || obj.uri || obj.photoId);
  });
};

const collectLegacyMediaSummary = (
  source: Record<string, any>,
  tipoServico?: string,
  options?: { hideChecklistPostesFlat?: boolean }
): LegacyMediaSummaryItem[] => {
  const allowedFields = getRelevantLegacyPhotoFields(tipoServico);
  return Object.entries(source)
    .filter(([key, value]) => {
      const isExplicitField = key.startsWith('fotos_') || key.startsWith('doc_');
      const isCompatibleLegacyMedia = isLikelyLegacyMediaArray(key, value);
      if (!isExplicitField && !isCompatibleLegacyMedia) return false;
      if (allowedFields && isExplicitField && !allowedFields.has(key)) return false;
      if (options?.hideChecklistPostesFlat && key === 'fotos_checklist_postes') return false;
      return true;
    })
    .map(([key, value]) => ({
      key,
      label: LEGACY_MEDIA_LABELS[key] || humanizeLegacyField(key),
      count: getArrayCount(value),
      kind: key.startsWith('doc_') ? ('arquivo' as const) : ('foto' as const),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
};

const collectLegacyPostesSummary = (source: Record<string, any>, tipoServico?: string): LegacyPosteSummary[] => {
  const isChecklist = tipoServico === CHECKLIST_TIPO;
  const checklist = isChecklist && Array.isArray(source?.checklist_postes_data) ? source.checklist_postes_data : [];
  const generic = Array.isArray(source?.postes_data) ? source.postes_data : [];
  const postes = isChecklist ? checklist : generic;

  return postes
    .map((poste: any, index: number) => {
      const numberText = String(poste?.numero ?? index + 1);
      const isAditivo = poste?.isAditivo === true || String(poste?.id || '').toUpperCase().startsWith('AD-P');
      const prefix = isAditivo ? 'AD-P' : 'P';
      const status = formatLegacyPosteStatus(poste?.status);
      const statusKey = String(poste?.status || '').trim().toLowerCase();
      const requirements = isChecklist ? (LEGACY_POSTE_REQUIREMENTS[statusKey] || []) : [];

      const sections = Object.entries(LEGACY_POSTE_SECTION_LABELS)
        .map(([field, label]) => ({
          key: field,
          label,
          count: getArrayCount(poste?.[field]),
        }))
        .filter((section) => section.count > 0);

      const total = sections.reduce((acc, section) => acc + section.count, 0);
      const requirementDone = requirements.filter((req) => getArrayCount(poste?.[req.field]) >= req.min).length;
      const requirementTotal = requirements.length;
      const missingRequirements = requirements
        .filter((req) => getArrayCount(poste?.[req.field]) < req.min)
        .map((req) => `${req.label} (${getArrayCount(poste?.[req.field])}/${req.min})`);

      return {
        key: String(poste?.id || `${prefix}${numberText}`),
        title: `${prefix}${numberText}`,
        status,
        isAditivo,
        sections,
        total,
        requirementDone,
        requirementTotal,
        missingRequirements,
      };
    })
    .filter((poste) => poste.total > 0 || !!poste.status || poste.missingRequirements.length > 0);
};

const collectLegacySimpleSummary = (source: Record<string, any>, tipoServico?: string): LegacySimpleSummary[] => {
  const result: LegacySimpleSummary[] = [];
  const dados = source?.dados_adicionais && typeof source.dados_adicionais === 'object'
    ? source.dados_adicionais as Record<string, any>
    : null;

  const transformadorModoRaw = dados?.transformador_modo || source?.transformador_status;
  if (tipoServico === 'Transformador' && transformadorModoRaw) {
    const normalized = String(transformadorModoRaw).trim().toLowerCase();
    const value =
      normalized === 'instalado' ? 'Instalado' :
      normalized === 'retirado' ? 'Retirado' :
      normalized === 'ambos' ? 'Ambos' :
      String(transformadorModoRaw);
    result.push({ label: 'Modo do transformador', value });
  }

  if (dados?.identificador_item) {
    result.push({ label: 'Identificador', value: String(dados.identificador_item) });
  }

  if (dados?.referencia_poste_inicio || dados?.referencia_poste_fim) {
    const inicio = String(dados?.referencia_poste_inicio || '-');
    const fim = String(dados?.referencia_poste_fim || '-');
    result.push({ label: 'Referencia de poste', value: `${inicio} -> ${fim}` });
  }

  if (Array.isArray(dados?.pontos_referencia) && dados.pontos_referencia.length > 0) {
    result.push({ label: 'Pontos de referencia', value: `${dados.pontos_referencia.length}` });
  }

  if (typeof dados?.observacao === 'string' && dados.observacao.trim().length > 0) {
    const text = dados.observacao.trim();
    result.push({
      label: 'Observacao',
      value: text.length > 80 ? `${text.slice(0, 80)}...` : text,
    });
  }

  return result;
};

const formatLegacyItemCount = (item: LegacyMediaSummaryItem): string => {
  if (item.count === 1) {
    return item.kind === 'arquivo' ? '1 arquivo' : '1 foto';
  }
  return item.kind === 'arquivo' ? `${item.count} arquivos` : `${item.count} fotos`;
};

// ==================== ServiceCard ====================

export interface ServiceCardProps {
  service: Servico;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCapturePhoto: (servicoId: string, category: keyof Servico) => void;
  onMarkComplete: (servicoId: string) => void;
  onOpenDetails?: () => void;
  onPhotoViewer?: (photo: FotoInfo) => void;
  usesLegacyFlow?: boolean;
  legacyData?: Record<string, any>;
}

const isRenderablePhotoRef = (value: unknown): value is string => {
  return typeof value === 'string' && (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('content://') ||
    value.startsWith('/')
  );
};

const getRenderablePhotoCount = (items: unknown[]): number => {
  return items.reduce<number>((total, item) => {
    if (!item) return total;
    if (typeof item === 'string') return total + (isRenderablePhotoRef(item) ? 1 : 0);
    if (typeof item === 'object') {
      const photo = item as FotoInfo;
      if (isRenderablePhotoRef(photo.url) || isRenderablePhotoRef(photo.uri)) return total + 1;
    }
    return total;
  }, 0);
};

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  isExpanded,
  onToggleExpand,
  onCapturePhoto,
  onMarkComplete,
  onOpenDetails,
  onPhotoViewer,
  usesLegacyFlow,
  legacyData,
}) => {
  const categories = getVisiblePhotoCategories(service);
  const validation = validateServicoCompletion(service);
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);
  const pendingRequiredCount = validation.missingRules.length + validation.configErrors.length;
  const categoriesWithPhotos = categories.filter((category) => {
    const photos = (service[category.field] || []) as unknown[];
    return getRenderablePhotoCount(photos) > 0;
  });
  const categoriesWithoutPhotos = categories.filter((category) => {
    const photos = (service[category.field] || []) as unknown[];
    return getRenderablePhotoCount(photos) === 0;
  });

  const accentColor = service.status === 'completo' ? '#059669' : service.status === 'em_progresso' ? '#D97706' : '#CBD5E1';

  const isLegacyFlow = service.id.startsWith('legacy-') || !!usesLegacyFlow;
  const summarySource = useMemo(
    () => mergeLegacySummarySource(service, legacyData),
    [service, legacyData]
  );
  const dataExists = isLegacyFlow && (
    hasLegacyData(summarySource as Servico) ||
    hasRelevantLegacyDataByServiceType(summarySource, service.tipo_servico)
  );
  const legacyPostesSummary = useMemo(
    () => (isLegacyFlow && dataExists ? collectLegacyPostesSummary(summarySource, service.tipo_servico) : []),
    [dataExists, isLegacyFlow, service.tipo_servico, summarySource]
  );
  const legacyMediaSummary = useMemo(
    () => (isLegacyFlow && dataExists
      ? collectLegacyMediaSummary(summarySource, service.tipo_servico, { hideChecklistPostesFlat: legacyPostesSummary.length > 0 })
      : []),
    [dataExists, isLegacyFlow, legacyPostesSummary.length, service.tipo_servico, summarySource]
  );
  const legacySimpleSummary = useMemo(
    () => (isLegacyFlow && dataExists ? collectLegacySimpleSummary(summarySource, service.tipo_servico) : []),
    [dataExists, isLegacyFlow, service.tipo_servico, summarySource]
  );
  const createdAtLabel = useMemo(() => {
    const rawCreatedAt = String(service.created_at || '').trim();
    if (!rawCreatedAt) return '';

    // Alguns registros antigos chegam sem timezone (ex.: "2026-04-27T22:27:00").
    // Nesses casos, o valor representa UTC e precisa do sufixo "Z" para não aparecer +3h.
    const withT = rawCreatedAt.includes(' ') ? rawCreatedAt.replace(' ', 'T') : rawCreatedAt;
    const hasExplicitTimezone = /([zZ]|[+\-]\d{2}:?\d{2})$/.test(withT);
    const normalized = hasExplicitTimezone ? withT : `${withT}Z`;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return String(service.created_at || '');
    const datePart = parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
    const timePart = parsed.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Fortaleza',
    });
    return `${datePart} ${timePart}`;
  }, [service.created_at]);

  return (
    <View style={[styles.serviceCard, { borderLeftColor: accentColor }]}>
      {/* Header */}
      <TouchableOpacity style={[styles.serviceHeader, isExpanded && styles.serviceHeaderExpanded]} onPress={onToggleExpand} activeOpacity={0.75}>
        <View style={styles.serviceHeaderLeft}>
          <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textTertiary} />

          <View style={{ flex: 1 }}>
            <Text style={styles.serviceTitle} numberOfLines={1}>
              {service.tipo_servico}
            </Text>
            <Text style={styles.serviceMetaText}>
              {service.responsavel} | {createdAtLabel}
            </Text>
          </View>
        </View>

        <View style={styles.serviceHeaderRight}>
          <StatusBadge status={service.status} size="sm" />
          <SyncBadge syncStatus={service.sync_status} size={16} />
        </View>
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.serviceExpandedContent}>

          {/* ── LEGACY FLOW: sem dados ainda ── */}
          {isLegacyFlow && !dataExists && (
            <View style={styles.legacyEmptyState}>
              <Ionicons name="document-text-outline" size={36} color="#94A3B8" />
              <Text style={styles.legacyEmptyTitle}>Formulário completo</Text>
              <Text style={styles.legacyEmptySubtitle}>
                Os postes, fotos e dados deste serviço são registrados no formulário original. Toque para iniciar.
              </Text>
              {onOpenDetails && (
                <TouchableOpacity style={styles.legacyOpenBtn} onPress={onOpenDetails}>
                  <Ionicons name="open-outline" size={16} color="#fff" />
                  <Text style={styles.legacyOpenBtnText}>Abrir formulário</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── LEGACY FLOW: resumo após salvar parcial ── */}
          {isLegacyFlow && dataExists && (
            <View style={styles.legacySummary}>
              <Text style={styles.legacySummaryTitle}>Resumo registrado</Text>

              {/* Midias com registro */}
              {legacyMediaSummary.length > 0 && (
                <View style={styles.summaryGroup}>
                  <Text style={styles.summaryGroupLabel}>Formulario preenchido</Text>
                  {legacyMediaSummary.map((item) => (
                    <View key={item.key} style={[styles.summaryRow, styles.summaryRowDone]}>
                      <Text style={[styles.summaryRowLabel, styles.summaryRowLabelDone]}>{item.label}</Text>
                      <Text style={[styles.summaryRowValue, styles.summaryRowValueDone]}>{formatLegacyItemCount(item)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Estrutura de postes */}
              {legacyPostesSummary.length > 0 && (
                <View style={styles.summaryGroup}>
                  <Text style={styles.summaryGroupLabel}>Postes - {legacyPostesSummary.length}</Text>
                  {legacyPostesSummary.map((poste) => (
                    <View key={poste.key} style={styles.posteSummaryCard}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryRowLabel}>
                          {poste.title}
                        </Text>
                        <Text style={styles.summaryRowValue}>{poste.total} fotos</Text>
                      </View>
                      <View style={styles.posteMetaRow}>
                        <Text style={styles.posteMetaText}>
                          Status: {poste.status || 'Nao informado'}
                        </Text>
                        {poste.isAditivo && (
                          <View style={styles.posteAditivoBadge}>
                            <Text style={styles.posteAditivoBadgeText}>Aditivo</Text>
                          </View>
                        )}
                      </View>
                      {poste.requirementTotal > 0 && (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryRowLabel}>Obrigatorios</Text>
                          <Text style={styles.summaryRowValue}>
                            {poste.requirementDone}/{poste.requirementTotal}
                          </Text>
                        </View>
                      )}
                      {poste.missingRequirements.length > 0 && (
                        <Text style={styles.posteMissingText}>
                          Faltando: {poste.missingRequirements.join(', ')}
                        </Text>
                      )}
                      {poste.sections.map((section) => (
                        <View key={`${poste.key}-${section.key}`} style={[styles.summarySubRow, styles.summarySubRowDone]}>
                          <Text style={[styles.summarySubLabel, styles.summarySubLabelDone]}>{section.label}</Text>
                          <Text style={[styles.summarySubValue, styles.summarySubValueDone]}>
                            {section.count === 1 ? '1 foto' : `${section.count} fotos`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Estruturas auxiliares */}
              {service.tipo_servico === CHECKLIST_TIPO && (summarySource.checklist_seccionamentos_data?.length || 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Seccionamentos registrados</Text>
                  <Text style={styles.summaryRowValue}>{summarySource.checklist_seccionamentos_data.length}</Text>
                </View>
              )}
              {service.tipo_servico === CHECKLIST_TIPO && (summarySource.checklist_aterramentos_cerca_data?.length || 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Aterramentos de cerca</Text>
                  <Text style={styles.summaryRowValue}>{summarySource.checklist_aterramentos_cerca_data.length}</Text>
                </View>
              )}
              {service.tipo_servico === CHECKLIST_TIPO && (summarySource.checklist_hastes_termometros_data?.length || 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Hastes/termometros</Text>
                  <Text style={styles.summaryRowValue}>{summarySource.checklist_hastes_termometros_data.length}</Text>
                </View>
              )}

              {/* Dados adicionais */}
              {legacySimpleSummary.length > 0 && (
                <View style={styles.summaryGroup}>
                  <Text style={styles.summaryGroupLabel}>Dados do servico</Text>
                  {legacySimpleSummary.map((row) => (
                    <View key={row.label} style={styles.summaryRow}>
                      <Text style={styles.summaryRowLabel}>{row.label}</Text>
                      <Text style={styles.summaryRowValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              )}

              {legacyMediaSummary.length === 0 &&
                legacyPostesSummary.length === 0 &&
                legacySimpleSummary.length === 0 && (
                  <Text style={styles.legacyEmptySubtitle}>
                    Sem detalhes resumíveis neste card. Toque em "Editar no formulário" para visualizar os registros completos.
                  </Text>
                )}

              {/* Ações */}
              <View style={styles.legacySummaryActions}>
                {service.status !== 'completo' && (
                  <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={() => onMarkComplete(service.id)}>
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                    <Text style={styles.primaryBtnText}>Marcar Completo</Text>
                  </TouchableOpacity>
                )}
                {onOpenDetails && (
                  <TouchableOpacity style={[styles.actionBtn, styles.legacyBtn]} onPress={onOpenDetails}>
                    <Ionicons name="create-outline" size={16} color="#1D4ED8" />
                    <Text style={styles.legacyBtnText}>Editar no formulário</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── FLUXO NORMAL (não-legado) ── */}
          {!isLegacyFlow && (
            <>
              {/* Photos section */}
              <View style={styles.photosSection}>
                <Text style={styles.sectionTitle}>Fotos do servico</Text>

                {pendingRequiredCount > 0 && (
                  <Text style={styles.requiredPendingText}>
                    Pendencias obrigatorias: {pendingRequiredCount}
                  </Text>
                )}
                {validation.configErrors.length > 0 && (
                  <View style={styles.ruleWarningBanner}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                    <Text style={styles.ruleWarningText}>{validation.configErrors[0]}</Text>
                  </View>
                )}

                {categoriesWithPhotos.length > 0 && categoriesWithPhotos.map((category, idx) => {
                  const photos = (service[category.field] || []) as unknown[];
                  const photoCount = getRenderablePhotoCount(photos);
                  return (
                    <PhotoCategoryTile
                      key={idx}
                      label={category.label}
                      count={photoCount}
                      photos={photos as FotoInfo[]}
                      onAddPhoto={() => onCapturePhoto(service.id, category.field)}
                    />
                  );
                })}

                {categoriesWithoutPhotos.length > 0 && (
                  <View style={styles.pendingCategoriesBox}>
                    <TouchableOpacity style={styles.pendingCategoriesHeader} onPress={() => setShowEmptyCategories(!showEmptyCategories)}>
                      <Text style={styles.pendingCategoriesTitle}>
                        {showEmptyCategories ? 'Ocultar pendencias' : 'Mostrar pendencias'} ({categoriesWithoutPhotos.length})
                      </Text>
                      <Ionicons
                        name={showEmptyCategories ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>

                    {showEmptyCategories && categoriesWithoutPhotos.map((category, idx) => (
                      <PhotoCategoryTile
                        key={`pending-${idx}`}
                        label={category.label}
                        count={0}
                        photos={[]}
                        onAddPhoto={() => onCapturePhoto(service.id, category.field)}
                      />
                    ))}
                  </View>
                )}

                {categories.length === 0 && !SERVICOS_COM_TELA_PROPRIA.has(service.tipo_servico) && (
                  <Text style={styles.photoEmptyCollapsed}>Sem categorias de foto para este tipo de servico</Text>
                )}

                {categories.length === 0 && SERVICOS_COM_POSTES_UI.has(service.tipo_servico) && (() => {
                  const postesData = Array.isArray((service as any).postes_data) ? (service as any).postes_data : [];
                  const totalFotos = postesData.reduce((acc: number, p: any) => {
                    return acc +
                      (Array.isArray(p.fotos_antes) ? p.fotos_antes.length : 0) +
                      (Array.isArray(p.fotos_durante) ? p.fotos_durante.length : 0) +
                      (Array.isArray(p.fotos_depois) ? p.fotos_depois.length : 0);
                  }, 0);
                  return (
                    <View style={styles.postesPromptBox}>
                      <Ionicons name="hammer-outline" size={28} color="#DC2626" />
                      <Text style={styles.postesPromptTitle}>
                        {postesData.length > 0
                          ? `${postesData.length} ponto${postesData.length !== 1 ? 's' : ''} · ${totalFotos} foto${totalFotos !== 1 ? 's' : ''}`
                          : 'Nenhum ponto registrado'}
                      </Text>
                      <Text style={styles.postesPromptText}>
                        {postesData.length > 0
                          ? 'Toque em "Registrar Pontos" para visualizar ou editar.'
                          : 'Toque em "Registrar Pontos" para adicionar postes com fotos Antes, Durante e Depois.'}
                      </Text>
                    </View>
                  );
                })()}

                {categories.length === 0 && service.tipo_servico === 'Transformador' && (() => {
                  const modoStr = (service as any).dados_adicionais?.transformador_modo as string | undefined;
                  const trFields = [
                    'fotos_transformador_laudo',
                    'fotos_transformador_componente_instalado', 'fotos_transformador_tombamento_instalado',
                    'fotos_transformador_tape', 'fotos_transformador_placa_instalado',
                    'fotos_transformador_instalado', 'fotos_transformador_conexoes_primarias_instalado',
                    'fotos_transformador_conexoes_secundarias_instalado',
                    'fotos_transformador_antes_retirar', 'fotos_transformador_laudo_retirado',
                    'fotos_transformador_tombamento_retirado', 'fotos_transformador_placa_retirado',
                    'fotos_transformador_conexoes_primarias_retirado',
                    'fotos_transformador_conexoes_secundarias_retirado',
                  ];
                  const totalFotos = trFields.reduce((acc, f) =>
                    acc + (Array.isArray((service as any)[f]) ? (service as any)[f].length : 0), 0);
                  const modoLabel = modoStr === 'instalado' ? 'Instalado' : modoStr === 'retirado' ? 'Retirado' : null;
                  return (
                    <View style={styles.postesPromptBox}>
                      <Ionicons name="construct-outline" size={28} color="#DC2626" />
                      <Text style={styles.postesPromptTitle}>
                        {modoLabel ? `Modo: ${modoLabel} · ${totalFotos} foto${totalFotos !== 1 ? 's' : ''}` : 'Modo não selecionado'}
                      </Text>
                      <Text style={styles.postesPromptText}>
                        {modoLabel
                          ? 'Toque em "Registrar Fotos" para visualizar ou editar.'
                          : 'Toque em "Registrar Fotos" para selecionar o modo e registrar.'}
                      </Text>
                    </View>
                  );
                })()}

                {categories.length === 0 && service.tipo_servico === CHECKLIST_TIPO && (() => {
                  const postes = Array.isArray((service as any).checklist_postes_data) ? (service as any).checklist_postes_data : [];
                  const seccionamentos = Array.isArray((service as any).checklist_seccionamentos_data) ? (service as any).checklist_seccionamentos_data : [];
                  const aterramentos = Array.isArray((service as any).checklist_aterramentos_cerca_data) ? (service as any).checklist_aterramentos_cerca_data : [];
                  const hastes = Array.isArray((service as any).checklist_hastes_termometros_data) ? (service as any).checklist_hastes_termometros_data : [];
                  const simpleFields = [
                    'fotos_checklist_croqui',
                    'fotos_checklist_panoramica_inicial',
                    'fotos_checklist_chede',
                    'fotos_checklist_padrao_geral',
                    'fotos_checklist_padrao_interno',
                    'fotos_checklist_frying',
                    'fotos_checklist_abertura_fechamento_pulo',
                    'fotos_checklist_panoramica_final',
                  ];
                  const simpleCount = simpleFields.reduce((acc, field) => (
                    acc + (Array.isArray((service as any)[field]) ? (service as any)[field].length : 0)
                  ), 0);
                  const totalEstruturado =
                    postes.length + seccionamentos.length + aterramentos.length + hastes.length;

                  return (
                    <View style={styles.postesPromptBox}>
                      <Ionicons name="clipboard-outline" size={28} color="#DC2626" />
                      <Text style={styles.postesPromptTitle}>
                        {totalEstruturado > 0 || simpleCount > 0
                          ? `${postes.length} postes · ${seccionamentos.length} secc. · ${aterramentos.length} aterr.`
                          : 'Checklist sem registros'}
                      </Text>
                      <Text style={styles.postesPromptText}>
                        {totalEstruturado > 0 || simpleCount > 0
                          ? 'Toque em "Registrar Checklist" para visualizar ou editar.'
                          : 'Toque em "Registrar Checklist" para iniciar os itens e fotos.'}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* Actions */}
              <View style={styles.serviceActions}>
                {service.status !== 'completo' && !SERVICOS_COM_TELA_PROPRIA.has(service.tipo_servico) && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.primaryBtn]}
                    onPress={() => onMarkComplete(service.id)}
                  >
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                    <Text style={styles.primaryBtnText}>Marcar Completo</Text>
                  </TouchableOpacity>
                )}
                {onOpenDetails && (
                  <TouchableOpacity
                    style={[styles.actionBtn, SERVICOS_COM_TELA_PROPRIA.has(service.tipo_servico) ? styles.cavaRochaBtn : styles.detailsBtn]}
                    onPress={onOpenDetails}
                  >
                    <Ionicons
                      name={SERVICOS_COM_TELA_PROPRIA.has(service.tipo_servico) ? 'camera' : 'create-outline'}
                      size={16}
                      color={SERVICOS_COM_TELA_PROPRIA.has(service.tipo_servico) ? '#fff' : colors.textSecondary}
                    />
                    <Text style={SERVICOS_COM_TELA_PROPRIA.has(service.tipo_servico) ? styles.cavaRochaBtnText : styles.detailsBtnText}>
                      {service.tipo_servico === 'Transformador'
                        ? 'Registrar Fotos'
                        : service.tipo_servico === CHECKLIST_TIPO
                          ? 'Registrar Checklist'
                        : SERVICOS_COM_POSTES_UI.has(service.tipo_servico)
                          ? 'Registrar Pontos'
                          : 'Detalhes'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Error / warning message: erro de sync (vermelho) ou fotos perdidas após sync (amarelo) */}
          {service.error_message && (
            <View style={service.sync_status === 'error' ? styles.errorBanner : styles.warningBanner}>
              <Ionicons
                name="alert-circle"
                size={16}
                color={service.sync_status === 'error' ? colors.danger : colors.warning}
              />
              <Text style={service.sync_status === 'error' ? styles.errorBannerText : styles.warningBannerText}>
                {service.error_message}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ==================== PhotoViewerModal ====================
interface PhotoViewerModalProps {
  photos: FotoInfo[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({ photos, initialIndex, visible, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentIndexRef = useRef(initialIndex);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const scaleVal = useRef(1);
  const baseTx = useRef(0);
  const baseTy = useRef(0);
  const initDist = useRef(0);
  const lastTap = useRef(0);

  const resetTransform = useCallback(() => {
    scaleVal.current = 1;
    baseTx.current = 0;
    baseTy.current = 0;
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (visible) {
      currentIndexRef.current = initialIndex;
      setCurrentIndex(initialIndex);
      resetTransform();
    }
  }, [visible, initialIndex, resetTransform]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,

      onPanResponderGrant: (evt) => {
        const now = Date.now();
        if (evt.nativeEvent.touches.length === 1 && now - lastTap.current < 280) {
          lastTap.current = 0;
          if (scaleVal.current > 1.1) {
            resetTransform();
          } else {
            scaleVal.current = 2.5;
            Animated.spring(scale, { toValue: 2.5, useNativeDriver: true }).start();
          }
          return;
        }
        lastTap.current = now;
        initDist.current = 0;
      },

      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const dx = touches[1].pageX - touches[0].pageX;
          const dy = touches[1].pageY - touches[0].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (initDist.current === 0) {
            initDist.current = dist;
          } else {
            const newScale = Math.max(1, Math.min(5, scaleVal.current * (dist / initDist.current)));
            scale.setValue(newScale);
            scaleVal.current = newScale;
            initDist.current = dist;
          }
        } else if (scaleVal.current > 1.05) {
          translateX.setValue(baseTx.current + gs.dx);
          translateY.setValue(baseTy.current + gs.dy);
        }
      },

      onPanResponderRelease: (_, gs) => {
        initDist.current = 0;
        if (scaleVal.current > 1.05) {
          baseTx.current += gs.dx;
          baseTy.current += gs.dy;
        } else {
          resetTransform();
          if (Math.abs(gs.dx) > 60 && Math.abs(gs.dy) < 80) {
            const idx = currentIndexRef.current;
            const all = photosRef.current;
            if (gs.dx < 0 && idx < all.length - 1) {
              const next = idx + 1;
              currentIndexRef.current = next;
              setCurrentIndex(next);
            } else if (gs.dx > 0 && idx > 0) {
              const prev = idx - 1;
              currentIndexRef.current = prev;
              setCurrentIndex(prev);
            }
          }
        }
      },
    })
  ).current;

  const photo = photos[currentIndex];
  // Prefere a URL pública (Supabase) sobre o URI local.
  // O arquivo local é deletado após o sync bem-sucedido; usar url evita o erro
  // "Arquivo pode ter sido removido do dispositivo" no PhotoWithPlaca.
  const uri = photo?.url || photo?.uri;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={viewerStyles.bg}>
        {/* Top bar */}
        <View style={viewerStyles.topBar}>
          {photos.length > 1 && (
            <Text style={viewerStyles.counterText}>{currentIndex + 1} / {photos.length}</Text>
          )}
          <TouchableOpacity style={viewerStyles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Text style={viewerStyles.hint}>Pinça para zoom · Duplo toque para ampliar</Text>

        {/* Zoomable area */}
        <Animated.View
          style={[viewerStyles.imageWrap, { transform: [{ scale }, { translateX }, { translateY }] }]}
          {...panResponder.panHandlers}
        >
          {uri ? (
            <Image source={{ uri }} style={viewerStyles.image} resizeMode="contain" />
          ) : (
            <View style={viewerStyles.noImage}>
              <Ionicons name="image-outline" size={64} color="#475569" />
            </View>
          )}
        </Animated.View>

        {/* Nav buttons */}
        {photos.length > 1 && (
          <View style={viewerStyles.navRow}>
            <TouchableOpacity
              style={[viewerStyles.navBtn, currentIndex === 0 && viewerStyles.navBtnDisabled]}
              onPress={() => {
                const p = currentIndex - 1;
                currentIndexRef.current = p;
                setCurrentIndex(p);
                resetTransform();
              }}
              disabled={currentIndex === 0}
            >
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[viewerStyles.navBtn, currentIndex === photos.length - 1 && viewerStyles.navBtnDisabled]}
              onPress={() => {
                const n = currentIndex + 1;
                currentIndexRef.current = n;
                setCurrentIndex(n);
                resetTransform();
              }}
              disabled={currentIndex === photos.length - 1}
            >
              <Ionicons name="chevron-forward" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const viewerStyles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    zIndex: 10,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    marginLeft: 'auto' as any,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
  },
  hint: {
    position: 'absolute',
    top: 108,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    zIndex: 10,
  },
  imageWrap: {
    width: SCREEN_W,
    height: SCREEN_H * 0.72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H * 0.72,
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRow: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    gap: 32,
  },
  navBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
    padding: 10,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
});

// ==================== PhotoCategoryTile ====================
/**
 * Tile mostrando uma categoria de fotos (ex: "Fotos Abertura: 2/3")
 */
interface PhotoCategoryTileProps {
  label: string;
  count: number;
  photos: FotoInfo[];
  onAddPhoto: () => void;
  onDeletePhoto?: (index: number) => void;
}

const resolvePhotoItem = (item: any): FotoInfo | null => {
  if (!item) return null;
  if (typeof item === 'string') {
    if (item.startsWith('http://') || item.startsWith('https://')) {
      return { url: item } as FotoInfo;
    }
    if (item.startsWith('file://') || item.startsWith('content://') || item.startsWith('/')) {
      return { uri: item } as FotoInfo;
    }
    return null; // bare ID, sem como renderizar
  }
  if (typeof item === 'object') {
    const photo = { ...(item as FotoInfo) };
    if (!photo.uri && isRenderablePhotoRef(photo.url) && !photo.url?.startsWith('http')) {
      photo.uri = photo.url;
    }
    if (!photo.url && isRenderablePhotoRef(photo.uri) && photo.uri?.startsWith('http')) {
      photo.url = photo.uri;
    }

    if (isRenderablePhotoRef(photo.url) || isRenderablePhotoRef(photo.uri)) {
      return photo;
    }
  }
  return null;
};

const PhotoCategoryTile: React.FC<PhotoCategoryTileProps> = ({
  label,
  count,
  photos,
  onAddPhoto,
  onDeletePhoto,
}) => {
  // Auto-expande quando há fotos para evitar clique duplo
  const [showPhotos, setShowPhotos] = useState(count > 0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Normaliza o array de fotos (resolve strings para FotoInfo quando possível)
  const resolvedPhotos = useMemo(
    () => photos.map(resolvePhotoItem).filter((p): p is FotoInfo => p !== null),
    [photos]
  );

  const openViewer = (idx: number) => {
    setViewerIndex(idx);
    setViewerOpen(true);
  };

  return (
    <View style={styles.photoCategoryTile}>
      {/* Header */}
      <TouchableOpacity
        style={styles.photoCategoryHeader}
        onPress={() => setShowPhotos(!showPhotos)}
      >
        <View style={styles.photoCategoryLabelRow}>
          <Ionicons name={showPhotos ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textSecondary} />
          <Text style={styles.photoCategoryLabel}>{label}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onAddPhoto} style={styles.addPhotoButton}>
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Photos Grid */}
      {showPhotos && resolvedPhotos.length > 0 && (
        <View style={styles.photosGrid}>
          {resolvedPhotos.map((photo, idx) => {
            const uri = photo.url || photo.uri;
            return (
              <TouchableOpacity key={idx} style={styles.photoThumbnail} onPress={() => openViewer(idx)} activeOpacity={0.85}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.photoImage, { backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="image" size={24} color={colors.textTertiary} />
                  </View>
                )}
                <View style={styles.photoZoomHint}>
                  <Ionicons name="expand-outline" size={12} color="#FFF" />
                </View>
                {onDeletePhoto && (
                  <TouchableOpacity
                    style={styles.photoDelete}
                    onPress={(e) => { e.stopPropagation?.(); onDeletePhoto(idx); }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <PhotoViewerModal
        photos={resolvedPhotos}
        initialIndex={viewerIndex}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      {/* Empty state */}
      {showPhotos && resolvedPhotos.length === 0 && (
        <View style={styles.photoEmpty}>
          <Ionicons name="images-outline" size={32} color={colors.textTertiary} />
          <Text style={styles.photoEmptyText}>Nenhuma foto capturada</Text>
        </View>
      )}

      {/* Collapsed empty state indicator */}
      {!showPhotos && count === 0 && (
        <Text style={styles.photoEmptyCollapsed}>Sem fotos</Text>
      )}
    </View>
  );
};

// ==================== ServiceTypeSelector ====================
/**
 * Modal para selecionar tipo de servico ao criar novo
 */
export interface ServiceTypeSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (tipo: TipoServico) => void;
  loading?: boolean;
  allowedTypes?: TipoServico[];
}

const TIPOS_SERVICO: TipoServico[] = [
  'APR',
  'Abertura e Fechamento de Chave',
  'Altimetria',
  'Bandolamento',
  'Book de Aterramento',
  'Cava em Rocha',
  'Checklist de Fiscaliza\u00e7\u00e3o',
  'Ditais',
  'Documenta\u00e7\u00e3o',
  'Emenda',
  'Funda\u00e7\u00e3o Especial',
  'Instala\u00e7\u00e3o do Medidor',
  'Linha Viva',
  'Poda',
  'Registro de Impedimento',
  'Transformador',
  'Vazamento e Limpeza de Transformador',
  'Teste',
];

export const ServiceTypeSelector: React.FC<ServiceTypeSelectorProps> = ({
  visible,
  onClose,
  onSelect,
  loading = false,
  allowedTypes,
}) => {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const tiposDisponiveis = (allowedTypes && allowedTypes.length > 0) ? allowedTypes : TIPOS_SERVICO;

  const handleSelect = (tipo: TipoServico) => {
    if (loading) return;
    onSelect(tipo);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} statusBarTranslucent>
      <View style={styles.selectorOverlay}>
        <View style={[styles.selectorContent, { paddingBottom: spacing.lg + Math.max(insets.bottom, 8) }]}>
          {/* Handle */}
          <View style={styles.selectorHandle} />

          {/* Título */}
          <Text style={styles.selectorTitle}>{'Escolha o Servi\u00e7o'}</Text>

          {/* Altura calculada: 88% tela menos áreas fixas (handle + título + botão + insets) */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
          ) : (
            <ScrollView
              style={[styles.selectorList, { maxHeight: Math.max(screenHeight * 0.88 - 60 - 56 - spacing.lg * 2 - Math.max(insets.bottom, 8), 200) }]}
              contentContainerStyle={styles.selectorListContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              {tiposDisponiveis.map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={styles.selectorItem}
                  onPress={() => handleSelect(tipo)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectorItemText}>{tipo}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Cancelar */}
          <TouchableOpacity style={styles.selectorCancelBtn} onPress={onClose}>
            <Text style={styles.selectorCancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  // ========== ObraContainer ==========
  obraContainer: {
    backgroundColor: colors.bgPrimary,
    borderRadius: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderTopWidth: 3,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  obraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  obraHeaderContent: {
    flex: 1,
    gap: 5,
  },
  obraHeaderRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    flexShrink: 0,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: colors.textTertiary,
    flex: 1,
  },
  obraTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  statusBadge_: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot_: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText_: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  servicePillsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    height: 28,
  },
  pillScroll: {},
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: spacing.sm,
  },
  servicePillDone: {
    backgroundColor: '#D1FAE5',
  },
  servicePillPending: {
    backgroundColor: '#FEF3C7',
  },
  servicePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
    backgroundColor: colors.bgSecondary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    gap: spacing.xs,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  actionButtonSecondary: {
    backgroundColor: colors.successLight,
    borderWidth: 1.5,
    borderColor: colors.successBorder,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
  },
  statsRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgSecondary,
  },
  statsText: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  // ========== ServiceCard ==========
  serviceCard: {
    backgroundColor: colors.bgPrimary,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  serviceHeaderExpanded: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  serviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  serviceHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  serviceMetaText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  serviceExpandedContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  photosSection: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  requiredPendingText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  legacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  legacyBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
    lineHeight: 17,
  },
  legacyInlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  legacyInlineBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  legacyInlineBannerSub: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 1,
  },
  legacyBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'center',
  },
  legacyBtnText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 13,
  },
  ruleWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  ruleWarningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  pendingCategoriesBox: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    padding: spacing.sm,
  },
  pendingCategoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  pendingCategoriesTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  serviceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    gap: spacing.xs,
  },
  primaryBtn: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  detailsBtn: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
  },

  // ========== PhotoCategoryTile ==========
  photoCategoryTile: {
    marginBottom: spacing.sm,
  },
  photoCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  photoCategoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  photoCategoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addPhotoButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  photoThumbnail: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.bgTertiary,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoZoomHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 4,
    padding: 2,
  },
  photoDelete: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: colors.bgPrimary,
    borderRadius: 12,
  },
  photoEmpty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoEmptyText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  photoEmptyCollapsed: {
    fontSize: 11,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginLeft: spacing.md,
    marginTop: 2,
  },

  // ========== StatusBadge ==========
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ========== ServiceTypeSelector ==========
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  selectorContent: {
    backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    maxHeight: '88%',
  },
  selectorHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgTertiary,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  selectorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  selectorCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorList: {
    flexGrow: 1,
  },
  selectorListContent: {
    paddingBottom: 4,
  },
  selectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  selectorItemText: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  selectorCancelBtn: {
    marginTop: 8,
    backgroundColor: colors.bgTertiary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectorCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ── Legacy empty / summary styles ──
  legacyEmptyState: {
    alignItems: 'center' as const,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  legacyEmptyTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    marginTop: 4,
  },
  legacyEmptySubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  legacyOpenBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  legacyOpenBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  legacySummary: {
    padding: 12,
    gap: 6,
  },
  legacySummaryTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryGroup: {
    gap: 3,
    marginBottom: 4,
  },
  summaryGroupLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  summaryRowLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  summaryRowValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500' as const,
  },
  summaryRowDone: {
    backgroundColor: '#ECFDF5',
    borderBottomColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  summaryRowLabelDone: {
    color: '#166534',
    fontWeight: '600' as const,
  },
  summaryRowValueDone: {
    color: '#166534',
    fontWeight: '700' as const,
  },
  posteSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  posteMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
  },
  posteMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  posteAditivoBadge: {
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  posteAditivoBadgeText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600' as const,
  },
  posteMissingText: {
    fontSize: 12,
    color: '#B45309',
    paddingVertical: 4,
  },
  summarySubRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 2,
    paddingLeft: 8,
  },
  summarySubLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  summarySubValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500' as const,
  },
  summarySubRowDone: {
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  summarySubLabelDone: {
    color: '#166534',
    fontWeight: '600' as const,
  },
  summarySubValueDone: {
    color: '#166534',
    fontWeight: '700' as const,
  },
  legacySummaryActions: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap' as const,
  },
  postesPromptBox: {
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 6,
  },
  postesPromptTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center' as const,
  },
  postesPromptText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  cavaRochaBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  cavaRochaBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
});

export default {
  ObraContainer,
  ServiceCard,
  ServiceTypeSelector,
};
