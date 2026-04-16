/**
 * Tipos para Serviços (arquitetura 1:N com Obras)
 * Cada obra pode ter múltiplos serviços, cada um com fotos independentes
 */

export type TipoServico =
  | 'Abertura e Fechamento de Chave'
  | 'Altimetria'
  | 'Bandolamento'
  | 'Book de Aterramento'
  | 'Cava em Rocha'
  | 'Checklist de Fiscalização'
  | 'Ditais'
  | 'Documentação'
  | 'Emenda'
  | 'Fundação Especial'
  | 'Instalação do Medidor'
  | 'Linha Viva'
  | 'Poda'
  | 'Transformador'
  | 'Vazamento e Limpeza de Transformador';

export type StatusServico = 'rascunho' | 'em_progresso' | 'completo';
export type SyncStatusServico = 'offline' | 'syncing' | 'synced' | 'error';

/**
 * Metadados de uma foto (compatível com FotoInfo do photo-backup.ts)
 */
export interface FotoInfo {
  // Legacy field kept optional for backward compatibility with older cached payloads
  id?: string; // photoMetadata.id — permite resolveLocalPhotosToUrls re-fazer upload se url for inválida
  uri?: string;
  url?: string;
  latitude?: number;
  longitude?: number;
  utm_x?: number;
  utm_y?: number;
  utm_zone?: string;
  utmX?: string;
  utmY?: string;
  timestamp?: number;
  takenAt?: string;
  equipamento?: string;
  technician?: string;
  created_at?: string;
  synced?: boolean;
}

/**
 * Dados estruturados para postes (Linha Viva, Cava em Rocha, Checklist)
 */
export interface PosteData {
  id: string;
  numero: number;
  isAditivo?: boolean;
  fotos_antes: string[]; // Array de photoIds
  fotos_durante: string[];
  fotos_depois: string[];
  fotos_medicao?: string[];
  engaste?: string[]; // Para Checklist
  conexao1?: string[];
  posteInteiro?: string[];
}

/**
 * Dados estruturados para seccionamentos (Checklist de Fiscalização)
 */
export interface SeccionamentoData {
  id: string;
  numero: number;
  tipo?: 'seccionamento' | 'emenda' | 'poda';
  posteInicio?: number | null;
  posteFim?: number | null;
  poste_inicio?: number | null; // Fallback se usar snake_case
  poste_fim?: number | null;
  fotos: string[]; // Array de photoIds
}

/**
 * Dados estruturados para aterramentos de cerca (Checklist de Fiscalização)
 */
export interface AterramentoCercaData {
  id: string;
  numero: number;
  fotos: string[];
}

/**
 * Dados estruturados para hastes/termômetros (Checklist de Fiscalização)
 */
export interface HasteTermometroData {
  id: string;
  numero: string;
  isAditivo?: boolean;
  fotoHaste: string[];
  fotoTermometro: string[];
}

/**
 * Interface principal para Serviço
 */
export interface Servico {
  id: string;
  obra_id: string;
  obra_numero?: string; // Redundante com obras.obra — permite queries offline sem JOIN
  tipo_servico: TipoServico;
  responsavel?: string;
  status: StatusServico;
  sync_status: SyncStatusServico;
  error_message?: string | null;
  created_at: string;
  updated_at: string;

  // Fotos genéricas
  fotos_antes: FotoInfo[];
  fotos_durante: FotoInfo[];
  fotos_depois: FotoInfo[];

  // Fotos específicas de cada tipo
  fotos_abertura?: FotoInfo[];
  fotos_fechamento?: FotoInfo[];

  fotos_ditais_abertura?: FotoInfo[];
  fotos_ditais_impedir?: FotoInfo[];
  fotos_ditais_testar?: FotoInfo[];
  fotos_ditais_aterrar?: FotoInfo[];
  fotos_ditais_sinalizar?: FotoInfo[];

  fotos_aterramento_vala_aberta?: FotoInfo[];
  fotos_aterramento_hastes?: FotoInfo[];
  fotos_aterramento_vala_fechada?: FotoInfo[];
  fotos_aterramento_medicao?: FotoInfo[];

  fotos_transformador_laudo?: FotoInfo[];
  fotos_transformador_componente_instalado?: FotoInfo[];
  fotos_transformador_tombamento_instalado?: FotoInfo[];
  fotos_transformador_tape?: FotoInfo[];
  fotos_transformador_placa_instalado?: FotoInfo[];
  fotos_transformador_instalado?: FotoInfo[];
  fotos_transformador_antes_retirar?: FotoInfo[];
  fotos_transformador_laudo_retirado?: FotoInfo[];
  fotos_transformador_tombamento_retirado?: FotoInfo[];
  fotos_transformador_placa_retirado?: FotoInfo[];
  fotos_transformador_conexoes_primarias_instalado?: FotoInfo[];
  fotos_transformador_conexoes_secundarias_instalado?: FotoInfo[];
  fotos_transformador_conexoes_primarias_retirado?: FotoInfo[];
  fotos_transformador_conexoes_secundarias_retirado?: FotoInfo[];

