# Apresentação - App Mobile Obras Wise

---

## SLIDE 1: CAPA

### **OBRAS WISE**
#### Aplicativo Mobile para Gestão de Obras de Campo

- Solução completa para registro fotográfico
- Funciona 100% offline
- Sincronização automática com a nuvem

---

## SLIDE 2: O PROBLEMA

### Desafios do Registro de Obras em Campo

❌ Fotos perdidas ou desorganizadas
❌ Falta de padronização nos registros
❌ Dependência de internet no campo
❌ Dificuldade em rastrear informações
❌ Relatórios manuais demorados
❌ Retrabalho constante

---

## SLIDE 3: A SOLUÇÃO

### App Obras Wise

✅ **Organização automática** - Fotos categorizadas por tipo
✅ **Funciona offline** - Sem depender de sinal
✅ **GPS automático** - Localização em cada foto
✅ **Sincronização segura** - Dados na nuvem
✅ **Relatórios instantâneos** - PDF e Excel automáticos
✅ **Padronização** - Mesmo processo para todas as equipes

---

## SLIDE 4: TELA DE LOGIN

### Acesso Seguro

**Funcionalidades:**
- Login com email e senha
- Autenticação criptografada
- Sessão persistente (não precisa logar toda vez)
- Funciona após primeiro login mesmo offline

**Benefício:** Segurança dos dados + praticidade

---

## SLIDE 5: TELA INICIAL

### Dashboard do Técnico

**O que você vê:**
- Lista de obras criadas
- Status de cada obra (pendente/concluída)
- Indicador de sincronização
- Botão para criar nova obra

**Funcionalidades:**
- Filtrar por status
- Buscar por número da obra
- Ver obras pendentes de sync

---

## SLIDE 6: TIPOS DE SERVIÇO

### 12+ Tipos de Obras Suportados

| Tipo | Fotos Necessárias |
|------|-------------------|
| **Emenda** | Antes, Durante, Depois |
| **Bandolamento** | Antes, Durante, Depois |
| **Linha Viva** | Antes, Durante, Depois + Postes |
| **Poda** | Antes, Durante, Depois |
| **Transformador** | Laudo, Componentes, Tombamento, Placa |
| **Abertura/Fechamento de Chave** | Abertura, Fechamento |
| **Checklist de Fiscalização** | 9 categorias de fotos |
| **DITAIS** | 5 etapas do método |
| **Book de Aterramento** | 4 etapas |
| **Medidor** | Padrão, Leitura, Selo, Fase |
| **Altimetria** | Lado Fonte, Medição, Lado Carga |
| **Vazamento** | Evidência, Limpeza, Tombamento, Placa |

---

## SLIDE 7: CHECKLIST DE FISCALIZAÇÃO

### Registro Completo de Fiscalização

**9 Categorias de Fotos:**

1. **Croqui** - Desenho/esquema da área
2. **Panorâmica Inicial** - Visão geral antes
3. **CHEDE** - Chave de entrada
4. **Aterramento de Cerca** - Sistema de aterramento
5. **Padrão Geral** - Vista geral do padrão
6. **Padrão Interno** - Detalhes internos
7. **Panorâmica Final** - Visão geral depois
8. **Postes** - Fotos de cada poste (com número)
9. **Seccionamentos** - Pontos de seccionamento

**Diferencial:** Campo para identificar número do poste

---

## SLIDE 8: MÉTODO DITAIS

### 5 Etapas de Segurança

```
D - DESLIGAR
    └── Foto da abertura/desligamento

I - IMPEDIR RELIGAMENTO
    └── Foto do bloqueio

T - TESTAR AUSÊNCIA DE TENSÃO
    └── Foto do teste

A - ATERRAR
    └── Foto do aterramento

I/S - ISOLAR/SINALIZAR
    └── Foto da sinalização
```

**Benefício:** Garante registro de todas as etapas de segurança

---

## SLIDE 9: BOOK DE ATERRAMENTO

### Registro Completo do Aterramento

