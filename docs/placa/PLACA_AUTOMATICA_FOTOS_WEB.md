# Sistema de Placa Automática em Fotos - Dashboard Web

## Visão Geral

O dashboard web agora possui **placa automática em todas as fotos**, assim como o app mobile. As placas exibem metadados georreferenciados (GPS, UTM, endereço) junto com informações da obra (número, equipe, serviço, data/hora).

---

## Arquitetura da Solução

### Componentes Criados

```
web/src/
├── components/
│   ├── PhotoWithPlaca.tsx       # Componente de foto com placa (thumbnail + fullscreen)
│   ├── PhotoModal.tsx            # Modal fullscreen para visualizar fotos
│   └── PhotoGallery.tsx          # Galeria de fotos com modal
├── lib/
│   ├── geocoding.ts              # Biblioteca de geocodificação (GPS → Endereço, GPS → UTM)
│   ├── pdf-generator.ts          # Gerador de PDF (atualizado com placa)
│   └── supabase.ts               # Tipos atualizados (FotoInfo com placaData)
└── app/
    └── obra/[id]/page.tsx        # Página de detalhes da obra com fotos
```

---

## 1. Componente PhotoWithPlaca

**Arquivo:** [web/src/components/PhotoWithPlaca.tsx](../web/src/components/PhotoWithPlaca.tsx)

### Props

```typescript
interface PhotoWithPlacaProps {
  url: string                     // URL da foto
  obraNumero?: string             // Número da obra
  tipoServico?: string            // Tipo de serviço
  equipe?: string                 // Nome da equipe
  latitude?: number | null        // GPS Latitude
  longitude?: number | null       // GPS Longitude
  utmX?: number | null            // UTM X (opcional)
  utmY?: number | null            // UTM Y (opcional)
  utmZone?: string | null         // Zona UTM
  dateTime?: string               // Data/hora customizada
  isFullscreen?: boolean          // true = placa completa, false = badge
  className?: string              // Classes CSS adicionais
}
```

### Dois Modos de Exibição

#### Modo Thumbnail (`isFullscreen={false}`)
- Badge compacto no canto inferior esquerdo
- Exibe obra número e data/hora
- Ideal para galerias e listagens

#### Modo Fullscreen (`isFullscreen={true}`)
- Placa completa com todos os dados
- Geocodificação assíncrona (endereço)
- Cálculo automático de UTM
- Coordenadas GPS
- Ideal para modal de visualização

### Geocodificação Automática

```typescript
useEffect(() => {
  loadAddress()
}, [latitude, longitude])

async function loadAddress() {
  if (!latitude || !longitude) return

  // Timeout de 5 segundos
  const addr = await Promise.race([
    getAddressFromCoords(latitude, longitude),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ])

  if (addr?.formattedAddress) {
    setAddress(addr.formattedAddress)
  }
}
```

---

## 2. Biblioteca de Geocodificação

**Arquivo:** [web/src/lib/geocoding.ts](../web/src/lib/geocoding.ts)

### Funções Disponíveis

#### `getAddressFromCoords(latitude, longitude)`
- **API:** Nominatim (OpenStreetMap) - GRATUITA
- **Requer:** Header `User-Agent`, internet ativa
- **Limite:** 1 requisição/segundo
- **Retorna:** Endereço formatado em português

**Exemplo de uso:**
```typescript
const address = await getAddressFromCoords(-23.550520, -46.633308)
// Retorna: "Rua Augusta, 123, Consolação, São Paulo, SP"
```

#### `latLongToUTM(latitude, longitude)`
- **Sistema:** WGS84
- **Offline:** SIM (não precisa de internet)
- **Retorna:** Coordenadas UTM com zona

**Exemplo de uso:**
```typescript
const utm = latLongToUTM(-23.550520, -46.633308)
// Retorna: { x: 333958, y: 7395876, zone: "23K", hemisphere: "S" }
```

#### `formatUTM(utm)`
- Formata coordenadas UTM para exibição

**Exemplo de uso:**
```typescript
const formatted = formatUTM(utm)
// Retorna: "23K 333,958E 7,395,876N"
```

