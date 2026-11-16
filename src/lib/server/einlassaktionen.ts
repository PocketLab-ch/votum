import { error, fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { codeAusScan } from '$lib/domain/zugang';
import type { Vertretungsgrund } from '$lib/domain/vollmacht';
import { jaNein, text } from '$lib/server/formular';
import {
	bestaetigeAnwesenheit,
	holeUebersicht,
	lasseEinMitVertretungen,
	lehneAnmeldungAb,
	loeseZugangAuf
} from '$lib/server/anwesenheit';
import { lehneSaalmeldungAb, ordneSaalmeldungZu } from '$lib/server/saaleinstieg';
import {
	fragtNachPapierabgabe,
	hebePapierabgabeAuf,
	holePapierabgaben,
	vermerkeFrageBeantwortet,
	vermerkePapierabgabe,
	type Fragweg
} from '$lib/server/papierabgabe';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

/**
 * Die Handlungen am Eingang — an **einer** Stelle, für **zwei** Seiten.
 *
 * **Warum sie hier stehen.** Der Einlass geschieht an zwei Orten: auf der
 * Anwesenheitsseite am Notebook, wo alles zusammenläuft, und auf der schmalen
 * Einlass-Seite am Telefon, die nur scannen, zeigen und entscheiden kann
 * (Auftraggeber, 20.08.2026: «Kann man das nicht auf einer separaten Seite machen? Also
 * die Handy-Lösung?»). Beide brauchen dieselben neun Handlungen.
 *
 * Zwei Abschriften liefen auseinander — und dann verhielte sich dieselbe
 * Schaltfläche am Telefon anders als am Notebook, ausgerechnet im Saal.
 *
 * Was **nicht** hier steht, ist alles, was nur die grosse Seite kann: das
 * Wandbild, das Weggehen, die Häkchenliste, das Ausgeben eines Codes, das
 * Abmelden eines Geräts, das Eröffnen. Sie bleiben dort, wo sie hingehören.
 */

/**
 * Die Kennung der Versammlung aus den Routenparametern.
 *
 * Sie ist hier `string | undefined`, weil das Modul für sich genommen nicht
 * weiss, unter welcher Route es hängt. Beide Seiten, die es benutzen, liegen
 * unter `[id=kennung]` — die Zusicherung steht deshalb an dieser einen Stelle
 * und nicht als Ausrufezeichen an vierzig.
 */
/**
 * Der Weg, den das Formular ausdrücklich nennt — oder keiner.
 *
 * Nur die beiden Wege, die eine Maske behaupten kann: gescannt (Karte oder
 * Code) und von Hand. Alles andere entsteht nicht am Formular, und `undefined`
 * ist eine Antwort, keine Lücke.
 */
function gemeldeterWeg(wert: FormDataEntryValue | null): 'gescannt' | 'von_hand' | undefined {
	const w = text(wert);
	if (w === 'von_hand') return 'von_hand';
	if (w === 'gescannt') return 'gescannt';
	return undefined;
}

/**
 * Die Antwort auf die Frage am Eingang — oder keine, weil nicht gefragt wurde.
 *
 * **Nur ein ausdrückliches «ja» setzt den Vermerk.** Aus einem fehlenden Feld
 * «digital» zu schliessen wäre richtig, aus ihm «von Hand» zu schliessen wäre
 * eine Antwort, die niemand gegeben hat — und sie sperrte ein Telefon.
 *
 * **Jedes Formular sagt, was es getan hat** (10.09.2026). Bis hierher hiess ein
 * fehlendes Feld dreierlei zugleich: Schalter aus, gefragt und verneint, oder
 * gar nicht gefragt. Die ersten beiden sind harmlos, der dritte ist ein Fehler
 * in der Maske — und er sah aus wie die beiden anderen. Genau so ist die Zeile
 * «Von Hand erfassen» in der Anwesenheitsliste ein Vierteljahr lang stumm
 * geblieben, ohne dass ein Test oder ein Wächter etwas zu melden hatte.
 *
 * Die drei Wörter trennen die Fälle:
 *
 * | Wert | heisst |
 * |---|---|
 * | `ja` | gefragt, stimmt von Hand |
 * | `nein` | gefragt, stimmt digital |
 * | `nachher` | dieses Formular fragt nicht hier, sondern danach |
 * | fehlt | niemand hat gefragt |
 *
 * `nachher` tragen die beiden Wege am gemeinsamen Abend, die sofort erfassen:
 * Der Kartenscanner schickt selbst ab, und welches Haus die Karte betrifft,
 * steht erst danach fest. Dort fragt der Kasten `Papierentscheid`.
 *
 * **Gelesen wird über `getAll`, nicht über `get`.** Ein Formular mit Häkchen
 * trägt zwei Felder desselben Namens: das versteckte `nein`, das sagt «hier
 * wurde gefragt», und das angekreuzte `ja`. `get` liefert das erste, und welches
 * das ist, hinge an der Reihenfolge im Quelltext. Ein «ja» irgendwo in der Liste
 * gewinnt; das ist die Antwort, die jemand ausdrücklich gegeben hat.
 */
function papierAntwort(daten: FormData): 'ja' | 'nein' | 'nachher' | null {
	const alle = daten.getAll('papier').map((w) => text(w));
	if (alle.includes('ja')) return 'ja';
	if (alle.includes('nein')) return 'nein';
	if (alle.includes('nachher')) return 'nachher';
	return null;
}

/**
 * Was am Eingang zur Anwesenheit dazukommt, wenn dort «stimmt von Hand»
 * gewählt wurde.
 *
 * **Warum als geteilter Helfer und nicht in der Handlung.** `einlassen` gibt es
 * zweimal: hier und, überschrieben, auf der Anwesenheitsseite (die den
 * Zugangscode gleich mit ausgibt). Dazu `bestaetigen` für die Wartenden. Wer
 * den Vermerk in eine der Umsetzungen schriebe, hätte einen Eingang, der
 * fragt, und einen, der die Antwort verliert. Dieselbe Lehre wie beim
 * Papiervermerk in der Stimmsperre: Der neue Fall gehört nicht in einen
 * Verbraucher, sondern daneben, wo alle ihn holen.
 *
 * **Nach der Anwesenheit, nicht mit ihr.** Beide schreiben in eigenen
 * Transaktionen. Scheitert der Vermerk, steht die Anwesenheit trotzdem, und
 * genau das muss die Meldung sagen: Wer «erfasst» liest und dann doch keinen
 * Vermerk hat, korrigiert nichts, weil er nichts merkt.
 */
export async function papiervermerkAusFormular(
	locals: App.Locals,
	meetingId: string,
	parteiId: string,
	daten: FormData,
	/**
	 * Wo gefragt wurde, für `paper_question_answered.channel`.
	 *
	 * **Nur die Nachtragsliste setzt ihn**, und sie muss es: Sonst stünde dort
	 * `von_hand` wie an jedem anderen handgeführten Eingang, und niemand könnte
	 * später sehen, dass diese Frage nachgeholt statt am Eingang gestellt wurde.
	 * Der Vermerk selbst (`paper_ballot`) bleibt `von_hand` — ein Nachtrag ist
	 * eine Erfassung ohne Karte, und das ist dieselbe Sache wie am Eingang.
	 */
	fragweg?: Fragweg,
	/**
	 * Ob nach diesem Eintritt wirklich noch gefragt wird — der Kasten
	 * `Papierentscheid` also erscheint.
	 *
	 * **Nur für die Antwort `nachher` von Bedeutung**, und dort entscheidend: Der
	 * Kartenscanner am gemeinsamen Abend schickt sie an jedem Scan mit, der Kasten
	 * erscheint aber nur nach einem NEUEN Eintritt. Die Aufrufer wissen das
	 * (`e.neu`), das Formular nicht.
	 */
	nachtragOffen = false
): Promise<{
	satz: string;
	papier: { parteiId: string; meetingId: string } | null;
	/**
	 * Warum kein Vermerk entstand, im Klartext und ohne Rahmen.
	 *
	 * **Für die Stellen, die mehrere Häuser auf einmal melden** (10.09.2026). Der
	 * Sammeleinlass am Abend setzt den Vermerk in mehreren Versammlungen; er
	 * braucht den Grund je Haus, nicht den fertigen Satz, sonst schachteln sich
	 * zwei Meldungen ineinander: «ohne Vermerk in Haus A: Der Vermerk konnte nicht
	 * gesetzt werden: …». Null, wenn nichts schiefging oder nichts gefragt wurde.
	 */
	grund: string | null;
}> {
	const antwort = papierAntwort(daten);
	/*
	 * **Einmal die Versammlung lesen, dann sortieren sich die Fälle** (10.09.2026,
	 * mit Migration 109 umgebaut). Der Maske zu glauben, ob die Maske gefragt hat,
	 * wäre ein Kreis; die Versammlung weiss es unabhängig davon.
	 */
	const fragt = await fragtNachPapierabgabe(handelnder(locals).operatorId, meetingId);

	if (antwort === null) {
		/*
		 * **Kein Feld, und die Versammlung fragt: Dann hat die Maske geschwiegen.**
		 *
		 * Der Eintritt steht schon; ihn hier abzuweisen hiesse, eine Partei wegen
		 * eines Fehlers im Formular nicht einzulassen. Gesagt wird es trotzdem, und
		 * zwar der Sitzungsleitung: Ein stilles «stimmt digital» ist genau die
		 * Fehlrichtung, die niemand bemerkt, bis im Saal ein Telefon mitstimmt, das
		 * nicht mitstimmen sollte.
		 *
		 * **Seit Migration 109 bleibt es nicht bei der Meldung.** Die Partei
		 * bekommt keine Antwortzeile und steht damit in der Nachtragsliste, bis
		 * jemand sie fragt. Das trägt auch dort, wo die Meldung niemanden erreicht:
		 * bei der Häkchenliste, die mit Absicht nicht fragt, und bei jeder Partei,
		 * die eintrat, während der Schalter aus war.
		 */
		if (!fragt) return { satz: '', papier: null, grund: null };
		const offen = 'Es wurde nicht gefragt, ob diese Partei von Hand abstimmt.';
		return {
			satz: ` ${offen} Sie steht in der Nachtragsliste.`,
			papier: null,
			grund: offen
		};
	}

	/*
	 * **Eine Antwort wird festgehalten, egal wie sie lautet** (Migration 109).
	 * Bei abgeschalteter Frage wird nichts festgehalten: Dann hat niemand gefragt,
	 * und «gefragt» wäre eine Behauptung über einen Vorgang, den es nicht gab.
	 */
	const halteFest = async () => {
		if (!fragt) return;
		await vermerkeFrageBeantwortet(
			handelnder(locals),
			meetingId,
			parteiId,
			fragweg ??
				(antwort === 'nachher' ? 'gescannt' : (gemeldeterWeg(daten.get('weg')) ?? 'von_hand'))
		);
	};

	if (antwort === 'nachher') {
		/*
		 * **`nachher` zählt nur, wenn der Kasten wirklich fragt** (Code-Review
		 * 10.09.2026). Der Kartenscanner am Abend schickt es an JEDEM Scan mit,
		 * auch am zweiten derselben Karte — und der zeigt keinen Kasten mehr, weil
		 * kein neuer Eintritt entstand. Ohne diese Bedingung hätte ein zweiter Scan
		 * eine Partei still und unwiderruflich aus der Nachtragsliste genommen,
		 * ohne dass jemand gefragt worden wäre. Genau die Fehlrichtung, gegen die
		 * diese Tabelle gebaut ist.
		 *
		 * Die Vorgabe ist **nicht** festhalten: Wer den Kasten nicht kennt, lässt
		 * die Partei lieber einmal zu viel auf der Liste stehen als einmal zu wenig.
		 */
		if (nachtragOffen) await halteFest();
		return { satz: '', papier: null, grund: null };
	}
	if (antwort === 'nein') {
		await halteFest();
		return { satz: '', papier: null, grund: null };
	}
	try {
		await vermerkePapierabgabe(
			handelnder(locals),
			meetingId,
			parteiId,
			// Ohne ausdrücklichen Weg: Am Eingang hat jemand einen Knopf gedrückt,
			// und keine Karte gelesen.
			gemeldeterWeg(daten.get('weg')) ?? 'von_hand'
		);
		/*
		 * **Erst danach** (Code-Review 10.09.2026). Die Antwortzeile lässt sich
		 * nicht löschen; stünde sie vor dem Vermerk, nähme eine gescheiterte
		 * Vermerkung die Partei aus der Nachtragsliste, ohne dass ein Vermerk
		 * entstanden wäre — und zurück führte kein Weg.
		 */
		await halteFest();
		return {
			satz: ' Stimmt an dieser Versammlung von Hand ab.',
			/*
			 * **Die Versammlung reist mit** (10.09.2026, für den gemeinsamen Abend).
			 * Im Haus steht sie im Pfad, am Abend nicht: Dort ist `params.id` der
			 * Abend, und der Rückweg muss sagen, welches Haus er meint. Der
			 * Rücknahmekasten schickt sie deshalb als verstecktes Feld mit; im Haus
			 * liest niemand es, dort gilt weiterhin der Pfad.
			 */
			papier: { parteiId, meetingId },
			grund: null
		};
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) {
			return {
				satz: ` Der Vermerk «stimmt von Hand ab» konnte nicht gesetzt werden: ${fehler.message}`,
				papier: null,
				grund: fehler.message
			};
		}
		throw fehler;
	}
}

