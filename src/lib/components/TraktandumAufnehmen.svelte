<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import Wahlliste from './Wahlliste.svelte';
	import Suchauswahl from './Suchauswahl.svelte';
	/**
	 * Ein Traktandum während der Sitzung aufnehmen (Stories 5.11 und 5.12, FR-43).
	 *
	 * **Warum eine Komponente.** Dasselbe Formular wird an zwei Stellen gebraucht:
	 * am aufgerufenen Traktandum als «Gegenantrag» — dort steht der Grundantrag
	 * fest —, und unter der Traktandenliste als der allgemeine Weg, auf dem sich
	 * auch eine gar nicht angekündigte Sache aufnehmen lässt. Zweimal
	 * abgeschrieben liefen die beiden auseinander, und die Fassung, an der man
	 * gerade nicht arbeitet, ist immer die falsche (docs/gestaltung.md, «Eine
	 * Umwandlung, nicht zwei Abschriften»).
	 *
	 * **Steht der Grundantrag fest**, fallen zwei Felder weg: «Was ist das?» und
	 * die Auswahl des Grundantrags. Beide hätten dort nur eine mögliche Antwort —
	 * und ein Feld mit einer einzigen Möglichkeit sieht aus wie eine Entscheidung,
	 * die man auch anders treffen könnte.
	 */
	import { untrack } from 'svelte';
	import { gefuehrteWahl } from '$lib/felder';
	import { erfordernisabweichung } from '$lib/domain/folgeantrag';
	import {
		empfehlungMitReglement,
		empfehlungUniversal,
		NICHT_ANGEKUENDIGT_AM_ABEND,
		NICHT_ANGEKUENDIGT_GRUNDSATZ,
		NICHT_ANGEKUENDIGT_OHNE_REGLEMENT,
		NICHT_ANGEKUENDIGT_WEGE,
		type Universalvariante
	} from '$lib/domain/ausnahmen';
	import type { Ergebnistyp } from '$lib/domain/regelwerk';

	interface Grundantrag {
		id: string;
		nummer: string;
		titel: string;
		erfordernisTyp: Ergebnistyp | null;
		/** Das Mehr, das die Einladung nennt, in Worten; `null` ohne Untergrenze. */
		einladungsmehr: { worte: string; zuMild: string[]; geerbtZuMild: boolean } | null;
		/** Wer beim Grundantrag als betroffen eingetragen ist: die Vorauswahl (Block A3b). */
		betroffene: string[];
	}

	interface Props {
		/** Die angekündigten Anträge, an die ein Folgeantrag anknüpfen kann. */
		grundantraege: Grundantrag[];
		erfordernisse: { knotenId: string; astTitel: string; titel: string; typ: Ergebnistyp }[];
		parteien: { id: string; name: string }[];
		/**
		 * Das Traktandum, in dessen Kern der Antrag liegt — wenn es feststeht.
		 * Dann ist nur der Folgeantrag möglich, und die beiden Auswahlfelder
		 * darüber entfallen.
		 */
		festerGrundantrag?: string | null;
		/** Der Anfangswert der Grundantragswahl im allgemeinen Weg. */
		vorgewaehlt?: string;
		/**
		 * Die Versammlung, in die aufgenommen wird — nur am gemeinsamen Abend.
		 *
		 * Dort führt eine Route mehrere Häuser, und das Formular muss sagen,
		 * welches gemeint ist. In der Leitung eines Hauses steht es im Pfad.
		 */
		versammlungId?: string | null;
		/**
		 * Die Fundstelle, wenn das Reglement Beschlüsse über nicht angekündigte
		 * Gegenstände gestattet, wie es bei der Freigabe stand (Migration 127).
		 * Nur dann lässt sich ein neues Geschäft zur Abstimmung aufnehmen.
		 */
		ausnahmeReglement?: string | null;
		/**
		 * Die Universalversammlung im Moment (Migration 128): die eingefrorene
		 * Variante, ob alle da sind, und sonst die Gründe. Null, wo sie nicht in
		 * Frage kommt (am Abend oder ohne Freigabe).
		 */
		ausnahmeUniversal?: {
			variante: Universalvariante;
			leitungsvollmachtenZaehlen?: boolean;
			vollzaehlig: boolean;
			gruende: string[];
		} | null;
		/**
		 * Ob die Versammlung zu einem gemeinsamen Abend gehört. Dann gibt es die
		 * Abstimmung über ein neues Geschäft nicht, und der Satz sagt warum.
		 */
		amAbend?: boolean;
	}

	let {
		grundantraege,
		erfordernisse,
		parteien,
		festerGrundantrag = null,
		vorgewaehlt = '',
		versammlungId = null,
		ausnahmeReglement = null,
		ausnahmeUniversal = null,
		amAbend = false
	}: Props = $props();

	/** Die Universalversammlung trägt, wenn das Reglement nicht schon trägt. */
	const universalMoeglich = $derived(
		!ausnahmeReglement &&
			!amAbend &&
			ausnahmeUniversal?.variante !== 'keine' &&
			ausnahmeUniversal?.vollzaehlig === true
	);

	/*
	 * **Voreingestellt ist «nicht angekündigt»**, nicht der Folgeantrag: Wer
	 * umstellt, sagt damit ausdrücklich, dass die Sache im Kern eines
	 * angekündigten Antrags liegt — und trifft sichtbar die Beurteilung. Umgekehrt
	 * wäre die Voreinstellung ein stiller Freibrief.
	 */
	// Bewusst nur der Anfangswert — danach gehört das Feld der Sitzungsleitung.
	// `untrack`, weil ein nachziehender Wert die Eingabe unter den Händen
	// zurücksetzte; dasselbe Muster wie überall in dieser Anwendung.
	let spontanart = $state<'neu' | 'folgeantrag'>(
		untrack(() => (festerGrundantrag ? 'folgeantrag' : 'neu'))
	);
	let folgeantragsart = $state<'abstimmung' | 'kenntnisnahme'>('abstimmung');
	/*
	 * **Beim neuen Geschäft ist die Kenntnisnahme vorgewählt**, auch wenn das
	 * Reglement den Beschluss gestattet: Die herrschende Lehre rät von der
	 * Benutzung ab (Rz. 38 ad Art. 712n). Wer abstimmen lässt, wählt es.
	 */
	let neuart = $state<'abstimmung' | 'kenntnisnahme'>('kenntnisnahme');
	let gewaehlterGrundantrag = $state(untrack(() => festerGrundantrag ?? vorgewaehlt));
	let gewaehltesErfordernis = $state('');

	/**
	 * **Eine Wahl, die keine Option mehr hat, fällt weg** (07.09.2026, aus dem
	 * Code-Review).
	 *
	 * Der Anfangswert oben ist eingefroren, und das soll er bleiben — sonst zöge
	 * das Feld der Sitzungsleitung unter den Händen nach. Seit die Auswahl auch
	 * den entschiedenen, den zurückgezogenen und den gerade abgestimmten Antrag
	 * weglässt, kann sie sich aber **während** des offenen Formulars ändern: Wer
	 * es aufklappt, während über den Grundantrag noch nicht entschieden ist, und
	 * die Abstimmung dazwischen schliesst, hätte sonst einen Antrag gewählt, den
	 * die Liste darunter nicht mehr führt — und der Server weist ihn ab.
	 *
	 * Zurückgesetzt wird nur in diese eine Richtung: nichts wird gewählt, nur
	 * eine unmöglich gewordene Wahl geräumt.
	 */
	$effect(() => {
		if (festerGrundantrag) return;
		if (gewaehlterGrundantrag && !grundantraege.some((t) => t.id === gewaehlterGrundantrag)) {
			gewaehlterGrundantrag = '';
		}
	});

	const alsFolgeantrag = $derived(spontanart === 'folgeantrag');

	/**
	 * Wer den Antrag stellt — **mehrere möglich, mit Schnellsuche**.
	 *
	 * Gemeldet am 21.08.2026: «Die Schnellsuche bei Antragsteller fehlt. Inkl
	 * Selektion.» Dieselbe Not wie beim Ausstand: Bei achtzig Parteien findet
	 * niemand einen Namen in einem Aufklappfeld, und einen Gegenantrag stellen
	 * oft mehrere gemeinsam.
	 */
	let gewaehlteAntragsteller = $state<string[]>([]);

	/**
	 * **Die Betroffenen des Grundantrags als Vorschlag** (Block A3b, 26.09.2026).
	 *
	 * Wer betroffen ist, folgt aus dem Inhalt des Antrags, nicht aus einer
	 * Bezeichnung vor der Versammlung (`quellen`, Frage 46). Ein Folgeantrag hält
	 * sich im Kern des Grundantrags, trifft also meist dieselben Eigentümer;
	 * deshalb stehen sie angekreuzt da, und die Leitung ändert, wo er andere
	 * trifft. Bis dahin hatte ein im Saal aufgenommener Folgeantrag nie
	 * Betroffene, und die Sperre beim Eröffnen hielt ihn auf, bis jemand sie von
	 * Hand nachtrug.
	 *
	 * Nur wer in der Wahlliste steht: Eine Partei ausserhalb des Stands trüge
	 * `Wahlliste` sonst unsichtbar weiter mit, und der Server wiese sie ab.
	 */
	function vorschlagFuer(grundantragId: string): string[] {
		const ids = grundantraege.find((t) => t.id === grundantragId)?.betroffene ?? [];
		return ids.filter((id) => parteien.some((p) => p.id === id));
	}
	let gewaehlteBetroffene = $state<string[]>(
		untrack(() => vorschlagFuer(festerGrundantrag ?? vorgewaehlt))
	);
	/*
	 * **Wann der Vorschlag die Auswahl ersetzt.** Wechselt der Grundantrag,
	 * gilt dessen Vorschlag. Ändert sich der Vorschlag am selben Grundantrag
	 * (unter «Betroffene» ein- oder ausgetragen, während dieses Formular offen
	 * steht; im allgemeinen Weg der Leitungsseite bleibt es montiert), zieht
	 * die Auswahl nur mit, solange die Leitung sie nicht angefasst hat
	 * (Codeprüfung A3b). Sonst versprach «Vom Grundantrag übernommen» eine
	 * Übernahme, die nicht stattfand.
	 *
	 * Merkvariablen statt `$state`: Sie sollen den Effekt nicht selbst
	 * auslösen, nur den Wechsel erkennen. Ohne sie setzte jedes neue Laden der
	 * Seite die Auswahl der Leitung auf den Vorschlag zurück.
	 */
	const gleicheMenge = (a: string[], b: string[]) =>
		a.length === b.length && a.every((x) => b.includes(x));
	let vorschlagsgrund = untrack(() => gewaehlterGrundantrag);
	let letzterVorschlag = untrack(() => vorschlagFuer(gewaehlterGrundantrag));
	$effect(() => {
		const vorschlag = vorschlagFuer(gewaehlterGrundantrag);
		const wechsel = gewaehlterGrundantrag !== vorschlagsgrund;
		if (!wechsel && gleicheMenge(vorschlag, letzterVorschlag)) return;
		const unberuehrt = untrack(() => gleicheMenge(gewaehlteBetroffene, letzterVorschlag));
		vorschlagsgrund = gewaehlterGrundantrag;
		letzterVorschlag = vorschlag;
		if (wechsel || unberuehrt) gewaehlteBetroffene = vorschlag;
	});
	const vorgeschlagen = $derived(vorschlagFuer(gewaehlterGrundantrag));

	/**
	 * Alles zurück auf Anfang, nachdem ein Traktandum aufgenommen wurde.
	 *
	 * **Warum das von Hand geschehen muss.** Der Kasten steht dauerhaft da; ihn
	 * zuzuklappen und damit zu zerstören, wie es die Traktandenseite beim
	 * Anlegen tut, ist hier kein Weg. Und `form.reset()` erreicht diese fünf
	 * Werte nicht: Sie sind `$state`, einer davon in einem Kindbaustein. Vorher
	 * räumte das Neuladen sie auf; seit dem 28.08.2026 lädt die Seite nicht
	 * mehr neu, und die Sitzungsleitung fände im Saal das eben aufgenommene
	 * Traktandum noch vollständig ausgefüllt vor — mit einem Knopf, der es ein
	 * zweites Mal aufnähme.
	 *
	 * **Titel und Wortlaut erledigt `form.reset()`**, und darauf stützt sich
	 * auch die Zeile mit `spontanart`: Svelte setzt an einem `<select>` nur das
	 * `selected`-Attribut, und das greift an einem vom Benutzer angefassten
	 * Feld erst wieder, wenn `reset()` dessen Dirtiness gelöscht hat. Ein
	 * `reset: false` an diesem Formular machte den Rücksprung also lautlos
	 * wirkungslos.
	 */
	function wiederLeer(): void {
		spontanart = festerGrundantrag ? 'folgeantrag' : 'neu';
		folgeantragsart = 'abstimmung';
		neuart = 'kenntnisnahme';
		gewaehlterGrundantrag = festerGrundantrag ?? vorgewaehlt;
		gewaehltesErfordernis = '';
		gewaehlteAntragsteller = [];
		vorschlagsgrund = gewaehlterGrundantrag;
		letzterVorschlag = vorschlagFuer(gewaehlterGrundantrag);
		gewaehlteBetroffene = letzterVorschlag;
	}

	/*
	 * **Die Untergrenze aus der Einladung vor dem Absenden** (Codeprüfung 1 und
	 * Fachprüfung FP-3 vom 06.10.2026; Produktentscheid 06.10.2026, «Ja,
	 * dieselbe Untergrenze»). Ohne diesen Satz erfuhr die Leitung erst nach dem
	 * Aufnehmen, dass das gewählte Mehr nicht gesetzt ist.
	 *
	 * **Ob das Mehr sie hält, rechnet der Server** (zweite Runde, Laienprüfung
	 * R2-4, Codeprüfung M1, Fachprüfung FP2-10): Hier stand ein Zusatz an der
	 * Warnung «schwächer», die nur den Typ vergleicht. Bei gleichem Typ und
	 * anderer Reglementsregel schwieg er, und bei schwächerem Typ über einer
	 * milden Einladung warnte er zu Unrecht. `zuMild` kommt aus derselben
	 * Rechnung wie die Absage beim Setzen (`grenzeFuerFolgeantrag`).
	 */
	const untergrenze = $derived.by(() => {
		const g = grundantraege.find((t) => t.id === gewaehlterGrundantrag);
		return g?.einladungsmehr ? { grund: `${g.nummer} ${g.titel}`, ...g.einladungsmehr } : null;
	});
	const zuMild = $derived(
		untergrenze === null
			? null
			: gewaehltesErfordernis
				? untergrenze.zuMild.includes(gewaehltesErfordernis)
					? 'gewählte'
					: null
				: null
	);

	const abweichung = $derived(
		erfordernisabweichung(
			grundantraege.find((t) => t.id === gewaehlterGrundantrag)?.erfordernisTyp ?? null,
			erfordernisse.find((e) => e.knotenId === gewaehltesErfordernis)?.typ ?? null
		)
	);
