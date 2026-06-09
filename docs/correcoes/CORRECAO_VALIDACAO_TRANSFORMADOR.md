# 🔧 Correção: Validação de Fotos de Transformador (Conexões)

## 🐛 Problema Identificado

O sistema permitia **salvar** obras de Transformador (Instalado/Retirado) **sem todas as fotos obrigatórias**, mas bloqueava a **finalização**. O contador "Faltam X foto(s)" mostrava um número **incorreto**, pois **não contava as fotos de conexões** (Primárias e Secundárias).

### Comportamento Antes da Correção

- ❌ Usuário conseguia salvar obra sem todas as fotos de conexões
- ❌ Contador mostrava "Faltam 1 foto(s)" mesmo com múltiplas fotos faltando
- ❌ Validação **não incluía** as 4 seções de conexões:
  - Conexões Primárias (Instalado) - 2 fotos obrigatórias
  - Conexões Secundárias (Instalado) - 2 fotos obrigatórias
  - Conexões Primárias (Retirado) - 2 fotos obrigatórias
  - Conexões Secundárias (Retirado) - 2 fotos obrigatórias

---

## ✅ Solução Implementada

### 1. Atualização de Tipos (TypeScript)

Adicionados os novos campos de fotos ao tipo `OnlineObra`:

```typescript
type OnlineObra = {
  // ... outros campos
  fotos_transformador_instalado?: FotoInfo[];
  fotos_transformador_conexoes_primarias_instalado?: FotoInfo[];
  fotos_transformador_conexoes_secundarias_instalado?: FotoInfo[];
  fotos_transformador_antes_retirar?: FotoInfo[];
  fotos_transformador_tombamento_retirado?: FotoInfo[];
  fotos_transformador_placa_retirado?: FotoInfo[];
  fotos_transformador_conexoes_primarias_retirado?: FotoInfo[];
  fotos_transformador_conexoes_secundarias_retirado?: FotoInfo[];
  // ...
};
```

### 2. Atualização do `typeMap` em `getPhotosForSection()`

Adicionados os mapeamentos para as novas fotos de conexões:

```typescript
const typeMap: Record<string, PhotoMetadata['type'] | PhotoMetadata['type'][]> = {
  // ... outros mapeamentos
  'fotos_transformador_instalado': 'transformador_instalado',
  'fotos_transformador_conexoes_primarias_instalado': 'transformador_conexoes_primarias_instalado',
  'fotos_transformador_conexoes_secundarias_instalado': 'transformador_conexoes_secundarias_instalado',
  'fotos_transformador_antes_retirar': 'transformador_antes_retirar',
  'fotos_transformador_tombamento_retirado': 'transformador_tombamento_retirado',
  'fotos_transformador_placa_retirado': 'transformador_placa_retirado',
  'fotos_transformador_conexoes_primarias_retirado': 'transformador_conexoes_primarias_retirado',
  'fotos_transformador_conexoes_secundarias_retirado': 'transformador_conexoes_secundarias_retirado',
  // ...
};
```

### 3. Validação na Função `calcularFotosFaltantes()`

Adicionada validação específica para as **conexões com 2 fotos obrigatórias cada**:

#### Transformador Instalado

```typescript
if (obra.transformador_status === 'Instalado') {
  // Validações existentes
  if (!getPhotosForSection('fotos_transformador_componente_instalado').length)
    faltantes.push('Componente Instalado');
  if (!getPhotosForSection('fotos_transformador_tombamento_instalado').length)
    faltantes.push('Tombamento (Instalado)');
  if (!getPhotosForSection('fotos_transformador_tape').length)
    faltantes.push('Tape');
  if (!getPhotosForSection('fotos_transformador_placa_instalado').length)
    faltantes.push('Placa (Instalado)');
  if (!getPhotosForSection('fotos_transformador_instalado').length)
    faltantes.push('Transformador Instalado');

  // ✨ NOVAS VALIDAÇÕES: Conexões (2 fotos obrigatórias cada)
  const conexoesPrimariasInstalado = getPhotosForSection('fotos_transformador_conexoes_primarias_instalado');
  const conexoesSecundariasInstalado = getPhotosForSection('fotos_transformador_conexoes_secundarias_instalado');

  if (conexoesPrimariasInstalado.length < 2) {
    faltantes.push(`Conexões Primárias (Instalado) - ${2 - conexoesPrimariasInstalado.length} foto(s)`);
  }
  if (conexoesSecundariasInstalado.length < 2) {
    faltantes.push(`Conexões Secundárias (Instalado) - ${2 - conexoesSecundariasInstalado.length} foto(s)`);
  }
}
```