---

## 3. Componente PhotoModal

**Arquivo:** [web/src/components/PhotoModal.tsx](../web/src/components/PhotoModal.tsx)

### Funcionalidades

- Modal fullscreen com fundo escuro
- Botão de fechar (X) no canto superior direito
- Fechar com tecla `ESC`
- Fechar clicando fora da foto
- Previne scroll do body quando aberto
- Exibe foto com placa completa

### Uso

```tsx
const [selectedPhoto, setSelectedPhoto] = useState<FotoInfo | null>(null)

<PhotoModal
  isOpen={selectedPhoto !== null}
  onClose={() => setSelectedPhoto(null)}
  photo={selectedPhoto}
  obraNumero="2024-001"
  tipoServico="Linha Morta"
  equipe="Equipe Alpha"
/>
```

---

## 4. Componente PhotoGallery

**Arquivo:** [web/src/components/PhotoGallery.tsx](../web/src/components/PhotoGallery.tsx)

### Funcionalidades

- Grid responsivo de fotos (2-5 colunas conforme tela)
- Thumbnail com badge
- Hover effect (zoom + ícone de lupa)
- Clique para abrir em fullscreen
- Contador de fotos no título
- Modal integrado

### Uso

```tsx
<PhotoGallery
  photos={obra.fotos_antes || []}
  obraNumero={obra.obra}
  tipoServico={obra.tipo_servico}
  equipe={obra.equipe}
  title="Fotos Antes"
/>
```

**Grid Responsivo:**
- Mobile: 2 colunas
- Tablet (sm): 3 colunas
- Desktop (md): 4 colunas
- Desktop grande (lg): 5 colunas

---

## 5. Geração de PDF com Placa

**Arquivo:** [web/src/lib/pdf-generator.ts](../web/src/lib/pdf-generator.ts)

### Função `renderPhotoWithPlaca()`

Renderiza foto com placa usando **Canvas API**:

1. Carrega imagem da URL
2. Cria canvas com mesma dimensão
3. Desenha imagem no canvas
4. Desenha placa sobre a imagem:
   - Fundo preto semi-transparente
   - Borda azul
   - Textos: obra, data/hora, serviço, equipe
   - UTM (se GPS disponível)
5. Converte canvas para data URL (JPEG)
6. Retorna imagem com placa para o PDF

### Placa no PDF

- **Posição:** Canto inferior esquerdo
- **Largura:** 35% da imagem (máx. 300px)
- **Conteúdo:**
  - Obra número
  - Data/hora (do placaData ou da obra)
  - Tipo de serviço (truncado em 20 chars)
  - Equipe
  - UTM (se GPS disponível)

### Tamanho das Imagens no PDF

- **Largura:** 160mm
- **Altura:** 120mm
- **Qualidade JPEG:** 85%

---

## 6. Estrutura de Dados

### Tipo `FotoInfo` (atualizado)

**Arquivo:** [web/src/lib/supabase.ts](../web/src/lib/supabase.ts)

```typescript
export interface FotoInfo {
  url: string                     // URL da foto no Supabase Storage
  latitude?: number | null        // GPS Latitude
  longitude?: number | null       // GPS Longitude
  placaData?: {                   // Snapshot dos dados no momento da captura
    obraNumero?: string
    tipoServico?: string
    equipe?: string
    dataHora?: string             // Formatado: "26/12/2024, 14:30"
  } | null
}
```

### Compatibilidade com Fotos Antigas

O sistema suporta **3 formatos de dados**:

#### 1. Formato Novo (com GPS e placaData)
```json
{
  "url": "https://supabase.co/.../foto.jpg",
  "latitude": -23.550520,
  "longitude": -46.633308,
  "placaData": {
    "obraNumero": "2024-001",
    "tipoServico": "Linha Morta",
    "equipe": "Equipe Alpha",
    "dataHora": "26/12/2024, 14:30"
  }
}
```

#### 2. Formato Intermediário (só GPS)
```json
{
  "url": "https://supabase.co/.../foto.jpg",
  "latitude": -23.550520,
  "longitude": -46.633308
}
```

