/**
 * Namen unkenntlich machen, bevor Text das Haus verlässt (rein).
 *
 * **Die Namen sind bekannt.** Wer in einer Gemeinschaft vorkommt, steht in der
 * Momentaufnahme: Eigentümer, Vertretungen, Nutzniesser. Statt zu raten, welche
 * Wortfolge ein Name sein könnte, wird gegen diese Liste gesucht — mit den
 * Formen, in denen ein Name in freiem Text tatsächlich auftaucht: «Meier»,
 * «Anna Meier», «Familie Meier», «A. Meier», «Meiers Antrag», «Mueller» statt
 * «Müller».
 *
 * **Grosszügig suchen ist hier die sichere Seite** — und damit genau umgekehrt
 * zum Personenabgleich, wo Ähnlichkeit verboten ist. Dort führt ein falscher
 * Treffer dazu, dass jemand Zutritt zu einer fremden Versammlung bekommt. Hier
 * führt ein falscher Treffer dazu, dass das Wort «Winter» eine Weile
 * «[Person 3]» heisst und danach wieder «Winter» — denn **zurückgesetzt wird
 * die Zeichenfolge, die dastand**, nicht der erfasste Name. Ein zu viel
 * geschütztes Wort kostet nichts, ein übersehener Name ist eine Übermittlung.
 *
 * **Eine Person, ein Platzhalter.** «Anna Meier», «Meier» und «A. Meier» im
 * selben Text werden alle zu «[Person 1]» (Vorgabe des Auftraggebers vom 05.08.2026). Ein
 * Modell muss erkennen können, dass dieselbe Person gemeint ist; Nummern mit
 * Buchstaben dahinter machten das schwerer statt leichter, und ein Modell las
 * «[Person 2b] [Person 2c]» prompt als zwei Leute.
 *
 * **Der Preis dafür, offen benannt:** Zurückgesetzt wird der **erfasste Name**
 * und nicht mehr die Zeichenfolge, die dastand. Aus «Familie Meier» wird beim
 * Zurücksetzen «Anna Meier». Das ist im Protokoll die richtigere Angabe — aber
 * es heisst auch, dass ein zu viel geschütztes Wort als fremder Name
 * zurückkäme. Deshalb greift die Suche bei **einwortigen** Formen nur, wo das
 * Wort gross geschrieben steht: «im winter» bleibt der Jahreszeit.
 *
 * **Bei Gleichnamigen wird nicht zugeordnet.** Gibt es zwei Meier, ist «Meier»
 * allein keine Person, sondern «[Name 1]». Eine Nummer zu vergeben hiesse, eine
 * Gleichsetzung zu behaupten, die niemand belegen kann.
 *
 * **Vollständig ist das nicht** und wird hier auch nicht behauptet. Ein Name,
 * der in keiner Liste steht — der Nachbar, der Handwerker, der Anwalt der
 * Gegenseite —, bleibt stehen. Deshalb bleibt der zweite Riegel bestehen: Es
 * geht ohnehin nur hinaus, was für die jeweilige Prüfung gebraucht wird, und
 * was hinausgeht, lässt sich vorher ansehen.
 */

/** Eine Person, deren Name geschützt wird. */
export interface Namenstraeger {
	/** Beliebige stabile Kennung; sie kommt nie in den Text. */
	id: string;
	/** Der Name, wie die Gemeinschaft ihn führt. */
	name: string;
}

interface Form {
	/** Kleingeschrieben, für den Vergleich. */
	schluessel: string;
	/** Die Person — oder `null`, wenn diese Form auf mehrere passt. */
	traegerId: string | null;
}

export interface Schild {
	/** Alle Formen, längste zuerst. */
	formen: Form[];
	/** Nummer je Träger — aus seiner Kennung gerechnet, nicht aus seiner Stelle. */
	nummern: Map<string, number>;
	/** Der erfasste Name je Träger — das Ziel des Rückwegs für «[Person n]». */
	namen: Map<string, string>;
	/** Ein Ausdruck je Empfindlichkeit: mehrwortig egal, einwortig nur gross. */
	suche: RegExp[] | null;
}

