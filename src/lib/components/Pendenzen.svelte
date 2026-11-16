<script lang="ts">
	/**
	 * Die Pendenzen zu einem Traktandum — wer erledigt was bis wann.
	 *
	 * **Warum sie im Saal stehen und nicht danach nachgetragen werden.**
	 * Dieselbe Begründung wie beim Votum daneben: Die Zusage fällt, während
	 * gesprochen wird («Die Verwaltung wird das noch mit dem Bauleiter klären»).
	 * Wer sie nachher aus dem Gedächtnis aufschreibt, schreibt den Namen oder
	 * den Termin nicht mehr auf — und genau die beiden sind der Grund, warum ein
	 * Protokoll im Folgejahr überhaupt gelesen wird.
	 *
	 * **Als Komponente von Anfang an.** Der Abend führt durch die Traktanden
	 * mehrerer Häuser und braucht dasselbe Feld; zwei Fassungen sind bei Votum
	 * und Ergebnisnachgang beide Male auseinandergelaufen, bevor sie
	 * zusammengelegt wurden.
	 */
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import { fristSatz, ZUSTANDSWORT, type Pendenz, type Fristart } from '$lib/domain/pendenz';
	import { anfangswert, gefuehrteWahl } from '$lib/felder';
	import { datumKurz } from '$lib/domain/datum';

	interface Eigenschaften {
		traktandumId: string;
		pendenzen: Pendenz[];
		/**
		 * Der Text zum Beschluss dieses Traktandums, falls einer festgehalten ist.
		 *
		 * **Als Knopf, nicht als Vorbelegung** (Entscheid beim Bauen, 09.09.2026).
		 * Ein vorbelegtes Feld sähe aus wie eine bereits erfasste Pendenz, und wer
		 * es übersieht, legt den Beschluss ein zweites Mal als Aufgabe an. Der
		 * Beschluss ist auch nicht immer eine: «Das Protokoll wird genehmigt»
		 * verpflichtet niemanden zu etwas.
		 */
		beschlusstext?: string | null;
	}

	/*
	 * **Kein `mitVersammlung` wie bei `Votum`** — noch nicht (Sicherheitsprüfung
	 * 09.09.2026). Der erste Anlauf trug es mit, für den gemeinsamen Abend. Dort
	 * gibt es die Aktionen aber noch gar nicht, also las niemand das versteckte
	 * Feld: totes Beiwerk, und beim späteren Ausbau genau die Stelle, an der eine
	 * Versammlungskennung aus dem Formular statt aus der Adresse käme
	 * (`docs/audit/2026-09-07-traktandumsbindung.md`). Wer den Abend nachzieht,
	 * legt das Feld zusammen mit `hausDesAbends` an, nicht vorher.
	 */
	let { traktandumId, pendenzen, beschlusstext = null }: Eigenschaften = $props();

	/*
	 * Die gewählte Fristart je Formular — sie entscheidet, ob das Datumsfeld
	 * dasteht. Nicht als `hidden`, sondern gar nicht: Ein sichtbares Feld, das
	 * der Server verwirft, ist eine Zusage, die niemand hält.
	 */
	let neueFrist: Fristart = $state('naechste_versammlung');
	let fristJe: Record<string, Fristart> = $state({});
	const fristVon = (p: Pendenz): Fristart => fristJe[p.id] ?? p.fristArt;

	/*
	 * **Das Feld wird von Hand beschrieben, nicht gebunden** — und das ist hier
	 * kein Stilfrage.
	 *
	 * `bind:value` mit `$state` wäre der Weg, wenn das Programm den Wert führt.
	 * Es führt ihn aber nur einmal, beim Übernehmen aus dem Beschluss. Gebunden
	 * überstünde der Text das Absenden: `absenden()` ruft `form.reset()`, und ein
	 * Reset setzt auf `defaultValue` zurück — bei einem gebundenen Feld schreibt
	 * Svelte den Zustand sofort wieder hinein. Im Saal stünde nach dem Erfassen
	 * dieselbe Pendenz noch im Feld, und der nächste Klick legte sie ein zweites
	 * Mal an. Dieselbe Klasse wie beim Zuordnungsformular der Eigentümerseite
	 * (03.09.2026).
	 */
	let textfeld: HTMLInputElement | null = $state(null);
</script>

