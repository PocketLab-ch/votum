---
title: Dienste einbinden
description: Authentik, Dateiablage, Zeitquelle, Zeitstempel, KI, Mailausgang und die Übernahme aus immotool
date: 2026-07-31
---

# Dienste einbinden

Die Anwendung läuft vollständig ohne äussere Dienste. Jeder Dienst ist ein
Zusatz, keiner eine Voraussetzung — im Versammlungsraum ohne Internet muss alles
Wesentliche weiter gehen.

## Der Betriebszustand wird gefragt, nicht gesetzt

Es gibt keinen Schalter «offline». Der Zustand ergibt sich daraus, ob die
eingerichteten Dienste antworten. Ein Schalter sagte, was jemand gemeint hat,
als er ihn setzte — nicht, was gerade gilt.

| Zustand | Bedeutung | Anzeige |
|---|---|---|
| **eigenständig** | Kein äusserer Dienst eingerichtet | keine, alles läuft bestimmungsgemäss |
| **verbunden** | Alle eingerichteten Dienste antworten | keine |
| **getrennt** | Ein eingerichteter Dienst antwortet nicht | Band über jeder Seite |

Nur die Störung wird angezeigt, und der Text nennt, was **ohne** den Dienst
trotzdem geht. Sonst legte jemand mitten in der Versammlung los, das Netz zu
reparieren. Der Alleinbetrieb bekommt keine Meldung: Eine, die jeden Tag
dasteht, wird nicht mehr gelesen.

Gefragt werden Authentik, Mailausgang, immotool und — seit dem 14.08.2026 —
**KI-Kette und Zeitstempeldienst**. Bei diesen beiden wird geprüft, **ob das
Haus antwortet, nicht ob der Schlüssel gilt**: Ein echter Modellaufruf bei jedem
Seitenaufbau kostete Geld und Sekunden, ein echter Zeitstempel belastete eine
fremde Stelle für nichts. Ob Schlüssel und Modellname stimmen, sagt der
Prüfknopf unter «Äussere Dienste» — und der ist die richtige Stelle dafür: Man
drückt ihn, wenn man etwas geändert hat.

Bei der KI genügt **eine** antwortende Stufe. Fällt die erste aus, weicht die
Kette aus; das als Störung zu melden hiesse, die Ausweichung als Fehler zu
lesen.

## Authentik als zusätzlicher Anmeldeweg

Authentik ist ein **zweiter** Weg herein, nie der einzige. Die lokale Anmeldung
bleibt offen, auch wenn Authentik erreichbar ist. Fiele der Dienst mitten in der
Versammlung aus, käme sonst niemand mehr herein.

### In Authentik einrichten

1. Legen Sie einen **Provider** vom Typ *OAuth2/OpenID* an.
2. Client-Typ: **Confidential**.
3. Redirect-URI: `https://<ihr-host>/anmelden/authentik/zurueck`
4. **`sub_mode` auf die unveränderliche Benutzer-UUID stellen** (in Authentik
   *User UUID*), nicht auf die E-Mail-Adresse. Adressen ändern sich und werden
   neu vergeben; daran geknüpft öffnet eine Anmeldung irgendwann die falsche
   Tür. Der Eigentümerzugang vergleicht später gegen genau diese UUID.
5. **`grant_types` auf das Nötige beschränken:** `authorization_code` und
   `refresh_token`. Ein Fluss, den niemand benutzt, ist eine Tür, die niemand
   bewacht.
6. Notieren Sie Issuer-URL, Client-ID und Client-Secret.
7. Verbinden Sie den Provider mit einer **Application** und geben Sie sie den
   Personen frei, die eine Versammlung führen dürfen.

> **Wer einen bestehenden Provider als Vorlage klont, erbt seine Einstellungen** —
> und die passen nicht unbedingt. Am 20.08.2026 kamen aus der Vorlage
> `sub_mode = user_email`, sieben `grant_types` und ein fremder Anmeldefluss mit.
> Nichts davon wäre aufgefallen: Die Anmeldung hätte funktioniert, nur die
> spätere Zuordnung nie gepasst.

### In der Anwendung eintragen

```bash
AUTHENTIK_ISSUER=https://auth.example.ch/application/o/versammlung/
AUTHENTIK_CLIENT_ID=…
AUTHENTIK_CLIENT_SECRET=…
```

Bleibt eines der drei Felder leer, erscheint der Knopf gar nicht.

**Im Container kommt nur an, was Compose durchreicht.** Bis zum 20.08.2026
standen die drei Zeilen zwar in `compose.prod.yml`, aber nicht in
`docker-compose.yml` — wer sie in die `.env` des Entwicklungsstapels schrieb,
sah den Knopf trotzdem nie und suchte den Fehler bei Authentik.

### Hinter einem Reverse-Proxy

Zwei Dinge, die dort nötig sind und beide wie ein Proxy-Fehler aussehen:

- **`ORIGIN` setzen.** Der Proxy spricht die Anwendung intern über `http` an;
  ohne `ORIGIN` baut sie den Rückweg daraus — und Authentik weist
  `http://…/zurueck` ab, weil dort `https://…/zurueck` eingetragen ist. Im
  Entwicklungsserver wirkt `ORIGIN` nur auf die Adressbildung (Rückweg,
  QR-Codes, Zugangskarten); im Betrieb prüft `adapter-node` zusätzlich die
  Herkunft jeder Anfrage.
- **Den Namen in `VITE_ERLAUBTE_NAMEN` eintragen** (in der `.env`, durch
  Kommas getrennt; `vite.config.ts` liest daraus `server.allowedHosts`). Vite weist seit Fassung 6 jeden unbekannten `Host`
  mit `403` und `text/plain` ab — die Antwort sieht aus, als käme sie vom
  Proxy. Nur der Entwicklungsserver; im Betrieb gibt es diese Prüfung nicht.

### Wie ein Konto zugeordnet wird

**Ein Konto entsteht dabei nicht von selbst.** Wer eine Versammlung führen darf,
entscheidet die Bewirtschaftung: unter **Betreiber → Konten** oder über
`scripts/benutzer-anlegen.mjs`.

Beim Anmelden sucht die Anwendung in dieser Reihenfolge:

1. Ein Konto, das bereits mit dieser Authentik-Kennung (`sub`) verknüpft ist.
2. Sonst ein Konto mit **derselben E-Mail-Adresse**, das noch keine Kennung
   trägt und für das die Verknüpfung gerade offensteht. Dabei entsteht sie.

Danach zählt allein die Kennung. Ein umbenanntes Konto in Authentik findet
seinen Weg weiterhin, und eine später geänderte Adresse führt niemanden mehr
irgendwohin.

### Das Fenster für die erste Anmeldung

**Warum die Adresse nicht dauerhaft gilt.** Sie ist bequem, aber in Authentik
darf jeder Angemeldete sie selbst ändern, solange `default_user_change_email` am
Tenant das erlaubt. Stünde sie
dauerhaft als Anker offen, genügte das: Wer irgendein Konto im Verzeichnis hat,
setzt seine Adresse auf die einer Verwaltung, deren hiesiges Konto noch keine
Kennung trägt, meldet sich an und hat dieses Konto samt seiner Rolle.

Deshalb gilt die Adresse nur in einem Fenster von **14 Tagen**:

| Handlung | Was mit dem Fenster geschieht |
|---|---|
| Konto **mit** Adresse anlegen | geht auf |
| Konto **ohne** Adresse anlegen | bleibt zu, es gibt keinen Anker |
| Adresse später eintragen | öffnet **nicht**, die Verwaltung öffnet bewusst |
| Adresse ändern oder entfernen | geht zu — es stand für die alte Adresse offen, nicht für das Konto |
| «Erste Anmeldung öffnen» in der Kontenliste | geht auf, wieder 14 Tage |
| Erste Anmeldung gelingt | geht zu, ab jetzt zählt die Kennung |

Den Stand zeigt die Kontenliste je Zeile: «erste Anmeldung offen bis …», «mit
Authentik verknüpft», «Anmeldefenster abgelaufen» oder «ohne Adresse». Ein
abgelaufenes Fenster ist kein Schaden, sondern ein Knopfdruck.

**Ein Konto ausser Dienst kommt auf keinem Weg herein**, auch bei offenem
Fenster. Das Ausserdienststellen ist der stärkere Griff.

### Die Verknüpfung wieder lösen

**Zwei Wege, je nachdem wer löst** (Vorgabe des Auftraggebers, 16.09.2026):

| Wer | Wo | Was mit den Sitzungen geschieht |
|---|---|---|
| Die Verwaltung, für jedes Konto | Betreiber → Konten, Kasten «Anmeldung über Authentik» | **alle** enden |
| Jeder für sein eigenes Konto | Mein Konto | die übrigen enden, die eigene bleibt |

Der Unterschied ist Absicht und folgt derselben Abwägung wie beim Kennwort: Wer
eine fremde Verknüpfung löst, tut das im Zweifel, weil die Identität dahinter
nicht mehr stimmt — dann muss auch die laufende Sitzung weg. Wer sein eigenes
Konto aufräumt, soll sich dabei nicht selbst hinauswerfen.

**Das Anmeldefenster geht dabei nicht wieder auf.** Sonst wäre das Lösen
unbemerkt zugleich eine Freigabe für die nächste Person, die diese Adresse
trägt. Wer neu verknüpfen will, öffnet die erste Anmeldung eigens.

**Eine gelöste Kennung kehrt nur zu ihrem eigenen Konto zurück.** Wer an einem
Konto **im Dienst** löst, hinterlässt eine Spur (`app_user.oidc_subject_zuletzt`);
diese Kennung kommt danach über den Adressweg an kein anderes Konto mehr. Der
Grund steht in `migrations/112_geloeste_kennung.sql`: Solange eine Kennung
gesetzt ist, trägt sie ihren Besitzer zwingend ins eigene Konto — erst das Lösen
macht aus dieser stillen Schranke einen Knopf, den der Betroffene selbst drückt.
Ohne die Spur könnte sich eine Sitzungsleitung entkoppeln, in Authentik die
Adresse eines frisch angelegten Verwaltungskontos eintragen und dessen Rolle
übernehmen.

