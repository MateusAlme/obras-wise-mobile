# Conexões do Transformador - Documentação

## Visão Geral

Sistema de registro fotográfico obrigatório para conexões primárias e secundárias de transformadores, tanto para transformadores instalados quanto retirados.

## Funcionalidades

### 1. Fotos Obrigatórias

Para serviços de tipo "Transformador", são obrigatórias **2 fotos** de cada tipo de conexão:

#### Transformador Instalado:
- **Conexões Primárias**: 2 fotos obrigatórias
- **Conexões Secundárias**: 2 fotos obrigatórias

#### Transformador Retirado:
- **Conexões Primárias**: 2 fotos obrigatórias
- **Conexões Secundárias**: 2 fotos obrigatórias

### 2. Validação

O sistema **PERMITE salvar parcialmente**, mas **AVISA** que a obra está incompleta se:
- Transformador Instalado selecionado E menos de 2 fotos de Conexões Primárias
- Transformador Instalado selecionado E menos de 2 fotos de Conexões Secundárias
- Transformador Retirado selecionado E menos de 2 fotos de Conexões Primárias
- Transformador Retirado selecionado E menos de 2 fotos de Conexões Secundárias

**Comportamento**:
- Um alerta é exibido mostrando quais fotos estão faltando
- O usuário pode escolher:
  - **"Cancelar"**: Volta para a tela e pode adicionar as fotos
  - **"Salvar Mesmo Assim"**: Salva a obra incompleta para editar depois

### 3. Contador de Fotos

Cada seção mostra um contador no formato: `(X/2)` onde:
- X = número de fotos anexadas
- 2 = número obrigatório

Exemplo: `📸 Conexões Primárias * (1/2)` indica que apenas 1 foto foi anexada de 2 necessárias.

## Arquivos Modificados

### `mobile/app/nova-obra.tsx`

**Estados adicionados** (linhas 123-129):
```typescript
const [fotosTransformadorConexoesPrimariasInstalado, setFotosTransformadorConexoesPrimariasInstalado] = useState<FotoData[]>([]);
const [fotosTransformadorConexoesSecundariasInstalado, setFotosTransformadorConexoesSecundariasInstalado] = useState<FotoData[]>([]);
const [fotosTransformadorConexoesPrimariasRetirado, setFotosTransformadorConexoesPrimariasRetirado] = useState<FotoData[]>([]);
const [fotosTransformadorConexoesSecundariasRetirado, setFotosTransformadorConexoesSecundariasRetirado] = useState<FotoData[]>([]);
```

**Função `takePicture` atualizada** (linhas 539-541):
- Adicionados tipos `'transformador_conexoes_primarias_instalado'`, `'transformador_conexoes_secundarias_instalado'`
- Adicionados tipos `'transformador_conexoes_primarias_retirado'`, `'transformador_conexoes_secundarias_retirado'`
- Casos de atualização de arrays (linhas 698-711, 878-891)

**Função `removePhoto` atualizada** (linhas 1124-1126):
- Adicionados tipos na assinatura
- Casos de remoção (linhas 1183-1196)

**Função `handleSalvarObra` atualizada**:
- **Validação** (linhas 1376-1398): Verifica se há 2 fotos de cada tipo de conexão
- **photoIds** (linhas 1453-1459): Inclusão no objeto para salvar no banco
- **totalFotos** (linhas 1411-1414): Inclusão no contador de fotos totais

**UI adicionada**:
- **Transformador Instalado** (linhas 3318-3404):
  - Seção "Conexões Primárias" com contador (X/2)
  - Seção "Conexões Secundárias" com contador (X/2)
- **Transformador Retirado** (linhas 3543-3629):
  - Seção "Conexões Primárias" com contador (X/2)
  - Seção "Conexões Secundárias" com contador (X/2)

## Arquivos Criados

### `supabase/migrations/20250217_adicionar_conexoes_transformador.sql`

Migration que adiciona 4 colunas ao banco de dados:

