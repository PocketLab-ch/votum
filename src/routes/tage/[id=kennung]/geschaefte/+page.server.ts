import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { gemeinsameListe } from '$lib/domain/gemeinsameliste';
import { text } from '$lib/server/formular';
import {
	bearbeiteGeschaeft,
	erstelleGeschaeft,
	holeGemeinsameListe,
	loescheGeschaeft,
	schreibeNummern,
	setzeBeteiligte,
	setzeErfordernisAmGeschaeft,
	vereinheitlicheListe,
	verschiebeGeschaeft,
	verschiebeInGeschaeft
} from '$lib/server/geschaeft';
import { waehlbareErfordernisse } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { fehlendeMuster, uebernimmMuster } from '$lib/server/vorlagen';
import { holeTafel } from '$lib/server/versammlungstag';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Traktandenliste der gemeinsamen Versammlung.
 *
 * **Eine Sitzung, eine Liste, ein Protokoll** — so hat der Auftraggeber es am 11.08.2026
 * beschrieben. Vorher stand hier eine flache Aufzählung von «Geschäften»; die
 * Gliederung, nach der im Saal aufgerufen wird, entstand nirgends:
 *
 *     3    Budget                  Sammelpunkt, keine Abstimmung
 *     3.1  Nirgendweg 3           abgestimmt, eigener Betrag
 *     3.2  Nirgendweg 5/5a        abgestimmt, eigener Betrag
 *
 * Die Nummer ist die **Protokollnummer**: Sie wird beim Anlegen und beim
 * Verschieben auf die Traktanden der einzelnen Versammlungen geschrieben, damit
 * im Saal und im Protokoll dasselbe steht.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	/*
	 * **Erst zusammenführen, dann zeigen.** Die Pflichttraktanden entstehen beim
	 * Anlegen jeder einzelnen Versammlung und kennen den Abend nicht; ohne diesen
	 * Schritt zeigte die gemeinsame Liste nur die von Hand angelegten Geschäfte,
	 * während in den Gemeinschaften acht weitere Traktanden mit eigener Zählung
	 * stünden — der Befund vom 11.08.2026.
	 *
	 * Kein Aufräumjob: Der Aufruf ist wirkungslos, sobald nichts mehr lose ist,
	 * und rührt nichts an, was schon zu einem Geschäft gehört.
	 */
	await vereinheitlicheListe(
		{ operatorId: op, userId: locals.benutzer.id, label: locals.benutzer.displayName },
		params.id
	);

	const [geschaefte, tafel, muster] = await Promise.all([
		holeGemeinsameListe(op, params.id),
		holeTafel(op, params.id),
		fehlendeMuster(op, params.id)
	]);

	return {
		liste: gemeinsameListe(geschaefte),
		/** Mustertraktanden, die am Abend noch fehlen — leer heisst: alle da. */
		muster: muster.fehlen.map((v) => ({
			schluessel: v.schluessel,
			titel: v.titel,
			art: v.art,
			kurzfassung: v.kurzfassung ?? null
		})),
		versammlungsart: muster.art,
		/**
		 * Die Fälle des Regelwerks als Auswahlliste.
		 *
		 * «Das Quorum muss beim Erfassen definiert werden können. Sonst muss ich
		 * immer für jede Gemeinschaft einzeln erfassen» (Auftraggeber, 11.08.2026). Bei
		 * sechs Häusern waren das sechs Wege durch den Entscheidbaum für denselben
		 * Antrag.
		 */
		erfordernisse: waehlbareErfordernisse(holeRegelwerk()),
		/** Alle mittagenden Gemeinschaften — für das Ändern der Beteiligten. */
		alleHaeuser: tafel.map((z) => ({
			meetingId: z.meetingId,
			gemeinschaft: z.gemeinschaft,
			offen: z.zustand === 'entwurf' || z.zustand === 'freigegeben'
		})),
		// Nur die noch nicht eröffneten: Eine laufende Versammlung nachträglich zu
		// ergänzen ist ein Spontantraktandum; ob darüber abgestimmt werden darf,
		// entscheiden Reglement oder Universalversammlung (Story 5.11, Migrationen
		// 127 und 128).
		ergaenzbar: tafel
			.filter((z) => z.zustand === 'entwurf' || z.zustand === 'freigegeben')
			.map((z) => ({ meetingId: z.meetingId, gemeinschaft: z.gemeinschaft })),
		/** Wie viele Gemeinschaften mittagen — davon hängt ab, ob 3.n entsteht. */
		haeuser: tafel.length
	};
};

function handelnder(locals: App.Locals) {
	return {
		operatorId: locals.benutzer!.operatorId,
		userId: locals.benutzer!.id,
		label: locals.benutzer!.displayName
	};
}