function kennung(params: Partial<Record<string, string>>): string {
	const id = params.id;
	if (!id) throw new Error('Die Einlasshandlungen brauchen eine Versammlungskennung in der Route.');
	return id;
}

export function handelnder(locals: App.Locals) {
	return {
		operatorId: locals.benutzer!.operatorId,
		userId: locals.benutzer!.id,
		label: locals.benutzer!.displayName
	};
}

/**
 * Ein fachlicher Fehler wird angezeigt, kein technischer verschluckt.
 *
 * Was die Fachlogik ablehnt, ist eine Auskunft an die Sitzungsleitung; alles
 * andere gehört in die Fehlerseite, wo es auffällt.
 */
export function fachlich(fehler: unknown) {
	if (fehler instanceof FachlicherFehler) {
		return fail(400, { fehler: { nachricht: fehler.message } });
	}
	throw fehler;
}

/**
 * Was zur Kontrolle dasteht, wenn eine Karte gelesen wurde.
 *
 * **Eine Form für zwei Herkünfte.** Zur Sitzungsleitung kommt eine Karte auf
 * zwei Wegen: über die Kamera-App des Telefons (`/z/<CODE>` legt den Code in
 * einen kurzlebigen Keks, den das Laden hier abholt) und über den Scanner im
 * Fenster (`?/pruefen`). Beide bauen dieselbe Karte — sonst zeigte der eine
 * Weg den Hinweis «bereits anwesend» und der andere nicht, und niemand wüsste
 * warum.
 */