**4 Etapas Documentadas:**

1. **Vala Aberta**
   - Foto da escavação pronta

2. **Hastes Aplicadas**
   - Foto das hastes instaladas

3. **Vala Fechada**
   - Foto após fechamento

4. **Medição com Terrômetro**
   - Foto do equipamento com leitura

---

## SLIDE 10: CAPTURA DE FOTOS

### Sistema Inteligente de Fotos

**Ao tirar uma foto:**
- 📍 GPS capturado automaticamente
- 📅 Data e hora registrados
- 🏷️ Categoria definida
- 🔢 Numeração automática

**Recursos:**
- Múltiplas fotos por categoria
- Galeria para revisar
- Excluir foto se necessário
- Compressão automática (economia de dados)

---

## SLIDE 11: PLACA/MARCA D'ÁGUA

### Identificação Automática nas Fotos

**Informações na placa:**
- Número da obra
- Tipo de serviço
- Equipe responsável
- Data e hora
- Coordenadas GPS

**Benefício:** Rastreabilidade total de cada foto

---

## SLIDE 12: MODO OFFLINE

### Funciona Sem Internet

```
┌─────────────────────────────────────────┐
│           COMO FUNCIONA                 │
├─────────────────────────────────────────┤
│                                         │
│  1. Criar obra      → Salva local       │
│  2. Tirar fotos     → Salva local       │
│  3. Editar dados    → Salva local       │
│  4. Conectar WiFi   → Sync automático   │
│  5. Dados na nuvem  → Backup seguro     │
│                                         │
└─────────────────────────────────────────┘
```

**Garantia:** NUNCA perde dados, mesmo sem sinal

---

## SLIDE 13: SINCRONIZAÇÃO

### Sync Automático e Seguro

**Processo:**
1. App detecta conexão disponível
2. Envia dados pendentes
3. Upload das fotos para nuvem
4. Confirma sincronização
5. Libera espaço local (opcional)

**Indicadores visuais:**
- 🟢 Sincronizado
- 🟡 Pendente de sync
- 🔴 Erro (retry automático)

---

## SLIDE 14: BACKUP DE FOTOS

### Segurança dos Dados

**Sistema de backup em 3 camadas:**

```
Camada 1: Memória do App
    ↓
Camada 2: Storage Local (AsyncStorage)
    ↓
Camada 3: Nuvem (Supabase Storage)
```

**Benefícios:**
- Fotos nunca são perdidas
- Recuperação automática
- Histórico preservado

---

## SLIDE 15: FLUXO DE TRABALHO

### Passo a Passo do Técnico

```
1. INÍCIO DO DIA
   └── Abrir app e verificar obras pendentes

2. NO LOCAL DA OBRA
   └── Criar nova obra ou continuar existente
   └── Selecionar tipo de serviço
   └── Tirar fotos conforme categorias

3. DURANTE O SERVIÇO
   └── Adicionar fotos em cada etapa
   └── App salva automaticamente

4. FIM DO SERVIÇO
   └── Revisar fotos
   └── Finalizar obra

5. COM INTERNET
   └── Sincronização automática
   └── Dados disponíveis na web
```

---

## SLIDE 16: INTERFACE INTUITIVA

### Fácil de Usar

**Características:**
- Botões grandes para uso em campo
- Cores indicativas de status
- Poucos cliques para ações principais
- Feedback visual de cada ação
- Funciona com luvas (toque amplo)

**Tempo de treinamento:** Menos de 30 minutos

---

## SLIDE 17: COMPATIBILIDADE

### Funciona em Qualquer Celular

**Android:**
- Versão 8.0 ou superior
- Qualquer fabricante

**iOS:**
- iPhone 8 ou superior
- iOS 13 ou superior

**Requisitos mínimos:**
- 2GB RAM
- 500MB espaço livre
- Câmera funcional
- GPS (opcional, mas recomendado)

---

## SLIDE 18: SEGURANÇA

### Dados Protegidos

