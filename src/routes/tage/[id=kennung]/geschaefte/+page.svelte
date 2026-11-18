<script lang="ts">
	/**
	 * Die Traktandenliste der gemeinsamen Versammlung.
	 *
	 * **Dieselbe Bedienung wie bei einer einzelnen Versammlung** — gemeldet am
	 * 11.08.2026: «Traktanden sind so hinzuzufügen, wie sie bei einer einzelnen
	 * Sitzung sind.» Also: eine Liste mit Nummern, Ziehen zum Umordnen, das
	 * Anlegeformular darunter — und das Quorum gleich beim Erfassen.
	 *
	 * **Der Unterschied ist die zweite Ebene.** Ab zwei Gemeinschaften steht das
	 * Traktandum als Sammelpunkt (3) mit einer Ziffer je Gemeinschaft darunter
	 * (3.1, 3.2). Das ist keine Darstellungsfrage, sondern eine der Ankündigung:
	 * Beschlossen wird in jedem Haus einzeln, also muss es dort auch einzeln
	 * angekündigt sein (Produktentscheid 11.08.2026).
	 *
	 * **Zugeklappt, solange überall dasselbe steht.** Sechs Häuser mal acht
	 * Pflichttraktanden sind sechsundfünfzig Zeilen; die Ordnung braucht sie, das
	 * Auge nicht. Sobald ein Haus ausschert, klappt der Punkt von selbst auf — dann
	 * gibt es dort etwas zu sehen.
	 *
	 * Gezogen wird auf beiden Ebenen: oben die Reihenfolge des Abends, unten die
	 * der Gemeinschaften innerhalb eines Traktandums.
	 */
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Fallauswahl from '$lib/components/Erfordernisauswahl.svelte';
	import Antragsvorschlag from '$lib/components/Antragsvorschlag.svelte';
	import { anfangswert, angekreuzt, gefuehrteWahl } from '$lib/felder';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();

	const werte = $derived(form && 'werte' in form && form.werte ? form.werte : null);

	/** Welches Traktandum gerade geändert wird — höchstens eines. */
	let aendert = $state<string | null>(null);
	let musterOffen = $state(false);
	let neuOffen = $state(false);

	/**
	 * Welche Sammelpunkte aufgeklappt sind.
	 *
	 * Vorgabe: zu, ausser der Punkt ist aufgespalten. Wer einmal aufklappt, behält
	 * es offen, solange die Seite steht.
	 */
	let offen = $state(new Set<string>());
	const zeigtZiffern = (z: { geschaeftId: string; einheitlich: boolean }) =>
		offen.has(z.geschaeftId) || !z.einheitlich;

	function klappe(geschaeftId: string) {
		const neu = new Set(offen);
		if (neu.has(geschaeftId)) neu.delete(geschaeftId);
		else neu.add(geschaeftId);
		offen = neu;
	}

	/** Die Zeilen, die gerade zu sehen sind — Ziffern nur bei aufgeklapptem Punkt. */
	const sichtbar = $derived(
		data.liste.filter((z) => z.tiefe === 1 || zeigtZiffern(z))
	);

	/**
	 * Ob sich ein Punkt überhaupt noch von der Liste nehmen lässt.
	 *
	 * **Warum die Frage hier steht** (07.09.2026, aus dem Code-Review).
	 * `loescheGeschaeft` weist ab, sobald eine beteiligte Versammlung eröffnet
	 * ist: Aus einer eröffneten wird ein Traktandum nicht entfernt, sondern
	 * zurückgezogen. Ein Rückfragefenster, das «verschwindet in allen drei
	 * Gemeinschaften» verspricht und danach in die Absage läuft, ist schlechter
	 * als kein Knopf — die Traktandenseite eines einzelnen Hauses zeigt an
	 * derselben Stelle deshalb einen Satz statt eines Knopfes.
	 *
	 * **Was sie nicht abdeckt:** Untertraktanden. Die stehen nicht in dieser
	 * Liste, und die Anwendung weist deswegen weiterhin ab. Der Satz im Fenster
	 * sagt das.
	 */
	const offeneHaeuser = $derived(
		new Set(data.alleHaeuser.filter((h) => h.offen).map((h) => h.meetingId))
	);
	function entfernbar(geschaeftId: string): boolean {
		const beteiligte = data.liste.filter((z) => z.geschaeftId === geschaeftId && z.meetingId);
		return beteiligte.length > 0 && beteiligte.every((z) => offeneHaeuser.has(z.meetingId!));
	}

	/**
	 * Ziehen mit Zeigerereignissen, nicht mit HTML5-Drag-and-Drop.
	 *
	 * Dieselbe Begründung wie auf der Traktandenseite einer einzelnen
	 * Versammlung: Auf Android und iOS löst Drag-and-Drop entweder gar nicht aus
	 * oder scrollt die Seite mit. `pointerdown` fasst Maus, Stift und Finger
	 * gleich an.
	 *
	 * **Zwei Ebenen, zwei Formulare.** Ein Sammelpunkt bewegt sich zwischen den
	 * Traktanden, eine Ziffer nur innerhalb ihres Punktes: 3.1 zwischen 4 und 5 zu
	 * schieben ergäbe eine Nummer, die es nicht gibt.
	 */
	let zieht = $state<{ id: string; ebene: 1 | 2; geschaeftId: string } | null>(null);
	let ueber = $state<string | null>(null);

	let formularOben: HTMLFormElement;
	let feldGeschaeft: HTMLInputElement;
	let feldVor: HTMLInputElement;

	let formularUnten: HTMLFormElement;
	let feldInGeschaeft: HTMLInputElement;
	let feldTraktandum: HTMLInputElement;
	let feldVorTraktandum: HTMLInputElement;

	function beginne(e: PointerEvent, id: string, ebene: 1 | 2, geschaeftId: string) {
		zieht = { id, ebene, geschaeftId };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function bewege(e: PointerEvent) {
		if (!zieht) return;
		const merkmal = zieht.ebene === 1 ? 'geschaeft' : 'ziffer';
		const unten = document
			.elementsFromPoint(e.clientX, e.clientY)
			.find((el) => el instanceof HTMLElement && el.dataset[merkmal]) as HTMLElement | undefined;

		// Auf der zweiten Ebene nur innerhalb desselben Traktandums.
		if (zieht.ebene === 2 && unten?.dataset.inGeschaeft !== zieht.geschaeftId) {
			ueber = null;
			return;
		}
		const ziel = unten?.dataset[merkmal];
		ueber = ziel && ziel !== zieht.id ? ziel : null;
	}

	function lasse() {
		if (zieht && ueber) {
			if (zieht.ebene === 1) {
				feldGeschaeft.value = zieht.id;
				feldVor.value = ueber;
				formularOben.requestSubmit();
			} else {
				feldInGeschaeft.value = zieht.geschaeftId;
				feldTraktandum.value = zieht.id;
				feldVorTraktandum.value = ueber;
				formularUnten.requestSubmit();
			}
		}
		zieht = null;
		ueber = null;
	}

	const wortlautNoetig = $state({ art: 'abstimmung' });

	/*
	 * **Der Musterwortlaut auch hier** (Prüflauf I, B-18). Ein Traktandum
	 * entsteht an drei Stellen; der Vorschlag darf nicht an zweien fehlen, sonst
	 * ist er eine Eigenheit einer Maske statt einer Hilfe der Anwendung.
	 *
	 * Gesteuerte Felder — das Programm füllt sie, und genau dafür ist
	 * `bind:value` + `$state` gedacht (Doktrin vom 11.08.2026).
	 */
	let neuTitel = $state('');
	let neuWortlaut = $state('');
	let neuFall = $state('');

	/*
	 * **Was der Server zurückgibt, kommt zurück ins Feld.** Vorher trugen beide
	 * Felder `anfangswert(werte?.…)`; mit gesteuerten Feldern muss das von Hand
	 * geschehen, sonst ist nach einer abgelehnten Eingabe alles Getippte weg —
	 * die Falle «Hydration leert Felder» in neuer Gestalt.
	 *
	 * Der Effekt hängt allein an `werte` und schreibt unter `untrack`: Sonst
	 * liefe er bei jedem Tastendruck erneut und setzte das Feld auf den Stand
	 * der letzten Absage zurück.
	 */
	/*
	 * **Und das Formular wieder auf, mit allen Feldern** (offener Punkt aus der
	 * Codeprüfung vom 07.10.2026). Das Anlegen schickt ohne `use:enhance` ab,
	 * die Seite lädt also neu, und `neuOffen` stand danach auf zu: Die Absage
	 * oben nannte ein Formular, das man erst wieder aufklappen musste, und dort
	 * standen Art, Fall und Gemeinschaften auf der Vorgabe. Beim Ändern
	 * dasselbe mit `aendert`.
	 */
	/*
	 * **Den Stand der Absage festhalten, nicht `werte` laufend lesen**
	 * (Codeprüfung 07.10.2026). Ziehen und Umordnen schicken über `use:enhance`
	 * ab und ersetzen `form`; ohne eigenen Zustand sprangen danach die Häkchen
	 * auf «alle» und die Änderungsfelder auf den gespeicherten Stand, ohne dass
	 * es jemand sah.
	 */
	let neuHaeuser = $state<string[] | null>(null);
	let aendernRueck = $state<{
		geschaeft: string;
		titel: string;
		antragswortlaut: string;
		art: string;
	} | null>(null);
	$effect(() => {
		const w = werte;
		if (!w) return;
		untrack(() => {
			if (w.aktion === 'aendern') {
				aendert = w.geschaeft || null;
				aendernRueck = w;
				return;
			}
			neuOffen = true;
			neuTitel = w.titel;
			neuWortlaut = w.antragswortlaut;
			wortlautNoetig.art = w.art;
			neuFall = w.erfordernis;
			neuHaeuser = w.meetings;
		});
	});
	/** Die zurückgegebenen Werte einer abgelehnten Änderung an diesem Punkt. */
	const rueckAendern = (geschaeftId: string) =>
		aendernRueck?.geschaeft === geschaeftId ? aendernRueck : null;
	/** Ob eine Gemeinschaft im Anlegeformular angekreuzt ist: nach einer Absage wie abgeschickt. */
	const neuAngekreuzt = (meetingId: string) => (neuHaeuser ? neuHaeuser.includes(meetingId) : true);

	/** «Abbrechen» heisst leer: Wer danach neu aufklappt, sieht nicht die abgelehnten Werte. */
	function schalteNeu() {
		if (neuOffen) {
			neuTitel = '';
			neuWortlaut = '';
			neuFall = '';
			wortlautNoetig.art = 'abstimmung';
			neuHaeuser = null;
		}
		neuOffen = !neuOffen;
	}
	const neuArt = $derived(
		data.erfordernisse.find((e) => e.knotenId === neuFall)?.geschaeftsart ?? null
	);
</script>

<h1>Traktandenliste</h1>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<p class="lesebreite">
	Die Liste gilt für den ganzen Abend: Unter dieser Nummer wird im Saal
	aufgerufen, und unter derselben steht das Geschäft im Protokoll der
	Gemeinschaft. Läuft ein Traktandum in mehreren Gemeinschaften, trägt jede eine
	eigene Ziffer: Beschlossen wird in jeder für sich. Und was einzeln beschlossen
	wird, muss einzeln angekündigt sein.
</p>

<!-- Die Ziele der Verschiebung reisen über zwei versteckte Formulare. -->
<!--
	`use:enhance` ist hier kein Schmuck: Ohne ihn lud der Browser die Seite neu,
	der Aufklapper schloss sich und die Ansicht sprang nach ganz oben — gemeldet am
	11.08.2026 beim Schieben einer Ziffer. Mit ihm bleiben Aufklappzustand und
	Scrollstelle stehen, und nur die Daten kommen neu.
-->
<form
	method="POST"
	action="?/verschieben"
	bind:this={formularOben}
	class="versteckt"
	use:enhance={() => async ({ update }) => update({ reset: false })}
>
	<input type="hidden" name="geschaeft" bind:this={feldGeschaeft} />
	<input type="hidden" name="vor" bind:this={feldVor} />
</form>
<form
	method="POST"
	action="?/umordnen"
	bind:this={formularUnten}
	class="versteckt"
	use:enhance={() => async ({ update }) => update({ reset: false })}
>
	<input type="hidden" name="geschaeft" bind:this={feldInGeschaeft} />
	<input type="hidden" name="traktandum" bind:this={feldTraktandum} />
	<input type="hidden" name="vor" bind:this={feldVorTraktandum} />
</form>

{#if data.liste.length === 0}
	<p class="leer">
		Noch kein Traktandum. Legen Sie unten eines an — es entsteht in jeder
		angekreuzten Gemeinschaft, mit demselben Inhalt.
	</p>
{:else}
	<ol class="liste" onpointermove={bewege} onpointerup={lasse} onpointercancel={lasse}>
		{#each sichtbar as z (z.nummer + (z.traktandumId ?? z.geschaeftId))}
			<li
				class="zeile"
				class:unterpunkt={z.tiefe === 2}
				class:sammelpunkt={z.art === 'sammelpunkt'}
				class:zieht={zieht?.id === (z.tiefe === 1 ? z.geschaeftId : z.traktandumId)}
				class:ueber={ueber === (z.tiefe === 1 ? z.geschaeftId : z.traktandumId)}
				data-geschaeft={z.tiefe === 1 ? z.geschaeftId : undefined}
				data-ziffer={z.tiefe === 2 ? z.traktandumId : undefined}
				data-in-geschaeft={z.tiefe === 2 ? z.geschaeftId : undefined}
			>
				<button
					type="button"
					class="griff"
					aria-label="{z.nummer} {z.titel} verschieben"
					onpointerdown={(e) =>
						beginne(
							e,
							z.tiefe === 1 ? z.geschaeftId : (z.traktandumId as string),
							z.tiefe,
							z.geschaeftId
						)}
				>
					⠿
				</button>

				<span class="nr">{z.nummer}</span>

				<span class="mitte">
					<span class="titel">{z.titel}</span>
					{#if z.antragswortlaut && z.art !== 'sammelpunkt'}
						<span class="wortlaut">{z.antragswortlaut}</span>
					{/if}
					{#if z.art === 'sammelpunkt'}
						<span class="hilfe">
							{z.haeuser} Gemeinschaften, je eine Ziffer — beschlossen wird darunter.
						</span>
					{/if}
					<!--
						**Wer entscheidet und wonach** (23.08.2026, Prüflauf II, B-04 und
						B-05).

						Bei einem gemeinsamen Traktandum stand «2 Gemeinschaften, je eine
						Ziffer». Bei einem, das nur ein Haus betrifft, stand nichts — dass
						Traktandum 12 zu Haus A gehört und 13 zu Haus B, wusste der Prüfer
						nur, weil der Hausname im Titel stand. Bei «Fassadenanstrich» wäre
						es in der Abendliste nicht erkennbar gewesen: genau dort, wo man die
						Geschäfte verteilt.

						Und die Schwelle stand nirgends — für «kommen wir auf zwei Drittel?»
						musste man ins Haus wechseln. Beides liegt längst in der Zeile
						(`gemeinschaft`, `erfordernis`); gezeigt wurde es nur im
						aufgeklappten Ändern-Bereich.
					-->
					{#if z.tiefe === 1 && z.haeuser === 1 && z.gemeinschaft}
						<span class="hilfe wer">Nur {z.gemeinschaft}</span>
					{/if}
					{#if z.art !== 'kenntnisnahme' && z.erfordernis}
						<span class="hilfe wonach">
							{data.erfordernisse.find((e) => e.knotenId === z.erfordernis)?.titel ??
								z.erfordernis}
						</span>
					{/if}
				</span>

				<!--
					Marken und Wege in einem Platz: rechts neben dem Titel, wo die Liste
					breit ist, darunter, wo sie schmal ist (siehe `.zeile` unten).
				-->
				<span class="tat">
				<span class="marken">
					{#if z.art === 'kenntnisnahme'}
						<span class="marke">Kenntnisnahme</span>
					{:else if z.art === 'sammelpunkt'}
						<!--
							Beschlossen wird in den Unterpunkten je Gemeinschaft. «ohne Beschluss»
							las sich neben offenen Abstimmungen wie eine Kenntnisnahme (Probe
							Wertquotenmehr, 17.11.2026).
						-->
						<span class="marke leise">Beschluss je Gemeinschaft</span>
					{/if}
					{#if z.abweichend}
						<span class="marke abweichend" title="Der Wortlaut ist gegenüber dem Anlegen geändert">
							angepasst
						</span>
					{/if}
				</span>

				{#if z.art === 'sammelpunkt'}
					<!--
						Aufklappen statt weglassen: Die Ziffern gehören zur Ordnung, aber
						sechs Häuser mal acht Punkte sind 56 Zeilen. Ein aufgespaltener
						Punkt steht von selbst offen — dort gibt es etwas zu sehen.
					-->
					<button
						type="button"
						class="weg klappe"
						aria-expanded={zeigtZiffern(z)}
						onclick={() => klappe(z.geschaeftId)}
					>
						{zeigtZiffern(z) ? 'Ziffern zuklappen' : `${z.haeuser} Ziffern zeigen`}
					</button>
				{/if}

				{#if z.tiefe === 1}
					<button
						type="button"
						class="weg aendern"
						onclick={() => {
							aendert = aendert === z.geschaeftId ? null : z.geschaeftId;
							aendernRueck = null;
						}}
					>
						{aendert === z.geschaeftId ? 'Schliessen' : 'Ändern'}
					</button>
				{:else if z.meetingId}
					<a class="weg" href="/versammlungen/{z.meetingId}/traktanden">In der Gemeinschaft</a>
				{/if}
				</span>
			</li>

			{#if aendert === z.geschaeftId && z.tiefe === 1}
				<!--
					Die Häuser eines Punktes. Beim Sammelpunkt stehen sie in seinen
					Ziffern, nicht an ihm selbst — er trägt bewusst kein Traktandum, weil
					über ihn nicht abgestimmt wird.
				-->
				{@const haeuserZeilen =
					z.art === 'sammelpunkt'
						? data.liste
								.filter((x) => x.geschaeftId === z.geschaeftId && x.tiefe === 2)
								.flatMap((x) => x.traktanden)
						: z.traktanden}
				{@const rueck = rueckAendern(z.geschaeftId)}
				{@const art = rueck ? rueck.art : z.art}
				<li class="bearbeiten">
					<form method="POST" action="?/aendern" class="felder" id="aendern-{z.geschaeftId}">
						<input type="hidden" name="geschaeft" value={z.geschaeftId} />
						<label class="breit">
							Titel
							<input
								name="titel"
								required
								minlength="3"
								maxlength="300"
								{...anfangswert(rueck ? rueck.titel : z.titel)}
							/>
						</label>
						<label>
							Art
							<select name="art">
								<option value="abstimmung" selected={art !== 'kenntnisnahme'}>Abstimmung</option>
								<option value="kenntnisnahme" selected={art === 'kenntnisnahme'}>
									Kenntnisnahme
								</option>
							</select>
						</label>
						<label class="voll">
							Antragswortlaut
							<input
								name="antragswortlaut"
								maxlength="2000"
								{...anfangswert(rueck ? rueck.antragswortlaut : (z.antragswortlaut ?? ''))}
							/>
							<span class="hilfe">
								{#if z.haeuser > 1}
									Wird in die Gemeinschaften übernommen, die bisher denselben Wortlaut hatten. Wer
									einen eigenen trägt, behält ihn.
								{:else}
									Wird im Saal vorgelesen und steht im Protokoll.
								{/if}
							</span>
						</label>
					</form>

					{#if z.art !== 'kenntnisnahme'}
						<!--
							Das Quorum im Bestand (Auftraggeber, 11.08.2026: «Was noch gemacht werden
							muss ist, dass man das Quorum ändern kann, im Bestand»). Gilt für
							alle Häuser des Punktes; hergeleitet wird je Gemeinschaft.
						-->
						<form method="POST" action="?/erfordernis" class="quorum felder" id="quorum-{z.geschaeftId}">
							<input type="hidden" name="geschaeft" value={z.geschaeftId} />
							<Fallauswahl
								erfordernisse={data.erfordernisse}
								wert={z.erfordernis ?? ''}
								leerText={z.haeuser > 1 && !z.erfordernis
									? '— uneinheitlich oder offen —'
									: '— noch offen —'}
								hilfe="Gilt für alle {z.haeuser === 1
									? 'diese Gemeinschaft'
									: `${z.haeuser} Gemeinschaften`}; wo ein Reglement abweicht, wird es dort angewandt. Der Entscheidbaum je Gemeinschaft bleibt daneben offen."
							/>
						</form>
					{/if}

					<!--
						Die Beteiligten als eigenes Formular: Sie ändern die Gliederung und
						legen Traktanden an oder löschen sie — das gehört nicht unter
						denselben Knopf wie eine Textkorrektur.
					-->
					<form method="POST" action="?/beteiligte" class="beteiligte" id="wer-{z.geschaeftId}">
						<input type="hidden" name="geschaeft" value={z.geschaeftId} />
						<fieldset>
							<legend>In welchen Gemeinschaften?</legend>
							{#each data.alleHaeuser as h (h.meetingId)}
								<label class="kasten">
									<input
										type="checkbox"
										name="meetings"
										value={h.meetingId}
										disabled={!h.offen}
										{...angekreuzt(haeuserZeilen.some((t) => t.meetingId === h.meetingId))}
									/>
									<span>
										{h.gemeinschaft}
										{#if !h.offen}<span class="hilfe">bereits eröffnet</span>{/if}
									</span>
								</label>
							{/each}
						</fieldset>
					</form>

					{#if haeuserZeilen.length > 0}
						<p class="steht-in">
							Wortlaut je Gemeinschaft ändern:
							{#each haeuserZeilen as t, i (t.traktandumId)}
								{#if i > 0}<span aria-hidden="true"> · </span>{/if}
								<a href="/versammlungen/{t.meetingId}/traktanden">{t.gemeinschaft}</a>
							{/each}
						</p>
					{/if}

					<!--
						Die Knöpfe schicken **verschiedene** Formulare ab, und das sieht man
						ihnen nicht an. Gemeldet am 11.08.2026: «Was bedeutet Erfordernis
						setzen? Eine kurze Anleitung der Funktionen wäre hilfreich.»

						Zwei Antworten darauf: Jeder Knopf nennt jetzt seinen Gegenstand
						(«Text», «Mehrheit», «Gemeinschaften») statt bloss «Speichern» — drei
						gleich beschriftete Knöpfe nebeneinander lesen sich wie einer, der
						dreimal dasteht. Und der Aufklapper sagt, was jeder tut, samt dem
						Fachbegriff, unter dem es im Handbuch und im Gesetz steht
						(docs/gestaltung.md, «Der Hintergrund wartet zugeklappt»).
					-->
					<details class="anleitung">
						<summary>Was tun diese Knöpfe?</summary>
						<dl>
							<dt>Text speichern</dt>
							<dd>
								Übernimmt Titel, Art und Antragswortlaut von oben. Nur den Text — die Mehrheit und
								die Gemeinschaften bleiben, wie sie sind.
							</dd>
							{#if z.art !== 'kenntnisnahme'}
								<dt>Mehrheit speichern</dt>
								<dd>
									Legt fest, <strong>welche Mehrheit</strong> für den Beschluss nötig ist — im Gesetz
									und im Protokoll das <em>Mehrheitserfordernis</em>. Ein einfaches Mehr genügt für
									das meiste; bauliche Massnahmen und Reglementsänderungen brauchen mehr, eine
									Zweckänderung alle. Wer den Fall aus der Liste wählt, setzt ihn für alle
									Gemeinschaften dieses Punktes; hergeleitet wird er trotzdem je Gemeinschaft, weil
									ein Reglement strenger sein kann.
								</dd>
							{/if}
							<dt>Gemeinschaften speichern</dt>
							<dd>
								Übernimmt die Häkchen darüber: In jeder angekreuzten Gemeinschaft entsteht dieses
								Traktandum, bei jeder entfernten verschwindet es. Damit ändert sich die Gliederung —
								ab zwei Gemeinschaften trägt jede ihre eigene Ziffer (3.1, 3.2), weil dort einzeln
								abgestimmt und deshalb auch einzeln angekündigt wird.
							</dd>
							<dt>Von der Liste nehmen</dt>
							<dd>Nimmt den Punkt aus dem ganzen Abend — in allen Gemeinschaften zugleich.</dd>
						</dl>
					</details>

					<div class="knoepfe">
						<button type="submit" form="aendern-{z.geschaeftId}">Text speichern</button>
						{#if z.art !== 'kenntnisnahme'}
							<button type="submit" form="quorum-{z.geschaeftId}" class="leise">
								Mehrheit speichern
							</button>
						{/if}
						<button type="submit" form="wer-{z.geschaeftId}" class="leise">
							Gemeinschaften speichern
						</button>
						<!--
							**Mit Rückfrage** (07.09.2026, aus dem Code-Review zu `82c00cf`).
							Der Knopf nimmt den Punkt aus **allen** Gemeinschaften des Abends
							zugleich und stand bis dahin ohne Nachfrage neben «Text
							speichern» — drei harmlose Knöpfe und einer, der in fünf Häusern
							ein Traktandum löscht. Die Traktandenseite eines einzelnen
							Hauses fragt beim Löschen seit dem 06.09.2026 nach; hier wog es
							schwerer und fragte niemand.
						-->
						{#if entfernbar(z.geschaeftId)}
							<!--
								Ohne `use:enhance`: Das Formular lud die Seite hier schon immer
								neu, und die Rückfrage ändert daran nichts. Mit `enhance` käme
								die Liste über `invalidateAll()` nach — ein zweiter Zeitpunkt,
								an dem nichts gewonnen wäre. Deshalb auch keine `marke`: Die
								Fokusrückgabe liest nur `absenden()`, und der Knopf ist nach dem
								Neuladen ohnehin weg.
							-->
							<form method="POST" action="?/entfernen" class="wegnehmen">
								<input type="hidden" name="geschaeft" value={z.geschaeftId} />
								<Rueckfrage
									beschriftung="Von der Liste nehmen"
									gewicht="leise"
									ton="warnung"
									zeichen="kreuz"
									frage="«{z.titel}» aus dem ganzen Abend nehmen?"
									folge={`Das Traktandum verschwindet ${
										z.haeuser === 1
											? 'in der einen beteiligten Gemeinschaft'
											: `in allen ${z.haeuser} beteiligten Gemeinschaften zugleich`
									}, mit Wortlaut, Mehrheitserfordernis und angehängten Unterlagen. Stehen darunter Untertraktanden, weist die Anwendung das Entfernen ab — die sind zuerst in ihrer Gemeinschaft zu entfernen.`}
									bestaetigen="Aus dem Abend nehmen"
								/>
							</form>
						{:else}
							<p class="nichtmehr">
								Von der Liste nehmen geht nicht mehr: Mindestens eine beteiligte Versammlung ist
								eröffnet. Dort wird ein Traktandum <strong>zurückgezogen</strong>, nicht entfernt
								— das bleibt im Protokoll sichtbar.
							</p>
						{/if}
					</div>
				</li>
			{/if}
		{/each}
	</ol>
{/if}

{#if data.muster.length > 0 && data.ergaenzbar.length > 0}
	<!--
		Mustertraktanden am Abend (Auftraggeber, 11.08.2026). Angeboten wird nur, was fehlt:
		Ein Knopf, der beim zweiten Druck alles doppelt anlegt, fiele erst im Saal auf.
	-->
	<section class="muster">
		<h2>
			{data.muster.length === 1
				? 'Ein Mustertraktandum fehlt noch'
				: `${data.muster.length} Mustertraktanden fehlen noch`}
		</h2>
		<p class="lesebreite">
			Was zu einer {data.versammlungsart === 'ordentlich' ? 'ordentlichen' : 'ausserordentlichen'}
			Versammlung gehört. Aufgenommen werden sie einmal für den ganzen Abend — in jeder
			Gemeinschaft unter derselben Nummer, mit dem Mehrheitserfordernis aus deren Reglement.
		</p>

		{#if musterOffen}
			<form method="POST" action="?/muster" id="muster">
				<ul class="wahlen">
					{#each data.muster as m (m.schluessel)}
						<li>
							<label class="wahl">
								<input type="checkbox" name="schluessel" value={m.schluessel} {...angekreuzt(true)} />
								<span>
									<span class="titel">{m.titel}</span>
									{#if m.kurzfassung}<span class="hilfe">{m.kurzfassung}</span>{/if}
								</span>
							</label>
						</li>
					{/each}
				</ul>
			</form>
			<div class="knoepfe">
				<button type="submit" form="muster">Gewählte aufnehmen</button>
				<button type="button" class="leise" onclick={() => (musterOffen = false)}>Abbrechen</button>
			</div>
		{:else}
			<button type="button" onclick={() => (musterOffen = true)}>Mustertraktanden ansehen</button>
		{/if}
	</section>
{/if}

<h2>Ein Traktandum aufnehmen</h2>

{#if data.ergaenzbar.length === 0}
	<p class="leer">
		Keine Versammlung ist noch offen für Traktanden. Was in einer eröffneten
		Versammlung dazukommen soll, ist ein Spontantraktandum; ob darüber abgestimmt
		werden darf, entscheiden Reglement oder Universalversammlung.
	</p>
{:else}
	<div class="neu">
		<button type="button" class="haupt" onclick={schalteNeu}>
			{neuOffen ? 'Abbrechen' : 'Traktandum hinzufügen'}
		</button>

		{#if neuOffen}
			<form method="POST" action="?/anlegen" id="neu" class="felder">
				<label class="breit">
					Titel
					<input
						name="titel"
						required
						minlength="3"
						maxlength="300"
						placeholder="Budget 2027"
						bind:value={neuTitel}
					/>
				</label>
				<label>
					Art
					<!--
						`use:gefuehrteWahl` und `selected` statt `bind:value`: Die Wahl
						entscheidet, ob der Antragswortlaut Pflicht ist und ob das Quorum
						darunter steht — sie muss dem Programm also bekannt sein. `bind:value`
						löschte dabei eine Wahl, die vor der Hydration getroffen wurde
						(`$lib/felder`, `gefuehrteWahl`; gemessen in
						`e2e/wahl-vor-hydration.mjs`).
					-->
					<select name="art" use:gefuehrteWahl={(w) => (wortlautNoetig.art = w)}>
						<option value="abstimmung" selected={wortlautNoetig.art === 'abstimmung'}>
							Abstimmung
						</option>
						<option value="kenntnisnahme" selected={wortlautNoetig.art === 'kenntnisnahme'}>
							Kenntnisnahme
						</option>
					</select>
				</label>
				<label class="voll">
					Antragswortlaut
					<input
						name="antragswortlaut"
						maxlength="2000"
						required={wortlautNoetig.art === 'abstimmung'}
						placeholder="Das Budget 2027 sei zu genehmigen."
						bind:value={neuWortlaut}
					/>
					<span class="hilfe">
						Wird im Saal vorgelesen und steht im Protokoll. Bei einer Kenntnisnahme bleibt er leer.
					</span>
					{#if wortlautNoetig.art === 'abstimmung'}
						<Antragsvorschlag
							art={neuArt}
							titel={neuTitel}
							fall={neuFall || null}
							vorhanden={neuWortlaut}
							uebernehmen={(satz) => (neuWortlaut = satz)}
						/>
					{/if}
				</label>

				{#if wortlautNoetig.art === 'abstimmung'}
					<!--
						Das Quorum **hier**, nicht sechsmal einzeln (Auftraggeber, 11.08.2026): «Sonst
						muss ich immer für jede Gemeinschaft einzeln erfassen.» Hergeleitet
						wird es trotzdem je Gemeinschaft — eine Reglementsabweichung gilt für
						ein Haus, nicht für den Abend.
					-->
					<Fallauswahl
						erfordernisse={data.erfordernisse}
						bind:wert={neuFall}
						leerText="— später bestimmen —"
						hilfe="Gilt für alle angekreuzten Gemeinschaften. Wo ein Reglement abweicht, wird es dort angewandt. Kennen Sie den Fall nicht, lassen Sie es offen — der Entscheidbaum führt Sie später je Gemeinschaft hin."
					/>
				{/if}

				<fieldset class="voll haeuser">
					<legend>In welchen Gemeinschaften?</legend>
					<p class="hilfe">
						{#if data.ergaenzbar.length > 1}
							Ab zwei Gemeinschaften bekommt jede eine eigene Ziffer — überall derselbe Inhalt,
							danach je Gemeinschaft änderbar.
						{:else}
							Es tagt eine Gemeinschaft mit; das Traktandum steht dort ohne Unterteilung.
						{/if}
					</p>
					{#each data.ergaenzbar as e (e.meetingId)}
						<label class="kasten">
							<input
								type="checkbox"
								name="meetings"
								value={e.meetingId}
								{...angekreuzt(neuAngekreuzt(e.meetingId))}
							/>
							<span>{e.gemeinschaft}</span>
						</label>
					{/each}
				</fieldset>
			</form>

			<div class="knoepfe">
				<button type="submit" form="neu" class="haupt">Traktandum aufnehmen</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Wer entscheidet, steht in Akzentfarbe — es ist eine Zuständigkeit, keine
	   Nebenbemerkung. Der Fall daneben bleibt leise. */
	.wer {
		color: var(--akzent);
	}

	.wonach {
		font-style: italic;
	}

	.meldung {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		margin: 0 0 1rem;
		max-width: var(--lesebreite);
		padding: 0.75rem 1rem;
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	.versteckt {
		display: none;
	}

	.liste {
		/* Der Umschlag unten misst die Liste, nicht das Fenster (docs/gestaltung.md,
		   «Auf dem Telefon steht alles untereinander»). */
		container-type: inline-size;
		list-style: none;
		margin: 1.25rem 0;
		max-width: 60rem;
		padding: 0;
	}

	.zeile {
		align-items: start;
		border-bottom: 1px solid var(--linie);
		/*
		 * **Feste Plätze statt Umbruch** (06.10.2026, UI-Durchgang). Griff, Titel,
		 * Marken und bis zu drei Knöpfe passen am Telefon nicht in eine Zeile;
		 * die Knöpfe tragen `white-space: nowrap` und schoben die Seite 44 px
		 * seitlich weg (02.09.2026). Das Umbrechen, das damals half, liess aber
		 * dem Titel als `flex: 1` nur den Rest der ersten Reihe: Bei 390 px
		 * waren das 13 px, «Begrüssung» lief unter «ohne Beschluss», die
		 * Erklärung stand ein Wort je Zeile, die erste Zeile mass 391 px.
		 *
		 * Jetzt ein Raster: Griff, Nummer, Titel in der ersten Reihe, Marken und
		 * Wege (`.tat`) darunter in der Titelspur. Erst wenn die Liste breit genug
		 * ist, rücken sie nach rechts neben den Titel, wie bisher am Notebook.
		 */
		column-gap: 0.6rem;
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		min-width: 0;
		padding: 0.5rem 0;
		row-gap: 0.3rem;
	}

	.tat {
		align-items: start;
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		grid-column: 3;
	}

	@container (min-width: 34rem) {
		.zeile {
			grid-template-columns: auto auto minmax(0, 1fr) auto;
		}

		.tat {
			flex-wrap: nowrap;
			grid-column: 4;
			grid-row: 1;
		}
	}

	/* Die zweite Ebene rückt ein — so weit, dass die Ziffer 3.1 unter der 3 steht. */
	.zeile.unterpunkt {
		padding-left: 2rem;
	}

	.zeile.sammelpunkt {
		background: var(--flaeche-2);
		font-weight: 550;
	}

	.zeile.zieht {
		opacity: 0.45;
	}

	.zeile.ueber {
		box-shadow: inset 0 2px 0 var(--akzent);
	}

	.griff {
		background: none;
		border: none;
		color: var(--text-leise);
		cursor: grab;
		font-size: 1.1rem;
		line-height: 1;
		min-height: 0;
		padding: 0.2rem 0.3rem;
		touch-action: none;
	}

	.nr {
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
		min-width: 2.5rem;
	}

	.mitte {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
		overflow-wrap: break-word;
	}

	.wortlaut,
	.hilfe {
		color: var(--text-leise);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.marken {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	/* Ohne Marke kein Platzhalter: Sonst rückt der Weg daneben um die Lücke ein. */
	.marken:not(:has(*)) {
		display: none;
	}

	.marke {
		background: var(--flaeche-2);
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 400;
		padding: 0.1rem 0.6rem;
		white-space: nowrap;
	}

	.marke.abweichend {
		background: color-mix(in srgb, var(--warnung) 22%, transparent);
	}

	.marke.leise {
		color: var(--text-leise);
	}

	.weg {
		font-size: 0.875rem;
		white-space: nowrap;
	}

	/* Der Knopf sieht aus wie der Verweis daneben — beide führen weiter. */
	button.weg {
		background: none;
		border: none;
		color: var(--akzent);
		cursor: pointer;
		min-height: 0;
		padding: 0.1rem 0.2rem;
		text-decoration: underline;
	}

	.bearbeiten {
		border-bottom: 1px solid var(--linie);
		list-style: none;
		padding: 0.75rem 0 1rem 2rem;
	}

	.quorum {
		margin-top: 1rem;
		max-width: 40rem;
	}

	.beteiligte fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		margin-top: 1rem;
		padding: 0.9rem 1rem;
	}

	.kasten {
		align-items: center;
		display: flex;
		flex-direction: row;
		font-weight: 400;
		gap: 0.6rem;
		padding: 0.15rem 0;
	}

	.kasten input[type='checkbox'] {
		flex: none;
		height: 1.1rem;
		min-height: 0;
		width: 1.1rem;
	}

	.steht-in {
		color: var(--text-leise);
		font-size: 0.875rem;
		margin: 0.9rem 0 0;
	}

	.knoepfe {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.9rem;
	}

	/*
	 * **Steht noch für den Fall, dass wieder ein Formular dazukommt.** Seit dem
	 * 07.09.2026 trägt das einzige hier `class="wegnehmen"` und setzt
	 * `display: block`; die Regel greift also gerade auf nichts. Sie zu
	 * entfernen hiesse, das nächste Formular in dieser Leiste bräche die Zeile
	 * um — `display: contents` ist hier die Vorgabe, nicht die Ausnahme.
	 */
	.knoepfe form {
		display: contents;
	}

	.nichtmehr {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0 0 0 auto;
		max-width: 34rem;
	}

	/*
	 * Drei Knöpfe speichern je ihren Teil und sind gleichrangig — einen davon
	 * hervorzuheben hiesse, er speichere alles. Das Entfernen aber ist die eine
	 * Handlung, die sich nicht zurücknehmen lässt: Es rückt nach rechts weg
	 * (docs/gestaltung.md, «Löschen steht leise unten»).
	 *
	 * **Am Formular und nicht am Knopf** (07.09.2026). Seit dort eine
	 * `Rueckfrage` steht, gehört der Knopf deren Stilbereich; ein
	 * `form:last-child button` von hier aus trifft ihn nicht mehr und wäre eine
	 * Regel, die stumm nichts tut. Das Formular verliert dafür sein
	 * `display: contents` und wird selbst zum Flex-Kind.
	 */
	.knoepfe form.wegnehmen {
		display: block;
		margin-left: auto;
	}

	.muster {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		margin-top: 2rem;
		padding: 1rem 1.15rem 1.25rem;
	}

	.muster h2 {
		margin-top: 0;
	}

	.muster .wahlen {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
	}

	.muster .wahl {
		align-items: start;
		display: flex;
		flex-direction: row;
		font-weight: 400;
		gap: 0.6rem;
		padding: 0.35rem 0;
	}

	.muster .wahl input[type='checkbox'] {
		flex: none;
		height: 1.1rem;
		margin-top: 0.15rem;
		min-height: 0;
		width: 1.1rem;
	}

	.muster .wahl span {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.titel {
		font-weight: 550;
	}

	h2 {
		margin-top: 2rem;
	}

	.haeuser {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
	}

	.neu {
		margin-top: 1rem;
	}

	.leer {
		color: var(--text-leise);
		max-width: var(--lesebreite);
	}

	/*
	 * Die Anleitung steht zugeklappt über den Knöpfen — dort, wo die Frage
	 * entsteht, und nicht als Hilfeseite anderswo.
	 */
	.anleitung {
		margin: 1rem 0 0;
		max-width: var(--lesebreite);
	}

	/*
	 * Wie `Karte.svelte`: Akzentfarbe und das Dreieck des Browsers. Der erste
	 * Versuch setzte `display: flex` für die Fingergrösse — das nimmt `summary`
	 * seinen Marker, und dann sieht man dem Satz nicht an, dass er sich öffnen
	 * lässt. Genau danach war gefragt («bspw. zum aufklappen»).
	 */
	.anleitung summary {
		cursor: pointer;
		color: var(--akzent);
		font-size: 0.9rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}

	.anleitung dl {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
	}

	.anleitung dt {
		font-weight: 550;
		margin-top: 0.6rem;
	}

	.anleitung dd {
		margin: 0.15rem 0 0;
		color: var(--text-leise);
	}
</style>
