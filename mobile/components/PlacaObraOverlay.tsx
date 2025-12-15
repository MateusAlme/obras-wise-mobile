import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { getAddressFromCoords, latLongToUTM, formatUTM, type Address, type UTMCoordinates } from '../lib/geocoding';

interface PlacaObraOverlayProps {
  visible: boolean;
  photoUri: string;
  obraNumero: string;
  tipoServico: string;
  equipe: string;
  latitude: number | null;
  longitude: number | null;
  onConfirm: () => void;
  onRetake: () => void;
}

export function PlacaObraOverlay({
  visible,
  photoUri,
  obraNumero,
  tipoServico,
  equipe,
  latitude,
  longitude,
  onConfirm,
  onRetake,
}: PlacaObraOverlayProps) {
  const [address, setAddress] = useState<Address | null>(null);
  const [utm, setUtm] = useState<UTMCoordinates | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && latitude && longitude) {
      loadLocationData();
    }
  }, [visible, latitude, longitude]);

  async function loadLocationData() {
    setLoading(true);
    try {
      if (latitude && longitude) {
        // Obter endereço
        const addr = await getAddressFromCoords(latitude, longitude);
        setAddress(addr);

        // Calcular UTM
        const utmCoords = latLongToUTM(latitude, longitude);
        setUtm(utmCoords);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de localização:', error);
    } finally {
      setLoading(false);
    }
  }

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const currentTime = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        {/* Foto de fundo */}
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />

        {/* Sobreposição escura */}
        <View style={styles.overlay} />

        {/* Placa da Obra */}
        <View style={styles.placaContainer}>
          <View style={styles.placa}>
            {/* Cabeçalho */}
            <View style={styles.header}>
              <Text style={styles.headerText}>REGISTRO DE OBRA</Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Obtendo localização...</Text>
              </View>
            ) : (
              <View style={styles.content}>
                {/* Data e Hora */}
                <View style={styles.row}>
                  <Text style={styles.label}>Data/Hora:</Text>
                  <Text style={styles.value}>
                    {currentDate} às {currentTime}
                  </Text>
                </View>

                {/* Obra */}
                <View style={styles.row}>
                  <Text style={styles.label}>Obra:</Text>
                  <Text style={styles.valueHighlight}>{obraNumero || 'N/A'}</Text>
                </View>

                {/* Tipo de Serviço */}
                <View style={styles.row}>
                  <Text style={styles.label}>Serviço:</Text>
                  <Text style={styles.value}>{tipoServico}</Text>
                </View>

                {/* Equipe */}
                <View style={styles.row}>
                  <Text style={styles.label}>Equipe:</Text>
                  <Text style={styles.value}>{equipe}</Text>
                </View>

                {/* Divisor */}
                <View style={styles.divider} />

                {/* Localização */}
                <View style={styles.locationSection}>
                  <Text style={styles.sectionTitle}>LOCALIZAÇÃO</Text>

                  {/* Coordenadas UTM */}
                  {utm && (
                    <View style={styles.row}>
                      <Text style={styles.label}>UTM:</Text>
                      <Text style={styles.valueHighlight}>{formatUTM(utm)}</Text>
                    </View>
                  )}

                  {/* GPS */}
                  {latitude && longitude && (
                    <View style={styles.row}>
                      <Text style={styles.label}>GPS:</Text>
                      <Text style={styles.valueSmall}>
                        {latitude.toFixed(6)}, {longitude.toFixed(6)}
                      </Text>
                    </View>
                  )}

                  {/* Endereço */}
                  {address && address.formattedAddress !== 'Endereço não disponível' && (
                    <View style={styles.addressRow}>
                      <Text style={styles.label}>Endereço:</Text>
                      <Text style={styles.address}>{address.formattedAddress}</Text>
                    </View>
                  )}

                  {/* Cidade/Estado */}
                  {address && address.city && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Cidade/UF:</Text>
                      <Text style={styles.value}>
                        {address.city}
                        {address.state ? ` - ${address.state}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Botões */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.buttonRetake} onPress={onRetake}>
              <Text style={styles.buttonText}>🔄 Refazer Foto</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.buttonConfirm} onPress={onConfirm}>
              <Text style={styles.buttonText}>✓ Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  photo: {
    width: width,
    height: height,
    position: 'absolute',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  placaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placa: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  content: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  addressRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    width: 100,
  },
  value: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  valueHighlight: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
    flex: 1,
  },
  valueSmall: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  address: {
    fontSize: 13,
    color: '#1e293b',
    marginTop: 4,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
  },
  locationSection: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
    maxWidth: 500,
  },
  buttonRetake: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonConfirm: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
