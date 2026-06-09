# 🔧 Correção: Botão Pausar vs Salvar Obra

## ❌ Problema Identificado

### O Que Estava Acontecendo:

1. **Botão "Salvar Obra"**:
   - Salvava obra como PENDENTE (`saveObraOffline`)
   - Obra ia para fila de sincronização
   - NÃO aparecia no histórico de obras
   - Apenas em "Obras Pendentes"

2. **Faltava Botão "Pausar"**:
   - Não havia forma de salvar rascunho
   - Usuário perdia progresso ao cancelar

### Sintomas:

```
❌ Obras salvas não aparecem no histórico
❌ Não há opção para pausar e continuar depois
❌ Botão "Finalizar" não aparece (mesmo com obra completa)
❌ Usuário confuso sobre onde estão as obras
```

## ✅ Solução Implementada

### Estrutura Correta de Botões:

```
┌─────────────────────────────────────┐
│ [Pausar]    [Finalizar*]  [Cancelar]│
└─────────────────────────────────────┘
```

*Botão "Finalizar" só aparece quando:
- Usuário está ONLINE
- Todas as fotos obrigatórias foram adicionadas

### 3 Botões Distintos:

#### 1. **Pausar**
- **Função**: Salvar rascunho sem validações
- **Quando usar**: Obra incompleta, precisa pausar
- **O que faz**:
  - Chama `saveObraLocal()`
  - Salva no AsyncStorage como rascunho
  - Status: `'rascunho'`
  - Origem: `'offline'`
  - Aparece no histórico de obras ✅
- **Sem validações**: Aceita obra vazia ou parcial

#### 2. **Finalizar** (Condicional)
- **Função**: Finalizar obra completa online
- **Quando aparece**:
  - ✅ Usuário está ONLINE
  - ✅ Todas as fotos obrigatórias adicionadas
  - ✅ Campos básicos preenchidos
- **O que faz**:
  - Upload de fotos para Supabase
  - Salva obra no banco
  - Status: `'finalizada'`
  - Origem: `'online'`
  - Sincroniza automaticamente ✅

#### 3. **Cancelar**
- **Função**: Descartar obra e voltar
- **Quando usar**: Desistir da obra
- **O que faz**:
  - Não salva nada
  - Volta para tela anterior

## 📊 Comparação

### saveObraOffline (PENDENTE)

```typescript
// Salva em: @obras-wise:obras-pendentes
await saveObraOffline(obraData, photoIds);

// Resultado:
sync_status: 'pending'
Aparece em: Obras Pendentes
Aparece no histórico: ❌ NÃO
```

### saveObraLocal (RASCUNHO)

```typescript
// Salva em: @obras_local
await saveObraLocal(obraData);

// Resultado:
status: 'rascunho'
origem: 'offline'
synced: false
Aparece no histórico: ✅ SIM
```

## 🔄 Fluxos de Uso

### Cenário 1: Obra Incompleta (Sem Internet)

```
1. Usuário preenche alguns campos
2. Adiciona algumas fotos
3. Precisa pausar
4. Clica em "Pausar"
   ↓
5. Obra salva como rascunho
6. Aparece no histórico de obras ✅
7. Pode editar depois
```

### Cenário 2: Obra Completa (Com Internet)

```
1. Usuário preenche todos os campos
2. Adiciona todas as fotos obrigatórias
3. Está online
4. Botão "Finalizar" APARECE ✅
5. Clica em "Finalizar"
   ↓
6. Upload de fotos
7. Salva no Supabase
8. Status: 'finalizada'
9. Aparece no histórico ✅
```

### Cenário 3: Obra Completa (Sem Internet)

```
1. Usuário preenche todos os campos
2. Adiciona todas as fotos obrigatórias
3. Está OFFLINE
4. Botão "Finalizar" NÃO APARECE ❌
5. Apenas "Pausar" e "Cancelar" visíveis
6. Clica em "Pausar"
   ↓
7. Obra salva como rascunho
8. Aparece no histórico ✅
9. Quando tiver internet, pode editar e finalizar
```

## 💻 Implementação

### Função handlePausar (Nova)

```typescript
const handlePausar = async () => {
  // ZERO validações - aceita qualquer estado
  setLoading(true);
  try {
    const obraData = {
      obra: obra?.trim() || '',
      data: data || '',
      responsavel: responsavel || '',
      equipe: isCompUser ? equipeExecutora : equipe || '',
      tipo_servico: tipoServico || '',
      status: 'rascunho',
      origem: 'offline',
      // ... todos os campos
    };

    const obraId = await saveObraLocal(obraData);

    Alert.alert(
      '💾 Obra Pausada',
      'Obra salva como rascunho.\nVocê pode continuar editando depois.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  } catch (error) {
    Alert.alert('Erro', 'Não foi possível pausar a obra');
  } finally {
    setLoading(false);
  }
};
```

### Função calcularPodeFinalizar (Nova)

