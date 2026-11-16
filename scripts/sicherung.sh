#!/usr/bin/env bash
#
# Tägliche Sicherung des Betriebsstapels: Datenbank und Dateiablage zusammen
# (AD-17), verschlüsselt am Entstehungsort, mit Prüfsummen und Aufbewahrung.
#
# **Entschieden am 15.10.2026** (Auftraggeber, Auftrag M6, nach der Empfehlung
# aus N1): automatisch täglich, beides zusammen, verschlüsselt,
# SHA-256-Manifest, 30 Tage, Gotify bei Fehlschlag. Nicht gelöst und eigene
# Pendenzen: eine Kopie ausser Haus und ein geübter Rückspieltest nach Takt.
#
# **Seit dem 16.10.2026 beides** (Auftrag F1): `SICHERUNG_KOPIE` kopiert die
# Ordner nach jedem gelungenen Lauf an ein zweites Ziel, und
# `scripts/rueckspieldrill.sh` spielt die neueste Sicherung von dort zurück.
#
# **Verschlüsselt schon hier**, wie bei immotool und CMMS: Die Sicherung liegt
# auf der Platte des Wirts und wandert mit dessen eigener Sicherung weiter. Auf
# dem Wirt liegt nur der öffentliche Schlüssel; ohne den privaten lässt sich
# nichts zurückspielen, und genau so soll es sein.
#
# **Erst die Datenbank, dann die Ablage.** Die Anwendung legt eine Datei ab,
# bevor eine Zeile auf sie zeigt (`src/lib/server/dateien.ts`). Wer in dieser
# Reihenfolge sichert, hat zu jedem neu angelegten Verweis im Auszug die Datei
# im Archiv. **Die Grenze:** Das Löschen nach Frist (`aufbewahrung.ts`) und das
# Entfernen von Waisen (`abgabe.ts`) löschen erst die Zeile, dann die Datei.
# Fällt das zwischen Auszug und Archiv, fehlt im Archiv eine Datei, deren Zeile
# im Auszug noch steht; getroffen ist dann nur, was ohnehin wegfallen sollte.
#
# **Die Rollen kommen mit, ohne Kennwörter.** `pg_dump` nimmt die Rolle
# `versammlung_app` nicht mit, auf die Rechte und Zeilenschutz verweisen. In
# einem frischen Cluster bräche das Rückspielen an jeder dieser Stellen ab.
#
# **Nicht in der Sicherung:** die Env-Datei mit `VERSAMMLUNG_GEHEIMNIS`. Ohne
# dasselbe Geheimnis sind die in der Oberfläche hinterlegten Zugangsschlüssel
# nach dem Rückspielen unlesbar (`docs/installation.md`, «Sichern»).
#
# Aufruf aus `/etc/cron.d/versammlung-sicherung`. Von Hand ebenso, der Lauf
# legt je Aufruf ein eigenes Verzeichnis an:
#
#   SICHERUNG_EMPFAENGER=<fingerabdruck> scripts/sicherung.sh
#
# Rückspielen: `docs/installation.md`, Abschnitt «Sichern».
set -euo pipefail
# Was hier entsteht, liest nur root.
umask 077