{#snippet fristfelder(art: Fristart, waehle: (a: Fristart) => void, datum: string | null)}
	<label>
		Bis wann
		<select name="fristArt" use:gefuehrteWahl={(w) => waehle(w as Fristart)}>
			<option value="naechste_versammlung" selected={art === 'naechste_versammlung'}>
				bis zur nächsten Versammlung
			</option>
			<option value="datum" selected={art === 'datum'}>bis zu einem Datum</option>
			<option value="keine" selected={art === 'keine'}>ohne Termin</option>
		</select>
	</label>
	{#if art === 'datum'}
		<label>
			Datum
			<input type="date" name="fristDatum" {...anfangswert(datum)} required />
		</label>
	{/if}
{/snippet}

<section class="pendenzen">
	<h4>Pendenzen</h4>

	{#if pendenzen.length > 0}
		<ul>
			{#each pendenzen as p (p.id)}
				<li class:abgeschlossen={p.zustand !== 'offen'}>
					<p class="satz">
						<!--
							Das Leerzeichen als `&nbsp;`-freie Entität: Svelte schluckt den
							Zeilenumbruch am Ende eines Blocks, und im Saal stand
							«die Bewirtschaftung:Offerten einholen» ohne Lücke (Durchstich
							09.09.2026).
						-->
						{#if p.verantwortlich}<strong>{p.verantwortlich}</strong>:&#32;{/if}{p.text}
						<span class="klein">— {fristSatz(p)}</span>
						{#if p.zustand !== 'offen'}
							<span class="zustand">{ZUSTANDSWORT[p.zustand]} seit {datumKurz(p.zustandSeit)}</span>
						{/if}
					</p>
					{#if p.abschlussNotiz}
						<p class="klein notiz">{p.abschlussNotiz}</p>
					{/if}

					<details>
						<summary>Ändern oder abschliessen</summary>

						<!--
							`reset: false` wie beim Ändern darunter: Beide Formulare zeigen den
							Bestand, statt eine Eingabe zu sammeln. Ein Reset fiele auf die
							Werte des letzten Seitenaufbaus zurück und zeigte damit den Stand
							von vorhin unter einer Zeile, die schon den neuen nennt.
						-->
						<form
							method="POST"
							action="?/pendenzZustand"
							use:enhance={absenden({ reset: false })}
						>
							<input type="hidden" name="pendenz" value={p.id} />
							<div class="felder">
								<label>
									Zustand
									<select name="zustand">
										<option value="offen" selected={p.zustand === 'offen'}>offen</option>
										<option value="erledigt" selected={p.zustand === 'erledigt'}>erledigt</option>
										<option value="hinfaellig" selected={p.zustand === 'hinfaellig'}>
											hinfällig
										</option>
									</select>
								</label>
								<label class="breit">
									Bemerkung (freiwillig)
									<input
										name="notiz"
										{...anfangswert(p.abschlussNotiz)}
										placeholder="hat sich nicht mehr gemeldet"
									/>
								</label>
								<button type="submit" data-fokus="pendenzZustand:{p.id}">Zustand setzen</button>
							</div>
							<p class="klein">
								«Hinfällig» ist für die Zusage, die still verfallen ist. Wird der Zustand
								wieder auf «offen» gesetzt, fällt die Bemerkung weg.
							</p>
						</form>

						<form method="POST" action="?/pendenzAendern" use:enhance={absenden({ reset: false })}>
							<input type="hidden" name="pendenz" value={p.id} />
							<div class="felder">
								<label class="voll">
									Was ist zu tun
									<input name="text" {...anfangswert(p.text)} required maxlength="600" />
								</label>
								<label>
									Wer (freiwillig)
									<input name="verantwortlich" {...anfangswert(p.verantwortlich)} />
								</label>
								{@render fristfelder(
									fristVon(p),
									(a) => (fristJe = { ...fristJe, [p.id]: a }),
									p.fristDatum
								)}
								<button type="submit" data-fokus="pendenzAendern:{p.id}">Wortlaut sichern</button>
							</div>
						</form>

						{#if p.zustand === 'offen'}
							<!--
								**Die Zeile verschwindet, also braucht der Fokus ein anderes Ziel.**
								`absenden()` sucht sonst die Marke des gedrückten Knopfes — und die
								gibt es nach dem Entfernen nicht mehr, samt der ganzen Handlung zu
								diesem Gegenstand. Er landet dann still auf `<body>`. Das feste Ziel
								ist das Erfassungsfeld weiter unten; es steht immer da.
							-->
							<form
								method="POST"
								action="?/pendenzEntfernen"
								class="weg"
								use:enhance={absenden({ marke: 'pendenzNeu' })}
							>
								<input type="hidden" name="pendenz" value={p.id} />
									<Rueckfrage
									beschriftung="Pendenz entfernen"
									zeichen="kreuz"
									ton="warnung"
									frage="«{p.text}» entfernen?"
									folge="Sie ist danach weg. Was erledigt oder verfallen ist, setzen Sie stattdessen oben auf diesen Zustand — das bleibt lesbar."
									bestaetigen="Entfernen"
								/>
								<span class="klein">Nur, wenn sie versehentlich entstanden ist.</span>
							</form>
						{/if}
					</details>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="POST" action="?/pendenzErfassen" class="neu" use:enhance={absenden()}>
		<input type="hidden" name="traktandum" value={traktandumId} />
		<div class="felder">
			<label class="voll">
				Was ist zu tun
				<input
					name="text"
					bind:this={textfeld}
					data-fokus="pendenzNeu"
					{...anfangswert('')}
					required
					maxlength="600"
					placeholder="Offerten für die Rampe einholen"
				/>
			</label>
			<label>
				Wer (freiwillig)
				<input name="verantwortlich" placeholder="die Bewirtschaftung" />
			</label>
			{@render fristfelder(neueFrist, (a) => (neueFrist = a), null)}
			<button type="submit" class="haupt" data-fokus="pendenzErfassen:{traktandumId}">
				Pendenz festhalten
			</button>
		</div>
		{#if beschlusstext}
			<button
				type="button"
				class="leise uebernehmen"
				onclick={() => {
					if (textfeld) textfeld.value = beschlusstext;
				}}
			>
				Aus dem Beschluss übernehmen
			</button>
		{/if}
		<p class="klein">
			Was jemand aus diesem Traktandum zu tun hat, in einem Satz. Sie bleibt auch nach der
			Versammlung offen und lässt sich später abhaken.
		</p>
	</form>
</section>

<style>
	.pendenzen {
		margin-top: 0.75rem;
		border-top: 1px solid var(--linie);
		padding-top: 0.6rem;
	}

	.pendenzen h4 {
		margin: 0 0 0.4rem;
		font-size: 1rem;
	}

	.pendenzen ul {
		list-style: none;
		margin: 0 0 0.6rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pendenzen li {
		border-left: 3px solid var(--akzent);
		padding-left: 0.6rem;
	}

	/* Abgeschlossenes tritt zurück, verschwindet aber nicht: Dass etwas erledigt
	   oder verfallen ist, gehört zum Sachstand. */
	.abgeschlossen {
		border-left-color: var(--linie);
		color: var(--text-leise);
	}

	.satz {
		margin: 0;
	}

	.zustand {
		margin-left: 0.4rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.notiz {
		margin: 0.1rem 0 0;
	}

	.pendenzen summary {
		min-height: var(--ziel-min);
		padding: 0.35rem 0;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.felder {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 0.4rem 0.6rem;
		margin: 0.4rem 0;
	}

	.felder label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-weight: 550;
	}

	.felder label.voll {
		grid-column: 1 / -1;
	}

	.felder label.breit {
		grid-column: span 2;
	}

	.felder input,
	.felder select {
		min-height: var(--ziel-min);
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		max-width: 100%;
		box-sizing: border-box;
	}

	/* Platz für den Pfeil wie `main select` in app.css (Auftrag V2,
	   06.10.2026); die Regel darüber wiegt mehr und nahm ihn zurück.
	   «bis zur nächsten Versammlung» lief bei 9.6 px Polster an den Pfeil. */
	.felder select {
		padding-right: 1.75rem;
	}

	.felder button {
		min-height: var(--ziel-min);
		align-self: end;
		padding: 0 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		cursor: pointer;
		/* «Pendenz festhalten» lief in der Rasterspalte zweizeilig
		   (Praxisfund 03.10.2026); die Beschriftung bleibt eine Zeile. */
		white-space: nowrap;
	}

	/* Nur das Erfassen ist der Akzentknopf: Es ist die Handlung, für die dieser
	   Abschnitt im Saal dasteht. Alles übrige geschieht Monate später. */
	.felder button.haupt {
		border-color: var(--akzent);
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 550;
		padding: 0 1.1rem;
	}

	.uebernehmen {
		min-height: var(--ziel-min);
		padding: 0 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}

	.pendenzen p.klein {
		margin: 0.2rem 0 0;
	}

	/* «Das Unumkehrbare rückt weg» (docs/gestaltung.md). */
	.weg {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.4rem;
	}
</style>
