import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { text } from '$lib/server/formular';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeTraktanden } from '$lib/server/traktanden';
import { holeDurchgaenge } from '$lib/server/abstimmung';
import { durchAnderesTraktandumErsetzt } from '$lib/domain/abstimmung';
import {
	halteWeisungFest,
	holeWeisungspflichtige,
	holeWeisungsstand,
	leiteWeisungAusBeschlussAb,
	leiteWeisungenAbSammel,
	setzeWeisungsbindung,
	stimmeNachWeisungenAb,
	trageOhneBeschlussEin,
	type Sammelbefund
} from '$lib/server/weisung';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import {
	holeMitgliedsgemeinschaft,
	type Weisungsquelle
} from '$lib/server/weisungsquellen';
import type { Actions, PageServerLoad } from './$types';
import type { Haltung, Weisungsherkunft } from '$lib/domain/weisung';

/**
 * Die Weisungen der Mitgliedsgemeinschaften (Stories 7.3 und 7.4).
 *
 * Erreichbar nur, wo es Mitgliedsgemeinschaften gibt — bei einer gewöhnlichen
 * STWEG hätte die Seite keinen Gegenstand.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const versammlung = await holeVersammlung(op, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [traktanden, pflichtige, durchgaenge, gemeinschaft] = await Promise.all([
		holeTraktanden(op, params.id),
		holeWeisungspflichtige(op, versammlung.stwegId, versammlung.datum),
		holeDurchgaenge(op, params.id),
		holeGemeinschaft(op, versammlung.stwegId)
	]);

	// Je Traktandum der Stand. Nur Abstimmungen — über eine Kenntnisnahme wird
	// nicht angewiesen, weil nicht abgestimmt wird.
	const zeilen = [];
	for (const t of traktanden.filter((x) => x.knoten.art === 'abstimmung')) {
		const stand = await holeWeisungsstand(op, params.id, t.knoten.id);
		zeilen.push({
			traktandumId: t.knoten.id,
			nummer: t.nummer,
			titel: t.knoten.titel,
			antragswortlaut: t.knoten.antragswortlaut,
			// Ob schon abgestimmt wurde: Danach nimmt die Anwendung keine Weisung
			// mehr entgegen. Auch nach einer Ersetzung durch einen Folgeantrag,
			// wie der Server (`durch_anderes_traktandum_ersetzt`, Migration 133).
			abgestimmt:
				durchgaenge.some((d) => d.traktandumId === t.knoten.id && !d.ueberholtAm) ||
				durchAnderesTraktandumErsetzt(durchgaenge, t.knoten.id),
			/**
			 * Ob die Abstimmung **jetzt** offen ist (25.08.2026).
			 *
			 * `abgestimmt` beantwortet eine andere Frage: Dort zählt jeder nicht
			 * überholte Durchgang, auch der laufende. Wer damit den Knopf «Stimmen
			 * nach den Weisungen abgeben» steuerte, blendete ihn genau dann aus,
			 * wenn er gebraucht wird — die Stimmen fallen in einen offenen
			 * Durchgang.
			 */
			offen: durchgaenge.some(
				(d) => d.traktandumId === t.knoten.id && !d.ueberholtAm && d.zustand === 'offen'
			),
			stand
		});
	}

	/**
	 * Beschlüsse der Häuser, aus denen sich eine Weisung ableiten lässt.
	 *
	 * Gesucht wird je Mitgliedsgemeinschaft in ihren eigenen Versammlungen nach
	 * geschlossenen, nicht überholten Durchgängen. Angeboten wird nur, was
	 * wirklich ein Ergebnis hat.
	 */
	const quellen: Record<string, Weisungsquelle[]> = {};
	for (const p of pflichtige) {
		quellen[p.parteiId] = await holeMitgliedsgemeinschaft(op, p.parteiId);
	}

	return {
		versammlung,
		gemeinschaftName: gemeinschaft?.name ?? '',
		pflichtige,
		zeilen,
		quellen
	};
};

function handelnder(locals: App.Locals) {
	return {
		operatorId: locals.benutzer!.operatorId,
		userId: locals.benutzer!.id,
		label: locals.benutzer!.displayName
	};
}

