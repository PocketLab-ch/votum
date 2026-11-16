<script lang="ts">
	import { datumLang } from '$lib/domain/datum';
	import { anfangswert } from '$lib/felder';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import { nutzniessungsHinweis } from '$lib/domain/nutzniessung';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	let { data, form } = $props();

	let hatVereinbarung = $state(false);
</script>

<h1>Nutzniessung</h1>

<p class="einleitung">
	Wer bei einem Traktandum stimmen darf, bestimmt die Sitzungsleitung — das System leitet es nicht
	ab. Der Grund steht im Gesetz selbst: ZGB Art. 712o Abs. 2 ist eine Auffangregel, die nur greift,
	wo sich Eigentümer und Nutzniesser nicht verständigt haben. Eine Vereinbarung verdrängt sie
	vollständig und kann alle Beschlussarten erfassen, auch qualifiziertes Mehr und Einstimmigkeit.
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.angelegt}
	<Meldung ton="gut" marke={form}>Nutzniessung erfasst.</Meldung>
{/if}

<!--
	Der Seitenstapel statt zweier Spalten (01.09.2026, Task 4 aus
	`docs/plan-seitenaufbau-2026-08-27.md`).

	**Was das Nebeneinander hier kostete:** Die Bestandsliste ist oft leer oder
	trägt einen Eintrag, das Erfassungsformular daneben ist immer gleich lang.
	Links blieb dann eine halbe Bildschirmhöhe Nichts stehen. Auf dem Telefon
	klappten die Spalten ohnehin untereinander — dort war die Reihenfolge schon
	immer die des Stapels, nur ohne Überschriften.

	**Der Bestand bekommt dabei eine.** «Erfasste Nutzniessungen» stand nirgends;
	die Liste fing ohne Ansage an. In einem Stapel benannter Abschnitte fällt das
	auf, im Nebeneinander ging es unter.
