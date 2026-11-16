#!/usr/bin/env bash
#
# Richtet einen Betriebsstapel ein: Env-Datei, Abbild, Container, erstes Konto.
#
# **Wozu** (Auftraggeber, 11.09.2026, vor den Bedienungstests durch echte Benutzer): Bis
# hierher stand die Installation in `docs/installation.md` als Folge von Hand
# auszuführender Schritte. Sie sind alle richtig, aber es sind sieben, und drei
# davon gehen still schief:
#
#   1. Die Env-Datei wird kopiert und nicht ausgefüllt. Der Stapel startet, und
#      `ORIGIN` zeigt auf `127.0.0.1` — im Saal weist dann jedes Formular ab.
#   2. `APP_DB_PASSWORD` fehlt beim **ersten** Migrationslauf. Die Migration
#      gelingt, die Anwendung kommt nicht an ihre Datenbank, und die Ursache
#      liegt einen Schritt vor dem Fehler.
#   3. Das erste Konto wird vergessen. Eine Selbstregistrierung gibt es nicht,
#      also steht man vor einer laufenden Anwendung ohne Zugang.
#
# Dieses Skript macht dieselben Schritte, in derselben Reihenfolge, und fragt
# nur, was es nicht wissen kann. Alles Übrige rechnet es aus oder würfelt es.
#
# ## Zwei Wege hinein
#
#   scripts/einrichten.sh                    # Menü, fragt Schritt für Schritt
#   scripts/einrichten.sh --datei mein.conf  # ohne Rückfragen, aus einer Datei
#   scripts/einrichten.sh --vorlage mein.conf # schreibt eine kommentierte Vorlage
#   scripts/einrichten.sh --trocken --datei m.conf  # sagt, was es täte, und tut nichts
#
# Die Datei ist derselbe Satz Antworten, den das Menü erfragt. Sie taugt für den
# zweiten Rechner, für den Wiederaufbau nach einem Ausfall und dafür, eine
# Installation nachvollziehbar zu machen: Was drinsteht, ist die Installation.
#
# ## Was am Schluss auf dem Bildschirm steht
#
# Die Zugangsdaten — Adresse, Benutzername, Kennwort (Vorgabe des Auftraggebers: «Passwörter
# für den Zugang sollen in der Ausgabe erscheinen»). Sie stehen ausserdem in
# einer Datei mit Rechten 0600, weil ein Terminalfenster sich schliessen lässt,
# bevor jemand sie notiert hat.
#
# **Die Kennwörter der Datenbank stehen NICHT auf dem Bildschirm.** Sie werden
# gewürfelt, landen in der Env-Datei und werden dort gebraucht; niemand tippt
# sie je ein. Sie auszugeben hiesse, sie ohne Anlass zu verbreiten.
#
# ## Was es nicht tut
#
# Kein TLS, kein Proxy, keine Sicherung, keine Firewall. Das steht in
# `docs/installation.md` und gehört zum Wirt, nicht zur Anwendung. Und es räumt
# nichts weg: Eine vorhandene Env-Datei wird nie überschrieben, ein laufender
# Stapel nie angehalten, ohne dass jemand zugestimmt hat.
set -euo pipefail

wurzel="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$wurzel"

# ── Ausgabe ────────────────────────────────────────────────────────────────
rot=''; gruen=''; fett=''; aus=''
if [[ -t 1 ]]; then
	rot=$'\033[31m'; gruen=$'\033[32m'; fett=$'\033[1m'; aus=$'\033[0m'
fi
sage()   { printf '%s\n' "$*"; }
gut()    { printf '%s✓%s %s\n' "$gruen" "$aus" "$*"; }
schritt(){ printf '\n%s%s%s\n' "$fett" "$*" "$aus"; }
fehler() { printf '%s✗ %s%s\n' "$rot" "$*" "$aus" >&2; }
abbruch(){ fehler "$*"; exit 1; }

# ── Antworten ──────────────────────────────────────────────────────────────
#
# Jede Antwort hat einen Namen, eine Frage, eine Vorgabe und einen Satz Hilfe.
# Menü und Datei lesen denselben Satz — zwei Listen liefen auseinander, und die
# Datei wäre die, die es später nicht mehr gäbe.
ART=''                 # notebook | server | probelauf
ORIGIN=''
VERSAMMLUNG_BIND=''
VERSAMMLUNG_PORT=''
VERSAMMLUNG_OFFLINE=''
BETREIBER=''
BENUTZER=''
ANZEIGENAME=''
PROJEKT=''
ENVDATEI=''

