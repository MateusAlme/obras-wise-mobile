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
    left: 15,
    bottom: 15,
    width: '92%', // Largura fixa grande
    backgroundColor: 'rgba(0, 0, 0, 0.80)', // Muito opaco
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)', // Borda muito visível
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  placaHeader: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Header bem escuro
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  placaHeaderText: {
    color: 'rgba(255, 255, 255, 1)', // Branco total
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  placaContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(240, 240, 240, 1)', // Quase branco
    width: 85,
  },
  value: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 1)', // Branco total
    fontWeight: '800',
    flex: 1,
  },
  valueHighlight: {
    fontSize: 14,
    fontWeight: '900',
    color: 'rgba(100, 170, 255, 1)', // Azul bem claro
    flex: 1,
  },
  valueUtm: {
    fontSize: 13,
    fontWeight: '900',
    color: 'rgba(60, 220, 160, 1)', // Verde bem claro
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Divisor mais visível
    marginVertical: 6,
  },
});
