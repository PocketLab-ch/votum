/**
 * Eine Aktion unter `[id=kennung]` trifft nur, was auf ihrer Seite steht.
 *
 * **Der Befund vom 26.08.2026 (Sicherheitsprüfung).** Elf Aktionen auf vier
 * Seiten nahmen eine Kennung aus einem verborgenen Feld oder einer Auswahlliste
 * entgegen und prüften nicht nach, ob sie zu der Gemeinschaft gehört, deren
 * Adresse in der Zeile steht. Der Zeilenschutz bindet `party`, `unit`,
 * `representation`, `usufruct` und `bylaw_quorum_rule` an den **Betreiber** —
 * wer zwei Gemeinschaften verwaltet, traf mit der Kennung aus der einen die
 * Aktion der anderen.
 *
 * **Beide Hälften werden gemessen**, und die zweite ist die wichtigere:
 *
 *   - die fremde Kennung wird abgewiesen, **und** die fremde Zeile steht
 *     danach unverändert da;
 *   - die eigene Kennung geht durch. Ohne diese Hälfte wüsste man nicht, ob
 *     hier bloss alles gesperrt wurde.
 *
 * **Aufgerufen werden die Aktionen selbst**, nicht die Funktionen darunter. Die
 * Prüfung sitzt in der Route; ein Test gegen den Kern sähe von ihr nichts und
 * wäre grün, sobald jemand die Zeile aus der Route wieder entfernt.
 *
 * Beide Gemeinschaften gehören **demselben Betreiber**. Das ist der Fall, um
 * den es geht: Zwischen zwei Betreibern hält der Zeilenschutz ohnehin, und
 * genau deshalb fiel die Lücke nie auf.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit, holeEinheiten } from '$lib/server/einheiten';
import {
	erstelleEigentuemer,
	erstelleGemeinschaftlicheZeile,
	holeEigentuemer,
	ordneEigentumZu
} from '$lib/server/eigentuemer';
import { erstellePerson, holePersonen, verknuepfePartei } from '$lib/server/personen';
import { holeMitberechtigteJeHuelle } from '$lib/server/mitberechtigte';
import { bezeichneVertreter, holeVertretungen } from '$lib/server/vertretung';
import { erstelleNutzniessung, holeNutzniessungen } from '$lib/server/nutzniessung';
import { erstelleReglementsregel, holeReglementsregeln } from '$lib/server/reglement';
import { actions as eigentuemerAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/eigentuemer/+page.server';
/*
 * **Die Wege an einer einzelnen Zeile stehen seit dem 27.08.2026 auf ihrer
 * eigenen Seite** (Produktentscheid: ein Einstieg je Zeile statt sechs in einer
 * Tabellenzelle). Die Aktionen sind dieselben, nur umgezogen; geprüft werden
 * muss dort dasselbe.
 */
