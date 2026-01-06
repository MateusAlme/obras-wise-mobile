// Novos estilos para adicionar em nova-obra.tsx
// Adicionar na seção de StyleSheet.create

  // Container dos botões (modificar o existente ou adicionar)
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },

  // Botão Pausar (AMARELO/LARANJA)
  pauseButton: {
    flex: 1,
    backgroundColor: '#f59e0b', // Laranja/Amarelo
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pauseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Botão Finalizar (VERDE)
  finalizarButton: {
    flex: 2,
    backgroundColor: '#10b981', // Verde
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  // Manter botão cancel existente (CINZA)
  // cancelButton: { ... } // Já existe

  // Botão desabilitado (já existe, mas garantir que está presente)
  buttonDisabled: {
    opacity: 0.5,
  },
