import { SERVICO_PHOTO_MAP, type Servico } from '../types/servico';

type CategoryDef = { field: keyof Servico; label: string };
type RequiredRule = CategoryDef & { minCount: number };

export type ServicoValidationResult = {
  configErrors: string[];
  missingRules: Array<RequiredRule & { currentCount: number; missingCount: number }>;
};

const TRANSFORMADOR_INSTALADO_FIELDS: Array<keyof Servico> = [
  'fotos_transformador_laudo',
  'fotos_transformador_componente_instalado',
  'fotos_transformador_tombamento_instalado',
  'fotos_transformador_tape',
  'fotos_transformador_placa_instalado',
  'fotos_transformador_instalado',
  'fotos_transformador_conexoes_primarias_instalado',
  'fotos_transformador_conexoes_secundarias_instalado',
];

const TRANSFORMADOR_RETIRADO_FIELDS: Array<keyof Servico> = [
  'fotos_transformador_antes_retirar',
  'fotos_transformador_laudo_retirado',
  'fotos_transformador_tombamento_retirado',
  'fotos_transformador_placa_retirado',
  'fotos_transformador_conexoes_primarias_retirado',
  'fotos_transformador_conexoes_secundarias_retirado',
];

const getCount = (servico: Servico, field: keyof Servico): number => {
  const value = (servico as any)[field];
  if (!Array.isArray(value)) return 0;
  return value.filter((p: any) => {
    if (!p) return false;
    if (typeof p === 'string') return p.length > 0;
    return p.uri || p.url || p.id;
  }).length;
};

const getTransformadorModo = (servico: Servico): 'instalado' | 'retirado' | 'ambos' | null => {
  const raw = String(
    (servico as any)?.dados_adicionais?.transformador_modo ||
    (servico as any)?.transformador_status ||
    ''
  ).toLowerCase().trim();

  if (raw === 'instalado' || raw === 'retirado' || raw === 'ambos') return raw;
  return null;
};

export const getVisiblePhotoCategories = (servico: Servico): CategoryDef[] => {
  const base = [...(SERVICO_PHOTO_MAP[servico.tipo_servico] || [])];
  if (servico.tipo_servico !== 'Transformador') return base;

  const modo = getTransformadorModo(servico);
  if (!modo) return base;

  const allow = new Set<keyof Servico>();
  if (modo === 'instalado' || modo === 'ambos') {
    TRANSFORMADOR_INSTALADO_FIELDS.forEach((f) => allow.add(f));
  }
  if (modo === 'retirado' || modo === 'ambos') {
    TRANSFORMADOR_RETIRADO_FIELDS.forEach((f) => allow.add(f));
  }

  return base.filter((cat) => allow.has(cat.field));
};

const toFallbackLabel = (field: keyof Servico): string => {
  return String(field)
    .replace(/^fotos_/, '')
    .replace(/^transformador_/, '')
    .replace(/_/g, ' ');
};

const getRequiredRules = (servico: Servico): { configErrors: string[]; rules: RequiredRule[] } => {
  const categories = getVisiblePhotoCategories(servico);

  if (servico.tipo_servico !== 'Transformador') {
    return {
      configErrors: [],
      rules: categories.map((cat) => ({ ...cat, minCount: 1 })),
    };
  }

  const modo = getTransformadorModo(servico);
  const configErrors: string[] = [];
  if (!modo) {
    configErrors.push('Defina o modo do transformador (Instalado ou Retirado) em Detalhes.');
    return { configErrors, rules: [] };
  }

  const labelByField = new Map<keyof Servico, string>(
    (SERVICO_PHOTO_MAP.Transformador || []).map((cat) => [cat.field, cat.label])
  );

  const rules: RequiredRule[] = [];
  const addRule = (field: keyof Servico, minCount = 1) => {
    rules.push({
      field,
      label: labelByField.get(field) || toFallbackLabel(field),
      minCount,
    });
  };

  if (modo === 'instalado' || modo === 'ambos') {
    TRANSFORMADOR_INSTALADO_FIELDS.forEach((field) => addRule(field, 1));
  }

  if (modo === 'retirado' || modo === 'ambos') {
    TRANSFORMADOR_RETIRADO_FIELDS.forEach((field) => addRule(field, 1));
  }

  return { configErrors, rules };
};

export const validateServicoCompletion = (servico: Servico): ServicoValidationResult => {
  const { configErrors, rules } = getRequiredRules(servico);

  const missingRules = rules
    .map((rule) => {
      const currentCount = getCount(servico, rule.field);
      const missingCount = Math.max(0, rule.minCount - currentCount);
      return { ...rule, currentCount, missingCount };
    })
    .filter((rule) => rule.missingCount > 0);

  return { configErrors, missingRules };
};
