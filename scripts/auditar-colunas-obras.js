const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const outputJson = path.join(repoRoot, 'docs', 'auditoria-colunas-obras.json');
const outputMd = path.join(repoRoot, 'docs', 'auditoria-colunas-obras.md');

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.expo', 'android', 'ios', 'build', 'dist']);

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function rel(p) {
  return toPosix(path.relative(repoRoot, p));
}

function listFiles(dir, options = {}) {
  const { extensions = CODE_EXTENSIONS, skip = SKIP_DIRS } = options;
  if (!fs.existsSync(dir)) return [];

  const out = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (skip.has(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.has(ext)) {
        out.push(fullPath);
      }
    }
  }

  return out;
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ');
}

function normalizeIdentifier(raw) {
  if (!raw) return '';
  return raw.replace(/^["`]+|["`]+$/g, '').trim().toLowerCase();
}

function ensureColumn(map, col) {
  if (!map.has(col)) {
    map.set(col, {
      column: col,
      active: false,
      addedIn: new Set(),
      droppedIn: new Set(),
      renamedFrom: new Set(),
    });
  }
  return map.get(col);
}

function markAdd(map, col, file) {
  const rec = ensureColumn(map, col);
  rec.active = true;
  rec.addedIn.add(file);
}

function markDrop(map, col, file) {
  const rec = ensureColumn(map, col);
  rec.active = false;
  rec.droppedIn.add(file);
}

function parseCreateTableColumns(statement, file, map) {
  const lower = statement.toLowerCase();
  if (!/create\s+table/.test(lower)) return;
  if (!/\b(?:public\.)?obras\b/.test(lower)) return;

  const firstParen = statement.indexOf('(');
  const lastParen = statement.lastIndexOf(')');
  if (firstParen === -1 || lastParen <= firstParen) return;

  const body = statement.slice(firstParen + 1, lastParen);
  const lines = body.split(/\r?\n/);

  for (const line of lines) {
    const cleaned = line.trim().replace(/,$/, '');
    if (!cleaned) continue;
    if (/^(constraint|primary\s+key|foreign\s+key|unique|check)\b/i.test(cleaned)) continue;

    const m = cleaned.match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+/);
    if (!m) continue;

    const col = normalizeIdentifier(m[1]);
    if (!col) continue;
    markAdd(map, col, file);
  }
}

function parseAlterTableColumns(statement, file, map) {
  const lower = statement.toLowerCase();
  if (!/alter\s+table/.test(lower)) return;
  if (!/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?obras\b/.test(lower)) return;

  const addRegex = /add\s+column(?:\s+if\s+not\s+exists)?\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let addMatch;
  while ((addMatch = addRegex.exec(statement)) !== null) {
    const col = normalizeIdentifier(addMatch[1]);
    if (col) markAdd(map, col, file);
  }

  const dropRegex = /drop\s+column(?:\s+if\s+exists)?\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let dropMatch;
  while ((dropMatch = dropRegex.exec(statement)) !== null) {
    const col = normalizeIdentifier(dropMatch[1]);
    if (col) markDrop(map, col, file);
  }

  const renameRegex = /rename\s+column\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+to\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let renameMatch;
  while ((renameMatch = renameRegex.exec(statement)) !== null) {
    const oldCol = normalizeIdentifier(renameMatch[1]);
    const newCol = normalizeIdentifier(renameMatch[2]);
    if (!oldCol || !newCol) continue;
    markDrop(map, oldCol, file);
    markAdd(map, newCol, file);
    const newRec = ensureColumn(map, newCol);
    newRec.renamedFrom.add(oldCol);
  }
}

function extractObrasColumnsFromMigrations() {
  const sqlFiles = listFiles(migrationsDir, { extensions: new Set(['.sql']), skip: new Set(['_old']) })
    .sort((a, b) => rel(a).localeCompare(rel(b)));

  const columns = new Map();

  for (const file of sqlFiles) {
    const relativeFile = rel(file);
    const raw = fs.readFileSync(file, 'utf8');
    const sql = stripSqlComments(raw);
    const statements = sql.split(';');

    for (const statementRaw of statements) {
      const statement = statementRaw.trim();
      if (!statement) continue;
      parseCreateTableColumns(statement, relativeFile, columns);
      parseAlterTableColumns(statement, relativeFile, columns);
    }
  }

  return {
    sqlFiles,
    columns,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUsage(activeColumns) {
  const appRoots = [
    path.join(repoRoot, 'mobile', 'app'),
    path.join(repoRoot, 'mobile', 'lib'),
    path.join(repoRoot, 'mobile', 'components'),
    path.join(repoRoot, 'mobile', 'contexts'),
    path.join(repoRoot, 'web', 'src'),
    path.join(repoRoot, 'photo-server'),
    path.join(repoRoot, 'supabase', 'functions'),
  ];

  const maintenanceRoots = [
    path.join(repoRoot, 'mobile', 'utils'),
    path.join(repoRoot, 'scripts'),
    path.join(repoRoot, 'supabase'),
  ];

  const appFiles = appRoots.flatMap((dir) => listFiles(dir));
  const maintenanceFiles = maintenanceRoots.flatMap((dir) => listFiles(dir));

  const ignored = new Set([
    toPosix(path.join('supabase', 'migrations')),
    toPosix(path.join('supabase', 'migrations', '_old')),
    rel(outputJson),
    rel(outputMd),
  ]);

  const shouldIgnore = (filePath) => {
    const p = rel(filePath);
    return (
      p.startsWith('supabase/migrations/') ||
      p.startsWith('supabase/migrations/_old/') ||
      ignored.has(p)
    );
  };

  const uniq = (arr) => Array.from(new Set(arr));

  const appFileList = uniq(appFiles).filter((f) => !shouldIgnore(f));
  const maintenanceFileList = uniq(maintenanceFiles).filter((f) => !shouldIgnore(f));

  const appContent = new Map();
  for (const file of appFileList) {
    appContent.set(file, fs.readFileSync(file, 'utf8'));
  }

  const maintenanceContent = new Map();
  for (const file of maintenanceFileList) {
    maintenanceContent.set(file, fs.readFileSync(file, 'utf8'));
  }

  const usage = [];

  for (const column of activeColumns) {
    const pattern = new RegExp(`\\b${escapeRegex(column)}\\b`, 'g');

    const appHits = [];
    for (const [file, content] of appContent.entries()) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) appHits.push(rel(file));
    }

    const maintenanceHits = [];
    for (const [file, content] of maintenanceContent.entries()) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) maintenanceHits.push(rel(file));
    }

    usage.push({
      column,
      usedInApp: appHits.length > 0,
      appHitCount: appHits.length,
      appSample: appHits.slice(0, 5),
      usedInMaintenance: maintenanceHits.length > 0,
      maintenanceHitCount: maintenanceHits.length,
      maintenanceSample: maintenanceHits.slice(0, 5),
    });
  }

  return usage.sort((a, b) => a.column.localeCompare(b.column));
}

function toMarkdown(audit) {
  const lines = [];

  lines.push('# Auditoria de Colunas da Tabela obras');
  lines.push('');
  lines.push(`Gerado em: ${audit.generatedAt}`);
  lines.push('');
  lines.push('## Resumo');
  lines.push('');
  lines.push(`- Colunas ativas na tabela obras (via migrations): **${audit.summary.totalActiveColumns}**`);
  lines.push(`- Colunas com uso no app (mobile/web/functions): **${audit.summary.usedInApp}**`);
  lines.push(`- Colunas sem uso no app: **${audit.summary.unusedInApp}**`);
  lines.push(`- Colunas sem uso no app nem manutencao/scripts: **${audit.summary.unusedEverywhere}**`);
  lines.push('');

  lines.push('## Colunas sem uso no app (candidatas a revisao)');
  lines.push('');
  lines.push('| Coluna | Uso em manutencao/scripts | Adicionada em |');
  lines.push('|---|---:|---|');

  for (const row of audit.columns.filter((c) => !c.usedInApp)) {
    const added = row.addedIn[0] || '-';
    const aux = row.usedInMaintenance ? `${row.maintenanceHitCount} arquivo(s)` : 'nao';
    lines.push(`| ${row.column} | ${aux} | ${added} |`);
  }

  lines.push('');
  lines.push('## Todas as colunas ativas');
  lines.push('');
  lines.push('| Coluna | App | Manutencao | Exemplo app |');
  lines.push('|---|---:|---:|---|');

  for (const row of audit.columns) {
    const runtime = row.usedInApp ? row.appHitCount : 0;
    const aux = row.usedInMaintenance ? row.maintenanceHitCount : 0;
    const sample = row.appSample[0] || '-';
    lines.push(`| ${row.column} | ${runtime} | ${aux} | ${sample} |`);
  }

  lines.push('');
  lines.push('## Observacoes');
  lines.push('');
  lines.push('- Este levantamento e estatico (busca textual por nome de coluna).');
  lines.push('- Colunas com nomes muito genericos (ex.: status, data, id) podem aparecer por outros motivos no codigo.');
  lines.push('- Antes de remover coluna, valide tambem com dados reais e queries no banco.');

  return lines.join('\n');
}

function main() {
  const { columns } = extractObrasColumnsFromMigrations();

  const active = Array.from(columns.values())
    .filter((c) => c.active)
    .sort((a, b) => a.column.localeCompare(b.column));

  const usage = buildUsage(active.map((c) => c.column));
  const usageMap = new Map(usage.map((u) => [u.column, u]));

  const rows = active.map((col) => {
    const u = usageMap.get(col.column);
    return {
      column: col.column,
      active: col.active,
      addedIn: Array.from(col.addedIn).sort(),
      droppedIn: Array.from(col.droppedIn).sort(),
      renamedFrom: Array.from(col.renamedFrom).sort(),
      usedInApp: u ? u.usedInApp : false,
      appHitCount: u ? u.appHitCount : 0,
      appSample: u ? u.appSample : [],
      usedInMaintenance: u ? u.usedInMaintenance : false,
      maintenanceHitCount: u ? u.maintenanceHitCount : 0,
      maintenanceSample: u ? u.maintenanceSample : [],
    };
  });

  const summary = {
    totalActiveColumns: rows.length,
    usedInApp: rows.filter((r) => r.usedInApp).length,
    unusedInApp: rows.filter((r) => !r.usedInApp).length,
    unusedEverywhere: rows.filter((r) => !r.usedInApp && !r.usedInMaintenance).length,
  };

  const audit = {
    generatedAt: new Date().toISOString(),
    summary,
    columns: rows,
  };

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.mkdirSync(path.dirname(outputMd), { recursive: true });

  fs.writeFileSync(outputJson, JSON.stringify(audit, null, 2), 'utf8');
  fs.writeFileSync(outputMd, toMarkdown(audit), 'utf8');

  console.log(`OK: ${summary.totalActiveColumns} colunas ativas identificadas.`);
  console.log(`OK: relatorio JSON em ${rel(outputJson)}`);
  console.log(`OK: relatorio MD em ${rel(outputMd)}`);
  console.log(`OK: sem uso no app: ${summary.unusedInApp}`);
  console.log(`OK: sem uso total: ${summary.unusedEverywhere}`);
}

main();