#### 3. Formato Antigo (só URL - string)
```json
"https://supabase.co/.../foto.jpg"
```

### Fallback de Dados

Se `placaData` não existir, usa dados da obra:
```typescript
const obraNumero = photo.placaData?.obraNumero || obra.obra
const tipoServico = photo.placaData?.tipoServico || obra.tipo_servico
const equipe = photo.placaData?.equipe || obra.equipe
```

---

## 7. Página de Detalhes da Obra

**Arquivo:** [web/src/app/obra/[id]/page.tsx](../web/src/app/obra/[id]/page.tsx)

### Rota

```
/obra/[id]
```

Onde `[id]` é o UUID da obra.

### Funcionalidades

- Carrega obra do Supabase por ID
- Exibe informações básicas (responsável, serviço, atipicidades)
- Exibe todas as seções de fotos:
  - Fotos Antes/Durante/Depois
  - Abertura/Fechamento de Chave
  - Método DITAIS (5 etapas)
  - Book de Aterramento (4 fotos)
  - Transformador (9 fotos + status)
  - Medidor (5 fotos)
  - Checklist de Fiscalização (9 fotos)
  - Altimetria (4 fotos)
  - Vazamento e Limpeza (7 fotos)

### Navegação

- Botão "Voltar ao Dashboard" no topo
- Sidebar sempre visível
- Loading state enquanto carrega
- Mensagem de erro se obra não encontrada

---

## 8. Fluxo de Dados Completo

### 1. Captura no Mobile

```
App Mobile (nova-obra.tsx)
    ↓
Captura GPS + Foto + Snapshot (placaData)
    ↓
Upload para Supabase Storage
    ↓
Salva no banco: { url, latitude, longitude, placaData }
```

### 2. Visualização no Web

```
Dashboard Web
    ↓
Busca obra do Supabase
    ↓
PhotoGallery renderiza thumbnails com badge
    ↓
Usuário clica em foto
    ↓
PhotoModal abre com PhotoWithPlaca (fullscreen)
    ↓
PhotoWithPlaca busca endereço (geocodificação assíncrona)
    ↓
Exibe placa completa com todos os dados
```

### 3. Geração de PDF

```
Usuário clica "Baixar PDFs"
    ↓
Para cada obra:
    ↓
Para cada foto:
    ↓
renderPhotoWithPlaca() cria canvas com placa
    ↓
Converte canvas para JPEG
    ↓
Adiciona imagem ao PDF
    ↓
Salva PDF com nome: Obra_[nome]_[equipe]_[data].pdf
```

---

## 9. Estilo Visual da Placa

### Cores

```css
/* Fundo */
background: rgba(0, 0, 0, 0.88)     /* Preto semi-transparente */

/* Borda */
border: 2px solid rgba(37, 99, 235, 0.7)  /* Azul semi-transparente */

/* Texto - Labels */
color: #9ca3af                       /* Cinza */

/* Texto - Valores */
color: #ffffff                       /* Branco */

/* UTM */
color: #34d399                       /* Verde */

/* Endereço */
color: #e2e8f0                       /* Cinza claro */
```

### Tipografia

- **Labels:** Arial 12px regular
- **Valores:** Arial 13px bold
- **UTM:** Monospace 11px
- **Endereço:** Arial 10px

### Layout

```
┌──────────────────────────┐
│ 📍 Registro Fotográfico  │  ← Header com ícone
├──────────────────────────┤
│ Obra:        2024-001    │
│ Data/Hora:   26/12 14:30 │
│ Serviço:     Linha Morta │
│ Equipe:      Equipe A    │
├──────────────────────────┤  ← Separador
│ UTM:  24S 555,123E ...   │  ← Verde
│ Endereço: Rua Exemplo... │  ← Cinza claro
├──────────────────────────┤
│ GPS: -23.550520, -46... │  ← Footer (micro)
└──────────────────────────┘
```

---

## 10. Performance e Otimizações

### Geocodificação

- **Timeout:** 5 segundos (evita travamento)
- **Assíncrona:** Não bloqueia UI
- **Cache:** Implementar cache de endereços (futura melhoria)