function fachlich(fehler: unknown) {
	if (fehler instanceof FachlicherFehler) {
		return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
	}
	throw fehler;
}

export const actions: Actions = {
	/**
	 * Weisungen aus den Beschlüssen der Häuser ableiten — alle auf einmal
	 * (Auftraggeber, 25.08.2026: «Ja, und die Weisung müsstest du dann auch bauen, dass
	 * dann korrekt abgestimmt wird»).
	 *
	 * Die Anwendung **liest** die Hausbeschlüsse und rechnet sie nicht nach. Was
	 * fehlt, steht mit Grund im Hinweis.
	 */
	ableiten: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const b = await leiteWeisungenAbSammel(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum'))
			);
			return { hinweis: sammelsatz('Aus den Hausbeschlüssen übernommen', b) };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Für Häuser ohne Beschluss eintragen, was ihr Reglement dafür vorsieht.
	 *
	 * Auftraggeber, 25.08.2026: «Ist auch im Reglement geklärt. Enthaltung oder Nein als
	 * Auswahl anbieten.» Ein eigener Handgriff, weil es eine Rechtsfolge ist und
	 * keine Auskunft aus einer Abstimmung.
	 */
	ohneBeschluss: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const b = await trageOhneBeschlussEin(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum'))
			);
			return { hinweis: sammelsatz('Nach Reglement eingetragen', b) };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Stimmen der Miteigentümergemeinschaft nach den Weisungen abgeben.
	 *
	 * Dieselbe Haltung ein drittes Mal von Hand einzutippen war die letzte
	 * Gelegenheit, sich zu vertippen — und die folgenreichste, denn hier
	 * entsteht der Beschluss.
	 */
	stimmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const b = await stimmeNachWeisungenAb(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum'))
			);
			return { hinweis: sammelsatz(`${b.zeilen} Stimmen abgegeben`, b) };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	bindung: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await setzeWeisungsbindung(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('gebunden')) === 'true'
			);
			return { hinweis: 'Die Weisungsbindung ist gesetzt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	erfassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const quelle = text(daten.get('quelle'));

		try {
			// Ist ein Beschluss gewählt, wird abgeleitet statt getippt: Das Ergebnis
			// steht dort fest, und es hier einzutragen erzeugte eine zweite Wahrheit.
			if (quelle) {
				const [versammlungId, durchgangId] = quelle.split('|');
				await leiteWeisungAusBeschlussAb(handelnder(locals), params.id, {
					traktandumId: text(daten.get('traktandum')),
					parteiId: text(daten.get('partei')),
					quelleVersammlungId: versammlungId,
					quelleDurchgangId: durchgangId
				});
				return { hinweis: 'Die Weisung ist aus dem Beschluss des Hauses abgeleitet.' };
			}

			const herkunft = text(daten.get('herkunft')) as Weisungsherkunft;
			await halteWeisungFest(handelnder(locals), params.id, {
				traktandumId: text(daten.get('traktandum')),
				parteiId: text(daten.get('partei')),
				haltung: (herkunft === 'frei' ? 'frei' : text(daten.get('haltung'))) as Haltung,
				herkunft,
				bemerkung: text(daten.get('bemerkung')) || null
			});
			return { hinweis: 'Die Weisung ist festgehalten.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	}
};


/**
 * Der Satz zu einem Sammelbefund — an einer Stelle, nicht dreimal.
 *
 * **Was gelungen ist UND was nicht.** Ein Sammelweg, der nur «5 übernommen»
 * meldet, verschweigt die zwei Häuser, an denen es hängt — und genau die halten
 * die Abstimmung auf.
 */
function sammelsatz(kopf: string, b: Sammelbefund): string {
	const gut = b.gelungen.length > 0 ? `${kopf}: ${b.gelungen.join(', ')}.` : `${kopf}: nichts.`;
	if (b.offen.length === 0) return gut;
	return `${gut} Offen: ${b.offen.map((o) => `${o.name} (${o.grund})`).join('; ')}.`;
}
