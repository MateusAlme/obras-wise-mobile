# Troubleshooting: Usuário 2025 Não Vê Obras

## 🔍 Problema

O usuário com matrícula 2025 consegue fazer login, mas **não vê nenhuma obra** na listagem do app mobile.

## ✅ Checklist Rápido

Execute este checklist antes de investigar mais a fundo:

- [ ] O usuário 2025 foi criado? (Execute `20250206_adicionar_usuario_2025.sql`)
- [ ] As políticas RLS foram atualizadas? (Execute `20250207_compartilhar_obras_entre_usuarios.sql`)
- [ ] Existem obras cadastradas no banco de dados?
- [ ] O app mobile está conectado ao Supabase correto?
- [ ] O usuário está autenticado corretamente?

## 🛠️ Diagnóstico Passo a Passo

### Passo 1: Executar Script de Diagnóstico

1. Acesse o **Supabase Dashboard** → SQL Editor
2. Copie e execute: [scripts/diagnostico_usuario_2025.sql](./diagnostico_usuario_2025.sql)
3. Analise os resultados de cada seção

**O que o script verifica:**

| Seção | O que verifica |
|-------|----------------|
| 1 | Se usuário existe em `auth.users` |
| 2 | Se perfil existe em `profiles` |
| 3 | Se registro existe em `usuarios_app` |
| 4 | Total de obras no sistema |
| 5 | Distribuição de obras por usuário |
| 6 | Políticas RLS ativas |
| 7 | Status RLS habilitado/desabilitado |
| 8 | Amostra de obras recentes |
| 9 | Resumo e recomendações |

### Passo 2: Identificar o Problema

Com base no resultado do diagnóstico:

#### ❌ Problema 1: Usuário 2025 não existe

**Sintoma:**
```
✗ PROBLEMA: Usuário 2025 NÃO EXISTE!
```

**Solução:**
```sql
-- Execute no SQL Editor:
-- Arquivo: supabase/migrations/20250206_adicionar_usuario_2025.sql
```

---

#### ❌ Problema 2: Não há obras no sistema

**Sintoma:**
```
Total de obras: 0
⚠ NÃO HÁ OBRAS cadastradas no sistema
```

**Solução:**
```sql
-- Criar obra de teste:
-- Arquivo: scripts/criar_obra_teste.sql
```

Ou cadastre uma obra manualmente pelo app mobile com outro usuário.

---

#### ❌ Problema 3: Políticas RLS incorretas

**Sintoma:**
```
Políticas RLS ativas: 0
```
OU
```
Políticas RLS ativas: 4
Mas com nomes: "Users can view their own obras"
```

**Solução:**
```sql
-- Execute no SQL Editor:
-- Arquivo: supabase/migrations/20250207_compartilhar_obras_entre_usuarios.sql
```

Verifique se as políticas corretas foram criadas:
- ✅ `Usuários autenticados podem ver todas as obras`
- ✅ `Usuários autenticados podem criar obras`
- ✅ `Usuários autenticados podem editar todas as obras`
- ✅ `Usuários autenticados podem deletar todas as obras`

---

#### ❌ Problema 4: RLS desabilitado

**Sintoma:**
```
✗ RLS está DESABILITADO
```

**Solução:**
```sql
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
```

---

### Passo 3: Testar no App Mobile

Depois de aplicar as correções:

1. **Feche completamente o app mobile** (force stop)
2. **Limpe o cache** (se possível)
3. **Abra o app novamente**
4. **Faça login** com:
   - Matrícula: `2025`
   - Senha: `teccel2025`
5. **Navegue até a lista de obras**
6. **Verifique** se as obras aparecem

### Passo 4: Verificar Console de Logs

Se ainda não funcionar, verifique os logs do app:

#### No React Native (Expo):

```bash
# Terminal onde o app está rodando
# Procure por erros como:

# ❌ Erro de autenticação
Error: User not authenticated

# ❌ Erro de política RLS
PostgresError: new row violates row-level security policy

# ❌ Erro de rede
Network request failed
```

## 🧪 Criar Obra de Teste

Para garantir que existe pelo menos uma obra para testar:

```sql
-- Execute no SQL Editor:
-- Arquivo: scripts/criar_obra_teste.sql
```

Esta obra será visível para TODOS os usuários autenticados.

## 🔧 Possíveis Causas e Soluções

### Causa 1: Cache do App Mobile

**Sintomas:**
- Obras existem no banco
- Políticas RLS corretas
- Mas app não mostra nada

