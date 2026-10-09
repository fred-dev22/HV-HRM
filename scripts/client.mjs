#!/usr/bin/env node
// Raccourci cote frontend : applique ou retire la marque d'un client en appelant
// le script du backend (scripts/apply-brand.mjs), qui copie le profil vers son dossier brand/.
//
//   npm run client:hv        applique le profil HV (deploy/hv/brand du backend)
//   npm run client:reset     retour a l'application generique
//   node scripts/client.mjs <profil.json>   autre profil (dossier ou client.json, relatif au backend)
//
// Dossier du backend : ../hv-hrm-backend, ou la variable BACKEND_DIR.
// Ensuite : recharger la page (Ctrl+Maj+R). Aucun redemarrage : le backend relit brand/client.json.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(process.env.BACKEND_DIR ?? resolve(here, '../../hv-hrm-backend'));
const script = resolve(backend, 'scripts/apply-brand.mjs');
if (!existsSync(script)) {
  console.error(`\nERREUR : script introuvable (${script}).\nDefinir BACKEND_DIR avec le dossier du backend.\n`);
  process.exit(1);
}

const arg = process.argv[2];
let args;
if (!arg || arg === 'hv') args = ['--preset', 'deploy/hv/brand'];
else if (arg === 'reset') args = ['--reset'];
else args = ['--preset', arg];

const result = spawnSync(process.execPath, [script, ...args], { cwd: backend, stdio: 'inherit' });
process.exit(result.status ?? 1);
