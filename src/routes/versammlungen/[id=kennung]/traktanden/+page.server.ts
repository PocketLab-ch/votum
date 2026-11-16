import { lesartKartensatz } from '$lib/domain/auszaehlung';
import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	ANTRAGSTELLERARTEN,
	hinweiseZu,
	SCHWELLE_KURZFASSUNG,
	type Antragstellerart,
	type TraktandumEingabe,
	type Traktandumart
} from '$lib/domain/traktanden';
import { GROESSTE_TIEFE } from '$lib/domain/traktandenbaum';
import {
	erfordernisAusKnoten,
	umstrittenSatz,
	waehlbareErfordernisse,
	type Erfordernis
} from '$lib/domain/entscheidbaum';
import { umstrittenBeiStrengererKlausel } from '$lib/domain/reglement';
import { holeRegelwerk, knotenDerFassung, knotenFuerUmstritten } from '$lib/rules';
import {
	ausstandMitVollmachten,
	mehrhinweise,
	neuAnZweiterHinweis
} from '$lib/domain/mehrhinweise';
import {
	erklaereAusstand,
	holeAusstand,
	holeVertreterOhnePartei,
	holeVollmachtenImAusstand,
	nimmAusstandZurueck
} from '$lib/server/ausstand';
import { holeVerwaltungsausstand } from '$lib/server/abstimmung';
import { ausstandsmeldung, vertreterausstandsmeldung } from '$lib/domain/auszaehlung';
import { istImEntwurf } from '$lib/domain/versammlung';
import { ganzzahl, text } from '$lib/server/formular';
import { haengeAn, holeAnhaengeDerVersammlung, loeseAb } from '$lib/server/anhaenge';
import { DateiFehler } from '$lib/server/dateien';
import { holeLesarten } from '$lib/server/lesarten';
import { holeTraktandenMitEinladungsmehr } from '$lib/server/einladungsmehr';
import { holeEigentuemer, stimmkraftAnsicht } from '$lib/server/eigentuemer';
import { listeGemeinschaften } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { zaehleVollmachten } from '$lib/server/vollmacht';
import { holeTagDerVersammlung } from '$lib/server/versammlungstag';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeMomentaufnahme } from '$lib/server/freigabe';
import { kiEingerichtet } from '$lib/server/ki';
import { haltEntscheidFest, pruefeTraktandum } from '$lib/server/traktandenpruefung';
import { reichtDieZeit, verfuegbarkeit, verlangeEntscheid, type KiFunktion } from '$lib/domain/ki';
import { pruefpunkteFuer } from '$lib/domain/traktandenpruefung';
import {
	bearbeiteTraktandum,
	bestaetigeTraktandenliste,
	erstelleTraktandum,
	setzeGewaehltesErfordernis,
	holeNeueTraktandenDerZweiten,
	holeTraktanden,
	loescheTraktandum,
	oeffneTraktandenlisteWieder,
	setzeNummer,
	verschiebeTraktandum
} from '$lib/server/traktanden';
import type { Actions, PageServerLoad } from './$types';
import { holeBetreiber } from '$lib/server/betreiber';

/**
 * Wie viele Traktanden ein Sammellauf höchstens an das Modell schickt.
 *
 * Zwanzig deckt jede Versammlung ab, die im Bestand vorkommt (die längste
 * Vorlage hat acht, der Praxisdurchlauf des Auftraggebers elf) und deckelt zugleich den Fall,
 * den niemand beabsichtigt.
 */
/*
 * **Ohne `export`** (01.09.2026): SvelteKit lässt aus `+page.server.ts` nur
 * `load`, `actions` und eine kurze Liste weiterer Namen heraus und wirft sonst
 * beim Aufbau der Seite — «Invalid export». Weder `svelte-check` noch der
 * Prüflauf sehen das; gefunden hat es der Browserdurchlauf, mit einer 500 auf
 * der Traktandenseite.
 */
const HOECHSTENS_AUF_EINMAL = 20;

/**
 * Das gesetzliche Erfordernis eines Knotens in der Fassung des gespeicherten
 * Erfordernisses (Ä-12, F-4): Eine angewandte Reglementsregel trägt es nicht
 * mehr, `umstrittenBeiStrengererKlausel` vergleicht aber mit ihm.
 */
