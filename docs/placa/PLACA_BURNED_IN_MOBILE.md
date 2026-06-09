# Placa Automática "Gravada" (Burned-In) nas Fotos - Mobile

## Visão Geral

A partir de agora, a **placa de informações é gravada permanentemente na foto durante a captura** no app mobile, usando renderização nativa com Skia Canvas.

Isso significa que a foto salva no Supabase Storage **já contém a placa visível**, não apenas como overlay, mas como parte permanente da imagem.

---

## Diferença: Overlay vs Burned-In

### ❌ **Antes: Placa como Overlay**
- Placa era renderizada apenas visualmente no app
- Foto original salva SEM placa
- PDFs e compartilhamentos não mostravam a placa
- Dependia de metadata (placaData) para recriar overlay

### ✅ **Agora: Placa Burned-In (Gravada)**
- Placa é desenhada DIRETAMENTE na imagem
- Foto salva JÁ TEM a placa visível
- PDFs, compartilhamentos e visualizações mostram a placa
- Não depende de overlay visual
- Funciona em qualquer lugar (WhatsApp, email, impressão)

---

## Arquitetura da Solução

### Bibliotecas Utilizadas

```json
{
  "@shopify/react-native-skia": "2.2.12"  // Canvas nativo para React Native
}
```

### Fluxo de Captura de Foto

```
1. Usuário tira foto                              [ImagePicker]
        ↓
2. App obtém GPS (latitude/longitude)            [expo-location]
        ↓
3. App prepara placaData                          [nova-obra.tsx]
        ↓
4. App renderiza foto + placa usando Skia         [photo-with-placa.ts]
   - Carrega imagem original
   - Desenha placa sobre a foto
   - Calcula UTM
   - Busca endereço (assíncrono, 3s timeout)
   - Salva nova imagem com placa
        ↓
5. App faz backup da foto (com placa)             [photo-backup.ts]
        ↓
6. Foto sincronizada para Supabase Storage        [photo-queue.ts]
```

---

## Implementação Técnica

### 1. Arquivo: `photo-with-placa.ts`

**Função Principal:** `renderPhotoWithPlacaBurnedIn()`

```typescript
export async function renderPhotoWithPlacaBurnedIn(
  imageUri: string,
  placaData: PlacaData
): Promise<string>
```

**Parâmetros:**
- `imageUri` - URI da foto original (do ImagePicker)
- `placaData` - Dados para exibir na placa

**Retorno:**
- URI da nova foto com placa gravada

**Processo:**

1. **Calcular UTM** (se GPS disponível)
2. **Buscar endereço** via Nominatim (timeout 3s)
3. **Carregar imagem** original usando FileSystem
4. **Criar Surface Skia** com mesmas dimensões
5. **Desenhar imagem** original no canvas
6. **Desenhar placa** sobre a imagem:
   - Fundo preto semi-transparente
   - Borda azul
   - Textos (obra, data, serviço, equipe, UTM, endereço)
7. **Salvar** nova imagem no cache
8. **Retornar** URI da nova foto

### 2. Estrutura `PlacaData`

```typescript
export interface PlacaData {
  obraNumero: string      // Nome da obra
  tipoServico: string     // Tipo de serviço
  equipe: string          // Nome da equipe
  dataHora: string        // Data/hora formatada (dd/MM/yyyy HH:mm)
  latitude?: number       // GPS Latitude
  longitude?: number      // GPS Longitude
}
```

### 3. Integração em `nova-obra.tsx`

**Linha ~578-603:**

```typescript
// Preparar dados da placa
const placaData = {
  obraNumero: obra || tempObraId.substring(0, 8),
  tipoServico: Array.isArray(tipoServico) ? tipoServico[0] : tipoServico || 'Obra',
  equipe: nomeEquipe || 'Equipe',
  dataHora: new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
  latitude: location.latitude,
  longitude: location.longitude,
};

// Renderizar foto com placa "gravada" (burned-in)
let photoUri = result.assets[0].uri;
try {
  const photoWithPlaca = await renderPhotoWithPlacaBurnedIn(photoUri, placaData);
  photoUri = photoWithPlaca; // Usar foto com placa se sucesso
  console.log('✅ Placa gravada na foto');
} catch (error) {
  console.warn('⚠️ Erro ao gravar placa, usando foto original:', error);
  // Continua com foto original
}
```

