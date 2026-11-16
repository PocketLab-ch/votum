/**
 * Regelwerk, Fassung 2026-10-13.
 *
 * **Daten, kein Code** (AD-4). An der nützlichen baulichen Massnahme
 * (ZGB Art. 647d Abs. 1) kommt die Zustimmung der Betroffenen als zweites,
 * additives Erfordernis dazu, wie bei der Änderung der Nutzungsrechte
 * (ZGB Art. 712g Abs. 4, Fassung 2026-09-28): Das Mehr bleibt das
 * qualifizierte nach Köpfen und Wertquoten, daneben müssen die erheblich und
 * dauernd Betroffenen zustimmen, im Saal oder vorab schriftlich.
 *
 * **Was die Fassung nicht tut.** Art. 647d Abs. 3 (unzumutbare Kosten) wird
 * nicht als eigener Beschlussgegenstand gebaut. Die Erläuterung nennt die
 * Übernahme durch die übrigen als Ersatzweg, und der zweite Hinweis führt das
 * Verfahren (übernehmen, im Antragstext festhalten und nicht erfassen; keine
 * Übernahme, erfassen und Zustimmung einholen). Produktentscheid 04.10.2026.
 *
 * **Bestehende Traktanden rechnen weiter wie bisher.** `veralteteErfordernisse`
 * vergleicht die gespeicherten Erfordernisfelder, nicht die Fassungskennung;
 * ein Traktandum unter einer älteren Fassung behält sein Erfordernis ohne
 * Zustimmungspflicht.
 *
 * **Geprüft in drei Runden** Laien- und Fachprüfung am 04.10.2026
 * (`quellen`, `pruefung/berichte/2026-10-04-647d-betroffene.md`). Die Form
 * «im Saal oder vorab schriftlich» trägt die Fachprüfung über die Formfreiheit
 * und die Parallelstelle Rz. 209 ad Art. 712g; zu Art. 647d selbst schweigt
 * der Bestand zur Form. **Die beiden Belegentscheide liegen seit 04.10.2026
 * im Repo** (`quellen`, `volltexte/einzeltexte/`): BGE 136 III 261 trägt den
 * formlosen Satz direkt (E. 3.2, E. 3.3, E. 4.3); die Aussage zum Sonderrecht
 * trägt allein BGer 5A_972/2020 E. 5.3, weil Rz. 129 dafür BGE 136 III 261
 * E. 3.3 zitiert, was E. 3.3 nicht sagt.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_12 } from './quorum-2026-10-12';

/**
 * Die Erläuterung, wer an der nützlichen Massnahme betroffen ist, und ihre
 * Fassung für die Website.
 *
 * **Der Werkzeugsatz fällt für die Website weg** (Codeprüfung 04.10.2026, N6):
 * «Sind Sie unsicher, erfassen Sie die Person …» richtet sich an die
 * Sitzungsleitung; die Website rechnet und erfasst nichts. Beide Fassungen
 * stehen hier, damit der Schlüssel im Export nicht still veraltet (Vorbild
 * `ANGEHOERIGE_WEBSITE`, Fassung 2026-10-12).
 */
