/**
 * Die Traktandenliste einer gemeinsamen Versammlung (rein).
 *
 * **Eine Sitzung, eine Liste, ein Protokoll** — so hat der Auftraggeber es am 11.08.2026
 * beschrieben: «Da es eine Sitzung ist, soll es auch ein Protokoll geben. Die
 * Traktandennummer widergibt die Nummer im Protokoll.»
 *
 * Rechtlich bleibt jede Gemeinschaft für sich: eigene Beschlussfähigkeit,
 * eigene Abstimmung, eigene Anfechtungsfrist. Was sie teilen, ist die
 * **Ordnung** des Abends — und damit die Nummer, unter der ein Geschäft
 * aufgerufen wird. Steht im Saal «3.1 Budget Nirgendweg 3», muss dieselbe
 * Nummer im Protokoll stehen; zwei Zählungen nebeneinander wären im Saal nicht
 * zu führen und im Protokoll nicht zu belegen.
 *
 * **Die Zahl der Gemeinschaften bestimmt die Gliederung**, nicht der Inhalt:
 *
 *     Begrüssung           läuft in zwei Häusern             →  1      Sammelpunkt
 *       Nirgendweg 3                                        →  1.1    abgestimmt
 *       Nirgendweg 5/5a                                     →  1.2    abgestimmt
 *     Rampe                nur eine Gemeinschaft             →  2      abgestimmt
 *
 * **Ab zwei Gemeinschaften immer eine Ziffer je Haus** (Produktentscheid
 * 11.08.2026): «Eigentlich muss pro Haus abgestimmt werden, ergo auch je ein
 * Traktandum angekündigt werden. Sonst entstehen Missverständnisse.» Der
 * Beschluss fällt in jedem Haus einzeln, mit eigener Beschlussfähigkeit und
 * eigener Anfechtungsfrist — was einzeln beschlossen wird, muss einzeln
 * angekündigt sein. Ein Punkt, der sich erst bei abweichendem Wortlaut
 * aufspaltet, führte in der Einladung eine Ankündigung, die es so nicht gibt.
 *
 * Dass die Liste dadurch lang wird, ist eine Frage der **Anzeige**, nicht der
 * Ordnung: Die Ziffern stehen zugeklappt unter ihrem Sammelpunkt.
 *
 * **Der Sammelpunkt wird nie abgestimmt.** Er ist eine Überschrift; der Beschluss
 * fällt in der einzelnen Gemeinschaft. Stünde er zur Abstimmung, gäbe es einen
 * Beschluss ohne Gemeinschaft, die ihn gefasst hat.
 *
 * Rein: hinein gehen Geschäfte und ihre Traktanden, heraus kommt die
 * nummerierte Liste. Keine Datenbank, keine Uhr (AD-1).
 */
import type { Id } from './types';

/** Ein Traktandum, wie es in einer einzelnen Gemeinschaft steht. */
export interface Hauszeile {
	traktandumId: Id;
	meetingId: Id;
	stwegId: Id;
	gemeinschaft: string;
	/** Was dort steht — kann vom Geschäft abweichen, sobald jemand es ändert. */
	titel: string;
	antragswortlaut: string | null;
	art: 'abstimmung' | 'kenntnisnahme';
	/** Der gewählte Fall des Regelwerks, aus dem das Mehrheitserfordernis stammt. */
	erfordernisKnoten: string | null;
	/** Ob der Inhalt noch dem des Geschäfts entspricht. */
	abweichend: boolean;
}

export interface Geschaeftszeile {
	geschaeftId: Id;
	titel: string;
	antragswortlaut: string | null;
	inhalt: string | null;
	art: 'abstimmung' | 'kenntnisnahme';
	stelle: number;
	haeuser: Hauszeile[];
}

/** Ein Eintrag der gemeinsamen Liste — Sammelpunkt oder Traktandum. */
export interface Listenzeile {
	nummer: string;
	tiefe: 1 | 2;
	titel: string;
	/** Nur gesetzt, wenn genau ein Traktandum dahintersteht. */
	traktandumId: Id | null;
	geschaeftId: Id;
	meetingId: Id | null;
	gemeinschaft: string | null;
	art: 'abstimmung' | 'kenntnisnahme' | 'sammelpunkt';
	/**
	 * **Ob über diesen Punkt abgestimmt wird** — die Frage, die `art` nicht
	 * beantwortet (24.08.2026).
	 *
	 * Gemeldet aus dem Prüflauf: «ich habe bei Traktandum 1 auf Abstimmung
	 * gedrückt und diese Meldung erhalten.» Traktandum 1 war «Begrüssung und
	 * Feststellung der Beschlussfähigkeit», in beiden Gemeinschaften als
	 * Kenntnisnahme angekündigt — und die Sitzungsleitung bot trotzdem
	 * «Abstimmung eröffnen» an, weil sie `art === 'kenntnisnahme'` prüfte. Bei
	 * zwei Häusern steht dort aber `'sammelpunkt'`, und der Vergleich traf nie
	 * zu. Der Server wies es zu Recht ab: «Nirgends möglich.»
	 *
	 * `art` sagt, wie der Eintrag **gebaut** ist (Sammelpunkt oder Traktandum);
	 * `punktart` sagt, was in den Häusern darunter **steht**. Zwei verschiedene
	 * Fragen, die vorher eine Antwort teilten.
	 *
	 * `'gemischt'` ist kein Ausnahmefall, sondern der Normalfall am Verbundabend:
	 * Ein Haus stimmt über die Jahresrechnung ab, das andere nimmt sie zur
	 * Kenntnis. Der Knopf muss dann da sein — für das eine —, und der Hinweis
	 * daneben, dass es für das andere nicht gilt.
	 *
	 * Seit 25.09.2026 gilt das nur noch für die Liste («teils Kenntnisnahme»).
	 * Am Abend wird ein gemischter Punkt je Haus geführt (`laeuftGemeinsam`), und
	 * jeder Schritt trägt dann die Art seines Hauses.
	 */
	punktart: 'abstimmung' | 'kenntnisnahme' | 'gemischt';
	antragswortlaut: string | null;
	/** Bei wie vielen Gemeinschaften dieses Geschäft läuft. */
	haeuser: number;
	/**
	 * Alle Traktanden, die unter dieser Nummer aufgerufen werden.
	 *
	 * Beim einheitlichen Punkt sind das alle Häuser, beim Sammelpunkt keines
	 * (er wird nicht abgestimmt) und beim Unterpunkt genau eines. Daraus
	 * entstehen die Protokollnummern — ohne diese Liste bekäme beim
	 * einheitlichen Punkt nur ein Haus seine Nummer und die übrigen zählten
	 * weiter für sich.
	 */
	traktanden: { traktandumId: Id; meetingId: Id; gemeinschaft: string }[];
	abweichend: boolean;
	/**
	 * Ob unter dem Sammelpunkt überall dasselbe steht.
	 *
	 * Nur für die Anzeige: Ein einheitlicher Sammelpunkt darf zugeklappt bleiben,
	 * ein aufgespaltener lohnt das Aufklappen. Die **Gliederung** hängt nicht
	 * daran — die entscheidet die Zahl der Gemeinschaften.
	 */
	einheitlich: boolean;
	/**
	 * Der Fall des Regelwerks, wenn **alle** Häuser denselben tragen.
	 *
	 * Null heisst «keiner» oder «uneinheitlich» — dann steht im Auswahlfeld nichts
	 * vorbelegt, denn ein vorbelegter Wert behauptete eine Einheitlichkeit, die es
	 * nicht gibt.
	 */
	erfordernis: string | null;
}

