# 0032: Die L5-Protokollzeile nennt die angewandte Regel der zweiten Versammlung

- **Status:** gilt
- **Datum:** 2026-10-29
- **Rolle:** Produktentscheid, Entscheidrunde A0 (`.auftraege/2026-10-29-votum-ablaufplan-pendenzen-und-freigabe.md`)

## Wortlaut

Frage: «Hat das Reglement für die zweite Versammlung eine strengere Hürde als
das Gesetz, rechnet Votum richtig mit der strengeren, und die Einladung nennt
sie. Die Protokollzeile sagt aber fest ‹nach Gesetz ein Drittel der
Eigentümer›. Soll die Zeile die tatsächlich angewandte Regel nennen?»

> «Angewandte Regel nennen (Empfohlen)»

## Anlass

Review DeepSeek zu Lesarten Block 7, Befund 5. Die Sperre rechnet mit der
hinterlegten Regel der Stufe (`regeln[m.tier]` in
`src/lib/server/abstimmung.ts`), die Einladung nennt sie
(`beschlussfaehigkeitssatz` in `src/lib/domain/einladung.ts`), die Zeile in
`src/lib/domain/mehrhinweise.ts` sagt fest «nach Gesetz ein Drittel der
Eigentümer». Die Fachprüfung Runde 8 hat «nach Gesetz» als gesetzliches
Minimum getragen.

## Was gilt

Ist für die zweite Versammlung eine Regel des Reglements hinterlegt, nennt die
Zeile diese samt Fundstelle, wie die Einladung; ohne Regel bleibt «nach Gesetz
ein Drittel der Eigentümer». Gebaut in Schritt A5 mit Laien- und Fachprüfung.
Dasselbe prüft A5 an den übrigen Sätzen mit «nach Gesetz ein Drittel» in
`mehrhinweise.ts` und `lesarten.ts`.

## Alternativen

- So lassen: wahr als Minimum, aber im Protokoll steht dann eine tiefere
  Schwelle als die angewandte.

Gebaut mit `0b6bfda2` (A5).
