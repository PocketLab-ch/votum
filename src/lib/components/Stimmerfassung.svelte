<script lang="ts">
	/**
	 * Stimmen erfassen — für eine Partei oder für den ganzen Saal.
	 *
	 * **Zwei Ausnahmen, ein Baustein.**
	 *
	 *   - *Für eine Partei stimmen* (20.08.2026): «dass der Sitzungsleiter für
	 *     einen Eigentümer stimmen darf. Das müsste aber dokumentiert sein. Bspw.
	 *     Telefon ist gerade ausgefallen.» In der geführten Betriebsart fiele eine
	 *     solche Stimme sonst unter «ohne Abgabe» — und das ist keine Enthaltung,
	 *     sondern eine verlorene Stimme, die in der Bezugsgrösse bleibt und damit
	 *     wie ein Nein wirkt.
	 *   - *Alle Stimmen von Hand* — der Teilausfall: Server läuft, Netz weg. Dann
	 *     erreicht kein Telefon die Anwendung, und der Saal stimmt von Hand ab.
	 *     Eine Begründung für den ganzen Durchgang; vierzehnmal denselben Satz zu
	 *     tippen wäre keine bessere Auskunft.
	 *
	 * In der Betriebsart «einfach» ist die Tabelle kein Notweg, sondern der
	 * Normalweg (Story 5.14) — dann steht sie offen da.
	 *
	 * **Als Komponente seit dem 24.08.2026** (Auftraggeber: «Musst du zwei Ansichten für
	 * die Sektion ‹An der Versammlung› bauen? Kann man die nicht generisch
	 * nutzen?»). Der Abend führt seit demselben Tag durch die Subtraktanden — ein
	 * Schritt ist dort ein Traktandum in einem Haus, also dieselbe Lage wie in der
	 * Leitung einer einzelnen Versammlung.
	 */
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import Wahlliste from '$lib/components/Wahlliste.svelte';
	import { einspracheHaendeVorsatz } from '$lib/domain/lesarten';
	import { anfangswert, angekreuzt, aufgeklappt } from '$lib/felder';
	import { SUMMENVERMERK_MINDESTLAENGE } from '$lib/domain/auszaehlung';

	interface Erfassungszeile {
		parteiId: string;
		name: string;
		einheiten: string[];
		kopfstimmen: number;
		wertquote: number;
		gewaehlt: string | null;
		selbst: boolean;
	}

	interface Eigenschaften {
		erfassung: Erfassungszeile[];
		betriebsart: 'gefuehrt' | 'einfach';
		/**
		 * Wer nicht erfasst werden kann und warum — Ausstand, ruhende Vollmacht.
		 *
		 * Ohne diese Zeilen suchte die Sitzungsleitung den Fehler in der
		 * Anwesenheitsliste: Die Partei steht dort ja als anwesend.
		 */
		sperren?: string[];
		/** Am Abend führt eine Route mehrere Häuser — dann muss das Formular sagen, welches. */
		versammlungId?: string | null;
		/**
		 * Ob die Tabelle in der einfachen Betriebsart offen steht.
		 *
		 * Auf der Anwesenheitsseite ja — dort ist Erfassen die Aufgabe. In der
		 * Sitzungsleitung nein: Sie führt durch den Abend, und eine vierzehnzeilige
		 * Tabelle nimmt den Blick auf alles andere.
		 */
		offen?: boolean;
		/**
		 * Warum eine Handzählung hier nicht genügt — oder `null`, wenn sie geht.
		 *
		 * Der Satz kommt aus dem Kern (`summenhindernis`) und nennt den Grund:
		 * «Wertquoten hängen an der Einheit», «bei der Einstimmigkeit zählt, wer
		 * nicht». Ohne ihn fragte man sich, warum der Block bei Punkt 5 dasteht
		 * und bei Punkt 6 nicht.
		 */
		summenhindernis?: string | null;
		/**
		 * Ob der Vermerk Pflicht ist, und warum (`summenvermerkNoetig`, Block
		 * A3c). `null`: freiwillig.
		 */
		summenvermerk?: string | null;
		/** Die schon erfasste Handzählung, wenn eine steht. */
		handzaehlung?: {
			ja: number;
			nein: number;
			enthaltung: number;
			andereJa: number | null;
			andereNein: number | null;
			andereEnthaltung: number | null;
			vermerk: string | null;
		} | null;
		/**
		 * Die Texte und die Zählhilfe der Handzählung an der Einsprache (L3,
		 * Migration 172), oder `null` ausserhalb der Einsprache. Dann zeigt das
		 * Formular die zweite Dreizahl und sagt, wonach zu zählen ist.
		 */
		einspracheZaehlung?: {
			ueberschrift: string;
			erklaerung: string;
			feldEigentuemer: string;
			feldEinheit: string;
			zusatz: string;
			absage: string;
			feldNachEinstellung: 'je_eigentuemer' | 'je_einheit';
			haende: Record<'je_eigentuemer' | 'je_einheit', string[]>;
		} | null;
	}

	let {
		erfassung,
		betriebsart,
		sperren = [],
		versammlungId = null,
		offen = false,
		summenhindernis = null,
		summenvermerk = null,
		handzaehlung = null,
		einspracheZaehlung = null
	}: Eigenschaften = $props();

	/**
	 * Welche Zeilen die Sitzungsleitung zum Ändern geöffnet hat.
	 *
	 * Vorgeschlagen am 21.08.2026: «wenn ausgeblendet aktiv klicken zum
	 * einblenden, wenn man es bearbeiten möchte». Wer eine bereits abgegebene
	 * Stimme berichtigen will, sagt das mit einem Klick — und trägt dann neu ein.
	 * Was vorher stand, erfährt er dabei nicht: Es steht gar nicht in den Daten
	 * dieser Seite.
	 */
	let offeneZeilen = $state(new Set<string>());

	/**
	 * Für welche Partei stellvertretend gestimmt wird.
	 *
	 * **Warum das hier stehen muss.** `Wahlliste` führt die Auswahl in eigenem
	 * `$state`, und `form.reset()` räumt nur das DOM. Vorher setzte das
	 * Neuladen sie zurück; seit dem 28.08.2026 lädt die Seite nicht mehr neu.
	 * Ohne diesen Griff bliebe die eben bestimmte Partei angekreuzt stehen —
	 * anders als beim Ausstand fällt sie nicht einmal aus der Liste, sie wird
	 * nur als «hat bereits gestimmt» leise gestellt. Der nächste Klick auf
	 * «Ja» ginge dann an dieselbe Partei, und die Sitzungsleitung bekäme
	 * mitten im Saal eine Absage, deren Grund nicht auf dem Bildschirm steht.
	 *
	 * `beiErfolg` und nicht `danach`: Der Weg erfasst genau **eine** Partei,
	 * einen Teilerfolg gibt es hier nicht. Und nach einer Absage soll die Wahl
	 * stehen bleiben — wer den Grund berichtigt, will nicht neu suchen.
	 */
	let stellvertretendFuer = $state<string[]>([]);

	/** Das Summenformular, um es nach einer Rücknahme selbst zu leeren. */
	let summenformular: HTMLFormElement | undefined = $state();

	/** Ob beim Absenden eine Handzählung stand — siehe `leereNachRuecknahme`. */
	let standEineHandzaehlung = false;

	/**
	 * Nach dem **Zurücknehmen** einer Handzählung die drei Zahlen leeren.
	 *
	 * `reset: false` ist für dieses Formular richtig: Die Felder zeigen den
	 * Bestand, und `anfangswert()` schreibt im Browser nur `defaultValue` — ein
	 * Leeren bei jedem Erfassen fiele auf den Stand des letzten Seitenaufbaus
	 * zurück. Für den einen Weg, der den Bestand **entfernt**, ist das aber
	 * falsch herum: Der Rücknahmeknopf verschwindet, und die alten Zahlen
	 * blieben sichtbar stehen. Wer dann «Summen erfassen» drückt, schreibt sie
	 * zurück (28.08.2026 im Review gefunden).
	 *
	 * **Geprüft wird der Übergang, nicht der Zustand.** Ein blosses
	 * `if (!handzaehlung)` wäre auch im gewöhnlichen Fall wahr — dann nämlich,
	 * wenn noch gar keine Handzählung steht. Genau dort schickt die
	 * Sitzungsleitung ihre eben ausgezählten Zahlen ab, und wird die Absendung
	 * abgewiesen (etwa weil für den Durchgang schon einzelne Stimmen erfasst
	 * sind), liefe `danach` trotzdem und löschte die drei Zahlen vom Papier.
	 * Das widerspräche Regel 1 in `absenden.ts` — «eine Absage behält das
	 * Getippte» — und im Saal ist der Zettel manchmal die einzige Kopie. Der
	 * zweite Sicherheitsdurchgang vom 28.08.2026 hat genau das gefunden, an
	 * einer Behebung aus dem Review eine Stunde davor.
	 *
	 * `laufend` ist der einzige Haken, der **vor** der Absendung läuft; er ist
	 * hier deshalb nicht als Ladezustand gebraucht, sondern als Merker.
	 */
	function merkeStand(marke: string | null): void {
		if (marke !== null) standEineHandzaehlung = Boolean(handzaehlung);
	}

	function leereNachRuecknahme(): void {
		if (standEineHandzaehlung && !handzaehlung) summenformular?.reset();
	}

	/**
	 * Ob die Erfassungstabelle aufgeklappt steht.
	 *
	 * **In der einfachen Betriebsart ist sie der Normalweg** — dort stimmt der
	 * Saal von Hand ab, und die Sitzungsleitung trägt alles ein. Zugeklappt
	 * gehört sie nur in der geführten Betriebsart, wo sie der Ausnahmefall
	 * («Netzausfall») ist. Genau dafür gibt es `offen`; bis zum 25.08.2026 gab
	 * ihn allerdings **keine** der beiden Sitzungsleitungen mit, und die Tabelle
	 * blieb immer zu.
	 */
	// `untrack`, weil der Anfangswert gemeint ist und nicht eine Bindung: Svelte
	// warnt sonst zu Recht, dass hier nur der erste Wert gelesen wird — genau das
	// ist die Absicht (siehe oben).
	const erfassungOffen = untrack(() => betriebsart === 'einfach' && offen);
	const andereZaehlung = $derived(
		einspracheZaehlung
			? einspracheZaehlung.feldNachEinstellung === 'je_eigentuemer'
				? einspracheZaehlung.feldEinheit
				: einspracheZaehlung.feldEigentuemer
			: ''
	);
