import type { TipoServico } from '../types/servico';

export const normalizeProfileText = (value?: string | null): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const normalizeServiceType = normalizeProfileText;

export const isCompressorProfile = (role?: string | null, equipe?: string | null): boolean => {
  const roleKey = normalizeProfileText(role);
  const equipeKey = normalizeProfileText(equipe);
  return roleKey === 'compressor' || roleKey.includes('compressor') || /^com\b/.test(equipeKey);
};

export const isLinhaVivaProfile = (role?: string | null, equipe?: string | null): boolean => {
  const roleKey = normalizeProfileText(role);
  const equipeKey = normalizeProfileText(equipe);
  return (
    roleKey === 'linha_viva' ||
    roleKey === 'linha-viva' ||
    roleKey === 'linha viva' ||
    roleKey === 'lv' ||
    roleKey.includes('linha viva') ||
    /^lv\b/.test(equipeKey)
  );
};

export const isAdminOrSupervisor = (role?: string | null): boolean => {
  const roleKey = normalizeProfileText(role);
  return roleKey === 'admin' || roleKey.startsWith('sup');
};

export const getAllowedServiceTypesForProfile = (
  role?: string | null,
  equipe?: string | null
): TipoServico[] | undefined => {
  const roleKey = normalizeProfileText(role);
  if (roleKey === 'admin' || roleKey.startsWith('sup')) return undefined;
  if (isCompressorProfile(role, equipe)) return ['Cava em Rocha'];
  if (isLinhaVivaProfile(role, equipe)) return ['Linha Viva'];
  return undefined;
};

export const isServiceTypeAllowedForProfile = (
  tipoServico?: string | null,
  role?: string | null,
  equipe?: string | null
): boolean => {
  const allowed = getAllowedServiceTypesForProfile(role, equipe);
  if (!allowed || allowed.length === 0) return true;
  const tipoKey = normalizeServiceType(tipoServico);
  return allowed.some((tipo) => normalizeServiceType(tipo) === tipoKey);
};

export const isObraVisibleForProfile = (
  obra: { tipo_servico?: string | null; creator_role?: string | null },
  role?: string | null,
  equipe?: string | null
): boolean => {
  const allowed = getAllowedServiceTypesForProfile(role, equipe);
  if (!allowed || allowed.length === 0) return true;

  if (isCompressorProfile(role, equipe) && normalizeProfileText(obra.creator_role).includes('compressor')) {
    return true;
  }

  return isServiceTypeAllowedForProfile(obra.tipo_servico, role, equipe);
};