vorlage_schreiben() {
	local ziel="$1"
	[[ -e "$ziel" ]] && abbruch "«$ziel» gibt es schon. Ein anderer Name, oder die Datei vorher wegnehmen."
	cat >"$ziel" <<'VORLAGE'
# Antworten für scripts/einrichten.sh --datei <diese Datei>
#
# Jede Zeile ist NAME=wert. Leere Werte bedeuten «Vorgabe nehmen».
# Kennwörter stehen hier NICHT drin: Das Skript würfelt sie und schreibt sie in
# die Env-Datei. Was Sie zum Anmelden brauchen, steht am Schluss auf dem
# Bildschirm.

# Wofür der Stapel gedacht ist. Er entscheidet über Adresse und Bindung:
#   notebook   Notebook im Versammlungsraum, eigenes WLAN, kein Proxy davor
#   server     Server hinter einem Reverse-Proxy mit TLS
#   probelauf  nur dieser Rechner, zum Ausprobieren
ART=notebook

# Die Adresse, unter der die Anwendung erreichbar ist — so, wie die Telefone
# sie sehen. SvelteKit weist Formulare ab, deren Herkunft nicht dazu passt, und
# ein falscher Wert fällt erst beim ersten Abschicken auf, also im Saal.
#   notebook:  http://192.168.4.1:3000
#   server:    https://versammlung.example.ch
ORIGIN=http://192.168.4.1:3000

# Woran der Port gebunden wird. Leer lassen: Das Skript nimmt 0.0.0.0 für das
# Notebook und 127.0.0.1 für Server und Probelauf.
VERSAMMLUNG_BIND=

# Der Port auf dem Wirt. Leer lassen für 3000.
VERSAMMLUNG_PORT=

# Wie die Bewirtschaftung heisst. Steht in der Anwendung als Betreiber.
BETREIBER=Ihre Bewirtschaftung

# Das erste Konto. Alle weiteren legt die Verwaltung in der Anwendung an.
BENUTZER=verwaltung
ANZEIGENAME=Vorname Nachname

# Compose-Projektname und Env-Datei. Leer lassen für versammlung-prod und
# .env.betrieb. Ein eigener Name ist Pflicht, wenn auf demselben Rechner auch
# der Entwicklungsstapel läuft — sonst übernimmt dieser Aufruf dessen Container.
#
# Die Env-Datei muss «.env» oder «.env.<name>» heissen. In ihr stehen die
# Kennwörter, und nur dieses Muster deckt .gitignore und .dockerignore ab.
PROJEKT=
ENVDATEI=
VORLAGE
	gut "Vorlage geschrieben: $ziel"
	sage "Ausfüllen, dann: scripts/einrichten.sh --datei $ziel"
}

