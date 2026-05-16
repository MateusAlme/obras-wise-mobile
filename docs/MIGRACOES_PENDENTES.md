# Migrações Pendentes do Banco de Dados

## 📋 Resumo

Existem **4 migrações pendentes** que precisam ser aplicadas no Supabase:

### 1. ✅ Fix de Recursão Infinita no RLS (CRÍTICO - já foi mencionado)
**Arquivo**: `supabase/migrations/20250201_fix_profiles_rls.sql`

**Problema que resolve**: Erro de recursão infinita ao carregar perfil do usuário.

**O que faz**:
- Remove políticas RLS problemáticas da tabela `profiles`
- Cria função auxiliar `is_admin()` com `SECURITY DEFINER` para bypassar RLS
- Recria políticas RLS sem recursão

**Status**: ⚠️ **Você já aplicou esta migração, certo?**

---

### 2. ✅ Criar Perfis Faltantes (CRÍTICO)
**Arquivo**: `supabase/migrations/20250201_criar_perfis_faltantes.sql`

**Problema que resolve**: Erro `PGRST116` - usuários sem perfil na tabela `profiles`.

**O que faz**:
- Cria perfis para todos os usuários existentes em `auth.users` que não têm perfil
- Define o primeiro usuário como admin se não houver nenhum admin

**Status**: ⚠️ **Você mencionou que já aplicou, mas precisa confirmar**

---

### 3. 🆕 Adicionar Colunas do Medidor (NOVO)
**Arquivo**: `supabase/migrations/20250201_adicionar_medidor_fotos.sql`

**Problema que resolve**: Faltam colunas no banco para salvar fotos do serviço "Instalação do Medidor".

**O que faz**:
Adiciona 5 colunas JSONB à tabela `obras`:
- `fotos_medidor_padrao` - Padrão c/ Medidor Instalado
- `fotos_medidor_leitura` - Leitura c/ Medidor Instalado
- `fotos_medidor_selo_born` - Selo do Born do Medidor
- `fotos_medidor_selo_caixa` - Selo da Caixa
- `fotos_medidor_identificador_fase` - Identificador de Fase

**Status**: 🚧 **PENDENTE - Precisa aplicar**

---

### 4. 🆕 Adicionar Colunas do Checklist de Fiscalização (NOVO)
**Arquivo**: `supabase/migrations/20250201_adicionar_checklist_fiscalizacao.sql`

**Problema que resolve**: Faltam colunas no banco para salvar fotos do serviço "Checklist de Fiscalização".

**O que faz**:
Adiciona 9 colunas JSONB à tabela `obras`:

**Fotos Fixas** (7 colunas):
- `fotos_checklist_croqui` - Croqui da Obra (1 foto)
- `fotos_checklist_panoramica_inicial` - Panorâmica Inicial (2 fotos)
- `fotos_checklist_chede` - Material/Chede (1 foto)
- `fotos_checklist_aterramento_cerca` - Aterramento de Cerca (1 foto)
- `fotos_checklist_padrao_geral` - Padrão Vista Geral (1 foto)
- `fotos_checklist_padrao_interno` - Padrão Interno (1 foto)
- `fotos_checklist_panoramica_final` - Panorâmica Final (2 fotos)

**Fotos Dinâmicas** (2 colunas):
- `fotos_checklist_postes` - Array de objetos com 4 fotos por poste
- `fotos_checklist_seccionamentos` - Array de arrays de fotos

**Status**: 🚧 **PENDENTE - Precisa aplicar**

---

## 🎯 Como Aplicar as Migrações

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o SQL Editor:
   https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/sql/new

2. Para cada migração pendente:
   - Abra o arquivo da migração
   - Copie todo o conteúdo
   - Cole no SQL Editor
   - Clique em **"Run"**

