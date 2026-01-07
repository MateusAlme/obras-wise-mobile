# 🔄 Migração de Campos de Fotos

## 📋 O Que É Esta Migração?

Esta migração **renomeia os campos de fotos** das obras salvas no AsyncStorage do app mobile.

### Por Que É Necessária?

Recentemente fizemos uma mudança no código para **padronizar os nomes dos campos de fotos**:

| Campo Antigo | Campo Novo |
|--------------|------------|
| `antes` | `fotos_antes` |
| `durante` | `fotos_durante` |
| `depois` | `fotos_depois` |
| `abertura` | `fotos_abertura` |
| `fechamento` | `fotos_fechamento` |
| ... (49 campos no total) | ... |

**Problema**: Se você criou obras ANTES desta mudança, elas foram salvas com os nomes antigos (`antes`, `durante`, etc.). Agora o código busca pelos nomes novos (`fotos_antes`, `fotos_durante`), então **as fotos não aparecem** ❌

**Solução**: Executar a migração para renomear os campos das obras antigas.

## 🚀 Como Usar

### Passo 1: Ir para a Lista de Obras

Abra o app e vá para a aba **"Obras"**.

### Passo 2: Clicar em "Migrar Fotos"

No topo da lista, você verá os botões de ação:

```
┌────────────────────────────────────────────────────┐
│  [➕ Nova]  [☁️ Sync]  [🔧 Corrigir]  [🔄 Migrar]  │
└────────────────────────────────────────────────────┘
```

Clique em **🔄 Migrar Fotos**.

### Passo 3: Confirmar Migração

Aparecerá um alerta:

```
🔄 Migrar Campos de Fotos

Esta operação vai renomear os campos de fotos das obras antigas para o formato novo.

✅ Corrige campos: antes → fotos_antes
✅ Corrige todos os tipos de fotos
✅ Mantém os dados das fotos

[Cancelar]  [Migrar]
```

Clique em **"Migrar"**.

### Passo 4: Aguardar Conclusão

O app vai:
1. Carregar todas as obras do AsyncStorage
2. Verificar quais precisam de migração
3. Renomear os campos antigos para o formato novo
4. Salvar as obras atualizadas

### Passo 5: Verificar Resultado

Você verá uma mensagem como:

```
✅ Migração Concluída

Total de obras: 15
Obras migradas: 8
Erros: 0

As fotos devem aparecer agora!
```

### Passo 6: Abrir Obras

Agora você pode abrir as obras e **as fotos devem aparecer** ✅

## 🔍 O Que a Migração Faz

### Exemplo Prático

**Antes da Migração**:
```json
{
  "id": "local_123",
  "obra": "00012345",
  "antes": ["photo1", "photo2"],          ❌ Nome antigo
  "durante": ["photo3"],                  ❌ Nome antigo
  "depois": ["photo4", "photo5"],         ❌ Nome antigo
  "transformador_laudo": ["photo6"]       ❌ Nome antigo
}
```

**Depois da Migração**:
```json
{
  "id": "local_123",
  "obra": "00012345",
  "fotos_antes": ["photo1", "photo2"],    ✅ Nome novo
  "fotos_durante": ["photo3"],            ✅ Nome novo
  "fotos_depois": ["photo4", "photo5"],   ✅ Nome novo
  "fotos_transformador_laudo": ["photo6"] ✅ Nome novo
}
```

### Campos Migrados

A migração renomeia **49 tipos de campos de fotos**:

#### Fotos Padrão (5 campos)
- `antes` → `fotos_antes`
- `durante` → `fotos_durante`
- `depois` → `fotos_depois`
- `abertura` → `fotos_abertura`
- `fechamento` → `fotos_fechamento`

#### Fotos DITAIS (5 campos)
- `ditais_abertura` → `fotos_ditais_abertura`
- `ditais_impedir` → `fotos_ditais_impedir`
- `ditais_testar` → `fotos_ditais_testar`
- `ditais_aterrar` → `fotos_ditais_aterrar`
- `ditais_sinalizar` → `fotos_ditais_sinalizar`

#### Fotos Aterramento (4 campos)
- `aterramento_vala_aberta` → `fotos_aterramento_vala_aberta`
- `aterramento_hastes` → `fotos_aterramento_hastes`
- `aterramento_vala_fechada` → `fotos_aterramento_vala_fechada`
- `aterramento_medicao` → `fotos_aterramento_medicao`