export interface Maskierung {
	text: string;
	/** Platzhalter → das, was dort stand. Für den Rückweg. */
	rueckweg: Record<string, string>;
	/** Wie oft ersetzt wurde — für die Anzeige «3 Namen geschützt». */
	anzahl: number;
}

/**
 * Wörter, die als Namensteil nichts taugen: Anreden, Rechtsformen, Bindewörter.
 *
 * Sie fliegen nicht aus dem vollen Namen, sondern nur aus den kurzen Formen —
 * «Familie Meier» bleibt als Ganzes eine Form, «Familie» allein wird keine.
 */
const KEINE_NAMENSTEILE = new Set([
	'familie',
	'fam',
	'herr',
	'herrn',
	'frau',
	'eheleute',
	'ehepaar',
	'erbengemeinschaft',
	'erbengem',
	'erben',
	'stockwerkeigentuemergemeinschaft',
	'stockwerkeigentümergemeinschaft',
	'stwe',
	'stweg',
	'gemeinschaft',
	'und',
	'oder',
	'von',
	'van',
	'der',
	'den',
	'die',
	'das',
	'ag',
	'sa',
	'gmbh',
	'sagl',
	'sàrl',
	'sarl',
	'kg',
	'co',
	'ch'
]);

/** Anreden und Sammelbezeichnungen, die einem Namen vorangestellt werden. */
const VORSATZ = /^(familie|fam\.?|herrn?|frau|eheleute|ehepaar|erbengemeinschaft|erbengem\.?|erben)\s+/i;

function ohneAkzente(wort: string): string {
	return wort.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** «Müller» → «Mueller», «Mueller» → «Müller». Beide Richtungen. */
function umlautformen(wort: string): string[] {
	const aus = new Set<string>();
	const ausgeschrieben = wort
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/Ä/g, 'Ae')
		.replace(/Ö/g, 'Oe')
		.replace(/Ü/g, 'Ue')
		.replace(/ß/g, 'ss');
	if (ausgeschrieben !== wort) aus.add(ausgeschrieben);

	// Die Gegenrichtung nur dort, wo ein Umlaut plausibel ist: «Mueller» ja,
	// «Neuenschwander» nein — sonst entstünde «Nöenschwander».
	const umlaute: Record<string, string> = { ae: 'ä', oe: 'ö', ue: 'ü' };
	const zusammengezogen = wort.replace(
		/([bcdfghjklmnpqrstvwxyz])(ae|oe|ue)/gi,
		(_treffer: string, vor: string, paar: string) => {
			const u = umlaute[paar.toLowerCase()] ?? paar;
			return vor + (paar[0] === paar[0].toUpperCase() ? u.toUpperCase() : u);
		}
	);
	if (zusammengezogen !== wort) aus.add(zusammengezogen);

	const nackt = ohneAkzente(wort);
	if (nackt !== wort) aus.add(nackt);
	return [...aus];
}

/**
 * Die Formen, in denen ein erfasster Name in freiem Text auftauchen kann.
 *
 * Bewusst kurz gehalten: keine Lautähnlichkeit, keine Abstandsmasse. Was hier
 * entsteht, sind Schreibweisen desselben Namens, keine Vermutungen über andere.
 */