import { actions as zeileAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/eigentuemer/[partei=kennung]/+page.server';
import { actions as einheitenAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/einheiten/+page.server';
import { actions as nutzniessungAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/nutzniessung/+page.server';
import { actions as reglementAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/reglement/+page.server';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

/** Was zu einer Gemeinschaft gehört und in der anderen nichts zu suchen hat. */
interface Bestand {
	stweg: string;
	/** Eine Zeile, an der nichts hängt — tilgbar. */
	karteileiche: string;
	/** Eine Zeile mit Einheit. */
	eigentuemer: string;
	/** Eine Zeile, die noch keinen Vertreter trägt. */
	ohneVertreter: string;
	/** Eine Zeile, an der nichts hängt — archivierbar. */
	archivierbar: string;
	/** Eine gemeinschaftliche Zeile («Hülle») mit zwei Mitberechtigten. */
	huelle: string;
	/** Der beim Anlegen bestimmte Vertreter der Hülle. */
	mitglied1: string;
	/** Der zweite Mitberechtigte. */
	mitglied2: string;
	/** Eine Zeile mit verknüpfter Person — für die Bemerkung. */
	mitPerson: string;
	/** Die Person hinter `mitPerson`. */
	person: string;
	/** Die Einheit, die `eigentuemer` hält. */
	einheit: string;
	/** Eine Einheit ohne Zuordnung. */
	freieEinheit: string;
	/** Eine Einheit mit Nutzniessung. */
	nutzeinheit: string;
	vertretung: string;
	nutzniessung: string;
	regel: string;
}

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüferin' };
}

async function baueBestand(name: string): Promise<Bestand> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name: `Prüflauf ${name}`,
		quotaDenominator: 1000,
		headCountMode: 'per_unit',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	const einheit = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: `${name} 1.1`,
		quotas: { stamm: 400 },
		countsAsHead: true
	});
	const freieEinheit = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: `${name} 1.2`,
		quotas: { stamm: 300 },
		countsAsHead: true
	});
	const nutzeinheit = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: `${name} 1.3`,
		quotas: { stamm: 300 },
		countsAsHead: true
	});

	const eigentuemer = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: `${name} Halterin`,
		representativeName: null,
		isCommunity: false
	});
	const karteileiche = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: `${name} Karteileiche`,
		representativeName: null,
		isCommunity: false
	});
	const ohneVertreter = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: `${name} Ohne Vertreter`,
		representativeName: null,
		isCommunity: false
	});

	const archivierbar = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: `${name} Archivierbar`,
		representativeName: null,
		isCommunity: false
	});

	/*
	 * **Die gemeinschaftliche Zeile** — sie trägt die Wege, die zwei Kennungen
	 * zugleich annehmen (Vertretung wechseln, Mitberechtigte, Zustelladresse).
	 * Ohne sie blieben genau die vier Aktionen ungemessen, deren Prüfung schon
	 * vor diesem Auftrag stand.
	 */
	const gemeinsam = await erstelleGemeinschaftlicheZeile(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		personen: [
			{ name: `${name} Erste`, email: null, adresse: null },
			{ name: `${name} Zweite`, email: null, adresse: null }
		],
		vertreterIndex: 0
	});

	const mitPerson = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: `${name} Mit Person`,
		representativeName: null,
		isCommunity: false
	});
	const person = await erstellePerson(handelnder(), {
		art: 'natural',
		name: `${name} Mit Person`,
		email: null,
		telefon: null,
		adresse: null
	});
	await verknuepfePartei(handelnder(), mitPerson.id, person.id);

	await ordneEigentumZu(handelnder(), einheit.id, eigentuemer.id, '2024-01-01');

	const vertretung = await bezeichneVertreter(handelnder(), {
		parteiId: eigentuemer.id,
		personName: `${name} Vertreter`,
		ab: '2024-01-01'
	});

	const nutzniessung = await erstelleNutzniessung(handelnder(), {
		unitId: nutzeinheit.id,
		holderName: `${name} Nutzniesser`,
		validFrom: '2024-01-01',
		hasAgreement: false
	});

	const regel = await erstelleReglementsregel(handelnder(), {
		stwegId: g.id,
		geschaeftsart: 'baulich_nuetzlich',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: null,
		quotenbasis: 'keine',
		fundstelle: `Reglement ${name} Ziff. 12`,
		enthaltungZaehltMit: true
	});

	// Welche der beiden Personen der Hülle der bestimmte Vertreter ist, sagt die
	// Zuordnung selbst — geraten wäre der Test dann grün, wenn er es verkehrt rät.
	const jeHuelle = await holeMitberechtigteJeHuelle(betreiber, g.id);
	const mitglieder = jeHuelle.get(gemeinsam.huelle) ?? [];
	const vertreterZeile = mitglieder.find((m) => m.istVertreter);
	const andereZeile = mitglieder.find((m) => !m.istVertreter);
	if (!vertreterZeile || !andereZeile) {
		throw new Error('Die gemeinschaftliche Zeile hat nicht zwei Mitberechtigte.');
	}

	return {
		stweg: g.id,
		karteileiche: karteileiche.id,
		eigentuemer: eigentuemer.id,
		ohneVertreter: ohneVertreter.id,
		archivierbar: archivierbar.id,
		huelle: gemeinsam.huelle,
		mitglied1: vertreterZeile.partyId,
		mitglied2: andereZeile.partyId,
		mitPerson: mitPerson.id,
		person: person.id,
		einheit: einheit.id,
		freieEinheit: freieEinheit.id,
		nutzeinheit: nutzeinheit.id,
		vertretung: vertretung.id,
		nutzniessung: nutzniessung.id,
		regel: regel.id
	};
}

let a: Bestand;
let b: Bestand;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Prüflauf Kennungsprüfung');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-kennungen');
	a = await baueBestand('A');
	b = await baueBestand('B');
}, 60000);

afterAll(verbindungenSchliessen);

