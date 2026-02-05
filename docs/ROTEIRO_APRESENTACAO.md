# Roteiro de Apresentação - Obras Wise

## Visão Geral do Sistema

O **Obras Wise** é uma solução completa para gestão de obras de campo, composta por:
- **App Mobile** (React Native/Expo) - Usado pela equipe de campo
- **Sistema Web** (Next.js) - Usado pela gestão/escritório

---

## PARTE 1: APLICATIVO MOBILE

### 1.1 Tela de Login
**O que mostrar:**
- Abrir o app
- Mostrar a tela de login com campos de email e senha
- Fazer login com um usuário de demonstração

**Pontos a destacar:**
- Interface simples e intuitiva
- Autenticação segura via Supabase
- Funciona offline após primeiro login

---

### 1.2 Tela Inicial (Dashboard)
**O que mostrar:**
- Lista de obras pendentes e concluídas
- Filtros por equipe e status
- Botão de nova obra

**Pontos a destacar:**
- Visualização rápida do status das obras
- Sincronização automática quando online
- Indicador de conexão (online/offline)

---

### 1.3 Criar Nova Obra
**O que mostrar:**
1. Clicar em "Nova Obra"
2. Preencher dados básicos:
   - Número da obra
   - Equipe responsável
   - Tipo de serviço
   - Data

**Pontos a destacar:**
- Seleção de tipo de serviço define quais campos aparecem
- Campos obrigatórios validados
- Salvamento automático em modo offline

---

### 1.4 Tipos de Serviço Disponíveis
**Demonstrar pelo menos 2-3 tipos:**

#### A) Emenda / Bandolamento / Poda
- Fotos: Antes, Durante e Depois
- Fluxo simples de 3 etapas

#### B) Checklist de Fiscalização (DEMONSTRAR COMPLETO)
- Croqui
- Panorâmica Inicial
- CHEDE
- Aterramento de Cerca
- Padrão Geral
- Padrão Interno
- Panorâmica Final
- Postes (com número identificador)
- Seccionamentos

#### C) DITAIS
- Desligar/Abertura
- Impedir Religamento
- Testar Ausência de Tensão
- Aterrar
- Sinalizar/Isolar

#### D) Book de Aterramento
- Vala Aberta
- Hastes Aplicadas
- Vala Fechada
- Medição com Terrômetro

---

### 1.5 Captura de Fotos
**O que mostrar:**
1. Clicar no botão de câmera
2. Tirar uma foto
3. Mostrar a foto na galeria
4. Demonstrar que múltiplas fotos podem ser adicionadas

**Pontos a destacar:**
- Fotos com geolocalização automática (GPS)
- Placa/marca d'água com informações da obra
- Compressão inteligente para economia de dados
- Backup local antes de sincronizar

---

### 1.6 Funcionamento Offline
**O que mostrar:**
1. Ativar modo avião no celular
2. Criar uma obra ou adicionar fotos
3. Mostrar que os dados são salvos localmente
4. Reativar internet e mostrar sincronização

**Pontos a destacar:**
- 100% funcional sem internet
- Sincronização automática quando reconecta
- Não perde dados mesmo se fechar o app
- Fotos ficam no backup local até confirmar upload

---

### 1.7 Edição de Obra Existente
**O que mostrar:**
1. Selecionar uma obra da lista
2. Visualizar detalhes e fotos
3. Adicionar mais fotos se necessário
4. Finalizar obra

**Pontos a destacar:**
- Pode pausar e continuar depois
- Histórico de alterações preservado
- Fotos nunca são perdidas

---

## PARTE 2: SISTEMA WEB

### 2.1 Tela de Login
**O que mostrar:**
- Acessar o sistema web
- Fazer login com credenciais de administrador

**Pontos a destacar:**
- Acesso restrito por perfil (admin, gestor, visualizador)
- Interface responsiva

---

### 2.2 Dashboard Principal
**O que mostrar:**
- Visão geral das obras
- Filtros por período, equipe, tipo de serviço
- Cards com estatísticas

**Pontos a destacar:**
- Dados em tempo real
- Filtros avançados para análise
- Exportação de dados

---

### 2.3 Lista de Obras (Relatórios)
**O que mostrar:**
1. Navegar para "Relatórios"
2. Mostrar lista de obras com filtros
3. Visualizar o "Book" de uma obra

**Pontos a destacar:**
- Book fotográfico visual
- Organizado por tipo de foto
- Visualização em grade ou lista

---

### 2.4 Detalhes da Obra
**O que mostrar:**
1. Clicar em uma obra para ver detalhes
2. Mostrar todas as seções de fotos
3. Demonstrar o Checklist de Fiscalização com fotos

**Pontos a destacar:**
- Todas as fotos organizadas por categoria
- Informações completas da obra
- Dados de geolocalização das fotos

