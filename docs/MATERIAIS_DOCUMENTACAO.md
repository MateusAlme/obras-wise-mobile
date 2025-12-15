# Documentação de Materiais (Previsto/Realizado)

## Visão Geral

Sistema de upload de documentos PDF para registro de materiais planejados (previsto) e materiais efetivamente utilizados (realizado) em obras de serviço de documentação.

## Funcionalidades

### 1. Upload de PDFs

Permite anexar documentos PDF em duas categorias:

- **Materiais Previsto**: Documentos contendo a lista de materiais planejados para a obra
- **Materiais Realizado**: Documentos contendo a lista de materiais efetivamente utilizados

### 2. Armazenamento

- PDFs são salvos no Supabase Storage
- Metadados armazenados em formato JSONB na tabela `obras`
- Cada documento inclui:
  - URL do arquivo no storage
  - Coordenadas GPS (latitude/longitude) - se disponíveis
  - ID único da foto/documento

### 3. Visualização

- Lista de documentos anexados com numeração
- Botão de remoção (×) para cada documento
- Indicador visual (✅) quando há documentos anexados
- Funciona tanto para criação de novas obras quanto edição

## Arquivos Modificados

### `mobile/app/nova-obra.tsx`

**Estados adicionados** (linhas 189-190):
```typescript
const [docMateriaisPrevisto, setDocMateriaisPrevisto] = useState<FotoData[]>([]);
const [docMateriaisRealizado, setDocMateriaisRealizado] = useState<FotoData[]>([]);
```

**Função `selectDocument` atualizada** (linhas 998-1002):
- Adicionados tipos `'doc_materiais_previsto'` e `'doc_materiais_realizado'`
- Cálculo de índice (linhas 1030-1031)
- Atualização de arrays (linhas 1073-1076)

**Função `removePhoto` atualizada** (linhas 1110-1111):
- Adicionados tipos na assinatura
- Casos de remoção (linhas 1271-1274)

**Função `handleSalvarObra` atualizada** (linhas 1468-1469):
- Inclusão no objeto `photoIds` para salvar no banco

**useEffect para edição atualizado** (linhas 427-428):
- Carregamento de documentos ao editar obra existente

**UI adicionada** (linhas 4952-5014):
- Seção "9. Materiais Previsto"
- Seção "10. Materiais Realizado"
- Botões de seleção de PDF
- Lista de documentos com opção de remoção

## Arquivos Criados

### `supabase/migrations/20250216_adicionar_materiais_documentacao.sql`

Migration que adiciona as colunas ao banco de dados:

```sql
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS doc_materiais_previsto jsonb DEFAULT '[]'::jsonb;

ALTER TABLE obras
ADD COLUMN IF NOT EXISTS doc_materiais_realizado jsonb DEFAULT '[]'::jsonb;
```

**Comentários adicionados**:
- `doc_materiais_previsto`: Array JSONB com URLs de documentos de materiais planejados
- `doc_materiais_realizado`: Array JSONB com URLs de documentos de materiais utilizados

**Verificação automática**:
- Script verifica se as colunas foram criadas com sucesso
- Exibe mensagens de confirmação ou erro

### `scripts/database/aplicar-materiais-documentacao.bat`

Script batch para aplicar a migration no Supabase:

```batch
supabase db push
```

## Como Usar

### 1. Aplicar Migration no Banco

Execute o script batch:

```
cd scripts/database
aplicar-materiais-documentacao.bat
```

Ou manualmente:
```
cd C:\Users\Mateus Almeida\obras-wise-mobile
supabase db push
```

### 2. Usar no Aplicativo Mobile

1. Abra o app e vá em "Nova Obra" ou edite uma obra existente
2. Selecione "Documentação" como tipo de serviço
3. Role até as seções "Materiais Previsto" e "Materiais Realizado"
4. Clique em "Selecionar PDF" para anexar documentos
5. Remova documentos clicando no botão "×" se necessário
6. Salve a obra - os documentos serão enviados ao Supabase Storage

### 3. Visualização no Dashboard Web