/**
 * Ruft eine Aktion so auf, wie SvelteKit es täte.
 *
 * Gebraucht werden `request`, `locals` und `params` — mehr liest keine dieser
 * Aktionen. Ein echtes `Request` mit echtem `FormData`, damit `request.formData()`
 * denselben Weg geht wie im Betrieb.
 */
type Aktionen = Record<string, (arg: never) => Promise<unknown>>;

async function fahre(
	aktionen: Aktionen,
	name: string,
	stwegId: string,
	/**
	 * Ein Feld darf mehrfach vorkommen — die Einheitentabelle schickt
	 * `einheitId` je Zeile einmal. Als Liste geschrieben, weil ein gewöhnliches
	 * Objekt keinen Schlüssel zweimal führen kann.
	 */
	felder: Record<string, string | string[]>
): Promise<{ abgesagt: boolean; nachricht: string; ergebnis: unknown }> {
	const daten = new FormData();
	for (const [k, v] of Object.entries(felder)) {
		for (const einzeln of Array.isArray(v) ? v : [v]) daten.append(k, einzeln);
	}

	const ereignis = {
		request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-kennungen',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id: stwegId }
	};

	const ergebnis = (await aktionen[name](ereignis as never)) as {
		status?: number;
		data?: { fehler?: { nachricht?: string } };
	};

	// `fail()` liefert ein ActionFailure mit `status` und `data`; ein Erfolg ist
	// ein gewöhnliches Objekt ohne beides.
	const abgesagt = typeof ergebnis?.status === 'number' && ergebnis.status >= 400;
	return {
		abgesagt,
		nachricht: ergebnis?.data?.fehler?.nachricht ?? '',
		ergebnis
	};
}

