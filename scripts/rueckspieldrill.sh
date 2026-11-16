#!/usr/bin/env bash
#
# Rückspieldrill: die neueste Sicherung aus `scripts/sicherung.sh` auf einen
# Wegwerfstapel zurückspielen und an der Wirkung prüfen, danach alles
# wegräumen.
#
# **Entschieden am 15.10.2026** (Auftraggeber, nach Rückfrage zu M6):
# vierteljährlich automatisch, Meldung nur bei Fehler. Gebaut am 16.10.2026
# (Auftrag F1).
#
# **Der private Schlüssel kommt über die Standardeingabe**, nie aus einer Datei
# auf diesem Wirt. Er gehört nicht neben die Sicherungen, die er öffnet; liegt
# er dort, wandert er mit jeder Kopie des Wirts mit, und die Verschlüsselung
# läuft leer. Wer ihn hält, ruft den Drill auf und reicht ihn durch. Hier lebt
# er nur in einem GnuPG-Verzeichnis im Arbeitsspeicher (`/dev/shm`), solange
# der Lauf dauert.
#
# **Entschlüsselt liegt nur, was im Wegwerfstapel liegt.** Jedes Teil geht von
# `gpg` durch eine Pipe direkt in dessen Volumes, keine entschlüsselte Datei
# daneben. Die Volumes sind auf der Platte dieses Wirts und fallen am Ende mit
# `down -v` weg; ihre Blöcke überschreibt das nicht. Der Lauf gehört deshalb
# nicht in die Zeit einer Sicherung des Wirts.
#
# **Geprüft wird die Wirkung, nicht die Zeilenzahl:** Jedes Abschlusspaket muss
# aus der zurückgespielten Ablage mit genau der Prüfsumme seines Siegels
# kommen, ebenso jede Zeitstempelantwort und jedes eingespielte Abschlusspaket
# (`imported_meeting`), und jedes Manifest, auch das eines Nachtragssiegels,
# muss die Prüfsumme tragen, die als Siegel eingetragen ist. Hat die Sicherung kein Siegel, sagt der Lauf das
# ausdrücklich und meldet es, statt grün zu schweigen: Dann ist das
# Zurückspielen geprüft, die Ablage aber nicht.
#
# **Der Wegwerfstapel spricht mit niemandem.** Er läuft in einem internen Netz
# ohne veröffentlichten Port, ohne Zeitgeber und mit einem eigenen, zufälligen
# `VERSAMMLUNG_GEHEIMNIS`. Die in der Oberfläche hinterlegten Zugänge (SMTP,
# KI, Zeitstempel) bleiben so unlesbar; ein zurückgespielter Stand darf keine
# Einladung und keine Erinnerung verschicken.
#
# Aufruf, der Schlüssel auf der Standardeingabe:
#
#   DRILL_QUELLE=root@wirt: scripts/rueckspieldrill.sh < privater-schluessel.asc
#
# `DRILL_QUELLE` ist ein Sicherungsverzeichnis (wie `SICHERUNG_ZIEL`) oder ein
# rsync-Ziel, das auf `:` oder `/` endet (wie `SICHERUNG_KOPIE`).
#
# **Falsch rot, nie falsch grün**, in zwei bekannten Fällen: Lief «Löschen nach
# Frist» zwischen Auszug und Archiv der Sicherung (Kopf von `sicherung.sh`),
# fehlt ein Paket, dessen Siegel der Auszug noch hat. Und ein Ordner, der am
# Ziel gerade erst ankommt, hat noch nicht alle Teile. Zeitplan und Halter des
# Schlüssels stehen in der Betriebsdoku des Betreibers.
set -euo pipefail
umask 077

