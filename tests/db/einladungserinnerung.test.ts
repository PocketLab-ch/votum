/**
 * Die Erinnerung an den Einladungsversand, durch die ganze Kette
 * (Migration 099, Auftraggeber 28.08.2026).
 *
 * Was der Kern nicht prüfen kann und hier gemessen wird:
 *
 * - dass der **betreiberübergreifende** Weg zu den Kandidaten überhaupt trägt —
 *   der Zeitgeber gehört keinem Betreiber, und ohne die Datenbankfunktion aus
 *   Migration 099 bekäme er die leere Menge (AD-6);
 * - dass die Erinnerung **einmal** geht und der zweite Lauf schweigt;
 * - dass sie **unterbleibt**, sobald die Einladung erzeugt wurde;
 * - dass ohne Erinnerungsadresse **kein Merker** gesetzt wird — sonst käme die
 *   Erinnerung auch nach dem Nachtragen der Adresse nie mehr.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { speichereEinberufungsfrist } from '$lib/server/reglement';
import { setzeErinnerungsadresse } from '$lib/server/betreiber';
import { vermerkeEinladung, vermerkeTraktandenliste } from '$lib/server/unterlagenvermerk';
import { erinnerungslauf } from '$lib/server/einladungserinnerung';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { gibVersammlungFrei, nimmVersammlungsfreigabeZurueck } from '$lib/server/freigabe';
import { legeMarkeAb, neueMarke, vermerkeVersand } from '$lib/server/versandvermerk';
import { holeVorbereitung } from '$lib/server/uebersicht';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { datumLang } from '$lib/domain/datum';
import { env } from '$env/dynamic/private';
import { holeEinladungsmehrInWorten, holeNeuversandHinweis } from '$lib/server/einladungsmehr';
import {
	actions as markenAktionen,
	load as markenSeite
} from '../../src/routes/b/[marke]/+page.server';
import { load as uebersicht } from '../../src/routes/versammlungen/[id=kennung]/+page.server';
import { load as traktandenliste } from '../../src/routes/versammlungen/[id=kennung]/traktanden/+page.server';
import { actions as erfordernisAktionen } from '../../src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.server';
import { eroeffneVersammlung } from '$lib/server/versammlungen';
import { setzeErfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { tageSpaeter } from '$lib/domain/versammlung';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/fehler';
import { app, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/**
 * Der heutige Kalendertag — derselbe, den auch die Datenbankfunktion sieht
 * (`current_date`). Die Versammlungstage werden davon abgeleitet, damit der
 * Lauf an jedem Wochentag dasselbe misst.
 */
const HEUTE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

/** Sammelt, was hinausginge, statt es hinauszugeben. */
function briefkasten() {
	const gesammelt: { an: string; betreff: string; text: string }[] = [];
	return {
		gesammelt,
		versende: async (an: string, betreff: string, text: string) => {
			gesammelt.push({ an, betreff, text });
		}
	};
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Erinnerungs-Prüflauf');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

/**
 * Eine Gemeinschaft mit Frist und eine Versammlung dazu.
 *
 * `inTagen` ist der Abstand des Versammlungstages von heute, `frist` die
 * Einberufungsfrist. Sind beide gleich, läuft die Frist heute ab — dann ist die
 * Erinnerung an jedem Wochentag fällig, weil der Werktag davor nie in der
 * Zukunft liegt.
 */
async function versammlungMitFrist(name: string, inTagen: number, frist: number | null) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	if (frist !== null) {
		await speichereEinberufungsfrist(handelnder(betreiber), g.id, frist, 'Reglement Ziff. 12');
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum: tageSpaeter(HEUTE, inTagen),
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	return { g, v };
}

async function merker(meetingId: string) {
	return imKontext(betreiber, async (tx) => {
		const [z] = await tx<{ sent: Date | null; kind: string | null }[]>`
			SELECT invitation_reminder_sent_at AS sent, invitation_reminder_kind AS kind
			  FROM meeting WHERE id = ${meetingId}
		`;
		return z;
	});
}

describe('Die Erinnerungsadresse', () => {
	/*
	 * **Die Absage steht hier und nicht im Drehbuch** (01.09.2026): Der Server
	 * antwortet mit 400, und der Beobachter des Browserdurchlaufs zählt jede 400
	 * in der Konsole als Befund. Diese Tolerierung für einen absichtlichen
	 * Fehlversuch zu lockern hiesse, sie für alle anderen Seiten mit zu lockern.
	 */
	it('weist eine Adresse ohne Punkt in der Domäne ab und ändert nichts', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		await expect(
			setzeErinnerungsadresse(handelnder(betreiber), 'nicht-so@example')
		).rejects.toThrow(FachlicherFehler);

		const [z] = await imKontext(betreiber, async (tx) => {
			return tx<{ reminder_address: string | null }[]>`
				SELECT reminder_address FROM operator WHERE id = ${betreiber}
			`;
		});
		expect(z.reminder_address).toBe('bewirtschaftung@example.ch');
	});

	it('nimmt sie mit einem leeren Feld wieder heraus', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		expect(await setzeErinnerungsadresse(handelnder(betreiber), '   ')).toBeNull();
	});
});