/** Die Fälle: je Aktion die fremde und die eigene Kennung. */
const faelle: {
	name: string;
	aktionen: Aktionen;
	aktion: string;
	/** Felder mit der Kennung aus der **anderen** Gemeinschaft. */
	fremd: (b: Bestand) => Record<string, string | string[]>;
	/** Dieselben Felder mit der eigenen Kennung. */
	eigen: (a: Bestand) => Record<string, string | string[]>;
}[] = [
	{
		name: 'Eigentümerseite · angabenBerichtigen',
		aktionen: zeileAktionen as Aktionen,
		aktion: 'angabenBerichtigen',
		fremd: (x) => ({
			parteiId: x.karteileiche,
			kind: 'natural',
			displayName: 'Fremd berichtigt',
			isCommunity: 'false'
		}),
		eigen: (x) => ({
			parteiId: x.karteileiche,
			kind: 'natural',
			displayName: 'A Karteileiche',
			isCommunity: 'false'
		})
	},
	{
		name: 'Eigentümerseite · verknuepfen',
		aktionen: eigentuemerAktionen as Aktionen,
		aktion: 'verknuepfen',
		fremd: (x) => ({ parteiId: x.karteileiche, personId: '' }),
		eigen: (x) => ({ parteiId: x.karteileiche, personId: '' })
	},
	{
		name: 'Eigentümerseite · vertreterBezeichnen',
		aktionen: eigentuemerAktionen as Aktionen,
		aktion: 'vertreterBezeichnen',
		fremd: (x) => ({ parteiId: x.ohneVertreter, personName: 'Fremd Vertreter', ab: '2025-01-01' }),
		eigen: (x) => ({ parteiId: x.ohneVertreter, personName: 'Eigen Vertreter', ab: '2025-01-01' })
	},
	{
		name: 'Eigentümerseite · vertretungBeenden',
		aktionen: eigentuemerAktionen as Aktionen,
		aktion: 'vertretungBeenden',
		fremd: (x) => ({ id: x.vertretung, bis: '2025-06-30' }),
		eigen: (x) => ({ id: x.vertretung, bis: '2025-06-30' })
	},
	{
		name: 'Eigentümerseite · zuordnen',
		aktionen: eigentuemerAktionen as Aktionen,
		aktion: 'zuordnen',
		fremd: (x) => ({ unitId: x.freieEinheit, partyId: x.karteileiche, ab: '2025-02-01' }),
		eigen: (x) => ({ unitId: x.freieEinheit, partyId: x.karteileiche, ab: '2025-02-01' })
	},
	{
		name: 'Eigentümerseite · zuordnungTilgen',
		aktionen: zeileAktionen as Aktionen,
		aktion: 'zuordnungTilgen',
		fremd: (x) => ({ unitId: x.einheit }),
		eigen: (x) => ({ unitId: x.einheit })
	},
	{
		name: 'Einheitenseite · speichern',
		aktionen: einheitenAktionen as Aktionen,
		aktion: 'speichern',
		/*
		 * Die Felder tragen die Kennung im Namen (`label.<id>`) — die Maske
		 * speichert die ganze Tabelle auf einmal. Beim ersten Lauf stand hier
		 * `label`, und die Gegenprobe scheiterte an «Die Bezeichnung der Einheit
		 * fehlt»: grün gewesen wäre sie nur, weil die Aktion aus einem anderen
		 * Grund absagt.
		 */
		fremd: (x) => ({
			einheitId: x.freieEinheit,
			[`kind.${x.freieEinheit}`]: 'unit',
			[`label.${x.freieEinheit}`]: 'Fremd umbenannt',
			[`q.${x.freieEinheit}.stamm`]: '300',
			[`kopf.${x.freieEinheit}`]: 'true'
		}),
		eigen: (x) => ({
			einheitId: x.freieEinheit,
			[`kind.${x.freieEinheit}`]: 'unit',
			[`label.${x.freieEinheit}`]: 'A 1.2',
			[`q.${x.freieEinheit}.stamm`]: '300',
			[`kopf.${x.freieEinheit}`]: 'true'
		})
	},
	{
		name: 'Nutzniessungsseite · berichtigen',
		aktionen: nutzniessungAktionen as Aktionen,
		aktion: 'berichtigen',
		fremd: (x) => ({ id: x.nutzniessung, holderName: 'Fremd berichtigt' }),
		eigen: (x) => ({ id: x.nutzniessung, holderName: 'A Nutzniesser neu' })
	},
	{
		name: 'Nutzniessungsseite · erfassen',
		aktionen: nutzniessungAktionen as Aktionen,
		aktion: 'erfassen',
		fremd: (x) => ({
			unitId: x.freieEinheit,
			holderName: 'Fremd erfasst',
			validFrom: '2025-03-01'
		}),
		eigen: (x) => ({ unitId: x.freieEinheit, holderName: 'A erfasst', validFrom: '2025-03-01' })
	},
	{
		name: 'Nutzniessungsseite · beenden',
		aktionen: nutzniessungAktionen as Aktionen,
		aktion: 'beenden',
		fremd: (x) => ({ id: x.nutzniessung, per: '2025-12-31' }),
		eigen: (x) => ({ id: x.nutzniessung, per: '2025-12-31' })
	},
	{
		name: 'Eigentümerseite · vertretungWechseln',
		aktionen: zeileAktionen as Aktionen,
		aktion: 'vertretungWechseln',
		fremd: (x) => ({ parteiId: x.huelle, mitgliedId: x.mitglied2 }),
		eigen: (x) => ({ parteiId: x.huelle, mitgliedId: x.mitglied2 })
	},
	{
		name: 'Eigentümerseite · zustelladresseSetzen',
		aktionen: zeileAktionen as Aktionen,
		aktion: 'zustelladresseSetzen',
		fremd: (x) => ({ parteiId: x.huelle, mitgliedId: x.mitglied2 }),
		eigen: (x) => ({ parteiId: x.huelle, mitgliedId: x.mitglied2 })
	},
	{
		// Erst nach dem Wechsel der Vertretung: Wer die Stimme ausübt, lässt sich
		// nicht wegnehmen — der Kern weist das mit eigenem Satz ab.
		name: 'Eigentümerseite · mitberechtigtenEntfernen',
		aktionen: zeileAktionen as Aktionen,
		aktion: 'mitberechtigtenEntfernen',
		fremd: (x) => ({ parteiId: x.huelle, mitgliedId: x.mitglied1 }),
		eigen: (x) => ({ parteiId: x.huelle, mitgliedId: x.mitglied1 })
	},
	{
		name: 'Eigentümerseite · mitberechtigtenAufnehmen',
		aktionen: zeileAktionen as Aktionen,
		aktion: 'mitberechtigtenAufnehmen',
		fremd: (x) => ({ parteiId: x.huelle, mitgliedId: x.karteileiche }),
		eigen: (x) => ({ parteiId: x.huelle, mitgliedId: x.karteileiche })
	},
	{
		name: 'Eigentümerseite · archivieren',
		aktionen: zeileAktionen as Aktionen,
		aktion: 'archivieren',
		fremd: (x) => ({ parteiId: x.archivierbar, notiz: 'Prüflauf' }),
		eigen: (x) => ({ parteiId: x.archivierbar, notiz: 'Prüflauf' })
	},
	{
		// Nach dem Archivieren — sonst gäbe es nichts hervorzuholen.
		name: 'Eigentümerseite · hervorholen',
		aktionen: zeileAktionen as Aktionen,
		aktion: 'hervorholen',
		fremd: (x) => ({ parteiId: x.archivierbar }),
		eigen: (x) => ({ parteiId: x.archivierbar })
	},
	{
		name: 'Reglementsseite · aufheben',
		aktionen: reglementAktionen as Aktionen,
		aktion: 'aufheben',
		fremd: (x) => ({ regelId: x.regel }),
		eigen: (x) => ({ regelId: x.regel })
	}
];

