# 📋 Instruções para Aplicar as Atualizações no Frontend

## 🎯 Resumo das Mudanças

Foram implementadas **2 grandes melhorias**:

### ✅ 1. Novos Serviços e Documentos
- **Altimetria** (4 fotos)
- **Vazamento e Limpeza de Transformador** (7 fotos)
- **Termo de Desistência - LPT** (documento)

### ✅ 2. Visualização Individual e Status de Obras
- Filtro automático por usuário - cada usuário vê apenas suas próprias obras (RLS)
- Status de obra (em aberto / finalizada)
- Contador de fotos pendentes
- Indicadores visuais nos cards

---

## 🚀 Passo 1: Aplicar Migrations no Banco de Dados

### Opção A: Via Supabase Dashboard (RECOMENDADO)

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/SEU_PROJECT_ID/sql

2. **Abra o SQL Editor:**
   - Menu lateral > SQL Editor
   - Clique em "New query"

3. **Execute o script consolidado:**
   - Abra o arquivo: `supabase/EXECUTAR_NO_DASHBOARD.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor
   - Clique em "Run" (ou pressione Ctrl+Enter)

4. **Verifique se executou com sucesso:**
   - Deve mostrar "Success" na parte inferior
   - Verifique os resultados das queries de verificação no final

### Opção B: Via CLI (se o Docker estiver rodando)

```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile"
supabase db push
```

---

## 📱 Passo 2: Atualizar o App Mobile

### 2.1 Limpar Cache e Reinstalar Dependências

```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\mobile"

# Limpar cache do Expo
npx expo start -c

# OU reiniciar o servidor
# Pressione Ctrl+C para parar
# Execute novamente: npx expo start
```

### 2.2 Verificar se os Novos Tipos de Serviço Aparecem

1. Abra o app no dispositivo/emulador
2. Clique em "Nova Obra"
3. Na lista de "Tipo de Serviço", verifique se aparecem:
   - ✅ Altimetria
   - ✅ Vazamento e Limpeza de Transformador

### 2.3 Testar Indicadores Visuais

1. Acesse a tela "Obras"
2. Verifique os cards das obras:
   - Você deve ver **apenas as obras que você criou** (não verá obras de outros usuários)
   - Obras com fotos pendentes devem mostrar: **"⚠ Em aberto"** (amarelo)
   - Contador de fotos pendentes: **"X foto(s) pendente(s)"**
   - Obras finalizadas devem mostrar: **"✓ Finalizada"** (verde)

---

## 🌐 Passo 3: Atualizar o App Web

### 3.1 Reiniciar o Servidor de Desenvolvimento

```bash
cd "C:\Users\Mateus Almeida\obras-wise-mobile\web"

# Parar o servidor (Ctrl+C)
# Limpar cache do Next.js
if exist ".next\dev\lock" del ".next\dev\lock"

# Reiniciar
npm run dev
```

### 3.2 Verificar no Navegador

1. Abra: http://localhost:3000
2. Faça login
3. Verifique se você vê **apenas as obras que você criou** (não verá obras de outros usuários)
4. Teste a geração de PDF (deve incluir as novas seções)

---

## 🔍 Passo 4: Verificações Importantes

### ✅ Checklist de Validação

- [ ] **Banco de Dados:**
  - [ ] Campos `status` e `finalizada_em` existem na tabela `obras`
  - [ ] 12 novos campos de fotos foram criados
  - [ ] Políticas RLS estão ativas
  - [ ] Função `calcular_fotos_pendentes` foi criada

- [ ] **App Mobile:**
  - [ ] Novos tipos de serviço aparecem na lista
  - [ ] Cards de obras mostram badges de status
  - [ ] Contador de fotos pendentes funciona
  - [ ] Apenas obras que você criou são exibidas (filtro individual)

- [ ] **App Web:**
  - [ ] Dashboard carrega apenas suas obras (filtro individual)
  - [ ] PDF inclui novas seções (Altimetria, Vazamento, Termo LPT)
  - [ ] Filtros funcionam corretamente

---

## 🐛 Resolução de Problemas

### Problema: "Não vejo as mudanças no frontend"

**Solução:**
1. Verifique se o script SQL foi executado com sucesso no Supabase
2. Limpe o cache do app:
   ```bash
   # Mobile
   npx expo start -c

   # Web
   rm -rf .next
   npm run dev
   ```
3. Force refresh no navegador (Ctrl+Shift+R)
4. No mobile, feche completamente o app e abra novamente

### Problema: "RLS bloqueia todas as obras" ou "Não vejo minhas obras"

**Possíveis causas:**
1. O campo `user_id` nas obras antigas pode estar NULL ou com valor incorreto
2. Você não está autenticado corretamente

**Solução:**
```sql
-- Verificar se suas obras têm o user_id correto
SELECT id, obra, user_id, created_at
FROM obras
WHERE user_id = auth.uid();

