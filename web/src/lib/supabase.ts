import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos do banco de dados
export interface Obra {
  id: string
  data: string
  obra: string
  responsavel: string
  equipe: string
  tipo_servico: string
  tem_atipicidade: boolean
  atipicidades: number[]
  descricao_atipicidade?: string | null
  fotos_antes?: FotoInfo[]
  fotos_durante?: FotoInfo[]
  fotos_depois?: FotoInfo[]
  fotos_abertura?: FotoInfo[]
  fotos_fechamento?: FotoInfo[]
  // DITAIS - 5 fotos (método DITAIS)
  fotos_ditais_abertura?: FotoInfo[]
  fotos_ditais_impedir?: FotoInfo[]
  fotos_ditais_testar?: FotoInfo[]
  fotos_ditais_aterrar?: FotoInfo[]
  fotos_ditais_sinalizar?: FotoInfo[]
  // BOOK ATERRAMENTO - 4 fotos
  fotos_aterramento_vala_aberta?: FotoInfo[]
  fotos_aterramento_hastes?: FotoInfo[]
  fotos_aterramento_vala_fechada?: FotoInfo[]
  fotos_aterramento_medicao?: FotoInfo[]
  // TRANSFORMADOR
  transformador_status?: string | null
  fotos_transformador_laudo?: FotoInfo[]
  fotos_transformador_componente_instalado?: FotoInfo[]
  fotos_transformador_tombamento_instalado?: FotoInfo[]
  fotos_transformador_tape?: FotoInfo[]
  fotos_transformador_placa_instalado?: FotoInfo[]
  fotos_transformador_instalado?: FotoInfo[]
  fotos_transformador_antes_retirar?: FotoInfo[]
  fotos_transformador_tombamento_retirado?: FotoInfo[]
  fotos_transformador_placa_retirado?: FotoInfo[]
  // MEDIDOR - 5 fotos
  fotos_medidor_padrao?: FotoInfo[]
  fotos_medidor_leitura?: FotoInfo[]
  fotos_medidor_selo_born?: FotoInfo[]
  fotos_medidor_selo_caixa?: FotoInfo[]
  fotos_medidor_identificador_fase?: FotoInfo[]
  // CHECKLIST DE FISCALIZAÇÃO
  fotos_checklist_croqui?: FotoInfo[]
  fotos_checklist_panoramica_inicial?: FotoInfo[]
  fotos_checklist_chede?: FotoInfo[]
  fotos_checklist_aterramento_cerca?: FotoInfo[]
  fotos_checklist_padrao_geral?: FotoInfo[]
  fotos_checklist_padrao_interno?: FotoInfo[]
  fotos_checklist_panoramica_final?: FotoInfo[]
  fotos_checklist_postes?: FotoInfo[]
  fotos_checklist_seccionamentos?: FotoInfo[]
  // ALTIMETRIA - 4 fotos
  fotos_altimetria_lado_fonte?: FotoInfo[]
  fotos_altimetria_medicao_fonte?: FotoInfo[]
  fotos_altimetria_lado_carga?: FotoInfo[]
  fotos_altimetria_medicao_carga?: FotoInfo[]
  // VAZAMENTO E LIMPEZA DE TRANSFORMADOR - 7 fotos
  fotos_vazamento_evidencia?: FotoInfo[]
  fotos_vazamento_equipamentos_limpeza?: FotoInfo[]
  fotos_vazamento_tombamento_retirado?: FotoInfo[]
  fotos_vazamento_placa_retirado?: FotoInfo[]
  fotos_vazamento_tombamento_instalado?: FotoInfo[]
  fotos_vazamento_placa_instalado?: FotoInfo[]
  fotos_vazamento_instalacao?: FotoInfo[]
  // DOCUMENTAÇÃO - PDFs
  doc_cadastro_medidor?: FotoInfo[]
  doc_laudo_transformador?: FotoInfo[]
  doc_laudo_regulador?: FotoInfo[]
  doc_laudo_religador?: FotoInfo[]
  doc_apr?: FotoInfo[]
  doc_fvbt?: FotoInfo[]
  doc_termo_desistencia_lpt?: FotoInfo[]
  user_id: string
  created_at: string
}

export interface FotoInfo {
  url: string
  latitude?: number | null
  longitude?: number | null
}

export interface Equipe {
  id: string
  nome: string
  descricao?: string | null
  created_at: string
}

export interface UsuarioApp {
  id: string
  nome: string
  email: string
  equipe_id?: string | null
  equipe?: Equipe | null
  created_at: string
}