/**
 * Die erste Hälfte: die fremde Kennung wird abgewiesen.
 *
 * Gefahren wird **unter der Adresse von A** mit den Kennungen aus B. Danach
 * wird B nachgelesen — eine Absage, nach der die fremde Zeile trotzdem
 * verändert ist, wäre keine.
 */
describe('Die Kennung aus der anderen Gemeinschaft wird abgewiesen', () => {
	for (const fall of faelle) {
		it(fall.name, async () => {
			const { abgesagt, nachricht } = await fahre(
				fall.aktionen,
				fall.aktion,
				a.stweg,
				fall.fremd(b)
			);
			expect(abgesagt).toBe(true);
			expect(nachricht).toMatch(/gehört nicht zu dieser Gemeinschaft/);
		});
	}

	/*
	 * **Die Tabelle wird ganz oder gar nicht geschrieben** (26.08.2026, aus dem
	 * Code-Review der Behebung).
	 *
	 * Stand die Prüfung in der Schleife, waren beim Abweisen der zweiten Kennung
	 * die Zeilen davor schon geändert: Die Seite meldete eine Absage, und die
	 * Tabelle war trotzdem halb umbenannt. Gemessen wird deshalb die eigene
	 * Einheit an erster Stelle, die fremde an zweiter.
	 */
	it('und schreibt eine Tabelle mit einer fremden Kennung gar nicht erst', async () => {
		const vorher = (await holeEinheiten(betreiber, a.stweg)).find((e) => e.id === a.nutzeinheit);
		expect(vorher?.label).toBe('A 1.3');

		const { abgesagt } = await fahre(einheitenAktionen as Aktionen, 'speichern', a.stweg, {
			einheitId: [a.nutzeinheit, b.freieEinheit],
			[`kind.${a.nutzeinheit}`]: 'unit',
			[`label.${a.nutzeinheit}`]: 'Halb umbenannt',
			[`q.${a.nutzeinheit}.stamm`]: '300',
			[`kopf.${a.nutzeinheit}`]: 'true',
			[`kind.${b.freieEinheit}`]: 'unit',
			[`label.${b.freieEinheit}`]: 'Fremd umbenannt',
			[`q.${b.freieEinheit}.stamm`]: '300',
			[`kopf.${b.freieEinheit}`]: 'true'
		});
		expect(abgesagt).toBe(true);

		const nachher = (await holeEinheiten(betreiber, a.stweg)).find((e) => e.id === a.nutzeinheit);
		expect(nachher?.label).toBe('A 1.3');
	});

	it('und lässt den Bestand der anderen Gemeinschaft unverändert', async () => {
		const [einheiten, parteien, vertretungen, nutzniessungen, regeln] = await Promise.all([
			holeEinheiten(betreiber, b.stweg),
			holeEigentuemer(betreiber, b.stweg, 'alle'),
			holeVertretungen(betreiber, b.stweg),
			holeNutzniessungen(betreiber, b.stweg),
			holeReglementsregeln(betreiber, b.stweg)
		]);

		// Nichts umbenannt, nichts getilgt, nichts beendet, nichts dazugekommen.
		expect(einheiten.map((e) => e.label).sort()).toEqual(['B 1.1', 'B 1.2', 'B 1.3']);
		// Namen statt Anzahl: Eine Absage, die eine Zeile umbenennt oder tilgt,
		// fiele bei einer blossen Zählung nur zur Hälfte auf.
		expect(parteien.map((p) => p.displayName).sort()).toEqual([
			'B Archivierbar',
			'B Erste',
			'B Erste und B Zweite',
			'B Halterin',
			'B Karteileiche',
			'B Mit Person',
			'B Ohne Vertreter',
			'B Zweite'
		]);
		expect(parteien.every((p) => p.archiviertAm == null)).toBe(true);
		expect(vertretungen).toHaveLength(1);
		expect(vertretungen[0].bis).toBeNull();
		expect(nutzniessungen).toHaveLength(1);
		expect(nutzniessungen[0].holderName).toBe('B Nutzniesser');
		expect(nutzniessungen[0].validTo ?? null).toBeNull();
		expect(regeln).toHaveLength(1);

		// Die Zuordnung von B 1.1 steht noch, und B 1.2 hat weiterhin keine.
		const halterin = parteien.find((p) => p.displayName === 'B Halterin');
		expect(halterin).toBeTruthy();
	});
});

