# Verificar Configuração do Storage no Supabase

## Problema Identificado

Erro: **"unknown image format"** ao carregar imagens

## Possíveis Causas

### 1. Bucket não é público
O bucket `obra-photos` precisa ser público para as URLs funcionarem.

### 2. URLs corrompidas nos logs (bug visual)
Os logs mostram URLs com caracteres duplicados, mas isso pode ser apenas um bug de visualização do console.

## Como Verificar

### Passo 1: Testar URL Diretamente no Navegador

Abra essa URL no navegador (Chrome/Firefox):
```
https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obra-photos/dc4ca687-2ccc-493a-bdaf-8eeb5a32ff2d/abertura_1763554395246_x111bubh1_0.jpg
```

**Resultado esperado**: A imagem deve aparecer
**Se der erro 404 ou 403**: Problema de permissões

### Passo 2: Verificar Configurações do Bucket

1. Acesse: **Supabase Dashboard** → **Storage**
2. Clique no bucket **obra-photos**
3. Clique no ícone de **engrenagem** (settings)
4. Verifique:
   - ✅ **Public bucket**: Deve estar MARCADO
   - ✅ **Allowed MIME types**: Deve incluir `image/*` ou `image/jpeg`

### Passo 3: Verificar Políticas de Acesso (RLS)

1. Acesse: **Supabase Dashboard** → **Storage** → **Policies**
2. Deve ter uma política permitindo SELECT público:

```sql
-- Policy name: "Public Access"
-- Allowed operation: SELECT
-- Policy definition:
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'obra-photos');
```

## Correção se Bucket não é Público

### Opção 1: Tornar Bucket Público (Recomendado)

1. **Storage** → **obra-photos** → **Settings**
2. Marcar **"Public bucket"**
3. Salvar

### Opção 2: Adicionar Policy de Acesso Público

Execute no **SQL Editor**:

```sql
-- Permitir acesso público para leitura
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'obra-photos');
```

## Teste Após Correção

1. Recarregar app mobile
2. Abrir obra 12345678
3. Verificar se imagens aparecem
4. Verificar logs: `✅ Image loaded` (sucesso) ou `❌ Image load error` (falha)

## URLs Observadas nos Logs

**No banco (correto):**
```
obra-photos/dc4ca687-.../abertura_xxx.jpg
```

**Nos logs (aparentemente corrompido):**
```
obra-phottos/...  (t duplicado)
obra--photos/...  (hífen duplicado)
```

**Nota**: Isso pode ser apenas um bug de visualização do console do Expo. A URL real passada para o componente Image pode estar correta.

## Verificação de Formato de Arquivo

O erro "unknown image format" também pode ocorrer se:
- Arquivo não é uma imagem válida
- Arquivo está corrompido
- Content-Type incorreto no storage

### Verificar Arquivo Diretamente

No **Supabase Storage** → **obra-photos** → pasta do usuário:
- Clicar no arquivo `abertura_xxx.jpg`
- Clicar em **Download** ou **View**
- Verificar se é uma imagem válida