QUELLE="${DRILL_QUELLE:-/var/backups/versammlung}"
# Ohne Anführungszeichen: Die Tilde wird so auch ohne gesetztes HOME aufgelöst.
SSH_SCHLUESSEL=${DRILL_SSH_SCHLUESSEL:-~/.ssh/versammlung-kopie}
PROJEKT="${DRILL_PROJEKT:-versammlung-drill}"
# Aus dem Betrieb kommt das Abbild: Zurückgespielt wird im Ernstfall mit der
# Fassung, die gerade läuft, nicht mit der von damals.
BETRIEB="${DRILL_BETRIEB:-versammlung-prod}"
TAG="${DRILL_TAG:-}"
# Mit DRILL_TAG von Hand auch der Name, wenn das Abbild aus einer Registry kommt.
ABBILD="${DRILL_ABBILD:-}"
if [[ -n "$ABBILD" && -z "$TAG" ]]; then
	echo "DRILL_ABBILD ohne DRILL_TAG: Das Abbild käme sonst still aus dem Betrieb." >&2
	exit 2
fi
# Älter als das, und die Kopie hinkt: Dann prüfte der Drill einen Stand, den
# niemand mehr zurückspielen will.
HOECHSTALTER="${DRILL_HOECHSTALTER_STUNDEN:-48}"
FRIST="${DRILL_FRIST:-600}"
# Gotify ohne Vorgabe: Adresse und Tokendatei sind Belegungen des Hosts und
# stehen in dessen Zeitplan (Betriebsdoku des Dienstes). Fehlt eine, bleibt der
# Lauf ungemeldet und sagt das im Protokoll und im Journal.
GOTIFY_URL="${GOTIFY_URL:-}"
GOTIFY_TOKENDATEI="${GOTIFY_TOKENDATEI:-}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lauf="$(date +%F_%H%M%S)"
stufe='begonnen'
befund=''
arbeit=''
schluesselbund=''
stapel=''

log() { echo "$(date '+%F %T') $*"; }

