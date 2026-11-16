# 0055: Der Spiegel von Votum liegt auf GitHub, mit Issues und Pull Requests

- **Status:** gilt
- **Datum:** 2026-11-16
- **Rolle:** Produktentscheid

## Wortlaut

Aus dem Produktentscheid vom 16.11.2026, nachdem die Nutzungsbedingungen von
Codeberg gelesen waren:

> «dann löschen wir das dort und bleiben auf Github»

Zu Beiträgen, am selben Tag:

> «Pullrequest und co soll auch drauf»

## Anlass

Seit dem 22.07.2026 verbieten die Nutzungsbedingungen von Codeberg, § 2 (1) 7,
Projekte, die «mostly consist of code written by generative AI tools
(including … Claude …)». Votum ist überwiegend so entstanden; nach § 2 (2)
wird ein solcher Inhalt sofort entfernt. Der Spiegel nach Entscheid 0051 lag
seit dem Vormittag desselben Tages dort, mit fünf Ständen und ohne Issues,
Forks oder Sterne.

## Was gilt

- **Ort:** `https://github.com/PocketLab-ch/votum`, öffentlich. Die Org heisst
  `PocketLab-ch`, weil `PocketLab` auf GitHub ein fremdes Konto ist. Die fünf
  Stände von Codeberg sind mit ihren Tags unverändert übernommen (gleiche
  Hashes), damit jede genannte Version auffindbar bleibt und der nächste Stand
  ohne `--force` anschliesst.
- **Gitea bleibt führend**, mit Geschichte, Sperrliste und CI. Der öffentliche
  Stand entsteht weiter mit `scripts/spiegel-stand.sh`, nach jedem
  Prod-Ausrollen, mit dem Abbild-Tag als Tag (Entscheide 0051 und 0053; der
  Ort Codeberg dort ist durch diesen Entscheid ersetzt). Den Ablauf trägt der
  Skill `github-spiegel`.
- **Issues und Discussions an, Wiki und Projects aus.**
- **Pull Requests sind willkommen, gemergt wird auf GitHub nie.** Ein Beitrag
  wird von Hand ins Gitea übernommen, geprüft wie jeder eigene Block, und kommt
  mit dem nächsten Stand zurück. Danach wird der Pull Request mit Verweis auf
  den Tag geschlossen. Ein Beitrag, der nicht übernommen wird, wird mit einer
  kurzen Begründung geschlossen. Der öffentliche Stand trägt weiter den neutralen
  Autor; einzelne Beitragende nennt er nicht. Ein Ruleset sperrt auf `main`
  Löschen, Force-Push und jedes Update ausser über den Zugang des Spiegels.
- **Sicherheitslücken** gehören weiter nicht in ein Issue, sondern über das
  Kontaktformular von PocketLab (`SECURITY.md`).
- Was Entscheid 0051 sonst festhielt (Stand ohne Geschichte, Ausschlüsse aus
  `.gitattributes`, Anschluss an den Vorgänger), gilt unverändert.

## Offen

Vor dem ersten übernommenen Beitrag sind zwei Punkte aus Infra
`adr/0011-trunk-based-zweige-als-ausnahme.md` zu klären: ein abgeschotteter
Prüflauf für fremden Code (ohne Netz und Geheimnisse) und die Rechtsfrage zu
Beiträgen (CLA) in `quellen`.

## Alternativen

- **Auf Codeberg bleiben:** verworfen, die Nutzungsbedingungen schliessen das
  Projekt aus.
- **Ein Anbieter mit Schutz vor KI-Training:** nicht gewählt. Codeberg sperrt
  die Crawler der KI-Anbieter in seiner `robots.txt` aus (`Disallow: /` für
  `GPTBot`, `ClaudeBot`, `CCBot` und weitere, gemessen 16.11.2026; in den
  Nutzungsbedingungen steht dazu nichts). GitHub lässt dieselben Crawler zu
  (`Crawl-delay: 1`). Der Code ist dort öffentlich und kann zum Training
  verwendet werden. Ein Anbieter mit einer Sperre wie Codeberg wurde nicht
  gesucht.
- **Pull Requests sperren:** GitHub lässt sie nicht abschalten, und gewollt
  sind sie ohnehin.

## Verwandt

- Entscheid 0051 (Codeberg-Spiegel), abgelöst
- Entscheid 0053 (Version ist der Abbild-Tag)
- PocketLab `docs/entscheide/0002-quellcode-je-werkzeug.md`
- Interner Plan vom 16.11.2026 zum Umzug
