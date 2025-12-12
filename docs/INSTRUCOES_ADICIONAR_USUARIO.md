# Instruções: Adicionar Usuário Mobile (Matrícula 2025)

## Como executar

### Opção 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard**
   - Vá para: https://app.supabase.com
   - Faça login na sua conta
   - Selecione o projeto "obras-wise-mobile"

2. **Abra o SQL Editor**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query" ou use uma query existente

3. **Execute o script**
   - Copie todo o conteúdo do arquivo `scripts/adicionar_usuario_2025.sql`
   - Cole no editor SQL
   - Clique em "Run" ou pressione `Ctrl+Enter`

4. **Verifique os resultados**
   - O script mostrará mensagens de sucesso no console
   - Ao final, uma query SELECT mostrará os dados do usuário criado

### Opção 2: Via CLI (Requer Docker Desktop rodando)

1. **Inicie o Docker Desktop**
   - Certifique-se que o Docker está rodando

2. **Execute o comando**
   ```bash
   supabase db push
   ```

3. **Aplique a migration**
   - A migration `20250206_adicionar_usuario_2025.sql` será aplicada automaticamente

---

## Credenciais do Novo Usuário

Após executar o script, o usuário poderá fazer login no app mobile com:

- **Matrícula:** `2025`
- **Senha:** `teccel2025`

---

## Detalhes Técnicos

### Estrutura criada:

1. **auth.users** (Supabase Auth)
   - Email: `2025@obraswise.com`
   - Senha: `teccel2025` (hasheada com bcrypt)
   - Status: Confirmado (email_confirmed_at preenchido)

2. **profiles**
   - Nome completo: "Usuário 2025"
   - Role: "user" (não é admin)

3. **usuarios_app**
   - Matrícula: `2025`
   - Nome: "Usuário 2025"
   - Equipe: CNT 01 (Construção 01)
   - Status: Ativo

### Fluxo de Login no App Mobile:

1. Usuário digita matrícula: `2025`
2. O app converte para email: `2025@obraswise.com`
3. Envia para Supabase Auth junto com a senha
4. Se autenticado, busca dados do `usuarios_app` pela matrícula
5. Carrega informações da equipe associada

---

## Alterações Possíveis

### Mudar a equipe do usuário:

Se quiser associar a uma equipe diferente, altere esta linha no script:

```sql
SELECT id INTO v_equipe_id FROM equipes WHERE codigo = 'CNT 01' LIMIT 1;
```

Equipes disponíveis:
- **CNT** (Construção): CNT 01, CNT 02, CNT 03, CNT 04, CNT 06, CNT 07, CNT 10, CNT 11, CNT 12
- **MNT** (Manutenção): MNT 01, MNT 02, MNT 03, MNT 04, MNT 05, MNT 06
- **LV** (Linha Viva): LV 01 CJZ, LV 02 PTS, LV 03 JR PTS

### Mudar a senha:

Altere esta linha no script:

```sql
v_encrypted_password := crypt('teccel2025', gen_salt('bf'));
```

Troque `'teccel2025'` pela nova senha desejada.

---

## Verificação

Após executar o script, você pode verificar se o usuário foi criado corretamente rodando:

```sql
SELECT
  ua.matricula,
  ua.nome,
  ua.ativo,
  e.nome as equipe,
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmado,
  p.role as perfil_role
FROM usuarios_app ua
LEFT JOIN equipes e ON e.id = ua.equipe_id
LEFT JOIN auth.users u ON u.id = ua.supabase_user_id
LEFT JOIN profiles p ON p.id = ua.supabase_user_id
WHERE ua.matricula = '2025';
```

Resultado esperado:
```
matricula | nome          | ativo | equipe         | email                  | email_confirmado | perfil_role
----------|---------------|-------|----------------|------------------------|------------------|------------
2025      | Usuário 2025  | true  | Construção 01  | 2025@obraswise.com     | true             | user
```

---

## Solução de Problemas

### Erro: "duplicate key value violates unique constraint"

O usuário já existe. O script irá atualizar as informações existentes automaticamente.

### Erro: "permission denied"

Certifique-se de estar usando o Supabase Dashboard com permissões de admin, ou use a service_role key.

### Usuário não consegue fazer login no app

1. Verifique se o email foi confirmado (email_confirmed_at não é null)
2. Verifique se o usuário está ativo na tabela usuarios_app
3. Confirme que a senha está correta
4. Teste o login pelo Supabase Dashboard primeiro

---

## Próximos Passos

Após criar o usuário, você pode:

1. **Testar o login** no app mobile
2. **Adicionar mais usuários** modificando a matrícula e executando novamente
3. **Gerenciar usuários** pelo painel web (interface de administração)
4. **Alterar equipe** do usuário conforme necessário

---

## Contato / Suporte

Para mais informações sobre a estrutura do banco de dados, consulte:
- [supabase/migrations/20250117_criar_equipes_e_usuarios.sql](../supabase/migrations/20250117_criar_equipes_e_usuarios.sql)