# Leer erlaubt bis nach der Falle: Mit `:?` bräche ein Lauf ohne Empfänger ab,
# bevor er melden kann. Geprüft wird unten, zusammen mit der Form.
EMPFAENGER="${SICHERUNG_EMPFAENGER:-}"
ZIEL="${SICHERUNG_ZIEL:-/var/backups/versammlung}"
PROJEKT="${SICHERUNG_PROJEKT:-versammlung-prod}"
TAGE="${SICHERUNG_TAGE:-30}"
FRIST="${SICHERUNG_FRIST:-3600}"
# Vorgabe im Heimverzeichnis des Aufrufers, ohne Anführungszeichen, damit die Tilde
# auch ohne gesetztes HOME aufgelöst wird (Cron, Aufruf in einen Container).
export GNUPGHOME=${SICHERUNG_GNUPGHOME:-~/.gnupg-versammlung-sicherung}
# Gotify ohne Vorgabe: Adresse und Tokendatei sind Belegungen des Hosts und
# stehen in dessen Zeitplan (Betriebsdoku des Dienstes). Fehlt eine, bleibt der
# Lauf ungemeldet und sagt das im Protokoll und im Journal.
GOTIFY_URL="${GOTIFY_URL:-}"
GOTIFY_TOKENDATEI="${GOTIFY_TOKENDATEI:-}"
# Zweites Ziel, leer heisst keines. Ein rsync-Ziel, das auf `:` oder `/` endet,
# gewöhnlich ein Konto, das dort nur `rrsync` in ein Verzeichnis darf
# (`root@wirt:`).
KOPIE="${SICHERUNG_KOPIE:-}"
KOPIE_SCHLUESSEL=${SICHERUNG_KOPIE_SCHLUESSEL:-~/.ssh/versammlung-kopie}

lauf="$(date +%F_%H%M%S)"
ordner="$ZIEL/$lauf"
unfertig="$ordner.unfertig"
# Fünf Stände, damit die Meldung sagt, was wirklich geschah.
stufe='begonnen'

log() { echo "$(date '+%F %T') $*"; }