Wer versehentlich gelöst hat, kommt trotzdem zurück: An **dasselbe** Konto darf
die Kennung wieder, sobald die Verwaltung das Fenster öffnet.

**Beim Lösen an einem Konto ausser Dienst unterbleibt die Spur**, und das ist
kein Widerspruch. Ausser Dienst stellen kann nur die Verwaltung, und niemand
sich selbst; ein Lösen dort ist also immer eine bewusste Handlung an einem toten
Konto. Die Kennung muss dann weiterziehen dürfen, sonst bekäme ein Mensch nach
dem Weggang nie wieder ein verknüpftes Konto — der Index über `oidc_subject` ist
über alle Betreiber eindeutig.

> **Ein Konto ohne Kennwort lässt sich nicht lösen.** Es kennt dann keinen
> zweiten Weg herein, und ohne Kennung wäre es nicht gesperrt, sondern
> unerreichbar — niemand sähe warum. Solche Konten gibt es absichtlich (siehe
> «Ein reines Authentik-Konto braucht kein Kennwort» weiter oben); sie tragen in
> der Liste die Marke «nur zentrale Anmeldung». Wer sie loswerden will, stellt
> sie ausser Dienst: Das ist umkehrbar und sagt, was es tut — **und danach lässt
> sich die Verknüpfung auch ohne Kennwort lösen**, damit die Kennung nicht für
> immer an einer stillgelegten Zeile hängt.

**Vergebliche Versuche stehen im Verlauf des Kontos.** Wer sich unter der
hinterlegten Adresse anzumelden versucht, während das Fenster zu ist, erscheint
dort als «Erstverknüpfung abgewiesen» samt Grund. Das ist kein Buchhaltungseifer:
Ohne diesen Eintrag kostet ein Fehlversuch nichts, und aus «jemand müsste das
Fenster treffen» würde «jemand muss nur warten».

> **Die Grenze dieses Verfahrens, offen gesagt.** Die Adresse ist ein Merkmal,
> das der Anmeldende in Authentik selbst setzen kann. Das Fenster macht den
> Missbrauch schwer und sichtbar, es macht ihn nicht unmöglich. Wer die Schranke
> härter braucht, hat zwei Wege: `default_user_change_email` am Tenant auf
> `False` stellen (wirkt auf alle Anwendungen am selben Tenant) oder die Erstverknüpfung um
> ein Einmalgeheimnis ergänzen, das die Verwaltung der Person auf einem zweiten
> Weg gibt. Das Einmalgeheimnis baut Votum bewusst **nicht**; das Fenster ist
> der gewählte Weg.

### Wenn jemand heiratet

Name und Adresse ändert die Verwaltung in der Kontenliste, und beim Anmelden
über Authentik zieht die Anwendung beides von dort nach. **Bereits geschriebene
Protokolle und Verläufe bleiben unberührt:** `audit_entry.actor_label` und
`minutes.created_by_label` halten den Namen als Text fest, wie er zur Zeit der
Handlung galt. Wer im März gehandelt hat, heisst dort weiterhin, wie er damals
hiess — das ist bei einem Protokoll der Zweck und keine Nachlässigkeit.

**Ein reines Authentik-Konto braucht kein Kennwort.** `benutzer-anlegen.mjs`
verlangt zwar eines, aber es lässt sich danach entfernen
(`UPDATE app_user SET password_hash = NULL WHERE username = …`). Die lokale
Anmeldung weist ein solches Konto ab; hinein kommt es nur über Authentik. Das
ist die sauberere Lage als ein Kennwort, das niemand kennt und niemand ändert.

### Wenn Authentik nicht antwortet

Die Anmeldeseite prüft die Erreichbarkeit beim Öffnen, mit Zeitlimit. Antwortet
Authentik nicht, weicht sie mit Hinweis auf die lokale Anmeldung aus, und die
Nutzung dieser Rückfallebene steht im Verlauf. Im Versammlungsraum ohne Netz
steht die Antwort in zwei Sekunden fest.

### Eigentümerzugang über Authentik