datei_lesen() {
	local quelle="$1"
	[[ -r "$quelle" ]] || abbruch "«$quelle» ist nicht lesbar."
	# Nur bekannte Namen übernehmen. `source` wäre kürzer und führte die Datei
	# aus — eine Antwortdatei ist Eingabe, kein Skript.
	local zeile name wert
	while IFS= read -r zeile || [[ -n "$zeile" ]]; do
		[[ "$zeile" =~ ^[[:space:]]*(#|$) ]] && continue
		name="${zeile%%=*}"; wert="${zeile#*=}"
		name="${name//[[:space:]]/}"
		# **Beschneiden** (aus dem Code-Review, 11.09.2026): Eine Datei mit
		# Windows-Zeilenenden hängt an jeden Wert ein `\r`. Es übersteht die
		# Prüfung auf `http://`, landet in der Env-Datei, und die Anwendung
		# vergleicht danach eine Herkunft, die es nicht gibt — im Saal weist dann
		# jedes Formular ab. Gemessen: ORIGIN 22 statt 21 Zeichen.
		wert="${wert%$'\r'}"
		wert="${wert#"${wert%%[![:space:]]*}"}"
		wert="${wert%"${wert##*[![:space:]]}"}"
		case "$name" in
			ART|ORIGIN|VERSAMMLUNG_BIND|VERSAMMLUNG_PORT|BETREIBER|BENUTZER|ANZEIGENAME|PROJEKT|ENVDATEI)
				printf -v "$name" '%s' "$wert" ;;
			*) fehler "Unbekannter Name in $quelle: $name — übergangen" ;;
		esac
	done <"$quelle"
}

frage() {
	local name="$1" text="$2" vorgabe="$3" hilfe="${4:-}"
	local antwort
	[[ -n "$hilfe" ]] && sage "  $hilfe"
	read -r -p "  $text${vorgabe:+ [$vorgabe]}: " antwort || abbruch 'Abgebrochen.'
	printf -v "$name" '%s' "${antwort:-$vorgabe}"
}

menue() {
	schritt 'Wofür ist dieser Stapel?'
	sage '  1) Notebook im Versammlungsraum — eigenes WLAN, kein Proxy davor'
	sage '  2) Server hinter einem Reverse-Proxy mit TLS'
	sage '  3) Probelauf auf diesem Rechner'
	local wahl
	read -r -p '  Ihre Wahl [1]: ' wahl || abbruch 'Abgebrochen.'
	case "${wahl:-1}" in
		1) ART='notebook' ;;
		2) ART='server' ;;
		3) ART='probelauf' ;;
		*) abbruch "Unbekannte Wahl: $wahl" ;;
	esac

	schritt 'Unter welcher Adresse ist die Anwendung erreichbar?'
	case "$ART" in
		notebook)
			frage ORIGIN 'Adresse' 'http://192.168.4.1:3000' \
				'So, wie die Telefone sie sehen. Ein falscher Wert fällt erst beim ersten Abschicken auf — im Saal.' ;;
		server)
			frage ORIGIN 'Adresse' 'https://versammlung.example.ch' \
				'Die öffentliche Adresse mit https, nicht die des Containers.' ;;
		probelauf)
			frage ORIGIN 'Adresse' 'http://127.0.0.1:3000' '' ;;
	esac

	schritt 'Wer betreibt sie?'
	frage BETREIBER 'Name der Bewirtschaftung' 'Bewirtschaftung' \
		'Steht in der Anwendung als Betreiber.'

	schritt 'Das erste Konto'
	sage '  Eine Selbstregistrierung gibt es nicht. Alle weiteren Konten legt'
	sage '  die Verwaltung danach in der Anwendung an.'
	frage BENUTZER 'Benutzername' 'verwaltung' ''
	frage ANZEIGENAME 'Anzeigename' 'Verwaltung' ''
}

# ── Aufruf lesen ───────────────────────────────────────────────────────────
quelle=''
trocken='nein'
# **In einer Schleife, nicht nur `$1`** (aus dem Code-Review, 11.09.2026). Vorher
# wurde `--trocken` allein an erster Stelle erkannt: `--datei m.conf --trocken`
# baute, startete und legte ein Konto an, obwohl jemand ausdrücklich nur sehen
# wollte, was geschähe. Und überzählige Angaben fielen still weg.
while [[ $# -gt 0 ]]; do
	case "$1" in
		# **Ein Probelauf ohne Wirkung.** Er prüft die Antworten, rechnet die
		# abgeleiteten Werte aus und sagt, welche Befehle folgen würden — ohne Bau,
		# ohne Container, ohne Konto. Gedacht für die Frage «stimmt meine Datei?»,
		# die man sonst erst nach dem ersten Bau beantwortet bekommt.
		--trocken) trocken='ja'; shift ;;
		--vorlage) [[ -n "${2:-}" ]] || abbruch 'Aufruf: scripts/einrichten.sh --vorlage <datei>'
			vorlage_schreiben "$2"; exit 0 ;;
		--datei)   [[ -n "${2:-}" ]] || abbruch 'Aufruf: scripts/einrichten.sh --datei <datei>'
			quelle="$2"; shift 2 ;;
		--hilfe|-h) sed -n '2,47p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) abbruch "Unbekannte Angabe: $1 — siehe --hilfe" ;;
	esac
done

