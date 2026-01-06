# 🔧 Guia de Implementação: Botões Pausar e Finalizar

## 📋 Passos para Implementar

### Passo 1: Adicionar as Novas Funções

**Arquivo**: `mobile/app/nova-obra.tsx`

**Onde**: Logo após a função `prosseguirSalvamento` (procure por onde essa função termina)

**O que adicionar**: Copie o conteúdo do arquivo `mobile/app/nova-obra-functions.tsx` e cole após a função `prosseguirSalvamento`.

### Passo 2: Substituir a UI dos Botões

**Arquivo**: `mobile/app/nova-obra.tsx`

**Onde**: Linhas 5734-5758 (seção `{/* Botões */}`)

**Remover**:
```tsx
{/* Botões */}
<TouchableOpacity
  style={[styles.button, loading && styles.buttonDisabled]}
  onPress={handleSalvarObra}
  disabled={loading}
>
  <Text style={styles.buttonText}>
    {loading ? 'Salvando...' : 'Salvar Obra'}
  </Text>
</TouchableOpacity>

<TouchableOpacity
  style={styles.cancelButton}
  onPress={() => {
    // Tentar voltar, se não conseguir ir para dashboard
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }}
  disabled={loading}
>
  <Text style={styles.cancelButtonText}>Cancelar</Text>
</TouchableOpacity>
```

**Substituir por**: Copie o conteúdo do arquivo `mobile/app/nova-obra-buttons-ui.tsx`

### Passo 3: Adicionar os Novos Estilos

**Arquivo**: `mobile/app/nova-obra.tsx`

**Onde**: Dentro do `StyleSheet.create({ ... })` no final do arquivo

**O que adicionar**: Copie os estilos do arquivo `mobile/app/nova-obra-styles.tsx` e adicione dentro do StyleSheet existente.

### Passo 4: Importar saveObraLocal (se necessário)

Se ainda não estiver importado, adicione no topo do arquivo:

```typescript
import { saveObraLocal } from '../lib/offline-sync';
```

(Verifique se o import já existe, se sim, apenas certifique-se que `saveObraLocal` está incluído)

## ✅ Checklist de Implementação

- [ ] **Passo 1**: Funções adicionadas (`calcularPodeFinalizar` e `handlePausar`)
- [ ] **Passo 2**: UI dos botões substituída
- [ ] **Passo 3**: Estilos adicionados
- [ ] **Passo 4**: Import verificado
- [ ] **Teste 1**: App compila sem erros
- [ ] **Teste 2**: Botão "Pausar" aparece
- [ ] **Teste 3**: Botão "Finalizar" aparece apenas quando online + completo
- [ ] **Teste 4**: Botão "Pausar" salva obra no histórico
- [ ] **Teste 5**: Botão "Finalizar" finaliza obra corretamente

## 🧪 Como Testar Após Implementar

### Teste 1: Pausar Obra Incompleta

1. Abrir app
2. Clicar "Nova Obra"
3. Preencher apenas número e data
4. **NÃO** adicionar fotos
5. **Verificar**: Botão "Finalizar" NÃO aparece
6. **Verificar**: Botão "Pausar" APARECE
7. Clicar "Pausar"
8. Verificar alerta: "💾 Obra Pausada"
9. Ir para lista de obras
10. **VERIFICAR**: Obra aparece no histórico ✅
11. Status deve ser "Rascunho" ou similar

### Teste 2: Finalizar Obra Completa (Online)

1. Abrir app
2. Clicar "Nova Obra"
3. Preencher TODOS os campos obrigatórios
4. Adicionar TODAS as fotos obrigatórias
5. Estar ONLINE (com internet)
6. **VERIFICAR**: Botão "Finalizar" APARECE ✅
7. Clicar "Finalizar"
8. **VERIFICAR**: Upload de fotos
9. **VERIFICAR**: Alerta de sucesso
10. **VERIFICAR**: Obra no histórico com status "Finalizada"

### Teste 3: Obra Completa Mas Offline

1. Abrir app
2. Clicar "Nova Obra"
3. Preencher TODOS os campos
4. Adicionar TODAS as fotos
5. Desligar internet (modo avião)
6. **VERIFICAR**: Botão "Finalizar" NÃO APARECE ❌
7. Apenas "Pausar" e "Cancelar" visíveis
8. Clicar "Pausar"
9. **VERIFICAR**: Obra salva
10. **VERIFICAR**: Aparece no histórico

## 📁 Arquivos Criados (Referência)

1. `mobile/app/nova-obra-functions.tsx` - Funções novas
2. `mobile/app/nova-obra-buttons-ui.tsx` - UI dos botões
3. `mobile/app/nova-obra-styles.tsx` - Estilos novos
4. `GUIA_IMPLEMENTACAO_BOTOES.md` - Este arquivo

**IMPORTANTE**: Esses arquivos são apenas REFERÊNCIA. Você deve copiar o conteúdo deles para dentro do arquivo `nova-obra.tsx` principal.

## 🚨 Possíveis Problemas

### Problema 1: Erro de compilação "calcularPodeFinalizar is not defined"

**Solução**: Certifique-se que a função `calcularPodeFinalizar` foi adicionada ANTES do `return` do componente.

### Problema 2: Botão "Finalizar" não aparece nunca

**Solução**: Verifique:
- Está online?
- Todos os campos obrigatórios preenchidos?
- Todas as fotos obrigatórias adicionadas?
- Função `calcularPodeFinalizar` retorna `true`?

### Problema 3: Obra pausada não aparece no histórico

**Solução**: Verifique:
- Função `handlePausar` está chamando `saveObraLocal`?
- Status está sendo definido como `'rascunho'`?
- Origem está sendo definida como `'offline'`?

## 💡 Dicas

1. **Faça backup** do arquivo `nova-obra.tsx` antes de começar
2. **Implemente passo a passo**, testando após cada passo
3. **Use busca** (Ctrl+F) para encontrar as seções corretas no arquivo
4. **Consulte os logs** do console para debug

## 🎯 Resultado Final Esperado

Após implementação completa:

```
┌─────────────────────────────────────┐
│                                     │
│  [Pausar]  [Finalizar*]  [Cancelar]│
│                                     │
└─────────────────────────────────────┘
```

*Botão "Finalizar" só aparece quando online + completo

- ✅ Obras pausadas aparecem no histórico
- ✅ Botão "Finalizar" condicional
- ✅ Interface clara e intuitiva