gotify() {
	local titel="$1" text="$2" prio="$3" antwort
	if [[ -z "$GOTIFY_URL" || -z "$GOTIFY_TOKENDATEI" ]]; then
		log "GOTIFY_URL oder GOTIFY_TOKENDATEI nicht gesetzt, also ungemeldet"
		logger -t versammlung-drill "GOTIFY_URL oder GOTIFY_TOKENDATEI nicht gesetzt"
		return 0
	fi
	if [[ ! -s "$GOTIFY_TOKENDATEI" ]]; then
		log "Kein Gotify-Token unter $GOTIFY_TOKENDATEI, also ungemeldet"
		logger -t versammlung-drill "kein Gotify-Token unter $GOTIFY_TOKENDATEI"
		return 0
	fi
	# Der Token über die Standardeingabe von curl, nicht als Argument.
	antwort="$(printf 'header = "X-Gotify-Key: %s"\n' "$(tr -d '\r\n' < "$GOTIFY_TOKENDATEI")" |
		curl -sS --max-time 15 --fail -K - "$GOTIFY_URL/message" \
			-F "title=$titel" -F "message=$text" -F "priority=$prio" 2>&1)"
	if [[ "$antwort" =~ \"id\":([0-9]+) ]]; then
		log "Gotify-Meldung abgesetzt, Nachricht ${BASH_REMATCH[1]}"
	else
		log "Gotify-Meldung NICHT abgesetzt: ${antwort:0:200}"
		logger -t versammlung-drill 'Gotify-Meldung nicht abgesetzt'
	fi
}

dc() { docker compose --progress quiet -p "$PROJEKT" --env-file "$arbeit/env" -f "$REPO/compose.prod.yml" -f "$arbeit/drill.yml" "$@"; }

# **Aufräumen gehört zum Erfolg.** Bleibt ein Volume mit zurückgespielten Daten
# stehen oder der Schlüssel im Arbeitsspeicher, ist der Lauf rot, auch wenn
# alles andere gelang.
aufraeumen() {
	local rest=''
	if [[ -n "$stapel" ]]; then
		dc down -v --remove-orphans --timeout 20 > /dev/null 2>&1 || true
		[[ -z "$(docker ps -aq --filter "label=com.docker.compose.project=$PROJEKT")" ]] ||
			rest+=" Container"
		[[ -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$PROJEKT")" ]] ||
			rest+=" Volumes"
	fi
	if [[ -n "$schluesselbund" ]]; then
		GNUPGHOME="$schluesselbund" gpgconf --kill all > /dev/null 2>&1 || true
		rm -rf "$schluesselbund"
		[[ ! -e "$schluesselbund" ]] || rest+=" Schlüsselbund"
	fi
	if [[ -n "$arbeit" ]]; then
		rm -rf "$arbeit"
		[[ ! -e "$arbeit" ]] || rest+=" Arbeitsverzeichnis"
	fi
	[[ -z "$rest" ]] || { log "Nicht weggeräumt:$rest"; return 1; }
	log "Weggeräumt: Wegwerfstapel, Schlüsselbund, Arbeitsverzeichnis"
}

melden() {
	local rc=$?
	set +e
	aufraeumen || { rc=1; stufe="nicht weggeräumt nach $stufe"; }
	if [[ "$stufe" == 'geprüft' && "$rc" -eq 0 ]]; then
		if [[ -n "$befund" ]]; then
			log "$befund"
			gotify 'Votum-Drill: nichts zu prüfen' "$befund Lauf $lauf auf $(hostname)." 4
		fi
		log "Ende"
		return 0
	fi
	local was="Rückspieldrill $lauf nicht bestanden (Stand: $stufe, Code $rc)"
	log "ABBRUCH: $was"
	logger -t versammlung-drill "Abbruch: $was"
	gotify 'Votum-Drill fehlgeschlagen' "$was, auf $(hostname). Protokoll: /var/log/versammlung-drill.log" 8
	exit "$rc"
}
trap melden EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
# Bricht `pct exec` oder eine SSH-Sitzung ab, kommt HUP. Ohne Falle endete der
# Lauf ohne Aufräumen, und die entschlüsselten Volumes blieben stehen.
trap 'exit 129' HUP

log "Rückspieldrill $lauf beginnt (Quelle $QUELLE, Stapel $PROJEKT)"

[[ "$HOECHSTALTER" =~ ^[0-9]+$ && "$FRIST" =~ ^[0-9]+$ ]] ||
	{ log "DRILL_HOECHSTALTER_STUNDEN und DRILL_FRIST müssen ganze Zahlen sein"; exit 1; }
# Der Wegwerfstapel wird am Ende mit seinen Volumes gelöscht. Ein Name, der
# einem echten Stapel gehört, löschte dessen Daten.
[[ "$PROJEKT" =~ ^[a-z0-9][a-z0-9_-]*$ && "$PROJEKT" != "$BETRIEB" && "$PROJEKT" != 'versammlung' ]] ||
	{ log "DRILL_PROJEKT $PROJEKT ist kein zulässiger Name für einen Wegwerfstapel"; exit 1; }
if [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$PROJEKT")$(docker volume ls -q --filter "label=com.docker.compose.project=$PROJEKT")" ]]; then
	log "Stapel $PROJEKT besteht schon, Rest eines früheren Laufs? Nicht angefasst"
	exit 1
fi
[[ "$QUELLE" != *:* || "$QUELLE" == *: || "$QUELLE" == */ ]] ||
	{ log "DRILL_QUELLE als rsync-Ziel muss auf : oder / enden"; exit 1; }
[[ ! -t 0 ]] || { log "Der private Schlüssel gehört auf die Standardeingabe"; exit 1; }

# ── Der Schlüssel, zuerst: Die Standardeingabe gehört ihm ──────────────────
schluesselbund="$(mktemp -d /dev/shm/versammlung-drill-gnupg.XXXXXX)"
export GNUPGHOME="$schluesselbund"
stufe='Schlüssel'
gpg --batch --quiet --import 2> "$schluesselbund/import.log" ||
	{ log "Schlüssel nicht einlesbar: $(head -c 300 "$schluesselbund/import.log")"; exit 1; }
geheime="$(gpg --batch --with-colons --list-secret-keys | awk -F: '$1 == "fpr" { print $10 }')"
[[ -n "$geheime" ]] || { log "Auf der Standardeingabe kam kein privater Schlüssel"; exit 1; }

