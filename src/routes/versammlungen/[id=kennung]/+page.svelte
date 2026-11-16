<script lang="ts">
	import { page } from '$app/state';
	import { aufgeklappt } from '$lib/felder';
	import Anhaenge from '$lib/components/Anhaenge.svelte';
	import Karte from '$lib/components/Karte.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Ungespeichert from '$lib/components/Ungespeichert.svelte';
	import VersammlungFormular from '$lib/components/VersammlungFormular.svelte';
	import { datumLang, tagVon, zeitpunktKurz } from '$lib/domain/datum';
	import {
		abendabweichung,
		abendzugehoerigkeit,
		abstimmungsweise,
		versammlungsart,
		versammlungsstufe
	} from '$lib/domain/klartext';
	import { zustandsname } from '$lib/domain/versammlung';
	import Meldung from '$lib/components/Meldung.svelte';
	import { abgabehinweis } from '$lib/domain/abgabe';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';
	import { anfangswert } from '$lib/felder';

	let { data, form } = $props();

	/*
	 * Kommt man über den Sprunganker von der Sitzungsleitung, klappt der
	 * Codeabschnitt von selbst auf. `page.url.hash` statt `location`: Der Wert
	 * steht schon beim ersten Rendern zur Verfügung und wechselt mit der
	 * Navigation mit.
	 */
	const angesprungen = $derived(page.url.hash === '#anzeigecode');

	const v = $derived(data.versammlung);

	/**
	 * Ist die Versammlung gerade an ein anderes Gerät abgegeben?
	 *
	 * Die Datenbank weist dann jede Änderung ab (Migration 117), und zwar als
	 * Serverfehler. Diese Seite nimmt deshalb die Griffe weg, die dort hineinliefen
	 * — dasselbe Verhältnis wie beim Siegel: Die Datenbank ist die Zusage, die
	 * Seite sorgt dafür, dass niemand blind dagegenläuft.
	 */
	const unterwegs = $derived(Boolean(data.abgabe));

	/**
	 * Nach einem fachlichen Fehler stehen die Eingaben wieder im Formular.
	 *
	 * Abgeleitet und nicht in der Vorlage zusammengesetzt: Nicht jeder Fehler
	 * bringt Werte mit — der Dateifehler etwa nicht —, und `form.werte` gibt es
	 * dann gar nicht.
	 */
	const werte = $derived(
		form && 'werte' in form && form.werte
			? form.werte
			: {
					datum: v.datum,
					uhrzeit: v.uhrzeit,
					ort: v.ort,
					art: v.art,
					stufe: v.stufe,
					betriebsart: v.betriebsart,
					anlass: v.anlass ?? '',
					vorgaengerId: v.vorgaengerId ?? ''
				}
	);

	const abstimmung = $derived(abstimmungsweise(v.betriebsart));
	const abend = $derived(abendzugehoerigkeit(data.tag?.bezeichnung ?? null));
	/**
	 * Datum und Ort müssen zum gemeinsamen Abend passen — das ist sein Zweck.
	 *
	 * Die Zuordnung setzt nur die Kennung; niemand prüft, ob die Versammlung
	 * wirklich an diesem Tag an diesem Ort stattfindet. Läuft es auseinander,
	 * steht in der Einladung ein anderer Tag als auf der Tafel im Saal.
	 */
	const abweichung = $derived(
		abendabweichung(
			{ datum: v.datum, ort: v.ort, betriebsart: v.betriebsart },
			data.tag
				? { datum: data.tag.datum, ort: data.tag.ort, betriebsart: data.tag.betriebsart }
				: null
		)
	);
	const art = $derived(versammlungsart(v.art));
	const stufe = $derived(versammlungsstufe(v.stufe));
	/** Die Rückfrage vor dem Löschen — sie kommt vom Server, weil sie zählt. */
	const loeschfrage = $derived(form && 'loeschfrage' in form ? form.loeschfrage : null);

</script>

<div class="kopf">
	<h1>Versammlung vom {datumLang(v.datum)}</h1>
	<span class="zustand" data-zustand={v.zustand}>{zustandsname(v.zustand)}</span>
</div>

