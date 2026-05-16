# 📸 Arquitetura de Armazenamento de Fotos - ObrasWise

## 🎯 Como Funciona Atualmente

### Arquitetura em 2 Camadas:

```
┌─────────────────────────────────────────────┐
│          MOBILE APP (React Native)          │
│  1. Usuário tira foto                       │
│  2. Foto comprimida (quality 0.6)           │
│  3. GPS capturado                           │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│       SUPABASE STORAGE (Armazenamento)      │
│  - Foto armazenada em: obra-photos/         │
│  - Estrutura: user_id/obra_id/foto.jpg      │
│  - URL pública gerada                       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│     SUPABASE DATABASE (PostgreSQL)          │
│  Tabela: obras                              │
│  Campo: fotos_antes (JSONB)                 │
│  {                                          │
│    url: "https://...supabase.co/foto.jpg"  │
│    latitude: -15.7234,                      │
│    longitude: -47.8826                      │
│  }                                          │
└─────────────────────────────────────────────┘
```

---

## 💾 O que fica no Banco de Dados?

### ❌ **NÃO** fica no banco:
- ❌ A foto em si (arquivo binário)
- ❌ Imagem em base64
- ❌ Bytes da foto

### ✅ **SIM** fica no banco:
- ✅ **URL** da foto no Supabase Storage
- ✅ **Coordenadas GPS** (latitude, longitude)
- ✅ **Metadados** da obra

### Exemplo de dado no banco:

```json
// Campo: fotos_antes (JSONB)
[
  {
    "url": "https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obra-photos/abc123/obra456/antes_1234_0.jpg",
    "latitude": -15.7234567,
    "longitude": -47.8826543
  },
  {
    "url": "https://hiuagpzaelcocyxutgdt.supabase.co/storage/v1/object/public/obra-photos/abc123/obra456/antes_1234_1.jpg",
    "latitude": -15.7234789,
    "longitude": -47.8826789
  }
]
```

---

## 🗂️ Estrutura de Armazenamento

### No Supabase Storage:

```
obra-photos/
├── user_abc123/
│   ├── obra_0032401637/
│   │   ├── antes_1705234567_0.jpg      (500 KB)
│   │   ├── antes_1705234567_1.jpg      (450 KB)
│   │   ├── durante_1705234567_0.jpg    (600 KB)
│   │   ├── depois_1705234567_0.jpg     (550 KB)
│   │   └── ...
│   ├── obra_0032401638/
│   │   └── ...
└── user_def456/
    └── ...
```

### No PostgreSQL (Supabase Database):

```sql
-- Tabela: obras
id                    UUID
obra                  VARCHAR  "0032401637"
data                  DATE     "2025-01-18"
responsavel           VARCHAR  "João Silva"
equipe                VARCHAR  "CNT 01"
fotos_antes           JSONB    [{"url": "...", "latitude": ..., "longitude": ...}]
fotos_durante         JSONB    [{"url": "...", "latitude": ..., "longitude": ...}]
fotos_depois          JSONB    [...]
fotos_abertura        JSONB    [...]
fotos_fechamento      JSONB    [...]
fotos_ditais_abertura JSONB    [...]
...
```

---

## 📊 Prós e Contras da Arquitetura Atual

### ✅ **Vantagens:**

1. **Separação de Responsabilidades**
   - Banco: apenas referências e metadados (rápido)
   - Storage: arquivos grandes (otimizado para isso)

2. **Performance**
   - Queries no banco são rápidas (não tem blobs)
   - Fotos servidas por CDN do Supabase

3. **Escalabilidade**
   - Storage cresce independente do banco
   - Fácil fazer backup só das fotos

4. **Custo**
   - Banco pequeno (só texto/JSON)
   - Storage com preço por GB usado

5. **Flexibilidade**
   - Pode mudar Storage sem mexer no banco
   - URLs públicas fáceis de compartilhar

### ⚠️ **Desvantagens:**

1. **Dependência de 2 Sistemas**
   - Se Storage cair, fotos ficam inacessíveis
   - Precisa sincronizar banco + storage

2. **Custo de Storage**
   - Supabase cobra por armazenamento
   - Quanto mais fotos, maior o custo

3. **URLs Públicas**
   - Qualquer um com a URL acessa a foto
   - Não tem autenticação (por enquanto)

---

## 💰 Custos Atuais (Supabase)

### Plano Gratuito:
- ✅ **500 MB** de Storage
- ✅ 2 GB de transferência/mês
- ✅ **~500-1000 fotos** (assumindo 500 KB cada)

### Quando Exceder:

**Plano Pro:** $25/mês
- 100 GB de Storage
- 200 GB de transferência
- **~200.000 fotos**

**Cálculo:**
- 100 obras/mês
- 6 fotos/obra
- 500 KB/foto
- = **300 MB/mês** ✅ Cabe no gratuito!

---

## 🔐 Segurança

### Atualmente:

```javascript
// Upload público (qualquer um pode acessar via URL)
{
  contentType: 'image/jpeg',
  upsert: false
}
```

### ⚠️ Problema:
- URLs são públicas
- Sem autenticação para visualizar
- Qualquer um com o link acessa a foto

### ✅ Solução (Recomendada):

#### Opção 1: Usar Signed URLs (Mais Seguro)

```javascript
// Ao invés de URL pública, gera URL temporária
const { data, error } = await supabase.storage
  .from('obra-photos')
  .createSignedUrl(filePath, 3600) // Expira em 1 hora

// URL: https://...?token=abc123 (expira)
```

#### Opção 2: Row Level Security (RLS)