/**
 * Was nach einer Absage ins Formular zurückkommt.
 *
 * **Alle Felder, und die Gemeinschaften als Liste** (offener Punkt aus der
 * Codeprüfung vom 07.10.2026). Vorher gingen die Felder über
 * `Object.fromEntries`: Von mehreren angekreuzten Gemeinschaften blieb eine,
 * und die Seite las ohnehin nur Titel und Wortlaut. Nach einer Absage stand
 * das Formular wieder mit allen Häusern, der Art «Abstimmung» und ohne Fall
 * da; wer nur den Titel nachbesserte, legte das Traktandum anders an als
 * gewollt. `aktion` sagt der Seite, welches Formular gemeint ist: Beide
 * Aktionen geben Werte zurück, und der Titel einer abgelehnten Änderung
 * landete sonst im Feld für ein neues Traktandum.
 *
 * abend: meetings — nur zurück ins Formular der Absage; wirkt auf keine Versammlung, geprüft wird beim nächsten Absenden in `erstelleGeschaeft`.
 */
function zurueck(aktion: 'anlegen' | 'aendern', daten: FormData) {
	return {
		aktion,
		geschaeft: text(daten.get('geschaeft')),
		titel: text(daten.get('titel')),
		antragswortlaut: text(daten.get('antragswortlaut')),
		art: text(daten.get('art')) === 'kenntnisnahme' ? 'kenntnisnahme' : 'abstimmung',
		erfordernis: text(daten.get('erfordernis')),
		meetings: daten.getAll('meetings').map(String)
	};
}