# ── Voraussetzungen ────────────────────────────────────────────────────────
schritt 'Voraussetzungen'
command -v docker >/dev/null || abbruch 'Docker fehlt.'
docker compose version >/dev/null 2>&1 || abbruch 'Docker Compose (v2) fehlt.'
command -v openssl >/dev/null || abbruch 'openssl fehlt — es würfelt die Kennwörter.'
gut "Docker $(docker --version | sed 's/Docker version //; s/,.*//'), Compose vorhanden"

# ── Antworten holen ────────────────────────────────────────────────────────
if [[ -n "$quelle" ]]; then
	datei_lesen "$quelle"
	gut "Antworten aus $quelle"
else
	menue
fi

: "${ART:=probelauf}"
: "${BETREIBER:=Bewirtschaftung}"
: "${BENUTZER:=verwaltung}"
: "${ANZEIGENAME:=Verwaltung}"
: "${PROJEKT:=versammlung-prod}"
: "${ENVDATEI:=.env.betrieb}"
: "${VERSAMMLUNG_PORT:=3000}"
case "$ART" in
	notebook)  : "${VERSAMMLUNG_BIND:=0.0.0.0}";   VERSAMMLUNG_OFFLINE='true' ;;
	server)    : "${VERSAMMLUNG_BIND:=127.0.0.1}"; VERSAMMLUNG_OFFLINE='false' ;;
	probelauf) : "${VERSAMMLUNG_BIND:=127.0.0.1}"; VERSAMMLUNG_OFFLINE='false'
		: "${ORIGIN:=http://127.0.0.1:3000}" ;;
	*) abbruch "Unbekannte Art: $ART — notebook, server oder probelauf" ;;
esac
# **Der Name der Env-Datei ist nicht frei** (aus dem Sicherheitsdurchgang,
# 11.09.2026). In sie kommen gleich drei Geheimnisse: beide Datenbankkennwörter
# und `VERSAMMLUNG_GEHEIMNIS`, mit dem die in der Anwendung hinterlegten Zugänge
# äusserer Dienste entschlüsselt werden. `.gitignore` und `.dockerignore` decken
# beide nur `.env` und `.env.*`.
#
# Ein sprechender Name wie `versammlung.env` fällt durch beide Raster — und der
# nächste Schritt ist der Bau, der die Wurzel als Kontext einzieht. Die Datei
# läge dann in einer Abbildschicht, und ein `git add -A` nähme sie mit. Die
# Schranke steht deshalb hier, wo der Name entsteht, und nicht in zwei Listen,
# die man einzeln vergisst.
case "$ENVDATEI" in
	.env|.env.*) ;;
	*) abbruch "Die Env-Datei muss «.env» oder «.env.<name>» heissen, sonst deckt sie weder .gitignore noch .dockerignore — und in ihr stehen die Kennwörter. Gemeint war: $ENVDATEI" ;;