</script>

{#snippet mitVersammlung()}
	{#if versammlungId}
		<input type="hidden" name="versammlung" value={versammlungId} />
	{/if}
{/snippet}

{#snippet erfassungstabelle()}
	<!--
		**Am Telefon jede Partei eine Karte** (UI-Durchgang 06.10.2026). Die Tabelle
		brauchte bei 390 px mindestens 461 px in einem 258 px breiten Formular; die
		Seite lief 137 px quer, und weil `body` den Querlauf abschneidet, waren
		«Nein» und «Enthaltung» bei 34 von 51 Feldern nicht zu erreichen. Jetzt das
		Hausmuster aus `app.css`: `.tabellenbahn` mit `table.karten`.
	-->
	<div class="tabellenbahn">
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<table role="table" class="karten">
			<thead>
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<tr role="row">
					<th scope="col">Partei</th>
					<th scope="col">Stimmkraft</th>
					<th scope="col">Ja</th>
					<th scope="col">Nein</th>
					<th scope="col">Enthaltung</th>
				</tr>
			</thead>
			<tbody>
				{#each erfassung as p (p.parteiId)}
					<!--
						**Wer selbst gestimmt hat, steht leiser da** (20.08.2026, «wenn durch
						einen Eigentümer wählt bitte eingrauen»). Im Netzausfall trägt die
						Sitzungsleitung der Reihe nach ein; ohne Unterschied überschriebe sie
						dabei Stimmen, die längst da sind.

						**Gesperrt wird die Zeile nicht.** Für das Ergebnis zählt die letzte
						Eintragung (AD-5), und manchmal ist die Berichtigung genau das
						Gewollte — «ich habe mich vertippt» kommt im Saal vor. Die Anwendung
						zeigt es an, statt zu entscheiden.
					-->
					<!-- svelte-ignore a11y_no_redundant_roles -->
					<tr role="row" class:selbst={p.selbst}>
						<td role="cell" class="kopfzelle">
							{p.name}
							<span class="klein">{p.einheiten.join(', ')}</span>
							{#if p.selbst}
								<span class="marke gut">hat selbst gestimmt</span>
							{/if}
						</td>
						<td role="cell" class="zahl" data-spalte="Stimmkraft">{p.kopfstimmen} K · {p.wertquote} WQ</td>
						{#if p.selbst && !offeneZeilen.has(p.parteiId)}
							<!--
								**Die Stimme steht nicht da, und sie ist auch nicht geladen.**

								Vorgeschlagen am 21.08.2026: «könnte man lösen, indem man die, die
								abgestimmt haben, eingraut und die Bullets ausgeblendet … wenn man
								es bearbeiten möchte, aktiv klicken zum Einblenden.» Genau so — und
								eine Stufe strenger: Was vom Gerät der Partei kam, wird gar nicht
								erst an diese Seite geliefert. Ein verborgenes Feld liesse sich
								aufklappen; was fehlt, nicht.

								**Berichtigen bleibt möglich.** Der Knopf gibt die Felder frei; die
								Sitzungsleitung trägt dann ein, was gilt, ohne zu sehen, was vorher
								stand. Für das Ergebnis zählt die letzte Zeile (AD-5).
							-->
							<td role="cell" class="wahl gestimmt" colspan="3">
								<button
									type="button"
									class="leise"
									onclick={() => (offeneZeilen = new Set(offeneZeilen).add(p.parteiId))}
								>
									Stimme ändern
								</button>
							</td>
						{:else}
							{#each ['yes', 'no', 'abstain'] as wahl (wahl)}
								<td
									role="cell"
									class="wahl"
									data-spalte={wahl === 'yes' ? 'Ja' : wahl === 'no' ? 'Nein' : 'Enthaltung'}
								>
									<input
										type="radio"
										name="wahl:{p.parteiId}"
										value={wahl}
										{...angekreuzt(p.gewaehlt === wahl)}
										aria-label="{p.name}: {wahl === 'yes'
											? 'Ja'
											: wahl === 'no'
												? 'Nein'
												: 'Enthaltung'}"
									/>
								</td>
							{/each}
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<!--
		**Wer fehlt und warum.** Ohne diese Zeile suchte die Sitzungsleitung den
		Fehler in der Anwesenheitsliste — die Partei steht dort ja als anwesend.
	-->
	{#each sperren as satz, i (i)}
		<p class="klein ausgenommen">{satz}</p>
	{/each}
	<!--
		**Der Satz sagte, eine leere Zeile werde als Nichtabgabe erfasst.** Sie
		wird gar nicht erfasst: Die Aktion überspringt jede Zeile ohne Wahl. Der
		Unterschied ist entscheidend, seit die Stimmen vom Telefon hier verborgen
		sind — sonst müsste die Sitzungsleitung fürchten, dass ihr Abschicken die
		bereits abgegebenen Stimmen löscht.
	-->
	<p class="klein">
		Eine Zeile ohne Eintrag wird <strong>nicht angerührt</strong>: Eine bereits abgegebene
		Stimme bleibt, und wo keine ist, zählt die Partei als ohne Abgabe — nicht als Enthaltung.
		Eine Berichtigung erzeugt eine neue Zeile; für das Ergebnis zählt die letzte.
	</p>
	<button type="submit" class="haupt" data-fokus="erfassen:alle">Stimmen erfassen</button>
{/snippet}

<!--
	**Beides zugeklappt, in jeder Betriebsart** (Auftraggeber, 24.08.2026): «Dass der
	Sitzungsleiter für die Eigentümer abstimmen darf, ist per Default
	auszublenden. Das soll eine Option sein, wenn was schiefgeht.»

	In der geführten Betriebsart stimmen die Eigentümer selbst; ein dauerhaft
	offenes Erfassungsfeld lädt dazu ein, ihnen die Arbeit abzunehmen. In der
	einfachen ist die Tabelle zwar der Normalweg — aber sie ist lang, und mitten
	in der Sitzungsleitung nimmt sie den Blick auf alles andere.
-->
<details class="stellvertretend">
	<summary title="Nur, wenn die Partei anwesend ist und selbst nicht abstimmen kann — ausgefallenes Telefon, leerer Akku, kein Empfang.">
		Für eine Partei stimmen
	</summary>
	<form
		method="POST"
		action="?/stellvertretend"
		class="fuerEine"
		use:enhance={absenden({
			beiErfolg: () => {
				stellvertretendFuer = [];
			}
		})}
	>
		<!--
			**Kein Vorgabeknopf.** Enter erfasste sonst eine Ja-Stimme für die gewählte Partei. Der erste `type="submit"` eines
			Formulars ist sein Vorgabeknopf, und Enter in irgendeinem Feld löst
			ihn aus. Ein **gesperrter** Knopf davor hält das auf, ohne
			JavaScript und ohne Serverumlauf (im Browser gemessen, 28.08.2026).
			Bewacht von `scripts/check-vorgabeknopf.mjs`.
		-->
		<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
		{@render mitVersammlung()}
		<p class="klein">
			{#if betriebsart === 'einfach'}
				Nur für Parteien, die <strong>anwesend</strong> sind. Auf Papier trägt die
				Sitzungsleitung ohnehin ein — hier geht es einzeln, wenn die Tabelle
				unten zu viel ist.
			{:else}
				Nur, wenn die Partei <strong>anwesend</strong> ist und selbst nicht abstimmen kann —
				ausgefallenes Telefon, leerer Akku, kein Empfang. Der Grund steht danach im
				Protokoll und im Verlauf.
			{/if}
		</p>
		<!--
			**Suchen statt scrollen** (21.08.2026): «Bei für welche Partei fehlt noch
			die Suchfunktion für die Partei.» Bei achtzig Köpfen findet ein
			Aufklappfeld niemand.

			Die Stimmkraft steht als Zusatz dabei: Wer stellvertretend erfasst, muss
			sehen, was er da einträgt. «Hat bereits gestimmt» erscheint ebenfalls —
			eine zweite Stimme für dieselbe Partei weist der Server ab, und das soll
			man vorher wissen.
		-->
		<fieldset class="parteiwahl">
			<legend>Für welche Partei</legend>
			<Wahlliste
				bind:gewaehlt={stellvertretendFuer}
				name="partei"
				mehrfach={false}
				pflicht
				suchbeschriftung="Partei suchen"
				leerhinweis="Keine Partei gewählt."
				eintraege={erfassung.map((p) => ({
					id: p.parteiId,
					name: p.name,
					zusatz: `${p.kopfstimmen} K · ${p.wertquote} WQ${p.gewaehlt ? ' — hat bereits gestimmt' : ''}`,
					leise: Boolean(p.gewaehlt)
				}))}
			/>
		</fieldset>
		<label>
			Warum Sie erfassen
			<!--
				**Pflicht nur in der geführten Betriebsart** (Auftraggeber, 25.08.2026: «ich
				vermute dass die Sitzung mit Handzählen ist und darum kein Kommentar
				beim Stimmen durch den Sitzungsleiter braucht»).

				Er hat recht, und derselbe Entscheid steht zehn Zeilen weiter unten
				schon beim Sammelweg. Beim Einzelweg fehlte er: Dort stand `required`
				fest, mit dem Vermerk «in jeder Betriebsart». Das ist für die geführte
				richtig — dort stimmen die Eigentümer selbst, und wer für einen
				einträgt, greift ein. In der einfachen ist genau das der NORMALWEG:
				Die Sitzungsleitung zählt die Hände und trägt ein, für alle. Ein
				Pflichtfeld dafür verlangt vierzehnmal denselben Satz und erzeugt
				keine Auskunft, sondern Tippen.
			-->
			<input
				name="begruendung"
				required={betriebsart === 'gefuehrt'}
				minlength="10"
				placeholder={betriebsart === 'einfach'
					? 'Freiwillig — etwa: im Saal mündlich abgegeben'
					: 'Telefon ausgefallen, Stimme im Saal mündlich abgegeben'}
				autocomplete="off"
			/>
		</label>
		<span class="knoepfe">
			<button
				type="submit"
				name="wahl"
				value="yes"
				class="handlung"
				data-ton="gut"
				data-fokus="stimme:ja"
			>
				Ja erfassen
			</button>
			<button
				type="submit"
				name="wahl"
				value="no"
				class="handlung"
				data-ton="warnung"
				data-fokus="stimme:nein"
			>
				Nein erfassen
			</button>
			<button type="submit" name="wahl" value="abstain" class="handlung" data-fokus="stimme:enthaltung">
				Enthaltung erfassen
			</button>
		</span>
		<p class="klein">
			Eine Berichtigung erzeugt eine neue Zeile; für das Ergebnis zählt die letzte.
			Gelöscht wird nichts.
		</p>
	</form>
</details>

<!--
	**Der Anfangswert, nicht der Dauerwert** (25.08.2026, berichtigt am
	26.08.2026).

	Gemeint war von Anfang an: einmal aus `offen` gesetzt, danach vom Benutzer
	geführt. Der Weg dorthin war `bind:open` — und der war falsch. Er ist
	**dieselbe Falle**, die er abwenden sollte, nur eine Ebene tiefer:
	`bind_property` schreibt `element.open = get()` in einem `render_effect`,
	ohne jede Prüfung. Wer das `<summary>` anklickt, bevor das Skript geladen
	ist, sieht den Kasten bei der Hydration wieder zugehen (gemessen in
	`e2e/ausklapper-vor-hydration.mjs`).

	`aufgeklappt()` aus `$lib/felder` tut, was gemeint war: `open` auf dem
	Server, und im Browser greift das Programm nur ein, wo es mehr weiss als der
	Server — die Tabelle dazu steht dort.
-->
<details class="stellvertretend" {...aufgeklappt(erfassungOffen)}>
	<summary
		title={betriebsart === 'einfach'
			? 'In dieser Betriebsart stimmt der Saal von Hand ab, und die Sitzungsleitung trägt alles ein.'
			: 'Der Teilausfall: Server läuft, Netz weg. Dann erreicht kein Telefon die Anwendung, und der Saal stimmt von Hand ab.'}
	>
		{betriebsart === 'einfach'
			? 'Alle Stimmen erfassen'
			: 'Alle Stimmen von Hand erfassen (Netzausfall)'}
	</summary>
	<form method="POST" action="?/erfassen" class="erfassung" use:enhance={absenden({ reset: false })}>
		{@render mitVersammlung()}
		<label class="grundzeile">
			Warum Sie erfassen
			<!--
				**Pflicht nur in der geführten Betriebsart.** Dort stimmen die
				Eigentümer selbst, und wer für alle einträgt, greift ein. In der
				einfachen ist die Betriebsart der Grund — ihn je Durchgang zu
				wiederholen erzeugte ein Pflichtfeld und keine Auskunft. Wer trotzdem
				etwas schreibt, dessen Satz steht an jeder Stimme.
			-->
			<input
				name="begruendung"
				required={betriebsart === 'gefuehrt'}
				minlength="10"
				placeholder={betriebsart === 'einfach'
					? 'Freiwillig — etwa: zweiter Wahlgang, im Saal ausgezählt'
					: 'WLAN im Saal ausgefallen, im Saal von Hand abgestimmt'}
				autocomplete="off"
			/>
		</label>
		{@render erfassungstabelle()}
	</form>
</details>

<!--
	**Nur die Summen — zusätzlich, nicht statt** (Auftraggeber, 25.08.2026): «Ich finde
	es eigentlich gut, dass ich einzelne Stimme mit den Bulletpoints erfassen
	kann. Ohne Zuordnung wäre einfach noch zusätzlich. So bleibt man flexibel, je
	situation.»

	Der Fall dahinter: «So setzt es voraus, dass ich jeden Eigentümer kenne und
	die Stimmen richtig setze. Also beim einfachen Mehr. Wenn müsste man dort die
	totale Anzahl an Ja, Nein und Enthaltung eintragen können.»

	**Und nur beim einfachen Mehr.** Die Grenze hat der Auftraggeber selbst gezogen — «Beim
	qualifiziertem Mehr braucht es die Zettel aus jeder Zeit» —, und sie ist
	nicht Vorsicht, sondern Arithmetik: Wertquoten hängen an der Einheit, und wer
	Hände zählt, weiss nicht, welche Einheiten zugestimmt haben. Der Satz sagt es
	statt einen toten Block anzubieten.
-->
{#if summenhindernis}
	<p class="klein hindernis">
		<strong>Von Hand zählen geht hier nicht:</strong>
		{summenhindernis}
	</p>
{:else}
	<details class="stellvertretend" {...aufgeklappt(Boolean(handzaehlung))}>
		<summary title="Drei Zahlen statt einer Zeile je Partei — für den Saal, in dem die Hände gezählt werden.">
			Von Hand gezählt: nur die Summen
		</summary>
		<form
			method="POST"
			action="?/summen"
			class="summen"
			bind:this={summenformular}
			use:enhance={absenden({ reset: false, laufend: merkeStand, danach: leereNachRuecknahme })}
		>
			{@render mitVersammlung()}
			<p class="klein">
				Für den Saal, in dem die Hände gezählt werden. Es wird dann <strong>nicht</strong>
				festgehalten, wer wie gestimmt hat — das steht so im Protokoll. Wer da ist und die
				Hand nicht hebt, zählt als ohne Abgabe, nicht als Enthaltung.
			</p>

			{#if einspracheZaehlung}
				<!--
					**Bei der Einsprache zweimal zählen** (L3, Migration 172). Die Texte
					kommen aus dem Katalog (`einspracheHandzaehlungTexte`), die Namen der
					Hände mit mehr oder weniger als einer Stimme je Zählung aus
					`einspracheHaende`.
				-->
				<div class="einsprache">
					<strong>{einspracheZaehlung.ueberschrift}</strong>
					<p class="klein">{einspracheZaehlung.erklaerung}</p>
					{#each ['je_eigentuemer', 'je_einheit'] as const as zaehlung (zaehlung)}
						{#if einspracheZaehlung.haende[zaehlung].length > 0}
							<p class="klein ausgenommen">
								<!-- A5, Punkt 9: je Zählung, denn gezählt wird zweimal. -->
								{einspracheHaendeVorsatz(zaehlung)}{einspracheZaehlung.haende[zaehlung].join(', ')}.
							</p>
						{/if}
					{/each}
				</div>
			{/if}

			<div class="zahlen">
				{#if einspracheZaehlung}
					<!-- Das Feld nach der Einstellung trägt den Zusatz. -->
					<span class="gruppentitel">
						{einspracheZaehlung.feldNachEinstellung === 'je_eigentuemer'
							? einspracheZaehlung.feldEigentuemer
							: einspracheZaehlung.feldEinheit}
						({einspracheZaehlung.zusatz})
					</span>
				{/if}
				<label>
					Ja
					<input
						type="number"
						name="ja"
						min="0"
						step="1"
						required
						{...anfangswert(String(handzaehlung?.ja ?? ''))}
					/>
				</label>
				<label>
					Nein
					<input
						type="number"
						name="nein"
						min="0"
						step="1"
						required
						{...anfangswert(String(handzaehlung?.nein ?? ''))}
					/>
				</label>
				<label>
					Enthaltung
					<input
						type="number"
						name="enthaltung"
						min="0"
						step="1"
						required
						{...anfangswert(String(handzaehlung?.enthaltung ?? ''))}
					/>
				</label>
			</div>

			{#if einspracheZaehlung}
				<!-- Die andere Zählung, aus der zweiten Dreizahl. -->
				<div class="zahlen">
					<!-- Die Felder heissen wie die der ersten Zählung; der Name der Gruppe
						steht deshalb auch in ihrer Beschriftung für Vorleseprogramme
						(Codeprüfung Block 5, N7). -->
					<span class="gruppentitel">{andereZaehlung}</span>
					<label>
						Ja
						<input
							type="number"
							name="andere_ja"
							aria-label={`Ja, ${andereZaehlung}`}
							min="0"
							step="1"
							{...anfangswert(String(handzaehlung?.andereJa ?? ''))}
						/>
					</label>
					<label>
						Nein
						<input
							type="number"
							name="andere_nein"
							aria-label={`Nein, ${andereZaehlung}`}
							min="0"
							step="1"
							{...anfangswert(String(handzaehlung?.andereNein ?? ''))}
						/>
					</label>
					<label>
						Enthaltung
						<input
							type="number"
							name="andere_enthaltung"
							aria-label={`Enthaltung, ${andereZaehlung}`}
							min="0"
							step="1"
							{...anfangswert(String(handzaehlung?.andereEnthaltung ?? ''))}
						/>
					</label>
				</div>
			{/if}

			<label>
				Wie gezählt wurde
				<input
					name="vermerk"
					maxlength="200"
					minlength={summenvermerk ? SUMMENVERMERK_MINDESTLAENGE : undefined}
					required={Boolean(summenvermerk)}
					placeholder={summenvermerk
						? 'Etwa: Handzeichen, Vollmachten einzeln aufgerufen, gezählt von der Sitzungsleitung'
						: 'Freiwillig — etwa: Handzeichen, gezählt von der Sitzungsleitung'}
					autocomplete="off"
					{...anfangswert(handzaehlung?.vermerk ?? '')}
				/>
				<span class="klein">
					{#if summenvermerk}
						{summenvermerk}
					{:else}
						Steht im Protokoll und erklärt, warum keine einzelnen Stimmen festgehalten sind.
					{/if}
				</span>
			</label>

			<span class="knoepfe">
				<button type="submit" class="haupt" data-vorgabe="Summen erfassen" data-fokus="summen:erfassen">
					Summen erfassen
				</button>
				{#if handzaehlung}
					<!-- `formnovalidate`: Die Rücknahme braucht weder Zahlen noch den Pflichtvermerk (A3c). -->
					<button type="submit" name="zuruecknehmen" value="ja" class="leise" formnovalidate>
						Handzählung zurücknehmen
					</button>
				{/if}
			</span>
			{#if handzaehlung}
				<p class="klein">
					Solange eine Handzählung steht, lassen sich keine einzelnen Stimmen erfassen —
					zwei Auszählungen desselben Durchgangs ergäben zwei Ergebnisse.
				</p>
			{/if}
		</form>
	</details>
{/if}

<style>
	/* Die drei Zahlen nebeneinander: Sie sind eine Frage, nicht drei. */
	.summen {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.summen .zahlen {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.summen .zahlen label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 550;
	}

	.summen .zahlen input {
		width: 6rem;
	}

	.summen .einsprache {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.5rem 0.7rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.summen .zahlen .gruppentitel {
		display: block;
		flex-basis: 100%;
		font-weight: 550;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.summen > label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 550;
		max-width: var(--lesebreite);
	}

	.summen p,
	.hindernis {
		max-width: var(--lesebreite);
	}

	/* Der Grund steht leise da, wo sonst der Block stünde. */
	.hindernis {
		margin-top: 0.75rem;
		color: var(--text-leise);
	}

	/*
	 * `fieldset` statt `label`: Die Beschriftung gehört zu einer Gruppe von
	 * Feldern, nicht zu einem. Der Rahmen fällt weg — er stünde in einer Karte,
	 * die schon einen hat.
	 */
	.parteiwahl {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}

	.parteiwahl legend {
		padding: 0;
		font-weight: 550;
		font-size: 0.95rem;
	}

	.erfassung {
		margin: 1rem 0;
	}

	/* Die Ausnahme steht zugeklappt und ruhig: In der geführten Betriebsart
	   stimmen die Eigentümer selbst. */
	.stellvertretend {
		margin: 1rem 0;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.5rem 0.8rem;
	}

	.stellvertretend summary {
		cursor: pointer;
		font-weight: 550;
		padding: 0.3rem 0;
	}

	.fuerEine {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.6rem;
		max-width: 44rem;
	}

	.fuerEine label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 550;
	}

	.fuerEine input {
		min-height: var(--ziel-min);
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.grundzeile {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 550;
		max-width: 44rem;
		margin-bottom: 0.75rem;
	}

	.grundzeile input {
		min-height: var(--ziel-min);
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	.fuerEine .knoepfe {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.zahl {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	td.wahl {
		text-align: center;
	}

	/*
	 * Leiser, nicht unlesbar: Die Zeile ist kein Fehler, sondern eine bereits
	 * erledigte Sache. Wer sie doch braucht, muss sie noch lesen können — und
	 * die Ankreuzfelder bleiben in voller Deckkraft, weil man sie treffen soll.
	 */
	tr.selbst td {
		color: var(--text-leise);
		background: color-mix(in srgb, var(--flaeche-2) 60%, transparent);
	}

	tr.selbst td.wahl {
		color: var(--text);
	}

	/* Kein leeres Feld, sondern ein Weg: Die Zelle sagt, dass hier etwas steht
	   und wie man es ändert. */
	td.gestimmt {
		text-align: center;
	}

	td.wahl input {
		width: 1.4rem;
		height: 1.4rem;
	}

	/*
	 * In der Karte (unter 46rem, `table.karten` in `app.css`) steht jedes
	 * Wahlfeld linksbündig hinter seiner Beschriftung, nicht mittig weit weg von
	 * «Ja:». Nebeneinander passen die drei im 258 px breiten Formular der
	 * Sitzungsleitung nicht (gemessen 50 + 67 + 107 px in 230 px), und eine
	 * Reihe, die mal zwei, mal drei Felder trägt, liest sich schlechter als drei
	 * Zeilen.
	 */
	@media (max-width: 46rem) {
		td.wahl {
			text-align: left;
		}
	}

	.klein {
		font-size: 0.85rem;
		color: var(--text-leise);
		display: block;
	}

	.marke {
		display: inline-block;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.marke.gut {
		background: color-mix(in srgb, var(--akzent) 22%, transparent);
	}
</style>
