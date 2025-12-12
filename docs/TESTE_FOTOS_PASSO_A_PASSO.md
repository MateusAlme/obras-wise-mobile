# 📸 Teste de Fotos - Passo a Passo

Este guia vai te ajudar a testar se as fotos estão funcionando corretamente no sistema.

---

## 🔍 Problema Atual

Você criou duas obras:
- **Obra 00000000** - Criada em 19/11 (ANTES da migração)
- **Obra 7777777777** - Criada em 19/11 (DEPOIS da migração?)

**Nenhuma delas mostra fotos nos detalhes.**

---

## ✅ Solução Simplificada

### Passo 1: Deletar Obras Antigas (Opcional)

As obras antigas podem ter sido criadas antes das colunas existirem. Para um teste limpo:

1. Abra o **Supabase Dashboard**
2. Vá em **Table Editor** → **obras**
3. Delete as obras de teste (00000000 e 7777777777)
4. Ou deixe-as lá e crie uma nova

---

### Passo 2: Criar Nova Obra de Teste

**No App Mobile:**

1. ✅ Toque em "Nova Obra"
2. ✅ Preencha os dados:
   ```
   Data: Hoje
   Número da Obra: 8888888888
   Responsável: Seu Nome
   Equipe: CNT 01
   Tipo de Serviço: Emenda
   Atipicidades: Não
   ```

3. ✅ **IMPORTANTE:** Tire as 3 fotos obrigatórias:
   - Antes (1 foto mínimo)
   - Durante (1 foto mínimo)
   - Depois (1 foto mínimo)

4. ✅ Toque em "Salvar Obra"

5. ✅ Aguarde a mensagem: **"✅ Sucesso! Obra cadastrada com 3 foto(s) enviada(s)!"**

---

### Passo 3: Verificar se Fotos Aparecem

1. ✅ Volte para a lista de obras
2. ✅ Puxe para baixo para atualizar (refresh)
3. ✅ Toque na obra **8888888888**
4. ✅ **Verifique:** As 3 fotos devem aparecer em miniatura

**Se as fotos aparecerem:** ✅ Sistema funcionando!
**Se não aparecerem:** ❌ Vamos para o Passo 4

---

### Passo 4: Verificar no Supabase

**Abra o Supabase Dashboard:**

1. Vá em **Table Editor** → **obras**
2. Encontre a obra **8888888888**
3. Clique para ver os detalhes
4. **Verifique as colunas:**
   ```
   fotos_antes: [{"url": "...", "latitude": ..., "longitude": ...}]
   fotos_durante: [{"url": "...", "latitude": ..., "longitude": ...}]
   fotos_depois: [{"url": "...", "latitude": ..., "longitude": ...}]
   ```

**Se as colunas estão vazias `[]` ou `null`:**
- ❌ As fotos não foram salvas no banco
- ➡️ Problema no código de salvamento

**Se as colunas têm dados:**
- ✅ Fotos foram salvas no banco
- ❌ Problema na exibição no app
- ➡️ Problema no código de leitura

---

### Passo 5: Verificar Storage do Supabase

**Verifique se as imagens foram enviadas:**

1. No Supabase Dashboard, vá em **Storage**
2. Abra o bucket **"obras-fotos"** ou similar
3. **Verifique:** Deve haver 3 imagens novas
4. **Tente abrir uma imagem:** Deve carregar e mostrar a foto

**Se não houver imagens no Storage:**
- ❌ Upload de fotos falhou
- ➡️ Problema na função de upload

---

## 🔧 Diagnóstico Rápido

Use esta tabela para identificar o problema:

| Sintoma | Causa Provável | Solução |
|---------|----------------|---------|
| Fotos não aparecem, colunas vazias no banco | Upload falhou ou obra criada antes da migração | Criar nova obra após migração |
| Fotos no banco, mas não aparecem no app | Problema no código de exibição | Verificar `getPhotosForSection()` |
| Erro ao salvar obra | Colunas não existem no banco | Aplicar migração novamente |
| App trava ao tirar foto | Problema de permissões | Verificar permissões câmera/localização |

---

## 📋 Checklist de Validação

Marque cada item conforme testa:

### ✅ Infraestrutura
- [ ] Migração `20250119_adicionar_colunas_fotos.sql` foi aplicada
- [ ] Tabela `obras` tem 14 colunas de fotos
- [ ] Storage bucket `obras-fotos` existe e está público
- [ ] RLS (Row Level Security) permite insert/select

### ✅ Criação de Obra
- [ ] App permite tirar fotos
- [ ] Validação bloqueia se faltar fotos obrigatórias
- [ ] Mensagem de sucesso aparece após salvar
- [ ] Obra aparece na lista após salvar

### ✅ Visualização
- [ ] Obra aparece na lista
- [ ] Detalhes da obra abrem corretamente
- [ ] Fotos aparecem em miniatura
- [ ] Fotos podem ser ampliadas (se implementado)

### ✅ Sincronização
- [ ] Fotos salvas no Storage do Supabase
- [ ] URLs das fotos salvos no banco
- [ ] Coordenadas GPS salvas junto com fotos

---

## 🚨 Problemas Comuns

### 1. "Nenhuma foto disponível"

**Causa:** Fotos não estão no banco ou formato errado

**Solução:**
```typescript
// Verifique se os dados estão assim:
fotos_antes: [
  {
    "url": "https://supabase.co/storage/...",
    "latitude": -23.550520,
    "longitude": -46.633308
  }
]
```

### 2. "Cannot read property 'length' of undefined"

**Causa:** Coluna não existe ou está null

**Solução:** Aplicar migração novamente

### 3. Imagens não carregam (quebradas)

**Causa:** URLs inválidas ou Storage não público

**Solução:**
1. Verificar permissões do bucket
2. Verificar se URLs estão corretas
3. Testar URL diretamente no navegador

---

## 💡 Dicas

1. **Sempre teste com uma obra nova** após fazer mudanças no banco
2. **Delete obras de teste antigas** para evitar confusão
3. **Use números fáceis** (1111111111, 2222222222) para obras de teste
4. **Verifique o console do Metro** para ver erros
5. **Recarregue a lista** (pull to refresh) após criar obra

---

## 🎯 Resultado Esperado

Após seguir este guia, você deve:

✅ Conseguir criar uma obra nova
✅ Ver as fotos nos detalhes da obra
✅ Ver as fotos no Supabase
✅ Ver as imagens no Storage

Se tudo funcionar, o sistema está 100% operacional! 🎉

---

## 📞 Próximos Passos

Se o teste passar:
1. Delete as obras de teste antigas
2. Treine os usuários no fluxo correto
3. Documente qualquer comportamento estranho

Se o teste falhar:
1. Anote exatamente qual passo falhou
2. Tire print do erro (se houver)
3. Verifique os logs do Metro Bundler
4. Entre em contato com suporte técnico
