# Placa Automática em Fotos de Serviço

## Visão Geral

Sistema de registro automático de informações da obra em todas as fotos de serviço capturadas no aplicativo mobile. Após tirar qualquer foto, o sistema exibe uma "placa" sobreposta com:

- 📋 **Dados da Obra** (número, tipo de serviço, equipe)
- 📅 **Data e Hora** (captura automática do momento da foto)
- 📍 **Localização UTM** (conversão automática de GPS para coordenadas UTM)
- 🏠 **Endereço** (geocodificação reversa baseada na localização GPS)

## Funcionalidades

### 1. Captura Automática de Localização

Quando o usuário tira uma foto de serviço, o sistema automaticamente:

1. **Solicita localização GPS** usando `expo-location`
2. **Converte para coordenadas UTM** usando algoritmo WGS84
3. **Obtém endereço** através de geocodificação reversa
4. **Exibe todos os dados** em uma placa sobreposta à foto

### 2. Placa de Informações

A placa exibida contém:

```
┌─────────────────────────────────────┐
│      REGISTRO DE OBRA               │
├─────────────────────────────────────┤
│ Data/Hora: 15/12/2025 às 14:30      │
│ Obra: 24M 561817-9243785            │
│ Serviço: Transformador              │
│ Equipe: CNT 01                      │
├─────────────────────────────────────┤
│        LOCALIZAÇÃO                  │
├─────────────────────────────────────┤
│ UTM: 24L 555123E 9234567N           │
│ GPS: -7.123456, -38.654321          │
│ Endereço: Rua das Flores, 123       │
│          Centro, Cajazeiras - PB    │
└─────────────────────────────────────┘
       [🔄 Refazer]  [✓ Confirmar]
```

### 3. Opções do Usuário

Após visualizar a placa, o usuário pode:

- **✓ Confirmar**: Salva a foto com todos os dados registrados
- **🔄 Refazer**: Descarta a foto e tira novamente

## Arquivos Criados

### 1. `mobile/lib/geocoding.ts`

Biblioteca de utilitários para localização:

**Funções:**

- `getAddressFromCoords(latitude, longitude)`: Geocodificação reversa (GPS → endereço)
- `latLongToUTM(latitude, longitude)`: Conversão GPS → UTM
- `formatUTM(utm)`: Formatação de coordenadas UTM para exibição

**Interfaces:**

```typescript
interface Address {
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  formattedAddress: string;
}

interface UTMCoordinates {
  x: number;
  y: number;
  zone: string;
  hemisphere: 'N' | 'S';
}
```

### 2. `mobile/components/PlacaObraOverlay.tsx`

Componente React Native que exibe a placa sobreposta:

**Props:**

```typescript
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
```

**Recursos:**

- Modal em tela cheia com foto de fundo
- Carregamento assíncrono de endereço
- Cálculo automático de UTM
- Design responsivo e acessível
- Botões de ação bem visíveis

### 3. Modificações em `mobile/app/nova-obra.tsx`

**Novos Estados:**

```typescript
const [showPlacaOverlay, setShowPlacaOverlay] = useState(false);
const [pendingPhoto, setPendingPhoto] = useState<{
  uri: string;
  tipo: string;
  location: { latitude: number | null; longitude: number | null };
  photoMetadata: any;
  posteIndex?: number;
  seccionamentoIndex?: number;
  aterramentoCercaIndex?: number;
} | null>(null);
```

**Novas Funções:**

- `handlePlacaConfirm()`: Confirma a foto e adiciona aos arrays
- `handlePlacaRetake()`: Refaz a foto

**Fluxo Modificado:**

```
Antes:
takePicture() → Backup → Adicionar ao array → Alert

Agora:
takePicture() → Backup → Guardar pendente → Mostrar Placa
  └─→ Confirmar → Adicionar ao array
  └─→ Refazer → takePicture() novamente
```

## Fluxo Técnico

### 1. Captura de Foto

```typescript
const takePicture = async (tipo: string, ...) => {
  // 1. Tirar foto
  const result = await ImagePicker.launchCameraAsync({...});

  // 2. Obter localização GPS
  const location = await getCurrentLocation();

  // 3. Fazer backup com UTM
  const photoMetadata = await backupPhoto(
    result.assets[0].uri,
    tempObraId,
    tipo,
    index,
    location.latitude,
    location.longitude
  );

  // 4. Guardar pendente e mostrar placa
  setPendingPhoto({
    uri: result.assets[0].uri,
    tipo,
    location,
    photoMetadata,
    ...
  });
  setShowPlacaOverlay(true);
}
```

### 2. Exibição da Placa

```typescript
<PlacaObraOverlay
  visible={showPlacaOverlay}
  photoUri={pendingPhoto.uri}
  obraNumero={obra}
  tipoServico={tipoServico}
  equipe={equipe}
  latitude={pendingPhoto.location.latitude}
  longitude={pendingPhoto.location.longitude}
  onConfirm={handlePlacaConfirm}
  onRetake={handlePlacaRetake}
/>
```