-->
<div class="seitenstapel">
	<section class="abschnitt">
		<div class="kachel">
			<h2>Erfasste Nutzniessungen</h2>
		{#if data.nutzniessungen.length > 0}
			<ul class="liste">
				{#each data.nutzniessungen as n (n.id)}
					<li>
						<div class="kopf">
							<strong>{n.unitLabel}</strong>
							<span class="zeitraum">
								<!--
									**Schweizer Datum, nicht ISO** (23.08.2026, Prüflauf II, A-46).
									Hier stand «2020-01-01 bis auf Weiteres», während die
									Eigentümerseite daneben «Di., 19. Mai 2026» schreibt. Dieselbe
									Anwendung, zwei Schreibweisen — und die technische steht
									ausgerechnet dort, wo ein Nutzniessungsrecht beginnt.
								-->
								{datumLang(n.validFrom)} bis {n.validTo ? datumLang(n.validTo) : 'auf Weiteres'}
							</span>
						</div>
						<p class="hinweis">{nutzniessungsHinweis(n)}</p>
						{#if n.nachweis}
							<p class="nachweis">
								Nachweis: <a href="/anhang/{n.nachweis.pruefsumme}">{n.nachweis.name}</a>
							</p>
						{:else}
							<p class="nachweis fehlt">
								Kein Nutzniessungsvertrag hinterlegt. Ohne ihn lässt sich im Streitfall nicht belegen,
								was vereinbart wurde.
							</p>
						{/if}

						<!--
							**Berichtigen und Beenden** (23.08.2026, Prüflauf II). Bis dahin gab es
							nur das Erfassen: Im Prüflauf stand «Nutzniessung zugunsten von BNUT» —
							eine Referenz aus der CSV-Spalte statt eines Namens —, und es führte
							kein Weg zurück. Kein Ändern, kein Beenden, kein Entfernen; eine zweite
							Erfassung wies die Anwendung ab.

							**Zwei Wege, weil es zwei Sachverhalte sind:** Wer verzichtet oder
							stirbt, dessen Nutzniessung ENDET an einem Tag und bleibt für
							vergangene Versammlungen sichtbar. Wer sie versehentlich erfasst hat,
							will, dass sie nie gewesen ist. Der zweite Weg steht nur offen, solange
							keine Versammlung darauf beruht — das prüft der Kern.
						-->
						<details class="berichtigen">
							<summary>Berichtigen oder beenden</summary>
							<form method="POST" action="?/berichtigen" class="felder">
								<input type="hidden" name="id" value={n.id} />
								<label>
									Name des Nutzniessers
									<input name="holderName" required maxlength="200" {...anfangswert(n.holderName)} />
								</label>
								<button type="submit">Namen berichtigen</button>
								<span class="klein">
									Nur die Schreibweise. Zeitraum und Vereinbarung sind der Inhalt des Rechts —
									dafür gibt es das Beenden.
								</span>
							</form>
							<form method="POST" action="?/beenden" class="felder">
								<input type="hidden" name="id" value={n.id} />
								<label>
									Endet am
									<input type="date" name="per" required />
								</label>
								<button type="submit">Beenden</button>
							</form>
							<form method="POST" action="?/beenden">
								<input type="hidden" name="id" value={n.id} />
								<Rueckfrage
									beschriftung="Als Versehen tilgen"
									zeichen="kreuz"
									ton="warnung"
									frage="Diese Nutzniessung tilgen?"
									folge="Sie wird entfernt, als hätte es sie nie gegeben — kein Ende im Protokoll. Hat die Einheit schon an einer freigegebenen Versammlung teilgenommen, weist die Anwendung das ab."
									bestaetigen="Tilgen"
								/>
							</form>
						</details>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="leer">Keine Nutzniessung erfasst.</p>
		{/if}
		</div>
	</section>

	<section class="abschnitt">
		<div class="neu kachel">
			<h2>Nutzniessung erfassen</h2>
			<!--
				**Benannte Aktion statt `default`** (23.08.2026): Seit die Zeilen einen Weg
				zum Berichtigen und Beenden haben, gibt es benannte Aktionen — und
				SvelteKit lässt `default` nicht daneben stehen. Der Fehler fiele erst beim
				Absenden auf, nicht beim Laden der Seite.
			-->
			<form method="POST" action="?/erfassen" enctype="multipart/form-data" class="felder">
				<label class="breit">
					Einheit
					<Suchauswahl
						name="unitId"
						beschriftung="Einheit"
						leerText="— wählen —"
						pflicht
						eintraege={data.einheiten.map((e) => ({ wert: e.id, text: e.label }))}
					/>
				</label>

				<label class="breit">
					Nutzniesser
					<input name="holderName" required placeholder="Hedwig Berger-Stucki" />
				</label>

				<label class="schmal">
					Beginn
					<input type="date" name="validFrom" required />
				</label>

				<label class="schmal">
					Ende
					<input type="date" name="validTo" />
					<span class="hilfe">Freiwillig</span>
				</label>

				<!--
					**Der Vermerk genügt** (Hinweis des Auftraggebers vom 05.08.2026): Der Vertrag liegt
					ohnehin schon vor der Versammlung bei der Bewirtschaftung — er ist die
					Grundlage dieser Erfassung. Wie bei der Vollmacht ist «liegt vor» der
					Nachweis und die Kopie ein Nachtrag.
				-->
				<label class="kasten voll">
					<input type="checkbox" name="contractOnFile" value="true" />
					<span>
						Der Nutzniessungsvertrag liegt uns vor
						<span class="hilfe">
							Ein Vermerk genügt. Eine Kopie können Sie unten hinterlegen, müssen aber nicht.
						</span>
					</span>
				</label>

				<label class="kasten voll">
					<input type="checkbox" name="hasAgreement" value="true" bind:checked={hatVereinbarung} />
					<span>
						Es besteht eine Vereinbarung über die Stimmrechtsausübung
						<span class="hilfe">
							Sie geht der gesetzlichen Regel vor und kann alle Beschlussarten erfassen.
						</span>
					</span>
				</label>

				{#if hatVereinbarung}
					<label class="voll">
						Was die Vereinbarung regelt
						<textarea
							name="agreementSummary"
							required
							rows="3"
							placeholder="z. B. Das Stimmrecht verbleibt für alle Beschlüsse bei der Eigentümerin."
						></textarea>
						<span class="hilfe">
							Im Moment der Abstimmung muss ablesbar sein, was darin steht — der blosse Hinweis, dass es
							eine Vereinbarung gibt, hilft dann nicht.
						</span>
					</label>
				{/if}

				<label class="voll">
					Kopie des Nutzniessungsvertrags
					<input type="file" name="nachweis" accept="application/pdf,image/jpeg,image/png,image/heic" />
					<span class="hilfe">PDF oder Foto, höchstens 10 MB.</span>
				</label>

				<button type="submit">Erfassen</button>
			</form>
		</div>
	</section>
</div>

<style>

	.leer {
		color: var(--text-leise);
		max-width: 46rem;
	}




	/*
	 * **In der Kachel setzt den Abstand die Kachel** (01.09.2026, Stapelumbau).
	 * Der Bestand hing vorher frei am Seitengrund; sein Aussenrand war dort der
	 * Abstand zur Nachbarspalte. In einem gerahmten Block addiert er sich zum
	 * Innenrand, und unter «Keine Nutzniessung erfasst.» stand eine Zeile Luft
	 * ohne Grund.
	 */
	.kachel > .leer,
	.kachel > .liste {
		margin: 0;
	}

	.liste {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.liste li {
		padding: 0.9rem 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
	}

	.kopf {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		flex-wrap: wrap;
	}

	.zeitraum {
		color: var(--text-leise);
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}

	.hinweis {
		margin: 0.5rem 0 0;
		max-width: 48rem;
	}

	.nachweis {
		margin: 0.5rem 0 0;
		font-size: 0.9rem;
	}

	.nachweis.fehlt {
		color: var(--warnung);
	}

	/* Den Abstand setzt die Spalte (`gap`), nicht der Block. */
	.neu {
		margin-top: 0;
	}

	.neu h2 {
		font-size: 1rem;
		margin: 0 0 0.75rem;
	}







	.felder .kasten > span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	input:not([type='checkbox']):not([type='file']),
	.felder :global(select),
	.felder :global(.auswahlsuche),
	textarea {
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
		font-weight: 400;
	}

	textarea {
		resize: vertical;
	}

	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
		margin-top: 0.2rem;
		flex: none;
	}

	input[type='file'] {
		font: inherit;
		font-weight: 400;
		padding: 0.4rem 0;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
		flex: none;
	}
	.berichtigen {
		margin-top: 0.5rem;
	}

	/* Kein `display: flex` am summary — das nähme ihm sein Dreieck
	   (bewacht von der Stylelint-Regel `versammlung/dreieck-am-summary`). */
	.berichtigen summary {
		cursor: pointer;
		font-size: 0.9rem;
		min-height: var(--ziel-min);
		padding: 0.7rem 0;
	}
</style>
