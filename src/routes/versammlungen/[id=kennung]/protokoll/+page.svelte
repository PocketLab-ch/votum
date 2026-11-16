<script lang="ts">
	/**
	 * Das Protokoll — Notizen, Entwurf, Fassungen.
	 *
	 * **In der Reihenfolge, in der es entsteht.** Zuoberst die Notizen je
	 * Traktandum: Sie werden während der Sitzung geschrieben und sind das
	 * Einzige, was von Hand kommt. Darunter der Entwurf, der daraus und aus den
	 * Zahlen entsteht. Zuunterst die Fassungen, die es erst nach dem Versand
	 * gibt.
	 */
	import { enhance } from '$app/forms';
	import { nachziehen, type Nachzug } from '$lib/nachziehen';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import { zeitpunktKurz, datumLang } from '$lib/domain/datum';
	import Modellantwort from '$lib/components/Modellantwort.svelte';
	import SicherndesFeld from '$lib/components/SicherndesFeld.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import Signaturwege from '$lib/components/Signaturwege.svelte';
	import Standfelder from '$lib/components/Standfelder.svelte';
	import { abgeschlossen, LEITUNGSFELDER } from '$lib/domain/versammlung';
	import { BESCHLUSSVERMERK_TEXT } from '$lib/domain/protokoll';

	let { data, form } = $props();

	/*
	 * Der Nachzug für das Votenfeld: Leert jemand den Text, nimmt der Server den
	 * Beschlussvermerk weg, und das Feld sichert ohne Neuladen. Erst `jetzt()`
	 * holt den Stand; der Zuhörer wird beim Verlassen der Seite abgemeldet.
	 */
	let nach: Nachzug | null = null;
	$effect(() => {
		nach = nachziehen();
		return () => nach?.ende();
	});

	const v = $derived(data.versammlung);
	/*
	 * **Auch die versiegelte Versammlung ist geschlossen** (04.09.2026). Hier
	 * stand `=== 'geschlossen'`, und wer der Empfehlung dieser Seite folgte
	 * («erst versiegeln, dann den Entwurf erzeugen»), bekam als Erstes zu lesen,
	 * seine Zahlen seien vorläufig und die Schlusszeit fehle. Für Zahlen, die die
	 * Datenbank gerade gegen jede Änderung gesperrt hatte.
	 */
	const geschlossen = $derived(abgeschlossen(v.zustand));
	const mitNotiz = $derived(data.traktanden.filter((t) => t.notiz.trim().length > 0).length);
	// Eine Abstimmung ohne Ergebnis, an der der Haken noch fehlen kann (Block 7c).
	const hakenFehltNoch = $derived(
		data.traktanden.some((t) => t.beschlussvermerkMoeglich && !t.beschlussvermerk)
	);

	// Über die Hausfunktion, damit die Zeit nicht am Gerät hängt (04.09.2026).
	const zeitpunkt = zeitpunktKurz;
</script>

<h1>Protokoll</h1>

<p class="einleitung">
	ZGB 712n Abs. 2 verlangt ein <strong>Beschlussprotokoll</strong>, kein Wortprotokoll. Die Zahlen
	und Beschlusswortlaute stehen bereits in der Anwendung; was Sie beisteuern, sind die Begründungen
	und Voten, die zum Verständnis nötig sind.
</p>

<!--
	**Eine Sitzung, ein Protokoll** (Auftraggeber, 12.08.2026: «Es gibt dann ein Protokoll
	für die Versammlung. Nicht pro Haus.») Dasselbe Muster wie bei der
	Traktandenliste: Was hier bleibt, sind die Voten — sie entstehen während der
	Sitzung und fliessen in das eine Protokoll ein.