describe('Der Erinnerungslauf', () => {
	it('erinnert einmal, wenn die Frist heute abläuft — und schweigt beim zweiten Lauf', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const { v } = await versammlungMitFrist('Erinnerung fällig', 10, 10);

		const post = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: post.versende });

		const meine = post.gesammelt.filter((n) => n.betreff.includes('Erinnerung fällig'));
		expect(meine).toHaveLength(1);
		expect(meine[0].an).toBe('bewirtschaftung@example.ch');
		expect(meine[0].betreff).toMatch(/^Erinnerung:/);
		// Die Frist steht im Text, und zwar als Datum und nicht als Zahl allein.
		expect(meine[0].text).toContain('Reglement Ziff. 12');
		expect((await merker(v.id)).kind).toBe('vorwarnung');

		const zweiter = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: zweiter.versende });
		expect(zweiter.gesammelt.filter((n) => n.betreff.includes('Erinnerung fällig'))).toHaveLength(0);
	});

	it('schreibt den Nachweis samt Adresse in den Verlauf', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const { v } = await versammlungMitFrist('Erinnerung im Verlauf', 12, 12);

		await erinnerungslauf({ heute: HEUTE, versende: briefkasten().versende });

		const zeilen = await imKontext(betreiber, async (tx) => {
			return tx<{ actor_label: string; detail: { adresse: string; art: string } }[]>`
				SELECT actor_label, detail FROM audit_entry
				 WHERE subject_type = 'meeting' AND subject_id = ${v.id}
				   AND event_type = ${EREIGNISARTEN.einladungErinnert}
			`;
		});
		expect(zeilen).toHaveLength(1);
		expect(zeilen[0].detail.adresse).toBe('bewirtschaftung@example.ch');
		expect(zeilen[0].actor_label).toBe('Zeitgeber');
	});

	it('meldet die abgelaufene Frist mit einem anderen Betreff', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		// Versammlung in zehn Tagen, Frist zwanzig: der Versandtag ist vorbei.
		const { v } = await versammlungMitFrist('Erinnerung zu spät', 10, 20);

		const post = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: post.versende });

		const meine = post.gesammelt.filter((n) => n.betreff.includes('Erinnerung zu spät'));
		expect(meine).toHaveLength(1);
		expect(meine[0].betreff).toMatch(/^Einberufungsfrist abgelaufen:/);
		expect(meine[0].text).toContain('kann ein Beschluss angefochten werden');
		expect((await merker(v.id)).kind).toBe('abgelaufen');
	});

	it('lässt eine Versammlung in Ruhe, deren Frist noch fern ist', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const { v } = await versammlungMitFrist('Erinnerung fern', 90, 10);

		const post = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: post.versende });

		expect(post.gesammelt.filter((n) => n.betreff.includes('Erinnerung fern'))).toHaveLength(0);
		expect((await merker(v.id)).sent).toBeNull();
	});

	it('lässt eine Gemeinschaft ohne hinterlegte Frist in Ruhe', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const { v } = await versammlungMitFrist('Erinnerung ohne Frist', 10, null);

		const post = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: post.versende });

		expect(post.gesammelt.filter((n) => n.betreff.includes('ohne Frist'))).toHaveLength(0);
		expect((await merker(v.id)).sent).toBeNull();
	});

	it('schweigt, sobald die Einladung erzeugt wurde', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const { v } = await versammlungMitFrist('Erinnerung erledigt', 10, 10);
		await vermerkeEinladung(handelnder(betreiber), v.id);

		const post = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: post.versende });

		expect(post.gesammelt.filter((n) => n.betreff.includes('Erinnerung erledigt'))).toHaveLength(0);
		expect((await merker(v.id)).sent).toBeNull();
	});

	/*
	 * **Ohne Adresse kein Merker.** Ein gesetzter Merker hiesse «erinnert»; wer
	 * die Adresse danach nachträgt, bekäme nie eine Erinnerung — und würde das
	 * erst am verpassten Termin merken.
	 */
	it('setzt ohne Erinnerungsadresse keinen Merker und erinnert danach doch', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), '');
		const { v } = await versammlungMitFrist('Erinnerung ohne Adresse', 10, 10);

		const ohne = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: ohne.versende });
		expect(ohne.gesammelt.filter((n) => n.betreff.includes('ohne Adresse'))).toHaveLength(0);
		expect((await merker(v.id)).sent).toBeNull();

		await setzeErinnerungsadresse(handelnder(betreiber), 'spaeter@example.ch');
		const danach = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: danach.versende });
		expect(danach.gesammelt.filter((n) => n.betreff.includes('ohne Adresse'))).toHaveLength(1);
	});

	/*
	 * **Ein Fehlschlag gibt den Merker wieder frei.** Sonst kostete ein
	 * unerreichbarer Mailserver die Erinnerung endgültig — und niemand erführe
	 * es, weil der Merker sagt, sie sei gegangen.
	 */
	it('gibt den Merker frei, wenn der Versand scheitert', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const { v } = await versammlungMitFrist('Erinnerung scheitert', 10, 10);

		await erinnerungslauf({
			heute: HEUTE,
			versende: async () => {
				throw new Error('Mailserver nicht erreichbar');
			}
		});
		expect((await merker(v.id)).sent).toBeNull();

		const danach = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: danach.versende });
		expect(danach.gesammelt.filter((n) => n.betreff.includes('Erinnerung scheitert'))).toHaveLength(1);
	});
});

/*
 * **Nach einer Milderung des Mehrs erinnert der Lauf erneut** (Produktentscheid
 * 06.10.2026, «Ja, erneut erinnern»; Migration 145). Die Milderung ist dieselbe
 * wie in `einladungsmehr.test.ts`, describe «Vor Beginn»: ein Traktandum mit
 * zwei Dritteln, freigegeben, danach auf das einfache Mehr gestellt.
 */
