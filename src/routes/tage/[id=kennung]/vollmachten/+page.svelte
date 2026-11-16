<script lang="ts">
	/**
	 * Die Vollmachten des ganzen Abends (Auftraggeber, 23.08.2026): «Wie auch Vollmachten
	 * […] muss über die Gruppe gehen.»
	 *
	 * **Zusammen steht die Sicht, nicht die Vollmacht.** Eine Vollmacht gilt für
	 * eine Gemeinschaft; wer in zwei Häusern Eigentümer ist, erteilt zwei. Die
	 * Zeile nennt deshalb immer ihr Haus, und die Gruppen bleiben getrennt.
	 */
	import Meldung from '$lib/components/Meldung.svelte';
	import { brauchtNachweis, istBestaetigbar } from '$lib/domain/vollmacht';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';

	let { data, form } = $props();

	const ZUSTAND: Record<string, string> = {
		erfasst: 'erfasst — noch nicht wirksam',
		bestaetigt: 'bestätigt',
		zurueckgewiesen: 'zurückgewiesen',
		widerrufen: 'widerrufen',
		verdraengt: 'verdrängt'
	};
</script>

<h1>Vollmachten des Abends</h1>

<!--
	**Was gilt, steht auf der Seite** — nicht nur in der Ablaufleiste, die man
	beim Arbeiten nicht liest. Aufgefallen im Durchgang: Der Satz stand in der
	Schrittbeschreibung und im Quelltext, und beides sieht im Saal niemand.

	Er ist keine Beiläufigkeit: Wer glaubt, eine Vollmacht gelte für den ganzen
	Abend, nimmt sie einmal entgegen und wundert sich, dass im zweiten Haus die
	Stimmkraft fehlt.
-->
<p class="einleitung">
	Eine Vollmacht gilt <strong>je Gemeinschaft</strong>. Wer in zwei Häusern Eigentümer ist,
	erteilt zwei — hier stehen sie nebeneinander, jede bei ihrem Haus.
</p>

<!--
	**Die Zahl der offenen zuerst.** Sie sagt, wie viel Arbeit am Eingang noch
	liegt — und eine erfasste Vollmacht überträgt noch nichts.
