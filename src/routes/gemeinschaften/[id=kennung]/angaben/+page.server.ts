import { error, fail, redirect } from '@sveltejs/kit';
import {
	bearbeiteGemeinschaft,
	entferneGemeinschaft,
	holeEntfernungshindernis,
	hatHaeuserAlsMitglieder,
	holeGemeinschaft,
	listeGemeinschaften
} from '$lib/server/gemeinschaften';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { ausFormular, formularwerte, text } from '$lib/server/formular';
import { archiviere, holeAusArchiv } from '$lib/server/archivieren';
import { veralteteErfordernisse } from '$lib/server/reglement';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Stammangaben der Gemeinschaft — ein eigener Punkt, nicht mehr die
 * Startseite (Story 6.7).
 *
 * Bisher war das Bearbeitungsformular **die** Gemeinschaftsseite. Wer eine
 * Gemeinschaft öffnete, sah Eingabefelder statt Inhalt: Bezeichnung, Adresse,
 * Nenner. Was die Gemeinschaft ausmacht — wie viele Einheiten, ob die Quoten
 * aufgehen, wann die nächste Versammlung ist — stand nirgends. Bearbeiten ist
 * eine seltene Handlung; sie gehört nicht an die Stelle, die man täglich öffnet.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	/*
	 * **Auch die archivierten** (25.08.2026, aus dem Sicherheits-Review).
	 *
	 * Daraus wird `moeglicheEltern` — die Auswahl «gehoert sie zu einer
	 * uebergeordneten?». Fehlte die archivierte Klammer darin, waere in der
	 * Liste **keine** Wahlmoeglichkeit angekreuzt, der Browser naehme die
	 * erste («Nein, sie steht fuer sich»), und das naechste Speichern einer
	 * beliebigen Angabe loeste das Haus aus der MEG — ohne Rueckfrage, ohne
	 * Meldung.
	 *
	 * Seit die Gruppe gemeinsam geht (Migration 087) ist das der zweite Grund:
	 * Ein Haus, dessen Klammer archiviert ist, steht selbst nicht mehr in der
	 * aktiven Sicht — seine eigene Angabenseite muss es trotzdem laden koennen.
	 */
	const alle = await listeGemeinschaften(locals.benutzer.operatorId, 'alle');

	// Sich selbst und die eigenen Nachkommen als übergeordnete Gemeinschaft
	// anzubieten, würde einen Ring vorschlagen, den Kern und Datenbank danach
	// zurückweisen. Besser gar nicht erst zur Wahl stellen.
	const nachkommen = new Set<string>([gemeinschaft.id]);
	let gewachsen = true;
	while (gewachsen) {
		gewachsen = false;
		for (const g of alle) {
			if (g.parentStwegId && nachkommen.has(g.parentStwegId) && !nachkommen.has(g.id)) {
				nachkommen.add(g.id);
				gewachsen = true;
			}
		}
	}

	return {
		gemeinschaft,
		/**
		 * Wer unter dieser Gemeinschaft steht — für die Rückfrage beim Archivieren.
		 *
		 * **Sie gehen mit** (Auftraggeber, 25.08.2026: «Gruppen müssen als gesamte Gruppe
		 * archiviert und wiederhergestellt werden, weil diese zusammenhängen»).
		 * Genannt werden sie trotzdem: Wer eine Klammer stilllegt, soll vorher
		 * lesen, welche fünf Häuser er mitnimmt.
		 *
		 * **Der ganze Teilbaum, nicht nur die erste Ebene** — die Ableitung in
		 * `stweg_archiv_wegen` reicht so tief wie der Baum, und die Rückfrage
		 * darf nicht weniger versprechen als sie tut.
		 */
		untergemeinschaften: [...nachkommen]
			.filter((k) => k !== params.id)
			.map((k) => alle.find((g) => g.id === k))
			.filter((g) => g !== undefined)
			.map((g) => ({
				name: g.name,
				/*
				 * **Wer schon einzeln im Archiv liegt, kommt nicht mit zurück**
				 * (25.08.2026, dritte Reviewrunde). Die Rückfrage sagte bis dahin
				 * über alle Nachkommen dasselbe: «gehen mit ins Archiv» und «kommen
				 * gemeinsam zurück». Für ein im Januar einzeln archiviertes Haus
				 * war im März beides falsch — es lag schon dort, und es blieb dort.
				 */
				/*
				 * **Nicht nur die eigene Spalte** (25.08.2026, vierte Reviewrunde).
				 * Bei A → B → C, wo B einzeln archiviert wurde, trägt C kein
				 * eigenes Datum — stünde es unter «kommt gemeinsam zurück», wäre
				 * das falsch: Nach dem Hervorholen von A hält B es weiter fest.
				 * Massgeblich ist, ob es **wegen jemand anderem** im Archiv liegt
				 * als wegen der Gemeinschaft, um die es hier geht.
				 */
				schonEinzeln:
					Boolean(g.archiviertAm) ||
					Boolean(g.imArchivWegen && g.imArchivWegen.id !== params.id)
			}))
			.sort((a, b) => a.name.localeCompare(b.name, 'de-CH')),
		/**
		 * Wessen Archivierung diese Gemeinschaft mitnimmt — für den Fall, dass
		 * man auf einem Haus steht, dessen Klammer archiviert ist.
		 */
		imArchivWegen: alle.find((g) => g.id === params.id)?.imArchivWegen ?? null,
		// `schonKind` wie beim Anlegen (A-26): Wer schon unter einer anderen steht,
		// wird gekennzeichnet — zulässig, aber es baut eine dritte Stufe.
		/*
		 * Archivierte stehen nur dann zur Wahl, wenn sie die **jetzige** Klammer
		 * sind — dann muessen sie drinstehen, sonst faellt die Zuordnung beim
		 * Speichern weg. Neu waehlen kann man sie nicht.
		 */
		/*
		 * **`imArchivSeit`, nicht `archiviertAm`** (25.08.2026, dritte
		 * Reviewrunde). Ein Haus in einer archivierten Gruppe trägt kein eigenes
		 * Datum — es stand deshalb ungekennzeichnet in der Elternauswahl **jeder**
		 * anderen Gemeinschaft. Wer es wählte, hängte seine Gemeinschaft unter
		 * eine archivierte Klammer und sah sie danach aus jeder Liste
		 * verschwinden: ohne Rückfrage, ohne Meldung.
		 */
		moeglicheEltern: alle
			.filter((g) => !nachkommen.has(g.id))
			.filter((g) => !g.imArchivSeit || g.id === gemeinschaft.parentStwegId)
			.map((g) => ({
				id: g.id,
				name: g.imArchivSeit ? `${g.name} (im Archiv)` : g.name,
				schonKind: g.parentStwegId !== null
			})),
		/**
		 * Was dem Entfernen entgegensteht — `null`, wenn nichts entgegensteht.
		 *
		 * **Vorher statt nachher** (Auftraggeber, 15.09.2026). Die Prüfung gab es schon,
		 * aber erst im Vollzug: Der Knopf stand offen, man bestätigte die
		 * Rückfrage «Endgültig entfernen?», und **dann** kam die Absage. Die
		 * Auskunft war richtig und kam zu spät, um noch etwas wert zu sein.
		 *
		 * Die Absage im Vollzug bleibt trotzdem stehen. Ein gesperrter Knopf ist
		 * eine Auskunft und keine Schranke: Zwischen dem Laden dieser Seite und
		 * dem Absenden kann jemand anders eine Versammlung anlegen, und ein
		 * Formular lässt sich auch ohne den Knopf absenden.
		 *
		 * **Was hier zuerst stand und falsch war** (Code-Review, 15.09.2026):
		 * «ohne JavaScript gibt es die Sperre gar nicht». Das stimmt nicht —
		 * `disabled` rendert der Server ins Markup, die Sperre gilt also auch auf
		 * der unhydrierten Seite. Der Grund darüber trägt allein, und eine
		 * Begründung, die nicht stimmt, macht die richtige daneben unglaubwürdig.
		 */
		/**
		 * Ob Gemeinschaften Mitglied sind: Dann steht die Trägerschaft gemäss
		 * Grundbuch im Formular und ist beim Speichern Pflicht (Ä-43).
		 */
		mitHaeusern: await hatHaeuserAlsMitglieder(locals.benutzer.operatorId, params.id),
		entfernungshindernis: await holeEntfernungshindernis(
			locals.benutzer.operatorId,
			params.id,
			gemeinschaft.name
		)
	};
};

