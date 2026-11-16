#!/usr/bin/env bash
#
# Richtet einen Arbeitsbaum dieses Repos für den Prüflauf ein, idempotent.
# Aufrufer: `arbeitsbaum neu versammlung <thema>` (nach dem Anlegen eines
# Worktrees) und die Hand. Arbeitsbaum-Vertrag, 14.10.2026.
#
# Einziger Schritt: node_modules für Alpine, gebaut in einem Container mit
# demselben Abbild wie der Dev-Stapel (node:24-alpine). Auf dem Wirt gebaute
# Module passen nicht: Dort fehlt etwa das Rollup-Binding für musl, und
# umgekehrt (gemessen 30.09.2026).
#
# Neu eingerichtet wird, wenn node_modules fehlt, halb ist (npm schreibt
# node_modules/.package-lock.json erst am Ende), nicht für Alpine gebaut ist
# (das musl-Binding von Rollup fehlt) oder nicht mehr zur package-lock.json
# passt. Im Hauptverzeichnis tut das Skript deshalb in der Regel nichts.
#
# `--nur-pruefen`: nur Exit 0 oder 1, nichts einrichten (Aufrufer
# scripts/pruefen.sh, der im Hauptverzeichnis nicht installieren darf).
#
# Eine .env braucht der Prüflauf nicht: scripts/pruefen.sh holt die Zugänge
# aus dem laufenden Dev-Container.
set -euo pipefail
WURZEL="$(cd -P "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"

passt() {
	[ -f "$WURZEL/node_modules/.package-lock.json" ] || return 1
	[ -d "$WURZEL/node_modules/@rollup/rollup-linux-x64-musl" ] || return 1
	node -e '
		const fs = require("fs");
		const soll = JSON.parse(fs.readFileSync(process.argv[1])).packages;
		const ist = JSON.parse(fs.readFileSync(process.argv[2])).packages;
		for (const [pfad, p] of Object.entries(soll)) {
			if (pfad && !p.optional && (!ist[pfad] || ist[pfad].version !== p.version)) process.exit(1);
		}' "$WURZEL/package-lock.json" "$WURZEL/node_modules/.package-lock.json" 2>/dev/null
}

if [ "${1:-}" = "--nur-pruefen" ]; then
	passt
	exit
fi

if ! passt; then
	echo "  node_modules einrichten (npm ci in node:24-alpine)"
	docker run --rm --init -v "$WURZEL:/app" -w /app --entrypoint sh node:24-alpine \
		-c 'npm ci --no-audit --no-fund --loglevel=error && npx svelte-kit sync >/dev/null'
fi
