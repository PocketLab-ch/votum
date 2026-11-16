/**
 * Regelwerk, Fassung 2026-09-25.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung berichtigt drei Beispiele der
 * Fassung 2026-09-24 und lässt alles Übrige, wie es ist. Die Vorfassung wird
 * nicht angefasst: Sie ist seit dem 22.09.2026 im Betrieb, und ein Traktandum
 * speichert die Fassungskennung, unter der sein Erfordernis hergeleitet wurde.
 *
 * Anlass sind die Befunde **B-17** und **B-18** aus dem Bericht der
 * Fachprüfung vom 22.09.2026, beide mit Wortlautvorschlag. Produktentscheid
 * 22.09.2026.
 *
 * ---
 *
 * **B-17: `k-benutzungsweise` verkürzte den Sachverhalt falsch.**
 *
 * Das Beispiel lautete «Verbot einer Kinderkrippe in einer Wohnung
 * (BGer 5A_352/2012)». Im Entscheid ging es um «locaux avec affectation
 * tertiaire», also Räume mit gemischter Zweckbestimmung, die noch nie genutzt
 * worden waren. Das Verbot hielt als blosse **Präzisierung** dieser
 * bestehenden Zweckbestimmung durch eine Reglementsänderung mit
 * qualifiziertem Mehr, gerade **weil** es keine Zweckänderung war (E. 3.3 und
 * 4.3). Bei einer Einheit, die im Reglement dem Wohnen gewidmet ist, liegt der
 * Fall anders und kann nach E. 4.3.3 in Art. 648 Abs. 2 kippen.
 *
 * Die Verkürzung war keine unmittelbare Fehlhandlung, weil die Karte für
 * Grenzfälle auf `k-grenzfall-nutzung` verweist. Angefochten wird aber die
 * Begründung, und die Karte behauptete etwas anderes, als der Entscheid sagt.
 *
 * **Und sie war der Grund für einen zweiten Befund.** Beim Einbauen der
 * Fassung 2026-09-24 fiel im Code-Review auf, dass zwei Karten desselben
 * Astes dieselbe Lebenslage mit gegenläufigem Ergebnis führten: eine
 * Kinderkrippe mit qualifiziertem Mehr hier, gewerbsmässige Kinderbetreuung
 * mit Einstimmigkeit auf der Grenzfallkarte. Das zweite Beispiel wurde
 * deshalb herausgenommen. Mit dem berichtigten Wortlaut löst sich der
 * Widerspruch auf: Nicht die Tätigkeit entscheidet, sondern wie der Zweck der
 * betroffenen Einheit ursprünglich gefasst war.
 *
 * ---
 *
 * **B-18: eine Erwägung, die ihre Aussage nicht trägt, an zwei Stellen.**
 *
 * `k-zweckbestimmung` belegte «Aus Wohnungen werden Hotelzimmer» mit
 * BGer 5A_632/2011 **E. 4.3**. Diese Erwägung stellt nur fest, **dass** die
 * Liegenschaft überhaupt eine Zweckbestimmung hat («Entgegen der Darstellung
 * der Beklagten ergibt sich aus der Gemeinschaftsordnung eine Zweckbestimmung
 * der Liegenschaft»). Die Aussage, die die Karte belegen will, steht in
 * **E. 5.2.1** und **E. 5.3**.
 *
 * **Dieselbe falsche Angabe stand zwei Stunden lang auch auf
 * `k-grenzfall-nutzung`** (Fassung 2026-09-24, committet um 16:15, berichtigt
 * um 18:30), und sie stammt von hier: Beim Ausbauen jener Karte wurde die
 * Fundstelle aus der Nachbarkarte übernommen, ohne sie am Entscheid zu
 * prüfen. Der Bericht der Fachprüfung lag zu diesem Zeitpunkt vor und nannte
 * den Befund bereits.
 *
 * Der kurze Abstand macht die Sache schärfer, nicht milder: Eine Fundstelle,
 * die anderswo im Haus schon als nicht tragend vermerkt ist, wandert trotzdem
 * weiter, solange man sie kopiert statt sie aufzuschlagen. Zwei Stunden
 * genügten dafür.
 *
 * **Und sie ist weitergewandert als nur auf eine zweite Karte.** Das
 * autoritative Quellen-Repo führt sie in
 * `quellen/themen/stockwerkeigentum/entscheide.md` ebenfalls, mit dem
 * Vermerk «Alle drei aus `src/data/quorumsbaum.json`». Die Karte hat ihren
 * Fehler also an die Quelle zurückgegeben, aus der man ihn später wieder
 * abschreibt. Berichtigt im selben Arbeitsgang, in einem eigenen Commit
 * dort.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_09_24 } from './quorum-2026-09-24';

const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	'k-benutzungsweise': {
		beispiele: [
			'Verbot einer bestimmten gewerblichen Nutzung in Räumen mit gemischter ' +
				'Zweckbestimmung (BGer 5A_352/2012 E. 4.3.3)'
		]
	},

	'k-zweckbestimmung': {
		beispiele: [
			'Aus Wohnungen werden Hotelzimmer (BGer 5A_632/2011 E. 5.2.1 und 5.3, mit ' +
				'Parallelverfahren 5A_648/2011)',
			'Reglementsänderung, die aus ruhigem Wohnen generell Gewerbe zulässt ' +
				'(BGer 5A_98/2017 E. 3.3)'
		]
	},

	'k-grenzfall-nutzung': {
		beispiele: [
			'Zweckänderung: Aus Wohnungen werden Hotelzimmer (BGer 5A_632/2011 E. 5.2.1 und 5.3).',
			'Keine Zweckänderung: Aus einem Lebensmittelladen wird eine Apotheke, wenn für den ' +
				'Anteil von Anfang an eine kommerzielle Nutzung vorgesehen war (Art. 712a Rz. 150b).'
		]
	}
};

export const REGELWERK_2026_09_25 = {
	...REGELWERK_2026_09_24,
	fassung: '2026-09-25',

	freigabevermerk:
		REGELWERK_2026_09_24.freigabevermerk +
		' Am 25.09.2026 wurden drei Beispiele berichtigt. Das Verbot bei der Benutzungsweise ' +
		'betraf Räume mit gemischter Zweckbestimmung, nicht eine Wohnung; die Karte sagt das ' +
		'jetzt. Und die Erwägung bei BGer 5A_632/2011 lautet E. 5.2.1 und 5.3, nicht E. 4.3: ' +
		'Die bisher genannte Stelle stellt nur fest, dass die Liegenschaft überhaupt eine ' +
		'Zweckbestimmung hat. Am Erfordernis ändert sich nichts.',

	knoten: REGELWERK_2026_09_24.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		return neu ? { ...k, ...neu } : k;
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
