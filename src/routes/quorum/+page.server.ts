import { knotenNachLesart, LESARTEN_VORGABE, type Lesartenwahl } from '$lib/domain/lesarten';
import { holeLesarten } from '$lib/server/lesarten';
import { error, fail } from '@sveltejs/kit';
import { holeRegelwerk } from '$lib/rules';
import {
	erfordernisAus,
	ergebniskarte,
	laufe,
	setzeErfordernis,
	uebersteuere,
	urheberschaft,
	WAEHLBARE_TYPEN,
	basisbezeichnung,
	waehlbareBasen,
	ANFECHTUNGSHINWEIS,
	REGLEMENTSBRUCHHINWEIS,
	type Kennzahlen
} from '$lib/domain/entscheidbaum';
import type { Ergebnistyp } from '$lib/domain/regelwerk';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { mitAbsage } from '$lib/server/absage';
import { text } from '$lib/server/formular';
import { holeGemeinschaft, listeGemeinschaften } from '$lib/server/gemeinschaften';
import { stimmkraftAnsicht } from '$lib/server/eigentuemer';
import { haltErfordernisFest } from '$lib/server/erfordernis';
import {
	holeEnthaltungseinstellung,
	holePruefstand,
	holeReglementsregeln
} from '$lib/server/reglement';
import {
	enthaltungNachWahl,
	enthaltungseinstellungVon,
	karteMitEnthaltung,
	zaehlweiseFuerKarte,
	karteMitReglement,
	pruefungOffen,
	pruefungshinweis,
	wendeReglementAn,
	zahlenbeispielNachZaehlweise,
	type Enthaltungseinstellung,
	type Reglementsregel,
	type Reglementspruefstand
} from '$lib/domain/reglement';
import type { Actions, PageServerLoad } from './$types';

