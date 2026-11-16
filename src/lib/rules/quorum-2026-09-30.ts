/**
 * Regelwerk, Fassung 2026-09-30.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung berichtigt die Texte der Karten
 * zur luxuriösen Massnahme und den Satz zu gemischten Geschäften. **Am
 * Erfordernis ändert sich an keiner Stelle etwas.**
 *
 * **Anlass.** Die Fassung 2026-09-27 hatte diese Texte neu geschrieben
 * (drei Bedingungen nach ZGB Art. 647e Abs. 2, Beweislast, Trennungsrat). Sie
 * gingen damals durch den Code-Review, aber durch keine Laien- und
 * Fachprüfung. Als der Abzug für den Quorenfinder der Website am 26.09.2026
 * nachgezogen werden sollte, wären sie zum ersten Mal öffentlich geworden.
 * Die Prüfung vorher fand (`quellen/pruefung/berichte/2026-09-26-quorenfinder-luxurioes.md`):
 *
 *   - **Die Beweislast ohne Anfechtungsfrist.** «Wer später bestreitet … muss
 *     das beweisen» liess offen, dass der Beschluss nur anfechtbar ist und die
 *     Klage innert eines Monats beim Gericht erhoben werden muss (Art. 75 ZGB;
 *     Rz. 207, 209, 230 ad Art. 712m). Wer abwartet, hat einen gültigen
 *     Beschluss. Ebenso «fällt zurück auf Einstimmigkeit», das nach einer
 *     selbsttätigen Folge klang.
 *   - **Titel und Begründung klangen, als reiche die Kostenübernahme.** Die
 *     Begründung nennt die drei Bedingungen jetzt selbst.
 *   - **Die zweite Bedingung klang, als sei immer Ersatz geschuldet;** nach
 *     Gesetz nur, soweit eine vorübergehende Beeinträchtigung besteht.
 *   - **Die laufenden Kosten** (Betrieb, Unterhalt): Ob der Kostenanteil nach
 *     Abs. 2 sie umfasst, ist nicht geklärt; fehlt eine Regelung, ist streitig,
 *     ob sie nach Wertquoten auf alle fallen oder der Gegner auch davon befreit
 *     ist (Rz. 62 ad Art. 712h: «von den anfallenden Kosten zu befreien»). Eine
 *     Zwischenfassung sagte «nach Wertquoten auf alle»; die Fachprüfung fand,
 *     dass das zulasten des Gegners zu fest war.
 *   - **Der Fristbeginn:** für Anwesende und Vertretene ab der Versammlung,
 *     nicht ab dem Protokoll (Rz. 218a, 230 ad Art. 712m), und auch bei einer
 *     Beeinträchtigung, die sich erst im Betrieb zeigt.
 *   - **Der Trennungsrat** ist nur für Bauprojekte mit einem luxuriösen Teil
 *     belegt (Rz. 115a ad Art. 712a; BGer 5A_798/2010 E. 4.6.2, dort «non
 *     appare irrealizzabile», also durchführbar, nicht «zumutbar»); für
 *     notwendige und nützliche Teile ist die Frage offen (`quellen`,
 *     `entscheide.md`, A-12).
 *   - **Bestand:** Rz. 125 ad Art. 712a trug die Aussage zum Reglement nicht,
 *     sie steht allein in Rz. 136.
 *
 * **Die Lehrstreit-Absätze L-4 (Zählung) und B2 (Reglement) bleiben**, B2 mit
 * dem berichtigten Beleg. Die Probe in `tests/domain/regelwerksfassungen.test.ts`
 * hält fest, dass sie nicht verloren gehen.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_09_29 } from './quorum-2026-09-29';

const ERSTE_BEDINGUNG_QUELLE = '(Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 135)';

const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	'k-baulich-luxurioes': {
		hinweise: [
			'Ein Weg ohne Einstimmigkeit besteht nach ZGB Art. 647e Abs. 2. Er verlangt drei ' +
				'Bedingungen zugleich: Wer nicht zustimmt, wird in Nutzung und Gebrauch nicht dauernd ' +
				'beeinträchtigt; für eine bloss vorübergehende Beeinträchtigung leisten ihm die übrigen ' +
				'Ersatz; und sie übernehmen seinen Kostenanteil. Fehlt eine davon, bleibt es bei der ' +
				`Einstimmigkeit ${ERSTE_BEDINGUNG_QUELLE}.`,
			// L-4, wörtlich aus der Vorfassung.
			'Auch die Zählung ist umstritten: Nach dem SVIT-Kommentar genügt die Zustimmung ' +
				'sämtlicher anwesenden und vertretenen Eigentümer (Art. 712m Rz. 197; anders Manz), ' +
				'nach der herrschenden Lehre braucht es alle im Grundbuch aufgeführten. Dieses ' +
				'Werkzeug rechnet über alle Eigentümer, wer das erreicht, genügt beiden Lesarten.'
		]
	},

	'k-baulich-luxurioes-ausweg': {
		// Der Vorspann zum Grundsatz bleibt (Vorgabe vom 15.08.2026, siehe Fassung 2026-09-27).
		begruendung:
			'Grundsatz ist die Einstimmigkeit: Luxuriöse Massnahmen brauchen die Zustimmung aller ' +
			'Eigentümer (ZGB Art. 647e Abs. 1). Abs. 2 öffnet den Ausweg über das qualifizierte Mehr ' +
			'nur, wenn drei Bedingungen zugleich erfüllt sind: Wer nicht zustimmt, wird nicht dauernd ' +
			'beeinträchtigt, erhält Ersatz für eine vorübergehende Beeinträchtigung, und die übrigen ' +
			'übernehmen seinen Kostenanteil. Die Kostenübernahme allein genügt nicht; fehlt eine ' +
			'Bedingung, bleibt es bei Abs. 1.',
		hinweise: [
			'Erste Bedingung: Wer nicht zustimmt, wird in seinem Nutzungs- und Gebrauchsrecht nicht ' +
				'dauernd beeinträchtigt, auch nicht durch den Betrieb der Anlage, etwa durch Lärm. ' +
				'Massstab ist der Durchschnittsmensch, nicht die besondere Empfindlichkeit des Einzelnen ' +
				`${ERSTE_BEDINGUNG_QUELLE}. Belegt die Anlage dauernd einen Teil einer gemeinsamen ` +
				'Fläche, die er bisher nutzen konnte, prüfen Sie diese Bedingung besonders sorgfältig; ' +
				'bleibt Zweifel, holen Sie die Zustimmung aller ein oder ändern Sie das Projekt, bis er ' +
				'ausgeräumt ist, etwa durch einen anderen Standort.',
			'Zweite Bedingung: Soweit die Arbeiten ihn vorübergehend beeinträchtigen, etwa durch ' +
				'Lärm, ein Gerüst oder einen gesperrten Zugang, leisten ihm die übrigen Eigentümer dafür ' +
				'Ersatz. Nehmen Sie auch diese Zusage in den Beschlusstext auf.',
			'Dritte Bedingung: Die übrigen Eigentümer übernehmen den Kostenanteil des oder der ' +
				'Nichtzustimmenden. Diese Zusage gehört in den Beschlusstext, sonst ist sie später nicht ' +
				'belegbar. Halten Sie dort auch fest, wer die laufenden Kosten der Anlage trägt, etwa ' +
				'Betrieb und Unterhalt. Ob der Kostenanteil nach Abs. 2 diese Kosten umfasst, ist nicht ' +
				'geklärt. Am sichersten übernehmen die übrigen Eigentümer auch sie. Fehlt eine Regelung, ' +
				'ist streitig, ob diese Kosten nach Wertquoten auf alle verteilt werden oder ob der ' +
				'Nichtzustimmende auch davon befreit ist; der Kommentar spricht von einer Befreiung von ' +
				'den «anfallenden Kosten» (Wermelinger, SVIT-Kommentar 2023, Art. 712h Rz. 62).',
			'Wer bestreitet, dass die drei Bedingungen erfüllt waren, etwa weil er doch dauernd ' +
				'beeinträchtigt wird, muss den Beschluss innert eines Monats beim Gericht anfechten, in ' +
				'der Regel mit einem Schlichtungsgesuch (Art. 75 ZGB). Die Frist läuft ab Kenntnis des ' +
				'Beschlusses: für Anwesende und Vertretene ab der Versammlung, auch wenn das Protokoll ' +
				'später kommt; wer weder anwesend noch vertreten war, in der Regel ab Zustellung des ' +
				'Protokolls (Wermelinger, SVIT-Kommentar 2023, Art. 712m Rz. 218a, 230). Sie lässt sich ' +
				'nicht verlängern und läuft auch dann, wenn sich eine Beeinträchtigung, etwa Lärm im ' +
				'Betrieb, erst später zeigt. Wer das befürchtet, muss innert dieser Frist entscheiden. ' +
				'Ein Brief an die Verwaltung oder eine Einsprache gegen die ' +
				'Baubewilligung genügt nicht. Ohne Anfechtung gilt der Beschluss. Vor Gericht muss er ' +
				'beweisen, dass eine Bedingung fehlte; dann fehlte die nötige Einstimmigkeit nach ' +
				'Abs. 1, und das Gericht hebt den Beschluss auf. Einen Einwand lassen Sie am besten ' +
				'schon an der Versammlung ins Protokoll aufnehmen.',
			'Die Beweislast folgt aus Art. 8 ZGB (Wermelinger, SVIT-Kommentar 2023, Art. 712a ' +
				'Rz. 135a, gestützt auf ein Urteil des Kantonsgerichts von Graubünden, ZK1 20 176 vom ' +
				'14.12.2021, Erw. 5.3.2). Es ist ein kantonaler Entscheid; andere Gerichte sind nicht ' +
				'daran gebunden.',
			// B2, mit berichtigtem Beleg: Rz. 125 betrifft notwendige Massnahmen.
			'Ob das Reglement dieses Quorum mildern darf, ist umstritten: Der Kommentar lässt ' +
				'die Verringerung des Quorums an einer Stelle zu (Art. 712g Rz. 54), hält an ' +
				'einer anderen das System von Art. 647e Abs. 1 und 2 für zwingend (Art. 712a ' +
				'Rz. 136). Dieses Werkzeug folgt der strengeren Lesart und wendet eine ' +
				'blosse Reglementserleichterung nicht an.'
		]
	}
};

export const REGELWERK_2026_09_30 = {
	...REGELWERK_2026_09_29,
	fassung: '2026-09-30',

	quellen: [
		...REGELWERK_2026_09_29.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712m Rz. 207, 209, 230 und 233a (Beschluss über ' +
			'eine luxuriöse Massnahme mit qualifiziertem Mehr nur anfechtbar; Monatsfrist, ' +
			'Schlichtungsgesuch; Rz. 218a zum Fristbeginn) und Art. 712h Rz. 62 (Kostenbefreiung des Gegners); BGE 140 III 561 ' +
			'E. 2.2.2.4 (das Schlichtungsgesuch wahrt die Verwirkungsfrist). Zu BGer 5A_798/2010 ' +
			'E. 4.6.2: Das Gericht hält die getrennte Abstimmung für durchführbar («non appare ' +
			'irrealizzabile»).'
	],

	gemischteGeschaefte:
		'Wird nicht getrennt, gilt für das ganze Geschäft das strengere Erfordernis — auch für ' +
		'den Teil, der für sich allein mit einfachem Mehr auskäme. Verfolgt ein Vorhaben mehrere ' +
		'Zwecke zugleich, etwa eine notwendige Dachsanierung mit gleichzeitigem Ausbau der ' +
		'Dachterrasse, klären Sie das vor der Versammlung mit dem Antragsteller. Der bessere Weg ' +
		'ist, getrennt abzustimmen, am klarsten in zwei Traktanden; schneiden Sie die Teile so, ' +
		'dass jeder auch allein Sinn ergibt. Dann bekommt jeder Teil sein eigenes Erfordernis. Für ' +
		'Bauprojekte mit einem luxuriösen Teil steht genau das im Kommentar, und das Bundesgericht ' +
		'hält die getrennte Abstimmung auch bei einem Gesamtprojekt für durchführbar (Wermelinger, ' +
		'SVIT-Kommentar 2023, Art. 712a Rz. 115a; BGer 5A_798/2010 E. 4.6.2).',

	freigabevermerk:
		REGELWERK_2026_09_29.freigabevermerk +
		' Am 30.09.2026 berichtigt Votum die Karten zur luxuriösen Massnahme: Wer die drei ' +
		'Bedingungen bestreitet, muss innert eines Monats beim Gericht anfechten. Am Erfordernis ' +
		'ändert sich nichts.',

	knoten: REGELWERK_2026_09_29.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		return neu ? { ...k, ...neu } : k;
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