```typescript
const calcularPodeFinalizar = (): boolean => {
  // ✅ CRÍTICO: Deve estar online para finalizar
  if (!isOnline) return false;

  // Validar campos básicos
  if (!data || !obra || !responsavel || !tipoServico) return false;

  // Validar fotos obrigatórias por tipo de serviço
  if (isServicoTransformador && transformadorStatus) {
    if (transformadorStatus === 'Instalado') {
      if (fotosTransformadorConexoesPrimariasInstalado.length < 2) return false;
      if (fotosTransformadorConexoesSecundariasInstalado.length < 2) return false;
    }
    if (transformadorStatus === 'Retirado') {
      if (fotosTransformadorConexoesPrimariasRetirado.length < 2) return false;
      if (fotosTransformadorConexoesSecundariasRetirado.length < 2) return false;
    }
  }

  // ... outras validações

  return true; // Todas as validações passaram
};
```

### UI dos Botões

```typescript
{/* Botão Pausar - SEMPRE VISÍVEL */}
<TouchableOpacity
  style={[styles.pauseButton, loading && styles.buttonDisabled]}
  onPress={handlePausar}
  disabled={loading}
>
  <Text style={styles.pauseButtonText}>
    {loading ? 'Salvando...' : 'Pausar'}
  </Text>
</TouchableOpacity>

{/* Botão Finalizar - CONDICIONAL */}
{calcularPodeFinalizar() && (
  <TouchableOpacity
    style={[styles.button, loading && styles.buttonDisabled]}
    onPress={handleFinalizarObra}
    disabled={loading}
  >
    <Text style={styles.buttonText}>
      Finalizar Obra
    </Text>
  </TouchableOpacity>
)}

{/* Botão Cancelar - SEMPRE VISÍVEL */}
<TouchableOpacity
  style={styles.cancelButton}
  onPress={() => router.back()}
  disabled={loading}
>
  <Text style={styles.cancelButtonText}>Cancelar</Text>
</TouchableOpacity>
```

## 🎨 Aparência dos Botões

### Pausar (Amarelo)
```css
pauseButton: {
  backgroundColor: '#f59e0b', // Amarelo/Laranja
  padding: 16,
  borderRadius: 8,
  flex: 1,
  marginRight: 8,
}
```

### Finalizar (Verde) - Condicional
```css
button: {
  backgroundColor: '#10b981', // Verde
  padding: 16,
  borderRadius: 8,
  flex: 2,
  marginRight: 8,
}
```

### Cancelar (Cinza)
```css
cancelButton: {
  backgroundColor: '#6b7280', // Cinza
  padding: 16,
  borderRadius: 8,
  flex: 1,
}
```

## ✅ Checklist de Implementação

- [ ] Criar função `handlePausar()`
- [ ] Criar função `calcularPodeFinalizar()`
- [ ] Modificar função `handleSalvarObra()` → `handleFinalizarObra()`
- [ ] Atualizar UI dos botões
- [ ] Testar fluxo de pausar
- [ ] Testar fluxo de finalizar
- [ ] Verificar que obras aparecem no histórico
- [ ] Documentar mudanças

## 🧪 Como Testar

### Teste 1: Pausar Obra Incompleta

1. Criar nova obra
2. Preencher apenas número e data
3. NÃO adicionar fotos
4. Clicar "Pausar"
5. Verificar alerta: "💾 Obra Pausada"
6. Ir para lista de obras
7. **Verificar**: Obra aparece no histórico ✅
8. Status: "Rascunho"
9. Badge: "Aguardando Sync"

### Teste 2: Finalizar Obra Completa (Online)

1. Criar nova obra
2. Preencher todos os campos
3. Adicionar todas as fotos obrigatórias
4. Estar ONLINE
5. **Verificar**: Botão "Finalizar" APARECE ✅
6. Clicar "Finalizar"
7. **Verificar**: Upload de fotos
8. **Verificar**: Alerta "Obra Finalizada"
9. **Verificar**: Obra no histórico com status "Finalizada"

### Teste 3: Obra Completa Mas Offline

1. Criar nova obra
2. Preencher todos os campos
3. Adicionar todas as fotos
4. Desligar internet (modo avião)
5. **Verificar**: Botão "Finalizar" NÃO APARECE ❌
6. Apenas "Pausar" e "Cancelar" visíveis
7. Clicar "Pausar"
8. **Verificar**: Obra salva como rascunho
9. **Verificar**: Aparece no histórico

## 📚 Arquivos Afetados

### A Modificar:
- `mobile/app/nova-obra.tsx` - Adicionar botão Pausar e lógica

### Funções:
- `saveObraLocal()` - Já existe em `offline-sync.ts` ✅
- `calcularPodeFinalizar()` - Nova função
- `handlePausar()` - Nova função
- `handleFinalizarObra()` - Renomear de `handleSalvarObra()`

## 🎯 Resultado Final

Após implementação:

- ✅ **Botão "Pausar"**: Salva rascunho SEM validações
- ✅ **Botão "Finalizar"**: Aparece apenas quando online + completo
- ✅ **Botão "Cancelar"**: Descarta obra
- ✅ **Obras aparecem no histórico** (não mais apenas em pendentes)
- ✅ **Usuário pode pausar e continuar depois**
- ✅ **Interface clara** sobre o que cada botão faz

**Status das obras no histórico:**
- 🟡 Rascunho: Obra pausada, incompleta
- 🟢 Finalizada: Obra completa e sincronizada
- 🔵 Aguardando: Obra pendente de sincronização
