/**
 * Ein Mehrheitserfordernis vorschlagen und gegenprüfen (FR-59, rein).
 *
 * **Das Modell beantwortet Rückfragen, es wählt kein Erfordernis.** Die
 * Anwendung läuft den Baum und legt jede Frage einzeln vor — mit ihrem
 * Hilfetext und ihren zwei bis vier Antworten. Das Modell wählt eine davon.
 * Welcher Fall daraus wird, rechnet `laufe()` aus, also unser eigener Code an
 * der geltenden Fassung.
 *
 * **Zwei Anläufe waren nötig, beide gegen echte Geschäfte gemessen
 * (05.08.2026).**
 *
 * Der erste liess das Modell den Fall unmittelbar wählen. Es ordnete einen
 * **Liftanbau** als «notwendige bauliche Massnahme» ein — einfaches Mehr statt
 * qualifiziertem, und ohne sich als unsicher zu melden. Genau die gefährliche
 * Richtung. Wer die Rückfragen weglässt, verlangt vom Modell die
 * Rechtsanwendung; wer sie mitgibt, verlangt Lesen.
 *
 * Der zweite legte den **ganzen Baum** vor und verlangte den Weg als Liste von
 * Antwortkennungen. Vier von sechs Wegen waren unbrauchbar: Das Modell gab
 * Fragekennungen statt Antwortkennungen zurück oder sprang. Sicher, aber
 * nutzlos.
 *
 * Jetzt läuft die Anwendung den Baum und legt **eine Frage nach der anderen**
 * vor. Das Modell wählt aus zwei bis vier Antworten — mehr kann es nicht tun.
 * Das kostet einen Aufruf je Frage und ist der Weg, den auch ein Mensch geht.
 *
 * **Die KI setzt nie.** Was hier entsteht, ist ein Vorschlag samt Weg dorthin.
 * Die Sitzungsleitung durchläuft den Baum trotzdem selbst; der Vorschlag sagt
 * ihr nur, wo sie anfangen soll.
 *
 * **Im Zweifel das strengere Erfordernis.** Ein zu streng gefasster Beschluss
 * ist gültig, ein zu schwach gefasster anfechtbar (ZGB Art. 712m Abs. 2 i.V.m.
 * Art. 75). Diese Unsymmetrie ist der Grund, warum bei Unsicherheit nicht
 * gemittelt, sondern angehoben wird — und warum der Baum eigene
 * Grenzfall-Antworten hat, die das Modell wählen darf.
 */
import { laufe, type Schritt } from './entscheidbaum';
import { FachlicherFehler } from './gemeinschaft';
import { strenge, type Ergebnistyp, type Frage, type Regelwerk } from './regelwerk';

export interface Vorschlag {
	astId: string;
	astTitel: string;
	knotenId: string;
	titel: string;
	rechtsgrundlage: string;
	typ: Ergebnistyp;
	/** Die Rückfragen, die zu ihm führen — wörtlich verlangt in FR-59. */
	schritte: Modellschritt[];
	/**
	 * Ob das Modell sich für unsicher erklärt hat.
	 *
	 * Kein Mangel des Vorschlags, sondern eine Warnung an die Sitzungsleitung:
	 * Hier lohnt sich die eigene Prüfung besonders.
	 */
	grenzfall: boolean;
}

export interface Vorschlagslage {
	vorschlag: Vorschlag | null;
	/** Warum es keinen gibt — für die Anzeige. */
	grund: string | null;
}

/** Ein Schritt, den das Modell beantwortet hat — mit seiner Begründung. */
export interface Modellschritt extends Schritt {
	begruendung: string;
	unsicher: boolean;
}

/**
 * Der Auftrag, den **Einstieg** zu wählen.
 *
 * Ein eigener Schritt, weil die Äste keine Frage des Baums sind, sondern seine
 * Eingänge — und weil ein falscher Einstieg jede folgende Antwort wertlos
 * macht.
 */
export function einstiegsauftrag(rw: Regelwerk): string {
	return [
		'Du ordnest ein Geschäft einer Stockwerkeigentümerversammlung nach schweizerischem Recht',
		'ein (ZGB Art. 712a ff.). **Du wählst kein Mehrheitserfordernis** — du sagst nur, um',
		'welche Art von Geschäft es geht.',
		'',
		'Wähle genau einen Einstieg:',
		...rw.aeste.map((a) => `- ${a.id} = ${a.titel}: ${a.beschreibung}`),
		'',
		'Antworte ausschliesslich mit JSON, ohne Zäune und ohne Vorrede:',
		'{"astId":"…","begruendung":"in einem Satz"}'
	].join('\n');
}