# ── Die neueste Sicherung holen ────────────────────────────────────────────
arbeit="$(mktemp -d /var/tmp/versammlung-drill.XXXXXX)"
stufe='Sicherung holen'
muster='^20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]_[0-9]{6}$'
if [[ "$QUELLE" == *:* ]]; then
	fern="ssh -i $SSH_SCHLUESSEL -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=30"
	# Erst die Liste, dann die Auswahl: Ein Fehler der Verbindung soll als
	# solcher enden, nicht als «keine Sicherung».
	liste="$(timeout "$FRIST" rsync --list-only -e "$fern" "$QUELLE")"
	neueste="$(awk '$1 ~ /^d/ { print $NF }' <<< "$liste" | grep -E "$muster" | sort | tail -1 || true)"
	[[ -n "$neueste" ]] || { log "Keine Sicherung unter $QUELLE"; exit 1; }
	timeout "$FRIST" rsync -a -e "$fern" "$QUELLE$neueste/" "$arbeit/sicherung/"
else
	neueste="$(find "$QUELLE" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' |
		grep -E "$muster" | sort | tail -1 || true)"
	[[ -n "$neueste" ]] || { log "Keine Sicherung unter $QUELLE"; exit 1; }
	cp -a "$QUELLE/$neueste" "$arbeit/sicherung"
fi
s="$arbeit/sicherung"
log "Neueste Sicherung: $neueste"

stufe='Prüfsummen'
# Genau diese vier Dateien und keine fehlt; `sha256sum -c` allein prüfte nur,
# was im Manifest steht.
[[ "$(awk '{ print $2 }' "$s/SHA256SUMS" | sort | tr '\n' ' ')" == 'dateien.tar.gpg datenbank.dump.gpg rollen.sql.gpg stand.txt ' ]] ||
	{ log "SHA256SUMS nennt nicht genau die vier Teile"; exit 1; }
(cd "$s" && sha256sum --quiet -c SHA256SUMS) || { log "Prüfsummen stimmen nicht"; exit 1; }

stand() { sed -n "s/^$1=//p" "$s/stand.txt"; }
zeitpunkt="$(stand zeitpunkt)"
alter=$(( ($(date +%s) - $(date -d "$zeitpunkt" +%s)) / 3600 ))
(( alter <= HOECHSTALTER )) ||
	{ log "Die neueste Sicherung ist $alter Stunden alt (höchstens $HOECHSTALTER), die Kopie hinkt"; exit 1; }
# Ein Name aus der Zukunft hiesse, die Uhr der Sicherung sprang vor; dann wäre
# «die neueste» womöglich ein alter Stand.
(( alter >= -1 )) || { log "Die neueste Sicherung trägt einen Zeitpunkt in der Zukunft ($zeitpunkt)"; exit 1; }
empfaenger="$(stand empfaenger)"
grep -qxF "$empfaenger" <<< "$geheime" ||
	{ log "Die Sicherung ist an $empfaenger verschlüsselt, der Schlüssel auf der Eingabe ist ein anderer"; exit 1; }
migration="$(stand migration)"
log "Stand: $zeitpunkt, Abbild $(stand abbild), Migration $migration"

# ── Der Wegwerfstapel ──────────────────────────────────────────────────────
stufe='Wegwerfstapel'
if [[ -z "$TAG" ]]; then
	betrieb_app="$(docker ps -q --filter "label=com.docker.compose.project=$BETRIEB" \
		--filter 'label=com.docker.compose.service=app' --filter 'label=com.docker.compose.oneoff=False')"
	[[ "$(wc -w <<< "$betrieb_app")" -eq 1 ]] || { log "Kein eindeutiger Betrieb $BETRIEB für das Abbild"; exit 1; }
	bild="$(docker inspect -f '{{.Config.Image}}' "$betrieb_app")"
	# Lokal gebaut heisst das Abbild `versammlung:<tag>`, aus einer Registry
	# `<registry>/<pfad>:<tag>` (VERSAMMLUNG_ABBILD in compose.prod.yml). Der
	# Tag ist der Teil nach dem letzten Doppelpunkt, der Name alles davor.
	TAG="${bild##*:}"
	ABBILD="${bild%:*}"