function gesetzlichesErfordernis(fassung: string, knotenId: string): Erfordernis | null {
	/*
	 * **Kein eigener Filter nach Kennung mehr** (Fachprüfung Runde 4, N4-1): Hier
	 * stand `knotenId !== REGLEMENT_NORMAL_KNOTEN`, und als die Fassung 2026-11-18
	 * zwei Karten mit demselben Mehr brachte, kam der Vermerk dort nie an, obwohl
	 * der Kern sie kannte. Welche Karten gemeint sind, entscheidet allein
	 * `umstrittenBeiStrengererKlausel`; die Herleitung ist rein und billig.
	 */
	const knoten = knotenDerFassung(fassung, knotenId);
	return knoten ? erfordernisAusKnoten(holeRegelwerk(fassung), knoten) : null;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [
		traktanden,
		stimmkraft,
		eigentuemerAlle,
		gemeinschaften,
		anhaenge,
		gemeinschaft,
		betreiber,
		tag,
		neueAnZweiter,
		momentaufnahme,
		lesarten
	] =
		await Promise.all([
		holeTraktanden(locals.benutzer.operatorId, params.id),
		// Wählbar ist die Eigentumsstufe am Tag der Versammlung. Die Ansicht
		// gruppiert mehrere Einheiten bereits unter derselben Partei.
		stimmkraftAnsicht(locals.benutzer.operatorId, versammlung.stwegId, versammlung.datum),
		// Für bestehende historische Verweise braucht es auch einheitenlose und
		// archivierte Parteien. Sie werden unten nur ihrem bisherigen Feld
		// beigegeben und dadurch nicht allgemein neu wählbar.
		holeEigentuemer(locals.benutzer.operatorId, versammlung.stwegId, 'alle'),
		/*
		 * **Vollstaendig, und die Auswahl filtert unten** (25.08.2026, zweite
		 * Reviewrunde). Mit `'aktiv'` fehlte ein archiviertes Haus in der Liste
		 * `untergemeinschaften` — und damit war im Pflichtfeld «Antragstellerin»
		 * eines bestehenden Traktandums **nichts** angekreuzt. Der Browser
		 * verweigerte das Speichern, bis jemand eine andere Untergemeinschaft
		 * waehlte: Der Titel liess sich nicht mehr berichtigen, ohne die
		 * Antragstellerin zu verfaelschen.
		 */
		listeGemeinschaften(locals.benutzer.operatorId, 'alle'),
		holeAnhaengeDerVersammlung(locals.benutzer.operatorId, params.id),
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeBetreiber(locals.benutzer.operatorId),
		holeTagDerVersammlung(locals.benutzer.operatorId, params.id),
		// Ä-17 B: neue Traktanden an einer zweiten Versammlung.
		holeNeueTraktandenDerZweiten(locals.benutzer.operatorId, params.id),
		// Die Zählweise für den Hinweis an der Einsprache aus derselben Quelle wie
		// die Auszählung: ab der Freigabe die Momentaufnahme (Codeprüfung
		// Durchgang 3, N1).
		holeMomentaufnahme(locals.benutzer.operatorId, params.id),
		// L1 auf der Karte: ab der Freigabe die eingefrorene Wahl, davor die der
		// Gemeinschaft, denn das Traktandum kann eine veraltete tragen.
		holeLesarten(locals.benutzer.operatorId, { meetingId: params.id })
	]);
	const eigentuemer = stimmkraft.zeilen
		.filter((e) => e.einheiten.length > 0)
		.map((e) => ({
			id: e.partyId,
			name: e.displayName,
			einheiten: e.einheiten.map((u) => u.label)
		}));
	const aktuell = new Set(eigentuemer.map((e) => e.id));

	/*
	 * **Der Ausstand vorab** (Ä-26, Produktentscheid 17.10.2026). Solange die
	 * Versammlung bevorsteht, erklärt die Leitung ihn schon hier, und die Seite
	 * nennt, wessen Vollmachten dadurch bei diesem Traktandum ruhen werden. Am
	 * Abend führt die Leitungsseite den Ausstand; dort steht er dann schon.
	 */
	const vorBeginn = versammlung.zustand === 'entwurf' || versammlung.zustand === 'freigegeben';
	const ausstandJeTraktandum = new Map(
		vorBeginn
			? await Promise.all(
					traktanden
						.filter((n) => n.knoten.art === 'abstimmung')
						.map(async (n) => [
							n.knoten.id,
							[
								...(await holeAusstand(locals.benutzer!.operatorId, n.knoten.id)),
								// G7 (06.11.2026): Der Ausstand aus L8 in der Vorschau der
								// ruhenden Vollmachten wie ein erklärter Vertreterausstand;
								// `ausEinstellung` hält ihn vom Knopf fern, der nur einen
								// erklärten zurücknimmt.
								...(await holeVerwaltungsausstand(
									locals.benutzer!.operatorId,
									params.id,
									n.knoten.id
								)).map((a) => ({
									...a,
									erklaertAm: '',
									erklaertDurch: '',
									ausEinstellung: true
								}))
							]
						] as const
					)
				)
			: []
	);
	const vertreterOhnePartei = vorBeginn
		? await holeVertreterOhnePartei(locals.benutzer.operatorId, params.id)
		: [];
	const mitEinladungsmehr = vorBeginn
		? new Set<string>()
		: await holeTraktandenMitEinladungsmehr(locals.benutzer.operatorId, params.id);
	const vollmachtenImAusstand = await holeVollmachtenImAusstand(
		locals.benutzer.operatorId,
		params.id,
		[...ausstandJeTraktandum.values()].flat()
	);
	const eigentuemerNachId = new Map(eigentuemerAlle.map((e) => [e.id, e]));
	const historischeWahlen = (ids: string[]) =>
		[...new Set(ids)]
			.filter((id) => !aktuell.has(id))
			.map((id) => eigentuemerNachId.get(id))
			.filter((e) => e !== undefined)
			.map((e) => ({ id: e.id, name: e.displayName, einheiten: [] as string[] }));

	/*
	 * **Sichtbar deaktiviert statt fehlerhaft** (FR-62). Wer im
	 * Versammlungsraum ohne eingerichtetes Modell auf einen Knopf drückt und
	 * eine Fehlermeldung bekommt, hält die Anwendung für kaputt. Der Grund steht
	 * deshalb schon hier fest und nicht erst nach dem Drücken.
	 */
	// Ob Netz da ist, entscheidet sich beim Fragen. Ein hier gelesener Zustand
	// wäre schon veraltet, wenn die Seite ankommt.
	const ki = await darfPruefen(locals.benutzer.operatorId, gemeinschaft ?? null, betreiber);

	/*
	 * **Ist die Rücknahme der Freigabe noch möglich?** (Nachzug Block 3,
	 * Entscheid E vom 03.10.2026). Die Seite sagt der Leitung, wie sie die
	 * Traktanden wieder ändern könnte; mit einer Vollmacht ist der Weg über die
	 * Rücknahme zu — dann darf der Satz ihn nicht mehr nennen. Gezählt wird in
	 * jedem Zustand, wie in der Schranke `nimmVersammlungsfreigabeZurueck`.
	 */
	const vollmachtenHaengen =
		versammlung.zustand === 'freigegeben' &&
		(await zaehleVollmachten(locals.benutzer.operatorId, params.id)) > 0;

	// Wen ein bestehendes Traktandum als Antragstellerin nennt — die muss in der
	// Auswahl bleiben, auch wenn sie inzwischen im Archiv liegt.
	const genannteAntragsteller = new Set(
		traktanden.map((n) => n.knoten.antragstellerId).filter((id): id is string => Boolean(id))
	);

	return {
		versammlung,
		aenderbar: istImEntwurf(versammlung),
		/*
		 * **Das Mehr bleibt vor Beginn änderbar** (Produktentscheid 06.10.2026,
		 * «Verweis einbauen»). Die Erfordernisseite schreibt im Zustand
		 * «freigegeben» (Milderung mit Neuversand, Rückweg auf das Mehr der
		 * Einladung), aber kein Verweis führte hin. Nur dieser Verweis hängt
		 * daran; alles, was `aenderbar` sonst steuert, bleibt beim Entwurf.
		 */
		erfordernisVorBeginn: versammlung.zustand === 'freigegeben',
		vollmachtenHaengen,
		freigabeZuruecknehmbar: versammlung.zustand === 'freigegeben' && !vollmachtenHaengen,
		/**
		 * Wie viele Traktanden ein Sammellauf auf einmal nimmt.
		 *
		 * Die Seite braucht die Zahl, damit der Knopf nicht in eine Absage führt
		 * und der Satz daneben dieselbe Zahl nennt wie der Server (Code-Review
		 * 01.09.2026). Zwei Zahlen für eine Schranke laufen auseinander.
		 */
		hoechstensAufEinmal: HOECHSTENS_AUF_EINMAL,
		/**
		 * Gehört die Versammlung zu einer gemeinsamen, wird die Liste dort geführt.
		 *
		 * **Ein Abbild, keine zweite Liste** (Auftraggeber, 11.08.2026): «Ich ging davon
		 * aus, dass es eine Traktandenliste für alle gibt … Auf Ebene Gemeinschaft
		 * sollte es dann nur ein Abbild der Sammelversammlung geben.» Was hier
		 * bleibt, ist das Anpassen des eigenen Wortlauts — beim Budget der Betrag.
		 * Was hier nicht mehr geht: aufnehmen, umordnen, entfernen. Sonst zählte
		 * jedes Haus wieder für sich.
		 */
		gemeinsam: tag ? { id: tag.id, bezeichnung: tag.bezeichnung } : null,
		bestaetigt: versammlung.traktandenlisteBestaetigtAm ?? null,
		traktanden: traktanden.map((n) => ({
			...n,
			historischerEinzelantragsteller:
				n.knoten.antragstellerart === 'eigentuemer' && n.knoten.antragstellerId
					? historischeWahlen([n.knoten.antragstellerId])
					: [],
			historischeGemeinsameAntragsteller:
				n.knoten.antragstellerart === 'mehrere_eigentuemer'
					? historischeWahlen(n.knoten.antragstellerIds ?? [])
					: [],
			historischeBetroffene: historischeWahlen(n.knoten.betroffeneParteiIds),
			hinweise: hinweiseZu(n.knoten, n.knoten.erfordernis, n.knoten.betroffeneParteiIds),
			// Ä-01, Ä-02, Ä-04 (Entscheid 17.09.2026); welcher Knoten, sagt
			// `knotenFuerUmstritten`.
			umstritten: n.knoten.erfordernis
				? (umstrittenSatz(
						n.knoten.erfordernis,
						knotenFuerUmstritten(n.knoten.erfordernis.fassung, n.knoten.erfordernis.knotenId)
					) ??
					// Ä-12, F-4: eine Klausel an «Reglement ändern», strenger als das Gesetz.
					umstrittenBeiStrengererKlausel(
						n.knoten.erfordernis,
						gesetzlichesErfordernis(n.knoten.erfordernis.fassung, n.knoten.erfordernis.knotenId)
					))
				: null,
			// Block 3 der Freigabeliste: Ä-11 (zweite Versammlung), Ä-15, Ä-20.
			mehrhinweise: n.knoten.erfordernis
				? mehrhinweise(
						// L3 wie L1 aus `holeLesarten`: vor der Freigabe die der Gemeinschaft,
						// nicht die am Traktandum, die erst die Freigabe nachzieht
						// (Codeprüfung Block 5, M2).
						{ ...n.knoten.erfordernis, einspracheLesart: lesarten.L3 },
						knotenDerFassung(n.knoten.erfordernis.fassung, n.knoten.erfordernis.knotenId),
						versammlung.stufe,
						// Vor Beginn, solange sie bevorsteht (Codeprüfung 17.10.2026, N2).
						vorBeginn,
						// Saalfassung nur mit festgehaltenem Einladungsmehr, wie auf den
						// Leitungsseiten (M-A; Featureprüfung Block 3, 18.10.2026).
						!vorBeginn && mitEinladungsmehr.has(n.knoten.id),
						// Hinweis zur Zählweise an der Einsprache (19.10.2026), wie die Auszählung.
						momentaufnahme?.headCountMode ?? gemeinschaft?.headCountMode,
						// Die Bestimmung zur Einlage in den Erneuerungsfonds (Migration 193), nicht eingefroren.
						gemeinschaft?.fondsgrenze
					).concat(lesartKartensatz(n.knoten.erfordernis, lesarten.L1, lesarten.L13) ?? [])
				: [],
			// Ä-17 B (`docs/entscheide/0012`): an jedem neuen Abstimmungstraktandum
			// einer zweiten Versammlung, auch ohne gesetztes Erfordernis.
			// L5 je Wahl, vor der Freigabe die der Gemeinschaft (Migration 174).
			neuAnZweiter: neueAnZweiter.has(n.knoten.id) ? neuAnZweiterHinweis(lesarten.L5, false) : null,
			ausstand: (ausstandJeTraktandum.get(n.knoten.id) ?? []).map((a) => ({
				id: a.id,
				kennung: a.parteiId,
				name: a.name,
				grund: a.grund,
				vertreter: a.vertreter,
				ausEinstellung: 'ausEinstellung' in a && a.ausEinstellung === true,
				warnung: ausstandMitVollmachten(a.name, vollmachtenImAusstand.get(a.id) ?? [], a.vertreter)
			})),
			anhaenge: anhaenge.filter(
				(a) => a.gegenstandArt === 'agenda_item' && a.gegenstandId === n.knoten.id
			),
			// Je Art: Bei einer Kenntnisnahme fallen die drei Beschlusspunkte weg.
			pruefpunkte: pruefpunkteFuer(n.knoten.art)
		})),
		eigentuemer,
		/** Wer vorab in den Ausstand gesetzt werden kann (Ä-26); leer nach Beginn. */
		ausstandswahl: vorBeginn
			? [
					...eigentuemer.map((e) => ({ id: e.id, name: e.name })),
					...vertreterOhnePartei.map((v) => ({
						id: v.kennung,
						name: v.name,
						zusatz: `vertritt ${v.vertritt.join(', ')}; nicht Eigentümer`
					}))
				]
			: [],
		/*
		 * Archivierte stehen nur dann zur Wahl, wenn ein Traktandum sie **jetzt**
		 * schon als Antragstellerin nennt — dann muessen sie drin sein, sonst
		 * laesst sich der Punkt nicht mehr speichern. Neu waehlen kann man sie
		 * nicht. Dieselbe Regel wie bei der Elternwahl auf der Angabenseite.
		 */
		untergemeinschaften: gemeinschaften
			.filter((g) => g.parentStwegId === versammlung.stwegId)
			.filter((g) => !g.imArchivSeit || genannteAntragsteller.has(g.id))
			.map((g) => ({
				id: g.id,
				name: g.imArchivSeit ? `${g.name} (im Archiv)` : g.name
			})),
		antragstellerarten: ANTRAGSTELLERARTEN,
		// Die Fälle des Regelwerks als Auswahlliste — für die, die den Fall kennen
		// und sich den Entscheidbaum sparen wollen.
		erfordernisse: waehlbareErfordernisse(holeRegelwerk()),
		schwelleKurzfassung: SCHWELLE_KURZFASSUNG,
		groessteTiefe: GROESSTE_TIEFE,
		ki
	};
};