  fotos_medidor_padrao?: FotoInfo[];
  fotos_medidor_leitura?: FotoInfo[];
  fotos_medidor_selo_born?: FotoInfo[];
  fotos_medidor_selo_caixa?: FotoInfo[];
  fotos_medidor_identificador_fase?: FotoInfo[];

  fotos_checklist_croqui?: FotoInfo[];
  fotos_checklist_panoramica_inicial?: FotoInfo[];
  fotos_checklist_chede?: FotoInfo[];
  fotos_checklist_aterramento_cerca?: FotoInfo[];
  fotos_checklist_padrao_geral?: FotoInfo[];
  fotos_checklist_padrao_interno?: FotoInfo[];
  fotos_checklist_panoramica_final?: FotoInfo[];
  fotos_checklist_postes?: FotoInfo[];
  fotos_checklist_seccionamentos?: FotoInfo[];
  fotos_checklist_frying?: FotoInfo[];
  fotos_checklist_abertura_fechamento_pulo?: FotoInfo[];

  fotos_altimetria_lado_fonte?: FotoInfo[];
  fotos_altimetria_medicao_fonte?: FotoInfo[];
  fotos_altimetria_lado_carga?: FotoInfo[];
  fotos_altimetria_medicao_carga?: FotoInfo[];

  fotos_vazamento_evidencia?: FotoInfo[];
  fotos_vazamento_equipamentos_limpeza?: FotoInfo[];
  fotos_vazamento_tombamento_retirado?: FotoInfo[];
  fotos_vazamento_placa_retirado?: FotoInfo[];
  fotos_vazamento_tombamento_instalado?: FotoInfo[];
  fotos_vazamento_placa_instalado?: FotoInfo[];
  fotos_vazamento_instalacao?: FotoInfo[];

  // Documentos
  doc_cadastro_medidor?: FotoInfo[];
  doc_laudo_transformador?: FotoInfo[];
  doc_laudo_regulador?: FotoInfo[];
  doc_laudo_religador?: FotoInfo[];
  doc_apr?: FotoInfo[];
  doc_fvbt?: FotoInfo[];
  doc_termo_desistencia_lpt?: FotoInfo[];
  doc_autorizacao_passagem?: FotoInfo[];
  doc_materiais_previsto?: FotoInfo[];
  doc_materiais_realizado?: FotoInfo[];

  // Dados estruturados
  postes_data?: PosteData[];
  checklist_postes_data?: PosteData[];
  checklist_seccionamentos_data?: SeccionamentoData[];
  checklist_aterramentos_cerca_data?: AterramentoCercaData[];
  checklist_hastes_termometros_data?: HasteTermometroData[];
}

/**
 * Versão local do Serviço para armazenamento offline (AsyncStorage)
 */
export interface ServicoLocal {
  id: string;
  obra_id: string;
  obra_numero?: string; // Redundante com obras.obra — permite queries offline sem JOIN
  tipo_servico: TipoServico;
  responsavel?: string;
  status: StatusServico;
  sync_status: SyncStatusServico;
  error_message?: string | null;
  created_at: string;
  updated_at: string;

