# Fotos de Maior e Menor Esforço nos Postes

## Resumo
Adicionadas duas novas seções de fotos obrigatórias para cada poste no **Checklist de Fiscalização**: **Maior Esforço** e **Menor Esforço**, cada uma exigindo **mínimo de 2 fotos**.

## Detalhes da Implementação

### 1. Estrutura de Dados

Cada poste agora possui 6 seções de fotos:

#### Fotos Unitárias (1 foto cada):
- Poste Inteiro
- Engaste e Descrição
- Conexão 1
- Conexão 2

#### Fotos Múltiplas (mínimo 2 fotos cada):
- **Maior Esforço** (2 fotos obrigatórias)
- **Menor Esforço** (2 fotos obrigatórias)

### 2. Interface do Usuário

#### Contador Visual
Cada seção mostra o progresso:
- `📸 Maior Esforço (0/2)` - Nenhuma foto
- `📸 Maior Esforço (1/2)` - 1 foto adicionada
- `📸 Maior Esforço (2/2) ✓` - Completo (2 fotos)

#### Botão de Adicionar
- Habilitado: `+ Adicionar (0/2)` ou `+ Adicionar (1/2)`
- Desabilitado: `✓ Completo` (quando atingir 2 fotos)

#### Validação no Título do Poste
O poste só mostra ✓ no título quando TODAS as 6 seções estiverem completas:
```
Poste 1 ✓
```

### 3. Validação ao Salvar

#### Comportamento
Quando o usuário tenta salvar a obra SEM completar as fotos obrigatórias:

```
Alert: "Postes Incompletos"

A obra será salva, mas está INCOMPLETA.

Faltam fotos obrigatórias:

Poste 1:
  - Maior Esforço: 1/2 fotos
  - Menor Esforço: 0/2 fotos

Poste 2:
  - Menor Esforço: 1/2 fotos

Você pode editar a obra depois para adicionar as fotos faltantes.

[Cancelar]  [Salvar Mesmo Assim]
```

#### Opções
- **Cancelar**: Volta para a obra e permite adicionar as fotos faltantes
- **Salvar Mesmo Assim**: Salva a obra incompleta (pode ser editada depois)

### 4. Armazenamento

As fotos são armazenadas no campo `checklist_postes` (JSONB) do banco de dados:

```typescript
checklist_postes: [
  // Poste 1
  photo_id_1,  // Poste Inteiro
  photo_id_2,  // Engaste
  photo_id_3,  // Conexão 1
  photo_id_4,  // Conexão 2
  photo_id_5,  // Maior Esforço (foto 1)
  photo_id_6,  // Maior Esforço (foto 2)
  photo_id_7,  // Menor Esforço (foto 1)
  photo_id_8,  // Menor Esforço (foto 2)

  // Poste 2
  ...
]
```

### 5. Funcionalidades

#### Placa Automática
Todas as fotos de postes incluem a **placa automática** com informações da obra:
- Data/Hora
- Número da Obra
- Tipo de Serviço
- Equipe
- Coordenadas UTM
- Endereço (quando disponível)

#### Visualização em Tela Cheia
- Clique na miniatura para ver a foto em tela cheia
- Placa fica FIXA na imagem (burned-in)
- Funciona offline

#### Remoção Individual
- Botão × em cada foto para remover
- Após remover, pode adicionar nova foto

### 6. Fluxo de Uso

1. **Criar Obra** → Selecionar "Checklist de Fiscalização"
2. **Rolar até Registro dos Postes**
3. **Clicar "➕ Adicionar Poste"** (se necessário mais postes)
4. **Para cada poste:**
   - Adicionar 1 foto: Poste Inteiro
   - Adicionar 1 foto: Engaste e Descrição
   - Adicionar 1 foto: Conexão 1
   - Adicionar 1 foto: Conexão 2
   - **Adicionar 2 fotos: Maior Esforço** ⭐ NOVO
   - **Adicionar 2 fotos: Menor Esforço** ⭐ NOVO
5. **Verificar ✓** no título do poste (aparece quando tudo completo)
6. **Salvar Obra**

### 7. Arquivos Modificados

#### Mobile App
- `mobile/app/nova-obra.tsx`:
  - Linha 151-165: Estado `fotosPostes` com novos campos
  - Linha 554-556: Tipos adicionados em `takePicture()`
  - Linha 668-669: Índices para novas fotos
  - Linha 830-847: Atualização de estado ao adicionar foto
  - Linha 1333-1350: Remoção de fotos
  - Linha 1504-1534: Validação ao salvar
  - Linha 1646-1654: Inclusão no payload para banco
  - Linha 4621-4628: Inicialização ao adicionar poste
  - Linha 4637-4641: Validação no título do poste
  - Linha 4767-4827: UI das novas seções

### 8. Compatibilidade

#### Web
- Placa burned-in funciona usando Canvas API do navegador
- Visualização em tela cheia

#### Mobile (Android/iOS)
- Placa burned-in funciona usando Skia Canvas (nativo)
- Performance otimizada
- Funciona completamente offline

### 9. Banco de Dados

**Nenhuma migration necessária!**

O campo `checklist_postes` já existe e é do tipo JSONB (array de strings), portanto aceita qualquer quantidade de fotos. As novas fotos de "Maior Esforço" e "Menor Esforço" são automaticamente incluídas nesse array.

### 10. Testes

#### Teste 1: Adicionar Fotos
1. Criar nova obra com tipo "Checklist de Fiscalização"
2. Adicionar 1 poste
3. Adicionar 2 fotos em "Maior Esforço"
4. Verificar contador: (2/2) ✓
5. Adicionar 2 fotos em "Menor Esforço"
6. Verificar contador: (2/2) ✓
7. Verificar ✓ no título do poste (se outras seções completas)

#### Teste 2: Validação Incompleta
1. Criar nova obra com tipo "Checklist de Fiscalização"
2. Adicionar 1 poste
3. Adicionar apenas 1 foto em "Maior Esforço"
4. Tentar salvar obra
5. Verificar alerta mostrando que falta 1 foto
6. Clicar "Cancelar"
7. Adicionar foto faltante
8. Salvar com sucesso

#### Teste 3: Múltiplos Postes
1. Criar nova obra com tipo "Checklist de Fiscalização"
2. Adicionar 3 postes
3. Completar Poste 1 (todas 6 seções)
4. Deixar Poste 2 incompleto (1 foto em Maior Esforço)
5. Completar Poste 3
6. Tentar salvar
7. Verificar alerta mostrando apenas Poste 2 incompleto
8. Escolher "Salvar Mesmo Assim" ou completar Poste 2

#### Teste 4: Remoção
1. Adicionar 2 fotos em "Maior Esforço"
2. Clicar × na primeira foto
3. Verificar contador: (1/2)
4. Adicionar nova foto
5. Verificar contador: (2/2) ✓

## Benefícios

1. **Documentação Completa**: Registro fotográfico mais detalhado dos esforços de trabalho
2. **Validação Automática**: Sistema avisa sobre fotos faltantes
3. **Flexibilidade**: Permite salvar obra incompleta e editar depois
4. **Rastreabilidade**: Todas fotos com placa automática incluindo GPS e timestamp
5. **Offline-First**: Funciona sem internet, sincroniza depois