#### Transformador Retirado

```typescript
else if (obra.transformador_status === 'Retirado') {
  // Validações existentes
  if (!getPhotosForSection('fotos_transformador_antes_retirar').length)
    faltantes.push('Antes de Retirar');
  if (!getPhotosForSection('fotos_transformador_tombamento_retirado').length)
    faltantes.push('Tombamento (Retirado)');
  if (!getPhotosForSection('fotos_transformador_placa_retirado').length)
    faltantes.push('Placa (Retirado)');

  // ✨ NOVAS VALIDAÇÕES: Conexões (2 fotos obrigatórias cada)
  const conexoesPrimariasRetirado = getPhotosForSection('fotos_transformador_conexoes_primarias_retirado');
  const conexoesSecundariasRetirado = getPhotosForSection('fotos_transformador_conexoes_secundarias_retirado');

  if (conexoesPrimariasRetirado.length < 2) {
    faltantes.push(`Conexões Primárias (Retirado) - ${2 - conexoesPrimariasRetirado.length} foto(s)`);
  }
  if (conexoesSecundariasRetirado.length < 2) {
    faltantes.push(`Conexões Secundárias (Retirado) - ${2 - conexoesSecundariasRetirado.length} foto(s)`);
  }
}
```

---

## 🎯 Comportamento Após a Correção

### Transformador Instalado

**Fotos Obrigatórias:**
1. ✅ Componente Instalado (1 foto)
2. ✅ Tombamento (Instalado) (1 foto)
3. ✅ Tape (1 foto)
4. ✅ Placa (Instalado) (1 foto)
5. ✅ Transformador Instalado (1 foto)
6. ✅ **Conexões Primárias (Instalado) - 2 fotos** 🆕
7. ✅ **Conexões Secundárias (Instalado) - 2 fotos** 🆕

**Total:** 9 fotos obrigatórias

### Transformador Retirado

**Fotos Obrigatórias:**
1. ✅ Antes de Retirar (1 foto)
2. ✅ Tombamento (Retirado) (1 foto)
3. ✅ Placa (Retirado) (1 foto)
4. ✅ **Conexões Primárias (Retirado) - 2 fotos** 🆕
5. ✅ **Conexões Secundárias (Retirado) - 2 fotos** 🆕

**Total:** 7 fotos obrigatórias

---

## 📱 Exemplos de Mensagens de Validação

### Antes (Incorreto)
```
❌ "Faltam 1 foto(s)"
```
(Não especificava QUAIS fotos faltavam)

### Depois (Correto)

#### Exemplo 1: Instalado - Faltam apenas conexões
```
✅ "Faltam 4 foto(s)"

Fotos faltantes:
- Conexões Primárias (Instalado) - 2 foto(s)
- Conexões Secundárias (Instalado) - 2 foto(s)
```

#### Exemplo 2: Retirado - Falta 1 conexão primária e 2 secundárias
```
✅ "Faltam 3 foto(s)"

Fotos faltantes:
- Conexões Primárias (Retirado) - 1 foto(s)
- Conexões Secundárias (Retirado) - 2 foto(s)
```

#### Exemplo 3: Instalado - Obra completa
```
✅ Botão ativo: "Finalizar Obra"
```
(Todas as 9 fotos obrigatórias anexadas)

---

## 📁 Arquivos Modificados

### [mobile/app/obra-detalhe.tsx](../mobile/app/obra-detalhe.tsx)

1. **Linhas 20-60**: Adicionados campos ao tipo `OnlineObra`
   ```typescript
   fotos_transformador_conexoes_primarias_instalado?: FotoInfo[];
   fotos_transformador_conexoes_secundarias_instalado?: FotoInfo[];
   fotos_transformador_conexoes_primarias_retirado?: FotoInfo[];
   fotos_transformador_conexoes_secundarias_retirado?: FotoInfo[];
   ```

