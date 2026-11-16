/**
 * Vollmacht über den persönlichen Zugang, mit Weisung je Antrag.
 *
 * **Die vier Zusagen sind der Prüfstand:** freigeschaltet oder gar nicht;
 * bestätigt wird weiterhin von der Sitzungsleitung; der Nachweis heisst, was er
 * ist; und geändert wird nur, solange die Versammlung nicht läuft.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { holeVollmachten, bestaetigeVollmacht, holeParteien } from '$lib/server/vollmacht';
import {
	erhebeLage,
	erklaere,
	holeEmpfehlungen,
	setzeWeisungen,
	widerrufeEigene
} from '$lib/server/selbstvollmacht';
import { empfehlungsstand } from '$lib/domain/empfehlung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const WORTLAUT = 'Die Fassade wird für 240 000 Franken saniert.';

/** Eine freigegebene Versammlung mit zwei Parteien und einem Antrag. */
async function vorbereitet(name: string, datum: string, ueberZugang = true) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		proxyByAccess: ueberZugang,
		proxyByAccessSource: ueberZugang ? 'Art. 26 Reglement' : undefined
	});

	const parteien: { id: string; parteiId: string }[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 500 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push({ id: p.id, parteiId: p.id });
	}

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: WORTLAUT,
		antragstellerart: 'bewirtschaftung'
	});
	// Eine Kenntnisnahme daneben: Zu ihr darf sich keine Weisung erteilen lassen.
	const k = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Jahresbericht',
		art: 'kenntnisnahme',
		antragstellerart: 'bewirtschaftung'
	});
	await gibVersammlungFrei(handelnder(betreiber), v.id);

	// Nach der Freigabe steht die Momentaufnahme; erst dort gibt es die Zeilen,
	// an denen eine Vollmacht hängt.
	const moment = await holeParteien(betreiber, v.id);
	return {
		gemeinschaft: g.id,
		versammlung: v.id,
		traktandum: t.id,
		kenntnisnahme: k.id,
		aebi: moment.find((m) => m.name === 'Aebi')!,
		bucher: moment.find((m) => m.name === 'Bucher')!
	};
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Selbstvollmacht');
	benutzer = await pruefbenutzer(betreiber, 'selbstvollmachtleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Freischaltung', () => {
	it('ist vorgabemässig aus — und sagt, was stattdessen geht', async () => {
		const s = await vorbereitet('Zugangsweg 1', '2027-03-01', false);
		const lage = await erhebeLage(betreiber, s.versammlung, s.aebi.parteiId);

		expect(lage.erlaubt).toBe(false);
		expect(lage.grund).toMatch(/nicht freigeschaltet/i);
		// Kein blosses Nein: Der Weg auf Papier steht weiterhin offen.
		expect(lage.grund).toMatch(/Papier/);
	});

	it('weist die Erklärung auch dann ab, wenn jemand am Formular vorbei sendet', async () => {
		// Die Oberfläche zeigt den Weg gar nicht erst; hier steht dieselbe Regel
		// noch einmal, weil eine abgeschickte Anfrage nicht davon abhängen darf,
		// was eine Seite angezeigt hat (AD-6).
		const s = await vorbereitet('Zugangsweg 2', '2027-03-02', false);
		await expect(
			erklaere(betreiber, s.versammlung, s.aebi.parteiId, { bevollmaechtigtId: s.bucher.id })
		).rejects.toThrow(/nicht freigeschaltet/i);
	});

	/*
	 * **Die Absage ist auf diesem Weg knapper** (Sicherheitsprüfung vom
	 * 24.09.2026, Befund 2; die Lücke im Nachweis meldete der zweite Code-Review
	 * als Befund 8).
	 *
	 * Hier handelt eine Eigentümerin ohne Benutzerkonto und darf den Namen frei
	 * tippen. Die ausführliche Meldung der Sitzungsleitung nennt Zahl und Namen
	 * und liesse sich damit als Orakel benutzen: Wer Namen durchprobiert, erführe
	 * vor der Versammlung, wer wie viele Vollmachten hält.
	 *
	 * **Ohne diese Probe wäre der Zweig ungemessen**: Alle übrigen Proben zur
	 * Grenze laufen über den Leitungsweg und erwarten «wäre die 2.» — ein Muster,
	 * das hier gar nicht vorkommt. Wer die Bedingung umkehrte, bliebe grün.
	 */
	it('nennt auf dem Zugangsweg weder Zahl noch fremden Namen', async () => {
		const s = await vorbereitet('Zugangsweg Grenze', '2027-03-20');
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE stweg SET proxy_limit = 1, proxy_limit_rule_source = 'Reglement Ziff. 8.2'
				WHERE id = ${s.gemeinschaft}
			`
		);
		await erklaere(betreiber, s.versammlung, s.aebi.parteiId, { bevollmaechtigtName: 'Zemp' });

		const fehler = await erklaere(betreiber, s.versammlung, s.bucher.parteiId, {
			bevollmaechtigtName: 'Zemp'
		}).catch((f: unknown) => f as { nachricht?: string; message?: string });
		const text = String(
			(fehler as { nachricht?: string; message?: string }).nachricht ??
				(fehler as { message?: string }).message
		);

		expect(text).toMatch(/Ihr Reglement zulässt/);
		expect(text).toMatch(/Reglement Ziff\. 8\.2/);
		// Kein Orakel: weder die laufende Nummer noch der Name der dritten Person.
		expect(text).not.toMatch(/Zemp/);
		expect(text).not.toMatch(/\bdie 2\./);
	});

	it('verlangt beim Freischalten eine Fundstelle', async () => {
		// Wer den Beschluss anficht, greift zuerst die Form der Vollmacht an.
		await expect(
			erstelleGemeinschaft(handelnder(betreiber), {
				name: 'Ohne Fundstelle',
				quotaDenominator: 1000,
				headCountMode: 'per_owner',
				parkingCountsAsHead: false,
				parentStwegId: null,
				proxyByAccess: true
			})
		).rejects.toThrow(FachlicherFehler);
	});
});

describe('Die Erklärung über den Zugang', () => {
	it('entsteht als «erfasst» — die Sitzungsleitung bestätigt weiterhin', async () => {
		const s = await vorbereitet('Zugangsweg 3', '2027-03-03');
		const v = await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id
		});

		expect(v.zustand).toBe('erfasst');
		// **Der Nachweis heisst, was er ist.** Nicht «Original vorgelegt»: Es war
		// niemand da, dem etwas vorgelegen hätte.
		expect(v.herkunft).toBe('zugang');
		expect(v.nachweisVorgelegt).toBe(false);
		// Und im Verlauf steht die Person, nicht ein Konto der Bewirtschaftung.
		expect(v.erfasstDurch).toMatch(/Aebi.*persönlichen Zugang/);

		const [spur] = await imKontext(
			betreiber,
			(tx) => tx`SELECT actor_user_id, actor_label FROM audit_entry
			            WHERE subject_id = ${v.id} AND event_type = 'proxy.recorded'`
		);
		expect(spur.actor_user_id).toBeNull();
		expect(spur.actor_label).toMatch(/persönlichen Zugang/);
	});

	it('nimmt Weisungen im selben Vorgang entgegen', async () => {
		const s = await vorbereitet('Zugangsweg 4', '2027-03-04');
		const v = await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id,
			weisungen: [{ traktandumId: s.traktandum, wahl: 'nein' }]
		});

		const w = await holeEmpfehlungen(betreiber, v.id);
		expect(w).toHaveLength(1);
		expect(w[0].wahl).toBe('nein');
		// **Der Wortlaut wird mitgeschrieben**, nicht bloss der Verweis: Daran
		// hängt später, ob die Weisung noch gilt.
		expect(w[0].wortlaut).toBe(WORTLAUT);
	});

	it('lässt zu einer Kenntnisnahme keine Weisung zu', async () => {
		// Sie kennt kein Ja und kein Nein; eine Weisung dazu wäre eine Angabe
		// ohne Aussage.
		const s = await vorbereitet('Zugangsweg 5', '2027-03-05');
		await expect(
			erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
				bevollmaechtigtId: s.bucher.id,
				weisungen: [{ traktandumId: s.kenntnisnahme, wahl: 'ja' }]
			})
		).rejects.toThrow(/kein Antrag/i);

		// Und es bleibt nichts halb Erklärtes stehen: Der ganze Vorgang fällt weg.
		expect(await holeVollmachten(betreiber, s.versammlung)).toHaveLength(0);
	});

	it('nimmt den Wortlaut aus der Datenbank, nicht aus der Anfrage', async () => {
		// Sonst bestimmte der Absender selbst, worauf sich seine Weisung angeblich
		// bezog — und könnte sie später gegen einen anderen Antrag halten.
		const s = await vorbereitet('Zugangsweg 6', '2027-03-06');
		const v = await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id,
			weisungen: [{ traktandumId: s.traktandum, wahl: 'ja' }]
		});
		const [w] = await holeEmpfehlungen(betreiber, v.id);
		expect(w.wortlaut).toBe(WORTLAUT);
	});
});

describe('Die Weisung beim Abstimmen', () => {
	it('gilt, solange der Antrag derselbe ist', async () => {
		const s = await vorbereitet('Zugangsweg 7', '2027-03-07');
		const v = await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id,
			weisungen: [{ traktandumId: s.traktandum, wahl: 'ja' }]
		});
		const [w] = await holeEmpfehlungen(betreiber, v.id);

		const stand = empfehlungsstand(w.wahl, w.wortlaut, WORTLAUT, 'Aebi');
		expect(stand.gilt).toBe(true);
	});

	it('hält den Wortlaut fest, an dem sie später gemessen wird', async () => {
		/*
		 * **Wichtig zu wissen, wie weit dieser Prüflauf reicht.** Heute lässt sich
		 * der Wortlaut eines freigegebenen Antrags gar nicht mehr ändern:
		 * `bearbeiteTraktandum` verlangt den Zustand «Entwurf», und wer die
		 * Freigabe zurücknimmt, verliert die Momentaufnahme und mit ihr alle
		 * Vollmachten. Der Fall ist also **derzeit unerreichbar** — die Absicherung
		 * steht für Welle 3, wo Rückkommens- und Folgeanträge einen laufenden
		 * Antrag umformulieren.
		 *
		 * Geprüft wird deshalb, was heute schon trägt: dass der Wortlaut
		 * mitgeschrieben wird und der Vergleich anschlägt. Die Änderung wird dafür
		 * unmittelbar in der Datenbank gesetzt — kein Weg, den die Anwendung
		 * anbietet, und genau deshalb hier so benannt.
		 */
		const s = await vorbereitet('Zugangsweg 8', '2027-03-08');
		const v = await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id,
			weisungen: [{ traktandumId: s.traktandum, wahl: 'ja' }]
		});

		const [w] = await holeEmpfehlungen(betreiber, v.id);
		expect(w.wortlaut).toBe(WORTLAUT);

		const anders = 'Die Fassade wird für 320 000 Franken saniert.';
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE agenda_item SET motion_text = ${anders} WHERE id = ${s.traktandum}`
		);

		// Die Weisung steht unverändert da — sie trägt den alten Wortlaut …
		const [nachher] = await holeEmpfehlungen(betreiber, v.id);
		expect(nachher.wortlaut).toBe(WORTLAUT);
		// … und deshalb fällt sie beim Abstimmen sichtbar weg.
		const stand = empfehlungsstand(nachher.wahl, nachher.wortlaut, anders, 'Aebi');
		expect(stand.gilt).toBe(false);
		expect(stand.satz).toMatch(/anderen Wortlaut/);
	});
});

