# 📚 Índice Completo: Guia de Criação de Serviços no Mobile

Você pediu para entender **como criar um novo serviço no mobile**, desde a criação até renderizar na tela. Criei **4 documentos detalhados** que cobrem todos os aspectos.

---

## 📖 Qual Documento Ler?

Escolha de acordo com sua necessidade:

### 1️⃣ **[GUIA_CRIACAO_NOVO_SERVICO.md](GUIA_CRIACAO_NOVO_SERVICO.md)** - Comece aqui! 📍

**Conteúdo**: Explicação teórica + estrutura completa do fluxo

**Perfeito para**:
- Entender a arquitetura geral
- Ver o passo a passo conceitual
- Aprender as responsabilidades de cada arquivo
- Checklist de implementação

**Seções principais**:
- 6 passos principais de implementação
- Fluxo geral visualizado
- Estrutura de dados (AsyncStorage + Supabase)
- Ciclo de vida completo
- Checklist de implementação

---

### 2️⃣ **[CODIGO_PRONTO_SERVICO_TESTE.md](CODIGO_PRONTO_SERVICO_TESTE.md)** - Copiar e Colar 💻

**Conteúdo**: Snippets de código prontos para usar

**Perfeito para**:
- Copiar e colar código nos seus arquivos
- Ver exatamente o que adicionar em cada arquivo
- Não precisar digitar, só adaptar
- Implementação prática e rápida

**Seções principais**:
- Adicionar ao `servico.ts` (tipos e interfaces)
- Adicionar ao `servico-sync.ts` (funções)
- Usar em `servico-detalhe.tsx` (UI)
- Sincronização automática
- Testando a implementação
- Debugging

---

### 3️⃣ **[ARQUITETURA_VISUAL_SERVICO.md](ARQUITETURA_VISUAL_SERVICO.md)** - Entender os Dados 🗂️

**Conteúdo**: Diagramas visuais + estrutura de dados + fluxo de sincronização

**Perfeito para**:
- Visualizar como os dados fluem
- Entender AsyncStorage vs Supabase
- Ver o mapeamento de responsabilidades
- Debug de problemas de dados

**Seções principais**:
- Diagrama geral do fluxo (ASCII art)
- Fluxo detalhado por ação (criar, foto, sincronizar)
- Estrutura de dados (AsyncStorage + Supabase)
- Ciclo de vida do serviço
- Diagrama de estados
- Tratamento de erros

---

### 4️⃣ **[EXEMPLO_PASSO_A_PASSO.md](EXEMPLO_PASSO_A_PASSO.md)** - Simulação Realista 🎬

**Conteúdo**: Exemplo completo com valores reais + o que aparece na tela

**Perfeito para**:
- Ver como funciona na prática
- Entender cada linha de código
- Debug com valores específicos
- Testar mentalmente antes de implementar

**Seções principais**:
- 7 passos completos com prints da tela
- Valores reais de AsyncStorage
- Sequência exata de chamadas de função
- O que muda em cada etapa
- Verificação no Supabase final
- Checklist de funcionamento

---

## 🎯 Roteiro Recomendado

### Se você quer **entender tudo rapidamente** (30 min):
1. Leia [GUIA_CRIACAO_NOVO_SERVICO.md](GUIA_CRIACAO_NOVO_SERVICO.md) - Visão geral completa
2. Olhe [ARQUITETURA_VISUAL_SERVICO.md](ARQUITETURA_VISUAL_SERVICO.md) - Entender o fluxo de dados
3. Pule para [CODIGO_PRONTO_SERVICO_TESTE.md](CODIGO_PRONTO_SERVICO_TESTE.md) - Implementar

### Se você quer **implementar agora** (1-2 horas):
1. Abra [CODIGO_PRONTO_SERVICO_TESTE.md](CODIGO_PRONTO_SERVICO_TESTE.md) - Copie os códigos
2. Coloque nos arquivos especificados
3. Consulte [GUIA_CRIACAO_NOVO_SERVICO.md](GUIA_CRIACAO_NOVO_SERVICO.md) se tiver dúvidas
4. Teste com [EXEMPLO_PASSO_A_PASSO.md](EXEMPLO_PASSO_A_PASSO.md) - Simulação

### Se você quer **debugar um problema** (10-30 min):
1. Vá para [ARQUITETURA_VISUAL_SERVICO.md](ARQUITETURA_VISUAL_SERVICO.md) - Entender estrutura
2. Use [EXEMPLO_PASSO_A_PASSO.md](EXEMPLO_PASSO_A_PASSO.md) - Procure valores esperados
3. Verifique [CODIGO_PRONTO_SERVICO_TESTE.md](CODIGO_PRONTO_SERVICO_TESTE.md) - Checklist de debugging