### 3. Confirmação

```typescript
const handlePlacaConfirm = () => {
  // Criar objeto FotoData com todos os metadados
  const photoData: FotoData = {
    uri: pendingPhoto.uri,
    latitude: location.latitude,
    longitude: location.longitude,
    utmX: photoMetadata.utmX,
    utmY: photoMetadata.utmY,
    utmZone: photoMetadata.utmZone,
    photoId: photoMetadata.id,
  };

  // Adicionar ao array correspondente
  setFotosAntes(prev => [...prev, photoData]);

  // Limpar e fechar
  setPendingPhoto(null);
  setShowPlacaOverlay(false);
}
```

## Algoritmo de Conversão UTM

O sistema usa o algoritmo de conversão WGS84 para converter coordenadas GPS (latitude/longitude) em UTM:

### Parâmetros WGS84:
- **Semi-eixo maior (a)**: 6.378.137 metros
- **Excentricidade (e)**: 0.081819190842622
- **Fator de escala (k0)**: 0.9996

### Cálculo da Zona UTM:
```
zona = floor((longitude + 180) / 6) + 1
hemisfério = latitude >= 0 ? 'N' : 'S'
```

### Coordenadas UTM:
- **Easting (X)**: Distância horizontal do meridiano central (0-1.000.000m)
- **Northing (Y)**: Distância vertical do equador
- **Zona**: Número + letra (ex: "24L")

**Exemplo:**
```
GPS: -7.123456, -38.654321
UTM: 24L 555123E 9214567N
```

## Geocodificação Reversa

Utiliza `expo-location` para converter coordenadas em endereço:

```typescript
const addresses = await Location.reverseGeocodeAsync({
  latitude,
  longitude,
});

// Retorna:
{
  street: "Rua das Flores",
  district: "Centro",
  city: "Cajazeiras",
  region: "Paraíba",
  postalCode: "58900-000"
}
```

## Benefícios

### 1. Rastreabilidade Completa
- Todas as fotos têm localização precisa
- Registro de data/hora exato
- Vínculo claro com a obra

### 2. Transparência
- Usuário vê todos os dados antes de confirmar
- Pode refazer se localização estiver errada
- Endereço legível confirma a localização

### 3. Conformidade
- Coordenadas UTM para uso técnico
- GPS para integração com mapas
- Endereço para comunicação com clientes

### 4. Experiência do Usuário
- Processo visual e intuitivo
- Feedback imediato da localização
- Opção de refazer se necessário

## Tratamento de Erros

### Sem permissão de localização:
```
Foto salva sem coordenadas
Placa mostra: "Localização não disponível"
```

### Erro na geocodificação:
```
UTM: Calculado normalmente
GPS: Exibido normalmente
Endereço: "Endereço não disponível"
```

### Sem conexão de internet:
- GPS e UTM funcionam offline
- Geocodificação pode falhar (exibe erro gracioso)

## Próximas Melhorias

### 1. Precisão de Localização
- [ ] Indicador visual de precisão GPS
- [ ] Aguardar precisão < 10m antes de capturar
- [ ] Opção de recapturar localização

### 2. Exportação
- [ ] Exportar placa como imagem sobreposta
- [ ] PDF com placa + foto lado a lado
- [ ] Watermark com dados na própria foto

### 3. Validação
- [ ] Alertar se localização muito distante da obra anterior
- [ ] Histórico de localizações da obra
- [ ] Detecção de movimento suspeito

## Dependências

- `expo-location`: Localização GPS e geocodificação
- `react-native`: Framework mobile
- `expo-image-picker`: Captura de fotos

## Testes

### Teste Manual:

1. **Tirar foto de serviço**
   - Abrir app mobile
   - Ir em "Nova Obra" ou editar obra existente
   - Clicar em qualquer botão "Tirar Foto"
   - Verificar se placa aparece

2. **Verificar dados**
   - Conferir data/hora
   - Conferir número da obra
   - Conferir tipo de serviço
   - Conferir equipe

3. **Verificar localização**
   - Conferir coordenadas UTM
   - Conferir GPS
   - Conferir se endereço está correto

4. **Testar ações**
   - Clicar em "Refazer" → deve abrir câmera novamente
   - Clicar em "Confirmar" → deve salvar foto e fechar placa

### Casos de Teste:

- ✅ Foto com localização precisa
- ✅ Foto sem permissão de localização
- ✅ Foto com erro na geocodificação
- ✅ Foto offline (sem internet)
- ✅ Refazer foto
- ✅ Múltiplas fotos seguidas

## Suporte

Para problemas ou dúvidas, consulte:
- Código: `mobile/components/PlacaObraOverlay.tsx`
- Utilitários: `mobile/lib/geocoding.ts`
- Integração: `mobile/app/nova-obra.tsx` (linhas 643-992, 4695-4708)