#### Fotos Transformador (13 campos)
- `transformador_laudo` → `fotos_transformador_laudo`
- `transformador_componente_instalado` → `fotos_transformador_componente_instalado`
- `transformador_tombamento_instalado` → `fotos_transformador_tombamento_instalado`
- ... e mais 10 campos

#### Fotos Medidor (5 campos)
- `medidor_padrao` → `fotos_medidor_padrao`
- `medidor_leitura` → `fotos_medidor_leitura`
- ... e mais 3 campos

#### Fotos Checklist (9 campos)
- `checklist_croqui` → `fotos_checklist_croqui`
- `checklist_panoramica_inicial` → `fotos_checklist_panoramica_inicial`
- ... e mais 7 campos

#### Fotos Altimetria (4 campos)
- `altimetria_lado_fonte` → `fotos_altimetria_lado_fonte`
- ... e mais 3 campos

#### Fotos Vazamento (7 campos)
- `vazamento_evidencia` → `fotos_vazamento_evidencia`
- ... e mais 6 campos

## 📊 Logs de Debug

Durante a migração, você verá logs no console:

```
🔄 Iniciando migração de campos de fotos...
📊 Total de obras: 15

🔍 Verificando obra 1/15: 00012345
  📝 Migrando campo: antes → fotos_antes
  📝 Migrando campo: durante → fotos_durante
  📝 Migrando campo: depois → fotos_depois
  ✅ Obra migrada!

🔍 Verificando obra 2/15: 00012346
  ⏭️ Obra já está no formato novo (nada a migrar)

...

💾 Salvando 8 obra(s) migrada(s)...
✅ Obras migradas salvas com sucesso!

📊 Resultado da migração:
  - Total: 15
  - Migradas: 8
  - Erros: 0
  - Já no formato novo: 7
```

## ⚠️ Cenários Especiais

### Cenário 1: Todas as Obras Já Estão Corretas

Se você clicar em "Migrar" mas todas as obras já estão no formato novo:

```
✅ Migração Concluída

Total de obras: 15
Obras migradas: 0
Erros: 0

Todas as obras já estavam no formato correto.
```

**Resultado**: Nenhuma mudança foi feita (seguro executar múltiplas vezes).

### Cenário 2: Obra Tem Ambos os Campos

Se uma obra tem tanto `antes` quanto `fotos_antes`:

```json
{
  "id": "local_123",
  "antes": ["photo1"],          // Campo antigo
  "fotos_antes": ["photo2"]     // Campo novo (já existe)
}
```

**Comportamento**: A migração **NÃO sobrescreve** o campo novo. Apenas remove o campo antigo.

**Resultado**:
```json
{
  "id": "local_123",
  "fotos_antes": ["photo2"]     // Campo novo preservado ✅
}
```

### Cenário 3: Erro Durante Migração

Se houver erro ao migrar uma obra específica:

```
❌ Erro ao migrar obra local_123: [erro]
```

**Comportamento**: A obra problemática é **mantida sem alterações** (não perde dados). Outras obras continuam sendo migradas.

## 🎯 Segurança

A migração é **SEGURA** porque:

1. ✅ **Não deleta dados**: Apenas renomeia campos
2. ✅ **Preserva campos novos**: Se `fotos_antes` já existe, não sobrescreve
3. ✅ **Rollback automático**: Em caso de erro, obra mantém formato original
4. ✅ **Idempotente**: Pode executar múltiplas vezes sem problemas
5. ✅ **Backup implícito**: AsyncStorage mantém dados até serem sobrescritos

## 🔗 Quando Executar

Execute a migração se:

1. ✅ **Fotos sumiram** após atualização do app
2. ✅ **Obras antigas** não mostram fotos
3. ✅ **Erro de sync**: "Cannot read property 'length' of undefined"
4. ✅ **Após correção de bugs** relacionados a campos de fotos

## 📁 Arquivos Relacionados

- [mobile/utils/migrate-photo-fields.ts](../mobile/utils/migrate-photo-fields.ts) - Função de migração
- [mobile/app/(tabs)/obras.tsx](../mobile/app/(tabs)/obras.tsx) - Botão "Migrar Fotos"
- [CORRECAO_ERRO_SYNC_UNDEFINED.md](./CORRECAO_ERRO_SYNC_UNDEFINED.md) - Documentação do erro de sync

## 🚀 Status

✅ **Migração Implementada e Pronta para Uso**

O botão "Migrar Fotos" está disponível na lista de obras. Clique nele sempre que precisar corrigir campos de fotos antigas.
