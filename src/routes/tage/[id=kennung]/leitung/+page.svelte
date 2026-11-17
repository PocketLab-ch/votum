<script lang="ts">
	/**
	 * Die Sitzungsleitung des gemeinsamen Abends.
	 *
	 * **Sie sieht aus wie die einer einzelnen Versammlung** (Auftraggeber, 24.08.2026:
	 * «Optisch soll Gruppe und Einzel identisch aussehen»). Die Regel steht seit
	 * dem 11.08. in `docs/gestaltung.md` — «Gleicher Gegenstand, gleiches
	 * Layout» —, galt aber nur für den Rahmen: Links der Ablauf, rechts die
	 * Seite. Innerhalb der Seite führte der Abend eine flache Knopfliste, die
	 * einzelne Versammlung einen Dreischritt mit «Aktuelles Geschäft» daneben.
	 *
	 * Deshalb hier dieselbe Anordnung, dieselben Überschriften, dieselben
	 * Rollennamen: Kopf mit Anwesenheitsmarke, «Ablauf» links mit
	 * vorher/jetzt/nachher, «Aktuelles Geschäft» rechts, darunter alle
	 * Traktanden.
	 *
	 * **Was anders bleibt, bleibt anders aus einem Grund:** Ein Klick wirkt auf
	 * alle Gemeinschaften, die den Punkt führen, und die Erfassung der Stimmen
	 * steht in der Leitung des Hauses — dort sind die Stimmberechtigten.
	 */
	import { zuordnungssatz } from '$lib/domain/freigabezuordnung';
	import {
		GEHEIM_BESCHLUSS_HAKEN,
		GEHEIM_HINWEIS_LEITUNG,
		GEHEIM_REGLEMENT_HAKEN
	} from '$lib/domain/auszaehlung';
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { aufgeklappt } from '$lib/felder';
	import Beamerfenster from '$lib/components/Beamerfenster.svelte';
	import Beschlussfaehigkeitskachel from '$lib/components/Beschlussfaehigkeitskachel.svelte';
	import Einlass from '$lib/components/Einlass.svelte';
	import Papierentscheid from '$lib/components/Papierentscheid.svelte';
	import Ergebnisnachgang from '$lib/components/Ergebnisnachgang.svelte';
	import AbstimmungAbbrechen from '$lib/components/AbstimmungAbbrechen.svelte';
	import Antragspruefung from '$lib/components/Antragspruefung.svelte';
	import Rueckfrage from '$lib/components/Rueckfrage.svelte';
	import Pausenschalter from '$lib/components/Pausenschalter.svelte';
	import Meldung from '$lib/components/Meldung.svelte';
	import { datumLang, uhrzeit } from '$lib/domain/datum';
	import Wandbild from '$lib/components/Wandbild.svelte';
	import Votum from '$lib/components/Votum.svelte';
	import Stimmerfassung from '$lib/components/Stimmerfassung.svelte';
	import Eingriffe from '$lib/components/Eingriffe.svelte';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import { stelltBeschlussfaehigkeitFest as gemeinsamerPunkt } from '$lib/domain/traktandenvorlage';
	import { laeuftGemeinsam } from '$lib/domain/gemeinsameliste';

	let { data, form } = $props();

	/** Wo eine Abstimmung zu diesem Punkt offen ist — über die Traktandenkennungen. */
	function offenBei(z: { traktanden: { traktandumId: string }[] } | null): typeof data.offene {
		if (!z) return [];
		const meine = new Set(z.traktanden.map((t) => t.traktandumId));
		return data.offene.filter((o) => meine.has(o.traktandumId));
	}

	const offenJetzt = $derived(offenBei(data.aktuelles));

	/**
	 * Woran die Bausteine des laufenden Schrittes hängen.
	 *
	 * **Ein Schritt ist am Abend ein Traktandum in einem Haus** — beides gehört
	 * also in den Schlüssel. Er trägt die `{#key}`-Blöcke um `Votum`,
	 * `Eingriffe` und `Stimmerfassung`: Seit die Sicht über `absenden()`
	 * schickt, lädt sie beim Wechsel nicht mehr neu, und diese Bausteine
	 * überlebten ihn samt allem, was sie mit `untrack()` eingefroren haben —
	 * der Sicherungsmerker des Votums, der aufgeklappte Ausstandskasten mit
	 * seiner Parteiauswahl, die angekreuzten Felder der Erfassungstabelle.
	 * Die Begründung im Einzelnen steht in `docs/gestaltung.md`.
	 *
	 * **Was er nicht trennt:** zwei Durchgänge am selben Traktandum.
	 * `data.offene` führt keine Durchgangskennung, anders als `data.offen.id`
	 * in der Leitung eines Hauses. Der gewöhnliche Weg fängt es ab — zwischen
	 * Schliessen und Öffnen gibt es keine `data.erfassung`, der `{#if}`
	 * zerstört die Tabelle also ohnehin. Wer die Kennung einmal mitgibt,
	 * nimmt sie hier auf.
	 */
	/*
	 * **Zu den Fokusmarken dieser Sicht.** Gegenläufige Handlungen — «Abstimmung
	 * eröffnen» und «Abstimmung schliessen», die drei Schritte des Ablaufs —
	 * tragen ihren Unterschied hinter dem Doppelpunkt, wo sonst der Gegenstand
	 * steht (`abstimmung:schliessen` statt `schliessen:abstimmung`). Das ist
	 * Absicht: Der Ersatzgriff in `absenden()` sucht ein Element, dessen Marke
	 * auf denselben Gegenstand endet, und fände so die **Umkehrhandlung**. In
	 * der Leitung eines Hauses ist genau das aufgefallen — nach dem Schliessen
	 * lag der Fokus auf «Freigeben», und ein Nachdrücken eröffnete einen neuen
	 * Durchgang. Hier greift der Ersatz nicht, der Fokus bleibt auf `<body>`,
	 * und das ist bei nicht rücknehmbaren Handlungen die richtige Antwort.
	 */
	const schrittSchluessel = $derived(
		`${data.aktuelles?.traktandumId ?? ''}:${data.schritthaus?.meetingId ?? ''}`
	);
	/** Die Punkte der obersten Ebene — ihre Zahl ist die Obergrenze beim Verschieben. */
	const punkte = $derived(data.liste.filter((z) => z.tiefe === 1));
	/** Ob in irgendeiner Gemeinschaft schon festgehalten wurde — entscheidet die Beschriftung. */
	const schonFestgehalten = $derived(data.stand.some((st) => st.festgestellt));
	/** Ob das Festhalten angeboten wird — nur beim Traktandum, das die Beschlussfähigkeit betrifft. */
	const festhalten = $derived(
		Boolean(data.aktuelles && gemeinsamerPunkt(data.aktuelles.titel))
	);

	/** Welche Versammlungen des Abends noch laufen — sie werden geschlossen. */
	const offeneHaeuser = $derived(data.stand.filter((s) => s.zustand === 'laufend'));

	/**
	 * Was sich vertagen lässt: was läuft, und was noch die erste Versammlung ist.
	 *
	 * Eine dritte kennt ZGB Art. 712p nicht — steht ein Haus schon in zweiter
	 * Versammlung, braucht es eine neue Einberufung, keine Vertagung. Es hier
	 * anzubieten führte in eine Absage aus der Tiefe.
	 */
	/**
	 * Über welche Häuser des laufenden Punktes schon entschieden ist.
	 *
	 * **Der Anlass** (Auftraggeber, 25.08.2026): «und wenn 2.1 bereits abgestimmt, kann
	 * ich dort nicht nochmals abstimmen, wie es der button suggeriert.»
	 *
	 * `data.rueckkommen` deckt nur den Punkt ab, hinter dem **ein** Haus steht;
	 * bei einem Sammelpunkt über fünf Gemeinschaften ist es null, und der Knopf
	 * stand da, obwohl überall entschieden war. Der Server sagt dann «Nirgends
	 * möglich» — im Saal liest sich das wie ein Defekt.
	 */
	const punktEntschieden = $derived(
		(data.aktuelles?.traktanden ?? []).filter((t) => data.entschiedene.includes(t.traktandumId))
	);
	const alleEntschieden = $derived(
		(data.aktuelles?.traktanden.length ?? 0) > 0 &&
			punktEntschieden.length === data.aktuelles?.traktanden.length
	);

	const vertagbar = $derived(
		data.stand.filter((s) => s.zustand === 'laufend' && s.stufe === 'erste')
	);

	/**
	 * Ob der Abend am Ende ist: Es ist etwas aufgerufen, es kommt nichts mehr,
	 * keine Abstimmung läuft, und mindestens eine Versammlung ist noch offen.
	 *
	 * Dieselbe Rechnung wie im Haus (`abschluss.amEnde`) — nur mit dem Zusatz der
	 * letzten Bedingung: Sind alle geschlossen, gibt es nichts mehr zu schliessen,
	 * und ein Knopf, der in eine Absage führt, gehört nicht dorthin, wo die
	 * Sitzungsleitung den nächsten Schritt sucht.
	 */
	const amEnde = $derived(
		data.aktuelles !== null &&
			data.naechstes === null &&
			offenJetzt.length === 0 &&
			offeneHaeuser.length > 0
	);
	/**
	 * **Zwei Gestalten, ein Balken** (28.08.2026).
	 *
	 * Die Aktionen dieser Seite geben `fail(400, { fehler: '<Satz>' })` zurück,
	 * dreissigmal, und der Typ kennt nur diese eine Form. Seit `Einlass.svelte`
	 * auf `absenden()` steht, kann hier aber auch dessen Ausfallmeldung landen,
	 * und die trägt `{ fehler: { nachricht } }` — über `applyAction`
	 * eingeschoben, also erst zur Laufzeit, wo `svelte-check` nichts davon
	 * sieht. Ohne diese Unterscheidung stünde im roten Balken «[object
	 * Object]», und zwar genau dann, wenn im Saal die Verbindung abreisst.
	 */
	function fehlertext(fehler: unknown): string {
		if (typeof fehler === 'string') return fehler;
		const nachricht = (fehler as { nachricht?: unknown })?.nachricht;
		return typeof nachricht === 'string' ? nachricht : 'Die Handlung ist fehlgeschlagen.';
	}
</script>

<div class="saalkopf">
	<!--
		**Der Beamerknopf steht rechts oben, wie im Haus** (Auftraggeber, 24.08.2026:
		«Optisch soll Gruppe und Einzel identisch aussehen»). Zuerst stand er
		unter den Wegen — dieselbe Handlung an anderer Stelle, und wer zwischen
		Gruppe und Haus wechselt, sucht ihn zweimal.
	-->
	<span class="beamerplatz">
		<Beamerfenster pfad="/tage/{data.tag.id}/praesentation" knapp />
	</span>
	<div class="kopf">
		<h1>Sitzungsleitung</h1>
		<span class="marke">{data.anwesend} von {data.stimmberechtigt} anwesend</span>
		<!--
			**Wie viele Gemeinschaften beschlussfähig sind** (Auftraggeber, 24.08.2026:
			«Was noch oben hin kann, wie viele Gemeinschaften beschlussfähig sein.
			Bspw. 4 von 5»).
			
			Die Zahl der Häuser allein sagt nichts; die Frage im Saal lautet, ob
			beschlossen werden kann — und die Antwort ist je Gemeinschaft
			verschieden. «4 von 5» sagt beides in drei Zeichen.
		-->
		<span class="marke" class:vollzaehlig={data.beschlussfaehige === data.haeuser.length}>
			{data.beschlussfaehige} von {data.haeuser.length} beschlussfähig
		</span>
		{#if offenJetzt.length > 0}
			<span class="marke laeuft">Abstimmung läuft</span>
		{/if}
	</div>
	<p class="wo">
		{data.tag.bezeichnung} · {datumLang(data.tag.datum)} · {data.tag.ort}
	</p>
	<p class="hin">
		<a href="/tage/{data.tag.id}/einlass">Anwesenheit</a> ·
		<a href="/tage/{data.tag.id}/vollmachten">Vollmachten</a> ·
		<a href="/tage/{data.tag.id}/tafel">Tafel im Saal</a>
	</p>
</div>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{fehlertext(form.fehler)}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}
<!--
	**Eine Warnung aus der Aufnahme bleibt stehen** (Produktentscheid
	06.10.2026, «Eigenes Feld für Warnungen, das stehen bleibt»). Mit
	`ton="warnung"` wandert sie nicht in die Quittungsecke, sondern steht hier,
	bis die Leitung sie schliesst oder die nächste Antwort des Servers kommt.
	Warum sie nicht als `hinweis` reist, steht bei `Saalaufnahme.warnung`.