esac
[[ -n "$ORIGIN" ]] || abbruch 'ORIGIN fehlt — die Adresse, unter der die Anwendung erreichbar ist.'
[[ "$ORIGIN" == http://* || "$ORIGIN" == https://* ]] \
	|| abbruch "ORIGIN muss mit http:// oder https:// beginnen: $ORIGIN"
# Ein abschliessender Schrägstrich bricht den Herkunftsvergleich von SvelteKit.
ORIGIN="${ORIGIN%/}"
[[ "$BENUTZER" =~ ^[A-Za-z0-9._-]+$ ]] || abbruch "Benutzername mit Sonderzeichen: $BENUTZER"

if [[ "$trocken" == 'ja' ]]; then
	schritt 'Trockenlauf — es wird nichts geschrieben und nichts gestartet'
	sage "  Art:          $ART"
	sage "  Adresse:      $ORIGIN"
	sage "  Bindung:      $VERSAMMLUNG_BIND:$VERSAMMLUNG_PORT"
	sage "  Offline:      $VERSAMMLUNG_OFFLINE"
	sage "  Betreiber:    $BETREIBER"
	sage "  Erstes Konto: $BENUTZER ($ANZEIGENAME)"
	sage "  Projekt:      $PROJEKT"
	sage "  Env-Datei:    $ENVDATEI$([[ -e "$ENVDATEI" ]] && echo ' (gibt es schon — bliebe unangetastet)')"
	sage ''
	sage '  Es würden folgen:'
	sage '    scripts/abbild-bauen.sh'
	sage "    docker compose -p $PROJEKT --env-file $ENVDATEI -f compose.prod.yml up -d"
	sage "    <Kennwort> | docker compose -p $PROJEKT --env-file $ENVDATEI -f compose.prod.yml \\"
	sage "      run --rm -T -e VERSAMMLUNG_BETREIBER='$BETREIBER' \\"
	sage "      migrate node scripts/benutzer-anlegen.mjs $BENUTZER '$ANZEIGENAME' admin"
	sage ''
	exit 0
fi

# ── Env-Datei ──────────────────────────────────────────────────────────────
schritt "Env-Datei $ENVDATEI"
if [[ -e "$ENVDATEI" ]]; then
	sage "  «$ENVDATEI» gibt es schon. Sie wird nicht angefasst."
	sage '  Die vorhandenen Werte gelten; das Skript baut und startet damit weiter.'
	# **Nicht überschreiben, auch nicht nach Rückfrage.** Darin stehen die
	# Kennwörter einer laufenden Datenbank. Ein neues APP_DB_PASSWORD sperrte die
	# Anwendung aus ihrer eigenen Datenbank aus, und das fiele erst beim Start auf.
	env_neu='nein'
else
	umask 077
	{
		printf '# Erzeugt von scripts/einrichten.sh am %s\n' "$(date '+%d.%m.%Y %H:%M')"
		printf '# Art: %s\n\n' "$ART"
		printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -base64 33 | tr -d '\n/+=' | cut -c1-32)"
		printf 'APP_DB_PASSWORD=%s\n' "$(openssl rand -base64 33 | tr -d '\n/+=' | cut -c1-32)"
		printf 'VERSAMMLUNG_GEHEIMNIS=%s\n' "$(openssl rand -hex 32)"
		printf 'ORIGIN=%s\n' "$ORIGIN"
		printf 'VERSAMMLUNG_BIND=%s\n' "$VERSAMMLUNG_BIND"
		printf 'VERSAMMLUNG_PORT=%s\n' "$VERSAMMLUNG_PORT"
		printf 'VERSAMMLUNG_OFFLINE=%s\n' "$VERSAMMLUNG_OFFLINE"
		printf 'VERSAMMLUNG_TAG=\n'
	} >"$ENVDATEI"
	chmod 600 "$ENVDATEI"
	env_neu='ja'
	gut "$ENVDATEI geschrieben (nur für Sie lesbar), Kennwörter gewürfelt"
fi

# ── Abbild ─────────────────────────────────────────────────────────────────
schritt 'Abbild bauen'
sage '  Das dauert beim ersten Mal einige Minuten.'
VERSAMMLUNG_ENVDATEI="$ENVDATEI" scripts/abbild-bauen.sh
grep -q '^VERSAMMLUNG_TAG=.\+' "$ENVDATEI" \
	|| abbruch "VERSAMMLUNG_TAG steht nicht in $ENVDATEI — der Bau hat den Tag nicht eingetragen."
gut "Tag: $(grep '^VERSAMMLUNG_TAG=' "$ENVDATEI" | cut -d= -f2)"

# ── Starten ────────────────────────────────────────────────────────────────
schritt 'Stapel starten'
compose=(docker compose -p "$PROJEKT" --env-file "$ENVDATEI" -f compose.prod.yml)
"${compose[@]}" up -d
gut 'Container laufen'

# **Die Gesundheitsprüfung des Abbilds, nicht «lässt sich node starten»** (aus
# dem Code-Review, 11.09.2026). `exec node -e 'process.exit(0)'` beweist nur,
# dass der Container lebt — ein abstürzender app-Container passiert das in
# seinem Laufzeitfenster, und der Lauf meldete danach «Fertig» samt einer
# Adresse, die die Verbindung verweigert. Das Abbild bringt einen HEALTHCHECK
# mit; er fragt den HTTP-Dienst.
sage '  Warte, bis die Anwendung antwortet …'
bereit='nein'
for _ in $(seq 1 60); do
	kennung="$("${compose[@]}" ps -q app 2>/dev/null | head -1)"
	if [[ -n "$kennung" ]]; then
		zustand="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}ohne{{end}}' "$kennung" 2>/dev/null || echo '')"
		case "$zustand" in
			healthy) bereit='ja'; break ;;
			# Kein HEALTHCHECK im Abbild: dann bleibt nur die Frage, ob der Dienst
			# den Port bedient. Von innen, damit die Bindung am Wirt egal ist.
			ohne) "${compose[@]}" exec -T app wget -q -O /dev/null http://127.0.0.1:3000/anmelden \
					&& { bereit='ja'; break; } ;;
		esac
	fi
	sleep 2
