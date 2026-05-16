# Scanner de Placa da Obra

## 📋 Funcionalidade

Sistema para capturar automaticamente informações da placa de identificação da obra através de foto ou digitação manual.

## 🎯 Objetivo

Facilitar o preenchimento dos dados da obra ao permitir que o usuário:
1. Tire uma foto da placa da obra
2. Digite manualmente o texto da placa
3. Tenha os campos preenchidos automaticamente

## 📸 Formato Esperado da Placa

```
22.10.2025
24M 561817-9243785
190 Sitio Almas
Cajazeiras
Paraiba
```

**Campos extraídos:**
- **Data**: DD.MM.YYYY ou DD/MM/YYYY
- **Obra**: Número da obra (com ou sem prefixo)
- **Localização**: Endereço/local da obra
- **Município**: Cidade
- **Estado**: Estado (detecta automaticamente estados do nordeste)

## 🔧 Componentes Criados

### 1. **PlacaScanner** (`mobile/components/PlacaScanner.tsx`)

Modal com 3 opções:
- 📷 **Tirar Foto**: Abre câmera para fotografar a placa
- 🖼️ **Escolher da Galeria**: Seleciona foto existente
- ⌨️ **Digitar Manualmente**: Campo de texto para entrada manual

**Props:**
```typescript
interface PlacaScannerProps {
  visible: boolean;
  onClose: () => void;
  onPlacaDetected: (info: PlacaInfo) => void;
}
```

### 2. **placa-parser.ts** (`mobile/lib/placa-parser.ts`)

Parser inteligente que extrai informações da placa.

**Funções principais:**
- `parsePlacaText(text: string)`: Processa texto e extrai informações
- `isValidPlacaInfo(info: PlacaInfo)`: Valida se os dados extraídos são válidos

**Interface:**
```typescript
interface PlacaInfo {
  data: string;           // DD.MM.YYYY
  obra: string;           // Número da obra
  localizacao: string;    // Endereço/local
  municipio: string;      // Cidade
  estado: string;         // Estado
}
```

## 🎨 Integração na Tela Nova Obra

### Botão de Acesso

Na tela `nova-obra.tsx`, antes do campo "Número da Obra":

```tsx
<TouchableOpacity
  style={styles.scanPlacaButton}
  onPress={() => setShowPlacaScanner(true)}
>
  <Text style={styles.scanPlacaButtonIcon}>📋</Text>
  <Text style={styles.scanPlacaButtonText}>Escanear Placa da Obra</Text>
</TouchableOpacity>
```

### Handler de Callback

Quando a placa é processada:

```typescript
const handlePlacaDetected = (placaInfo: PlacaInfo) => {
  // Preenche data (converte DD.MM.YYYY para YYYY-MM-DD)
  if (placaInfo.data) {
    const [day, month, year] = placaInfo.data.split('.');
    setData(`${year}-${month}-${day}`);
  }

  // Preenche número da obra
  if (placaInfo.obra) {
    setObra(placaInfo.obra);
  }

  // Mostra confirmação com todas as informações
  Alert.alert('Informações Capturadas!', ...);
};
```

## 📝 Algoritmo de Parsing

### Extração de Data
- Procura padrão `DD.MM.YYYY` ou `DD/MM/YYYY` nas primeiras 3 linhas
- Normaliza para formato `DD.MM.YYYY`

### Extração de Obra
Detecta padrões:
- `24M 561817-9243785` (prefixo + números)
- `561817-9243785` (apenas números separados)
- `5618179243785` (números longos, 6+ dígitos)

### Extração de Localização
- Busca linha após o número da obra
- Ignora se for cidade ou estado conhecido
- Fallback: linha começando com número + texto (ex: "190 Sitio Almas")

### Extração de Município
- Lista de cidades conhecidas da Paraíba
- Fallback: penúltima linha (antes do estado)

### Extração de Estado
- Detecta automaticamente estados do nordeste:
  - Paraíba, Pernambuco, Ceará, Rio Grande do Norte
  - Alagoas, Sergipe, Bahia
- Aceita siglas (PB, PE, CE, RN, AL, SE, BA)
- Normaliza para nome completo com acentos

## 🚀 Fluxo de Uso