function heute(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Der Rechner steht für sich.
 *
 * Kein Sitzungszustand, kein Entwurf, keine Speicherung: Der Stand ergibt sich
 * aus der Adresse — Ast und Antwortfolge. Damit funktionieren der Zurück-Knopf
 * des Browsers und ein Lesezeichen von selbst, und ein Sitzungsleiter kann den
 * Pfad einem Eigentümer schicken, der ihn dann genau so vorfindet.
 *
 * **Und die Adresse ist eine Falscheingabe wert** (Block B2, 16.10.2026).
 * `?g=x` lief in `holeGemeinschaft`, das die ungültige Kennung korrekt in
 * einen FachlicherFehler übersetzt, nur fing ihn dieser Load nicht, weil sein
 * `try` erst um den Entscheidbaum lag: rohe 500 (gemessen am Dev-Stapel). Der
 * gemeinsame Fang `mitAbsage` übersetzt jetzt jede fachliche Absage des ganzen
 * Ladewegs in `error(400, …)`, wie die Aktionen es mit `fail(400, …)` tun.
 */
export const load: PageServerLoad = mitAbsage(async ({ locals, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const regelwerk = holeRegelwerk();

	// Auswahlliste des Finders — archivierte gehoeren nicht hinein.
	const gemeinschaften = await listeGemeinschaften(locals.benutzer.operatorId, 'aktiv');
	const gemeinschaftId = url.searchParams.get('g') ?? '';
	const astId = url.searchParams.get('ast') ?? '';
	const pfad = (url.searchParams.get('p') ?? '').split(',').filter(Boolean);

	// Die echten Zahlen dieser Gemeinschaft, nicht die des Lehrbuchs. Ohne
	// gewählte Gemeinschaft bleibt das Zahlenbeispiel weg — erfundene Zahlen auf
	// einer Ergebniskarte sind schlimmer als keine.
	let kennzahlen: Kennzahlen | null = null;
	let regeln: Reglementsregel[] = [];
	let enthaltung: Enthaltungseinstellung | null = null;
	let stand: Reglementspruefstand | null = null;
	// Ohne Gemeinschaft die Vorgaben, ausdrücklich (Migration 169).
	let lesarten: Lesartenwahl = LESARTEN_VORGABE;
	if (gemeinschaftId) {
		const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, gemeinschaftId);
		enthaltung = enthaltungseinstellungVon(gemeinschaft);
		[regeln, stand, lesarten] = await Promise.all([
			holeReglementsregeln(locals.benutzer.operatorId, gemeinschaftId),
			holePruefstand(locals.benutzer.operatorId, gemeinschaftId),
			holeLesarten(locals.benutzer.operatorId, { stwegId: gemeinschaftId })
		]);
		if (gemeinschaft && gemeinschaft.quotaDenominator > 0) {
			const stimmkraft = await stimmkraftAnsicht(
				locals.benutzer.operatorId,
				gemeinschaftId,
				heute()
			);
			kennzahlen = {
				kopfstimmen: stimmkraft.summeKopfstimmen,
				// Für die Einsprache nach L3 je Eigentümer (`kennzahlenNachZaehlweise`).
				eigentuemer: stimmkraft.summeEigentuemer,
				// Der Nenner aus dem Reglement, nicht die Summe der erfassten
				// Quoten: Mehr als die Hälfte «aller» Wertquoten meint 501 von
				// 1000, auch wenn erst 998 erfasst sind.
				gesamtquote: gemeinschaft.quotaDenominator,
				zaehlweise: gemeinschaft.headCountMode
			};
		}
	}

	const gemeinsam = {
		fassung: regelwerk.fassung,
		juristischGegengelesen: regelwerk.juristischGegengelesen,
		freigabevermerk: regelwerk.freigabevermerk,
		aeste: regelwerk.aeste,
		gemeinschaften: gemeinschaften.map((g) => ({ id: g.id, name: g.name })),
		gemeinschaftId,
		kennzahlen,
		// Der Reglementsvorbehalt wechselt seine Rolle: Hinweis, wo nichts
		// hinterlegt ist — ausgewiesene Anwendung, wo etwas hinterlegt ist.
		reglementOffen: stand ? pruefungOffen(stand) : false,
		reglementHinweis: stand ? pruefungshinweis(stand) : null,
		/*
		 * **Der Vermerk, den es zu sehen gab** (23.08.2026, Prüflauf I, B-23).
		 *
		 * Unter dem Feld «Vermerk zum Reglement» steht: «Erscheint bei jeder
		 * Herleitung für diese Gemeinschaft als Hinweis.» Im Prüflauf trug ein
		 * Verwalter dort § 12 Abs. 3 ein — und sah ihn nie wieder. Gespeichert
		 * wurde er (`stweg.bylaw_note`), gezeigt nirgends.
		 *
		 * Was sich nicht als Regel fassen liess, gehört genau hierher: Die
		 * Herleitung sagt, was das Regelwerk meint; der Vermerk sagt, was das
		 * Reglement daneben noch bestimmt.
		 */
		reglementsvermerk: stand?.freitext ?? null,
		waehlbar: WAEHLBARE_TYPEN.map((typ) => ({
			typ,
			bezeichnung: regelwerk.ergebnistypen.find((t) => t.typ === typ)?.bezeichnung ?? typ,
			/*
			 * **Die Bezugsgrösse gehört zum Erfordernis** (Auftraggeber, 11.08.2026): «Es
			 * gibt halt Mehrheit aller und Mehrheit der anwesenden Köpfe … das wird
			 * nicht abgebildet.» Der Typ sagt nur, wie hoch die Schwelle liegt.
			 */
			basen: {
				kopf: waehlbareBasen(typ).kopf.map((b) => ({ wert: b, text: basisbezeichnung(b) })),
				quoten: waehlbareBasen(typ).quoten.map((b) => ({ wert: b, text: basisbezeichnung(b) }))
			}
		})),
		// Alle Bezeichnungen, nicht nur die wählbaren: Der Vorschlag, von dem
		// abgewichen wurde, kann ein Reglementsmehr oder ein Grenzfall sein — und
		// dann stünde sonst die Rohkennung auf der Karte.
		bezeichnungen: Object.fromEntries(
			regelwerk.ergebnistypen.map((t) => [t.typ, t.bezeichnung])
		) as Record<string, string>,
		anfechtungshinweis: ANFECHTUNGSHINWEIS,
		reglementsbruchhinweis: REGLEMENTSBRUCHHINWEIS
	};

	if (!astId) return { ...gemeinsam, stand: null };

	const lauf = laufe(regelwerk, astId, pfad);
	if (lauf.stand.art === 'frage') {
		return {
			...gemeinsam,
			stand: { art: 'frage' as const, frage: lauf.stand.frage, schritte: lauf.schritte, astId }
		};
	}
	const hergeleitet = erfordernisAus(regelwerk, lauf);
	const angewandt = wendeReglementAn(hergeleitet, regeln, enthaltung, lesarten);
	// Nach der eingestellten Lesart, wie das Erfordernis (Review DeepSeek, B1).
	const gesetzlicheKarte = ergebniskarte(
		regelwerk,
		// L13 nicht, wo die Enthaltungsklausel sie verdrängt (Block C, Antwort 10).
			knotenNachLesart(regelwerk, lauf.stand.knoten, { ...lesarten, L13: zaehlweiseFuerKarte(angewandt, lesarten) }),
		kennzahlen ?? undefined,
		lesarten.L3
	);

	return {
		...gemeinsam,
		stand: {
			art: 'ergebnis' as const,
			karte: karteMitEnthaltung(
				karteMitReglement(
					gesetzlicheKarte,
					angewandt.regel,
					angewandt.vorbehalt,
					stand?.freitext ?? null,
					angewandt.regel && kennzahlen && !angewandt.vorbehalt
						? zahlenbeispielNachZaehlweise(angewandt.regel, kennzahlen, hergeleitet, lesarten.L3)
						: null,
					angewandt.lesart,
					hergeleitet
				),
				angewandt.enthaltung
			),
			knotenId: lauf.stand.knoten.id,
			schritte: lauf.schritte,
			astId,
			erfordernis: angewandt.erfordernis,
			urheberschaft: urheberschaft(angewandt.erfordernis),
			/*
			 * **Die Regel, die hier nicht greift** (Prüflauf I, B-19) — wie am
			 * Traktandum. Im Grenzfall wird eine hinterlegte Reglementsregel
			 * bewusst nicht angewandt; wer anschliessend von Hand setzt,
			 * verliert sie samt Wertquotenschranke und merkt es nirgends.
			 */
			regelVorbehalten:
				angewandt.vorbehalt === 'grenzfall' && angewandt.regel
					? {
							fundstelle: angewandt.regel.fundstelle,
							mitQuotenschranke: angewandt.regel.quotenSchwelle !== null
						}
					: null
		}
	};
});

export const actions: Actions = {
	/**
	 * Das Erfordernis setzen — abweichend vom Vorschlag oder ganz ohne einen.
	 *
	 * Ein POST und kein Verweis, weil hier etwas geschieht: Die Entscheidung der
	 * Sitzungsleitung geht in den Verlauf. Sie ist der Vorgang, auf den es im
	 * Streitfall ankommt.
	 */
	setzen: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const regelwerk = holeRegelwerk();

		const typ = text(daten.get('typ')) as Ergebnistyp;
		const begruendung = text(daten.get('begruendung'));
		const astId = text(daten.get('ast'));
		const pfad = text(daten.get('p')).split(',').filter(Boolean);
		const gemeinschaftId = text(daten.get('g')) || null;

		const handelnder = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};

		try {
			/*
			 * Der Vorschlag, von dem abgewichen wird, ist der **angewandte** — sonst
			 * bliebe ein Übersteuern der Reglementsregel unbemerkt und stünde als
			 * blosse Abweichung vom Gesetz im Verlauf.
			 *
			 * **Im `try`, nicht davor:** `holeLesarten` sagt bei einer fremden
			 * Gemeinschaft «Gemeinschaft nicht gefunden.», und vor dem `try` kam
			 * das als 500-Seite statt als Absage zurück (Feldteil von
			 * `e2e/fremdbetreiber.mjs`, 27.10.2026).
			 */
			const regeln = gemeinschaftId
				? await holeReglementsregeln(locals.benutzer.operatorId, gemeinschaftId)
				: [];
			const enthaltung = gemeinschaftId
				? await holeEnthaltungseinstellung(locals.benutzer.operatorId, gemeinschaftId)
				: null;
			const lesarten = gemeinschaftId
				? await holeLesarten(locals.benutzer.operatorId, { stwegId: gemeinschaftId })
				: LESARTEN_VORGABE;

			/*
			 * Der Typ sagt, wie hoch die Schwelle liegt; wovon, sagt die Basis
			 * (Auftraggeber, 11.08.2026: «Mehrheit aller und Mehrheit der anwesenden Köpfe
			 * … das wird nicht abgebildet»).
			 *
			 * **Beide Wege bekommen sie** (Prüflauf I, B-16/B-19) — hier wie am
			 * Traktandum. Bis zum 23.08.2026 kannte nur das Formular ohne Baum die
			 * Bezugsgrösse; wer den Entscheidbaum durchlief und am Ende abwich,
			 * erbte stillschweigend die Basis des Vorschlags.
			 */
			const gewaehlteBasen = {
				kopfbasis: (text(daten.get('kopfbasis')) || undefined) as never,
				quotenbasis: (text(daten.get('quotenbasis')) || undefined) as never
			};
			const vorschlag = astId
				? wendeReglementAn(
						erfordernisAus(regelwerk, laufe(regelwerk, astId, pfad)),
						regeln,
						enthaltung,
						lesarten
					)
				: null;
			const uebergang = vorschlag
				? uebersteuere(regelwerk, vorschlag.erfordernis, typ, begruendung, gewaehlteBasen)
				: setzeErfordernis(regelwerk, typ, begruendung, gewaehlteBasen);

			const erfordernis = await haltErfordernisFest(handelnder, gemeinschaftId, {
				...uebergang,
				ergebnis: enthaltungNachWahl(uebergang.ergebnis, vorschlag, enthaltung)
			});
			return { gesetzt: erfordernis, urheberschaft: urheberschaft(erfordernis) };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
