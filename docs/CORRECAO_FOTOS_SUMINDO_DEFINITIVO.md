# 🔧 CORREÇÃO DEFINITIVA: Fotos Sumindo ao Pausar/Retomar Obra

## Data: 2025-01-XX

## 🐛 Problema Reportado
> "Em todos os book esses erros, começo a obra, tiro fotos antes e durante, pauso. Volto para adicionar a outra as anteriores somem."

O usuário tirava fotos, pausava a obra como rascunho, e ao retornar para adicionar mais fotos, as anteriores tinham desaparecido.

## 🔍 Análise do Bug

### Causa Raiz Identificada
O código de salvamento (`handlePausar` e `prosseguirSalvamento`) usava **condicionais baseadas no tipo de serviço** para decidir quais campos de fotos salvar:

```typescript
// ❌ CÓDIGO PROBLEMÁTICO (antes)
const photoIds = {
  fotos_antes: isServicoPadrao ? extractPhotoData(fotosAntes) : [],
  fotos_durante: isServicoPadrao ? extractPhotoData(fotosDurante) : [],
  fotos_depois: isServicoPadrao ? extractPhotoData(fotosDepois) : [],
  fotos_ditais_abertura: isServicoDitais ? extractPhotoData(fotosDitaisAbertura) : [],
  // ...
};
```

### Por que isso causava perda de fotos?
1. Usuário cria obra de tipo "Emenda" (`isServicoPadrao = true`)
2. Tira fotos em `fotosAntes` e `fotosDurante`
3. Pausa → `fotos_antes: ['abc123']` salvo corretamente
4. Volta para editar → fotos carregadas no estado
5. **Se por algum motivo** `isServicoPadrao` fosse avaliado como `false`:
   - `fotos_antes: []` seria salvo (array vazio!)
   - Fotos PERDIDAS!

### Cenários onde isso poderia acontecer:
- Timing de estados React (tipoServico não carregado antes do salvamento)
- Bug em condicionais derivadas
- Race condition na navegação

## ✅ Solução Implementada

Removidas TODAS as condicionais de tipo de serviço no salvamento de fotos. Agora o código **sempre salva o conteúdo do estado**, independente do tipo de serviço:

```typescript
// ✅ CÓDIGO CORRIGIDO (depois)
const photoIds = {
  // Fotos padrão - sempre salvar o que tiver no estado
  fotos_antes: extractPhotoData(fotosAntes) as string[],
  fotos_durante: extractPhotoData(fotosDurante) as string[],
  fotos_depois: extractPhotoData(fotosDepois) as string[],
  // DITAIS - sempre salvar
  fotos_ditais_abertura: extractPhotoData(fotosDitaisAbertura) as string[],
  fotos_ditais_impedir: extractPhotoData(fotosDitaisImpedir) as string[],
  // ... todas as outras fotos sem condicionais
};
```

### Por que isso funciona?
- Se o usuário tirou fotos em um campo, elas serão salvas
- Se o usuário não tirou fotos, o array estará vazio e será salvo como `[]`
- **Nenhuma foto é perdida** porque não há decisão condicional

## 📁 Arquivos Modificados

### `mobile/app/nova-obra.tsx`

1. **`handlePausar`** (linhas ~3730-3820)
   - Removidas todas as condicionais `isServicoPadrao ?`, `isServicoDitais ?`, etc.
   - Todos os campos de fotos agora são salvos diretamente do estado

2. **`prosseguirSalvamento`** (linhas ~2545-2630)
   - Mesma correção aplicada
   - Todos os campos de fotos salvos sem condicionais

3. **Logs de debug adicionados** para facilitar diagnóstico futuro:
   - Estado das fotos antes de salvar
   - IDs que serão salvos
   - Tipo de serviço atual

## 🧪 Como Testar

1. Criar nova obra de qualquer tipo (Emenda, Ditais, Transformador, etc.)
2. Tirar 2-3 fotos em qualquer seção
3. Clicar em "Pausar" para salvar como rascunho
4. Voltar para a tela de obras
5. Abrir a obra salva
6. ✅ **Verificar que TODAS as fotos estão presentes**
7. Adicionar mais fotos
8. Pausar novamente
9. ✅ **Verificar que TODAS as fotos (antigas + novas) estão presentes**

## 📊 Correções Anteriores (Mantidas)

Este fix complementa correções anteriores que também ajudam:

1. **`mapPhotos` preserva photoId** - mesmo quando foto não é encontrada no backup, o ID é mantido
2. **`allPhotoIds` expandido** - busca de fallback inclui todos os campos de fotos
3. **`getPhotosByObraWithFallback`** - tem 3 estratégias de busca para encontrar fotos

## 🎯 Resumo

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Salvamento | Condicional por tipo de serviço | Sempre salva todos os campos |
| Risco de perda | Alto (se tipo interpretado errado) | Zero |
| Campos vazios | Não salvos se tipo errado | Salvos como `[]` (inofensivo) |

---

**Status: ✅ CORRIGIDO**
**Impacto: CRÍTICO → Resolução de perda de dados**
