import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getAddressFromCoords, latLongToUTM, formatUTM } from '../lib/geocoding';

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
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log(`[PhotoWithPlaca useEffect] Coordenadas recebidas: lat=${latitude}, lon=${longitude}`);
    loadAddress();
  }, [latitude, longitude]);

  async function loadAddress() {
    if (latitude && longitude) {
      try {
        console.log(`[PhotoWithPlaca] Buscando endereço para: ${latitude}, ${longitude}`);

        const addr = await Promise.race([
          getAddressFromCoords(latitude, longitude),
          new Promise<null>((resolve) => setTimeout(() => {
            console.log('[PhotoWithPlaca] Timeout de geocodificação (5s)');
            resolve(null);
          }, 5000)) // Aumentado para 5 segundos
        ]);

        if (addr && addr.formattedAddress && addr.formattedAddress !== 'Endereço não disponível' && addr.formattedAddress !== 'Erro ao obter endereço') {
          console.log(`[PhotoWithPlaca] ✅ Endereço encontrado: ${addr.formattedAddress}`);
          console.log(`[PhotoWithPlaca] Chamando setAddress com: "${addr.formattedAddress}"`);
          setAddress(addr.formattedAddress);
          console.log(`[PhotoWithPlaca] Estado address atualizado`);
        } else {
          console.log('[PhotoWithPlaca] ❌ Nenhum endereço válido retornado');
          setAddress('');
        }
      } catch (error) {
        console.error('[PhotoWithPlaca] Erro ao buscar endereço:', error);
        setAddress('');
      }
    } else {
      console.log('[PhotoWithPlaca] Sem coordenadas GPS');
    }
    setLoading(false);
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

  // Debug: Log do estado no render
  console.log(`[PhotoWithPlaca RENDER] address="${address}", loading=${loading}`);

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

            {/* Divisor */}
            {!!utmDisplay && <View style={styles.divider} />}

            {/* UTM */}
            {!!utmDisplay && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>UTM:</Text>
                <Text style={styles.valueUtm}>{utmDisplay}</Text>
              </View>
            )}

            {/* Endereço - SEMPRE mostra */}
            {(latitude && longitude) && (
              <Text style={styles.address}>
                {loading ? 'Carregando endereço...' : (address || 'Endereço não disponível')}
              </Text>
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
    left: 10,
    bottom: 10,
    maxWidth: '90%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.8)',
    overflow: 'hidden',
  },
  placaHeader: {
    backgroundColor: 'rgba(37, 99, 235, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  placaHeaderText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  placaContent: {
    padding: 10,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9ca3af',
    width: 70,
  },
  value: {
    fontSize: 10,
    color: '#fff',
    flex: 1,
  },
  valueHighlight: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#60a5fa',
    flex: 1,
  },
  valueUtm: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#34d399',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 6,
  },
  address: {
    fontSize: 10,
    color: '#fff',
    marginTop: 6,
    lineHeight: 14,
    fontWeight: '500',
  },
});
