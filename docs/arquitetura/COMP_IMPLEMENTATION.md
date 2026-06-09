# 🔧 Implementação do Perfil COMP (Compressor)

## 📋 Resumo
Perfil exclusivo para registro de serviços de **Cava em Rocha**, com permissão para lançar serviços para qualquer equipe. **Interface idêntica às equipes normais**, mas restrito apenas a Cava em Rocha.

---

## 🔐 Credenciais de Acesso

| Campo | Valor |
|-------|-------|
| **Usuário** | `COMP` |
| **Senha** | `Teccel2025` |
| **Role** | `compressor` |
| **Acesso** | Apenas serviço "Cava em Rocha" |

---

## ✅ Funcionalidades Implementadas

### 1. **Login Especial**
- [login.tsx](../mobile/app/login.tsx) reconhece credenciais COMP
- Redireciona para estrutura de tabs `/(comp)` igual às equipes
- Armazena role `compressor` no AsyncStorage

### 2. **Interface Completa com Tabs**
- **Estrutura:** [app/(comp)/](../mobile/app/(comp)/)
- **Tab "Cava em Rocha":** [index.tsx](../mobile/app/(comp)/index.tsx)
  - Histórico de todas as obras lançadas por COMP
  - Filtros: Todas, Em Aberto, Finalizadas
  - Botão FAB (+) para nova obra
  - Pull-to-refresh
  - Contador de registros
- **Tab "Perfil":** [profile.tsx](../mobile/app/(comp)/profile.tsx)
  - Informações do usuário COMP
  - Dados de login
  - Botão de logout

### 3. **Formulário Dinâmico** (Mesma Tela das Equipes)
- [nova-obra.tsx](../mobile/app/nova-obra.tsx) adaptado para COMP
- **Diferenças quando COMP está logado:**
  - ✅ Tipo de Serviço **fixado** em "Cava em Rocha" (desabilitado)
  - ✅ Campo extra: **Equipe Executora** (dropdown obrigatório)
  - ✅ Mesmas fotos e campos das equipes normais
  - ✅ Salvamento automático com `created_by: 'COMP'`

### 4. **Integração com Histórico das Equipes**
- Registros salvos com:
  ```json
  {
    "equipe": "CNT 01",        // Equipe selecionada
    "tipo_servico": "Cava em Rocha",
    "created_by": "COMP",      // Identificação do criador
    "creator_role": "compressor",
    "status": "finalizada"
  }
  ```
- Obras aparecem no histórico da equipe selecionada
- Filtradas corretamente pelas RLS policies

### 5. **RLS Policies**
Migration: [20250213_comp_role.sql](../supabase/migrations/20250213_comp_role.sql)

**Políticas criadas:**
- `comp_insert_cava_rocha`: COMP só pode inserir "Cava em Rocha"
- `comp_select_cava_rocha`: COMP só visualiza "Cava em Rocha"
- `comp_no_update`: COMP não pode editar registros
- `comp_no_delete`: COMP não pode deletar registros

**Novas colunas:**
```sql
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS creator_role TEXT;
```

### 6. **Headers Automáticos**
[supabase.ts](../mobile/lib/supabase.ts) envia automaticamente:
```typescript
{
  'x-equipe': 'COMP',
  'x-role': 'compressor'
}
```

---

## 🚀 Como Usar

### **Passo 1: Login**
1. Abrir app
2. Selecionar **"COMP"** no dropdown de equipes
3. Digitar senha: **Teccel2025**
4. Clicar em "Entrar"

### **Passo 2: Registrar Serviço**
1. Clicar no botão **+** (FAB) no canto inferior direito
2. Preencher **Número da Obra** (8-10 dígitos)
3. Preencher **Nome do Encarregado**
4. **Tipo de Serviço** já está fixado em "Cava em Rocha"
5. Selecionar **Equipe Executora** (ex: CNT 01, MNT 03, LV 01, etc)
6. Tirar **Fotos** conforme necessário (Antes, Durante, Depois)
7. Clicar em **"Salvar"**

### **Passo 3: Verificar no Histórico**
1. Logout do COMP
2. Login com a equipe selecionada (ex: CNT 01)
3. Ver o registro de "Cava em Rocha" no histórico
4. Detalhe mostra "Lançado por: COMP"

---

## 🗄️ Aplicar Migration no Banco

**IMPORTANTE:** Execute o SQL manualmente no Supabase Dashboard:

1. Acesse: https://supabase.com/dashboard/project/hiuagpzaelcocyxutgdt/editor
2. Abra o **SQL Editor**
3. Copie e cole o conteúdo de: `supabase/migrations/20250213_comp_role.sql`
4. Execute o SQL
5. Verifique se as colunas `created_by` e `creator_role` foram criadas
6. Verifique se as policies foram aplicadas