export function lesbarerEinstieg(roh: unknown, rw: Regelwerk): string | null {
	if (typeof roh !== 'object' || roh === null) return null;
	const id = (roh as { astId?: unknown }).astId;
	if (typeof id !== 'string') return null;
	return rw.aeste.some((a) => a.id === id.trim()) ? id.trim() : null;
}

/**
 * Der Auftrag für **eine** Rückfrage.
 *
 * **Mitsamt dem Hilfetext.** Er trägt die Einordnung: «Ersatz von Defektem
 * durch Gleichwertiges» sagt einem Modell mehr über «notwendig» als das Wort
 * selbst. Er steht ohnehin in der Oberfläche und ist über niemanden eine
 * Auskunft.
 */
export function frageauftrag(frage: Frage): string {
	return [
		'Du beantwortest eine Rückfrage des Entscheidbaums für Stockwerkeigentümerversammlungen',
		'nach schweizerischem Recht (ZGB Art. 712a ff.).',
		'',
		`Frage: ${frage.text}`,
		...(frage.hilfe ? [`Anhaltspunkte: ${frage.hilfe}`] : []),
		'',
		'Wähle genau eine Antwort:',
		...frage.antworten.map((a) => `- ${a.id} = «${a.text}»${a.hilfe ? ` (${a.hilfe})` : ''}`),
		'',
		// Die Unsymmetrie ist der Kern: Zu streng ist gültig, zu schwach ist
		// anfechtbar. Ein Modell, das im Zweifel abwärts rundet, wäre gefährlich.
		'Bist du unsicher, wähle die Antwort, die zum **strengeren** Mehrheitserfordernis führt',
		'— oder eine ausdrückliche Unsicher-Antwort, falls es eine gibt — und setze',
		'"unsicher": true. Ein zu streng gefasster Beschluss ist gültig, ein zu schwach',
		'gefasster anfechtbar.',
		'',
		'Antworte ausschliesslich mit JSON, ohne Zäune und ohne Vorrede:',
		'{"antwortId":"…","unsicher":false,"begruendung":"in einem Satz"}'
	].join('\n');
}

export interface Modellantwort {
	antwortId: string;
	unsicher: boolean;
	begruendung: string;
}

/**
 * Nimmt eine Antwort entgegen — und lässt nur zu, was an dieser Frage steht.
 *
 * Mehr kann das Modell nicht tun: Es wählt aus zwei bis vier Möglichkeiten.
 * Ein erfundenes Mehrheitserfordernis ist auf diesem Weg unmöglich.
 */
export function lesbareAntwort(roh: unknown, frage: Frage): Modellantwort | null {
	if (typeof roh !== 'object' || roh === null) return null;
	const v = roh as Record<string, unknown>;
	const id = typeof v.antwortId === 'string' ? v.antwortId.trim() : '';
	if (!frage.antworten.some((a) => a.id === id)) return null;
	return {
		antwortId: id,
		unsicher: v.unsicher === true,
		begruendung: typeof v.begruendung === 'string' ? v.begruendung.trim() : ''
	};
}

/**
 * Setzt aus dem gelaufenen Weg den Vorschlag zusammen.
 *
 * Der Fall wird **gerechnet, nicht geglaubt**: `laufe()` an der geltenden
 * Fassung. Endet der Weg mitten im Baum, gibt es keinen Vorschlag — die offene
 * Frage ist trotzdem eine brauchbare Auskunft.
 */
export function vorschlagAus(
	rw: Regelwerk,
	astId: string,
	schritte: readonly Modellschritt[]
): Vorschlagslage {
	let lauf;
	try {
		lauf = laufe(
			rw,
			astId,
			schritte.map((s) => s.antwortId)
		);
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) {
			return { vorschlag: null, grund: `Der Weg passt nicht zum Entscheidbaum: ${fehler.message}` };
		}
		throw fehler;
	}

	if (lauf.stand.art === 'frage') {
		return {
			vorschlag: null,
			grund: `Die Einschätzung bleibt bei einer offenen Frage stehen: «${lauf.stand.frage.text}» Bitte selbst entscheiden.`
		};
	}

	const ast = rw.aeste.find((a) => a.id === lauf.astId);
	const k = lauf.stand.knoten;
	return {
		vorschlag: {
			astId: lauf.astId,
			astTitel: ast?.titel ?? '',
			knotenId: k.id,
			titel: k.titel,
			rechtsgrundlage: k.rechtsgrundlage,
			typ: k.typ,
			schritte: [...schritte],
			// Der Baum kennt eigene Grenzfall-Knoten; landet der Weg dort, ist es
			// einer, ob das Modell sich dazu bekennt oder nicht.
			grenzfall: schritte.some((s) => s.unsicher) || k.typ === 'grenzfall'
		},
		grund: null
	};
}