---

## 🗺️ Mapa de Conteúdo

```
┌─────────────────────────────────────────────────────────────┐
│         Criando um Novo Serviço no Mobile Wise              │
└─────────────────────────────────────────────────────────────┘

📍 GUIA_CRIACAO_NOVO_SERVICO.md
├─ Entender a arquitetura
├─ 6 passos de implementação
├─ Fluxo geral
├─ Estrutura de dados
└─ Ciclo de vida

│
├─→ CODIGO_PRONTO_SERVICO_TESTE.md
│   ├─ Código pronto para cada arquivo
│   ├─ Imports e tipos
│   ├─ Funções CRUD
│   ├─ Renderização UI
│   └─ Debugging
│
├─→ ARQUITETURA_VISUAL_SERVICO.md
│   ├─ Diagrama de fluxo
│   ├─ AsyncStorage vs Supabase
│   ├─ Mapeamento de responsabilidades
│   ├─ Estados possíveis
│   └─ Tratamento de erros
│
└─→ EXEMPLO_PASSO_A_PASSO.md
    ├─ Simulação realista
    ├─ Valores reais
    ├─ Cada clique do usuário
    ├─ Resultado em AsyncStorage
    ├─ Verificação no Supabase
    └─ Checklist final
```

---

## 💾 Arquivos que Você Precisa Modificar

Todos os 4 documentos mencionam estes arquivos:

```
mobile/
├── types/
│   └── servico.ts (MODIFICAR)
├── lib/
│   └── servico-sync.ts (MODIFICAR/ADICIONAR)
├── app/
│   └── servico-detalhe.tsx (MODIFICAR)
├── contexts/
│   └── AuthContext.tsx (VERIFICAR/MODIFICAR)
└── app/
    └── _layout.tsx (VERIFICAR/MODIFICAR)

// Para o exemplo "Teste":
// - Adicionar tipo 'Teste' em TipoServico
// - Adicionar campos fotos_teste_* nas interfaces
// - Criar função createTesteServico()
// - Renderizar na tela
```

---

## 📝 Exemplo Rápido (2 minutos)

Se você quer só ver **o essencial**, aqui está em 3 etapas:

### Etapa 1: Adicionar Tipo (servico.ts)
```typescript
export type TipoServico = 
  | 'APR'
  | ...
  | 'Teste'        // ← NOVO
  | 'Transformador'
```

### Etapa 2: Criar Função (servico-sync.ts)
```typescript
export const createTesteServico = async (obraId: string) => {
  const servico: ServicoLocal = {
    id: `temp_teste_${Date.now()}...`,
    obra_id: obraId,
    tipo_servico: 'Teste',
    status: 'rascunho',
    sync_status: 'offline',
    fotos_teste_observacao: [],
    fotos_teste_comprovacao: []
  };
  
  const list = JSON.parse(await AsyncStorage.getItem('@servicos_pending_sync') || '[]');
  list.push(servico);
  await AsyncStorage.setItem('@servicos_pending_sync', JSON.stringify(list));
  
  return servico;
};
```

### Etapa 3: Usar na Tela (servico-detalhe.tsx)
```typescript
const handleCreateTeste = async () => {
  const novo = await createTesteServico(obraId);
  setServico(novo);
};

// Na UI:
<TouchableOpacity onPress={handleCreateTeste}>
  <Text>Novo Serviço Teste</Text>
</TouchableOpacity>
```

---

## 🔑 Conceitos-Chave (Resumo)

### AsyncStorage (Local/Offline)
- Armazena serviços pendentes em `@servicos_pending_sync`
- Cada foto tem metadados em `@photo_*`
- Dados persistem mesmo sem conectividade

### Supabase (Cloud/Online)
- Sincroniza quando há conexão
- Converte `temp_` IDs em UUIDs
- Armazena fotos no Storage com URLs públicas

### Fluxo de Sincronização
1. **Criar**: LocalStorage (temp ID)
2. **Editar**: LocalStorage (ID temp + fotos)
3. **Conectar**: Detecta WiFi
4. **Sincronizar**: Upload de fotos → Inserir no DB → Gerar URLs
5. **Finalizar**: ID vira UUID, sync_status = synced