/**
 * Die zweite Hälfte, ohne die die erste nichts wert wäre: derselbe Aufruf mit
 * der eigenen Kennung geht durch.
 *
 * Die Reihenfolge ist Absicht — `zuordnen` braucht die freie Einheit, bevor
 * `erfassen` eine Nutzniessung darauf legt, und `beenden` kommt nach
 * `berichtigen`. Deshalb läuft die Schleife der Reihe nach, nicht nebeneinander.
 */
describe('Die eigene Kennung geht durch', () => {
	for (const fall of faelle) {
		it(fall.name, async () => {
			const { abgesagt, nachricht } = await fahre(
				fall.aktionen,
				fall.aktion,
				a.stweg,
				fall.eigen(a)
			);
			expect({ abgesagt, nachricht }).toEqual({ abgesagt: false, nachricht: '' });
		});
	}
});

/**
 * **«Nichts angekreuzt» darf die Vertretung nicht löschen** (27.08.2026, aus
 * dem Code-Review).
 *
 * Ein Auswahlknopf, den niemand anfasst, schickt sein Feld **gar nicht**;
 * «niemand bezeichnet» schickt es leer. Sind beide dasselbe, löscht ein Klick
 * auf «Übernehmen» ohne Wahl den eingefrorenen `representative_name` — und der
 * steht auf Unterschriftenliste und Stimmzettel.
 *
 * Der Fall ist nicht bloss von aussen erreichbar: Eine Hülle aus der Zeit vor
 * Migration 094 trägt den Namen als freien Text ohne Verweis, und dann ist bei
 * keinem der Knöpfe etwas vorgewählt.
 */
describe('Die Vertretung unterscheidet «leer» von «gar nicht geschickt»', () => {
	it('weist ein Formular ohne das Feld ab und lässt den Namen stehen', async () => {
		const [vorher] = await admin<{ representative_name: string | null }[]>`
			SELECT representative_name FROM party WHERE id = ${a.huelle}
		`;
		expect(vorher.representative_name).not.toBeNull();

		const { abgesagt, nachricht } = await fahre(
			zeileAktionen as Aktionen,
			'vertretungWechseln',
			a.stweg,
			{ parteiId: a.huelle }
		);
		expect(abgesagt).toBe(true);
		expect(nachricht).toMatch(/niemand bezeichnet/);

		const [nachher] = await admin<{ representative_name: string | null }[]>`
			SELECT representative_name FROM party WHERE id = ${a.huelle}
		`;
		expect(nachher.representative_name).toBe(vorher.representative_name);
	});

	it('nimmt die Bezeichnung zurück, wenn das Feld leer geschickt wird', async () => {
		const { abgesagt } = await fahre(
			zeileAktionen as Aktionen,
			'vertretungWechseln',
			a.stweg,
			{ parteiId: a.huelle, mitgliedId: '' }
		);
		expect(abgesagt).toBe(false);

		const [zeile] = await admin<
			{ representative_name: string | null; representative_party_id: string | null }[]
		>`
			SELECT representative_name, representative_party_id FROM party WHERE id = ${a.huelle}
		`;
		expect(zeile.representative_name).toBeNull();
		expect(zeile.representative_party_id).toBeNull();
	});
});

/**
 * Die tilgenden Wege stehen für sich, weil sie ihren Gegenstand aufbrauchen:
 * Nach dem erfolgreichen Tilgen gäbe es nichts mehr, wogegen die Absage laufen
 * könnte.
 */