describe('Ändern und Zurücknehmen', () => {
	it('ersetzt die Weisungen vollständig — ein Häkchen lässt sich entfernen', async () => {
		const s = await vorbereitet('Zugangsweg 9', '2027-03-09');
		await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id,
			weisungen: [{ traktandumId: s.traktandum, wahl: 'ja' }]
		});

		const gesetzt = await setzeWeisungen(betreiber, s.versammlung, s.aebi.parteiId, []);
		expect(gesetzt).toBe(0);

		const [v] = await holeVollmachten(betreiber, s.versammlung);
		expect(await holeEmpfehlungen(betreiber, v.id)).toHaveLength(0);
	});

	it('nimmt die eigene Vollmacht zurück', async () => {
		const s = await vorbereitet('Zugangsweg 10', '2027-03-10');
		await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id
		});

		await widerrufeEigene(betreiber, s.versammlung, s.aebi.parteiId);

		const [v] = await holeVollmachten(betreiber, s.versammlung);
		expect(v.zustand).toBe('widerrufen');
		expect(v.beendetGrund).toMatch(/über den persönlichen Zugang zurückgenommen/i);
		// Und danach steht der Weg wieder offen: eine neue Vollmacht ist möglich.
		const lage = await erhebeLage(betreiber, s.versammlung, s.aebi.parteiId);
		expect(lage.eigene).toBeNull();
	});

	it('lässt während der Sitzung erteilen, aber nicht mehr zurücknehmen', async () => {
		/*
		 * **Zwei verschiedene Fristen, und der Unterschied hat einen Grund.**
		 * Erteilen geht bis zuletzt — wer um 19.05 im Stau steht, soll noch
		 * jemanden bevollmächtigen können. Zurücknehmen endet mit der Eröffnung:
		 * Danach hat die bevollmächtigte Person die Stimme vielleicht schon
		 * ausgeübt, und ein Widerruf vom Telefon zöge sie nachträglich in Zweifel.
		 */
		const s = await vorbereitet('Zugangsweg 11', '2027-03-11');
		await eroeffneVersammlung(handelnder(betreiber), s.versammlung);

		// Erteilen: geht.
		const v = await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id,
			weisungen: [{ traktandumId: s.traktandum, wahl: 'ja' }]
		});
		expect(v.zustand).toBe('erfasst');
		await bestaetigeVollmacht(handelnder(betreiber), s.versammlung, v.id);

		// Weisung ändern: geht auch, sie ist nur eine Empfehlung.
		expect(
			await setzeWeisungen(betreiber, s.versammlung, s.aebi.parteiId, [
				{ traktandumId: s.traktandum, wahl: 'nein' }
			])
		).toBe(1);

		// Zurücknehmen: nicht mehr — mit dem Weg, der stattdessen gilt.
		await expect(widerrufeEigene(betreiber, s.versammlung, s.aebi.parteiId)).rejects.toThrow(
			/Kommen Sie selbst/i
		);

		const lage = await erhebeLage(betreiber, s.versammlung, s.aebi.parteiId);
		expect(lage.aenderbar).toBe(true);
		expect(lage.widerrufbar).toBe(false);
		expect(lage.widerrufGrund).toMatch(/Kommen Sie selbst/);
		expect(lage.eigene?.zustand).toBe('bestaetigt');

		await schliesseVersammlung(handelnder(betreiber), s.versammlung);
	});

	it('lässt nach dem Schluss gar nichts mehr zu', async () => {
		const s = await vorbereitet('Zugangsweg 13', '2027-03-13');
		await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
		await schliesseVersammlung(handelnder(betreiber), s.versammlung);

		await expect(
			erklaere(betreiber, s.versammlung, s.aebi.parteiId, { bevollmaechtigtId: s.bucher.id })
		).rejects.toThrow(/nicht mehr ändern/i);

		const lage = await erhebeLage(betreiber, s.versammlung, s.aebi.parteiId);
		expect(lage.aenderbar).toBe(false);
	});
});

describe('Der Zeilenschutz', () => {
	it('zeigt einem fremden Betreiber die Weisungen nicht', async () => {
		const s = await vorbereitet('Zugangsweg 12', '2027-03-12');
		const v = await erklaere(betreiber, s.versammlung, s.aebi.parteiId, {
			bevollmaechtigtId: s.bucher.id,
			weisungen: [{ traktandumId: s.traktandum, wahl: 'ja' }]
		});

		const fremder = await pruefbetreiber('Fremd zur Selbstvollmacht');
		expect(await holeEmpfehlungen(fremder, v.id)).toHaveLength(0);
	});
});