/** Der gemeinsame Fall, oder null wenn die Häuser auseinandergehen. */
function gemeinsamerFall(haeuser: Hauszeile[]): string | null {
	const erster = haeuser[0]?.erfordernisKnoten ?? null;
	if (!erster) return null;
	return haeuser.every((h) => h.erfordernisKnoten === erster) ? erster : null;
}

/**
 * Ob alle beteiligten Häuser dasselbe auf der Liste haben.
 *
 * Gliedert **nicht** — das tut die Zahl der Häuser. Die Auskunft dient allein
 * der Anzeige: Ein Sammelpunkt, unter dem überall dasselbe steht, darf
 * zugeklappt bleiben; sobald ein Haus ausschert, lohnt sich das Aufklappen.
 */
function einheitlich(haeuser: Hauszeile[]): boolean {
	const [erstes, ...weitere] = haeuser;
	if (!erstes) return true;
	return weitere.every(
		(h) =>
			h.titel.trim() === erstes.titel.trim() &&
			(h.antragswortlaut ?? '').trim() === (erstes.antragswortlaut ?? '').trim() &&
			h.art === erstes.art
	);
}

/**
 * Was in den Häusern unter einem Punkt steht: überall Abstimmung, überall
 * Kenntnisnahme — oder beides.
 *
 * Ohne Häuser gilt die Art des Geschäfts. Das ist kein Rückfall ins Ungefähre:
 * Ein Geschäft ohne Traktanden ist noch nicht aufgeteilt, und dann ist seine
 * eigene Art die einzige Auskunft, die es gibt.
 */
function punktartVon(
	haeuser: Hauszeile[],
	geschaeftsart: 'abstimmung' | 'kenntnisnahme'
): 'abstimmung' | 'kenntnisnahme' | 'gemischt' {
	if (haeuser.length === 0) return geschaeftsart;
	const arten = new Set(haeuser.map((h) => h.art));
	return arten.size === 1 ? [...arten][0] : 'gemischt';
}

/**
 * Rechnet die gemeinsame Liste mit ihren Nummern.
 *
 * Die Reihenfolge kommt aus `stelle` des Geschäfts, innerhalb eines Geschäfts
 * aus der Reihenfolge der Gemeinschaften, wie sie hereingereicht wird — dort
 * ist es die Stelle im Ablauf des Abends, damit die Liste im Saal derselben
 * Ordnung folgt wie der Einlass.
 */