describe('Tilgen trifft nur die eigene Zeile', () => {
	it('weist die fremde Eigentümerzeile ab und tilgt sie nicht', async () => {
		const { abgesagt, nachricht } = await fahre(
			zeileAktionen as Aktionen,
			'eigentuemerTilgen',
			a.stweg,
			{ parteiId: b.karteileiche }
		);
		expect(abgesagt).toBe(true);
		expect(nachricht).toMatch(/gehört nicht zu dieser Gemeinschaft/);

		const parteien = await holeEigentuemer(betreiber, b.stweg, 'alle');
		expect(parteien.map((p) => p.displayName)).toContain('B Karteileiche');
	});

	/*
	 * **Der gelungene Weg wirft** (27.08.2026, mit dem Umzug auf die Seite der
	 * Zeile). Getilgt wird dort, und danach gibt es die Seite nicht mehr; die
	 * Aktion schickt deshalb mit `redirect(303, …)` zurück zur Liste. SvelteKit
	 * bildet das als geworfenes `Redirect` ab, nicht als Rückgabewert — ohne
	 * diesen Griff läse der Test einen Fehler, wo ein Erfolg steht.
	 */
	it('und tilgt die eigene', async () => {
		const geworfen = await fahre(zeileAktionen as Aktionen, 'eigentuemerTilgen', a.stweg, {
			parteiId: a.ohneVertreter
		}).catch((f: unknown) => f);
		expect((geworfen as { status?: number }).status).toBe(303);
		expect((geworfen as { location?: string }).location).toContain('getilgt=');

		const parteien = await holeEigentuemer(betreiber, a.stweg, 'alle');
		expect(parteien.map((p) => p.displayName)).not.toContain('A Ohne Vertreter');
	});
});

/**
 * Die Bemerkung hängt an der Person, nicht an der Gemeinschaft.
 *
 * **Der Befund vom 26.08.2026 aus der Sicherheitsprüfung der Behebung.** Die
 * Zeile war geprüft, die Person nicht — `setzePersonenbemerkung` schreibt allein
 * über die Personenkennung. Wer auf der Seite von A stand, überschrieb mit
 * einem gefälschten `personId` die Bemerkung einer Person, die nur in B eine
 * Zeile hat: derselbe Fehler eine Schicht tiefer. Geprüft wird deshalb nicht
 * gegen die Gemeinschaft (`person` trägt keine `stweg_id`), sondern gegen die
 * Zeile — und die ist ihrerseits gegen die Gemeinschaft geprüft.
 */
describe('Die Bemerkung trifft nur die Person der eigenen Zeile', () => {
	async function bemerkungVon(personId: string): Promise<string | null> {
		const personen = await holePersonen(betreiber, 'alle');
		return personen.find((p) => p.id === personId)?.bemerkung ?? null;
	}

	it('weist die Person aus der anderen Gemeinschaft ab', async () => {
		const { abgesagt, nachricht } = await fahre(
			zeileAktionen as Aktionen,
			'angabenBerichtigen',
			a.stweg,
			{
				// Die **eigene** Zeile — die Prüfung davor greift also nicht.
				parteiId: a.mitPerson,
				kind: 'natural',
				displayName: 'A Mit Person',
				isCommunity: 'false',
				personId: b.person,
				bemerkung: 'Fremd hineingeschrieben'
			}
		);
		expect(abgesagt).toBe(true);
		expect(nachricht).toMatch(/gehört nicht zu dieser Eigentümerzeile/);
		expect(await bemerkungVon(b.person)).toBeNull();
	});

	it('und schreibt sie an der eigenen', async () => {
		const { abgesagt } = await fahre(
			zeileAktionen as Aktionen,
			'angabenBerichtigen',
			a.stweg,
			{
				parteiId: a.mitPerson,
				kind: 'natural',
				displayName: 'A Mit Person',
				isCommunity: 'false',
				personId: a.person,
				bemerkung: 'Kommt nie, bevollmächtigt den Nachbarn'
			}
		);
		expect(abgesagt).toBe(false);
		expect(await bemerkungVon(a.person)).toBe('Kommt nie, bevollmächtigt den Nachbarn');
	});
});

/**
 * `anlegen` legt die Zeile unter `params.id` an — falsch werden könnte allein
 * die Einheit, die im selben Zug zugeordnet wird.
 */
