#!/usr/bin/env bash
#
# Erzeugt den öffentlichen Stand von Votum für den Spiegel auf Codeberg
# (Entscheid 0051, Codeberg-Plan Schritt 3).
#
#   scripts/spiegel-stand.sh <commit> <ziel>
#
# **Was es tut, in dieser Reihenfolge:**
#
#   1. `git archive <commit>` in `<ziel>`, ein leeres Verzeichnis ausserhalb
#      des Repos. Was `.gitattributes` dieses Commits mit `export-ignore`
#      nennt, fehlt darin (die beiden Sperrlisten, interne Prüfberichte und
#      Arbeitspapiere, `.gitea/`).
#   2. Prüft, dass jeder dort genannte Pfad fehlt, auch Muster mit `*`
#      (über `compgen -G`), und eine feste Mindestliste dazu.
#   3. `gitleaks dir` über den Stand, mit `--redact`: Ein Fund bricht ab,
#      ohne dass sein Wert im Protokoll steht.
#   4. Den Personendaten-Wächter des Stands mit der Sperrliste aus dem
#      internen Repo, auf einer Wegwerfkopie: Die Liste kommt nie in `<ziel>`.
#   5. Einen Commit «Stand <kurz>» in `<ziel>`, mit neutralem Autor und dem
#      Datum des Commits, damit weder ein Hostname noch die Uhrzeit des
#      Laufs im Autorfeld steht (Befund vom 24.09.2026). Mit
#      `SPIEGEL_VORGAENGER=<url oder pfad>` schliesst er an den letzten Commit
#      des Spiegels an (nur ein Spiegel: Commits des internen Repos oder
#      fremde Autoren brechen ab); der Push geht dann ohne `--force`, und ein früherer
#      Stand bleibt auffindbar (`SECURITY.md` nennt ihn). Ohne die Variable ist
#      er ein neuer Anfang, gedacht nur für den ersten Stand.
#   6. Mit `SPIEGEL_TAG=<Abbild-Tag>` einen annotierten Tag gleichen Namens auf
#      diesen Commit, Nachricht «Votum <tag>», neutraler Autor, Datum des
#      Commits (Entscheid 0053: die Version ist der Abbild-Tag). Der Tag muss
#      auf `<commit>` enden, sonst Abbruch. Mit `SPIEGEL_VORGAENGER` ist er
#      Pflicht (ohne nur mit `SPIEGEL_OHNE_TAG=1`). Gepusht wird er eigens:
#      `git push <url> main refs/tags/<tag>`.
#
# **Kein Push.** Der Push ist ein eigener Schritt (Plan, Schritt 5), nach
# einem Blick auf den Stand.
#
# **Warum `git archive` und nicht ein Push des internen Zweigs.** Die
# Geschichte vor dem 27.10.2026 trägt echte Namen
# (`docs/veroeffentlichung-personendaten.md`), und `export-ignore` gilt nur
# für Archive, nicht für einen Push.
#
# Autor einstellbar über `SPIEGEL_AUTOR_NAME` und `SPIEGEL_AUTOR_EMAIL`.

set -euo pipefail

entpackt=''
fertig=''
kopie=''
abbruch() {
	echo "spiegel-stand: $*" >&2
	exit 1
}
# **Aufräumen bei jedem Ende ohne Erfolg**, auch wenn `set -e` einen Befehl
# abbricht oder jemand Ctrl-C drückt: Das Ziel war leer, was darin liegt, ist von
# diesem Lauf und taugt nicht als Stand. Wegräumen, damit niemand einen halben
# Stand pusht und der nächste Lauf nicht an «nicht leer» scheitert.
aufraeumen() {
	local rc=$?
	[[ -n "$kopie" ]] && rm -rf "$kopie"
	if [[ -n "$entpackt" && -z "$fertig" ]]; then
		find "$ziel" -mindepth 1 -delete
		echo "spiegel-stand: ${ziel} wieder geleert." >&2
	fi
	exit "$rc"
}
trap aufraeumen EXIT
trap 'exit 130' INT TERM