function ausFormular(daten: FormData, meetingId: string): TraktandumEingabe {
	const art = text(daten.get('antragstellerart')) as Antragstellerart;
	return {
		meetingId,
		titel: text(daten.get('titel')),
		art: text(daten.get('art')) as Traktandumart,
		inhalt: text(daten.get('inhalt')) || undefined,
		kurzfassung: text(daten.get('kurzfassung')) || undefined,
		antragswortlaut: text(daten.get('antragswortlaut')) || undefined,
		antragstellerart: art,
		antragstellerId:
			art === 'eigentuemer'
				? text(daten.get('antragstellerPartei')) || null
				: art === 'untergemeinschaft'
					? text(daten.get('antragstellerGemeinschaft')) || null
					: null,
		antragstellerIds: daten.getAll('antragstellerParteien').map(String).filter(Boolean),
		antragstellerName: text(daten.get('antragstellerName')) || undefined,
		betroffeneParteiIds: daten.getAll('betroffene').map(String).filter(Boolean),
		// L8 (Migration 184): Das Häkchen zum Geschäft der Verwaltung; der Kern
		// verwirft es bei einer Kenntnisnahme, der Server am Wahlknoten.
		verwaltungsGeschaeft: daten.get('verwaltungsGeschaeft') === 'ja',
		parentId: text(daten.get('parentId')) || null
	};
}

