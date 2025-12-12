# 🔐 Sistema de Login por Equipe - Instruções de Implementação

## 📋 Resumo das Mudanças

Este sistema implementa autenticação baseada em equipes, onde cada equipe (CNT 01, MNT 02, etc.) possui seu próprio usuário e senha.

### ✅ O que foi implementado:

1. **Banco de Dados:**
   - Tabela `equipe_credenciais` com senhas criptografadas (bcrypt)
   - Tabela `equipe_sessoes` para auditoria de logins
   - Função `validar_login_equipe()` para autenticação
   - Função `alterar_senha_equipe()` para trocar senhas
   - Todas as 18 equipes cadastradas com senha padrão: **Teccel2025**

2. **Mobile App:**
   - Tela de login com dropdown de seleção de equipe
   - Sessão salva no AsyncStorage
   - Filtro automático: cada equipe vê apenas suas obras
   - Banner mostrando equipe logada + botão de logout
   - Campo "Equipe" preenchido automaticamente em background (invisível ao usuário)

3. **Segurança:**
   - Senhas criptografadas com bcrypt
   - Validação no servidor (Supabase Functions)
   - Redirecionamento automático para login se sessão expirar

---

## 🚀 Passo 1: Aplicar Migration no Banco de Dados

### 1.1 Acessar o Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Faça login na sua conta
3. Selecione o projeto **obras-wise-mobile**
4. No menu lateral, clique em **SQL Editor**

### 1.2 Executar a Migration

1. Abra o arquivo: `supabase/migrations/20250211_sistema_login_por_equipe.sql`
2. Copie TODO o conteúdo do arquivo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (ou pressione Ctrl+Enter)

**Resultado esperado:**
```
Success. No rows returned
```

### 1.3 Verificar se foi aplicado corretamente

Execute esta query no SQL Editor:

```sql
-- Verificar se as tabelas foram criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('equipe_credenciais', 'equipe_sessoes');

-- Verificar se as equipes foram cadastradas
SELECT equipe_codigo, ativo, created_at
FROM equipe_credenciais
ORDER BY equipe_codigo;

-- Testar a função de login (com equipe CNT 01)
SELECT * FROM validar_login_equipe('CNT 01', 'Teccel2025');
```

**Resultado esperado:**
- 2 tabelas encontradas: `equipe_credenciais`, `equipe_sessoes`
- 18 equipes cadastradas (CNT 01-12, MNT 01-06, LV 01-03)
- Função de login retorna: `valido: true`

---

## 📱 Passo 2: Testar o Sistema de Login

### 2.1 Testar no Mobile

1. **Reinicie o aplicativo mobile**
   ```bash
   cd mobile
   npm start
   ```

2. **Teste de Login:**
   - Abra o app
   - Clique no campo "Equipe"
   - Selecione uma equipe (ex: CNT 01)
   - Digite a senha: **Teccel2025**
   - Clique em "Entrar"

3. **Verificar:**
   - ✅ Login deve ser bem-sucedido
   - ✅ Deve aparecer um banner vermelho no topo: "Equipe logada: CNT 01"
   - ✅ Deve mostrar apenas obras da equipe CNT 01
   - ✅ Botão "Sair" deve estar visível

### 2.2 Testar Filtro de Obras

1. **Criar obra com CNT 01:**
   - Faça login com CNT 01
   - Crie uma nova obra
   - Observe que o campo "Equipe" não aparece mais na tela (é preenchido automaticamente em background)
   - Salve a obra

2. **Login com outra equipe:**
   - Faça logout
   - Faça login com MNT 02
   - Verifique que NÃO aparece a obra criada por CNT 01
   - Apenas obras de MNT 02 devem aparecer

### 2.3 Testar Logout

1. Na tela "Obras", clique no botão "Sair"
2. Confirme a ação
3. Deve voltar para a tela de login
4. Sessão deve ser limpa (não deve logar automaticamente)

---

## 🔒 Passo 3: Alterar Senhas Padrão (IMPORTANTE!)

**⚠️ ATENÇÃO:** A senha padrão `Teccel2025` está documentada publicamente. **Altere as senhas em produção!**

### 3.1 Alterar Senha via SQL

```sql
-- Alterar senha da equipe CNT 01 para "NovaSenha123"
UPDATE equipe_credenciais
SET senha_hash = crypt('NovaSenha123', gen_salt('bf'))
WHERE equipe_codigo = 'CNT 01';

-- Verificar se funcionou
SELECT * FROM validar_login_equipe('CNT 01', 'NovaSenha123');
```

### 3.2 Alterar Senha via Função (mais seguro)

```sql
-- Usando a função que valida a senha atual primeiro
SELECT alterar_senha_equipe(
  'CNT 01',           -- equipe
  'Teccel2025',       -- senha atual
  'NovaSenha123'      -- nova senha
);

-- Retorna true se sucesso, false se senha atual incorreta
```

### 3.3 Alterar Todas as Senhas de Uma Vez

```sql
-- Alterar senha de todas as equipes CNT
UPDATE equipe_credenciais
SET senha_hash = crypt('SenhaCNT2025', gen_salt('bf'))
WHERE equipe_codigo LIKE 'CNT%';

-- Alterar senha de todas as equipes MNT
UPDATE equipe_credenciais
SET senha_hash = crypt('SenhaMNT2025', gen_salt('bf'))
WHERE equipe_codigo LIKE 'MNT%';

-- Alterar senha de todas as equipes LV
UPDATE equipe_credenciais
SET senha_hash = crypt('SenhaLV2025', gen_salt('bf'))
WHERE equipe_codigo LIKE 'LV%';
```

