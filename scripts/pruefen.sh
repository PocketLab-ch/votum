#!/usr/bin/env bash
#
# Der Prüflauf (`npm run pruefen`) in einem Einmalcontainer aus DIESEM Baum.
# Aufrufer: scripts/git-hooks/pre-commit und die Hand. Arbeitsbaum-Vertrag,
# 14.10.2026.
#
# **Warum nicht mehr `docker compose exec app npm run pruefen`:** Der
# Dev-Container hat das Hauptverzeichnis eingehängt (`.:/app`). Aus einem
# Worktree gestartet, prüfte der Hook damit still das Hauptverzeichnis, je nach
# Verzeichnisname oder `COMPOSE_PROJECT_NAME` (gemessen 30.09. und 14.10.2026).
# Jetzt hängt ein eigener Container genau den Baum ein, in dem dieses Skript
# liegt.
#
# Was der Container bekommt:
#   - den Baum unter /app, samt seinen node_modules (für Alpine gebaut; im
#     Worktree legt sie scripts/arbeitsbaum-einrichten.sh an),
#   - das Netz `versammlung_default` des Dev-Stapels: Die Datenbanktests legen
#     dort auf dem Dev-Postgres ihre eigene Prüfdatenbank an und werfen sie
#     wieder weg (tests/db/aufbau.ts), unter einem Namen je Lauf,
#   - aus der Umgebung des Dev-Containers `versammlung-app-1` nur, was die
#     Tests brauchen: die beiden Datenbank-URLs, APP_DB_PASSWORD, ORIGIN und
#     die nicht geheimen VERSAMMLUNG_*-Einstellungen. Kein Authentik-,
#     SMTP-, KI- oder Immotool-Zugang: Kein Test liest sie (die Tests setzen
#     SMTP, KI und Geheimnis selbst), und im Container läuft auch Code aus
#     Worktrees und Abgaben. Über eine Datei mit Modus 600, nie über die
#     Kommandozeile.
#   - `/daten` als tmpfs: Die Tests schreiben Dateien (Siegel, Abgaben), und
#     zwar bisher in das Volume `versammlung_dateien` des Dev-Stapels.
#   - eine leere `.env` über der des Baums, falls es eine gibt: SvelteKit
#     liest sie in vitest mit ein. Im Hauptverzeichnis trüge sie alle
#     Geheimnisse herein, im Worktree gibt es keine; so sehen beide dieselbe
#     Umgebung.
#
# **Ein voller Lauf zur Zeit auf diesem Rechner** (Sperre /tmp/versammlung-
# pruefen.lock). Gemessen bei der Abnahme am 14.10.2026: Zwei gleichzeitige
# Läufe trieben die Last auf 9,5 bei 8 Kernen, und in beiden überschritt je ein
# Kerntest seine 5 Sekunden (einberufungsfrist, fokusmarke), rot ohne Befund.
# Dazu setzt jeder Lauf beim Migrieren das Passwort der clusterweiten Rolle
# versammlung_app (src/lib/server/migrate.ts); zwei gleichzeitige können daran
# zusammenstossen. Der zweite Lauf wartet höchstens 15 Minuten und sagt das,
# auch am Terminal, wenn es eines gibt (der Hook schreibt die Ausgabe sonst in
# eine Datei). Zusätzlich wartet er auf einen noch laufenden Container
# `versammlung-pruef-*`: Wird ein Lauf auf dem Wirt hart beendet (kill -9),
# ist die Sperre frei, der Container aber läuft weiter. Wer bewusst parallel
# fahren will, setzt VERSAMMLUNG_PRUEFSPERRE auf eine eigene Datei.
# **Die Gitea-CI sieht die Sperre nicht** (seit 14.10.2026 fährt sie den vollen
# Lauf auf dem act_runner dieses Rechners). Zwei Läufe können also doch
# zusammenfallen; Näheres in docs/agents/entwicklung.md, «Gitea-CI».
#
# `--init`: Ohne ihn ist `sh` PID 1 im Container und überhört SIGTERM und
# SIGINT. Ein abgebrochener Hook liesse den Lauf im Container weiterdrehen,
# samt Prüfdatenbank (derselbe Vorfall steht in
# tests/waechter/kollisionshinweis.test.ts, damals mit `compose exec`).
#
# Was nur Dev kann und deshalb nach der Übernahme im Hauptverzeichnis läuft,
# steht im AGENTS.md, Abschnitt «Arbeiten im Worktree».
set -euo pipefail
WURZEL="$(cd -P "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
DEV_APP="${VERSAMMLUNG_DEV_APP:-versammlung-app-1}"
NETZ="${VERSAMMLUNG_DEV_NETZ:-versammlung_default}"
SPERRE="${VERSAMMLUNG_PRUEFSPERRE:-/tmp/versammlung-pruefen.lock}"

