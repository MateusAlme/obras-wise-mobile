# Script de Correção: Status de Sincronização

## 🐛 Problema

Obras que já estão no Supabase estão marcadas como `synced: false` no AsyncStorage, mostrando [📤 Aguardando sync] quando deveriam mostrar [☁️ Sincronizada].

## 🔧 Solução: Remigração Forçada

### Opção 1: Via Interface (Recomendado)

**Passos**:

1. **Fazer backup manual** (importante!):
   - Abrir app
   - Ir em "Obras"
   - Verificar se há obras NÃO sincronizadas ([📤 Aguardando sync])
   - Se houver, clicar em "☁️ Sincronizar" ANTES de continuar

2. **Limpar AsyncStorage e remigrar**:
   - Abrir terminal no diretório do projeto
   - Executar:
   ```bash
   # Abrir React Native Debugger
   # No console, executar:
   AsyncStorage.clear()
   ```

3. **Reabrir o app**:
   - Fechar completamente o app
   - Reabrir
   - App vai migrar obras do Supabase automaticamente
   - Todas as obras virão marcadas como `synced: true`

### Opção 2: Correção Programática (Criar função temporária)

Adicionar função temporária em `mobile/app/(tabs)/obras.tsx`:

```typescript
// FUNÇÃO TEMPORÁRIA - REMOVER DEPOIS DE USAR
const corrigirStatusSync = async () => {
  try {
    console.log('🔧 Iniciando correção de status de sincronização...');

    const equipe = await AsyncStorage.getItem('@equipe_logada');
    if (!equipe) return;

    // 1. Buscar TODAS as obras do Supabase
    const { data: obrasSupabase, error } = await supabase
      .from('obras')
      .select('id, obra, data, created_at, updated_at')
      .eq('equipe', equipe);

    if (error || !obrasSupabase) {
      console.error('❌ Erro ao buscar obras do Supabase:', error);
      return;
    }

    console.log(`📊 Encontradas ${obrasSupabase.length} obra(s) no Supabase`);

    // 2. Carregar obras do AsyncStorage
    const localObras = await getLocalObras();
    console.log(`📱 Encontradas ${localObras.length} obra(s) no AsyncStorage`);

    // 3. Para cada obra do Supabase, marcar como sincronizada no AsyncStorage
    let corrigidas = 0;
    for (const obraSupabase of obrasSupabase) {
      const localIndex = localObras.findIndex(o => o.id === obraSupabase.id);

      if (localIndex !== -1) {
        // Obra existe localmente
        if (!localObras[localIndex].synced) {
          // Marcar como sincronizada
          localObras[localIndex].synced = true;
          localObras[localIndex].locallyModified = false;
          localObras[localIndex].serverId = obraSupabase.id;
          corrigidas++;
          console.log(`✅ Obra ${obraSupabase.obra} marcada como sincronizada`);
        }
      } else {
        // Obra não existe localmente - adicionar como sincronizada
        const novaObra: LocalObra = {
          ...obraSupabase as any,
          synced: true,
          locallyModified: false,
          serverId: obraSupabase.id,
          last_modified: obraSupabase.updated_at || obraSupabase.created_at,
        };
        localObras.push(novaObra);
        corrigidas++;
        console.log(`➕ Obra ${obraSupabase.obra} adicionada como sincronizada`);
      }
    }

    // 4. Salvar AsyncStorage atualizado
    await AsyncStorage.setItem(LOCAL_OBRAS_KEY, JSON.stringify(localObras));

    console.log(`✅ Correção concluída: ${corrigidas} obra(s) corrigidas`);
    Alert.alert(
      'Correção Concluída',
      `${corrigidas} obra(s) foram marcadas como sincronizadas.\n\nRecarregando lista...`
    );

    // 5. Recarregar lista
    await carregarObras();
  } catch (error) {
    console.error('❌ Erro na correção:', error);
    Alert.alert('Erro', String(error));
  }
};
```

**Adicionar botão temporário** (remover depois):

```typescript
// No JSX, adicionar botão temporário:
<TouchableOpacity
  style={{ padding: 16, backgroundColor: '#dc3545' }}
  onPress={corrigirStatusSync}
>
  <Text style={{ color: '#fff', textAlign: 'center' }}>
    🔧 CORRIGIR STATUS (TEMPORÁRIO)
  </Text>
</TouchableOpacity>
```

### Opção 3: Via Expo Developer Tools

```bash
# 1. Abrir terminal
cd "c:\Users\Mateus Almeida\obras-wise-mobile\mobile"

# 2. Abrir developer menu no dispositivo
# - Android: Pressionar Ctrl+M ou sacudir o dispositivo
# - iOS: Pressionar Cmd+D ou sacudir o dispositivo

# 3. Selecionar "Debug JS Remotely"

# 4. No console do navegador, executar:
AsyncStorage.clear().then(() => {
  console.log('✅ AsyncStorage limpo');
  // Recarregar app
  location.reload();
});
```

## 🧪 Verificação

Após executar a correção:

```bash
# 1. Abrir lista de obras
   → ✅ Todas as obras que estão no Supabase devem mostrar [☁️ Sincronizada]
   → ✅ Apenas obras criadas APÓS a correção devem mostrar [📤 Aguardando sync]

# 2. Verificar console:
   → "✅ Obra [número] marcada como sincronizada"
   → "✅ Correção concluída: X obra(s) corrigidas"

# 3. Testar ordenação:
   → Criar nova obra
   → ✅ Nova obra deve aparecer no topo
```

## ⚠️ Importante

**ANTES de executar qualquer opção**:

1. ✅ Verificar se há obras [📤 Aguardando sync]
2. ✅ Se houver, sincronizar PRIMEIRO
3. ✅ Confirmar que todas foram sincronizadas
4. ✅ Só então executar a correção

**POR QUE?** Se você limpar o AsyncStorage antes de sincronizar, perderá as obras locais não sincronizadas!

## 🎯 Recomendação

**Use a Opção 1** (limpar AsyncStorage):
- Mais simples
- Garante estado limpo
- Remigra tudo do Supabase corretamente
- Menos chance de erros

**Mas lembre-se**: Sincronizar obras pendentes ANTES de limpar!

---

**Criado em**: Janeiro 2026
**Status**: ⚙️ SCRIPT DE CORREÇÃO ÚNICA
**Usar apenas**: Uma vez para corrigir obras existentes
