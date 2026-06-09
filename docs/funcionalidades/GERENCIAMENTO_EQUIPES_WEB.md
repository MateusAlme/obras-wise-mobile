# Gerenciamento de Equipes - Sistema Web

## 📋 Visão Geral

Sistema completo de gerenciamento de equipes (usuários) através do painel web administrativo. Permite criar, editar, inativar e excluir equipes, além de gerenciar senhas.

## 🎯 Funcionalidades Implementadas

### 1. **Criar Nova Equipe** ➕
- Código da equipe (ex: CNT 01, MNT 02, LV 01 CJZ)
- Senha inicial (mínimo 6 caracteres)
- Equipe criada já ativa por padrão

### 2. **Editar Equipe** ✏️
- Alterar código da equipe
- Atualiza automaticamente timestamp de atualização

### 3. **Alterar Senha** 🔐
- Definir nova senha para qualquer equipe
- Confirmação de senha obrigatória
- **Não requer senha atual** (função admin)
- Validação de mínimo 6 caracteres

### 4. **Ativar/Inativar Equipe** 🔄
- Inativar equipe sem excluir dados
- Equipes inativas não podem fazer login
- Preserva todo histórico de obras
- Pode reativar a qualquer momento

### 5. **Excluir Equipe** 🗑️
- Exclusão permanente do banco de dados
- Confirmação obrigatória
- **Atenção:** Ação irreversível!

### 6. **Buscar Equipes** 🔍
- Campo de busca em tempo real
- Busca por código da equipe
- Resultados instantâneos

### 7. **Estatísticas** 📊
- Total de equipes cadastradas
- Equipes ativas
- Equipes inativas

## 🖥️ Interface do Usuário

### Página Principal (`/users`)

**Header:**
- Título: "Gerenciamento de Equipes"
- Botão: "Nova Equipe" (azul, canto superior direito)

**Cards de Estatísticas:**
1. **Total de Equipes** (azul) - Número total cadastrado
2. **Equipes Ativas** (verde) - Equipes que podem fazer login
3. **Equipes Inativas** (cinza) - Equipes desativadas

**Campo de Busca:**
- Ícone de lupa
- Placeholder: "Buscar equipe..."
- Filtragem em tempo real

**Tabela de Equipes:**

| Código da Equipe | Status | Criado em | Atualizado em | Ações |
|------------------|--------|-----------|---------------|-------|
| CNT 01 | ✓ Ativa | 12/02/2025 10:30 | 15/02/2025 14:20 | Editar \| Senha \| Inativar \| Excluir |
| MNT 02 | ✕ Inativa | 10/02/2025 08:15 | 14/02/2025 16:45 | Editar \| Senha \| Ativar \| Excluir |

**Botões de Ação:**
- **Editar** (azul) - Alterar código da equipe
- **Senha** (roxo) - Redefinir senha
- **Inativar/Ativar** (laranja/verde) - Alternar status
- **Excluir** (vermelho) - Remover permanentemente

### Modal de Nova Equipe

```
┌─────────────────────────────────┐
│ Nova Equipe              [✕]    │
├─────────────────────────────────┤
│ Código da Equipe *              │
│ [CNT 01                     ]   │
│ Use o formato: TIPO NÚMERO      │
│                                 │
│ Senha *                         │
│ [●●●●●●●●                   ]   │
│ Mínimo 6 caracteres             │
│                                 │
│ [Cancelar]  [Criar]             │
└─────────────────────────────────┘
```

### Modal de Editar Equipe

```
┌─────────────────────────────────┐
│ Editar Equipe            [✕]    │
├─────────────────────────────────┤
│ Código da Equipe *              │
│ [CNT 01                     ]   │
│ Use o formato: TIPO NÚMERO      │
│                                 │
│ [Cancelar]  [Salvar]            │
└─────────────────────────────────┘
```

### Modal de Alterar Senha

```
┌─────────────────────────────────┐
│ Alterar Senha            [✕]    │
├─────────────────────────────────┤
│ Equipe: CNT 01                  │
│                                 │
│ Nova Senha *                    │
│ [●●●●●●●●                   ]   │
│ Mínimo 6 caracteres             │
│                                 │
│ Confirmar Nova Senha *          │
│ [●●●●●●●●                   ]   │
│ Digite a senha novamente        │
│                                 │
│ [Cancelar]  [Alterar Senha]     │
└─────────────────────────────────┘
```

## 🔧 Implementação Técnica

### Frontend ([web/src/app/users/page.tsx](../web/src/app/users/page.tsx))