export function namensformen(name: string): string[] {
	const sauber = name.trim().replace(/\s+/g, ' ');
	if (sauber === '') return [];

	const aus = new Set<string>([sauber]);

	// «Meier, Anna» → «Anna Meier» und die Teile einzeln.
	const kommagetrennt = sauber.includes(',') ? sauber.split(',').map((t) => t.trim()) : [];
	if (kommagetrennt.length === 2 && kommagetrennt.every((t) => t !== '')) {
		aus.add(`${kommagetrennt[1]} ${kommagetrennt[0]}`);
		aus.add(`${kommagetrennt[0]} ${kommagetrennt[1]}`);
	}

	const ohneVorsatz = sauber.replace(VORSATZ, '').trim();
	if (ohneVorsatz !== '' && ohneVorsatz !== sauber) aus.add(ohneVorsatz);

	// Einzelne Bestandteile — auch die Hälften eines Doppelnamens, weil «Meier»
	// für «Meier-Keller» im Saal die übliche Kurzform ist.
	const teile = ohneVorsatz
		.replace(/,/g, ' ')
		.split(/[\s-]+/)
		.map((t) => t.trim())
		.filter((t) => t !== '');
	for (const teil of teile) {
		const k = ohneAkzente(teil).toLowerCase().replace(/\.$/, '');
		// zeichenzahl-frei: Namensabgleich, keine Eingabeschranke.
		if (k.length < 3) continue;
		if (KEINE_NAMENSTEILE.has(k)) continue;
		aus.add(teil);
	}

	// «A. Meier» — die Form, die in Notizen am häufigsten vorkommt.
	const wortformen = teile.filter((t) => !KEINE_NAMENSTEILE.has(ohneAkzente(t).toLowerCase()));
	if (wortformen.length >= 2) {
		const letzter = wortformen[wortformen.length - 1];
		for (const vorn of wortformen.slice(0, -1)) {
			// zeichenzahl-frei: gehört zu vorn[0] — das zählt ebenfalls Einheiten.
			if (vorn.length >= 2) aus.add(`${vorn[0]}. ${letzter}`);
			// **Vorname und Nachname ohne das dazwischen.** Wer «Beat "Bäbu"
			// Winter» erfasst hat, schreibt in der Notiz «Beat Winter» — und ohne
			// diese Form würde daraus zweimal geschützt und beim Zurücksetzen
			// «Beat und Winter»: zwei Personen aus einer.
			aus.add(`${vorn} ${letzter}`);
		}
	}

	// Schreibweisen mit und ohne Umlaut, für jede bisherige Form.
	for (const form of [...aus]) {
		for (const abwandlung of umlautformen(form)) aus.add(abwandlung);
	}

	// zeichenzahl-frei: Namensabgleich, keine Eingabeschranke.
	return [...aus].filter((f) => f.replace(/[^\p{L}\p{N}]/gu, '').length >= 3);
}

/** Dieselbe Anrede wie im Suchausdruck, zum Abstreifen beim Nachschlagen. */
const ANREDE_VORNE =
	/^(?:familie|fam\.|herrn?|frau|eheleute|ehepaar|erbengemeinschaft|erben)\s+/;

/**
 * Ein Muster, das nur mit grossem Anfangsbuchstaben greift, sonst aber jede
 * Schreibweise nimmt.
 *
 * **Warum nicht einfach `(?=\p{Lu})` mit dem `i`-Flag:** In JavaScript matcht
 * `\p{Lu}` unter `i` auch Kleinbuchstaben — die Prüfung wäre wirkungslos
 * gewesen. Und den ganzen Ausdruck gross zu schreiben ging auch nicht: Damit
 * verlangte «Müller-Keller» ein kleines «keller» und zerfiel in zwei Treffer.
 *
 * Also Zeichen für Zeichen: der erste Buchstabe gross, alle weiteren in beiden
 * Schreibweisen.
 */
function grossAnfang(schluessel: string): string {
	return [...schluessel]
		.map((z, i) => {
			const gross = z.toLocaleUpperCase('de-CH');
			const klein = z.toLocaleLowerCase('de-CH');
			if (i === 0) return fluchten(gross);
			return gross === klein ? fluchten(z) : `[${fluchten(klein)}${fluchten(gross)}]`;
		})
		.join('');
}

