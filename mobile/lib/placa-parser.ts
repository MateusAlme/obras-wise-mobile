/**
 * Parser para extrair informações de placas de obra
 * Formato esperado:
 *
 * DD.MM.YYYY
 * 24M 561817-9243785
 * 190 Sitio Almas
 * Cajazeiras
 * Paraiba
 */

export interface PlacaInfo {
  data: string;
  obra: string;
  localizacao: string;
  municipio: string;
  estado: string;
}

/**
 * Extrai informações de texto OCR da placa
 */
export const parsePlacaText = (text: string): PlacaInfo | null => {
  try {
    // Limpar texto: remover caracteres especiais e normalizar espaços
    const cleanText = text
      .replace(/\n+/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length < 3) {
      console.warn('Texto da placa muito curto:', lines);
      return null;
    }

    // Extrair informações
    const data = extractData(lines);
    const obra = extractObra(lines);
    const localizacao = extractLocalizacao(lines);
    const municipio = extractMunicipio(lines);
    const estado = extractEstado(lines);

    // Validar se pelo menos obra foi encontrada
    if (!obra) {
      console.warn('Número da obra não encontrado');
      return null;
    }

    return {
      data: data || '',
      obra,
      localizacao: localizacao || '',
      municipio: municipio || '',
      estado: estado || ''
    };

  } catch (error) {
    console.error('Erro ao parsear texto da placa:', error);
    return null;
  }
};

/**
 * Extrai data no formato DD.MM.YYYY ou DD/MM/YYYY
 */
const extractData = (lines: string[]): string | null => {
  // Procurar por padrão de data nas primeiras 3 linhas
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i];

    // Padrão: DD.MM.YYYY ou DD/MM/YYYY
    const dateMatch = line.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (dateMatch) {
      const [_, day, month, year] = dateMatch;
      return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
    }
  }

  return null;
};

/**
 * Extrai número da obra
 * Formatos: "24M 561817-9243785", "561817-9243785", "24M-561817-9243785"
 */
const extractObra = (lines: string[]): string | null => {
  // Procurar por padrão de obra (números separados por hífen ou espaço)
  for (const line of lines) {
    // Remover espaços para facilitar
    const normalized = line.replace(/\s+/g, ' ');

    // Padrão: prefixo opcional + números-números
    // Ex: "24M 561817-9243785" ou "561817-9243785"
    const obraMatch = normalized.match(/([A-Z0-9]+\s+)?(\d+[-\s]\d+)/i);
    if (obraMatch) {
      const prefix = obraMatch[1] ? obraMatch[1].trim() : '';
      const numbers = obraMatch[2].replace(/\s/g, '-');
      return prefix ? `${prefix} ${numbers}` : numbers;
    }

    // Padrão alternativo: apenas números longos (mais de 6 dígitos)
    const longNumberMatch = normalized.match(/\b(\d{6,})\b/);
    if (longNumberMatch) {
      return longNumberMatch[1];
    }
  }

  return null;
};

/**
 * Extrai localização (linha após o número da obra)
 * Ex: "190 Sitio Almas"
 */
const extractLocalizacao = (lines: string[]): string | null => {
  // Procurar linha da obra primeiro
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];

    // Se encontrou padrão de obra, próxima linha pode ser localização
    if (/\d+[-\s]\d+/.test(line) || /\d{6,}/.test(line)) {
      const nextLine = lines[i + 1];

      // Verificar se próxima linha não é município ou estado conhecido
      if (nextLine && !isKnownCity(nextLine) && !isKnownState(nextLine)) {
        return nextLine;
      }
    }
  }

  // Fallback: procurar linha que comece com número + texto
  for (const line of lines) {
    if (/^\d+\s+[A-Za-z]/.test(line)) {
      return line;
    }
  }

  return null;
};

/**
 * Extrai município
 */
const extractMunicipio = (lines: string[]): string | null => {
  // Procurar por cidades conhecidas ou padrão de cidade
  for (const line of lines) {
    if (isKnownCity(line)) {
      return line;
    }
  }

  // Fallback: penúltima ou antepenúltima linha (antes do estado)
  if (lines.length >= 3) {
    const candidato = lines[lines.length - 2];
    if (!isKnownState(candidato)) {
      return candidato;
    }
  }

  return null;
};

/**
 * Extrai estado
 */
const extractEstado = (lines: string[]): string | null => {
  // Procurar por estados conhecidos
  for (const line of lines) {
    if (isKnownState(line)) {
      return normalizeState(line);
    }
  }

  // Fallback: última linha
  if (lines.length > 0) {
    return normalizeState(lines[lines.length - 1]);
  }

  return null;
};

/**
 * Verifica se é uma cidade conhecida da Paraíba
 */
const isKnownCity = (text: string): boolean => {
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  const cities = [
    'cajazeiras', 'souza', 'pombal', 'patos', 'joaopessoa', 'campina',
    'campinagrande', 'guarabira', 'itabaiana', 'monteiro', 'princesaisabel'
  ];

  return cities.some(city => normalized.includes(city.toLowerCase()));
};

/**
 * Verifica se é um estado conhecido
 */
const isKnownState = (text: string): boolean => {
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  const states = [
    'paraiba', 'paraíba', 'pb',
    'pernambuco', 'pe',
    'ceara', 'ceará', 'ce',
    'riograndedonorte', 'rn',
    'alagoas', 'al',
    'sergipe', 'se',
    'bahia', 'ba'
  ];

  return states.some(state => normalized.includes(state));
};

/**
 * Normaliza nome do estado
 */
const normalizeState = (text: string): string => {
  const normalized = text.toLowerCase().replace(/\s+/g, '');

  const stateMap: Record<string, string> = {
    'paraiba': 'Paraíba',
    'paraíba': 'Paraíba',
    'pb': 'Paraíba',
    'pernambuco': 'Pernambuco',
    'pe': 'Pernambuco',
    'ceara': 'Ceará',
    'ceará': 'Ceará',
    'ce': 'Ceará',
    'riograndedonorte': 'Rio Grande do Norte',
    'rn': 'Rio Grande do Norte',
    'alagoas': 'Alagoas',
    'al': 'Alagoas',
    'sergipe': 'Sergipe',
    'se': 'Sergipe',
    'bahia': 'Bahia',
    'ba': 'Bahia'
  };

  for (const [key, value] of Object.entries(stateMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Se não encontrou, retornar capitalizado
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Exemplo de uso manual (para testar sem OCR)
 */
export const parseManualPlacaInput = (text: string): PlacaInfo | null => {
  return parsePlacaText(text);
};

/**
 * Valida se o resultado do parser é válido
 */
export const isValidPlacaInfo = (info: PlacaInfo | null): boolean => {
  if (!info) return false;

  // Obra é obrigatória
  if (!info.obra || info.obra.length < 5) return false;

  return true;
};