export function gemeinsameListe(geschaefte: Geschaeftszeile[]): Listenzeile[] {
	const raus: Listenzeile[] = [];
	const geordnet = [...geschaefte].sort(
		(a, b) => a.stelle - b.stelle || a.titel.localeCompare(b.titel, 'de-CH')
	);

	geordnet.forEach((g, i) => {
		const nummer = String(i + 1);

		const alle = g.haeuser.map((h) => ({
			traktandumId: h.traktandumId,
			meetingId: h.meetingId,
			gemeinschaft: h.gemeinschaft
		}));

		// Höchstens eine Gemeinschaft: kein Sammelpunkt. Eine Gliederung mit einem
		// einzigen Glied gliedert nichts.
		if (g.haeuser.length <= 1) {
			const h = g.haeuser[0];
			raus.push({
				nummer,
				tiefe: 1,
				titel: h ? h.titel : g.titel,
				traktandumId: h?.traktandumId ?? null,
				geschaeftId: g.geschaeftId,
				meetingId: h?.meetingId ?? null,
				gemeinschaft: h?.gemeinschaft ?? null,
				art: h ? h.art : g.art,
				punktart: h ? h.art : g.art,
				antragswortlaut: h ? h.antragswortlaut : g.antragswortlaut,
				haeuser: g.haeuser.length,
				traktanden: alle,
				abweichend: h?.abweichend ?? false,
				einheitlich: true,
				erfordernis: gemeinsamerFall(g.haeuser)
			});
			return;
		}

		raus.push({
			nummer,
			tiefe: 1,
			titel: g.titel,
			traktandumId: null,
			geschaeftId: g.geschaeftId,
			meetingId: null,
			gemeinschaft: null,
			art: 'sammelpunkt',
			punktart: punktartVon(g.haeuser, g.art),
			antragswortlaut: g.antragswortlaut,
			haeuser: g.haeuser.length,
			// Der Sammelpunkt selbst trägt keine Nummer an ein Traktandum: Er wird
			// nicht abgestimmt, und die Häuser tragen ihre eigene Ziffer.
			traktanden: [],
			abweichend: g.haeuser.some((h) => h.abweichend),
			einheitlich: einheitlich(g.haeuser),
			erfordernis: gemeinsamerFall(g.haeuser)
		});

		const gleichlautend = einheitlich(g.haeuser);
		g.haeuser.forEach((h, j) => {
			raus.push({
				nummer: `${nummer}.${j + 1}`,
				tiefe: 2,
				titel: h.gemeinschaft,
				traktandumId: h.traktandumId,
				geschaeftId: g.geschaeftId,
				meetingId: h.meetingId,
				gemeinschaft: h.gemeinschaft,
				art: h.art,
				punktart: h.art,
				antragswortlaut: h.antragswortlaut,
				haeuser: g.haeuser.length,
				traktanden: [
					{ traktandumId: h.traktandumId, meetingId: h.meetingId, gemeinschaft: h.gemeinschaft }
				],
				abweichend: h.abweichend,
				erfordernis: h.erfordernisKnoten,
				// **Der Wert des Punktes, nicht der der Zeile.** Die Anzeige fragt ihn
				// bei jeder Zeile ab, um zu entscheiden, ob sie zugeklappt bleibt;
				// stünde hier «true», bliebe eine Ziffer versteckt, obwohl ihr Punkt
				// aufgespalten ist (gefunden vom Durchlauf am 11.08.2026).
				einheitlich: gleichlautend
			});
		});
	});

	return raus;
}

/**
 * Welche Nummer jedes einzelne Traktandum tragen muss.
 *
 * Das Ergebnis geht als **feste Nummer** an die Traktanden der einzelnen
 * Versammlungen: Im Protokoll der Gemeinschaft steht dann «3.1», wie im Saal
 * aufgerufen. Lücken sind dabei normal und richtig — wer bei 3.1 nicht dabei
 * ist, hat in seinem Protokoll kein 3.1, und das ist die Wahrheit über den
 * Abend, keine Panne.
 */
export function nummernJeTraktandum(liste: Listenzeile[]): Map<Id, string> {
	const raus = new Map<Id, string>();
	for (const z of liste) {
		// Über `traktanden`, nicht über `traktandumId`: Beim einheitlichen Punkt
		// tragen alle sechs Häuser dieselbe Nummer, und `traktandumId` ist dort
		// bewusst leer — es steht ja nicht ein einzelnes dahinter.
		for (const t of z.traktanden) raus.set(t.traktandumId, z.nummer);
	}
	return raus;
}

// ── Lose Traktanden einsammeln ──────────────────────────────────────────────

/** Ein Traktandum, das in seiner Gemeinschaft steht und zu keinem Geschäft gehört. */
export interface LosesTraktandum {
	traktandumId: Id;
	meetingId: Id;
	titel: string;
	antragswortlaut: string | null;
	art: 'abstimmung' | 'kenntnisnahme';
	/** Die Stelle in der Liste seiner eigenen Versammlung. */
	stelle: number;
}

/** Ein Geschäft, wie es aus zusammengehörenden losen Traktanden entstehen soll. */
export interface Sammelvorschlag {
	titel: string;
	antragswortlaut: string | null;
	art: 'abstimmung' | 'kenntnisnahme';
	stelle: number;
	traktandumIds: Id[];
}

/** Ein Geschäft, das der Abend schon führt — samt der Häuser, die darin stecken. */
export interface BestehendesGeschaeft {
	geschaeftId: Id;
	titel: string;
	besetzt: Id[];
}

export interface Einsammlung {
	/** Lose Traktanden, die an ein bestehendes Geschäft anschliessen. */
	anschluesse: { geschaeftId: Id; traktandumIds: Id[] }[];
	/** Was kein bestehendes Geschäft findet und ein neues bildet. */
	neue: Sammelvorschlag[];
}

/**
 * Fasst lose Traktanden zu Geschäften des Abends zusammen.
 *
 * **Warum es das braucht.** Die Pflichttraktanden entstehen beim Anlegen jeder
 * Versammlung — sechs Gemeinschaften ergeben sechsmal «Begrüssung», sechsmal
 * «Jahresrechnung». Ohne Zusammenfassung führt jede Gemeinschaft ihre eigene
 * Zählung, und das gemeinsame Geschäft trägt daneben eine zweite: Im Screenshot
 * vom 11.08.2026 stand «1.1 Budget 2027» unter einer Liste, die bei 8 endete.
 *
 * Zusammengefasst wird über den **Titel**, denn er ist es, was im Saal aufgerufen
 * wird. Antragswortlaut und Art kommen aus dem ersten Traktandum der Gruppe;
 * gehen sie zwischen den Häusern auseinander, zeigt die Liste das anschliessend
 * als Sammelpunkt — dafür ist sie da.
 *
 * **Gleiche Titel in derselben Versammlung** landen nicht in derselben Gruppe:
 * Ein Geschäft trägt je Gemeinschaft höchstens ein Traktandum, sonst stünde
 * dieselbe Nummer zweimal auf der Liste. Der zweite «Diverses» eines Hauses
 * bildet deshalb die zweite Gruppe dieses Titels.
 *
 * **Bestehende Punkte gehen vor.** Kommt eine Gemeinschaft später dazu, schliesst
 * ihre Begrüssung an die Begrüssung des Abends an, statt einen zweiten Punkt
 * gleichen Namens zu bilden. Ohne das ergaben drei Häuser mit je acht
 * Pflichttraktanden vierundzwanzig Punkte statt acht — gemessen am 11.08.2026.
 */