# **Jeder Lauf, der das Ende nicht erreicht, meldet sich.** Nicht nur der, der
# an einer bestimmten Stelle scheitert: Ein Melder, der nur bekannte Fehler
# kennt, schweigt beim unbekannten.
melden() {
	local rc=$?
	# Ohne das bräche ein scheiterndes `logger` die Falle ab, und ausgerechnet
	# im Fehlerfall ginge keine Meldung hinaus.
	set +e
	[[ -n "${leer:-}" ]] && rmdir "$leer" 2> /dev/null
	[[ "$stufe" == 'fertig' ]] && return 0
	local was
	if [[ "$stufe" == 'gesichert' ]]; then
		was="Sicherung $lauf liegt vor, aber die Aufbewahrung scheiterte (Code $rc)"
	elif [[ "$stufe" == 'aufbewahrt' ]]; then
		was="Sicherung $lauf liegt vor, aber die Kopie ans zweite Ziel scheiterte (Code $rc)"
	elif [[ "$stufe" == 'kopiert' ]]; then
		was="Sicherung $lauf liegt vor und ist kopiert, aber die Aufbewahrung am zweiten Ziel scheiterte (Code $rc)"
	else
		was="Sicherung $lauf nicht fertig (Code $rc)"
	fi
	log "ABBRUCH: $was"
	logger -t versammlung-sicherung "Abbruch: $was"
	if [[ -z "$GOTIFY_URL" || -z "$GOTIFY_TOKENDATEI" ]]; then
		log "GOTIFY_URL oder GOTIFY_TOKENDATEI nicht gesetzt, also ungemeldet"
		logger -t versammlung-sicherung "GOTIFY_URL oder GOTIFY_TOKENDATEI nicht gesetzt"
		return 0
	fi
	if [[ ! -s "$GOTIFY_TOKENDATEI" ]]; then
		log "Kein Gotify-Token unter $GOTIFY_TOKENDATEI, also ungemeldet"
		logger -t versammlung-sicherung "kein Gotify-Token unter $GOTIFY_TOKENDATEI"
		return 0
	fi
	# Der Token über die Standardeingabe, nicht als Argument: Er stünde sonst
	# in der Prozessliste des Wirts. Die Kennung aus der Antwort ins Protokoll:
	# Nur sie belegt, dass die Meldung angekommen ist.
	local antwort
	antwort="$(printf 'header = "X-Gotify-Key: %s"\n' "$(tr -d '\r\n' < "$GOTIFY_TOKENDATEI")" |
		curl -sS --max-time 15 --fail -K - "$GOTIFY_URL/message" \
			-F 'title=Votum-Sicherung fehlgeschlagen' \
			-F "message=$was, auf $(hostname). Protokoll: /var/log/versammlung-sicherung.log" \
			-F 'priority=8' 2>&1)"
	if [[ "$antwort" =~ \"id\":([0-9]+) ]]; then
		log "Gotify-Meldung abgesetzt, Nachricht ${BASH_REMATCH[1]}"
	else
		log "Gotify-Meldung NICHT abgesetzt: ${antwort:0:200}"
		logger -t versammlung-sicherung 'Gotify-Meldung nicht abgesetzt'
	fi
}
trap melden EXIT
# Ein Signal ruft die Falle sonst mit Code 0 auf, und die Meldung sagte «Code 0».
trap 'exit 143' TERM
trap 'exit 130' INT

# Früh prüfen, was sich früh prüfen lässt, aber nach der Falle: Ein falscher
# Wert in der Cron-Zeile soll den ersten Lauf laut anhalten, nicht jede Nacht
# still oder erst nach der Sicherung an der Aufbewahrung scheitern.
[[ "$TAGE" =~ ^[0-9]+$ && "$FRIST" =~ ^[0-9]+$ ]] ||
	{ log "SICHERUNG_TAGE und SICHERUNG_FRIST müssen ganze Zahlen sein"; exit 1; }
[[ -z "$KOPIE" || "$KOPIE" == *: || "$KOPIE" == */ ]] ||
	{ log "SICHERUNG_KOPIE muss auf : oder / enden, sonst zielt der Vergleich daneben"; exit 1; }
[[ "$KOPIE" != *:* || -r "$KOPIE_SCHLUESSEL" ]] ||
	{ log "SICHERUNG_KOPIE ist gesetzt, aber $KOPIE_SCHLUESSEL ist nicht lesbar"; exit 1; }

# **Ein Lauf zur Zeit.** Hängt einer, scheitert der nächste hier laut, statt
# still daneben zu laufen. Ohne diese Sperre sähe ein hängender Lauf aus wie
# Ruhe, denn gemeldet wird nur am Ende.
mkdir -p "$ZIEL"
chmod 700 "$ZIEL"
exec 9> "$ZIEL/.sperre"
flock -n 9 || { log "Ein anderer Lauf hält die Sperre $ZIEL/.sperre, hängt er?"; exit 1; }

# Ein Fingerabdruck, kein Name: Ein Name passt auf jeden Schlüssel, der ihn
# trägt, auch auf einen später untergeschobenen.
[[ "$EMPFAENGER" =~ ^[0-9A-F]{40}$ ]] || { log "SICHERUNG_EMPFAENGER fehlt oder ist kein Fingerabdruck (40 Hexzeichen, gross)"; exit 1; }
# Die Kennungen aller Schlüssel, an die verschlüsselt werden kann: der
# Hauptschlüssel oder, wie gpg es gewöhnlich anlegt, ein Unterschlüssel.
kennungen="$(gpg --batch --with-colons --list-keys "$EMPFAENGER" |
	awk -F: '($1 == "pub" || $1 == "sub") && $12 ~ /e/ { print $5 }')"
[[ -n "$kennungen" ]] || { log "Schlüssel $EMPFAENGER kann nicht verschlüsseln"; exit 1; }

