import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Modal, Dimensions, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SERVICO_PHOTO_MAP, type Servico, type FotoInfo } from '../types/servico';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_progresso: 'Em andamento',
  completo: 'Concluído',
};

const STATUS_COLOR: Record<string, string> = {
  rascunho: '#F59E0B',
  em_progresso: '#3B82F6',
  completo: '#10B981',
};

export default function ServicoDetalhePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string }>();

  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPhotos, setViewerPhotos] = useState<FotoInfo[]>([]);

  const servico: Servico | null = (() => {
    try {
      return params.data ? JSON.parse(decodeURIComponent(params.data as string)) : null;
    } catch {
      return null;
    }
  })();

  if (!servico) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Serviço não encontrado.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categories = SERVICO_PHOTO_MAP[servico.tipo_servico] || [];
  const statusColor = STATUS_COLOR[servico.status] || '#94A3B8';
  const statusLabel = STATUS_LABEL[servico.status] || servico.status;

  const allPhotos = categories.flatMap((cat) => {
    const field = (servico as any)[cat.field];
    if (!Array.isArray(field)) return [];
    return field.filter((p: any) => p && (p.uri || p.url));
  });

  const openViewer = (photos: FotoInfo[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerUri(photos[index]?.uri || photos[index]?.url || null);
  };

  const totalFotos = allPhotos.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E293B" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{servico.tipo_servico}</Text>
          <Text style={styles.headerSub}>
            {servico.obra_numero ? `Obra ${servico.obra_numero}` : 'Serviço'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color="#94A3B8" />
            <Text style={styles.infoLabel}>Responsável</Text>
            <Text style={styles.infoValue}>{servico.responsavel || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="images-outline" size={16} color="#94A3B8" />
            <Text style={styles.infoLabel}>Total de fotos</Text>
            <Text style={styles.infoValue}>{totalFotos}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
            <Text style={styles.infoLabel}>Criado em</Text>
            <Text style={styles.infoValue}>
              {servico.created_at
                ? new Date(servico.created_at).toLocaleDateString('pt-BR')
                : '—'}
            </Text>
          </View>
        </View>

        {/* Seções de fotos por categoria */}
        {categories.map((cat) => {
          const field = (servico as any)[cat.field];
          const photos: FotoInfo[] = Array.isArray(field)
            ? field.filter((p: any) => p && (p.uri || p.url))
            : [];

          return (
            <View key={cat.field} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryCount}>{photos.length}</Text>
                </View>
              </View>

              {photos.length === 0 ? (
                <View style={styles.emptyCategory}>
                  <Ionicons name="camera-outline" size={24} color="#475569" />
                  <Text style={styles.emptyCategoryText}>Sem fotos</Text>
                </View>
              ) : (
                <View style={styles.photosGrid}>
                  {photos.map((photo, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.photoThumb}
                      onPress={() => openViewer(photos, idx)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: photo.uri || photo.url }}
                        style={styles.photoThumbImage}
                        resizeMode="cover"
                      />
                      <View style={styles.photoThumbOverlay}>
                        <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {categories.length === 0 && (
          <View style={styles.noCategories}>
            <Ionicons name="alert-circle-outline" size={32} color="#475569" />
            <Text style={styles.noCategoriesText}>
              Nenhuma categoria de foto definida para "{servico.tipo_servico}"
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Visualizador de foto full-screen */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.viewerBg}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {viewerUri ? (
            <Image
              source={{ uri: viewerUri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : (
            <ActivityIndicator size="large" color="#FFFFFF" />
          )}

          {viewerPhotos.length > 1 && (
            <View style={styles.viewerNav}>
              <TouchableOpacity
                style={[styles.viewerNavBtn, viewerIndex === 0 && styles.viewerNavBtnDisabled]}
                onPress={() => {
                  const prev = viewerIndex - 1;
                  if (prev >= 0) {
                    setViewerIndex(prev);
                    setViewerUri(viewerPhotos[prev]?.uri || viewerPhotos[prev]?.url || null);
                  }
                }}
                disabled={viewerIndex === 0}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={styles.viewerCounter}>{viewerIndex + 1} / {viewerPhotos.length}</Text>

              <TouchableOpacity
                style={[styles.viewerNavBtn, viewerIndex === viewerPhotos.length - 1 && styles.viewerNavBtnDisabled]}
                onPress={() => {
                  const next = viewerIndex + 1;
                  if (next < viewerPhotos.length) {
                    setViewerIndex(next);
                    setViewerUri(viewerPhotos[next]?.uri || viewerPhotos[next]?.url || null);
                  }
                }}
                disabled={viewerIndex === viewerPhotos.length - 1}
              >
                <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#94A3B8', fontSize: 16, marginBottom: 16 },
  backBtn: { backgroundColor: '#1E293B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: '#FFFFFF', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  headerBack: { padding: 4, marginRight: 12 },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#94A3B8', fontSize: 12, marginTop: 1 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, marginLeft: 8,
  },
  statusText: { fontSize: 11, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  infoCard: {
    backgroundColor: '#1E293B', borderRadius: 12,
    padding: 16, gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { color: '#94A3B8', fontSize: 13, flex: 1 },
  infoValue: { color: '#F1F5F9', fontSize: 13, fontWeight: '600' },

  categorySection: {
    backgroundColor: '#1E293B', borderRadius: 12, overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  categoryLabel: { color: '#F1F5F9', fontSize: 14, fontWeight: '600' },
  categoryBadge: {
    backgroundColor: '#334155', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  categoryCount: { color: '#94A3B8', fontSize: 12 },

  emptyCategory: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14,
  },
  emptyCategoryText: { color: '#475569', fontSize: 13 },

  photosGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 10, gap: 8,
  },
  photoThumb: {
    width: (SCREEN_WIDTH - 64) / 3,
    height: (SCREEN_WIDTH - 64) / 3,
    borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#334155',
  },
  photoThumbImage: { width: '100%', height: '100%' },
  photoThumbOverlay: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 2,
  },

  noCategories: {
    alignItems: 'center', padding: 40, gap: 12,
  },
  noCategoriesText: { color: '#475569', fontSize: 14, textAlign: 'center' },

  // Viewer
  viewerBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute', top: 48, right: 20,
    zIndex: 10, padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  viewerNav: {
    position: 'absolute', bottom: 60,
    flexDirection: 'row', alignItems: 'center', gap: 24,
  },
  viewerNavBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 8,
  },
  viewerNavBtnDisabled: { opacity: 0.3 },
  viewerCounter: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