export function fasseZusammen(
	lose: LosesTraktandum[],
	bestehende: BestehendesGeschaeft[] = []
): Einsammlung {
	const geordnet = [...lose].sort(
		(a, b) => a.stelle - b.stelle || a.traktandumId.localeCompare(b.traktandumId)
	);

	// Bestehende Geschäfte nach Titel, mit den Versammlungen, die sie schon führen.
	const vorhanden = new Map<string, { geschaeftId: Id; besetzt: Set<Id>; traktandumIds: Id[] }[]>();
	for (const b of bestehende) {
		const schluessel = b.titel.trim().toLocaleLowerCase('de-CH');
		const liste = vorhanden.get(schluessel) ?? [];
		liste.push({ geschaeftId: b.geschaeftId, besetzt: new Set(b.besetzt), traktandumIds: [] });
		vorhanden.set(schluessel, liste);
	}

	// Schlüssel → Gruppen dieses Titels, in der Reihenfolge ihres Entstehens.
	const nachTitel = new Map<string, Sammelvorschlag[]>();
	/** Welche Versammlungen in einer Gruppe schon vertreten sind. */
	const belegt = new Map<Sammelvorschlag, Set<Id>>();

	for (const t of geordnet) {
		const schluessel = t.titel.trim().toLocaleLowerCase('de-CH');

		// Zuerst an ein bestehendes Geschäft dieses Titels, in dem die Versammlung
		// noch nicht vertreten ist.
		const anschluss = vorhanden.get(schluessel)?.find((v) => !v.besetzt.has(t.meetingId));
		if (anschluss) {
			anschluss.traktandumIds.push(t.traktandumId);
			anschluss.besetzt.add(t.meetingId);
			continue;
		}

		let gruppen = nachTitel.get(schluessel);
		if (!gruppen) {
			gruppen = [];
			nachTitel.set(schluessel, gruppen);
		}

		// Die erste Gruppe, in der diese Versammlung noch nicht vertreten ist.
		let gruppe = gruppen.find((g) => !belegt.get(g)?.has(t.meetingId));
		if (!gruppe) {
			gruppe = {
				titel: t.titel.trim(),
				antragswortlaut: t.antragswortlaut,
				art: t.art,
				stelle: t.stelle,
				traktandumIds: []
			};
			gruppen.push(gruppe);
			belegt.set(gruppe, new Set());
		}
		gruppe.traktandumIds.push(t.traktandumId);
		belegt.get(gruppe)!.add(t.meetingId);
		gruppe.stelle = Math.min(gruppe.stelle, t.stelle);
	}

	return {
		anschluesse: [...vorhanden.values()]
			.flat()
			.filter((v) => v.traktandumIds.length > 0)
			.map((v) => ({ geschaeftId: v.geschaeftId, traktandumIds: v.traktandumIds })),
		neue: [...nachTitel.values()]
			.flat()
			.sort((a, b) => a.stelle - b.stelle || a.titel.localeCompare(b.titel, 'de-CH'))
	};
}

/**
 * Wohin ein Eintrag rückt, wenn man ihn vor einen anderen zieht.
 *
 * Dieselbe Rechnung für beide Achsen der Liste: die Reihenfolge der Traktanden
 * am Abend und die Reihenfolge der Gemeinschaften innerhalb eines Traktandums.
 * Zweimal geschrieben liefen sie auseinander, und das Ziehen verhielte sich auf
 * den beiden Ebenen verschieden.
 */
export function neueStellen(
	eintraege: { id: Id; stelle: number }[],
	bewegt: Id,
	vorId: Id | null
): { id: Id; stelle: number }[] {
	const geordnet = [...eintraege].sort((a, b) => a.stelle - b.stelle);
	const ohne = geordnet.filter((g) => g.id !== bewegt);
	const eintrag = geordnet.find((g) => g.id === bewegt);
	if (!eintrag) return geordnet;

	// `vorId === null` heisst ans Ende — das ist der Ablegepunkt unterhalb des
	// letzten Eintrags.
	const stelle = vorId === null ? ohne.length : ohne.findIndex((g) => g.id === vorId);
	const ziel = stelle < 0 ? ohne.length : stelle;
	ohne.splice(ziel, 0, eintrag);

	return ohne.map((g, i) => ({ id: g.id, stelle: i }));
}

/** Wohin ein Geschäft rückt, wenn man es an eine andere Stelle zieht. */
export function neueReihenfolge(
	geschaefte: { geschaeftId: Id; stelle: number }[],
	bewegt: Id,
	vorId: Id | null
): { geschaeftId: Id; stelle: number }[] {
	return neueStellen(
		geschaefte.map((g) => ({ id: g.geschaeftId, stelle: g.stelle })),
		bewegt,
		vorId
	).map((g) => ({ geschaeftId: g.id, stelle: g.stelle }));
}

/**
 * Aus einer Stelle im Ablauf den Ablegepunkt machen.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Das Sortieren fehlt bei den Traktanden.»
 * Die Leitung des Abends kannte kein Verschieben; die Pflegeseite kann es nur
 * durch Ziehen, und im Saal zieht niemand mit der Maus, während vierzehn Leute
 * zusehen. Die Leitung einer einzelnen Versammlung hat dafür seit dem 21.08. ein
 * Zahlenfeld — dasselbe hier.
 *
 * `verschiebeGeschaeft` denkt in «vor welches» und nicht in «an welche Stelle».
 * Beides ineinander umzurechnen ist eine Zeile Arithmetik — und genau deshalb
 * steht sie im Kern und nicht in der Seite: Zweimal geschrieben rechnete sie
 * beim Verschieben nach hinten anders als beim Verschieben nach vorne, und
 * niemand merkte es, weil beide Wege plausible Ergebnisse liefern.
 *
 * Die Stelle zählt ab **eins** — im Saal wird «an dritter Stelle» gesagt.
 */
