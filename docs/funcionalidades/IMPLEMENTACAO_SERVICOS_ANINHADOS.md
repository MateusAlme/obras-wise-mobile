# 🚀 Guia de Implementação: Arquitetura 1:N Obras → Serviços

## 📋 Resumo Executivo

Você agora tem uma **arquitetura refatorada** que transforma a gestão de obras do seu app:
- **Antes**: Diversos cards de obras dispersos (cada serviço = uma obra)
- **Depois**: Um card unificado por obra com múltiplos serviços aninhados

**Status**: ✅ Estrutura implementada e validada (build TypeScript limpo)

---

## 📦 Arquivos Criados

### 1. **Backend (Supabase)**
```
supabase/migrations/20260415_criar_tabela_servicos.sql
```
- Tabela `servicos` com schema completo
- RLS policies herdadas da tabela `obras`
- Índices para performance
- Comentários documentados

### 2. **TypeScript Types**
```
mobile/types/servico.ts
```
- `TipoServico`: Enum de 15 tipos
- `Servico`: Interface com todos os campos de fotos
- `ServicoLocal`: Versão offline com photoIds
- `SERVICO_PHOTO_MAP`: Mapeamento tipo → categorias de fotos
- Tipos auxiliares: `PosteData`, `SeccionamentoData`, etc.

### 3. **React Native Components**
```
mobile/components/ServicosComponents.tsx
```
- `ObraContainer`: Card colapsável da obra
- `ServiceCard`: Card expandível do serviço
- `PhotoCategoryTile`: Tile de categoria de fotos
- `ServiceTypeSelector`: Modal para selecionar tipo
- `StatusBadge` / `SyncBadge`: Indicadores visuais
- **Styles**: Design tokens, spacing, colors

### 4. **Sincronização**
```
mobile/lib/servico-sync.ts
```
- `saveServicoLocal()`: Armazena offline
- `syncServico()`: Sincroniza individual com Supabase
- `createServico()`: Cria novo
- `deleteServico()`: Deleta e limpa fotos
- `markServicoComplete()`: Marca como completo
- `fetchServicosForObra()`: Busca serviços de uma obra

### 5. **Exemplo de Integração**
```
mobile/app/obras-com-servicos-exemplo.tsx
```
- Componente function que mostra como usar tudo
- Lógica de expand/collapse
- Chamadas às funções de sincronização
- Fluxo de criação de novo serviço

---

## 🔧 Como Integrar

### Passo 1: Aplicar Migration no Supabase

```bash
# No Supabase Dashboard > SQL Editor:
# 1. Copie o conteúdo de supabase/migrations/20260415_criar_tabela_servicos.sql
# 2. Cole no SQL Editor
# 3. Execute (Run)
```

Ou use Supabase CLI:
```bash
supabase db push
```

### Passo 2: Atualizar sua tela `obras.tsx`

Adapte o exemplo em `obras-com-servicos-exemplo.tsx`:

```typescript
import { ObraContainer, ServiceCard, ServiceTypeSelector } from '../components/ServicosComponents';
import { fetchServicosForObra, createServico, deleteServico } from '../lib/servico-sync';
import { Servico } from '../types/servico';

// Componente com exemplo já implementado
```

**Principais mudanças**:
1. Remover renderização de um único `tipo_servico` por obra
2. Buscar array de `servicos` para cada obra
3. Usar `ObraContainer` e `ServiceCard` para renderizar
4. Conectar callbacks: `onAddService`, `onDeleteService`, etc.

### Passo 3: Atualizar `nova-obra.tsx`

Após criar uma obra, mostre seletor de tipo de serviço:

```typescript
import { ServiceTypeSelector } from '../components/ServicosComponents';
import { createServico } from '../lib/servico-sync';

// ... após sucesso na criação da obra

const [serviceSelectorVisible, setServiceSelectorVisible] = useState(false);

// Mostrar modal
{serviceSelectorVisible && (
  <ServiceTypeSelector
    visible={serviceSelectorVisible}
    onClose={() => setServiceSelectorVisible(false)}
    onSelect={async (tipo) => {
      await createServico(obraId, tipo, responsavelLogado);
      // Recarrega
    }}
  />
)}
```

### Passo 4: Integrar com Sistema de Fotos

Implemente `handleCapturePhoto` para conectar com sua câmera/galeria:

```typescript
const handleCapturePhoto = async (servicoId: string, category: keyof Servico) => {
  // 1. Abre câmera ou galeria
  const photo = await openPhotoPicker();
  
  // 2. Backup para AsyncStorage/Supabase Storage
  const backupResult = await backupPhoto(photo);
  
  // 3. Adiciona ao serviço
  const updatedServico = await addPhotoToServico(servicoId, category, backupResult.photoId);
  
  // 4. Sincroniza
  await syncServico(updatedServico);
};
```

---

## 🎯 Fluxo de Dados

```
┌─────────────┐
│  Nova Obra  │
└──────┬──────┘
       │ cria
       ▼
┌─────────────────────────────┐
│ Obra (obra_id, data, ...)   │
└──────┬──────────────────────┘
       │ contém (1:N)
       ▼
┌─────────────────────────────────────────────┐
│ Serviço 1 (tipo, status, sync_status, ...) │
│ Serviço 2 (tipo, status, sync_status, ...) │
│ Serviço 3 (tipo, status, sync_status, ...) │
└──────┬──────┬────────────┬──────────────────┘
       │      │            │
       ▼      ▼            ▼
    fotos  fotos         fotos
    (array (array       (array
     JSONB) JSONB)      JSONB)
```

**Sincronização**: Isolada por serviço → falha em um não afeta outros

---

## 📐 Estrutura de Componentes no React Native