function fluchten(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Baut aus den bekannten Namen das Schild.
 *
 * Einmal je Versammlung gebaut, danach für jede Prüfung wiederverwendbar.
 */
/**
 * Die Nummer einer Person — **aus ihrer Kennung, nicht aus ihrer Stelle**.
 *
 * **Einwand des Auftraggebers vom 05.08.2026:** «damit nicht bei einem Löschen aus einem
 * Meier ein Kunz wird, weil der neue Platzhalter neu belegt wird.» Genau das
 * wäre bei fortlaufender Nummerierung passiert: Wer Meier entfernt, schiebt
 * alle danach um eins nach vorn, und «[Person 3]» meint plötzlich jemand
 * anderen.
 *
 * Deshalb wird gerechnet statt gezählt. Die Nummer hängt allein an der Kennung
 * der Person; wer entfernt wird, nimmt seine Nummer mit, und niemand erbt sie.
 */
function stabileNummer(id: string): number {
	// FNV-1a, 32 Bit. Kein kryptographischer Anspruch — verlangt ist nur, dass
	// dieselbe Kennung immer dieselbe Zahl ergibt und benachbarte Kennungen
	// nicht benachbarte Zahlen.
	let h = 0x811c9dc5;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	// Vierstellig: gross genug, dass Zusammenstösse selten sind, klein genug,
	// dass «[Person 4712]» im Auftrag nicht wie eine Aktennummer aussieht.
	return (h % 9000) + 1000;
}

export function schild(traeger: readonly Namenstraeger[]): Schild {
	const jeForm = new Map<string, Set<string>>();
	const nummern = new Map<string, number>();
	const belegt = new Set<number>();

	const namen = new Map<string, string>();

	// Nach Kennung sortiert, damit die Auflösung eines Zusammenstosses nicht
	// davon abhängt, in welcher Reihenfolge die Liste hereinkam.
	const geordnet = [...traeger].sort((a, b) => a.id.localeCompare(b.id));

	for (const t of geordnet) {
		if (!nummern.has(t.id)) {
			/*
			 * **Zusammenstösse.** Zwei Kennungen können dieselbe Zahl ergeben; bei
			 * achtzig Personen und neuntausend Zahlen geschieht das etwa in einem
			 * von dreissig Beständen. Dann rückt die zweite hoch — und nur sie.
			 * Alle anderen behalten ihre Nummer, auch wenn jemand dazukommt oder
			 * verschwindet.
			 */
			let n = stabileNummer(t.id);
			while (belegt.has(n)) n = (n % 9000) + 1000;
			belegt.add(n);
			nummern.set(t.id, n);
		}
		if (!namen.has(t.id)) namen.set(t.id, t.name.trim().replace(/\s+/g, ' '));
		for (const form of namensformen(t.name)) {
			const s = form.toLocaleLowerCase('de-CH');
			const dazu = jeForm.get(s) ?? new Set<string>();
			dazu.add(t.id);
			jeForm.set(s, dazu);
		}
	}

	const formen: Form[] = [...jeForm.entries()]
		.map(([schluessel, ids]) => ({
			schluessel,
			// Passt eine Form auf mehrere, wird nicht zugeordnet.
			traegerId: ids.size === 1 ? [...ids][0] : null
		}))
		// Längste zuerst: «Anna Meier» soll gewinnen, nicht «Meier».
		.sort((a, b) => b.schluessel.length - a.schluessel.length);

	/*
	 * **Einwortige Formen nur gross geschrieben.**
	 *
	 * Seit ein Platzhalter je Person gilt, kommt der **erfasste Name** zurück und
	 * nicht mehr die Zeichenfolge, die dastand. Ein zu viel geschütztes Wort wäre
	 * damit nicht mehr harmlos: Aus «im winter» würde «im Beat Winter». Ein
	 * einzelnes Wort greift deshalb nur, wo es gross steht — mehrwortige Formen
	 * («Anna Meier», «Familie Müller») bleiben unempfindlich, weil zwei Wörter
	 * hintereinander kaum zufällig einen Namen ergeben.
	 */
	const einwortig = formen.filter((f) => !/\s/.test(f.schluessel));
	const mehrwortig = formen.filter((f) => /\s/.test(f.schluessel));
	/*
	 * **Die Anrede gehört zum Namen.** Ohne sie stünde beim Zurücksetzen
	 * «Familie Anna Meier», weil «Familie» als eigenes Wort liegen bliebe. Und
	 * ein «Frau [Person 7]» verrät nebenbei das Geschlecht, ohne dafür einen
	 * Grund zu haben.
	 */
	const ANREDE = '(?:[Ff]amilie|[Ff]am\\.|[Hh]errn?|[Ff]rau|[Ee]heleute|[Ee]hepaar|[Ee]rbengemeinschaft|[Ee]rben)\\s+';
	const grenze = (muster: string, flaggen: string) =>
		new RegExp(
			// Kein Buchstabe davor, und danach höchstens ein Fugen-s, das
			// stehenbleibt: «Meiers» wird zu «[Person 1]s», «Meierhof» bleibt.
			`(?<![\\p{L}\\p{N}])(?:${ANREDE})?(?:${muster})(?=s?(?![\\p{L}\\p{N}]))`,
			flaggen
		);

	const teile: RegExp[] = [];
	if (mehrwortig.length > 0) {
		teile.push(grenze(mehrwortig.map((f) => fluchten(f.schluessel)).join('|'), 'giu'));
	}
	if (einwortig.length > 0) {
		/*
		 * **Gross geschrieben heisst: der erste Buchstabe.**
		 *
		 * Ein erster Anlauf schrieb jede Form gross und suchte sie wörtlich —
		 * damit verlangte «Müller-Keller» ein kleines «keller» und zerfiel im
		 * Durchgang vom 05.08.2026 in zwei Treffer: «[Person 3898]-[Person 3898]».
		 * Geprüft wird deshalb nur der Anfang, der Rest bleibt gleichgültig.
		 */
		teile.push(grenze(einwortig.map((f) => grossAnfang(f.schluessel)).join('|'), 'gu'));
	}
	const suche = teile.length === 0 ? null : teile;

	return { formen, nummern, namen, suche };
}

/**
 * Die feste Bezeichnung eines Trägers: «[Person 3]».
 *
 * **Der Ankerpunkt.** Wo ein Name als Feld vorliegt — der Antragsteller, die
 * Vertretung, der Nutzniesser —, wird nicht gesucht und ersetzt, sondern von
 * vornherein diese Bezeichnung gesetzt. Suchen ist nur dort nötig, wo ein Name
 * mitten im Fliesstext steht.
 *
 * Der Rückweg dieser Bezeichnung führt immer auf den **erfassten** Namen; nur
 * abweichende Schreibweisen aus dem Fliesstext bekommen einen Buchstaben
 * dahinter. Damit können sich Feld und Fliesstext nicht in die Quere kommen.
 */
export function bezeichner(s: Schild, traegerId: string): string | null {
	const nummer = s.nummern.get(traegerId);
	return nummer === undefined ? null : `[Person ${nummer}]`;
}

/**
 * Ersetzt jede bekannte Namensform durch einen Platzhalter.
 *
 * Ein Durchgang über den Text: Weil alle Formen in einem einzigen Ausdruck
 * stehen und der längste zuerst kommt, kann keine kürzere Form nachträglich in
 * einen bereits gesetzten Platzhalter hineingreifen.
 */
export function maskiere(s: Schild, text: string): Maskierung {
	if (s.suche === null || text === '') return { text, rueckweg: {}, anzahl: 0 };

	const rueckweg: Record<string, string> = {};
	// Je Träger genau ein Platzhalter — und je mehrdeutiger Form einer, weil
	// «Meier» bei zwei Meiers keine Person ist.
	const vergeben = new Map<string, string>();
	let unbestimmte = 0;
	let anzahl = 0;

	const jeSchluessel = new Map(s.formen.map((f) => [f.schluessel, f.traegerId]));

	const ersetze = (treffer: string) => {
		// Die Anrede zählt beim Nachschlagen nicht mit — sie ist mitgefangen,
		// aber nicht Teil der Form.
		const klein = treffer.toLocaleLowerCase('de-CH').replace(ANREDE_VORNE, '');
		const traegerId = jeSchluessel.get(klein) ?? null;
		// **Je Träger ein Merkmal**, nicht je Schreibweise: Alle Formen derselben
		// Person landen auf demselben Platzhalter.
		const merkmal = traegerId ?? `?|${klein}`;

		let platz = vergeben.get(merkmal);
		if (platz === undefined) {
			if (traegerId !== null) {
				platz = `[Person ${s.nummern.get(traegerId) ?? 0}]`;
				// Zurück kommt der **erfasste** Name: Bei einem Platzhalter je
				// Person gibt es keine Schreibweise mehr, auf die man zurückfiele.
				rueckweg[platz] = s.namen.get(traegerId) ?? treffer;
			} else {
				platz = `[Name ${++unbestimmte}]`;
				// Bei einer mehrdeutigen Form ist die Zeichenfolge selbst der
				// richtige Rückweg — sie ist für alle Vorkommen dieselbe.
				rueckweg[platz] = treffer;
			}
			vergeben.set(merkmal, platz);
		}
		anzahl++;
		return platz;
	};

	// Mehrwortige Formen zuerst: «Anna Meier» soll gewinnen, nicht «Meier».
	let aus = text;
	for (const ausdruck of s.suche) {
		ausdruck.lastIndex = 0;
		aus = aus.replace(ausdruck, ersetze);
	}

	return zusammengezogen({ text: aus, rueckweg, anzahl });
}

/**
 * Zieht zwei benachbarte Platzhalter derselben Person zu einem zusammen.
 *
 * **Der Fund vom 05.08.2026.** «Beat Winter» wurde als zwei Formen erkannt und
 * zu «[Person 2b] [Person 2c]». Ein Modell liest das als zwei Personen und
 * schreibt «Beat und Winter» — im Protokoll stünde dann eine Person zu viel.
 *
 * Die Formenliste deckt den Fall inzwischen ab; das hier ist das Netz darunter,
 * weil kein Formengenerator jede Schreibweise trifft.
 */
function zusammengezogen(m: Maskierung): Maskierung {
	// Zwei gleiche Platzhalter nebeneinander: «Beat Winter» wurde als «Beat» und
	// «Winter» erkannt und stünde sonst zweimal da — beim Zurücksetzen ergäbe
	// das «Beat Winter Beat Winter».
	// Leerzeichen **oder Bindestrich**: «Mueller-Keller» zerfiel im Durchgang
	// vom 05.08.2026 genau dort.
	const paar = /(\[Person \d+\])[\s-]+\1/g;
	let text = m.text;
	let anzahl = m.anzahl;

	for (let schutz = 0; schutz < 20; schutz++) {
		const vorher = text;
		text = text.replace(paar, '$1');
		if (text === vorher) break;
		anzahl--;
	}

	return { text, rueckweg: m.rueckweg, anzahl };
}

const PLATZHALTER = /\[\s*(Person|Name)\s*(\d+)\s*\]/gi;

/**
 * Setzt die Namen wieder ein.
 *
 * **Zurück kommt, was dastand** — nicht der erfasste Name. Sonst würde aus
 * «Familie Meier» im Entwurf «Familie Anna Meier», und ein zu viel geschütztes
 * Wort («Winter», «Frei», «Gross») käme als fremder Name zurück.
 *
 * Ein Platzhalter, den die Anwendung nicht vergeben hat, bleibt stehen. Er ist
 * dann im Entwurf sichtbar, und das ist richtig so: Das Modell hat sich jemanden
 * ausgedacht, und das soll auffallen und nicht verschwinden.
 */
export function enthuelle(rueckweg: Record<string, string>, text: string): string {
	if (text === '') return text;
	return text.replace(PLATZHALTER, (treffer, art: string, nummer: string) => {
		const schluessel = `[${art[0].toUpperCase()}${art.slice(1).toLowerCase()} ${nummer}]`;
		return rueckweg[schluessel] ?? treffer;
	});
}

/**
 * Maskiert mehrere Felder gemeinsam und meldet die Bezeichnungen mit, die als
 * Feld gesetzt werden.
 *
 * Getrennt zu maskieren hiesse, dass dieselbe Person im Titel «[Person 1]» und
 * im Antragswortlaut wieder «[Person 1]» wäre — aber nur zufällig. Deshalb gilt
 * eine Nummerierung über alle Felder und über die Verweise.
 */
export function maskiereFelder<K extends string>(
	s: Schild,
	felder: Record<K, string | null | undefined>,
	/** Träger, die als Feld übermittelt werden — ihr Name gehört in den Rückweg. */
	verweise: readonly string[] = []
): { felder: Record<K, string>; rueckweg: Record<string, string>; anzahl: number } {
	const trenner = '␞';
	const schluessel = Object.keys(felder) as K[];
	const zusammen = schluessel.map((k) => (felder[k] ?? '').replaceAll(trenner, ' ')).join(trenner);
	const m = maskiere(s, zusammen);
	const teile = m.text.split(trenner);

	const aus = {} as Record<K, string>;
	schluessel.forEach((k, i) => {
		aus[k] = teile[i] ?? '';
	});

	const rueckweg = { ...m.rueckweg };
	for (const id of verweise) {
		const b = bezeichner(s, id);
		const name = s.namen.get(id);
		if (b !== null && name !== undefined) rueckweg[b] = name;
	}

	return { felder: aus, rueckweg, anzahl: m.anzahl };
}
