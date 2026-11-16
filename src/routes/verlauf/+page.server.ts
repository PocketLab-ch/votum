import { error } from '@sveltejs/kit';
import { holeBereiche, leseVerlauf } from '$lib/server/verlaufsabfrage';
import { holeAlleVersammlungen } from '$lib/server/versammlungen';
import { listeGemeinschaften } from '$lib/server/gemeinschaften';
import { datumLang, istKalendertag } from '$lib/domain/datum';
import { typnamenAus } from '$lib/domain/verlaufswerte';
import { holeRegelwerk } from '$lib/rules';
import type { Verlaufsfilter } from '$lib/domain/verlaufsfilter';
import type { PageServerLoad } from './$types';

/** Ein leerer Parameter ist kein Filter, sondern ein abgeschicktes leeres Feld. */
function wert(url: URL, name: string): string | undefined {
	const w = url.searchParams.get(name)?.trim();
	return w ? w : undefined;
}

/**
 * Ein Datumsfilter aus der Adresse — oder gar keiner.
 *
 * **Ein unbrauchbarer Filter filtert nichts, statt die Seite zu zerreissen**
 * (Code-Review 02.09.2026). `von` und `bis` gingen ungeprüft als `::date` in die
 * Abfrage; `/verlauf?von=2026-02-31` endete als rohe 500, weil der Aufruf im
 * `load` steht und dort niemand fängt. Eine Adresse kann jeder tippen, und ein
 * Verlauf, der bei einem Tippfehler in der Zeile abstürzt, ist im Streitfall
 * genau dann weg, wenn man ihn braucht.
 *
 * **Warum stillschweigend statt mit Absage:** Der Filter ist ein Hilfsmittel.
 * Der Verlauf zeigt dann alles statt eines Ausschnitts — sichtbar, weil die
 * Felder leer bleiben, und ohne dass jemand die Seite verliert.
 */
function datumsfilter(url: URL, name: string): string | undefined {
	const w = wert(url, name);
	return w && istKalendertag(w) ? w : undefined;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	// Nur eine ganze Seitenzahl gilt, sonst die erste (siehe `leseVerlauf`).
	const roh = Number(url.searchParams.get('seite') ?? '0');
	const seite = Number.isSafeInteger(roh) && roh > 0 ? roh : 0;
	const filter: Verlaufsfilter = {
		suche: wert(url, 'suche'),
		bereich: wert(url, 'bereich'),
		art: wert(url, 'art'),
		gegenstand: wert(url, 'gegenstand'),
		versammlung: wert(url, 'versammlung'),
		gemeinschaft: wert(url, 'gemeinschaft'),
		abend: wert(url, 'abend'),
		von: datumsfilter(url, 'von'),
		bis: datumsfilter(url, 'bis')
	};

	const [{ zeilen, weitere, gesamt }, bereiche, versammlungen, gemeinschaften] =
		await Promise.all([
		leseVerlauf(locals.benutzer.operatorId, {
			...filter,
			seite: Number.isFinite(seite) ? seite : 0
		}),
		// Ohne den Bereichsfilter selbst — sonst stünde neben jedem anderen Bereich
		// eine Null, und man sähe nicht, wohin zu wechseln sich lohnt.
		holeBereiche(locals.benutzer.operatorId, { ...filter, bereich: undefined }),
		/*
		 * Die beiden Auswahllisten (Auftraggeber, 25.08.2026: «Beim Verlauf braucht es
		 * noch einen Filter nach Versammlung und nach Gemeinschaft»).
		 *
		 * Vollstaendig und ungefiltert: Wer im Verlauf sucht, sucht oft gerade
		 * das, was gerade NICHT laeuft — eine Versammlung von vorletztem Jahr,
		 * eine Gemeinschaft, die man abgegeben hat.
		 */
		holeAlleVersammlungen(locals.benutzer.operatorId, 'alle'),
		// **Auch die archivierten**: Der Verlauf ist der Ort zum Nachschlagen, und
		// der Satz zwei Zeilen höher sagt es schon — «eine Gemeinschaft, die man
		// abgegeben hat». Ohne sie stünden Verlaufszeilen ohne Namen da.
		listeGemeinschaften(locals.benutzer.operatorId, 'alle')
	]);

	return {
		zeilen,
		weitere,
		gesamt,
		bereiche,
		versammlungen: versammlungen.map((v) => ({
			id: v.id,
			// «Nirgendweg 11 · 19. Mai 2026» — die Gemeinschaft zuerst, weil man
			// sie sucht und das Datum nur unterscheidet.
			bezeichnung: `${v.gemeinschaftName} · ${datumLang(v.datum)}`
		})),
		gemeinschaften: gemeinschaften.map((g) => ({ id: g.id, name: g.name })),
		// Die Bezeichnungen der Erfordernistypen («Qualifiziertes Mehr») stehen
		// nur im Regelwerk; hier geholt, damit die Seite nicht das ganze
		// Regelwerk in den Browser lädt (V1, 06.10.2026).
		typnamen: typnamenAus(holeRegelwerk()),
		seite: Number.isFinite(seite) ? Math.max(0, seite) : 0,
		filter
	};
};