fi
ABBILD="${ABBILD:-versammlung}"
zufall() { od -An -N24 -tx1 /dev/urandom | tr -d ' \n'; }
{
	echo "VERSAMMLUNG_TAG=$TAG"
	echo "VERSAMMLUNG_ABBILD=$ABBILD"
	echo "POSTGRES_PASSWORD=$(zufall)"
	echo "APP_DB_PASSWORD=$(zufall)"
	echo "VERSAMMLUNG_GEHEIMNIS=$(zufall)"
	echo "VERSAMMLUNG_ERINNERUNG=aus"
	echo "ORIGIN=http://127.0.0.1:3000"
} > "$arbeit/env"
cat > "$arbeit/drill.yml" << 'YAML'
# Vom Drill erzeugt: kein Port nach aussen, kein Weg hinaus.
services:
  app:
    ports: !reset []
networks:
  default:
    internal: true
YAML
stapel=1
log "Wegwerfstapel $PROJEKT mit Abbild $ABBILD:$TAG"
dc up -d --wait --wait-timeout "$FRIST" postgres > /dev/null
# Anlegen ohne Starten: So entsteht die Ablage als Volume des Stapels, und
# `down -v` nimmt sie am Ende sicher mit.
dc create --no-recreate app > /dev/null
datenbank="$(dc ps -q postgres)"
# Nachgesehen, nicht angenommen: Ohne internes Netz könnte die Anwendung auf
# dem zurückgespielten Stand nach aussen sprechen.
[[ "$(docker network inspect -f '{{.Internal}}' "${PROJEKT}_default")" == 'true' ]] ||
	{ log "Das Netz ${PROJEKT}_default ist nicht intern, abgebrochen vor dem ersten Byte"; exit 1; }
werkzeug="$(docker inspect -f '{{.Config.Image}}' "$datenbank")"

entschluessle() { gpg --batch --quiet --decrypt "$s/$1"; }

stufe='Ablage zurückspielen'
entschluessle dateien.tar.gpg |
	timeout -k 30 "$FRIST" docker run --rm -i --init --pull never --network none -v "${PROJEKT}_dateien:/daten" \
		--entrypoint tar "$werkzeug" -C /daten -xpf -

stufe='Rollen zurückspielen'
# «role "versammlung" already exists» ist erwartet; es zählt, ob die Rolle der
# Anwendung danach da ist.
set +e
entschluessle rollen.sql.gpg | dc exec -T postgres psql -q -U versammlung -d postgres > "$arbeit/rollen.log" 2>&1
entschluesselt="${PIPESTATUS[0]}"
set -e
[[ "$entschluesselt" -eq 0 ]] || { log "rollen.sql.gpg ist nicht zu entschlüsseln"; exit 1; }
[[ "$(dc exec -T postgres psql -U versammlung -d postgres -Atc \
	"SELECT count(*) FROM pg_roles WHERE rolname = 'versammlung_app'")" == 1 ]] ||
	{ log "Rolle versammlung_app fehlt nach dem Rückspielen: $(head -c 300 "$arbeit/rollen.log")"; exit 1; }

stufe='Datenbank zurückspielen'
entschluessle datenbank.dump.gpg |
	timeout "$FRIST" docker exec -i "$datenbank" pg_restore -U versammlung -d versammlung --exit-on-error
sql() { dc exec -T postgres psql -U versammlung -d versammlung -AtX -c "$1"; }
zurueck="$(sql 'SELECT name FROM schema_migration ORDER BY name DESC LIMIT 1')"
[[ "$zurueck" == "$migration" ]] ||
	{ log "Zurückgespielt ist Migration $zurueck, die Sicherung nennt $migration"; exit 1; }

stufe='Anwendung starten'
# Migrationsschritt und Anwendung wie im Betrieb; der Migrationsschritt setzt
# das Kennwort der Anwendungsrolle, das bewusst nicht in der Sicherung lag.
dc up -d --wait --wait-timeout "$FRIST" app > /dev/null
log "Anwendung auf dem zurückgespielten Stand gesund"