# Kein Einrichten von hier aus: Im Hauptverzeichnis teilt sich der laufende
# Dev-Container die node_modules (siehe docs/agents/entwicklung.md, «Pakete ändern»).
if ! "$WURZEL/scripts/arbeitsbaum-einrichten.sh" --nur-pruefen; then
	echo "pruefen.sh: $WURZEL/node_modules fehlt, ist unvollständig, nicht für Alpine gebaut oder passt nicht zur package-lock.json. Im Worktree: scripts/arbeitsbaum-einrichten.sh" >&2
	exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -qx "$DEV_APP"; then
	cat >&2 <<MELDUNG
  Der Prüflauf braucht den laufenden Dev-Stapel ($DEV_APP und seine Datenbank):
  Von dort kommen die Zugänge, und auf seinem Postgres entsteht die Prüfdatenbank.
      docker compose -p versammlung up -d      (im Hauptverzeichnis)
MELDUNG
	exit 1
fi

UMGEBUNG="$(mktemp)"   # mktemp legt die Datei mit Modus 600 an
trap 'rm -f "$UMGEBUNG"' EXIT
docker exec "$DEV_APP" printenv \
	| grep -E '^(DATABASE_URL|DATABASE_MIGRATION_URL|APP_DB_PASSWORD|ORIGIN|VERSAMMLUNG_[A-Z0-9_]+)=' \
	| grep -vE '^VERSAMMLUNG_[A-Z0-9_]*(SCHLUESSEL|KENNWORT|TOKEN|GEHEIMNIS|SECRET)[A-Z0-9_]*=' \
	> "$UMGEBUNG" || true
if ! grep -q '^DATABASE_MIGRATION_URL=' "$UMGEBUNG"; then
	echo "pruefen.sh: aus $DEV_APP keine DATABASE_MIGRATION_URL gelesen; ohne sie keine Prüfdatenbank." >&2
	exit 1
fi
# Ein Name je Lauf. `$$` ist die Prozesskennung auf dem Wirt und damit unter
# gleichzeitigen Läufen schon eindeutig; der Zufall schützt den seltenen Fall
# einer wiederkehrenden Kennung. package.json:test:db lässt einen gesetzten
# Namen stehen.
LAUF="$$_${RANDOM}"
{
	echo "VERSAMMLUNG_PRUEFDB=versammlung_pruefung_${LAUF}"
	echo "VERSAMMLUNG_DATEIEN=/daten/dateien"
} >> "$UMGEBUNG"

melden() {
	echo "pruefen.sh: $*" >&2
	{ echo "pruefen.sh: $*" > /dev/tty; } 2>/dev/null || true
}
exec 9>"$SPERRE"
if ! flock -n 9; then
	melden "Ein anderer versammlung-Prüflauf läuft gerade auf diesem Rechner; warte auf ihn (höchstens 15 Minuten) ..."
	if ! flock -w 900 9; then
		melden "nach 15 Minuten noch belegt. Läuft ein Prüflauf fest? docker ps --filter name=versammlung-pruef-"
		exit 1
	fi
fi
frist=$((SECONDS + 900))
while [ -n "$(docker ps -q --filter name=^versammlung-pruef-)" ]; do
	if [ "$SECONDS" -ge "$frist" ]; then
		melden "Ein Container versammlung-pruef-* läuft seit über 15 Minuten ohne Sperre weiter; nachsehen."
		exit 1
	fi
	melden "Ein Container versammlung-pruef-* läuft noch (Lauf auf dem Wirt beendet?); warte ..."
	sleep 15
done

LEERE_ENV=()
if [ -e "$WURZEL/.env" ]; then
	LEERE_ENV=(-v /dev/null:/app/.env:ro)
fi

docker run --rm --init --name "versammlung-pruef-${LAUF//_/-}" \
	--network "$NETZ" --env-file "$UMGEBUNG" \
	-v "$WURZEL:/app" "${LEERE_ENV[@]}" -w /app --tmpfs /daten \
	--entrypoint sh node:24-alpine \
	-c 'mkdir -p /daten/dateien && npx svelte-kit sync >/dev/null && npm run pruefen'