2. **Linhas 422-429**: Adicionados mapeamentos ao `typeMap`
   ```typescript
   'fotos_transformador_conexoes_primarias_instalado': 'transformador_conexoes_primarias_instalado',
   'fotos_transformador_conexoes_secundarias_instalado': 'transformador_conexoes_secundarias_instalado',
   'fotos_transformador_conexoes_primarias_retirado': 'transformador_conexoes_primarias_retirado',
   'fotos_transformador_conexoes_secundarias_retirado': 'transformador_conexoes_secundarias_retirado',
   ```

3. **Linhas 512-544**: Adicionadas validações em `calcularFotosFaltantes()`
   - Validação de 2 fotos obrigatórias para cada tipo de conexão
   - Mensagens específicas mostrando quantas fotos faltam

---

## 🧪 Como Testar

### Cenário 1: Transformador Instalado - Sem Conexões

1. Criar nova obra com tipo "Transformador"
2. Selecionar status "Instalado"
3. Anexar apenas as 5 fotos principais (Componente, Tombamento, Tape, Placa, Instalado)
4. Ir para tela de detalhes
5. Verificar botão "Faltam 4 foto(s)"
6. Tentar finalizar
7. Ver alerta:
   ```
   Fotos Faltantes

   Esta obra ainda tem 4 foto(s) obrigatória(s) faltando:

   Conexões Primárias (Instalado) - 2 foto(s)
   Conexões Secundárias (Instalado) - 2 foto(s)

   Complete as fotos antes de finalizar a obra.
   ```

### Cenário 2: Transformador Retirado - Conexões Parciais

1. Criar nova obra com tipo "Transformador"
2. Selecionar status "Retirado"
3. Anexar as 3 fotos principais (Antes de Retirar, Tombamento, Placa)
4. Anexar apenas 1 foto de Conexões Primárias (faltam 1)
5. Anexar 0 fotos de Conexões Secundárias (faltam 2)
6. Ir para tela de detalhes
7. Verificar botão "Faltam 3 foto(s)"
8. Tentar finalizar
9. Ver alerta especificando exatamente quais conexões faltam

### Cenário 3: Transformador Instalado - Completo

1. Criar nova obra com tipo "Transformador"
2. Selecionar status "Instalado"
3. Anexar TODAS as fotos:
   - 5 fotos principais
   - 2 fotos de Conexões Primárias
   - 2 fotos de Conexões Secundárias
4. Ir para tela de detalhes
5. Verificar botão verde "Finalizar Obra" ativo
6. Clicar em "Finalizar Obra"
7. Confirmar que obra é finalizada com sucesso

---

## 🔗 Relação com Database

### Migration Aplicada

A migration [20250217_adicionar_conexoes_transformador.sql](../supabase/migrations/20250217_adicionar_conexoes_transformador.sql) já criou as colunas no banco:

```sql
-- Transformador Instalado
ALTER TABLE obras ADD COLUMN IF NOT EXISTS transformador_conexoes_primarias_instalado jsonb DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS transformador_conexoes_secundarias_instalado jsonb DEFAULT '[]'::jsonb;

-- Transformador Retirado
ALTER TABLE obras ADD COLUMN IF NOT EXISTS transformador_conexoes_primarias_retirado jsonb DEFAULT '[]'::jsonb;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS transformador_conexoes_secundarias_retirado jsonb DEFAULT '[]'::jsonb;
```

**Observação:** Cada coluna armazena um **array JSONB** com URLs de 2 fotos obrigatórias.

---

## 📊 Impacto da Correção

### Antes
- ❌ Validação incompleta
- ❌ Contador de fotos incorreto
- ❌ Usuário não sabia quais fotos faltavam
- ❌ Possível inconsistência de dados

### Depois
- ✅ Validação completa de todas as seções
- ✅ Contador de fotos preciso
- ✅ Mensagens específicas indicando exatamente o que falta
- ✅ Garantia de qualidade dos dados de Transformador

---

## 🚀 Deploy

Esta correção está **pronta para produção** e deve ser incluída no próximo build:

```bash
cd mobile
npx eas build --platform android --profile preview
```

---

**Correção implementada em:** 2025-01-05
**Versão:** 1.1.0
**Arquivo:** [mobile/app/obra-detalhe.tsx](../mobile/app/obra-detalhe.tsx)
**Relacionado:** [docs/CONEXOES_TRANSFORMADOR.md](CONEXOES_TRANSFORMADOR.md)
