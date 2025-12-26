'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, type Obra } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'
import PhotoGallery from '@/components/PhotoGallery'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ObraDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [obra, setObra] = useState<Obra | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      loadObra(params.id as string)
    }
  }, [params.id])

  async function loadObra(id: string) {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setObra(data)
    } catch (error) {
      console.error('Erro ao carregar obra:', error)
      alert('Erro ao carregar obra')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-xl text-gray-600">Carregando obra...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!obra) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-gray-600">Obra não encontrada</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />

        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar ao Dashboard
            </button>

            <h1 className="text-3xl font-bold text-gray-900">{obra.obra}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-full">
                {obra.equipe}
              </span>
              <span className="text-gray-600">
                {format(new Date(obra.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Responsável</div>
              <div className="text-lg font-semibold text-gray-900">{obra.responsavel}</div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Tipo de Serviço</div>
              <div className="text-lg font-semibold text-gray-900">{obra.tipo_servico}</div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Atipicidades</div>
              <div className="text-lg font-semibold text-gray-900">
                {obra.tem_atipicidade ? (
                  <span className="text-orange-600">{obra.atipicidades.length} atipicidade(s)</span>
                ) : (
                  <span className="text-green-600">Nenhuma</span>
                )}
              </div>
            </div>
          </div>

          {/* Atipicidades */}
          {obra.tem_atipicidade && obra.descricao_atipicidade && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8">
              <h3 className="text-lg font-semibold text-orange-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Descrição das Atipicidades
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">{obra.descricao_atipicidade}</p>
            </div>
          )}

          {/* Fotos */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Registro Fotográfico</h2>

            <PhotoGallery photos={obra.fotos_antes || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Fotos Antes" />
            <PhotoGallery photos={obra.fotos_durante || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Fotos Durante" />
            <PhotoGallery photos={obra.fotos_depois || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Fotos Depois" />
            <PhotoGallery photos={obra.fotos_abertura || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Fotos Abertura de Chave" />
            <PhotoGallery photos={obra.fotos_fechamento || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Fotos Fechamento de Chave" />

            {/* DITAIS */}
            {(obra.fotos_ditais_abertura?.length || obra.fotos_ditais_impedir?.length || obra.fotos_ditais_testar?.length || obra.fotos_ditais_aterrar?.length || obra.fotos_ditais_sinalizar?.length) ? (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Método DITAIS</h3>
                <PhotoGallery photos={obra.fotos_ditais_abertura || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="1. Desligar/Abertura" />
                <PhotoGallery photos={obra.fotos_ditais_impedir || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="2. Impedir Religamento" />
                <PhotoGallery photos={obra.fotos_ditais_testar || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="3. Testar Ausência de Tensão" />
                <PhotoGallery photos={obra.fotos_ditais_aterrar || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="4. Aterrar" />
                <PhotoGallery photos={obra.fotos_ditais_sinalizar || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="5. Sinalizar/Isolar" />
              </div>
            ) : null}

            {/* Book de Aterramento */}
            {(obra.fotos_aterramento_vala_aberta?.length || obra.fotos_aterramento_hastes?.length || obra.fotos_aterramento_vala_fechada?.length || obra.fotos_aterramento_medicao?.length) ? (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Book de Aterramento</h3>
                <PhotoGallery photos={obra.fotos_aterramento_vala_aberta || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Vala Aberta" />
                <PhotoGallery photos={obra.fotos_aterramento_hastes || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Hastes Aplicadas" />
                <PhotoGallery photos={obra.fotos_aterramento_vala_fechada || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Vala Fechada" />
                <PhotoGallery photos={obra.fotos_aterramento_medicao || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Medição com Terrômetro" />
              </div>
            ) : null}

            {/* Transformador */}
            {(obra.fotos_transformador_laudo?.length || obra.fotos_transformador_componente_instalado?.length || obra.fotos_transformador_tombamento_instalado?.length || obra.fotos_transformador_tape?.length || obra.fotos_transformador_placa_instalado?.length || obra.fotos_transformador_instalado?.length || obra.fotos_transformador_antes_retirar?.length || obra.fotos_transformador_tombamento_retirado?.length || obra.fotos_transformador_placa_retirado?.length) ? (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Transformador
                  {obra.transformador_status && (
                    <span className="ml-3 text-base text-blue-600">({obra.transformador_status})</span>
                  )}
                </h3>
                <PhotoGallery photos={obra.fotos_transformador_laudo || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Laudo" />
                <PhotoGallery photos={obra.fotos_transformador_componente_instalado || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Componente Instalado" />
                <PhotoGallery photos={obra.fotos_transformador_tombamento_instalado || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Tombamento (Instalado)" />
                <PhotoGallery photos={obra.fotos_transformador_tape || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Tape" />
                <PhotoGallery photos={obra.fotos_transformador_placa_instalado || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Placa (Instalado)" />
                <PhotoGallery photos={obra.fotos_transformador_instalado || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Instalado" />
                <PhotoGallery photos={obra.fotos_transformador_antes_retirar || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Antes de Retirar" />
                <PhotoGallery photos={obra.fotos_transformador_tombamento_retirado || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Tombamento (Retirado)" />
                <PhotoGallery photos={obra.fotos_transformador_placa_retirado || []} obraNumero={obra.obra} tipoServico={obra.tipo_servico} equipe={obra.equipe} title="Placa (Retirado)" />
              </div>
            ) : null}

            {/* Outras seções podem ser adicionadas aqui */}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