export function ablegepunkt(reihenfolge: Id[], bewegt: Id, stelle: number): Id | null {
	const ohne = reihenfolge.filter((id) => id !== bewegt);
	// Ausserhalb der Liste heisst «ans Ende»: Wer 99 eintippt, meint zuletzt.
	const ziel = Math.max(0, Math.min(ohne.length, Math.trunc(stelle) - 1));
	return ohne[ziel] ?? null;
}

/**
 * Ein Schritt beim Durchführen des Abends.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Wenn Subtraktanden vorhanden sind, muss
 * durch die durch navigiert werden. Eine Ausnahme ist die Beschlussfähigkeit.
 * Dort genügt eine globale Feststellung.» Und davor: «Eigentlich muss über jedes
 * Subtraktandum einzeln abgestimmt werden. Erneuerungsfonds, Bestellung
 * Ausschuss etc. kann unterschiedlich sein.»
 *
 * Bis dahin führte die Steuerung durch die **Punkte** und rief in allen Häusern
 * zugleich auf. Das ist richtig, solange im Saal eine Frage gestellt wird — und
 * falsch, sobald der Antrag je Haus anders lautet: Dann stünde auf jedem Telefon
 * die Frage des Nachbarhauses.
 */
export interface Abendschritt {
	/** Die Nummer, wie sie im Saal genannt wird: «7» oder «7.2». */
	nummer: string;
	titel: string;
	geschaeftId: Id;
	/**
	 * Das Traktandum dieses Schrittes. Null heisst: alle Häuser des Punktes
	 * zugleich — der Fall des einzigen Hauses und der Feststellung der
	 * Beschlussfähigkeit.
	 *
	 * Genauer: Beim einzigen Haus ist sie gesetzt, null gibt es nur bei einem
	 * Geschäft ohne Haus und bei einem gemeinsamen Schritt. Neu seit 25.09.2026
	 * ist, dass ein gemeinsamer Schritt immer eine Kenntnisnahme ist
	 * (`laeuftGemeinsam`).
	 */
	traktandumId: Id | null;
	/** Die Gemeinschaft, wenn der Schritt einer gehört. */
	gemeinschaft: string | null;
	punktart: 'abstimmung' | 'kenntnisnahme' | 'gemischt';
	antragswortlaut: string | null;
	/** Alle Traktanden, die dieser Schritt anspricht. */
	traktanden: { traktandumId: Id; meetingId: Id; gemeinschaft: string }[];
}

/**
 * Die Abfolge, in der ein Abend geführt wird.
 *
 * Drei Fälle, und der mittlere ist der, um den es geht:
 *
 *   - **Ein Haus** — der Punkt ist der Schritt. Eine Gliederung mit einem Glied
 *     gliedert nichts.
 *   - **Mehrere Häuser** — je Haus ein Schritt. Beschlossen wird in jedem für
 *     sich, also wird auch in jedem für sich gefragt.
 *   - **Alle Häuser zugleich** — wo eine Feststellung für den ganzen Saal gilt.
 *     Sie zu wiederholen hiesse, siebenmal dasselbe zu sagen; anzustimmen gibt
 *     es dabei nichts.
 *
 * `gemeinsam` entscheidet den dritten Fall. Der Prüfer kommt von aussen, damit
 * diese Rechnung nichts über Traktandentitel wissen muss. Er allein genügt
 * aber nicht, siehe `laeuftGemeinsam`.
 */
