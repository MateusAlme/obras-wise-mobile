# Melhorias Pendentes - Próxima Sessão

## Resumo da Sessão Atual

Nesta sessão foram implementadas as seguintes melhorias:

### ✅ Concluído
1. **Sistema de Equipes Dinâmicas**
   - App mobile agora carrega equipes do banco de dados
   - Implementado cache local para funcionar offline
   - Recarregamento automático ao abrir dropdown
   - Corrigida função `criar_equipe_com_senha` para criar em ambas tabelas

2. **Políticas RLS**
   - Permitida leitura pública de equipes ativas
   - Sincronização de equipes existentes

3. **Sistema Web**
   - Fotos de perfil para usuários
   - Melhorias na splash screen do app mobile
   - Campo adicional de Laudo para transformadores retirados
   - Correções de compatibilidade com Next.js 15

---

## 📋 Pendências para Próxima Sessão

### 1. Ajustes no Perfil do Compressor

**Arquivo:** `mobile/app/(comp)/_layout.tsx`

**Objetivos:**
- [ ] Revisar e corrigir menu inferior para ser mais responsivo
- [ ] Ajustar layout para padrão profissional consistente
- [ ] Garantir boa adaptação para diferentes tamanhos de tela (mobile e tablet)
- [ ] Melhorar espaçamento e visual dos ícones do menu

**Observações:**
- O menu atual está funcional mas precisa de melhorias de responsividade
- Manter consistência visual com outros perfis do sistema

---

### 2. Reestruturação do Book de Cava em Rocha

**Arquivo:** `mobile/app/cava-rocha.tsx`

**Estrutura de Dados Necessária:**

```typescript
type Poste = {
  id: string;
  numero: number; // Gerado automaticamente (P1, P2, P3...)
  fotosAntes: FotoData[];
  fotosDurante: FotoData[];
  fotosDepois: FotoData[];
  observacao?: string;
};

type BookCavaRocha = {
  data: string;
  obra: string;
  equipeExecutora: string;
  responsavel: string;
  observacaoGeral?: string;
  postes: Poste[]; // Array de postes
};
```

**Funcionalidades a Implementar:**

- [ ] **Checklist de Fiscalização**
  - Converter interface para formato de checklist
  - Cada poste é um item do checklist
  - Status: pendente / em andamento / concluído

- [ ] **Gestão de Múltiplos Postes**
  - Botão "Adicionar Poste"
  - Geração automática de ID: P1, P2, P3...
  - Possibilidade de remover postes
  - Reordenar postes
  - Expandir/colapsar seções de cada poste

- [ ] **Fotos por Poste**
  - Seção "Antes" (obrigatória)
  - Seção "Durante" (obrigatória)
  - Seção "Depois" (obrigatória)
  - Contador de fotos por seção
  - Visualização prévia das fotos

**UI/UX:**
```
┌─────────────────────────────────────┐
│ BOOK DE CAVA EM ROCHA              │
├─────────────────────────────────────┤
│ [Dados Gerais: Obra, Data, etc]    │
├─────────────────────────────────────┤
│ CHECKLIST DE POSTES                │
│                                     │
│ ┌─ P1 ─────────────────────┐      │
│ │ ✓ Fotos Antes: 3         │      │
│ │ ✓ Fotos Durante: 2       │      │
│ │ ⊗ Fotos Depois: 0        │      │
│ │ [Expandir] [Remover]     │      │
│ └──────────────────────────┘      │
│                                     │
│ ┌─ P2 ─────────────────────┐      │
│ │ ⊗ Pendente               │      │
│ │ [Expandir] [Remover]     │      │
│ └──────────────────────────┘      │
│                                     │
│ [+ Adicionar Poste]                │
└─────────────────────────────────────┘
```

---

### 3. Campo Padronizado de Identificação de Postes

**Aplicar em:**
- [ ] Cava em rocha (`mobile/app/cava-rocha.tsx`)
- [ ] Linha viva (localizar arquivo)
- [ ] Aterramento (localizar arquivo)
- [ ] Fundação especial (localizar arquivo)

**Implementação:**

```typescript
// Componente de Input de Poste
<View style={styles.posteIdContainer}>
  <Text style={styles.posteIdPrefix}>P</Text>
  <TextInput
    style={styles.posteIdInput}
    value={posteNumero}
    onChangeText={(text) => {
      // Aceita apenas números
      const numero = text.replace(/[^0-9]/g, '');
      setPosteNumero(numero);
    }}
    placeholder="1"
    keyboardType="numeric"
    maxLength={3}
  />
</View>

// Display: P1, P2, P3...
const posteId = `P${posteNumero}`;
```