export interface Kontrollkarte {
	parteiId: string;
	name: string;
	einheiten: string[];
	/**
	 * Die Stimmkraft — «wer er ist, WQ und ob man einlässt oder nicht»
	 * (20.08.2026).
	 *
	 * Wer am Eingang eine Karte scannt, entscheidet in diesem Augenblick über ein
	 * Stimmgewicht. Ohne die Zahl steht dort nur ein Name, und der sagt nicht,
	 * was er wiegt: Eine Erbengemeinschaft mit vier Einheiten sieht aus wie jede
	 * andere Zeile.
	 */
	kopfstimmen: number;
	wertquote: number;
	gesamtquote: number;
	/** Was die Sitzungsleitung sofort sehen muss: Ist der schon drin? */
	schonAnwesend: boolean;
	/** Und: Steht er schon angemeldet im Kasten «Am Eingang»? */
	wartetSchon: boolean;
	seit: string | null;
	/**
	 * Steht für diese Partei schon der Vermerk «stimmt von Hand ab»?
	 *
	 * **Damit die Karte auch der Rückweg ist.** Das Fenster von fünf Sekunden
	 * nach dem Einlass fängt den Fehlgriff; danach braucht es eine Stelle, an
	 * der sich der Vermerk noch aufheben lässt. Die Karte ist sie: Wer am
	 * Eingang etwas richtigstellen will, hält sie ohnehin schon in der Hand und
	 * scannt sie noch einmal.
	 */
	aufPapier: boolean;
}

