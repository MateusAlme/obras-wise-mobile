import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { latLongToUTM, formatUTM } from '../lib/geocoding';

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
      <Image source={{ uri }} style={styles.photo} resizeMode="cover" />

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
    left: 12,
    bottom: 12,
    maxWidth: '95%', // Quase toda largura
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // Bem opaco
    borderRadius: 8,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)', // Borda bem visível
    overflow: 'hidden',
  },
  placaHeader: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Header destacado
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  placaHeaderText: {
    color: 'rgba(255, 255, 255, 1)', // Branco total
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  placaContent: {
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(230, 230, 230, 1)', // Cinza bem claro
    width: 75,
  },
  value: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 1)', // Branco total
    fontWeight: '700',
    flex: 1,
  },
  valueHighlight: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(96, 165, 250, 1)', // Azul total
    flex: 1,
  },
  valueUtm: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(52, 211, 153, 1)', // Verde total
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Divisor mais sutil
    marginVertical: 4,
  },
});