**Beides steht seit dem 20.08.2026: die Kennung kommt von selbst an, und der
Anmeldeweg ist gebaut.** Bis dahin war zwar die Ablage vorhanden
(`person.authentik_subject`, Migration 030), aber leer — der einzige Weg, sie zu
füllen, wäre Handarbeit gewesen, und die veraltet genau dann, wenn sie zählt:
beim Eigentümerwechsel. Jetzt liefert immotool die Authentik-User-UUID je
Eigentümer mit, und die Übernahme legt sie an der Partei ab (siehe
[Die Authentik-Kennung](#die-authentik-kennung-seit-20082026) weiter unten).

**Der Anmeldeweg:** Auf `/z` erscheint neben dem
Eingabefeld für den Code der Knopf «Mit meinem Konto anmelden» — sofern
Authentik eingerichtet ist. Was dann geschieht:

| Lage | Was passiert |
|---|---|
| Kennung steht im festgehaltenen Stand einer offenen Versammlung | Zugang und Gerätesitzung entstehen, die Person landet in der **Warteliste** |
| Kennung ist dort nicht eingetragen | Meldung, kein Zugang — eine Kennung erzeugt keine Berechtigung |
| Zwei offene Versammlungen zu derselben Kennung | Rückfrage statt Zuteilung |
| Für diese Partei ist bereits ein Gerät angemeldet | Abgewiesen, nicht verdrängt — wie beim Kartencode |

Die Freigabe bleibt bei der Sitzungsleitung. Der Weg erscheint überall als
**«über eigenes Konto»** (`access_session.origin` und `attendance_event.channel`
tragen `authentik`), damit im Protokoll unterscheidbar bleibt, was verschieden
ist.

Was noch fehlt:

1. Die **Klammer zur Person** — sie setzt bis heute ein Mensch
   («Vorschlagen, nicht setzen»), weil ein falscher Treffer jemandem Zutritt zu
   einer fremden Versammlung gäbe. Mit einer Kennung statt eines Namens ist der
   Vorschlag hart genug, um ihn anzubieten. Bis dahin führt der Weg über
   `party.authentik_subject` aus der Übernahme.
2. Der **QR auf dem Telefon**, den die Sitzungsleitung scannt — dann entfällt
   auch das Abtippen am Eingang.

Im Saal führt der Weg bis dahin über die persönliche Zugangskarte. Und auch
danach gilt: **Das Stimmrecht folgt aus dem festgehaltenen Stand, nie aus
einer Kennung oder einer Gruppe.** Ein Konto überlebt den Verkauf einer Wohnung
(in immotool 90 Tage Karenz), ein festgehaltener Stand nicht.

## Die Dateiablage

```bash
VERSAMMLUNG_DATEIEN=/daten/dateien
```

Hier liegen Nutzniessungsverträge, Anträge und später das Abschlusspaket. Der
Dateiname ist die Prüfsumme des Inhalts; unter einem Namen steht immer genau
dieser Inhalt und nie eine zweite Fassung.

Geschrieben wird atomar (F3, 15.10.2026): erst eine Teildatei im selben
Verzeichnis (Endung `.teil`), dann umbenennen auf den Endnamen. Ein Abbruch
mitten im Schreiben lässt deshalb nie eine halbe Datei unter dem
Prüfsummennamen stehen, sondern höchstens eine liegengelassene Teildatei. Sie
stört weder die Ablage noch die Sicherung und wird nicht automatisch
aufgeräumt. Abgelegt wird jedes Mal neu, auch wenn unter dem Endnamen schon
eine Datei liegt; eine beschädigte Datei wird so ersetzt, sobald derselbe
Inhalt wieder abgelegt wird. Von selbst erkannt wird sie nicht.

**Zusammen mit der Datenbank zu sichern, nie getrennt.** Die Datenbank verweist
über die Prüfsumme auf die Datei. Wer nur eines von beidem sichert, hat später
einen Beschluss ohne seine Beilage oder eine Beilage, zu der kein Beschluss mehr
gehört.

## Die Zeitquelle

```bash
VERSAMMLUNG_OFFLINE=true
```

Das schaltet nichts ab und bestimmt den Betriebszustand nicht. Es kennzeichnet
im Verlauf, dass die Uhr ohne Netzabgleich lief. Eine Uhr ohne Abgleich kann
falsch gehen, und im Streitfall muss das erkennbar sein.

Setzen Sie es auf dem Notebook im Versammlungsraum, nicht auf dem Server.

## Zwei Wege, etwas einzurichten

Seit dem 14.08.2026 lassen sich **KI-Kette und Zeitstempeldienst in der
Anwendung** einrichten: «Betreiber → Äussere Dienste», der Verwaltung
vorbehalten. Vorher ging beides nur über Umgebungsvariablen, und das hatte zwei
Folgen, die im Betrieb weh taten:

- Ein Modellwechsel verlangte Zugriff auf den Server und einen **Neustart** des
  Containers — der trifft alle, auch eine laufende Versammlung.
- Der **Zustand war nirgends zu sehen.** Ein abgelaufener Zugangsschlüssel fiel
  niemandem auf, bis im Saal jemand auf «Vorschlag holen» drückte.

| | in der Anwendung | in der Umgebung |
|---|---|---|
| Wirkt | sofort | nach Neustart |
| Zugangsschlüssel | verschlüsselt in der Datenbank | im Klartext in einer Datei |
| Zustand sichtbar | ja, mit Prüfknopf | nein |
| Braucht | `VERSAMMLUNG_GEHEIMNIS` (nur für Schlüssel) | Serverzugriff |

**Die Anwendung hat Vorrang, gemischt wird nie.** Steht dort etwas, gilt es;
steht dort nichts, gilt die Umgebung. Beides zusammenzuhängen ergäbe eine Kette,
deren Reihenfolge niemand angeordnet hat — und beim Ausfall der ersten Stufe
fragte die Anwendung ein Haus, von dem der Betreiber nicht mehr weiss, dass es
eingetragen ist.

Solange die Umgebung gilt, lässt sich in der Anwendung **nichts anlegen**: Eine
einzelne neue Stufe würde die geltende Kette schlagartig ersetzen. Der Weg führt
über «In die Anwendung übernehmen» — danach stehen dieselben Stufen dort und
lassen sich einzeln ändern. Die Einträge in der Umgebung können stehen bleiben.

### Das Geheimnis für Zugangsschlüssel

```bash
openssl rand -hex 32     # → VERSAMMLUNG_GEHEIMNIS
```

Zugangsschlüssel liegen mit AES-256-GCM verschlüsselt in der Datenbank. Ohne
`VERSAMMLUNG_GEHEIMNIS` lässt sich alles Übrige eintragen, **Schlüssel aber
nicht** — sie kämen sonst im Klartext in jede Sicherungskopie. Die Oberfläche
sagt das vor dem Ausfüllen.

Was das leistet und was nicht: Geschützt ist der Weg über einen
**Datenbankauszug** — und das ist der Weg, über den solche Schlüssel tatsächlich
abhandenkommen. Wer den laufenden Server hat, hat beides; das ist die Grenze des
Verfahrens, kein Mangel der Umsetzung. Deshalb: **getrennt sichern.** Liegen
Auszug und Geheimnis am selben Ort, ist die Verschlüsselung eine Verzierung.

Geht das Geheimnis verloren, sind die abgelegten Schlüssel nicht mehr lesbar.
Das hält nichts auf: Die Stufe kommt ohne Schlüssel zurück, scheitert beim
Anruf und sagt dort, was fehlt.

## Der Zeitstempeldienst

In der Anwendung unter «Betreiber → Äussere Dienste», oder über die Umgebung:

```bash
VERSAMMLUNG_ZEITSTEMPEL_URL=https://freetsa.org/tsr
VERSAMMLUNG_ZEITSTEMPEL_NAME=freetsa.org
VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE=32:E8:41:…:FC
```

Ein Zeitstempel nach RFC 3161 bezeugt, dass das **Siegel** eines
Abschlusspakets zu einem bestimmten Zeitpunkt bereits vorlag. Er sagt nichts
darüber, ob der Inhalt richtig ist — nur, dass er damals schon so aussah. Genau
das lässt sich später nicht mehr nachstellen.

Ohne Eintrag wird versiegelt, aber nicht bezeugt. Das Siegel gilt trotzdem; die
Lücke steht am Paket und als offener Punkt auf der Übersicht.

**Heften Sie das Zertifikat an.** Ohne die Fingerabdrücke prüft die Anwendung
zwar die Signatur, aber nicht, wer sie geleistet hat — sie nähme dann jede
Antwort an, die unter der eingestellten Adresse ausgeliefert wird.

**Der einfache Weg: «Prüfzeitstempel holen».** Die Anwendung stempelt einen
Zufallswert, zeigt den Fingerabdruck des Unterzeichners und bietet einen Knopf
zum Anheften. Genau deshalb gibt es ihn: Den Abdruck von Hand zu beschaffen —
eine Antwort besorgen, drei `openssl`-Aufrufe durch eine Pipe — macht in der
Praxis niemand, und ohne ihn fehlt die Sicherung still. Gestempelt wird auf
einen Zufallswert und nicht auf ein Siegel, damit die Probe nichts bezeugt, was
später als Beleg gelesen werden könnte.

Von Hand, wenn Sie eine Antwort schon haben:

```bash
openssl ts -reply -in zeitstempel.tsr -token_out \
  | openssl pkcs7 -inform der -print_certs \
  | openssl x509 -noout -fingerprint -sha256
```

Beide Schreibweisen werden angenommen — mit Doppelpunkten und ohne. Abgelegt
wird immer die Doppelpunktform in Grossbuchstaben, denn dagegen wird später
verglichen. Ein Abdruck in der anderen Schreibweise sähe richtig aus und passte
nie; der Zeitstempel gälte als «nicht angeheftet», und niemand fände den Grund.

**Welcher Dienst.** freetsa.org ist frei und für Entwicklung und Abnahme gut
genug. Wer vor Gericht damit argumentieren will, nimmt einen **nach ZertES
anerkannten** Anbieter. Anerkannt sind (Stand 08/2026, Liste beim BAKOM):
**DigiCert Switzerland AG, SIGN8 AG, SwissSign AG, Swisscom (Schweiz) AG**
sowie das BIT für die Bundesverwaltung. **Sectigo ist nicht darunter** — die
frühere Fassung dieses Absatzes nannte es fälschlich, korrigiert am 22.08.2026
nach der Rechtsprüfung (`rechtspruefung-siegel-2026-08-22.md`, Befund B-3).
Ausländische Anbieter helfen nicht weiter: Qualifizierte Zertifikate aus der EU
werden in der Schweiz nicht automatisch anerkannt; ein Verhandlungsmandat dazu
ist seit dem 29.01.2025 in Arbeit, ohne Zeitplan.

Im Betrieb ist DigiCert der Hauptdienst und freetsa der Ersatz
(Produktentscheid 13.11.2026, Abschnitt «Der Ersatzdienst» unten).

**Was der Wechsel bringt — und was nicht.** Keine gesetzliche Vermutung: Die
Gleichstellung mit der eigenhändigen Unterschrift (OR Art. 14 Abs. 2bis) setzt
eine **qualifizierte Signatur** voraus und greift nur dort, wo das Gesetz
Schriftlichkeit verlangt. Für das Versammlungsprotokoll verlangt ZGB Art. 712n
Abs. 2 **keine Form**. Was der anerkannte Anbieter bringt, ist Aufsicht,
Haftung (ZertES Art. 17), Prüfbarkeit durch Dritte und eine Ausstellungspflicht
(Art. 13) — alles Gewicht bei der freien Beweiswürdigung (ZPO Art. 157), keine
Beweisregel.

**Wohin die Anfrage geht.** freetsa.org trägt im Zertifikat Würzburg, der Name
löst aber auf `2607:9d00::/32` auf — ARIN führt den Bereich auf **RackNerd LLC,
Kalifornien**. Die Anfrage geht also in die **Vereinigten Staaten**, nicht nach
Deutschland. Übermittelt wird allein der SHA-256 über das Manifest; nach
hiesiger Einschätzung ist das kein Personendatum, weil der Eingaberaum eine
Umkehrung ausschliesst. **Die Einschätzung hält nur unter dieser Bedingung:**
Wer je den Abdruck über ein einzelnes, inhaltsarmes Dokument stempelt — «Vollmacht
von A für B» —, macht daraus ein rekonstruierbares und damit personenbezogenes
Datum. Gestempelt wird deshalb ausschliesslich der Siegel-Abdruck.

Der Wechsel
kostet nichts: Alte Pakete behalten ihren alten Stempel, und das Prüfwerkzeug
sagt bei einem fremden Aussteller, dass er heute nicht hinterlegt ist, statt das
Paket zu verwerfen.

**Ein Fall verdient trotzdem Aufmerksamkeit: der nachgeholte Stempel über einen
Wechsel hinweg.** Seit dem 22.09.2026 schreibt das Versiegeln die Stelle ins
Paket — sofern ihr Zertifikat angeheftet ist; ohne Anheftung gibt es keine
Erwartung, die mitreisen könnte. Wechseln Sie den Dienst, während für eine Versammlung noch ein
Zeitstempel aussteht, nennt das Paket die **alte** Stelle und der nachgeholte
Stempel kommt von der neuen. Das Prüfwerkzeug erkennt den Fall an der Herkunft
des Stempels — nachgeholte werden getrennt eingereicht — und meldet ihn als
gewöhnlichen Hinweis statt als Widerspruch. Sauberer ist es dennoch, offene
Zeitstempel **vor** dem Wechsel nachzuholen; die Übersicht führt sie als offene
Punkte.

**Jeder Anlauf wird vollständig geprüft** — Abdruck, Zufallswert, Signatur,
Gültigkeit des Zertifikats zum bezeugten Zeitpunkt, Anheftung. Besteht er die
Prüfung nicht, wird **wiederholt**: bis zu drei Anläufe mit einer und zwei
Sekunden Pause, jeder mit frischem Zufallswert. Ein Lastverteiler, der einen
schlechten Knoten erwischt, kostet damit nichts weiter; ohne Wiederholung bliebe
das Siegel unbezeugt, und bemerkt würde es erst, wenn jemand die Übersicht
liest. Brauchte es mehr als einen Anlauf, steht das am Siegel — ein wackelnder
Dienst soll sich nicht wie ein reibungsloser lesen.

Weist der Dienst die **Anfrage** ab, wird nicht wiederholt: Das ändert sich
durch Klopfen nicht und verzögerte bloss das Versiegeln.

**Klappt es endgültig nicht**, steht der Grund am Siegel. Die Anwendung
unterscheidet dabei zwei Fälle, und der Unterschied ist der Punkt:

| Zustand | Was er heisst |
|---|---|
| **ausstehend** | Der Dienst war nicht erreichbar. Nachholen, sobald wieder Verbindung besteht. |
| **gescheitert** | Der Dienst hat abgelehnt, oder die Antwort hielt der Prüfung nicht stand. Das geht nicht von selbst weg — hinschauen. |

Nachgeholt wird von Hand, auf der Siegelseite. Kein Auftrag, der nachts läuft:
Wer abschliesst, soll sehen, ob die Bezeugung geklappt hat.

### Der Ersatzdienst (13.11.2026)

Neben dem Hauptdienst lässt sich ein **Ersatzdienst** eintragen: dieselbe
Maske, ein zweiter Kasten darunter. Er springt ein, wenn der Hauptdienst keinen
**geprüften** Stempel liefert: unerreichbar, abgewiesen, oder sein Zertifikat
ist nicht angeheftet. Dann bezeugt der Ersatz das Siegel.

| | Hauptdienst | Ersatzdienst |
|---|---|---|
| Einstellbar in | Anwendung und Umgebung | **nur Anwendung** |
| Gefragt | immer zuerst | erst nach dem Hauptdienst |
| Anläufe | bis zu drei | genau einer |
| Anheftung | eigene Liste | eigene Liste |

**Warum es ihn gibt.** Der Anlass ist eine Eigenschaft der Anheftung: Sie ist
streng, und das ist ihr Zweck. DigiCert wechselt sein Unterzeichnerzertifikat
von Zeit zu Zeit; der Name trägt die Jahreszahl, derzeit «DigiCert SHA256
RSA4096 Timestamp Responder 2026 1». Nach einem Wechsel weist die Anwendung
**jeden** DigiCert-Stempel ab, bis jemand den neuen Abdruck anheftet; im
Zweifel merkt es niemand, bis ein Siegel ohne Bezeugung dasteht. Der Ersatz
schliesst genau dieses Fenster, ohne die Prüfung irgendwo weicher zu machen:
Es kommt eine zweite, ebenso geprüfte Stelle dazu.

**Jeder Dienst prüft gegen seine eigene Liste.** Ein Abdruck, der beim
Hauptdienst hinterlegt ist, deckt den Ersatz nicht, und umgekehrt. Wer den
einen anheftet, ändert am anderen nichts.

**Ohne angeheftetes Zertifikat wird der Ersatz nicht gefragt.** Sonst nähme
die Anwendung jede Antwort an, die unter seiner Adresse ausgeliefert wird.
Weil DigiCert über `http` läuft, könnte jemand im Netzweg den Hauptdienst
gezielt scheitern lassen; die Ausweichung darf dann nicht die schwächere
Prüfung sein. Am Siegel steht der Grund, wenn der Ersatz deshalb ausblieb.

**Ohne Hauptdienst kein Ersatz.** Steht nur der Ersatz da, meldet die
Anwendung weiter «kein Zeitstempeldienst hinterlegt» und fragt niemanden. Der
Ersatz ist eine Ausweichung und keine zweite erste Stelle.

**Was am Siegel steht.** Springt der Ersatz ein, nennt die Bemerkung beide:
«Bezeugt durch Free TSA (Ersatz); der Hauptdienst DigiCert scheiterte: …».
Scheitern beide, stehen beide Gründe da. Der Zustand folgt dem Ersatzanlauf.

**Was das Paket nennt.** Das Manifest führt seit dem 13.11.2026 neben der
Stelle des Hauptdienstes auch die des Ersatzes, mit beiden Zertifikaten. Der
Ersatz steht dort, sobald für ihn ein Zertifikat angeheftet ist, auch wenn der
eingetragene Hauptdienst selbst keinen Abdruck hat. Sonst meldete die Seite
«Prüfen» einen Stempel des Ersatzes als Widerspruch im Paket, «dafür gibt es
keine harmlose Erklärung», und das wäre im Fall des Einspringens schlicht
falsch. Zwei Grenzen: Ein Ersatz ohne angeheftetes Zertifikat steht nicht im
Paket, weil er nie gefragt wird. Und ohne eingetragenen Hauptdienst steht auch
der Ersatz nicht da, weil dann niemand gefragt wird.

Nach einem Zertifikatswechsel bei DigiCert bleibt der **alte** Abdruck
angeheftet. Das Manifest nennt dann diesen alten Abdruck und den Ersatz; der
beigelegte Stempel stammt vom Ersatz, wenn er eingesprungen ist; scheiterte
auch er, liegt keiner bei.

Umgekehrt: Ist der Hauptdienst eingetragen, aber ohne Abdruck, und nur der
Ersatz angeheftet, stempelt im Regelfall der Hauptdienst. Sein Aussteller
steht dann in keiner Liste des Pakets; die Seite «Prüfen» wertet das nicht als
Widerspruch, weil das Paket für den Hauptdienst keinen bestimmten Aussteller
erwartet.

**Die Umgebung kennt keinen Ersatz.** `VERSAMMLUNG_ZEITSTEMPEL_*` beschreibt
den Hauptdienst; ein Ersatz dort wäre eine Ausweichung, deren Zustand niemand
sieht. Er wird ausschliesslich in der Anwendung eingetragen und steht mit
Setzen und Entfernen im Verlauf.

**Was einzutragen ist** (Produktentscheid 13.11.2026, «Hauptdienst DigiCert,
freetsa Ersatz»):

| | Hauptdienst | Ersatzdienst |
|---|---|---|
| Adresse | `http://timestamp.digicert.com` | `https://freetsa.org/tsr` |
| Bezeichnung | DigiCert | Free TSA |
| Zertifikat | anheften über «Prüfzeitstempel holen» | ebenso, mit eigener Liste |

Beide Abdrücke entstehen aus der Probe des jeweiligen Dienstes; der Knopf
steht in jedem Kasten und heftet nur an den Dienst an, der gefragt wurde.

## Die KI-Anbindung

**Vorgabe: aus.** Ohne Eintrag bleibt die Anwendung vollständig benutzbar — es
gibt keinen Ablaufschritt, der eine KI voraussetzt.

**Welches Modell Sie befragen, entscheiden Sie.** Die Anwendung schreibt keinen
Anbieter vor. Gesprochen wird OpenAI-kompatibel (`/chat/completions`), und das
bieten praktisch alle: Infomaniak, Mistral, OpenAI — oder ein Modell auf Ihrem
eigenen Rechner, dann verlässt kein Wort das Haus.

### Die Kette

Eingerichtet werden **Stufen**. Stufe 1 wird zuerst gefragt; antwortet sie nicht,
kommt Stufe 2 dran. Wer keine Ausweichung braucht, richtet nur eine ein.

In der Anwendung unter «Betreiber → Äussere Dienste», mit einem **Prüfknopf je
Stufe**: Er ruft genau die an, auf deren Knopf gedrückt wurde — nicht über die
Kette, denn die wiche bei Ausfall aus, und dann meldete die Prüfung «geht» und
gemeint wäre die Nachbarstufe.

**Die Reihenfolge stellen die Pfeile um** (seit 17.08.2026). Eine neue Stufe
kommt ans Ende — eine, die stillschweigend zur ersten würde, wechselte das
Modell, das im Saal antwortet. Wer sie nach vorn holen will, schiebt sie mit
«↑» dorthin; getauscht wird immer mit dem Nachbarn, und die Nummern werden
lückenlos neu vergeben.

Bis dahin liess sich die Reihenfolge **nur beim Anlegen** bestimmen: Das
Änderungsformular fasst Bezeichnung, Adresse, Modell, Geduld und Schlüssel an,
die Nummer nicht. Wer tauschen wollte, musste beide Stufen entfernen und neu
anlegen — und verlor dabei die Zugangsschlüssel, denn angezeigt werden sie nie
wieder. Der Tausch selbst braucht eine **aufschiebbare** Eindeutigkeit
(Migration 065): Er durchläuft zwangsläufig einen Zwischenstand mit zwei
gleichen Nummern, und ein Hilfswert ist nicht zu haben — `position` reicht nur
von 1 bis 9, bei neun Stufen ist keine Nummer frei. Jeder Tausch steht als
eigene Art im Verlauf (`ai.stage.moved`): Wer später fragt, warum ein anderes
Haus im Protokollvermerk steht, sucht genau diesen Eintrag.

Über die Umgebung geht es weiterhin:

```bash
VERSAMMLUNG_KI_1_NAME=Infomaniak (CH)
VERSAMMLUNG_KI_1_URL=https://api.infomaniak.com/2/ai/<produkt>/openai/v1/chat/completions
VERSAMMLUNG_KI_1_MODELL=mistralai/Mistral-Small-4-119B-2603
VERSAMMLUNG_KI_1_SCHLUESSEL=…

VERSAMMLUNG_KI_2_NAME=Mistral (EU/FR)
VERSAMMLUNG_KI_2_URL=https://api.mistral.ai/v1/chat/completions
VERSAMMLUNG_KI_2_MODELL=mistral-small-latest
VERSAMMLUNG_KI_2_SCHLUESSEL=…
```

Andere Möglichkeiten, gleichwertig eingerichtet:

| Wohin | URL | Bemerkung |
|---|---|---|
| OpenAI | `https://api.openai.com/v1/chat/completions` | Inhalte verlassen die Schweiz |
| Lokal (Ollama) | `http://127.0.0.1:11434/v1/chat/completions` | Schlüssel bleibt leer, nichts verlässt das Haus |
| Lokal (llama.cpp, vLLM) | `http://…/v1/chat/completions` | dito |

> **Der NAME steht später im Nachweis** und im Protokollvermerk. Schreiben Sie
> hinein, was ein Leser wissen muss — insbesondere den Standort. Die Anwendung
> kann nicht wissen, wo Ihr Modell steht; sie gibt weiter, was Sie eintragen.

**Ausgewichen wird nur bei Ausfall:** Zeitüberschreitung, nicht erreichbar, 429,
5xx. Nie, weil eine Antwort nicht gefällt — eine Prüfung so lange zu wiederholen,
bis sie passt, wäre das Gegenteil einer Prüfung. Je Stufe ein Versuch; die Kette
ist die Wiederholung. Wer nur eine Stufe einrichtet, bekommt dort zwei Versuche.

**Fällt alles aus**, gibt es einen Hinweis und keinen Abbruch. Kein Ablauf hängt
an der KI.

### Was gemessen wurde

Zeiten sind nicht nebensächlich: Eine Prüfung, die im Saal zwanzig Sekunden
braucht, benutzt niemand. Gegen dieselbe Traktandenprüfung (Stand 05.08.2026,
über Infomaniak):

| Modell | Zeit | Ergebnis |
|---|---|---|
| `mistralai/Mistral-Small-4-119B-2603` | 1,4 s | sauberes JSON, brauchbare Befunde |
| `swiss-ai/Apertus-v1.5-70B` | 1,1 s | sauberes JSON, knapper |
| `mistralai/Ministral-3-14B-Instruct-2512` | 5,2 s | JSON in Zäunen (wird abgeräumt) |
| `google/gemma-4-31B-it` | 26,7 s | brauchbar, aber im Saal unbrauchbar |
| `Qwen/Qwen3.5-122B-A10B-FP8` | — | leerer Inhalt (Reasoning-Modell) |

Messen Sie nach, bevor Sie ein Modell in den Saal lassen. Ein Reasoning-Modell,
das seinen Text in ein anderes Feld legt, gilt der Anwendung als Ausfall der
Stufe — nicht falsch, aber unnötig, wenn ein passendes danebensteht.

### Was hinausgeht — und was vorher unkenntlich gemacht wird

Übermittelt wird **nur, was die jeweilige Prüfung braucht**: bei der
Traktandenprüfung Titel, Inhalt und Antragswortlaut, für den Abgleich auf
Widersprüche zusätzlich die Titel der übrigen Traktanden. Keine Einheiten, keine
Wertquoten, keine Zuordnung zu Personen.

**Jeder Eigentümer hat eine Bezeichnung**, durchnummeriert je Versammlung:
«[Person 1]», «[Person 2]». Wo der Name als **Feld** vorliegt — Antragsteller,
Vertretung, Nutzniesser —, wird gar nicht gesucht, sondern von vornherein diese
Bezeichnung gesetzt. Das ist der verlässliche Teil.

**Im Fliesstext wird zusätzlich gesucht.** «Sanierung Balkon Familie Meier» ist
ein getippter Satz, und dort hilft keine Feldzuordnung. Gesucht wird gegen die
Namen aus dem festgehaltenen Stand, in den Formen, in denen sie wirklich getippt
werden: «Meier», «Familie Meier», «A. Meier», «Meiers Antrag», «Mueller» ohne
Umlaut. Was zurückkommt, ist wieder der Satz von vorher.

Drei Eigenheiten sind Absicht:

- **Eine Person, ein Platzhalter.** «Anna Meier», «Meier», «Frau Meier» und
  «A. Meier» werden alle zu «[Person 4712]». Ein Modell muss erkennen können,
  dass dieselbe Person gemeint ist — Nummern mit Buchstaben dahinter machten das
  schwerer, und ein Modell las «[Person 2b] [Person 2c]» prompt als zwei Leute.
- **Die Nummer wird gerechnet, nicht gezählt.** Sie hängt allein an der Kennung
  der Person. Wird jemand entfernt, nimmt er seine Nummer mit und niemand erbt
  sie — bei fortlaufender Zählung wäre aus einem Meier nach dem Löschen ein Kunz
  geworden. Deshalb sind die Nummern vierstellig und nicht 1, 2, 3.
- **Zurück kommt der erfasste Name.** Es gibt keine Schreibweise mehr, auf die
  man zurückfallen könnte. Im Protokoll ist das die richtigere Angabe — aus
  «Familie Meier» wird «Anna Meier». Die Anrede wandert mit in den Platzhalter,
  sonst stünde dort «Familie Anna Meier»; nebenbei verrät so auch kein «Frau
  [Person 7]» mehr das Geschlecht.
- **Bei Gleichnamigen keine Nummer.** Gibt es zwei Meier, ist «Meier» allein
  «[Name 1]» und keine bestimmte Person; dort kommt die Zeichenfolge zurück,
  die dastand.

> **Der Preis, offen benannt:** Weil der erfasste Name zurückkommt, wäre ein zu
> viel geschütztes Wort nicht mehr harmlos — aus «im winter» würde «im Beat
> Winter». **Einwortige** Formen greifen deshalb nur, wo das Wort gross
> geschrieben steht. Das heisst umgekehrt: «meier hat widersprochen» aus einer
> hastigen Notiz bleibt ungeschützt. Von zwei schlechten Möglichkeiten die, die
> keinen Text beschädigt.

**Die Suche im Fliesstext ist die schwächere Hälfte**, und das wird hier nicht
schöngeredet. Sie übersieht einen Vertippten («Meyer» statt «Meier»), einen
Übernamen und jeden, der in keiner Liste steht — den Nachbarn, den Handwerker,
den Anwalt der Gegenseite. Und sie kann nichts gegen den Satz ausrichten, der
**ohne Namen** eine Person bezeichnet: «der Eigentümer der Attikawohnung» ist in
einer Gemeinschaft mit einer Attikawohnung so eindeutig wie ein Name.

Deshalb die drei Riegel zusammen und nicht die Maskierung allein:

1. Es geht nur hinaus, was die Prüfung **braucht** — keine Einheiten, keine
   Quoten, keine Zuordnung zu Personen.
2. **Vor dem Senden lässt sich ansehen, was hinausgeht.** Wörtlich,
   aufklappbar, jedes Mal — mit der Zahl der ersetzten Namen daneben. Wer dort
   etwas stehen sieht, das nicht hinaus soll, ändert es im Traktandum.
3. Die Gemeinschaft entscheidet, ob überhaupt (Vorgabe: aus) — und der
   Betreiber, wohin. Bei einem Modell auf dem eigenen Rechner verlässt nichts
   davon das Haus.

### Der Weg zurück: was hereinkommt

Die drei Riegel oben regeln, was **hinausgeht**. Der Rückweg hat eine eigene
Frage, und sie wurde im Audit vom 08.08.2026 gestellt: Der geprüfte Text ist
nicht immer der eigene. Ein Traktandum darf von einem Eigentümer stammen, und wer
einen Antrag einreicht, kann darin die Maschine ansprechen.

Der übliche Schaden fällt aus — Svelte setzt Text als Text, an keiner Stelle wird
eine Modellantwort als Auszeichnung eingesetzt, und keine der vier Funktionen
darf etwas ändern.

Beim **Erfordernisvorschlag** kann kein Erfordernis erfunden werden: Das Modell
wählt je Frage aus zwei bis vier vorgegebenen Antworten, den Fall rechnet
danach `laufe()` aus dem Regelwerk. Es kann aber sehr wohl **falsch abbiegen**,
und es gibt zu jedem Schritt eine **Begründung** in freiem Text zurück. Deshalb
steht auch dieser Weg gekennzeichnet da — und deshalb steht über dem Vorschlag
der Satz «Lesen Sie die Antworten, nicht das Ergebnis».

> **Nachtrag vom 08.08.2026.** Der Audit-Bericht desselben Tages führte den
> Erfordernisvorschlag als «Wirkung: keine». Das war zu grosszügig: «kein
> erfundenes Erfordernis» ist nicht dasselbe wie «keine Wirkung». Die Abnahme
> hat es aufgedeckt.

Beim **Protokollentwurf** fällt jeder Absatz durch, der eine Zahl, einen
Platzhalter oder einen Lückentext enthält, die nicht in der Notiz standen. Ein
frei erfundener Name, den das Namensverzeichnis nicht kennt und der deshalb nie
maskiert wurde, fällt dabei **nicht** auf — dagegen hilft nur, den Vorschlag
neben der Notiz zu lesen, und genau so steht er da.

Was bleibt, ist der **Befundtext selbst**: freier Text vor den Augen der
Sitzungsleitung. Dagegen hilft kein Filter — wer weiss, dass gefiltert wird,
formuliert um. Es hilft die Herkunftsangabe: Alles, was ein Modell formuliert
oder gewählt hat, steht in einem Kasten mit Balken und der Beschriftung
**Antwort von …**. Alles ausserhalb hat die Anwendung gerechnet.

### Wo eingerichtet wird

«Betreiber → Äussere Dienste» — Stufe hinzufügen, ändern, aus der Kette nehmen,
Verbindung prüfen. Der Verwaltung vorbehalten, **auch das Lesen**: Hier steht,
wohin Inhalte der Versammlung hinausgehen; das ist eine Auskunft über die
Aussenwege, keine Stammdatenliste.

**Solange die Kette aus der Umgebung gilt, steht dort nur «Verbindung prüfen».**
Ändern, Entfernen und Hinzufügen erscheinen erst, nachdem «In die Anwendung
übernehmen» gedrückt wurde — der Grund steht oben in diesem Kapitel. Wer die
Knöpfe sucht und den Satz daneben nicht liest, hält die Stufen für unveränderlich.

**Der Prüfknopf antwortet an der Stufe**, auf deren Knopf gedrückt wurde: «…
antwortete in 262 ms («Bereit»)» in grün, die Absage in Warnfarbe, beides
unmittelbar unter der Zeile. Während des Anrufs heisst der Knopf «fragt an …»
und ist gesperrt. Bis zum 17.08.2026 stand die Antwort als unformatierter Absatz
am Seitenkopf, 380 px über dem Knopf — gemeldet als «es geschieht nicht viel».

### Die KI abschalten — an welcher Stelle?

Es gibt zwei verschiedene Schalter, und der häufigere ist nicht dieser hier:

| Was Sie wollen | Wo |
|---|---|
| Eine Gemeinschaft soll keine KI nutzen | bei der **Gemeinschaft**, Angaben — Vorgabe ist ohnehin **aus** |
| Eine einzelne Funktion ausnehmen | ebenda, je Funktion |
| Kein Modell mehr hinterlegen (ganze Anlage) | «Äussere Dienste» — alle Stufen aus der Kette nehmen |

**Die letzte Stufe ist die heikle.** Wird sie entfernt, gilt wieder die Kette aus
der Umgebung, falls dort `VERSAMMLUNG_KI_…` gesetzt ist — die Anwendung fällt auf
den Rückfall zurück, und abgeschaltet ist damit nichts. Wer die KI auf dieser
Ebene wirklich stilllegen will, nimmt die Stufen **hier** weg *und* die Einträge
aus der Umgebung (danach Neustart). Die Seite sagt das an der Stelle, an der
entfernt wird, und nennt die Zahl der wartenden Umgebungsstufen.

Der Zugangsschlüssel wird nie angezeigt — auch nicht als Punktereihe mit dem
echten Wert dahinter, denn ein `<input value="sk-…">` steht im ausgelieferten
HTML. Zu sehen ist eine Andeutung (`sk-…890`), gerade genug, um zwei
auseinanderzuhalten. Ein **leeres** Schlüsselfeld heisst «unverändert», nicht
«löschen»: Sonst verlöre ein blosser Namenswechsel den Zugang, und bemerkt würde
es erst im Saal. Zum Entfernen gibt es ein eigenes Häkchen.

### Zwei Schalter beim Betreiber

Unter **Betreiber** stehen zwei Angaben, die für die ganze Anlage gelten:

- **Hinweise ausblenden.** Die KI-Abschnitte stehen an vier Stellen; ist die KI
  nicht zugelassen, zeigen sie sonst dauerhaft den Grund. Reine Anzeige — was
  zugelassen ist, bleibt sichtbar und benutzbar.
- **Maschinenvermerk im Protokoll.** Vorgabe an. Er steht in einem Dokument, das
  an alle Eigentümer geht; über dessen Inhalt entscheidet die Sitzungsleitung.
  **Der Nachweis bleibt in jedem Fall** — abschaltbar ist die Zeile im
  Protokoll, nicht die Nachvollziehbarkeit. Sonst wäre es kein Schalter, sondern
  ein Radiergummi.

### Je Gemeinschaft und je Funktion

Zugelassen wird die KI **je Gemeinschaft** (Vorgabe: aus), und einzelne
Funktionen lassen sich ausnehmen — eine Gemeinschaft kann die Traktandenprüfung
wollen und den Protokollentwurf nicht.

### Was festgehalten wird

Jede Nutzung mit Zeitpunkt, Funktion, Gegenstand, **Stufe** und dem, was die
Sitzungsleitung damit gemacht hat: angenommen, abgelehnt, verändert übernommen.
Beim Protokollentwurf gilt schon das Übernehmen eines Absatzes als Entscheid.
**Nicht** die Anfrage und nicht die Antwort — der Nachweis ist eine Auskunft
darüber, wer was entschieden hat, kein zweiter Speicher für Personenbezogenes an
einer Stelle, die nie gelöscht wird.

## Die Übernahme aus immotool

**Vorgabe: aus.** Ohne Eintrag erscheint die Wahl auf der Übernahmeseite gar
nicht — dort steht dann wie bisher der Dateiwähler. Und wer immotool gar nicht
einsetzt, merkt von diesem Abschnitt nichts.

```bash
VERSAMMLUNG_IMMOTOOL_URL=https://immotool.example.ch
VERSAMMLUNG_IMMOTOOL_TOKEN=…
```

Der Schlüssel ist derselbe Wert, der in immotool als
`IMMOTOOL_VERSAMMLUNG_EXPORT_TOKEN` steht. Erzeugen mit `openssl rand -hex 32`;
kürzer als 32 Zeichen weist immotool ab.

### Was übernommen wird

Eigentümer, Einheiten, Wertquoten — und die weiteren Verteiler, **sofern es sie
hier auch gibt**. Ein Verteiler heisst in immotool nur «Aufzug»; hier trägt er
zusätzlich einen Schlüssel. Kennt die Gemeinschaft den nicht, bleibt die Spalte
weg und der Hinweis nennt den Schlüssel, unter dem Sie ihn anlegen. Dass die
Spalte mitkäme und dann jede Einheit daran scheiterte, wäre der schlechtere
Weg — und der wäre schwer zu deuten.

### Offen: die Einheiten eines Unterobjekts

**Status am 09.09.2026: nicht entschieden, und das ist Absicht.**

Eine Liegenschaft kann im immotool Unterobjekte haben, etwa «Haus A» unter
«MEG Einstellhalle». Dass die Einheiten eines Unterobjekts zur Wurzel gehören,
ist dort inzwischen entschieden (Auftraggeber, 07.09.2026) und in mehreren Lesern
umgesetzt. **Für die Übernahme hierher gilt das ausdrücklich nicht.**

Die Frage ist enger und gehört uns, nicht dem immotool: **Zählt eine Einheit
unter «Haus A» beim Quorum der Gemeinschaft mit, und wessen Stimmrecht ist
sie?** Solange das offen ist, liefert `versammlung_stammdaten` die Einheiten
eines Unterobjekts **nicht** mit. Das ist die Fassung, die niemanden falsch
abstimmen lässt: Eine Einheit, die fehlt, fällt beim Erfassen auf. Eine, die zu
viel da ist, verschiebt still ein Quorum.

**Und sie ist hier nicht nur unentschieden, sondern nicht abbildbar**
(nachgemessen am 09.09.2026). Diese Anwendung kennt unterhalb der Gemeinschaft
gar keine Zwischenebene: `unit` hängt mit `stweg_id` direkt an der Gemeinschaft
(Migration 005), und eine Hierarchie gibt es nur eine Ebene höher, zwischen
Gemeinschaften (`uebergeordnete_mit_eltern` in `domain/gemeinschaft.ts`).
Quorum und Stimmrecht rechnen auf den Einheiten dieser einen Gemeinschaft.

Eine übernommene Einheit unter «Haus A» hätte hier also keinen Ort, an dem ihre
Zugehörigkeit stünde. Die zurückhaltende Fassung drüben ist damit nicht bloss
vorsichtig, sondern die einzige, die zu widerspruchsfreien Daten führt. Wollte
man es ändern, wäre das ein **Modellentscheid hier** (eine eigene Gemeinschaft
je Haus, oder ein Merkmal an der Einheit) und keine Frage der Schnittstelle.

Im immotool steht die Frage in
`immotool/docs/pendenzen/2026-09-09-einheiten-unter-unterobjekten.md` unter
«Offen», Punkt 6, und der Wächtereintrag dort trägt bewusst **keine**
Begründung, sondern die Kennzeichnung «ungeprüft» — er sagt damit «hier ist
eine Entscheidung offen» statt «hier ist alles in Ordnung».

**Warum das hier steht.** Die Antwort liegt bei uns, dokumentiert war die Frage
aber nur beim Absender. Eine Frage, die nur dort steht, wo sie nicht
beantwortet wird, findet niemand. Wer hier an Quorum oder Stimmrecht arbeitet,
soll sie finden, bevor er die Übernahme für vollständig hält.

### Was nicht übernommen wird

Vier Dinge weiss immotool nicht, und die Anwendung erfindet sie nicht:

| Angabe | Was stattdessen gilt |
|---|---|
| Nutzniessung | bleibt leer; hier erfassen |
| Juristische Person | alles gilt als natürliche Person |
| Wer die Stimme einer Gemeinschaft ausübt | die erstgenannte Person |
| Kopfstimme | aus der Nutzungsart abgeleitet: Nebenobjekt ohne, alles andere mit |

Alle vier stehen vor der Übernahme als Hinweis auf dem Bildschirm, und jede
Abweichung erscheint in der Vorschau als Änderung. Sie sind danach bei den
Eigentümern und Einheiten zu berichtigen.

### Die Authentik-Kennung (seit 20.08.2026)

Führt immotool zu einem Eigentümer eine Authentik-Identität, kommt deren
Kennung mit — die UUID aus dem `sub`-Anspruch, nie die E-Mail-Adresse. Sie ist
die Grundlage des Eigentümerzugangs (siehe oben) und steht danach bei den
Eigentümern als «Authentik-Kennung hinterlegt».

> **Dieser Absatz sagte bis zum 15.09.2026 das Gegenteil** («Sie bewirkt heute
> noch nichts: Einen Anmeldeweg für Eigentümer gibt es nicht»). Das stimmte, als
> er geschrieben wurde, und war seit den Migrationen 067/068/071 überholt —
> während derselbe Text weiter oben den gebauten Weg bereits beschrieb. Ein
> Widerspruch im selben Dokument ist schlimmer als eine Lücke, weil man der
> falschen Hälfte glaubt.

Das Stimmrecht folgt unverändert aus dem festgehaltenen Stand, nie aus einer
Kennung. Und die Kennung muss **vor der Freigabe** stehen: Eingelöst wird gegen
`snapshot_party`, und die Freigabe friert ein.

Drei Regeln:

- **Nur, wo eine Person allein besitzt.** Gehört eine Einheit zweien, gehört
  ihnen auch die Stimme gemeinsam; welche der beiden sich dafür anmelden darf,
  entscheidet die Bewirtschaftung. Die Übernahme lässt die Kennung dann weg und
  sagt es im Hinweis, statt eine der beiden auszuwählen.
- **Gesetzt wird sie, entfernt nie.** Eine Datei ohne die Spalte
  `person_authentik` — eine ältere oder eine von Hand geschriebene — ist kein
  Löschauftrag. Sonst nähme ein harmloser zweiter Lauf einem Eigentümer den
  Zugang weg, und niemand suchte den Grund in der Datei.
- **Nur eine je Zeile, und nur in UUID-Form.** Zwei Kennungen an einer Stimme
  wären zwei Menschen, die sich beide dafür anmelden dürften; eine
  E-Mail-Adresse an dieser Stelle wäre eine Kennung, die neu vergeben werden
  kann. Beides weist die Vorschau ab.
- **Eine Kennung gehört einer Partei.** Steht dieselbe zweimal in der Datei
  oder gehört sie hier schon einer anderen Partei, fällt die betroffene Zeile
  durch — mit Nennung der Zeile beziehungsweise der Partei, der sie gehört. Die
  übrigen Zeilen laufen normal durch. Der Grund für die Prüfung an dieser
  Stelle: In der Datenbank wacht ein eindeutiger Index darüber, aber der
  schlägt erst beim Schreiben zu, und die Übernahme läuft in **einer**
  Transaktion — eine doppelte Kennung nähme sonst allen anderen Zeilen ihren
  Lauf.

> **Wenn eine Kennung wirklich wandern soll**, etwa weil dieselbe Person in
> immotool doppelt erfasst war: Sie ist dort zu bereinigen. Die Anwendung löst
> das nicht von selbst auf — sie sagt, was sie vorfindet.

Auf dem Handweg gilt dasselbe: Die Spalte heisst `person_authentik` und ist
wahlfrei.

### Der Stichtag

immotool führt Eigentum mit Gültigkeitszeitraum. Übernommen wird, wer **am
Stichtag** eingetragen ist — und ab demselben Tag gilt die Zuordnung auch hier.
Wer eine Versammlung zum 1. Januar vorbereitet, trägt den 1. Januar ein, nicht
heute.

### Was Widersprüche in immotool auslösen

Sie werden gemeldet, nicht geglättet. Stehen an einer Einheit zwei Eigentümer,
ist sie aber als Alleineigentum erfasst, übernimmt die Anwendung Miteigentum —
eine Einheit, eine Stimme (ZGB Art. 712o Abs. 1) — und sagt, dass das in
immotool zu berichtigen ist. Zwei Menschen können an derselben Einheit kein
Alleineigentum haben; das ist kein Grenzfall, sondern ein Widerspruch.

### Wenn immotool nicht antwortet

Dann steht das im Band über der Seite, und dort steht auch, was ohne den Dienst
weiterhin geht: die Übernahme aus einer CSV-Datei und die Erfassung von Hand.
**Eine laufende Versammlung ist nie betroffen** — übernommen wird bei der
Vorbereitung, nicht im Saal. Auf dem Notebook im Versammlungsraum bleiben beide
Einträge deshalb leer.

## Der Mailausgang

**Vorgabe: aus.** Ohne Eintrag erscheint der Versandknopf gar nicht, und die
Anwendung bleibt genau so benutzbar wie bisher: Sie erzeugt die Dateien —
Traktandenliste, Zugangskarten, Versandpaket —, verschickt werden sie über Ihr
Mailprogramm oder Ihre Dokumentenablage.

```bash
VERSAMMLUNG_SMTP_HOST=mail.example.ch
VERSAMMLUNG_SMTP_PORT=587
VERSAMMLUNG_SMTP_BENUTZER=versammlung@example.ch
VERSAMMLUNG_SMTP_KENNWORT=…
VERSAMMLUNG_SMTP_ABSENDER=versammlung@example.ch
VERSAMMLUNG_SMTP_ABSENDERNAME=Ihre Bewirtschaftung
```

Ohne `HOST` oder ohne `ABSENDER` gilt der Ausgang als nicht eingerichtet.

### Verschlüsselt oder gar nicht

Auf Port 465 ist die Verbindung von Beginn an verschlüsselt; auf jedem anderen
Port verlangt die Anwendung **STARTTLS** und bricht ab, wenn der Server es nicht
anbietet. Es gibt keinen Rückfall auf unverschlüsselt: Sonst gingen das Kennwort
und mit ihm die Anhänge im Klartext über die Leitung — und die Anhänge tragen
persönliche Zugangscodes.

### Je Person eine Nachricht

**Nie eine Sammelmail.** Jeder Eigentümer bekommt eine eigene Nachricht mit
**seiner** Karte. Wer einen fremden Zugangscode hat, kann in fremdem Namen
abstimmen; ein Verteiler oder ein Kopie-Feld verschenkte ihn an alle.

Verschickt wird nacheinander, nicht gleichzeitig: Mailserver drosseln, und eine
Drosselung bei zwölf gleichzeitigen Verbindungen träfe mitten in den Versand.
Ein Fehler bricht nicht ab — wer dreizehn von vierzehn Karten verschicken kann,
soll das tun. Danach steht **namentlich** da, welche offen blieb.

### Was im Verlauf steht

Je Empfänger ein Eintrag mit Adresse und Ergebnis — nicht der Text und nicht der
Anhang. Die Adresse gehört dazu: «Ich habe keine Einladung erhalten» lässt sich
ohne sie nicht beantworten.

### Wenn der Mailserver nicht antwortet

Dann steht das im Band über der Seite, und dort steht auch, was ohne ihn geht:
Das Versandpaket und die einzelnen Karten entstehen unverändert. Auf dem
Notebook im Versammlungsraum bleibt der Eintrag leer.

### Der Weg ohne Mailausgang

Die `Versandliste.csv` im Versandpaket trägt die E-Mail-Adressen, aber
**keinen** Zugangscode: Sie geht durch mehr Hände als die Karten selbst, in eine
Ablage, in eine Tabellenkalkulation, in einen Serienbrief.

## Die Erinnerung an den Einladungsversand

**Vorgabe: aus.** Sie geht erst hinaus, wenn drei Dinge zusammenkommen — ein
eingerichteter Mailausgang, eine Adresse unter «Betreiber → Erinnerungen» und
eine Einberufungsfrist unter «Gemeinschaft → Reglement und Quoren». Fehlt eines
davon, geschieht nichts, und der Dienst schreibt jedes Mal ins Protokoll, was
fehlt.

### Wann sie kommt

Einen **Werktag** vor dem letzten Tag, an dem die Einladung nach der erfassten
Frist bei allen sein soll (im Code `versandfrist`). Bis zum Empfang zu rechnen
ist die vorsichtige Regel der Anwendung, nicht die Rechtslage: Ein Reglement
kann ab Versand rechnen, dann gilt nach ihm dessen Regel (Produktentscheid
06.10.2026, «Als Regel der Anwendung»; Rz. 23, 24 ad Art. 712n). Fällt dieser
Tag auf ein Wochenende oder einen allgemeinen Feiertag, wird auf den letzten
Werktag davor vorgezogen. Als Feiertag zählen Neujahr, Karfreitag, Ostermontag,
Auffahrt, Pfingstmontag, der 1. August, Weihnachten und der Stephanstag
(Produktentscheid 06.10.2026, «Bundesweite Feiertage», seither «allgemeine»:
rechtlich ist nur der 1. August ein Bundesfeiertag, Art. 110 Abs. 3 BV; die
übrigen sind kantonal, gelten aber fast überall; `feiertage.ts`). Die
beweglichen rechnet die Anwendung aus dem Ostersonntag, eine Liste mit
Jahreszahlen gibt es nicht. Kantonale Feiertage kennt sie nicht, weil sie nicht
weiss, in welchem Kanton die Bewirtschaftung arbeitet: Fällt der errechnete Tag
auf einen kantonalen Feiertag, kommt die Erinnerung an diesem Tag statt am
Werktag davor.

Wurde der Tag verpasst — weil der Dienst stand oder die Versammlung erst danach
erfasst wurde —, geht die Erinnerung beim nächsten Lauf trotzdem, mit einem
anderen Wortlaut: dann ist die Frist bereits abgelaufen. Nach dem
Versammlungstag selbst kommt keine mehr.

### Wann sie ausbleibt

Sobald die Anwendung die **erzeugte Einladung** sieht, also den Abruf von
`einladung.pdf`, und zwar seit der letzten Rücknahme der Freigabe (siehe
unten). Das ist bewusst das einzige Merkmal: Der Mailversand der
Anwendung schickt die Zugangskarten, und der Begleittext sagt ausdrücklich, dass
die Einladung mit Traktandenliste daneben hinausgeht. Ihn mitzuzählen hiesse,
die Erinnerung abzuschalten, obwohl die Einladung selbst noch nirgends steht.

Oder sobald jemand **von Hand vermerkt**, dass die Einladung verschickt ist
(Haken «Die Einladung ist verschickt» auf der Seite Vorbereitung; vom 06.10.2026
bis 07.10.2026 «… ist bei allen angekommen»). Das
ist der Weg für alle, die sie ausserhalb der Anwendung schreiben und über ihr
eigenes Mailprogramm verschicken — bis zum 02.09.2026 bekamen sie die Erinnerung
trotzdem, bis die Versammlung vorbei war.

**Ausser nach einer Milderung des Mehrs** (Produktentscheid 06.10.2026, «Ja,
erneut erinnern»; Migration 145). Wird das Mehr eines Traktandums nach der
Freigabe milder, muss die berichtigte Einladung neu hinaus, und die erste ist
meist schon erzeugt. Solange die berichtigte aussteht, zählt das Ereignis
«Einladung erzeugt» deshalb nicht. Ein Vermerk zählt, wenn er nach der
Milderung gesetzt wurde, auch nach dem letzten Fristtag (`neuversandVermerkt`,
dieselbe Bedingung wie beim Hinweis; Produktentscheid 07.10.2026, «Nur noch
aufmerksam machen»). Bis 07.10.2026 zählte er nur bis zum letzten Fristtag
(`neuversandGilt`). Wird das Mehr vorher zurückgestellt, entfällt die
Erinnerung ebenfalls.

Die Mail hat dann einen eigenen Wortlaut und nennt die gemilderten Traktanden.
Sie macht aufmerksam und stellt keine Bedingung: Das mildere Mehr nimmt die
Anwendung auch ohne Vermerk, und für Versandweg und Zeitpunkt sorgt, wer einlädt;
die Anwendung prüft das nicht. Nach Fristablauf sagt sie bedingt, was folgt
(«Ist sie noch nicht verschickt …»), weil sie auch kommt, wenn die berichtigte
Einladung rechtzeitig hinausging und nur der Haken fehlt, etwa wenn der
Zeitgeber am Erinnerungstag nicht lief. Den Link zum Vermerk trägt sie vor
und nach Fristablauf; bis 07.10.2026 nur davor.

### Der Vermerk «Die Einladung ist verschickt»

Ein Hilfsmittel, kein Zwangsinstrument (Vorgabe des Auftraggebers, 02.09.2026). Er schaltet
die Fristwarnung und die Erinnerung ab, sonst nichts: keine Rechte, keine
Schranke, und der Schritt «Einladung erzeugen» gilt dadurch **nicht** als
erledigt — dort entsteht ein PDF, und das entsteht so nicht.

**Nach einer Milderung** (`domain/einladungsmehr.ts`): Wurde das Mehr eines
Traktandums nach der Freigabe gemildert, nimmt die Anwendung den Vermerk zurück,
falls er stand. Ein neuer Vermerk danach nimmt den Hinweis auf der Seite
Vorbereitung und die Erinnerung weg; am Mehr ändert er nichts. Das mildere Mehr
nimmt die Anwendung auch ohne Vermerk, auch beim Eröffnen (Produktentscheid
07.10.2026, «Nur noch aufmerksam machen»). Vom 06.10.2026 bis 07.10.2026 galt
«Erste Einladung gilt»: Ohne Vermerk nach der Milderung und bis zum letzten
Fristtag fiel das Mehr beim Eröffnen auf das der bisherigen Einladung zurück.
Diesen Rückfall gibt es nicht mehr. Einzelheiten im Handbuch, Schritt 8.

Er ist eine Aussage eines Menschen, kein Nachweis der Anwendung. Deshalb steht
im Verlauf, wer ihn gesetzt hat und auf welchem Weg, und deshalb lässt er sich
jederzeit wieder entfernen. Eine weitere Erinnerung bringt das Entfernen allein
nicht, denn der Merker bleibt gesetzt. Erinnert wird erneut nur, wenn der
Merker leer ist (vor der ersten Erinnerung, nach einem Fehlschlag oder nach
einer Rücknahme der Freigabe) oder älter als eine noch ausstehende Milderung. Am Code geprüft, Korrekturrunde
06.10.2026.

Auch die Rücknahme der Freigabe nimmt den Vermerk zurück
(`loescheEinladungsmehrBeiRuecknahme`, Produktentscheid 06.10.2026 «Nein,
Neuversand verlangen»). Die Marke einer früheren Erinnerungsmail fällt dabei
immer, auch ohne gesetzten Vermerk (Codeprüfung M1, 06.10.2026).

**Seit dem 06.10.2026 setzt die Rücknahme auch den Merker der Erinnerung
zurück** (Produktentscheide «Rücknahme setzt den Merker zurück» und «Seit
Rücknahme zählen»; Migration 147). Die Versammlung steht danach wie vor der
ersten Freigabe, auch wenn vor der Rücknahme schon eine Erinnerung kam: Wie
dort kann die Erinnerung schon im Entwurf kommen, wenn die Frist naht, und
dann kommt nach der neuen Freigabe keine weitere; ihr Link vermerkt den
Versand auch nach der neuen Freigabe (Codeprüfung Teil 1, M2, 06.10.2026). Dazu
zählt «Einladung erzeugt» nur, wenn es nach der letzten Rücknahme vermerkt
wurde; dieselbe Bedingung (`vermerkt_seit_ruecknahme`) gilt für die
Kandidatensuche, den Dienst, den Vorbereitungsschritt «Einladung erzeugen» und
das Vermerken selbst. Ein neues Erzeugen nach der Rücknahme wird deshalb
wieder vermerkt, ebenso eine neu erzeugte Traktandenliste. Läuft bei der
Rücknahme gerade eine Erinnerungsmail, legt der Dienst ihre Marke nicht ab
(`legeMarkeAb` vergleicht den Merker, und der ist dann leer): Der Link in
dieser Mail gilt nicht.

**Zwei Wege führen hin:**

| Weg | Wo |
|---|---|
| Kästchen | Versammlung → Vorbereitung, unter der Schrittliste |
| Link | in der Erinnerungsmail selbst, ohne Anmeldung |

**Der Link ist eine Einmalmarke**: 32 Zufallsbytes, in der Datenbank nur als
Prüfwert (`meeting.invitation_reminder_token_hash`), im Klartext einzig in der
Mail. Je Versammlung gilt nur die Marke aus der zuletzt verschickten Erinnerung.
Sie wird erst abgelegt, **nachdem** die Mail angenommen wurde — sonst entwertete
ein misslungener Versand den Link der zuletzt zugestellten Erinnerung.

**Das Öffnen des Links tut nichts, erst der Knopf auf der Seite.** Mailserver
rufen Links vor der Zustellung ab (Outlook Safe Links, Viren- und
Vorschauprüfer); täte schon der Abruf den Vermerk, verstummte die Erinnerung,
bevor sie jemand gelesen hat. Der Weg dahinter (`/b/<marke>`) kann genau eines:
diesen Vermerk setzen.

**Nach einer Milderung fragt die Seite nach der berichtigten Einladung** und
nennt den letzten Fristtag. Nach diesem Tag sagt sie bedingt: Ist die
berichtigte Einladung noch nicht verschickt, kommt sie nicht mehr rechtzeitig
an; war sie am letzten Tag nicht bei allen, kann ein Beschluss mit dem milderen
Mehr angefochten werden. Den Knopf zeigt sie trotzdem: Jeder
Vermerk nach der Milderung zählt (seit dem Produktentscheid 07.10.2026; bis
dahin gab es nach diesem Tag keinen Knopf). Jede Milderung verbraucht
die Marke, auch ohne Vermerk; ein Link aus einer Erinnerung davor gilt dann
nicht mehr. Fällt eine Milderung zwischen den Versand einer Erinnerung und das
Ablegen ihrer Marke, verwirft der Dienst die Marke (`legeMarkeAb` mit dem
Merker). Der Link in dieser Mail gilt dann nicht. Die Seite schickt mit, welche Frage sie gezeigt hat. Hat sich die
Lage bis zum Absenden geändert, löst sie nicht ein und fragt neu. Ob eine berichtigte
Einladung aussteht, liest sie über `einladung_marke_neuversand` (Migration 146)
und rechnet nach `neuversandVermerkt`, wie Erinnerung und Hinweis (bis
07.10.2026 `neuversandGilt`, damals auch beim Eröffnen).

**Ohne `ORIGIN` gibt es keinen Link.** Die Anwendung kennt ihre eigene Adresse
nur aus dieser Variablen — der Zeitgeber läuft ohne Anfrage, aus der sie sich
ablesen liesse. Die Erinnerung geht dann trotzdem hinaus, nur ohne den Absatz
mit dem Link.

### Einmal je Versammlung, und einmal nach jeder Milderung

Genauer: einmal je Freigabe, denn die Rücknahme der Freigabe leert den Merker
(siehe oben). Der Merker steht in der Datenbank, nicht im Speicher des Dienstes: Ein Neustart
ist der Regelfall, und aus einem Merker im Speicher würde bei jedem Aufspielen
eine zweite Nachricht. Er wird **vor** dem Versand gesetzt und nur bei einem
Fehlschlag wieder freigegeben — lieber eine Erinnerung zu wenig als ein
Postfach voll derselben.

**Nach einer Milderung wird der Merker nicht zurückgesetzt** (Migration 145).
«Nach der Milderung erinnert» heisst: `invitation_reminder_sent_at` liegt nicht
vor `released_requirement_relaxed_at`. Ist er älter, gilt er als frei, und der
Dienst beansprucht ihn mit derselben Bedingung im selben `UPDATE`, nachdem er
die Versammlung gesperrt hat. So geht nach einer Milderung höchstens eine
Erinnerung, auch bei zwei gleichzeitigen Läufen. Fallen zwei Milderungen vor
den Erinnerungstag, geht eine Mail, die beide nennt; eine Milderung nach einer
schon verschickten Erinnerung bringt eine weitere. Der Zeitpunkt der ersten
Erinnerung bleibt im Verlauf, dessen Eintrag dann den Grund «Mehr seit der
Freigabe gemildert» trägt.

**Zeitpunkte nach der Sperre** (Korrekturrunde 06.10.2026, Codeprüfung M1).
Milderung und Merker schreiben `clock_timestamp()`, nicht `now()`, also den
Zeitpunkt nach dem Warten auf die Sperre. Sonst läge der Zeitpunkt einer
Milderung, die auf einen Erinnerungslauf gewartet hat, vor dessen Merker, und
die Erinnerung zu ihr bliebe aus.

Offen bleibt dabei ein Fall: Nimmt der Mailserver die Nachricht an und bricht
die Verbindung erst danach ab, gilt das als Fehlschlag, der Merker wird
freigegeben, und die nächste Stunde bringt dieselbe Erinnerung ein zweites Mal.
Der Vermerk oben entschärft das, hebt es aber nicht auf.

### Der Zeitgeber

Nachgesehen wird stündlich, das erste Mal eine Minute nach dem Start. Das ist
der einzige Vorgang der Anwendung, den niemand auslöst; er löscht und verdichtet
nichts, sondern liest und verschickt höchstens eine Nachricht je Versammlung und
eine weitere nach jeder Milderung des Mehrs.

```bash
VERSAMMLUNG_ERINNERUNG=aus   # schaltet ihn ganz ab, ohne Neubau
```

## Gotify oder andere Meldewege

Nicht angebunden und nicht vorgesehen. Eine Versammlung wird geführt, nicht
überwacht; was schiefgeht, sieht die Sitzungsleitung auf dem Bildschirm vor sich.
Für den Serverbetrieb nutzen Sie die Prüfung des Containers
(`HEALTHCHECK` im Abbild) und Ihre bestehende Überwachung.