export const NUTZLICH_BETROFFEN_ANWENDUNG =
	'Betroffen ist, wessen Gebrauch oder Benutzung der gemeinsamen Sache durch die Massnahme ' +
	'für den bisherigen Zweck erheblich und dauernd erschwert oder unwirtschaftlich wird. ' +
	'Das gilt auch bei einem Teil im Sonderrecht oder bei einer Sondernutzung. Dann braucht ' +
	'es die Zustimmung der Person. Wer eine Fläche allein nutzt, ist dafür geschützt, wenn ' +
	'ihm das bei der Gründung des Stockwerkeigentums, im Reglement oder durch Beschluss ' +
	'eingeräumt wurde. Durfte er sie nur formlos nutzen, hat er daraus kein Vetorecht. Der ' +
	'Gebrauch der gemeinsamen Teile zum bisherigen Zweck ist ohnehin geschützt; wird er ' +
	'erheblich und dauernd erschwert, ist die Person betroffen. Eine nur auf Zusehen hin, ' +
	'also vorläufig, bewilligte Umwandlung ist keine dauernde Erschwerung. Die Erschwerung ' +
	'muss objektiv sein, so wie ein Durchschnittsmensch sie empfindet. Betroffen ist auch, ' +
	'wem die Kosten nicht zuzumuten sind, insbesondere weil sie in keinem Verhältnis zum ' +
	'Wert seines Anteils stehen; die persönliche finanzielle Lage zählt mit. Die übrigen ' +
	'können die Zustimmung ersetzen, wenn sie den Teil übernehmen, der ihm nicht zumutbar ' +
	'ist (Abs. 3). Sind Sie unsicher, erfassen Sie die Person und holen Sie die Zustimmung ' +
	'ein.';

export const NUTZLICH_BETROFFEN_WEBSITE =
	'Betroffen ist, wessen Gebrauch oder Benutzung der gemeinsamen Sache durch die Massnahme ' +
	'für den bisherigen Zweck erheblich und dauernd erschwert oder unwirtschaftlich wird. ' +
	'Das gilt auch bei einem Teil im Sonderrecht oder bei einer Sondernutzung. Dann braucht ' +
	'es die Zustimmung der Person. Wer eine Fläche allein nutzt, ist dafür geschützt, wenn ' +
	'ihm das bei der Gründung des Stockwerkeigentums, im Reglement oder durch Beschluss ' +
	'eingeräumt wurde. Durfte er sie nur formlos nutzen, hat er daraus kein Vetorecht. Der ' +
	'Gebrauch der gemeinsamen Teile zum bisherigen Zweck ist ohnehin geschützt; wird er ' +
	'erheblich und dauernd erschwert, ist die Person betroffen. Eine nur auf Zusehen hin, ' +
	'also vorläufig, bewilligte Umwandlung ist keine dauernde Erschwerung. Die Erschwerung ' +
	'muss objektiv sein, so wie ein Durchschnittsmensch sie empfindet. Betroffen ist auch, ' +
	'wem die Kosten nicht zuzumuten sind, insbesondere weil sie in keinem Verhältnis zum ' +
	'Wert seines Anteils stehen; die persönliche finanzielle Lage zählt mit. Die übrigen ' +
	'können die Zustimmung ersetzen, wenn sie den Teil übernehmen, der ihm nicht zumutbar ' +
	'ist (Abs. 3).';

/**
 * Der Kostenhinweis (Art. 647d Abs. 3) und seine Fassung für die Website.
 * Die Anwendung sagt der Leitung, was sie erfassen und im Antragstext
 * festhalten soll; auf der Website bleibt die Rechtslage.
 */
export const NUTZLICH_KOSTEN_ANWENDUNG =
	'Sind einem Eigentümer die Kosten nicht zuzumuten, geht die Massnahme ohne seine ' +
	'Zustimmung nur, wenn die übrigen den unzumutbaren Teil übernehmen (ZGB Art. 647d ' +
	'Abs. 3). Beschliessen sie die Übernahme, halten Sie sie im Antragstext fest, auch ' +
	'wenn das erst in der Versammlung geschieht. Dann ist die Person nicht als ' +
	'betroffen zu erfassen, soweit es nur um die Kosten geht. Kommt die Übernahme ' +
	'nicht zustande, erfassen Sie die Person und holen Sie die Zustimmung ein. Ist ' +
	'zusätzlich der Gebrauch erheblich und dauernd erschwert, bleibt die Zustimmung ' +
	'nötig, auch wenn die übrigen die Kosten übernehmen.';

