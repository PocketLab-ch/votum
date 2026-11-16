<script lang="ts">
	/**
	 * Die Weisungen der Mitgliedsgemeinschaften (Stories 7.3 und 7.4).
	 *
	 * Je Traktandum eine Tafel: wer anweisen muss, wer angewiesen hat, was fehlt.
	 * Die fehlenden Häuser stehen mit Namen da — «es fehlen Weisungen» hilft
	 * nicht weiter, wenn man wissen muss, wen man anrufen soll.
	 */
	import { weisungInWorten } from '$lib/domain/weisung';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	let { data, form } = $props();

	const v = $derived(data.versammlung);
</script>

<h1>Weisungen der Mitgliedsgemeinschaften</h1>

{#if data.pflichtige.length === 0}
	<p class="lesebreite">
		Diese Gemeinschaft hat keine Mitgliedsgemeinschaften. Weisungen gibt es dort, wo die Anteile
		auf andere Gemeinschaften lauten und deren Vertreter die Stimme abgeben — etwa in einer
		Miteigentümerschaft nach ZGB Art. 655a.
	</p>
{:else}
	<p class="lesebreite">
		{data.gemeinschaftName} hat {data.pflichtige.length} Mitgliedsgemeinschaften. Sie stimmen in ihren
		eigenen Versammlungen ab; ihr Vertreter überbringt das Ergebnis. Ein weisungsgebundenes
		Traktandum lässt sich erst eröffnen, wenn alle Weisungen vorliegen.
	</p>

	{#if form?.fehler}
		<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
	{:else if form?.hinweis}
		<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
	{/if}

	<!--
		Ein Blatt je Haus (Story 7.8): Der Vertreter von Haus 4 hat mit den
		Weisungen von Haus 8 nichts zu tun, und ein gemeinsames Blatt gäbe ihm
		ohne Not Auskunft darüber, wie die anderen stimmen werden.
	-->
	<section class="blaetter">
		<h2>Weisungsblätter</h2>
		<p class="klein">
			Was der Vertreter mitnimmt: je Traktandum die Weisung seines Hauses mit dem Beschluss, auf
			den sie sich stützt.
		</p>
		<p class="liste">
			{#each data.pflichtige as p (p.parteiId)}
				<a
					class="knopf"
					href="/versammlungen/{v.id}/weisungsblatt.pdf?haus={p.parteiId}"
					target="_blank"
					rel="noopener">{p.name} (PDF)</a
				>
			{/each}
		</p>
	</section>

	{#each data.zeilen as z (z.traktandumId)}
		<!--
			**Die Kennung am Abschnitt** (08.09.2026). Wer einen bestimmten Punkt
			ansteuern will — ein Drehbuch, eine Verknüpfung aus der Steuerung —
			hatte hier nur den Titel, und zwei Punkte dürfen denselben tragen. Das
			Drehbuch über den Verbund hat deshalb den Weg über den
			Hausbeschluss ausgelassen und dabei vermerkt, die Auswahl treffe den
			falschen Abschnitt.
		-->
		<section class="traktandum" data-traktandum={z.traktandumId}>
			<div class="kopf">
				<h2>{z.nummer} {z.titel}</h2>
				{#if z.stand?.weisungsgebunden}
					<span class="marke">weisungsgebunden</span>
				{/if}
			</div>
			{#if z.antragswortlaut}
				<p class="wortlaut">{z.antragswortlaut}</p>
			{/if}

			<form method="POST" action="?/bindung" class="bindung">
				<input type="hidden" name="traktandum" value={z.traktandumId} />
				<input type="hidden" name="gebunden" value={z.stand?.weisungsgebunden ? 'false' : 'true'} />
				<button type="submit" class="leise">
					{z.stand?.weisungsgebunden ? 'Bindung aufheben' : 'Als weisungsgebunden setzen'}
				</button>
			</form>

			{#if z.stand}
				<p class="stand" class:offen={!z.stand.vollstaendig}>
					{z.stand.vorliegend} von {z.stand.erwartet} Weisungen liegen vor.
					{#if !z.stand.vollstaendig}
						Es fehlt: {z.stand.fehlend.join(', ')}.
					{/if}
				</p>

				<!--
					**Die drei Handgriffe der Kette** (Auftraggeber, 25.08.2026: «Ja, und die
					Weisung müsstest du dann auch bauen, dass dann korrekt abgestimmt
					wird»).

					Dieselbe Haltung stand bis hierher dreimal von Hand da: das Haus
					beschliesst, jemand tippt die Weisung ab, und dieselbe Haltung wird
					danach als Stimme ein drittes Mal eingetragen. Jeder Handgriff bleibt
					einzeln möglich — die Liste darunter ändert sich nicht.

					**Was jeder Knopf tut, steht auf ihm**, und was nicht ging, steht
					danach in der Meldung mit dem Namen des Hauses.
				-->
				{#if !z.abgestimmt || z.offen}
					<div class="kette">
						{#if !z.abgestimmt}
							<form method="POST" action="?/ableiten">
								<input type="hidden" name="traktandum" value={z.traktandumId} />
								<button type="submit">Weisungen aus den Hausbeschlüssen übernehmen</button>
							</form>
						{/if}

						{#if !z.abgestimmt && !z.stand.vollstaendig}
							<form method="POST" action="?/ohneBeschluss">
								<input type="hidden" name="traktandum" value={z.traktandumId} />
								<button type="submit" class="leise">
									Fehlende nach Reglement eintragen
								</button>
							</form>
						{/if}

						{#if z.stand.vollstaendig && z.offen}
							<!--
								Erst wenn die Abstimmung offen ist: Vorher gäbe es keinen
								Durchgang, in den die Stimmen fielen.
							-->
							<form method="POST" action="?/stimmen">
								<input type="hidden" name="traktandum" value={z.traktandumId} />
								<button type="submit" class="haupt">
									Stimmen nach den Weisungen abgeben
								</button>
							</form>
						{/if}
					</div>
				{/if}

				<ul class="haeuser">
					{#each z.stand.stand as h (h.parteiId)}
						<li>
							<div class="zeile">
								<span class="haus">
									{h.name}
									{#if h.vertreter}
										<span class="klein">vertreten durch {h.vertreter}</span>
									{:else}
										<span class="klein fehlt">kein Vertreter bezeichnet</span>
									{/if}
								</span>
								<span class="weisung" class:leer={!h.weisung}>
									{weisungInWorten(h.weisung, '').replace(/^:\s*/, '')}
								</span>
							</div>

							{#if !z.abgestimmt}
								<form method="POST" action="?/erfassen" class="felder erfassen">
									<input type="hidden" name="traktandum" value={z.traktandumId} />
									<input type="hidden" name="partei" value={h.parteiId} />

									{#if (data.quellen[h.parteiId] ?? []).length > 0}
										<label class="breit">
											Aus einem Beschluss des Hauses
											<Suchauswahl
												name="quelle"
												beschriftung="Aus einem Beschluss des Hauses"
												leerText="— von Hand erfassen —"
												eintraege={data.quellen[h.parteiId].map((q) => ({
													wert: `${q.versammlungId}|${q.durchgangId}`,
													text: q.text
												}))}
											/>
											<span class="hilfe">
												Die Anwendung liest das Ergebnis und rechnet es nicht nach.
											</span>
										</label>
									{/if}

									<label>
										Haltung
										<select name="haltung">
											<option value="ja">Ja</option>
											<option value="nein">Nein</option>
											<option value="enthaltung">Enthaltung</option>
										</select>
									</label>
									<label>
										Herkunft
										<!--
											Die Wahl heisst «erklärt», die Anzeige «festgehalten»
											(`weisungInWorten`): Hier wählt die Leitung den echten
											Erklärungsweg. Derselbe Codewert trägt auch die Weisung,
											die die Anwendung selbst nach der Auffangregel setzt, und
											dort hat niemand etwas erklärt.
										-->
										<select name="herkunft">
											<option value="erklaerung">schriftlich erklärt</option>
											<option value="frei">nach freiem Ermessen</option>
										</select>
									</label>
									<label class="breit">
										Bemerkung
										<input name="bemerkung" placeholder="Zirkularbeschluss vom 3. Mai" />
									</label>
									<button type="submit" class="leise">Festhalten</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else}
		<p>Diese Versammlung hat noch keine Abstimmungstraktanden.</p>
	{/each}
{/if}

<p class="klein zurueck"><a href="/versammlungen/{v.id}">Zur Versammlung</a></p>

<style>
	.traktandum {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
		margin: 1rem 0;
	}

	.kopf {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.marke {
		font-size: 0.78rem;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--akzent) 22%, transparent);
	}

	.wortlaut {
		max-width: var(--lesebreite);
		color: var(--text-leise);
		margin: 0.35rem 0;
	}

	.bindung {
		margin: 0.5rem 0;
	}

	/*
	 * **Die Kette steht in einer Zeile**, nicht untereinander: Sie ist ein
	 * Ablauf — übernehmen, ergänzen, abgeben —, und drei Knöpfe untereinander
	 * lesen sich wie drei Wahlmöglichkeiten. Auf dem Telefon bricht sie um.
	 */
	.kette {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.6rem 0;
	}

	.stand {
		margin: 0.5rem 0;
		font-weight: 550;
	}

	/* Nie Farbe allein: Der Satz nennt die fehlenden Häuser. */
	.stand.offen {
		color: var(--warnung);
	}

	.haeuser {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
	}

	.haeuser > li {
		border-top: 1px solid var(--linie);
		padding: 0.6rem 0;
	}

	.zeile {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: baseline;
	}

	.haus {
		flex: 1 1 16rem;
		font-weight: 550;
	}

	.weisung {
		flex: 2 1 22rem;
	}

	.weisung.leer,
	.fehlt {
		color: var(--warnung);
	}

	.klein {
		display: block;
		font-size: 0.85rem;
		font-weight: 400;
		color: var(--text-leise);
	}

	.erfassen {
		margin-top: 0.5rem;
	}

	.hilfe {
		font-size: 0.85rem;
		font-weight: 400;
		color: var(--text-leise);
	}




	.blaetter {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
		margin: 1rem 0;
	}

	.blaetter h2 {
		margin: 0 0 0.35rem;
		font-size: 1.05rem;
	}

	.liste {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0.75rem 0 0;
	}

	.knopf {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
		padding: 0 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 550;
	}

	.zurueck {
		margin-top: 1.5rem;
	}
</style>