describe('Nach einer Milderung', () => {
	const EINFACH: Erfordernis = {
		fassung: '2026-07-30',
		juristischGegengelesen: false,
		astId: 'a-verwaltung',
		knotenId: 'k-verwaltung-gewoehnlich',
		typ: 'einfaches_mehr',
		titel: 'Einfaches Mehr',
		rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
		kopfbasis: 'anwesend_vertreten',
		quotenbasis: 'keine',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenSchwelle: null,
		zustimmungBetroffenerNoetig: false,
		pfad: [],
		quelle: 'hergeleitet'
	};
	const ZWEIDRITTEL: Erfordernis = {
		...EINFACH,
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' }
	};

	/**
	 * Eine freigegebene Versammlung mit einem Traktandum zu zwei Dritteln, mit
	 * `zweites` ein weiteres dazu.
	 */
	async function freigegeben(
		name: string,
		inTagen: number,
		frist: number,
		zweites = false,
		mehr: Erfordernis = ZWEIDRITTEL
	) {
		const { g, v } = await versammlungMitFrist(name, inTagen, frist);
		for (const [nummer, quote] of [600, 400].entries()) {
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'unit',
				label: `Whg ${nummer + 1}`,
				quotas: { stamm: quote },
				countsAsHead: true
			});
			const p = await erstelleEigentuemer(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'natural',
				displayName: `Erfundene Partei ${nummer + 1}`,
				isCommunity: false,
				representativeName: null
			});
			await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		}
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			parentId: null,
			titel: 'Sanierung der Fassade',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird gemäss Offerte saniert.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, mehr);
		let zweitesTraktandum: string | null = null;
		if (zweites) {
			const b = await erstelleTraktandum(handelnder(betreiber), {
				meetingId: v.id,
				parentId: null,
				titel: 'Ersatz der Briefkästen',
				art: 'abstimmung',
				antragswortlaut: 'Die Briefkästen werden ersetzt.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: []
			});
			await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, b.id, ZWEIDRITTEL);
			zweitesTraktandum = b.id;
		}
		await gibVersammlungFrei(handelnder(betreiber), v.id);
		return { g, v, traktandum: t.id, zweitesTraktandum };
	}

	async function mildere(v: string, traktandum: string) {
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v, traktandum, EINFACH);
	}

	async function lauf(name: string) {
		const post = briefkasten();
		await erinnerungslauf({ heute: HEUTE, versende: post.versende });
		return post.gesammelt.filter((n) => n.betreff.includes(name));
	}

	/**
	 * Ein Lauf mit bekannter eigener Adresse (`ORIGIN`), damit Link und Adresse
	 * der Seite Vorbereitung in der Mail stehen. Danach wieder wie vorher.
	 */
	async function laufMitAdresse(name: string) {
		const vorher = env.ORIGIN;
		env.ORIGIN = 'https://votum.example';
		try {
			return await lauf(name);
		} finally {
			// Leer heisst für `festeHerkunft` dasselbe wie nicht gesetzt.
			env.ORIGIN = vorher ?? '';
		}
	}

	function markeAus(text: string): string {
		const treffer = /https:\/\/votum\.example\/b\/([A-Za-z0-9_-]+)/.exec(text);
		expect(treffer, text).not.toBeNull();
		return treffer![1];
	}

	const PRUEFERIN = {
		id: '',
		operatorId: '',
		username: 'pruefer-erinnerung',
		displayName: 'Prüferin',
		role: 'admin'
	};

	async function erinnert(meetingId: string) {
		return imKontext(
			betreiber,
			(tx) =>
				tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'meeting' AND subject_id = ${meetingId}
				   AND event_type = ${EREIGNISARTEN.einladungErinnert}
				 ORDER BY id
			`
		);
	}

	async function gemildertAm(traktandum: string) {
		const [z] = await imKontext(
			betreiber,
			(tx) =>
				tx<{ relaxed: Date }[]>`
				SELECT released_requirement_relaxed_at AS relaxed FROM agenda_item WHERE id = ${traktandum}
			`
		);
		return z.relaxed;
	}

	it('erinnert nach der Milderung erneut, obwohl die Einladung erzeugt und schon erinnert ist', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Milderung';
		const a = await freigegeben(name, 10, 10);

		// Die erste Erinnerung, danach die erste Einladung erzeugt.
		expect(await lauf(name)).toHaveLength(1);
		const erste = (await merker(a.v.id)).sent!;
		await vermerkeEinladung(handelnder(betreiber), a.v.id);
		expect(await lauf(name)).toHaveLength(0);

		await mildere(a.v.id, a.traktandum);
		expect(erste.getTime()).toBeLessThan((await gemildertAm(a.traktandum)).getTime());

		const meine = await lauf(name);
		expect(meine).toHaveLength(1);
		expect(meine[0].an).toBe('bewirtschaftung@example.ch');
		expect(meine[0].betreff).toBe(
			`Berichtigte Einladung nötig: ${name}, Versammlung vom ${datumLang(tageSpaeter(HEUTE, 10))}`
		);
		// Die Nummer ist die der Einladung; davor stehen die Pflichttraktanden.
		expect(meine[0].text).toMatch(
			/das Mehr eines Traktandums milder geworden\. Betroffen ist: «\d+ Sanierung der Fassade»\./
		);
		expect(meine[0].text).not.toContain('Die Anwendung sieht keine erzeugte Einladung');

		const m = await merker(a.v.id);
		expect(m.kind).toBe('vorwarnung');
		expect(m.sent!.getTime()).toBeGreaterThanOrEqual((await gemildertAm(a.traktandum)).getTime());

		const eintraege = await erinnert(a.v.id);
		expect(eintraege).toHaveLength(2);
		expect(eintraege[0].detail.grund).toBeUndefined();
		expect(eintraege[1].detail).toMatchObject({
			art: 'vorwarnung',
			grund: 'Mehr seit der Freigabe gemildert'
		});

		// Der zweite Lauf schweigt.
		expect(await lauf(name)).toHaveLength(0);
		expect(await erinnert(a.v.id)).toHaveLength(2);
	});

	it('schweigt, wenn der Neuversand nach der Milderung rechtzeitig vermerkt ist', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Vermerkt';
		const a = await freigegeben(name, 10, 10);
		await vermerkeEinladung(handelnder(betreiber), a.v.id);
		await mildere(a.v.id, a.traktandum);
		await vermerkeVersand(handelnder(betreiber), a.v.id, true);

		expect(await lauf(name)).toHaveLength(0);
		expect((await merker(a.v.id)).sent).toBeNull();
	});

	/*
	 * **Auch ein Vermerk nach dem letzten Fristtag erledigt die Erinnerung**
	 * (Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»: jeder Haken
	 * nach der Milderung zählt). Bis dahin erinnerte der Dienst weiter, mit
	 * dem Satz, beim Eröffnen gelte wieder die bisherige Einladung.
	 */
	it('schweigt auch, wenn der Vermerk erst nach dem letzten Fristtag kam', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Verspätet';
		const a = await freigegeben(name, 40, 20);
		await mildere(a.v.id, a.traktandum);
		await vermerkeVersand(handelnder(betreiber), a.v.id, true);
		// Die Frist auf gestern ziehen: Der Vermerk liegt dann danach (wie in
		// `einladungsmehr.test.ts`, «ein Haken nach dem letzten Fristtag»).
		await speichereEinberufungsfrist(handelnder(betreiber), a.g.id, 41, 'Reglement Ziff. 12');

		expect(await lauf(name)).toHaveLength(0);
		expect((await merker(a.v.id)).sent).toBeNull();
	});

	it('schweigt, wenn das Mehr vor dem Neuversand zurückgestellt wurde', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Zurück';
		const a = await freigegeben(name, 10, 10);
		expect(await lauf(name)).toHaveLength(1);
		await vermerkeEinladung(handelnder(betreiber), a.v.id);
		await mildere(a.v.id, a.traktandum);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.v.id, a.traktandum, ZWEIDRITTEL);

		expect(await lauf(name)).toHaveLength(0);
		expect(await erinnert(a.v.id)).toHaveLength(1);
	});

	it('ohne Milderung schweigt eine freigegebene Versammlung mit erzeugter Einladung wie bisher', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Ohne';
		const a = await freigegeben(name, 10, 10);
		await vermerkeEinladung(handelnder(betreiber), a.v.id);

		expect(await lauf(name)).toHaveLength(0);
		expect((await merker(a.v.id)).sent).toBeNull();
	});

	/*
	 * **Codeprüfung N7, Korrekturrunde 06.10.2026**: die Wege, die die ersten
	 * Proben nicht gingen.
	 */
	it('nach einem Fehlschlag gibt sie den Merker frei, und der nächste Lauf versucht es erneut', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Fehlschlag';
		const a = await freigegeben(name, 10, 10);
		expect(await lauf(name)).toHaveLength(1);
		await vermerkeEinladung(handelnder(betreiber), a.v.id);
		await mildere(a.v.id, a.traktandum);

		await erinnerungslauf({
			heute: HEUTE,
			versende: async () => {
				throw new Error('Mailserver nicht erreichbar');
			}
		});
		expect((await merker(a.v.id)).sent).toBeNull();

		const danach = await lauf(name);
		expect(danach).toHaveLength(1);
		expect(danach[0].betreff).toMatch(/^Berichtigte Einladung nötig: /);
	});

	it('eine zweite Milderung bringt eine zweite Mail, die nur das neue Traktandum nennt', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Zweimal';
		const a = await freigegeben(name, 10, 10, true);

		await mildere(a.v.id, a.traktandum);
		const erste = await lauf(name);
		expect(erste).toHaveLength(1);
		expect(erste[0].text).toMatch(/Betroffen ist: «\d+ Sanierung der Fassade»\./);

		// Die erste berichtigte Einladung ist gültig verschickt, dann die zweite Milderung.
		await vermerkeVersand(handelnder(betreiber), a.v.id, true);
		await mildere(a.v.id, a.zweitesTraktandum!);

		const zweite = await lauf(name);
		expect(zweite).toHaveLength(1);
		expect(zweite[0].text).toMatch(/Betroffen ist: «\d+ Ersatz der Briefkästen»\./);
		expect(zweite[0].text).not.toContain('Sanierung der Fassade');
		expect(await erinnert(a.v.id)).toHaveLength(2);
		expect(await lauf(name)).toHaveLength(0);
	});

	/*
	 * **Seit dem Produktentscheid 07.10.2026 legt der Dienst auch nach
	 * Fristablauf eine Marke ab** («Nur noch aufmerksam machen»: jeder Vermerk
	 * nach der Milderung erledigt Hinweis und Erinnerung). Bis dahin legte er
	 * keine ab, und der Mailtext trug keinen Link. Seit Block B trägt ihn auch
	 * diese Fassung; gegen den Stand davor rot.
	 */
	it('nach Fristablauf legt der Dienst eine Marke ab, und der Mailtext trägt den Link', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Ohne Link';
		const a = await freigegeben(name, 40, 20);
		await mildere(a.v.id, a.traktandum);
		await speichereEinberufungsfrist(handelnder(betreiber), a.g.id, 41, 'Reglement Ziff. 12');

		const meine = await laufMitAdresse(name);
		expect(meine).toHaveLength(1);
		expect(meine[0].betreff).toMatch(/^Frist für die berichtigte Einladung abgelaufen: /);
		expect(meine[0].text).toContain('auch über diesen Link bestätigen:\n\n    https://votum.example/b/');
		expect(meine[0].text).not.toContain('beim Eröffnen');
		// Die Adresse der Seite Vorbereitung steht auch hier (Laienprüfung N4).
		expect(meine[0].text).toContain(
			`    https://votum.example/versammlungen/${a.v.id}/vorbereitung\n`
		);
		const [z] = await imKontext(
			betreiber,
			(tx) =>
				tx<{ marke: string | null }[]>`
				SELECT invitation_reminder_token_hash AS marke FROM meeting WHERE id = ${a.v.id}
			`
		);
		expect(z.marke).not.toBeNull();
	});

	it('vor Fristablauf trägt die Mail Link und Adresse der Seite Vorbereitung', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Mit Link';
		const a = await freigegeben(name, 10, 10);
		await mildere(a.v.id, a.traktandum);

		const [mail] = await laufMitAdresse(name);
		expect(mail.text).toContain(`    https://votum.example/versammlungen/${a.v.id}/vorbereitung\n`);
		expect(mail.text).toContain('auch über diesen Link bestätigen:\n\n    https://votum.example/b/');
	});

	/** Was die Linkseite beim Aufruf liefert. */
	async function linkseite(marke: string) {
		return (await markenSeite({ params: { marke } } as never)) as {
			gefunden: boolean;
			fassung: string;
			frist: string | null;
		};
	}

	/** Das Absenden auf der Linkseite, mit der Fassung, die angezeigt war. */
	async function bestaetige(marke: string, fassung: string | null) {
		const daten = new FormData();
		if (fassung !== null) daten.set('fassung', fassung);
		return (await markenAktionen.default({
			params: { marke },
			request: new Request('http://pruefung.example/b', {
				method: 'POST',
				body: daten
			})
		} as never)) as { ausgang: string; fassung: string; frist: string | null };
	}

	async function untergrenzeVon(traktandum: string) {
		const [z] = await imKontext(
			betreiber,
			(tx) =>
				tx<{ mehr: Erfordernis | null }[]>`
				SELECT released_requirement AS mehr FROM agenda_item WHERE id = ${traktandum}
			`
		);
		return z.mehr;
	}

	it('am letzten Fristtag sagt die Mail, dass keine Post mehr reicht', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Fristtag';
		const a = await freigegeben(name, 10, 10);
		await mildere(a.v.id, a.traktandum);
		const [mail] = await lauf(name);
		// Versammlung in zehn Tagen, Frist zehn Tage: Heute ist der letzte Tag.
		expect(mail.text).toContain(
			// An die erfasste Frist gebunden seit Runde 1 (Fachprüfung B4, 07.10.2026).
			'Heute ist der letzte Tag. Per Post kommt sie nicht mehr bis zum letzten Tag der erfassten Frist an'
		);
		expect(mail.text).not.toContain('A-Post');
	});

	it('eine Milderung macht die Marke einer früheren Erinnerung ungültig, auch ohne Vermerk', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Alte Marke';
		const a = await freigegeben(name, 10, 10);
		const [mail] = await laufMitAdresse(name);
		expect(mail.betreff).toMatch(/^Erinnerung:/);
		const marke = markeAus(mail.text);
		expect((await linkseite(marke)).gefunden).toBe(true);

		await mildere(a.v.id, a.traktandum);
		expect((await linkseite(marke)).gefunden).toBe(false);
		expect((await bestaetige(marke, 'bisher')).ausgang).toBe('unbekannt');
	});

	/*
	 * **Die Sperre** (Codeprüfung M1). Zwei Verbindungen: Die Probe hält die
	 * Zeile der Versammlung, der Lauf wartet darauf (nachgewiesen über
	 * `pg_locks`), dann mildert die Probe wie `achteEinladungsmehr` und gibt
	 * frei. Liest der Lauf nach der Sperre frisch, schickt er die Fassung nach
	 * Milderung; las er die Traktanden vorher, die bisherige.
	 */
	it('der Lauf wartet auf eine laufende Milderung und liest danach ihren Stand', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Sperre';
		const a = await freigegeben(name, 10, 10);

		let wartend: Promise<{ betreff: string; text: string }[]> | null = null;
		/*
		 * **Den wartenden Lauf immer abwarten** (Codeprüfung H2): Scheitert eine
		 * Erwartung, solange er auf die Sperre wartet, liefe er sonst über das
		 * Ende der Probe hinaus und schriebe in die nächste.
		 */
		try {
			await imKontext(betreiber, async (tx) => {
				await tx`SELECT 1 FROM meeting WHERE id = ${a.v.id} FOR UPDATE`;
				wartend = lauf(name);
				let wartet = false;
				for (let i = 0; i < 100 && !wartet; i++) {
					await new Promise((r) => setTimeout(r, 50));
					const [z] = await app`
					SELECT count(*)::int AS n FROM pg_locks l
					 WHERE NOT l.granted AND l.locktype IN ('transactionid', 'tuple')
				`;
					wartet = z.n > 0;
				}
				expect(wartet, 'der Lauf hat nicht auf die Sperre gewartet').toBe(true);
				await tx`
				UPDATE agenda_item
				   SET released_requirement = ${tx.json(EINFACH as never)},
				       released_requirement_before = released_requirement,
				       released_requirement_relaxed_at = clock_timestamp()
				 WHERE id = ${a.traktandum}
			`;
			});
		} finally {
			if (wartend) await (wartend as Promise<unknown>).catch(() => undefined);
		}
		const mails = await wartend!;
		expect(mails).toHaveLength(1);
		expect(mails[0].betreff).toMatch(/^Berichtigte Einladung nötig: /);
	});

	/*
	 * **Eine Milderung zwischen Versand und Ablegen der Marke** (Codeprüfung
	 * Teil 2 Runde 3, N1). Der Versand ist hier der Prüfbriefkasten; in ihm
	 * fällt die Milderung. Die Marke dieser Mail kennt die Milderung nicht und
	 * wird verworfen, und der nächste Lauf erinnert an die Milderung.
	 */
	it('verwirft die Marke, wenn zwischen Versand und Ablegen eine Milderung fällt', async () => {
		await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
		const name = 'Erfundenhalde Zwischendrin';
		const a = await freigegeben(name, 10, 10);
		const vorher = env.ORIGIN;
		env.ORIGIN = 'https://votum.example';
		const gesammelt: { betreff: string; text: string }[] = [];
		try {
			await erinnerungslauf({
				heute: HEUTE,
				versende: async (_an, betreff, text) => {
					if (!betreff.includes(name)) return;
					gesammelt.push({ betreff, text });
					await mildere(a.v.id, a.traktandum);
				}
			});
		} finally {
			env.ORIGIN = vorher ?? '';
		}
		expect(gesammelt).toHaveLength(1);
		expect(gesammelt[0].betreff).toMatch(/^Erinnerung:/);
		const marke = markeAus(gesammelt[0].text);
		expect((await linkseite(marke)).gefunden).toBe(false);
		const [z] = await imKontext(
			betreiber,
			(tx) =>
				tx<{ marke: string | null }[]>`
				SELECT invitation_reminder_token_hash AS marke FROM meeting WHERE id = ${a.v.id}
			`
		);
		expect(z.marke).toBeNull();

		const danach = await lauf(name);
		expect(danach).toHaveLength(1);
		expect(danach[0].betreff).toMatch(/^Berichtigte Einladung nötig: /);
	});

	it('die Erfordernisseite weiss, ob für das Traktandum eine Milderung aussteht', async () => {
		const a = await freigegeben('Erfundenhalde Erfordernis gemildert', 30, 10);
		expect((await holeEinladungsmehrInWorten(betreiber, a.traktandum))?.gemildert).toBe(false);
		await mildere(a.v.id, a.traktandum);
		expect(await holeEinladungsmehrInWorten(betreiber, a.traktandum)).toMatchObject({
			gemildert: true,
			worte: expect.stringMatching(/zwei Drittel/i)
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.v.id, a.traktandum, ZWEIDRITTEL);
		expect((await holeEinladungsmehrInWorten(betreiber, a.traktandum))?.gemildert).toBe(false);
	});

	describe('Die Seite hinter dem Link', () => {
		it('fragt nach einer Milderung nach der berichtigten Einladung, nach Fristablauf in eigener Fassung', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Linkseite';
			const a = await freigegeben(name, 10, 10);
			await mildere(a.v.id, a.traktandum);
			const marke = markeAus((await laufMitAdresse(name))[0].text);

			expect(await linkseite(marke)).toMatchObject({
				gefunden: true,
				fassung: 'berichtigt',
				frist: datumLang(HEUTE)
			});

			// Die Frist um einen Tag länger: Ihr letzter Tag war gestern. Die Seite
			// zeigt dann die Fassung «zu spät», seit dem Produktentscheid 07.10.2026
			// mit Knopf (bis dahin ohne).
			await speichereEinberufungsfrist(handelnder(betreiber), a.g.id, 11, 'Reglement Ziff. 12');
			expect(await linkseite(marke)).toMatchObject({
				gefunden: true,
				fassung: 'zu_spaet',
				frist: datumLang(tageSpaeter(HEUTE, -1))
			});
		});

		/*
		 * Seit dem Produktentscheid 07.10.2026 («Nur noch aufmerksam machen»)
		 * erledigt der Vermerk nach Fristablauf den Hinweis, und das mildere Mehr
		 * bleibt beim Eröffnen. Bis dahin blieb der Hinweis stehen, und das
		 * Eröffnen fiel auf zwei Drittel zurück. Den Wortlaut der Seite «zu spät»
		 * misst `tests/domain/hakentext.test.ts`.
		 */
		it('nach Fristablauf: die Bestätigung von vorher löst nicht ein; ein Vermerk dann erledigt den Hinweis', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Zu spät';
			const a = await freigegeben(name, 10, 10);
			await mildere(a.v.id, a.traktandum);
			const marke = markeAus((await laufMitAdresse(name))[0].text);
			await speichereEinberufungsfrist(handelnder(betreiber), a.g.id, 11, 'Reglement Ziff. 12');

			// Die Seite zeigte «berichtigt», inzwischen ist die Frist vorbei.
			expect(await bestaetige(marke, 'berichtigt')).toMatchObject({
				ausgang: 'geaendert',
				fassung: 'zu_spaet'
			});
			expect((await linkseite(marke)).gefunden).toBe(true);

			// Wer trotzdem die Fassung «zu spät» abschickt, vermerkt den Versand.
			expect(await holeNeuversandHinweis(betreiber, a.v.id)).not.toBeNull();
			expect(await bestaetige(marke, 'zu_spaet')).toMatchObject({
				ausgang: 'gesetzt',
				fassung: 'zu_spaet'
			});
			expect(await holeNeuversandHinweis(betreiber, a.v.id)).toBeNull();
			await eroeffneVersammlung(handelnder(betreiber), a.v.id);
			expect((await untergrenzeVon(a.traktandum))?.kopfSchwelle).toEqual(EINFACH.kopfSchwelle);
		});

		it('mit Ja gilt der Neuversand, und die Antwort sagt es', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Linkknopf';
			const a = await freigegeben(name, 10, 10);
			await mildere(a.v.id, a.traktandum);
			const marke = markeAus((await laufMitAdresse(name))[0].text);
			expect(await holeNeuversandHinweis(betreiber, a.v.id)).not.toBeNull();

			expect(await bestaetige(marke, 'berichtigt')).toMatchObject({
				ausgang: 'gesetzt',
				fassung: 'berichtigt'
			});
			expect(await holeNeuversandHinweis(betreiber, a.v.id)).toBeNull();
		});

		it('hat sich die Frage geändert, wird nicht eingelöst, sondern neu gefragt', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Fassungswechsel';
			const a = await freigegeben(name, 10, 10);
			await mildere(a.v.id, a.traktandum);
			const marke = markeAus((await laufMitAdresse(name))[0].text);
			expect((await linkseite(marke)).fassung).toBe('berichtigt');

			// Zurückgestellt: Jetzt fragt die Seite wieder nach der bisherigen Einladung.
			await haltErfordernisAmTraktandumFest(
				handelnder(betreiber),
				a.v.id,
				a.traktandum,
				ZWEIDRITTEL
			);
			expect(await bestaetige(marke, 'berichtigt')).toMatchObject({
				ausgang: 'geaendert',
				fassung: 'bisher'
			});
			// Nicht eingelöst: Die Marke gilt weiter, und die Seite fragt neu.
			expect(await linkseite(marke)).toMatchObject({
				gefunden: true,
				fassung: 'bisher'
			});
			// Ohne Angabe ebenso.
			expect((await bestaetige(marke, null)).ausgang).toBe('geaendert');
			expect((await bestaetige(marke, 'bisher')).ausgang).toBe('gesetzt');
		});

		it('ohne Milderung bleibt es bei der bisherigen Frage', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Linkbestand';
			await freigegeben(name, 10, 10);
			const [mail] = await laufMitAdresse(name);
			expect(mail.betreff).toMatch(/^Erinnerung:/);
			const marke = markeAus(mail.text);

			expect(await linkseite(marke)).toMatchObject({
				gefunden: true,
				fassung: 'bisher'
			});
			expect(await bestaetige(marke, 'bisher')).toMatchObject({
				ausgang: 'gesetzt',
				fassung: 'bisher'
			});
		});
	});

	describe('Der Kasten auf der Versammlungsseite', () => {
		async function seite(id: string) {
			const daten = (await uebersicht({
				locals: {
					benutzer: { ...PRUEFERIN, id: benutzer, operatorId: betreiber },
					herkunft: null
				},
				params: { id },
				url: new URL('http://pruefung.example/versammlung')
			} as never)) as {
				neuversand: { anzahl: number; fristVorbei: boolean } | null;
				versammlung: { zustand: string };
			};
			return daten;
		}

		it('vor Fristablauf: steht aus; gültig vermerkt: kein Kasten', async () => {
			const a = await freigegeben('Erfundenhalde Übersicht', 30, 10, true);
			const ohne = await seite(a.v.id);
			expect(ohne.versammlung.zustand).toBe('freigegeben');
			expect(ohne.neuversand).toBeNull();

			await mildere(a.v.id, a.traktandum);
			expect((await seite(a.v.id)).neuversand).toEqual({
				anzahl: 1,
				fristVorbei: false
			});
			await mildere(a.v.id, a.zweitesTraktandum!);
			expect((await seite(a.v.id)).neuversand).toEqual({
				anzahl: 2,
				fristVorbei: false
			});

			await vermerkeVersand(handelnder(betreiber), a.v.id, true);
			expect((await seite(a.v.id)).neuversand).toBeNull();
		});

		// Seit dem Produktentscheid 07.10.2026 nimmt auch ein später Vermerk den
		// Kasten weg; bis dahin blieb er mit «Frist vorbei» stehen.
		it('nach Fristablauf: die Frist ist vorbei; ein später Vermerk nimmt den Kasten weg', async () => {
			const a = await freigegeben('Erfundenhalde Übersicht spät', 40, 20);
			await mildere(a.v.id, a.traktandum);
			await speichereEinberufungsfrist(handelnder(betreiber), a.g.id, 41, 'Reglement Ziff. 12');
			expect((await seite(a.v.id)).neuversand).toEqual({
				anzahl: 1,
				fristVorbei: true
			});
			await vermerkeVersand(handelnder(betreiber), a.v.id, true);
			expect((await seite(a.v.id)).neuversand).toBeNull();
		});
	});

	/*
	 * **Der Rückweg über die Erfordernisseite** (Codeprüfung N8), über deren
	 * Aktion und nicht über die Funktion dahinter: So prüft die Probe auch, dass
	 * die Route im Zustand «freigegeben» schreiben darf.
	 */
	it('über die Aktion der Erfordernisseite mildern und zurückstellen', async () => {
		const rw = holeRegelwerk();
		const qualifiziert = setzeErfordernis(rw, 'qualifiziertes_mehr', 'Prüflauf').ergebnis;
		const a = await freigegeben('Erfundenhalde Erfordernisseite', 30, 10, false, qualifiziert);

		async function setze(typ: string): Promise<number> {
			const daten = new FormData();
			daten.set('typ', typ);
			daten.set('begruendung', 'Prüflauf');
			try {
				const r = (await erfordernisAktionen.setzen({
					request: new Request('http://pruefung.example/aktion', {
						method: 'POST',
						body: daten
					}),
					locals: {
						benutzer: { ...PRUEFERIN, id: benutzer, operatorId: betreiber },
						herkunft: null
					},
					params: { id: a.v.id, traktandumId: a.traktandum },
					url: new URL('http://pruefung.example/aktion')
				} as never)) as { status?: number };
				return r?.status ?? 200;
			} catch (fehler) {
				// `redirect()` wirft ein Objekt mit `status`.
				if (fehler && typeof fehler === 'object' && 'status' in fehler) {
					return (fehler as { status: number }).status;
				}
				throw fehler;
			}
		}

		expect(await setze('einfaches_mehr')).toBe(303);
		expect(await holeNeuversandHinweis(betreiber, a.v.id)).not.toBeNull();
		expect(await setze('qualifiziertes_mehr')).toBe(303);
		expect(await holeNeuversandHinweis(betreiber, a.v.id)).toBeNull();
		expect((await untergrenzeVon(a.traktandum))?.typ).toBe('qualifiziertes_mehr');
	});

	/*
	 * **Der Rückweg braucht einen Weg** (Produktentscheid 06.10.2026, «Verweis
	 * einbauen»). Mail und Hinweis nennen «Erfordernis ändern» in der
	 * Traktandenliste; vorher führte bei einer freigegebenen Versammlung keiner
	 * zur Erfordernisseite.
	 */
	describe('Der Verweis in der Traktandenliste', () => {
		async function liste(id: string) {
			return (await traktandenliste({
				locals: {
					benutzer: { ...PRUEFERIN, id: benutzer, operatorId: betreiber },
					herkunft: null
				},
				params: { id },
				url: new URL('http://pruefung.example/traktanden')
			} as never)) as unknown as {
				aenderbar: boolean;
				erfordernisVorBeginn: boolean;
				traktanden: {
					knoten: { id: string; art: string; erfordernis: unknown };
				}[];
			};
		}

		it('ist bei einer freigegebenen Versammlung frei, sonst bleibt alles beim Entwurf', async () => {
			const a = await freigegeben('Erfundenhalde Traktandenliste', 30, 10);
			const daten = await liste(a.v.id);
			expect(daten.erfordernisVorBeginn).toBe(true);
			// Nur der Verweis: Die Liste selbst bleibt nach der Freigabe fest.
			expect(daten.aenderbar).toBe(false);
			const zeile = daten.traktanden.find((t) => t.knoten.id === a.traktandum)!;
			expect(zeile.knoten.art).toBe('abstimmung');
			expect(zeile.knoten.erfordernis).toBeTruthy();

			// Und der Weg trägt: Zurückstellen nach einer Milderung schreibt.
			await mildere(a.v.id, a.traktandum);
			await haltErfordernisAmTraktandumFest(
				handelnder(betreiber),
				a.v.id,
				a.traktandum,
				ZWEIDRITTEL
			);
			expect(await holeNeuversandHinweis(betreiber, a.v.id)).toBeNull();
		});

		it('im Entwurf nicht, dort führt der Kasten mit demselben Knopf hin', async () => {
			const { v } = await versammlungMitFrist('Erfundenhalde Entwurf', 30, 10);
			const daten = await liste(v.id);
			expect(daten.erfordernisVorBeginn).toBe(false);
			expect(daten.aenderbar).toBe(true);
		});
	});

	/*
	 * **Nach einer Rücknahme der Freigabe zählt nur, was danach kam**
	 * (Produktentscheide 06.10.2026, «Rücknahme setzt den Merker zurück» und
	 * «Seit Rücknahme zählen»; Migration 147). Die neue Freigabe ist eine neue
	 * Einladung: Der Merker der Erinnerung ist leer, und «Einladung erzeugt» von
	 * vorher hält weder die Erinnerung zurück noch erledigt es den Schritt.
	 */
	describe('Nach einer Rücknahme der Freigabe', () => {
		async function zuruecknehmenUndNeuFreigeben(meetingId: string) {
			await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), meetingId);
			await gibVersammlungFrei(handelnder(betreiber), meetingId);
		}

		async function kandidat(meetingId: string) {
			const zeilen = await imKontext(
				betreiber,
				(tx) =>
					tx<{ meeting_id: string }[]>`
					SELECT meeting_id FROM faellige_einladungserinnerungen(${EREIGNISARTEN.einladungErzeugt})
				`
			);
			return zeilen.some((z) => z.meeting_id === meetingId);
		}

		async function schrittEinladung(meetingId: string) {
			const v = await holeVorbereitung(betreiber, meetingId);
			return v!.schritte.find((s) => s.kennung === 'einladung')!.zustand;
		}

		async function anzahl(meetingId: string, art: string) {
			const [z] = await imKontext(
				betreiber,
				(tx) =>
					tx<{ n: number }[]>`
					SELECT count(*)::int AS n FROM audit_entry
					 WHERE subject_type = 'meeting' AND subject_id = ${meetingId} AND event_type = ${art}
				`
			);
			return z.n;
		}

		/** Der Merker als Text, wie der Dienst ihn an `legeMarkeAb` gibt. */
		async function merkerText(meetingId: string) {
			const [z] = await imKontext(
				betreiber,
				(tx) =>
					tx<{ merker: string | null }[]>`
					SELECT invitation_reminder_sent_at::text AS merker FROM meeting WHERE id = ${meetingId}
				`
			);
			return z.merker;
		}

		it('setzt den Merker zurück, und nach der neuen Freigabe kommt die Erinnerung wieder', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Rücknahme';
			const a = await freigegeben(name, 10, 10);

			expect(await lauf(name)).toHaveLength(1);
			await vermerkeEinladung(handelnder(betreiber), a.v.id);
			expect(await lauf(name)).toHaveLength(0);
			expect((await merker(a.v.id)).sent).not.toBeNull();

			await zuruecknehmenUndNeuFreigeben(a.v.id);
			expect(await merker(a.v.id)).toEqual({ sent: null, kind: null });
			expect(await kandidat(a.v.id)).toBe(true);

			const meine = await lauf(name);
			expect(meine).toHaveLength(1);
			expect(meine[0].betreff).toMatch(/^Erinnerung:/);
			expect((await merker(a.v.id)).kind).toBe('vorwarnung');
			expect(await erinnert(a.v.id)).toHaveLength(2);
			// Danach wieder einmal: Der zweite Lauf schweigt.
			expect(await lauf(name)).toHaveLength(0);
		});

		it('Gegenprobe: ohne Rücknahme bleibt es bei einer Erinnerung', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Ohne Rücknahme';
			const a = await freigegeben(name, 10, 10);

			expect(await lauf(name)).toHaveLength(1);
			const vorher = await merker(a.v.id);
			expect(await lauf(name)).toHaveLength(0);
			expect(await kandidat(a.v.id)).toBe(false);
			expect(await merker(a.v.id)).toEqual(vorher);
			expect(await erinnert(a.v.id)).toHaveLength(1);
		});

		it('eine Einladung von vor der Rücknahme zählt nicht, eine danach erzeugte wieder', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Neu erzeugt';
			const a = await freigegeben(name, 10, 10);
			await vermerkeEinladung(handelnder(betreiber), a.v.id);
			await vermerkeTraktandenliste(handelnder(betreiber), a.v.id);
			expect(await schrittEinladung(a.v.id)).toBe('erledigt');
			expect(await lauf(name)).toHaveLength(0);

			await zuruecknehmenUndNeuFreigeben(a.v.id);
			// Das «erzeugt» von vorher zählt nicht mehr: Schritt offen, Kandidat.
			expect(await schrittEinladung(a.v.id)).toBe('offen');
			expect(await kandidat(a.v.id)).toBe(true);

			await vermerkeEinladung(handelnder(betreiber), a.v.id);
			await vermerkeTraktandenliste(handelnder(betreiber), a.v.id);
			expect(await anzahl(a.v.id, EREIGNISARTEN.einladungErzeugt)).toBe(2);
			expect(await anzahl(a.v.id, EREIGNISARTEN.traktandenlisteErzeugt)).toBe(2);
			expect(await schrittEinladung(a.v.id)).toBe('erledigt');
			expect(await kandidat(a.v.id)).toBe(false);
			expect(await lauf(name)).toHaveLength(0);
			expect(await erinnert(a.v.id)).toHaveLength(0);

			// Weiter einmal je Freigabe: Ein drittes Erzeugen schreibt nichts.
			await vermerkeEinladung(handelnder(betreiber), a.v.id);
			expect(await anzahl(a.v.id, EREIGNISARTEN.einladungErzeugt)).toBe(2);
		});

		it('Gegenprobe: ohne Rücknahme vermerkt ein zweites Erzeugen nichts, und der Schritt bleibt erledigt', async () => {
			const a = await freigegeben('Erfundenhalde Einmal erzeugt', 30, 10);
			await vermerkeEinladung(handelnder(betreiber), a.v.id);
			await vermerkeEinladung(handelnder(betreiber), a.v.id);
			expect(await anzahl(a.v.id, EREIGNISARTEN.einladungErzeugt)).toBe(1);
			expect(await schrittEinladung(a.v.id)).toBe('erledigt');
		});

		it('eine Rücknahme während des Mailversands: die Marke der laufenden Mail wird nicht abgelegt', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Fenster';
			const a = await freigegeben(name, 10, 10);
			expect(await lauf(name)).toHaveLength(1);
			const beansprucht = await merkerText(a.v.id);
			expect(beansprucht).not.toBeNull();

			await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), a.v.id);
			expect(await legeMarkeAb(betreiber, a.v.id, neueMarke(), beansprucht!)).toBe(false);
			const [z] = await imKontext(
				betreiber,
				(tx) =>
					tx<{ marke: string | null }[]>`
					SELECT invitation_reminder_token_hash AS marke FROM meeting WHERE id = ${a.v.id}
				`
			);
			expect(z.marke).toBeNull();
		});

		it('Gegenprobe: ohne Rücknahme legt derselbe Merker die Marke ab', async () => {
			await setzeErinnerungsadresse(handelnder(betreiber), 'bewirtschaftung@example.ch');
			const name = 'Erfundenhalde Kein Fenster';
			const a = await freigegeben(name, 10, 10);
			expect(await lauf(name)).toHaveLength(1);
			const beansprucht = await merkerText(a.v.id);
			expect(await legeMarkeAb(betreiber, a.v.id, neueMarke(), beansprucht!)).toBe(true);
		});
	});
});