**Verificar policies:**
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'obras' AND policyname LIKE 'comp%';
```

**Resultado esperado:**
```
comp_insert_cava_rocha
comp_select_cava_rocha
comp_no_update
comp_no_delete
```

---

## 📊 Integração com BI/Relatórios

### **Filtros Sugeridos**

1. **Por Criador:**
```sql
SELECT * FROM obras WHERE created_by = 'COMP';
```

2. **Por Role:**
```sql
SELECT * FROM obras WHERE creator_role = 'compressor';
```

3. **Por Equipe + Tipo:**
```sql
SELECT * FROM obras
WHERE equipe = 'CNT 01'
AND tipo_servico = 'Cava em Rocha';
```

### **Campos para Relatórios**
- `equipe`: Equipe executora
- `created_by`: Quem lançou (COMP ou nome da equipe)
- `creator_role`: Tipo de perfil (compressor, equipe)
- `tipo_servico`: "Cava em Rocha"
- `data`: Data do serviço
- `responsavel`: Encarregado

---

## 🔒 Segurança

### **O que COMP PODE fazer:**
✅ Login com credenciais fixas
✅ Ver apenas registros de "Cava em Rocha"
✅ Inserir novos registros de "Cava em Rocha"
✅ Selecionar qualquer equipe executora
✅ Upload de fotos

### **O que COMP NÃO PODE fazer:**
❌ Ver outros tipos de serviço
❌ Editar registros existentes
❌ Deletar registros
❌ Acessar dashboards gerais
❌ Ver histórico completo de equipes
❌ Modificar registros de outras equipes

---

## 🧪 Testes

### **Teste 1: Login COMP**
```
✅ Login com COMP/Teccel2025
✅ Redireciona para /cava-rocha
✅ Mostra interface exclusiva
```

### **Teste 2: Registro para CNT 01**
```
✅ Preencher formulário
✅ Selecionar "CNT 01"
✅ Salvar com sucesso
✅ Verificar registro no banco com equipe='CNT 01'
```

### **Teste 3: Visualização por Equipe**
```
✅ Logout COMP
✅ Login com CNT 01
✅ Ver registro de Cava em Rocha no histórico
✅ Detalhe mostra "Criado por: COMP"
```

### **Teste 4: RLS**
```
✅ COMP não vê outros serviços
✅ CNT 01 não vê registros de CNT 02
✅ COMP não pode editar/deletar
```

---

## 📝 Arquivos Modificados/Criados

### **Criados:**
- ✅ `mobile/app/(comp)/_layout.tsx` - Layout de tabs para COMP
- ✅ `mobile/app/(comp)/index.tsx` - Tela principal com histórico
- ✅ `mobile/app/(comp)/profile.tsx` - Tela de perfil COMP
- ✅ `supabase/migrations/20250213_comp_role.sql` - Migration RLS
- ✅ `docs/COMP_IMPLEMENTATION.md` - Esta documentação

### **Modificados:**
- ✅ `mobile/app/login.tsx` - Reconhece COMP e redireciona para /(comp)
- ✅ `mobile/app/nova-obra.tsx` - Detecta COMP, fixa "Cava em Rocha" e adiciona seletor de equipe
- ✅ `mobile/lib/supabase.ts` - Envia headers x-equipe e x-role

---

## 🐛 Troubleshooting

### **Problema:** COMP não consegue fazer login
**Solução:** Verificar se "COMP" está na lista EQUIPES em login.tsx

### **Problema:** COMP vê todos os serviços
**Solução:** Verificar se RLS policies foram aplicadas corretamente

### **Problema:** Registro não aparece no histórico da equipe
**Solução:**
1. Verificar se campo `equipe` foi salvo corretamente
2. Verificar RLS policy `obras_select_policy`
3. Confirmar que equipe está logada corretamente

### **Problema:** Migration não aplica
**Solução:** Executar SQL manualmente no Dashboard do Supabase

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs do console no app
2. Verificar policies no Supabase Dashboard
3. Testar queries SQL diretamente no editor

---

## ✨ Próximos Passos (Opcional)

1. **Dashboard BI:** Criar visualizações específicas para Cava em Rocha
2. **Relatórios:** Adicionar filtro por `created_by` e `creator_role`
3. **Auditoria:** Registrar logs de acesso do COMP
4. **Múltiplos COMP:** Permitir criar mais usuários compressor (COMP2, COMP3, etc)
5. **Permissões:** Adicionar role para visualizar (mas não editar) registros COMP

---

**Status:** ✅ **IMPLEMENTADO E PRONTO PARA USO**

**Versão:** 1.0
**Data:** 13/02/2025
**Autor:** Claude Code
