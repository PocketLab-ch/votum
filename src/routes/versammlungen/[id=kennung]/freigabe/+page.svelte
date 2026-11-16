<script lang="ts">
	import { zustandsname } from '$lib/domain/versammlung';
	import { EINBERUFUNGSZUSTAENDIGKEIT } from '$lib/domain/freigabe';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();

	const v = $derived(data.versammlung);

	function wegzu(weg: string | undefined): string | null {
		if (weg === 'traktanden') return `/versammlungen/${v.id}/traktanden`;
		if (weg === 'einheiten') return `/gemeinschaften/${data.gemeinschaft.id}/einheiten`;
		if (weg === 'eigentuemer') return `/gemeinschaften/${data.gemeinschaft.id}/eigentuemer`;
		if (weg === 'lesarten') return `/gemeinschaften/${data.gemeinschaft.id}/lesarten`;
		return null;
	}
</script>

<div class="kopf">
	<h1>Freigabe</h1>
	<span class="zustand" data-zustand={v.zustand}>{zustandsname(v.zustand)}</span>
</div>

<p class="einleitung">
	Mit der Freigabe ist die Versammlung einberufen. Festgehalten wird, wer zum
	Versammlungsdatum stimmberechtigt ist; ab dann rechnet keine Auswertung mehr auf den lebenden Stammdaten.
	Ein Eigentümerwechsel danach verändert das Ergebnis dieser Versammlung nicht mehr.
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.freigegeben}
	<Meldung ton="gut" marke={form}>Freigegeben. Wer stimmberechtigt ist, steht jetzt fest.</Meldung>
{:else if form?.zurueckgenommen}
	<Meldung ton="gut" marke={form}>
		Freigabe zurückgenommen. Der festgehaltene Stand ist verworfen. War der Haken «Die
		Einladung ist verschickt» gesetzt, ist er jetzt zurückgenommen.
		<!-- Korrekturrunde 06.10.2026: an alle, die eingeladen werden, nicht nur die
		     Eigentümer (Fachprüfung 5, Rz. 56, 58 ad Art. 712n); der Haken mit seiner
		     Bedingung, nicht «danach» (Laienprüfung 5, wie der Knopftext). Bis 07.10.2026
		     «sobald sie bei allen angekommen ist», seit dem Produktentscheid 07.10.2026
		     nach dem Versand. -->
		Schicken Sie die Einladung nach der neuen Freigabe wieder an alle, die zur Versammlung dieser
		Gemeinschaft eingeladen werden. Setzen Sie den Haken neu, sobald sie verschickt ist.
		<!-- Laienprüfung Runde 3: derselbe Halbsatz wie beim Knopf. -->
		Nutzniesser, Wohnberechtigte und andere, die die Anwendung nicht führt, laden Sie ausserhalb
		der Anwendung ein.
	</Meldung>
{/if}

