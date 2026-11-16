/**
 * Regelwerk, Fassung 2026-10-17.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert nur Hinweise und einen
 * Satz der Begründung an einer Karte, `k-baulich-luxurioes-ausweg` (luxuriöse Massnahme mit
 * Kostenübernahme durch die übrigen). Verhalten, Rechtssatz, Wege und
 * Erfordernisse bleiben wie in 2026-10-16.
 *
 * **Der Anlass** (Rückmeldung des Auftraggebers, 08.10.2026, zum Hinweis
 * «Gut zu wissen» auf der Website: «Die Einleitung ist für mich nicht ganz
 * verständlich und der Text extrem lang. Wenn ich nicht zustimme, bin ich auch
 * nicht dauerhaft beeinträchtigt?»). Der erste Hinweis begann mit «Wer nicht
 * zustimmt, wird … nicht dauernd beeinträchtigt», einer Bedingung, die sich
 * wie eine Feststellung las, und lief über rund zwanzig Sätze und sechs
 * Sonderfälle. Die Karte trug acht Hinweise mit zusammen rund 7800 Zeichen.
 *
 * Jetzt: die Bedingung als Bedingung mit ihrer Folge («gilt dieser Weg nicht»),
 * die Sonderfälle je als eigener Hinweis mit Stichwort vorne, Betrieb und
 * Unterhalt sowie die Anfechtung gestrafft, die Beweislast in die Anfechtung.
 * Inhaltlich fällt nur weg, was keine Handlung trägt (die Begründung, warum
 * Balkondecke und Fassade gemeinschaftlich sind, steht in `quellen`).
 * Laien- und Fachprüfung in zwei Runden: `quellen/pruefung/zu-pruefen-2026-10-08-votum-ausweg-hinweise.md`
 * und `…-runde2.md`. Neu dazugekommen sind dabei Sätze für die Gegenseite: dass
 * sie selbst innert eines Monats anfechten muss, und dass sie eine Regelung zu
 * Betrieb und Unterhalt an der Versammlung verlangt.
 *
 * Die Fassung prüft beim Laden Anzahl und Anfänge der acht Hinweise der
 * Vorfassung und den ersetzten Satz der Begründung, und wirft sonst.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_16 } from './quorum-2026-10-16';

const AUSWEG = 'k-baulich-luxurioes-ausweg';

/** Die Anfänge der acht Hinweise der Vorfassung, in ihrer Reihenfolge. */
const ALT_ANFAENGE = [
	'Erste Bedingung: Wer nicht zustimmt, wird in seinem Nutzungs- und Gebrauchsrecht nicht dauernd',
	'Zweite Bedingung: Soweit die Arbeiten ihn vorübergehend beeinträchtigen',
	'Dritte Bedingung: Die übrigen Eigentümer übernehmen den Kostenanteil',
	'Ob der Kostenanteil auch Betrieb und Unterhalt umfasst, ist nicht geklärt.',
	'Der Ausschluss von der Nutzung wirkt wie ein Sondernutzungsrecht',
	'Steht die Anlage auf einer Fläche mit Sondernutzungsrecht',
	'Wer bestreitet, dass die drei Bedingungen erfüllt waren',
	'Die Beweislast folgt aus Art. 8 ZGB'
];