# ── Die Wirkung: jedes Siegel gegen die zurückgespielte Ablage ─────────────
stufe='Siegel prüfen'
# Ein Wort statt eines Wahrheitswerts: `boolean || text` ergibt `true`, nicht `t`,
# und ein Vergleich auf das falsche Wort fände jedes Manifest falsch.
sql "SELECT package_hash || ' ' ||
            CASE WHEN manifest_hash = encode(sha256(convert_to(manifest, 'UTF8')), 'hex')
                 THEN 'gleich' ELSE 'anders' END
       FROM seal ORDER BY sealed_at" > "$arbeit/siegel"
anzahl="$(wc -l < "$arbeit/siegel")"
# Die Zeitstempelantwort liegt ebenfalls unter ihrer Prüfsumme in der Ablage,
# ebenso jedes eingespielte Abschlusspaket (`einspielen.ts`); dieses hat keine
# Zeile in `seal`.
sql "SELECT timestamp_hash FROM seal WHERE timestamp_hash IS NOT NULL" > "$arbeit/stempel"
sql "SELECT package_checksum FROM imported_meeting" > "$arbeit/eingespielt"
nachtraege="$(sql "SELECT count(*) FROM minutes_version WHERE seal_hash IS NOT NULL
                     AND seal_hash IS DISTINCT FROM encode(sha256(convert_to(seal_manifest, 'UTF8')), 'hex')")"
[[ "$nachtraege" == 0 ]] ||
	{ log "$nachtraege Nachtragssiegel tragen nicht die Prüfsumme ihres Manifests"; exit 1; }
if (( anzahl == 0 )) && [[ ! -s "$arbeit/eingespielt" ]]; then
	befund="Nichts zu prüfen: Die Sicherung $neueste enthält keine versiegelte und keine eingespielte Versammlung. Zurückspielen und Start sind geprüft, die Ablage nicht."
else
	awk '$2 != "gleich"' "$arbeit/siegel" > "$arbeit/manifest-falsch"
	[[ ! -s "$arbeit/manifest-falsch" ]] ||
		{ log "$(wc -l < "$arbeit/manifest-falsch") Manifeste tragen nicht die Prüfsumme ihres Siegels"; exit 1; }
	# Die Ablage legt unter der Prüfsumme ab, zwei Ebenen tief (`dateien.ts`).
	{ awk '{ print $1 }' "$arbeit/siegel"; cat "$arbeit/stempel" "$arbeit/eingespielt"; } | sort -u > "$arbeit/soll"
	awk '{ h = $1; print "/daten/dateien/" substr(h, 1, 2) "/" substr(h, 3, 2) "/" h }' "$arbeit/soll" |
		timeout -k 30 "$FRIST" docker run --rm -i --init --pull never --network none -v "${PROJEKT}_dateien:/daten:ro" \
			--entrypoint xargs "$werkzeug" sha256sum > "$arbeit/gerechnet" 2> "$arbeit/gerechnet.log" || true
	# Gleich ist, wessen Inhalt die Prüfsumme trägt, unter der er liegt.
	awk '{ n = split($2, p, "/"); if (p[n] == $1) print $1 }' "$arbeit/gerechnet" | sort -u > "$arbeit/gut"
	gut="$(wc -l < "$arbeit/gut")"
	soll="$(wc -l < "$arbeit/soll")"
	if (( gut != soll )); then
		log "Nur $gut von $soll Dateien (Abschlusspakete, Zeitstempel, eingespielte Pakete) kommen mit ihrer Prüfsumme aus der Ablage." \
			"Abweichend, die ersten drei: $(comm -23 "$arbeit/soll" "$arbeit/gut" | head -3 | tr '\n' ' ')" \
			"$(head -c 200 "$arbeit/gerechnet.log")"
		exit 1
	fi
	log "$anzahl Siegel, $(wc -l < "$arbeit/stempel") Zeitstempel, $(wc -l < "$arbeit/eingespielt") eingespielte Pakete, $soll Dateien: jede kommt mit ihrer Prüfsumme aus der zurückgespielten Ablage"
fi
stufe='geprüft'