-- Se suas obras antigas não aparecem, pode ser necessário atualizar o user_id
-- CUIDADO: Execute apenas se você tiver certeza de que são suas obras!
UPDATE obras
SET user_id = auth.uid()
WHERE user_id IS NULL AND created_at >= 'DATA_INICIO_SUAS_OBRAS';
```

### Problema: "Contador de fotos pendentes não aparece"

**Causa:** O campo `status` pode estar NULL em obras antigas

**Solução:**
```sql
-- Executar no SQL Editor do Supabase
UPDATE obras
SET status = 'em_aberto'
WHERE status IS NULL;
```

### Problema: "Migration 'file name must match pattern' error"

**Causa:** Arquivos `EXECUTAR_AGORA.sql`, `fix_admin_user.sql` não seguem o padrão

**Solução:** Ignore esses avisos ou renomeie os arquivos:
```bash
# Renomear para incluir timestamp
mv EXECUTAR_AGORA.sql 20250101_executar_agora.sql
mv fix_admin_user.sql 20250101_fix_admin_user.sql
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do console do navegador (F12 > Console)
2. Verifique os logs do Expo (terminal onde rodou `npx expo start`)
3. Consulte a documentação do Supabase: https://supabase.com/docs
4. Entre em contato com o desenvolvedor

---

## 🎉 Próximos Passos

Após validar que tudo está funcionando:

1. **Testar criação de obras** com os novos serviços
2. **Validar upload de fotos** nas novas seções
3. **Testar filtro individual** (criar obras com diferentes usuários e verificar que cada um vê apenas as suas)
4. **Gerar PDFs** e verificar se incluem as novas seções
5. **Finalizar uma obra** e verificar se o status muda corretamente

---

## 📝 Notas Técnicas

### Arquivos Modificados

**Banco de Dados:**
- `supabase/migrations/20250208_adicionar_altimetria_vazamento.sql`
- `supabase/migrations/20250209_melhorias_visualizacao_equipe.sql` (substituído pela 20250210)
- `supabase/migrations/20250210_filtro_individual_por_usuario.sql`
- `supabase/EXECUTAR_NO_DASHBOARD.sql` (script consolidado - USA FILTRO INDIVIDUAL)

**Mobile:**
- `mobile/app/nova-obra.tsx`
- `mobile/app/(tabs)/obras.tsx`
- `mobile/app/obra-detalhe.tsx`
- `mobile/lib/offline-sync.ts`

**Web:**
- `web/src/lib/supabase.ts`
- `web/src/lib/pdf-generator.ts`

### Compatibilidade

- ✅ Funciona com obras antigas (status padrão: `em_aberto`)
- ⚠️ **Obras antigas podem precisar ter o `user_id` atualizado** se estiverem NULL
- ✅ Sincronização offline mantém compatibilidade
- ✅ PDFs antigos continuam funcionando
- ✅ Filtro individual garante privacidade entre usuários

---

**Data de Atualização:** 2025-02-10
**Versão:** 2.1.0 - Filtro Individual por Usuário
