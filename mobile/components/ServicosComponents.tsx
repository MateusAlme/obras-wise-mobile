import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';
import { Servico, TipoServico, SERVICO_PHOTO_MAP, FotoInfo, StatusServico, SyncStatusServico } from '../types/servico';

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
export interface ServiceCardProps {
  service: Servico;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCapturePhoto: (servicoId: string, category: keyof Servico) => void;
  onMarkComplete: (servicoId: string) => void;
  onOpenDetails?: () => void;
  onPhotoViewer?: (photo: FotoInfo) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  isExpanded,
  onToggleExpand,
  onCapturePhoto,
  onMarkComplete,
  onOpenDetails,
  onPhotoViewer,
}) => {
  const categories = SERVICO_PHOTO_MAP[service.tipo_servico] || [];
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);
  const categoriesWithPhotos = categories.filter((category) => {
    const photos = (service[category.field] || []) as FotoInfo[];
    return photos.length > 0;
  });
  const categoriesWithoutPhotos = categories.filter((category) => {
    const photos = (service[category.field] || []) as FotoInfo[];
    return photos.length === 0;
  });

  const accentColor = service.status === 'completo' ? '#059669' : service.status === 'em_progresso' ? '#D97706' : '#CBD5E1';

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
              {service.responsavel} | {new Date(service.created_at).toLocaleDateString('pt-BR')}
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
          {/* Photos section */}
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Fotos do servico</Text>

            {categoriesWithPhotos.length > 0 && categoriesWithPhotos.map((category, idx) => {
              const photos = (service[category.field] || []) as FotoInfo[];
              const photoCount = photos.length;

              return (
                <PhotoCategoryTile
                  key={idx}
                  label={category.label}
                  count={photoCount}
                  photos={photos}
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

            {categories.length === 0 && (
              <Text style={styles.photoEmptyCollapsed}>Sem categorias de foto para este tipo de servico</Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.serviceActions}>
            {service.status !== 'completo' && (
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
                style={[styles.actionBtn, styles.detailsBtn]}
                onPress={onOpenDetails}
              >
                <Ionicons name="document-text-outline" size={16} color={colors.secondary} />
                <Text style={styles.detailsBtnText}>Ver detalhes</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Error message if sync failed */}
          {service.sync_status === 'error' && service.error_message && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorBannerText}>{service.error_message}</Text>
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
  const uri = photo?.uri || photo?.url;

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

const PhotoCategoryTile: React.FC<PhotoCategoryTileProps> = ({
  label,
  count,
  photos,
  onAddPhoto,
  onDeletePhoto,
}) => {
  const [showPhotos, setShowPhotos] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

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
      {showPhotos && photos.length > 0 && (
        <View style={styles.photosGrid}>
          {photos.map((photo, idx) => (
            <TouchableOpacity key={idx} style={styles.photoThumbnail} onPress={() => openViewer(idx)} activeOpacity={0.85}>
              {(photo.uri || photo.url) ? (
                <Image
                  source={{ uri: photo.uri || photo.url }}
                  style={styles.photoImage}
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
          ))}
        </View>
      )}

      <PhotoViewerModal
        photos={photos}
        initialIndex={viewerIndex}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      {/* Empty state */}
      {showPhotos && photos.length === 0 && (
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
}

const TIPOS_SERVICO: TipoServico[] = [
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
  'Transformador',
  'Vazamento e Limpeza de Transformador',
];

export const ServiceTypeSelector: React.FC<ServiceTypeSelectorProps> = ({
  visible,
  onClose,
  onSelect,
  loading = false,
}) => {
  const handleSelect = async (tipo: TipoServico) => {
    onSelect(tipo);
    // Delay slightly to show visual feedback
    await new Promise((resolve) => setTimeout(resolve, 300));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.selectorOverlay}>
        <View style={styles.selectorContent}>
          {/* Handle */}
          <View style={styles.selectorHandle} />

          {/* Header */}
          <View style={styles.selectorHeader}>
            <Text style={styles.selectorTitle}>Tipo de Servico</Text>
            <TouchableOpacity onPress={onClose} style={styles.selectorCloseBtn}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={TIPOS_SERVICO}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.selectorItem}
                onPress={() => handleSelect(item)}
                disabled={loading}
                activeOpacity={0.6}
              >
                <Text style={styles.selectorItemText}>{item}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            scrollEnabled
            style={styles.selectorList}
          />

          {loading && <ActivityIndicator size="large" color={colors.primary} />}
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
    height: '70%',
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
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
    flex: 1,
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
});

export default {
  ObraContainer,
  ServiceCard,
  ServiceTypeSelector,
};



