<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { aufzaehlung } from '$lib/sprache';
	import {
		einheitlicheWahl,
		ersterOffenerBlock as ersteOffene,
		stimmbare,
		stimmstand
	} from '$lib/domain/stimmblock';
	import { nachzieher } from '$lib/components/neuladen';
	import { nachziehen } from '$lib/nachziehen';
	import { anfangswert, angekreuzt } from '$lib/felder';
	import { VERWALTUNG_HAKEN_HILFE_EIGENTUEMER } from '$lib/domain/mehrhinweise';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	let { data, form } = $props();

	/**
	 * **Der gescannte Code löst sich während der Versammlung ohne Tipp ein**
	 * (FP-1, 12.11.2026).
	 *
	 * Wer den QR seiner Karte scannt, steht im Gedränge vor dem Saal. Der
	 * Produktentscheid vom 24.08.2026 verlangt, dass er danach nicht noch einen
	 * Knopf drückt. Der Abruf von `/z/<code>` löst den Code darum nicht mehr
	 * selbst ein (sonst verbrauchte ihn der Vorschau-Bot eines Messengers),
	 * sondern merkt ihn vor und leitet hierher. Diese Seite schickt den Anstoss
	 * nach dem Hydrieren ab.
	 *
	 * **Vor Beginn wartet er auf einen Tipp** (FP-1b, 12.11.2026). Ein
	 * Abrufer, der JavaScript ausführt (der Linkprüfer eines Mailprogramms
	 * etwa), schickte das Formular sonst weiterhin selbst ab und verbrauchte
	 * den Zugang Tage vor der Versammlung. Der Anstoss trägt darum das Feld
	 * `auto`, das nur sein eigenes Formular sendet; der Server löst damit erst
	 * ein, wenn die Versammlung läuft.
	 *
	 * **Kein Inline-Skript** (Nonce-CSP): Der Anstoss steht in diesem Modul und
	 * damit im gebündelten Skript. Ohne JavaScript bleibt das Formular mit dem
	 * Knopf «Anmelden» stehen; es sendet dann klassisch und ohne `auto`.
	 */
	let anstossformular = $state<HTMLFormElement>();

	onMount(() => {
		if (!data.kartewartet) return;
		anstossformular?.requestSubmit();
	});

	/**
	 * Ob die Nachschau des Anstosses den Code nicht eingelöst hat.
	 *
	 * Dann steht der Knopf da, und erst sein Tipp löst ein. Ohne JavaScript
	 * gibt es diese Antwort nie; der Knopf steht ohnehin von Anfang an da.
	 */
	const tippen = $derived(
		form && typeof form === 'object' && 'tippen' in form ? Boolean(form.tippen) : false
	);

	/**
	 * Ob gerade abgestimmt wird — davon hängt ab, was oben steht.
	 *
	 * Läuft eine Abstimmung, gehört die Frage zuoberst (Produktentscheid
	 * 20.08.2026). Läuft keine, ist die Einordnung «wo stehen wir» das
	 * Wichtigste (Produktentscheid 04.09.2026). Beides gilt; sie unterscheiden
	 * sich nur in der Lage.
	 *
	 * **Die Pause gehört in die Bedingung**, obwohl sie mit der Abstimmung
	 * nichts zu tun hat: Sie steht in der Verzweigung davor und gewinnt. Ohne
	 * sie wäre der Ausdruck bei einer Unterbrechung während laufender
	 * Abstimmung wahr, der Abstimmungsteil würde aber nie gerendert — die
	 * Einordnung verschwände dann an beiden Stellen.
	 */
	const stimmtGerade = $derived(
		!data.versammlung?.pause && Boolean(data.abstimmung) && data.zustand === 'anwesend'
	);

	/*
	 * **Die Rückmeldung, unabhängig davon, welche Aktion sie geschickt hat.**
	 *
	 * Seit die Seite auch Vollmachten erklärt, gibt es Aktionen mit und ohne
	 * `fehler`. Der Typ ist damit eine Vereinigung, und ein direkter Zugriff
	 * gälte nur für den Teil, der das Feld hat. Hier einmal auseinandergenommen
	 * statt an jeder Stelle geprüft.
	 */
	const fehler = $derived(
		form && typeof form === 'object' && 'fehler' in form
			? (form.fehler as { nachricht: string } | undefined)
			: undefined
	);
	const belegt = $derived(
		form && typeof form === 'object' && 'belegt' in form ? Boolean(form.belegt) : false
	);
	const eingabe = $derived(
		form && typeof form === 'object' && 'eingabe' in form ? String(form.eingabe ?? '') : ''
	);
	const hinweis = $derived(
		form && typeof form === 'object' && 'hinweis' in form ? String(form.hinweis) : ''
	);

	/**
	 * Wann zuletzt ein Formular dieser Seite abgeschickt wurde.
	 *
	 * Ein `location.reload()` in genau diesem Fenster bricht die laufende Abgabe
	 * ab: Der Server hat sie dann vielleicht nie gesehen, und die Person merkt es
	 * nur, wenn sie nach dem Neuladen auf «noch nicht gestimmt» achtet. Deshalb
	 * schweigen alle Neulade-Auslöser, solange ein Abschicken jünger als die
	 * Karenz ist. Eine feste Marke statt des Zeitstempels wäre falsch: Stirbt das
	 * Netz unter der Abgabe, kommt nie eine Antwort — nach Ablauf der Karenz muss
	 * der Wachhund wieder greifen dürfen, damit die Person den wahren Stand sieht
	 * und erneut tippen kann.
	 *
	 * **Zwei Wege setzen sie, und das ist kein Zufall** (Code-Review 06.09.2026).
	 * Die übrigen Formulare dieser Seite senden als echte Navigation; für sie
	 * genügt der Fensterhorcher weiter unten. Das Wahlformular sendet seit
	 * heute über `use:enhance`, und SvelteKit ruft dort `preventDefault()`
	 * **bevor** das Ereignis am Fenster ankommt — der Horcher prüft genau
	 * `defaultPrevented` und setzte die Karenz für die Stimmabgabe deshalb nie
	 * mehr. Ausgerechnet für die Handlung, für die sie gebaut wurde.
	 *
	 * Sie hängt dort jetzt an `laufend` aus `absenden()`. Der Rückruf kommt
	 * **nach** der Doppelklicksperre, also nur für Absendungen, die wirklich
	 * hinausgehen — ein abgewiesener zweiter Klick verlängert die Karenz nicht.
	 */
	let letzterSubmit = 0;

	/**
	 * Welche Parteien gerade abgeben.
	 *
	 * **Zwei Gründe, beide aus dem Code-Review vom 06.09.2026.**
	 *
	 * Der erste ist ein Wettlauf: Seit das Wahlformular über `use:enhance`
	 * sendet, bricht ein zweiter Klick den ersten nicht mehr ab. Die
	 * Doppelklicksperre in `absenden()` schlüsselt auf Name **und Wert** des
	 * Knopfes, «Ja» und «Nein» derselben Partei sind für sie also zwei
	 * Handlungen und laufen nebeneinander. Kommen die Antworten in umgekehrter
	 * Reihenfolge zurück, malt die zweite den Stand vor der ersten.
	 *
	 * Der zweite ist schlichter: Ohne sichtbaren Laufzustand sieht ein Klick aus
	 * wie nichts und wird noch einmal gedrückt. Das ist die Regel, für die
	 * `laufend` in `absenden()` überhaupt da ist.
	 *
	 * **Eine Menge und kein einzelner Platz** (Sicherheitsdurchgang 06.09.2026).
	 * Der erste Anlauf merkte sich **eine** Partei. Wer eine Vollmacht hält, hat
	 * aber mehrere Wahlblöcke, und die teilten sich diesen Platz: Die zweite
	 * Abgabe überschrieb ihn und gab die Knöpfe der ersten frei, obwohl deren
	 * Anfrage noch flog; und die erste eintreffende Antwort gab alle frei. Die
	 * Sperre hielt damit genau dort nicht, wo sie gebraucht wird — auf dem Gerät
	 * mit zwei Stimmen.
	 *
	 * `SvelteSet` statt `Set`: Ein gewöhnliches `Set` in `$state` meldet keine
	 * Änderung an `add`/`delete`, die Knöpfe blieben also stumm.
	 */
	const abgebende = new SvelteSet<string>();
	const inSubmitKarenz = () => Date.now() - letzterSubmit < 15_000;

	/**
	 * Beim Warten alle fünf Sekunden nachsehen, ob die Sitzungsleitung bestätigt
	 * hat.
	 *
	 * **Nachziehen statt neu laden** (09.09.2026). Ein Takt, der neu lädt, tut
	 * es auch dann, wenn das Netz gerade weg ist — und dann kommt die Seite
	 * nicht zurück, sondern bleibt auf Chromiums Fehlerseite stehen. Hier trifft
	 * es die Person, die vor dem Saal wartet: Sie sähe die Freigabe nie und
	 * hätte kein Mittel ausser dem eigenen Neuladen. Ein gescheiterter Nachzug
	 * kostet dagegen nichts, der nächste Takt kommt in fünf Sekunden.
	 */
	$effect(() => {
		if (!data.angemeldet || data.kartewartet || data.zustand !== 'wartet') return;
		const nach = nachziehen({ nichtWaehrend: inSubmitKarenz, vorflug: true });
		const takt = setInterval(nach.jetzt, 5000);
		return () => {
			clearInterval(takt);
			nach.ende();
		};
	});

	/**
	 * Ein langsamer Auffrisch-Takt unter dem Ereignisstrom.
	 *
	 * Vor und nach der laufenden Versammlung ist er der einzige Weg, Änderungen
	 * zu sehen (der Strom läuft nur während «laufend»), darum dort wie bisher
	 * alle zwanzig Sekunden. Während der Versammlung wacht der
	 * Herzschlag-Wachhund im Strom-Effekt über tote Verbindungen; der Takt hier
	 * fängt nur noch, was ohne Durchgangswechsel ändert (etwa eine mitten in
	 * der Versammlung bestätigte Vollmacht), und darf deshalb auf eine Minute
	 * hinauf. Das blinde Neuladen alle zwanzig Sekunden — hundert Telefone,
	 * fünf Anfragen je Sekunde, Flackern unter dem Daumen und die Gefahr, eine
	 * laufende Stimmabgabe abzureissen — entfällt (Auftraggeber, 15.08.2026, mit Blick
	 * auf die grosse Versammlung).
	 */
	$effect(() => {
		if (!data.angemeldet || data.kartewartet) return;
		const laufend = data.versammlung.zustand === 'laufend';
		// **Auch hier nachziehen statt neu laden** (09.09.2026): siehe oben. Der
		// Takt läuft im Saal auf hundert Telefonen; ein Neuladen im falschen
		// Augenblick nimmt einem davon die Stimme.
		const nach = nachziehen({ nichtWaehrend: inSubmitKarenz, vorflug: true });
		const takt = setInterval(nach.jetzt, laufend ? 60_000 : 20_000);
		return () => {
			clearInterval(takt);
			nach.ende();
		};
	});

	/**
	 * Auf das Öffnen und Schliessen einer Abstimmung reagieren.
	 *
	 * Über den Ereignisstrom und nicht über einen Abfragetakt: Story 5.6 verlangt
	 * die Frage innert zwei Sekunden auf allen Geräten, und ein Takt, der das
	 * schafft, erzeugte bei hundert Telefonen mehr Last als hundert offene
	 * Verbindungen, die still daliegen.
	 *
	 * Geladen wird die Seite nur, wenn der Durchgang **wechselt**. Ein Neuladen
	 * bei jeder eintreffenden Stimme risse dem Eigentümer die Schaltfläche unter
	 * dem Daumen weg.
	 */
	$effect(() => {
		if (!data.angemeldet || data.kartewartet || data.versammlung.zustand !== 'laufend') return;

		/**
		 * **Eine Marke, und sie liegt im Nachzieher** (Code-Review 09.09.2026).
		 *
		 * Hier standen drei eigene Merker, und sie rückten **vor** dem Nachzug
		 * vor — genau die Reihenfolge, die `$lib/components/neuladen` als Fehler
		 * beschreibt. Unter `location.reload()` war sie richtig: Wer neu lud, kam
		 * mit dem neuen Stand zurück oder gar nicht. Ein Nachzug kann scheitern,
		 * und dann galt der Durchgangswechsel als geholt, war es nicht, und kam
		 * bis zum nächsten Takt nicht wieder — bis zu einer Minute, mitten in
		 * einer Abstimmung.
		 *
		 * Der Nachzieher führt die Marke selbst und stellt sie nur nach einem
		 * geglückten Zug vor. Die Rücksicht auf eine laufende Stimmabgabe steht
		 * als Regel daneben: In der Karenz zieht er nicht, meldet das, und der
		 * nächste Beitrag oder der Wachhund holt es nach.
		 */
		const anfangsmarke = untrack(() =>
			[
				data.versammlung.zustand,
				data.abstimmung?.durchgangId ?? '-',
				data.abstimmung ? 'offen' : '-',
				// Der Strom trägt nur den Zeitpunkt der Unterbrechung, nicht ihren
				// Wortlaut (AD-11) — der Anfangswert muss dieselbe Form haben, sonst
				// zieht die Seite beim ersten Herzschlag einmal grundlos nach.
				data.versammlung?.pause?.seit ?? '-'
			].join('|')
		);
		/**
		 * **Mit Bremse, sonst lädt die Seite endlos.**
		 *
		 * Gemeldet am 20.08.2026: «bei der Ansicht Eigentümer lädt er endlos. Man
		 * kann so nicht abstimmen.» Nachgemessen, und die Ursache ist ein
		 * Unterschied in der Sicht:
		 *
		 *   - Diese Seite kennt eine Abstimmung **nur, solange sie offen ist**
		 *     (`data.abstimmung` ist danach `null`).
		 *   - Der Strom meldet weiter den **letzten** Durchgang zum aufgerufenen
		 *     Traktandum, auch geschlossen.
		 *
		 * Ist ein Traktandum aufgerufen und seine Abstimmung geschlossen, weichen
		 * die beiden also dauerhaft voneinander ab: Die Seite lädt neu, bekommt
		 * denselben Unterschied wieder und lädt wieder — auf jedem Telefon im Saal,
		 * gleichzeitig.
		 *
		 * `nachzieher` ist genau dagegen gebaut (02.08.2026, damals die Wand im
		 * Saal) und merkt sich, wofür schon einmal gezogen wurde. Ein Zug, der
		 * beim ersten Mal nichts geändert hat, ändert auch beim zehnten nichts.
		 *
		 * **Der Merker liegt seit dem 09.09.2026 im Nachzieher**, nicht mehr in
		 * `sessionStorage`. Er musste dort liegen, solange hier neu geladen wurde
		 * — die Bremse hatte den Vorgang zu überleben, den sie bremste. Jetzt
		 * überlebt die Seite, und die Bremse wird dadurch verlässlicher: Im
		 * privaten Modus war `sessionStorage` gesperrt und es gab gar keine.
		 */
		const nach = nachzieher(anfangsmarke, { nichtWaehrend: inSubmitKarenz });

		let zuletztGehoert = Date.now();
		/**
		 * Der Strom, und wie er sich wieder aufbauen lässt.
		 *
		 * **Warum das eine Funktion sein muss** (09.09.2026). Der Wachhund unten
		 * lud bis heute die Seite neu, und das tat zwei Dinge: die Daten holen
		 * **und** jede Verbindung neu aufbauen. Ein Nachzug tut nur das erste.
		 * Ihn blind an die Stelle zu setzen wäre der schlechtere Zustand als
		 * vorher: frische Daten an einem toten Strom, und das Telefon stünde
		 * stumm da, ohne dass es jemand merkt.
		 */
		let quelle: EventSource;
		const empfange = (e: MessageEvent) => {
			zuletztGehoert = Date.now();
			const stand = JSON.parse(e.data);

			/*
			 * **Eine Marke für alles, was diese Sicht umstellt** — der Zustand der
			 * Versammlung, der Durchgang, sein Zustand und seit dem 22.08.2026 die
			 * Unterbrechung.
			 *
			 * **Der Zustand gehört dazu:** Das Schliessen der Versammlung wechselt
			 * keinen Durchgang. Wer zuletzt abgestimmt hatte, sass sonst vor einer
			 * Sicht, die eine laufende Versammlung zeigte, während im Saal längst
			 * Schluss war; ob es auffiel, hing daran, ob beim Schliessen zufällig
			 * noch eine Abstimmung offen war.
			 *
			 * **Die Pause auch**, und sie fehlte bis zum 22.08.2026: Wer während
			 * einer Pause auf sein Telefon sah, sah weiter das Traktandum. Sie als
			 * zweiten, eigenen Auslöser einzubauen wäre gefährlich gewesen — zwei
			 * Nachzieher mit verschiedenen Marken löschen einander den Merker und
			 * ziehen abwechselnd weiter, auf jedem Telefon im Saal gleichzeitig.
			 *
			 * Deshalb: ein Wert, ein Vergleich, ein Merker.
			 */
			nach.jetzt(
				[
					stand.zustand ?? data.versammlung.zustand,
					stand.abstimmung?.durchgangId ?? '-',
					stand.abstimmung?.zustand ?? '-',
					stand.pause ?? '-'
				].join('|')
			);
		};

		// Der Herzschlag des Servers (alle fünf Sekunden) macht Totenstille
		// messbar: Im Saal-WLAN sterben offene Verbindungen still — der Browser
		// meldet nichts, das Telefon zeigt weiter, was zuletzt ankam. Genau das
		// ist im Prüflauf passiert: Ein Telefon stand nach dem Ende der
		// Versammlung noch minutenlang auf der laufenden Sicht. Statt blind alle
		// zwanzig Sekunden nachzuziehen, tut die Seite es nur, wenn der Strom
		// wirklich verstummt ist (vier verpasste Schläge) — oder ein Nachzug aus
		// der Submit-Karenz nachzuholen ist.
		const verbinde = () => {
			quelle = new EventSource('/z/strom');
			quelle.onmessage = empfange;
			quelle.addEventListener('herzschlag', () => {
				zuletztGehoert = Date.now();
			});
		};
		verbinde();

		const nachStille = nachziehen({ nichtWaehrend: inSubmitKarenz, vorflug: true });
		const wachhund = setInterval(() => {
			if (inSubmitKarenz()) return;
			if (Date.now() - zuletztGehoert <= 20_000) return;

			/*
			 * **Erst die Leitung, dann die Daten.** Genau hier lag der Teil, den ein
			 * Nachzug allein nicht ersetzt: Der Wachhund feuert, WEIL die Verbindung
			 * tot ist. Sie neu aufzubauen ist die eigentliche Handlung; der Nachzug
			 * daneben holt, was in der Stille verpasst wurde.
			 *
			 * Die Uhr wird mitgestellt, sonst gälte der neue Strom sofort wieder als
			 * verstummt und der Wachhund baute alle fünf Sekunden neu auf.
			 */
			quelle.close();
			zuletztGehoert = Date.now();
			verbinde();
			/*
			 * **Ohne Vormerkung** (Code-Review 09.09.2026). Hier stand ein Merker
			 * für «in der Karenz wollte jemand nachziehen»; er wurde vor dem Zug
			 * verbraucht, auch wenn der durchfiel. Er wird nicht mehr gebraucht: Der
			 * Nachzieher oben führt die Marke selbst, stellt sie nur nach einem
			 * geglückten Zug vor und wiederholt einen gescheiterten von sich aus.
			 * Was in der Karenz ausfiel, holt er nach, ohne dass es jemand merken
			 * muss.
			 */
			nachStille.jetzt();
		}, 5_000);

		return () => {
			clearInterval(wachhund);
			nachStille.ende();
			nach.ende();
			quelle.close();
		};
	});

	/** Was diese Partei im offenen Durchgang zuletzt gestimmt hat. */
	const bereitsGestimmt = $derived(
		data.angemeldet && data.abstimmung ? einheitlicheWahl(data.abstimmung.bisher) : null
	);

	/**
	 * Die Parteien dieses Geräts, für die noch keine Stimme abgegeben ist.
	 *
	 * **Der Grund** (Bedienbarkeitsprüfung 05.09.2026): Wer eine Vollmacht hält,
	 * gibt zuerst seine eigene Stimme ab; die Seite springt danach an den Anfang,
	 * und der Block der vertretenen Person liegt weit unterhalb des Bildschirms.
	 * Ohne diesen Hinweis verfällt ihre Stimme, ohne dass jemand es merkt.
	 *
	 * Gezählt wird gegen die **stimmbaren** Parteien, nicht gegen alle: Für eine
	 * gesperrte Partei darf hier nicht gestimmt werden, sie ist also weder ein
	 * offener Punkt noch ein Teil der Summe. Stünde sie im Nenner, meldete die
	 * Bestätigung «Alle 2 Stimmen sind erfasst», während nur eine erfasst ist.
	 */
	const alleBloecke = $derived(data.angemeldet && data.abstimmung ? data.abstimmung.parteien : []);
	const stimmbareParteien = $derived(stimmbare(alleBloecke));

	const offeneStimmen = $derived(
		stimmbareParteien.filter((p) => stimmstand(p.bisher) === 'offen')
	);

	/**
	 * Der erste Block, für den noch nichts erfasst ist: dort steht der Hinweis
	 * auf die Änderbarkeit, und nur dort.
	 *
	 * Die Regel steht in `domain/stimmblock.ts` und übergeht gesperrte Parteien;
	 * hier stand sie einmal ohne diesen Filter, und dann fiel der Hinweis ganz
	 * weg, sobald die eigene Partei im Ausstand war. Warum, steht dort, samt der
	 * Probe, die es rot macht.
	 */
	const ersterOffenerBlock = $derived(ersteOffene(alleBloecke));

	/** Wie viele der hier ausübbaren Stimmen abgegeben sind. */
	const abgegebeneStimmen = $derived(
		stimmbareParteien.filter((p) => stimmstand(p.bisher) !== 'offen').length
	);

	/**
	 * **Der Teilstand**: etwas ist abgegeben, etwas fehlt noch.
	 *
	 * Die Betriebsart gehört in die Bedingung (Code-Review 06.09.2026). In der
	 * **einfachen** Führung erfasst die Sitzungsleitung die Stimmen; Wahlknöpfe
	 * gibt es auf diesem Gerät keine. Der Hinweis «noch offen» wäre dort eine
	 * Aufforderung zu etwas, das die lesende Person gar nicht tun kann.
	 */
	const teilstand = $derived(
		data.versammlung?.betriebsart === 'gefuehrt' &&
			offeneStimmen.length > 0 &&
			abgegebeneStimmen > 0
	);

	/**
	 * Alle hier ausübbaren Stimmen sind abgegeben.
	 *
	 * Nicht über `bereitsGestimmt` zu haben: Das liest allein die **eigene**
	 * Partei. Ist sie gesperrt oder uneinheitlich erfasst, wäre es `null`, und
	 * nach der letzten Vollmachtstimme stünde überhaupt nichts mehr da.
	 */
	const alleErfasst = $derived(
		stimmbareParteien.length > 1 && offeneStimmen.length === 0 && abgegebeneStimmen > 0
	);

	function wahlName(w: string): string {
		return w === 'yes' ? 'Ja' : w === 'no' ? 'Nein' : 'Enthaltung';
	}


	const MONATE = [
		'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
		'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
	];

	function datumLang(iso: string): string {
		const [j, m, t] = iso.split('-').map(Number);
		return j && m && t ? `${t}. ${MONATE[m - 1]} ${j}` : iso;
	}
