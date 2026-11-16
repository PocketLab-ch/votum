<script lang="ts">
	import Meldung from '$lib/components/Meldung.svelte';
	let { data, form } = $props();

	const v = $derived(data.versammlung);
	const ziel = $derived(`/versammlungen/${v.id}/zugaenge/karten.pdf`);
	const paket = $derived(`/versammlungen/${v.id}/zugaenge/versandpaket.zip`);

	function zeitpunkt(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString('de-CH', {
			timeZone: 'Europe/Zurich',
			dateStyle: 'short',
			timeStyle: 'short'
		});
	}
</script>

<h1>Persönliche Zugänge</h1>

<p class="einleitung">
	Jeder Eigentümer erhält <strong>eine eigene Karte</strong> mit seinem QR-Code — getrennt von
	der Traktandenliste, die für alle gleich ist. Zusammen auf einem Blatt hätte das drei
	Nachteile:
</p>
<ul class="einleitung">
	<li>Es entstünden so viele vollständige Traktandenlisten, wie es Karten gibt.</li>
	<li>Jede Änderung an der Liste machte alle Zugänge neu nötig.</li>
	<li>
		Beim Kuvertieren genügte ein vertauschtes Blatt, und jemand stimmte unter fremdem Namen ab.
	</li>
</ul>

