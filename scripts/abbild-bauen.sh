#!/usr/bin/env bash
#
# Baut das Betriebsabbild und schreibt den Tag in jede Env-Datei, die es gibt
# (.env fuer Dev, .env.betrieb fuer den Betriebsstapel).
#
# **Warum ein Skript und nicht ein docker-build von Hand.** Zwei Dinge gehen
# dabei regelmässig schief, und beide fallen erst im Saal auf:
#
#   1. **Der Tag.** Wer `latest` baut, weiss nach einem Neustart nicht mehr,
#      welche Fassung lief — und ein Rückschritt auf die vorige ist nicht
#      möglich, weil es sie unter dem Namen nicht mehr gibt. Der Tag hier ist
#      Datum plus Uhrzeit plus Kurzfassung des Commits.
#   2. **Der Bau aus dem falschen Verzeichnis.** Aufgerufen aus einem anderen
#      Ordner, baut Docker den dortigen Inhalt. Das Skript wechselt deshalb
#      selbst in die Wurzel des Repositorys.
#
# Der Schichtenwächter läuft im Bau mit (`npm run build`): Bindet der Kern
# etwas aus einer äusseren Schicht ein, bricht der Bau ab, statt ein Abbild zu
# erzeugen, dessen Rechtslogik sich nicht mehr ohne Datenbank prüfen lässt.
#
# Aufruf:
#
#   scripts/abbild-bauen.sh              # baut mit Schichtenzwischenspeicher
#   scripts/abbild-bauen.sh --neu        # baut ohne, wenn etwas nicht stimmt
#
set -euo pipefail

wurzel="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$wurzel"

ohne_cache=''
if [[ "${1:-}" == '--neu' ]]; then
	ohne_cache='--no-cache'
fi

# Der Commit gehört in den Tag: «vom 4. August» sagt bei zwei Bauläufen am
# selben Tag nichts, und im Zweifel muss sich die laufende Fassung einem Stand
# des Repositorys zuordnen lassen.
commit="$(git rev-parse --short HEAD 2>/dev/null || echo 'ohne-git')"
schmutzig=''
# **Auch unversionierte Dateien zählen** (Codeprüfung 16.11.2026, Entscheid 0053):
# `COPY . .` nimmt sie ins Abbild, `git diff` sähe sie nicht, und ein Tag ohne
# «-lokal» soll belegen, dass der Code dem Commit gleicht. Ignorierte Dateien
# (node_modules, build) nennt `git status` ohne `--ignored` nicht.
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
	schmutzig='-lokal'
	echo "Achtung: Das Arbeitsverzeichnis weicht vom Commit ab; der Tag wird als '$commit$schmutzig' gekennzeichnet." >&2
fi

tag="$(date +%Y%m%d-%H%M)-${commit}${schmutzig}"

echo "Baue versammlung:${tag}"
# Die Version der Anwendung ist dieser Tag (Entscheid 0053): Fusszeile und
# Abschlusspaket lesen ihn aus `VOTUM_VERSION`.
docker build ${ohne_cache} --build-arg "VOTUM_VERSION=${tag}" -t "versammlung:${tag}" .