/** Der Handelnde aus der Sitzung — dreimal gebraucht, einmal geschrieben. */
function handelnder(benutzer: NonNullable<App.Locals['benutzer']>) {
	return {
		operatorId: benutzer.operatorId,
		userId: benutzer.id,
		label: benutzer.displayName
	};
}

/** Eine fachliche Absage mit ihrer Quelle — sonst steht sie unter der falschen Überschrift. */
function fachlich(fehler: unknown, quelle: string) {
	if (fehler instanceof FachlicherFehler) {
		return fail(400, { quelle, fehler: { nachricht: fehler.message, feld: fehler.feld } });
	}
	throw fehler;
}

export const actions: Actions = {
	/*
	 * kennung: daten — `ausFormular` liest **eine** Kennung, `parentStwegId`,
	 * und die ist mit Absicht eine andere Gemeinschaft: die Klammer, unter die
	 * dieses Haus gehört. Eine Prüfung gegen `params.id` sperrte genau den Weg,
	 * für den das Feld da ist. Gehalten wird sie vom Zeilenschutz (derselbe
	 * Betreiber) und von der Ringprüfung in `vorfahren` — eine Gemeinschaft
	 * kann nicht ihr eigener Vorfahr werden.
	 */
	speichern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		try {
			await bearbeiteGemeinschaft(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				ausFormular(daten)
			);
			/*
			 * **Was die Einstellung an bestehenden Traktanden ändert** (07.10.2026).
			 * Die Einstellung zu den Enthaltungen wirkt beim Herleiten, nicht beim
			 * Zählen; ein Traktandum, das sein Erfordernis schon trägt, rechnet
			 * weiter wie bisher. Nachgezogen wird ausdrücklich, auf der
			 * Reglementsseite, wo der Kasten dafür schon steht. Hier nur die Zahl,
			 * damit niemand annimmt, die Einstellung gelte schon überall.
			 */
			/*
			 * **Gespeichert ist schon** (Codeprüfung 07.10.2026, Befund 8). Wirft
			 * die Zählung an einem Traktandum mit leerem Knoten, darf daraus keine
			 * Absage werden: Sie behauptete einen Fehler beim Speichern, der nicht
			 * stattfand. Dann bleibt nur der Verweis ohne Zahl.
			 */
			let veraltet: number | null;
			try {
				veraltet = (await veralteteErfordernisse(locals.benutzer.operatorId, params.id)).length;
			} catch (f) {
				if (!(f instanceof FachlicherFehler)) throw f;
				veraltet = null;
			}
			return { gespeichert: true, veraltet };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					quelle: 'speichern',
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					werte: formularwerte(daten, ['aiDisabledFunctions'])
				});
			}
			throw fehler;
		}
	},

	/**
	 * Die Gemeinschaft entfernen — nur, solange nichts daran hängt.
	 *
	 * Die Schranken stehen im Kern der Fachschicht und nennen ihren Grund; hier
	 * wird nur weitergereicht. Nach dem Entfernen führt kein Weg mehr auf diese
	 * Seite, deshalb geht es zur Übersicht.
	 */
	/**
	 * Archivieren und Hervorholen (Migration 086).
	 *
	 * **Steht über dem Entfernen**, weil es der mildere Weg ist: Entfernen geht
	 * nur, solange nichts daran hängt, und ist endgültig; Archivieren geht
	 * immer und nimmt nichts weg. Wer beides nebeneinander liest, wählt in aller
	 * Regel das Archiv — und genau das ist richtig.
	 */
	archivieren: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const { name } = await archiviere(
				handelnder(locals.benutzer),
				'gemeinschaft',
				params.id,
				text(daten.get('notiz'))
			);
			return {
				quelle: 'archiv',
				hinweis:
					`«${name}» liegt im Archiv: aus Auswahl und Suche genommen, sonst unverändert. ` +
					'Versammlungen, Protokolle und Siegel bleiben abrufbar.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// Die getippte Begründung reist mit zurück (25.08.2026).
				return fail(400, {
					quelle: 'archiv',
					notiz: text(daten.get('notiz')) ?? '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	hervorholen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const { name } = await holeAusArchiv(handelnder(locals.benutzer), 'gemeinschaft', params.id);
			return { quelle: 'archiv', hinweis: `«${name}» steht wieder in Auswahl und Suche.` };
		} catch (fehler) {
			return fachlich(fehler, 'archiv');
		}
	},

	entfernen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			await entferneGemeinschaft(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id
			);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				/*
				 * `quelle` sagt, **welche** der beiden Aktionen gescheitert ist. Ohne
				 * sie zeigte die Seite jeden Fehler an beiden Stellen: Ein
				 * abgewiesenes Speichern stand am 12.08.2026 auch unter «Gemeinschaft
				 * entfernen» — an einer Überschrift, mit der es nichts zu tun hat, und
				 * gelesen als «das Entfernen ist gescheitert».
				 */
				return fail(400, {
					quelle: 'entfernen',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
		redirect(303, '/gemeinschaften');
	}

};
