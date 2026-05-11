import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { latLongToUTM, formatUTM } from '../lib/geocoding';
import { getAllPhotoMetadata } from '../lib/photo-backup';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface PhotoWithPlacaProps {
  uri: string;
  obraNumero?: string;
  tipoServico?: string;
  equipe?: string;
  latitude?: number | null;
  longitude?: number | null;
  utmX?: number | null;
  utmY?: number | null;
  utmZone?: string | null;
  dateTime?: string; // Data/hora em que a foto foi tirada
  style?: any;
  onRecoverMissingPhoto?: (failedUri: string) => void | Promise<void>;
  recoverButtonLabel?: string;
}

export function PhotoWithPlaca({
  uri,
  obraNumero,
  tipoServico,
  equipe,
  latitude,
  longitude,
  utmX,
  utmY,
  utmZone,
  dateTime,
  style,
  onRecoverMissingPhoto,
  recoverButtonLabel,
}: PhotoWithPlacaProps) {
  const [currentUri, setCurrentUri] = useState(uri);
  const [imageError, setImageError] = useState(false);
  const [recoveringPhoto, setRecoveringPhoto] = useState(false);
  const fallbackTriedForUriRef = useRef<string | null>(null);
  const fallbackCandidatesRef = useRef<string[]>([]);
  const lastFailedUriRef = useRef<string>(uri);

  useEffect(() => {
    setCurrentUri(uri);
    setImageError(false);
    setRecoveringPhoto(false);
    fallbackTriedForUriRef.current = null;
    fallbackCandidatesRef.current = [];
    lastFailedUriRef.current = uri;
  }, [uri]);

  // Validacao: verificar se URI e valido
  // Aceitar tanto file:// (local) quanto https:// (Supabase)
  const isValidUri =
    currentUri &&
    (
      currentUri.startsWith('file://') ||
      currentUri.startsWith('content://') ||
      currentUri.startsWith('http://') ||
      currentUri.startsWith('https://')
    );

  const resolveFallbackCandidatesFromMetadata = async (failedUri: string): Promise<string[]> => {
    try {
      if (!failedUri || !failedUri.startsWith('file://')) return [];

      const normalized = failedUri.trim();
      const allMetadata = await getAllPhotoMetadata();

      const fromExactPath = allMetadata.find((photo) =>
        [photo.compressedPath, photo.backupPath, photo.originalUri]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .some((value) => value.trim() === normalized)
      );
      if (fromExactPath) {
        const candidates = [
          fromExactPath.compressedPath,
          fromExactPath.backupPath,
          fromExactPath.originalUri,
          fromExactPath.uploadUrl,
          fromExactPath.supabaseUrl,
        ]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
          .filter((value) => value !== normalized);
        if (candidates.length > 0) return candidates;
      }

      const fileName = normalized.split('?')[0].split('/').pop() || '';
      const baseFromCompressed = fileName.replace(/_compressed\.[a-z0-9]+$/i, '');

      const fromId = allMetadata.find((photo) => {
        if (!photo?.id) return false;
        if (photo.id === baseFromCompressed) return true;
        if (!fileName) return false;
        return (
          String(photo.compressedPath || '').includes(fileName) ||
          String(photo.backupPath || '').includes(fileName) ||
          String(photo.originalUri || '').includes(fileName)
        );
      });

      if (fromId) {
        const candidates = [
          fromId.compressedPath,
          fromId.backupPath,
          fromId.originalUri,
          fromId.uploadUrl,
          fromId.supabaseUrl,
        ]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
          .filter((value) => value !== normalized);
        if (candidates.length > 0) return candidates;
      }

      return [];
    } catch {
      return [];
    }
  };

  if (!isValidUri) {
    console.warn('PhotoWithPlaca: URI invalido ou vazio:', currentUri);
    return (
      <View style={[styles.container, style, styles.errorContainer]}>
        <Text style={styles.errorText}>Foto nao disponivel</Text>
        <Text style={styles.errorSubtext}>Arquivo pode ter sido removido</Text>
        {onRecoverMissingPhoto && (
          <TouchableOpacity
            style={[styles.recoverButton, recoveringPhoto && styles.recoverButtonDisabled]}
            disabled={recoveringPhoto}
            onPress={async () => {
              try {
                setRecoveringPhoto(true);
                await onRecoverMissingPhoto(lastFailedUriRef.current || currentUri || uri);
              } finally {
                setRecoveringPhoto(false);
              }
            }}
          >
            <Text style={styles.recoverButtonText}>
              {recoveringPhoto ? 'Substituindo...' : (recoverButtonLabel || 'Buscar na galeria')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Se houve erro ao carregar a imagem, mostrar placeholder
  if (imageError) {
    console.warn('PhotoWithPlaca: Erro ao carregar imagem:', currentUri);
    return (
      <View style={[styles.container, style, styles.errorContainer]}>
        <Text style={styles.errorText}>Foto nao disponivel</Text>
        <Text style={styles.errorSubtext}>
          {currentUri.includes('temp_')
            ? 'Foto nao foi sincronizada antes de ser removida'
            : 'Arquivo pode ter sido removido do dispositivo'}
        </Text>
        {onRecoverMissingPhoto && (
          <TouchableOpacity
            style={[styles.recoverButton, recoveringPhoto && styles.recoverButtonDisabled]}
            disabled={recoveringPhoto}
            onPress={async () => {
              try {
                setRecoveringPhoto(true);
                await onRecoverMissingPhoto(lastFailedUriRef.current || currentUri);
              } finally {
                setRecoveringPhoto(false);
              }
            }}
          >
            <Text style={styles.recoverButtonText}>
              {recoveringPhoto ? 'Substituindo...' : (recoverButtonLabel || 'Buscar na galeria')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Formatar data/hora atual se nao fornecida
  const displayDateTime = dateTime || new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calcular UTM se tiver coordenadas mas nao tiver UTM
  let utmDisplay = '';
  if (utmX && utmY && utmZone) {
    utmDisplay = `${utmZone} ${Math.round(utmX).toLocaleString()}E ${Math.round(utmY).toLocaleString()}N`;
  } else if (latitude && longitude) {
    const utm = latLongToUTM(latitude, longitude);
    utmDisplay = formatUTM(utm);
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: currentUri }}
        style={styles.photo}
        resizeMode="cover"
        onError={(error) => {
          const failedUri = currentUri;
          lastFailedUriRef.current = failedUri;
          const canTryRemoteFallback =
            failedUri.startsWith('file://') && fallbackTriedForUriRef.current !== failedUri;

          if (canTryRemoteFallback) {
            fallbackTriedForUriRef.current = failedUri;
            void (async () => {
              if (fallbackCandidatesRef.current.length === 0) {
                fallbackCandidatesRef.current = await resolveFallbackCandidatesFromMetadata(failedUri);
              }

              const nextCandidate = fallbackCandidatesRef.current.shift();
              if (nextCandidate) {
                console.warn('PhotoWithPlaca: arquivo local ausente, tentando fallback:', nextCandidate);
                setCurrentUri(nextCandidate);
                setImageError(false);
                return;
              }

              console.warn('PhotoWithPlaca: erro ao carregar imagem sem fallback:', failedUri);
              setImageError(true);
            })();
            return;
          }

          console.warn('PhotoWithPlaca: Erro ao carregar imagem:', failedUri, error.nativeEvent);
          setImageError(true); // Marcar erro para exibir placeholder
        }}
      />

      {/* Placa de Informacoes no canto inferior esquerdo */}
      {(obraNumero || tipoServico || equipe) && (
        <View style={styles.placa}>
          {/* Cabecalho */}
          <View style={styles.placaHeader}>
            <Text style={styles.placaHeaderText}>REGISTRO DE OBRA</Text>
          </View>

          {/* Conteudo */}
          <View style={styles.placaContent}>
            {/* Data/Hora */}
            <View style={styles.infoRow}>
              <Text style={styles.label}>Data/Hora:</Text>
              <Text style={styles.value}>{displayDateTime}</Text>
            </View>

            {/* Obra */}
            {obraNumero && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Obra:</Text>
                <Text style={styles.valueHighlight}>{obraNumero}</Text>
              </View>
            )}

            {/* Servico */}
            {tipoServico && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Servico:</Text>
                <Text style={styles.value}>{tipoServico}</Text>
              </View>
            )}

            {/* Equipe */}
            {equipe && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Equipe:</Text>
                <Text style={styles.value}>{equipe}</Text>
              </View>
            )}

            {/* UTM */}
            {!!utmDisplay && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.label}>UTM:</Text>
                  <Text style={styles.valueUtm}>{utmDisplay}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placa: {
    position: 'absolute',
    left: SCREEN_WIDTH * 0.025, // 2.5% da largura
    bottom: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.60, // 60% da largura da tela (responsivo)
    maxWidth: 450, // Limite maximo
    minWidth: 250, // Limite minimo
    backgroundColor: 'rgba(255, 255, 255, 0.75)', // Fundo branco mais transparente (75% opacidade)
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.3)', // Borda escura para contraste
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
  },
  placaHeader: {
    backgroundColor: 'rgba(220, 220, 220, 0.85)', // Cabecalho cinza mais transparente (85% opacidade)
    paddingVertical: SCREEN_WIDTH * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.03,
  },
  placaHeaderText: {
    color: 'rgba(0, 0, 0, 0.9)', // Texto preto bem legivel
    fontSize: Math.max(10, SCREEN_WIDTH * 0.030), // Responsivo, minimo 10px
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  placaContent: {
    padding: SCREEN_WIDTH * 0.03,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: SCREEN_WIDTH * 0.015,
    alignItems: 'center',
  },
  label: {
    fontSize: Math.max(11, SCREEN_WIDTH * 0.032), // Responsivo, minimo 11px
    fontWeight: '700',
    color: 'rgba(80, 80, 80, 1)', // Cinza escuro para otimo contraste
    width: SCREEN_WIDTH * 0.18,
    marginRight: 8,
  },
  value: {
    fontSize: Math.max(11, SCREEN_WIDTH * 0.032),
    color: 'rgba(0, 0, 0, 0.9)', // Texto preto bem legivel
    fontWeight: '700',
    flex: 1,
    flexWrap: 'wrap',
  },
  valueHighlight: {
    fontSize: Math.max(11, SCREEN_WIDTH * 0.032),
    fontWeight: '800',
    color: 'rgba(0, 90, 200, 1)', // Azul escuro para contraste
    flex: 1,
    flexWrap: 'wrap',
  },
  valueUtm: {
    fontSize: Math.max(10, SCREEN_WIDTH * 0.028),
    fontWeight: '800',
    color: 'rgba(0, 130, 80, 1)', // Verde escuro para contraste
    flex: 1,
    flexWrap: 'wrap',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Divisor escuro
    marginVertical: SCREEN_WIDTH * 0.012,
  },
  // Estilos para estado de erro
  errorContainer: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  recoverButton: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  recoverButtonDisabled: {
    opacity: 0.6,
  },
  recoverButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

