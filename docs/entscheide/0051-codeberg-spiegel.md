# 0051: Votum als Spiegel auf Codeberg, mit Issues, ohne Beiträge

- **Status:** abgelöst durch [0055](0055-spiegel-auf-github.md) (Spiegel auf GitHub, 16.11.2026)
- **Datum:** 2026-11-15
- **Rolle:** Produktentscheid

## Wortlaut

Aus dem Produktentscheid vom 15.11.2026 zum Quellcode der eigenen Werkzeuge
(PocketLab, `docs/entscheide/0002-quellcode-je-werkzeug.md`):

> «Mir ist wichtig, wenn wir selbst entwickeln, dass Vertrauen aufgebaut wird, in dem wir unseren Quellcode zeigen.»

> «Ich würde sonst nur Votum auf Codeberg laden. Als Testlauf. ImmoPortal erst zusammen mit Immotool.»

Zu den Issues im Spiegel, am selben Tag (`.auftraege/2026-11-15-votum-codeberg-plan.md`,
«Was der Spiegel ist»):

> «weil wenn was gefunden wird, kann man den Issues melden»

## Anlass

Votum muss nach Entscheid 0037 kein Quellarchiv veröffentlichen, weil der ganze
Code dem Haus gehört. Der Produktentscheid will ihn trotzdem zeigen, und Votum
ist das erste Werkzeug, das dafür auf Codeberg geht. Offen war, wie der
öffentliche Stand entsteht, ohne die interne Geschichte, die Sperrliste des
Personendaten-Wächters und die internen Prüfberichte mitzunehmen.

## Was gilt

- **Gitea bleibt führend**, mit Geschichte, Sperrliste und CI. Codeberg ist ein
  Spiegel ohne Beiträge (Infra `adr/0011-trunk-based-zweige-als-ausnahme.md`):
  Pull Requests und Wiki aus, Issues an.
- **Der öffentliche Stand** entsteht mit `scripts/spiegel-stand.sh <commit> <ziel>`:
  `git archive` in ein leeres Verzeichnis ausserhalb des Repos, dort geprüft
  und als ein Commit «Stand `<commit>`» festgehalten. Was `.gitattributes` mit
  `export-ignore` nennt, fehlt darin. Gepusht wird ausserhalb des Skripts.
- **Sicherheitslücken** gehören nicht in ein Issue, sondern über das
  Kontaktformular von PocketLab (`SECURITY.md`).
- **Wann neu hochladen:** nach jedem Prod-Ausrollen, mit dem Commit des
  ausgerollten Abbilds und dem Abbild-Tag als Tag (Entscheid 0053). Seit dem
  16.11.2026 als eigener Schritt nach dem Ausrollen, nicht im Ausrollen selbst:
  mit dem Skill `codeberg-spiegel`, der den Stand erzeugt, den Unterschied
  gegenprüfen lässt, pusht und nachmisst (Produktentscheid 16.11.2026, nach
  fünf Ständen von Hand). Der erste Stand brauchte einen Commit, der `.gitea/`
  schon ausschliesst (Mindestliste des Skripts).
- **Ein Stand schliesst an den vorigen an** (`SPIEGEL_VORGAENGER=<url oder pfad
  des Spiegels>` beim Skript; das interne Repo als Vorgänger bricht ab): Der Push geht ohne `--force`, und ein früherer Stand, den jemand in
  einer Meldung nennt, bleibt auffindbar. Nur der erste Stand hat keinen
  Vorgänger.

Entscheid 0037 bleibt: Er sagt, dass Votum kein Quellarchiv braucht, nicht, dass
es keins zeigen darf.

## Alternativen

- Alle drei Werkzeuge zugleich auf Codeberg: verworfen zugunsten eines Testlaufs
  mit Votum (PocketLab 0002).
- Das interne Repo mit Geschichte spiegeln: verworfen, die Geschichte vor der
  Bereinigung vom 27.10.2026 trägt die echten Namen noch
  (`docs/veroeffentlichung-personendaten.md`).