export const NUTZLICH_KOSTEN_WEBSITE =
	'Sind einem Eigentümer die Kosten nicht zuzumuten, geht die Massnahme ohne seine ' +
	'Zustimmung nur, wenn die übrigen den unzumutbaren Teil übernehmen (ZGB Art. 647d ' +
	'Abs. 3). Ist zusätzlich der Gebrauch erheblich und dauernd erschwert, bleibt die ' +
	'Zustimmung nötig, auch wenn die übrigen die Kosten übernehmen.';

const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	// ZGB Art. 647d Abs. 2 und 3; Rz. 128 bis 130 ad Art. 712a, Rz. 208 bis 211
	// ad Art. 712g (Zustimmungsform). Für das formlose Nutzen trägt BGE 136
	// III 261 E. 3.2, E. 3.3 und E. 4.3 (im Repo), daneben der Beobachter
	// S. 161 f.; für Sonderrecht und Sondernutzung allein BGer 5A_972/2020
	// E. 5.3 (im Repo).
	'k-baulich-nuetzlich': {
		rechtsgrundlage: 'ZGB Art. 647d Abs. 1 bis 3',
		zustimmungBetroffenerNoetig: true,
		betroffenenzustimmung: 'im_saal_oder_vorab',
		betroffeneErlaeuterung: NUTZLICH_BETROFFEN_ANWENDUNG,
		hinweise: [
			'Auch bei erreichtem Mehr: Wird einem Eigentümer der Gebrauch erheblich und dauernd ' +
				'erschwert, geht es nicht ohne seine Zustimmung (ZGB Art. 647d Abs. 2). Betroffene ' +
				'stimmen beim Mehr mit; ihre Zustimmung ist ein zweites, eigenes Erfordernis.',
			NUTZLICH_KOSTEN_ANWENDUNG
		]
	}
};

export const REGELWERK_2026_10_13 = {
	...REGELWERK_2026_10_12,
	fassung: '2026-10-13',

	quellen: [
		...REGELWERK_2026_10_12.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 128 bis 130 (nützliche Massnahmen, die ' +
			'drei Ausnahmen mit Zustimmungserfordernis, objektiver Massstab) und Art. 712g Rz. 208 ' +
			'bis 211 (Vetorecht als Zustimmungserfordernis, Zustimmung im Saal oder vorab ' +
			'schriftlich); BGE 136 III 261 E. 3.2 bis E. 4.3 (blosse Duldung begründet kein ' +
			'Vetorecht, ein ausschliessliches Nutzungsrecht kann nicht formlos begründet werden; ' +
			'im Repo); BGer 5A_972/2020 E. 5.3 (Sonderrecht oder Sondernutzung; im Repo); ' +
			'Beobachter «Stockwerkeigentum» S. 161 f. (formlose Erlaubnis). **Grenze der ' +
			'Fundstelle:** Rz. 129 zitiert für die Sonderrechtsaussage BGE 136 III 261 E. 3.3, was ' +
			'E. 3.3 nicht sagt; BGer 5A_1004/2018 wird in Rz. 129 als Regel für ' +
			'Entkalkungsanlagen gelesen, entschieden ist nur die appellatorische und die neue Rüge ' +
			'(beide im Repo, `quellen`, `themen/stockwerkeigentum/entscheide.md`).'
	],

	freigabevermerk:
		REGELWERK_2026_10_12.freigabevermerk +
		' Am 04.10.2026 verlangt Votum an der nützlichen baulichen Massnahme zusätzlich zum ' +
		'qualifizierten Mehr die Zustimmung der Betroffenen, die sie erheblich und dauernd ' +
		'betrifft (ZGB Art. 647d Abs. 2). Wem die Kosten nicht zuzumuten sind, muss nur ' +
		'zustimmen, wenn die übrigen den unzumutbaren Teil nicht übernehmen (Abs. 3). Die Texte ' +
		'gingen durch drei Runden Laien- und Fachprüfung.',

	knoten: REGELWERK_2026_10_12.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		return neu ? { ...k, ...neu } : k;
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