/**
 * Sperrt, was die Liste als Ganzes betrifft, solange ein Abend sie führt.
 *
 * Aufnehmen, umordnen, entfernen und die Nummer setzen gehören dorthin, wo die
 * Liste geführt wird — sonst zählte jedes Haus wieder für sich, und im Saal
 * stünden zwei Nummern nebeneinander. Das Anpassen des eigenen Wortlauts bleibt
 * hier: Genau dafür gibt es die Ziffern 3.1 und 3.2.
 *
 * Als Prüfung im Server, nicht nur als ausgeblendeter Knopf — ein
 * ausgeblendeter Knopf ist keine Schranke.
 */
async function verlangeEigeneListe(operatorId: string, meetingId: string): Promise<void> {
	const tag = await holeTagDerVersammlung(operatorId, meetingId);
	if (tag) {
		throw new FachlicherFehler(
			'gemeinsame_liste',
			`Diese Versammlung gehört zu «${tag.bezeichnung}». Die Traktandenliste wird dort geführt — ` +
				'für alle Gemeinschaften zusammen, damit im Saal und im Protokoll dieselbe Nummer steht. ' +
				'Der Wortlaut lässt sich hier weiterhin anpassen.',
			'id'
		);
	}
}

/**
 * Eine fachliche Absage als Antwort.
 *
 * **`aktion` benennt, wer abgesagt hat.** Seit dem 28.08.2026 lädt die Seite
 * nicht mehr neu, und der Anlegen-Kasten bleibt dabei offen stehen. Ohne diese
 * Angabe zeigte er über `fehler={form?.fehler}` auch die Absage eines fremden
 * Formulars — eine rote Zeile an einem Kasten, in den niemand etwas eingegeben
 * hat.
 */