```sql
ALTER TABLE obras
ADD COLUMN IF NOT EXISTS transformador_conexoes_primarias_instalado jsonb DEFAULT '[]'::jsonb;

ALTER TABLE obras
ADD COLUMN IF NOT EXISTS transformador_conexoes_secundarias_instalado jsonb DEFAULT '[]'::jsonb;

ALTER TABLE obras
ADD COLUMN IF NOT EXISTS transformador_conexoes_primarias_retirado jsonb DEFAULT '[]'::jsonb;

ALTER TABLE obras
ADD COLUMN IF NOT EXISTS transformador_conexoes_secundarias_retirado jsonb DEFAULT '[]'::jsonb;
```

**Comentários adicionados**:
- `transformador_conexoes_primarias_instalado`: Array JSONB com URLs de 2 fotos obrigatórias
- `transformador_conexoes_secundarias_instalado`: Array JSONB com URLs de 2 fotos obrigatórias
- `transformador_conexoes_primarias_retirado`: Array JSONB com URLs de 2 fotos obrigatórias
- `transformador_conexoes_secundarias_retirado`: Array JSONB com URLs de 2 fotos obrigatórias

**Verificação automática**:
- Script verifica se todas as 4 colunas foram criadas com sucesso
- Exibe mensagens de confirmação ou erro

### `scripts/database/aplicar-conexoes-transformador.bat`

Script batch para aplicar a migration no Supabase:

```batch
supabase db push
```

## Como Usar

### 1. Aplicar Migration no Banco

Execute o script batch:

```
cd scripts/database
aplicar-conexoes-transformador.bat
```

Ou manualmente:
```
cd C:\Users\Mateus Almeida\obras-wise-mobile
supabase db push
```

### 2. Usar no Aplicativo Mobile

1. Abra o app e vá em "Nova Obra"
2. Selecione "Transformador" como tipo de serviço
3. Escolha "Instalado" ou "Retirado"
4. Role até as seções de Conexões Primárias e Secundárias
5. Tire 2 fotos de cada tipo de conexão (total: 4 fotos)
6. O sistema NÃO permitirá salvar se faltar alguma foto
7. Salve a obra - as fotos serão enviadas ao Supabase Storage

### 3. Fluxo de Trabalho

```
Selecionar Tipo: Transformador
    ↓
Escolher Status: Instalado ou Retirado
    ↓
Preencher demais campos da obra
    ↓
Tirar 2 fotos das Conexões Primárias
    ↓
Tirar 2 fotos das Conexões Secundárias
    ↓
Clicar em "Salvar Obra"
    ↓
Sistema valida se há 2 fotos de cada tipo
    ↓
Se COMPLETO: Obra é salva diretamente
Se INCOMPLETO: Alerta exibido com opções:
    → Cancelar: Volta para adicionar fotos
    → Salvar Mesmo Assim: Salva obra incompleta
```

## Mensagens de Validação

### Obra Incompleta - Exemplo 1 (apenas primárias faltando)
```
Obra Incompleta

A obra será salva, mas está INCOMPLETA.

Faltam fotos obrigatórias:
- Conexões Primárias: 0/2 fotos

Você pode editar a obra depois para adicionar as fotos faltantes.

[Cancelar]  [Salvar Mesmo Assim]
```

### Obra Incompleta - Exemplo 2 (ambas faltando)
```
Obra Incompleta

A obra será salva, mas está INCOMPLETA.

Faltam fotos obrigatórias:
- Conexões Primárias: 1/2 fotos
- Conexões Secundárias: 0/2 fotos

Você pode editar a obra depois para adicionar as fotos faltantes.

[Cancelar]  [Salvar Mesmo Assim]
```

## Estrutura de Dados

### Formato no Banco (JSONB)

```json
[
  {
    "url": "https://supabase.co/storage/v1/object/public/...",
    "photoId": "uuid-da-foto-1",
    "latitude": -7.123456,
    "longitude": -38.654321,
    "utmX": 548940,
    "utmY": 9238340,
    "utmZone": "24L"
  },
  {
    "url": "https://supabase.co/storage/v1/object/public/...",
    "photoId": "uuid-da-foto-2",
    "latitude": -7.123456,
    "longitude": -38.654321,
    "utmX": 548940,
    "utmY": 9238340,
    "utmZone": "24L"
  }
]
```