**Componente:** `UsersPage`

**Estados:**
```typescript
interface Equipe {
  id: string
  equipe_codigo: string
  ativo: boolean
  created_at: string
  updated_at: string
}

type ModalMode = 'create' | 'edit' | 'changePassword' | null
```

**Principais Funções:**
- `loadEquipes()` - Carrega lista de equipes
- `handleSubmit()` - Processa formulários (criar, editar, senha)
- `toggleAtivo()` - Ativa/inativa equipe
- `handleDelete()` - Exclui equipe permanentemente
- `openCreateModal()` - Abre modal de criação
- `openEditModal()` - Abre modal de edição
- `openPasswordModal()` - Abre modal de senha

### Backend (Supabase Functions)

#### 1. `criar_equipe(p_equipe_codigo, p_senha)`

Cria nova equipe no sistema.

**Parâmetros:**
- `p_equipe_codigo` - Código da equipe (ex: "CNT 01")
- `p_senha` - Senha inicial

**Retorna:** UUID da equipe criada

**Validações:**
- Verifica se código já existe
- Criptografa senha com bcrypt
- Define `ativo = true` por padrão

**Exemplo:**
```sql
SELECT criar_equipe('CNT 15', 'SenhaSegura123');
```

#### 2. `admin_alterar_senha_equipe(p_equipe_codigo, p_senha_nova)`

Altera senha de equipe sem precisar da senha atual (função admin).

**Parâmetros:**
- `p_equipe_codigo` - Código da equipe
- `p_senha_nova` - Nova senha

**Retorna:** `true` se sucesso

**Validações:**
- Verifica se equipe existe
- Criptografa nova senha com bcrypt
- Atualiza timestamp `updated_at`

**Exemplo:**
```sql
SELECT admin_alterar_senha_equipe('CNT 01', 'NovaSenha456');
```

#### 3. `listar_equipes_com_estatisticas()`

Lista todas as equipes com estatísticas de obras (para futuro uso).

**Retorna:**
```typescript
{
  id: UUID
  equipe_codigo: string
  ativo: boolean
  total_obras: number
  obras_ultima_semana: number
  created_at: timestamp
  updated_at: timestamp
}[]
```

### Tabela do Banco de Dados

**Tabela:** `equipe_credenciais`