done
[[ "$bereit" == 'ja' ]] || abbruch "Die Anwendung kam nicht hoch. Protokoll: ${compose[*]} logs app"
gut 'Anwendung antwortet'

# ── Erstes Konto ───────────────────────────────────────────────────────────
schritt 'Erstes Konto'
if [[ "$env_neu" == 'nein' ]]; then
	# **Die Wahrheit über einen zweiten Lauf** (aus dem Code-Review, 11.09.2026).
	# Hier stand, ein bestehender Benutzername bleibe unangetastet. Das Gegenteil
	# ist der Fall: `benutzer-anlegen.mjs` schreibt mit `ON CONFLICT DO UPDATE`
	# und setzt Kennwort, Anzeigename, Rolle **und** `disabled_at = NULL`. Ein
	# zweiter Lauf öffnet also ein bewusst gesperrtes Konto wieder und macht es
	# zum Administrator. Das gehört gesagt, bevor jemand es auslöst.
	sage "  ${rot}Achtung${aus}: «$BENUTZER» wird überschrieben, falls es ihn schon gibt —"
	sage '  mit neuem Kennwort, neuer Rolle (admin) und aufgehobener Sperre.'
	sage '  Abbrechen mit Strg-C; ein anderer Benutzername steht in der Antwortdatei.'
	sleep 4
fi