</script>

<form method="POST" action="?/aufnehmen" use:enhance={absenden({ beiErfolg: wiederLeer })}>
	{#if versammlungId}
		<input type="hidden" name="versammlung" value={versammlungId} />
	{/if}
	{#if festerGrundantrag}
		<input type="hidden" name="spontanart" value="folgeantrag" />
		<input type="hidden" name="grundantrag" value={festerGrundantrag} />
	{:else}
		<label>
			Was ist das?
			<!--
				`use:gefuehrteWahl` und `selected` statt `bind:value`: Die Wahl schaltet
				das halbe Formular um, muss dem Programm also bekannt sein — `bind:value`
				löschte dabei eine Wahl, die vor der Hydration getroffen wurde
				(`$lib/felder`, `gefuehrteWahl`). Die Zuordnung ist ausgeschrieben statt
				als Typzusicherung: Was nicht «folgeantrag» heisst, ist «neu», und das ist
				die vorsichtigere der beiden Antworten.
			-->
			<select
				name="spontanart"
				use:gefuehrteWahl={(w) => (spontanart = w === 'folgeantrag' ? 'folgeantrag' : 'neu')}
			>
				<option value="neu" selected={spontanart === 'neu'}>
					Eine Sache, die heute nicht angekündigt war
				</option>
				<option
					value="folgeantrag"
					selected={spontanart === 'folgeantrag'}
					disabled={grundantraege.length === 0}
				>
					Ein Folgeantrag zu einem angekündigten Antrag
				</option>
			</select>
		</label>
		<!--
			**Ein gesperrter Eintrag ohne Grund ist eine Frage ohne Antwort**
			(07.09.2026, aus dem Code-Review). Die Sperre gab es schon; leer war die
			Liste vorher aber fast nie. Seit sie den entschiedenen, den
			zurückgezogenen und den gerade abgestimmten Antrag weglässt, ist der
			leere Fall gegen Ende des Abends der Normalfall — und dann steht dort
			ein graues Feld, während die Erklärung nur in einer Absage steckt, die
			sich gar nicht mehr auslösen lässt.
		-->
		{#if grundantraege.length === 0}
			<p class="klein">
				Zurzeit trägt kein angekündigter Antrag einen Folgeantrag: Über alle ist entschieden,
				sie sind zurückgezogen, oder es wird gerade über sie abgestimmt. Soll eine
				entschiedene Sache nochmals aufgerollt werden, braucht es einen Rückkommensantrag —
				den stellt die Versammlung, nicht die Sitzungsleitung.
			</p>
		{/if}
		{#if alsFolgeantrag}
			<label>
				Grundantrag, in dessen Kern er liegt
				<!--
					**Der Leereintrag ist hier kein Zierat** (26.08.2026, aus dem
					Code-Review). Ohne ihn trägt keine Option ein `selected`, der Browser
					wählt die erste, und `pflicht` sperrt nichts mehr: Wer auf
					«Folgeantrag» umstellt und abschickt, ohne das Feld anzufassen, hängt
					seinen Antrag an das erstbeste Traktandum — samt dessen Erfordernis.
				-->
				<Suchauswahl
					name="grundantrag"
					beschriftung="Grundantrag, in dessen Kern er liegt"
					leerText="— wählen —"
					pflicht
					bind:wert={gewaehlterGrundantrag}
					eintraege={grundantraege.map((t) => ({ wert: t.id, text: `${t.nummer} ${t.titel}` }))}
				/>
			</label>
		{/if}
	{/if}

	<!--
		**Die Reihenfolge folgt dem Gespräch im Saal** (21.08.2026): Wer stellt den
		Antrag, was ist es, wie heisst er, was steht drin — und zuletzt, mit
		welchem Mehr. Das Quorum steht am Ende, weil es sich aus dem Antragstext
		ergibt und nicht umgekehrt.
	-->
	<fieldset class="antragsteller">
		<legend>Wer den Antrag stellt</legend>
		<Wahlliste
			name="antragsteller"
			eintraege={parteien}
			suchbeschriftung="Antragsteller suchen"
			leerhinweis="Niemand gewählt — dann stellt ihn die Gemeinschaft. Mehrere möglich."
			bind:gewaehlt={gewaehlteAntragsteller}
		/>
	</fieldset>

	{#if alsFolgeantrag}
		<label>
			Art
			<!-- Wie oben: die Wahl entscheidet, ob das Erfordernis darunter steht. -->
			<select
				name="art"
				use:gefuehrteWahl={(w) =>
					(folgeantragsart = w === 'kenntnisnahme' ? 'kenntnisnahme' : 'abstimmung')}
			>
				<option value="abstimmung" selected={folgeantragsart === 'abstimmung'}>Abstimmung</option>
				<option value="kenntnisnahme" selected={folgeantragsart === 'kenntnisnahme'}>
					Kenntnisnahme — kein Beschluss
				</option>
			</select>
		</label>
		<label>
			Titel
			<input name="titel" required minlength="3" maxlength="200" />
		</label>

		<!--
			**Der Antragstext trägt keine Namen** — und das ist keine Bitte, sondern
			der Aufbau: Wer den Antrag stellt, steht im Feld darüber. Damit lässt
			sich der Text an ein Sprachmodell geben, ohne dass Personendaten
			mitgehen (21.08.2026).
		-->
		<!--
			**Hier kein Musterwortlaut**, anders als beim Anlegen eines Traktandums
			und im Geschäftsplaner (Antragsvorschlag.svelte, B-18). Das ist kein
			Vergessen: Ein Spontanantrag wird im Saal mündlich gestellt, und was
			hier steht, ist die Mitschrift dessen, was jemand gesagt hat. Ein
			Vorschlag der Anwendung träte an die Stelle eines fremden Wortlauts —
			und niemand merkte es, weil er sich gut liest.
		-->
		<label>
			Antragstext
			<textarea name="antragswortlaut" rows="3" placeholder="Worüber abgestimmt wird — ohne Namen"
			></textarea>
			<span class="hilfe">
				Nur die Sache. Wer ihn stellt, steht oben und kommt im Protokoll davor.
			</span>
		</label>

		{#if folgeantragsart === 'abstimmung'}
			<!--
				**Das Erfordernis gleich hier, nicht zwei Seiten weiter.**

				Ein Folgeantrag entsteht im Saal, und vor der Abstimmung braucht er ein
				Mehrheitserfordernis. Es über den Entscheidbaum zu holen heisst: Seite
				verlassen, Fragen beantworten, zurückkommen — vor vierzehn wartenden
				Menschen. Wer den Fall kennt, wählt ihn hier.
			-->
			<label>
				Mehrheitserfordernis
				<!--
					**Ohne Vorbelegung** (Produktentscheid 08.10.2026). Bis dahin
					erbe der Folgeantrag das Erfordernis des Grundantrags als
					Vorschlag; damit stand im Verlauf «von Hand gewählt», wo
					niemand gewählt hatte. Jetzt bekommt er die Herleitung wie ein
					neu angelegtes Traktandum: hier wählen, oder das Traktandum
					aufnehmen und danach in seiner Zeile über «Nötige Mehrheit
					ändern» den Entscheidbaum nehmen — der Baum selbst ist im
					Formular nicht zur Hand, er liegt auf der Erfordernisseite
					(Codeprüfung 09.10.2026).
				-->
				<Suchauswahl
					name="erfordernis"
					beschriftung="Mehrheitserfordernis"
					leerText="— später bestimmen —"
					bind:wert={gewaehltesErfordernis}
					eintraege={erfordernisse.map((e) => ({
						wert: e.knotenId,
						text: `${e.astTitel} · ${e.titel}`
					}))}
				/>
				{#if untergrenze}
					<span class="hilfe">
						Die Einladung nennt für «{untergrenze.grund}» {untergrenze.worte}. Ein milderes Mehr
						nach Köpfen, Wertquoten oder Enthaltungen lässt die Anwendung im Saal auch für den
						Folgeantrag nicht zu.
					</span>
				{/if}
				{#if zuMild}
					<span class="hilfe warnung">
						<!-- Runde 4 (Laienprüfung R4-3 a, Fachprüfung FP4-6, 06.10.2026): der Weg,
						     wenn das mildere gelten soll, statt «nehmen Sie ihn mit voller Frist auf».
						     «da» statt «in der Liste»: Am Abend ist er ein Schritt im Ablauf. -->
						Das {zuMild} Mehr ist milder als das der Einladung; die Anwendung setzt es beim
						Aufnehmen nicht. Wählen Sie das Mehr der Einladung oder ein strengeres. Soll das
						mildere gelten, nehmen Sie den Antrag trotzdem auf: Er steht dann ohne Mehr da. Zieht die
						Antragstellerin ihn zurück oder verschiebt die Versammlung ihn, halten Sie das mit
						«Antrag zurückziehen» fest. Dann nehmen Sie ihn mit voller Frist als eigenes Traktandum in
						die Einladung zu einer weiteren Versammlung auf; sonst setzen Sie das Mehr der Einladung.
					</span>
				{/if}
				<!--
					Neben der Warnung «zu mild» nicht noch «schwächer» (Laienprüfung R3-4 a,
					06.10.2026): Beide sagten dasselbe in zwei Tonlagen, und «begründungsbedürftig»
					klang, als liesse sich das mildere Mehr mit einer Begründung doch setzen.
				-->
				{#if abweichung.text && !(zuMild && abweichung.art === 'schwaecher')}
					<span class="hilfe" class:warnung={abweichung.art === 'schwaecher'}>
						{abweichung.text.replaceAll('**', '')}
					</span>
				{/if}
			</label>

			<!--
				Nur, wo der Grundantrag Betroffene trägt: Sonst gibt es nichts
				vorzuschlagen, und eintragen lässt sich wie bisher unter «Betroffene».
			-->
			{#if vorgeschlagen.length > 0}
				<fieldset class="antragsteller">
					<legend>Unmittelbar betroffen</legend>
					<Wahlliste
						name="betroffene"
						eintraege={parteien}
						suchbeschriftung="Betroffene suchen"
						leerhinweis="Niemand gewählt. Verlangt das Erfordernis die Zustimmung Betroffener, lässt sich ohne Eintrag nicht abstimmen. Ein anderes Mehrheitserfordernis passt, wenn der Folgeantrag weder ein bestehendes Nutzungsrecht noch die Wertquoten berührt. Das gilt nur, wenn er zudem keine nützliche bauliche Massnahme ist. Gemeint ist eine, die jemandem den Gebrauch erheblich und dauernd erschwert oder unwirtschaftlich macht oder ihm unzumutbare Kosten auferlegt. Wählen Sie es dann oben."
						bind:gewaehlt={gewaehlteBetroffene}
					/>
					<span class="hilfe">
						Vom Grundantrag übernommen. Wer betroffen ist, ergibt sich aus dem Inhalt des
						Folgeantrags. Bei einem Nutzungsrecht ist es, wer es heute hat, und zwar bei jeder
						Änderung, auch einer Erweiterung oder einer anderen Dauer, Entschädigung oder
						Unterhaltspflicht. Wer es erst erhalten soll, gilt in der Regel nicht als
						betroffen. Bei den Wertquoten ist es jeder, dessen Quote sich ändert. Bei einer
						nützlichen baulichen Massnahme ist es, wem sie den Gebrauch erheblich und dauernd
						erschwert oder unwirtschaftlich macht oder unzumutbare Kosten auferlegt. Trifft der
						Folgeantrag andere Eigentümer, ändern Sie die Auswahl.
						<!-- Die nützliche bauliche Massnahme seit der Fachprüfung FP3-5 und
						     Laienprüfung R3-2 c (06.10.2026), ZGB Art. 647d Abs. 2 und 3. -->
					</span>
				</fieldset>
			{/if}
		{/if}
	{:else if ausnahmeReglement}
		<label>
			Art
			<select
				name="art"
				use:gefuehrteWahl={(w) => (neuart = w === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme')}
			>
				<option value="kenntnisnahme" selected={neuart === 'kenntnisnahme'}>
					Kenntnisnahme, kein Beschluss
				</option>
				<option value="abstimmung" selected={neuart === 'abstimmung'}>
					Abstimmung, gestützt auf das Reglement
				</option>
			</select>
		</label>
		{#if neuart === 'abstimmung'}
			<p class="hilfe">{empfehlungMitReglement(ausnahmeReglement)}</p>
			<label>
				Mehrheitserfordernis
				<Suchauswahl
					name="erfordernis"
					beschriftung="Mehrheitserfordernis"
					leerText="— später bestimmen —"
					bind:wert={gewaehltesErfordernis}
					eintraege={erfordernisse.map((e) => ({
						wert: e.knotenId,
						text: `${e.astTitel} · ${e.titel}`
					}))}
				/>
			</label>
		{/if}
	{:else}
		<!--
			Keine Auswahl, sondern eine Feststellung. Ein Aufklappfeld mit einer
			einzigen Möglichkeit sieht aus wie eine Entscheidung, die man auch anders
			treffen könnte — und genau das ist hier nicht so.
		-->
		{#if universalMoeglich && ausnahmeUniversal}
			<label>
				Art
				<select
					name="art"
					use:gefuehrteWahl={(w) => (neuart = w === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme')}
				>
					<option value="kenntnisnahme" selected={neuart === 'kenntnisnahme'}>
						Kenntnisnahme, kein Beschluss
					</option>
					<option value="abstimmung" selected={neuart === 'abstimmung'}>
						Abstimmung als Universalversammlung
					</option>
				</select>
			</label>
			{#if neuart === 'abstimmung'}
				<p class="hilfe">{empfehlungUniversal(
						ausnahmeUniversal.variante,
						ausnahmeUniversal.leitungsvollmachtenZaehlen ?? false
					)}</p>
				<label>
					Mehrheitserfordernis
					<Suchauswahl
						name="erfordernis"
						beschriftung="Mehrheitserfordernis"
						leerText="— später bestimmen —"
						bind:wert={gewaehltesErfordernis}
						eintraege={erfordernisse.map((e) => ({
							wert: e.knotenId,
							text: `${e.astTitel} · ${e.titel}`
						}))}
					/>
				</label>
			{/if}
		{:else}
			<p class="feststellung">Kenntnisnahme, ein Beschluss ist heute nicht möglich.</p>
		{/if}
	{/if}

	{#if !alsFolgeantrag}
		<label>
			Titel
			<input name="titel" required minlength="3" maxlength="200" />
		</label>
		<label>
			Antragstext
			<!-- Bei «Abstimmung» ist der Text der Beschlusswortlaut (Codeprüfung 29.09.2026). -->
			<textarea
				name="antragswortlaut"
				rows="3"
				placeholder={neuart === 'abstimmung' && (ausnahmeReglement || universalMoeglich)
					? 'Worüber abgestimmt wird, ohne Namen'
					: 'Worum es geht — ohne Namen'}
			></textarea>
		</label>
	{/if}
	<button type="submit" class="leise" data-fokus="aufnehmen:traktandum">Aufnehmen</button>
</form>

{#if alsFolgeantrag}
	<p class="klein">
		<!-- Ohne Rückweisung: Produktentscheid 06.10.2026, «Einfaches Mehr» (Fachprüfung FP-1). -->
		Ein Folgeantrag hält sich im Kern des angekündigten Antrags — ein anderer Betrag, eine
		Etappierung, ein Vorbehalt. Darüber darf abgestimmt werden: Angekündigt
		sein muss der Gegenstand, nicht jeder Antrag dazu. Ob er im Kern liegt, beurteilen Sie.
	</p>
	<!--
		**Rückweisung und Verschiebung des Traktandums** (Produktentscheid
		06.10.2026, «Einfaches Mehr»; geändert nach Laien- und Fachprüfung Runde 3
		vom 06.10.2026, `quellen/pruefung/zu-pruefen-2026-10-06-votum-einladungsmehr-folgeantrag-runde3.md`,
		und Runde 4, `…-runde4.md`, R4-3 b und c, FP4-2, FP4-10, Codeprüfung N2; die
		fünfte Prüfung folgt). «Verschiebung des Traktandums» statt
		«Vertagung», weil «Vertagen» hier die ganze Versammlung meint.

		**Wo das Votenfeld steht, am Code geprüft:** In der Leitung einer
		Versammlung wie am Abend beim aufgerufenen Traktandum, über «Jetzt
		möglich» (`Votum.svelte`). Eine sichtbare Beschriftung hat es nicht, nur
		den Platzhalter.
	-->
	<p class="klein">
		Eine Rückweisung oder Verschiebung des Traktandums ist dagegen kein Folgeantrag, sondern ein
		Ordnungsantrag. Nehmen Sie sie nicht hier auf. Lassen Sie sofort per Handzeichen darüber
		abstimmen, vor jeder Abstimmung zur Sache, mit einfachem Mehr, wenn Ihr Reglement nichts
		anderes bestimmt. Gezählt wird nach Stimmen, nicht nach Händen, so wie die Kopfstimme für
		Ihre Gemeinschaft eingestellt ist (je Eigentümer oder je Einheit). Vertreter zählen für jede
		Vollmacht, Zugeschaltete fragen Sie einzeln. Angenommen ist sie, wenn mehr als die Hälfte
		der Anwesenden und Vertretenen Ja sagt, die bei diesem Traktandum mitstimmen dürfen. Wer im
		Ausstand ist, zählt nach der Regel dieser Anwendung nicht mit.
		{#if amAbend}
			Am gemeinsamen Abend stimmt nur die Gemeinschaft ab, deren Traktandum es ist; steht der
			Punkt bei mehreren, zählen Sie je Gemeinschaft getrennt.
		{/if}
		Halten Sie den Entscheid mit den Zahlen im Votenfeld des Traktandums fest, das verschoben
		wird. Es steht beim aufgerufenen Traktandum über «Jetzt möglich» (leer zeigt es «Voten,
		Begründungen, Ordnungsentscheide»). Angenommen: Heute wird über die Sache nicht mehr
		abgestimmt. Abgelehnt: Es geht weiter wie geplant. Nach einem angenommenen Rückkommen auf
		eine Annahme bleibt dabei der bisherige Beschluss nach dem Verständnis dieser Anwendung in
		Kraft; sagen Sie das vorher an. Mehr
		dazu steht im
		<a href="/handbuch/versammlung-fuehren.html#sonderfalle-im-saal" target="handbuch"
			>Handbuch, «Sonderfälle im Saal»</a
		>, bei der Rückweisung.
	</p>
{:else if !ausnahmeReglement && !universalMoeglich}
	<!-- Warum nicht, mit allen Gründen (Laienprüfung Runde 2, L1). -->
	<p class="klein">
		{NICHT_ANGEKUENDIGT_GRUNDSATZ}
		{#if amAbend}
			{NICHT_ANGEKUENDIGT_AM_ABEND}
		{:else}
			Beides liegt im Moment nicht vor. {NICHT_ANGEKUENDIGT_OHNE_REGLEMENT}
			{(ausnahmeUniversal?.gruende ?? []).join(' ')}
		{/if}
		{NICHT_ANGEKUENDIGT_WEGE}
	</p>
{/if}

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	/* ── Wer den Antrag stellt ───────────────────────────────────────────── */
	.antragsteller {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.5rem 0.7rem 0.7rem;
		margin: 0;
		min-width: 0;
	}

	.antragsteller legend {
		font-weight: 550;
		font-size: 0.9rem;
		padding: 0 0.3rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.9rem;
	}

	.hilfe {
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	.hilfe.warnung {
		color: var(--warnung);
	}

	.feststellung {
		margin: 0;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.klein {
		margin: 0.5rem 0 0;
		color: var(--text-leise);
		font-size: 0.85rem;
	}
</style>