  // Fotos armazenadas como photoIds (strings) ao invés de FotoInfo completas
  fotos_antes: string[];
  fotos_durante: string[];
  fotos_depois: string[];
  fotos_abertura?: string[];
  fotos_fechamento?: string[];
  fotos_ditais_abertura?: string[];
  fotos_ditais_impedir?: string[];
  fotos_ditais_testar?: string[];
  fotos_ditais_aterrar?: string[];
  fotos_ditais_sinalizar?: string[];
  fotos_aterramento_vala_aberta?: string[];
  fotos_aterramento_hastes?: string[];
  fotos_aterramento_vala_fechada?: string[];
  fotos_aterramento_medicao?: string[];
  fotos_transformador_laudo?: string[];
  fotos_transformador_componente_instalado?: string[];
  fotos_transformador_tombamento_instalado?: string[];
  fotos_transformador_tape?: string[];
  fotos_transformador_placa_instalado?: string[];
  fotos_transformador_instalado?: string[];
  fotos_transformador_antes_retirar?: string[];
  fotos_transformador_laudo_retirado?: string[];
  fotos_transformador_tombamento_retirado?: string[];
  fotos_transformador_placa_retirado?: string[];
  fotos_transformador_conexoes_primarias_instalado?: string[];
  fotos_transformador_conexoes_secundarias_instalado?: string[];
  fotos_transformador_conexoes_primarias_retirado?: string[];
  fotos_transformador_conexoes_secundarias_retirado?: string[];
  fotos_medidor_padrao?: string[];
  fotos_medidor_leitura?: string[];
  fotos_medidor_selo_born?: string[];
  fotos_medidor_selo_caixa?: string[];
  fotos_medidor_identificador_fase?: string[];
  fotos_checklist_croqui?: string[];
  fotos_checklist_panoramica_inicial?: string[];
  fotos_checklist_chede?: string[];
  fotos_checklist_aterramento_cerca?: string[];
  fotos_checklist_padrao_geral?: string[];
  fotos_checklist_padrao_interno?: string[];
  fotos_checklist_panoramica_final?: string[];
  fotos_checklist_postes?: string[];
  fotos_checklist_seccionamentos?: string[];
  fotos_checklist_frying?: string[];
  fotos_checklist_abertura_fechamento_pulo?: string[];
  fotos_altimetria_lado_fonte?: string[];
  fotos_altimetria_medicao_fonte?: string[];
  fotos_altimetria_lado_carga?: string[];
  fotos_altimetria_medicao_carga?: string[];
  fotos_vazamento_evidencia?: string[];
  fotos_vazamento_equipamentos_limpeza?: string[];
  fotos_vazamento_tombamento_retirado?: string[];
  fotos_vazamento_placa_retirado?: string[];
  fotos_vazamento_tombamento_instalado?: string[];
  fotos_vazamento_placa_instalado?: string[];
  fotos_vazamento_instalacao?: string[];
  doc_cadastro_medidor?: string[];
  doc_laudo_transformador?: string[];
  doc_laudo_regulador?: string[];
  doc_laudo_religador?: string[];
  doc_apr?: string[];
  doc_fvbt?: string[];
  doc_termo_desistencia_lpt?: string[];
  doc_autorizacao_passagem?: string[];
  doc_materiais_previsto?: string[];
  doc_materiais_realizado?: string[];

  // Dados estruturados
  postes_data?: PosteData[];
  checklist_postes_data?: PosteData[];
  checklist_seccionamentos_data?: SeccionamentoData[];
  checklist_aterramentos_cerca_data?: AterramentoCercaData[];
  checklist_hastes_termometros_data?: HasteTermometroData[];
}

/**
 * Mapa de tipos de serviço para suas categorias de fotos
 * Usado na UI para exibir apenas as fotos relevantes
 */
