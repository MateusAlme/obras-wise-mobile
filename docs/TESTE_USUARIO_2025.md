# ✅ Checklist de Teste - Usuário 2025

## 🎯 Objetivo
Verificar se o usuário com matrícula 2025 consegue visualizar TODAS as obras cadastradas no sistema.

---

## 📋 O Que Foi Feito

### ✅ Banco de Dados
- [x] Usuário 2025 criado (email: 2025@obraswise.com)
- [x] Políticas RLS configuradas para compartilhamento
- [x] RLS habilitado na tabela obras
- [x] Todas as políticas antigas removidas

### ✅ Código do App Mobile
- [x] Removido filtro `.eq('user_id', user.id)` em `mobile/app/(tabs)/index.tsx`
- [x] Removido filtro `.eq('user_id', user.id)` em `mobile/app/(tabs)/obras.tsx`

---

## 🧪 Como Testar

### Passo 1: Criar uma Obra de Teste no Banco

Execute no Supabase SQL Editor: [scripts/criar_obra_teste.sql](scripts/criar_obra_teste.sql)

Ou execute esta query rápida:

```sql
INSERT INTO obras (
  user_id,
  data,
  obra,
  responsavel,
  equipe,
  tipo_servico,
  tem_atipicidade,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = '2025@obraswise.com'),
  CURRENT_DATE,
  'Teste - Obra Compartilhada',
  'Sistema',
  'CNT 01',
  ARRAY['Teste'],
  false,
  NOW(),
  NOW()
);
```

### Passo 2: Reiniciar o App Mobile

1. **Feche o app completamente** (force stop ou swipe para fechar)
2. **Limpe o cache** (opcional mas recomendado):
   - Android: Configurações → Apps → Seu App → Limpar Cache
   - iOS: Desinstalar e reinstalar
3. **Abra o app novamente**

### Passo 3: Fazer Login com Usuário 2025

```
Matrícula: 2025
Senha: teccel2025
```

### Passo 4: Verificar a Listagem de Obras

- [ ] O app mostra obras na tela inicial?
- [ ] A contagem de obras aparece?
- [ ] Ao clicar em "Obras" vê a lista completa?
- [ ] As obras de outros usuários aparecem?

---

## ✅ Resultados Esperados

### Tela Inicial (Dashboard)
```
📊 Dashboard
Total de obras: X (onde X > 0)
```

### Tela de Obras
```
📋 Minhas Obras
- Teste - Obra Compartilhada
  Equipe: CNT 01
  Data: [data atual]

(Todas as outras obras do sistema devem aparecer aqui)
```

---

## ❌ Problemas Possíveis

### Problema 1: "Total de obras: 0"

**Causa:** Não há obras no banco de dados

**Solução:**
1. Execute `scripts/criar_obra_teste.sql`
2. Ou cadastre uma obra manualmente pelo app com outro usuário

### Problema 2: App não atualiza

**Causa:** Cache antigo do app

**Solução:**
1. Force stop no app
2. Limpe o cache
3. Faça logout e login novamente
4. Em último caso, reinstale o app

### Problema 3: Erro ao fazer login

**Causa:** Usuário 2025 não foi criado corretamente

**Solução:**
1. Execute `scripts/fix_completo_usuario_2025.sql`
2. Verifique com `scripts/diagnostico_usuario_2025.sql`

---

## 🔍 Verificações no Banco de Dados

### Verificar se há obras:
```sql
SELECT COUNT(*) FROM obras;
```

### Ver últimas obras:
```sql
SELECT
  o.obra as nome,
  o.equipe,
  u.email as criado_por,
  o.created_at
FROM obras o
LEFT JOIN auth.users u ON u.id = o.user_id
ORDER BY o.created_at DESC
LIMIT 5;
```

### Verificar políticas RLS:
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'obras';
```

Deve retornar:
- ✅ Usuários autenticados podem ver todas as obras (SELECT)
- ✅ Usuários autenticados podem criar obras (INSERT)
- ✅ Usuários autenticados podem editar todas as obras (UPDATE)
- ✅ Usuários autenticados podem deletar todas as obras (DELETE)

---

## 📝 Log de Testes

### Teste 1: [Data/Hora]
- [ ] Login realizado
- [ ] Obras apareceram: SIM / NÃO
- [ ] Total de obras vistas: ___
- [ ] Observações: _______________________

### Teste 2: [Data/Hora]
- [ ] Login realizado
- [ ] Obras apareceram: SIM / NÃO
- [ ] Total de obras vistas: ___
- [ ] Observações: _______________________

---

## 🆘 Suporte

Se os testes falharem:

1. **Execute diagnóstico completo:**
   ```
   scripts/verificar_obras_app.sql
   ```

2. **Consulte troubleshooting:**
   ```
   scripts/TROUBLESHOOTING_USUARIO_2025.md
   ```

3. **Verifique logs do console do app:**
   - Procure por erros de rede
   - Procure por erros de RLS
   - Procure por erros de autenticação

---

## ✅ Checklist Final

Antes de considerar concluído:

- [ ] Usuário 2025 foi criado com sucesso
- [ ] Políticas RLS estão compartilhadas
- [ ] Código do app foi atualizado (sem filtro por user_id)
- [ ] Pelo menos 1 obra existe no banco
- [ ] App foi reiniciado
- [ ] Login com usuário 2025 funciona
- [ ] Obras aparecem na listagem
- [ ] Contador de obras está correto

---

**Data do teste:** _______________________

**Resultado final:** ✅ PASSOU / ❌ FALHOU

**Notas adicionais:**
```
_____________________________________________
_____________________________________________
_____________________________________________
```