-->
<p class="einleitung">
	{#if data.offen === 0}
		Keine Vollmacht wartet auf Bestätigung.
	{:else if data.offen === 1}
		<strong>Eine Vollmacht</strong> ist erfasst und noch nicht bestätigt — sie überträgt bis
		dahin nichts.
	{:else}
		<strong>{data.offen} Vollmachten</strong> sind erfasst und noch nicht bestätigt — sie
		übertragen bis dahin nichts.
	{/if}
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

{#each data.haeuser as haus (haus.meetingId)}
	<section class="haus">
		<h2>{haus.gemeinschaft}</h2>

		{#if haus.vollmachten.length === 0}
			<p class="leer">
				Keine Vollmacht erfasst.
				<a href="/versammlungen/{haus.meetingId}/vollmachten">Hier erfassen</a>
			</p>
		{:else}
			<ul class="liste">
				{#each haus.vollmachten as v (v.id)}
					<li class="zeile" class:offen={v.zustand === 'erfasst'}>
						<div class="wer">
							<strong>{v.bevollmaechtigt}</strong> vertritt {v.vertreteneName}
							<span class="stand">{ZUSTAND[v.zustand] ?? v.zustand}</span>
							<!-- H-1 (07.11.2026): Das Merkmal wie auf der Seite je
							     Versammlung, damit die Leitung beim Durchgehen des
							     Abends sieht, welche Vollmachten ruhen. -->
							{#if v.istVerwaltung}<span class="stand">· Verwaltung</span>{/if}
							<!--
								**Warum diese Zeile bestätigbar ist und jene nicht** (Code-Review
								06.09.2026): Eine über den Zugang erklärte Vollmacht trägt weder
								Vermerk noch Datei, lässt sich aber bestätigen — die Erklärung
								selbst ist der Nachweis. Ohne diese Angabe stünden zwei gleich
								aussehende Zeilen nebeneinander, von denen nur eine einen Knopf
								hat. Die Schwesterseite je Versammlung sagt es an derselben
								Stelle.
							-->
							{#if v.herkunft === 'zugang'}
								<span class="stand">über den persönlichen Zugang erklärt</span>
							{/if}
							{#if v.nachweisVorgelegt}<span class="stand"
									>{v.mitberechtigung === 'nicht_eingetragen'
										? 'Nachweis der Mitberechtigung vorgelegt'
										: 'Original vorgelegt'}</span
								>{/if}
							{#if !brauchtNachweis(v) && v.herkunft !== 'zugang'}
								<span class="stand">kein Nachweis nötig, als Mitberechtigte im Register</span>
							{/if}
							{#if v.anzahlDateien > 0}
								<span class="stand">{v.anzahlDateien} Datei{v.anzahlDateien === 1 ? '' : 'en'}</span>
							{/if}
						</div>

						{#if v.zustand === 'erfasst'}
							<div class="tat">
								<!--
									Wie auf der Seite je Versammlung (Codeprüfung 03.11.2026, M2):
									kein Knopf bei der eingetragenen Mitberechtigten, denn es gibt
									kein Blatt; bei «nicht im Register» nennt er den Nachweis.
								-->
								{#if !v.nachweisVorgelegt && brauchtNachweis(v)}
									<form method="POST" action="?/vorlegen">
										<input type="hidden" name="meeting" value={haus.meetingId} />
										<input type="hidden" name="id" value={v.id} />
										<button type="submit">
											{v.mitberechtigung === 'nicht_eingetragen'
												? 'Nachweis der Mitberechtigung vorgelegt'
												: 'Original vorgelegt'}
										</button>
									</form>
								{/if}
								<!--
									**Kein Knopf, der nur scheitern kann** (Bedienbarkeitsprüfung
									05.09.2026, Befund 32): «Ohne vermerkten Nachweis führt
									‹Bestätigen› zwangsläufig zur Absage. Der Knopf steht in
									seinem einzigen möglichen Zustand da, um zu scheitern.»

									`verlangeBestaetigbar` weist eine Vollmacht ohne Nachweis und
									ohne Datei ab; über den Zugangsweg ist die Erklärung selbst
									der Nachweis. Wo der Knopf nicht trägt, steht jetzt der Satz,
									der sagt, was zuerst zu tun ist — die Absage des Servers
									bleibt als Sicherung bestehen.
								-->
								{#if istBestaetigbar(v)}
									<form method="POST" action="?/bestaetigen">
										<input type="hidden" name="meeting" value={haus.meetingId} />
										<input type="hidden" name="id" value={v.id} />
										<button type="submit" class="haupt">Bestätigen</button>
									</form>
								{:else}
									<!--
										**Der genannte Weg muss von hier aus gehen** (Code-Review
										06.09.2026). Der erste Anlauf nannte auch das Hinterlegen
										einer Datei — das gibt es nur auf der Seite je Versammlung,
										nicht hier am Abend. Wer im Saal am Eingang steht, liest
										jetzt den Weg, der neben ihm als Knopf steht.
									-->
									<p class="ohneNachweis">
										{v.mitberechtigung === 'nicht_eingetragen'
											? 'Zum Bestätigen fehlt der Nachweis der Mitberechtigung: «Nachweis der Mitberechtigung vorgelegt» vermerken.'
											: 'Zum Bestätigen fehlt der Nachweis: «Original vorgelegt» vermerken.'}
									</p>
								{/if}
								<!--
									**G-1 (Lauf 5, 07.11.2026):** Die Knöpfe zum Kennzeichnen stehen
									auch bei einer erfassten Vollmacht, wie auf der Seite je
									Versammlung: Der Einlasstisch ist der Ort, an dem das Blatt
									vorliegt und die Frage fällt, und wer erst nach dem Bestätigen
									kennzeichnen könnte, trüge es nach, während die Vollmacht schon
									überträgt.
								-->
								{#if v.bevollmaechtigtId === null}
									<form method="POST" action="?/verwaltung">
										<input type="hidden" name="meeting" value={haus.meetingId} />
										<input type="hidden" name="id" value={v.id} />
										<!-- Nur einer der beiden Knöpfe steht je Zustand; Enter
										     soll keine der beiden Handlungen erraten. -->
										<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
										{#if v.istVerwaltung}
											<button type="submit" name="istVerwaltung" value="nein">
												Kennzeichnung entfernen
											</button>
										{:else}
											<button type="submit" name="istVerwaltung" value="ja">
												Als Verwaltung kennzeichnen
											</button>
										{/if}
									</form>
								{/if}
								<!--
									**Mit Grund**, und deshalb mit Rückfrage: Zurückweisen und
									Widerrufen sind begründungspflichtig (`verlangeGrund`). Das ist
									keine Formsache — im Protokoll steht später, warum eine
									Stimmkraft nicht übertragen wurde.
								-->
								<form method="POST" action="?/zurueckweisen" class="mitGrund">
									<input type="hidden" name="meeting" value={haus.meetingId} />
									<input type="hidden" name="id" value={v.id} />
									<input name="grund" placeholder="Grund" required minlength="3" />
									<button type="submit">Zurückweisen</button>
								</form>
							</div>
						{:else if v.zustand === 'bestaetigt'}
							<div class="tat">
								{#if v.bevollmaechtigtId === null}
									<!-- H-1 (07.11.2026): wie bei den erfassten Vollmachten. -->
									<form method="POST" action="?/verwaltung">
										<input type="hidden" name="meeting" value={haus.meetingId} />
										<input type="hidden" name="id" value={v.id} />
										<!-- Nur einer der beiden Knöpfe steht je Zustand; Enter
										     soll keine der beiden Handlungen erraten. -->
										<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
										{#if v.istVerwaltung}
											<button type="submit" name="istVerwaltung" value="nein">
												Kennzeichnung entfernen
											</button>
										{:else}
											<button type="submit" name="istVerwaltung" value="ja">
												Als Verwaltung kennzeichnen
											</button>
										{/if}
									</form>
								{/if}
								<form method="POST" action="?/widerrufen" class="mitGrund">
									<input type="hidden" name="meeting" value={haus.meetingId} />
									<input type="hidden" name="id" value={v.id} />
									<input name="grund" placeholder="Grund" required minlength="3" />
									<Rueckfrage
										beschriftung="Widerrufen"
										zeichen="kreuz"
										ton="warnung"
										frage="Vollmacht widerrufen?"
										folge="Die Stimmkraft fällt an {v.vertreteneName} zurück. Der Widerruf steht mit Grund im Verlauf."
										bestaetigen="Widerrufen"
									/>
								</form>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="weg">
				<a href="/versammlungen/{haus.meetingId}/vollmachten">Neue Vollmacht in {haus.gemeinschaft} erfassen</a>
			</p>
		{/if}
	</section>
{/each}

{#if data.haeuser.length === 0}
	<p class="leer">Noch tagt keine Gemeinschaft mit.</p>
{/if}

<style>

	.haus {
		margin-top: 1.5rem;
	}

	h2 {
		font-size: 1.1rem;
		margin-bottom: 0.5rem;
	}

	.liste {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.zeile {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.6rem 0.8rem;
	}

	.zeile.offen {
		border-color: var(--akzent);
	}

	.ohneNachweis {
		margin: 0;
		color: var(--text-leise);
		font-size: 0.9375rem;
	}

	.stand {
		color: var(--text-leise);
		font-size: 0.875rem;
		margin-left: 0.5rem;
	}

	.tat {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.mitGrund {
		display: flex;
		gap: 0.35rem;
	}

	input[name='grund'] {
		min-height: var(--ziel-min);
		padding: 0 0.5rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		max-width: 12rem;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 0.8rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}

	.leer,
	.weg {
		color: var(--text-leise);
	}
</style>
