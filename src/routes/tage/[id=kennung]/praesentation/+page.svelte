<script lang="ts">
	/**
	 * Der gemeinsame Monitor (Auftraggeber, 23.08.2026): «Ein gemeinsamer Abend hat auch
	 * einen gemeinsamen Bildschirm.»
	 *
	 * Oben die Sache, über die gesprochen wird — einmal. Darunter je
	 * Gemeinschaft, wie es bei ihr steht. Keine Namen (AD-11): Was hier steht,
	 * sehen alle im Saal.
	 */
	import { untrack } from 'svelte';
	import { nachzieher } from '$lib/components/neuladen';
	import Beschlussfaehigkeitskachel from '$lib/components/Beschlussfaehigkeitskachel.svelte';
	import Hausabstimmung from '$lib/components/Hausabstimmung.svelte';
	import Traktandenwand from '$lib/components/Traktandenwand.svelte';
	import Vollbildecke from '$lib/components/Vollbildecke.svelte';
	// `uhrzeit` kommt aus dem Kern: Ohne Zeitzone hinge die Uhrzeit im Saal am
	// Gerät, das die Leinwand treibt (04.09.2026).
	import { datumLang, uhrzeit } from '$lib/domain/datum';
	import { gemeinsamePause } from '$lib/domain/pausenstand';


	import type { Stromnachricht } from '$lib/server/ereignisstrom';

	let { data } = $props();

	type Hausstand = {
		meetingId: string;
		gemeinschaft: string;
		/** Ohne Klammerzusätze, solange die Häuser unterscheidbar bleiben. */
		kurz: string;
		/** Das Traktandum dieses Hauses im laufenden Schritt — null, wenn unbeteiligt. */
		traktandumImSchritt: string | null;
		stand: Stromnachricht | null;
	};

	/*
	 * **Aus dem Strom kommen nur die Zahlen, die Namen stehen in `data`.**
	 *
	 * Vorher ersetzte jede Strom-Nachricht die ganze Liste — und der Strom trägt
	 * `meetingId`, `gemeinschaft` und `stand`, aber keinen Kurznamen. Mit der
	 * ersten Nachricht wäre die Kurzform von der Wand verschwunden und hätte eine
	 * leere Beschriftung hinterlassen. Dieselbe Klasse wie ein Formular, das
	 * weniger zurückschickt, als es bekommen hat.
	 *
	 * Der Strom ist ausdrücklich der Weg für Zahlen und Kennungen (AD-11);
	 * Beschriftungen gehören auf den Ladeweg.
	 */
	let staende = $state<Record<string, Stromnachricht | null>>({});
	const haeuser = $derived<Hausstand[]>(
		data.haeuser.map((h) => ({ ...h, stand: staende[h.meetingId] ?? null }))
	);
	/**
	 * Welche Gemeinschaft die Fusszeile gerade zeigt.
	 *
	 * **Eine Zeile statt fünf** (Auftraggeber, 24.08.2026). Sie wechselt alle sechs
	 * Sekunden — lange genug, um sie im Vorbeigehen zu lesen, kurz genug, dass
	 * niemand auf seine wartet. Bei einer einzigen Gemeinschaft steht sie still:
	 * Ein Wechsel zwischen einem Ding und demselben Ding ist Unruhe ohne Inhalt.
	 */
	let haussteller = $state(0);
	$effect(() => {
		if (data.haeuser.length < 2) return;
		const takt = setInterval(() => {
			haussteller = (haussteller + 1) % data.haeuser.length;
		}, 6000);
		return () => clearInterval(takt);
	});
	const gezeigtesHaus = $derived(haeuser[haussteller] ?? haeuser[0] ?? null);

	let verbunden = $state(false);
	let zuletzt = $state(0);
	/** Ob je eine Nachricht ankam — die Schranke vor jedem Neuladen. */
	let stromDaGewesen = $state(false);

	/*
	 * **Ein Strom für alle Häuser.** Je Haus eine Verbindung wäre der
	 * naheliegende Weg und der falsche: Über HTTP/1.1 sind sechs Verbindungen je
	 * Herkunft das Limit, und bei sechs Häusern bliebe keine für die Seite
	 * selbst.
	 */
	$effect(() => {
		const quelle = new EventSource(`/tage/${data.tag.id}/strom`);
		quelle.onopen = () => (verbunden = true);
		quelle.onerror = () => (verbunden = false);
		quelle.onmessage = (e) => {
			const satz = (JSON.parse(e.data) as { haeuser: Hausstand[] }).haeuser;
			staende = Object.fromEntries(satz.map((h) => [h.meetingId, h.stand]));
			verbunden = true;
			stromDaGewesen = true;
			zuletzt = Date.now();
		};
		quelle.addEventListener('herzschlag', () => {
			verbunden = true;
			zuletzt = Date.now();
		});
		return () => quelle.close();
	});

	/**
	 * Wechselt der aufgerufene Punkt, muss die Seite neu laden.
	 *
	 * Der Strom trägt nur Zahlen und Kennungen — den Text des Punktes holt die
	 * Seite vom Server. Ihn mitzuschicken hiesse, Traktandentexte über einen Weg
	 * zu schicken, der ausdrücklich keine trägt (dieselbe Regel wie bei der Wand
	 * einer einzelnen Versammlung).
	 */
	/*
	 * **Pause und Wandbild kommen aus dem Strom** (Code-Review 24.08.2026,
	 * Befund 5).
	 *
	 * Die Abendsteuerung schreibt beides in jedes Haus und verkündet es — die
	 * Wand hat es bis dahin nicht gelesen. Wer «Pause» drückte, bekam die
	 * Meldung «Unterbrochen in 3 Gemeinschaften», und an der Leinwand stand
	 * weiter der Antragswortlaut, obwohl niemand mehr abstimmen konnte. Genau
	 * das verspricht der Kopf von `Pausenschalter.svelte` ausdrücklich anders.
	 *
	 * **Einheitlich über alle Häuser**: Eine halbe Pause gibt es im Saal nicht.
	 * Unterbrochen ist die Wand, sobald ein LAUFENDES Haus unterbrochen ist — das
	 * ist die vorsichtige Richtung, und sie stimmt mit der Wirkung überein: Dort
	 * kann gerade niemand abstimmen. Ein geschlossenes Haus behält seinen
	 * `paused_at`, zählt aber nicht mit; sonst hinge die Pause nach dem Schluss
	 * für immer an der Wand (`pausenstand.ts`).
	 */
	const pause = $derived(data.pause);
	const wandbild = $derived(data.wandbild);

	let gezeigt = $state(untrack(() => data.punkt?.nummer ?? null));

	/*
	 * **Erst nachdem der Strom gesprochen hat** (24.08.2026, an der Wand
	 * gesehen: «Verbindung unterbrochen», Kacheln ohne Zahlen).
	 *
	 * Ohne diese Schranke lief die Seite in eine Dauerschleife: Beim Aufbau sind
	 * alle Stände `null`, also läuft scheinbar nirgends etwas — und weil ein
	 * Punkt gezeigt wurde, lud sie neu. Und wieder. Der Strom kam nie zum Zug,
	 * und die Wand stand still.
	 *
	 * Dieselbe Falle wie am 02.08. bei der Saalsicht einer einzelnen
	 * Versammlung, dort zwischen frischem und gemerktem Stand. Ein Neuladen
	 * gehört hinter eine Tatsache, nicht hinter eine Annahme.
	 */
	/**
	 * Hinkt die Wand hinterher, obwohl der Strom lebt?
	 *
	 * **Zwei Eingänge, eine Zeile** (Produktentscheid 10.09.2026). Der Hinweis
	 * unten hing bis hierher allein am Ereignisstrom. Wer im Saalnetz nur den
	 * Abrufweg sperrt, lässt den Strom leben: Die Wand meldet sich als verbunden,
	 * die Zahlen stehen still, und ausgerechnet der Satz, der davor warnt, wird
	 * nicht gezeigt. Gemessen am 09.09.2026 in `e2e/netzunterbruch.mjs`, indem
	 * nur `/robots.txt` blockiert wurde.
	 *
	 * **Kein gemeinsamer Schalter.** Beide Ursachen in ein `verbunden` zu
	 * schreiben hiesse, dass der nächste Herzschlag des Stroms die Warnung
	 * löscht, während der Abrufweg weiter tot ist. Genau diese Bauform hat den
	 * Befund erzeugt.
	 */
	let hinterher = $state(false);

	/**
	 * **Ein Nachzieher für alles, was der Strom nicht trägt** (09.09.2026).
	 *
	 * Darin stecken vier Anlässe mit demselben Grund: Der Strom führt
	 * ausschliesslich Zahlen und Kennungen (AD-11), die Worte kommen vom Server
	 * — die Pause, das Wandbild, der Satz zur Beschlussfähigkeit mit den
	 * Gemeinschaftsnamen und der Wortlaut des aufgerufenen Punktes.
	 *
	 * **Eine Marke und nicht vier.** Bis heute standen hier vier
	 * `location.reload()` nebeneinander, und ein Neuladen holte ohnehin alles.
	 * Ein Nachzug baut die Seite nicht neu auf: Vier Nachzieher feuerten bei
	 * einem Beitrag, der zwei Dinge zugleich ändert, nebeneinander — vier Abrufe
	 * für denselben Stand. Dieselbe Lehre wie am Telefon seit dem 22.08.2026:
	 * ein Wert, ein Vergleich, ein Merker.
	 *
	 * **Und warum kein Neuladen mehr.** Gemessen mit `setOffline` in einem
	 * eigenen Browserkontext: Kippt das Netz während des Neuladens, bleibt die
	 * Wand auf Chromiums Fehlerseite stehen und erholt sich nicht — im Saal eine
	 * tote Leinwand, die nicht einmal «Verbindung unterbrochen» sagt, weil auch
	 * diese Meldung zur Seite gehörte. Siehe `$lib/components/neuladen`.
	 */

	const nach = nachzieher(
		untrack(() =>
			[
				data.pause?.seit ?? '-',
				// Wortgleich zu `wandbildmarke` auf dem Server, sonst zöge die Wand
				// beim ersten Beitrag einmal grundlos nach.
				`${data.wandbild?.art ?? 'traktanden'}@${data.wandbild?.geaendertAm ?? ''}`,
				data.feststellung?.wann ?? '-',
				data.laufendesTraktandum ?? '-',
				// Der Rückzug am aufgerufenen Traktandum je Haus (Probe Wertquotenmehr, B4).
				data.rueckzugsmarke
			].join('|')
		),
		{},
		(r) => (hinterher = r)
	);
	// Der Nachzieher hängt sich für die Lebensdauer der Seite an das Fenster;
	// hier wird er wieder abgemeldet.
	$effect(() => nach.ende);

	$effect(() => {
		if (!stromDaGewesen) return;
		/*
		 * **Dieselbe Rechnung wie am Server** (`pausenstand.ts`, 01.09.2026).
		 *
		 * Hier stand «die erste Pause über alle Häuser». Seit der Server nur
		 * laufende Häuser zählt und die früheste Unterbrechung nimmt, konnten
		 * beide dauerhaft auseinanderliegen — ein unterbrochen geschlossenes Haus
		 * genügt. `gezeigtePause` wird nach dem Aufbau nie neu gesetzt, also
		 * hätte die Wand bei JEDER Strom-Nachricht neu geladen, endlos.
		 *
		 * Zwei Rechnungen für eine Frage laufen auseinander; deshalb rechnen
		 * Server und Wand dieselbe.
		 */
		const stromPause =
			gemeinsamePause(
				haeuser.map((h) => ({
					zustand: h.stand?.zustand,
					pause: h.stand?.pause ? { seit: h.stand.pause } : null
				}))
			).pause?.seit ?? null;
		/*
		 * **Die ganze Marke, nicht nur ihre Art** (Code-Review 09.09.2026). Hier
		 * stand `split('@')[0]`, und der Strom trägt `art@zeitstempel`
		 * (`wandbildmarke`). Weggeschnitten wurde also genau der Teil, der sich
		 * ändert, wenn jemand den Text an der Wand umschreibt, ohne die Art zu
		 * wechseln: An der gemeinsamen Wand kam die Änderung nie an, an der Wand
		 * des einzelnen Hauses schon.
		 */
		const stromMarke = haeuser.map((h) => h.stand?.wandbild).find((w) => w) ?? null;
		const stromFest = haeuser
			.map((h) => h.stand?.festgestelltAm)
			.filter((f): f is string => Boolean(f))
			.sort()
			.at(-1) ?? null;
		nach.jetzt(
			[
				stromPause ?? '-',
				/*
				 * `wandbildmarke` liefert immer eine nichtleere Zeichenkette, notfalls
				 * `traktanden@`. `null` heisst deshalb nicht «kein Bild», sondern
				 * «kein Haus hat einen Stand» — und dann ist der Effekt oben schon
				 * ausgestiegen. Ein Rückfall auf `data` stand hier und lief nie.
				 */
				stromMarke ?? '-',
				stromFest ?? '-',
				juengsterPunkt ?? '-',
				haeuser.map((h) => h.stand?.zurueckgezogenAm ?? '-').join(',')
			].join('|')
		);
	});

	/**
	 * Neu geladen wird, wenn ein ANDERER Punkt zuletzt aufgerufen wurde.
	 *
	 * **Nicht «passt der gezeigte Punkt dazu»** (Code-Review 24.08.2026,
	 * Befund 4): Diese Frage konnte dauerhaft mit Nein beantwortet werden — bei
	 * einem Spontantraktandum, das die gemeinsame Liste gar nicht kennt. Dann
	 * lud die Wand endlos neu, weil die Lage nach dem Neuladen dieselbe war.
	 *
	 * Verglichen wird deshalb mit dem, was der **Server** beim Laden für den
	 * laufenden Punkt hielt. Er rechnet nach dem Neuladen dasselbe aus; ungleich
	 * bleibt es nur, wenn sich wirklich etwas geändert hat.
	 *
	 * **Nicht mehr die Menge aller laufenden Punkte** (25.08.2026): Die bleibt
	 * gleich, wenn die Sitzungsleitung von 2.2 auf 2.1 zurückspringt — beide
	 * Häuser stehen ja weiter auf je einem Punkt. Massgebend ist der zuletzt
	 * aufgerufene, und dafür trägt der Strom seit heute die Uhrzeit.
	 */
	/**
	 * Die Abstimmung je Haus — aber nur die, die zu DIESEM Punkt gehört.
	 *
	 * **Der Filter ist der ganze Punkt** (25.08.2026). Der Strom trägt je Haus
	 * den offenen oder zuletzt geschlossenen Durchgang; welcher das ist,
	 * entscheidet der Stand jenes Hauses, nicht der Schritt an der Wand. Ein
	 * Haus, das schon weiter ist, brächte ohne diesen Vergleich das Ergebnis
	 * eines anderen Punktes auf die gemeinsame Leinwand — und niemand im Saal
	 * sähe, dass es zu einer anderen Frage gehört.
	 *
	 * Häuser ohne Traktandum in diesem Schritt fallen ganz weg: Sie sind daran
	 * nicht beteiligt, und eine leere Kachel behauptete das Gegenteil.
	 */
	const abstimmende = $derived(
		haeuser
			.filter((h) => h.traktandumImSchritt)
			.map((h) => ({
				meetingId: h.meetingId,
				kurz: h.kurz,
				abstimmung:
					h.stand?.abstimmung && h.stand.abstimmung.traktandumId === h.traktandumImSchritt
						? h.stand.abstimmung
						: null
			}))
	);
	/** Ob überhaupt eine Abstimmung zu diesem Punkt läuft oder gelaufen ist. */
	const esWirdAbgestimmt = $derived(abstimmende.some((a) => a.abstimmung));

	const juengsterPunkt = $derived(
		haeuser
			.map((h) => h.stand)
			.filter((s): s is Stromnachricht => Boolean(s?.aktuellesTraktandumId))
			.sort((a, b) => (b.aufgerufenSeit ?? '').localeCompare(a.aufgerufenSeit ?? ''))[0]
			?.aktuellesTraktandumId ?? null
	);