<p class="unterzeile">
	{v.uhrzeit} Uhr · {v.ort}{#if v.stufe === 'zweite'} · Zweitversammlung{/if}
</p>

{#if v.anlass}
	<p class="anlass"><strong>Anlass:</strong> {v.anlass}</p>
{/if}

<!--
	Hier standen bisher acht gleich aussehende Knöpfe. Sie sind in die
	Seitenleiste gewandert, wo sie in der Ordnung des Ablaufs stehen und ihren
	Zustand mitbringen. Diese Seite trägt jetzt nur noch, was ihr gehört: den
	Lebenslauf der Versammlung, die Unterlagen und die Angaben.
-->

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.geschlossen}
	<Meldung ton="gut" marke={form}>{form.geschlossen}</Meldung>
{:else if form?.gespeichert}
	<!--
		**Was der gemeinsame Anlass umgestellt hat, steht im selben Satz**
		(25.08.2026). «Gespeichert.» allein war unwahr, wenn die Zuordnung
		anschliessend Tag, Ort oder Abstimmungsweise vom Abend übernahm — dann
		steht etwas anderes da, als man abgeschickt hat.
	-->
	<Meldung ton="gut" marke={form}>
		Gespeichert.{#if form.hinweis}{' '}{form.hinweis}{/if}
	</Meldung>
{/if}

<!--
	**Unterwegs auf einem anderen Gerät** (18.09.2026). Das Band steht vor allem
	anderen, weil es erklärt, warum die Handlungen darunter nicht greifen: Die
	Datenbank weist jede Änderung ab, solange die Versammlung abgegeben ist
	(Migration 117). Ohne diesen Satz sähe die Seite aus wie immer, und der erste
	Klick käme als Serverfehler zurück.
-->
{#if data.abgabe}
	<section class="lebenslauf abgegeben">
		<h2>Diese Versammlung ist unterwegs</h2>
		<p>{abgabehinweis(data.abgabe, zeitpunktKurz)}</p>
		<p class="klein">
			<a href="/versammlungen/{v.id}/abgeben">Zur Abgabe</a>
		</p>
	</section>
{/if}

{#if v.zustand === 'freigegeben'}
	<section class="lebenslauf">
		<h2>Kann es losgehen?</h2>
		{#if data.abgabe}
			<!--
				**Kein Eröffnen-Knopf, solange sie unterwegs ist.** Der Trigger aus
				Migration 117 weist das Eröffnen ohnehin ab, aber als Serverfehler.
				Dasselbe Verhältnis wie beim Siegel: Die Datenbank ist die Zusage, die
				Seite nimmt den Griff weg, der sie auslösen würde.
			-->
			<p>
				Eröffnet wird auf dem Gerät, das die Versammlung führt. Hier geht es weiter, wenn sie mit
				ihrem Abschlusspaket zurück ist.
			</p>
		{:else}
			<p>Alles ist vorbereitet. Mit dem Eröffnen beginnt die Sitzung.</p>
			<p class="klein">
				Wird im Saal auf einem anderen Gerät geführt?
				<a href="/versammlungen/{v.id}/abgeben">An ein anderes Gerät abgeben</a>
			</p>
			<form method="POST" action="?/eroeffnen">
				<button type="submit" class="haupt">Versammlung eröffnen</button>
			</form>
			<details class="erklaerung">
				<summary>Was heisst das?</summary>
				<p>
					Mit der Eröffnung zählt die Anwesenheit, und der festgehaltene Stand wird unveränderlich — die
					Freigabe lässt sich danach nicht mehr zurücknehmen. Eine beschlussunfähige Versammlung darf
					eröffnet werden; sie muss es sogar, damit die Beschlussunfähigkeit festgestellt und
					protokolliert werden kann.
				</p>
			</details>
		{/if}
	</section>
{:else if v.zustand === 'laufend'}
	<section class="lebenslauf laeuft">
		<h2>Die Versammlung läuft</h2>
		<p class="weiter">
			<a class="knopf haupt" href="/versammlungen/{v.id}/leitung">Zur Sitzungsleitung</a>
			<a class="knopf" href="/versammlungen/{v.id}/anwesenheit">Anwesenheit</a>
		</p>

		<!--
			**Ein Sprungziel und ein Name, der gesucht wird** (22.08.2026, Befund
			C-04). Im Prüflauf suchte die Sitzungsleitung den Anzeigecode beim
			Eröffnen und fand ihn nicht: Er stand hier, zugeklappt, unter «Code für
			den Beamer» — während `/p` von einem «Anzeigecode» spricht. Zwei Namen
			für dieselbe Sache, und gesucht wurde nach dem anderen.

			`id="anzeigecode"` macht ihn von der Sitzungsleitung aus anspringbar, und
			aufgeklappt, wenn man von dort kommt: Wer hierher springt, sucht genau das.

			**Diese Stelle ist die einzige, an der der Browser mehr weiss als der
			Server** (26.08.2026, aus dem Code-Review): Ein URL-Fragment erreicht den
			Server nie, `page.url.hash` ist beim Rendern dort immer leer. Er liefert
			den Kasten also zwangsläufig zu, und erst `aufgeklappt()` im Browser
			klappt ihn auf. Eine Fassung, die jeden ausgelieferten Kasten in Ruhe
			liess, hat genau das verloren — gemessen in
			`e2e/ausklapper-vor-hydration.mjs`.
		-->
		<details class="anzeige" id="anzeigecode" {...aufgeklappt(angesprungen)}>
			<summary>Code für die Leinwand</summary>
			<p class="klein">
				Die Präsentationssicht läuft auf einem eigenen Gerät und verlangt diesen Code. Er
				erscheint <strong>einmal</strong> — gespeichert wird nur sein Prüfwert. Ist er verloren,
				erzeugen Sie einen neuen; der alte gilt dann nicht mehr. Eine Leinwand, die noch mit dem
				alten läuft, fällt nach einigen Sekunden auf die Eingabe des Codes zurück.
			</p>
			<form method="POST" action="?/anzeigecode">
				<button type="submit" class="leise">Neuen Code erzeugen</button>
			</form>
		</details>

		<!--
			Der Knopf bleibt sichtbar und wandert nicht in ein `<details>`: Er wird
			im Saal gesucht, wenn es schnell gehen muss. Die Warnung steht kurz
			daneben und vollständig im Rückfragefenster.
		-->
		<form method="POST" action="?/schliessen">
			<Rueckfrage
				beschriftung="Versammlung beenden"
				zeichen="hinaus"
				ton="warnung"
				frage="Versammlung schliessen?"
				folge="Offene Abstimmungen werden geschlossen. Alle Zugangscodes und der Code für die Leinwand werden wertlos, und die Teilnehmer sehen auf ihren Geräten die Abschlusssicht. Das lässt sich nicht rückgängig machen."
				bestaetigen="Versammlung beenden"
			/>
		</form>
		<p class="klein">
			Danach kann niemand mehr abstimmen. <strong>Das lässt sich nicht rückgängig machen.</strong>
		</p>
		<details class="erklaerung">
			<summary>Was heisst das?</summary>
			<p>
				Offene Abstimmungen werden mitgeschlossen. Alle Zugangscodes und der Code für die
				Leinwand werden wertlos, und die Teilnehmer sehen auf ihren Geräten die
				Abschlusssicht.
			</p>
		</details>
	</section>
{/if}

{#if form?.anzeige}
	<section class="anzeigecode" role="status">
		<h2>Code für die Leinwand</h2>
		<p class="code">{form.anzeige.code}</p>
		<!--
			**Die Adresse steht auf einer eigenen Zeile** (20.08.2026).

			Als `<strong>` mitten im Satz war sie ein einziges langes Wort ohne
			Umbruchstelle: Auf einem Telefon von 390 px stand sie 273 px über den
			Kasten hinaus und zog die ganze Seite 257 px über den Rand. Gemessen,
			nicht geschätzt — gemeldet hat es der Auftraggeber mit einem Bild vom eigenen Gerät.

			Eine eigene Zeile ist auch inhaltlich richtig: Man tippt sie ab oder
			hält sie jemandem hin, und dafür muss sie am Stück lesbar sein.
		-->
		<p class="klein">
			Öffnen Sie auf dem Beamer-Gerät diese Adresse — oder rufen Sie dort
			<code>/p</code> auf und tippen den Code ein.
		</p>
		<p class="adresse">{form.anzeige.link}</p>
		<p class="klein">
			<a href={form.anzeige.link} target="_blank" rel="noopener">Präsentationssicht hier öffnen</a>
		</p>
		<p class="klein">
			Er erscheint nur jetzt. Danach steht in der Datenbank nur sein Prüfwert.
		</p>
	</section>
{/if}

<!--
	**Der Hinweis richtet sich nach innen, der Vermerk nach aussen.**
	`data.frist.hinweis` sagt der Sitzungsleitung, was mit dem Datum ist, und
	nennt den ersten zulässigen Termin: eine Handreichung zum Korrigieren. Der
	Vermerk darunter ist der Wortlaut, mit dem die Eigentümer es erfahren, und er
	steht hier, damit niemand erst am fertigen PDF sieht, was hinausgeht. Er
	stand bis zum 23.09.2026 an dieser Stelle als selbst getippte Begründung —
	die ist mit Befund R-2b weggefallen.
-->
{#if data.frist && !data.frist.eingehalten}
	<p class="meldung fehler" role="alert">{data.frist.hinweis}</p>
{/if}
{#if v.fristvermerk}
	<p class="meldung vermerk">
		<strong>In Einladung und Protokoll:</strong>
		{v.fristvermerk}
	</p>
{/if}

<!--
	**Der Weg zur Seite Vorbereitung** (Produktentscheid 06.10.2026, «Verweis auf
	der Übersicht»). Dort stehen der Haken «Die Einladung ist verschickt» (bis
	07.10.2026 «… ist bei allen angekommen») und der Hinweis zur berichtigten
	Einladung, und bis dahin führte
	kein Verweis hin. Er steht, solange die Versammlung freigegeben ist: Vorher ist nichts
	verschickt, nachher nichts mehr zu vermerken.
-->
{#if v.zustand === 'freigegeben'}
	<!--
		**Der gestaltete Baustein, kein Absatz mit Klasse** (Codeprüfung N6,
		Korrekturrunde 06.10.2026): `.meldung.warnung` hat auf dieser Seite keine
		Regel. `marke={data}`: Weggedrückt bleibt der Kasten weg, bis die Seite
		neue Daten hat; dann steht er wieder, solange die Lage besteht.
	-->
	{#if data.neuversand}
		<Meldung ton="warnung" marke={data}>
			Seit der Freigabe ist das Mehr {data.neuversand.anzahl === 1
				? 'eines Traktandums'
				: 'mehrerer Traktanden'} milder geworden.
			<!-- Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»: kein Rückfall
			     beim Eröffnen mehr. Bis dahin sagte der Zweig «Frist vorbei», die
			     Anwendung nehme beim Eröffnen wieder das Mehr der bisherigen Einladung. -->
			<!-- Laien- und Fachprüfung Runde 1, 07.10.2026: als Empfehlung (B5) und nach
			     Fristablauf bedingt (B1), weil die Anwendung nicht weiss, ob sie schon
			     verschickt ist. Bis dahin «Dafür braucht es …» und unbedingt «kann
			     angefochten werden». -->
			Dafür sollte eine berichtigte Einladung an alle gehen; als verschickt vermerkt ist sie
			noch nicht.
			<!-- Runde 2, 07.10.2026: vor Fristablauf mit der Folge (Produktentscheid «1a»),
			     nach Fristablauf «die berichtigte Einladung» statt «sie» (Laienprüfung N7). -->
			{#if data.neuversand.fristVorbei}
				Der letzte Tag der erfassten Einberufungsfrist ist vorbei. War die berichtigte Einladung
				an diesem Tag nicht bei allen, kann ein Beschluss mit dem milderen Mehr angefochten werden.
			{:else}
				Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden.
			{/if}
		</Meldung>
	{/if}
	<p class="klein">
		<a href="/versammlungen/{v.id}/vorbereitung">Zur Vorbereitung</a>
	</p>
{/if}

<!--
	Solange die Versammlung im Entwurf steht, wird hier **erfasst** — dann führt
	das Formular, und Karten mit denselben Angaben daneben wären eine zweite
	Wahrheit. Das war der Zustand am 11.08.2026: «Betriebsart» stand als Karte
	oben und als Auswahl im Formular unten, mit zwei verschiedenen Knöpfen.

	Ab der Freigabe ist nichts mehr zu erfassen. Dann wird hier **nachgesehen**,
	und die Karten sind die Antwort — je eine Frage, je ein Satz, gleich hoch.
-->
{#if data.aenderbar}
	<h2 class="abschnitt">Angaben zur Versammlung</h2>
	<VersammlungFormular
		kompakt
		id="angaben"
		mitKnopf={false}
		anwesenheitsregeln={data.anwesenheitsregeln}
		vorgaengerinnen={data.vorgaengerinnen}
		reglementsfrist={data.gemeinschaft.zweitversammlungsfristTage
			? {
					tage: data.gemeinschaft.zweitversammlungsfristTage,
					fundstelle: data.gemeinschaft.zweitversammlungsfristFundstelle ?? null
				}
			: null}
		anzahlParteien={data.anzahlParteien}
		vorschlagBetriebsart={data.vorschlagBetriebsart}
		fehler={null}
		{werte}
		beschriftungKnopf="Speichern"
		abbrechenNach="/versammlungen"
		aktion="?/speichern"
		vomAbend={data.tag
			? { bezeichnung: data.tag.bezeichnung, pfad: `/tage/${data.tag.id}` }
			: null}
	/>

	<h2 class="abschnitt">Dazu gehört noch</h2>
{/if}

<div class="kacheln">
	{#if !data.aenderbar}
		<Karte titel="Wann und wo?" antwort="{datumLang(v.datum)}, {v.uhrzeit} Uhr" zusatz={v.ort}>
			{#snippet erklaerung()}
				<p>
					Datum und Ort stehen in den versandten Einladungen. Deshalb lassen sie sich ab der
					Freigabe nicht mehr ändern.
				</p>
			{/snippet}
		</Karte>

		<Karte titel={art.frage} antwort={art.antwort} zusatz={stufe.antwort}>
			{#snippet erklaerung()}
				<p>{art.erklaerung}</p>
				<p>{stufe.erklaerung}</p>
			{/snippet}
		</Karte>

		<Karte titel={abstimmung.frage} antwort={abstimmung.antwort} zusatz={abstimmung.zusatz}>
			{#snippet erklaerung()}
				<p>{abstimmung.erklaerung}</p>
			{/snippet}
			{#snippet fuss()}
				{#if unterwegs}
					<p class="klein">Solange die Versammlung unterwegs ist, wird hier nichts umgestellt.</p>
				{:else if v.zustand === 'freigegeben'}
					<form method="POST" action="?/betriebsart" class="wechsel">
						<input
							type="hidden"
							name="betriebsart"
							value={v.betriebsart === 'gefuehrt' ? 'einfach' : 'gefuehrt'}
						/>
						<input name="grund" placeholder="Grund (freiwillig)" maxlength="200" />
						<button type="submit" class="leise">
							Auf {v.betriebsart === 'gefuehrt' ? 'Papier' : 'Handy'} umstellen
						</button>
					</form>
				{:else}
					<p class="klein">Ab der Eröffnung nicht mehr umstellbar.</p>
				{/if}
				{#if v.betriebsart === 'gefuehrt' && !unterwegs && (v.zustand === 'freigegeben' || v.zustand === 'laufend')}
					<!--
						**Die Mischform** (Migration 108). Nur hier von Bedeutung: In der
						einfachen Betriebsart stimmen ohnehin alle von Hand.

						**Anders als die Betriebsart auch während der Versammlung
						umstellbar.** Sie entscheidet, wer abstimmen darf, und steht ab
						der Eröffnung fest. Dies hier entscheidet nur, ob am Eingang ein
						zweiter Knopf steht — und wer mitten im Einlass merkt, dass doch
						alle digital abstimmen, soll die Frage loswerden können, ohne die
						Versammlung anzuhalten.
					-->
					<form method="POST" action="?/papierfrage" class="wechsel">
						<!--
							**`ja`/`nein` und nicht `true`/`false`, und die Handlung liest
							ausdrücklich** (09.09.2026, im Security-Review gefunden). Erst
							stand hier `jaNein(daten.get('fragen'))`, und das kennt nur `true`
							und `on`: `'ja'` kam als **false** an. Abschalten wirkte zufällig
							richtig, Einschalten war ein stiller Leerlauf — und die
							Fehlrichtung war die unsichere, denn einmal aus wurde am Eingang
							nie wieder gefragt.

							Dieselbe Paarung wie beim bestehenden `name="bestaetigt"`: Ein
							Umschalter schickt in beiden Richtungen etwas, `jaNein` ist für
							Kästchen gedacht, die nur im Ja-Fall überhaupt mitkommen.
						-->
						<input type="hidden" name="fragen" value={v.papierfrage ? 'nein' : 'ja'} />
						<p class="klein">
							{v.papierfrage
								? 'Der Einlass fragt je Partei, ob digital oder von Hand abgestimmt wird.'
								: 'Der Einlass fragt nicht; alle stimmen digital ab. Bereits gesetzte Vermerke bleiben.'}
						</p>
						<button type="submit" class="leise">
							{v.papierfrage
								? 'Am Einlass nicht mehr fragen'
								: 'Am Einlass nach der Stimmabgabe fragen'}
						</button>
					</form>
				{/if}
			{/snippet}
		</Karte>
	{/if}

	<!--
		Story 7.5: Zuordnen soll auch von hier gehen. Hier ist man, wenn einem
		auffällt, dass die Versammlung zu einem gemeinsamen Abend gehört — nicht
		auf einer Seite, die man erst suchen muss.
	-->
	<Karte
		titel={abend.frage}
		antwort={abend.antwort}
		zusatz={abend.zusatz}
		warnung={abweichung}
	>
		{#snippet erklaerung()}
			<p>{abend.erklaerung}</p>
		{/snippet}
		{#snippet fuss()}
			{#if data.aenderbar}
				<!--
					Kein eigener Knopf: Die Auswahl gehört über `form` zum Formular
					der Seite und wird mit allem anderen gespeichert. `tagVorher`
					reist mit, damit der Server nur handelt, wenn sich wirklich etwas
					ändert — sonst stünde nach jedem Speichern ein «aus dem Abend
					genommen» im Verlauf, das niemand ausgelöst hat.
				-->
				<div class="wechsel">
					<div class="auswahl">
						<Suchauswahl
							name="tag"
							form="angaben"
							beschriftung="Gemeinsame Versammlung"
							leerText="— für sich allein —"
							wert={data.tag?.id ?? ''}
							eintraege={data.tage.map((t) => ({
								wert: t.id,
								text: `${t.bezeichnung} · ${datumLang(t.datum)}`
							}))}
						/>
					</div>
					<input type="hidden" name="tagVorher" form="angaben" value={data.tag?.id ?? ''} />
				</div>
			{:else if unterwegs}
				<p class="klein">
					Solange die Versammlung unterwegs ist, wird die Zuordnung zum gemeinsamen Abend nicht
					geändert.
				</p>
			{:else}
				<form method="POST" action="?/tag" class="wechsel">
					<div class="auswahl">
						<Suchauswahl
							name="tag"
							beschriftung="Gemeinsame Versammlung"
							leerText="— für sich allein —"
							wert={data.tag?.id ?? ''}
							eintraege={data.tage.map((t) => ({
								wert: t.id,
								text: `${t.bezeichnung} · ${datumLang(t.datum)}`
							}))}
						/>
					</div>
					<button type="submit" class="leise">Übernehmen</button>
				</form>
			{/if}
		{/snippet}
	</Karte>

	<Karte
		titel="Welche Dateien gehören dazu?"
		antwort={data.anhaenge.length === 0
			? 'Noch keine Datei.'
			: `${data.anhaenge.length} ${data.anhaenge.length === 1 ? 'Datei' : 'Dateien'}.`}
		zusatz="PDF oder Bild, bis 10 MB — zum Beispiel die Bestätigung für den Saal."
	>
		{#snippet erklaerung()}
			<p>
				Hierher gehören Unterlagen zur ganzen Versammlung: Raumbestätigung, Einladungsentwurf und
				Ähnliches. Was zu einem einzelnen Geschäft gehört, hängt man ans Traktandum.
			</p>
			<p>
				Massgebend ist der Inhalt der Datei, nicht ihre Endung: Ein umbenanntes Office-Dokument
				wird erkannt und abgewiesen.
			</p>
		{/snippet}
		{#snippet fuss()}
			<Anhaenge
				knapp
				anhaenge={data.anhaenge}
				aenderbar={data.aenderbar}
				formularId={data.aenderbar ? 'angaben' : ''}
			/>
		{/snippet}
	</Karte>
</div>

<!--
	**Ein Knopf für die ganze Seite.**
	Vorher standen drei: «Speichern» für die Angaben, «Übernehmen» für den Abend,
	«Anhängen» für die Datei — drei Knöpfe an drei Stellen für einen Vorgang, den
	man als einen erlebt. Er steht zuunterst, weil dort das Auge nach dem
	Ausfüllen ankommt (gewünscht am 11.08.2026).
-->
{#if data.aenderbar}
	<div class="abschluss">
		<button type="submit" form="angaben" class="haupt">Speichern</button>
		<a href="/versammlungen">Abbrechen</a>
		<Ungespeichert formular="angaben" />
	</div>

	<!--
		**Löschen steht unten und ist kein Speichern.**
		Zwei Stufen ohne `confirm()`: Der erste Klick holt vom Server, was
		verschwindet — Zahl der Traktanden, Dateien, ob die Versammlung bei einer
		gemeinsamen mittagt. Eine Rückfrage, die das nicht nennt, wird weggeklickt.
		Gebaut am 11.08.2026, weil eine aus der gemeinsamen Versammlung gelöste
		Versammlung sonst für immer in jeder Liste stehenblieb.
	-->
	<section class="entfernen">
		<h2>Diese Versammlung wird nicht gebraucht?</h2>
		{#if loeschfrage}
			<div class="meldung frage" role="alert">
				<p>{loeschfrage}</p>
				<form method="POST" action="?/loeschen" class="knoepfe">
					<input type="hidden" name="bestaetigt" value="ja" />
					<button type="submit" class="gefahr">Endgültig löschen</button>
					<a href="/versammlungen/{v.id}">Behalten</a>
				</form>
			</div>
		{:else}
			<p class="klein">
				Solange sie im Entwurf ist, lässt sie sich löschen — mit ihren Traktanden und Dateien. Ab
				der Freigabe nicht mehr: Dann steht sie in versandten Einladungen.
			</p>
			<form method="POST" action="?/loeschen">
				<button type="submit" class="leise">Versammlung löschen</button>
			</form>
		{/if}
	</section>
{/if}

<!--
	**Das Archiv steht ausserhalb von `aenderbar`.** Gerade die geschlossene und
	die versiegelte Versammlung will man aus der Liste nehmen — dort ist nichts
	mehr zu ändern, und genau deshalb steht sie im Weg. Löschen geht dann nicht
	mehr, archivieren schon: Es nimmt nichts weg.
-->
<!--
	**Der Weg zurueck steht immer da** (25.08.2026, aus beiden Reviews). Die
	Zustandsschranke gilt nur fuers Hineinlegen. Klammerte sie auch das
	Hervorholen ein, waere eine Versammlung, die im Entwurf archiviert und danach
	freigegeben wurde, nur noch ueber die Datenbank zu heilen: aus jeder Liste
	verschwunden, Einladungen draussen, kein Knopf mehr.
-->
<!--
	**Der Weg zur nächsten steht nicht unter «Archiv»** (Code-Review 06.09.2026).
	Der erste Anlauf setzte ihn in den Archivabschnitt: Wer eben den Abend
	abgeschlossen hat, sucht dort nicht, und der Befund «von der Versammlung
	führt kein Weg zur nächsten» bliebe beim Überfliegen bestehen.

	**«Ordentliche» steht ausdrücklich da.** Das Formular legt eine
	Erstversammlung an (`/versammlungen/neu` setzt fest `stufe: 'erste'`). Für
	die zweite Versammlung nach fehlender Beschlussfähigkeit gibt es einen
	eigenen Weg an der Anwesenheitsseite; wer ihn hier suchte, bekäme sonst eine
	Erstversammlung mit einem Quorum, das für sie nicht mehr gilt
	(`vertageVersammlung` in `$lib/server/versammlungen`).
-->
{#if !v.archiviertAm && !v.gemeinschaftArchiviertSeit && (v.zustand === 'versiegelt' || v.zustand === 'geschlossen')}
	<section class="weiter">
		<h2>Und weiter</h2>
		<p class="klein">
			<a href="/gemeinschaften/{v.stwegId}/versammlungen/neu">
				Nächste ordentliche Versammlung dieser Gemeinschaft anlegen
			</a>
		</p>
	</section>
{/if}

{#if v.archiviertAm || v.gemeinschaftArchiviertSeit || v.zustand === 'versiegelt' || v.zustand === 'geschlossen'}
	<section class="archiv">
		<h2>Archiv</h2>
		{#if form?.archiv}
			<Meldung ton="gut" marke={form}>{form.archiv}</Meldung>
		{/if}
		{#if v.gemeinschaftArchiviertSeit}
			<!--
				**Die Gruppe hält sie draussen** (25.08.2026, dritte Reviewrunde).
				Bis dahin stand hier nichts: Eine Versammlung, deren Gemeinschaft
				archiviert ist, sah aus wie jede andere — und wer sie einzeln
				hervorholte, las «steht wieder in Liste und Suche», wo sie nicht
				stand. Der Weg zurück führt über die Gemeinschaft.
			-->
			<p class="klein">
				<strong>
					Im Archiv seit {datumLang(tagVon(v.gemeinschaftArchiviertSeit))}, weil ihre
					Gemeinschaft archiviert ist.
				</strong>
				{#if v.archiviertAm}
					Sie ist zusätzlich einzeln archiviert.
				{/if}
				Sie erscheint nicht in Liste, Suche und auf der Startseite. Protokoll, Auswertung
				und Siegel bleiben abrufbar.
			</p>
			<p class="klein">
				<a href="/gemeinschaften/{v.stwegId}/angaben">
					Zur Gemeinschaft — dort steht der Weg zurück
				</a>
			</p>
		{:else if v.archiviertAm}
			<p class="klein">
				<strong>Im Archiv seit {datumLang(tagVon(v.archiviertAm))}.</strong>
				{#if v.archivnotiz}{' '}{v.archivnotiz}{/if}
				Sie erscheint nicht in Liste und Suche. Protokoll, Auswertung und Siegel bleiben
				abrufbar.
			</p>
			<form method="POST" action="?/hervorholen">
				<button type="submit">Aus dem Archiv holen</button>
			</form>
		<!-- zustand-nur-geschlossen: Genau der Zwischenzustand ist gemeint, die
		     versiegelte fängt der Zweig oben ab. -->
		{:else if v.zustand === 'geschlossen'}
			<!--
				**Der geschlossenen Versammlung fehlt das Siegel** (Auftraggeber, 25.08.2026:
				«Archivieren erst was versiegelt wurde»). Der Block steht hier
				trotzdem — gerade hier sucht jemand danach, und ein Knopf, der
				kommentarlos fehlt, ist keine Auskunft.
			-->
			<p class="klein">
				Archivieren geht erst nach dem Versiegeln. Das Siegel ist der Nachweis, dass das
				Protokoll zu dem gehört, was im Saal geschah — solange es fehlt, ist die Versammlung
				unfertig und gehört in den Blick.
			</p>
			<p class="klein">
				<a href="/versammlungen/{v.id}/siegel">Zum Versiegeln</a>
			</p>
		{:else if unterwegs}
			<p class="klein">
				Archivieren geht erst, wenn die Versammlung zurück ist. Sie wird gerade auf einem anderen
				Gerät geführt, und was dort geschieht, gehört noch dazu.
			</p>
		{:else}
			<p class="klein">
				Archivieren nimmt nichts weg: Die Versammlung bleibt mit allem, was an ihr hängt. Sie
				erscheint nur nicht mehr in Liste, Suche und auf der Startseite.
			</p>
			<form method="POST" action="?/archivieren" class="archivform">
				<input
					name="notiz"
					maxlength="200"
					placeholder="Warum (freiwillig)"
					aria-label="Warum archiviert wird"
					{...anfangswert(form?.quelle === 'archiv' ? form.notiz : '')}
				/>
				<button type="submit" class="leise">Versammlung archivieren</button>
			</form>
		{/if}
	</section>
{/if}

<p class="verlaufslink">
	<!--
		Über die Zugehörigkeit, wie der Verweis in der Ablaufleiste: `gegenstand`
		träfe nur Freigabe, Eröffnung und Schluss (Abnahme Block 3, 01.10.2026).
	-->
	<a href="/verlauf?versammlung={v.id}">Änderungen dieser Versammlung im Verlauf</a>
</p>

<style>
	.kopf {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.unterzeile,
	.anlass {
		color: var(--text-leise);
		margin: 0.25rem 0 0;
	}

	.anlass {
		color: var(--text);
	}

	h2 {
		margin-top: 2rem;
		font-size: 1.15rem;
	}

	/*
	 * Die Überschrift über einem Abschnitt trennt, sie schmückt nicht. Deshalb
	 * schmal und leise: Der Blick soll auf die Karten fallen, nicht auf das
	 * Wort darüber.
	 */
	.abschnitt {
		margin: 1.75rem 0 0.6rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-leise);
	}

	.weiter {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.knopf {
		min-height: var(--ziel-min);
		display: inline-flex;
		align-items: center;
		padding: 0 1.1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: inherit;
		text-decoration: none;
		font-weight: 550;
	}

	.knopf.haupt {
		border-color: var(--akzent);
		background: var(--akzent);
		color: var(--akzent-text);
	}

	.lebenslauf {
		margin-top: 1.25rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
		max-width: 42rem;
	}

	.kacheln {
		margin-top: 0.5rem;
	}

	.lebenslauf.abgegeben {
		border-left: 4px solid var(--warnung);
	}

	.lebenslauf.laeuft {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 8%, var(--flaeche));
	}

	.lebenslauf h2 {
		margin: 0 0 0.4rem;
		font-size: 1rem;
	}

	.lebenslauf p {
		margin: 0 0 0.7rem;
	}

	.wechsel {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		width: 100%;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	.wechsel :global(select),
	.wechsel :global(.auswahlsuche),
	.wechsel input {
		flex: 1 1 11rem;
		min-width: 0;
		min-height: var(--ziel-min);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--grund);
		color: var(--text);
		font: inherit;
	}

	/*
	 * **Die Suchauswahl steht als Ganzes in der Reihe** (UI-Durchgang
	 * 06.10.2026). Ohne Hülle waren Suchfeld, Trefferzähler und Auswahl je ein
	 * eigenes Flexelement: Der leere Zähler stand neben dem Suchfeld und nahm
	 * ihm 12 px (310 gegen 322 px bei 390). In der Hülle stehen die drei
	 * untereinander wie überall sonst, und Suchfeld und Auswahl sind gleich
	 * breit.
	 */
	.wechsel .auswahl {
		flex: 1 1 100%;
		min-width: 0;
	}

	/*
	 * **Rechts Platz für den Pfeil.** Mit 0.6rem lief ein langer Eintrag
	 * («Musterabend Musterweg · 11. September 2026», 416 px in 320 px) unter den
	 * Pfeil des Auswahlfelds, der Pfeil lag auf dem letzten Buchstaben.
	 */
	.wechsel :global(select) {
		padding-right: 2rem;
	}

	.klein {
		font-size: 0.875rem;
		color: var(--text-leise);
		margin: 0;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		max-width: 42rem;
		margin-top: 1rem;
	}


	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	/* Sachlich, nicht alarmierend: Der Vermerk ist die Feststellung, die
	   hinausgeht, und kein zweiter Fehler. */
	.meldung.vermerk {
		border-left: 3px solid var(--fehler);
		margin-top: 0.5rem;
		line-height: 1.5;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-leise);
		font: inherit;
		font-weight: 550;
		cursor: pointer;
	}

	.abschluss {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.abschluss button {
		border: none;
		background: var(--akzent);
		color: var(--akzent-text);
		padding: 0 1.25rem;
	}

	.verlaufslink {
		margin-top: 2rem;
		font-size: 0.9rem;
	}

	/*
		Abgesetzt und leise: Löschen ist kein Weg, den man sucht, sondern einer,
		den man findet, wenn man ihn braucht. Deshalb unten, hinter einer Linie,
		mit dem unauffälligen Knopf — die Warnfarbe kommt erst bei der Rückfrage.
	*/
	.entfernen {
		border-top: 1px solid var(--linie);
		margin-top: 2.5rem;
		max-width: var(--lesebreite);
		padding-top: 1.25rem;
	}

	.entfernen h2 {
		font-size: 1rem;
		margin: 0 0 0.35rem;
	}

	.entfernen .meldung.frage {
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
	}

	.entfernen .meldung.frage p {
		margin: 0 0 0.75rem;
	}

	.entfernen .knoepfe {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.entfernen button.gefahr {
		background: var(--fehler);
		border: none;
		/*
		 * **Nicht `#fff`** (01.09.2026): Im dunklen Thema ist `--fehler` ein
		 * helles Rosa, und weisse Schrift darauf war kaum zu lesen. `--flaeche`
		 * ist die Gegenfarbe, die `app.css` schon an jedem farbigen Hauptknopf
		 * benutzt.
		 */
		color: var(--flaeche);
	}

	.anzeigecode {
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 10%, transparent);
		padding: 1rem 1.15rem;
		max-width: 44rem;
		margin: 1.25rem 0;
	}

	.anzeigecode h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}

	.anzeigecode .code {
		font-family: ui-monospace, monospace;
		/*
		 * Auf einem schmalen Telefon misst der Code bei festen 2rem mehr als die
		 * Kastenbreite — er soll gross sein, aber nicht über den Rand.
		 */
		font-size: clamp(1.35rem, 7.5vw, 2rem);
		font-weight: 650;
		letter-spacing: 0.12em;
		margin: 0.25rem 0 0.5rem;
	}

	/* Eine Adresse ist ein Wort ohne Leerzeichen: Sie darf überall umbrechen,
	   sonst schiebt sie die Seite quer. */
	.anzeigecode .adresse {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		overflow-wrap: anywhere;
		margin: 0 0 0.5rem;
		color: var(--text);
	}

	.anzeige {
		margin: 0.75rem 0;
	}

	.anzeige summary {
		cursor: pointer;
		font-weight: 550;
	}

	/* Dieselbe Bauart wie in `Karte.svelte`: die Antwort steht, der Hintergrund
	   wartet zugeklappt. */
	.erklaerung {
		margin-top: 0.75rem;
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.erklaerung summary {
		cursor: pointer;
		color: var(--akzent);
	}

	.erklaerung p {
		margin: 0.4rem 0 0;
	}
</style>
