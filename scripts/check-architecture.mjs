// Enforces the modular-monolith boundaries of src/app. Run with `npm run lint:arch`.
//
//   core/     application-wide infrastructure; may not import shared/, layout/ or features/
//   shared/   reusable UI and utilities; may import core/, never layout/ or features/
//   layout/   the application frame; may import core/ and shared/, never features/
//   features/ business features; may import core/ and shared/, never layout/ or another feature
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const RULES = {
  core: ['shared', 'layout', 'features'],
  shared: ['layout', 'features'],
  layout: ['features'],
  features: ['layout'],
};

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (path.endsWith('.ts')) yield path;
  }
}

/** ['features', 'users'] for src/app/features/users/... */
function area(path) {
  return relative(appRoot, path).split(sep);
}

const violations = [];
for (const file of sourceFiles(appRoot)) {
  const [fromArea, fromFeature] = area(file);
  const forbidden = RULES[fromArea];
  if (!forbidden) continue;

  for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
    const specifier = match[1] ?? match[2];
    if (!specifier.startsWith('.')) continue;
    const [toArea, toFeature] = area(resolve(dirname(file), specifier));

    if (forbidden.includes(toArea)) {
      violations.push(`${relative(appRoot, file)}: ${fromArea}/ must not import ${toArea}/ ('${specifier}')`);
    } else if (fromArea === 'features' && toArea === 'features' && fromFeature !== toFeature) {
      violations.push(
        `${relative(appRoot, file)}: feature '${fromFeature}' must not import feature '${toFeature}' ('${specifier}')`,
      );
    }
  }
}

if (violations.length) {
  console.error(`Architecture boundary violations (${violations.length}):\n  ${violations.join('\n  ')}`);
  process.exit(1);
}
console.log('Architecture boundaries OK.');