# Genau ein Container je Dienst. Ein Einmalcontainer aus `compose run` trägt
# dieselben Merkmale und gehört nicht gesichert.
einer() {
	local treffer
	treffer="$(docker ps -q --filter "label=com.docker.compose.project=$PROJEKT" \
		--filter "label=com.docker.compose.service=$1" --filter 'label=com.docker.compose.oneoff=False')"
	[[ -n "$treffer" ]] || { log "Kein laufender Dienst $1 im Projekt $PROJEKT" >&2; return 1; }
	[[ "$(wc -l <<< "$treffer")" -eq 1 ]] || { log "Mehr als ein Dienst $1 im Projekt $PROJEKT" >&2; return 1; }
	echo "$treffer"
}
datenbank="$(einer postgres)"
anwendung="$(einer app)"
ablage="${PROJEKT}_dateien"
docker volume inspect "$ablage" > /dev/null
# Für `tar` das Abbild der laufenden Datenbank: Es liegt sicher vor, und
# `--pull never` hält einen Cronlauf davon ab, still etwas aus dem Netz zu
# holen.
werkzeug="$(docker inspect -f '{{.Config.Image}}' "$datenbank")"
abbild="$(docker inspect -f '{{.Config.Image}}' "$anwendung")"
migration="$(docker exec "$datenbank" psql -U versammlung -d versammlung -Atc \
	'SELECT name FROM schema_migration ORDER BY name DESC LIMIT 1')"
[[ -n "$abbild" && -n "$migration" ]] || { log "Abbild oder Migration nicht feststellbar"; exit 1; }

verschluesseln() {
	gpg --batch --yes --trust-model always --encrypt --recipient "$EMPFAENGER" --output "$1"
}

mkdir -m 700 "$unfertig"
log "Sicherung $lauf beginnt (Projekt $PROJEKT)"

timeout "$FRIST" docker exec "$datenbank" pg_dumpall -U versammlung --roles-only --no-role-passwords |
	verschluesseln "$unfertig/rollen.sql.gpg"
# `--lock-wait-timeout`: Ein `timeout` beendet nur den Docker-Client, der
# `pg_dump` im Container liefe weiter und hielte seine Sperren, bis eine
# Migration daran hängt (gemessen 15.10.2026). So gibt er selbst auf.
timeout "$FRIST" docker exec "$datenbank" pg_dump -U versammlung -Fc \
	--lock-wait-timeout=600s versammlung |
	verschluesseln "$unfertig/datenbank.dump.gpg"
# `--init` und `-k`: `tar` als erster Prozess im Container überhört SIGTERM,
# und `timeout` allein wartete dann ohne Ende (gemessen 15.10.2026).
timeout -k 30 "$FRIST" docker run --rm --init --pull never --network none -v "$ablage:/daten:ro" \
	--entrypoint tar "$werkzeug" -C /daten -cf - . |
	verschluesseln "$unfertig/dateien.tar.gpg"

# Was ohne Schlüssel lesbar bleibt, ist nur der Stand, keine Daten. Abbild und
# Migration braucht, wer zurückspielt: Ein älteres Abbild liefe auf einem
# neueren Schema.
{
	echo "zeitpunkt=$(date -Is)"
	echo "projekt=$PROJEKT"
	echo "abbild=$abbild"
	echo "migration=$migration"
	echo "empfaenger=$EMPFAENGER"
} > "$unfertig/stand.txt"

# **Selbstprobe**, bevor der Lauf als fertig gilt: Jede Datei ist nicht leer und
# an diesen Schlüssel verschlüsselt. Geprüft am Paket selbst, nicht am
# Rückgabewert von gpg.
for teil in rollen.sql.gpg datenbank.dump.gpg dateien.tar.gpg; do
	[[ -s "$unfertig/$teil" ]] || { log "$teil ist leer"; exit 1; }
	# Ohne privaten Schlüssel endet `gpg --list-packets` mit Code 2, auch wenn
	# es den Empfänger richtig nennt; unter `pipefail` sähe das aus wie ein
	# falscher Empfänger. Deshalb erst die Ausgabe, dann der Vergleich.
	pakete="$(gpg --batch --list-packets "$unfertig/$teil" 2>/dev/null || true)"
	gefunden=''
	while read -r k; do
		grep -q "keyid $k" <<< "$pakete" && gefunden=1
	done <<< "$kennungen"
	[[ -n "$gefunden" ]] || { log "$teil ist nicht an $EMPFAENGER verschlüsselt"; exit 1; }
done