---

## Design da Placa

### Posicionamento

- **Localização:** Canto inferior esquerdo
- **Distância:** 20px da borda
- **Largura:** 40% da imagem (máximo 480px)
- **Altura:** Dinâmica (baseada no número de linhas)

### Cores

```typescript
// Fundo
bgPaint.setColor(Skia.Color('rgba(0, 0, 0, 0.88)'))  // Preto semi-transparente

// Borda
borderPaint.setColor(Skia.Color('rgba(37, 99, 235, 0.7)'))  // Azul
borderPaint.setStrokeWidth(3)

// Texto - Labels (cinza)
labelPaint.setColor(Skia.Color('#9ca3af'))

// Texto - Valores (branco)
valuePaint.setColor(Skia.Color('#ffffff'))

// UTM (verde)
utmPaint.setColor(Skia.Color('#34d399'))
```

### Tipografia

- **Labels:** Font 16px
- **Valores:** Font 20px
- **Bold:** Obra e Equipe
- **Truncagem:** Serviço (20 chars), Endereço (30 chars)

### Layout da Placa

```
┌────────────────────────────────┐
│  ╔══════════════════════════╗  │
│  ║ Obra:     2024-001       ║  │ (Bold)
│  ║ Data:     26/12 14:30    ║  │
│  ║ Serviço:  Linha Morta    ║  │
│  ║ Equipe:   Equipe Alpha   ║  │ (Bold)
│  ║ UTM:      24S 555,123E...|  │ (Verde)
│  ║ Local:    Rua Exemplo... ║  │
│  ╚══════════════════════════╝  │
└────────────────────────────────┘
       ↑ 20px da borda inferior
```

---

## Geocodificação Assíncrona

### Busca de Endereço

**API:** Nominatim (OpenStreetMap) - Gratuita
**Timeout:** 3 segundos (para não travar)
**Fallback:** Se falhar, não exibe endereço

```typescript
const addr = await Promise.race([
  getAddressFromCoords(latitude, longitude),
  new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
])
```

### Cálculo de UTM

**Offline:** SIM (não precisa de internet)
**Sistema:** WGS84
**Formato:** `24S 555,123E 7,234,567N`

```typescript
const utm = latLongToUTM(latitude, longitude)
const utmDisplay = formatUTM(utm)
```

---

## Performance e Otimizações

### Tempo de Renderização

- **Sem endereço:** ~500ms
- **Com endereço:** ~3.5s (máximo)
- **Fallback:** Se erro, retorna foto original

### Tamanho do Arquivo

- **Foto original:** ~200KB (quality: 0.6)
- **Foto com placa:** ~220KB (+10%)
- **Encoding:** JPEG Base64 → 85% quality

### Tratamento de Erros

```typescript
try {
  const photoWithPlaca = await renderPhotoWithPlacaBurnedIn(photoUri, placaData);
  photoUri = photoWithPlaca;
  console.log('✅ Placa gravada na foto');
} catch (error) {
  console.warn('⚠️ Erro ao gravar placa, usando foto original:', error);
  // App continua com foto SEM placa (graceful degradation)
}
```

---

## Vantagens e Desvantagens

### ✅ **Vantagens**

1. **Placa permanente**
   - Foto sempre mostra informações, independente do app

2. **Compartilhamento**
   - WhatsApp, email, impressão mostram placa

3. **PDFs**
   - Relatórios têm fotos com placa sem processing extra

4. **Prova documental**
   - Foto serve como evidência com metadados visíveis

5. **Independência**
   - Não depende de metadata JSON (placaData)