3. Ordem recomendada:
   1. `20250201_fix_profiles_rls.sql` (se ainda não aplicou)
   2. `20250201_criar_perfis_faltantes.sql` (se ainda não aplicou)
   3. `20250201_adicionar_medidor_fotos.sql` ⬅️ **NOVO**
   4. `20250201_adicionar_checklist_fiscalizacao.sql` ⬅️ **NOVO**

### Opção 2: Via CLI do Supabase

```bash
cd "c:\Users\Mateus Almeida\obras-wise-mobile"
supabase db push
```

**Nota**: Vai pedir a senha do banco de dados.

### Opção 3: Via psql Direto

Se tiver as credenciais de conexão direta:

```bash
psql "postgresql://postgres:[SUA_SENHA]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/20250201_adicionar_medidor_fotos.sql

psql "postgresql://postgres:[SUA_SENHA]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/20250201_adicionar_checklist_fiscalizacao.sql
```

---

## ✅ Checklist de Verificação

Após aplicar cada migração, verifique:

- [ ] **20250201_fix_profiles_rls.sql**
  - [ ] Função `is_admin()` foi criada
  - [ ] Políticas RLS estão funcionando sem recursão
  - [ ] Consegue carregar perfil do usuário sem erro

- [ ] **20250201_criar_perfis_faltantes.sql**
  - [ ] Todos os usuários têm perfil em `public.profiles`
  - [ ] Existe pelo menos um usuário com `role = 'admin'`

- [ ] **20250201_adicionar_medidor_fotos.sql**
  - [ ] 5 novas colunas existem na tabela `obras`
  - [ ] Todas têm valor default `'[]'` (array vazio JSON)

- [ ] **20250201_adicionar_checklist_fiscalizacao.sql**
  - [ ] 9 novas colunas existem na tabela `obras`
  - [ ] Todas têm valor default `'[]'` (array vazio JSON)

---

## 🔍 Como Verificar se uma Migração Já Foi Aplicada

Execute no SQL Editor do Supabase:

```sql
-- Ver todas as colunas da tabela obras
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'obras'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Procure por**:
- `fotos_medidor_*` (5 colunas) - Se não existirem, aplicar migração #3
- `fotos_checklist_*` (9 colunas) - Se não existirem, aplicar migração #4

```sql
-- Verificar se a função is_admin existe
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin';
```

Se retornar vazio, aplicar migração #1.

```sql
-- Verificar se todos os usuários têm perfil
SELECT COUNT(*) as usuarios_sem_perfil
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
```

Se retornar > 0, aplicar migração #2.

---

## 📝 Observações Importantes

1. **Ordem Importa**: Aplique as migrações na ordem listada acima
2. **Backup**: O Supabase faz backups automáticos, mas é sempre bom confirmar
3. **Testes**: Após aplicar, teste criando uma obra de cada tipo novo:
   - "Instalação do Medidor"
   - "Checklist de Fiscalização"
4. **Rollback**: Se algo der errado, você pode reverter manualmente removendo as colunas:
   ```sql
   ALTER TABLE public.obras DROP COLUMN IF EXISTS fotos_medidor_padrao;
   -- etc...
   ```

---

## 🆘 Problemas Comuns

### Erro: "column already exists"
**Solução**: A coluna já foi criada. Use `IF NOT EXISTS` (já está nas migrações).

### Erro: "permission denied"
**Solução**: Você precisa estar logado como usuário com permissões de admin do banco.

### Erro: "relation 'obras' does not exist"
**Solução**: Verifique se você está conectado ao banco de dados correto.

---

## 📞 Próximos Passos Após Aplicar

Depois de aplicar todas as migrações:

1. ✅ Testar no mobile app:
   - Criar obra com "Instalação do Medidor"
   - Tirar fotos e verificar se salvam

2. ✅ Continuar implementação do Checklist:
   - Criar a UI completa
   - Testar offline sync
   - Testar visualização de obras

3. ✅ Verificar logs do Supabase para erros
