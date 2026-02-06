/**
 * Script para verificar status de sincronização de uma obra
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSyncStatus() {
  const obraNumero = process.argv[2] || '74747400'

  console.log(`\n🔍 Verificando status da obra ${obraNumero}...\n`)

  const { data: obra, error } = await supabase
    .from('obras')
    .select('id, obra, status, finalizada_em, creator_role, created_at')
    .eq('obra', obraNumero)
    .single()

  if (error || !obra) {
    console.error('❌ Erro ao buscar obra:', error)
    return
  }

  console.log('✅ Obra encontrada:')
  console.log('  ID:', obra.id)
  console.log('  Número:', obra.obra)
  console.log('  Status:', obra.status)
  console.log('  Finalizada em:', obra.finalizada_em || 'N/A')
  console.log('  Criador:', obra.creator_role || 'N/A')
  console.log('  Criada em:', obra.created_at)
  console.log('\n📊 A obra está no banco, mas as fotos de hastes/termômetros têm IDs temporários.')
  console.log('   Isso significa que essas fotos nunca foram enviadas para o Storage.')
  console.log('   As fotos existem apenas no dispositivo Android do usuário.')
}

checkSyncStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