### Formato no Estado (FotoData)

```typescript
interface FotoData {
  uri: string;          // URL da foto
  photoId: string;      // ID único
  latitude?: number;    // Coordenada GPS
  longitude?: number;   // Coordenada GPS
  utmX?: number;        // Coordenada UTM X
  utmY?: number;        // Coordenada UTM Y
  utmZone?: string;     // Zona UTM (ex: "24L")
}
```

## Recursos Visuais

### Placa Automática em Fotos

Todas as fotos de conexões incluem automaticamente:
- Data e hora do registro
- Número da obra
- Tipo de serviço
- Equipe responsável
- Coordenadas UTM
- Endereço (quando online)

Posicionamento: Canto inferior esquerdo
Fundo: Semi-transparente preto (rgba(0, 0, 0, 0.8))
Borda: Azul (#2563eb)

### Visualização em Tela Cheia

- Toque em qualquer foto para abrir em tela cheia
- Placa de informações permanece visível
- Botão X no canto superior direito para fechar

## Testes

### Casos de Teste

1. **Validação - Transformador Instalado sem fotos**
   - Criar obra com tipo "Transformador"
   - Selecionar "Instalado"
   - NÃO anexar nenhuma foto de conexões
   - Tentar salvar
   - ✅ Deve exibir alerta "Obra Incompleta" com opção de salvar mesmo assim

2. **Validação - Apenas 1 foto de Conexões Primárias**
   - Anexar 1 foto de Conexões Primárias
   - Anexar 2 fotos de Conexões Secundárias
   - Tentar salvar
   - ✅ Deve exibir alerta mostrando "Conexões Primárias: 1/2 fotos"
   - ✅ Opções: Cancelar ou Salvar Mesmo Assim

3. **Sucesso - 2 fotos de cada tipo**
   - Anexar 2 fotos de Conexões Primárias
   - Anexar 2 fotos de Conexões Secundárias
   - Salvar obra
   - ✅ Obra deve ser salva diretamente sem alertas

4. **Salvamento Parcial**
   - Anexar 0 fotos de Conexões Primárias
   - Anexar 1 foto de Conexões Secundárias
   - Clicar em "Salvar Obra"
   - Ver alerta "Obra Incompleta"
   - Clicar em "Salvar Mesmo Assim"
   - ✅ Obra deve ser salva no estado incompleto

5. **Remoção de foto**
   - Anexar 2 fotos de Conexões Primárias
   - Remover 1 foto
   - Tentar salvar
   - ✅ Deve exibir alerta de obra incompleta

6. **Transformador Retirado**
   - Mesmos testes acima para status "Retirado"
   - ✅ Validação deve funcionar igualmente

7. **Modo offline**
   - Desconectar internet
   - Anexar fotos (sem endereço)
   - Salvar obra
   - Verificar salvamento pendente
   - Reconectar
   - ✅ Fotos devem sincronizar com endereço "não disponível"

## Limitações e Observações

- Quantidade fixa: Sempre **exatamente 2 fotos** de cada tipo
- Não é possível ter mais ou menos que 2 fotos
- Endereço só é obtido quando há conexão com internet
- Coordenadas GPS e UTM são sempre capturadas (offline ou online)
- Fotos são salvas localmente e enviadas ao Supabase quando online

## Próximas Melhorias

- [ ] Permitir quantidade variável de fotos (configurável)
- [ ] Visualização de múltiplas fotos em carrossel
- [ ] Comparação lado-a-lado de conexões primárias vs secundárias
- [ ] Anotações manuais sobre cada conexão
- [ ] Detecção automática de defeitos nas conexões (IA)
- [ ] Zoom avançado nas fotos
- [ ] Exportação de relatório PDF com as fotos de conexões

## Suporte

Para problemas ou dúvidas:
- Código mobile: `mobile/app/nova-obra.tsx` (linhas mencionadas acima)
- Migration: `supabase/migrations/20250217_adicionar_conexoes_transformador.sql`
- Script de aplicação: `scripts/database/aplicar-conexoes-transformador.bat`