/**
 * An welcher STELLE im Ablauf der Abend gerade steht — aus dem, worauf die
 * Häuser stehen. Der Rückgabewert ist ein Index in `schritte`, `-1` wenn
 * nirgends etwas läuft.
 *
 * **Der Fehler, den das behebt** (Auftraggeber, 25.08.2026: «Wenn ich bei 2.2 auf
 * Aufrufen klicke, komme ich nicht weiter»).
 *
 * Bis hierher gewann das **Traktandum**, das in den meisten Häusern aufgerufen
 * war. Bei einem Punkt, der je Haus einzeln geführt wird — 2.1 für die MEG,
 * 2.2 für Nirgendweg 5/5a — hat aber jedes Haus sein eigenes: Die Zählung
 * endet 1 zu 1, und welches gewinnt, entscheidet die Reihenfolge der
 * Häuserliste. Wer 2.2 aufrief, sah weiter «JETZT 2.1» und «NACHHER 2.2» und
 * musste glauben, sein Klick sei ins Leere gegangen. Er war es nicht — am
 * 25.08.2026 in der Datenbank nachgesehen: Beide Häuser standen richtig, nur
 * die Steuerung zeigte das ältere.
 *
 * **Gezählt wird deshalb je SCHRITT, nicht je Traktandum.** 2.1 und 2.2 sind
 * derselbe Punkt in zwei Häusern; als Schritte sind sie zwei, und dann steht
 * ein Haus auf Schritt n und eines auf n+1 — kein Gleichstand mehr, sondern
 * eine echte Mehrheit von eins zu eins auf zwei verschiedenen Schritten.
 * (Abgelöst am 25.09.2026: Gezählt wird nicht mehr, siehe unten.)
 *
 * **Und bei echtem Gleichstand gilt der ZULETZT aufgerufene** (25.08.2026).
 * (Seit dem 25.09.2026 gilt der jüngste Aufruf immer, nicht nur bei
 * Gleichstand; siehe «Gezählt wird nicht mehr» unten.)
 *
 * Vorher stand hier «der spätere im Ablauf» — mit der Begründung, ein Abend
 * gehe reihum vorwärts. Das ist eine plausible Vermutung und war falsch.
 * Nachgemessen am Verbund-Durchlauf: Nirgendweg 5/5a stand auf Schritt 9,
 * die MEG noch auf Schritt 20 aus einem früheren Handgriff. Ein Klick auf
 * «Aufrufen» bei Punkt 9 schrieb richtig in die Datenbank (der Server
 * antwortete 200) — und die Steuerung zeigte weiter Punkt 20, weil dessen
 * Index höher ist. Wer dann «Abstimmung eröffnen» drückte, öffnete die
 * Abstimmung zum **anderen** Punkt.
 *
 * Die Uhrzeit beendet das Raten: `meeting.current_agenda_item_at` (Migration
 * 084) sagt, wann jedes Haus auf seinen Punkt gestellt wurde. Massgebend ist
 * der jüngste Aufruf — der letzte Handgriff der Sitzungsleitung. Häuser ohne
 * Zeitangabe stehen hinten an; sie können ein frisch aufgerufenes nicht
 * verdrängen.
 *
 * **Gezählt wird nicht mehr, der jüngste Aufruf gilt immer** (25.09.2026). Bis
 * dahin gewann der Schritt, auf dem die meisten Häuser standen, und die Uhrzeit
 * entschied nur bei Gleichstand. Die Zählung kam mit `0f57bbb` (24.08.2026) in
 * die Leitung des Abends («gilt der am häufigsten aufgerufene», damals je
 * Traktandum); `9e17ef6` (25.08.2026) verlegte sie hierher und zählte je
 * Schritt, dort entstand auch die Probe «laesst die Mehrheit entscheiden».
 * Ein Produktentscheid war sie nie; die Begründung der Probe («Sonst risse ein
 * einzelnes vorgeeiltes Haus den ganzen Saal mit») kam mit `3af7ffd`
 * (25.08.2026) aus der Entwicklung. Mit demselben Commit verwarf die Wand die
 * Zählung (Kommentar in `praesentation/+page.server.ts`: «Die Häufigkeit war nie
 * die Frage. Der Zeitpunkt fehlte bloss.»).
 *
 * Am 25.09.2026 gemessen (Fall 1a, drei Häuser): Zwei Häuser stehen noch auf
 * der gemeinsamen Begrüssung, eines ruft mit «nachher» 2.1 auf. Die Zählung
 * blieb 2 gegen 1 auf der Begrüssung stehen, während die Wand 2.1 zeigte.
 * Auftraggeber am 25.09.2026: «prüf die Ursache. Wäre sauberer.» Deshalb an
 * der Ursache behoben und nicht über einen geänderten Klick auf «nachher».
 *
 * **Bei genau gleicher Zeit der frühere Schritt** (25.09.2026). Vorher
 * entschied dann die Reihenfolge der Häuser, die nicht die der Schritte sein
 * muss. Der Sammelaufruf ruft das erste Haus zuletzt auf (`aufrufreihenfolge`),
 * damit es «jetzt» ist; fielen zwei Aufrufe in dieselbe Millisekunde, soll im
 * Dreischritt dasselbe herauskommen. Die Wand rechnet ohne diese Regel, allein
 * nach der Zeit; bei gleicher Millisekunde kann sie ein anderes Haus zeigen,
 * wenn die Reihenfolge im Punkt von der des Abends abweicht.
 */
export function laufendeStelle(
	schritte: Abendschritt[],
	/**
	 * Je Haus das aufgerufene Traktandum mit dem Zeitpunkt des Aufrufs.
	 * `traktandumId: null`, wo keines läuft.
	 */
	aufgerufene: { traktandumId: string | null; seit: string | null }[]
): number {
	/** Je Aufruf: sein Schritt und sein Zeitpunkt. Ohne Zeitangabe zuletzt. */
	const kandidaten: { stelle: number; seit: string }[] = [];
	for (const a of aufgerufene) {
		if (!a.traktandumId) continue;
		const i = schritte.findIndex((z) =>
			z.traktanden.some((x) => x.traktandumId === a.traktandumId)
		);
		if (i < 0) continue;
		kandidaten.push({ stelle: i, seit: a.seit ?? '' });
	}
	kandidaten.sort((a, b) => {
		if (a.seit !== b.seit) return a.seit < b.seit ? 1 : -1;
		return a.stelle - b.stelle;
	});
	return kandidaten[0]?.stelle ?? -1;
}

/**
 * In welcher Reihenfolge ein Aufruf die Häuser eines Punktes anspricht.
 *
 * **Der Sammelaufruf von hinten nach vorne** (25.09.2026). Der Dreischritt
 * nimmt den jüngsten Aufruf (`laufendeStelle`), bei genau gleicher Zeit den
 * früheren Schritt; die Wand nimmt den jüngsten. Rief der
 * Sammelaufruf von vorne nach hinten auf, stand danach das letzte Haus unter
 * «jetzt»: «VORHER 10.1 Haus A · JETZT 10.2 Haus B · NACHHER 11.1», und wer
 * vorwärts ging, liess 10.1 aufgerufen und unabgestimmt zurück (gemessen
 * 25.09.2026). Produktentscheid 25.09.2026: «von der Bedienung her muss es
 * identisch sein, wie jede andere Abstimmung». Das erste Haus wird deshalb
 * zuletzt aufgerufen, ist damit «jetzt», und «nachher» führt zum nächsten Haus
 * desselben Punktes.
 *
 * Die Regel «jüngster Aufruf» bleibt dafür unverändert: Sie trägt den Fall
 * eines Hauses, das noch auf einem alten Punkt steht.
 *
 * Ein einzelnes Traktandum (`einzeln`) hat nur ein Ziel; dort bleibt es, wie
 * es ist. Zweimal angewandt ergibt sich die Reihenfolge des Punktes zurück,
 * so ordnet `rufeAmAbendAuf` die Absagen wieder nach dem Punkt.
 */
