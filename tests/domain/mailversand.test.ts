import { describe, expect, it } from 'vitest';
import {
	adresseBrauchbar,
	betreffFuerEinladung,
	betreffFuerErinnerung,
	planeVersand,
	textFuerEinladung,
	textFuerErinnerung,
	textFuerGemeinschaft,
	versandInWorten,
	type Empfaenger,
	type Einladungstexte
} from '$lib/domain/mailversand';

const TEXTE: Einladungstexte = {
	gemeinschaft: 'STWEG Nirgendweg 3',
	datum: '11. März 2027',
	uhrzeit: '19:00',
	ort: 'Prüfsaal',
	absenderName: 'Probère Immobilien'
};

function e(teil: Partial<Empfaenger> = {}): Empfaenger {
	return {
		parteiId: 'p1',
		name: 'Aebi',
		adresse: 'aebi@example.ch',
		dateinamen: ['Zugangskarte_Aebi.pdf', 'Vollmacht_Aebi.pdf'],
		gemeinschaftlich: false,
		...teil
	};
}

describe('adresseBrauchbar', () => {
	it('nimmt gewöhnliche Adressen an', () => {
		expect(adresseBrauchbar('aebi@example.ch')).toBe(true);
		expect(adresseBrauchbar('a.b-c+d@sub.example.co.uk')).toBe(true);
	});

	it('weist ab, was keine ist', () => {
		// Der Zweck ist, Tippfehler zu fangen, bevor eine Karte ins Leere geht.
		expect(adresseBrauchbar('')).toBe(false);
		expect(adresseBrauchbar('aebi')).toBe(false);
		expect(adresseBrauchbar('aebi@example')).toBe(false);
		expect(adresseBrauchbar('aebi @example.ch')).toBe(false);
		expect(adresseBrauchbar('a@b@example.ch')).toBe(false);
	});
});

describe('planeVersand', () => {
	it('macht aus jedem Empfänger eine eigene Nachricht mit seinem eigenen Anhang', () => {
		// **Die Regel, an der alles hängt:** Der Anhang trägt einen persönlichen
		// Zugangscode. Eine Sammelmail verschenkte ihn.
		const plan = planeVersand(
			[
				e(),
				e({ parteiId: 'p2', name: 'Bucher', adresse: 'bucher@example.ch', dateinamen: ['Zugangskarte_Bucher.pdf', 'Vollmacht_Bucher.pdf'] })
			],
			TEXTE
		);

		expect(plan.nachrichten).toHaveLength(2);
		expect(plan.nachrichten[0].an).toBe('aebi@example.ch');
		expect(plan.nachrichten[0].anhaenge).toEqual([
			'Zugangskarte_Aebi.pdf',
			'Vollmacht_Aebi.pdf'
		]);
		expect(plan.nachrichten[1].an).toBe('bucher@example.ch');
		expect(plan.nachrichten[1].anhaenge).toContain('Zugangskarte_Bucher.pdf');
		// Keine Nachricht trägt den Anhang einer anderen.
		expect(new Set(plan.nachrichten.map((n) => n.anhaenge[0])).size).toBe(2);
	});

	it('nennt fehlende Adressen namentlich statt als Zahl', () => {
		// «2 ohne Adresse» hilft niemandem: Gesucht wird, wer nachzutragen ist.
		const plan = planeVersand([e(), e({ parteiId: 'p2', name: 'Bucher', adresse: '' })], TEXTE);
		expect(plan.nachrichten).toHaveLength(1);
		expect(plan.ohneAdresse).toEqual(['Bucher']);
	});

	it('meldet dieselbe Adresse für mehrere Parteien', () => {
		// Zulässig — Eheleute mit einem Postfach. Wer zwei Karten an dieselbe
		// Adresse schickt, soll das vorher wissen und nicht nachher.
		const plan = planeVersand(
			[e(), e({ parteiId: 'p2', name: 'Aebi-Bucher', adresse: 'Aebi@example.ch' })],
			TEXTE
		);
		expect(plan.nachrichten).toHaveLength(2);
		expect(plan.mehrfach).toEqual([
			{ adresse: 'aebi@example.ch', parteien: ['Aebi', 'Aebi-Bucher'] }
		]);
	});

	it('trägt Datum, Uhrzeit und Ort in den Text', () => {
		const plan = planeVersand([e()], TEXTE);
		expect(plan.nachrichten[0].betreff).toBe('STWEG Nirgendweg 3 — Versammlung vom 11. März 2027');
		expect(plan.nachrichten[0].text).toContain('11. März 2027, 19:00');
		expect(plan.nachrichten[0].text).toContain('Prüfsaal');
		expect(plan.nachrichten[0].text).toContain('Aebi');
		expect(plan.nachrichten[0].text).toContain('Probère Immobilien');
	});

	it('warnt im Text davor, die Karte weiterzugeben', () => {
		// Wer sie hat, kann in fremdem Namen abstimmen. Das gehört in die
		// Nachricht und nicht nur in ein Handbuch, das niemand liest.
		expect(textFuerEinladung(TEXTE, 'Aebi')).toMatch(/nicht weiter/);
	});

	it('nennt im Text kein Erfordernis und keine Frist', () => {
		/*
		 * Der Text begleitet die Einladung, er ersetzt sie nicht. Stünde hier eine
		 * Frist oder ein Mehrheitserfordernis, gäbe es zwei Fassungen derselben
		 * Angabe — und die eine könnte der anderen widersprechen.
		 */
		const text = textFuerEinladung(TEXTE, 'Aebi');
		expect(text).not.toMatch(/Frist|Mehrheit|Quorum|Anfechtung/);
	});

	it('lässt den Betreff bei allen gleich', () => {
		expect(betreffFuerEinladung(TEXTE)).toBe(betreffFuerEinladung(TEXTE));
	});

	it('warnt bei gemeinschaftlichem Eigentum gerade nicht vor dem Weitergeben', () => {
		/*
		 * **Der Einwand** (Auftraggeber, 27.08.2026): «Die Karte gilt nur für Sie. Geben
		 * Sie sie nicht weiter» ist hier falsch. Sie gilt für alle Beteiligten,
		 * und weitergeben ist genau der vorgesehene Weg, wenn die eine Person
		 * nicht kann. Sein Wortlaut für diesen Fall: «Die Karte gilt nur für die
		 * Einheit.»
		 */
		const plan = planeVersand([e({ name: 'Beat Muster', gemeinschaftlich: true })], TEXTE);
		expect(plan.nachrichten[0].text).toContain('Die Karte gilt nur für die Einheit.');
		expect(plan.nachrichten[0].text).not.toMatch(/nicht weiter/);
		expect(plan.nachrichten[0].gemeinschaftlich).toBe(true);
	});

	it('behält für den Alleineigentümer den bisherigen Satz', () => {
		// Zwei Fassungen, nicht eine geänderte: Dort trägt der Satz die Warnung,
		// und die ist dort richtig.
		const plan = planeVersand([e()], TEXTE);
		expect(plan.nachrichten[0].text).toContain('Die Karte gilt nur für Sie.');
		expect(plan.nachrichten[0].text).toMatch(/nicht weiter/);
		expect(plan.nachrichten[0].gemeinschaftlich).toBe(false);
	});

	it('nennt im gemeinschaftlichen Text keinen Namen einer einzelnen Person', () => {
		// Wer die Stimme abgibt, entscheidet sich am Abend. Ein Name hier
		// behauptete eine Rangordnung, die ZGB Art. 712o nicht kennt.
		const text = textFuerGemeinschaft(TEXTE, 'Beat Muster');
		expect(text.replace('Guten Tag Beat Muster', '')).not.toContain('Beat Muster');
	});

	it('trägt Datum, Uhrzeit und Ort auch in den gemeinschaftlichen Text', () => {
		const text = textFuerGemeinschaft(TEXTE, 'Beat Muster');
		expect(text).toContain('11. März 2027, 19:00');
		expect(text).toContain('Prüfsaal');
		expect(text).toContain('Beat Muster');
		expect(text).toContain('Probère Immobilien');
	});

	it('nennt auch im gemeinschaftlichen Text kein Erfordernis und keine Frist', () => {
		const text = textFuerGemeinschaft(TEXTE, 'Beat Muster');
		expect(text).not.toMatch(/Frist|Mehrheit|Quorum|Anfechtung/);
	});

	it('trägt die Folge der Uneinigkeit nicht in die Begleitmail', () => {
		// Sie steht in der Einladung (`gemeinschaftssatz`), nicht neben der Karte.
		const text = textFuerGemeinschaft(TEXTE, 'Beat Muster');
		expect(text).not.toMatch(/ungültig|Enthaltung|uneinig/);
	});
});