export const AUSWEG_HINWEISE: string[] = [
	'Erste Bedingung: Wer nicht zustimmt, darf durch die Anlage in der Nutzung seiner Wohnung oder ' +
		'der gemeinsamen Teile nicht dauernd beeinträchtigt werden, auch nicht durch ihren Betrieb, ' +
		'etwa durch Lärm. Wird jemand so beeinträchtigt, gilt dieser Weg für ihn nicht: Dann braucht ' +
		'es auch seine Zustimmung, und zwar von jedem, den es so trifft; belegt die Anlage eine Fläche, ' +
		'die alle benutzen, sind das alle. Massstab ist ein Durchschnittsmensch, nicht die besondere ' +
		'Empfindlichkeit Einzelner (Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 135). Wird ' +
		'trotzdem ohne seine Zustimmung beschlossen, gilt der Beschluss, wenn er ihn nicht selbst ' +
		'innert eines Monats anficht (siehe «Anfechten» unten).',
	'Gemeinsame Fläche: Belegt die Anlage dauernd eine gemeinsame Fläche, die die anderen benutzen ' +
		'dürfen, etwa ein Pool im Garten oder eine Sauna im Kellerraum, verlieren sie dieses Recht, ' +
		'auch wenn sie die Fläche kaum genutzt haben und die Anlage mitnutzen dürfen. Das kann eine ' +
		'dauernde Beeinträchtigung sein; geklärt ist es nicht. Dieses Werkzeug rechnet deshalb mit ' +
		'Einstimmigkeit: Wählen Sie an der Frage, ob jemand dauernd beeinträchtigt wird, «Ja, oder es ' +
		'ist unklar», ausser die Fläche ist so unbedeutend, dass ein Durchschnittsmensch den Verlust ' +
		'nicht bemerken würde.',
	'Fläche mit Sondernutzungsrecht: Hat ein anderer an der Fläche ein Sondernutzungsrecht, dürfen ' +
		'die übrigen ohnehin nicht hin. Dann braucht es statt der Zustimmung aller die Zustimmung des ' +
		'Berechtigten, am besten schriftlich (ZGB Art. 712g Abs. 4); beschliessen muss die Versammlung ' +
		'trotzdem. Soll die Anlage allen offenstehen, passen Sie zudem das Sondernutzungsrecht im ' +
		'Reglement an, als eigenen Antrag.',
	'Über dem eigenen Bereich: Eine Anlage über dem Bereich, den der Bauherr allein nutzt, nimmt ' +
		'den anderen nichts weg. Die Zustimmung eines Einzelnen braucht es dafür nicht, beschliessen ' +
		'muss die Versammlung trotzdem. Gemeint ist Dach oder Fassade direkt über einem Sitzplatz oder ' +
		'Garten, an dem er ein Sondernutzungsrecht hat, oder über seinem Balkon oder seiner Loggia, ' +
		'wenn sie ihm im Sonderrecht gehören oder er daran ein Sondernutzungsrecht hat, etwa seine ' +
		'Markise, auch an der Unterseite des Balkons darüber oder an der Decke der Loggia. Diese Teile ' +
		'sind gemeinschaftlich, die anderen benutzen sie aber nicht (ZGB Art. 712b Abs. 2 Ziff. 2; ' +
		'Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 143, 144; Art. 712b Rz. 66 bis 68, 70, 113, ' +
		'154, 168). Nicht dazu ' +
		'gehören Dach und Fassade im Übrigen und eine gemeinsame Dachterrasse. Aussehen und ' +
		'Nachbarwohnungen bleiben zu prüfen (siehe «Aussehen und andere Wohnungen»), etwa wenn die ' +
		'Markise an der ' +
		'Balkonplatte darüber befestigt wird. Was zu wem gehört, steht im Begründungsakt, im ' +
		'Aufteilungsplan, im Reglement oder als Dienstbarkeit im Grundbuch.',
	'Aussehen und andere Wohnungen: Ob das Aussehen allein eine dauernde Beeinträchtigung sein kann, ' +
		'ist nicht geklärt (Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 129, dort zu Art. 647d ' +
		'Abs. 2; Rz. 141, dort zu Bauberechtigungen des Sondernutzungsberechtigten im Reglement). Dass man die Anlage sieht, etwa eine ' +
		'Markise in Farbe und Art der übrigen, begründet noch keinen Zweifel; es braucht einen Grund, ' +
		'der auch einen Durchschnittsmenschen stören würde, etwa eine auffällig abweichende Farbe oder ' +
		'Form. Eine Markise, die an der Innenseite eines fremden Balkons befestigt ist oder in ihn ' +
		'hineinragt, kann dessen Eigentümer dauernd beeinträchtigen. Bleibt beim Aussehen, bei einer ' +
		'anderen Wohnung oder bei einer anderen Beeinträchtigung ein solcher Zweifel, holen Sie die ' +
		'Zustimmung der Betroffenen ein, beim Aussehen in der Regel aller, oder ändern Sie das Projekt, ' +
		'etwa durch einen anderen Standort.',
	'Zweite Bedingung: Soweit die Arbeiten jemanden, der nicht zustimmt, vorübergehend ' +
		'beeinträchtigen, etwa durch Lärm, ein Gerüst oder einen gesperrten Zugang, leisten ihm die ' +
		'Zustimmenden dafür Ersatz. Nehmen Sie diese Zusage in den Beschlusstext auf.',
	'Dritte Bedingung: Die Zustimmenden, im Titel dieser Karte «die übrigen», übernehmen den ' +
		'Kostenanteil derer, die nicht zustimmen; als ' +
		'nicht zustimmend gilt auch, wer sich enthält oder fehlt. Diese Zusage gehört in den ' +
		'Beschlusstext, sonst ist sie später nicht belegbar. Bezahlt wird nicht aus dem ' +
		'Erneuerungsfonds, an den alle beitragen, weder der übernommene Anteil noch der eigene der ' +
		'Zustimmenden (Wermelinger, SVIT-Kommentar 2023, Art. 712l Rz. 137).',
	'Betrieb und Unterhalt: Der Kommentar sagt nur, wer nicht zustimme, sei «von den anfallenden ' +
		'Kosten zu befreien» (Wermelinger, SVIT-Kommentar 2023, Art. 712h Rz. 62), nicht, ob das auch ' +
		'Betrieb und Unterhalt meint; ohne Regelung ist das also nicht sicher. Regeln Sie es deshalb im ' +
		'Beschlusstext, etwa so: Wer nicht zugestimmt hat, darf die Anlage erst nutzen, wenn er ' +
		'sich eingekauft hat. Betrieb, Unterhalt, spätere Erneuerungen und ein Rückbau gehen zulasten ' +
		'der Wohnungen der Zustimmenden und der eingekauften, nicht des Erneuerungsfonds. ' +
		'Nutzungsrecht, Kostenpflicht und das Recht, sich jederzeit einzukaufen, hängen an der Wohnung, ' +
		'nicht an der Person. Der Beschluss nennt den Preis, etwa den Anteil an den Baukosten, der mit ' +
		'den Jahren sinkt, und wer das Geld erhält, etwa die Nutzungsberechtigten im Zeitpunkt des ' +
		'Einkaufs nach ihren Wertquoten. Legen Sie das im ersten Beschluss fest; später ändern braucht ' +
		'womöglich die Zustimmung jedes Nutzungsberechtigten (ZGB Art. 712g Abs. 4). Fehlt eine solche ' +
		'Regelung, verlangt sie, wer dagegen ist, an der Versammlung.',
	'Ausschluss von der Nutzung: Er wirkt wie ein Sondernutzungsrecht der Wohnungen der ' +
		'Zustimmenden. Stellen Sie ihn als eigenen Antrag und stimmen Sie zuerst darüber ab. Verlangt ' +
		'Ihr Reglement für Sondernutzungsrechte Einstimmigkeit, rechnen Sie damit, dass er die ' +
		'Zustimmung aller braucht (Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 165). Scheitert er, ' +
		'dürfen alle die Anlage nutzen; die laufenden Kosten tragen die Wohnungen der Zustimmenden, ' +
		'wenn der Beschluss es so festlegt (siehe «Betrieb und Unterhalt»). Der Ausschluss gilt nur, wenn er als Beschluss im Protokoll steht (BGE 127 III 506 ' +
		'E. 3).',
	'Kosten bei einer Anlage im eigenen Bereich: Steht sie auf einer Fläche mit ' +
		'Sondernutzungsrecht oder direkt darüber oder über einem Balkon oder einer Loggia im ' +
		'Sonderrecht und bleibt sie dem Berechtigten vorbehalten, braucht es weder Ausschluss noch ' +
		'Einkauf. Betrieb, Unterhalt, spätere Erneuerungen, ein Rückbau und auch Ab- und ' +
		'Wiedermontage, wenn die Anlage für Arbeiten der Gemeinschaft weichen muss, gehen dann zulasten ' +
		'seiner Wohnung; legen Sie das im Beschluss fest (Wermelinger, SVIT-Kommentar 2023, Art. 712a ' +
		'Rz. 143, 144, 182; Art. 712h Rz. 110, 111).',
	'Anfechten: Wer meint, eine Bedingung fehle, etwa weil er doch dauernd beeinträchtigt wird, muss ' +
		'den Beschluss innert eines Monats beim Gericht anfechten, meist mit einem Schlichtungsgesuch ' +
		'(Art. 75 ZGB). Ob man auch nur deshalb anfechten kann, weil einen der Beschluss nicht von den ' +
		'laufenden Kosten befreit, ist nicht geklärt. Die Frist läuft für Anwesende und Vertretene ab der Versammlung, auch wenn das ' +
		'Protokoll später kommt; wer weder anwesend noch vertreten war, in der Regel ab Zustellung des ' +
		'Protokolls. Sie lässt sich nicht verlängern, auch wenn sich etwa Lärm erst im Betrieb zeigt ' +
		'(Wermelinger, SVIT-Kommentar 2023, Art. 712m Rz. 218a, 230). Ein Brief an die Verwaltung oder ' +
		'eine Einsprache gegen die Baubewilligung genügt nicht. Ohne Anfechtung gilt der Beschluss. Vor ' +
		'Gericht muss, wer anficht, beweisen, dass eine Bedingung fehlte (Art. 8 ZGB; Rz. 135a ad ' +
		'Art. 712a, gestützt auf einen Entscheid des Kantonsgerichts Graubünden, der andere Gerichte ' +
		'nicht bindet). Einen Einwand lassen Sie am besten schon an der Versammlung ins Protokoll ' +
		'aufnehmen.'
];