{#if v.zustand === 'entwurf'}
	{#if data.befund.hindernisse.length > 0}
		<section class="kasten hindernis">
			<h2>Das steht der Freigabe entgegen</h2>
			<ul>
				{#each data.befund.hindernisse as h (h.text)}
					<li>
						{h.text}
						{#if wegzu(h.weg)}<a href={wegzu(h.weg)}>Beheben</a>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.befund.hinweise.length > 0}
		<section class="kasten warnung">
			<h2>Auffällig, hält aber nicht auf</h2>
			<ul>
				{#each data.befund.hinweise as h (h.text)}
					<li>
						{h.text}
						{#if wegzu(h.weg)}<a href={wegzu(h.weg)}>Ansehen</a>{/if}
					</li>
				{/each}
			</ul>
			<p class="klein">
				Diese Punkte werden mit der Freigabe im Verlauf festgehalten — es soll später nicht
				rekonstruiert werden müssen, dass trotz offener Frage eingeladen wurde.
			</p>
		</section>
	{/if}

	<!--
		Unmittelbar über dem Knopf und unabhängig davon, ob er da ist: Die
		Zuständigkeit ist zu klären, bevor die Hindernisse behoben sind, nicht
		danach. Begründung bei `EINBERUFUNGSZUSTAENDIGKEIT`.
	-->
	<p class="lesebreite">{EINBERUFUNGSZUSTAENDIGKEIT}</p>

	{#if data.befund.moeglich}
		<form method="POST" action="?/freigeben">
			<button type="submit" class="haupt">Versammlung freigeben</button>
		</form>
		{#if data.befund.hinweise.length > 0}
			<p class="klein">Trotz der Hinweise oben.</p>
		{/if}
	{:else}
		<p class="klein">
			Die Freigabe ist gesperrt, solange die Punkte oben offen sind. Sie liessen jede Auszählung
			ins Leere laufen.
		</p>
	{/if}
{:else if data.momentaufnahme}
	<section class="kasten">
		<h2>Wer stimmberechtigt ist — festgehalten mit der Freigabe</h2>
		<p class="kennzahlen">
			<strong>{data.momentaufnahme.parteien}</strong>
			{data.momentaufnahme.parteien === 1 ? 'Partei' : 'Parteien'} ·
			<strong>{data.momentaufnahme.kopfstimmen}</strong> Kopfstimmen ·
			<strong>{data.momentaufnahme.wertquoten}</strong> von {data.momentaufnahme.gesamtquote} Wertquoten
		</p>

		{#if data.momentaufnahme.wertquoten !== data.momentaufnahme.gesamtquote}
			<p class="klein warnungstext">
				Die erfassten Wertquoten erreichen den Nenner aus dem Reglement nicht. Gerechnet wird
				gleichwohl auf dem Nenner: «Mehr als die Hälfte aller Wertquoten» meint
				{Math.floor(data.momentaufnahme.gesamtquote / 2) + 1} von
				{data.momentaufnahme.gesamtquote}.
			</p>
		{/if}

		<div class="tabellenbahn">
			<!--
				Rollen und `karten`: Auf dem Telefon wird jede Zeile zur Karte, sonst
				zöge die vierspaltige Tabelle die ganze Seite breit. Siehe app.css.
			-->
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<table role="table" class="karten">
				<thead>
					<!-- svelte-ignore a11y_no_redundant_roles -->
					<tr role="row">
						<th scope="col">Partei</th>
						<th scope="col">Einheiten</th>
						<th scope="col" class="zahl">Kopfstimmen</th>
						<th scope="col" class="zahl">Wertquote</th>
					</tr>
				</thead>
				<tbody>
					{#each data.momentaufnahme.eintraege as e (e.name)}
						<!-- svelte-ignore a11y_no_redundant_roles -->
						<tr role="row">
							<td role="cell" class="kopfzelle">
								{e.name}
								{#if e.ausgeuebtDurch !== e.name}
									<span class="klein">ausgeübt durch {e.ausgeuebtDurch}</span>
								{/if}
							</td>
							<td role="cell" data-spalte="Einheiten" class="zellenzusatz">{e.einheiten.join(', ')}</td>
							<td role="cell" data-spalte="Kopfstimmen" class="zahl">{e.kopfstimmen}</td>
							<td role="cell" data-spalte="Wertquote" class="zahl">{e.wertquote}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	{#if v.zustand === 'freigegeben'}
		<section class="kasten">
			<!--
				**Eine Überschrift je Zustand** (Nachzug-Abnahme, B4e, 03.10.2026).
				Bis dahin stand über beiden «Freigabe zurücknehmen», und im Zustand
				mit Vollmacht widersprach der Satz darunter der Überschrift: Der
				Knopf fehlt, die Rücknahme ist endgültig. Die Überschrift sagt es
				jetzt selbst.
			-->
			{#if data.vollmachtenHaengen}
				<h2>Freigabe lässt sich nicht mehr zurücknehmen</h2>
				<!--
					**Mit der ersten Vollmacht ist die Rücknahme Geschichte**
					(Nachzug Block 3, Entscheid E vom 03.10.2026). Der Knopf
					verschwindet, statt in die Absage `vollmachten_haengen` zu
					 führen; das Löschen der Vollmachten weist der Auslöser
					`proxy_nur_lebensweg` ab, und gezählt wird in jedem Zustand.
				-->
				<p>
					An dieser Versammlung hängt bereits eine Vollmacht. Die Rücknahme würde den
					festgehaltenen Stand verwerfen, und daran hängen die Vollmachten; auch eine
					zurückgewiesene oder widerrufene lässt sich nicht löschen. <strong>Die Freigabe lässt
						sich damit nicht mehr zurücknehmen.</strong>
				</p>
			{:else}
				<h2>Freigabe zurücknehmen</h2>
				<p>
					Möglich bis zur Eröffnung. Der festgehaltene Stand wird dabei <strong>vollständig
						verworfen</strong>, nicht fortgeschrieben — bei erneuter Freigabe entsteht er neu und kann
					andere Zahlen tragen.
				</p>
				<p class="klein">
					Mit der ersten Vollmacht endet das: Sie lässt sich danach nicht mehr zurücknehmen. Auch
					eine Vollmacht, die ein Eigentümer über den eigenen Zugang erklärt, zählt dafür.
				</p>
				<!--
					**Der Versandvermerk fällt mit** (Produktentscheid 06.10.2026,
					«Nein, Neuversand verlangen»; `loescheEinladungsmehrBeiRuecknahme`).
					Auch der Merker der Erinnerung fällt, und «Einladung erzeugt» zählt
					nur seit der Rücknahme (Produktentscheide 06.10.2026, «Rücknahme
					setzt den Merker zurück», «Seit Rücknahme zählen»; Migration 147).
					Eine neue Erinnerung verspricht der Text trotzdem nicht: Sie kommt
					nur mit erfasster Frist, Erinnerungsadresse und Mailausgang.
				-->
				<p>
					Bei der Rücknahme fällt ein gesetzter Haken «Die Einladung ist verschickt» (Seite
					Vorbereitung) zurück. Die Anwendung behandelt die neue Freigabe als neue Einladung.
					<!-- «dieser Gemeinschaft»: Am gemeinsamen Abend hiesse «an alle» sonst «an alle
					     Häuser» (Laienprüfung Runde 3, Produktentscheid «Gesammelt nachbessern»,
					     06.10.2026). Die Freigabe gilt je Versammlung, also je Gemeinschaft. Nicht
					     nur die Eigentümer: auch Nutzniesser und Wohnberechtigte werden eingeladen
					     (Fachprüfung 5, Korrekturrunde; Rz. 56, 58 ad Art. 712n). «Ehrlich mit
					     Hinweis» (Produktentscheid 06.10.2026): Der Versand der Anwendung geht an
					     die Parteien des Kartensatzes und ihre Mitberechtigten (`versandpaket.ts`);
					     von der Nutzniessung kennt die Anwendung nur den Namen, keine Anschrift,
					     und Wohnberechtigte gar nicht. -->
					Schicken Sie sie wieder an alle, die zur Versammlung dieser Gemeinschaft eingeladen
					werden; sicher ist sie, wenn sie bis zum letzten Tag der Einberufungsfrist bei allen ist.
					<!-- «Bis zum letzten Tag» statt «innert der Frist» (Auftrag «Hinweise lesbar»,
					     06.10.2026): Das las sich als «in den nächsten Tagen». -->
					<!-- Haken nach dem Versand, Empfang bei der Sitzungsleitung (Produktentscheid
					     07.10.2026, «Nur noch aufmerksam machen»; bis 07.10.2026 «sobald sie bei
					     allen ist»). -->
					Setzen Sie den Haken neu, sobald sie verschickt ist. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht. Nutzniesser, Wohnberechtigte und andere, die
					die Anwendung nicht führt, laden Sie ausserhalb der Anwendung ein. Der Versand der
					Anwendung geht nur an die Eigentümer.
				</p>
				<form method="POST" action="?/zuruecknehmen" class="zeile">
					<input name="grund" placeholder="Grund (freiwillig)" maxlength="300" />
					<button type="submit" class="leise">Freigabe zurücknehmen</button>
				</form>
			{/if}
		</section>
	{:else}
		<p class="klein">
			Die Versammlung ist eröffnet. Der festgehaltene Stand ist unveränderlich: Es wurde bereits auf ihm
			gerechnet, und ein neuer Stand machte jede bisherige Feststellung unbelegbar.
		</p>
	{/if}
{/if}

<style>

	.kopf {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.kasten {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
		max-width: 46rem;
		margin: 1.25rem 0;
	}

	.kasten.hindernis {
		border-color: var(--fehler);
		background: color-mix(in srgb, var(--fehler) 7%, var(--flaeche));
	}

	.kasten.warnung {
		border-color: var(--warnung);
		background: color-mix(in srgb, var(--warnung) 8%, var(--flaeche));
	}

	.kasten h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	.kasten ul {
		margin: 0 0 0.5rem;
		padding-left: 1.2rem;
	}

	.kasten li {
		margin-bottom: 0.35rem;
	}

	.kasten li a {
		margin-left: 0.5rem;
		font-size: 0.9rem;
	}

	.kennzahlen {
		font-variant-numeric: tabular-nums;
	}

	/* `display` nur am `span`: Als blosse Klasse auf einem `<td>` macht sie aus
	   der Zelle einen Block — sie fällt dann aus ihrer Zeile, und die Tabelle
	   bekommt eine Treppe. `scripts/check-anzeigeart.mjs` hält es offen. */
	span.klein {
		display: block;
	}

	.klein,
	td.zellenzusatz {
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.warnungstext {
		color: var(--warnung);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.75rem;
		font-size: 0.9rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	.zahl {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.zeile {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	input {
		flex: 1 1 14rem;
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1.25rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-leise);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	/*
	 * In der Karte richtet die rechte Kante nicht mehr aus, sie trennt: «1» stand
	 * am fernen Rand, seine Beschriftung «Kopfstimmen:» links daneben. Die Regel
	 * steht hier und nicht in app.css, weil Sveltes Bereichsklasse `.zahl` sonst
	 * jede globale Regel schlägt.
	 */
	@media (max-width: 46rem) {
		td.zahl {
			text-align: left;
		}
	}
</style>