-->
{#if data.gemeinsam}
	<p class="meldung gemeinsam">
		Diese Versammlung gehört zu <strong>{data.gemeinsam.bezeichnung}</strong>. Das Protokoll wird
		dort geführt, für alle Gemeinschaften zusammen — <a href="/tage/{data.gemeinsam.id}/protokoll"
			>zum Protokoll des Abends</a
		>. Ihre Voten unten fliessen dort ein; einen eigenen Entwurf gibt es hier nicht, denn zwei
		Protokolle über dieselbe Sitzung wären zwei Entwürfe zum selben Beschluss. Was hier bleibt:
		das Versenden dieses Hauses und später der Eintrag seiner Genehmigung. Beides steht unter
		<a href="#fassungen">Fassungen</a>.
	</p>
{/if}

{#if form?.fehler && !form?.quelle}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis && !form?.quelle}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

<!--
	── Voten je Traktandum (FR-46) ─────────────────────────────────────────────

	**«Notizen» hiess es bis zum 12.08.2026** — und machte den Inhalt kleiner, als
	er ist. Gemeldet: «Es muss nicht Notizen oder so haben sondern einen Absatz,
	wo, wenn vorhanden, die Inhalte hinkommen. Das muss kein eigenes Label haben,
	es gehört ja zum jeweiligen Absatz.» Und darauf: «Nenne es Voten.»

	Im Dokument steht der Text ohnehin als schlichter Absatz unter seinem Punkt,
	ohne Überschrift davor. Hier heisst er jetzt so, wie er in der Versammlung
	entsteht.
-->
<h2>Voten</h2>
<p class="klein">
	Was Sie hier eintragen, steht im Protokoll als Absatz unter dem jeweiligen Traktandum. Alles
	andere — Antrag, Erfordernis, Ergebnis, Zahlen — entsteht aus den erfassten Daten. Bleibt ein
	Feld leer, steht dort nichts; nachtragen lässt es sich auch nach dem Schluss.
	<br />
	{mitNotiz} von {data.traktanden.length}
	{data.traktanden.length === 1 ? 'Traktandum trägt ein Votum' : 'Traktanden tragen ein Votum'}.
</p>

{#each data.traktanden as t (t.id)}
	<form method="POST" action="?/notiz" class="notiz" style="--tiefe: {t.tiefe}" use:enhance>
		<input type="hidden" name="traktandum" value={t.id} />
		<label for="notiz-{t.id}">
			<span class="nummer">{t.nummer}</span>
			{t.titel}
			{#if t.art === 'kenntnisnahme'}<span class="marke">Kenntnisnahme</span>{/if}
		</label>
		<SicherndesFeld
			ziel="/versammlungen/{v.id}/protokoll/sichern"
			feld="notiz"
			traktandum={t.id}
			id="notiz-{t.id}"
			name="notiz"
			wert={t.notiz}
			zeilen={t.notiz ? 4 : 2}
			platzhalter="Voten, Begründungen, Ordnungsentscheide"
			nachSichern={(text) => {
				// Der Server nimmt mit dem geleerten Text den Beschlussvermerk weg
				// (`setzeProtokollnotiz`). Ohne Neuladen bliebe der Haken darunter
				// angekreuzt stehen (Codeprüfung zur Abnahme, 02.10.2026).
				if (text.trim() === '' && t.beschlussvermerk) void nach?.jetzt();
			}}
		/>
		<!-- Der Knopf bleibt für den Fall ohne JavaScript; sonst sichert das Feld selbst. -->
		<noscript><button type="submit" class="leise">Sichern</button></noscript>
	</form>
	<!--
		**Der Beschlussvermerk** (Block 7). Er steht unter dem Votenfeld, weil er
		sich auf dessen Text bezieht; der Satz am Haken steht im Kern
		(`BESCHLUSSVERMERK_TEXT`).

		**Er erscheint nur, wo er stehen darf** — die Versammlung ist geschlossen
		oder versiegelt, und Votum führt kein Ergebnis (`beschlussvermerkMoeglich`,
		Schranken 1 und 2). Den leeren Text fängt erst der Server ab (Schranke 3):
		Das Feld sichert sich beim Verlassen selbst, und der Haken soll nicht
		verschwinden, während jemand tippt.

		**Auch am gemeinsamen Abend.** Die Seite blendet dort den eigenen Entwurf
		und den Protokolltext aus; die Votenfelder, der Fassungsabschnitt und der
		Vermerk bleiben.
	-->
	{#if geschlossen && (t.beschlussvermerkMoeglich || t.beschlussvermerk)}
		<form
			method="POST"
			action="?/beschlussvermerk"
			class="vermerk"
			style="--tiefe: {t.tiefe}"
			data-vermerk={t.id}
			use:enhance={({ formElement }) =>
				async ({ result, update }) => {
					await update();
					/*
					 * **Nach einer Absage zurück auf den Stand des Servers**
					 * (Abnahme 02.10.2026, im Browser gemessen). Das Kästchen blieb
					 * nach «Das Votenfeld ist leer» angekreuzt stehen, der Vermerk
					 * war aber nicht gesetzt. Wer danach den Text eintrug, hielt den
					 * Vermerk für gesetzt, und der Entwurf sagte weiter «nicht
					 * abgestimmt».
					 */
					if (result.type !== 'success') {
						const haken = formElement.querySelector<HTMLInputElement>('input[name="vermerk"]');
						if (haken) haken.checked = t.beschlussvermerk;
					}
				}}
		>
			<input type="hidden" name="traktandum" value={t.id} />
			<label>
				<input
					type="checkbox"
					name="vermerk"
					value="ja"
					{...angekreuzt(t.beschlussvermerk)}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
				/>
				{BESCHLUSSVERMERK_TEXT}
			</label>
			<!-- Der Knopf bleibt für den Fall ohne JavaScript; sonst schickt das Kästchen selbst ab. -->
			<noscript><button type="submit" class="leise">Übernehmen</button></noscript>
			{#if form?.quelle === `vermerk-${t.id}` && form?.fehler}
				<p class="fehler">{form.fehler.nachricht}</p>
			{/if}
		</form>
	{/if}
{:else}
	<p class="klein">Diese Versammlung hat keine Traktanden.</p>
{/each}

<!-- ── Voten ausformulieren lassen (FR-61) ───────────────────────────────── -->
<!--
	**Zwischen den Notizen und dem Protokolltext, nicht danach.**
	Ausformuliert werden die Voten, und der Entwurf entsteht daraus — wer die
	Reihenfolge umdreht, formuliert in einen fertigen Text hinein.
-->
{#if data.ki.anzeigen}
<section class="kientwurf" class:aus={!data.ki.verfuegbar}>
	<h2>Voten ausformulieren lassen</h2>
	{#if data.ki.verfuegbar}
		<p class="klein">
			Aus jedem Votum wird ein Absatz in nüchterner Form. <strong>Beschluss, Ergebnis und
			Zahlen bleiben aussen vor</strong> — die setzt die Anwendung selbst darunter, aus den
			erfassten Daten. Ein Absatz, der eine Zahl enthält, die im Votum nicht steht, wird
			verworfen statt angezeigt.
		</p>
		<form method="POST" action="?/kientwurf" use:enhance>
			<button type="submit" class="leise">Voten ausformulieren lassen</button>
		</form>
	{:else}
		<p class="klein">{data.ki.grund}</p>
	{/if}

	{#if form?.entwuerfe}
		{@const e = form.entwuerfe}
		{#if e.stufe === null}
			<p class="fehlschlag">
				Es ging nicht: {e.fehlschlaege.join(' · ')}. Am Protokoll ändert das nichts.
			</p>
		{:else}
			<p class="klein stand">
				{e.vorschlaege.filter((v) => v.absatz).length} von {e.vorschlaege.length} Voten
				formuliert{e.ohneNotiz > 0
					? `, ${e.ohneNotiz} Traktanden ohne Notiz übersprungen`
					: ''}. {e.stufe}, {(e.dauerMs / 1000).toFixed(1)} s,
				{e.namenGeschuetzt === 0 ? 'keine Namen im Text' : `${e.namenGeschuetzt} Namen ersetzt`}.
			</p>

			<!--
				**Eine Umrandung um die Entwürfe** (Audit B-09). Der Absatz ist der
				einzige Ort in dieser Anwendung, an dem freier Modelltext in ein
				Dokument wandert, das unterschrieben wird. Dass er aus der Notiz
				stammt, ist geprüft — dass er nüchtern klingt, macht ihn nicht zur
				Aussage der Anwendung.
			-->
			{#each e.vorschlaege as v (v.traktandumId)}
				<div class="vorschlag">
					<h3>{v.titel}</h3>
					{#if v.absatz}
						<!-- Nebeneinander: Wer übernimmt, soll sehen, was er ersetzt. -->
						<div class="gegenueber">
							<div>
								<span class="marke">Notiz</span>
								<p>{v.notiz}</p>
							</div>
							<div>
								<!--
									**Nur der Vorschlag trägt die Umrandung** (Abnahme zu B-09).
									Zuerst lag sie um die ganze Schleife — und damit um die Notiz,
									die die Sitzungsleitung selbst geschrieben hat, um den
									Traktandumtitel und um die Verwerfungsgründe der Anwendung. Eine
									Kennzeichnung, die auch Fremdes einschliesst, ist keine
									Kennzeichnung mehr; im schlimmsten Fall — alle Absätze verworfen
									— stand «Antwort von …» über lauter Anwendungstext.
								-->
								<!-- Ohne Dauer: Die steht einmal oben am Stand und wäre hier
								     bei zwanzig Absätzen zwanzigmal dasselbe. -->
								<Modellantwort stufe={e.stufe}>
									<span class="marke">Vorschlag</span>
									<p>{v.absatz}</p>
								</Modellantwort>
							</div>
						</div>
						{#each v.hinweise as h (h)}
							<p class="hinweis">{h}</p>
						{/each}
						<form method="POST" action="?/kiuebernehmen" use:enhance>
							<input type="hidden" name="traktandumId" value={v.traktandumId} />
							<input type="hidden" name="absatz" value={v.absatz} />
							<input type="hidden" name="nutzungId" value={e.nutzungId ?? ''} />
							<button type="submit" class="leise">Diesen Absatz als Notiz übernehmen</button>
						</form>
					{:else}
						<!--
							**Auch die Absage steht neben ihrem Gegenstand** (02.09.2026, aus
							Praxisbefund des Auftraggebers «zeigt kein Vorher/Nachher»).

							Bis hierher stand im Verwerfungsfall nur der Grund da — «Der Absatz
							nennt eine Zahl, die in der Notiz nicht vorkommt» —, ohne die Notiz,
							um die es ging. Wer prüfen wollte, ob die Verwerfung berechtigt war,
							hatte genau das nicht vor sich: Er musste zurückscrollen und das
							Traktandum wiederfinden.

							Damit sieht man ausgerechnet dort am wenigsten, wo die Anwendung
							eingegriffen hat — und das ist die Stelle, an der jemand wissen will,
							ob das Werkzeug taugt. Der Auftraggeber hat genau das gefragt.
						-->
						<div class="gegenueber">
							<div>
								<span class="marke">Notiz</span>
								<p>{v.notiz}</p>
							</div>
							<div>
								<!--
									**«Verworfen», nicht «Nicht übernommen»** (aus dem Code-Review).
									Der zweite Wortlaut steht schon unten am Entscheid der
									Sitzungsleitung, und beide sind gleichzeitig auf dem Bildschirm.
									Zweimal dasselbe Wort für zwei verschiedene Sachen — hier hat die
									Anwendung entschieden, dort der Mensch.
								-->
								<span class="marke">Verworfen</span>
								<p class="fehlschlag">{v.grund}</p>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<details class="hinausgegangen">
				<summary>Was übermittelt wurde</summary>
				<pre>{e.hinausgegangen}</pre>
			</details>

			{#if e.nutzungId}
				<form method="POST" action="?/kientwurfsentscheid" class="entscheid" use:enhance>
					<input type="hidden" name="nutzungId" value={e.nutzungId} />
					<span>Ihr Entscheid:</span>
					<button type="submit" name="entscheid" value="angenommen" class="leise" data-vorgabe="angenommen">
						Übernommen
					</button>
					<button type="submit" name="entscheid" value="veraendert" class="leise">
						Verändert übernommen
					</button>
					<button type="submit" name="entscheid" value="abgelehnt" class="leise">
						Nicht übernommen
					</button>
				</form>
				<p class="klein">
					<strong>Sie entscheiden, nicht das Werkzeug.</strong> Das Übernehmen eines Absatzes
					gilt als Entscheid; die Knöpfe hier sind für den Fall, dass Sie sich alles
					angesehen und nichts genommen haben. Der Vermerk am Schluss des Protokolls
					erscheint nur, wenn wirklich etwas übernommen wurde.
				</p>
			{/if}
		{/if}
	{/if}
</section>
{/if}

<!-- ── Entwurf und Arbeitsfassung (FR-48, FR-49) ──────────────────────────── -->
{#if !data.gemeinsam}
<!--
	**Warum das hier steht und nicht im Formular der Versammlung.** Wer den
	Vorsitz führte, steht erst am Abend fest — die Versammlung wird Wochen vorher
	angesetzt. Und gebraucht wird die Angabe genau einen Schritt später: im Kopf
	des Protokolls und über den Unterschriftszeilen. Deshalb unmittelbar über
	«Der Protokolltext», damit sie da ist, bevor der Entwurf entsteht.

	**Freiwillig, weil das Gesetz sie nicht verlangt.** Zwingender Inhalt des
	Protokolls sind die Beschlüsse (ZGB Art. 712n Abs. 2); der SVIT-Kommentar
	hält für alles Weitere fest, es könne «nur auf der Grundlage der
	Gemeinschaftsordnung verlangt» werden. Eine Pflichtangabe wäre hier strenger
	als das Recht.
-->
<h2>Vorsitz und Protokollführung</h2>

{#if form?.quelle === 'leitung' && form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{/if}

<!--
	`.felder` ist das Hausraster (`src/app.css`) — eine eigene Klasse ohne eigene
	Regel wäre «eine Rückmeldung, die niemand sieht» (docs/gestaltung.md).
	`minlength` spiegelt die Schranke des Servers, damit der Knopf nicht in die
	Absage führt.
-->
<form method="POST" action="?/leitung" class="felder" use:enhance>
	<Standfelder
		felder={Object.keys(LEITUNGSFELDER)}
		bestand={{ sitzungsleitung: v.sitzungsleitung, protokollfuehrung: v.protokollfuehrung }}
		stand={form?.stand}
	/>
	<label>
		Wer führte den Vorsitz? <span class="hilfe">freiwillig</span>
		<input
			name="sitzungsleitung"
			minlength="2"
			maxlength="120"
			{...anfangswert(
				form?.quelle === 'leitung' ? (form.werte?.sitzungsleitung ?? '') : (v.sitzungsleitung ?? '')
			)}
		/>
	</label>
	<label>
		Wer schrieb das Protokoll? <span class="hilfe">freiwillig</span>
		<input
			name="protokollfuehrung"
			minlength="2"
			maxlength="120"
			{...anfangswert(
				form?.quelle === 'leitung'
					? (form.werte?.protokollfuehrung ?? '')
					: (v.protokollfuehrung ?? '')
			)}
		/>
	</label>
	<!--
		Der Knopf steht unmittelbar im Raster, nicht in einem `<p>`: Nur so greift
		`.felder > button { align-self: end }` aus `app.css`. Im Absatz stand er
		bei 1440 px 39 px über der Unterkante der Felder (UI-Durchgang 06.10.2026).
	-->
	<button type="submit">Vorsitz speichern</button>
</form>
<p class="hilfe">
	Beides steht im Kopf des Protokolls und über den Unterschriftszeilen — <strong
		>in den Text kommt es, sobald der Entwurf erzeugt wird</strong
	>. Steht schon einer da, halten Sie zuerst die jetzige Fassung fest und erzeugen ihn neu.
	Ohne Angabe bleiben die Zeilen leer: Das Gesetz verlangt nur die Beschlüsse (ZGB Art. 712n
	Abs. 2), der SVIT-Kommentar empfiehlt die Unterzeichnung durch beide.
</p>

<h2>Der Protokolltext</h2>

{#if !data.protokoll}
	{#if !geschlossen}
		<p class="meldung warnung">
			Die Versammlung ist noch nicht geschlossen. Der Entwurf lässt sich schon erzeugen, aber die
			Zahlen sind dann vorläufig und die Schlusszeit fehlt — üblicherweise erzeugen Sie ihn
			danach.
		</p>
	{/if}
	<!--
		**Erst versiegeln, dann den Entwurf erzeugen** (22.08.2026). Der
		Siegelabschnitt am Schluss des Protokolls entsteht aus dem Siegel — wer
		zuerst das Protokoll erzeugt, bekommt ihn nicht und merkt es nie. Der
		Hinweis steht deshalb genau hier, wo der Entwurf entsteht, und nicht in
		einer Anleitung.
	-->
	{#if !data.versiegelt}
		<p class="meldung warnung">
			Diese Versammlung ist noch nicht versiegelt. Versiegeln Sie zuerst — dann trägt das
			Protokoll am Schluss die Prüfsumme des Abschlusspakets und den Zeitstempel dazu.
			<!--
				Block 7c: «Versiegeln Sie zuerst» stand hier neben dem Haken, der vor
				das Versiegeln gehört. Nur wo ein Haken noch fehlen kann.
			-->
			{#if hakenFehltNoch}
				Wurde über einen Antrag von Hand abgestimmt, kommt vor dem Versiegeln noch ein Schritt.
				Tragen Sie den Beschluss oben im Feld «Voten» ein und setzen Sie den Haken darunter. Die
				Reihenfolge ist dann: Beschluss nachtragen und Haken setzen, versiegeln, Entwurf
				erzeugen. Nach dem Versiegeln ändert der Haken die Auswertung im Abschlusspaket nicht
				mehr.
			{/if}
			<a href="/versammlungen/{v.id}/siegel">Zum Siegel</a>
		</p>
	{/if}
	<form method="POST" action="?/entwurf" use:enhance>
		<button type="submit" class="haupt">Entwurf erzeugen</button>
	</form>
	<p class="hilfe">
		Der Entwurf enthält Kopf, Anwesenheit mit Vertretungen, die Feststellung der
		Beschlussfähigkeit mit Zahlen und je Traktandum Antrag, Votum, angewandtes Erfordernis und
		Ergebnis. Danach gehört er Ihnen: Er ist frei bearbeitbar und
		<strong>nicht Teil des Siegels</strong>.
	</p>
{:else}
	<p class="klein">
		Erzeugt {zeitpunkt(data.protokoll.erzeugtAm)} · zuletzt geändert
		{zeitpunkt(data.protokoll.geaendertAm)}{#if data.protokoll.geaendertDurch}
			von {data.protokoll.geaendertDurch}{/if}
	</p>

	<form method="POST" action="?/speichern" class="bearbeiten" use:enhance>
		<label class="nurLeser" for="body">Protokolltext</label>
		<!--
			Ungesteuert und selbstsichernd: Der Text gehört der Sitzungsleitung. Ein
			zurückgeschriebener Wert könnte Getipptes verdrängen (dieselbe Falle wie
			beim Wertquoten-Nenner), und ein Feld, das erst auf Knopfdruck speichert,
			verliert alles beim Wechseln oder Neuladen (FR-46).
		-->
		<SicherndesFeld
			ziel="/versammlungen/{v.id}/protokoll/sichern"
			feld="body"
			id="body"
			name="body"
			wert={data.protokoll.body}
			zeilen={24}
		/>
		<div class="knopfreihe">
			<button type="submit" class="haupt">Speichern</button>
			<!--
				`data-sveltekit-reload`: Ohne den Vermerk hält der Client-Router die
				Adresse für eine eigene Seite und meldet «Not found» — die Datei
				entsteht aber erst auf dem Server. Dieselbe Regel wie bei allen
				anderen Ausgaben des Projekts.
			-->
			<a class="knopf" href="/versammlungen/{v.id}/protokoll.docx" data-sveltekit-reload>
				Als Word herunterladen
			</a>
			<!--
				**Und als OpenDocument** (Auftraggeber, 05.09.2026). Nicht jede
				Bewirtschaftung arbeitet mit Word; wer LibreOffice einsetzt, bekommt
				hier das Format seines Hauses statt eine Umwandlung, die bei jedem
				Öffnen anders ausfällt. Beide tragen denselben Text und dieselbe
				Fusszeile.
			-->
			<a class="knopf" href="/versammlungen/{v.id}/protokoll.odt" data-sveltekit-reload>
				Als OpenDocument herunterladen
			</a>
			<a
				class="knopf"
				href="/versammlungen/{v.id}/protokoll.pdf"
				data-sveltekit-reload
				target="_blank"
				rel="noopener"
			>
				Als PDF ansehen
			</a>
		</div>
		<p class="hilfe">
			Auszeichnung: <code>#</code> bis <code>######</code> für Überschriften,
			<code>- </code> für Aufzählungen, Leerzeile für einen Absatz. Mehr braucht es nicht: was
			darüber hinausgeht, machen Sie im heruntergeladenen Dokument.
		</p>
	</form>

	<!--
		**Neu erzeugen, wenn die jetzige Fassung gesichert ist** (22.08.2026).

		Der Weg fehlte: Wer den Entwurf vor dem Versiegeln erzeugt hatte, kam nie
		an den Siegelabschnitt — und die Absage nannte einen Ausweg, den es nicht
		gab. Der Knopf steht nur da, wenn nichts verloren gehen kann.
	-->
	{#if data.fassungGesichert}
		<!--
			**Mit Rückfrage** (22.08.2026, Befund D-01). Ein Klick, kein Dialog, kein
			Rückgängig: Im Prüflauf verlor der Verwalter 21 Handkorrekturen und
			machte sie ein zweites Mal. Der Knopf steht zwar nur da, wenn eine
			Fassung gesichert ist — aber gesichert ist die FASSUNG, nicht die
			Überarbeitung, die seither im Feld entstanden ist.

			Die Frage nennt beides: was ersetzt wird und was bleibt. «Sind Sie
			sicher?» hätte hier nichts zu bedenken gegeben und bloss gelehrt,
			Rückfragen wegzuklicken.

			**Ohne `use:enhance`:** Der Rückfragedialog fängt den Klick ab und
			schickt danach das Formular selbst ab; `use:enhance` daneben führte zu
			zwei Wegen für dasselbe Absenden.
		-->
		<form method="POST" action="?/entwurf" class="neuerzeugen">
			<Rueckfrage
				beschriftung="Entwurf neu erzeugen"
				zeichen="kreuz"
				ton="warnung"
				frage="Den jetzigen Protokolltext ersetzen?"
				folge="Der Text im Feld wird durch einen frischen Entwurf aus den Daten überschrieben — auch alles, was Sie seit dem Festhalten daran geändert haben. Die festgehaltene Fassung bleibt unberührt und ist über die Tabelle oben erreichbar."
				bestaetigen="Text ersetzen"
			/>
			<span class="klein">
				Erzeugt den Entwurf frisch aus den Daten — nötig, damit er nach dem Versiegeln den
				Siegelabschnitt trägt.
			</span>
		</form>
	{/if}

	<!--
		**Der Nachweis über maschinelle Vorbereitung** (22.08.2026, Befund D-05).
		Die Betreiberseite versprach ihn «im Verlauf» — dort stand er nicht, und
		einsehbar war er nirgends. Wer ihn im Streitfall brauchte, kam nur über die
		Datenbank daran.

		**Anfragen und Übernahmen getrennt**, weil nur das zweite zählt: Wer sich
		Vorschläge angesehen und keinen übernommen hat, hat kein maschinell
		vorbereitetes Protokoll.
	-->
	{#if data.kinachweis}
		<p class="klein kinachweis">
			<strong>Maschinell vorbereitet:</strong>
			{data.kinachweis.uebernommen === 0
				? `${data.kinachweis.anfragen} Anfrage${data.kinachweis.anfragen === 1 ? '' : 'n'}, davon keine übernommen — dieses Protokoll ist von Hand geschrieben.`
				: `${data.kinachweis.uebernommen} von ${data.kinachweis.anfragen} Vorschlägen übernommen.`}
			{#if data.kinachweis.anbieter.length > 0}
				Dienst: {data.kinachweis.anbieter.join(', ')}.
			{/if}
			{#if data.kinachweis.zuletzt}
				Zuletzt {zeitpunkt(data.kinachweis.zuletzt)}.
			{/if}
		</p>
	{/if}
{/if}
{/if}

<!-- ── Fassungen (FR-50) ──────────────────────────────────────────────────── -->
<!--
	**Auch am Haus eines gemeinsamen Abends** (A2, Produktentscheid 03.10.2026:
	«Fassung je Haus»). Dort gibt es keine eigene Arbeitsfassung; der Text ist
	die Zusammenstellung des Abends, die beim Festhalten in diesem Augenblick
	entsteht. Jedes Haus hält seine eigene Fassung fest. Sie kann sich von der
	eines anderen Hauses unterscheiden, wenn sich das Abenddokument zwischen den
	beiden Festhalten ändert; das ist gewollt, denn belegt wird der Text, den
	dieses Haus verschickt hat.

	**Bei einer Einzelversammlung erst mit dem Entwurf.** Dort lag der Abschnitt
	bis A2 im Entwurfszweig; dabei bleibt es. Ohne Arbeitsfassung liefe der
	Knopf in «Es besteht noch kein Protokoll, das sich festhalten liesse.»
-->
{#if data.gemeinsam || data.protokoll}
{#if data.gemeinsam}
	<p class="meldung gemeinsam">
		Der Text, den Sie hier festhalten, ist das <strong>Protokoll des Abends</strong>. Am Abend
		entsteht es bei jedem Aufruf neu; Ihre Fassung hält den Stand fest, der in diesem Augenblick
		gilt. Andere Häuser halten eigene Fassungen fest. Weil jedes zu einem anderen Zeitpunkt
		festhält, können sie sich unterscheiden.
	</p>
{/if}
<h2 id="fassungen">Fassungen</h2>
<p class="klein">
	Eine festgehaltene Fassung bleibt unverändert abrufbar, auch wenn Sie danach weiterarbeiten.
	Halten Sie fest, was Sie versenden — im Streitfall ist genau das die Frage: Welchen Text
	haben die Eigentümer bekommen?
</p>

<!--
	**«versandt» erst nach dem Versiegeln** (Block 8, Produktentscheid
	30.09.2026). Die Sperre steht im Server (`halteFassungFest`); hier ist die
	Art gar nicht erst wählbar, und daneben steht der Grund. Die Reihenfolge
	bleibt richtig: Wer noch einen Beschluss von Hand nachzutragen hat, tut
	das vor dem Versiegeln.

	**Ohne Siegel steht «festgehalten» zuoberst** (Codeprüfung 02.10.2026).
	Das Feld hat keine Vorauswahl, die erste Option gilt. Fiele «versandt»
	nur weg, wäre das «genehmigt», und wer bloss den Knopf drückt, legte eine
	unveränderliche Fassung mit falscher Art an.
-->
<form method="POST" action="?/festhalten" class="festhalten" use:enhance>
	<label>
		Als
		<select name="art">
			{#if data.versiegelt}
				<option value="versandt">versandt</option>
				<option value="genehmigt">von der Versammlung genehmigt</option>
				<option value="festgehalten">festgehalten</option>
			{:else}
				<option value="festgehalten">festgehalten</option>
				<option value="genehmigt">von der Versammlung genehmigt</option>
			{/if}
		</select>
	</label>
	<label class="breit">
		Bemerkung (freiwillig)
		<input name="bemerkung" placeholder="etwa: an alle Eigentümer per Post" />
	</label>
	<button type="submit">Jetzige Fassung festhalten</button>
</form>
{#if !data.versiegelt}
	<p class="hilfe">
		«versandt» lässt sich erst wählen, wenn die Versammlung versiegelt ist: Erst mit dem Siegel
		entsteht das Abschlusspaket, das zum Protokoll gehört. Wollen Sie das Protokoll verschicken:
		Fehlt noch ein Beschluss von Hand, tragen Sie ihn zuerst nach, denn die Auswertung im
		Abschlusspaket steht nach dem Versiegeln fest. Versiegeln Sie dann. Danach halten Sie die
		Fassung hier als «versandt» fest. Am Wortlaut des Protokolls können Sie auch nach dem
		Versiegeln arbeiten.
		<a href="/versammlungen/{v.id}/siegel">Zum Siegel</a>
	</p>
{/if}

<!--
	**Die Prüfsumme der massgeblichen Fassung** (22.08.2026) — und was damit zu
	tun ist.

	Sie steht hier und nicht im Kleingedruckten, weil an ihr zwei Dinge hängen:
	Die nächste Versammlung genehmigt genau diese Fassung und nennt den Wert in
	ihrem Antrag; und wer signieren lässt, kann nachher prüfen, ob er dieselbe
	unterschrieben hat.
-->
{#if data.fassungsabdruck}
	<section class="abdruck">
		<h3>Prüfsumme der {data.fassungsabdruck.art === 'versandt' ? 'versandten' : 'letzten'} Fassung</h3>
		<p class="wert">{data.fassungsabdruck.abdruck}</p>
		<p class="klein">
			SHA-256 über den Wortlaut der Fassung {data.fassungsabdruck.nummer}. Die nächste
			Versammlung nennt diesen Wert in ihrem Traktandum «Genehmigung des Protokolls» —
			damit bezeugt ihr Beschluss, welche Fassung gilt.
		</p>

		<!--
			**Der Hinweis zur Signatur steht in einer Komponente**, seit er hier und
			auf der Verbundseite auseinandergelaufen war (22.08.2026). Was er sagt und
			warum, steht dort.
		-->
		<Signaturwege />
	</section>
{/if}

<!--
	**Die Siegelkette** (Ä-39, Migration 161). Jede Fassung, die nach dem
	Versiegeln festgehalten wird, trägt ein Nachtragssiegel, das auf das vorige
	verweist. Der Satz kommt aus dem Nachrechnen beim Laden der Seite.
-->
{#if data.kette}
	<p class="kette" class:gebrochen={!data.kette.haelt}>
		<strong>Siegelkette:</strong>
		{data.kette.satz}
		{#if data.kette.ohneSiegel.length > 0}
			Ohne Nachtragssiegel, weil vor dessen Einführung nach dem Siegel festgehalten:
			{data.kette.ohneSiegel.map((n) => `Fassung Nr. ${n}`).join(', ')}.
		{/if}
	</p>
{/if}

{#if data.fassungen.length > 0}
	<table class="fassungen">
		<thead>
			<tr><th>Nr.</th><th>Art</th><th>Wann</th><th>Bemerkung</th><th>Umfang</th></tr>
		</thead>
		<tbody>
			<!--
				**Jede Fassung ist abrufbar** (22.08.2026, Befund D-03). Daneben stand
				«bleibt unverändert abrufbar», und die Tabelle hatte keinen einzigen
				Link — die Zusicherung war unerfüllbar.

				Als Ausklapper in der Zeile statt als eigene Seite: Die Texte sind
				ohnehin geladen, und wer zwei Fassungen vergleicht, will sie
				nebeneinander haben und nicht hintereinander aufrufen.
			-->
			{#each data.fassungen as f (f.id)}
				<tr>
					<td>{f.nummer}</td>
					<td>{f.artName}</td>
					<td class="klein">{zeitpunkt(f.zeitpunkt)}{#if f.durch}, {f.durch}{/if}</td>
					<td>{f.bemerkung ?? ''}</td>
					<td class="klein">{f.zeichen.toLocaleString('de-CH')} Zeichen</td>
				</tr>
				<tr class="fassungstext">
					<td colspan="5">
						<!--
							**Der Wortlaut kommt über einen eigenen Abruf** (Nachprüfung
							23.08.2026). Zuerst stand hier `{f.body}` — und der ist in den
							Seitendaten bewusst leer: Der Wortlaut alter Fassungen gehört nicht
							in jede Seitenladung, bei einem Dutzend Fassungen wären das schnell
							hunderte Kilobyte. Der Ausklapper zeigte deshalb ein leeres Feld,
							und die Rückfrage vor «Entwurf neu erzeugen» verwies auf einen
							Rettungsanker, den es nicht gab.

							`data-sveltekit-reload`: Die Adresse gehört dem Server, nicht dem
							Client-Router — dieselbe Regel wie bei allen Ausgaben des Projekts.
						-->
						<p class="klein">
							Prüfsumme (SHA-256): <span class="abdruckwert">{f.abdruck}</span> ·
							<a href="/versammlungen/{v.id}/protokoll/fassung/{f.nummer}" data-sveltekit-reload
								>Wortlaut ansehen</a
							>
						</p>
						{#if f.nachtragssiegel}
							<p class="klein">
								Nachtragssiegel: <span class="abdruckwert">{f.nachtragssiegel}</span> ·
								<a
									href="/versammlungen/{v.id}/protokoll/fassung/{f.nummer}/nachtragssiegel.zip"
									data-sveltekit-reload>Fassung mit Siegel herunterladen</a
								>
							</p>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{:else}
		<p class="klein">Noch keine Fassung festgehalten.</p>
	{/if}
{/if}

<p class="hinweis">
	Das Protokoll gehört bewusst <strong>nicht</strong> zum Siegel: Es entsteht nach der Sitzung,
	wird redigiert und von der nächsten Versammlung genehmigt. Die Zahlen dagegen stehen mit dem
	Schluss der Versammlung fest — sie liegen in der Auswertung und im Verlauf.
	<a href="/versammlungen/{v.id}/auswertung">Zur Auswertung</a> ·
	{datumLang(v.datum)}
</p>

<style>
	.neuerzeugen {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin: 0.75rem 0;
	}

	/*
	 * Die Prüfsumme steht als Ganzes da — 64 Zeichen, umbrechend, in
	 * Festbreitenschrift. Abgekürzt wäre sie wertlos: Verglichen wird der
	 * ganze Wert oder gar nicht.
	 */
	.abdruck {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.9rem 1.1rem;
		margin: 1rem 0;
	}

	.abdruck h3 {
		margin: 0 0 0.4rem;
		font-size: 0.95rem;
	}

	.abdruck .wert {
		margin: 0 0 0.4rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.9rem;
		overflow-wrap: anywhere;
		user-select: all;
	}

	/*
	 * Derselbe Kasten wie auf der Traktandenseite: Beide sagen dasselbe — was hier
	 * geführt wird und was am Abend. Zwei verschiedene Kästen für dieselbe Aussage
	 * liest man als zwei verschiedene Regeln.
	 */
	.meldung.gemeinsam {
		background: var(--flaeche-2);
		border-left: 3px solid var(--akzent);
		border-radius: var(--radius);
		margin: 0 0 1.25rem;
		max-width: 60rem;
		padding: 0.85rem 1rem;
	}

	.hinweis {
		max-width: 62ch;
	}

	.hinweis {
		border-top: 1px solid var(--linie);
		color: var(--text-leise);
		font-size: 0.9rem;
		margin-top: 2rem;
		padding-top: 0.75rem;
	}

	.klein,
	.hilfe {
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.hilfe {
		max-width: 62ch;
	}

	.notiz {
		border-left: 3px solid var(--linie);
		margin: 0 0 0.75rem calc(var(--tiefe) * 1.25rem);
		padding-left: 0.75rem;
	}

	.notiz label {
		display: block;
		font-weight: 550;
		margin-bottom: 0.2rem;
	}

	/*
	 * Der Beschlussvermerk sitzt am selben Einzug wie das Votenfeld, aber ohne
	 * dessen Rahmen: Er ist eine Angabe zum Text darüber, kein zweites Feld.
	 */
	.vermerk {
		margin: -0.35rem 0 0.9rem calc(var(--tiefe) * 1.25rem + 0.75rem);
	}

	.vermerk label {
		align-items: flex-start;
		display: flex;
		font-size: 0.9rem;
		gap: 0.45rem;
	}

	.vermerk input[type='checkbox'] {
		margin-top: 0.15rem;
	}

	.vermerk .fehler {
		color: var(--fehler);
		font-size: 0.9rem;
		margin: 0.25rem 0 0;
	}

	.nummer {
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
		margin-right: 0.4rem;
	}

	.marke {
		background: var(--flaeche-2);
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 400;
		margin-left: 0.4rem;
		padding: 0.1rem 0.5rem;
	}

	.knopfreihe {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.6rem 0;
	}

	.festhalten {
		align-items: end;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0.75rem 0 1rem;
	}

	.festhalten label {
		display: block;
		font-size: 0.9rem;
	}

	.festhalten .breit {
		flex: 1 1 18rem;
	}

	.festhalten input {
		width: 100%;
	}

	.kette {
		margin: 0.5rem 0;
	}

	.kette.gebrochen {
		color: var(--fehler);
	}

	.fassungen {
		border-collapse: collapse;
		width: 100%;
	}

	.fassungen th,
	.fassungen td {
		border-bottom: 1px solid var(--linie);
		padding: 0.4rem 0.5rem;
		text-align: left;
		vertical-align: top;
	}

	.nurLeser {
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		height: 1px;
		overflow: hidden;
		position: absolute;
		white-space: nowrap;
		width: 1px;
	}
	/* ── Voten ausformulieren (FR-61) ─────────────────────────────────────── */
	.kientwurf {
		margin: 1.5rem 0;
		padding: 0.85rem 1rem;
		border: 1px solid var(--linie);
		border-radius: 6px;
		background: var(--flaeche-2);
	}
	.kientwurf h2 {
		margin-top: 0;
	}
	/*
	 * **Abgeschaltet heisst gestrichelt, nicht blass** (UI-Durchgang 06.10.2026).
	 * Vorher `opacity: 0.7` auf dem ganzen Kasten: Der Satz, der sagt, warum
	 * der Dienst fehlt, kam damit auf 3.17:1 (hell) und 3.73:1 (dunkel), unter
	 * den 4.5:1 für Fliesstext. Gerade dieser Satz muss lesbar sein. Jetzt
	 * zeigen gestrichelter Rand, fehlende Fläche und die leise Überschrift den
	 * Zustand; der Text behält seine Farbe.
	 */
	.kientwurf.aus {
		border-style: dashed;
		background: transparent;
	}
	.kientwurf.aus h2 {
		color: var(--text-leise);
	}
	.kientwurf .vorschlag {
		margin: 0.75rem 0;
		padding: 0.5rem 0.75rem;
		background: var(--flaeche);
		border-left: 3px solid var(--linie);
	}
	.kientwurf .vorschlag h3 {
		margin: 0 0 0.4rem;
		font-size: 0.95rem;
	}
	/* Nebeneinander, wo Platz ist; untereinander auf dem Telefon. */
	.gegenueber {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: 1fr;
	}
	@media (min-width: 45rem) {
		.gegenueber {
			grid-template-columns: 1fr 1fr;
		}
	}
	.gegenueber p {
		margin: 0.2rem 0 0.5rem;
	}
	.gegenueber .marke {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-leise);
	}
	.kientwurf .entscheid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin-top: 0.75rem;
		font-size: 0.85rem;
	}
	.kientwurf .hinweis {
		margin: 0.3rem 0;
		padding: 0.35rem 0.6rem;
		background: var(--flaeche-hinweis);
		border-left: 3px solid var(--hinweis);
		font-size: 0.85rem;
	}
	.kientwurf .fehlschlag {
		margin: 0.3rem 0;
		color: var(--warnung);
	}
	.kientwurf .hinausgegangen pre {
		margin: 0.4rem 0 0;
		padding: 0.5rem;
		overflow-x: auto;
		white-space: pre-wrap;
		background: var(--flaeche);
		border: 1px dashed var(--linie);
		font-size: 0.85rem;
	}
	/*
	 * Der Fassungstext, zugeklappt in der Zeile darunter. Kein `display: flex` am
	 * summary — das nähme ihm sein Dreieck (bewacht von der Stylelint-Regel `versammlung/dreieck-am-summary`).
	 */
	.kinachweis {
		border-left: 3px solid var(--linie);
		margin: 1rem 0;
		max-width: 62ch;
		padding-left: 0.75rem;
	}

	.abdruckwert {
		/* Dieselbe Reihe wie beim Siegelabdruck oben — keine Variable dafür. */
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		overflow-wrap: anywhere;
		user-select: all;
	}
</style>
