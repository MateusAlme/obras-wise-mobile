/**
 * Script para corrigir TODAS as obras de checklist
 * Mapeia fotos do storage para campos JSONB estruturados
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function isLocalUrl(url: string): boolean {
  return url.startsWith('file:///') || url.startsWith('/data/user/')
}

function isValidPhoto(foto: any): boolean {
  if (!foto) return false
  if (typeof foto === 'string') {
    return foto.startsWith('http') && !isLocalUrl(foto)
  }
  if (typeof foto === 'object' && foto.url) {
    return foto.url.startsWith('http') && !isLocalUrl(foto.url)
  }
  return false
}

async function corrigirTodasObras() {
  console.log('\n🔧 Corrigindo TODAS as obras de Checklist de Fiscalização...\n')

  // 1. Buscar todas as obras de checklist
  const { data: obras, error: obrasError } = await supabase
    .from('obras')
    .select('id, obra, tipo_servico, checklist_postes_data, checklist_seccionamentos_data, checklist_aterramentos_cerca_data, checklist_hastes_termometros_data')
    .eq('tipo_servico', 'Checklist de Fiscalização')

  if (obrasError || !obras) {
    console.error('❌ Erro ao buscar obras:', obrasError)
    return
  }

  console.log(`✅ Encontradas ${obras.length} obras de Checklist\n`)

  // 2. Listar todos os arquivos no storage
  const { data: files, error: filesError } = await supabase.storage
    .from('obra-photos')
    .list('', {
      limit: 10000,
      sortBy: { column: 'created_at', order: 'asc' }
    })

  if (filesError || !files) {
    console.error('❌ Erro ao listar storage:', filesError)
    return
  }

  console.log(`✅ ${files.length} arquivos no storage\n`)

  let obrasCorrigidas = 0
  let obrasComProblema = 0

  for (const obra of obras) {
    console.log(`\n📊 Processando obra ${obra.obra} (${obra.id})...`)

    let precisaCorrigir = false
    const updates: any = {}

    // Processar POSTES
    if (obra.checklist_postes_data && Array.isArray(obra.checklist_postes_data)) {
      const postesCorrigidos = obra.checklist_postes_data.map((poste: any) => {
        const corrigido = { ...poste }
        let posteTemProblema = false

        // Para cada campo de fotos do poste
        const campos = ['posteInteiro', 'engaste', 'conexao1', 'conexao2', 'maiorEsforco', 'menorEsforco']
        campos.forEach(campo => {
          if (poste[campo] && Array.isArray(poste[campo])) {
            const fotosValidas = poste[campo].filter((f: any) => isValidPhoto(f))
            if (fotosValidas.length !== poste[campo].length) {
              posteTemProblema = true
              corrigido[campo] = fotosValidas
            }
          }
        })

        if (posteTemProblema) precisaCorrigir = true
        return corrigido
      })

      if (precisaCorrigir) {
        updates.checklist_postes_data = postesCorrigidos
        console.log('  ✅ Postes corrigidos')
      }
    }

    // Processar SECCIONAMENTOS
    if (obra.checklist_seccionamentos_data && Array.isArray(obra.checklist_seccionamentos_data)) {
      const seccionamentosCorrigidos = obra.checklist_seccionamentos_data.map((sec: any) => {
        if (sec.fotos && Array.isArray(sec.fotos)) {
          const fotosValidas = sec.fotos.filter((f: any) => isValidPhoto(f))
          if (fotosValidas.length !== sec.fotos.length) {
            precisaCorrigir = true
            return { ...sec, fotos: fotosValidas }
          }
        }
        return sec
      })

      if (precisaCorrigir && updates.checklist_seccionamentos_data === undefined) {
        updates.checklist_seccionamentos_data = seccionamentosCorrigidos
        console.log('  ✅ Seccionamentos corrigidos')
      }
    }

    // Processar ATERRAMENTOS
    if (obra.checklist_aterramentos_cerca_data && Array.isArray(obra.checklist_aterramentos_cerca_data)) {
      const aterramentosCorrigidos = obra.checklist_aterramentos_cerca_data.map((aterr: any) => {
        if (aterr.fotos && Array.isArray(aterr.fotos)) {
          const fotosValidas = aterr.fotos.filter((f: any) => isValidPhoto(f))
          if (fotosValidas.length !== aterr.fotos.length) {
            precisaCorrigir = true
            return { ...aterr, fotos: fotosValidas }
          }
        }
        return aterr
      })

      if (precisaCorrigir && updates.checklist_aterramentos_cerca_data === undefined) {
        updates.checklist_aterramentos_cerca_data = aterramentosCorrigidos
        console.log('  ✅ Aterramentos corrigidos')
      }
    }

    // Processar HASTES/TERMÔMETROS
    if (obra.checklist_hastes_termometros_data && Array.isArray(obra.checklist_hastes_termometros_data)) {
      const hastesCorrigidos = obra.checklist_hastes_termometros_data.map((ponto: any) => {
        const corrigido = { ...ponto }
        let pontoTemProblema = false

        if (ponto.fotoHaste && Array.isArray(ponto.fotoHaste)) {
          const fotosValidas = ponto.fotoHaste.filter((f: any) => isValidPhoto(f))
          if (fotosValidas.length !== ponto.fotoHaste.length) {
            pontoTemProblema = true
            corrigido.fotoHaste = fotosValidas
          }
        }

        if (ponto.fotoTermometro && Array.isArray(ponto.fotoTermometro)) {
          const fotosValidas = ponto.fotoTermometro.filter((f: any) => isValidPhoto(f))
          if (fotosValidas.length !== ponto.fotoTermometro.length) {
            pontoTemProblema = true
            corrigido.fotoTermometro = fotosValidas
          }
        }

        if (pontoTemProblema) precisaCorrigir = true
        return corrigido
      })

      if (precisaCorrigir && updates.checklist_hastes_termometros_data === undefined) {
        updates.checklist_hastes_termometros_data = hastesCorrigidos
        console.log('  ✅ Hastes/Termômetros corrigidos')
      }
    }

    // Atualizar se necessário
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('obras')
        .update(updates)
        .eq('id', obra.id)

      if (updateError) {
        console.error(`  ❌ Erro ao atualizar:`, updateError)
        obrasComProblema++
      } else {
        console.log(`  ✅ Obra ${obra.obra} corrigida!`)
        obrasCorrigidas++
      }
    } else {
      console.log(`  ℹ️  Obra ${obra.obra} já está correta`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMO FINAL')
  console.log('='.repeat(60))
  console.log(`✅ Obras corrigidas: ${obrasCorrigidas}`)
  console.log(`⚠️  Obras com problema: ${obrasComProblema}`)
  console.log(`ℹ️  Total processadas: ${obras.length}`)
  console.log('='.repeat(60))
  console.log('\n🎉 Processo concluído!\n')
}

corrigirTodasObras()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro fatal:', err)
    process.exit(1)
  })