describe('versandInWorten', () => {
	it('sagt bei lauter Erfolgen die Zahl', () => {
		const gut = { parteiId: 'p', name: 'A', an: 'a@example.ch', zugestellt: true, grund: null };
		expect(versandInWorten([gut, { ...gut, parteiId: 'q' }])).toBe('2 Nachrichten verschickt.');
		expect(versandInWorten([gut])).toBe('Eine Nachricht verschickt.');
	});

	it('verweist bei gemischtem Ausgang auf die Namen', () => {
		// «12 von 14» lässt offen, welche zwei fehlen — und das ist die Auskunft,
		// die gebraucht wird.
		const satz = versandInWorten([
			{ parteiId: 'p', name: 'A', an: 'a@example.ch', zugestellt: true, grund: null },
			{ parteiId: 'q', name: 'B', an: 'b@example.ch', zugestellt: false, grund: 'abgelehnt' }
		]);
		expect(satz).toMatch(/1 verschickt, 1 nicht/);
		expect(satz).toMatch(/namentlich/);
	});

	it('beschönigt einen Totalausfall nicht', () => {
		const satz = versandInWorten([
			{ parteiId: 'p', name: 'A', an: 'a@example.ch', zugestellt: false, grund: 'kein Server' }
		]);
		expect(satz).toMatch(/konnte nicht verschickt werden/);
	});
});

