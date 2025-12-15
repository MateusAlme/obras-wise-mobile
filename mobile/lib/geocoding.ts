import * as Location from 'expo-location';

export interface Address {
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  formattedAddress: string;
}

/**
 * Converte coordenadas GPS em endereço usando geocodificação reversa
 */
export async function getAddressFromCoords(
  latitude: number,
  longitude: number
): Promise<Address> {
  try {
    console.log(`[Geocoding] Iniciando geocodificação reversa para: ${latitude}, ${longitude}`);

    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    console.log(`[Geocoding] Resultado da API:`, JSON.stringify(addresses));

    if (addresses && addresses.length > 0) {
      const addr = addresses[0];

      // Formatar endereço completo
      const parts = [];
      if (addr.street) parts.push(addr.street);
      if (addr.streetNumber) parts.push(addr.streetNumber);
      if (addr.district) parts.push(addr.district);
      if (addr.city) parts.push(addr.city);
      if (addr.region) parts.push(addr.region);

      const formattedAddress = parts.length > 0 ? parts.join(', ') : 'Endereço não disponível';

      console.log(`[Geocoding] Endereço formatado: ${formattedAddress}`);

      return {
        street: addr.street || null,
        neighborhood: addr.district || addr.subregion || null,
        city: addr.city || null,
        state: addr.region || null,
        postalCode: addr.postalCode || null,
        formattedAddress,
      };
    }

    console.log('[Geocoding] Nenhum endereço retornado pela API');

    return {
      street: null,
      neighborhood: null,
      city: null,
      state: null,
      postalCode: null,
      formattedAddress: 'Endereço não disponível',
    };
  } catch (error) {
    console.error('[Geocoding] Erro na geocodificação reversa:', error);
    return {
      street: null,
      neighborhood: null,
      city: null,
      state: null,
      postalCode: null,
      formattedAddress: 'Erro ao obter endereço',
    };
  }
}

/**
 * Converte coordenadas GPS (lat/long) para UTM
 */
export interface UTMCoordinates {
  x: number;
  y: number;
  zone: string;
  hemisphere: 'N' | 'S';
}

export function latLongToUTM(latitude: number, longitude: number): UTMCoordinates {
  // Determinar zona UTM
  const zoneNumber = Math.floor((longitude + 180) / 6) + 1;
  const hemisphere = latitude >= 0 ? 'N' : 'S';

  // Constantes do WGS84
  const a = 6378137.0; // Semi-eixo maior (metros)
  const e = 0.081819190842622; // Excentricidade
  const k0 = 0.9996; // Fator de escala

  // Converter para radianos
  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;

  // Meridiano central da zona
  const lonOrigin = ((zoneNumber - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const lonDiff = lonRad - lonOrigin;

  // Cálculos intermediários
  const N = a / Math.sqrt(1 - Math.pow(e * Math.sin(latRad), 2));
  const T = Math.pow(Math.tan(latRad), 2);
  const C = (Math.pow(e, 2) / (1 - Math.pow(e, 2))) * Math.pow(Math.cos(latRad), 2);
  const A = lonDiff * Math.cos(latRad);

  const M =
    a *
    ((1 - Math.pow(e, 2) / 4 - (3 * Math.pow(e, 4)) / 64 - (5 * Math.pow(e, 6)) / 256) * latRad -
      ((3 * Math.pow(e, 2)) / 8 + (3 * Math.pow(e, 4)) / 32 + (45 * Math.pow(e, 6)) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * Math.pow(e, 4)) / 256 + (45 * Math.pow(e, 6)) / 1024) * Math.sin(4 * latRad) -
      ((35 * Math.pow(e, 6)) / 3072) * Math.sin(6 * latRad));

  // Calcular coordenadas UTM
  let x =
    k0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + Math.pow(T, 2) + 72 * C - 58 * (Math.pow(e, 2) / (1 - Math.pow(e, 2)))) *
          Math.pow(A, 5)) /
          120) +
    500000.0; // False Easting

  let y =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        (Math.pow(A, 2) / 2 +
          ((5 - T + 9 * C + 4 * Math.pow(C, 2)) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + Math.pow(T, 2) + 600 * C - 330 * (Math.pow(e, 2) / (1 - Math.pow(e, 2)))) *
            Math.pow(A, 6)) /
            720));

  // Ajustar para hemisfério sul
  if (latitude < 0) {
    y += 10000000.0; // False Northing para hemisfério sul
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    zone: `${zoneNumber}${hemisphere}`,
    hemisphere,
  };
}

/**
 * Formatar coordenadas UTM para exibição
 */
export function formatUTM(utm: UTMCoordinates): string {
  return `${utm.zone} ${utm.x.toLocaleString()}E ${utm.y.toLocaleString()}N`;
}