1. **Usuário clica em "Escanear Placa da Obra"**
2. **Modal PlacaScanner abre** com 3 opções
3. **Usuário escolhe uma opção:**
   - Tirar foto → Câmera abre → Foto capturada
   - Galeria → Seletor abre → Imagem selecionada
   - Manual → Campo de texto aparece

4. **Entrada manual é solicitada** (por enquanto, OCR real requer build)
5. **Usuário digita texto da placa** (linha por linha)
6. **Clica em "Processar"**
7. **Parser extrai informações**
8. **Se válido:**
   - Preenche campos automaticamente
   - Mostra Alert com confirmação
   - Fecha modal
9. **Se inválido:**
   - Mostra Alert com formato esperado
   - Permite tentar novamente

## 🔮 Futuras Melhorias

### OCR Real (Requer Build Nativo)

Para habilitar OCR automático sem entrada manual:

1. **Usar `react-native-vision-camera`** + `vision-camera-ocr`:
   ```bash
   npx expo install react-native-vision-camera vision-camera-ocr
   ```

2. **Configurar no `app.json`**:
   ```json
   {
     "expo": {
       "plugins": [
         [
           "react-native-vision-camera",
           {
             "cameraPermissionText": "Permitir acesso à câmera para escanear placas"
           }
         ]
       ]
     }
   }
   ```

3. **Processar frame em tempo real**:
   ```typescript
   const frameProcessor = useFrameProcessor((frame) => {
     'worklet';
     const scannedText = scanOCR(frame);
     runOnJS(onTextDetected)(scannedText);
   }, []);
   ```

### Melhorias no Parser

- Suporte a mais formatos de data
- Detecção de mais cidades/estados
- Validação de número de obra com padrões conhecidos
- Correção automática de erros comuns do OCR

## ⚠️ Limitações Atuais

1. **Expo Go não suporta OCR nativo**
   - Solução atual: entrada manual do texto
   - Para OCR real: necessário fazer build (EAS Build)

2. **Parser é baseado em padrões**
   - Funciona bem com placas padronizadas
   - Pode falhar com formatos muito diferentes

3. **Apenas estados do nordeste**
   - Fácil de expandir adicionando em `isKnownState()`

## 📊 Exemplos de Uso

### Entrada Manual Bem-Sucedida

```
22.10.2025
24M 561817-9243785
190 Sitio Almas
Cajazeiras
Paraiba
```

**Resultado:**
```typescript
{
  data: "22.10.2025",
  obra: "24M 561817-9243785",
  localizacao: "190 Sitio Almas",
  municipio: "Cajazeiras",
  estado: "Paraíba"
}
```

### Variações Aceitas

```
// Sem prefixo
22/10/2025
561817-9243785
Rua Principal 100
Sousa
PB

// Números contínuos
22.10.2025
5618179243785
Centro
Patos
Paraíba
```

## 🛠️ Arquivos Modificados/Criados

### Criados
- ✅ `mobile/components/PlacaScanner.tsx` - Componente modal do scanner
- ✅ `mobile/lib/placa-parser.ts` - Lógica de parsing
- ✅ `docs/SCANNER_PLACA_OBRA.md` - Esta documentação

### Modificados
- ✅ `mobile/app/nova-obra.tsx`:
  - Import do PlacaScanner e PlacaInfo
  - Estado `showPlacaScanner`
  - Função `handlePlacaDetected`
  - Botão "Escanear Placa da Obra"
  - Componente PlacaScanner no render
  - Estilos do botão

## 📱 Testes

### Teste Manual
1. Abra a tela de Nova Obra
2. Clique em "Escanear Placa da Obra"
3. Escolha "Digitar Manualmente"
4. Cole o texto exemplo:
   ```
   22.10.2025
   24M 561817-9243785
   190 Sitio Almas
   Cajazeiras
   Paraiba
   ```
5. Clique em "Processar"
6. Verifique se campos foram preenchidos:
   - Data: 22/10/2025
   - Obra: 24M 561817-9243785

### Teste de Validação
- Tente com texto inválido → deve mostrar alerta de erro
- Tente com apenas número da obra → deve aceitar (obra é obrigatória)
- Tente sem número da obra → deve rejeitar