{#if !data.freigegeben}
	<p class="meldung warnung">
		Zugänge entstehen erst mit der Freigabe: Vorher steht noch nicht fest, wer stimmberechtigt ist.
		<a href="/versammlungen/{v.id}/freigabe">Zur Freigabe</a>
	</p>
{:else}
	<div class="hinweis">
		<h2>Der Code erscheint genau einmal</h2>
		<p>
			Gespeichert wird nur ein Prüfwert, nie der Code selbst — ein Datenbankauszug gibt damit keine
			gültigen Zugänge preis. Die Karte lässt sich deshalb später nicht noch einmal herunterladen:
			Wer sie verliert, bekommt einen <strong>neuen</strong> Zugang, und der alte wird dabei
			ungültig.
		</p>
		<!--
			**Was der erste Blick bewirkt** (23.08.2026, Prüflauf I, B-25). Die Seite
			erklärte gut, dass der Code nur einmal erscheint — kein Wort davon, dass
			er sich beim ersten Öffnen an ein Gerät bindet. Wer ihn zur Kontrolle
			selbst aufruft, hat ihn damit verbraucht: Der Eigentümer steht dann am
			Eingang mit einer Karte, die schon jemandem gehört.
		-->
		<p>
			<strong>Und er bindet sich beim ersten Öffnen an ein Gerät.</strong> Wer den Link zur
			Kontrolle selbst aufruft, hat den Zugang damit an sein eigenes Gerät gebunden — der
			Eigentümer bekommt dann am Eingang eine Absage und braucht einen neuen. Prüfen Sie die
            Karte am Papier, nicht am Link.
		</p>
	</div>

	{#if data.ohneZugang > 0}
		<form method="POST" action={ziel} class="erzeugen">
			<input type="hidden" name="form" value="sammel" />
			<button type="submit">
				Karten für {data.ohneZugang}
				{data.ohneZugang === 1 ? 'Partei' : 'Parteien'} erzeugen
			</button>
			<span class="klein">Nur für die, die noch keinen gültigen Zugang haben.</span>
		</form>
	{:else}
		<p class="klein">Alle Parteien haben einen gültigen Zugang.</p>
	{/if}

	<h2>Wer hat eine Karte</h2>

	<div class="tabellenbahn">
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<table role="table" class="karten">
		<thead>
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<tr role="row">
				<th scope="col">Partei</th>
				<th scope="col">Einheiten</th>
				<th scope="col">Zugang</th>
				<th scope="col">Zuletzt genutzt</th>
				<th scope="col"><span class="nurLeser">Aktion</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.uebersicht as u (u.snapshotPartyId)}
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<tr role="row">
					<td role="cell" class="kopfzelle">
						{u.name}
						{#if u.ausgeuebtDurch !== u.name}
							<span class="klein">Stimme: {u.ausgeuebtDurch}</span>
						{/if}
					</td>
					<td role="cell" data-spalte="Einheiten" class="zellenzusatz">{u.einheiten.join(', ')}</td>
					<td role="cell" data-spalte="Zugang">
						{#if u.zustand === 'gueltig'}
							<span class="marke gut">gültig</span>
							{#if u.anzahl > 1}
								<span class="klein">{u.anzahl - 1}× ersetzt</span>
							{/if}
						{:else}
							<span class="marke">keine Karte</span>
						{/if}
					</td>
					<td role="cell" data-spalte="Zuletzt genutzt" class="zellenzusatz">{zeitpunkt(u.zuletztGenutztAm)}</td>
					<td role="cell" class="tat">
						<form method="POST" action={ziel}>
							<input type="hidden" name="form" value="einzeln" />
							<input type="hidden" name="partei" value={u.snapshotPartyId} />
							<button type="submit" class="leise">
								{u.zustand === 'gueltig' ? 'Neu erzeugen' : 'Karte erzeugen'}
							</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
		</table>
	</div>

	<h2>Für den Versand</h2>
	<p class="klein">
		Alle Formen erzeugen für jede noch nicht versorgte Partei einen Zugang. Wollen Sie einen
		bestehenden ersetzen, tun Sie das oben einzeln.
	</p>

	{#if form?.bericht}
		<!--
			Je Nachricht ein Ergebnis, nicht eine Gesamtzahl: «12 von 14 verschickt»
			lässt offen, welche zwei fehlen — und genau das braucht man.
		-->
		<div class="meldung" class:gut={form.bericht.ergebnisse.every((e) => e.zugestellt)}>
			<p><strong>{form.bericht.satz}</strong></p>
			{#if form.bericht.ergebnisse.some((e) => !e.zugestellt)}
				<!--
					**Ohne Schlüssel** (27.08.2026, aus dem Code-Review). `parteiId` war
					einer, ist aber seit den Mitberechtigten nicht mehr eindeutig: Wer
					eine eigene Wohnung hält und daneben an einer zweiten mitberechtigt
					ist, steht zweimal darin — einmal mit Karte, einmal ohne. Zwei
					gleiche Schlüssel werfen in Svelte 5 `each_key_duplicate`, und die
					Seite zeigte nach dem Versand gar nichts mehr. Die Liste ist eine
					einmalige Ausgabe; sie braucht keinen.
				-->
				<ul>
					{#each form.bericht.ergebnisse.filter((e) => !e.zugestellt) as e}
						<li>{e.name} ({e.an}): {e.grund ?? 'ohne Angabe'}</li>
					{/each}
				</ul>
			{/if}
			{#if form.bericht.plan.ohneAdresse.length > 0}
				<p class="klein">
					Ohne E-Mail-Adresse und deshalb nicht angeschrieben:
					{form.bericht.plan.ohneAdresse.join(', ')}. Was für sie bestimmt ist, liegt im
					Versandpaket.
				</p>
			{/if}
			{#if form.bericht.plan.mehrfach.length > 0}
				<p class="klein">
					Mehrere Sendungen an dieselbe Adresse:
					{#each form.bericht.plan.mehrfach as m (m.adresse)}
						{m.adresse} ({m.parteien.join(', ')}){' '}
					{/each}
				</p>
			{/if}
		</div>
	{:else if form?.fehler}
		<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
	{:else if data.absage}
		<!--
			Die Absage eines Downloadwegs (22.08.2026, Befund B-04). Sie kommt über
			die Adresse zurück, weil eine Dateiauslieferung keine Formularantwort
			kennt — und sie steht hier statt auf einer nackten Fehlerseite: Wer
			Zugänge vorbereitet, soll dabei bleiben können.

			**Ton `warnung`, nicht `fehler`:** «Alle haben schon einen Zugang» ist
			keine Panne, sondern eine Auskunft mit einem Weg daneben.

			**Kein `<Meldung>`, und `role="alert"` bleibt** (02.09.2026). Der
			Baustein vergibt bei `warnung` ein `role="status"`, hier soll die Absage
			aber sofort angesagt werden. Und er hängt am `marke`-Wert: Diese Meldung
			kommt aus der Adresse, `form` ist dabei `null` und bliebe es — nach
			einem Wegdrücken käme auch die nächste Absage nicht mehr an.
		-->
		<p class="meldung warnung" role="alert">{data.absage}</p>
	{/if}

	<!--
		**Ein Knopf, der nur absagen kann, ist ein Fehler** — auch mit schöner
		Meldung (Lehre vom 21.08.2026, hier angewandt am 22.08.). Haben alle
		Parteien einen gültigen Zugang, erzeugen die drei Sammelwege nichts und
		weisen ab. Statt das geschehen zu lassen, steht der Grund vorher da.

		Die Wege bleiben trotzdem anklickbar: Zwischen Laden und Klick kann ein
		Zugang ablaufen, und dann tun sie wieder etwas. Gesperrt wäre hier die
		schlechtere Antwort — die Erklärung reicht.
	-->
	{#if data.ohneZugang === 0}
		<p class="klein hinweis-alle">
			Alle {data.uebersicht.length} Parteien haben einen gültigen Zugang. Die Sammelwege unten
			erzeugen deshalb nichts Neues; ein bestehender Code lässt sich nicht noch einmal
			ausdrucken. Zum Ersetzen wählen Sie in der Liste oben «Neu erzeugen».
		</p>
	{/if}

	<div class="formen">
		{#if data.mailMoeglich}
			<!--
				Nur mit eingerichtetem Mailausgang. Ohne ihn gäbe es einen Knopf, der
				nichts tut — und die drei übrigen Wege bleiben ohnehin.
			-->
			<form method="POST" action="?/versenden">
				<button type="submit">Einladungen per Mail verschicken</button>
				<span class="klein">
					Je Empfänger <strong>eine eigene Nachricht mit einem eigenen Anhang</strong>, nie
					eine Sammelmail: Der Anhang trägt den Zugangscode. Gehört eine Einheit mehreren
					Personen gemeinsam, bekommt jede von ihnen dieselbe Karte. Die Einheit hat trotzdem
					eine Stimme; wer den Code zuerst benutzt, übt sie aus. Wer keine Adresse hinterlegt
					hat, wird danach namentlich genannt.
				</span>
			</form>
		{/if}

		<form method="POST" action={paket}>
			<input type="hidden" name="form" value="paket" />
			<button type="submit">Versandpaket als ZIP</button>
			<span class="klein">
				Eine ZIP-Datei mit lauter Einzeldokumenten: die Traktandenliste einmal, dazu je ein
				persönliches QR-Blatt und je ein Vollmachtsformular. Für die Dokumentenablage, aus der
				jeder Eigentümer den Verweis auf <strong>seine</strong> Dateien bekommt. Eine
				Versandliste zum Zuordnen von Dateien, Partei und E-Mail-Adresse liegt bei.
			</span>
		</form>

		<form method="POST" action={ziel}>
			<input type="hidden" name="form" value="sammel" />
			<button type="submit" class="leise">Alle Karten in einer Datei</button>
			<span class="klein">Eine Seite je Person, zum Ausdrucken und Kuvertieren.</span>
		</form>

		<form method="POST" action={ziel}>
			<input type="hidden" name="form" value="versandsatz" />
			<button type="submit" class="leise">Versandsatz je Eigentümer</button>
			<span class="klein">
				Traktandenliste, persönliche Karte und Vollmachtsformular hintereinander, als ein PDF.
			</span>
		</form>

		<!--
			**Ein eigener Weg zum Vollmachtsformular** (Bedienbarkeitsprüfung
			05.09.2026, Befund 25). Es liegt im Versandsatz bei — der entsteht aber
			nur zusammen mit **neuen** Zugangscodes, und das entwertet die alten.
			Wer nur ein Blatt nachdrucken will, weil jemand anruft und es verlegt
			hat, darf dafür niemandem den Zugang nehmen. Deshalb ein Verweis und
			kein Formular: Hier geschieht nichts.
		-->
		<!--
			**Nur, wenn es eine Partei gibt.** Ohne stimmberechtigte Partei sagt der
			Weg fachlich ab (409), und ein Verweis, der in eine Absage führt, ist
			der Befund, den `scripts/check-absagen.mjs` bewacht. Die Liste oben ist
			dann ohnehin leer.
		-->
		{#if data.uebersicht.length > 0}
		<p class="ausgabe">
			<a href="/versammlungen/{v.id}/vollmachtsformular.pdf">
				Nur die Vollmachtsformulare
			</a>
			<span class="klein">
				Ein Blatt je Partei, mit Name und Einheiten schon darauf: zum Unterschreiben und
				Mitbringen. Ohne neue Zugangscodes.
			</span>
		</p>
		{/if}
	</div>

	<p class="klein">
		Im Versandpaket liegt die Traktandenliste <strong>einmal</strong> und nicht bei jeder Karte: Sie
		ist für alle dieselbe, ein Verweis genügt für alle. Sonst zöge eine berichtigte Liste vierzehn
		neue Zugangscodes nach sich — für nichts.
	</p>

	<p class="klein">
		Eine geänderte Traktandenliste macht bestehende Karten <strong>nicht</strong> ungültig: Der
		Zugang hängt an der Person, nicht an der Liste.
	</p>
{/if}

<style>

	.hinweis {
		border: 1px solid var(--warnung);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 10%, transparent);
		padding: 0.85rem 1rem;
		max-width: 46rem;
		margin: 1.25rem 0;
	}

	.hinweis h2 {
		margin: 0 0 0.35rem;
		font-size: 0.95rem;
	}

	.hinweis p {
		margin: 0;
	}

	h2 {
		margin-top: 2rem;
		font-size: 1.15rem;
	}

	.erzeugen {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin: 1.25rem 0;
	}

	table {
		width: 100%;
		max-width: 52rem;
		border-collapse: collapse;
		margin-top: 0.75rem;
		font-size: 0.92rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid var(--linie);
		vertical-align: top;
	}

	/* `display` nur am `span`: Als blosse Klasse auf einem `<td>` macht sie aus
	   der Zelle einen Block — sie fällt dann aus ihrer Zeile, und die Tabelle
	   bekommt eine Treppe. `scripts/check-anzeigeart.mjs` hält es offen. */
	span.klein {
		display: block;
	}

	.klein,
	td.zellenzusatz {
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	.nurLeser {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.marke {
		display: inline-block;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: var(--flaeche-2);
		font-size: 0.8rem;
	}

	.marke.gut {
		background: color-mix(in srgb, var(--akzent) 22%, transparent);
	}

	.formen {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		margin: 1rem 0;
	}

	.formen form,
	.formen .ausgabe {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		max-width: 20rem;
	}

	/*
	 * **Der Verweis trägt das Gewicht der Knöpfe daneben** (07.09.2026, aus dem
	 * Code-Review). Als blosser Fliesstext war er in einer Reihe von vier
	 * Knöpfen zu übersehen, und am Telefon lag die Trefferfläche unter der
	 * Mindestgrösse des Projekts. Ein Verweis bleibt er trotzdem: Hier geschieht
	 * nichts Unumkehrbares.
	 */
	.formen .ausgabe a {
		align-items: center;
		align-self: start;
		display: inline-flex;
		min-height: var(--ziel-min);
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
		align-self: flex-start;
	}

	button.leise {
		background: transparent;
		border: 1px solid var(--linie);
		color: var(--text);
		font-weight: 400;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 46rem;
		margin: 1rem 0;
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}

	.meldung.gut {
		background: color-mix(in srgb, var(--akzent) 15%, transparent);
	}

	.meldung p {
		margin: 0 0 0.4rem;
	}

	.meldung p:last-child {
		margin: 0;
	}

	.meldung ul {
		margin: 0 0 0.4rem;
		padding-left: 1.25rem;
		font-size: 0.9rem;
	}

	@media (max-width: 46rem) {
		td.tat {
			padding-top: 0.5rem;
		}
	}
	.hinweis-alle {
		border-left: 3px solid var(--linie);
		margin: 0 0 0.9rem;
		max-width: 62ch;
		padding-left: 0.75rem;
	}
</style>