export function aufrufreihenfolge<T>(ziele: T[], einzeln: boolean): T[] {
	return einzeln ? ziele : [...ziele].reverse();
}

/**
 * Ob ein Punkt über mehrere Häuser als **ein** Schritt für alle läuft.
 *
 * Nur, wenn der Prüfer ihn als gemeinsam erkennt **und** überall eine
 * Kenntnisnahme steht. Der Prüfer liest den Titel, und ein Titel sagt nicht,
 * ob abgestimmt wird: «Feststellung der Beschlussfähigkeit und Wahl des
 * Protokollführers» trägt das Wort und ist eine Wahl. Als gemeinsamer Schritt
 * lief sie ohne Vorschau, ohne Sperre, ohne Ausstand und ohne Stimmerfassung,
 * und `oeffneAmAbend` eröffnete die übrigen Häuser, während eines abwies
 * (Messung 25.09.2026, `.auftraege`-Bericht «Sammelpunkt am Abend»).
 *
 * Produktentscheid 25.09.2026: kein Abstimmungsschritt über mehrere Häuser. Wo
 * abgestimmt wird, gibt es je Haus einen Schritt, wie bei jedem anderen Punkt.
 * «Gemischt» zählt dazu: Das Haus, das abstimmt, braucht seinen eigenen
 * Schritt.
 *
 * Eine Stelle für die Schrittrechnung und die Liste der Leitung, damit beide
 * dieselbe Grenze ziehen.
 */
export function laeuftGemeinsam(
	zeile: Pick<Listenzeile, 'haeuser' | 'titel' | 'punktart'>,
	gemeinsam: (titel: string) => boolean
): boolean {
	return zeile.haeuser > 1 && zeile.punktart === 'kenntnisnahme' && gemeinsam(zeile.titel);
}

/**
 * Ein angehängter Antrag (Rückkommen oder Folgeantrag), wie er am Abend als
 * eigener Schritt läuft.
 *
 * Er steht nicht in der gemeinsamen Liste: Er entsteht erst im Saal, als
 * Unterpunkt seines Ziels in genau einem Haus, und
 * trägt kein Geschäft. Die gemeinsame Liste bleibt deshalb unberührt, auch ihre
 * Nummern, die als feste Nummern an die Häuser gehen.
 */
export interface Abendantrag {
	traktandumId: Id;
	meetingId: Id;
	gemeinschaft: string;
	/**
	 * Das Traktandum, an dem er hängt: beim Rückkommensantrag
	 * `reconsiders_item_id`, beim im Saal aufgenommenen Folgeantrag `parent_id`.
	 */
	zielId: Id;
	/** Die Nummer in seinem Haus, etwa «10.1.1». */
	nummer: string;
	titel: string;
	antragswortlaut: string | null;
	art: 'abstimmung' | 'kenntnisnahme';
}

/**
 * Woran ein angehängter Antrag hängt, oder null, wenn der Knoten keiner ist.
 *
 * Beim Rückkommensantrag `reconsiders_item_id`, beim im Saal aufgenommenen
 * Folgeantrag `parent_id`. **Nur der im Saal aufgenommene Folgeantrag zählt**
 * (`spontan` und `spontanart` `folgeantrag`): Ein angekündigter Unterpunkt
 * trägt ebenfalls `parentId`, steht aber schon in der Liste des Hauses und
 * bräuchte am Abend keinen eigenen Schritt vor seinem Elternteil. Ein
 * sachfremd aufgenommener Punkt (`spontanart` `neu`) stützt sich auf keinen
 * Grundantrag.
 *
 * Im Kern und nicht in `holeAbendantraege`, damit die Abgrenzung eine Probe
 * bekommt (Nachprüfung 25.09.2026: keine Probe sah sie).
 */
export function zielDesAntrags(k: {
	spontan?: boolean;
	spontanart?: string | null;
	parentId: Id | null;
	rueckkommenZielId?: Id | null;
}): Id | null {
	if (k.rueckkommenZielId) return k.rueckkommenZielId;
	if (k.spontan && k.spontanart === 'folgeantrag' && k.parentId) return k.parentId;
	return null;
}

/**
 * Die angehängten Anträge (Rückkommen und Folgeantrag), die an diesen
 * Traktanden hängen, samt denen, die wiederum an ihnen hängen.
 *
 * **Daran hängt die Bindung ans Geschäft.** Ein angehängter Antrag gehört zu dem
 * Geschäft, an dessen Traktandum er hängt. Die Abendsteuerung nimmt nur
 * Traktanden eines Geschäfts entgegen (`bindung: geschaeftId`); diese Rechnung
 * erweitert die Menge um genau die Anträge, die über ihr Ziel dazugehören, und
 * um nichts sonst. Ein Antrag, dessen Ziel in keinem Traktandum des Geschäfts
 * liegt, kommt nicht vor.
 *
 * Reihenfolge: je Ziel in der Reihenfolge der Eingabe, und ein Antrag, der an
 * einem Antrag hängt, **vor** diesem. Das ist dieselbe Regel wie beim Ziel
 * selbst (`abendschritte`): Was angehängt ist, wird zuerst behandelt, und
 * «nachher» führt zu dem, woran es hängt.
 *
 * Ein Kreis kann beim Anlegen nicht entstehen, aus zwei verschiedenen
 * Gründen, beide geprüft von der Anwendung, nicht von der Datenbank: Ein
 * Rückkommensantrag setzt ein schon behandeltes Ziel voraus, ein Folgeantrag
 * einen angekündigten Grundantrag, der selbst kein Folgeantrag ist
 * (`grundantrag_nicht_angekuendigt`). Die Menge der gesehenen hält die
 * Rechnung trotzdem endlich.
 */