describe('Der Link in der Erinnerung', () => {
	const texte = {
		gemeinschaft: 'STWEG Sonnenhof',
		datum: '3. September 2026',
		uhrzeit: '19:00',
		ort: 'Saal',
		frist: '14. August 2026',
		tage: 20,
		fundstelle: 'Reglement Ziff. 12',
		absenderName: 'Bewirtschaftung Muster',
		bestaetigungslink: 'https://beispiel.invalid/b/AbCdEf'
	};

	// Seit den Restpunkten Runde 1 (06.10.2026) steht das Eingeständnis im
	// Einstieg; der Link folgt dem Satz, der sagt, wann vermerkt wird.
	it('steht beim Satz zum Selbstversand, nicht am Schluss', () => {
		const text = textFuerErinnerung(texte, false);
		const gestaendnis = text.indexOf('Haben Sie die Einladung ausserhalb der Anwendung verschickt');
		const link = text.indexOf('https://beispiel.invalid/b/AbCdEf');
		const schluss = text.indexOf('Diese Erinnerung geht einmal je Versammlung');
		expect(gestaendnis).toBeGreaterThan(-1);
		expect(link).toBeGreaterThan(gestaendnis);
		expect(link).toBeLessThan(schluss);
	});

	/*
	 * **Ohne eigene Adresse kein Link — und trotzdem eine vollständige Nachricht**
	 * (02.09.2026). Ein Link auf `undefined/b/…` wäre schlimmer als keiner: Er
	 * sähe aus, als hätte der Empfänger etwas falsch gemacht.
	 */
	it('fehlt ganz, wenn die Anwendung ihre Adresse nicht kennt', () => {
		const text = textFuerErinnerung({ ...texte, bestaetigungslink: null }, false);
		expect(text).not.toContain('/b/');
		expect(text).not.toContain('undefined');
		// Die Nachricht bleibt vollständig, und sie sagt, wo der Vermerk geht.
		expect(text).toContain('sieht die Anwendung keine erzeugte Einladung');
		// Hakenname seit dem Produktentscheid 07.10.2026; gegen den Stand davor rot.
		expect(text).toContain(
			'Dafür setzen Sie auf der Seite Vorbereitung der Versammlung den Haken «Die Einladung ' +
				'ist verschickt»; dann erinnert die Anwendung an diese Einladung nicht mehr.'
		);
		expect(text).not.toContain('Dafür genügt dieser Link');
		expect(text).toContain('Diese Erinnerung geht einmal je Versammlung.');
	});

	/*
	 * **Was die Anwendung sieht, nicht ein Versand** (Laien- und Fachprüfung
	 * Restpunkte Runde 1, 06.10.2026; Rz. 24a, 26, 30, 66 bis 68 ad Art. 712n).
	 * Der ganze Text vor und nach Ablauf.
	 *
	 * **Vermerkt wird der Versand, der Empfang liegt bei der Sitzungsleitung**
	 * (Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»). Gegen den
	 * Stand davor rot: Dort stand «vermerken Sie das, sobald sie bei allen
	 * angekommen ist. Verschickt allein genügt nicht».
	 */
	it('vor und nach Ablauf: Einstieg, Folgen, Vermerk nach dem Versand, Verantwortung', () => {
		const regel =
			'Erfasst ist eine Einberufungsfrist von 20 Tagen (Reglement Ziff. 12). Die Anwendung ' +
			'rechnet vorsichtig damit, dass die Einladung bis zum 14. August 2026 bei allen ist; ' +
			'rechnet Ihr Reglement ab Versand, gilt dessen Regel.';
		const folgen =
			'Zu spät heisst: nach der Frist Ihres Reglements oder, nennt es keine, zu knapp, um sich ' +
			'vorzubereiten und teilzunehmen. Kommt die Einladung zu spät, aber vor der Versammlung ' +
			'an, kann ein Beschluss angefochten werden. Kommt sie erst nach dem Versammlungstag oder ' +
			'gar nicht, kann er nichtig sein.';
		const kopf = ['    Versammlung   3. September 2026, 19:00, Saal', '    Bei allen bis 14. August 2026', ''];
		const link = (abgelaufen: boolean) => [
			'',
			'Dafür genügt dieser Link; dann erinnert die Anwendung an diese Einladung',
			'nicht mehr:',
			'',
			'    https://beispiel.invalid/b/AbCdEf',
			'',
			// Seit Runde 1 (Laienprüfung 10, 07.10.2026) `VERANTWORTUNG`.
			(abgelaufen ? 'Ob die Einladung rechtzeitig bei allen war, sagt der Vermerk nicht. ' : '') +
				'Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.',
			'',
			'Diese Erinnerung geht einmal je Versammlung. Wird danach das Mehr eines Traktandums ' +
				'milder oder die Freigabe zurückgenommen, kommt eine weitere.',
			'',
			'Freundliche Grüsse',
			'Bewirtschaftung Muster'
		];
		expect(textFuerErinnerung(texte, false)).toBe(
			[
				'Guten Tag',
				'',
				'für die Versammlung der STWEG Sonnenhof sieht die Anwendung keine erzeugte Einladung. ' +
					'Es ist auch nicht vermerkt, dass die Einladung verschickt ist.',
				'',
				...kopf,
				regel,
				`${folgen} Die Post braucht Zeit, ins Ausland länger. Kommt die Einladung nicht mehr ` +
					'rechtzeitig bei allen an, ist ein neuer Versammlungstermin der sichere Weg.',
				'',
				'Haben Sie die Einladung ausserhalb der Anwendung verschickt, vermerken Sie das.',
				...link(false)
			].join('\n')
		);
		expect(textFuerErinnerung(texte, true)).toBe(
			[
				'Guten Tag',
				'',
				'der letzte Tag für die Einladung zur Versammlung der STWEG Sonnenhof ist vorbei. Die ' +
					'Anwendung sieht keine erzeugte Einladung, und es ist auch nicht vermerkt, dass die ' +
					'Einladung verschickt ist.',
				'',
				...kopf,
				regel,
				`${folgen} In beiden Fällen ist ein neuer Termin der sichere Weg.`,
				'',
				'Haben Sie die Einladung ausserhalb der Anwendung verschickt, vermerken Sie das.',
				...link(true)
			].join('\n')
		);
		// Der Betreff behauptet keinen Versand, vor und nach Ablauf.
		expect(betreffFuerErinnerung(texte, false)).toBe(
			'Erinnerung: Einladung STWEG Sonnenhof, Versammlung vom 3. September 2026'
		);
		expect(betreffFuerErinnerung(texte, true)).toBe(
			'Einberufungsfrist abgelaufen: Einladung STWEG Sonnenhof, Versammlung vom 3. September 2026'
		);
	});

	/*
	 * **Vor Ablauf keine Pflicht aus der erfassten Tageszahl** (Fachprüfung
	 * Restpunkte Runde 2, 06.10.2026): «sie muss bis zum … bei allen sein»
	 * machte die Regel der Anwendung zur Pflicht. **Nach Ablauf, was der Vermerk
	 * nicht sagt** (Laienprüfung Restpunkte Runde 2), wie die Fristwarnung.
	 *
	 * **Kein Empfang verlangt, in jeder Lage** (Produktentscheid 07.10.2026):
	 * weder «Verschickt allein genügt nicht» noch «sobald sie bei allen
	 * angekommen ist»; dafür der Satz zur Verantwortung. Gegen den Stand davor
	 * rot.
	 */
	it('vor Ablauf ohne «muss bis zum», nach Ablauf mit dem, was der Vermerk nicht sagt', () => {
		for (const link of [texte.bestaetigungslink, null]) {
			const vor = textFuerErinnerung({ ...texte, bestaetigungslink: link }, false);
			const nach = textFuerErinnerung({ ...texte, bestaetigungslink: link }, true);
			expect(vor).not.toMatch(/muss bis zum/);
			expect(nach).toContain(
				'Ob die Einladung rechtzeitig bei allen war, sagt der Vermerk nicht. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.'
			);
			expect(vor).toContain('Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.');
			for (const t of [vor, nach]) expect(t).not.toContain('Sitzungsleitung');
			for (const t of [vor, nach]) {
				expect(t).not.toContain('genügt nicht');
				expect(t).not.toContain('angekommen');
			}
		}
	});

	it('jeder Satz der gewöhnlichen Erinnerung bleibt unter 180 Zeichen, auch mit langem Namen', () => {
		const lang = {
			...texte,
			gemeinschaft: 'Stockwerkeigentümergemeinschaft Erfundenweg 12',
			frist: '30. September 2026',
			fundstelle: 'Reglement nennt keine Frist'
		};
		for (const abgelaufen of [false, true]) {
			for (const bestaetigungslink of [lang.bestaetigungslink, null]) {
				const saetze = textFuerErinnerung({ ...lang, bestaetigungslink }, abgelaufen)
					.split('\n')
					.filter((z) => z.trim() !== '' && !z.startsWith('    '))
					.map((z) => z.replace(/(\d)\.(?= [A-ZÄÖÜ][a-zäöü]+ \d{4})/g, '$1·'))
					.flatMap((z) => z.split(/(?<=[.?])\s+/));
				for (const satz of saetze) expect(satz.length, satz).toBeLessThanOrEqual(180);
			}
		}
	});

	it('steht auch in der Fassung nach Fristablauf', () => {
		expect(textFuerErinnerung(texte, true)).toContain('https://beispiel.invalid/b/AbCdEf');
	});
});

