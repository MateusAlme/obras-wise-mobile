import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { latLongToUTM, formatUTM } from '../lib/geocoding';

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
}: PhotoWithPlacaProps) {

  // ✅ VALIDAÇÃO: Verificar se URI é válido
  if (!uri || !uri.startsWith('file://')) {
    console.warn('⚠️ PhotoWithPlaca: URI inválido ou vazio:', uri);
    return (
      <View style={[styles.container, style, styles.errorContainer]}>
        <Text style={styles.errorText}>❌ Foto não disponível</Text>
        <Text style={styles.errorSubtext}>Arquivo pode ter sido removido</Text>
      </View>
    );
  }

  // Formatar data/hora atual se não fornecida
  const displayDateTime = dateTime || new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calcular UTM se tiver coordenadas mas não tiver UTM
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
        source={{ uri }}
        style={styles.photo}
        resizeMode="cover"
        onError={(error) => {
          console.error('❌ Erro ao carregar imagem:', uri, error.nativeEvent);
        }}
      />

      {/* Placa de Informações no canto inferior esquerdo */}
      {(obraNumero || tipoServico || equipe) && (
        <View style={styles.placa}>
          {/* Cabeçalho */}
          <View style={styles.placaHeader}>
            <Text style={styles.placaHeaderText}>REGISTRO DE OBRA</Text>
          </View>

          {/* Conteúdo */}
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

            {/* Serviço */}
            {tipoServico && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Serviço:</Text>
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
    maxWidth: 450, // Limite máximo
    minWidth: 250, // Limite mínimo
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  placaHeader: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: SCREEN_WIDTH * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.03,
  },
  placaHeaderText: {
    color: 'rgba(255, 255, 255, 1)',
    fontSize: Math.max(10, SCREEN_WIDTH * 0.030), // Responsivo, mínimo 10px
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
    fontSize: Math.max(11, SCREEN_WIDTH * 0.032), // Responsivo, mínimo 11px
    fontWeight: '700',
    color: 'rgba(230, 230, 230, 1)',
    width: SCREEN_WIDTH * 0.18,
    marginRight: 8,
  },
  value: {
    fontSize: Math.max(11, SCREEN_WIDTH * 0.032),
    color: 'rgba(255, 255, 255, 1)',
    fontWeight: '700',
    flex: 1,
    flexWrap: 'wrap',
  },
  valueHighlight: {
    fontSize: Math.max(11, SCREEN_WIDTH * 0.032),
    fontWeight: '800',
    color: 'rgba(100, 170, 255, 1)',
    flex: 1,
    flexWrap: 'wrap',
  },
  valueUtm: {
    fontSize: Math.max(10, SCREEN_WIDTH * 0.028),
    fontWeight: '800',
    color: 'rgba(60, 220, 160, 1)',
    flex: 1,
    flexWrap: 'wrap',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginVertical: SCREEN_WIDTH * 0.012,
  },
  // ✅ Estilos para estado de erro
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
});