# Das Kennwort: gewürfelt, gut lesbar vorzulesen. Keine Zeichen, die sich auf
# Papier verwechseln lassen (I, l, O, 0, 1) — im Saal wird so etwas diktiert.
#
# **Aus `openssl rand`, nicht aus `/dev/urandom | head`** (11.09.2026, beim
# ersten Lauf gefunden). `tr … </dev/urandom | head -c 20` liefert zwar ein
# Kennwort, aber `head` beendet sich nach zwanzig Zeichen, `tr` bekommt SIGPIPE,
# und mit `set -o pipefail` ist der Rückgabewert der Kette 141. `set -e` beendet
# daraufhin das Skript — mitten im Schritt «Erstes Konto», ohne eine Zeile
# Fehlermeldung. Der Stapel lief danach, das Konto fehlte, und nichts sagte es.
#
# `openssl rand` schreibt eine endliche Menge; niemand schliesst ein Rohr zu
# früh. Die Schleife deckt den seltenen Fall, dass nach dem Aussieben zu wenig
# übrig bleibt.
kennwort=''
while [[ ${#kennwort} -lt 20 ]]; do
	kennwort+="$(openssl rand -base64 48 | LC_ALL=C tr -dc 'A-HJ-NP-Za-km-z2-9')"
done
kennwort="${kennwort:0:20}"

# **Im `migrate`-Container, nicht im `app`-Container** (11.09.2026, beim dritten
# Lauf gefunden). Das Anlegen des ersten Betreibers geht dem Zeilenschutz voraus
# und braucht die privilegierte Verbindung; `app` hat nur die eingeschränkte —
# aus gutem Grund, ein Superuser umginge den Zeilenschutz immer (AD-6). Der
# Dienst `migrate` trägt `DATABASE_MIGRATION_URL` bereits in seiner Umgebung.
#
# `run --rm` statt `exec`, weil dieser Container sich nach der Migration beendet
# hat. Der überschriebene Befehl macht daraus keinen zweiten Migrationslauf.
#
# Das Kennwort geht über ein **Rohr**, nicht über `-e`: `docker compose … -e
# VAR="…"` stellt den Wert in die Argumentliste des docker-Prozesses, und die
# steht in der Prozessliste des Wirts. Genau das verbietet die Hausregel
# («Secrets nie als Kommandozeilen-Argument»). `benutzer-anlegen.mjs` liest seit
# dem 11.09.2026 auch von der Standardeingabe. Dasselbe gilt für
# `DATABASE_MIGRATION_URL`: Sie enthält das Datenbankkennwort und kommt deshalb
# aus der Umgebung des Dienstes, nicht von der Kommandozeile.
#
# `VERSAMMLUNG_BETREIBER` darf über `-e` gehen: ein Name, kein Geheimnis.
if printf '%s' "$kennwort" | "${compose[@]}" run --rm -T \
		-e VERSAMMLUNG_BETREIBER="$BETREIBER" \
		migrate node scripts/benutzer-anlegen.mjs "$BENUTZER" "$ANZEIGENAME" admin; then
	gut "Konto «$BENUTZER» angelegt"
	konto_neu='ja'
else
	fehler 'Das Konto liess sich nicht anlegen — die Meldung darüber sagt warum.'
	konto_neu='nein'
fi

# ── Zugangsdaten ───────────────────────────────────────────────────────────
# **Nicht in die Wurzel des Repositorys** (aus dem Code-Review, 11.09.2026):
# Dort deckt sie kein Muster in `.gitignore`, ein `git add -A` nähme sie mit,
# und der Bau zieht den ganzen Ordner als Kontext ein. `zugang/` ist ignoriert,
# in beiden Listen.
mkdir -p zugang && chmod 700 zugang
zugangsdatei="zugang/$(date '+%Y%m%d-%H%M').txt"
umask 077
{
	printf 'Votum — Zugang\n'
	printf 'Eingerichtet am %s\n\n' "$(date '+%d.%m.%Y %H:%M')"
	printf 'Adresse:      %s\n' "$ORIGIN"
	printf 'Benutzername: %s\n' "$BENUTZER"
	if [[ "$konto_neu" == 'ja' ]]; then
		printf 'Kennwort:     %s\n' "$kennwort"
	else
		printf 'Kennwort:     — es wurde kein Konto angelegt.\n'
	fi
	printf '\nBetreiber:    %s\n' "$BETREIBER"
	printf 'Projekt:      %s\n' "$PROJEKT"
	printf 'Env-Datei:    %s\n' "$ENVDATEI"
	printf '\nÄndern Sie das Kennwort nach der ersten Anmeldung.\n'
} >"$zugangsdatei"
chmod 600 "$zugangsdatei"

schritt 'Fertig'
sage ''
sage "  Adresse:      $ORIGIN"
sage "  Benutzername: $BENUTZER"
if [[ "$konto_neu" == 'ja' ]]; then
	sage "  Kennwort:     ${fett}${kennwort}${aus}"
else
	# **Nicht «unverändert»** (11.09.2026): Der Schritt scheitert aus mehr als
	# einem Grund, und «das Konto bestand schon» war bei zweien davon eine
	# Behauptung. Hier steht, was sicher ist: Es wurde keines angelegt.
	sage "  Kennwort:     ${rot}kein Konto angelegt${aus} — siehe die Meldung oben"
fi
sage ''
sage "  Steht auch in $zugangsdatei (nur für Sie lesbar)."
sage '  Ändern Sie das Kennwort nach der ersten Anmeldung.'
sage ''
case "$ART" in
	notebook)
		sage '  Für den Saal: Das Notebook muss sein WLAN aufspannen, und die Adresse'
		sage "  oben muss die sein, unter der die Telefone es sehen ($ORIGIN)." ;;
	server)
		sage '  Davor gehört ein Proxy mit TLS. Er darf den Ereignisstrom NICHT puffern'
		sage '  (/versammlungen/<id>/strom, /p/strom, /z/strom) — sonst sieht der Saal'
		sage '  das Ergebnis erst beim nächsten Klick. In nginx: proxy_buffering off;' ;;
	probelauf)
		sage '  Zum Ausprobieren mit Beispieldaten: node e2e/mustergemeinschaft.mjs' ;;
esac
sage ''
sage "  Anhalten:  docker compose -p $PROJEKT --env-file $ENVDATEI -f compose.prod.yml down"
sage "  Protokoll: docker compose -p $PROJEKT --env-file $ENVDATEI -f compose.prod.yml logs -f app"
sage ''