/*
 * **Die Erinnerung nach einer Milderung des Mehrs** (Produktentscheid
 * 06.10.2026, «Ja, erneut erinnern»; Wortlaut nach drei Runden Laien-, Fach-
 * und Codeprüfung, 06.10.2026).
 */
describe('Die Erinnerung nach einer Milderung', () => {
	const texte = {
		gemeinschaft: 'STWEG Erfundenweg 99',
		datum: '3. September 2026',
		uhrzeit: '19:00',
		ort: 'Saal',
		frist: '14. August 2026',
		tage: 20,
		fundstelle: 'Reglement Ziff. 12',
		absenderName: 'Bewirtschaftung Probe',
		bestaetigungslink: 'https://beispiel.invalid/b/AbCdEf',
		gemildert: ['3 Sanierung der Fassade'],
		vorbereitungslink: 'https://beispiel.invalid/versammlungen/v-1/vorbereitung'
	};

	const LAGE = [
		'Guten Tag',
		'',
		'seit der Freigabe ist an der Versammlung der STWEG Erfundenweg 99 das Mehr eines ' +
			'Traktandums milder geworden. Betroffen ist: «3 Sanierung der Fassade». Eine Einladung, ' +
			'die schon verschickt ist, nennt noch das strengere. Wer es geändert hat, steht im ' +
			'Verlauf der Versammlung.',
		'',
		'    Versammlung   3. September 2026, 19:00, Saal',
		'    Bei allen bis 14. August 2026',
		''
	];
	const SCHLUSS = [
		'Diese Erinnerung geht nach jeder Milderung einmal.',
		'',
		'Freundliche Grüsse',
		'Bewirtschaftung Probe'
	];
	const KLICKS =
		'Klicken Sie in der Traktandenliste auf das Traktandum und dann auf «Erfordernis ändern».';
	// Erst zurückstellen, dann der Haken, auch wenn sie schon verschickt ist
	// (Laienprüfung Restpunkte Runde 1, B6, Codeprüfung G2, 06.10.2026); seit dem
	// Produktentscheid 07.10.2026 «verschickt» statt «bei allen».
	const HAKEN_BISHER =
		'Haben Sie das Mehr zurückgestellt, setzen Sie auf der Seite Vorbereitung den Haken; er gilt ' +
		'dann für die bisherige Einladung. Setzen Sie ihn, sobald sie verschickt ist; ist sie das ' +
		'schon, gleich.';
	/*
	 * **Haken nach dem Versand, das mildere Mehr auch ohne Haken**
	 * (Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»). Bis dahin
	 * hiess es «Sobald sie bei allen ist, setzen Sie … den Haken «Die Einladung
	 * ist bei allen angekommen»», und ein Satz sagte, im Saal öffne die
	 * Anwendung die Abstimmung erst nach dem Zurückstellen.
	 */
	const HAKEN =
		'Ist sie verschickt, setzen Sie auf der Seite Vorbereitung den Haken «Die Einladung ist ' +
		'verschickt» (unten auf der Seite). Dann entfällt der Hinweis dort.';
	// Die Warnung im Saal unabhängig vom Haken (Laienprüfung 3, Runde 1, 07.10.2026).
	const AUFMERKSAM =
		'Die Anwendung nimmt das mildere Mehr auch ohne Haken; sie macht nur aufmerksam. Im Saal ' +
		'steht trotzdem eine Warnung beim Traktandum, solange das Mehr dort milder ist als in der ' +
		'Einladung vor der Milderung.';
	const V = 'Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.';
	const LINK = [
		'Ist die berichtigte Einladung verschickt, können Sie das auch über diesen Link bestätigen:',
		'',
		'    https://beispiel.invalid/b/AbCdEf',
		''
	];

	it('nennt im Betreff die berichtigte Einladung, vor und nach Fristablauf', () => {
		expect(betreffFuerErinnerung(texte, false)).toBe(
			'Berichtigte Einladung nötig: STWEG Erfundenweg 99, Versammlung vom 3. September 2026'
		);
		expect(betreffFuerErinnerung(texte, true)).toBe(
			'Frist für die berichtigte Einladung abgelaufen: STWEG Erfundenweg 99, Versammlung vom 3. September 2026'
		);
	});

	it('vor Fristablauf: Lage, Tag, Postweg, Verantwortung, Haken, Adresse, Rückweg, Link', () => {
		const text = textFuerErinnerung(texte, false);
		expect(text).toBe(
			[
				...LAGE,
				// Mit der Folge (Produktentscheid 07.10.2026 «1a»); gegen den Stand davor rot.
				'Für das mildere Mehr sollte eine berichtigte Einladung an alle gehen. Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden. ' +
					'Schicken Sie sie so, ' +
					'dass sie spätestens am 14. August 2026 bei allen ist. Per Post reicht dafür jetzt in ' +
					'der Regel nur noch A-Post innerhalb der Schweiz; für Adressen im Ausland reicht auch sie ' +
					`meist nicht. ${V}`,
				'',
				HAKEN,
				'',
				'    https://beispiel.invalid/versammlungen/v-1/vorbereitung',
				'',
				AUFMERKSAM,
				'',
				'Reicht die Zeit nicht, bleiben Sie beim Mehr der bisherigen Einladung; dann braucht es ' +
					`keine berichtigte. Stellen Sie das Mehr dafür zurück: ${KLICKS} ${HAKEN_BISHER}`,
				'',
				...LINK,
				...SCHLUSS
			].join('\n')
		);
		// Die Spalte der Werte steht in beiden Zeilen gleich.
		const zeilen = text.split('\n');
		const v = zeilen.find((z) => z.includes('Versammlung   '))!;
		const b = zeilen.find((z) => z.includes('Bei allen bis'))!;
		expect(v.indexOf('3. September')).toBe(b.indexOf('14. August'));
	});

	/*
	 * **Kein Rückfall, kein Empfang als Bedingung, in jeder Fassung**
	 * (Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»). Gegen den
	 * Stand davor rot: Vor Ablauf stand «nimmt die Anwendung beim Eröffnen
	 * wieder das Mehr der bisherigen Einladung», nach Ablauf «Bis dahin ist kein
	 * gültiger Vermerk eingegangen» und kein Link.
	 */
	it('in jeder Fassung ohne Rückfall und ohne Empfang als Bedingung, mit Link und Verantwortung', () => {
		for (const gemildert of [['3 Sanierung der Fassade'], ['3 Sanierung der Fassade', '5 Lift']]) {
			for (const abgelaufen of [false, true]) {
				for (const postlage of [null, 'knapp', 'zu_spaet'] as const) {
					const t = textFuerErinnerung({ ...texte, gemildert, postlage }, abgelaufen);
					const was = `${gemildert.length}, ${abgelaufen}, ${postlage}`;
					expect(t, was).not.toContain('beim Eröffnen');
					expect(t, was).not.toContain('gültiger Vermerk');
					expect(t, was).not.toContain('angekommen');
					expect(t, was).not.toContain('Halten Sie fest');
					expect(t, was).not.toContain('öffnet die Anwendung die Abstimmung');
					expect(t, was).toContain('«Die Einladung ist verschickt»');
					expect(t, was).toContain('Die Anwendung nimmt das mildere Mehr auch ohne Haken');
					expect(t, was).toContain(V);
					expect(t, was).not.toContain('Sitzungsleitung');
					expect(t, was).toContain(
						'Für das mildere Mehr sollte eine berichtigte Einladung an alle gehen.'
					);
					expect(t, was).not.toContain('braucht es eine berichtigte');
					// Die Folge beim Baustein nur vor Fristablauf (Produktentscheid «1a»).
					expect(t.includes('Kommt sie nicht rechtzeitig bei allen an'), was).toBe(!abgelaufen);
					expect(t, was).toContain(
						'auch über diesen Link bestätigen:\n\n    https://beispiel.invalid/b/AbCdEf'
					);
				}
			}
		}
	});

	it('am letzten Fristtag: keine Post mehr, sondern von Hand oder ein anderer Weg', () => {
		const text = textFuerErinnerung(
			{ ...texte, fristtag: true, postZuSpaet: true, postlage: 'zu_spaet' },
			false
		);
		expect(text).toContain(
			'bei allen ist. Heute ist der letzte Tag. Per Post kommt sie nicht mehr bis zum letzten Tag ' +
				'der erfassten Frist an. Es ' +
				'bleibt die Übergabe von Hand oder ein anderer Weg, den Ihr Reglement erlaubt; schreibt ' +
				'es keine Form vor, geht auch E-Mail.'
		);
		// «schriftlich» im Reglement: nicht am letzten Moment klären, sondern von Hand
		// (Laienprüfung Korrekturrunde, Punkt 2).
		expect(text).toContain('Verlangt es «schriftlich» und ist nicht geklärt, ob E-Mail genügt, übergeben Sie');
		expect(text).not.toContain('klären Sie vorher');
		// Kein Nachweis des Empfangs mehr (Produktentscheid 07.10.2026); bis dahin
		// «Halten Sie fest, dass sie bei allen ankam. Sonst stellen Sie das Mehr zurück.».
		expect(text).toContain(
			`übergeben Sie sie von Hand. ${V}`
		);
		expect(text).not.toContain('Halten Sie fest');
		expect(text).not.toContain('kaum noch');
		expect(text).not.toContain('A-Post');
	});

	it('am Samstag vor einer Frist am Montag: milder, ohne «Heute ist der letzte Tag»', () => {
		const text = textFuerErinnerung(
			{ ...texte, fristtag: false, postZuSpaet: true, postlage: 'knapp' },
			false
		);
		// Am Samstag kann A-Post noch ankommen, sicher ist es nicht (Laienprüfung Nachtrag 2).
		expect(text).toContain(
			'bei allen ist. Per Post kommt sie kaum noch bis zum letzten Tag der erfassten Frist an. ' +
				'Sicherer ist'
		);
		expect(text).toContain('Verlangt es «schriftlich» und ist nicht geklärt, ob E-Mail genügt');
		expect(text).not.toContain('nicht mehr rechtzeitig');
		expect(text).not.toContain('Heute ist der letzte Tag');
		expect(text).not.toContain('A-Post');
	});

	it('an einem anderen Tag vor der Frist streng, auch ohne Postlage nie mild', () => {
		// Sonntag oder Feiertag davor: streng, ohne «Heute ist der letzte Tag»
		// (Fachprüfung Korrekturrunde). Ohne `postlage` (alter Aufrufer) ebenso.
		for (const t of [
			{ ...texte, fristtag: false, postZuSpaet: true, postlage: 'zu_spaet' as const },
			{ ...texte, fristtag: false, postZuSpaet: true }
		]) {
			const text = textFuerErinnerung(t, false);
			expect(text).toContain(
				'bei allen ist. Per Post kommt sie nicht mehr bis zum letzten Tag der erfassten Frist an. ' +
					'Es bleibt'
			);
			expect(text).not.toContain('kaum noch');
			expect(text).not.toContain('Heute ist der letzte Tag');
		}
	});

	it('die erfasste Frist wird nicht dem Reglement zugeschrieben und zählt bis zum Empfang', () => {
		// Codeprüfung M1, Korrekturrunde: Erfasst sein kann auch der Rat von zehn
		// Tagen. Produktentscheid «Jetzt richtigstellen»: bei allen, nicht versandt.
		const text = textFuerErinnerung({ ...texte, gemildert: [] }, false);
		expect(text).toContain('Erfasst ist eine Einberufungsfrist von');
		// «zu spät» und «fehlt» getrennt, vor Ablauf ebenso wie nach (Fachprüfung
		// Restpunkte Runde 1, B1 und B4, 06.10.2026); der ganze Wortlaut steht in
		// der Probe «vor und nach Ablauf» oben.
		// Bis zum Empfang als vorsichtige Regel der Anwendung, nicht als Rechtslage
		// (Produktentscheid «Als Regel der Anwendung», Fachprüfung Runde 3).
		expect(text).toMatch(/rechnet vorsichtig damit, dass die Einladung bis zum .+ bei allen ist/);
		expect(text).toContain('rechnet Ihr Reglement ab Versand, gilt dessen Regel.');
		expect(text).toContain('zu knapp, um sich vorzubereiten und teilzunehmen.');
		expect(text).not.toContain('nach der Regel Ihres Reglements');
		// Auch vor Ablauf die Nichtigkeit (Fachprüfung Restpunkte Runde 1: ohne
		// sie las sich die Mail lockerer, als die Lage ist).
		expect(text).toContain('Kommt sie erst nach dem Versammlungstag oder gar nicht, kann er nichtig sein.');
		// Fachprüfung Runde 4: keine erfasste Zahl als Grenze der Anfechtbarkeit.
		expect(text).not.toContain('gelten die erfassten Tage');
		// Ein Hinweis auf das Postlaufrisiko, keine Frist für die Post
		// (Produktentscheid 06.10.2026); nach Ablauf nicht mehr.
		expect(text).toContain(
			'Die Post braucht Zeit, ins Ausland länger. Kommt die Einladung nicht mehr rechtzeitig ' +
				'bei allen an, ist ein neuer Versammlungstermin der sichere Weg.'
		);
		expect(textFuerErinnerung({ ...texte, gemildert: [] }, true)).not.toContain('Die Post braucht Zeit');
		expect(text).toContain('    Bei allen bis ');
		expect(text).not.toContain('Versandfrist');
		expect(text).not.toContain('Das Reglement verlangt');
		expect(text).not.toContain('anfechtbar');
		const ab = textFuerErinnerung({ ...texte, gemildert: [] }, true);
		// Nach Ablauf derselbe Wortlaut, dann der neue Termin (Fachprüfung Runde 1,
		// B1; Restpunkte Runde 1, B1; Rz. 66 bis 68 ad Art. 712n).
		expect(ab).toContain(
			'Kommt sie erst nach dem Versammlungstag oder gar nicht, kann er nichtig sein. In beiden ' +
				'Fällen ist ein neuer Termin der sichere Weg.'
		);
		expect(ab).not.toContain('nach der Regel Ihres Reglements');
		expect(ab).not.toContain('Versandfrist');
		expect(ab).not.toContain('anfechtbar');
		expect(betreffFuerErinnerung({ ...texte, gemildert: [] }, true)).toMatch(/^Einberufungsfrist abgelaufen:/);
	});

	it('in der Mehrzahl: jedes betroffene Traktandum, erst alle zurückgestellt ersparen die Einladung', () => {
		const zwei = { ...texte, gemildert: ['3 Sanierung der Fassade', '5 Ersatz der Briefkästen'] };
		const vor = textFuerErinnerung(zwei, false);
		// Erst die Handlung, dann die Folge (Laienprüfung Nachtrag 2): «zurückgestellt»
		// vor der Anleitung las sich als «vertagt».
		expect(vor).toContain(
			'Reicht die Zeit nicht, bleiben Sie beim Mehr der bisherigen Einladung. Stellen Sie dafür ' +
				'das Mehr jedes betroffenen Traktandums zurück: Klicken Sie in der Traktandenliste auf ' +
				'jedes betroffene Traktandum und dann auf «Erfordernis ändern». Dann braucht es keine ' +
				'berichtigte.'
		);
		expect(vor).not.toContain('Traktanden zurückgestellt');
		/*
		 * **Saalsatz und Haken-Satz in der Mehrzahl** (Codeprüfung Restpunkte
		 * Runde 1, G1 und G2, 06.10.2026). Seit dem Produktentscheid 07.10.2026
		 * macht der Saalsatz nur aufmerksam, statt das Öffnen der Abstimmung an
		 * das Zurückstellen zu binden; gegen den Stand davor rot.
		 */
		for (const t of [vor, textFuerErinnerung(zwei, true)]) {
			expect(t).toContain(
				'Die Anwendung nimmt das mildere Mehr auch ohne Haken; sie macht nur aufmerksam. Im Saal ' +
					'steht trotzdem eine Warnung bei jedem dieser Traktanden, solange das Mehr dort milder ' +
					'ist als in der Einladung vor der Milderung.'
			);
			expect(t).not.toContain('beim Traktandum');
			expect(t).toContain(
				'Haben Sie das Mehr überall zurückgestellt, setzen Sie auf der Seite Vorbereitung den ' +
					'Haken; er gilt dann für die bisherige Einladung. Setzen Sie ihn, sobald sie verschickt ' +
					'ist; ist sie das schon, gleich.'
			);
		}
		const nach = textFuerErinnerung(zwei, true);
		expect(nach).toContain(
			'Wollen Sie beim Mehr der bisherigen Einladung bleiben, stellen Sie es überall zurück. ' +
				'Klicken Sie in der Traktandenliste auf jedes betroffene Traktandum'
		);
		// Kein doppeltes «jedes betroffene Traktandum» (Runde 1, Punkt 11).
		expect(nach.split('jedes betroffene Traktandum').length - 1).toBe(1);
		// Auch der Verschiebeweg in der Mehrzahl (Codeprüfung N1, Nachtrag); seit
		// dem Produktentscheid 07.10.2026 als «der sichere Weg».
		expect(nach).toContain(
			'Der sichere Weg zum milderen Mehr: Verschieben Sie die betroffenen Traktanden und laden ' +
				'Sie mit voller Frist neu ein. Hat jemand eines davon verlangt, entscheidet über dessen ' +
				'Verschiebung die Versammlung (Ordnungsantrag, in der Regel einfaches Mehr). Lehnt sie die ' +
				'Verschiebung ab, lassen Sie über dieses Traktandum an der Versammlung mit dem Mehr der ' +
				'Einladung abstimmen. Die ganze Versammlung verschieben Sie nicht, wenn ein Fünftel der ' +
				'Eigentümer sie verlangt hat'
		);
		expect(nach).not.toContain('Verschieben Sie das Traktandum');
	});

	it('vor Fristablauf ohne bekannte Adresse: weder Link noch Adresse der Seite', () => {
		const text = textFuerErinnerung(
			{ ...texte, bestaetigungslink: null, vorbereitungslink: null },
			false
		);
		expect(text).not.toContain('https://');
		expect(text).not.toContain('über diesen Link');
		expect(text).toContain('(unten auf der Seite). Dann entfällt der Hinweis dort.\n\nDie Anwendung nimmt');
	});

	/*
	 * **Nach Fristablauf: aufmerksam machen, mit Link** (Produktentscheid
	 * 07.10.2026, «Nur noch aufmerksam machen»). Gegen den Stand davor rot: Dort
	 * stand «Bis dahin ist kein gültiger Vermerk eingegangen. Die Anwendung
	 * nimmt beim Eröffnen deshalb wieder das Mehr der bisherigen Einladung», und
	 * die Mail trug keinen Link.
	 */
	/*
	 * **Bedingt** (Fachprüfung B1, Runde 1, 07.10.2026): Die Mail nach Fristablauf
	 * kommt auch, wenn die berichtigte Einladung rechtzeitig hinausging und nur
	 * der Haken fehlt, etwa wenn der Zeitgeber am Erinnerungstag nicht lief.
	 * Gegen den Stand davor rot: Dort hiess es unbedingt «Sie kann jetzt nicht
	 * mehr rechtzeitig ankommen».
	 */
	it('nach Fristablauf: bedingt nicht mehr rechtzeitig, anfechtbar, trotzdem schicken oder bleiben, mit Link', () => {
		const text = textFuerErinnerung(texte, true);
		expect(text).toBe(
			[
				...LAGE,
				'Für das mildere Mehr sollte eine berichtigte Einladung an alle gehen. Der letzte Tag der ' +
					'erfassten Einberufungsfrist war der 14. August 2026. Ist die berichtigte Einladung noch ' +
					// Codeprüfung Block B, N3: wie Hinweis und Linkseite; gegen den Stand davor rot.
					'nicht verschickt, kommt sie nach dieser Frist nicht mehr rechtzeitig an. War sie am 14. August 2026 nicht ' +
					'bei allen, kann ein Beschluss mit dem milderen Mehr angefochten werden. ' +
					V,
				'',
				// Der erste Weg als Bedingung und eigener Absatz (Laienprüfung Runde 2,
				// N5, 07.10.2026); gegen den Stand davor rot.
				'Wenn Sie sie trotzdem schicken, wissen alle vom milderen Mehr; das Anfechtungsrisiko bleibt.',
				'',
				HAKEN,
				'',
				'    https://beispiel.invalid/versammlungen/v-1/vorbereitung',
				'',
				AUFMERKSAM,
				'',
				`Wollen Sie beim Mehr der bisherigen Einladung bleiben, stellen Sie es zurück: ${KLICKS} ${HAKEN_BISHER}`,
				'',
				'Der sichere Weg zum milderen Mehr: Verschieben Sie das Traktandum und laden Sie mit voller ' +
					'Frist neu ein. Hat jemand das Traktandum verlangt, entscheidet über die Verschiebung die ' +
					'Versammlung (Ordnungsantrag, in der Regel einfaches Mehr). Lehnt sie die Verschiebung ' +
					'ab, lassen Sie an der Versammlung mit dem Mehr der Einladung abstimmen. Die ganze ' +
					'Versammlung verschieben Sie nicht, wenn ein Fünftel der Eigentümer sie verlangt hat, ' +
					'und sonst nur aus wichtigem Grund.',
				'',
				...LINK,
				...SCHLUSS
			].join('\n')
		);
		expect(text).not.toContain('Wollen Sie doch');
		expect(text).not.toContain('entfällt diese Erinnerung');
	});

	it('nennt mehrere Traktanden in der Mehrzahl', () => {
		const text = textFuerErinnerung(
			{ ...texte, gemildert: ['3 Sanierung der Fassade', '5 Ersatz der Briefkästen'] },
			false
		);
		expect(text).toContain(
			'das Mehr mehrerer Traktanden milder geworden. Betroffen sind: «3 Sanierung der Fassade», ' +
				'«5 Ersatz der Briefkästen».'
		);
		expect(text).not.toContain('eines Traktandums');
	});

	it('jeder Satz aller Fassungen bleibt unter 180 Zeichen, auch mit langem Namen', () => {
		const lang = {
			...texte,
			gemeinschaft: 'Stockwerkeigentümergemeinschaft Erfundenweg 12',
			frist: '30. September 2026',
			gemildert: ['3 Sanierung der Fassade', '4 Ersatz der Briefkästen']
		};
		for (const [abgelaufen, fristtag, postZuSpaet] of [
			[false, false, false],
			[false, true, true],
			[false, false, true],
			[true, false, false]
		] as const) {
			// Je Absatz, Satzende nur Punkt oder Fragezeichen: Ein Doppelpunkt
			// beendet keinen Satz, sonst misst die Probe zu kurz.
			const saetze = textFuerErinnerung(
				{ ...lang, fristtag, postZuSpaet, postlage: postZuSpaet ? (fristtag ? 'zu_spaet' : 'knapp') : null },
				abgelaufen
			)
				.split('\n')
				.filter((z) => z.trim() !== '' && !z.startsWith('    '))
				// Der Punkt im Datum («30. September 2026») ist kein Satzende; gleich lang ersetzt.
				.map((z) => z.replace(/(\d)\.(?= [A-ZÄÖÜ][a-zäöü]+ \d{4})/g, '$1·'))
				.flatMap((z) => z.split(/(?<=[.?])\s+/));
			for (const satz of saetze) expect(satz.length, satz).toBeLessThanOrEqual(180);
		}
	});

	it('eine leere Liste ist der bisherige Text, mit dem neuen Schlusssatz', () => {
		const text = textFuerErinnerung({ ...texte, gemildert: [] }, false);
		expect(betreffFuerErinnerung({ ...texte, gemildert: [] }, false)).toMatch(/^Erinnerung:/);
		expect(text).toContain('sieht die Anwendung keine erzeugte Einladung');
		expect(text).toContain(
			'Diese Erinnerung geht einmal je Versammlung. Wird danach das Mehr eines Traktandums ' +
				'milder oder die Freigabe zurückgenommen, kommt eine weitere.'
		);
		expect(text).toContain(
			'Dafür genügt dieser Link; dann erinnert die Anwendung an diese Einladung\nnicht mehr:'
		);
		expect(text).not.toContain('berichtigte');
		expect(text).not.toContain('/vorbereitung');
		// Ohne Feld ebenso, auch nach Fristablauf, und dort mit Link wie bisher.
		const ab = textFuerErinnerung({ ...texte, gemildert: undefined }, true);
		expect(ab).toContain('Diese Erinnerung geht einmal je Versammlung.');
		expect(ab).toContain('https://beispiel.invalid/b/AbCdEf');
	});
});
