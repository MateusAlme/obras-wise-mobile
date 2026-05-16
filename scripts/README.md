# Scripts de Configuração e Troubleshooting

## 🚀 Solução Rápida (Recomendado)

Se o usuário 2025 não está vendo obras, **execute apenas este script**:

### [fix_completo_usuario_2025.sql](./fix_completo_usuario_2025.sql)

Este script faz tudo automaticamente:
- ✅ Cria usuário 2025 (se não existe)
- ✅ Atualiza políticas RLS para compartilhamento
- ✅ Garante que RLS está habilitado
- ✅ Cria obra de teste (se não houver obras)
- ✅ Executa diagnóstico completo

**Como usar:**
1. Acesse https://app.supabase.com
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo de `fix_completo_usuario_2025.sql`
4. Clique em **Run**
5. Leia o resumo final com as instruções

---

## 📚 Scripts Disponíveis

### 1. Usuário

| Script | Descrição |
|--------|-----------|
| [adicionar_usuario_2025.sql](./adicionar_usuario_2025.sql) | Cria usuário com matrícula 2025 e senha teccel2025 |
| [INSTRUCOES_ADICIONAR_USUARIO.md](./INSTRUCOES_ADICIONAR_USUARIO.md) | Documentação completa sobre criação de usuários |

### 2. Compartilhamento de Obras

| Script | Descrição |
|--------|-----------|
| [../supabase/migrations/20250207_compartilhar_obras_entre_usuarios.sql](../supabase/migrations/20250207_compartilhar_obras_entre_usuarios.sql) | Altera políticas RLS para compartilhamento |
| [INSTRUCOES_COMPARTILHAR_OBRAS.md](./INSTRUCOES_COMPARTILHAR_OBRAS.md) | Documentação sobre compartilhamento de obras |

### 3. Diagnóstico e Troubleshooting

| Script | Descrição |
|--------|-----------|
| [diagnostico_usuario_2025.sql](./diagnostico_usuario_2025.sql) | Diagnóstico completo do usuário 2025 |
| [criar_obra_teste.sql](./criar_obra_teste.sql) | Cria uma obra de teste para verificação |
| [fix_completo_usuario_2025.sql](./fix_completo_usuario_2025.sql) | ⭐ Script all-in-one (recomendado) |
| [TROUBLESHOOTING_USUARIO_2025.md](./TROUBLESHOOTING_USUARIO_2025.md) | Guia completo de troubleshooting |

---

## 🔧 Fluxo de Trabalho Recomendado

### Cenário 1: Primeira Instalação

```
1. Execute: fix_completo_usuario_2025.sql
2. Teste login no app com matrícula 2025
3. Verifique se obras aparecem
```

### Cenário 2: Usuário 2025 Não Vê Obras

```
1. Execute: diagnostico_usuario_2025.sql
2. Leia o resumo e identifique o problema
3. Execute: fix_completo_usuario_2025.sql
4. Se ainda não funcionar, consulte: TROUBLESHOOTING_USUARIO_2025.md
```

### Cenário 3: Adicionar Mais Usuários

```
1. Copie: adicionar_usuario_2025.sql
2. Altere matrícula, email e senha
3. Execute o script modificado
4. Leia: INSTRUCOES_ADICIONAR_USUARIO.md para detalhes
```

---

## 📋 Credenciais do Usuário 2025

- **Matrícula:** `2025`
- **Senha:** `teccel2025`
- **Email:** `2025@obraswise.com`
- **Equipe:** CNT 01 (Construção 01)

---

## 🔍 Verificações Rápidas

### Verificar se usuário existe:

```sql
SELECT * FROM auth.users WHERE email = '2025@obraswise.com';
```

### Verificar total de obras:

```sql
SELECT COUNT(*) FROM obras;
```

### Verificar políticas RLS:

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'obras';
```

### Verificar RLS habilitado:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'obras';
```

---

## 🆘 Precisa de Ajuda?

1. **Leia primeiro:** [TROUBLESHOOTING_USUARIO_2025.md](./TROUBLESHOOTING_USUARIO_2025.md)
2. **Execute diagnóstico:** [diagnostico_usuario_2025.sql](./diagnostico_usuario_2025.sql)
3. **Tente solução completa:** [fix_completo_usuario_2025.sql](./fix_completo_usuario_2025.sql)

---

## 📁 Estrutura de Arquivos

```
scripts/
├── README.md (este arquivo)
├── fix_completo_usuario_2025.sql          ⭐ Solução completa
├── adicionar_usuario_2025.sql             Criar usuário 2025
├── diagnostico_usuario_2025.sql           Diagnóstico
├── criar_obra_teste.sql                   Obra de teste
├── INSTRUCOES_ADICIONAR_USUARIO.md        Doc usuários
├── INSTRUCOES_COMPARTILHAR_OBRAS.md       Doc compartilhamento
└── TROUBLESHOOTING_USUARIO_2025.md        Guia troubleshooting

supabase/migrations/
├── 20250206_adicionar_usuario_2025.sql
└── 20250207_compartilhar_obras_entre_usuarios.sql
```

---

## 🔐 Segurança

- ✅ Todas as senhas são hasheadas com bcrypt
- ✅ RLS (Row Level Security) sempre habilitado
- ✅ Apenas usuários autenticados têm acesso
- ✅ Rastreabilidade via campo `user_id`

---

## 📚 Documentação Relacionada

- [Estrutura do Banco de Dados](../supabase/migrations/)
- [Código do App Mobile](../mobile/)
- [Código do App Web](../web/)

---

**Última atualização:** 2025-02-07
