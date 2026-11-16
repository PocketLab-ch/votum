<script lang="ts">
	let { data, form } = $props();

	/**
	 * Was nach dem Absenden gilt — davor der Stand aus dem Aufruf.
	 *
	 * **Dieser Zweig steht zuoberst**, und das ist kein Geschmack (02.09.2026,
	 * eigener Durchstich): Nach dem Vermerken ist die Marke verbraucht, `load`
	 * findet sie nicht mehr und meldet «nicht gefunden». Stünde die Absage
	 * zuerst, verdeckte sie die Erfolgsmeldung — der Vermerk wäre gesetzt, und
	 * die Seite sagte «Dieser Link gilt nicht mehr».
	 */
	const erledigt = $derived(form?.ausgang === 'gesetzt' || form?.ausgang === 'schon_vermerkt');

	/**
	 * Die Frage, die jetzt gilt. Nach einer abgewiesenen Bestätigung («Lage
	 * geändert») bringt die Antwort sie mit; sonst die aus dem Aufruf.
	 */
	const fassung = $derived(form?.ausgang === 'geaendert' ? form.fassung : data.fassung);
	const frist = $derived(form?.ausgang === 'geaendert' ? form.frist : data.frist);
</script>

<svelte:head>
	<title>Einladung als verschickt vermerken</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="karte">
	{#if erledigt}
		<p class="oben">{form?.gemeinschaft ?? data.gemeinschaft}</p>
		<h1>
			<!-- «Vermerkt, aber zu spät» bis 07.10.2026: Seit dem Produktentscheid
			     07.10.2026 zählt jeder Vermerk nach der Milderung, auch nach Fristablauf. -->
			{form?.ausgang !== 'gesetzt' ? 'War schon vermerkt' : 'Vermerkt, danke'}
		</h1>
		<p class="wann">Versammlung vom {form?.tag ?? data.tag}</p>
		<p>
			<!--
				**Ohne Rückfall** (Produktentscheid 07.10.2026, «Nur noch aufmerksam
				machen»): Bis 07.10.2026 hiess es hier nach der berichtigten Einladung
				«Die Anwendung nimmt beim Eröffnen das mildere Mehr» und nach Fristablauf,
				ein Vermerk ändere das Mehr nicht mehr. Das mildere Mehr nimmt die
				Anwendung seither auch ohne Vermerk; der Vermerk nimmt nur den Hinweis
				und die Erinnerung weg (`neuversandVermerkt`).
			-->
			{#if form?.ausgang === 'gesetzt' && form?.fassung !== 'bisher'}
				Sie haben angegeben, dass die berichtigte Einladung verschickt ist. Der Hinweis auf der
				Seite Vorbereitung entfällt, und an diese Einladung erinnert die Anwendung nicht mehr.
				{#if form?.fassung === 'zu_spaet'}
					<!-- Bedingt (Fachprüfung B1, Runde 1, 07.10.2026): Die Anwendung weiss nicht,
					     wann sie verschickt wurde. Bis dahin unbedingt «kann angefochten werden». -->
					War sie am {form?.frist} nicht bei allen, kann ein Beschluss mit dem milderen Mehr
					angefochten werden.
				{/if}
			{:else if form?.ausgang === 'gesetzt'}
				<!-- Korrekturrunde 06.10.2026: «an diese Einladung», denn nach einer
				     Milderung erinnert die Anwendung an dieselbe Versammlung erneut. -->
				<!-- Mit dem Haken umbenannt (Produktentscheid 07.10.2026, «Die Einladung ist
				     verschickt»; bis 07.10.2026 «… ist bei allen angekommen»): Der Link
				     setzt denselben Vermerk. -->
				Die Einladung ist als verschickt vermerkt. Die Anwendung erinnert an diese Einladung
				nicht mehr.
			{:else}
				Jemand hat es bereits gesagt — vielleicht Sie selbst, vielleicht jemand aus Ihrem Haus.
				<!-- Codeprüfung N4: «an diese Einladung», wie in der Mail; nach einer
				     Milderung kommt eine weitere. -->
				An diese Einladung erinnert die Anwendung so oder so nicht mehr.
			{/if}
		</p>
		<!--
			**Der Rückweg gehört hierher.** Der Vermerk ist eine Aussage, kein
			Nachweis, und ein versehentlicher Klick soll nicht bedeuten, dass die
			Erinnerung für diese Versammlung endgültig weg ist. Wer den Satz hier
			nicht liest, sucht die Stelle später vergeblich.
		-->
		<!--
			**Kein Satz darüber, ob danach wieder erinnert wird** (Korrekturrunde
			06.10.2026, Codeprüfung M4). «Dann erinnert es erneut» stimmte nicht:
			Das Entfernen setzt den Merker nicht zurück. «Es kommt keine weitere»
			stimmte aber auch nicht immer: Nach einer weiteren Milderung, oder wenn
			ein Fehlschlag den Merker geleert hat, kommt eine. Die Bedingung steht in
			`docs/dienste.md`; hier steht nur der Weg.
		-->
		<p class="klein">
			Versehentlich vermerkt? In der Anwendung lässt sich der Haken auf der Seite Vorbereitung
			wieder entfernen.
		</p>
	{:else if !data.gefunden || form?.ausgang === 'unbekannt'}
		<!--
			**Kein Grund, warum genau.** Verbraucht, abgelaufen oder erfunden sind
			hier dasselbe: Wer die Marke rät, soll aus der Antwort nichts lernen.
			Der Weg weiter steht trotzdem da, denn der häufigste Fall ist harmlos —
			jemand hat den Link ein zweites Mal geöffnet, Tage später.
		-->
		<h1>Dieser Link gilt nicht mehr</h1>
		<!-- Laienprüfung Teil 2 Runde 3, Punkt 5: Auch eine Milderung verbraucht ihn
		     (`achteEinladungsmehr`, Sicherheitsprüfung Runde 3). -->
		<p>
			Er wird nach dem Vermerken verbraucht. Kam die Erinnerung mehrfach, gilt nur der Link aus
			der zuletzt erhaltenen. Er gilt auch nicht mehr, wenn seither das Mehr eines Traktandums
			milder geworden ist.
		</p>
		<p class="klein">
			<!-- Bis 07.10.2026 den Empfang, nicht den Versand (Codeprüfung Restpunkte Runde 1,
			     M1, 06.10.2026); seit dem Produktentscheid 07.10.2026 nach dem Haken «Die
			     Einladung ist verschickt». -->
			In der Anwendung lässt sich jederzeit vermerken, dass die Einladung verschickt ist: bei
			der Versammlung, unter «Vorbereitung».
		</p>
	{:else if fassung !== 'bisher'}
		<!--
			**Nach einer Milderung die berichtigte Einladung** (Korrekturrunde
			06.10.2026). Dieselbe Bedingung wie Erinnerung und Hinweis
			(`neuversandVermerkt`). Bis 07.10.2026 gab es nach dem letzten Fristtag
			keinen Knopf, weil ein Vermerk dann das mildere Mehr nicht mehr gültig
			machte (`neuversandGilt`, Rückfall beim Eröffnen). Seit dem
			Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») zählt jeder
			Vermerk nach der Milderung, also steht der Knopf in beiden Fassungen. Die
			Fassung `zu_spaet` bleibt eine eigene: Sie sagt, dass die Einladung nicht
			mehr rechtzeitig ankommen kann, und der Server löst nur ein, wenn die
			gezeigte Fassung noch gilt.
		-->
		<p class="oben">{data.gemeinschaft}</p>
		{#if form?.ausgang === 'geaendert'}
			<p role="status"><strong>Inzwischen hat sich die Lage geändert; bitte lesen Sie die Frage neu.</strong></p>
		{/if}
		<!-- Produktentscheid 07.10.2026: bestätigt wird der Versand, nicht der Empfang
		     (bis 07.10.2026 «Ist die berichtigte Einladung bei allen angekommen?»). -->
		<h1>Ist die berichtigte Einladung verschickt?</h1>
		<p class="wann">Versammlung vom {data.tag}</p>
		{#if fassung === 'zu_spaet'}
			<!-- Bedingt (Fachprüfung B1, Runde 1, 07.10.2026): Ohne Haken kann sie trotzdem
			     rechtzeitig verschickt worden sein. Bis dahin «kann jetzt nicht mehr rechtzeitig
			     ankommen». -->
			<p>
				Der letzte Tag der erfassten Einberufungsfrist war der {frist}. Ist die berichtigte
				Einladung noch nicht verschickt, kommt sie nach dieser Frist nicht mehr rechtzeitig an.
				War sie am {frist} nicht bei allen, kann ein Beschluss mit dem milderen Mehr angefochten
				werden.
			</p>
		{:else if frist}
			<p>
				Sie soll spätestens am {frist} bei allen sein. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.
			</p>
		{:else}
			<!-- Fachprüfung B4: ohne erfasste Frist kennt die Anwendung den letzten Tag nicht.
			     Produktentscheid 06.10.2026, «Hinweis, zehn Tage zu erfassen»: ein Rat,
			     kein Vorgabewert. -->
			<p>
				Rechtzeitig heisst nach der Frist Ihres Reglements; nennt es keine, in der Regel
				mindestens zehn Tage vor der Versammlung. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht. Erfassen Sie die Frist auf der Seite «Reglement und Quoren» der
				Gemeinschaft; dann nennt die Anwendung den letzten Tag und erinnert daran.
			</p>
		{/if}
		<p>
			Mit Ja entfällt der Hinweis auf der Seite Vorbereitung, und an diese Einladung erinnert die
			Anwendung nicht mehr. Das mildere Mehr nimmt die Anwendung auch ohne Ja; sie macht nur
			aufmerksam.
			<!-- Laienprüfung Runde 1, Punkt 3: Die Warnung im Saal hängt nicht am Ja
			     (`warnungImSaal` in `mailversand.ts`, hier ohne Zahl der Traktanden). -->
			Im Saal steht trotzdem eine Warnung, solange das Mehr dort milder ist als in der Einladung
			vor der Milderung.
		</p>
		{#if fassung === 'zu_spaet'}
			<!--
				**Der Rückweg wie in Hinweis und Mail** (Codeprüfung Restpunkte Runde 2,
				Punkt 7, 06.10.2026): Der Haken-Satz nennt seine Bedingung selbst und
				sagt, was gilt, wenn die bisherige Einladung schon verschickt ist. In der
				Mehrzahl, weil die Seite nicht weiss, wie viele Traktanden betroffen sind
				(`einladung_marke_neuversand` liefert keine Zahl); «jedes» trägt auch eines.
				Seit dem Produktentscheid 07.10.2026 «verschickt» statt «bei allen».
			-->
			<p>
				Wollen Sie beim Mehr der bisherigen Einladung bleiben, stellen Sie es zurück: Klicken Sie
				in der Traktandenliste auf jedes betroffene Traktandum und dann auf «Erfordernis ändern».
				Haben Sie das Mehr überall zurückgestellt, setzen Sie auf der Seite Vorbereitung den
				Haken; er gilt dann für die bisherige Einladung. Setzen Sie ihn, sobald sie verschickt
				ist; ist sie das schon, gleich.
			</p>
		{/if}
		<form method="POST">
			<input type="hidden" name="fassung" value={fassung} />
			<button type="submit">Ja, die berichtigte Einladung ist verschickt</button>
		</form>
	{:else}
		<p class="oben">{data.gemeinschaft}</p>
		{#if form?.ausgang === 'geaendert'}
			<p role="status"><strong>Inzwischen hat sich die Lage geändert; bitte lesen Sie die Frage neu.</strong></p>
		{/if}
		<!-- Wie der Haken auf der Seite Vorbereitung (Produktentscheid 07.10.2026, «Die
		     Einladung ist verschickt»; bis 07.10.2026 «… ist bei allen angekommen»):
		     bestätigt wird der Versand. -->
		<h1>Ist die Einladung verschickt?</h1>
		<p class="wann">Versammlung vom {data.tag}</p>
		{#if data.schonVermerkt}
			<p>
				Für diese Versammlung ist bereits vermerkt, dass die Einladung verschickt ist. An diese
				Einladung erinnert die Anwendung nicht mehr.
			</p>
		{:else}
			<!--
				**Am Code geprüft** (Korrekturrunde 06.10.2026): Der Vermerk schaltet
				auch die Fristwarnung der Vorbereitung ab (`vorbereitungsschritte`,
				`versendet`), nicht nur die Erinnerung. Eine Milderung danach nimmt ihn
				zurück; das betrifft diese Seite nicht, weil sie dann anders fragt.
			-->
			<p>
				Sagen Sie es hier, dann erinnert die Anwendung an diese Einladung nicht mehr, und die
				Fristwarnung in der Anwendung entfällt. Sonst ändert sich nichts; auf der Seite
				Vorbereitung lässt sich der Vermerk wieder entfernen. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.
			</p>
		{/if}
		<!--
			**Der Knopf, nicht der Link, macht die Aussage** (Code-Review
			02.09.2026). Mailserver rufen Links vor der Zustellung ab; täte das
			Öffnen schon den Vermerk, verstummte die Erinnerung, bevor sie jemand
			liest.
		-->
		<!--
			**Die gezeigte Frage geht mit** (Fachprüfung B7, Korrekturrunde
			06.10.2026). Hat sich die Lage bis zum Absenden geändert, löst der
			Server nicht ein und die Seite fragt neu.
		-->
		<form method="POST">
			<input type="hidden" name="fassung" value="bisher" />
			<button type="submit">Ja, die Einladung ist verschickt</button>
		</form>
	{/if}
</section>

<style>
	.karte {
		max-width: 30rem;
		margin: 0 auto;
	}

	.oben {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0;
	}

	h1 {
		margin: 0.2rem 0 0.5rem;
		font-size: 1.5rem;
	}

	.wann {
		color: var(--text-leise);
		margin: 0 0 1rem;
	}

	.klein {
		color: var(--text-leise);
		font-size: 0.9rem;
	}
</style>