export const actions: Actions = {
	/*
	 * abend: meetings — die Häkchenliste wird nicht hier geprüft, sondern in
	 * `erstelleGeschaeft`, und dort schärfer als `hausDesAbends` es könnte:
	 * `WHERE m.meeting_day_id = ${tagId} AND m.id = ANY(…)` mit
	 * anschliessendem Längenvergleich. Eine fremde Kennung fällt aus der
	 * Menge, die Zahlen weichen ab, und die ganze Anlage bricht ab statt sie
	 * stillschweigend zu überspringen.
	 */
	anlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const g = await erstelleGeschaeft(handelnder(locals), params.id, {
				titel: text(daten.get('titel')),
				antragswortlaut: text(daten.get('antragswortlaut')) || null,
				art: text(daten.get('art')) === 'kenntnisnahme' ? 'kenntnisnahme' : 'abstimmung',
				meetingIds: daten.getAll('meetings').map((x) => String(x)),
				erfordernis: text(daten.get('erfordernis')) || null
			});

			// Die Nummern gleich nachziehen: Ein Traktandum ohne Nummer wäre im
			// Saal nicht aufrufbar, und im Protokoll stünde eine andere Zählung.
			await schreibeNummern(handelnder(locals), params.id);

			const n = g.traktanden.length;
			return {
				hinweis:
					n === 1
						? `«${g.titel}» steht jetzt in einer Gemeinschaft auf der Traktandenliste.`
						: `«${g.titel}» steht jetzt in ${n} Gemeinschaften auf der Traktandenliste — ` +
							'als Sammelpunkt mit einer Ziffer je Gemeinschaft, und in jeder ein eigener ' +
							'Beschluss. Die Inhalte lassen sich danach je Gemeinschaft anpassen.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					werte: zurueck('anlegen', daten)
				});
			}
			throw fehler;
		}
	},

	/**
	 * Fehlende Mustertraktanden aufnehmen (Auftraggeber, 11.08.2026).
	 *
	 * Angeboten wird nur, was fehlt. Ein Knopf, der «Muster übernehmen» heisst und
	 * beim zweiten Druck alles doppelt anlegt, ist eine Falle — und aufgefallen
	 * wäre es erst im Saal.
	 */
	muster: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await uebernimmMuster(
				handelnder(locals),
				params.id,
				daten.getAll('schluessel').map(String)
			);
			return {
				hinweis:
					`${e.titel.length === 1 ? 'Ein Mustertraktandum steht' : `${e.titel.length} Mustertraktanden stehen`} ` +
					`jetzt auf der Liste — in ${e.haeuser === 1 ? 'einer Gemeinschaft' : `allen ${e.haeuser} Gemeinschaften`}, ` +
					'unter derselben Nummer. Das Mehrheitserfordernis ist je Gemeinschaft aus deren Reglement hergeleitet.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Ein Traktandum am Abend ändern — für alle, die noch mitgehen.
	 *
	 * Wer in seinem Haus einen eigenen Wortlaut hat, behält ihn. Sonst wäre die
	 * Anpassung je Gemeinschaft bei jeder Korrektur am Abend verloren, und
	 * gemerkt hätte es niemand: Die Liste sähe danach einheitlich aus.
	 */
	aendern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await bearbeiteGeschaeft(handelnder(locals), params.id, text(daten.get('geschaeft')), {
				titel: text(daten.get('titel')),
				antragswortlaut: text(daten.get('antragswortlaut')) || null,
				art: text(daten.get('art')) === 'kenntnisnahme' ? 'kenntnisnahme' : 'abstimmung'
			});
			return {
				hinweis:
					e.geblieben === 0
						? 'Geändert — in allen beteiligten Gemeinschaften.'
						: `Geändert. ${e.mitgezogen} ${e.mitgezogen === 1 ? 'Gemeinschaft ist' : 'Gemeinschaften sind'} ` +
							`mitgezogen; ${e.geblieben} ${e.geblieben === 1 ? 'behält' : 'behalten'} den eigenen Wortlaut ` +
							'und steht weiterhin als eigene Ziffer auf der Liste.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					werte: zurueck('aendern', daten)
				});
			}
			throw fehler;
		}
	},

	/**
	 * Welche Gemeinschaften ein Traktandum führen — nachträglich ändern.
	 *
	 * «Es sollte möglich sein, Gemeinschaften nachträglich aus einem Traktandum zu
	 * entfernen oder hinzuzufügen» (Auftraggeber, 11.08.2026). Vorher war die Auswahl beim
	 * Anlegen endgültig.
	 */
	/*
	 * abend: meetings — wie beim Anlegen: `setzeBeteiligte` bindet zuerst das
	 * Geschäft über `leseGeschaeftAn(tx, tagId, …)` an den Abend der Adresse
	 * und prüft die neu dazukommenden Häuser dann gegen dessen
	 * `meeting_day_id`, wieder mit Längenvergleich.
	 */
	beteiligte: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await setzeBeteiligte(
				handelnder(locals),
				params.id,
				text(daten.get('geschaeft')),
				daten.getAll('meetings').map((x) => String(x))
			);
			await schreibeNummern(handelnder(locals), params.id);
			const teile = [
				e.dazu.length > 0 ? `dazu: ${e.dazu.join(', ')}` : null,
				e.weg.length > 0 ? `nicht mehr dabei: ${e.weg.join(', ')}` : null
			].filter(Boolean);
			return {
				hinweis:
					teile.length === 0
						? 'An den Gemeinschaften hat sich nichts geändert.'
						: `Geändert — ${teile.join('; ')}. Die Ziffern sind nachgezogen.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Das Mehrheitserfordernis eines bestehenden Traktandums setzen.
	 *
	 * «Was noch gemacht werden muss ist, dass man das Quorum ändern kann, im
	 * Bestand» (Auftraggeber, 11.08.2026). Gilt für alle Häuser des Punktes; hergeleitet
	 * wird je Gemeinschaft aus deren Reglement.
	 */
	erfordernis: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const n = await setzeErfordernisAmGeschaeft(
				handelnder(locals),
				params.id,
				text(daten.get('geschaeft')),
				text(daten.get('erfordernis'))
			);
			return {
				hinweis:
					n === 0
						? 'Nichts zu setzen — über eine Kenntnisnahme wird nicht beschlossen.'
						: `Mehrheitserfordernis gesetzt, in ${n === 1 ? 'einer Gemeinschaft' : `${n} Gemeinschaften`} ` +
							'— je aus deren Reglement hergeleitet.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Eine Gemeinschaft innerhalb eines Traktandums verschieben (3.1 ↔ 3.2).
	 *
	 * «Kann ja sein, dass die Auswahl uneinheitlich ist oder abweicht von anderen
	 * Abstimmungen mit denselben Gemeinschaften» (Auftraggeber, 11.08.2026).
	 */
	umordnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await verschiebeInGeschaeft(
				handelnder(locals),
				params.id,
				text(daten.get('geschaeft')),
				text(daten.get('traktandum')),
				text(daten.get('vor')) || null
			);
			return { hinweis: 'Reihenfolge in diesem Traktandum geändert — die Ziffern sind nachgezogen.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	entfernen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await loescheGeschaeft(handelnder(locals), params.id, text(daten.get('geschaeft')));
			await schreibeNummern(handelnder(locals), params.id);
			return {
				hinweis:
					`«${e.titel}» ist von der Liste genommen — in ${e.haeuser === 1 ? 'einer Gemeinschaft' : `${e.haeuser} Gemeinschaften`}. ` +
					'Die Nummern darunter sind nachgezogen.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Ein Traktandum an eine andere Stelle ziehen.
	 *
	 * Bewegt wird das **Geschäft**, nicht die einzelne Ziffer: 3.1 und 3.2 sind
	 * dieselbe Sache in zwei Gemeinschaften, und sie voneinander zu trennen
	 * ergäbe zwei Punkte, über die getrennt beraten würde, obwohl es einer ist.
	 * Innerhalb eines Sammelpunkts richtet sich die Reihenfolge nach dem Ablauf
	 * des Abends — dieselbe Ordnung wie beim Einlass und auf der Tafel.
	 */
	verschieben: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await verschiebeGeschaeft(
				handelnder(locals),
				params.id,
				text(daten.get('geschaeft')),
				text(daten.get('vor')) || null
			);
			return { hinweis: 'Reihenfolge geändert — die Nummern sind nachgezogen.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