export function zurKontrolle(
	stand: {
		parteiId: string;
		name: string;
		einheiten: string[];
		zustand: string;
		seit: string | null;
		kopfstimmen: number;
		wertquote: number;
	},
	gesamtquote: number,
	aufPapier = false
): Kontrollkarte {
	return {
		aufPapier,
		parteiId: stand.parteiId,
		name: stand.name,
		einheiten: stand.einheiten,
		kopfstimmen: stand.kopfstimmen,
		wertquote: stand.wertquote,
		gesamtquote,
		schonAnwesend: stand.zustand === 'anwesend',
		/**
		 * Ob diese Partei schon in der Warteschlange steht.
		 *
		 * **Der Fall, aus dem zwei Kacheln wurden** (11.09.2026, vom Auftraggeber im
		 * Eingangstest gefunden): Wer seinen QR selbst abscannt, löst den Zugang
		 * ein und steht damit angemeldet im Kasten «Am Eingang». Legt er danach
		 * dieselbe Karte am Tisch vor und der Eingang scannt sie, entstand
		 * daneben eine zweite Kachel mit einem zweiten Knopfpaar — dieselbe
		 * Person, zwei Entscheidungen, und keine der beiden sagte etwas von der
		 * anderen. Die Karte weiss es jetzt und sagt es; der wartende Eintrag
		 * darunter entfällt, solange sie oben steht.
		 */
		wartetSchon: stand.zustand === 'wartet',
		seit: stand.seit
	};
}