export type Vergleichsart =
	| 'gleich'
	| 'strenger_gesetzt'
	| 'schwaecher_gesetzt'
	| 'anderer_fall'
	| 'unvergleichbar';

export interface Gegenpruefung {
	art: Vergleichsart;
	/** Der Satz für die Anzeige. Er sagt nie, was zu tun ist. */
	satz: string;
	/** Ob die Sitzungsleitung hinsehen sollte. */
	auffaellig: boolean;
}

/**
 * Vergleicht ein gesetztes Erfordernis mit dem vorgeschlagenen (FR-59).
 *
 * **Ein Hinweis, kein Urteil.** Weicht das Gesetzte ab, kann das ebenso gut
 * heissen, dass die Sitzungsleitung den Sachverhalt besser kennt als ein
 * Modell, das drei Zeilen Text gelesen hat. Der Satz nennt deshalb den
 * Unterschied und seine Folge — und überlässt den Schluss dem Menschen.
 */
export function gegenpruefung(
	gesetzt: { knotenId?: string | null; typ: Ergebnistyp; titel: string } | null,
	vorschlag: Vorschlag
): Gegenpruefung | null {
	if (gesetzt === null) return null;

	if (gesetzt.knotenId && gesetzt.knotenId === vorschlag.knotenId) {
		return {
			art: 'gleich',
			satz: `Der Vorschlag deckt sich mit dem gesetzten Erfordernis («${vorschlag.titel}»).`,
			auffaellig: false
		};
	}

	const gesetztRang = strenge(gesetzt.typ);
	const vorschlagRang = strenge(vorschlag.typ);

	/*
	 * **Nicht jedes Erfordernis liegt auf einer Leiter.** Ein Reglementsmehr —
	 * zwei Drittel der Anwesenden — ist nicht ohne Weiteres mehr oder weniger
	 * als die Hälfte aller Wertquoten; ein Grenzfall ist ungeklärt. Hier eine
	 * Richtung zu behaupten, wäre eine Rechtsauskunft, die niemand geben kann.
	 */
	if (gesetztRang === null || vorschlagRang === null) {
		return {
			art: 'unvergleichbar',
			satz:
				`Das Modell kommt auf «${vorschlag.titel}». Ob das mehr oder weniger verlangt als ` +
				'das gesetzte Erfordernis, lässt sich nicht allgemein sagen — ein Mehr der Anwesenden ' +
				'und ein Mehr aller Wertquoten sind nicht dieselbe Leiter. Bitte selbst vergleichen.',
			auffaellig: true
		};
	}

	if (gesetztRang === vorschlagRang) {
		// Anderer Weg, gleiche Mehrheit: erwähnenswert, aber kein Grund zur Sorge.
		return {
			art: 'anderer_fall',
			satz:
				`Das Modell ordnet das Geschäft einem anderen Fall zu («${vorschlag.titel}»), ` +
				'kommt aber auf dieselbe Mehrheit. Für die Zählung ändert das nichts; für die ' +
				'Begründung im Protokoll kann es eine Rolle spielen.',
			auffaellig: false
		};
	}

	if (gesetztRang > vorschlagRang) {
		/*
		 * Strenger als nötig ist der harmlose Fall: Ein Beschluss, der eine
		 * höhere Mehrheit erreicht hat als erforderlich, ist gültig. Er kann
		 * allerdings scheitern, obwohl er nicht müsste — deshalb wird es gesagt.
		 */
		return {
			art: 'strenger_gesetzt',
			satz:
				`Sie verlangen mehr als das Modell («${vorschlag.titel}» wäre nach seiner Einschätzung ` +
				'genug). Ein Beschluss mit zu hoher Mehrheit ist gültig — er kann aber scheitern, ' +
				'obwohl er es nicht müsste.',
			auffaellig: true
		};
	}

	return {
		art: 'schwaecher_gesetzt',
		satz:
			`Das Modell kommt auf ein **strengeres** Erfordernis («${vorschlag.titel}»). ` +
			'Das ist die Richtung, in der ein Fehler teuer wird: Ein Beschluss, der die nötige ' +
			'Mehrheit nicht erreicht hat, ist anfechtbar (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). ' +
			'Sehen Sie hier bitte selbst nach.',
		auffaellig: true
	};
}