🔐 **Autenticação**
- Login obrigatório
- Sessões criptografadas

🔒 **Armazenamento**
- Dados criptografados no dispositivo
- Backup em nuvem segura

👤 **Privacidade**
- Acesso apenas às próprias obras
- Controle de permissões

---

## SLIDE 19: BENEFÍCIOS

### Por que usar o Obras Wise?

| Antes | Depois |
|-------|--------|
| Fotos no WhatsApp | Fotos organizadas no app |
| Sem padrão | Processo padronizado |
| Perde dados sem internet | Funciona 100% offline |
| Relatório manual | Relatório automático |
| Horas organizando fotos | Zero tempo perdido |
| Fotos sem identificação | GPS + data + equipe |

---

## SLIDE 20: CASO DE USO

### Exemplo Prático: Checklist de Fiscalização

**Situação:** Técnico vai fiscalizar uma instalação

**Com o App:**
1. Abre o app (2 segundos)
2. Cria obra "Checklist de Fiscalização" (10 segundos)
3. Tira foto do croqui (5 segundos)
4. Tira foto panorâmica inicial (5 segundos)
5. Registra cada poste com número (30 segundos cada)
6. Finaliza com panorâmica final (5 segundos)
7. Sync automático no escritório

**Resultado:** Obra completa documentada em minutos

---

## SLIDE 21: INTEGRAÇÃO

### Ecossistema Completo

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  APP MOBILE  │ ──► │    NUVEM     │ ──► │  SISTEMA WEB │
│  (Campo)     │     │  (Supabase)  │     │  (Gestão)    │
└──────────────┘     └──────────────┘     └──────────────┘
      │                                          │
      │              ┌──────────────┐            │
      └────────────► │  RELATÓRIOS  │ ◄──────────┘
                     │  PDF / XLSX  │
                     └──────────────┘
```

---

## SLIDE 22: DEMONSTRAÇÃO AO VIVO

### Vamos ver na prática!

**Demonstração:**
1. Criar uma obra de Checklist de Fiscalização
2. Tirar fotos em algumas categorias
3. Mostrar funcionamento offline
4. Sincronizar com a nuvem
5. Ver no sistema web

---

## SLIDE 23: RESUMO

### O que o App Oferece

✅ **12+ tipos de serviço** suportados
✅ **100% offline** - funciona sem internet
✅ **GPS automático** em todas as fotos
✅ **Organização** por categorias
✅ **Sincronização** automática e segura
✅ **Backup** em múltiplas camadas
✅ **Interface** simples e intuitiva
✅ **Compatível** com Android e iOS

---

## SLIDE 24: PRÓXIMOS PASSOS

### Como Começar

1. **Instalação**
   - Download do app
   - Criação de conta

2. **Treinamento**
   - Sessão de 30 minutos
   - Material de apoio

3. **Uso**
   - Começar a registrar obras
   - Suporte disponível

---

## SLIDE 25: CONTATO

### Dúvidas?

**Suporte Técnico:**
- Email: suporte@exemplo.com
- WhatsApp: (XX) XXXXX-XXXX

**Treinamento:**
- Agendamento via gestão

---

## NOTAS PARA O APRESENTADOR

### Dicas de Apresentação

1. **Prepare o celular:**
   - App instalado e logado
   - Algumas obras de exemplo
   - Bateria carregada

2. **Demonstrações práticas:**
   - Criar obra ao vivo
   - Tirar foto real
   - Mostrar modo offline (modo avião)

3. **Foque nos benefícios:**
   - "Nunca mais perde foto"
   - "Funciona sem internet"
   - "Relatório automático"

4. **Responda perguntas comuns:**
   - "E se o celular quebrar?" → Dados na nuvem
   - "Ocupa muito espaço?" → Compressão + limpeza
   - "É difícil de usar?" → Demo de 2 minutos

5. **Tempo sugerido:**
   - Slides: 20-25 minutos
   - Demonstração: 10-15 minutos
   - Perguntas: 10 minutos