</script>

<svelte:head><title>{data.tag.bezeichnung}</title></svelte:head>

<div class="wand">
	<header>
		<span class="anlass">{data.tag.bezeichnung}</span>
		<span class="wann">{datumLang(data.tag.datum)} · {data.tag.ort}</span>
		<!--
			**Zwei Eingänge, ein Satz.** Der Strom ist der eine, der Abrufweg der
			andere; wen im Saal interessiert, welche Leitung gerissen ist? Ein
			zweites Zeichen daneben wäre eine Zeile mit zwei Aussagen.
		-->
		{#if !verbunden || hinterher}
			<!-- Die Marke sagt, welcher Eingang es war; siehe die Wand des Hauses. -->
			<span class="tot" data-grund={hinterher ? 'rueckstand' : 'strom'}>
				Verbindung unterbrochen
			</span>
		{/if}
	</header>

	{#if pause}
		<!--
			**Die Pause überlagert alles** — wie im `Saalbild` einer einzelnen
			Versammlung. Nicht als vierte Wandbildart, sondern als Schicht darüber:
			Sie gilt auch, während eine Abstimmung offen ist.
		-->
		<section class="punkt pause">
			<h1>Pause</h1>
			{#if pause.text}<p class="pausentext">{pause.text}</p>{/if}
		</section>
	{:else if wandbild && wandbild.art === 'begruessung' && !data.punkt}
		<section class="punkt">
			<h1>Herzlich willkommen</h1>
			<p class="pausentext">{data.tag.bezeichnung}</p>
		</section>
	{:else if wandbild && wandbild.art === 'frei' && wandbild.text && !data.punkt}
		<section class="punkt">
			<h1>{wandbild.text}</h1>
		</section>
	{:else if data.einzelpunkt}
		<!--
			Ein Punkt, der nur einer Gemeinschaft gehört — ein Spontantraktandum
			etwa. Die Zeile darunter sagt, wessen: An der Wand sitzen alle
			Gemeinschaften, und wer nicht dazugehört, soll wissen, dass er gerade
			nicht gemeint ist.
		-->
		<section class="punkt">
			<p class="nummer">{data.einzelpunkt.nummer} · {data.einzelpunkt.gemeinschaft}</p>
			<h1>{data.einzelpunkt.titel}</h1>
			{#if data.einzelpunkt.antragswortlaut}
				<blockquote>{data.einzelpunkt.antragswortlaut}</blockquote>
			{/if}
			{#if data.einzelpunkt.art === 'kenntnisnahme'}
				<p class="art">Kenntnisnahme — hier wird nicht abgestimmt.</p>
			{/if}
			{@render rueckzug()}
		</section>
	{:else if data.punkt}
		<section class="punkt">
			<!--
				Die Nummer des Schrittes — «2.1», wenn eine einzelne Gemeinschaft
				abstimmt (Auftraggeber, 24.08.2026). Ihr Name steht daneben: An der Wand sitzen
				alle Häuser, und wer nicht gemeint ist, soll das sehen.
			-->
			<p class="nummer">
				{data.punkt.nummer}{#if data.punkt.gemeinschaft}{' '}· {data.punkt.gemeinschaft}{/if}
			</p>
			<h1>{data.punkt.titel}</h1>
			{#if data.punkt.antragswortlaut}
				<blockquote>{data.punkt.antragswortlaut}</blockquote>
			{/if}
			{#if data.punkt.art === 'kenntnisnahme'}
				<p class="art">Kenntnisnahme — hier wird nicht abgestimmt.</p>
			{/if}
			{@render rueckzug()}
		</section>
	{:else}
		<section class="punkt liste">
			<h1>Traktanden</h1>
			<!--
				**Kein Scrollen an der Wand** (Auftraggeber, 24.08.2026). Passt die Liste nicht,
				teilt sie sich auf zwei Spalten; reicht auch das nicht, blättert sie.
				Kopf und Fuss bleiben davon unberührt.
			-->
			<Traktandenwand punkte={data.punkte} />
		</section>
	{/if}

	<!--
		**Die Abstimmung je Gemeinschaft** (Auftraggeber, 25.08.2026: «auf dem Monitor wird
		das Ergebnis nicht angezeigt»).

		Das ist der ganze Unterschied zur Wand einer einzelnen Versammlung:
		dieselbe Frage, mehrere Beschlüsse. Jede Gemeinschaft hat ihre eigene
		Beschlussfähigkeit, ihr eigenes Mehr und ihre eigene Schwelle, und alles
		muss im Saal nebeneinander stehen — sonst rechnet jemand die Zahlen des
		Nachbarhauses auf seine eigene Abstimmung an.

		**Erst, wenn abgestimmt wird.** Solange keine Abstimmung zu diesem Punkt
		offen oder geschlossen ist, bleibt die Wand beim Punkt. Leere Kacheln
		unter jedem Traktandum wären Unruhe ohne Auskunft.

		**Nicht während der Pause**: Die legt sich über alles, auch über eine
		offene Abstimmung — dort kann gerade niemand abstimmen.
	-->
	<!--
		Der Rückzug am Punkt (Probe Wertquotenmehr, 17.11.2026, B4): Vorher stand
		der Antrag nach einem Rückzug unverändert da. Ohne Grund und ohne Namen.
	-->
	{#snippet rueckzug()}
		{#if data.alleZurueckgezogen}
			<p class="art">Zurückgezogen, es wird nicht abgestimmt.</p>
		{:else if data.zurueckgezogen.length > 0}
			<p class="art">Zurückgezogen in {data.zurueckgezogen.join(', ')}; dort wird nicht abgestimmt.</p>
		{/if}
	{/snippet}

	{#if !pause && esWirdAbgestimmt}
		<section class="abstimmungen">
			{#each abstimmende as a (a.meetingId)}
				<Hausabstimmung name={a.kurz} abstimmung={a.abstimmung} />
			{/each}
		</section>
	{/if}

	<!--
		**Je Gemeinschaft eine Spalte.** Jede Gemeinschaft hat ihre eigene
		Beschlussfähigkeit; beim Punkt, der sie zum Gegenstand hat, füllt sie die
		Wand.
	-->
	<!--
		**Was festgehalten wurde, steht auf der Wand** (Auftraggeber, 25.08.2026: «Wenn
		Beschlussfähigkeit festgehalten wird […] soll dies an der Sitzung
		entsprechend am Monitor angezeigt werden. In Form von Alle STWEG und MEG
		sind beschlussfähig oder so ähnlich»).

		**Der festgehaltene Befund, nicht die laufenden Zahlen.** Die Kacheln
		darunter und die Fusszeile zeigen, wie es JETZT steht — sie ändern sich,
		sobald jemand kommt oder geht. Dieser Satz ist der Eintrag, auf den sich
		jeder Beschluss des Abends stützt; deshalb steht die Uhrzeit dabei.

		**Sobald eine vorliegt — nicht nur beim Feststellungstraktandum.**
		Festgestellt wird auch mitten in der Sitzung, wenn der Saal sich geleert
		hat und vor dem nächsten Beschluss Klarheit gebraucht wird; genau dann
		will der Saal es sehen. Eine Zeile kostet die Wand nichts, und sie ist
		die Voraussetzung jedes Beschlusses, der an diesem Abend gefasst wird.

		**In der Pause nicht**: Die legt sich über alles.
	-->
	{#if data.feststellung && !pause}
		<p class="festgestellt">
			<strong>{data.feststellung.satz}</strong>
			<span class="wann"
				>festgehalten um {uhrzeit(data.feststellung.wann)}{#if !data.feststellung.vollstaendig}{' '}·
					noch nicht in jeder Gemeinschaft{/if}</span
			>
		</p>
	{/if}

	{#if data.beschlussfaehigkeitImVordergrund && !pause}
		<!--
			**Beim Punkt, der sie zum Gegenstand hat, füllt sie die Wand** (Auftraggeber,
			24.08.2026): «Das Pflichttraktandum Feststellung der Beschlussfähigkeit
			braucht die Sicht, um zu sehen, ob man beschlussfähig ist.»

			**`&& !pause`** (01.09.2026): Die Pause überlagert alles, und der
			Abschnitt direkt darüber prüft sie schon. Hier fehlte sie, und die
			Kacheln standen während der Unterbrechung weiter da.

			Sonst steht sie klein — siehe unten. Zwei Zustände statt einer
			Dauergrösse: Die Beschlussfähigkeit ist die Voraussetzung jedes
			Beschlusses und deshalb immer sichtbar; die Sache des Abends ist sie nur
			bei diesem einen Punkt.
		-->
		<section class="haeuser">
			{#each haeuser as h (h.meetingId)}
				<Beschlussfaehigkeitskachel
					name={h.kurz}
					bedingungen={h.stand?.bedingungen ?? []}
					beschlussfaehig={Boolean(h.stand?.beschlussfaehig)}
					groesse="saal"
				/>
			{/each}
		</section>
	{/if}

	<!--
		**Der Weg zurück, ohne die Wand zu stören** (Auftraggeber, 25.08.2026: «Beim
		Präsentationsbildschirm fehlt u.a. den Button für die Präsentationsansicht,
		wie bei der Einzelversammlung»).

		Dieselbe Ecke wie an der Wand einer einzelnen Versammlung und an `/p`:
		Vollbild — am Beamer hat selten jemand eine Tastatur für `F11` zur Hand —
		und der Verweis zurück in die Sitzungsleitung. Sie liegt unsichtbar in der
		Ecke und erscheint erst auf Maus oder Berührung. An der Wand bewegt sich
		nichts, also sieht sie dort niemand.
	-->
	<Vollbildecke>
		{#snippet weitere()}
			<a class="knopf" href="/tage/{data.tag.id}/leitung">Zur Sitzungsleitung</a>
		{/snippet}
	</Vollbildecke>

	<!--
		**Die Fusszeile: Zahlen und Einstieg** (Auftraggeber, 24.08.2026: «Minimalistisch
		halten. Mit Zahlen und Kurzform der STWEG. QR-Code, analog des Monitors der
		Einzelabstimmung.»)

		Vorher standen hier fünf Kacheln mit je zwei Balken — sie nahmen die untere
		Hälfte der Wand ein, obwohl der Punkt oben die Sache ist. Jetzt: je Haus
		eine Zeile mit Kurzname, Köpfen und Wertquoten, dazu das Wort
		«beschlussfähig» als Farbe statt als Satz. Dieselben Zahlen wie in den
		Balken, ein Sechstel des Platzes.
	-->
	<footer>
		<!--
			**Eine Zeile, die wechselt** (Auftraggeber, 24.08.2026): «Die Beschlussfähigkeit
			auf dem Monitor muss eine Zeile sein. Sie darf rotieren.»

			Vorher stand je Gemeinschaft eine Zeile — bei fünf Häusern fünf, und die
			Leiste nahm ein Viertel der Wand. Jetzt trägt der Platz einer Zeile
			nacheinander alle: Wer die eigene sucht, wartet ein paar Sekunden, und
			wer sie nicht sucht, sieht eine ruhige Wand.
		-->
		<!--
			Beim Pflichttraktandum stehen die Balken oben — dann wäre die Zeile
			dieselbe Auskunft ein zweites Mal. Der Code bleibt: Wer zu spät kommt,
			kommt oft genau dann.

			**Was die Pause betrifft** (01.09.2026): Die Kacheln oben weichen der
			Unterbrechung. Diese Zeile läuft weiter — sie zeigt Summen und den
			Kurznamen eines Hauses, nicht die Sache des Abends, und wer während
			der Pause an die Wand schaut, darf ruhig sehen, wie es um die
			Beschlussfähigkeit steht.
		-->
		{#if gezeigtesHaus && !data.beschlussfaehigkeitImVordergrund}
			<p
				class="zeile"
				class:ja={gezeigtesHaus.stand?.beschlussfaehig}
				class:nein={gezeigtesHaus.stand && !gezeigtesHaus.stand.beschlussfaehig}
			>
				<span class="wer">{gezeigtesHaus.kurz}</span>
				{#if gezeigtesHaus.stand}
					<span class="wert"
						><strong>{gezeigtesHaus.stand.kopfstimmenAnwesend}</strong>/{gezeigtesHaus.stand
							.kopfstimmenGesamt} Kopfstimmen</span
					>
					<span class="wert"
						><strong>{gezeigtesHaus.stand.quotenAnwesend}</strong>/{gezeigtesHaus.stand
							.gesamtquote} Wertquoten</span
					>
					<span class="urteil"
						>{gezeigtesHaus.stand.beschlussfaehig
							? 'beschlussfähig'
							: 'nicht beschlussfähig'}</span
					>
				{:else}
					<span class="wert leise">noch keine Zahlen</span>
				{/if}
				{#if haeuser.length > 1}
					<span class="takt" aria-hidden="true">
						{#each haeuser as _, i (i)}<span class:hier={i === haussteller}></span>{/each}
					</span>
				{/if}
			</p>
		{/if}

		{#if data.einstiegSvg}
			<!--
				**Ein Code für alle Häuser.** Er öffnet die Hausauswahl; das
				Saalmerkmal der einzelnen Versammlung steht dahinter und nicht auf der
				Wand.
			-->
			<div class="einstieg">
				<!-- Eigenes Erzeugnis: `qrcode` baut das SVG aus unserer eigenen Adresse. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="qr">{@html data.einstiegSvg}</div>
				<p class="frage">Ohne Karte? Scannen.</p>
			</div>
		{/if}
	</footer>
</div>

<style>
	/*
	 * Gesetzt für den Saal, nicht für den Schreibtisch: grosse Schrift, ruhiger
	 * Aufbau, viel Weiss. Was aus zehn Metern nicht lesbar ist, gehört nicht an
	 * die Wand.
	 */
	/*
	 * **Die Wand ist genau so hoch wie der Bildschirm** (Auftraggeber, 24.08.2026: «Bei
	 * der Präsentationsansicht kein Scrollen. Die Grösse des Monitors gibt die
	 * Höhe»).
	 *
	 * Vorher `min-height` — die Seite wuchs mit dem Inhalt, und bei zwanzig
	 * Traktanden stand die Hälfte unter der Kante. An einem Beamer gibt es
	 * niemanden, der scrollt: Was darunter steht, existiert für den Saal nicht.
	 */
	.wand {
		height: 100vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: clamp(0.75rem, 2vh, 2rem);
		padding: clamp(1rem, 3vw, 3rem);
		background: var(--flaeche);
		color: var(--text);
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 1.5rem;
		color: var(--text-leise);
		font-size: clamp(1rem, 1.6vw, 1.4rem);
	}

	.anlass {
		font-weight: 600;
		color: var(--text);
	}

	.tot {
		color: var(--warnung);
		font-weight: 600;
	}

	.punkt {
		flex: 1 1 auto;
		min-height: 0;
	}

	/* Die Traktandenliste füllt den mittleren Bereich und schneidet ab; Kopf und
	   Fuss behalten ihre Höhe. */
	.punkt.liste {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.punkt.pause h1 {
		color: var(--warnung);
	}

	.pausentext {
		font-size: clamp(1.2rem, 2.4vw, 2.4rem);
		color: var(--text-leise);
	}

	.nummer {
		color: var(--text-leise);
		font-size: clamp(1.2rem, 2vw, 2rem);
		margin: 0;
	}

	h1 {
		font-size: clamp(2rem, 4.5vw, 4.5rem);
		line-height: 1.1;
		margin: 0.2em 0;
	}

	blockquote {
		margin: 0.5em 0 0;
		padding-left: 0.6em;
		border-left: 4px solid var(--akzent);
		font-size: clamp(1.2rem, 2.4vw, 2.4rem);
		line-height: 1.3;
	}

	.art {
		color: var(--text-leise);
		font-size: clamp(1rem, 1.8vw, 1.8rem);
	}



	/*
	 * **Die Fusszeile: Zahlen links, Einstieg rechts** — dieselbe Aufteilung wie
	 * auf der Wand einer einzelnen Versammlung, damit im Saal beide Bildschirme
	 * gleich zu lesen sind.
	 */
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: clamp(0.75rem, 2vw, 2rem);
		border-top: 1px solid var(--linie);
		padding-top: clamp(0.5rem, 1.5vh, 1rem);
	}

	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem 1.25rem;
		margin: 0;
		font-size: clamp(0.9rem, 1.5vw, 1.5rem);
	}

	.wer {
		font-weight: 600;
	}

	/*
	 * Der Takt: ein Punkt je Gemeinschaft, der gefüllte ist die gezeigte. Ohne
	 * ihn sieht ein Wechsel aus wie ein Sprung — mit ihm ist erkennbar, dass die
	 * Zeile durchzählt und die eigene gleich kommt.
	 */
	.takt {
		display: inline-flex;
		gap: 0.3rem;
		align-items: center;
	}

	.takt span {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--linie);
	}

	.takt span.hier {
		background: var(--text-leise);
	}

	.wert {
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
	}

	.wert strong {
		color: var(--text);
	}

	/*
	 * **Beschlussfähig als Farbe, nicht als Kasten.** Das Wort steht da, weil
	 * eine Farbe allein nichts sagt, wenn man sie nicht sehen kann — und der
	 * Kasten drumherum kostete die Zeile, die er sparen soll.
	 */
	.urteil {
		font-size: 0.85em;
	}

	.zeile.ja .urteil {
		color: var(--akzent);
	}

	.zeile.nein .urteil {
		color: var(--warnung);
	}

	.einstieg {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.frage {
		margin: 0;
		color: var(--text-leise);
		font-size: clamp(0.75rem, 1vw, 1rem);
	}

	.qr {
		width: clamp(3.5rem, 5vw, 5rem);
		/* themenfest: Der QR-Code braucht Weiss, damit ihn jede Kamera liest. */
		background: #fff;
		padding: 0.25rem;
		border-radius: var(--radius);
	}

	.qr :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}

	/*
	 * **Die Abstimmungskacheln teilen sich das Raster mit den
	 * Beschlussfähigkeitskacheln** — gleiche Mindestbreite, gleicher Abstand.
	 * Zwei verschiedene Raster auf einer Wand läsen sich wie zwei Anwendungen.
	 *
	 * `min-height: 0` und `overflow: hidden`: An der Wand wird nicht gescrollt.
	 * Passen die Kacheln nicht, schneiden sie ab — und der Punkt oben bleibt
	 * stehen, denn er ist die Sache.
	 */
	/*
	 * **Der festgehaltene Befund steht über den Kacheln** — er ist die Aussage,
	 * die Kacheln sind ihr Beleg. Deshalb gross und in der Textfarbe, nicht
	 * leise: Wer im Saal fragt «sind wir beschlussfähig?», liest diese Zeile.
	 */
	.festgestellt {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.3rem 1rem;
		font-size: clamp(1.1rem, 2vw, 2rem);
		line-height: 1.25;
	}

	.festgestellt .wann {
		font-size: 0.6em;
		color: var(--text-leise);
	}

	.abstimmungen {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: clamp(0.5rem, 1.5vw, 1.25rem);
		min-height: 0;
		overflow: hidden;
	}

	/*
	 * **Sieben Kacheln müssen nebeneinander passen** (Auftraggeber, 24.08.2026). Bei
	 * `18rem` Mindestbreite brachen sie ab der fünften um; `12rem` trägt sieben
	 * auf einem gewöhnlichen Beamer und bleibt aus zehn Metern lesbar, weil der
	 * Inhalt der Kachel aus Name, Balken und zwei Zahlen besteht.
	 */
	.haeuser {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: clamp(0.5rem, 1.5vw, 1.25rem);
	}




</style>