```sql
-- No Supabase, ativar RLS para storage
CREATE POLICY "Usuários podem ver suas próprias fotos"
ON storage.objects FOR SELECT
USING (
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 🚀 Alternativas de Armazenamento

### 1. **Supabase Storage** (Atual) ✅ RECOMENDADO

**Prós:**
- ✅ Integrado com seu sistema
- ✅ CDN global (rápido)
- ✅ Fácil de usar
- ✅ Backup automático

**Contras:**
- ⚠️ Custo cresce com uso
- ⚠️ Depende do Supabase

**Custo:**
- Gratuito até 500 MB
- $25/mês (100 GB)

---

### 2. **AWS S3** (Alternativa)

**Prós:**
- ✅ Muito barato (storage)
- ✅ 99.999999999% durabilidade
- ✅ Infinitamente escalável

**Contras:**
- ⚠️ Mais complexo de configurar
- ⚠️ Precisa integração extra
- ⚠️ Custo de transferência

**Custo:**
- $0.023/GB/mês (storage)
- 100 GB = ~$2.30/mês
- Mas cobra transferência

---

### 3. **Cloudflare R2** (Melhor Custo)

**Prós:**
- ✅ ZERO custo de transferência
- ✅ Compatível com S3
- ✅ Muito barato

**Contras:**
- ⚠️ Precisa configurar
- ⚠️ Menos integrado

**Custo:**
- $0.015/GB/mês
- 100 GB = $1.50/mês
- **ZERO** transfer fees

---

### 4. **Armazenar no Banco** ❌ NÃO RECOMENDADO

**Prós:**
- ✅ Tudo em um lugar
- ✅ Backup único

**Contras:**
- ❌ Banco fica GIGANTE
- ❌ Queries ficam lentas
- ❌ Backup pesado
- ❌ Limite de tamanho de linha (1 GB)

**NÃO USE para imagens!**

---

## 📈 Recomendações

### Para seu caso (100-200 obras/mês):

### 🥇 **Opção 1: Supabase Storage** (Atual)
**Status:** ✅ MANTER

**Motivo:**
- Já funciona bem
- Integração perfeita
- Custo zero (gratuito até 500 MB)
- Simples de gerenciar

**Ação:**
- ✅ Manter como está
- 🔐 Adicionar Signed URLs (segurança)
- 📊 Monitorar uso mensal

---

### 🥈 **Opção 2: Migrar para Cloudflare R2**
**Status:** ⏳ CONSIDERAR FUTURO

**Quando:**
- Ultrapassar 500 MB/mês
- Custo do Supabase ficar alto
- Precisar de mais controle

**Vantagem:**
- Custo 60% menor que Supabase
- Zero custo de transferência

---

## 🔧 Melhorias Recomendadas

### 1. Adicionar Signed URLs (Segurança)

**Prioridade:** 🔴 ALTA

```javascript
// Em vez de URL pública permanente
const { data: { publicUrl } } = supabase.storage
  .from('obra-photos')
  .getPublicUrl(filePath)

// Usar URL temporária (expira em 1 hora)
const { data, error } = await supabase.storage
  .from('obra-photos')
  .createSignedUrl(filePath, 3600)
```

---

### 2. Implementar Row Level Security

**Prioridade:** 🟡 MÉDIA

No Supabase Dashboard:
```sql
-- Storage > Policies
CREATE POLICY "Users see own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'obra-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### 3. Adicionar Limpeza de Fotos Antigas

**Prioridade:** 🟢 BAIXA

```python
# Script para deletar fotos órfãs
def limpar_fotos_orfas():
    """Remove fotos do storage que não estão no banco"""
    # Listar todas fotos no storage
    # Comparar com URLs no banco
    # Deletar fotos sem referência
```

---

### 4. Backup Periódico

**Prioridade:** 🟡 MÉDIA

```bash
# Backup automático (cron job)
# 1. Backup do banco (dados + URLs)
pg_dump supabase_db > backup.sql

# 2. Sync fotos para backup
aws s3 sync supabase_storage s3://backup-bucket
```

---

## 📊 Monitoramento

### Métricas para Acompanhar:

1. **Storage Usado**
   - Supabase Dashboard > Storage
   - Alertar quando > 400 MB (80% do limite)

2. **Custo Mensal**
   - Supabase Dashboard > Billing
   - Projetar crescimento

3. **Fotos por Obra**
   - Painel Web > Estatísticas
   - Média de fotos/obra

4. **Taxa de Upload**
   - Quantas fotos/dia
   - Crescimento mensal

---

## 🎯 Conclusão

### Sua arquitetura atual está **EXCELENTE** para o caso de uso!

**Recomendação:**
1. ✅ **MANTER** Supabase Storage
2. 🔐 **ADICIONAR** Signed URLs (segurança)
3. 📊 **MONITORAR** uso mensal
4. 💰 **MIGRAR** para R2 se custo ficar alto (futuro)

---

## 📋 Checklist

- [x] Fotos no Supabase Storage ✅
- [x] URLs no banco (JSONB) ✅
- [x] GPS junto com URL ✅
- [ ] Signed URLs (segurança) ⏳
- [ ] Row Level Security ⏳
- [ ] Monitoramento de uso ⏳
- [ ] Backup automático ⏳

---

## 💡 Resumo Rápido

**Onde está a foto?**
→ Supabase Storage (arquivo físico)

**O que está no banco?**
→ URL + GPS (JSON)

**É seguro?**
→ URLs públicas (melhorar com Signed URLs)

**Quanto custa?**
→ Grátis até 500 MB, depois $25/mês

**Está bom assim?**
→ ✅ SIM! Arquitetura correta e escalável!