### Renderização de Canvas

- **Quality JPEG:** 0.85 (balanço entre qualidade e tamanho)
- **Lazy loading:** Fotos carregadas sob demanda
- **Batch processing:** PDFs gerados com delay de 500ms entre obras

### Nominatim API

- **Limite:** 1 req/s (respeitado com delays)
- **Header obrigatório:** `User-Agent: WA-Gestao-Obras-Web/1.0`
- **Fallback:** Se erro, não exibe endereço (graceful degradation)

---

## 11. Como Testar

### 1. Testar Componente PhotoWithPlaca

```bash
cd web
npm run dev
```

Acesse: `http://localhost:3000/obra/[id-de-uma-obra]`

### 2. Testar Geração de PDF

1. Acesse `/reports`
2. Selecione filtros (equipe, período)
3. Clique "Baixar PDFs das Obras"
4. Verifique se PDFs têm fotos com placa

### 3. Testar Modal Fullscreen

1. Acesse `/obra/[id]`
2. Clique em qualquer foto
3. Verifique:
   - Placa completa exibida
   - Endereço sendo buscado (se GPS disponível)
   - Tecla ESC fecha modal
   - Clique fora fecha modal

---

## 12. Troubleshooting

### Placa não aparece no PDF

**Causa:** Problema no canvas ou CORS

**Solução:**
1. Verificar se imagens do Supabase têm CORS habilitado
2. Verificar console do navegador por erros
3. Verificar se `crossOrigin = 'anonymous'` está configurado

### Endereço não carrega

**Causa:** Nominatim API lenta ou bloqueada

**Solução:**
1. Verificar internet ativa
2. Verificar header `User-Agent` na requisição
3. Verificar timeout (5s padrão)
4. Verificar rate limit (máx. 1 req/s)

### Fotos antigas sem placa

**Causa:** Formato antigo (só URL string)

**Solução:**
- Sistema tem fallback automático
- Usa dados da obra quando `placaData` não existe
- UTM calculado em tempo real se GPS disponível

---

## 13. Próximas Melhorias

### Curto Prazo
- [ ] Cache de endereços (Map ou localStorage)
- [ ] Indicador de progresso na geocodificação
- [ ] Lazy loading de imagens na galeria
- [ ] Paginação de fotos (se > 50 fotos)

### Médio Prazo
- [ ] API de geocodificação própria (evitar limite Nominatim)
- [ ] Otimização de imagens (resize server-side)
- [ ] Download de PDF em background (Web Worker)
- [ ] Compressão de PDFs (reduzir tamanho)

### Longo Prazo
- [ ] Edição de metadados de fotos
- [ ] Comparação de fotos (antes/depois lado a lado)
- [ ] Exportação de fotos em lote (ZIP)
- [ ] Marcação de fotos favoritas

---

## 14. Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] Verificar variáveis de ambiente (Supabase URL/Key)
- [ ] Testar geração de PDF com 10+ obras
- [ ] Testar modal em diferentes navegadores
- [ ] Verificar responsividade mobile/tablet/desktop
- [ ] Validar CORS do Supabase Storage
- [ ] Verificar rate limit do Nominatim
- [ ] Testar compatibilidade com fotos antigas
- [ ] Verificar performance com 100+ fotos
- [ ] Documentar limites de uso do Nominatim
- [ ] Configurar fallback de geocodificação

---

## 15. Referências

### APIs Utilizadas
- [Nominatim API (OpenStreetMap)](https://nominatim.org/release-docs/develop/api/Overview/)
- [Canvas API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [jsPDF Documentation](https://artskydj.github.io/jsPDF/docs/)

### Bibliotecas
- `jspdf` - Geração de PDFs
- `date-fns` - Formatação de datas
- `@supabase/supabase-js` - Cliente Supabase

### Fórmulas
- [Conversão GPS → UTM (WGS84)](https://en.wikipedia.org/wiki/Universal_Transverse_Mercator_coordinate_system)

---

**Documentação criada em:** 26/12/2024
**Última atualização:** 26/12/2024
**Versão:** 1.0.0