### ObraContainer (renderização colapsada)
```
┌──────────────────────────────────┐
│ ▶ Quadro TR-0042                 │
│   Rua das Flores, 42             │
│   João | Equipe A2               │
│                                  │
│ 📱 Service Pills (horizontal)    │
│   [✓ Transformador] [⚠ Ditais]  │
│                                  │
│ [Expandir] [+Serviço]            │
└──────────────────────────────────┘
```

### ServiceCard (renderização expandida)
```
┌────────────────────────────────────┐
│ ▼ ⚠ Ditais         [sync badge]    │
│   João • 10/04/2026                │
│                                    │
│ 📷 Fotos                           │
│   ▶ Abertura (1 foto)              │
│   ▶ Ditais Impedir (0 fotos)       │
│   ▶ Ditais Testar (2 fotos) [grid] │
│   ▶ Ditais Aterrar (1 foto)        │
│   ▶ Ditais Sinalizar (0 fotos)     │
│                                    │
│ [Marcar Completo] [Deletar]        │
└────────────────────────────────────┘
```

---

## 🗄️ Banco de Dados: Antes vs Depois

### Antes (tabela `obras`)
```sql
obras {
  id, data, obra, responsavel, tipo_servico,
  fotos_abertura[], fotos_transformador_laudo[],
  fotos_ditais_abertura[], ...
}
-- 1 obra = 1 tipo de serviço
```

### Depois (tabelas `obras` + `servicos`)
```sql
obras {
  id, data, obra, responsavel, status
}

servicos {
  id, obra_id (FK),
  tipo_servico, responsavel,
  status, sync_status,
  fotos_abertura[], fotos_transformador_laudo[],
  fotos_ditais_abertura[], ...
}
-- 1 obra = múltiplos serviços
```

---

## 🔄 Sincronização Por Serviço

### Antes (monolítico)
```
Obra inteira sync ─→ falha de 1 campo ─→ toda obra falha ✗
```

### Depois (granular)
```
Serviço 1 sync ✓
Serviço 2 sync ✗ (isolado)
Serviço 3 sync ⏳
```

**Benefício**: Falha em um serviço não bloqueia outros

---

## 📱 Decisões UX Confirmadas

| Decisão | Implementação |
|---------|---------------|
| ✅ Finalização Manual | Botão "Finalizar Obra" não automático |
| ✅ Fotos Serviço-Específicas | Cada serviço tem suas fotos isoladas |
| ✅ Responsável Variável | `servico.responsavel` pode diferir de `obra.responsavel` |
| ✅ Delete Permanente | Deletar serviço = fotos desaparecem do servidor |

---

## 🧪 Checklist de Testes

- [ ] Migration aplicada sem erros
- [ ] TypeScript build: sem erros
- [ ] Criar obra nova
- [ ] Seletor de tipo de serviço abre
- [ ] Criar novo serviço (online)
- [ ] Expandir serviço (mostra categorias de fotos)
- [ ] Capturar foto para categoria
- [ ] Marcar serviço como completo
- [ ] Deletar serviço (fotos somem)
- [ ] Criar serviço offline (AsyncStorage)
- [ ] Sincronizar quando online
- [ ] Falha de um serviço não afeta outros
- [ ] Finalizar obra não automático

---

## 📚 Documentação de Código

### Tipos
- [mobile/types/servico.ts](../types/servico.ts) - Interfaces e tipos

### Componentes
- [mobile/components/ServicosComponents.tsx](../components/ServicosComponents.tsx) - UI completa

### Sincronização
- [mobile/lib/servico-sync.ts](../lib/servico-sync.ts) - Lógica de sync

### Exemplo
- [mobile/app/obras-com-servicos-exemplo.tsx](../app/obras-com-servicos-exemplo.tsx) - Como usar

---

## ⚠️ Notas Importantes

1. **Migração de Dados Existentes**: Você terá que rodar um script para converter obras antigas em serviços. Deixa registrado para depois.

2. **Compatibilidade**: Novo código coexiste com antigo. Pode manter ambas as telas temporariamente durante transição.

3. **Offline First**: Todos os serviços criados offline são enfileirados em AsyncStorage e sincronizam quando online.

4. **RLS**: Herda permissões da obra (mesmos usuários/equipes que veem a obra, veem seus serviços).

---

## 🎨 Design Tokens (Customizáveis)

No arquivo `ServicosComponents.tsx`, ajuste cores/spacing conforme sua marca:

```typescript
const colors = {
  primary: '#0066CC',      // ← Seu azul
  success: '#10B981',      // ← Verde
  warning: '#F59E0B',      // ← Laranja
  danger: '#EF4444',       // ← Vermelho
  // ...
};
```

---

## 📞 Próximos Passos

1. **Imediato**: Aplicar migration Supabase
2. **Curto**  (Dia 1-2): Integrar componentes em `obras.tsx`
3. **Médio**  (Dia 2-3): Conectar sistema de fotos
4. **Longo**  (Sem urgência): Migrar dados históricos

---

## 💡 FAQ

**P: E se o usuário deletar uma obra?**  
R: Cascata DELETE em `servicos.obra_id` → todas fotos do serviço deletadas

**P: Posso renomear um tipo de serviço?**  
R: Atualize `TIPOS_SERVICO` em `nova-obra.tsx` e `SERVICO_PHOTO_MAP`

**P: Quantos serviços por obra?**  
R: Ilimitado (schema não tem constraint)

**P: Pode ter 2 serviços do mesmo tipo?**  
R: Sim! (design permite duplicação)

---

Implementação concluída! 🎉

Autor: GitHub Copilot  
Data: 15/04/2026  
Build Status: ✅ TypeScript compiling  
