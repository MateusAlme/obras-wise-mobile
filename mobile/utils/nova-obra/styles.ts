import { StyleSheet } from 'react-native';

export const novaObraStyles = StyleSheet.create({
  // Container dos botões (modificar o existente ou adicionar)
  buttonContainer: {
    flexDirection: 'row',
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
    marginRight: 12, // Espaçamento entre botões
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
    marginRight: 12, // Espaçamento entre botões
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  // Botão desabilitado (já existe, mas garantir que está presente)
  buttonDisabled: {
    opacity: 0.5,
  },
});