/**
 * Ergänzt die Rückmeldung um das, was die Vollmacht mit ausgelöst hat.
 *
 * Ohne diesen Satz geschähe es lautlos: Wer eine Person einlässt, sieht die
 * Anwesenheitszahl um drei steigen und weiss nicht, warum.
 *
 * Exportiert, weil die Anwesenheitsseite das geteilte `einlassen` überschreibt
 * (QR nach dem Einlass ohne Karte, Block C1) und denselben Satz braucht —
 * zwei Abschriften liefen auseinander.
 */
export function mitVertretung(e: {
	name: string;
	mitgebracht?: string[];
	vertretungBeendet?: string | null;
	/** Hinweise, wenn mehrere Mitberechtigte einer Einheit da sind (`mitberechtigtenhinweis`). */
	mitberechtigte?: string[];
}): string {
	const teile: string[] = [];
	if (e.mitgebracht && e.mitgebracht.length > 0) {
		teile.push(
			`Als vertreten mit eingetroffen: ${e.mitgebracht.join(', ')}.`
		);
	}
	if (e.vertretungBeendet) {
		teile.push(
			`Die Vertretung durch ${e.vertretungBeendet} ist damit beendet — wer selbst da ist, übt selbst aus.`
		);
	}
	// Hier und nicht in jeder Einlassaktion: Beide `einlassen` (geteilt und
	// auf der Anwesenheitsseite) bauen ihren Satz über diese Funktion.
	if (e.mitberechtigte) teile.push(...e.mitberechtigte);
	return teile.length > 0 ? ' ' + teile.join(' ') : '';
}

