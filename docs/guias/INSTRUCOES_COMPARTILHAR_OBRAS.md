# Compartilhar Obras Entre Usuários

## 📋 Resumo

Esta migration altera o comportamento da tabela `obras` para que **todas as obras sejam compartilhadas entre todos os usuários autenticados**, ao invés de cada usuário ver apenas suas próprias obras.

## 🔄 O Que Muda

### ❌ Comportamento ANTERIOR (Privado)

- Cada usuário via apenas suas próprias obras
- User A não conseguia ver obras criadas por User B
- Histórico separado por usuário
- Edição/deleção apenas das próprias obras

### ✅ Comportamento NOVO (Compartilhado)

- **Todos os usuários veem TODAS as obras** cadastradas no sistema
- Histórico único e compartilhado
- Qualquer usuário pode **editar** qualquer obra
- Qualquer usuário pode **deletar** qualquer obra
- Colaboração total entre membros da equipe

## 🚀 Como Aplicar

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. Vá em **"SQL Editor"**
4. Copie todo o conteúdo do arquivo: [supabase/migrations/20250207_compartilhar_obras_entre_usuarios.sql](../supabase/migrations/20250207_compartilhar_obras_entre_usuarios.sql)
5. Cole no editor e clique em **"Run"**

### Opção 2: Via CLI (Requer Docker)

```bash
supabase db push
```

## 📊 Políticas RLS Aplicadas

### 🔍 SELECT (Visualização)
```sql
-- Todos podem ver TODAS as obras
USING (true)
```

### ➕ INSERT (Criação)
```sql
-- Qualquer usuário autenticado pode criar obras
-- O user_id continua sendo preenchido automaticamente
WITH CHECK (auth.uid() = user_id)
```

### ✏️ UPDATE (Edição)
```sql
-- Todos podem editar TODAS as obras
USING (true) WITH CHECK (true)
```

### 🗑️ DELETE (Deleção)
```sql
-- Todos podem deletar TODAS as obras
USING (true)
```

## ⚠️ Política Alternativa (Opcional)

Se você quiser que apenas o **criador original** possa deletar suas obras, edite a migration e:

1. Comente a política:
```sql
-- CREATE POLICY "Usuários autenticados podem deletar todas as obras"
```

2. Descomente a política alternativa:
```sql
CREATE POLICY "Usuários podem deletar apenas suas próprias obras"
  ON obras FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

## 🔐 Segurança

- ✅ **Autenticação obrigatória**: Apenas usuários autenticados têm acesso
- ✅ **RLS ativado**: Proteção em nível de banco de dados
- ✅ **user_id preservado**: Continua registrando quem criou cada obra
- ✅ **Rastreabilidade**: O campo `user_id` permite saber quem criou cada registro

## 📱 Impacto no App Mobile

### Antes da Migration
```typescript
// Usuário via apenas suas obras
const { data } = await supabase
  .from('obras')
  .select('*');
// Retorna: apenas obras onde user_id = usuário atual
```

### Depois da Migration
```typescript
// Usuário vê TODAS as obras de todos os usuários
const { data } = await supabase
  .from('obras')
  .select('*');
// Retorna: TODAS as obras do sistema
```

## 🧪 Como Testar

1. **Faça login com o usuário matrícula 2025**
   - Matrícula: `2025`
   - Senha: `teccel2025`

2. **Visualize as obras**
   - Você deverá ver TODAS as obras cadastradas por outros usuários

3. **Crie uma nova obra**
   - A obra será visível para TODOS os usuários

4. **Faça login com outro usuário**
   - Verifique que a obra criada no passo 3 aparece

## 🔄 Rollback (Reverter)

Se precisar voltar ao comportamento anterior (privado), execute:

```sql
-- Remover políticas compartilhadas
DROP POLICY IF EXISTS "Usuários autenticados podem ver todas as obras" ON obras;
DROP POLICY IF EXISTS "Usuários autenticados podem editar todas as obras" ON obras;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar todas as obras" ON obras;

-- Restaurar políticas privadas
CREATE POLICY "Users can view their own obras"
  ON obras FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own obras"
  ON obras FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own obras"
  ON obras FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

## 📚 Arquivos Relacionados

- **Migration**: [supabase/migrations/20250207_compartilhar_obras_entre_usuarios.sql](../supabase/migrations/20250207_compartilhar_obras_entre_usuarios.sql)
- **Schema original**: [supabase/migrations/20250112_multiplas_fotos.sql](../supabase/migrations/20250112_multiplas_fotos.sql)
- **Sync logic**: [mobile/lib/offline-sync.ts](../mobile/lib/offline-sync.ts)

## ❓ FAQ

### Por que o campo `user_id` ainda é obrigatório?

O `user_id` continua sendo preenchido para manter o **histórico de quem criou cada obra**. Isso é útil para:
- Auditoria
- Rastreabilidade
- Possível implementação futura de filtros por usuário
- Possível reversão para modelo privado

### As obras antigas continuam visíveis?

Sim! Todas as obras já cadastradas continuam no banco de dados e agora ficam visíveis para todos os usuários.

### Preciso alterar código do app mobile?

**Não!** A mudança é apenas nas políticas RLS do banco de dados. O app mobile continuará funcionando normalmente, mas agora retornará todas as obras ao invés de apenas as do usuário atual.

### E se eu quiser filtrar por equipe?

Você pode adicionar filtros na aplicação:

```typescript
// Filtrar obras pela equipe do usuário
const { data } = await supabase
  .from('obras')
  .select('*')
  .eq('equipe', userEquipe);
```

Mas a RLS permitirá que todos vejam todas, independente da equipe.

---

## ✅ Checklist de Aplicação

- [ ] Backup do banco de dados (opcional, mas recomendado)
- [ ] Executar migration no SQL Editor
- [ ] Verificar mensagens de sucesso
- [ ] Testar com múltiplos usuários
- [ ] Confirmar que obras antigas estão visíveis
- [ ] Confirmar que novas obras são compartilhadas
- [ ] Documentar mudança para equipe

---

**Última atualização**: 2025-02-07