### ⚠️ **Desvantagens**

1. **Delay na captura**
   - 3.5s extras (se buscar endereço)
   - Solução: Timeout de 3s, assíncrono

2. **Arquivo maior**
   - ~10% maior
   - Solução: Ainda comprimido (quality 60%)

3. **Irreversível**
   - Placa não pode ser removida depois
   - Solução: Guardar metadata JSON também (futuro)

---

## Compatibilidade

### Dashboard Web

O dashboard web agora pode exibir fotos com placa de **2 formas**:

1. **Fotos antigas (sem placa burned-in):**
   - Renderiza overlay usando PhotoWithPlaca.tsx

2. **Fotos novas (com placa burned-in):**
   - Exibe diretamente (placa já está na imagem)
   - Pode adicionar overlay extra se necessário

### PDFs

- Gerador de PDF detecta se foto já tem placa
- Se tiver, exibe direto
- Se não tiver, renderiza placa usando canvas (web)

---

## Como Testar

### 1. Testar Captura de Foto

```bash
cd mobile
npx expo start
```

1. Abra app no dispositivo físico (GPS real)
2. Crie nova obra
3. Tire uma foto
4. Aguarde 3-5 segundos (renderização + upload)
5. Visualize foto capturada
6. Verifique se placa está visível no canto inferior esquerdo

### 2. Verificar Placa Gravada

- Foto deve mostrar placa MESMO fora do app
- Compartilhe foto via WhatsApp → placa deve estar visível
- Abra foto na galeria do celular → placa deve estar visível

### 3. Verificar Logs

```
✅ Placa gravada na foto
✅ Foto com placa gravada: file:///cache/photo_with_placa_12345.jpg
```

### 4. Verificar Supabase Storage

- Acesse Supabase Storage
- Baixe foto uploaded
- Verifique se placa está visível

---

## Troubleshooting

### Placa não aparece na foto

**Causa:** Erro no Skia ou FileSystem

**Solução:**
1. Verificar logs do console
2. Se erro, foto original é usada (fallback)
3. Placa ainda pode ser vista via overlay no app

### Endereço não carrega

**Causa:** Sem internet ou Nominatim lento

**Solução:**
- Timeout de 3s garante que não trava
- Se falhar, placa exibe sem endereço (apenas UTM)

### Renderização demora muito

**Causa:** Geocodificação lenta

**Solução:**
- Timeout já implementado (3s)
- Considerar desabilitar endereço (só UTM) se problema persistir

### Foto fica borrada

**Causa:** Encoding/quality baixo

**Solução:**
- Verificar quality do snapshot.encodeToBase64()
- Atualmente em 85% (bom balanço)

---

## Melhorias Futuras

### Curto Prazo
- [ ] Opção para desabilitar geocodificação (só UTM)
- [ ] Indicador visual de "Gravando placa..." (loading)
- [ ] Cache de endereços (evitar requisições duplicadas)

### Médio Prazo
- [ ] Customização da placa (cor, posição, tamanho)
- [ ] Múltiplos idiomas (i18n)
- [ ] Modo "placa leve" (só obra + data)

### Longo Prazo
- [ ] Edição de placa (re-renderizar com novos dados)
- [ ] Marca d'água adicional (logo da empresa)
- [ ] QR code com link para obra online

---

## Referências

### Bibliotecas
- [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/) - Canvas nativo
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) - Manipulação de arquivos
- [expo-location](https://docs.expo.dev/versions/latest/sdk/location/) - GPS

### APIs
- [Nominatim (OpenStreetMap)](https://nominatim.org/) - Geocodificação reversa

### Conversões
- [GPS → UTM (WGS84)](https://en.wikipedia.org/wiki/Universal_Transverse_Mercator_coordinate_system)

---

**Documentação criada em:** 26/12/2024
**Última atualização:** 26/12/2024
**Versão:** 1.0.0
**Biblioteca Skia:** 2.2.12
