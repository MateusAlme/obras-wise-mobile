// Tipos
export interface Address {
  formattedAddress: string
  street?: string
  number?: string
  district?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

export interface UTMCoordinates {
  x: number
  y: number
  zone: string
  hemisphere: 'N' | 'S'
}

/**
 * Converte coordenadas GPS (latitude/longitude) para endereço usando Nominatim (OpenStreetMap)
 *
 * IMPORTANTE:
 * - Nominatim é gratuito mas requer header User-Agent
 * - Limite de 1 requisição/segundo
 * - Requer internet ativa
 */
export async function getAddressFromCoords(
  latitude: number,
  longitude: number
): Promise<Address> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=pt-BR`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WA-Gestao-Obras-Web/1.0', // OBRIGATÓRIO para Nominatim
      },
    })

    if (!response.ok) {
      throw new Error(`Erro na geocodificação: ${response.status}`)
    }

    const data = await response.json()

    if (!data.address) {
      return { formattedAddress: 'Endereço não disponível' }
    }

    // Formatar endereço
    const parts: string[] = []
    if (data.address.road) parts.push(data.address.road)
    if (data.address.house_number) parts.push(data.address.house_number)
    if (data.address.suburb) parts.push(data.address.suburb)
    if (data.address.city || data.address.town || data.address.village) {
      parts.push(data.address.city || data.address.town || data.address.village)
    }
    if (data.address.state) parts.push(data.address.state)

    return {
      formattedAddress: parts.length > 0 ? parts.join(', ') : 'Endereço não disponível',
      street: data.address.road,
      number: data.address.house_number,
      district: data.address.suburb,
      city: data.address.city || data.address.town || data.address.village,
      state: data.address.state,
      country: data.address.country,
      postalCode: data.address.postcode,
    }
  } catch (error) {
    console.error('Erro ao buscar endereço:', error)
    return { formattedAddress: 'Endereço não disponível' }
  }
}

/**
 * Converte coordenadas GPS (latitude/longitude) para UTM (Universal Transverse Mercator)
 *
 * Sistema de referência: WGS84
 * Funciona OFFLINE (não precisa de internet)
 *
 * @param latitude - Latitude em graus decimais (-90 a 90)
 * @param longitude - Longitude em graus decimais (-180 a 180)
 * @returns Coordenadas UTM com zona
 */
export function latLongToUTM(latitude: number, longitude: number): UTMCoordinates {
  // Determinar zona UTM
  const zoneNumber = Math.floor((longitude + 180) / 6) + 1
  const hemisphere: 'N' | 'S' = latitude >= 0 ? 'N' : 'S'

  // Constantes do elipsóide WGS84
  const a = 6378137.0 // Semi-eixo maior (metros)
  const e = 0.081819190842622 // Excentricidade
  const e2 = e * e // Excentricidade ao quadrado
  const k0 = 0.9996 // Fator de escala no meridiano central

  // Converter graus para radianos
  const latRad = (latitude * Math.PI) / 180
  const lonRad = (longitude * Math.PI) / 180

  // Meridiano central da zona
  const lonOrigin = ((zoneNumber - 1) * 6 - 180 + 3) * (Math.PI / 180)
  const lonDiff = lonRad - lonOrigin

  // Cálculos intermediários
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad))
  const T = Math.tan(latRad) * Math.tan(latRad)
  const C = (e2 / (1 - e2)) * Math.cos(latRad) * Math.cos(latRad)
  const A = lonDiff * Math.cos(latRad)

  // Meridional arc
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * latRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * latRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latRad))

  // Coordenadas UTM
  let x =
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * (e2 / (1 - e2))) * A * A * A * A * A) / 120) +
    500000.0

  let y =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * (e2 / (1 - e2))) * A * A * A * A * A * A) / 720))

  // Ajustar para hemisfério sul
  if (hemisphere === 'S') {
    y += 10000000.0
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    zone: `${zoneNumber}${hemisphere}`,
    hemisphere,
  }
}

/**
 * Formata coordenadas UTM para exibição
 *
 * Exemplo: "24S 555,123E 7,234,567N"
 */
export function formatUTM(utm: UTMCoordinates): string {
  const xFormatted = utm.x.toLocaleString('pt-BR')
  const yFormatted = utm.y.toLocaleString('pt-BR')
  return `${utm.zone} ${xFormatted}E ${yFormatted}N`
}

/**
 * Valida se coordenadas GPS são válidas
 */
export function isValidGPS(latitude?: number | null, longitude?: number | null): boolean {
  if (latitude == null || longitude == null) return false
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}
