// Novas funções para adicionar em nova-obra.tsx
// Adicionar após a função prosseguirSalvamento e antes do return

  // ✅ NOVA FUNÇÃO: Calcular se pode finalizar obra
  const calcularPodeFinalizar = (): boolean => {
    // ✅ CRÍTICO: Deve estar online para finalizar
    if (!isOnline) {
      return false;
    }

    // 1. Validar campos básicos
    if (!data || !obra || !responsavel || !tipoServico) {
      return false;
    }

    // 2. Validar fotos de transformador (se aplicável)
    if (isServicoTransformador && transformadorStatus) {
      if (transformadorStatus === 'Instalado') {
        if (fotosTransformadorConexoesPrimariasInstalado.length < 2) return false;
        if (fotosTransformadorConexoesSecundariasInstalado.length < 2) return false;
      }
      if (transformadorStatus === 'Retirado') {
        if (fotosTransformadorConexoesPrimariasRetirado.length < 2) return false;
        if (fotosTransformadorConexoesSecundariasRetirado.length < 2) return false;
      }
    }

    // 3. Validar fotos de checklist (se aplicável)
    if (isServicoChecklist && numPostes > 0) {
      for (const poste of fotosPostes) {
        if (poste.status === 'instalado') {
          if (poste.posteInteiro.length < 1) return false;
          if (poste.engaste.length < 1) return false;
          if (poste.conexao1.length < 1) return false;
          if (poste.conexao2.length < 1) return false;
          if (poste.maiorEsforco.length < 2) return false;
          if (poste.menorEsforco.length < 2) return false;
        } else if (poste.status === 'retirado') {
          if (poste.posteInteiro.length < 2) return false;
        }
      }
    }

    return true; // Todas as validações passaram
  };

  // ✅ NOVA FUNÇÃO: Pausar obra (salvar rascunho)
  const handlePausar = async () => {
    setLoading(true);
    try {
      console.log('💾 Pausando obra como rascunho...');

      // Importar função de salvar local
      const { saveObraLocal } = await import('../lib/offline-sync');

      // Montar dados da obra (ZERO validações - aceita qualquer estado)
      const obraData = {
        obra: obra?.trim() || '',
        data: data || '',
        responsavel: responsavel || '',
        equipe: isCompUser ? (equipeExecutora || '') : (equipe || ''),
        tipo_servico: tipoServico || '',
        status: 'rascunho' as const,
        origem: 'offline' as const,
        observacoes: observacoes || '',
        transformador_status: transformadorStatus,
        num_postes: numPostes,
        num_seccionamentos: numSeccionamentos,
        num_aterramento_cerca: numAterramentoCerca,
        // Fotos (salvar IDs)
        fotos_antes: fotosAntes.map(f => ({ photoId: f.photoId, uri: f.uri })),
        fotos_durante: fotosDurante.map(f => ({ photoId: f.photoId, uri: f.uri })),
        fotos_depois: fotosDepois.map(f => ({ photoId: f.photoId, uri: f.uri })),
        // ... adicionar todas as outras fotos conforme necessário
      };

      const obraId = await saveObraLocal(obraData);

      console.log(`✅ Obra pausada com ID: ${obraId}`);

      Alert.alert(
        '💾 Obra Pausada',
        'Obra salva como rascunho.\n\nVocê pode continuar editando depois na lista de obras.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Erro ao pausar obra:', error);
      Alert.alert('Erro', 'Não foi possível pausar a obra. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ RENOMEAR: handleSalvarObra → handleFinalizarObra
  // (A função handleSalvarObra existente deve ser renomeada para handleFinalizarObra)