**Validações:**
- Não permitir poste sem número
- Não permitir números duplicados no mesmo book
- Validar que o número é válido (1-999)

**Benefícios:**
- Padronização automática
- Redução de erros de digitação
- Interface mais intuitiva
- Facilita busca e organização

---

### 4. Atualização do Banco de Dados

**Tabela:** `obras`

**Novos Campos Necessários:**

```sql
ALTER TABLE obras ADD COLUMN IF NOT EXISTS postes_data JSONB;

-- Estrutura do JSONB:
-- [
--   {
--     "id": "P1",
--     "numero": 1,
--     "fotos_antes": [...],
--     "fotos_durante": [...],
--     "fotos_depois": [...],
--     "observacao": "..."
--   }
-- ]
```

**Migration a Criar:**
```sql
-- supabase/migrations/20260130_adicionar_campo_postes.sql

-- Adicionar campo para armazenar dados dos postes
ALTER TABLE obras ADD COLUMN IF NOT EXISTS postes_data JSONB DEFAULT '[]';

-- Índice para busca por postes
CREATE INDEX IF NOT EXISTS idx_obras_postes_data ON obras USING gin (postes_data);

-- Comentário
COMMENT ON COLUMN obras.postes_data IS
'Armazena array de postes com fotos antes/durante/depois e identificação padronizada (P1, P2, P3...)';
```

---

### 5. Considerações de Implementação

**Manter Compatibilidade:**
- Obras antigas (sem campo postes_data) devem continuar funcionando
- Migração gradual para novo formato
- Considerar fallback para formato antigo

**Performance:**
- Carregar fotos de forma lazy (sob demanda)
- Comprimir imagens antes do upload
- Cache local de thumbnails

**Validações:**
- Mínimo 1 poste por book
- Pelo menos 1 foto em cada seção (antes/durante/depois)
- ID de poste único dentro do mesmo book
- Número da obra válido (8-10 dígitos)

**Offline First:**
- Salvar dados localmente primeiro
- Sincronizar quando houver conexão
- Indicador visual de status de sync
- Retry automático em caso de falha

---

## 📁 Arquivos a Localizar

Precisa-se encontrar os arquivos dos seguintes tipos de serviço:

```bash
# Comandos para buscar:
find mobile/app -name "*linha*viva*" -o -name "*aterramento*" -o -name "*fundacao*"
grep -r "Linha Viva\|Aterramento\|Fundação Especial" mobile/app/
```

---

## 🎯 Ordem de Implementação Sugerida

1. **Primeiro:** Reestruturar Book de Cava em Rocha (arquivo único, mais complexo)
2. **Segundo:** Implementar campo padronizado de ID de poste
3. **Terceiro:** Aplicar mesma estrutura em Linha Viva
4. **Quarto:** Aplicar em Aterramento
5. **Quinto:** Aplicar em Fundação Especial
6. **Sexto:** Ajustar responsividade do perfil Compressor
7. **Sétimo:** Testes completos em diferentes dispositivos

---

## 📝 Notas Importantes

- **Backup:** Fazer backup do código atual antes de grandes mudanças
- **Testes:** Testar cada tipo de serviço após implementação
- **Usuários:** Comunicar mudanças aos usuários finais
- **Documentação:** Atualizar documentação de uso do app
- **Performance:** Monitorar uso de memória com múltiplas fotos

---

## 🔗 Referências

- Código atual: `mobile/app/cava-rocha.tsx`
- Layout Compressor: `mobile/app/(comp)/_layout.tsx`
- Tipos de serviço: buscar em `mobile/app/nova-obra.tsx`

---

## ✅ Critérios de Aceitação

**Book de Cava em Rocha:**
- [ ] Permite adicionar múltiplos postes
- [ ] ID automático com prefixo "P"
- [ ] 3 seções de fotos por poste (antes/durante/depois)
- [ ] Interface de checklist intuitiva
- [ ] Funciona offline
- [ ] Sincroniza corretamente

**Campo de ID de Poste:**
- [ ] Prefixo "P" automático
- [ ] Aceita apenas números
- [ ] Não permite duplicados
- [ ] Visual profissional e claro

**Responsividade:**
- [ ] Funciona em smartphones (5-7 polegadas)
- [ ] Funciona em tablets (8-12 polegadas)
- [ ] Menu inferior adaptável
- [ ] Botões e textos legíveis

---

**Data:** 2026-01-29
**Sessão:** Preparação para Melhorias v2.0
**Status:** Planejamento Completo ✓