(cd "$unfertig" && sha256sum rollen.sql.gpg datenbank.dump.gpg dateien.tar.gpg stand.txt > SHA256SUMS)
mv -T "$unfertig" "$ordner"
stufe='gesichert'
log "Sicherung fertig: $ordner ($(du -sh "$ordner" | cut -f1))"

# Aufbewahrung, und erst nach einer gelungenen Sicherung: Scheitert die neue,
# bleiben die alten alle stehen. Nur Verzeichnisse, die dieses Skript angelegt
# hat (Name aus Datum und Zeit), auch abgebrochene. `-mtime +30` heisst: ab
# dem 31. vollen Tag.
find "$ZIEL" -mindepth 1 -maxdepth 1 -type d -name '20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]_*' \
	-mtime +"$TAGE" -print -exec rm -rf {} +
stufe='aufbewahrt'

# **Zweites Ziel**, aber kein Spiegel: Neues kommt hinzu, gelöscht wird dort
# nur, was nach seinem Namen älter ist als die Aufbewahrung und zwei Tage
# mehr; hier zählt `-mtime` volle Tage ab der Änderungszeit, dort zählt der
# Name, und erst mit zwei Tagen Abstand löscht das Ziel sicher später. Was hier fehlt, löscht dort nichts. Ein Spiegel mit
# `--delete` leerte die Kopie, sobald dieses Verzeichnis leer geräumt ist, und
# eine Löschgrenze (`--max-delete`) löscht erst bis zur Grenze und meldet
# danach (Codeprüfung F1, 16.10.2026). Teilordner und die Sperre bleiben hier.
# Die Verschlüsselung reist mit; am Ziel liegt nichts, was ohne den privaten
# Schlüssel lesbar wäre, ausser `stand.txt`.
if [[ -n "$KOPIE" ]]; then
	fern=(ssh -i "$KOPIE_SCHLUESSEL" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=30)
	timeout "$FRIST" rsync -a --exclude='*.unfertig' --exclude='.sperre' -e "${fern[*]}" "$ZIEL/" "$KOPIE"
	# Der Beleg am Ende, nicht der Rückgabewert: Der neue Ordner wird am Ziel
	# über seinen Inhalt verglichen. Jede Zeile hier ist eine Abweichung.
	abweichung="$(timeout "$FRIST" rsync -a -n -c -i -e "${fern[*]}" "$ordner/" "$KOPIE$lauf/")"
	[[ -z "$abweichung" ]] || { log "Kopie von $lauf weicht ab: ${abweichung:0:200}"; exit 1; }
	log "Kopie: $KOPIE$lauf, Inhalt gleich"
	stufe='kopiert'

	# Die Namen tragen Datum und Zeit dieses Wirts und sortieren wie die Zeit.
	grenze="$(date -d "-$((TAGE + 2)) days" +%F_%H%M%S)"
	liste="$(timeout "$FRIST" rsync --list-only -e "${fern[*]}" "$KOPIE")"
	alt="$(awk '$1 ~ /^d/ { print $NF }' <<< "$liste" |
		grep -E '^20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]_[0-9]{6}$' | awk -v g="$grenze" '$0 < g' || true)"
	if [[ -n "$alt" ]]; then
		# rrsync kennt kein `rm`. Gelöscht wird mit einem leeren Ordner als
		# Quelle, und nur, was die Filter einschliessen; alles andere schützt
		# der Ausschluss vor `--delete`.
		filter=()
		while read -r d; do filter+=("--include=/$d/***"); done <<< "$alt"
		leer="$(mktemp -d)"
		timeout "$FRIST" rsync -r --delete "${filter[@]}" --exclude='*' -e "${fern[*]}" "$leer/" "$KOPIE"
		rmdir "$leer"
		leer=''
		log "Am Ziel nach Aufbewahrung gelöscht: $(tr '\n' ' ' <<< "$alt")"
	fi
fi

stufe='fertig'
log "Ende"