**NOTA**: O dashboard web ainda precisa ser atualizado para exibir estes documentos.

Arquivos que precisam de atualização:
- `web/src/app/dashboard/obras/[id]/page.tsx` - Exibir documentos na página de detalhes
- `web/src/components/ObraDetails.tsx` - Adicionar seções de materiais (se aplicável)

## Fluxo Técnico

### Upload de Documento

```typescript
selectDocument('doc_materiais_previsto')
  → DocumentPicker.getDocumentAsync()
  → backupPhoto() // Faz upload para storage
  → setDocMateriaisPrevisto([...array, docData]) // Adiciona ao array
```

### Salvamento

```typescript
handleSalvarObra()
  → photoIds.doc_materiais_previsto = docMateriaisPrevisto.map(f => f.photoId)
  → saveObraToDatabase(obraData) // Salva no Supabase
```

### Carregamento (Edição)

```typescript
useEffect()
  → loadObraData(obraId)
  → setDocMateriaisPrevisto(obraData.doc_materiais_previsto.map(...))
```

## Estrutura de Dados

### Formato no Banco (JSONB)

```json
[
  {
    "url": "https://supabase.co/storage/v1/object/public/...",
    "photoId": "uuid-da-foto",
    "latitude": -7.123456,
    "longitude": -38.654321
  }
]
```

### Formato no Estado (FotoData)

```typescript
interface FotoData {
  uri: string;          // URL do documento
  photoId: string;      // ID único
  latitude?: number;    // Coordenada GPS
  longitude?: number;   // Coordenada GPS
}
```

## Validações

- ✅ Apenas serviços do tipo "Documentação" exibem essas seções
- ✅ Upload bloqueado durante processamento (uploadingPhoto = true)
- ✅ Múltiplos documentos podem ser anexados em cada categoria
- ✅ Funciona em modo offline (salvamento pendente)
- ✅ Sincronização automática quando online

## Dependências

- `expo-document-picker`: Seleção de arquivos PDF
- `expo-file-system`: Manipulação de arquivos
- Supabase Storage: Armazenamento de documentos
- Supabase Database: Metadados em JSONB

## Testes

### Casos de Teste

1. **Upload de documento - Materiais Previsto**
   - Criar nova obra com tipo "Documentação"
   - Selecionar PDF na seção "Materiais Previsto"
   - Verificar se aparece na lista
   - Salvar obra
   - Verificar se foi salvo no banco

2. **Upload de documento - Materiais Realizado**
   - Mesmo processo para "Materiais Realizado"

3. **Múltiplos documentos**
   - Anexar 3+ documentos em cada categoria
   - Verificar numeração (Documento 1, 2, 3...)
   - Salvar e verificar todos foram salvos

4. **Remoção de documento**
   - Anexar 3 documentos
   - Remover o documento 2
   - Verificar que apenas 1 e 3 permanecem
   - Salvar e verificar no banco

5. **Edição de obra existente**
   - Editar obra que já tem documentos anexados
   - Verificar se documentos aparecem corretamente
   - Adicionar novo documento
   - Remover documento existente
   - Salvar e verificar alterações

6. **Modo offline**
   - Desconectar internet
   - Criar obra com documentos
   - Verificar salvamento pendente
   - Reconectar
   - Verificar sincronização

## Próximas Melhorias

- [ ] Visualização prévia de PDF no app mobile
- [ ] Download de PDF do storage
- [ ] Compartilhamento de documentos
- [ ] Exibição no dashboard web
- [ ] Busca por conteúdo de PDF (OCR)
- [ ] Compressão de PDFs grandes
- [ ] Limite de tamanho por documento

## Suporte

Para problemas ou dúvidas:
- Código mobile: `mobile/app/nova-obra.tsx` (linhas 189-190, 998-1076, 1110-1274, 1468-1469, 427-428, 4952-5014)
- Migration: `supabase/migrations/20250216_adicionar_materiais_documentacao.sql`
- Script de aplicação: `scripts/database/aplicar-materiais-documentacao.bat`
