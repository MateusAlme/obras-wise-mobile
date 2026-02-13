import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getAddressFromCoords, latLongToUTM, formatUTM } from './geocoding';

interface WatermarkData {
  obraNumero: string;
  tipoServico: string;
  equipe: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Adiciona placa de informações no canto inferior esquerdo da foto
 */
export async function addWatermarkToPhoto(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  try {
    // Obter informações de localização
    let utmText = 'UTM: N/A';
    let addressText = 'Localização não disponível';

    if (data.latitude && data.longitude) {
      // Calcular UTM
      const utm = latLongToUTM(data.latitude, data.longitude);
      utmText = formatUTM(utm);

      // Obter endereço (com timeout)
      try {
        const address = await Promise.race([
          getAddressFromCoords(data.latitude, data.longitude),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
        ]);

        if (address && address.formattedAddress !== 'Endereço não disponível') {
          addressText = address.formattedAddress;
        }
      } catch (error) {
        console.log('Erro ao obter endereço:', error);
      }
    }

    // Formatar data/hora
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Criar SVG com as informações (será sobreposto na foto)
    const svgMarkup = `
<svg width="100%" height="100%">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="0" dy="1" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.5"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Fundo semitransparente -->
  <rect x="10" y="calc(100% - 180)" width="400" height="170" rx="8"
        fill="rgba(0, 0, 0, 0.75)" stroke="rgba(37, 99, 235, 0.8)" stroke-width="2"/>

  <!-- Cabeçalho -->
  <rect x="10" y="calc(100% - 180)" width="400" height="30" rx="8" fill="rgba(37, 99, 235, 0.9)"/>
  <text x="210" y="calc(100% - 162)"
        font-family="Arial, sans-serif" font-size="14" font-weight="bold"
        fill="white" text-anchor="middle">
    REGISTRO DE OBRA
  </text>

  <!-- Conteúdo -->
  <text x="20" y="calc(100% - 140)" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#9ca3af">Data/Hora:</text>
  <text x="100" y="calc(100% - 140)" font-family="Arial, sans-serif" font-size="12" fill="white">${dateStr} às ${timeStr}</text>

  <text x="20" y="calc(100% - 120)" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#9ca3af">Obra:</text>
  <text x="100" y="calc(100% - 120)" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#60a5fa">${data.obraNumero || 'N/A'}</text>

  <text x="20" y="calc(100% - 100)" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#9ca3af">Serviço:</text>
  <text x="100" y="calc(100% - 100)" font-family="Arial, sans-serif" font-size="12" fill="white">${data.tipoServico}</text>

  <text x="20" y="calc(100% - 80)" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#9ca3af">Equipe:</text>
  <text x="100" y="calc(100% - 80)" font-family="Arial, sans-serif" font-size="12" fill="white">${data.equipe}</text>

  <line x1="20" y1="calc(100% - 68)" x2="390" y2="calc(100% - 68)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1"/>

  <text x="20" y="calc(100% - 50)" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#9ca3af">UTM:</text>
  <text x="100" y="calc(100% - 50)" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#34d399">${utmText}</text>

  <text x="20" y="calc(100% - 30)" font-family="Arial, sans-serif" font-size="11" fill="#d1d5db">${addressText}</text>
</svg>
    `.trim();

    // Como expo-image-manipulator não suporta SVG overlay diretamente,
    // vamos criar uma abordagem diferente: salvar os dados como texto em um arquivo
    // e processar a imagem com as informações

    // Por enquanto, retornar a URI original
    // TODO: Implementar overlay real usando Canvas nativo ou biblioteca de watermark
    return photoUri;

  } catch (error) {
    console.error('Erro ao adicionar watermark:', error);
    return photoUri; // Retornar URI original em caso de erro
  }
}

/**
 * Versão simplificada: adiciona texto simples na foto
 * Usando expo-image-manipulator com overlay de texto básico
 */
export async function addSimpleWatermark(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  try {
    // Formatar data/hora
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Obter UTM
    let utmText = '';
    if (data.latitude && data.longitude) {
      const utm = latLongToUTM(data.latitude, data.longitude);
      utmText = formatUTM(utm);
    }

    // Criar arquivo temporário com metadados
    const metadataPath = `${FileSystem.cacheDirectory}photo_metadata_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(
      metadataPath,
      JSON.stringify({
        dateTime: `${dateStr} ${timeStr}`,
        obra: data.obraNumero || 'N/A',
        servico: data.tipoServico,
        equipe: data.equipe,
        utm: utmText,
        hasLocation: !!(data.latitude && data.longitude),
      })
    );

    // Por enquanto, retornar URI original
    // A renderização da placa será feita no componente
    return photoUri;

  } catch (error) {
    console.error('Erro ao processar watermark:', error);
    return photoUri;
  }
}