export const SERVICO_PHOTO_MAP: Record<TipoServico, Array<{ field: keyof Servico; label: string }>> = {
  'Abertura e Fechamento de Chave': [
    { field: 'fotos_abertura', label: 'Abertura' },
    { field: 'fotos_fechamento', label: 'Fechamento' },
  ],
  'Altimetria': [
    { field: 'fotos_altimetria_lado_fonte', label: 'Lado Fonte' },
    { field: 'fotos_altimetria_medicao_fonte', label: 'Medição Fonte' },
    { field: 'fotos_altimetria_lado_carga', label: 'Lado Carga' },
    { field: 'fotos_altimetria_medicao_carga', label: 'Medição Carga' },
  ],
  'Bandolamento': [
    { field: 'fotos_antes', label: 'Antes' },
    { field: 'fotos_durante', label: 'Durante' },
    { field: 'fotos_depois', label: 'Depois' },
  ],
  'Book de Aterramento': [
    { field: 'fotos_aterramento_vala_aberta', label: 'Vala Aberta' },
    { field: 'fotos_aterramento_hastes', label: 'Hastes Instaladas' },
    { field: 'fotos_aterramento_vala_fechada', label: 'Vala Fechada' },
    { field: 'fotos_aterramento_medicao', label: 'Medição' },
  ],
  'Cava em Rocha': [
    { field: 'fotos_antes', label: 'Antes' },
    { field: 'fotos_durante', label: 'Durante' },
    { field: 'fotos_depois', label: 'Depois' },
  ],
  'Checklist de Fiscalização': [
    { field: 'fotos_checklist_croqui', label: 'Croqui' },
    { field: 'fotos_checklist_panoramica_inicial', label: 'Panorâmica Inicial' },
    { field: 'fotos_checklist_chede', label: 'CHEDE' },
    { field: 'fotos_checklist_postes', label: 'Postes' },
    { field: 'fotos_checklist_seccionamentos', label: 'Seccionamentos' },
    { field: 'fotos_checklist_aterramento_cerca', label: 'Aterramento da Cerca' },
    { field: 'fotos_checklist_padrao_geral', label: 'Padrão Geral' },
    { field: 'fotos_checklist_padrao_interno', label: 'Padrão Interno' },
    { field: 'fotos_checklist_frying', label: 'Frying' },
    { field: 'fotos_checklist_abertura_fechamento_pulo', label: 'Abertura/Fechamento Pulo' },
    { field: 'fotos_checklist_panoramica_final', label: 'Panorâmica Final' },
  ],
  'Ditais': [
    { field: 'fotos_ditais_abertura', label: 'Desligar' },
    { field: 'fotos_ditais_impedir', label: 'Impedir Acionamento' },
    { field: 'fotos_ditais_testar', label: 'Testar Funcionamento' },
    { field: 'fotos_ditais_aterrar', label: 'Aterrar Corretamente' },
    { field: 'fotos_ditais_sinalizar', label: 'Sinalizar Corretamente' },
  ],
  'Documentação': [
    { field: 'doc_apr', label: 'APR' },
    { field: 'doc_cadastro_medidor', label: 'Cadastro Medidor' },
    { field: 'doc_laudo_transformador', label: 'Laudo Transformador' },
    { field: 'doc_laudo_regulador', label: 'Laudo Regulador' },
    { field: 'doc_laudo_religador', label: 'Laudo Religador' },
    { field: 'doc_fvbt', label: 'FVBT' },
    { field: 'doc_termo_desistencia_lpt', label: 'Termo Desistência LPT' },
    { field: 'doc_autorizacao_passagem', label: 'Autorização de Passagem' },
    { field: 'doc_materiais_previsto', label: 'Materiais Previsto' },
    { field: 'doc_materiais_realizado', label: 'Materiais Realizado' },
  ],
  'Emenda': [
    { field: 'fotos_antes', label: 'Antes' },
    { field: 'fotos_durante', label: 'Durante' },
    { field: 'fotos_depois', label: 'Depois' },
  ],
  'Fundação Especial': [
    { field: 'fotos_antes', label: 'Antes' },
    { field: 'fotos_durante', label: 'Durante' },
    { field: 'fotos_depois', label: 'Depois' },
  ],
  'Instalação do Medidor': [
    { field: 'fotos_medidor_padrao', label: 'Padrão c/ Medidor Instalado' },
    { field: 'fotos_medidor_leitura', label: 'Leitura c/ Medidor Instalado' },
    { field: 'fotos_medidor_selo_born', label: 'Selo do Born' },
    { field: 'fotos_medidor_selo_caixa', label: 'Selo da Caixa' },
    { field: 'fotos_medidor_identificador_fase', label: 'Identificador de Fase' },
  ],
  'Linha Viva': [
    { field: 'fotos_antes', label: 'Antes' },
    { field: 'fotos_durante', label: 'Durante' },
    { field: 'fotos_depois', label: 'Depois' },
  ],
  'Poda': [
    { field: 'fotos_antes', label: 'Antes' },
    { field: 'fotos_durante', label: 'Durante' },
    { field: 'fotos_depois', label: 'Depois' },
  ],
  'Transformador': [
    // Instalado
    { field: 'fotos_transformador_componente_instalado', label: 'Componente Instalado' },
    { field: 'fotos_transformador_tombamento_instalado', label: 'Tombamento Instalado' },
    { field: 'fotos_transformador_tape', label: 'Tape' },
    { field: 'fotos_transformador_placa_instalado', label: 'Placa Instalado' },
    { field: 'fotos_transformador_instalado', label: 'Transformador Instalado' },
    { field: 'fotos_transformador_conexoes_primarias_instalado', label: 'Conexões Primárias Instalado' },
    { field: 'fotos_transformador_conexoes_secundarias_instalado', label: 'Conexões Secundárias Instalado' },
    // Retirado
    { field: 'fotos_transformador_antes_retirar', label: 'Antes de Retirar' },
    { field: 'fotos_transformador_laudo_retirado', label: 'Laudo Retirado' },
    { field: 'fotos_transformador_tombamento_retirado', label: 'Tombamento Retirado' },
    { field: 'fotos_transformador_placa_retirado', label: 'Placa Retirado' },
    { field: 'fotos_transformador_conexoes_primarias_retirado', label: 'Conexões Primárias Retirado' },
    { field: 'fotos_transformador_conexoes_secundarias_retirado', label: 'Conexões Secundárias Retirado' },
  ],
  'Vazamento e Limpeza de Transformador': [
    { field: 'fotos_vazamento_evidencia', label: 'Evidência do Vazamento' },
    { field: 'fotos_vazamento_equipamentos_limpeza', label: 'Equipamentos de Limpeza' },
    { field: 'fotos_vazamento_tombamento_retirado', label: 'Tombamento Retirado' },
    { field: 'fotos_vazamento_placa_retirado', label: 'Placa Retirado' },
    { field: 'fotos_vazamento_tombamento_instalado', label: 'Tombamento Instalado' },
    { field: 'fotos_vazamento_placa_instalado', label: 'Placa Instalado' },
    { field: 'fotos_vazamento_instalacao', label: 'Instalação do Transformador' },
  ],
};