### Responsabilidades
- **servico-sync.ts**: Lógica de CRUD + Sincronização
- **servico-detalhe.tsx**: Renderização + Eventos
- **photo-backup.ts**: Armazenamento de fotos
- **AsyncStorage**: Cache local
- **Supabase**: Banco de dados + Storage

---

## ❓ Perguntas Frequentes

### P: Por que usa AsyncStorage?
**R**: Funciona offline. Dados não se perdem mesmo sem internet.

### P: Por que usa "temp_" como ID?
**R**: O ID final é gerado pelo Supabase. Antes disso, usa temp para local storage.

### P: Quando sincroniza automaticamente?
**R**: Quando NetInfo detecta conexão restaurada (em AuthContext).

### P: O que acontece se falhar a sincronização?
**R**: sync_status = 'error', mantém no AsyncStorage, tenta novamente.

### P: Preciso criar um novo arquivo?
**R**: Não, você modifica os existentes. Tudo fica em servico-sync.ts.

### P: Como testo sem Supabase?
**R**: AsyncStorage funciona offline. Só não sincroniza com cloud.

---

## 🚀 Próximos Passos

Após ler os documentos:

1. **Implementar**: Coloque o código nos arquivos (30 min)
2. **Testar**: Crie um serviço Teste na tela (5 min)
3. **Validar**: Tire fotos, verifique AsyncStorage (5 min)
4. **Sincronizar**: Conecte WiFi, veja dados no Supabase (5 min)
5. **Debug**: Se não funcionar, use EXEMPLO_PASSO_A_PASSO.md (30 min)

---

## 📞 Fichário de Referência Rápida

| Preciso de... | Vá para... | Seção |
|---|---|---|
| Entender a ideia geral | GUIA_CRIACAO_NOVO_SERVICO | Fluxo Geral |
| Copiar código | CODIGO_PRONTO_SERVICO_TESTE | Cada arquivo |
| Ver estrutura de dados | ARQUITETURA_VISUAL_SERVICO | Estrutura de Dados |
| Valores reais | EXEMPLO_PASSO_A_PASSO | Cada passo |
| Debug de sync | EXEMPLO_PASSO_A_PASSO | Verificar Supabase |
| Debug de foto | CODIGO_PRONTO_SERVICO_TESTE | Debugging |
| Entender AsyncStorage | ARQUITETURA_VISUAL_SERVICO | AsyncStorage Section |
| Ver fluxo visual | ARQUITETURA_VISUAL_SERVICO | Diagrama Geral |

---

## 🎓 Aprendizado Estruturado

```
Nível 1: Básico
  ├─ Tipo de serviço (o que é)
  ├─ Campo de foto (como armazena)
  └─ Botão para criar (UI simples)

Nível 2: Intermediário
  ├─ Função createTesteServico()
  ├─ AsyncStorage.getItem/setItem
  ├─ Adicionar foto a um campo
  └─ Marcar como completo

Nível 3: Avançado
  ├─ Sincronização com Supabase
  ├─ Conversão de IDs (temp → UUID)
  ├─ Upload de arquivos para Storage
  ├─ Detectar conexão com NetInfo
  └─ Erro handling + retry

Nível 4: Especialista
  ├─ Locking de sincronização (evitar duplicação)
  ├─ Batch de fotos
  ├─ Validação de serviço (servico-rules.ts)
  ├─ Photo watermarking + metadata
  └─ Offline-first architecture
```

---

## ✨ Resumo Final

Você tem **4 documentos completos** que cobrem:

✅ **Teoria** - Como funciona e por que  
✅ **Prática** - Código pronto para copiar  
✅ **Visualização** - Diagramas e fluxos  
✅ **Simulação** - Exemplo realista com valores  

**Tempo estimado**:
- Entender: 30 min
- Implementar: 1 hora
- Testar: 30 min
- Debug (se necessário): 30 min

**Total**: 2-3 horas para ter um novo serviço funcionando.

---

## 🎯 Comece Agora!

1. Abra [GUIA_CRIACAO_NOVO_SERVICO.md](GUIA_CRIACAO_NOVO_SERVICO.md)
2. Leia os 6 passos principais
3. Quando estiver pronto para codificar, vá para [CODIGO_PRONTO_SERVICO_TESTE.md](CODIGO_PRONTO_SERVICO_TESTE.md)
4. Se tiver dúvidas, consulte [ARQUITETURA_VISUAL_SERVICO.md](ARQUITETURA_VISUAL_SERVICO.md) ou [EXEMPLO_PASSO_A_PASSO.md](EXEMPLO_PASSO_A_PASSO.md)

Boa sorte! 🚀