/** Die Begründung der Vorfassung, Teilsatz, der wie eine Feststellung las. */
const BEGRUENDUNG_ALT =
	'Wer nicht zustimmt, wird nicht dauernd beeinträchtigt, erhält Ersatz für eine vorübergehende ' +
	'Beeinträchtigung, und die übrigen übernehmen seinen Kostenanteil. Die Kostenübernahme allein ' +
	'genügt nicht; fehlt eine Bedingung, bleibt es bei Abs. 1.';
const BEGRUENDUNG_NEU =
	'Wer nicht zustimmt, darf nicht dauernd beeinträchtigt werden, erhält Ersatz für eine ' +
	'vorübergehende Beeinträchtigung, und die Zustimmenden übernehmen seinen Kostenanteil. Die ' +
	'Kostenübernahme allein genügt nicht; fehlt eine Bedingung für jemanden, braucht es auch seine ' +
	'Zustimmung (Abs. 1).';

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function fassung20261017(k: Ergebnisknoten): Ergebnisknoten {
	if (k.id !== AUSWEG) return k;
	const alt = k.hinweise ?? [];
	if (alt.length !== ALT_ANFAENGE.length || alt.some((h, i) => !h.startsWith(ALT_ANFAENGE[i]))) {
		throw new Error('Fassung 2026-10-17: Die Hinweise am Ausweg sind nicht die der Vorfassung.');
	}
	if ((k.begruendung ?? '').split(BEGRUENDUNG_ALT).length !== 2) {
		throw new Error('Fassung 2026-10-17: Die Begründung am Ausweg ist nicht die der Vorfassung.');
	}
	return {
		...k,
		begruendung: k.begruendung!.replace(BEGRUENDUNG_ALT, BEGRUENDUNG_NEU),
		hinweise: AUSWEG_HINWEISE
	};
}

export const REGELWERK_2026_10_17 = {
	...REGELWERK_2026_10_16,
	fassung: '2026-10-17',

	knoten: REGELWERK_2026_10_16.knoten.map(fassung20261017),

	freigabevermerk:
		REGELWERK_2026_10_16.freigabevermerk +
		' In der Fassung 2026-10-17 sind die Hinweise zur luxuriösen Massnahme mit Kostenübernahme neu ' +
		'gegliedert: die erste Bedingung mit ihrer Folge, die Sonderfälle je für sich, dazu, was tun ' +
		'muss, wer dagegen ist.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