export const einlassaktionen = {
	/**
	 * Einen gescannten Code **nachschlagen**, ohne etwas zu erfassen.
	 *
	 * **Warum getrennt von `scannen`.** Gewünscht am 20.08.2026: «QR-Scannen,
	 * dann gleicht der QR den Inhalt mit der DB ab und zeigt mir dies zur
	 * Kontrolle an und ich kann annehmen oder ablehnen.» Genau dieser
	 * Zwischenschritt fehlte: Wer über die Kamera scannt, hält eine fremde Karte
	 * in der Hand und will sehen, wen er da einlässt, **bevor** ein Eintrag
	 * entsteht. Der Verlauf ist nur anfügbar (AD-5) — ein versehentlich
	 * erfasster Eintritt lässt sich nicht wegnehmen, nur durch ein Weggehen
	 * ergänzen.
	 *
	 * Es wird deshalb **nichts** geschrieben: nachschlagen, hinlegen, fertig.
	 * Erfasst wird erst mit `einlassen`.
	 */
	pruefen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		// Ein Scanner liefert die Adresse aus dem QR-Code, kein blosses Kennwort.
		const code = codeAusScan(text(daten.get('code')));

		const befund = await loeseZugangAuf(locals.benutzer.operatorId, code);
		if (!befund.gueltig) {
			return fail(400, { fehler: { nachricht: befund.grund ?? 'Zugang nicht gültig.' } });
		}
		if (befund.meetingId !== kennung(params)) {
			return fail(400, {
				fehler: {
					nachricht:
						'Diese Karte gehört zu einer anderen Versammlung. Sie ist gültig — nur nicht hier.'
				}
			});
		}

		const uebersicht = await holeUebersicht(locals.benutzer.operatorId, kennung(params));
		const stand = uebersicht?.staende.find((s) => s.parteiId === befund.parteiId);
		if (!stand) {
			return fail(400, {
				fehler: { nachricht:
						'Wer zu diesem Zugang gehört, steht nicht auf der Liste der Stimmberechtigten.'
				}
			});
		}

		const papier = await holePapierabgaben(locals.benutzer.operatorId, kennung(params));
		return {
			geprueft: zurKontrolle(
				stand,
				uebersicht?.gesamtquote ?? 0,
				papier.some((p) => p.parteiId === stand.parteiId)
			)
		};
	},

	/**
	 * Anwesenheit über einen gescannten oder abgetippten Code bestätigen.
	 *
	 * Der Code wird über denselben Weg aufgelöst wie beim Eigentümer selbst und
	 * anschliessend geprüft, ob er zu **dieser** Versammlung gehört. Ohne diese
	 * Prüfung liesse sich mit der Karte einer anderen Versammlung eine Anwesenheit
	 * erzeugen — die Karte wäre gültig, nur eben für etwas anderes.
	 */
	scannen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		// Auch hier über `codeAusScan`: Ein Handscanner mit Tastatur-Emulation
		// tippt die Adresse aus dem QR-Code in das Feld, nicht den Code.
		const code = codeAusScan(text(daten.get('code')));

		const befund = await loeseZugangAuf(locals.benutzer.operatorId, code);
		if (!befund.gueltig) {
			return fail(400, { fehler: { nachricht: befund.grund ?? 'Zugang nicht gültig.' } });
		}
		if (befund.meetingId !== kennung(params)) {
			return fail(400, {
				fehler: {
					nachricht:
						'Diese Karte gehört zu einer anderen Versammlung. Sie ist gültig — nur nicht hier.'
				}
			});
		}

		try {
			const e = await bestaetigeAnwesenheit(
				handelnder(locals),
				kennung(params),
				befund.parteiId as string,
				'gescannt'
			);
			const p = await papiervermerkAusFormular(locals, kennung(params), e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, kennung(params));
			return e.neu
				? {
						bestaetigt: `${e.name} ist als anwesend erfasst.${mitVertretung(e)}${p.satz}`,
						papier: p.papier
					}
				: {
						hinweis:
							`${e.name} war bereits erfasst — es wurde kein zweiter Eintrag angelegt.` +
							mitVertretung(e) +
							p.satz,
						papier: p.papier
					};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Freigabe aus der Warteliste, oder Erfassung von Hand. */
	bestaetigen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			/*
			 * **Kein Weg ist kein «gescannt»** (24.08.2026). Hier stand
			 * `… === 'von_hand' ? 'von_hand' : 'gescannt'` — und der Knopf
			 * «Freigeben» am wartenden Eintrag schickt gar kein `weg`. Er
			 * bestätigt eine Anmeldung, die die Person selbst vom eigenen Telefon
			 * gemacht hat; im Verlauf stand danach «Karte gescannt».
			 *
			 * `undefined` heisst jetzt «nicht behauptet»; der Kern nimmt dann den
			 * Weg der Anmeldung.
			 */
			const e = await bestaetigeAnwesenheit(
				handelnder(locals),
				kennung(params),
				text(daten.get('partei')),
				gemeldeterWeg(daten.get('weg'))
			);
			const p = await papiervermerkAusFormular(
				locals,
				kennung(params),
				e.parteiId,
				daten
			);
			await verkuendeStand(locals.benutzer.operatorId, kennung(params));
			return e.neu
				? {
						bestaetigt: `${e.name} ist als anwesend erfasst.${mitVertretung(e)}${p.satz}`,
						papier: p.papier
					}
				: {
						hinweis: `${e.name} war bereits erfasst.${mitVertretung(e)}${p.satz}`,
						papier: p.papier
					};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Einlass mit Vollmachten in einem Zug (Vorschlag des Auftraggebers vom 04.08.2026).
	 *
	 * Am Eingang steht die Person mit den Blättern in der Hand. Der Umweg über
	 * die Vollmachtsseite hiesse: einlassen, Seite wechseln, je Vollmacht dreimal
	 * tippen, zurückwechseln — mit der Schlange im Rücken.
	 */
	einlassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const vertritt = daten
			.getAll('vertritt')
			.map((w) => String(w))
			.filter(Boolean);
		const dateien = daten.getAll('nachweis').filter((d): d is File => d instanceof File);

		try {
			const e = await lasseEinMitVertretungen(
				handelnder(locals),
				kennung(params),
				text(daten.get('partei')),
				{
					vertritt,
					weg: text(daten.get('weg')) === 'gescannt' ? 'gescannt' : 'von_hand',
					nachweisVorgelegt: jaNein(daten.get('nachweisVorgelegt')),
					// Ä-28: Die geteilte Aktion bedient auch das Saalgerät. Sie war der
					// dritte Aufrufer, den der erste Wächter nicht sah, weil er nur
					// `src/routes/` las — die Aktion liegt in `src/lib/server/`.
					vertretungsgrund: (text(daten.get('vertretungsgrund')) as Vertretungsgrund) || null,
					dateien
				}
			);
			// Die **aufgelöste** Kennung, nicht die aus dem Formular: `findeZiel`
			// nimmt beide (Momentaufnahme oder Stammdaten), der Vermerk sucht nur
			// nach der aus den Stammdaten.
			const p = await papiervermerkAusFormular(locals, kennung(params), e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, kennung(params));
			const zusatz =
				e.vollmachten.length > 0
					? ` Mit Vollmacht für ${e.vollmachten.join(', ')} — bestätigt und wirksam.`
					: '';
			return {
				bestaetigt: `${e.name} ist als anwesend erfasst.${zusatz}${mitVertretung(e)}${p.satz}`,
				papier: p.papier
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},


	/**
	 * Den Vermerk «stimmt von Hand ab» zurücknehmen.
	 *
	 * **Der Rückweg zur Frage am Eingang**, in zwei Rollen. Unmittelbar nach dem
	 * Einlass ist er das Rückgängig der eben getroffenen Wahl: Wer am falschen
	 * Knopf war, sieht den Satz und nimmt ihn zurück, solange die Person noch
	 * vor ihm steht. Später ist er die Korrektur.
	 *
	 * **Er nimmt nur den Vermerk zurück, nicht den Einlass.** Die Anwesenheit
	 * ist nur anfügbar (AD-5); ein Eintritt lässt sich nicht wegnehmen, nur
	 * durch ein Weggehen ergänzen. Wer sich beim Einlassen selbst vertan hat,
	 * korrigiert das in der Liste, wie bisher.
	 */
	/**
	 * Die Eingangsfrage für eine Partei **nachholen** (Migration 109).
	 *
	 * **Wer hier steht, kam herein, bevor es die Frage gab.** Der Schalter war
	 * aus, oder die Häkchenliste hat ein Dutzend Namen auf einmal abgehakt. Der
	 * Nachtrag ist deshalb kein Entscheid mitten in der Sitzung, sondern das
	 * Nachholen einer Frage, die am Eingang gestellt worden wäre.
	 *
	 * **Die Antwort kommt am Knopf mit**, wie an jedem anderen Eingang, und wird
	 * hier genauso gelesen. Deshalb steht die Handlung neben den anderen und
	 * nicht in einer Maske: Sie ist derselbe Vorgang, nur später.
	 */
	papierBeantworten: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('partei'));
		try {
			const p = await papiervermerkAusFormular(
				locals,
				kennung(params),
				parteiId,
				daten,
				'nachtrag'
			);
			if (p.grund) return fail(400, { fehler: { nachricht: p.grund } });
			await verkuendeStand(locals.benutzer.operatorId, kennung(params));
			return {
				bestaetigt: p.papier
					? 'Nachgetragen — die Partei stimmt von Hand ab.'
					: 'Nachgetragen — die Partei stimmt digital ab.',
				papier: p.papier
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	papierZuruecknehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const weg = await hebePapierabgabeAuf(
				handelnder(locals),
				kennung(params),
				text(daten.get('partei'))
			);
			/*
			 * **Auch beim Zurücknehmen verkünden.** Der Vermerk sperrt das Telefon
			 * der Partei; wer ihn wegnimmt, gibt es wieder frei. Ohne die
			 * Verkündung erführe das Gerät es erst beim nächsten Laden, und im
			 * Saal fragt dann jemand, warum er nicht stimmen kann.
			 */
			await verkuendeStand(locals.benutzer.operatorId, kennung(params));
			return weg
				? { hinweis: 'Zurückgenommen — die Partei stimmt digital ab.' }
				: { hinweis: 'Es war kein Vermerk gesetzt; nichts geändert.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	ablehnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await lehneAnmeldungAb(
				handelnder(locals),
				kennung(params),
				text(daten.get('partei')),
				text(daten.get('grund')) || undefined
			);
			await verkuendeStand(locals.benutzer.operatorId, kennung(params));
			return { hinweis: 'Anmeldung abgelehnt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/** Eine Saalmeldung einer Partei zuordnen — das ist zugleich die Bestätigung. */
	saalZuordnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await ordneSaalmeldungZu(
				handelnder(locals),
				kennung(params),
				text(daten.get('meldung')),
				text(daten.get('partei'))
			);
			/*
			 * **Auch der Saal-Zugang ist ein Eingang** (09.09.2026, im zweiten
			 * Code-Review gefunden). Wer sich über die Wand meldet und hier einer
			 * Partei zugeordnet wird, wird damit eingelassen — und die Frage
			 * «digital oder von Hand» gehört an denselben Vorgang.
			 */
			const p = await papiervermerkAusFormular(locals, kennung(params), e.parteiId, daten);
			await verkuendeStand(locals.benutzer.operatorId, kennung(params));
			return { bestaetigt: `${e.name} ist als anwesend erfasst.${p.satz}`, papier: p.papier };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},


	saalAblehnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await lehneSaalmeldungAb(
				handelnder(locals),
				kennung(params),
				text(daten.get('meldung')),
				text(daten.get('grund')) || undefined
			);
			return { hinweis: 'Meldung abgelehnt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},
} satisfies Actions;
