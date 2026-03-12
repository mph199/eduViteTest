/**
 * Module Loader – Liest ENABLED_MODULES aus der Umgebung und
 * lädt die entsprechenden Modul-Pakete aus ./modules/<id>/index.js.
 *
 * Wenn ENABLED_MODULES nicht gesetzt ist, werden ALLE vorhandenen
 * Module geladen (Abwärtskompatibilität / Einfachheit für
 * Einzelinstallationen).
 */

import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './config/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = logger.child({ component: 'modules' });

/**
 * Ermittelt die ID-Liste der zu ladenden Module.
 * @returns {string[]}
 */
function getEnabledModuleIds() {
  const env = process.env.ENABLED_MODULES;
  if (env) {
    return env
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Fallback: alle Ordner unter backend/modules/ mit einer index.js
  const modulesDir = join(__dirname, 'modules');
  if (!existsSync(modulesDir)) return [];

  return readdirSync(modulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(modulesDir, d.name, 'index.js')))
    .map((d) => d.name);
}

/**
 * Lädt und registriert alle aktivierten Module.
 *
 * @param {import('express').Express} app  – Express-App-Instanz
 * @param {object} ctx                     – Geteilter Kernel-Kontext
 * @param {object} ctx.rateLimiters        – Rate-Limiter-Middlewares
 * @returns {Promise<string[]>}            – IDs der erfolgreich geladenen Module
 */
export async function loadModules(app, ctx) {
  const ids = getEnabledModuleIds();
  const loaded = [];

  for (const id of ids) {
    const modPath = join(__dirname, 'modules', id, 'index.js');
    if (!existsSync(modPath)) {
      log.warn(`Module "${id}" nicht gefunden – übersprungen`);
      continue;
    }

    try {
      const mod = (await import(`./modules/${id}/index.js`)).default;
      mod.register(app, ctx);
      loaded.push(id);
      log.info(`Modul geladen: ${mod.name || id}`);
    } catch (err) {
      log.error({ err }, `Fehler beim Laden von Modul "${id}"`);
    }
  }

  return loaded;
}