# **Was zur Laufzeit gelesen wird, muss im Abbild liegen** (15.10.2026, M6).
# Die Schriften der PDFs fehlten in jedem Betriebsabbild bis dahin, und
# Versiegeln endete mit 500. Geprüft wird vor dem Setzen des Tags, damit ein
# solches Abbild gar nicht erst in eine Env-Datei kommt.
#
# `-r` zusätzlich zu `-s`: Die Probe läuft als der Benutzer der Anwendung, und
# eine Datei, die da ist, aber ihm nicht lesbar, endet mit derselben 500.
shopt -s nullglob
schriften=(src/lib/server/pdf/schriften/*.ttf)
shopt -u nullglob
if [[ ${#schriften[@]} -eq 0 ]]; then
	echo "Abbruch: Im Repo liegen keine Schriften unter src/lib/server/pdf/schriften." >&2
	exit 1
fi
fehlend=''
for schrift in "${schriften[@]}"; do
	name="$(basename "$schrift")"
	if ! docker run --rm --entrypoint sh "versammlung:${tag}" \
		-c 'test -s "$1" && test -r "$1"' sh "/app/schriften/${name}"; then
		fehlend+=" ${name}"
	fi
done
if [[ -n "$fehlend" ]]; then
	echo "Abbruch: Im Abbild versammlung:${tag} fehlen unter /app/schriften oder sind nicht lesbar:${fehlend}" >&2
	echo "Ohne sie endet jedes PDF und das Versiegeln mit 500. Das Abbild ist gebaut, der Tag" >&2
	echo "steht aber in keiner Env-Datei (wegräumen: docker rmi versammlung:${tag})." >&2
	exit 1
fi

# **Die Version muss im Abbild stehen** (Codeprüfung 16.11.2026, Entscheid 0053):
# Fehlte das Build-Arg, zeigte der Betrieb «Entwicklungsstand», und jedes
# Abschlusspaket trüge für immer «ohne Versionsangabe». Kein Prüflauf sähe es,
# denn der gebaute Stand auf dem Entwicklungssystem läuft ohne die Variable.
im_abbild="$(docker run --rm --entrypoint printenv "versammlung:${tag}" VOTUM_VERSION || true)"
if [[ "$im_abbild" != "$tag" ]]; then
	echo "Abbruch: Im Abbild versammlung:${tag} steht VOTUM_VERSION=«${im_abbild}» statt «${tag}»." >&2
	echo "Das Abbild ist gebaut, der Tag steht aber in keiner Env-Datei (wegräumen: docker rmi versammlung:${tag})." >&2
	exit 1
fi

# Den Tag gleich dorthin schreiben, wo compose.prod.yml ihn sucht. Von Hand
# nachgetragen wird er sonst genau einmal vergessen — und dann startet der
# Betrieb die vorige Fassung, ohne dass es jemandem auffällt.
#
# **Beide Dateien** (03.09.2026): Ein Betriebsstapel läuft mit
# `--env-file .env.betrieb`, nicht mit `.env` — die geteilte `.env` würde dem
# Dev-Stapel ein ORIGIN unterschieben. Das Skript schrieb bis dahin nur nach
# `.env` und meldete «gesetzt»; wer das las, hielt den Betrieb für nachgezogen
# und startete die vorige Fassung. Genau der Fehler, den der Absatz darüber
# ausschliessen will, eine Datei weiter.
tag_setzen() {
	local datei="$1"
	[[ -f "$datei" ]] || return 0
	if grep -q '^VERSAMMLUNG_TAG=' "$datei"; then
		sed -i "s|^VERSAMMLUNG_TAG=.*|VERSAMMLUNG_TAG=${tag}|" "$datei"
		echo "VERSAMMLUNG_TAG in ${datei} auf ${tag} gesetzt."
	else
		echo "VERSAMMLUNG_TAG=${tag}" >> "$datei"
		echo "VERSAMMLUNG_TAG=${tag} an ${datei} angefügt."
	fi
}

# `.env` wird angelegt, wenn sie fehlt — ohne sie läuft nichts. `.env.betrieb`
# gibt es nur dort, wo ein Betriebsstapel steht; fehlt sie, ist das kein Fehler,
# sondern eine Maschine ohne Betrieb.
#
# **Und eine dritte, wenn jemand eine nennt** (11.09.2026, beim ersten Lauf von
# `scripts/einrichten.sh` gefunden). Der Installer schreibt seine Werte nach
# `.env.probe` oder wie der Benutzer sie nennt; dieses Skript kannte nur die
# zwei festen Namen, trug den Tag dort ein und meldete «gesetzt». Der Aufruf
# danach brach mit «VERSAMMLUNG_TAG fehlt» ab — an einer Datei, die das Skript
# nie gesehen hatte.
#
#   VERSAMMLUNG_ENVDATEI=.env.probe scripts/abbild-bauen.sh
touch .env
tag_setzen .env
tag_setzen .env.betrieb
if [[ -n "${VERSAMMLUNG_ENVDATEI:-}" ]]; then
	# **Kein `touch`** (aus dem Code-Review, 11.09.2026). Ein Tippfehler im Namen
	# legte sonst eine leere Scheindatei an, trug den Tag dort ein und meldete
	# Erfolg — während die gemeinte Datei ohne Tag blieb. Genau die Störung, die
	# dieser Block beheben soll, eine Datei weiter. Wer eine Datei nennt, hat sie.
	[[ -f "$VERSAMMLUNG_ENVDATEI" ]] \
		|| { echo "VERSAMMLUNG_ENVDATEI zeigt auf '$VERSAMMLUNG_ENVDATEI' — die Datei gibt es nicht." >&2; exit 1; }
	# Nicht schon geschrieben? Sonst stünde die Meldung zweimal da.
	case "$VERSAMMLUNG_ENVDATEI" in
		.env|.env.betrieb) ;;
		*) tag_setzen "$VERSAMMLUNG_ENVDATEI" ;;
	esac
fi

echo
echo "Weiter mit:"
# **Der gedruckte Befehl muss auf dieser Maschine laufen** (aus dem
# Code-Review): `--env-file .env.betrieb` bricht mit «couldn't find env file»
# ab, wo es die Datei nicht gibt. Wo es sie gibt, gehören Projektname und
# Env-Datei zwingend dazu — ohne `-p` landet der Betrieb im Dev-Projekt, ohne
# `--env-file` fehlt ihm sein ORIGIN.
if [[ -f .env.betrieb ]]; then
	echo "  docker compose -p versammlung-prod --env-file .env.betrieb -f compose.prod.yml up -d"
	zurueck='.env.betrieb'
else
	echo "  docker compose -f compose.prod.yml up -d"
	zurueck='.env'
fi
echo
echo "Die vorige Fassung bleibt als Abbild bestehen. Zurück geht es, indem"
echo "VERSAMMLUNG_TAG in ${zurueck} auf den alten Tag zeigt und der Aufruf"
echo "wiederholt wird — Migrationen laufen dabei nicht rückwärts (AD-14, nur"
echo "anfügend)."