</script>

<svelte:window
	onsubmit={(e) => {
		if (!e.defaultPrevented) letzterSubmit = Date.now();
	}}
/>

<svelte:head>
	<!--
		**Der Reitertitel sagt dasselbe wie die Überschrift** (Code-Review
		06.09.2026). Wer das Telefon Tage später wieder ansieht, liest zuerst
		Reiter, Verlauf oder Lesezeichen — dort stand weiter «Zugang zur
		Versammlung», während die Seite selbst schon den beendeten Abend zeigte.
	-->
	<title>
		{data.angemeldet === false && data.nachschau && !data.kartewartet
			? `Versammlung vom ${datumLang(data.nachschau.datum)}`
			: 'Zugang zur Versammlung'}
	</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if data.kartewartet}
	<!--
		**Der gescannte Code wartet auf diesen POST** (FP-1, 12.11.2026).
		Der Code steht weder in der Adresse noch in diesen Daten, sondern nur im
		`httpOnly`-Keks; die Aktion liest ihn dort. Mit JavaScript schickt
		`onMount` das Formular von selbst ab, ohne JavaScript steht der Knopf da
		und sendet klassisch. Die Verzweigung steht vor beiden Sichten: Ein
		vorgemerkter Code gilt auch, wenn dieses Gerät schon angemeldet ist; der
		Scan wechselt dann den Zugang, wie es der bisherige Weg tat.

		**Zwei Formulare, ein Ziel** (FP-1b, 12.11.2026). Das erste trägt das
		Kennzeichen `auto` und keinen Knopf: Nur `onMount` schickt es ab, und
		nur so erfährt der Server, dass der Anstoss und nicht die Person sendet.
		Das zweite ist der Knopf. Er schickt kein `auto`, auch ohne JavaScript
		nicht, denn dort wird das erste Formular nie abgeschickt. Das Formular
		des Anstosses läuft über `use:enhance`: Ohne das antwortete der Server
		mit einer ganzen Seite, und `onMount` schickte sie gleich wieder ab.
	-->
	<section class="karte">
		<h1>Zugang zur Versammlung</h1>
		<!--
			**Der Satz vor dem Tipp.** «Ihre Karte ist bereit» stimmt in beiden
			Lagen; «wird angemeldet» wäre ohne JavaScript falsch, weil dort
			nichts von selbst geschieht. Erst die Antwort des Anstosses sagt,
			dass der Knopf gedrückt werden muss.
		-->
		<p class="hilfe" aria-live="polite">
			{#if tippen}
				Ihre Karte ist bereit. Tippen Sie auf «Anmelden».
			{:else}
				Ihre Karte ist bereit.
			{/if}
		</p>
		<form method="POST" action="?/karte" use:enhance bind:this={anstossformular}>
			<input type="hidden" name="auto" value="1" />
		</form>
		<form method="POST" action="?/karte" use:enhance>
			<button type="submit">Anmelden</button>
		</form>
	</section>
{:else if !data.angemeldet}
	<section class="karte">
		<!--
			**Der Schlussbildschirm nennt seinen Tag** (Bedienbarkeitsprüfung
			05.09.2026, Befund 11 der Telefonsicht). Nach dem Ende trug diese Seite
			weiter die Überschrift «Zugang zur Versammlung» und darunter eine Liste
			von Beschlüssen, ohne Angabe, wozu sie gehören.

			**Den Namen der Gemeinschaft trägt sie nicht** (Produktentscheid
			06.09.2026): Die Zusicherung weiter unten gilt weiter, und
			Gemeinschaftsnamen enthalten im Bestand regelmässig die Strasse. Das
			Datum ordnet ein, ohne das Haus zu nennen.

			Vor dem Ende bleibt die alte Überschrift richtig: Dort geht es
			tatsächlich um den Zugang.
		-->
		{#if data.nachschau}
			<h1>Versammlung vom {datumLang(data.nachschau.datum)}</h1>
			<p class="einordnung">Der Abend ist beendet.</p>
		{:else}
			<h1>Zugang zur Versammlung</h1>
		{/if}

		{#if data.grund}
			<!--
				**Dieselbe Meldung wie im angemeldeten Zweig — und derselbe Weg
				hinaus.** Wer über Authentik hereinkommt, sieht «Ihr anderes Gerät
				wurde abgemeldet»; hängt der Grund am Adressparameter, nimmt der
				Schliessknopf ihn mit (21.08.2026: «Es geht darum, dass der Balken
				nach dem Login weg kann, wenn man ihn gelesen hat»).
			-->
			<!--
				**Der Abschluss ist kein Fehler** (04.09.2026). Solange die Nachschau
				greift, steht darunter der Verlauf des Abends; eine Absage in
				Fehlerfarbe darüber wäre dann die falsche Ansage. «Warnung» sagt, dass
				hier etwas zu Ende ist, ohne dass jemand etwas falsch gemacht hätte.
			-->
			<Meldung
				ton={data.belegt || data.nachschau ? 'warnung' : 'fehler'}
				marke={data}
				beimSchliessen={() => {
					const ohne = new URL(window.location.href);
					ohne.searchParams.delete('stand');
					history.replaceState(history.state, '', ohne);
				}}
			>
				{data.grund}
			</Meldung>
			{#if data.andereKennung}
				<!--
					**Nach diesem Fehlschlag hilft nur ein anderes Konto.** «Zu Ihrem
					Konto ist keine offene Versammlung eingetragen» heisst in der
					Praxis fast immer: Es kam die falsche Kennung zurück, weil im
					Browser schon eine Anmeldung offen war.
				-->
				<p class="wiederholen">
					<a class="knopf" href="/z/authentik?anderes=1" data-sveltekit-reload>
						Mit einem anderen Konto anmelden
					</a>
				</p>
			{/if}
		{/if}
		<!--
			**Die Nachschau: eine Stunde nach dem Schluss** (04.09.2026, Produktentscheid).
			Bis dahin endete der Abend hier mit einer rot hinterlegten
			Absage — nach zwei Stunden Abstimmen ein Hinauswurf in Fehlerfarbe, und
			ohne ein Wort darüber, was insgesamt beschlossen wurde.

			**Dieselbe Frist wie beim Anzeigecode der Leinwand**, und dieselben
			Angaben: Nummer, Titel, Ergebnis. Kein Name, keine Stimmkraft, nicht die
			eigene Stimme. Wer das Telefon nach dem Abend findet, soll nicht lesen
			können, wem es gehört.

			**Nur zeigen, nicht handeln.** Der Zugang gilt serverseitig als
			ungültig; alle acht Aktionen dieser Seite prüfen darauf und weisen ab.
		-->
		{#if data.nachschau}
			<div class="ich verlauf">
				<h2>Was an diesem Abend beschlossen wurde</h2>
				{#if data.nachschau.verlauf.length > 0}
					<ol>
						{#each data.nachschau.verlauf as z (z.id)}
							<li>
								<span class="was"><strong>{z.nummer}</strong> {z.titel}</span>
								<span class="wie" class:ja={z.angenommen === true}>
									{z.angenommen === null
										? 'ohne Beschluss'
										: z.angenommen
											? 'angenommen'
											: 'abgelehnt'}
								</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p>Es wurde über keinen Antrag abgestimmt.</p>
				{/if}
				<!--
					**Wer das Protokoll schickt** (Bedienbarkeitsprüfung 05.09.2026,
					Befund 10 der Telefonsicht): «Der Abschlussbildschirm sagt ‹Der
					Wortlaut steht im Protokoll› — ohne Link, ohne Angabe, wie man es
					bekommt.»

					Einen Link gibt es nicht und soll es hier nicht geben: Diese Sicht
					trägt bewusst weder Gemeinschaftsnamen noch Bewirtschaftung
					(Produktentscheid 06.09.2026, siehe `+page.server.ts`) — wer das
					Telefon nach dem Abend findet, soll nicht lesen können, wem es
					gehört. Was fehlte, ist deshalb nicht die Adresse, sondern die
					Auskunft, dass man überhaupt jemanden fragen kann und wen.

					Und ausdrücklich, dass diese Anwendung es **nicht** verschickt:
					Sonst wartet jemand auf eine Nachricht, die von hier nie kommt.
				-->
				<p class="klein">
					Der Wortlaut der Beschlüsse steht im Protokoll. Es kommt von Ihrer Bewirtschaftung,
					nicht aus dieser Anwendung. Bleibt es aus, fragen Sie dort nach.
				</p>
				<p class="klein">
					Wie einzelne Personen gestimmt haben, steht im Protokoll ebenso wenig wie hier.
				</p>
			</div>
		{/if}

		{#if data.beendet}
			<!--
				Der Weg zurück als Angebot, nicht als Nebenwirkung: Solange er nicht
				gewählt ist, bleibt oben die Auskunft stehen, warum der Zugang zu Ende
				ist. Sonst stünde dort nach dem nächsten Nachladen wieder eine
				Aufforderung, einen Code einzutippen, der nichts mehr öffnet.
			-->
			<form method="POST" action="?/vergessen">
				<button type="submit" class="leise">Anderen Zugang eingeben</button>
			</form>
		{/if}
		{#if fehler}
			<!-- «Belegt» ist kein Fehler der Person: Ihr Code stimmt. Deshalb in
			     anderer Farbe und mit dem Weg heraus, statt mit der Aufforderung,
			     genauer abzutippen. -->
			<Meldung ton={belegt ? 'warnung' : 'fehler'} marke={form}>{fehler.nachricht}</Meldung>
		{/if}

		{#if !data.beendet}
		{#snippet kontoweg()}
			<!--
				Der bequeme Weg steht oben, der immer mögliche darunter — nie
				umgekehrt und nie allein. Wer sein Konto nicht hat oder wessen Telefon
				gerade kein Netz findet, muss die Karte benutzen können, ohne dafür
				erst etwas wegzuklicken (AD-9).
			-->
			<p class="hilfe">
				Melden Sie sich mit Ihrem eigenen Konto an — dann brauchen Sie keine Karte.
			</p>
			<a class="knopf" href="/z/authentik" data-sveltekit-reload>Mit meinem Konto anmelden</a>
			<!--
				**Der Ausweg aus der stillen Anmeldung.**

				Authentik nimmt die Sitzung, die im Browser schon offen ist — im
				Regelfall richtig, im Ausnahmefall eine Sackgasse: Wer als
				Bewirtschaftung angemeldet ist, bekommt hier seine
				Bewirtschaftungs-Kennung zurück, und die steht in keinem der bei der
				Freigabe festgehaltenen Stände. Ein zweiter Versuch führt an dieselbe Wand, weil die
				Sitzung dieselbe bleibt.

				Deshalb steht der Weg klein daneben — und nach einem Fehlschlag
				gross in der Meldung.
			-->
			<p class="anderes">
				<a href="/z/authentik?anderes=1" data-sveltekit-reload>Mit einem anderen Konto</a>
			</p>
		{/snippet}

		<!--
			**Nach einer Absage steht das Codefeld oben** (Bedienbarkeitsprüfung
			05.09.2026, Befund 9 der Telefonsicht): «Beim zweiten Gerät ist die
			Meldung gut, aber darunter stehen drei Konto-Angebote, bevor ‹oder› und
			das Codefeld kommen. Der grösste Knopf führt weg von der Lösung.»

			Der Fall ist genau bestimmbar: Wer eine Absage auf einen eingetippten
			Code liest, **hat** eine Karte in der Hand. Für ihn ist das
			Konto-Angebot nicht der bequeme Weg, sondern der falsche — es führt
			(bei «belegt») an dieselbe Wand zurück.

			AD-9 bleibt gewahrt: Der Kartenweg steht weiterhin nie allein, und der
			Kontoweg verschwindet nicht, er rückt nach unten. Ohne Absage bleibt es
			bei der bisherigen Reihenfolge, weil dort die Begründung von oben gilt.
		-->
		{#if data.authentik && !fehler}
			{@render kontoweg()}
			<p class="oder">oder</p>
		{/if}

		<p class="hilfe">
			Tippen Sie den Code von Ihrer Zugangskarte ein. Gross- und Kleinschreibung und die
			Bindestriche spielen keine Rolle.
		</p>

		<form method="POST" action="?/einloesen">
			<label>
				Zugangscode
				<input
					name="code"
					{...anfangswert(eingabe)}
					placeholder="ABCD-EFGH-JKMN-PQRS-TWXY"
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					inputmode="text"
					required
				/>
			</label>
			<button type="submit">Weiter</button>
		</form>

		<p class="hilfe klein">
			Schneller geht es, wenn Sie den QR-Code auf Ihrer Karte mit der Kamera Ihres Telefons
			erfassen. Ohne Karte wenden Sie sich an die Sitzungsleitung.
		</p>

		{#if data.authentik && fehler}
			<p class="oder">oder</p>
			{@render kontoweg()}
		{/if}
		{/if}
	</section>
{:else}
	<section class="karte">
		{#if data.hinweis}
			<!--
				**Was beim Anmelden nebenbei geschah.** Steht zuoberst, weil es die
				einzige Auskunft auf dieser Seite ist, die sich auf ein anderes Gerät
				bezieht — und weil sie sonst niemand sucht.
			-->
			<Meldung
				ton="warnung"
				marke={data}
				beimSchliessen={() => {
					/*
					 * **Den Grund wegnehmen, nicht nur die Anzeige.** Der Hinweis hängt
					 * am Adressparameter `?stand=uebernommen`; ohne diese Zeile stünde
					 * er beim nächsten Laden wieder da — gemeldet am 21.08.2026 («Der
					 * rote Balken lässt sich weiterhin nicht entfernen»).
					 *
					 * `replaceState` und kein Neuladen: Die Seite bleibt stehen, wie sie
					 * ist, und der Eintrag im Verlauf des Browsers wird ersetzt statt
					 * ergänzt — sonst führte der Zurück-Knopf in dieselbe Meldung.
					 */
					const ohne = new URL(window.location.href);
					ohne.searchParams.delete('stand');
					history.replaceState(history.state, '', ohne);
				}}
			>
				{data.hinweis}
			</Meldung>
		{/if}
		<!--
			**Solange abgestimmt wird, schrumpft der Kopf** (Bedienbarkeitsprüfung
			05.09.2026, Befund 8 der Telefonsicht): «Bis zur Frage sind rund 1200
			Pixel zu scrollen.»

			Was hier steht, ordnet ein: Gemeinschaft, wer erkannt wurde, wann und wo.
			Beim Ankommen ist das genau richtig — es beantwortet «bin ich hier
			richtig, und bin **ich** es». Während einer laufenden Abstimmung ist es
			der Grund, warum man die Frage nicht sieht: Wer im Saal sitzt, weiss
			Datum und Ort.

			**Der Gruss bleibt**, nur kleiner. Er beantwortet die eine Frage, die
			auch mitten in der Abstimmung zählt: ob man auf dem eigenen Telefon
			stimmt und nicht auf dem des Nachbarn. Datum und Ort verschwinden, bis
			die Abstimmung vorbei ist.

			Der Dreischritt darunter bleibt unverändert — er ist ein Produktentscheid
			vom 06.09.2026 (Befund 12 der Telefonsicht).
		-->
		<p class="oben">{data.gemeinschaftName}</p>
		<h1 class:knapp={stimmtGerade}>Guten Tag, {data.ich.ausgeuebtDurch}</h1>

		{#if !stimmtGerade}
			<p class="wann">
				Versammlung vom {datumLang(data.versammlung.datum)}, {data.versammlung.uhrzeit} Uhr<br />
				{data.versammlung.ort}
			</p>
		{/if}

		<!--
			**Die Frage steht zuoberst** (20.08.2026).

			Gemeldet mit einem Bild vom eigenen Telefon: «Die Abstimmung-Kachel soll
			eins höher sein. Also nach dem Titel. Sonst sieht man die Frage nicht und
			muss scrollen.» Dazwischen stand die Kontrollkarte «Sie sind erkannt
			als» — sie ist beim Anmelden wichtig und beim Abstimmen im Weg.

			Die Karte bleibt, sie rückt nur nach unten: Wer prüfen will, ob seine
			Stimmkraft stimmt, tut das vor der Abstimmung; wer abstimmt, will die
			Frage sehen, ohne zu schieben. Dasselbe gilt für das verkündete
			Ergebnis — was gerade zählt, steht oben.
		-->
		{#if fehler}
			<Meldung ton="fehler" marke={form}>{fehler.nachricht}</Meldung>
		{:else if hinweis}
			<Meldung ton="gut" marke={form}>{hinweis}</Meldung>
		{/if}

		<!--
			**Wo die Versammlung steht** (04.09.2026, Produktentscheid).

			Ist ein Traktandum aufgerufen, aber noch keine Abstimmung offen, stand
			hier bisher nur «Sie sind als anwesend erfasst». Während der Diskussion,
			also genau dann, wenn jemand nachlesen möchte, worum es geht, war der
			Bildschirm leer; bei Traktanden ohne Abstimmung erfuhr man über das Gerät
			nie, wo die Versammlung steht.

			**Nummer und Titel, nicht der Antragstext.** Der Wortlaut steht an der
			Leinwand; das Gerät ordnet ein. Dieselbe Dreiteilung führt die
			Sitzungsleitung unter «Ablauf», dort mit Knöpfen — hier ohne, denn die
			Eigentümerin steuert nichts.

			**Bei offener Abstimmung steht er unter der Frage, nicht darüber**
			(Bedienbarkeitsprüfung 05.09.2026). Der Entscheid vom 20.08.2026 lautet
			«die Frage steht zuoberst» (Auftraggeber, mit einem Bild vom eigenen Telefon:
			«Sonst sieht man die Frage nicht und muss scrollen») — und genau das war
			wieder eingetreten, seit dieser Block am 04.09.2026 davor kam. Der Prüfer
			mass rund 1200 Pixel bis zur Frage, und nach jedem Knopfdruck sprang die
			Seite an den Anfang zurück.

			Beide Entscheide gelten weiter; sie unterscheiden sich nur darin, was in
			welcher Lage oben gehört. Läuft keine Abstimmung, ist die Einordnung das
			Wichtigste. Läuft eine, ist es die Frage.
		-->
		{#snippet wostehtes(schritt: NonNullable<typeof data.dreischritt>)}
			<ol class="dreischritt" aria-label="Wo die Versammlung steht">
				<li class="vorher">
					<span class="rolle">vorher</span>
					{#if schritt.vorheriges}
						<span><strong>{schritt.vorheriges.nummer}</strong> {schritt.vorheriges.titel}</span>
					{:else}
						<span class="leer">Der Abend beginnt</span>
					{/if}
				</li>
				<li class="jetzt">
					<span class="rolle">jetzt</span>
					{#if schritt.jetzt}
						<span><strong>{schritt.jetzt.nummer}</strong> {schritt.jetzt.titel}</span>
					{/if}
				</li>
				<li class="nachher">
					<span class="rolle">nachher</span>
					{#if schritt.naechstes}
						<span><strong>{schritt.naechstes.nummer}</strong> {schritt.naechstes.titel}</span>
					{:else}
						<span class="leer">Das letzte Geschäft</span>
					{/if}
				</li>
			</ol>
		{/snippet}

		{#if data.dreischritt && !stimmtGerade}
			{@render wostehtes(data.dreischritt)}
		{/if}

		{#if data.versammlung.pause}
			<!-- ── Pause ────────────────────────────────────────────────────────
				**Vor allem anderen** (Migration 073). Unterbricht die Sitzungsleitung,
				verschwinden die Wahlknöpfe: Sonst gäbe jemand mit offener Seite seine
				Stimme in die Pause hinein ab, während im Saal niemand hinschaut.

				Die Abstimmung ist nicht geschlossen — wer schon gestimmt hat, behält
				seine Stimme, und nach der Pause geht es weiter. Genau das steht hier,
				damit niemand glaubt, seine Stimme sei verloren.
			-->
			<section class="pause">
				<h2>Pause</h2>
				{#if data.versammlung.pause.text}
					<p class="satz">{data.versammlung.pause.text}</p>
				{/if}
				<p class="klein">
					Die Sitzungsleitung hat unterbrochen. {#if data.abstimmung}Die Abstimmung läuft
						weiter, sobald es weitergeht — was Sie bereits abgegeben haben, bleibt
						erfasst.{:else}Es geht gleich weiter.{/if}
				</p>
			</section>
		{:else if data.abstimmung && data.zustand === 'anwesend'}
			<!-- ── Abstimmen (Story 5.7, FR-38) ──────────────────────────────── -->
			<section class="abstimmung">
				<p class="traktandum">{data.abstimmung.titel}</p>
				<!-- Die Frage im Wortlaut steht darüber. Ohne sichtbare Frage keine
				     Stimmabgabe: Der Server nimmt nur an, was zur offenen Abstimmung
				     gehört. -->
				<h2>{data.abstimmung.frage || 'Abstimmung'}</h2>
				<!--
					**Was nötig ist, vor der Abstimmung** (04.09.2026, aus dem
					Prüfdurchgang der Eigentümersicht). Hier stand allein der Fallname,
					etwa «Gewöhnliche Verwaltungshandlung»; der erklärende Satz kam erst
					im Ergebnis, also nachdem entschieden war. Wer wissen will, ob seine
					Stimme etwas bewirken kann, braucht die Auskunft vorher.

					Derselbe Satz steht an der Wand: Beide kommen aus
					`holeMehrheitsvorschau`.
				-->
				{#if data.abstimmung.erfordernis}
					<p class="klein">{data.abstimmung.erfordernis}</p>
				{/if}
				<!--
					**Dass zum zweiten Mal abgestimmt wird, steht hier** (Bedienbarkeits-
					prüfung 05.09.2026, Befund 4 der Telefonsicht). Die Karte war im
					zweiten Durchgang wortwörtlich dieselbe wie im ersten, während
					fünfzehn Zentimeter tiefer noch das alte Ergebnis stand. Der Satz
					dazu gab es, aber nur auf dem Leitungsschirm.

					Er steht über den Wahlknöpfen und nicht bei den Ergebnissen weiter
					unten: Wer gleich drückt, muss vorher wissen, worüber.
				-->
				{#if data.abstimmung.stattAntrag}
					<!--
						**Nach dem Rückkommen über einen Folgeantrag** (Produktentscheid
						30.09.2026). Anders als beim selben Antrag lässt sich der bisherige
						Beschluss hier mit keinem Knopf behalten: Ein Ja setzt diesen Antrag
						an seine Stelle, ein Nein hebt ihn ebenfalls auf. Das muss vor dem
						Drücken dastehen.
					-->
					<!--
						Die Folge zuerst und fett (Laienprüfung 30.09.2026, Stelle 3): Wer die
						ganze Sache will, drückt sonst aus Gewohnheit Nein und meint, das Alte
						bleibe. Ja und Nein je in einem eigenen Satz, ohne «ihn» mit
						unklarem Bezug.
					-->
					<p class="klein nochmals">
						{#if data.abstimmung.stattAntrag.lage === 'angenommen'}
							<strong
								>Den bisherigen Beschluss zu Traktandum {data.abstimmung.stattAntrag.titel} können Sie in
								dieser Abstimmung mit keinem Knopf behalten.</strong
							>
							Nach einem Rückkommen wird über diesen Antrag abgestimmt statt über den bisherigen,
							der angenommen war. Ja: Dieser Antrag gilt an seiner Stelle. Nein: Keiner der beiden
							gilt mehr. Auch eine Enthaltung hält den bisherigen Beschluss nicht.
						{:else if data.abstimmung.stattAntrag.lage === 'abgelehnt'}
							<strong
								>Nach einem Rückkommen wird über diesen Antrag abgestimmt statt über den bisherigen
								zu Traktandum {data.abstimmung.stattAntrag.titel}, der abgelehnt war.</strong
							>
							Ja: Dieser Antrag gilt. Nein: Es bleibt bei einer Ablehnung.
						{:else}
							<strong
								>Nach einem Rückkommen wird über diesen Antrag abgestimmt statt über den bisherigen
								zu Traktandum {data.abstimmung.stattAntrag.titel}.</strong
							>
							Dieser Durchgang entscheidet die Sache neu, mit Ja wie mit Nein.
						{/if}
					</p>
				{:else if data.abstimmung.zuvor}
					<p class="klein nochmals">
						<strong>Es wird ein zweites Mal über dieselbe Sache abgestimmt.</strong>
						{#if data.abstimmung.zuvor.lage === 'angenommen'}
							Beim letzten Mal wurde sie angenommen.
						{:else if data.abstimmung.zuvor.lage === 'abgelehnt'}
							Beim letzten Mal wurde sie abgelehnt.
						{/if}
						<!--
							Ja und Nein zählen: Eine Ablehnung ersetzt den bisherigen
							Beschluss (Produktentscheid 30.09.2026, «Nein heisst Nein»,
							`docs/freigabe.md`, Punkt (a)). Bis dahin stand hier «kommt
							kein Beschluss zustande, bleibt der bisherige in Kraft», und
							wer Nein drückte, hielt den Beschluss damit fest.
						-->
						{#if data.abstimmung.zuvor.lage === 'angenommen'}
							Dieser Durchgang entscheidet neu, mit Ja wie mit Nein: Wird der Antrag
							diesmal abgelehnt, entfällt der bisherige Beschluss. Wer ihn behalten
							will, stimmt Ja; eine Enthaltung hält ihn nicht.
							<!-- Fachprüfung 30.09.2026, F-7: Bis dahin hielt eine Enthaltung den
							     Beschluss fest, jetzt nur noch ein Ja. -->
						{:else}
							Dieser Durchgang entscheidet neu, mit Ja wie mit Nein.
						{/if}
					</p>
				{/if}
				{#if data.abstimmung.noetig}
					<p class="klein noetig">
						{data.abstimmung.noetig}
						{#if data.abstimmung.noetigWandert}
							<span class="wandert">
								Die Zahl verschiebt sich, wenn jemand später dazukommt.
							</span>
						{/if}
						{#if data.abstimmung.ausstandsgrund}
							<!--
								Befund 15: Auch hier sieht man die eine Zahl fallen und die andere
								stehen bleiben. Im selben Absatz und nicht darunter — er erklärt
								genau die Zahl darüber, und auf dem Telefon ist jeder eigene Block
								ein Grund mehr zu scrollen.
							-->
							<span class="wandert">{data.abstimmung.ausstandsgrund}</span>
						{/if}
					</p>
				{/if}
				{#if data.abstimmung.geheim}
					<!--
						**Die Information vor der Abstimmung** (DSG Art. 19;
						Fachprüfung 28.09.2026, F-5). Sie muss vor dem Drücken
						dastehen, nicht im Ergebnis danach.
					-->
					<p class="klein geheim">
						Geheime Abstimmung: Protokoll und Anzeigen nennen nur, ob die Mehrheit erreicht
						ist. Wer wie gestimmt hat, sehen nur Verwaltung und Sitzungsleitung; Ihre eigene
						Stimme erhalten Sie dort auf Verlangen. Müssen Sie als Betroffene zustimmen, zählt
						nur Ihre schriftliche Zustimmung vor dem Eröffnen, nicht diese Stimme.
					</p>
				{/if}
				{#if data.abstimmung.konsultativ}
					<!--
						**Vor dem Abstimmen, nicht im Ergebnis** (Migration 158): Wer jetzt
						drückt, soll wissen, dass daraus kein Beschluss wird.
					-->
					<p class="meldung warnung">{data.abstimmung.konsultativSatz}</p>
				{/if}

				<!--
					**Solange eine Stimme offen ist, steht das hier** (Bedienbarkeits-
					prüfung 05.09.2026, schwerster Befund der Eigentümersicht).

					Wer eine Vollmacht hält, stimmt zuerst für sich. Danach lud die Seite
					neu, sprang an den Anfang, und hier stand «Ihre Stimme ist erfasst» —
					der Block der vertretenen Person aber **531 Pixel unterhalb des
					Bildschirmrands**. Der Prüfer legte das Telefon weg, und die zweite
					Stimme verfiel still: kein Wort vorher, keins beim Schliessen, keins
					danach. Gemessen an einem echten Durchgang, nicht ausgedacht.

					Dazu nannte die Bestätigung nur die **eigene** Stimmkraft, auch wenn
					längst zwei Stimmen abgegeben waren. Sie nennt jetzt keine Summe mehr
					(warum nicht, steht weiter unten), sondern die Zahl der Stimmen und
					den Namen der Person, für die eine fehlt.

					**Der Hinweis muss dorthin, wo die Bestätigung steht** — er ersetzt
					sie, solange etwas fehlt. Ein Kasten weiter unten wäre genau der
					Fehler, den er behebt.
				-->
				{#if teilstand}
					<p class="fehlt" role="status">
						<strong
							>{abgegebeneStimmen} von {stimmbareParteien.length} Stimmen abgegeben.</strong
						><br />
						Noch offen: {aufzaehlung(
							offeneStimmen.map((p) => (p.eigene ? 'Ihre eigene Stimme' : p.name))
						)}.
					</p>
				{:else if abgegebeneStimmen > 0 || bereitsGestimmt}
					<p class="bestaetigt" role="status">
						{#if alleErfasst}
							<!--
								**Keine Summe über mehrere Stimmen.** Die Bestätigung nannte hier
								«1 Kopfstimme und 235 von 1000 Wertquoten», auch wenn das Gerät
								zwei Stimmen abgegeben hatte. Die richtige Summe zu nennen hiesse,
								die Stimmkraft je vertretener Partei zu rechnen — die Quote hängt
								an der Einheit, die Kopfstimme an der Zählweise der Gemeinschaft.
								Bis das hier zur Verfügung steht, steht die Zahl an jedem Block
								einzeln, und hier steht nur, was sicher stimmt.
							-->
							<strong>Alle {stimmbareParteien.length} Stimmen sind erfasst.</strong><br />
							Was jede zählt, steht bei ihr.
						{:else if bereitsGestimmt}
							Ihre Stimme ist erfasst: <strong>{wahlName(bereitsGestimmt)}</strong><br />
							Gezählt werden {data.ich.kopfstimmenHier}
							{data.ich.kopfstimmenHier === 1 ? 'Kopfstimme' : 'Kopfstimmen'} und
							{data.ich.wertquote} von {data.ich.gesamtquote} Wertquoten.
						{:else}
							<!--
								**Der dritte Zustand** (Code-Review 06.09.2026, über einen
								Typfehler gefunden). Weder «alle erfasst» noch «Ihre Stimme ist
								erfasst»: In der einfachen Führung erfasst die Sitzungsleitung,
								und dabei kann ein Teilstand entstehen, für den es hier keine
								Aufforderung geben darf. Ebenso, wenn die eigene Partei gesperrt
								oder uneinheitlich erfasst ist. Ohne diesen Zweig behauptete die
								Seite «Alle 2 Stimmen sind erfasst», während erst eine dastand.
							-->
							<strong>{abgegebeneStimmen} von {stimmbareParteien.length} Stimmen erfasst.</strong
							><br />
							Was jede zählt, steht bei ihr.
						{/if}
					</p>
				{/if}

				<!--
					**Der Änderungshinweis hängt am Erfasstsein, nicht am Kasten**
					(Code-Review 06.09.2026). Er stand im Bestätigungszweig und fiel
					damit genau im Teilstand weg — also bei der Gruppe, die mehrere
					Stimmen führt und am ehesten etwas berichtigen muss.
				-->
				{#if abgegebeneStimmen > 0 && data.versammlung.betriebsart === 'gefuehrt'}
					<p class="klein">
						Solange die Abstimmung offen ist, können Sie sie ändern. Die frühere bleibt im
						Verlauf stehen; gezählt wird die letzte.
					</p>
				{/if}

				{#if data.versammlung.betriebsart === 'gefuehrt'}
					<!--
						**Eine Stimme je Partei, je ein eigener Satz Knöpfe.**

						Wer Vollmachten hält, stimmt hier für alle — die eigene zuerst.
						Bewusst **kein** Sammelknopf «alle gleich»: Zwei Vollmachten können
						verschiedene Weisungen tragen, und ein Knopf, der alle auf einmal
						setzt, ist genau dann bequem, wenn er falsch ist. Jede Abgabe geht
						für sich hinaus; bricht die Verbindung, fehlt höchstens eine.
					-->
					{#each data.abstimmung.parteien as p (p.parteiId)}
						{@const gestimmt = einheitlicheWahl(p.bisher)}
						{@const nochNichts = stimmstand(p.bisher) === 'offen'}
						<div class="fuer" class:vertreten={!p.eigene}>
							{#if data.abstimmung.parteien.length > 1}
								<p class="wen">
									{#if p.eigene}
										<strong>Ihre eigene Stimme</strong>
									{:else}
										<strong>{p.name}</strong> — durch Vollmacht
									{/if}
									{#if p.einheiten.length > 0}
										<span class="klein">{p.einheiten.join(', ')}</span>
									{/if}
									<!--
										**Drei Zustände, nicht zwei** (Code-Review 08.09.2026).
										`einheitlicheWahl()` gibt auch dann `null`, wenn für die Einheiten
										einer Partei Verschiedenes erfasst ist. Hier stand dafür
										«noch nicht gestimmt», obwohl die Partei oben als erfasst
										mitzählt: zwei Aussagen über dieselbe Partei auf einem
										Bildschirm. An den Knöpfen war der Fall schon behandelt, in
										dieser Zeile nicht. Wie erreichbar er ist, steht in
										`domain/stimmblock.ts`.
									-->
									{#if gestimmt}
										<span class="klein">erfasst: {wahlName(gestimmt)}</span>
									{:else if nochNichts}
										<span class="klein offen">noch nicht gestimmt</span>
									{:else}
										<span class="klein">für die Einheiten Verschiedenes erfasst</span>
									{/if}
								</p>
							{/if}

							<!--
								**Die Weisung der vertretenen Person.** Sie hebt den Knopf hervor und
								gibt nichts ab: Drücken muss die bevollmächtigte Person selbst. Bezog
								sie sich auf einen inzwischen geänderten Antrag, steht das hier — und
								die Hervorhebung fällt weg.
							-->
							{#if p.weisung}
								<p class="weisung" class:ueberholt={!p.weisung.gilt}>{p.weisung.satz}</p>
							{/if}

							<!--
								**Bei diesem Traktandum ausgeschlossen.** Statt drei Knöpfen, die alle
								in dieselbe Absage laufen, steht hier der Grund. Der Server verschliesst
								es ohnehin; hier steht es, bevor jemand drückt.
							-->
							<!--
								**Das Veto ersetzt die gesperrte Stimme** (26.09.2026, Auftrag
								«Veto im Ausstand»). Wer betroffen und im Ausstand ist, stimmt bei
								der Mehrheit nicht mit; über die Zustimmung entscheidet sie
								trotzdem selbst, am Telefon oder mündlich über die
								Sitzungsleitung. Der Block trägt beide Aussagen, damit niemand die
								Knöpfe für Stimmknöpfe hält.
							-->
							{#if p.veto}
								<div class="veto">
									<p class="klein">
										{p.name} ist im Ausstand und darf bei diesem Traktandum nicht mitstimmen.
										Ob sie zustimmt, entscheidet sie trotzdem, selbst oder durch ihre
										Vertretung, solange die Abstimmung läuft. Ohne ihre Zustimmung ist der
										Antrag abgelehnt: Wird nichts gewählt und liegt keine vermerkte
										schriftliche Zustimmung vor, gilt das wie «Nicht zustimmen». Der Entscheid zählt nur
										für die Zustimmung, nie bei der Mehrheit.
									</p>
									<!--
										Der Vorab-Vermerk steht auch hier, nicht nur bei der Leitung:
										Wer «Nicht zustimmen» wählt, hebt eine unterschriebene Zustimmung
										auf, auch als Vertretung (Laienprüfung Runde 3, V).
									-->
									{#if p.veto.vorab}
										<p class="klein">
											Vorab schriftlich zugestimmt (vermerkt). Wählen Sie «Nicht zustimmen», zählt
											diese Zustimmung nicht mehr.
										</p>
									{/if}
									{#if p.veto.entscheid}
										<p class="klein erfasst">
											Entscheid: {p.veto.entscheid === 'ja' ? 'Zustimmung' : 'keine Zustimmung'}
											({p.veto.weg === 'leitung'
												? 'mündlich, von der Sitzungsleitung erfasst'
												: p.veto.durchVertretung
													? 'durch die Vertretung'
													: 'am eigenen Gerät'}). Lässt sich bis zum Schliessen ändern.
										</p>
									{/if}
									<form
										method="POST"
										action="?/veto"
										class="wahl"
										use:enhance={absenden({
											laufend: (marke) => {
												if (marke === null) {
													abgebende.delete(p.parteiId);
													return;
												}
												letzterSubmit = Date.now();
												abgebende.add(p.parteiId);
											},
											danach: async () => {
												abgebende.delete(p.parteiId);
												await tick();
											}
										})}
									>
										<input type="hidden" name="durchgang" value={data.abstimmung.durchgangId} />
										<input type="hidden" name="partei" value={p.parteiId} />
										<button
											type="submit"
											name="entscheid"
											value="ja"
											data-fokus="veto:{p.parteiId}:ja"
											disabled={abgebende.has(p.parteiId)}
											data-vorgabe="Zustimmen"
											class:gewaehlt={p.veto.entscheid === 'ja'}>Zustimmen</button
										>
										<button
											type="submit"
											name="entscheid"
											value="nein"
											data-fokus="veto:{p.parteiId}:nein"
											disabled={abgebende.has(p.parteiId)}
											class="nein"
											class:gewaehlt={p.veto.entscheid === 'nein'}>Nicht zustimmen</button
										>
									</form>
								</div>
							{:else if p.gesperrt}
								<p class="gesperrt">{p.gesperrt}</p>
							{:else}
							<!--
								**Die abgegebene Stimme steht am Knopf** (Bedienbarkeitsprüfung
								05.09.2026, Befund 6 der Telefonsicht): «Nach der Abgabe sehen
								‹Ja›, ‹Nein›, ‹Enthaltung› genau gleich aus wie vorher; kein
								Knopf ist markiert. Bei zwei Blöcken sind das sechs identische
								Knöpfe und zwei unauffällige graue Zeilen.»

								**Kein `aria-pressed`** (Code-Review 06.09.2026): Das verspricht
								einen Umschalter, und wer ihn betätigt, um die Stimme
								zurückzunehmen, gibt sie bloss erneut ab. Drei einander
								ausschliessende Möglichkeiten sind eine Auswahl; `aria-current`
								sagt «das gilt gerade», ohne ein Umschalten zu behaupten.

								**`gestimmt` allein genügt nicht**: `einheitlicheWahl()` gibt auch
								dann `null`, wenn für die Einheiten einer Partei Verschiedenes
								erfasst ist (Kommentar bei der Funktion). Ohne die zweite Frage
								stünde bei uneinheitlicher Erfassung kein Knopf markiert und
								darunter «lässt sich noch ändern», während der Kasten oben «2 von
								2 Stimmen erfasst» meldet. `nochNichts` steht deshalb oben am
								Block: Seit dem 08.09.2026 braucht auch die Zeile «erfasst /
								noch nicht gestimmt» dieselbe Unterscheidung.
							-->
							<!--
								**`use:enhance`, damit die Seite nicht springt**
								(Bedienbarkeitsprüfung 05.09.2026, Befund 8 der Telefonsicht):
								«Nach jedem Knopfdruck springt die Seite an den Anfang zurück.»

								Im Drehbuch gemessen, bevor und nachdem: 300 px → 0 px. Ohne
								`enhance` sendet das Formular klassisch, der Browser lädt die
								Seite neu, und der Rollstand ist weg. Wer eine Vollmacht hält,
								stimmt danach nicht weiter — der Block der vertretenen Person
								liegt wieder ausserhalb des Bildschirms. Das ist derselbe Weg,
								auf dem am 05.09.2026 eine Stimme verfallen ist.

								**AD-9 bleibt gewahrt.** `use:enhance` ist fortschreitende
								Verbesserung: Ohne JavaScript sendet dasselbe Formular weiterhin
								klassisch, mit demselben Ergebnis. Es entsteht kein Weg, der
								ohne Skript nicht mehr geht.

								**Und die Regel «zwei Klicks sind ein Klick» trifft hier
								nicht falsch**: Ihr Schlüssel enthält Name und Wert des Knopfes,
								und der Name trägt die Partei-Kennung (`wahl:<id>`). Zwei Blöcke
								desselben Geräts sind damit zwei Handlungen; nur derselbe Knopf
								zweimal hintereinander wird zusammengefasst, und genau das soll
								er.
							-->
							<form
								method="POST"
								action="?/stimmen"
								class="wahl"
								use:enhance={absenden({
									laufend: (marke) => {
										if (marke === null) {
											/*
											 * **Das Netz unter dem Fokusgriff** (09.09.2026, aus dem
											 * Sicherheitsdurchgang). Freigegeben wird die Partei
											 * eigentlich in `danach` — aus dem Grund, der dort steht.
											 * Nur läuft `danach` nicht, wenn `update()` wirft, und
											 * dann blieben die Stimmknöpfe dieser Partei **für immer**
											 * gesperrt.
											 *
											 * Bis heute räumte das der Neulade-Takt auf: Alle sechzig
											 * Sekunden baute `location.reload()` die Seite neu, und
											 * mit ihr diesen Zustand. Ein Nachzug tut das nicht — er
											 * holt Daten, er setzt keinen Bauteilzustand zurück.
											 * Genau die zweite Wirkung, die mit dem Neuladen
											 * weggefallen ist.
											 *
											 * `laufend(null)` steht im `finally` von `absenden()` und
											 * läuft deshalb immer. Zweimal freigeben schadet nicht:
											 * `delete` auf einer schon entfernten Kennung tut nichts.
											 */
											abgebende.delete(p.parteiId);
											return;
										}
										// Die Karenz beginnt mit dem Abschicken; gesperrt wird nur
										// währenddessen.
										letzterSubmit = Date.now();
										abgebende.add(p.parteiId);
									},
									/*
									 * **Die Sperre fällt hier und nicht in `laufend`.**
									 *
									 * `laufend(null)` läuft im `finally` von `absenden()`, also
									 * **nach** dem Fokusgriff. Der Knopf wäre dort noch gesperrt,
									 * und `focus()` auf einem gesperrten Element tut nichts — der
									 * Griff scheiterte lautlos, genau wie im Kommentar dort
									 * beschrieben. `danach` liegt davor und wird abgewartet;
									 * `tick()` stellt sicher, dass der Knopf wirklich wieder
									 * bedienbar ist, bevor der Fokus ihn sucht.
									 */
									danach: async () => {
										// Nur die eigene Partei freigeben: Eine fremde Antwort darf
										// eine noch laufende Abgabe nicht entsperren.
										abgebende.delete(p.parteiId);
										await tick();
									}
								})}
							>
								<input type="hidden" name="durchgang" value={data.abstimmung.durchgangId} />
								<button
									type="submit"
									name="wahl:{p.parteiId}"
									value="yes"
									data-fokus="stimme:{p.parteiId}:yes"
									disabled={abgebende.has(p.parteiId)}
									data-vorgabe="Ja"
									class="ja"
									aria-current={gestimmt === 'yes' ? 'true' : undefined}
									class:gewaehlt={gestimmt === 'yes'}
									class:empfohlen={p.weisung?.gilt && p.weisung.wahl === 'ja'}>Ja</button
								>
								<button
									type="submit"
									name="wahl:{p.parteiId}"
									value="no"
									data-fokus="stimme:{p.parteiId}:no"
									disabled={abgebende.has(p.parteiId)}
									class="nein"
									aria-current={gestimmt === 'no' ? 'true' : undefined}
									class:gewaehlt={gestimmt === 'no'}
									class:empfohlen={p.weisung?.gilt && p.weisung.wahl === 'nein'}>Nein</button
								>
								<button
									type="submit"
									name="wahl:{p.parteiId}"
									value="abstain"
									data-fokus="stimme:{p.parteiId}:abstain"
									disabled={abgebende.has(p.parteiId)}
									class="enthaltung"
									aria-current={gestimmt === 'abstain' ? 'true' : undefined}
									class:gewaehlt={gestimmt === 'abstain'}
									class:empfohlen={p.weisung?.gilt && p.weisung.wahl === 'enthaltung'}
								>
									Enthaltung
								</button>
							</form>
							<!--
								**Dass sich die Stimme ändern lässt, steht vor der Abgabe**
								(Befund 7): «Vorher weiss niemand, ob der Druck endgültig ist.»
								Der Satz stand nur im Bestätigungskasten, also erst danach — und
								wer sich nicht traut, drückt gar nicht.

								Nach der Abgabe sagt ihn der Kasten weiter oben; hier steht er
								nur, solange diese Partei noch nicht gestimmt hat.
							-->
							<!--
								**Nur beim ersten offenen Block** (Code-Review 06.09.2026): Bei
								drei Vollmachten stünde derselbe Satz sonst viermal auf einem
								Telefonbildschirm, und sobald eine Partei gestimmt hat, sagt ihn
								der Kasten weiter oben noch einmal in anderen Worten.
							-->
							{#if nochNichts && p.parteiId === ersterOffenerBlock}
								<p class="klein aenderbar">Die Stimme lässt sich bis zum Schliessen ändern.</p>
							{/if}
							{/if}
						</div>
					{/each}
				{:else}
					<!-- In der einfachen Betriebsart wird im Saal abgestimmt und die
					     Sitzungsleitung erfasst. Zwei Wege für dieselbe Stimme wären
					     zwei Stimmen, und welche gilt, liesse sich nicht sagen. Die
					     Frage steht trotzdem hier: Wer sie nachlesen will, muss nicht
					     auf die Leinwand schauen. -->
					<p class="klein saal">
						Abgestimmt wird im Saal durch Handerheben. Die Sitzungsleitung erfasst die Stimmen.
					</p>
				{/if}
			</section>

			<!-- Die Einordnung folgt der Frage, sie geht ihr nicht voraus. -->
			{#if data.dreischritt}
				{@render wostehtes(data.dreischritt)}
			{/if}
		{:else if data.ergebnis}
			<section class="ergebnis" class:angenommen={data.ergebnis.angenommen}>
				<h2>{data.ergebnis.titel}</h2>
				<p class="gross">
					{data.ergebnis.keinBeschluss
						? 'Kein Beschluss'
						: data.ergebnis.angenommen
							? 'Angenommen'
							: 'Abgelehnt'}
				</p>
				<p class="klein">{data.ergebnis.satz}</p>
			</section>
		{/if}

		<div class="ich">
			<h2>Sie sind erkannt als</h2>
			<p class="name">{data.ich.name}</p>
			{#if data.ich.ausgeuebtDurch !== data.ich.name}
				<p class="klein">Die Stimme üben Sie aus.</p>
			{/if}

			<ul>
				{#each data.ich.einheiten as e (e.label)}
					<li>
						<span>{e.label}</span>
						<span class="quote">{e.quote} / {data.ich.gesamtquote}</span>
					</li>
				{/each}
			</ul>

			<p class="summe">
				{#if data.ich.einspracheJeEigentuemer}
					<!--
						A5, Punkt 3: an der Einsprache nach L3 «je Eigentümer» hat die
						Partei eine Stimme, auch mit mehreren Einheiten. Was die
						Bestätigung nach der Stimmabgabe sagt (`kopfstimmenHier`),
						sagt hier schon der Kasten, der zum Prüfen auffordert.
					-->
					{data.ich.kopfstimmenHier}
					{data.ich.kopfstimmenHier === 1 ? 'Kopfstimme' : 'Kopfstimmen'} bei diesem Traktandum:
					eine Stimme je Eigentümer, auch wer mehrere Einheiten hat
				{:else}
					{data.ich.kopfstimmen}
					{data.ich.kopfstimmen === 1 ? 'Kopfstimme' : 'Kopfstimmen'} ·
					{data.ich.wertquote} von {data.ich.gesamtquote} Wertquoten
				{/if}
			</p>
			<p class="klein">
				Stimmt etwas davon nicht, melden Sie sich bei der Sitzungsleitung — <strong>bevor</strong>
				abgestimmt wird.
			</p>
			<!--
				**Die zwei Begriffe, an denen ihr Gewicht hängt** (04.09.2026, aus dem
				Prüfdurchgang der Eigentümersicht). Darüber steht «1 Kopfstimme · 250
				von 1000 Wertquoten», und direkt daneben die Aufforderung, das zu
				prüfen. Erklärt wurden die beiden Wörter nirgends: Eine Abfrage über
				`main` nach `[title]`, `details summary` und `abbr` lieferte in allen
				geprüften Zuständen nichts. Wer soll prüfen, was er nicht versteht?

				Zugeklappt nach Regel 4 aus `docs/gestaltung.md`: Der Hintergrund
				wartet, bis jemand fragt. Kein `display: flex` auf der
				Zusammenfassung, sonst nimmt es ihr das Dreieck.
			-->
			<details class="erklaerung">
				<summary>Was heisst das?</summary>
				{#if data.ich.zaehlweise === 'per_owner'}
					<p>
						<strong>Kopfstimme:</strong> Eine Stimme je Eigentümer, unabhängig davon, wie gross
						die Wohnung ist. Wem zwei Wohnungen gehören, hat trotzdem eine.
					</p>
				{:else}
					<!--
						**Der Satz hängt an der Zählweise** (04.09.2026, aus dem Code-Review).
						Diese Gemeinschaft zählt je Einheit; «eine Stimme je Eigentümer» stünde
						hier unter einer Zeile, die «2 Kopfstimmen» sagt.
					-->
					<p>
						<strong>Kopfstimme:</strong> Eine Stimme je Einheit. Diese Gemeinschaft hat es so
						vereinbart; wem zwei Wohnungen gehören, hat darum zwei.
					</p>
				{/if}
				<p>
					<!--
						Der Nenner steht nicht fest: `quota_denominator` ist je Gemeinschaft
						einstellbar, das Handbuch nennt Hundertstel, Tausendstel und
						Zehntausendstel. Also aus den Daten, nicht aus dem Text.
					-->
					<strong>Wertquote:</strong> Ihr Anteil am ganzen Haus, gezählt von
					{data.ich.gesamtquote}. Er steht im Grundbuch und entscheidet mit, wenn ein
					Beschluss auch eine Mehrheit der Anteile braucht.
				</p>
				<p>
					Je nach Geschäft zählt nur die eine Zahl, manchmal beide. Was gerade gilt, steht bei
					der Abstimmung.
				</p>
			</details>
		</div>

		<!--
			**Der Verlauf des Abends** (04.09.2026, Produktentscheid).

			Bisher zeigte die Seite nur das zuletzt verkündete Ergebnis; beim
			nächsten Geschäft war es weg. Wer am Ende wissen wollte, was insgesamt
			beschlossen wurde, fand nichts — und nach dem Schluss stand hier eine rot
			hinterlegte Absage statt einer Übersicht.

			**Nur verkündete Ergebnisse**, und **ohne die eigene Stimme**: Der
			Nachweis, wie gezählt wurde, ist das Protokoll und nicht dieses Gerät.
			Was hier steht, wurde im Saal ohnehin laut gesagt; die Seite trägt es nur
			zusammen.
		-->
		{#if data.verlauf.length > 0}
			<div class="ich verlauf">
				<h2>Was bisher beschlossen wurde</h2>
				<ol>
					{#each data.verlauf as z (z.id)}
						<li>
							<span class="was"><strong>{z.nummer}</strong> {z.titel}</span>
							<span class="wie" class:ja={z.angenommen === true}>
								{z.angenommen === null ? 'ohne Beschluss' : z.angenommen ? 'angenommen' : 'abgelehnt'}
							</span>
						</li>
					{/each}
				</ol>
				<p class="klein">
					Wie einzelne Personen gestimmt haben, steht hier nicht. Das Protokoll hält fest, wie
					gezählt wurde.
				</p>
			</div>
		{/if}


		{#if data.versammlung.zustand === 'freigegeben'}
			<div class="stand warten">
				<h2>Die Versammlung hat noch nicht begonnen</h2>
				<p>
					Sie beginnt am {datumLang(data.versammlung.datum)} um {data.versammlung.uhrzeit} Uhr in
					{data.versammlung.ort}. Bringen Sie diese Karte mit.
				</p>
			</div>
		{:else if data.zustand === 'anwesend'}
			<div class="stand bereit">
				<h2>Sie sind als anwesend erfasst</h2>
				<p>
					{#if data.versammlung.betriebsart === 'gefuehrt'}
						<!--
							**Der Satz muss zur Lage passen** (20.08.2026). «Sobald eine
							Abstimmung eröffnet wird, erscheint die Frage hier» stand auch
							dann da, wenn die Frage drei Zentimeter weiter oben bereits
							stand — und wer das liest, sucht eine zweite, die es nicht gibt.

							**Und er darf nichts versprechen, was nicht kommt** (11.09.2026,
							vom Auftraggeber im Eingangstest gefunden). Bei einer Partei mit
							Papiervermerk erscheint keine Frage, nie. Derselbe Satz war dort
							also nicht bloss unpassend, sondern falsch — und widerlegt wird
							er erst dadurch, dass nichts geschieht. Wer das erlebt, hält die
							Anwendung für kaputt und ruft an, mitten in der Versammlung.
						-->
						{#if data.abstimmung}
							Die Frage steht oben auf dieser Seite. Lassen Sie sie geöffnet — die nächste
							erscheint von selbst.
						{:else if data.aufPapier}
							<!--
								**Nach `data.abstimmung`, nicht davor** (11.09.2026, im Code-Review
								gefunden). Steht oben ein aufgerufenes Traktandum, sagt es dort selbst,
								warum hier nichts zu tun ist; «auf diesem Gerät erscheint keine Frage»
								widerspräche dem, was drei Zentimeter höher steht.

								**«Für Ihre eigene Stimme»** (zweiter Reviewdurchgang, 11.09.2026): Wer
								selbst auf Papier stimmt, aber eine Vollmacht für eine digitale Partei
								hält, bekommt sehr wohl eine Frage — für die andere. Ob jemand eine
								Vollmacht hält, weiss diese Seite ausserhalb einer offenen Abstimmung
								nicht (`holeAusuebbare` läuft nur dann). Der Satz grenzt sich deshalb auf
								die eigene Stimme ein, statt etwas über die fremde zu behaupten.
							-->
							Sie stimmen an dieser Versammlung von Hand ab. Ihre Stimmen trägt die
							Sitzungsleitung ein; für Ihre eigene Stimme erscheint auf diesem Gerät darum
							keine Frage. Stimmt das nicht, melden Sie sich bei der Sitzungsleitung.
						{:else}
							Sobald eine Abstimmung eröffnet wird, erscheint die Frage hier auf dieser Seite.
							Lassen Sie sie geöffnet.
						{/if}
					{:else}
						Abgestimmt wird im Saal durch Handerheben.
					{/if}
				</p>
			</div>
		{:else if data.zustand === 'wartet'}
			<div class="stand warten">
				<h2>Angemeldet — die Sitzungsleitung bestätigt gleich</h2>
				<p>
					Ihre Anmeldung liegt der Sitzungsleitung vor. Diese Seite wechselt von selbst, sobald sie
					bestätigt ist.
				</p>
			</div>
		{:else}
			<form method="POST" action="?/anmelden" class="anmelden">
				<button type="submit">Jetzt anmelden</button>
				<p class="klein">
					Die Anmeldung ist noch keine Anwesenheit: Die Sitzungsleitung bestätigt sie. Am Eingang
					geht es schneller — dort wird Ihre Karte gescannt.
				</p>
			</form>
		{/if}

		<!--
			**Der zweite Weg von der Einladung aus** (Zusatzblock): «Ich komme nicht.»
			Nur wo die Gemeinschaft ihn freigeschaltet hat, und nur solange die
			Versammlung noch nicht läuft. Wer schon anwesend ist, sieht ihn nicht —
			für den ist die Frage beantwortet.
		-->
		{#if data.selbstvollmacht.erlaubt && data.zustand !== 'anwesend'}
			<section class="vollmacht">
				<h2>Ich kann nicht kommen</h2>

				{#if data.selbstvollmacht.eigene}
					{@const v = data.selbstvollmacht.eigene}
					<p class="erteilt">
						Sie haben <strong>{v.bevollmaechtigtName}</strong> bevollmächtigt.
						{#if v.zustand === 'erfasst'}
							<span class="klein"
								>Die Sitzungsleitung prüft die Vollmacht noch — bis dahin überträgt sie keine
								Stimme.</span
							>
						{:else}
							<span class="klein">Von der Sitzungsleitung bestätigt.</span>
						{/if}
					</p>

					{#if data.selbstvollmacht.aenderbar}
						{#if data.selbstvollmacht.weisungen.length > 0}
							<form method="POST" action="?/weisungen" class="weisungen">
								<h3>Ihre Weisungen</h3>
								<p class="klein">
									Eine Weisung ist eine <strong>Empfehlung</strong>: Sie erscheint auf dem Telefon
									Ihrer bevollmächtigten Person, abgeben muss sie die Stimme selbst. Wo Sie nichts
									ankreuzen, entscheidet sie frei.
								</p>
								{#each data.selbstvollmacht.weisungen as w (w.traktandumId)}
									<fieldset>
										<legend>{w.nummer} {w.titel}</legend>
										<p class="wortlaut">{w.wortlaut}</p>
										<div class="auswahl">
											{#each [['', 'keine Weisung'], ['ja', 'Ja'], ['nein', 'Nein'], ['enthaltung', 'Enthaltung']] as [wert, text] (wert)}
												<label>
													<input
														type="radio"
														name="weisung:{w.traktandumId}"
														value={wert}
														{...angekreuzt((w.wahl ?? '') === wert)}
													/>
													<span>{text}</span>
												</label>
											{/each}
										</div>
									</fieldset>
								{/each}
								<button type="submit">Weisungen speichern</button>
							</form>
						{/if}

						{#if data.selbstvollmacht.widerrufbar}
							<form method="POST" action="?/widerrufen" class="zurueck">
								<button type="submit" class="leise">Vollmacht zurücknehmen</button>
							</form>
						{:else}
							<p class="klein">{data.selbstvollmacht.widerrufGrund}</p>
						{/if}
					{:else}
						<p class="klein">{data.selbstvollmacht.grund}</p>
					{/if}
				{:else if data.selbstvollmacht.aenderbar}
					<p class="klein">
						Bevollmächtigen Sie jemanden, der für Sie abstimmt. Die Sitzungsleitung prüft die
						Vollmacht; erst danach überträgt sie eine Stimme.
					</p>
					<form method="POST" action="?/bevollmaechtigen" class="erteilen">
						<label>
							<span>Wen bevollmächtigen Sie?</span>
							<Suchauswahl
								name="bevollmaechtigt"
								beschriftung="Wen bevollmächtigen Sie?"
								leerText="— eine andere Person, Name unten —"
								eintraege={data.selbstvollmacht.waehlbare.map((w) => ({
									wert: w.id,
									text: w.name
								}))}
							/>
						</label>
						<label>
							<span>Oder der Name einer Person, die nicht Eigentümerin ist</span>
							<input type="text" name="bevollmaechtigtName" autocomplete="off" />
						</label>
						<!-- L8 (Migration 184): Das Häkchen zur Vollmacht der Verwaltung, wie
						     auf der Seite der Sitzungsleitung; hier erklärt der Eigentümer
						     selbst, wem er seine Stimme gegeben hat. M5 (06.11.2026): Der
						     Hilfetext steht in der Konstante. -->
						<label class="verwaltungshaken">
							<input type="checkbox" name="istVerwaltung" value="ja" />
							<span>Bevollmächtigt ist die Verwaltung</span>
						</label>
						<p class="klein">{VERWALTUNG_HAKEN_HILFE_EIGENTUEMER}</p>

						{#if data.selbstvollmacht.weisungen.length > 0}
							<h3>Weisungen (freiwillig)</h3>
							<p class="klein">
								Eine Weisung ist eine <strong>Empfehlung</strong>: Sie erscheint auf dem Telefon
								Ihrer bevollmächtigten Person, abgeben muss sie die Stimme selbst. Wo Sie nichts
								ankreuzen, entscheidet sie frei.
							</p>
							{#each data.selbstvollmacht.weisungen as w (w.traktandumId)}
								<fieldset>
									<legend>{w.nummer} {w.titel}</legend>
									<p class="wortlaut">{w.wortlaut}</p>
									<div class="auswahl">
										{#each [['', 'keine Weisung'], ['ja', 'Ja'], ['nein', 'Nein'], ['enthaltung', 'Enthaltung']] as [wert, text] (wert)}
											<label class="klein">
												<input
													type="radio"
													name="weisung:{w.traktandumId}"
													value={wert}
													{...angekreuzt(wert === '')}
												/>
												<span>{text}</span>
											</label>
										{/each}
									</div>
								</fieldset>
							{/each}
						{/if}

						<button type="submit">Vollmacht erteilen</button>
					</form>
				{:else}
					<p class="klein">{data.selbstvollmacht.grund}</p>
				{/if}
			</section>
		{/if}

		<form method="POST" action="?/abmelden" class="abmelden">
			<button type="submit" class="leise">Auf diesem Gerät abmelden</button>
			<p class="klein">
				Ihr Zugang gilt für <strong>ein</strong> Gerät. Wechseln Sie auf ein anderes, melden Sie
				sich hier zuerst ab — sonst bleibt der Zugang belegt, und nur die Sitzungsleitung kann ihn
				freigeben.
			</p>
		</form>
	</section>
{/if}

<style>
	/*
		Die nötige Mehrheit steht etwas kräftiger als der Fallname darüber: Sie ist
		die Angabe, nach der jemand sucht, der abwägt.
	*/
	/*
	 * `.klein.noetig` und nicht `.noetig` (04.09.2026, aus dem Code-Review):
	 * `.klein` setzt dieselbe Eigenschaft mit gleicher Spezifität und steht
	 * später in der Datei — die einfache Klasse wäre wirkungslos gewesen, und
	 * der Satz bliebe so leise wie der Fallname, den er übertönen soll.
	 */
	.klein.noetig {
		color: var(--text);
	}

	/* Der Vorbehalt leise: Er schränkt die Zahl ein, ersetzt sie aber nicht. */
	.noetig .wandert {
		display: block;
		color: var(--text-leise);
	}

	/*
		**Der Dreischritt, nach dem Vorbild der Sitzungsleitung** (04.09.2026).
		Die Regeln stehen hier und nicht dort: `.dreischritt` ist seitengebunden,
		und Svelte kapselt Stile je Datei. Die Klasse allein bringt nichts mit.

		Das aufgerufene Geschäft steht prominenter als seine Nachbarn, damit ein
		Blick genügt. Am Telefon untereinander, weil nebeneinander drei Titel in
		390 Pixel nicht lesbar wären.
	*/
	.dreischritt {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.dreischritt > li {
		padding: 0.45rem 0.7rem;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}

	.dreischritt > li.jetzt {
		background: color-mix(in srgb, var(--akzent) 18%, transparent);
		border: 1px solid var(--akzent);
		/*
		 * `em` und nicht `rem` (04.09.2026, vom Drehbuch gefangen): Die Liste erbt
		 * 17px, und `1.05rem` sind 16.8px — das «jetzt» wäre kleiner gewesen als
		 * seine Nachbarn, also genau umgekehrt. `em` misst am Elternteil.
		 */
		font-size: 1.15em;
		font-weight: 550;
	}

	.dreischritt .rolle {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-leise);
	}

	.dreischritt .leer {
		color: var(--text-leise);
	}

	/* Der Verlauf: eine Zeile je Geschäft, das Ergebnis rechts. */
	.verlauf ol {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.verlauf li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.verlauf .wie {
		white-space: nowrap;
		font-size: 0.85rem;
		color: var(--text-leise);
	}

	/*
		Angenommen in Akzentfarbe, abgelehnt leise: Die Warnfarbe gehört dem
		Hinweis, der jemanden zum Handeln bringen soll. Ein abgelehnter Antrag ist
		kein Fehler.
	*/
	.verlauf .wie.ja {
		color: var(--akzent);
		font-weight: 550;
	}

	/*
		**Die Regeln müssen hier stehen** (04.09.2026). `.erklaerung` gibt es nur
		seitengebunden in `versammlungen/neu`, und Svelte kapselt Stile je Datei:
		Die Klasse allein bringt nichts mit. Ohne diese Zeilen stünde der
		Ausklapper unformatiert zwischen den Karten.
	*/
	details.erklaerung {
		margin-top: 0.75rem;
		max-width: var(--lesebreite);
	}

	/* Kein `display: flex` auf der Zusammenfassung: Das nähme ihr das Dreieck. */
	details.erklaerung summary {
		cursor: pointer;
	}

	details.erklaerung p {
		margin: 0.4rem 0 0;
	}

	/*
	 * **Beide Klassen stehen hier, weil sie sonst nirgends stehen.**
	 *
	 * `.knopf` ist in dieser Anwendung nicht global, sondern je Seite definiert
	 * (`app.css` kennt nur `.knopfartig`). Ein Verweis mit dieser Klasse sähe
	 * ohne diesen Block wie gewöhnlicher Fliesstext aus — kein Fehler, keine
	 * Warnung, nur ein Knopf, der keiner ist. Dieselbe Klasse Fehler wie auf der
	 * Diensteseite am 17.08.2026.
	 */
	.knopf {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		margin-top: 0.75rem;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		text-decoration: none;
		font-weight: 600;
	}

	/* Klein und daneben: der Regelfall ist der Knopf darüber. */
	.anderes {
		margin: 0.5rem 0 0;
		text-align: center;
		font-size: 0.875rem;
	}

	.wiederholen {
		margin: 0.75rem 0 0;
	}

	.oder {
		margin: 1.25rem 0 0.75rem;
		color: var(--text-leise);
		font-size: 0.875rem;
		text-align: center;
	}

	.vollmacht {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		margin-top: 1.5rem;
		padding: 0.9rem 1rem;
	}

	.vollmacht h2 {
		font-size: 1.05rem;
		margin-top: 0;
	}

	.vollmacht fieldset {
		border: 0;
		border-top: 1px solid var(--linie);
		margin: 0.6rem 0 0;
		padding: 0.6rem 0 0;
	}

	.vollmacht legend {
		font-weight: 600;
		padding: 0;
	}

	.wortlaut {
		font-size: 0.9rem;
		margin: 0.2rem 0 0.5rem;
	}

	/* Genug Fläche für den Daumen: Hier wird auf dem Telefon getippt. */
	.auswahl {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
	}

	.auswahl label {
		align-items: center;
		display: flex;
		gap: 0.35rem;
		min-height: 2.2rem;
	}

	.erteilen,
	.weisungen {
		display: grid;
		gap: 0.6rem;
	}

	.erteilen label > span {
		display: block;
		font-size: 0.9rem;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	.erteilen :global(select),
	.erteilen :global(.auswahlsuche),
	.erteilen input[type='text'] {
		width: 100%;
	}

	/* Wie der Papierhaken im Einlass: ein Häkchen mit Text daneben. */
	.erteilen .verwaltungshaken {
		align-items: center;
		display: flex;
		gap: 0.5rem;
	}

	/* Die Weisung: sichtbar, aber nie wie ein Ergebnis. */
	.weisung {
		background: color-mix(in srgb, var(--akzent) 12%, transparent);
		border-radius: 0.5rem;
		font-size: 0.95rem;
		margin: 0.4rem 0;
		padding: 0.5rem 0.7rem;
	}

	.weisung.ueberholt {
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
	}

	/* Der Ausschluss steht an der Stelle der Knöpfe und trägt deren Höhe. */
	.gesperrt {
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
		border-radius: 0.5rem;
		font-size: 0.95rem;
		margin: 0.4rem 0;
		padding: 0.7rem;
	}

	button.empfohlen {
		outline: 3px solid var(--akzent);
		outline-offset: 2px;
	}

	.karte {
		max-width: 34rem;
		margin: 0 auto;
	}

	/*
	 * Während der Abstimmung ist der Gruss eine Kontrolle, keine Überschrift:
	 * Er sagt, auf wessen Telefon gestimmt wird. Die Frage darunter ist das,
	 * worauf es ankommt, und sie soll die grösste Schrift auf dem Bildschirm
	 * behalten.
	 */
	h1.knapp {
		font-size: 1.05rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
	}

	.oben {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0;
	}

	h1 {
		margin: 0.2rem 0 0.5rem;
		font-size: 1.6rem;
	}

	.wann {
		color: var(--text-leise);
		margin: 0 0 1.25rem;
	}

	.ich {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		padding: 1rem 1.15rem;
	}

	.ich h2,
	.stand h2 {
		margin: 0 0 0.4rem;
		font-size: 0.95rem;
	}

	.name {
		font-weight: 650;
		font-size: 1.15rem;
		margin: 0;
	}

	.ich ul {
		list-style: none;
		padding: 0;
		margin: 0.75rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.ich li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--linie);
		padding-bottom: 0.25rem;
	}

	.quote {
		font-variant-numeric: tabular-nums;
		color: var(--text-leise);
	}

	.summe {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		margin: 0.5rem 0 0.25rem;
	}

	.hilfe,
	.klein {
		font-size: 0.875rem;
		color: var(--text-leise);
	}

	.klein {
		margin: 0.25rem 0 0;
	}

	.stand {
		margin-top: 1.25rem;
		border-radius: var(--radius);
		padding: 1rem 1.15rem;
		border: 1px solid var(--linie);
	}

	.stand.bereit {
		border-color: var(--akzent);
		background: color-mix(in srgb, var(--akzent) 12%, transparent);
	}

	.stand.warten {
		background: var(--flaeche-2);
	}

	.stand p {
		margin: 0;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1.25rem 0;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 550;
	}

	input {
		min-height: 3.25rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		font-family: ui-monospace, monospace;
		font-size: 1.1rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	button {
		min-height: 3.25rem;
		padding: 0 1.5rem;
		border: none;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font: inherit;
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
	}

	button.leise {
		background: transparent;
		border: 1px solid var(--linie);
		color: var(--text-leise);
		font-size: 0.9rem;
		font-weight: 400;
		min-height: var(--ziel-min);
	}

	.abmelden {
		margin-top: 2rem;
	}

	.meldung {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		margin: 1rem 0;
	}

	.meldung.fehler {
		background: color-mix(in srgb, var(--fehler) 12%, transparent);
		color: var(--fehler);
	}

	.meldung.warnung {
		background: color-mix(in srgb, var(--warnung) 18%, transparent);
	}

	.fuer {
		margin-bottom: 1rem;
	}

	/*
	 * **Der Vertretungsblock setzt sich ab** (Produktentscheid 25.09.2026, nur
	 * die Gestaltung, kein neuer Text). Der graue Strich in `var(--linie)` ging
	 * im grünen Abstimmungskasten unter; wer für mehrere stimmt, soll ohne Lesen
	 * sehen, dass dieser Satz Knöpfe für jemand anderen ist. Ein ganzer Rahmen
	 * in der Signalfarbe, leicht getönt, statt eines Strichs am Rand.
	 */
	.fuer.vertreten {
		border: 2px solid var(--warnung);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 8%, transparent);
		padding: 0.6rem 0.75rem;
	}

	/*
	 * **Der Veto-Block setzt sich ab** (Auftrag «Veto im Ausstand», 26.09.2026):
	 * Er trägt eine andere Handlung als die Stimmknöpfe — die Zustimmung statt
	 * der Stimme — und darf nicht mit ihnen verwechselt werden. Ganzer Rahmen
	 * in der Signalfarbe, wie der Vertretungsblock darüber.
	 */
	.veto {
		border: 2px solid var(--warnung);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 8%, transparent);
		padding: 0.6rem 0.75rem;
	}

	.veto .erfasst {
		margin: 0.4rem 0 0;
		font-weight: 550;
	}

	.wen {
		margin: 0 0 0.35rem;
	}

	.wen .klein {
		display: block;
	}

	.wen .offen {
		color: var(--warnung);
	}

	.abstimmung {
		margin-top: 1.25rem;
		border: 2px solid var(--akzent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--akzent) 10%, transparent);
		padding: 1rem 1.15rem;
	}

	.abstimmung h2 {
		font-size: 1.35rem;
		margin: 0 0 0.35rem;
		line-height: 1.25;
	}

	/*
	 * Ruhig und deutlich: Auf dem Telefon soll man ohne Lesen sehen, dass gerade
	 * nichts zu tun ist.
	 */
	.pause {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 15%, var(--flaeche));
		padding: 1.1rem 1rem;
		text-align: center;
	}

	.pause h2 {
		margin: 0;
		font-size: 1.6rem;
	}

	.pause .satz {
		margin: 0.35rem 0 0;
		font-size: 1.1rem;
	}

	.traktandum {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0;
	}

	/*
	 * **Der Hinweis auf die offene Stimme trägt die Warnfarbe**, nicht die
	 * Bestätigungsfarbe: Er steht an derselben Stelle und darf nicht wie eine
	 * Bestätigung aussehen. Wer ihn für eine hält, legt das Telefon weg.
	 */
	/*
	 * **Der Hinweis auf den zweiten Durchgang trägt die Warnfarbe.** Er ist
	 * keine Auskunft am Rand, sondern der Unterschied zwischen «ich stimme
	 * über etwas Neues ab» und «ich stimme dieselbe Sache noch einmal».
	 */
	.nochmals {
		padding: 0.6rem 0.85rem;
		border-left: 3px solid var(--warnung);
		background: color-mix(in srgb, var(--warnung) 10%, transparent);
		border-radius: var(--radius);
	}

	.einordnung {
		margin: -0.25rem 0 1rem;
		color: var(--text-leise);
	}

	/*
	 * **Der gewählte Knopf trägt die Akzentfläche**, nicht bloss einen Rand: Er
	 * ist die Antwort auf «wie habe ich gestimmt», und die muss man im Saal aus
	 * einem Meter Abstand sehen. Die Empfehlung daneben bleibt ein Rand — sie
	 * sagt, was jemand anderes will, nicht was gilt.
	 */
	.wahl button.gewaehlt {
		background: var(--akzent);
		color: var(--akzent-text);
		border-color: var(--akzent);
		font-weight: 600;
	}

	.aenderbar {
		margin: 0.35rem 0 0;
		color: var(--text-leise);
	}

	.fehlt {
		padding: 0.75rem 1rem;
		border: 1px solid var(--warnung);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
	}

	.bestaetigt {
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.7rem 0.9rem;
		margin: 0.75rem 0 0.25rem;
	}

	/* Drei grosse Schaltflächen: Sie werden im Saal mit dem Daumen getroffen,
	   oft im Stehen und ohne Brille. */
	.wahl {
		display: grid;
		gap: 0.6rem;
		margin: 1rem 0 0;
	}

	.wahl button {
		min-height: 4rem;
		font-size: 1.35rem;
		font-weight: 650;
	}

	/*
	 * **Die Gegenfarbe gehört dazu** (Code-Review 01.09.2026).
	 *
	 * Hier stand nur der Grund; die Schrift erbte `--text`. Nachgerechnet nach
	 * WCAG: `--text` auf `--fehler` ergibt 2.14 im hellen und 2.16 im dunklen
	 * Thema — das Wort «Nein» war auf dem Knopf praktisch nicht zu lesen, auf
	 * dem Gerät, mit dem im Saal abgestimmt wird. Mit `--flaeche` sind es 8.15.
	 * `app.css` schreibt die Gegenfarbe an jedem anderen farbigen Knopf hin;
	 * hier fehlte sie als einzige.
	 *
	 * **Und eine Lehre über das Messen** (01.09.2026): Ich hielt den Befund
	 * zuerst für falsch, weil ein Lauf von `durchspielen` mit ausgebautem Fix
	 * 8.15 meldete — also den Wert MIT Fix. Der Dev-Server hatte die geänderte
	 * Datei nicht neu übersetzt. Eine Defektprobe, deren Defekt den Server nie
	 * erreicht, misst den guten Zustand und sieht wie eine Entwarnung aus.
	 */
	.wahl .nein {
		background: var(--fehler);
		color: var(--flaeche);
	}

	.wahl .enthaltung {
		background: var(--flaeche-2);
		color: var(--text);
		border: 1px solid var(--linie);
	}

	.ergebnis {
		margin-top: 1.25rem;
		border: 1px solid var(--linie);
		border-left: 4px solid var(--fehler);
		border-radius: var(--radius);
		padding: 1rem 1.15rem;
	}

	.ergebnis.angenommen {
		border-left-color: var(--akzent);
	}

	.ergebnis h2 {
		font-size: 0.95rem;
		margin: 0 0 0.35rem;
		color: var(--text-leise);
	}

	.gross {
		font-size: 1.6rem;
		font-weight: 700;
		margin: 0 0 0.35rem;
	}

	.saal {
		background: var(--flaeche-2);
		border-radius: var(--radius);
		padding: 0.7rem 0.9rem;
		margin-top: 0.75rem;
	}
</style>
