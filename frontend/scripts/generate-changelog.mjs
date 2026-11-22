#!/usr/bin/env node
/**
 * Genera los datos tipados del changelog a partir de ../changelog.md.
 *
 * El markdown de la raíz es la fuente única. Este script se ejecuta antes de
 * `build`, `build:static`, `start` y `test`, y escribe un fichero TypeScript que
 * el componente de Angular importa en tiempo de compilación.
 *
 * Uso:
 *   node scripts/generate-changelog.mjs          # regenera el fichero
 *   node scripts/generate-changelog.mjs --check  # falla si está desactualizado
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const markdownPath = resolve(scriptDir, '..', '..', 'changelog.md');
const outputPath = resolve(
  scriptDir,
  '..',
  'src',
  'app',
  'components',
  'changelog',
  'changelog.generated.ts'
);
const checkOnly = process.argv.includes('--check');

function fail(message) {
  console.error(`[changelog] ${message}`);
  process.exit(1);
}

/** Convierte el formato en línea de Markdown en partes que Angular puede pintar. */
function parseInline(text) {
  const parts = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      parts.push({ text: match[2], bold: true });
    } else if (match[3] !== undefined) {
      parts.push({ text: match[3], code: true });
    } else {
      parts.push({ text: match[4], href: match[5] });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ text: '' }];
}

function parseMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const releases = [];
  let release = null;
  let section = null;
  let lastItem = null;
  let summaryParts = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed || trimmed === '---') continue;

    const releaseMatch = /^##\s+\[([^\]]+)\]\s+-\s+(.+)$/.exec(trimmed);
    if (releaseMatch) {
      release = {
        version: releaseMatch[1].trim(),
        date: releaseMatch[2].trim(),
        summary: '',
        sections: [],
      };
      releases.push(release);
      section = null;
      lastItem = null;
      summaryParts = [];
      continue;
    }

    if (/^#\s/.test(trimmed)) continue;

    if (!release) continue;

    const sectionMatch = /^###\s+(.+)$/.exec(trimmed);
    if (sectionMatch) {
      section = { title: sectionMatch[1].trim(), items: [] };
      release.sections.push(section);
      lastItem = null;
      continue;
    }

    if (trimmed.startsWith('>')) {
      summaryParts.push(trimmed.replace(/^>\s?/, ''));
      release.summary = summaryParts.join(' ');
      continue;
    }

    if (trimmed.startsWith('- ')) {
      if (!section) {
        fail(`Hay un elemento fuera de una sección en la versión ${release.version}.`);
      }
      const item = trimmed.slice(2).trim();
      if (!item) {
        fail(`Elemento vacío en la versión ${release.version}.`);
      }
      section.items.push(item);
      lastItem = item;
      continue;
    }

    // Las líneas indentadas continúan el último elemento.
    if (/^\s{2,}/.test(line) && lastItem && section) {
      section.items[section.items.length - 1] = `${lastItem} ${trimmed}`;
      lastItem = section.items[section.items.length - 1];
    }
  }

  if (releases.length === 0) {
    fail('No se encontró ninguna versión con el formato "## [1.2.3] - fecha".');
  }

  const versions = new Set();
  for (const entry of releases) {
    if (versions.has(entry.version)) {
      fail(`La versión ${entry.version} está repetida.`);
    }
    versions.add(entry.version);

    if (!entry.date) {
      fail(`La versión ${entry.version} no tiene fecha.`);
    }
    if (entry.sections.length === 0) {
      fail(`La versión ${entry.version} no tiene secciones "###".`);
    }
    for (const block of entry.sections) {
      if (block.items.length === 0) {
        fail(`La sección "${block.title}" de ${entry.version} no tiene elementos.`);
      }
    }
  }

  return releases.map((entry) => ({
    version: entry.version,
    date: entry.date,
    ...(entry.summary ? { summary: parseInline(entry.summary) } : {}),
    sections: entry.sections.map((block) => ({
      title: block.title,
      items: block.items.map(parseInline),
    })),
  }));
}

if (!existsSync(markdownPath)) {
  if (existsSync(outputPath)) {
    console.warn(
      '[changelog] No se encontró ../../changelog.md; se reutiliza el fichero generado.'
    );
    process.exit(0);
  }
  fail(`No se encontró ${markdownPath} y tampoco existe ${outputPath}.`);
}

const markdown = readFileSync(markdownPath, 'utf8');
const releases = parseMarkdown(markdown);

const output = `// Fichero generado automáticamente por frontend/scripts/generate-changelog.mjs.
// No lo edites a mano: cambia ../changelog.md y ejecuta \`npm run changelog:sync\`.
import type { ChangelogRelease } from './changelog.model';

export const CHANGELOG_RELEASES: readonly ChangelogRelease[] = ${JSON.stringify(
  releases,
  null,
  2
)};
`;

if (checkOnly) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (current !== output) {
    fail('El changelog generado está desactualizado. Ejecuta `npm run changelog:sync`.');
  }
  console.log('[changelog] Los datos generados están al día.');
  process.exit(0);
}

mkdirSync(dirname(outputPath), { recursive: true });
if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== output) {
  writeFileSync(outputPath, output, 'utf8');
  console.log(`[changelog] Generado ${outputPath}`);
} else {
  console.log('[changelog] Sin cambios.');
}