---

## 🛠️ Passo 4: Gerenciamento de Equipes

### 4.1 Adicionar Nova Equipe

```sql
INSERT INTO equipe_credenciais (equipe_codigo, senha_hash, ativo)
VALUES ('CNT 13', crypt('Teccel2025', gen_salt('bf')), true);
```

### 4.2 Desativar Equipe (sem deletar)

```sql
UPDATE equipe_credenciais
SET ativo = false
WHERE equipe_codigo = 'CNT 01';
```

### 4.3 Reativar Equipe

```sql
UPDATE equipe_credenciais
SET ativo = true
WHERE equipe_codigo = 'CNT 01';
```

### 4.4 Ver Histórico de Logins

```sql
-- Ver últimos 50 logins
SELECT
  equipe_codigo,
  login_at,
  ultimo_acesso,
  device_id,
  ativo
FROM equipe_sessoes
ORDER BY login_at DESC
LIMIT 50;

-- Ver equipes que estão logadas agora
SELECT
  equipe_codigo,
  login_at,
  ultimo_acesso,
  COUNT(*) as dispositivos_ativos
FROM equipe_sessoes
WHERE ativo = true
GROUP BY equipe_codigo, login_at, ultimo_acesso
ORDER BY ultimo_acesso DESC;
```

---

## 🐛 Resolução de Problemas

### Problema: "Equipe ou senha incorretos"

**Possíveis causas:**
1. Senha digitada errada
2. Equipe não existe no banco
3. Equipe está desativada (ativo = false)

**Solução:**
```sql
-- Verificar se equipe existe e está ativa
SELECT equipe_codigo, ativo FROM equipe_credenciais
WHERE equipe_codigo = 'CNT 01';

-- Resetar senha se necessário
UPDATE equipe_credenciais
SET senha_hash = crypt('Teccel2025', gen_salt('bf'))
WHERE equipe_codigo = 'CNT 01';
```

### Problema: "Erro ao validar credenciais"

**Causa:** Função `validar_login_equipe` não foi criada

**Solução:**
Execute novamente a migration completa no SQL Editor.

### Problema: Não mostra banner de equipe logada

**Causa:** Sessão não foi salva no AsyncStorage

**Solução:**
1. Limpe o cache do app
2. Faça logout e login novamente
3. Verifique o console para erros

### Problema: Vê obras de outras equipes

**Causa:** Filtro não está funcionando

**Solução:**
```sql
-- Verificar se o filtro está correto
SELECT equipe, COUNT(*)
FROM obras
GROUP BY equipe;

-- Testar o filtro manualmente
SELECT * FROM obras WHERE equipe = 'CNT 01';
```

---

## 📊 Monitoramento

### Dashboard de Uso

```sql
-- Quantas obras por equipe
SELECT equipe, COUNT(*) as total_obras
FROM obras
GROUP BY equipe
ORDER BY total_obras DESC;

-- Equipes mais ativas (por logins)
SELECT equipe_codigo, COUNT(*) as total_logins
FROM equipe_sessoes
GROUP BY equipe_codigo
ORDER BY total_logins DESC;

-- Últimas atividades
SELECT
  e.equipe_codigo,
  COUNT(o.id) as obras_cadastradas,
  MAX(o.created_at) as ultima_obra
FROM equipe_credenciais e
LEFT JOIN obras o ON o.equipe = e.equipe_codigo
GROUP BY e.equipe_codigo
ORDER BY ultima_obra DESC NULLS LAST;
```

---

## 📝 Checklist Final

Antes de colocar em produção, verifique:

- [ ] Migration aplicada com sucesso no banco
- [ ] Todas as 18 equipes cadastradas
- [ ] Função `validar_login_equipe` funciona
- [ ] Senhas padrão foram alteradas (se em produção)
- [ ] Login funciona no mobile
- [ ] Filtro de obras por equipe funciona
- [ ] Logout funciona corretamente
- [ ] Campo "Equipe" não aparece na tela de nova obra (preenchido automaticamente)
- [ ] Banner de equipe logada aparece no topo da tela de obras

---

## 📚 Arquivos Modificados

**Banco de Dados:**
- `supabase/migrations/20250211_sistema_login_por_equipe.sql` (NOVO)

**Mobile:**
- `mobile/app/login.tsx` (MODIFICADO - Sistema de login por equipe)
- `mobile/app/(tabs)/obras.tsx` (MODIFICADO - Banner de equipe + logout + filtro)
- `mobile/app/nova-obra.tsx` (MODIFICADO - Equipe automática em background, campo removido da UI)

---

## 🔐 Credenciais Padrão

**Todas as equipes foram cadastradas com a senha padrão:**

```
Senha: Teccel2025
```

**Equipes disponíveis:**
- **CNT:** CNT 01, CNT 02, CNT 03, CNT 04, CNT 06, CNT 07, CNT 10, CNT 11, CNT 12
- **MNT:** MNT 01, MNT 02, MNT 03, MNT 04, MNT 05, MNT 06
- **LV:** LV 01 CJZ, LV 02 PTS, LV 03 JR PTS

---

**Data de Implementação:** 2025-02-11
**Versão:** 3.0.0 - Sistema de Login por Equipe