export function angehaengteAntraege(ziele: Id[], antraege: Abendantrag[]): Abendantrag[] {
	const raus: Abendantrag[] = [];
	const gesehen = new Set<Id>(ziele);
	const folge = (zielId: Id) => {
		for (const a of antraege) {
			if (a.zielId !== zielId || gesehen.has(a.traktandumId)) continue;
			gesehen.add(a.traktandumId);
			folge(a.traktandumId);
			raus.push(a);
		}
	};
	for (const z of ziele) folge(z);
	return raus;
}

export function abendschritte(
	liste: Listenzeile[],
	gemeinsam: (titel: string) => boolean,
	/**
	 * Die angehängten Anträge des Abends (Rückkommen und Folgeantrag). Jeder
	 * steht als eigener Schritt, damit der Dreischritt einen aufgerufenen
	 * Antrag findet: `laufendeStelle` sieht nur, was in `schritte` steht.
	 *
	 * **Direkt vor seinem Ziel, nicht danach** (25.09.2026, im Durchstich
	 * gesehen). Beide Arten werden vor ihrem Ziel behandelt: der
	 * Rückkommensantrag vor dem zweiten Durchgang, der Folgeantrag vor dem
	 * Grundantrag («Über ihn wird zuerst abgestimmt», `reihenfolgehinweis` in
	 * `folgeantrag.ts`). Die Bedienung soll dieselbe sein wie bei jeder
	 * anderen Abstimmung (Produktentscheid 25.09.2026): abstimmen, dann
	 * «nachher». Stand der Rückkommensantrag hinter dem Ziel, führte «nachher»
	 * nach dem zweiten Durchgang zurück auf den schon entschiedenen Antrag
	 * statt zum nächsten Haus, und zum Ziel kam man nur über «Zurück».
	 */
	antraege: Abendantrag[] = []
): Abendschritt[] {
	const raus: Abendschritt[] = [];

	/** Die angehängten Anträge vor den Schritt setzen, dann den Schritt. */
	const setze = (s: Abendschritt) => {
		// Mehrere Anträge am selben Ziel in der Reihenfolge ihrer Aufnahme: Der
		// jüngste steht zuletzt, also direkt vor dem Ziel, und sein «nachher» ist
		// das Ziel selbst (beim Rückkommen der zweite Durchgang, beim
		// Folgeantrag der Grundantrag). Ein Antrag an einem Antrag steht vor
		// diesem (`angehaengteAntraege`).
		for (const a of angehaengteAntraege(
			s.traktanden.map((t) => t.traktandumId),
			antraege
		)) {
			raus.push({
				nummer: a.nummer,
				titel: a.titel,
				// Das Geschäft des Ziels: Über diese Kennung ruft der Abend auf,
				// eröffnet und schliesst.
				geschaeftId: s.geschaeftId,
				traktandumId: a.traktandumId,
				gemeinschaft: a.gemeinschaft,
				punktart: a.art,
				antragswortlaut: a.antragswortlaut,
				traktanden: [
					{ traktandumId: a.traktandumId, meetingId: a.meetingId, gemeinschaft: a.gemeinschaft }
				]
			});
		}
		raus.push(s);
	};

	for (const z of liste) {
		if (z.tiefe !== 1) continue;

		const einzeln =
			z.haeuser > 1 && !laeuftGemeinsam(z, gemeinsam)
				? liste.filter((u) => u.tiefe === 2 && u.geschaeftId === z.geschaeftId)
				: [];

		if (einzeln.length === 0) {
			/*
			 * **Die Traktanden aus den Unterzeilen holen** (im Test gefunden,
			 * 24.08.2026).
			 *
			 * Ein Sammelpunkt trägt selbst keine — das ist Absicht, denn er wird
			 * nicht abgestimmt und bekommt keine Nummer an ein Traktandum. Wer
			 * `z.traktanden` nimmt, bekommt beim gemeinsamen Punkt eine **leere
			 * Liste**: Die Steuerung fände ihn im Dreischritt nie wieder (sie sucht
			 * über die Traktanden), und «Aufrufen» hätte nichts anzusprechen.
			 *
			 * Beim Punkt mit einem einzigen Haus steht die Zeile für sich; dort ist
			 * `z.traktanden` schon vollständig, und die Suche findet dasselbe.
			 */
			const alle =
				z.haeuser > 1
					? liste.filter((u) => u.geschaeftId === z.geschaeftId).flatMap((u) => u.traktanden)
					: z.traktanden;

			setze({
				nummer: z.nummer,
				titel: z.titel,
				geschaeftId: z.geschaeftId,
				// Beim Punkt über alle Häuser bleibt es leer: Die Handlung gilt allen.
				traktandumId: z.haeuser > 1 ? null : z.traktandumId,
				gemeinschaft: z.haeuser > 1 ? null : z.gemeinschaft,
				punktart: z.punktart,
				antragswortlaut: z.antragswortlaut,
				traktanden: alle
			});
			continue;
		}

		for (const u of einzeln) {
			setze({
				nummer: u.nummer,
				// Der Titel des PUNKTES, nicht der der Unterzeile: Die trägt den Namen
				// der Gemeinschaft, und «MEG Nirgendweg 3-13a» als Überschrift eines
				// Schrittes sagt nicht, worüber gesprochen wird.
				titel: u.abweichend ? z.titel : z.titel,
				geschaeftId: u.geschaeftId,
				traktandumId: u.traktandumId,
				gemeinschaft: u.gemeinschaft,
				punktart: u.punktart,
				antragswortlaut: u.antragswortlaut,
				traktanden: u.traktanden
			});
		}
	}

	return raus;
}
