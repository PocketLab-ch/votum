#!/usr/bin/env node
// Legt nach `vite build` den Einstieg des gebauten Stands an.
//
// adapter-node schreibt `build/index.js`. Dieses Skript verschiebt ihn nach
// `build/adapter.js` und legt `scripts/server-einstieg.mjs` als neuen
// `build/index.js` ab. `node build` bleibt damit der Startbefehl, und der
// Server von adapter-node (Port, Socket-Aktivierung, geordnetes Beenden)
// bleibt unverändert. Die Begründung steht in der Vorlage.
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const EINSTIEG = 'build/index.js';
const ADAPTER = 'build/adapter.js';
const VORLAGE = 'scripts/server-einstieg.mjs';

if (!existsSync(EINSTIEG)) {
	console.error(`${EINSTIEG} fehlt: zuerst \`npm run build\` im Ganzen laufen lassen.`);
	process.exit(1);
}
if (!existsSync(VORLAGE)) {
	console.error(`${VORLAGE} fehlt: der Bau ist unvollständig.`);
	process.exit(1);
}

// Ein zweiter Lauf ohne Neubau darf den Adapter nicht überschreiben: Sonst
// importiert `build/adapter.js` sich selbst, und `node build` bricht mit einer
// Meldung ab, die den Grund nicht nennt.
const vorhanden = await readFile(EINSTIEG, 'utf8');
if (vorhanden.includes('./adapter.js')) {
	if (!existsSync(ADAPTER)) {
		console.error(
			`${EINSTIEG} ist der Aufsatz, aber ${ADAPTER} fehlt: ein voller \`npm run build\` ist nötig.`
		);
		process.exit(1);
	}
	console.log(`${EINSTIEG} ist bereits der Aufsatz; nichts zu tun.`);
	process.exit(0);
}

await rename(EINSTIEG, ADAPTER);

// Die Sourcemap gehört zum verschobenen Einstieg, nicht zur Vorlage.
if (existsSync(`${EINSTIEG}.map`)) {
	await rename(`${EINSTIEG}.map`, `${ADAPTER}.map`);
	const text = await readFile(ADAPTER, 'utf8');
	const berichtigt = text.replace(
		/\/\/# sourceMappingURL=\S+/,
		'//# sourceMappingURL=adapter.js.map'
	);
	if (berichtigt === text) {
		console.warn(
			`${ADAPTER}: kein sourceMappingURL gefunden; die Karte liegt als ${ADAPTER}.map daneben.`
		);
	}
	await writeFile(ADAPTER, berichtigt);
}

await copyFile(VORLAGE, EINSTIEG);
