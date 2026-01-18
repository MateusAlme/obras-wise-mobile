// NOTA: Usando fallback simples para desenvolvimento
// Em produção com Expo Dev Client, use expo-crypto
// import * as Crypto from 'expo-crypto';

/**
 * Gera hash SHA-256 de uma senha (versão simplificada para desenvolvimento)
 * @param password - Senha em texto puro
 * @returns Hash da senha em formato hexadecimal
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    // Adiciona um salt fixo (em produção, considere salt único por usuário)
    const saltedPassword = `${password}_obras_wise_salt_2025`;

    // FALLBACK: Hash simples para desenvolvimento (substitua por expo-crypto em produção)
    let hash = 0;
    for (let i = 0; i < saltedPassword.length; i++) {
      const char = saltedPassword.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Converter para hexadecimal
    return Math.abs(hash).toString(16).padStart(16, '0');
  } catch (error) {
    console.error('Erro ao gerar hash de senha:', error);
    throw new Error('Falha ao processar senha');
  }
};

/**
 * Verifica se uma senha corresponde ao hash armazenado
 * @param password - Senha em texto puro
 * @param hash - Hash armazenado
 * @returns true se a senha corresponde ao hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    const newHash = await hashPassword(password);
    return newHash === hash;
  } catch (error) {
    console.error('Erro ao verificar senha:', error);
    return false;
  }
};