**Solução:**
1. Fechar app completamente
2. Limpar dados do app (Android: Configurações → Apps → Seu App → Limpar Dados)
3. Desinstalar e reinstalar (última opção)

---

### Causa 2: Sincronização Offline

**Sintomas:**
- App mostra obras antigas
- Não atualiza com dados novos

**Solução:**
Verificar lógica de sync em [mobile/lib/offline-sync.ts](../mobile/lib/offline-sync.ts):

```typescript
// O sync deve buscar TODAS as obras, não apenas do usuário atual
const { data: obras } = await supabase
  .from('obras')
  .select('*')
  .order('created_at', { ascending: false });
```

---

### Causa 3: Filtro por user_id no Código

**Sintomas:**
- Políticas RLS corretas
- Mas código filtra por `user_id`

**Solução:**
Procure e remova filtros como:

```typescript
// ❌ ERRADO - filtra apenas obras do usuário
.eq('user_id', userId)

// ✅ CORRETO - busca todas as obras
// (RLS já garante que apenas autenticados vejam)
```

Arquivos para verificar:
- [mobile/lib/offline-sync.ts](../mobile/lib/offline-sync.ts)
- Componentes de listagem de obras

---

### Causa 4: Token de Autenticação Inválido

**Sintomas:**
- Login parece funcionar
- Mas nenhum dado é carregado

**Solução:**
Verificar se o token está válido:

```typescript
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Se session for null, re-autenticar
if (!session) {
  await supabase.auth.signOut();
  // Redirecionar para login
}
```

---

## 📊 Query Útil: Ver Exatamente o Que o Usuário 2025 Veria

Execute esta query para simular o que o usuário 2025 deveria ver:

```sql
-- Buscar ID do usuário 2025
SELECT id FROM auth.users WHERE email = '2025@obraswise.com';

-- Simular query que o app faz
-- Substitua {user_id} pelo ID retornado acima
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '{user_id}';

SELECT * FROM obras ORDER BY created_at DESC;
```

**Nota:** Esta simulação pode não funcionar perfeitamente no SQL Editor.
O melhor teste é direto no app mobile.

---

## 🆘 Última Opção: Desabilitar RLS Temporariamente

⚠️ **APENAS PARA TESTES - NÃO USAR EM PRODUÇÃO**

```sql
-- Desabilitar RLS temporariamente
ALTER TABLE obras DISABLE ROW LEVEL SECURITY;

-- Testar no app se obras aparecem
-- ...

-- REABILITAR IMEDIATAMENTE
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
```

Se obras aparecem com RLS desabilitado, o problema está definitivamente nas políticas RLS.

---

## 📝 Checklist de Verificação Final

Depois de aplicar todas as correções:

- [ ] Usuário 2025 existe em `auth.users`
- [ ] Perfil existe em `profiles`
- [ ] Registro existe em `usuarios_app` com `ativo = true`
- [ ] Existem obras no banco (pelo menos 1)
- [ ] Políticas RLS compartilhadas estão ativas
- [ ] RLS está habilitado na tabela obras
- [ ] App foi reiniciado
- [ ] Cache do app foi limpo
- [ ] Login funciona corretamente
- [ ] Obras aparecem na listagem

---

## 🔗 Arquivos de Referência

| Arquivo | Propósito |
|---------|-----------|
| [20250206_adicionar_usuario_2025.sql](../supabase/migrations/20250206_adicionar_usuario_2025.sql) | Criar usuário 2025 |
| [20250207_compartilhar_obras_entre_usuarios.sql](../supabase/migrations/20250207_compartilhar_obras_entre_usuarios.sql) | Políticas RLS compartilhadas |
| [diagnostico_usuario_2025.sql](./diagnostico_usuario_2025.sql) | Script de diagnóstico |
| [criar_obra_teste.sql](./criar_obra_teste.sql) | Criar obra para teste |
| [mobile/lib/offline-sync.ts](../mobile/lib/offline-sync.ts) | Lógica de sincronização |

---

## 💡 Dica Pro: Log de Debugging

Adicione logs temporários no app para ver o que está sendo retornado:

```typescript
// Em mobile/lib/offline-sync.ts ou onde busca obras
const { data: obras, error } = await supabase
  .from('obras')
  .select('*');

console.log('=== DEBUG OBRAS ===');
console.log('Total de obras:', obras?.length || 0);
console.log('Erro:', error);
console.log('Primeiras 3 obras:', obras?.slice(0, 3));
console.log('===================');
```

---

**Última atualização:** 2025-02-07