```sql
CREATE TABLE equipe_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_codigo VARCHAR(20) NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Índices:**
- `idx_equipe_credenciais_codigo` - Busca rápida por código
- `idx_equipe_credenciais_ativo` - Filtro por status

**Triggers:**
- `trigger_equipe_credenciais_updated_at` - Atualiza `updated_at` automaticamente

## 🚀 Como Usar

### 1. Aplicar Migração SQL

**Opção A - Dashboard do Supabase:**
1. Acesse: https://supabase.com/dashboard/project/SEU_PROJECT_ID/sql/new
2. Copie e cole o conteúdo de [supabase/APLICAR_FUNCOES_ADMIN.sql](../supabase/APLICAR_FUNCOES_ADMIN.sql)
3. Clique em "RUN"

**Opção B - CLI do Supabase:**
```bash
cd supabase
supabase db push
```

### 2. Acessar o Sistema Web

1. Faça login no sistema web com usuário admin
2. Navegue para "Usuários" no menu lateral
3. Você verá a tela de gerenciamento de equipes

### 3. Criar Nova Equipe

1. Clique no botão "Nova Equipe"
2. Preencha:
   - **Código da Equipe**: Ex: `CNT 15`
   - **Senha**: Mínimo 6 caracteres
3. Clique em "Criar"
4. Equipe estará disponível para login no app mobile

### 4. Alterar Senha

1. Na lista, clique no botão "Senha" da equipe desejada
2. Preencha:
   - **Nova Senha**: Nova senha (mínimo 6 caracteres)
   - **Confirmar Nova Senha**: Repita a senha
3. Clique em "Alterar Senha"
4. Senha atualizada imediatamente

### 5. Inativar Equipe

1. Na lista, clique no botão "Inativar"
2. Equipe será marcada como inativa
3. Login no app mobile será bloqueado
4. Dados e obras permanecem intactos
5. Para reativar, clique no botão "Ativar"

### 6. Excluir Equipe

1. Na lista, clique no botão "Excluir"
2. Confirme a exclusão permanente
3. **Atenção**: Dados não podem ser recuperados!

## 🔒 Segurança

### Criptografia de Senhas
- **Algoritmo**: bcrypt (gen_salt('bf'))
- **Salt**: Gerado automaticamente para cada senha
- **Segurança**: Resistente a rainbow tables e brute force

### Validações Frontend
- Código da equipe obrigatório
- Senha mínimo 6 caracteres
- Confirmação de senha deve ser igual
- Formato automaticamente em maiúsculas

### Validações Backend
- Código único (constraint UNIQUE)
- Verificação de equipe existente antes de criar
- Funções com `SECURITY DEFINER` para controle de acesso
- Confirmação obrigatória para exclusões

### Permissões
- ✅ Admin pode: criar, editar, alterar senha, ativar/inativar, excluir
- ❌ Equipes não podem: gerenciar outras equipes
- ✅ Equipes podem: alterar própria senha (via app ou função específica)

## 📱 Integração com App Mobile

### Login no App
- Equipes fazem login com `equipe_codigo` + `senha`
- Apenas equipes `ativo = true` podem logar
- Função `validar_login_equipe()` verifica credenciais

### Obras Criadas
- Obras ficam associadas ao `equipe_codigo`
- Admin pode ver obras de todas as equipes
- Equipes veem apenas suas próprias obras

## 🎨 Mensagens de Feedback

### Sucesso (verde)
- ✅ Equipe "CNT 01" criada com sucesso!
- ✅ Equipe atualizada com sucesso!
- ✅ Senha alterada com sucesso!
- ✅ Equipe "CNT 01" inativada com sucesso!
- ✅ Equipe "CNT 01" ativada com sucesso!
- ✅ Equipe "CNT 01" excluída com sucesso!

### Erro (vermelho)
- ❌ Equipe com código CNT 01 já existe
- ❌ As senhas não coincidem!
- ❌ A senha deve ter no mínimo 6 caracteres!
- ❌ Equipe CNT 99 não encontrada

## 📊 Futuros Aprimoramentos

### Estatísticas Avançadas
- Número de obras por equipe
- Obras criadas na última semana
- Taxa de finalização de obras
- Tempo médio por obra

### Filtros e Ordenação
- Filtrar por status (ativo/inativo)
- Ordenar por número de obras
- Ordenar por data de criação
- Exportar lista para Excel

### Histórico de Alterações
- Log de alterações de senha
- Histórico de ativação/inativação
- Auditoria de ações admin

### Permissões Granulares
- Diferentes níveis de admin
- Permissões específicas por função
- Logs de acesso e ações

## 🐛 Troubleshooting

### Erro ao criar equipe: "Equipe já existe"
**Causa:** Código da equipe duplicado
**Solução:** Use um código diferente ou edite a equipe existente

### Erro ao alterar senha: "Equipe não encontrada"
**Causa:** Código da equipe foi alterado ou excluído
**Solução:** Verifique a lista de equipes atualizada

### Modal não fecha após ação
**Causa:** Erro na execução da função
**Solução:** Verifique mensagens de erro e logs do browser

### Equipe não aparece após criar
**Causa:** Página não recarregou a lista
**Solução:** Recarregue a página manualmente (F5)

## 📝 Arquivos Modificados/Criados

### Criados
- ✅ `web/src/app/users/page.tsx` - Atualizado completamente
- ✅ `supabase/migrations/20250215_funcoes_admin_equipes.sql` - Funções SQL
- ✅ `supabase/APLICAR_FUNCOES_ADMIN.sql` - Script de aplicação rápida
- ✅ `docs/GERENCIAMENTO_EQUIPES_WEB.md` - Esta documentação

### Modificados
- Nenhum arquivo existente foi modificado, apenas substituído

## 🔗 Links Relacionados

- [Sistema de Login por Equipe](../supabase/migrations/20250211_sistema_login_por_equipe.sql)
- [Documentação do Supabase](https://supabase.com/docs)
- [Bcrypt Documentation](https://en.wikipedia.org/wiki/Bcrypt)

## ✅ Checklist de Verificação

Antes de usar o sistema, verifique:

- [ ] Migração SQL aplicada no Supabase
- [ ] Funções criadas: `criar_equipe`, `admin_alterar_senha_equipe`
- [ ] Tabela `equipe_credenciais` existe e tem dados
- [ ] Login admin funciona no sistema web
- [ ] Página `/users` carrega sem erros
- [ ] Consegue criar nova equipe
- [ ] Consegue alterar senha de equipe
- [ ] Consegue ativar/inativar equipe
- [ ] App mobile reconhece equipes criadas
- [ ] Equipes inativas não conseguem logar

---

**Sistema pronto para uso!** 🎉