[[ $# -eq 2 ]] || abbruch "Aufruf: scripts/spiegel-stand.sh <commit> <ziel>"
commit="$1"
ziel="$2"

repo="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
voll="$(git -C "$repo" rev-parse --verify --quiet "${commit}^{commit}")" || abbruch "«${commit}» ist kein Commit in ${repo}."
kurz="$(git -C "$repo" rev-parse --short=8 "$voll")"
# Der Tag wird vor allen Scans geprüft (Entscheid 0053): Ein falscher bricht ab, bevor
# etwas entsteht. Ohne «-lokal», denn ein Stand aus einem abweichenden Baum ist kein
# Commit, und der Commit im Tag muss dieser sein.
# **Pflicht für jeden Stand mit Vorgänger** (Codeprüfung 16.11.2026): README und
# Handbuch versprechen den Stand jeder Version unter ihrem Tag. Ohne Tag nur mit
# `SPIEGEL_OHNE_TAG=1`, ausdrücklich.
if [[ -n "${SPIEGEL_VORGAENGER:-}" && -z "${SPIEGEL_TAG:-}" && "${SPIEGEL_OHNE_TAG:-}" != 1 ]]; then
	abbruch "Ein Stand mit Vorgänger braucht SPIEGEL_TAG=<Abbild-Tag> (oder ausdrücklich SPIEGEL_OHNE_TAG=1)."
fi
if [[ -n "${SPIEGEL_TAG:-}" ]]; then
	[[ "$SPIEGEL_TAG" =~ ^[0-9]{8}-[0-9]{4}-[0-9a-f]{7,40}$ ]] ||
		abbruch "SPIEGEL_TAG «${SPIEGEL_TAG}» ist kein Abbild-Tag (JJJJMMTT-HHMM-<commit>, ohne «-lokal»)."
	[[ "$voll" == "${SPIEGEL_TAG##*-}"* ]] ||
		abbruch "SPIEGEL_TAG «${SPIEGEL_TAG}» nennt einen anderen Commit als ${kurz}."
fi

# Erst der Ort, dann anlegen: Ein Ziel im Repo soll nicht als Verzeichnis zurückbleiben.
ziel="$(realpath -m "$ziel")"
case "${ziel}/" in
	"${repo}/"*) abbruch "Das Ziel ${ziel} liegt im Repo; es gehört ausserhalb." ;;
esac
mkdir -p "$ziel"
[[ -z "$(ls -A "$ziel")" ]] || abbruch "Das Ziel ${ziel} ist nicht leer."

command -v gitleaks > /dev/null || abbruch "gitleaks fehlt; ohne den Scan geht kein Stand hinaus."
command -v node > /dev/null || abbruch "node fehlt; ohne den Personendaten-Wächter geht kein Stand hinaus."
sperre="${repo}/scripts/personendaten-sperre.tsv"
[[ -s "$sperre" ]] || abbruch "Die Sperrliste ${sperre} fehlt im internen Repo."

# Der Vorgänger vor dem Scan: Ein Pfad gilt vom Aufrufort aus (`git -C "$ziel"` läse
# ihn sonst vom Ziel aus), und was nicht erreichbar ist, bricht gleich ab.
vorg="${SPIEGEL_VORGAENGER:-}"
if [[ -n "$vorg" ]]; then
	if [[ "$vorg" != *://* && -e "$vorg" ]]; then vorg="$(realpath "$vorg")"; fi
	git ls-remote --exit-code -q "$vorg" refs/heads/main > /dev/null 2>&1 ||
		abbruch "Der Vorgänger ${vorg} hat keinen Zweig main oder ist nicht erreichbar."
fi

# 1. Der Stand aus dem Archiv.
entpackt=1
git -C "$repo" archive --format=tar "$voll" | tar -x -C "$ziel"
echo "Stand ${kurz} nach ${ziel} entpackt: $(find "$ziel" -type f | wc -l) Dateien."

# 2. Was ausgeschlossen ist, muss fehlen. Ohne `.gitattributes` liefert `git show`
# einen Fehler, und `pipefail` beendete das Skript ohne Meldung; deshalb `|| true`.
ausgeschlossen="$( (git -C "$repo" show "${voll}:.gitattributes" 2> /dev/null || true) | awk '!/^#/ && /export-ignore/ {print $1}')"
[[ -n "$ausgeschlossen" ]] || abbruch "Die .gitattributes von ${kurz} nennt nichts mit export-ignore; ohne Ausschlüsse ginge die Sperrliste mit."
while IFS= read -r pfad; do
	[[ -z "$pfad" ]] && continue
	if [[ "$pfad" == *[*?[]* ]]; then
		# Ein Muster: Ungequotet würde es im Ziel aufgelöst; `compgen -G` findet jeden Treffer.
		! compgen -G "${ziel}/${pfad%/}" > /dev/null || abbruch "${pfad} trifft im Stand etwas, obwohl .gitattributes es ausschliesst."
	else
		[[ ! -e "${ziel}/${pfad%/}" ]] || abbruch "${pfad} steht im Stand, obwohl .gitattributes es ausschliesst."
	fi
done <<< "$ausgeschlossen"
# Dazu eine Mindestliste, unabhängig von der .gitattributes des Commits: Ein älterer
# Commit mit kürzerer Liste trüge sonst die Prüfberichte (Sicherheitsprüfung, 15.11.2026).
# Die Arbeitspapiere seit dem Bereinigen für Codeberg (Codeprüfung zu Schritt 3b, M2): Ein
# Commit davor trüge das Freigabeprotokoll mit Angaben zum Betrieb.
# Die beiden Prüfskripte mit Daten Dritter (Sicherheitsprüfung 15.11.2026, A2).
for pfad in scripts/personendaten-sperre.tsv scripts/betriebsangaben-sperre.json docs/audit docs/ausit docs/pendenzen-sicherheit.md \
	docs/befunde-sicherheitsdurchgang-2026-10-09.md .gitea docs/freigabe.md docs/proben.md docs/pendenzen.md \
	docs/veroeffentlichung-personendaten.md docs/pruefung e2e/nirgendweg.mjs e2e/nirgendwerk.mjs; do
	[[ ! -e "${ziel}/${pfad}" ]] || abbruch "${pfad} steht im Stand; dieser Commit schliesst es nicht aus (nimm einen neueren)."
done
echo "Ausgeschlossen und abwesend: $(grep -c . <<< "$ausgeschlossen") Pfade."

# 3. Geheimnisse.
gitleaks dir "$ziel" --no-banner --redact --exit-code 1 > /dev/null 2>&1 || abbruch "gitleaks meldet einen Fund im Stand; nachsehen mit «gitleaks dir ${ziel} --redact»."
echo "gitleaks ohne Fund."

# 4. Personendaten, mit der internen Sperrliste auf einer Wegwerfkopie.
kopie="$(mktemp -d)"
cp -a "${ziel}/." "$kopie/"
cp "$sperre" "${kopie}/scripts/personendaten-sperre.tsv"
node "${kopie}/scripts/check-personendaten.mjs" "$kopie" || abbruch "Der Personendaten-Wächter meldet etwas im Stand."
rm -rf "$kopie"
kopie=''

# 5. Der Commit «Stand <kurz>».
datum="$(git -C "$repo" show -s --format=%cI "$voll")"
export GIT_AUTHOR_NAME="${SPIEGEL_AUTOR_NAME:-PocketLab}"
# Vorgabe ohne echtes Postfach und ohne Host (Personendaten-Wächter: nur `.invalid` u. ä.).
export GIT_AUTHOR_EMAIL="${SPIEGEL_AUTOR_EMAIL:-votum@spiegel.invalid}"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
export GIT_AUTHOR_DATE="$datum"
export GIT_COMMITTER_DATE="$datum"
git -C "$ziel" -c init.defaultBranch=main init -q
# Ein frisches `git init` hat keinen Hookpfad (gesetzt ist er nur lokal im internen Repo).
git -C "$ziel" add -A
baum="$(git -C "$ziel" write-tree)"
eltern=()
if [[ -n "$vorg" ]]; then
	git -C "$ziel" fetch -q "$vorg" main || abbruch "Der Vorgänger ${vorg} lässt sich nicht holen."
	vorher="$(git -C "$ziel" rev-parse FETCH_HEAD)"
	# **Nur ein Spiegel taugt als Vorgänger** (Codeprüfung, Durchgang 2): Wer aus
	# Versehen das interne Repo angibt, hinge dessen ganze Geschichte samt Sperrliste
	# an den Stand, und der Push ginge ohne Warnung durch. Abbruch, wenn der Commit im
	# internen Repo vorkommt oder ein Commit seiner Geschichte nicht vom Spiegel
	# stammt (Autor des Spiegels, Nachricht «Stand <hash>»).
	if git -C "$repo" cat-file -e "${vorher}^{commit}" 2> /dev/null; then
		abbruch "Der Vorgänger ${vorg} ist das interne Repo oder trägt dessen Commits; er gehört nicht unter einen Stand."
	fi
	fremd="$(git -C "$ziel" log --format='%ae%x09%ce%x09%s' "$vorher" |
		awk -F'\t' -v a="$GIT_AUTHOR_EMAIL" '!($1 == a && $2 == a && $3 ~ /^Stand [0-9a-f]+$/)' | head -1)"
	[[ -z "$fremd" ]] || abbruch "Der Vorgänger ${vorg} trägt einen Commit, der nicht vom Spiegel stammt: «${fremd//$'\t'/, }»."
	eltern=(-p "$vorher")
fi
neu="$(git -C "$ziel" commit-tree "$baum" "${eltern[@]}" -m "Stand ${kurz}")"
git -C "$ziel" update-ref refs/heads/main "$neu"
git -C "$ziel" reset -q
# **Der Tag des Stands ist die Version** (Entscheid 0053): `SPIEGEL_TAG=<Abbild-Tag>`
# setzt einen annotierten Tag gleichen Namens auf den Commit, Nachricht «Votum <tag>»,
# mit dem neutralen Autor und dem Datum des Commits (beide oben exportiert). Der Tag
# muss zum Commit passen, sonst trüge der Stand die Version eines anderen Codes.
if [[ -n "${SPIEGEL_TAG:-}" ]]; then
	git -C "$ziel" tag -a "$SPIEGEL_TAG" -m "Votum ${SPIEGEL_TAG}" "$neu"
fi
fertig=1
echo "Commit $(git -C "$ziel" log -1 --format='%h «%s», %an <%ae>, %cI' main) in ${ziel}$([[ ${#eltern[@]} -gt 0 ]] && echo ", nach $(git -C "$ziel" rev-parse --short FETCH_HEAD)" || echo ", ohne Vorgänger")$([[ -n "${SPIEGEL_TAG:-}" ]] && echo ", Tag ${SPIEGEL_TAG}"). Nicht gepusht$([[ -n "${SPIEGEL_TAG:-}" ]] && echo "; Push mit dem Tag: git -C ${ziel} push <url> main refs/tags/${SPIEGEL_TAG}")."