-->
{#if form?.warnung}
	<Meldung ton="warnung" marke={form}>{form.warnung}</Meldung>
{/if}

<!--
	**Der Pausenschalter steht vor dem Ablauf** — wie in der Leitung eines
	Hauses. Ganz oben, weil er im Notfall gebraucht wird, und weil ein
	unterbrochener Saal das Erste ist, was die Sitzungsleitung sehen muss.

	Am Abend gilt er für ALLE: Wer unterbricht, unterbricht den Raum. Die Leute
	stehen auf und gehen hinaus; in einem Haus weiterzustimmen, während im
	anderen niemand mehr sitzt, wäre keine Pause.
-->
<!--
	**Der Einlasskasten steht vor dem Ablauf** — wie in der Leitung eines Hauses.
	Er verschwindet, wenn niemand wartet; steht jemand am Eingang, ist er das
	Erste auf der Seite. Am gemeinsamen Abend fehlte er ganz, obwohl der QR auf
	der Leinwand genau hierher meldet (24.08.2026).
-->
<!--
	`laufend` sagt, ob die Knöpfe drücken dürfen — und das hängt daran, ob
	überhaupt eine Versammlung läuft. `stand.length > 0` stünde hier falsch: Das
	ist die Zahl der Häuser, nicht die der offenen. Ein Knopf, der in eine Absage
	aus der Tiefe führt («die Versammlung läuft nicht»), ist schlimmer als ein
	gesperrter mit Grund.
-->
<!--
	**Der Rückweg gehört dorthin, wo der Vermerk entsteht** (10.09.2026). Seit die
	Freigabe von dieser Seite aus fragt, kann sie auch danebengreifen — und ein
	Fehlgriff ohne Rückweg sperrte das Telefon der Partei für den ganzen Abend.
	Fünf Sekunden hier, danach steht der Vermerk an der Zeile am Eingang des
	Abends.
-->
<Papierentscheid papier={form && 'papier' in form ? form.papier : null} />
{#if form && 'papier' in form && form.papier}
	<!--
		**Der Kasten nennt einen Ort, den es hier nicht gibt** (10.09.2026, beim
		Gegenlesen des eigenen Blocks gefunden). Sein letzter Satz sagt: «Danach
		steht der Rückweg in der Anwesenheitsliste, an der Zeile dieser Partei.»
		Das stimmt — nur führt diese Seite keine Anwesenheitsliste, sie führt die
		Sitzung. Wer die fünf Sekunden verpasst, stünde vor einem Verweis ins
		Nichts.

		Dieselbe Klasse ist heute zweimal im Review aufgeschlagen: eine Absage, die
		einen Ausweg nennt, den es nicht gibt. Ein Satz mit Verknüpfung ist billiger
		als ein zweiter Rückweg an dieser Stelle, und er ist wahr.
	-->
	<p class="klein papierweg">
		Nach den fünf Sekunden steht der Rückweg am
		<a href="/tage/{data.tag.id}/einlass">Eingang des Abends</a>, an der Zeile dieser Partei.
	</p>
{/if}
<Einlass
	wartende={data.wartende}
	saalmeldungen={data.saalmeldungen}
	parteien={data.eingangsparteien}
	laufend={data.stand.some((s) => s.zustand === 'laufend')}
	knapp
/>

<Pausenschalter pause={data.pause} abstimmungOffen={offenJetzt.length > 0} />
<!--
	**Der Hinweis gilt dem gemischten Stand, nicht dem fehlenden** (01.09.2026).
	Vorher hing er an `data.pause === null` und behauptete damit Uneinigkeit,
	solange schlicht niemand unterbrochen hatte — also den ganzen Abend über.
-->
{#if !data.pausenEinig}
	<!--
		**Beide Wege, nicht nur einer** (Code-Review 01.09.2026).

		Bei gemischtem Stand zeigt der Schalter «Fortfahren», weil die Wand die
		Pause zeigt. Damit gäbe es aus der Uneinigkeit nur den Weg nach unten:
		überall fortfahren und danach neu unterbrechen. Wer die Pause meinte, soll
		sie vervollständigen können, ohne den Saal zwischendurch freizugeben.

		Zuvor war es umgekehrt falsch: Der Schalter bot bei Uneinigkeit nur
		«Pause» an, und der Abend liess sich nicht mehr fortsetzen.
	-->
	<div class="unstimmig">
		<p class="leise">
			Unterbrochen, aber nicht in jeder Gemeinschaft. Die Wand zeigt die Pause; wo nicht
			unterbrochen ist, kann weiter abgestimmt werden.
		</p>
		<form method="POST" action="?/pause" use:enhance={absenden()}>
			<input type="hidden" name="an" value="ja" />
			<button type="submit" class="leise">In allen Gemeinschaften unterbrechen</button>
		</form>
	</div>
{/if}

<div class="raster">
	<!-- ── Links: der Ablauf ────────────────────────────────────────────────── -->
	<section class="ablauf">
		<h2>Ablauf</h2>

		<ol class="dreischritt">
			<li class="vorher">
				<span class="rolle">vorher</span>
				{#if data.vorheriges}
					<strong>{data.vorheriges.nummer}</strong>
					{data.vorheriges.titel}
					{#if data.vorheriges.gemeinschaft}
						<span class="leise">{data.vorheriges.gemeinschaft}</span>
					{/if}
					<!--
						**Zurück** (Auftraggeber, 24.08.2026: «Bei der Steuerung muss man auch zurück
						können»). Der Dreischritt zeigte den vorherigen Punkt, aber es gab
						keinen Weg dorthin — wer zurückwollte, musste ihn unten in der Liste
						suchen. Dabei ist es dieselbe Handlung wie beim nächsten Punkt: ihn
						aufrufen.
					-->
					<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
						<input type="hidden" name="geschaeft" value={data.vorheriges.geschaeftId} />
						<input type="hidden" name="traktandum" value={data.vorheriges.traktandumId ?? ''} />
						<button type="submit" class="leise" data-fokus="schritt:zurueck">Zurück</button>
					</form>
				{:else}
					<span class="leise">—</span>
				{/if}
			</li>

			<li class="jetzt" class:offen={offenJetzt.length > 0}>
				<span class="rolle">jetzt</span>
				{#if data.aktuelles}
					<strong>{data.aktuelles.nummer}</strong>
					{data.aktuelles.titel}
					{#if data.aktuelles.gemeinschaft}
						<span class="leise">{data.aktuelles.gemeinschaft}</span>
					{/if}
					<form method="POST" action="?/zuruecknehmen" use:enhance={absenden()}>
						<input type="hidden" name="geschaeft" value={data.aktuelles.geschaeftId} />
						<input type="hidden" name="traktandum" value={data.aktuelles.traktandumId ?? ''} />
						<button type="submit" class="leise" data-fokus="schritt:jetzt">Aufruf zurücknehmen</button>
					</form>
				{:else}
					<span class="leise">Noch ist nichts aufgerufen.</span>
				{/if}
			</li>

			<li class="nachher" class:amEnde={amEnde}>
				<span class="rolle">nachher</span>
				{#if data.naechstes}
					<strong>{data.naechstes.nummer}</strong>
					{data.naechstes.titel}
					{#if data.naechstes.gemeinschaft}
						<span class="leise">{data.naechstes.gemeinschaft}</span>
					{/if}
					<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
						<input type="hidden" name="geschaeft" value={data.naechstes.geschaeftId} />
						<input type="hidden" name="traktandum" value={data.naechstes.traktandumId ?? ''} />
						<button type="submit" class="haupt" data-fokus="schritt:naechstes">Aufrufen</button>
					</form>
				{:else if amEnde}
					<!--
						**Der Abschluss steht dort, wo sonst das nächste Geschäft steht** —
						wie im Haus seit dem 21.08.2026: «Wenn das letzte Traktandum durch
						ist, kann dort der Abschluss knopf kommen.» Genau hier sucht die
						Sitzungsleitung den nächsten Schritt.

						Am Abend fehlte er ganz: Geschlossen wurde nur auf der Seite jedes
						Hauses, fünf Wechsel nacheinander, während alle aufstehen. Wer den
						letzten vergisst, hat eine Woche später eine Versammlung, die läuft.

						**Mit Rückfrage**, anders als beim Unterbrechen: Schliessen lässt
						sich nicht zurücknehmen.
					-->
					<strong>Alle Traktanden behandelt</strong>
					<form method="POST" action="?/abschliessen" use:enhance={absenden()}>
						<Rueckfrage
							beschriftung={offeneHaeuser.length === 1
								? 'Versammlung schliessen'
								: 'Alle Versammlungen schliessen'}
							gewicht="haupt"
							ton="warnung"
							frage={offeneHaeuser.length === 1
								? 'Versammlung schliessen?'
								: `${offeneHaeuser.length} Versammlungen schliessen?`}
							folge="Das lässt sich nicht zurücknehmen. Offene Abstimmungen werden mitgeschlossen, die Zugänge werden entwertet, und die Leinwand zeigt danach den Abschluss."
							bestaetigen="Jetzt schliessen"
						/>
					</form>
				{:else}
					<span class="leise">Das war der letzte Punkt.</span>
				{/if}
			</li>
		</ol>

		<div class="listenkopf">
			<h3>Alle Traktanden</h3>
			<!--
				**Das Stellenfeld bleibt sichtbar** (Auftraggeber, 24.08.2026: «Jetzt sind
				wieder die Sortierbarkeit der Traktanden und Subtraktanden
				verschwunden»).

				Ein Versuch, die Liste zu beruhigen, hatte es hinter einen Schalter
				gelegt — und damit eine Handlung versteckt, die im Saal gebraucht wird.
				Aufgeräumt heisst nicht weniger Möglichkeiten, sondern eine ruhige
				Ordnung: Die Zeile hat feste Spuren, das Feld sitzt immer an derselben
				Stelle.
			-->
		</div>
		<!--
			**Hier fehlt der Sprung zur eben aufgenommenen Zeile** (Stand
			06.09.2026). Die Aktion `?/aufnehmen` liefert seit heute die Kennung
			des Aufgenommenen mit (`form.aufgenommen`, siehe `saalaufnahme.ts`);
			die Sitzungsleitungssicht einer einzelnen Gemeinschaft rollt damit zur
			neuen Zeile und markiert sie. **Diese Seite tut das noch nicht.**

			Der Grund ist keine Nachlässigkeit, sondern ein Nachweis, den es hier
			nicht gibt: Diese Liste ist zweistufig, und die Zeile einer einzelnen
			Gemeinschaft steht im Aufklapper «Einzeln führen» — ein Sprung dorthin
			müsste ihn erst öffnen. Kein Drehbuch fährt diese Seite, der Fix wäre
			also ungemessen. Der Befund vom 05.09.2026 («die neue Zeile entsteht
			ausserhalb des Blicks») besteht hier deshalb weiter.
		-->
		<ul class="alle">
			{#each data.liste.filter((z) => z.tiefe === 1) as z, i (z.geschaeftId)}
				{@const offen = offenBei(z)}
				{@const unter = data.liste.filter(
					(u) => u.tiefe === 2 && u.geschaeftId === z.geschaeftId
				)}
				<li class:laeuft={offen.length > 0}>
					<span class="nummer">{z.nummer}</span>
					<span class="titel">{z.titel}</span>
					<span class="marken">
						{#if z.haeuser > 1}
							<span class="leise">{z.haeuser} Gemeinschaften</span>
						{/if}
						{#if z.punktart === 'kenntnisnahme'}
							<span class="leise">Kenntnisnahme</span>
						{:else if z.punktart === 'gemischt'}
							<span class="leise">teils Kenntnisnahme</span>
						{/if}
					</span>
					<span class="tat">
					<!--
						Dasselbe Zahlenfeld wie in der Leitung einer einzelnen Versammlung —
						dort seit dem 21.08. statt eines Pfeils, weil zwanzig Traktanden
						sonst neunzehn Klicks bedeuteten, jeden mit einem Seitenwechsel, im
						Saal, während alle zusehen.

						Bewegt wird das **Geschäft**, nicht die einzelne Ziffer: 7.1 und 7.2
						sind dieselbe Sache in zwei Gemeinschaften. Sie zu trennen ergäbe
						zwei Punkte, über die getrennt beraten würde, obwohl es einer ist.
					-->
					{#if punkte.length > 1}
						<form
							method="POST"
							action="?/verschieben"
							class="stellenform"
							use:enhance={absenden({ zurueckBeiAbsage: true })}
						>
							<input type="hidden" name="geschaeft" value={z.geschaeftId} />
							<label>
								Stelle
								<input
									type="number"
									name="stelle"
									{...anfangswert(String(i + 1))}
									min="1"
									max={punkte.length}
									required
									title="An welcher Stelle im Ablauf dieser Punkt behandelt wird"
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								/>
							</label>
							<button
								type="submit"
								class="leise"
								aria-label="{z.nummer} {z.titel} an die eingetragene Stelle setzen"
							>Setzen</button>
						</form>
					{/if}
						{#if data.aktuelles?.geschaeftId !== z.geschaeftId}
							<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
								<input type="hidden" name="geschaeft" value={z.geschaeftId} />
								<button type="submit">Aufrufen</button>
							</form>
						{/if}
					</span>
				</li>

				<!--
					**Die Unterpunkte sind der Normalweg** (Auftraggeber, 24.08.2026): «Wenn
					Subtraktanden vorhanden sind, muss durch die durch navigiert werden.»
					Beschlossen wird in jeder Gemeinschaft für sich, also wird auch in
					jeder für sich gefragt — die Ausnahme ist die Feststellung der
					Beschlussfähigkeit, wo eine Feststellung für den ganzen Saal genügt.

					Dieselbe Grenze wie die Schrittrechnung (`laeuftGemeinsam`): Wird
					unter dem Punkt irgendwo abgestimmt, ist er nicht gemeinsam, auch wenn
					«beschlussfähig» im Titel steht.
				-->
				{#if unter.length > 1 && !laeuftGemeinsam(z, gemeinsamerPunkt)}
					<!--
						**Einzeln je Gemeinschaft** (Auftraggeber, 24.08.2026): «Wie funktioniert das
						Mecano bei Traktanden, die nicht alle STWEG betreffen? Müsste da
						nicht einzeln durchgegangen werden? […] Erneuerungsfonds, Bestellung
						Ausschuss etc. kann unterschiedlich sein.»

						Der Sammelaufruf bleibt der Normalweg: Steht überall derselbe Antrag,
						wird im Saal einmal gefragt, und jede Gemeinschaft beschliesst für
						sich. Lautet er je Haus anders, wird nacheinander gefragt — dann
						braucht es diesen Weg, sonst stünde auf jedem Telefon die Frage des
						Nachbarhauses.

						**Offen, sobald die Häuser auseinandergehen.** Wo derselbe Wortlaut
						steht, bleibt der Ausklapper zu; dort ist der einzelne Aufruf die
						Ausnahme und soll nicht zum Normalweg einladen.
					-->
					<li class="einzeln">
						<details {...aufgeklappt(unter.some((u) => u.abweichend))}>
							<summary
								title="Diesen Punkt in einer einzelnen Gemeinschaft aufrufen, abstimmen oder schliessen — nötig, wenn der Antrag je Haus anders lautet."
								>Einzeln führen</summary
							>
							<ul>
								{#each unter as u, j (u.traktandumId)}
									{@const laeuft = data.offene.some((o) => o.traktandumId === u.traktandumId)}
									{@const dran = data.aufgerufene.includes(u.traktandumId ?? '')}
									{@const fertig = data.entschiedene.includes(u.traktandumId ?? '')}
									<li>
										<span class="nummer">{u.nummer}</span>
										<span class="titel">
											{u.gemeinschaft}
											{#if u.abweichend}
												<span class="leise">eigener Wortlaut</span>
											{/if}
										</span>
										<!--
											Die Handlungen in einem eigenen Platz unter dem Namen, damit
											Feld, Knopf und Sperrsatz die Zeile nicht seitlich schieben
											(06.10.2026, UI-Durchgang; siehe `.alle .einzeln li`).
										-->
										<div class="tat">
										<!--
											**Auch die Ziffern lassen sich umstellen** (Auftraggeber, 24.08.2026).
											Welche Gemeinschaft zuerst abstimmt, ist eine Frage des Ablaufs
											im Saal — und die entscheidet sich manchmal erst dort.
										-->
										<form
											method="POST"
											action="?/umordnen"
											class="stellenform"
											use:enhance={absenden({ zurueckBeiAbsage: true })}
										>
											<input type="hidden" name="geschaeft" value={u.geschaeftId} />
											<input type="hidden" name="traktandum" value={u.traktandumId} />
											<label>
												Stelle
												<input
													type="number"
													name="stelle"
													{...anfangswert(String(j + 1))}
													min="1"
													max={unter.length}
													required
													title="An welcher Stelle diese Gemeinschaft abstimmt"
													onchange={(e) => e.currentTarget.form?.requestSubmit()}
												/>
											</label>
											<button
												type="submit"
												class="leise"
												aria-label="{u.nummer} {u.gemeinschaft} an die eingetragene Stelle setzen"
											>Setzen</button>
										</form>
										<!--
											**Ein Knopf, nicht drei.** Welcher, sagt der Zustand dieses
											Hauses: Läuft die Abstimmung, gehört sie geschlossen; ist der
											Punkt aufgerufen, kann abgestimmt werden; sonst wird
											aufgerufen. Drei Knöpfe nebeneinander wären drei
											Entscheidungen, wo eine ansteht.
										-->
										{#if laeuft}
											<form method="POST" action="?/schliessen" use:enhance={absenden()}>
												<input type="hidden" name="geschaeft" value={u.geschaeftId} />
												<input type="hidden" name="traktandum" value={u.traktandumId} />
												<button type="submit">Schliessen</button>
											</form>
										{:else if fertig}
											<!--
												**Entschieden — kein zweiter Knopf** (Auftraggeber, 25.08.2026: «und
												wenn 2.1 bereits abgestimmt, kann ich dort nicht nochmals
												abstimmen, wie es der button suggeriert»).

												Hier stand weiter «Abstimmen» beziehungsweise «Aufrufen», und
												der Server wies beides ab. Im Saal liest sich das wie ein
												Defekt — und es kostet den Augenblick, in dem alle zusehen.

												Ein zweiter Durchgang ist nicht unmöglich, aber er braucht
												einen Beschluss der Versammlung: das Rückkommen. Der Weg
												dorthin führt über die Leitung des Hauses, wo der Antrag
												gestellt wird — deshalb steht hier kein Knopf, sondern der
												Stand und der Verweis.
											-->
											<span class="fertig">entschieden</span>
											<a class="leise" href="/versammlungen/{u.meetingId}/leitung">
												Zur Gemeinschaft
											</a>
										{:else if dran && u.punktart === 'abstimmung' && data.ohneMehr[u.traktandumId ?? '']}
											<!--
												**Ohne Mehrheitserfordernis kein «Abstimmen»** (Laienprüfung
												Runde 3, Befund N-1, 06.10.2026). Der Knopf führte in eine
												Absage, die auf den Entscheidbaum verweist, und den gibt es
												hier nicht. Satz und Verweis wie im Sperrzweig darunter;
												der Rückweg in den Abend gilt dort wie hier nicht
												(`pruefeRueckweg`), die Seite fällt auf ihren Ersatz zurück.
											-->
											<p class="meldung warnung sperre">
												Für diesen Antrag ist noch kein Mehrheitserfordernis gesetzt; ohne eines
												lässt sich nicht abstimmen.
											</p>
											<a
												class="leise"
												href="/versammlungen/{u.meetingId}/traktanden/{u.traktandumId}/erfordernis?zurueck=/tage/{data
													.tag.id}/leitung"
											>
												Erfordernis setzen
											</a>
										{:else if dran && u.punktart === 'abstimmung' && data.sperren[u.traktandumId ?? '']}
											<!--
												**Kein Knopf, der in eine Absage führt** (25.09.2026), wie im
												Dreischritt: der Satz aus der Vorschau des Hauses und daneben
												der Weg, den er nennt. «Unter ‹Jetzt möglich›» steht hier nur,
												wenn dieses Haus gerade «jetzt» ist; bei fehlenden Betroffenen
												führt deshalb ein eigener Verweis in die Leitung des Hauses, wo
												der Punkt aufgerufen ist (seit A2b). Zurück in den Abend
												führt er nicht: `pruefeRueckweg` lässt nur Pfade unter der
												Versammlung zu (offen, `docs/freigabe.md`, Abschnitt 3).
											-->
											<p class="meldung warnung sperre">{data.sperren[u.traktandumId ?? '']}</p>
											{#if data.sperrtWegenBetroffener[u.traktandumId ?? '']}
												<a class="leise" href="/versammlungen/{u.meetingId}/leitung">
													Betroffene eintragen
												</a>
											{/if}
											<a
												class="leise"
												href="/versammlungen/{u.meetingId}/traktanden/{u.traktandumId}/erfordernis?zurueck=/tage/{data
													.tag.id}/leitung"
											>
												Nötige Mehrheit ändern
											</a>
										{:else if dran && u.punktart === 'abstimmung'}
											{@const z = data.zuordnungen[u.traktandumId ?? '']}
											<form
												method="POST"
												action="?/oeffnen"
												class="zuordnungsform"
												use:enhance={absenden()}
											>
												<input type="hidden" name="geschaeft" value={u.geschaeftId} />
												<input type="hidden" name="traktandum" value={u.traktandumId} />
												<!-- Die Zuordnung wie am Hauptknopf (Ä-05); Begründung bei
												     `zuordnungen` in +page.server.ts. -->
												{#if z}
													<p class="klein" data-zuordnung>{zuordnungssatz(z, 'Abstimmen')}</p>
													<input type="hidden" name="zuordnung" value={z.marke} />
												{/if}
												<button type="submit">Abstimmen</button>
											</form>
										{:else if !dran}
											<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
												<input type="hidden" name="geschaeft" value={u.geschaeftId} />
												<input type="hidden" name="traktandum" value={u.traktandumId} />
												<button type="submit" class="leise">Aufrufen</button>
											</form>
										{/if}
										</div>
									</li>
								{/each}
							</ul>
						</details>
					</li>
				{/if}
			{/each}
		</ul>
		<!--
			**Dieselbe Komponente wie in der Leitung eines Hauses** (Auftraggeber,
			24.08.2026: «Optisch soll Gruppe und Einzel identisch aussehen»).

			Ein Nachbau stand hier zuerst — dieselben drei Wahlmöglichkeiten, von
			Hand gesetzt. Die Feldregel (`scripts/eslint/felder.mjs`) hat ihn beanstandet (`checked` statt
			`angekreuzt`), und das war der Hinweis: Was es als Baustein gibt,
			gehört nicht abgeschrieben. Der Kopf von `Wandbild.svelte` erklärt
			auch, warum das gebundene `checked` dort falsch wäre.

			Sie setzt alle Gemeinschaften zugleich: Ein gemeinsamer Bildschirm mit
			fünf verschiedenen Wandbildern wäre keiner.
		-->
		<Wandbild
			art={data.wandbild ?? 'traktanden'}
			text={null}
			aufgerufen={data.aktuelles
				? { nummer: data.aktuelles.nummer, titel: data.aktuelles.titel }
				: null}
		/>
		{#if data.wandbild === null}
			<p class="leise">
				Die Gemeinschaften zeigen zurzeit Verschiedenes. Eine Wahl hier gleicht sie an.
			</p>
		{/if}
	</section>

	<!-- ── Rechts: das laufende Geschäft ────────────────────────────────────── -->
	<section class="geschaeft">
		<h2>Aktuelles Geschäft</h2>

		<!--
			**Ob beschlossen werden darf, steht auch hier** — wie in der Leitung
			eines Hauses seit dem 23.08. Je Gemeinschaft eine Zeile, denn eine
			gemeinsame Beschlussfähigkeit gibt es nicht.
		-->
		<!--
			**Der Balken je Gemeinschaft** (Auftraggeber, 24.08.2026: «bei aktuellem Geschäft
			bräuchte es noch die Gauge-Anzeige über die Beschlussfähigkeit über alle
			STWEG und MEG»).
			
			Das Wort «beschlussfähig» sagt nur ja oder nein. Der Balken zeigt, WIE
			weit — und mit der Marke, wo die Schwelle liegt. Bei einer verschärften
			Reglementsregel liegt sie ganz woanders als bei der Hälfte, und im Saal
			ist der Unterschied zwischen «knapp» und «deutlich» eine Entscheidung.
			
			Dieselbe Komponente wie an der Tafel, am Beamer und auf der
			Anwesenheitsseite — eine Rechnung, vier Anzeigen.
		-->
		<!--
			**Ein Quadrat je Gemeinschaft** (Auftraggeber, 24.08.2026): «Bekommt man die STWEG
			Beschlussfähigkeit je auf ein Quadrat? Es müsste ja nur der Name stehen,
			ein Balken grün mit Zahl — rot, wenn nicht erreicht. Das wäre hilfreich,
			wenn bspw. 7 STWEG an einer Versammlung wäre.»

			Die ausführliche Anzeige braucht je Bedingung eine Zeile mit dem Satz
			«Wertquoten anwesend oder vertreten» — bei sieben Gemeinschaften füllt das
			den Bildschirm. Die Kachel zeigt dasselbe Urteil auf einem Sechstel des
			Platzes; was darunter steht, sind dieselben Zahlen.
		-->
		<div class="gauge">
			{#each data.stand as st (st.meetingId)}
				<div class="hauskachel">
					<Beschlussfaehigkeitskachel
						name={st.gemeinschaft}
						bedingungen={st.beschlussfaehig?.bedingungen ?? []}
						beschlussfaehig={Boolean(st.beschlussfaehig?.erfuellt)}
					/>
					{#if st.einzigerEigentuemer}
						<p class="klein">{st.einzigerEigentuemer}</p>
					{/if}
					{#if st.festgestellt && festhalten}
						<p
							class="klein"
							class:warnung={!st.festgestellt.beschlussfaehig}
							title={st.festgestellt.satz}
						>
							Festgehalten {uhrzeit(st.festgestellt.zeitpunkt)}{#if st.festgestellt.anzahl > 1}{' '}({st
									.festgestellt.anzahl}×){/if}
						</p>
					{/if}
				</div>
			{/each}
		</div>

		<!--
			**Ein Knopf, fünf Feststellungen** (Auftraggeber, 24.08.2026: «Die
			Beschlussfähigkeit sollte einfach festgehalten werden können»).

			Eine gemeinsame Beschlussfähigkeit gibt es nicht — jede Gemeinschaft hat
			ihre eigenen Kopfstimmen, ihre eigenen Wertquoten und womöglich ihre
			eigene Reglementsregel. Festgehalten wird deshalb je Haus, in seinem
			eigenen Bestand; bedient wird es von hier, wie alles andere am Abend
			auch.
		-->
		<!--
			**Nur beim Traktandum, das sie zum Gegenstand hat** (Auftraggeber, 24.08.2026):
			«Die Festhaltung der Beschlussfähigkeit muss nur im Traktandum 1 angezeigt
			werden. Nicht in den anderen Traktanden.»

			Die Balken bleiben überall — sie sind die Voraussetzung jeder Abstimmung
			und ändern sich im Lauf des Abends. Das Festhalten ist eine Handlung, und
			eine Handlung, die zwanzigmal angeboten wird, obwohl sie einmal ansteht,
			ist Lärm. Wer nach der Pause erneut feststellen will, ruft Traktandum 1
			auf.
		-->
		{#if festhalten}
		<div class="festhalten">
			<form method="POST" action="?/festhalten" use:enhance={absenden()}>
				<button
					type="submit"
					class={schonFestgehalten ? 'leise' : 'haupt'}
					title="Hält Zahlen, Zeitpunkt und Ergebnis in jeder Gemeinschaft fest. Der Eintrag bleibt im Protokoll stehen, auch wenn nachher jemand geht."
				>
					{schonFestgehalten ? 'Erneut festhalten' : 'Beschlussfähigkeit festhalten'}
				</button>
			</form>
		</div>
		{/if}

		{#if !data.aktuelles}
			<p class="leer">
				Rufen Sie ein Traktandum auf. Was hier steht, zeigen Beamer und Telefone.
			</p>
		{:else}
			<p class="nummer">
				Traktandum {data.aktuelles.nummer}
				<!-- Der Badge mit dem Quorumstyp, wie in der Leitung des Hauses
				     (Rückfrage 03.10.2026); er steht nur, wo der Schritt in genau
				     einem Haus liegt und dort ein Erfordernis gesetzt ist. -->
				{#if data.eingriffe?.erfordernisBezeichnung}
					<span class="marke">{data.eingriffe.erfordernisBezeichnung}</span>
				{/if}
			</p>
			<h3>{data.aktuelles.titel}</h3>

			{#if data.aktuelles.antragswortlaut}
				<blockquote>{data.aktuelles.antragswortlaut}</blockquote>
			{/if}

			<!--
				**Die nötige Mehrheit steht beim Antrag** (Auftrag 03.10.2026):
				Zwischen Antragstext und Voten-Feld, wie in der Leitung des
				Hauses; der Abend zieht die Anzeige mit (dieselben Klassen,
				dieselbe Reihenfolge). Sie gilt je Haus; bei einem Schritt über
				mehrere Häuser gibt es keine gemeinsame Zahl und die Zeile bleibt
				weg.
			-->
			{#if data.eingriffe && (data.vorschau?.kopf || data.vorschau?.quoten)}
				<p class="noetig">{data.vorschau.satz}</p>
				<!--
					**Ohne das Präfix mit der Bezeichnung** (Produktentscheid
					08.10.2026): Die Marke oben trägt die Bezeichnung jetzt mit
					der Bezugsgrösse; hier stünde sie doppelt.
				-->
				<p class="klein leise">
					{data.vorschau.regelInWorten} · {data.eingriffe.erfordernisTitel}
				</p>
			{/if}

			<!--
				**Hier stand ein Absatz, der erklärte, was der Knopf tut** — dass ein
				Aufruf für alle Gemeinschaften gilt und jede für sich zählt. Weg (Auftraggeber,
				24.08.2026): «Man muss sich darauf zurechtfinden, ohne Anleitung.»

				Die Sache sagt sich selbst: Über dem Punkt steht je Gemeinschaft ein
				Balken, nach dem Schliessen je Gemeinschaft ein Ergebnis. Ein Absatz, der
				beschreibt, was daneben zu sehen ist, füllt die Seite und wird beim
				zweiten Mal überlesen.
			-->
			<!--
				**`punktart`, nicht `art`** (Auftraggeber, 24.08.2026: «ich habe bei Traktandum 1
				auf Abstimmung gedrückt und diese Meldung erhalten»).

				Hier stand `data.aktuelles.art === 'kenntnisnahme'`. Bei einem Punkt, den
				zwei Gemeinschaften führen, steht in `art` aber `'sammelpunkt'` — der
				Vergleich traf nie zu, und die Sitzungsleitung bekam «Abstimmung
				eröffnen» angeboten für ein Traktandum, über das nicht abgestimmt wird.
				Der Server wies es zu Recht ab; im Saal las sich das wie ein Defekt.
			-->
			<!--
				**Das Votum, wo gesprochen wird** (Auftraggeber, 24.08.2026: «Auch kann ich keine
				Voten hinschreiben»). Derselbe Baustein wie in der Leitung eines Hauses;
				geschrieben wird in das Protokoll der Gemeinschaft, deren Punkt läuft.
			-->
			<!--
				**Die Zulässigkeitsprüfung des Folgeantrags** (FR-60) — derselbe
				Baustein wie im Haus. Sie steht beim laufenden Punkt und nicht in der
				Liste: Am Abend führt die Liste die Punkte des Verbunds, ein
				Folgeantrag aber liegt in genau einem Haus, und nur dort ist die Frage
				zu stellen. Zugelassen wird sie je Gemeinschaft.

				**Sichtbar deaktiviert statt unsichtbar** (FR-62, Code-Review
				25.09.2026). Die erste Fassung zeigte den Baustein immer, wenn der
				Folgeantrag lief, und übergab die Verfügbarkeit als `moeglich`; ohne
				KI blieb damit nichts stehen, und der Begründungssatz im `else if`
				war unerreichbar, weil dieselbe Bedingung schon oben zutraf. Jetzt
				gilt das Muster der Hausleitung: der Knopf nur, wenn die Prüfung
				geht, sonst der Grund.

				**Und bei laufender Abstimmung nur noch die Antwort** (Code-Review
				25.09.2026). Dieser Block steht ausserhalb der Kette, die den
				Abstimmungszustand führt; ein Modellaufruf mitten im Zählen schöbe
				die Stimmerfassung nach unten. Der Knopf tritt darum zurück,
				solange im Haus des Schrittes irgendeine Abstimmung offen ist;
				eine schon geholte Antwort bleibt stehen. Dieselbe Regel wie in der
				Hausleitung (`abstimmungLaeuft`, dort über `data.offen`, also jede
				offene Abstimmung der Versammlung).

				Bis zur Nachprüfung vom 25.09.2026 fragte die Bedingung nur
				`offenJetzt`, also die Traktanden des laufenden Schrittes. Wer das
				Budget in A eröffnete und danach den Folgeantrag aufrief, sah
				«Zulässigkeit prüfen», während in A gezählt wurde.
			-->
			{#if data.eingriffe?.istFolgeantrag && data.schritthaus && data.aktuelles.traktandumId}
				{#if data.ki.verfuegbar && data.ki.anzeigen}
					<Antragspruefung
						traktandumId={data.aktuelles.traktandumId}
						moeglich={!data.offene.some((o) => o.meetingId === data.schritthaus?.meetingId)}
						pruefung={form?.antragspruefung ?? null}
						mitVersammlungId={data.schritthaus.meetingId}
					/>
				{:else if data.ki.anzeigen}
					<p class="klein">{data.ki.grund}</p>
				{/if}
			{/if}

			<!--
				**Wer bei Nutzniessung stimmt** (FR-22) — steht beim aufgerufenen Punkt,
				weil sich die Frage dort stellt, und mit Begründung, damit eine
				Bestreitung im Saal sofort zu klären ist. Am Abend fehlte sie ganz.
			-->
			{#if data.nutzniessungen.length > 0}
				<ul class="nutzniessung">
					{#each data.nutzniessungen as n (n.einheit)}
						<li class:vonHand={n.vonHand}>
							<strong>{n.einheit}</strong> ({n.partei}): {n.satz.replaceAll('**', '')}
						</li>
					{/each}
				</ul>
			{/if}

			{#if data.schritthaus && data.aktuelles.traktandumId}
				{#key schrittSchluessel}
					<Votum
						versammlungId={data.schritthaus.meetingId}
						traktandumId={data.aktuelles.traktandumId}
						wert={data.notiz}
						mitVersammlung
					/>
				{/key}
			{/if}

			<!--
				**«Was jetzt geht» — auch am Abend** (Auftraggeber, 24.08.2026: «Von der
				Funktionalität her muss es gleich sein wie bei der Einzelversammlung»).
				Ausstand, Betroffene, Gegenantrag, Zurückziehen, nötige Mehrheit und Rückkommen —
				derselbe Baustein, dieselben Regeln aus dem Kern. Sie wirken im Haus des
				laufenden Schrittes; bei einem Punkt über alle Häuser gibt es sie nicht,
				denn dort wird nicht abgestimmt.
			-->
			{#if data.eingriffe && data.schritthaus && data.aktuelles.traktandumId}
				{#key schrittSchluessel}
					<Eingriffe
						traktandumId={data.aktuelles.traktandumId}
						lage={{
							art: data.eingriffe.art,
							abgestimmt: data.eingriffe.abgestimmt,
							durchgangOffen: offenJetzt.length > 0,
							zurueckgezogen: data.eingriffe.zurueckgezogen,
							rueckkommenLaeuft: data.eingriffe.rueckkommenLaeuft,
							rueckkommenOffen: data.eingriffe.rueckkommenOffen,
							grundantragEntschieden: data.eingriffe.grundantragEntschieden,
							beschlussAngenommen: data.eingriffe.sacheAngenommen,
							hatErfordernis: data.eingriffe.hatErfordernis,
							spontan: data.eingriffe.spontan,
							/* Das Veto braucht Betroffene im Ausstand (26.09.2026). */
							kenntVeto: data.eingriffe.vetoStand.length > 0
						}}
						parteien={data.eingriffe.parteien}
						vertreterOhnePartei={data.eingriffe.vertreterOhnePartei}
						ausstand={data.eingriffe.ausstand}
						betroffene={data.eingriffe.betroffene}
						betroffenenform={data.eingriffe.betroffenenlage.form}
						kenntBetroffene={data.eingriffe.betroffenenlage.kennt}
						beklagtenumfangWirkt={data.eingriffe.betroffenenlage.beklagtenumfang}
						angehoerigenhinweis={data.eingriffe.angehoerigenhinweis}
						angehoerigenlesartHinweis={data.eingriffe.angehoerigenlesartHinweis}
						milderungshinweis={data.eingriffe.milderungshinweis}
						folgeantragHinweis={data.eingriffe.folgeantragHinweis}
						betroffenenabweichung={data.eingriffe.betroffenenabweichung}
						ausstandAmGrundantrag={data.eingriffe.ausstandAmGrundantrag}
						vetoStand={data.eingriffe.vetoStand}
						erfordernisTitel={data.eingriffe.erfordernisTitel}
						erfordernisPfad="/versammlungen/{data.schritthaus.meetingId}/traktanden/{data.aktuelles
							.traktandumId}/erfordernis?zurueck=/tage/{data.tag.id}/leitung"
						rueckzugHindernis={data.eingriffe.rueckzugHindernis}
						grundantraege={data.eingriffe.grundantraege}
						erfordernisse={data.erfordernisse}
						angenommen={data.eingriffe.sacheAngenommen}
						mitVersammlungId={data.schritthaus.meetingId}
					/>
				{/key}
			{/if}

			<!--
				**Der zurückgezogene Antrag und der Weg zurück** (24.08.2026). Im Haus
				gibt es beides seit dem 21.08.; am Abend liess sich zwar zurückziehen
				(über «Was jetzt geht»), aber nicht zurücknehmen — eine Einbahnstrasse,
				die im Saal entsteht, wenn jemand seinen Antrag doch behandelt haben
				will.

				Ohne Rückfrage: Der Schritt ist umkehrbar, und es entsteht dabei nichts,
				das jemandem gehört.
			-->
			{#if data.eingriffe?.zurueckgezogen && data.schritthaus && data.aktuelles.traktandumId}
				<div class="zurueckgezogen">
					<p class="warnung">
						Der Antrag ist zurückgezogen; darüber wird nicht abgestimmt.
						<!--
							**Hier fehlt der Weg für ein nicht aufgerufenes Traktandum**
							(Stand 06.09.2026). Die Rücknahme steht nur am laufenden
							Schritt; wer bei Punkt 8 zurückzieht und danach Punkt 9 aufruft,
							kommt nicht mehr zu 8 zurück. Auf der Sitzungsleitungssicht einer
							einzelnen Gemeinschaft ist der Weg seit heute in der Liste
							(Bedienbarkeitsprüfung 05.09.2026, zweiter der schweren Befunde);
							hier fehlt er, weil `data.liste` den Rückzug nicht mitführt und
							kein Drehbuch diese Seite fährt. Ein Knopf ohne Nachweis wäre in
							diesem Repo keine Lieferung.
						-->
						{#if data.eingriffe.rueckzug?.grund}
							Grund: {data.eingriffe.rueckzug.grund}
						{/if}
					</p>
					<form method="POST" action="?/rueckzugZurueck" use:enhance={absenden()}>
						<input type="hidden" name="versammlung" value={data.schritthaus.meetingId} />
						<input type="hidden" name="traktandum" value={data.aktuelles.traktandumId} />
						<button type="submit" class="haupt" data-fokus="rueckzugZurueck:schritt">
							Rückzug zurücknehmen
						</button>
					</form>
				</div>
			{:else if data.aktuelles.punktart === 'kenntnisnahme'}
				<p class="klein">
					Kenntnisnahme — hier wird nicht abgestimmt. Wortmeldungen und Vorbehalte gehören ins
					Protokoll.
				</p>
			{:else if offenJetzt.length > 0}
				<div class="offen">
					<h4>Abstimmung läuft</h4>
					<!--
						**Der Satz stimmte nicht mehr** (24.08.2026). Er sagte, die Stimmen
						würden «in der Leitung der jeweiligen Gemeinschaft erfasst» — richtig,
						solange es hier keine Erfassung gab. Seit die Bausteine geteilt sind,
						wird hier erfasst; ein Satz, der auf einen anderen Weg verweist,
						schickte die Sitzungsleitung mitten in der Abstimmung fort.
					-->
					<p>in {offenJetzt.map((o) => o.gemeinschaft).join(', ')}</p>
					<!--
						**Für eine Partei stimmen und alles von Hand** (Auftraggeber, 24.08.2026):
						«Mir fehlt, dass der Versammlungsleiter für die anderen abstimmen darf
						— wenn man bspw. einen Auftrag erhalten hat von einem Eigentümer oder
						ein Eigentümer Probleme mit der Technik hat und man schnell reagieren
						muss.» Derselbe Baustein wie in der Leitung eines Hauses.
					-->
					{#if data.erfassung && data.schritthaus}
						<!--
							`offen`: In der einfachen Betriebsart ist die Tabelle der Normalweg
							und steht auf; in der geführten bleibt sie zu (Auftraggeber, 24.08.2026:
							«Dass der Sitzungsleiter für die Eigentümer abstimmen darf, ist per
							Default auszublenden»). Bis zum 25.08.2026 gab niemand den Wert
							mit — die Tabelle war auch dort zugeklappt, wo sie die Arbeit ist.
						-->
						{#key schrittSchluessel}
							<Stimmerfassung
								erfassung={data.erfassung}
								betriebsart={data.betriebsart}
								sperren={data.erfassungssperren}
								versammlungId={data.schritthaus.meetingId}
								summenhindernis={data.summenhindernis}
								summenvermerk={data.summenvermerk}
								handzaehlung={data.handzaehlung}
								einspracheZaehlung={data.einspracheZaehlung}
								offen
							/>
						{/key}
					{/if}

					<form method="POST" action="?/schliessen" use:enhance={absenden()}>
						<input type="hidden" name="geschaeft" value={data.aktuelles.geschaeftId} />
						<!--
							**Der Bezug muss mit** (Auftraggeber, 24.08.2026: «über jedes Subtraktandum
							wird einzeln abgestimmt»). Ohne ihn schlösse der Klick in allen
							Häusern des Punktes — auch in denen, die noch abstimmen.
						-->
						<input type="hidden" name="traktandum" value={data.aktuelles.traktandumId ?? ''} />
						<button type="submit" class="haupt" data-fokus="abstimmung:schliessen">
							Abstimmung schliessen
						</button>
					</form>
					<AbstimmungAbbrechen
						geschaeftId={data.aktuelles.geschaeftId}
						traktandumId={data.aktuelles.traktandumId ?? null}
					/>
				</div>
			{:else if data.rueckkommen && !data.rueckkommen.abstimmbar}
				<!--
					**Kein Knopf, der in eine Absage führt** — wie im Haus seit dem
					20.08.2026. Über den Punkt ist abgestimmt; ein zweiter Durchgang
					braucht einen Beschluss der Versammlung. Am Abend stand hier bis zum
					24.08.2026 trotzdem «Abstimmung eröffnen», und jeder Klick endete in
					derselben roten Absage — während der gestellte Rückkommensantrag als
					Traktandum am Ende der Liste wartete, wo ihn niemand suchte.

					Der Satz kommt aus dem Kern und ist derselbe wie im Haus; wo die
					Anwendung führen kann, führt sie.
				-->
				<div class="rueckkommensweg">
					<p class="meldung warnung">{data.rueckkommen.satz}</p>
					{#if data.folgeantragHinweis}
						<p class="meldung warnung">{data.folgeantragHinweis}</p>
					{/if}
					{#if data.rueckkommen.weg === 'antrag_aufrufen' && data.rueckkommen.antragId}
						<form method="POST" action="?/aufrufen" use:enhance={absenden()}>
							<input type="hidden" name="geschaeft" value={data.aktuelles.geschaeftId} />
							<input type="hidden" name="traktandum" value={data.rueckkommen.antragId} />
							<button type="submit" class="haupt">
								Rückkommensantrag {data.rueckkommen.antragNummer} aufrufen
							</button>
						</form>
					{/if}
				</div>
			{:else if alleEntschieden && !data.rueckkommen?.abstimmbar}
				<!--
					**Ausser nach angenommenem Rückkommen** (25.09.2026). Dann zählt der
					alte Durchgang bis zum Schliessen des neuen weiter als entschieden
					(`holeEntschiedeneAmAbend`), und ohne diese Ausnahme stand hier der
					Satz «ein zweiter Durchgang braucht einen Beschluss», während der
					Beschluss vorlag. Ob er vorliegt, sagt `data.rueckkommen`, dieselbe
					Rechnung wie im Haus; es steht nur beim Schritt in einem Haus, und
					nur dort gibt es ein Rückkommen.
				-->
				<!--
					**Überall entschieden — dann kein Knopf** (25.08.2026). Siehe
					`punktEntschieden`: Bei einem Sammelpunkt über mehrere Gemeinschaften
					gibt es kein `rueckkommen`, und hier stand weiter «Abstimmung
					eröffnen».

					Ein zweiter Durchgang ist nicht unmöglich, aber er braucht einen
					Beschluss der Versammlung — das Rückkommen, gestellt in der Leitung
					des Hauses. Der Satz nennt den Weg, statt den Knopf stehen zu lassen.
				-->
				<p class="meldung warnung">
					Über diesen Punkt ist in {punktEntschieden.length === 1
						? 'der Gemeinschaft'
						: `allen ${punktEntschieden.length} Gemeinschaften`} entschieden. Ein zweiter
					Durchgang braucht einen Beschluss der Versammlung — den Rückkommensantrag stellen
					Sie in der Leitung der betroffenen Gemeinschaft.
				</p>
			{:else}
				<!--
					**Hier kommt nur noch ein Schritt in höchstens einem Haus an** (seit
					25.09.2026, `laeuftGemeinsam`). Ein Schritt über mehrere Häuser ist
					eine Kenntnisnahme und endet oben. Hier standen zwei Hinweise für
					einen Abstimmungsschritt über mehrere Häuser: «in n Gemeinschaften
					schon entschieden» und «in einer Gemeinschaft eine Kenntnisnahme».
					Beide waren danach nie mehr erreichbar und sind entfernt.
				-->

				<!--
					**Hier nur noch der Hinweis ohne Zahlen** (Auftrag 03.10.2026,
					wie in der Leitung des Hauses): Die Zahl und die Regel stehen
					oben beim Antragstext. An dieser Stelle bleibt der Fall ohne
					Zahl samt dem Grund, warum sich nicht eröffnen lässt; er
					gehört zum Knopf daneben. Kopiertes Markup, keine geteilte
					Komponente: Wer eine der beiden Stellen ändert, zieht die
					andere nach.
				-->
				{#if !(data.vorschau?.kopf || data.vorschau?.quoten)}
					{#if data.eingriffe}
						<p class="klein">
							Erfordernis: <strong>{data.eingriffe.erfordernisTitel || 'noch nicht gesetzt'}</strong>
						</p>
					{/if}
					{#if data.vorschau?.sperrgrund}
						<p class="meldung warnung">{data.vorschau.sperrgrund}</p>
					{:else if data.vorschau}
						<p class="klein leise">{data.vorschau.satz}</p>
					{/if}
				{/if}
				{#if data.vorschau?.ausstandshinweis}
					<p class="klein saalhinweis">{data.vorschau.ausstandshinweis}</p>
				{/if}
				<!-- Warnungen vor dem Eröffnen (Block 3, Ä-11, Ä-15, Ä-20), wie in der
				     Leitung des Hauses. Kopiertes Markup wie die Zeilen darüber. -->
				{#if data.vorschau?.erreichbarkeitshinweis && data.erreichbarkeitZeigen}
					<p class="meldung warnung">{data.vorschau.erreichbarkeitshinweis}</p>
				{/if}
				{#each data.mehrhinweise as h (h)}
					<p class="meldung warnung">{h}</p>
				{/each}
				{#if data.verwaltungsangabe && data.schritthaus}
					<!-- Entscheid 0045, Punkt 11: die Angabe der Leitung am Folgeantrag,
					     wie in der Leitung des Hauses (Begründung dort), im Haus des
					     laufenden Schrittes. -->
					{#each data.verwaltungsangabe.angebote as a (a.grund)}
						<p class="klein saalhinweis">{a.satz}</p>
						<form method="POST" action="?/verwaltungsangabe" use:enhance={absenden()}>
							<input type="hidden" name="versammlung" value={data.schritthaus.meetingId} />
							<input type="hidden" name="traktandum" value={data.aktuelles.traktandumId ?? ''} />
							<input type="hidden" name="grund" value={a.grund} />
							<Rueckfrage
								beschriftung={a.beschriftung}
								ton="neutral"
								gewicht="leise"
								marke="verwaltungsangabe:{a.grund}"
								frage={a.frage}
								folge={a.folge}
							/>
						</form>
					{/each}
					{#if data.verwaltungsangabe.gesetzt}
						<form method="POST" action="?/verwaltungsangabeZurueck" use:enhance={absenden()}>
							<input type="hidden" name="versammlung" value={data.schritthaus.meetingId} />
							<input type="hidden" name="traktandum" value={data.aktuelles.traktandumId ?? ''} />
							<button type="submit" class="leise" data-fokus="verwaltungsangabe:zurueck">
								Angabe zurücknehmen
							</button>
						</form>
					{/if}
				{/if}
				{#if data.eingriffe && data.eingriffe.betroffenenlage.form && data.eingriffe.betroffene.length === 0}
					<!--
						**Das Erfordernis verlangt Zustimmung, eingetragen ist
						niemand** (Praxisfund 03.10.2026): Die Sitzungsleitung soll
						das beim Schritt sehen und nicht erst im Notweg oder beim
						Auszählen. `saalhinweis` wie die Zeilen daneben, damit die
						Abendseite keine eigene Gestaltung braucht.
					-->
					<p class="klein saalhinweis">
						Dieses Erfordernis verlangt die Zustimmung der unmittelbar Betroffenen;
						eingetragen ist niemand. Erfassen Sie sie bei «Betroffene» in der Leitung
						des Hauses.
						{#if data.eingriffe.betroffenenlage.form === 'im_saal_oder_vorab'}
							Die Zustimmung kann vorab schriftlich vermerkt oder im Saal erteilt werden.
						{:else}
							Die Zustimmung folgt mit der öffentlichen Abänderungsurkunde.
						{/if}
					</p>
				{/if}
				{#if data.rueckkommen?.satz}
					<!-- Der zweite Durchgang nach angenommenem Rückkommen, derselbe Satz wie
					     in der Leitung des Hauses: Er ersetzt einen gefassten Beschluss, und
					     das gehört vor das Eröffnen. `saalhinweis` statt `meldung gut` wie
					     dort: `.meldung` ist auf dieser Seite nicht gestaltet. -->
					<p class="klein saalhinweis">{data.rueckkommen.satz}</p>
					{#if data.folgeantragHinweis}
						<p class="klein saalhinweis">{data.folgeantragHinweis}</p>
					{/if}
				{/if}
				<!-- Kein Knopf, der in eine Absage führt; Begründung in der Leitung des Hauses. -->
				{#if data.aktuellOhneMehr && data.schritthaus}
					<!-- Ohne Mehrheitserfordernis der Weg dorthin statt des Knopfs (Befund N-1,
					     Laienprüfung Runde 3); Satz und Verweis wie unter «Einzeln führen». -->
					<p class="meldung warnung">
						Für diesen Antrag ist noch kein Mehrheitserfordernis gesetzt; ohne eines lässt sich
						nicht abstimmen.
					</p>
					<a
						class="leise"
						href="/versammlungen/{data.schritthaus.meetingId}/traktanden/{data.aktuelles
							.traktandumId}/erfordernis?zurueck=/tage/{data.tag.id}/leitung"
					>
						Erfordernis setzen
					</a>
				{:else if !data.vorschau?.sperrgrund}
					<form method="POST" action="?/oeffnen" use:enhance={absenden()}>
						<input type="hidden" name="geschaeft" value={data.aktuelles.geschaeftId} />
						<input type="hidden" name="traktandum" value={data.aktuelles.traktandumId ?? ''} />
						<label class="haken">
							<input type="checkbox" name="geheim" value="ja" />
							Geheim abstimmen: Die Anzeigen nennen nur «erreicht» oder «nicht erreicht».
						</label>
						<label class="haken">
							<input type="checkbox" name="geheimBeschlossen" value="ja" />
							{GEHEIM_BESCHLUSS_HAKEN}
						</label>
						<label class="haken">
							<input type="checkbox" name="geheimNachReglement" value="ja" />
							{GEHEIM_REGLEMENT_HAKEN}
						</label>
						<!-- Ä-38, Punkt 1, wie in der Leitung des Hauses. -->
						<p class="klein">{GEHEIM_HINWEIS_LEITUNG}</p>
						<!-- Die Zuordnung, die der Klick bestätigt (Ä-05, M4); Begründung in
						     der Leitung des Hauses beim gleichnamigen Block. -->
						{#if data.zuordnung}
							<p class="klein" data-zuordnung>
								{zuordnungssatz(data.zuordnung, 'Abstimmung eröffnen')}
							</p>
							<input type="hidden" name="zuordnung" value={data.zuordnung.marke} />
						{/if}
						<button type="submit" class="haupt" data-fokus="abstimmung:eroeffnen">
							Abstimmung eröffnen
						</button>
					</form>
				{/if}
			{/if}
		{/if}

		<!--
			**Das Ergebnis, sobald geschlossen ist** (24.08.2026). Vorher verschwand
			die Abstimmung, und was herauskam, stand nur in der Leitung des Hauses —
			verkündet wird aber genau in diesem Moment, hier vorne.

			Je Gemeinschaft eines: dieselbe Frage, mehrere Beschlüsse.
		-->
		{#if data.ergebnisse.length > 0}
			<div class="ergebnisse">
				<!--
					**Der Schlüssel trägt den Durchgang, nicht nur das Haus**
					(28.08.2026). `Ergebnisnachgang` führt zwei ungeführte Felder — wer
					den Stichentscheid gefällt hat und mit welcher Begründung — und ein
					aufgeklapptes `<details>`. Über `e.meetingId` allein behielte Svelte
					die Komponente beim Wechsel auf einen neuen Durchgang desselben
					Hauses, während das verborgene `durchgang`-Feld darin schon auf den
					neuen zeigt: Eine getippte Begründung landete am falschen Beschluss.
					Solange die Seite bei jedem Schritt neu lud, fiel das nicht auf.
				-->
				{#each data.ergebnisse as e (`${e.meetingId}:${e.durchgangId}`)}
					<!--
						**Der offene Stichentscheid ist keine Ablehnung** (05.09.2026, aus
						dem Code-Review). Der Kasten war rot, während der Text darin
						richtig sagte, dass ein Entscheid aussteht.
					-->
					<article
						class:angenommen={e.angenommen && !e.stichentscheidOffen}
						class:abgelehnt={e.angenommen === false && !e.stichentscheidOffen && !e.keinBeschluss}
					>
						<h4>
							{e.gemeinschaft}
							{#if e.durchgang > 1}<span class="leise">{e.durchgang}. Durchgang</span>{/if}
						</h4>
						{#if e.stichentscheidOffen}
							<p class="warnung">
								{#if e.stichentscheidArt === 'verwalter' || e.stichentscheidArt === 'vorsitz'}
									<!-- Mit Zahlen und Zählweise wie in der Leitung des Hauses (Probe Wertquotenmehr, B5). -->
									Stimmengleichheit{#if e.gleichstand}{' '}({e.gleichstand}){/if}: Nach dem Reglement entscheidet {e.stichentscheidArt ===
									'vorsitz'
										? 'die Person im Vorsitz'
										: 'der Verwalter'}. Tragen Sie
									unten den Entscheid ein — Annahme oder Ablehnung, mit dem Namen der
									entscheidenden Person.
								{:else}
									Stimmengleichheit: Die Wertquoten entscheiden, und die lassen sich aus der
									Handzählung nicht ablesen. Setzen Sie im Haus eine Neuabstimmung an.
								{/if}
							</p>
						{:else}
							<p>{e.satz ?? (e.angenommen ? 'angenommen' : 'abgelehnt')}</p>
							{#if e.nachRueckkommen}
								<!-- Reste vom 30.09.2026, Punkt 1. -->
								<p class="meldung warnung">{e.nachRueckkommen}</p>
							{/if}
							<!-- Nach der anderen Lesart des Hauses (Migrationen 169 und 170). -->
							<!-- Nach der Lesart geschlüsselt, nicht nach dem Satz: Zwei gleiche Sätze
							     brächen die Seite (Codeprüfung Block 2, Teil 2, H1). -->
							{#each e.andereLesarten as l (l.kennung)}
								<p class="meldung warnung">{l.satz}</p>
							{/each}
							<!-- Der Zweig gilt nur ohne offenen Stichentscheid: Der steht
							     bereits im Zweig darüber. -->
						{/if}
						<!--
							**Der Entscheid gehört hierher, nicht in die Hausansicht**
							(24.08.2026). Hier stand: «Der Stichentscheid steht in der Leitung
							dieser Gemeinschaft aus» — ein Verweis auf eine andere Seite, im
							Augenblick, in dem der Saal auf das Ergebnis wartet. Und die
							Hausansicht führt die Liste des Abends nicht; wer dorthin wechselt,
							verliert die Stelle.
						-->
						<Ergebnisnachgang
							durchgangId={e.durchgangId}
							stichentscheidOffen={e.stichentscheidOffen}
							stichentscheidArt={e.stichentscheidArt}
							stichentscheid={e.stichentscheid}
							beschlusstext={e.beschlusstext}
							mitVersammlungId={e.meetingId}
							ohneNeuabstimmung={!!e.offenNachRueckkommen}
						/>
						{#if e.offenNachRueckkommen}
							<!-- Reste vom 30.09.2026, Punkt 3; Codeprüfung H1. -->
							<Ergebnisnachgang
								durchgangId={e.offenNachRueckkommen}
								stichentscheidOffen={true}
								mitVersammlungId={e.meetingId}
								ohneBeschlusstext={true}
							/>
						{/if}
					</article>
				{/each}
			</div>
		{/if}

		<h3>Es tagen mit</h3>
		<ul class="haeuser">
			{#each data.haeuser as h (h.id)}
				<li><a href="/versammlungen/{h.id}/leitung">{h.name}</a></li>
			{/each}
		</ul>
		<!--
			**Wo der Beschluss von Hand liegt** (Produktentscheid 03.10.2026:
			«Ja, kurzer Verweis»). Die Hausverweise führen auf die Leitungsseiten
			der Gemeinschaften; dass dort der Beschluss von Hand liegt, stand
			bei ihnen nicht. Ein Satz genügt, kein zweiter Knopf: Der Weg ist die
			Leitung des Hauses, und die verlinkt diese Liste.
		-->
		<p class="klein">
			Der Beschluss von Hand liegt bei jeder Gemeinschaft: Er gehört in ihre Leitung, auch am
			Abend.
		</p>
	</section>
</div>

<!--
	**Vertagen, gesammelt** (Auftraggeber, 25.08.2026): «Wenn nur eine von fünf einheiten
	beschlussfähig sind, wird die Sitzung mit der beschlussfähigen Gemeinschaft
	durchgeführt. Die anderen brauchen einen neuen Termin, frühestens in 10 Tage
	später. Wobei auch die Gemeinschaft entscheiden kann, die Sitzung zu
	verschieben.»

	**Unten, hinter einer Linie, zugeklappt** — wie im Haus und wie alles, was
	sich nicht zurücknehmen lässt. Die vertagten Versammlungen werden
	geschlossen; ein Knopf, den man im Saal aus Versehen trifft, kostet den
	Abend.

	**Vorgehakt ist, wer nicht beschlussfähig ist.** Das ist der Fall, um den es
	geht, und er steht neben jedem Namen. Wer anders entscheidet, klickt — die
	Auswahl ist sichtbar, nicht vorbestimmt.
-->
{#if vertagbar.length > 0}
	<details class="vertagen">
		<summary>Vertagen und Folgeversammlungen ansetzen</summary>
		<form method="POST" action="?/vertagen" use:enhance={absenden()}>
			<p class="klein">
				Die gewählten Versammlungen werden geschlossen; was beschlossen ist, bleibt gültig.
				Die Folgeversammlungen entstehen sofort daneben, als Entwurf, mit den unerledigten
				Geschäften und als eigener gemeinsamer Abend. Die übrigen Gemeinschaften tagen
				weiter.
			</p>
			<!-- C3, F4c: eine neue erste statt einer zweiten (`folgestufeNachVertagung`). -->
			<p class="klein">
				War eine Gemeinschaft heute schon beschlussfähig, legt Votum für sie nach der Vorgabe
				keine zweite, sondern eine neue erste Versammlung an. Für deren Einladung gilt die Frist einer ersten.
				Prüfen Sie vor dem Versand, ob der gemeinsame Termin sie einhält und frühestens am elften
				Tag nach heute liegt.
			</p>
			<!-- L16 (Migration 194; Codeprüfung M2): je Haus nach dessen Einstellung. -->
			<p class="klein">
				Ist eine solche Gemeinschaft jetzt nicht mehr beschlussfähig und hat sie bei den Lesarten
				«Zweite Versammlung» eingestellt, legt Votum für sie eine zweite an. Dort genügt ein
				Drittel; ob das genügt, wenn sie schon beschlussfähig war, regeln Gesetz und Gerichte
				nicht ausdrücklich. Sagen Sie das der Versammlung vor dem Vertagen, und bitten Sie, selbst
				zu kommen oder eine Vollmacht zu geben. Die Meldung danach nennt je Gemeinschaft, was
				entstanden ist.
			</p>

			<fieldset>
				<legend>Wer wird vertagt</legend>
				{#each vertagbar as h (h.meetingId)}
					<label class="haus">
						<input
							type="checkbox"
							name="versammlung"
							value={h.meetingId}
							{...angekreuzt(!h.beschlussfaehig?.erfuellt)}
						/>
						<span>{h.gemeinschaft}</span>
						<span class="klein" class:warnung={!h.beschlussfaehig?.erfuellt}>
							{h.beschlussfaehig?.erfuellt ? 'beschlussfähig' : 'nicht beschlussfähig'}
						</span>
					</label>
				{/each}
			</fieldset>

			<div class="felder">
				<label>
					Warum vertagt wird
					<select name="grund" required>
						<option value="">— wählen —</option>
						<option value="Nicht beschlussfähig (ZGB Art. 712p Abs. 2).">
							Nicht beschlussfähig
						</option>
						<option value="Die Versammlung hat die Vertagung beschlossen.">
							Die Versammlung hat es beschlossen
						</option>
					</select>
					<span class="hilfe">
						Zwei verschiedene Sachverhalte; der Grund steht im Protokoll jeder Gemeinschaft.
						Ob danach eine zweite Versammlung nach Abs. 3 oder eine neue erste entsteht,
						richtet sich je Gemeinschaft danach, ob sie heute beschlussfähig war. Ist sie es
						nicht mehr, zählt auch, wie sie die Lesart L16 eingestellt hat.
					</span>
				</label>

				<label>
					Neuer Termin
					<input type="date" name="datum" {...anfangswert(data.vertagungsvorschlag)} required />
					<span class="hilfe">
						Frühestens am {datumLang(data.vertagungsvorschlag)}. {data.fristlauf} Uhrzeit und Ort
						kommen von hier und lassen sich danach ändern.
					</span>
				</label>
			</div>

			<!--
				**Keine Fokusmarke.** Der Knopf sitzt unten in einem `<details>`;
				ein genauer Treffer nach dem Absenden holte ihn ins Bild, und die
				Seite rollte zu einer nicht rücknehmbaren Handlung hin — genau das
				Springen, das dieser Baustein abschaffen soll. Ohne Marke bleibt
				der Fokus auf `<body>` (28.08.2026 im Sicherheitsdurchgang).
			-->
			<button type="submit">Vertagen</button>
		</form>
	</details>
{/if}

<style>
	.papierweg {
		margin: -0.4rem 0 0.8rem;
	}

	/*
	 * **Vertagen steht leise unten, hinter einer Linie** — dieselbe Bauart wie im
	 * Haus (`versammlungen/[id]/anwesenheit`) und dieselbe Regel wie beim
	 * Löschen: Was sich nicht zurücknehmen lässt, sucht man nicht, man findet es,
	 * wenn man es braucht.
	 */
	/* Der Stand statt des Knopfes: leise, aber lesbar — er ersetzt eine Handlung. */
	.fertig {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-variant: all-small-caps;
		letter-spacing: 0.04em;
	}

	.vertagen {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--linie);
	}

	.vertagen summary {
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	/* Fliesstext bleibt auf Lesebreite — die Seite ist 1440 px breit. */
	.vertagen p {
		max-width: var(--lesebreite);
	}

	.vertagen form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 0.75rem;
		max-width: 58rem;
	}

	.vertagen fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.vertagen legend {
		font-size: 0.9rem;
		font-weight: 550;
		padding: 0 0.35rem;
	}

	/* Die Zeile ist die Antippfläche, nicht bloss das Kästchen. */
	.vertagen .haus {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-height: var(--ziel-min);
		cursor: pointer;
	}

	.vertagen .haus span:first-of-type {
		font-weight: 550;
	}

	.vertagen .warnung {
		color: var(--warnung);
	}

	.vertagen button {
		align-self: start;
	}

	/*
	 * **Die Nutzniessung** — dieselben Masse wie in der Leitung eines Hauses.
	 * Eine von Hand zu entscheidende Zeile trägt eine Warnkante: Dort entscheidet
	 * nicht die Anwendung, sondern die Sitzungsleitung.
	 */
	.nutzniessung {
		list-style: none;
		margin: 0.4rem 0;
		padding: 0;
	}

	.nutzniessung li {
		font-size: 0.9rem;
		color: var(--text-leise);
		border-left: 2px solid var(--linie);
		padding-left: 0.6rem;
		margin: 0.2rem 0;
	}

	.nutzniessung li.vonHand {
		border-left-color: var(--warnung);
		color: var(--text);
	}

	/* Der Weg, wenn nicht abgestimmt werden kann — Satz und Knopf untereinander. */
	.rueckkommensweg {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		margin: 0.5rem 0;
	}

	.rueckkommensweg p {
		margin: 0;
	}

	/* Der zurückgezogene Antrag und der Weg zurück. */
	.zurueckgezogen {
		border-left: 3px solid var(--warnung);
		padding: 0.5rem 0 0.5rem 0.75rem;
		margin: 0.5rem 0;
	}

	.zurueckgezogen p {
		margin: 0 0 0.5rem;
	}

	/* Die Feststellung unter den Balken — abgesetzt, weil sie ein Befund ist
	   und keine laufende Rechnung. */
	.festhalten {
		margin: 0.25rem 0 1rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--linie);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 0.75rem;
	}

	.gauge p.warnung {
		color: var(--warnung);
	}

	/*
	 * Dieselben Klassennamen und Masse wie in der Leitung einer einzelnen
	 * Versammlung — nicht aus Bequemlichkeit, sondern weil beide gleich aussehen
	 * sollen. Wer eine der beiden Seiten ändert, sieht hier, dass es die andere
	 * auch gibt.
	 */
	.saalkopf {
		margin-bottom: 1rem;
	}

	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 0.75rem;
	}

	h1 {
		margin: 0;
	}

	.marke {
		font-size: 0.875rem;
		color: var(--text-leise);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.1rem 0.5rem;
	}

	.marke.laeuft {
		color: var(--akzent);
		border-color: var(--akzent);
	}

	.wo {
		color: var(--text-leise);
		margin: 0.25rem 0 0;
	}

	.hin {
		margin: 0.25rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.unstimmig {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		margin: 0.35rem 0 0.75rem;
	}

	.unstimmig p {
		margin: 0;
		flex: 1 1 20rem;
		min-width: 0;
	}

	.unstimmig button {
		min-height: var(--ziel-min);
		flex: none;
	}

	.raster {
		display: grid;
		gap: 1.5rem;
	}

	@media (min-width: 60rem) {
		.raster {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		}
	}

	/*
	 * Rahmen um beide Abschnitte — im Haus tragen «Ablauf» und «Aktuelles
	 * Geschäft» je einen Kasten, und ohne sie zerfliesst die Seite.
	 */
	section {
		min-width: 0;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
	}

	.beamerplatz {
		float: right;
	}

	/*
	 * Das Ergebnis je Gemeinschaft — grün angenommen, rot abgelehnt, wie an der
	 * Wand und im Protokoll. Der Streifen links trägt das Urteil; das Wort steht
	 * daneben, damit es auch ohne Farbunterscheidung lesbar bleibt.
	 */
	.ergebnisse {
		display: grid;
		gap: 0.5rem;
		margin: 0.75rem 0;
	}

	.ergebnisse article {
		border: 1px solid var(--linie);
		border-left: 4px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.5rem 0.75rem;
	}

	.ergebnisse article.angenommen {
		border-left-color: var(--akzent);
	}

	.ergebnisse article.abgelehnt {
		border-left-color: var(--fehler);
	}

	.ergebnisse h4 {
		margin: 0 0 0.2rem;
		font-size: 0.95rem;
	}

	.ergebnisse p {
		margin: 0;
		font-size: 0.9rem;
	}

	.ergebnisse p.warnung {
		color: var(--warnung);
	}

	/* Der Satz statt «Abstimmen» unter «Einzeln führen»: in der Zeile, nicht darüber. */
	.alle .einzeln p.sperre {
		margin: 0;
		flex: 1 1 18rem;
		color: var(--warnung);
		font-size: 0.9rem;
	}

	/*
	 * Kacheln nebeneinander statt untereinander: Bei sieben Gemeinschaften wäre
	 * eine Spalte länger als der Bildschirm, und das laufende Geschäft — der
	 * eigentliche Inhalt dieser Spalte — stünde darunter ausser Sicht.
	 */
	.gauge {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	.hauskachel {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.hauskachel .klein {
		margin: 0;
	}


	.marke.vollzaehlig {
		color: var(--akzent);
		border-color: var(--akzent);
	}

	h2 {
		font-size: 1.1rem;
		margin-top: 0;
	}

	h3 {
		font-size: 1rem;
		margin-bottom: 0.4rem;
	}

	.dreischritt {
		list-style: none;
		padding: 0;
		margin: 0 0 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dreischritt li {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.6rem 0.8rem;
	}

	.dreischritt .jetzt {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 8%, transparent);
	}

	.rolle {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-leise);
	}

	.leise {
		color: var(--text-leise);
	}

	/*
	 * Die Vorschau der nötigen Mehrheit, wortgleich mit der Leitung eines Hauses:
	 * Gewicht ohne Farbe, weil sie weder Warnung noch Erfolg ist, und der
	 * Ausstandssatz als leise Erklärung mit linkem Strich.
	 */
	.noetig {
		font-weight: 600;
		margin: 0.35rem 0 0.15rem;
	}

	.saalhinweis {
		border-left: 3px solid var(--linie);
		margin: 0.75rem 0;
		max-width: 62ch;
		padding-left: 0.75rem;
	}

	.alle {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		/* Der Umschlag unten misst die Liste, nicht das Fenster: Sie steht am
		   Notebook in einer Spalte, am Telefon über die ganze Breite. */
		container-type: inline-size;
	}

	/*
	 * **Feste Spalten statt Umbruch** (24.08.2026). Als Flex-Zeile rutschten
	 * Marken und Knöpfe je nach Titellänge an eine andere Stelle; bei zwanzig
	 * Traktanden stand nichts mehr untereinander, und ein langer Titel schob den
	 * Knopf in die nächste Zeile. Das Raster hält Nummer, Titel, Marken und
	 * Handlungen in derselben Spur — die Liste liest sich dann als Liste.
	 */
	/*
	 * **Zwei Zeilen statt vier Spalten** (24.08.2026). Die Liste steht in der
	 * linken Spalte der Steuerung und ist gut zwanzig Zeichen breit; vier
	 * nebeneinanderliegende Spuren pressten den Titel auf zwei Buchstaben je
	 * Zeile, und die Marken lagen darüber. Jetzt steht der Titel oben, die Marken
	 * darunter und die Handlungen rechts daneben über beide Zeilen — dieselbe
	 * Ordnung in jeder Zeile, gleich wie lang der Titel ist.
	 */
	/*
	 * **Am Telefon stehen die Handlungen unter dem Titel** (06.10.2026,
	 * UI-Durchgang). Die Spur `auto` nimmt sich, was Stellenfeld und «Aufrufen»
	 * brauchen, und die Spur `1fr` daneben bekommt den Rest: Bei 390 px waren das
	 * 257 von 324 px für die Handlungen und **0 px für den Titel**, der dann
	 * unter Feld und Knöpfen durchlief.
	 *
	 * Am Notebook ist es nicht anders, nur weniger schlimm: Die Liste steht in
	 * einer Spalte von rund 29rem, die Handlungen brauchen gut 17rem, und dem
	 * Titel blieben 121 bis 132 px. «Erneuerungsfonds» lief dort in «Stelle»
	 * hinein. Die Schwelle liegt deshalb bei 36rem: Erst wenn die Liste so breit
	 * ist, bleiben dem Titel neben den Handlungen gut 15rem.
	 */
	.alle > li {
		display: grid;
		grid-template-columns: 2.2rem minmax(0, 1fr);
		grid-template-areas:
			'nummer titel'
			'nummer marken'
			'nummer tat';
		align-items: baseline;
		gap: 0.15rem 0.5rem;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid var(--linie);
	}

	@container (min-width: 36rem) {
		.alle > li {
			grid-template-columns: 2.2rem minmax(0, 1fr) auto;
			grid-template-areas:
				'nummer titel tat'
				'nummer marken tat';
		}
	}

	.alle > li > .nummer {
		grid-area: nummer;
	}

	.alle > li > .titel {
		grid-area: titel;
		min-width: 0;
	}

	.alle > li > .marken {
		grid-area: marken;
		font-size: 0.8rem;
	}

	.alle > li > .tat {
		grid-area: tat;
		align-self: center;
	}

	/* Das Zahlenfeld für die Stelle — schmal, es trägt höchstens zwei Ziffern. */
	.stellenform {
		display: flex;
		align-items: center;
		/* 0.5rem statt 0.25rem (06.10.2026, UI-Durchgang): Mit 4 px stand
		   «Setzen» dicht am Feld; jetzt derselbe Abstand wie zwischen den
		   übrigen Handlungen der Zeile. */
		gap: 0.5rem;
	}

	.stellenform label {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--text-leise);
	}

	/*
	 * **Mit `[type='number']`, sonst verliert die Regel** (06.10.2026,
	 * UI-Durchgang). `main input:not(…):not(…)` in `app.css` wiegt mehr als
	 * `.stellenform input`, sein Innenabstand von 0.65rem je Seite liess im
	 * 51 px breiten Feld 28 px für die Zahl, und «10» stand als «1(» da.
	 * Breite und Abstand jetzt wie in der Leitung einer einzelnen Versammlung.
	 */
	.stellenform input[type='number'] {
		width: 3.6rem;
		padding: 0.1rem 0.3rem;
		font: inherit;
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		text-align: center;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
	}

	/* Der Ausklapper darunter läuft über die ganze Breite. */
	.alle > li.einzeln {
		display: block;
		border-bottom: 1px solid var(--linie);
	}

	.marken,
	.tat {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.3rem 0.5rem;
	}

	/* Innerhalb des Ausklappers: zwei schlichte Zeilen je Gemeinschaft. */
	.alle .einzeln ul {
		list-style: none;
		margin: 0.2rem 0 0.5rem;
		padding: 0 0 0 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	/*
	 * **Name oben, Handlungen darunter** (06.10.2026, UI-Durchgang). Als eine
	 * Flex-Reihe ohne Umbruch standen Nummer, Name, «eigener Wortlaut»,
	 * Stellenfeld, «Setzen» und der Knopf oder der Sperrsatz nebeneinander; bei
	 * 390 px lief die Seite 86 bzw. 217 px quer. Der Aufklapper öffnet sich von
	 * selbst, sobald ein Haus einen eigenen Wortlaut trägt, also genau dort, wo
	 * im Saal gearbeitet wird. Eine dritte Spalte wie oben trüge hier nicht:
	 * Mal steht ein Knopf darin, mal ein Satz und zwei Verweise.
	 */
	.alle .einzeln li {
		display: grid;
		grid-template-columns: minmax(2.2rem, auto) minmax(0, 1fr);
		align-items: baseline;
		gap: 0.2rem 0.5rem;
	}

	.alle .einzeln li > .titel {
		min-width: 0;
		overflow-wrap: break-word;
	}

	.alle .einzeln li > .tat {
		grid-column: 2;
	}

	/*
	 * Der Zuordnungssatz über «Abstimmen» (Ä-05): eine eigene Zeile über die
	 * ganze Breite, ohne die Standardränder des Absatzes, wie der Sperrsatz.
	 */
	.alle .einzeln .zuordnungsform {
		flex: 1 1 100%;
	}

	.alle .einzeln .zuordnungsform p {
		margin: 0 0 0.3rem;
	}

	.listenkopf {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}



	.alle li.laeuft {
		border-left: 3px solid var(--akzent);
	}

	.nummer {
		font-weight: 600;
		min-width: 2rem;
	}

	/* Der Quorumstyp steht als Marke neben «Traktandum N». */
	.nummer .marke {
		font-weight: 400;
		margin-left: 0.5rem;
	}

	.titel {
		flex: 1;
		min-width: 8rem;
	}

	.geschaeft blockquote {
		margin: 0.5rem 0;
		padding-left: 0.7rem;
		border-left: 3px solid var(--akzent);
	}

	.hinweis,
	.klein {
		color: var(--text-leise);
		font-size: 0.9375rem;
	}

	.offen {
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		padding: 0.7rem 0.9rem;
		margin-top: 0.6rem;
	}

	.offen h4 {
		margin: 0 0 0.3rem;
	}

	.haeuser {
		list-style: none;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}

	button.leise {
		color: var(--text-leise);
		border: none;
		background: none;
		padding: 0;
		text-decoration: underline;
	}

	.leer {
		color: var(--text-leise);
	}
</style>