---

### 2.5 Gestão de Atipicidades
**O que mostrar:**
1. Na página de detalhes da obra
2. Adicionar uma atipicidade da lista
3. Mostrar descrição automática
4. Remover atipicidade

**Pontos a destacar:**
- Lista padronizada de atipicidades
- Descrições detalhadas para relatórios
- Salva automaticamente no banco

---

### 2.6 Exportação de Relatórios
**O que mostrar:**

#### A) Exportar PDF
1. Clicar em "Exportar PDF"
2. Aguardar geração
3. Mostrar o PDF com fotos e informações

#### B) Exportar XLSX
1. Clicar em "Exportar XLSX"
2. Abrir no Excel
3. Mostrar aba de atipicidades formatada
4. Mostrar aba de fotos com URLs

**Pontos a destacar:**
- PDF pronto para impressão/envio
- Excel editável para relatórios personalizados
- Formatação profissional automática

---

### 2.7 Gestão de Equipes
**O que mostrar:**
1. Navegar para "Equipes"
2. Listar equipes cadastradas
3. Adicionar/editar equipe

**Pontos a destacar:**
- Controle centralizado de equipes
- Vinculação com obras

---

### 2.8 Gestão de Usuários
**O que mostrar:**
1. Navegar para "Usuários"
2. Listar usuários do sistema
3. Mostrar níveis de acesso

**Pontos a destacar:**
- Controle de acesso por perfil
- Auditoria de ações

---

## PARTE 3: FLUXO COMPLETO (DEMONSTRAÇÃO END-TO-END)

### Cenário: Obra de Checklist de Fiscalização

**No App Mobile:**
1. Criar nova obra tipo "Checklist de Fiscalização"
2. Preencher número da obra: "DEMO-001"
3. Tirar fotos:
   - 1 foto de Croqui
   - 1 foto Panorâmica Inicial
   - 1 foto de Poste (informar número do poste)
4. Salvar e sincronizar

**No Sistema Web:**
1. Atualizar lista de obras
2. Encontrar "DEMO-001"
3. Abrir detalhes
4. Verificar que todas as fotos aparecem
5. Adicionar atipicidade se aplicável
6. Exportar PDF

---

## BENEFÍCIOS PRINCIPAIS

### Para a Equipe de Campo:
- Trabalha offline sem problemas
- Interface simples e rápida
- Não perde dados nunca
- GPS automático nas fotos

### Para a Gestão:
- Visibilidade em tempo real
- Relatórios profissionais automáticos
- Histórico completo de obras
- Controle de atipicidades padronizado

### Para a Empresa:
- Redução de retrabalho
- Padronização de processos
- Rastreabilidade completa
- Integração campo-escritório

---

## PERGUNTAS FREQUENTES (FAQ)

**P: O que acontece se o celular descarregar durante uma obra?**
R: Os dados são salvos constantemente. Ao ligar novamente, tudo estará lá.

**P: As fotos ocupam muito espaço no celular?**
R: As fotos são comprimidas automaticamente. Após sincronizar, o backup local pode ser limpo.

**P: Posso usar em qualquer celular?**
R: Sim, funciona em Android e iOS.

**P: Quantas fotos posso tirar por obra?**
R: Não há limite. O sistema gerencia automaticamente.

**P: O sistema é seguro?**
R: Sim, usa criptografia e autenticação segura. Dados armazenados na nuvem com backup.

---

## DICAS PARA A APRESENTAÇÃO

1. **Prepare o ambiente:**
   - Celular carregado com app instalado
   - Computador com sistema web aberto
   - Conexão de internet estável
   - Conta de demonstração configurada

2. **Crie dados de exemplo:**
   - Tenha algumas obras já cadastradas
   - Com fotos em diferentes categorias
   - Uma obra completa para mostrar o PDF

3. **Demonstre o diferencial offline:**
   - Este é um grande diferencial
   - Mostre ativando/desativando o modo avião

4. **Foque nos benefícios:**
   - Menos papel
   - Menos retrabalho
   - Mais organização
   - Relatórios automáticos

5. **Tempo sugerido:**
   - App Mobile: 15-20 minutos
   - Sistema Web: 10-15 minutos
   - Demonstração completa: 5-10 minutos
   - Perguntas: 10 minutos
   - **Total: ~45 minutos**

---

## CHECKLIST PRÉ-APRESENTAÇÃO

- [ ] App instalado e funcionando
- [ ] Login de demonstração testado
- [ ] Sistema web acessível
- [ ] Obras de exemplo criadas
- [ ] PDF de exemplo gerado
- [ ] Internet funcionando
- [ ] Modo offline testado
- [ ] Projetor/tela configurado
- [ ] Roteiro impresso/disponível