/**
 * **Ein Teilerfolg darf nicht als Absage aussehen** (27.08.2026, aus dem
 * Code-Review).
 *
 * `erstelleEigentuemer` schliesst seine Transaktion ab, bevor `ordneEigentumZu`
 * läuft. Scheitert die Zuordnung, steht die Zeile trotzdem. Käme die Absage
 * über den äusseren `catch` zurück, brächte sie `werte` mit — das Formular
 * stünde gefüllt da, und ein zweiter Klick legte die Zeile ein zweites Mal an.
 * Genau die Karteileichen aus Prüflauf II.
 */
describe('Anlegen: die Zeile steht, die Zuordnung scheitert', () => {
	it('nennt beides und schickt das Formular NICHT gefüllt zurück', async () => {
		/*
		 * **Eine Einheit mit einem Loch in der Geschichte.** Die Anwendung kann
		 * keines herstellen — `ordneEigentumZu` weist es ab, und das Tilgen zieht
		 * den Vorgänger wieder auf «offen». Geschrieben wird deshalb direkt in die
		 * Tabelle; geprüft wird die Schale, nicht die Schranke.
		 */
		const loch = await erstelleEinheit(handelnder(), {
			stwegId: a.stweg,
			kind: 'unit',
			label: 'Whg mit Loch',
			quotas: { stamm: 1 },
			countsAsHead: true
		});
		await admin`
			INSERT INTO unit_ownership (unit_id, party_id, stweg_id, operator_id, valid_from, valid_to)
			VALUES (${loch.id}, ${a.eigentuemer}, ${a.stweg}, ${betreiber}, '2020-01-01', '2021-01-01'),
			       (${loch.id}, ${a.karteileiche}, ${a.stweg}, ${betreiber}, '2022-01-01', NULL)
		`;

		const name = `A Teilerfolg ${Date.now()}`;
		const { abgesagt, nachricht, ergebnis } = await fahre(
			eigentuemerAktionen as Aktionen,
			'anlegen',
			a.stweg,
			{
				kind: 'natural',
				displayName: name,
				personwahl: 'neu',
				gleichEinheit: loch.id,
				// Nach dem zweiten Abschnitt: Er wird gekappt, das Loch von 2021 bis
				// 2022 bleibt — `ordneEigentumZu` sagt mit `luecke` ab.
				gleichAb: '2023-01-01'
			}
		);
		expect(abgesagt).toBe(true);
		expect(nachricht).toMatch(/ist angelegt/);
		expect(nachricht).toContain(name);

		// **Kein `werte`**: Sonst käme das Formular gefüllt zurück.
		expect((ergebnis as { data?: Record<string, unknown> }).data?.werte).toBeUndefined();

		// Die Zeile steht wirklich, und zwar genau einmal.
		const zeilen = await admin`
			SELECT id FROM party WHERE stweg_id = ${a.stweg} AND display_name = ${name}
		`;
		expect(zeilen).toHaveLength(1);
	});
});

describe('Anlegen mit sofortiger Zuordnung', () => {
	it('weist eine Einheit aus der anderen Gemeinschaft ab', async () => {
		const { abgesagt, nachricht } = await fahre(
			eigentuemerAktionen as Aktionen,
			'anlegen',
			a.stweg,
			{
				kind: 'natural',
				displayName: 'A Neuzugang',
				personwahl: 'neu',
				gleichEinheit: b.freieEinheit,
				gleichAb: '2025-04-01'
			}
		);
		expect(abgesagt).toBe(true);
		expect(nachricht).toMatch(/gehört nicht zu dieser Gemeinschaft/);

		const einheiten = await holeEinheiten(betreiber, b.stweg);
		expect(einheiten.find((e) => e.label === 'B 1.2')).toBeTruthy();

		/*
		 * **Und es darf auch keine Zeile entstanden sein** (26.08.2026, aus dem
		 * Code-Review). Genau das war der Fehler der ersten Fassung: Die Prüfung
		 * stand hinter `erstelleEigentuemer`, dessen Transaktion schon
		 * abgeschlossen war. Die Absage kam, die Maske stand wieder gefüllt da,
		 * und ein zweiter Klick legte die Zeile ein zweites Mal an. Ohne diese
		 * Messung merkte niemand, wenn die Prüfung wieder nach hinten rutscht.
		 */
		const parteien = await holeEigentuemer(betreiber, a.stweg, 'alle');
		expect(parteien.map((p) => p.displayName)).not.toContain('A Neuzugang');
	});
});