function fachlich(fehler: unknown, daten?: FormData, aktion?: string) {
	if (fehler instanceof FachlicherFehler) {
		return fail(400, {
			fehler: { nachricht: fehler.message, feld: fehler.feld, aktion },
			werte: daten ? Object.fromEntries(daten) : undefined
		});
	}
	throw fehler;
}


/**
 * Wie lange ein Sammellauf insgesamt dauern darf.
 *
 * **Warum ein Gesamtbudget und nicht nur eine Frist je Aufruf** (Code-Review
 * 01.09.2026, zweite Runde): `frage` gibt jedem Traktandum mindestens zwei
 * Versuche à 12 s. Bei zwanzig Punkten sind das im schlechtesten Fall acht
 * Minuten in EINER HTTP-Antwort, und zwar nachdem alle Aufrufe bezahlt und im
 * Nachweis verbucht sind. Wer abbricht, soll wenigstens die Ergebnisse
 * behalten, die schon da sind.
 *
 * **Die Grenze ist der Mensch, nicht der Proxy.** Die Frist am Proxy stellt
 * der Betreiber, und sie muss über diesem Budget liegen (`docs/installation.md`,
 * Abschnitt zum Proxy). Das Budget hat einen eigenen Grund: Wer ein Formular
 * abschickt, sieht bis zur Antwort eine Seite, die nichts sagt. Nach
 * anderthalb Minuten ist das eine tote Seite, nach acht Minuten ein Defekt.
 *
 * Eingehalten wird sie näherungsweise, siehe `reichtDieZeit`: Der Lauf hört
 * auf, sobald der nächste Aufruf voraussichtlich darüber hinausreicht.
 */
const FRIST_GESAMT_MS = 100_000;

/**
 * Ob die KI-Traktandenprüfung für diese Gemeinschaft laufen darf.
 *
 * **An einer Stelle, nicht an dreien** (01.09.2026): Dieselbe Rechnung stand
 * zweimal in dieser Datei und musste beim Anlegen der Sammelprüfung ein drittes
 * Mal geschrieben werden. Ein ausgeblendeter Knopf ist keine Schranke — die
 * Prüfung gehört an jeden Weg, der das Modell befragt.
 */
async function darfPruefen(
	operatorId: string,
	gemeinschaft: { aiEnabled?: boolean; aiDisabledFunctions?: readonly string[] } | null | undefined,
	/**
	 * Der Betreiber, wenn ihn der Aufrufer ohnehin schon geholt hat.
	 *
	 * **Nicht selbst nachladen** (zweite Reviewrunde 01.09.2026): Die
	 * Ladefunktion holt ihn im `Promise.all` neben allem anderen. Ihn hier ein
	 * zweites Mal zu holen hiesse, aus einer parallelen Abfrage eine serielle
	 * Rundreise zu machen — die erste Fassung dieses Helfers tat genau das, mit
	 * einem Kommentar, der das Gegenteil behauptete.
	 */
	betreiber?: { kiHinweiseAusblenden?: boolean } | null
) {
	const b = betreiber === undefined ? await holeBetreiber(operatorId) : betreiber;
	return verfuegbarkeit(
		{
			eingerichtet: await kiEingerichtet(operatorId),
			zugelassen: gemeinschaft?.aiEnabled ?? false,
			offline: false,
			ausgenommen: (gemeinschaft?.aiDisabledFunctions ?? []) as KiFunktion[],
			hinweiseAusblenden: b?.kiHinweiseAusblenden === true
		},
		'traktandenpruefung'
	);
}

export const actions: Actions = {
	anlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const handelnder = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};
		try {
			const versammlung = await holeVersammlung(handelnder.operatorId, params.id);
			if (!versammlung) error(404, 'Versammlung nicht gefunden');
			await verlangeEigeneListe(handelnder.operatorId, params.id);

			const neu = await erstelleTraktandum(
				handelnder,
				ausFormular(daten, params.id),
				// M-3 (07.11.2026): Das Häkchen gegen das Erfordernis geprüft,
				// das gleich gesetzt wird; bei der Absage entsteht kein
				// Traktandum. Dasselbe Formularfeld wie unten beim Setzen.
				text(daten.get('erfordernis')) || null
			);
			await setzeGewaehltesErfordernis(
				handelnder,
				{ meetingId: params.id, stwegId: versammlung.stwegId },
				neu.id,
				text(daten.get('erfordernis')),
				null
			);
			return { angelegt: true };
		} catch (fehler) {
			return fachlich(fehler, daten, 'anlegen');
		}
	},

	speichern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const handelnder = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};
		const id = text(daten.get('id'));
		try {
			const versammlung = await holeVersammlung(handelnder.operatorId, params.id);
			if (!versammlung) error(404, 'Versammlung nicht gefunden');

			// Der bisherige Knoten, **bevor** gespeichert wird: Nur so lässt sich
			// erkennen, ob die Auswahl überhaupt etwas ändert.
			const vorher = (await holeTraktanden(handelnder.operatorId, params.id)).find(
				(t) => t.knoten.id === id
			);

			// G2 (06.11.2026): Das Erfordernis aus demselben Formular mitgeben,
			// damit die Prüfung gegen das Erfordernis läuft, das nach dem
			// Speichern gilt, und in derselben Transaktion bleibt.
			await bearbeiteTraktandum(
				handelnder,
				params.id,
				id,
				ausFormular(daten, params.id),
				text(daten.get('erfordernis')) || null
			);
			await setzeGewaehltesErfordernis(
				handelnder,
				{ meetingId: params.id, stwegId: versammlung.stwegId },
				id,
				text(daten.get('erfordernis')),
				vorher?.knoten.erfordernis?.knotenId ?? null
			);
			/*
			 * **Die Kennung gehört in die Antwort** (Code-Review 02.09.2026). Ein
			 * geändertes Traktandum macht den KI-Befund zu seinem alten Wortlaut
			 * ungültig; die Seite kann ihn nur wegräumen, wenn sie weiss, welcher
			 * Punkt geändert wurde.
			 */
			return { gespeichert: true, geaendert: id };
		} catch (fehler) {
			return fachlich(fehler, daten);
		}
	},

	entfernen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await verlangeEigeneListe(locals.benutzer.operatorId, params.id);
			await loescheTraktandum(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('id'))
			);
			return { entfernt: true };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Den Ausstand vorab erklären (Ä-26, Produktentscheid 17.10.2026). Derselbe
	 * Weg wie an der Leitungsseite (`erklaereAusstand`), samt Bindung an die
	 * Versammlung und dem Verlauf; mehrere auf einmal mit einem Grund.
	 */
	ausstand: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const handelnder = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};
		const wer = daten.getAll('partei').map((w) => text(w)).filter((w) => w.length > 0);
		if (wer.length === 0) {
			return fail(400, {
				fehler: {
					nachricht: 'Niemand ausgewählt. Wählen Sie, wer nicht mitentscheiden darf.',
					feld: 'partei',
					aktion: 'ausstand'
				}
			});
		}
		try {
			const versammlung = await holeVersammlung(handelnder.operatorId, params.id);
			if (!versammlung) error(404, 'Versammlung nicht gefunden');
			if (versammlung.zustand !== 'entwurf' && versammlung.zustand !== 'freigegeben') {
				return fail(400, {
					fehler: {
						nachricht: 'Die Versammlung läuft. Den Ausstand erklären Sie jetzt in der Sitzungsleitung.',
						aktion: 'ausstand'
					}
				});
			}
			const namen: string[] = [];
			const vertreter: string[] = [];
			for (const kennung of wer) {
				const a = await erklaereAusstand(
					handelnder,
					params.id,
					text(daten.get('traktandum')),
					kennung,
					text(daten.get('grund'))
				);
				(a.vertreter ? vertreter : namen).push(a.name);
			}
			return {
				hinweis: [
					namen.length ? ausstandsmeldung(namen) : '',
					vertreter.length ? vertreterausstandsmeldung(vertreter) : ''
				]
					.filter(Boolean)
					.join(' ')
			};
		} catch (fehler) {
			return fachlich(fehler, daten, 'ausstand');
		}
	},

	ausstandZurueck: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const zurueck = await nimmAusstandZurueck(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('ausstand'))
			);
			if (!zurueck) throw new FachlicherFehler('unbekannt', 'Es war kein Ausstand mehr eingetragen; nichts geändert.', 'ausstand');
			return { hinweis: 'Der Ausstand ist zurückgenommen.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	nummer: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await verlangeEigeneListe(locals.benutzer.operatorId, params.id);
			await setzeNummer(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('id')),
				text(daten.get('nummer'))
			);
			return { gespeichert: true };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	anhaengen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await haengeAn(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				'agenda_item',
				text(daten.get('traktandumId')),
				daten.get('datei') as File
			);
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof DateiFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			return fachlich(fehler);
		}
	},

	abloesen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await loeseAb(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('id'))
			);
			return { gespeichert: true };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	verschieben: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const elternteil = text(daten.get('neuerElternteil'));
		try {
			await verlangeEigeneListe(locals.benutzer.operatorId, params.id);
			await verschiebeTraktandum(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				{
					id: text(daten.get('id')),
					neuerElternteil: elternteil || null,
					stelle: ganzzahl(daten.get('stelle')) || 0
				}
			);
			return { verschoben: true };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Liste als vollständig bestätigen (Migration 033).
	 *
	 * Erst danach gilt der Schritt im Ablauf als erledigt. Vorher stand dort ein
	 * Häkchen, sobald **ein** Traktandum vorlag — und die Pflichttraktanden legt
	 * das Anlegen selbst an.
	 */
	bestaetigen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			await bestaetigeTraktandenliste(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id
			);
			return { hinweis: 'Traktandenliste als vollständig bestätigt.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Ein Traktandum prüfen lassen (FR-58).
	 *
	 * **Kein Abbruch, was auch geschieht** (FR-62): Fällt die ganze Kette aus,
	 * kommt ein Hinweis zurück und die Seite bleibt, wie sie war.
	 */
	kipruefen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const traktandumId = text(daten.get('traktandumId'));

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');
		const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId);

		// Die Zulassung wird hier noch einmal geprüft und nicht nur in der
		// Anzeige: Ein ausgeblendeter Knopf ist keine Schranke.
		const erlaubt = await darfPruefen(locals.benutzer.operatorId, gemeinschaft);
		if (!erlaubt.verfuegbar) return fail(400, { fehler: { nachricht: erlaubt.grund ?? '' } });

		// **Mit Absage statt Wurf** (F7, aus der Codeprüfung 16.10.2026): das
		// dritte Geschwister der beiden `kiantrag`; eine leere oder verstellte
		// Kennung endete hier ebenso als 500-Seite.
		try {
			const ergebnis = await pruefeTraktandum(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				traktandumId,
				// Die Kennung kommt aus dem Formular; gebunden wird sie an die
				// Versammlung aus der Adresse, deren Zulassung eben geprüft wurde.
				versammlung.id
			);
			return { pruefung: { traktandumId, ...ergebnis } };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * **Alle Traktanden auf einmal prüfen lassen** (Auftraggeber, 01.09.2026:
	 * «Eigentlich müssten alle Traktanden eine Überprüfung möglich sein»).
	 *
	 * Bis dahin gab es die Prüfung nur je Traktandum, und den Knopf dazu nur im
	 * aufgeklappten Bearbeitungsformular — wer die Liste bloss ansah, fand ihn
	 * nie. Eine Liste mit zwölf Punkten einzeln durchzuklicken ist ausserdem
	 * keine Prüfung, sondern eine Fleissaufgabe.
	 *
	 * **Nacheinander, nicht gleichzeitig.** Die Modelle hinter `frage` haben eine
	 * Reihenfolge und ein Kostendach; zwölf gleichzeitige Anfragen wären für den
	 * Anbieter ein Ansturm und für die Nutzung im Nachweis eine Wolke ohne
	 * Reihenfolge. Ein Traktandum dauert unter einer Sekunde.
	 *
	 * **Was nicht geprüft wird**, steht im Ergebnis mit Grund: `pruefeTraktandum`
	 * wirft nicht, es gibt zurück, was herausgekommen ist (FR-62). Ein Fehlschlag
	 * bei Punkt 3 hält Punkt 4 nicht auf.
	 */
	kipruefenAlle: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');
		const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId);

		const erlaubt = await darfPruefen(locals.benutzer.operatorId, gemeinschaft);
		if (!erlaubt.verfuegbar) return fail(400, { fehler: { nachricht: erlaubt.grund ?? '' } });

		/*
		 * **Auch der Sammelweg fragt, ob die Liste noch änderbar ist** (zweite
		 * Reviewrunde). Die Anzeige tut es seit der ersten; ein alter Reiter oder
		 * ein direkter POST hätte danach bis zu zwanzig bezahlte Modellaufrufe
		 * ausgelöst, an einer Liste, an der sich nichts mehr ändern lässt. «Ein
		 * ausgeblendeter Knopf ist keine Schranke» gilt auch für den eigenen.
		 */
		if (!istImEntwurf(versammlung)) {
			return fail(400, {
				fehler: {
					nachricht:
						'Die Versammlung ist nicht mehr im Entwurf. Befunde liessen sich an der ' +
						'Traktandenliste nicht mehr umsetzen; einzeln prüfen lässt sich weiterhin.'
				}
			});
		}

		const traktanden = await holeTraktanden(locals.benutzer.operatorId, params.id);
		if (traktanden.length === 0) {
			return fail(400, { fehler: { nachricht: 'Es steht noch kein Traktandum auf der Liste.' } });
		}
		/*
		 * **Eine Obergrenze, weil jeder Punkt Geld kostet** (Code-Review
		 * 01.09.2026). Ein Knopf, der beliebig viele Modellaufrufe auslöst, ist
		 * bei einer Liste mit vierzig Punkten kein Angebot mehr, sondern eine
		 * Rechnung. Wer wirklich vierzig prüfen will, prüft sie einzeln — und
		 * merkt dabei, was er tut.
		 */
		if (traktanden.length > HOECHSTENS_AUF_EINMAL) {
			return fail(400, {
				fehler: {
					nachricht:
						`Die Liste hat ${traktanden.length} Traktanden. Auf einmal prüfen lassen sich ` +
						`höchstens ${HOECHSTENS_AUF_EINMAL} — jeder Punkt geht einzeln an das Modell und ` +
						'kostet. Prüfen Sie die übrigen beim jeweiligen Traktandum.'
				}
			});
		}

		const handelnder = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};
		const pruefungen = [];
		const beginn = Date.now();
		let abgebrochen = 0;
		/*
		 * **Die Frist prüft, ob der Lauf fertig wird — nicht, ob er anfangen
		 * darf** (02.09.2026). Vorher stand hier `verstrichen > FRIST_GESAMT_MS`.
		 * Das liess bei 99 s verstrichener Zeit noch einen Aufruf starten, der
		 * seine volle Kette ausschöpfen darf; der Lauf endete dann nach 124 s.
		 *
		 * Als Reserve dient die **längste bisher gemessene** Dauer. Die
		 * konfigurierte Höchstgeduld wäre die naheliegende Zahl und ist die
		 * falsche: Sie ist je Stufe bis 120 s einstellbar, zwei solche Stufen
		 * ergäben 120 s Reserve gegen 100 s Budget, und der Lauf bräche ab dem
		 * zweiten Punkt immer ab — auch wenn das Modell in zwei Sekunden
		 * antwortet. Die Begründung dazu steht bei `reichtDieZeit`.
		 */
		let reserveMs = 0;
		for (const t of traktanden) {
			const weiter = reichtDieZeit({
				verstrichenMs: Date.now() - beginn,
				reserveMs,
				budgetMs: FRIST_GESAMT_MS,
				schonGeprueft: pruefungen.length
			});
			if (!weiter) {
				abgebrochen = traktanden.length - pruefungen.length;
				break;
			}
			const angefangen = Date.now();
			const ergebnis = await pruefeTraktandum(handelnder, t.knoten.id, versammlung.id);
			reserveMs = Math.max(reserveMs, Date.now() - angefangen);
			pruefungen.push({ traktandumId: t.knoten.id, ...ergebnis });
		}
		/*
		 * **Drei Ausgänge, nicht zwei** (Code-Review 01.09.2026). Eine Antwort,
		 * die kam, aber unbrauchbar war (`unlesbar`), hat weder `stufe === null`
		 * noch Befunde — sie fiel damit unter «kein Befund», also unter das Wort,
		 * das «alles in Ordnung» bedeutet. Genau davor warnt der Kasten am
		 * einzelnen Traktandum seit dem 23.08.2026, und nach dem Sammellauf ist
		 * diese Zeile oft die einzige Rückmeldung, die jemand liest.
		 *
		 * **Und gezählt werden Traktanden, nicht Befunde**: Fünf Befunde an einem
		 * Punkt sind ein Traktandum mit Befunden.
		 */
		const mitBefund = pruefungen.filter((p) => !p.unlesbar && p.befunde.length > 0).length;
		const ohneAntwort = pruefungen.filter((p) => p.stufe === null).length;
		const unbrauchbar = pruefungen.filter((p) => p.stufe !== null && p.unlesbar).length;
		const sauber = pruefungen.length - mitBefund - ohneAntwort - unbrauchbar;
		const punkte = (n: number) => `${n} ${n === 1 ? 'Traktandum' : 'Traktanden'}`;

		/*
		 * **«Nichts zu beanstanden» braucht wenigstens eine Antwort** (zweite
		 * Reviewrunde). Die erste Fassung sagte es, sobald kein Befund vorlag —
		 * auch dann, wenn der Anbieter zu KEINEM Punkt geantwortet hatte. Der
		 * Satz las sich dann als Entwarnung über eine Prüfung, die gar nicht
		 * stattgefunden hat. Genau diese Verwechslung schliesst der Kasten am
		 * einzelnen Traktandum seit dem 23.08.2026 aus; die Sammelmeldung machte
		 * sie wieder auf.
		 */
		const teile: string[] = [];
		if (mitBefund > 0) teile.push(`${punkte(mitBefund)} mit Befund`);
		if (sauber > 0) teile.push(`bei ${punkte(sauber)} nichts zu beanstanden`);
		if (unbrauchbar > 0) teile.push(`${punkte(unbrauchbar)} mit unbrauchbarer Antwort`);
		if (ohneAntwort > 0) teile.push(`${punkte(ohneAntwort)} ohne Antwort`);
		if (abgebrochen > 0) {
			/*
			 * **Nicht «die Zeit ist abgelaufen»** (Code-Review 02.09.2026). Der
			 * Lauf bricht ab, bevor das Budget aufgebraucht ist: Er hört auf,
			 * sobald der nächste Aufruf voraussichtlich darüber hinausreichen
			 * würde. Bei einem langsamen Modell steht diese Meldung deshalb schon
			 * nach der Hälfte der Zeit — «abgelaufen» wäre dann falsch, und wer
			 * es glaubt, sucht den Fehler bei sich.
			 */
			teile.push(
				`${punkte(abgebrochen)} nicht mehr geprüft, weil die Zeit für einen weiteren ` +
					'Durchgang nicht gereicht hätte — bitte einzeln nachholen'
			);
		}
		return {
			pruefungen,
			hinweis: `${punkte(pruefungen.length)} geprüft: ${teile.join(', ')}. Geändert wurde nichts.`
		};
	},

	/** Was die Sitzungsleitung mit den Befunden gemacht hat (FR-63). */
	kientscheid: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await haltEntscheidFest(
				{ operatorId: locals.benutzer.operatorId, userId: locals.benutzer.id, label: locals.benutzer.displayName },
				text(daten.get('nutzungId')),
				{ art: 'versammlung', versammlungId: params.id },
				verlangeEntscheid(text(daten.get('entscheid')))
			);
			return { hinweis: 'Im Nachweis festgehalten.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	wiedereroeffnen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			await oeffneTraktandenlisteWieder(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id
			);
			return { hinweis: 'Die Traktandenliste ist wieder offen.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	}

};
