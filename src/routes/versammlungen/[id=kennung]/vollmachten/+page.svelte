<script lang="ts">
	import { zeitpunktKurz } from '$lib/domain/datum';
	import {
		brauchtNachweis,
		GRUNDFRAGE,
		grundhilfe,
		grundvermerk,
		GRUNDWAHL,
		hoechstzahlMitberechtigte,
		istBestaetigbar,
		nachweisFehlt,
		vertretungsgrundInWorten
	} from '$lib/domain/vollmacht';
	import { VERWALTUNG_HAKEN_HILFE_LEITUNG } from '$lib/domain/mehrhinweise';
	/**
	 * Vollmachten prüfen und führen.
	 *
	 * **Die Prüfung steht im Mittelpunkt, nicht das Erfassen.** Eine erfasste
	 * Vollmacht überträgt nichts; erst die Bestätigung macht sie wirksam. Deshalb
	 * stehen die offenen zuoberst — sie sind die Arbeit —, die wirksamen darunter
	 * und die beendeten zuletzt.
	 */
	import { enhance } from '$app/forms';
	import VollmachtFuer from '$lib/components/VollmachtFuer.svelte';
	import { angekreuzt } from '$lib/felder';
	import { GRENZHINWEIS, nachweisgrenze } from '$lib/nachweisgrenze';
	import Meldung from '$lib/components/Meldung.svelte';
	import Suchauswahl from '$lib/components/Suchauswahl.svelte';

	let { data, form } = $props();

	const offene = $derived(data.vollmachten.filter((x) => x.zustand === 'erfasst'));
	const wirksame = $derived(data.vollmachten.filter((x) => x.zustand === 'bestaetigt'));
	const beendete = $derived(
		data.vollmachten.filter((x) => x.zustand === 'zurueckgewiesen' || x.zustand === 'widerrufen')
	);

	/**
	 * Alle Parteien stehen zur Wahl — die gesperrten mit ihrem Grund.
	 *
	 * Sie wegzulassen wäre bequemer und im Saal schlimmer: Wer jemanden sucht
	 * und nicht findet, weiss nicht, ob er sich vertippt hat oder ob die Person
	 * schon anwesend ist. Der Grund steht in der Liste; die Datenbank weist
	 * dieselben Fälle noch einmal ab (AD-6).
	 */
	/**
	 * Wer die Stimme ausübt — geführt, weil die Liste darunter davon abhängt.
	 *
	 * **Niemand bevollmächtigt sich selbst** (Auftraggeber, 24.08.2026: «sicherstellen,
	 * dass man sich nicht selbst bevollmächtigen kann, weil das ja nicht geht»).
	 * Der Kern weist es seit je ab (`vollmacht.ts`, «sich_selbst») — die Maske
	 * bot es trotzdem an: Dieselbe Partei stand oben als Bevollmächtigte und
	 * unten zum Ankreuzen. Ein Knopf, der in eine Absage führt.
	 */
	let bevollmaechtigt = $state('');

	/*
	 * **Gesperrt, nicht weggelassen** — dieselbe Regel wie bei den Anwesenden
	 * (siehe oben): Wer jemanden sucht und nicht findet, weiss nicht, warum.
	 * Ein ausgegrauter Eintrag mit Grund beantwortet die Frage, bevor sie
	 * gestellt wird. Ein gesperrtes Kästchen wird zudem nicht mitgeschickt.
	 */
	const waehlbar = $derived(
		data.parteien.map((p) =>
			p.id === bevollmaechtigt && bevollmaechtigt !== ''
				? { ...p, gesperrt: 'übt hier selbst aus — niemand bevollmächtigt sich selbst' }
				: p
		)
	);
	const nochOffen = $derived(data.parteien.filter((p) => !p.gesperrt).length);

	/** Dritte Person oder Eigentümer — die Auswahl bestimmt, welches Feld gilt. */
	let art = $state<'eigentuemer' | 'dritte'>('eigentuemer');

	let offenesFormular = $state<string | null>(null);
	function umschalten(schluessel: string) {
		offenesFormular = offenesFormular === schluessel ? null : schluessel;
	}

	// Über die Hausfunktion, damit die Zeit nicht am Gerät hängt (04.09.2026).
	const datum = zeitpunktKurz;
</script>

<h1>Vollmachten</h1>

<p class="einleitung">
	Wer nicht kommen kann, bevollmächtigt jemanden. Eine erfasste Vollmacht überträgt noch nichts —
	<strong>erst die Bestätigung macht sie wirksam.</strong> Trifft die bevollmächtigte Person ein,
	gilt die Partei, für die sie die Vollmacht hält, als anwesend und zählt für die
	Beschlussfähigkeit.
</p>

{#if form?.fehler}
	<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
{:else if form?.hinweis}
	<Meldung ton="gut" marke={form}>{form.hinweis}</Meldung>
{/if}

{#if data.stimmberechtigte === 0}
	<p class="meldung warnung">
		Diese Versammlung ist noch nicht freigegeben. Vorher steht nicht fest, wer stimmberechtigt ist
		— und damit auch nicht, wer sich vertreten lassen kann.
	</p>
{:else}
	{#if data.warnungen.length > 0}
		<div class="meldung warnung">
			<strong>Das Reglement setzt eine Schranke.</strong>
			<ul>
				{#each data.warnungen as w (w.bevollmaechtigt)}
					<li>{w.satz}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<p class="zahlen">
		{data.anzahlWirksam}
		{data.anzahlWirksam === 1 ? 'wirksame Vollmacht' : 'wirksame Vollmachten'}
		{#if data.anzahlOffen > 0}· <strong>{data.anzahlOffen} zu prüfen</strong>{/if}
		{#if data.schranke.hoechstzahl}
			· höchstens {data.schranke.hoechstzahl} je Person{#if data.schranke.fundstelle}
				({data.schranke.fundstelle}){/if}
		{/if}
	</p>
	<!--
		**Einstellung der Gemeinschaft, nicht Rechtslage** (Fachprüfung F1 Runde 2,
		1.2; Lesart L15, Migration 194).
		Steht nur, wo eine Höchstzahl hinterlegt ist: Ohne sie gibt es nichts,
		wovon die Stimmführung ausgenommen wäre.
	-->
	{#if data.schranke.hoechstzahl}
		<p class="klein">{hoechstzahlMitberechtigte(data.schranke.stimmfuehrung)}</p>
	{/if}

	<!--
		**Nachweise mit dem Telefon fotografieren** (Auftraggeber, 24.08.2026): «Kann man,
		wenn man Dokumente hochladen möchte, einen QR-Code bereitstellen, auf dem
		der Leiter dann — natürlich angemeldet — das Dokument fotografieren und
		zur Person, die sich vertreten lässt, hochladen kann?»

		Der Code führt auf die schmale Nachweisseite: dort steht je Vollmacht eine
		Zeile und ein Knopf, der die Kamera öffnet. Er trägt keinen Zugang, nur
		die Adresse — wer ihn scannt, meldet sich an wie überall.

		Der Link steht daneben, weil sich ein Code nicht selbst scannt: Wer die
		Seite schon auf dem Telefon hat, bräuchte sonst ein zweites Gerät.
	-->
	<details class="telefonweg">
		<summary>Nachweise mit dem Telefon fotografieren</summary>
		<div class="qr">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html data.telefonweg.svg}
			<div class="wohin">
				<p class="hilfe">
					Mit der Kamera-App scannen. Auf dem Telefon steht dann je Vollmacht eine Zeile mit
					einem Knopf, der die Kamera öffnet — das Blatt fotografieren, fertig. Anmelden
					müssen Sie sich dort wie überall.
				</p>
				<p class="adresse hilfe"><a href={data.telefonweg.url}>{data.telefonweg.url}</a></p>
			</div>
		</div>
	</details>

	<!-- ── Zu prüfen ──────────────────────────────────────────────────────── -->
	{#if offene.length > 0}
		<h2>Zu prüfen</h2>
		{#each offene as p (p.id)}
			<article class="vollmacht offen">
				<h3>{p.bevollmaechtigtName} <span class="fuer">bevollmächtigt für</span> {p.vertreteneName}</h3>
				<p class="klein">
					Erfasst {datum(p.erfasstAm)}{#if p.erfasstDurch}{' '}von {p.erfasstDurch}{/if}
					{#if p.bevollmaechtigtId === null}· dritte Person, selbst nicht stimmberechtigt{/if}
					<!-- G7 (06.11.2026): Das Merkmal wie die übrigen in dieser Zeile, damit
					     die Leitung beim Durchgehen sieht, welche Vollmachten ruhen. -->
					{#if p.istVerwaltung}· Verwaltung{/if}
				</p>
				<!--
					**Der Grund steht in der Liste** (Code-Review vom 24.09.2026, B7, und
					Sicherheitsprüfung Befund 1). Er nimmt die Zeile aus der Höchstzahl —
					und ohne ihn sah eine ausgenommene Vollmacht genau aus wie eine
					gewöhnliche. Die Warnung schweigt dann ebenfalls, denn sie zählt die
					Zeile nicht mit. Wer diese Seite vor der Versammlung durchgeht, ist
					der vorgesehene Kontrollpunkt; er kann einen falsch gesetzten Grund
					nur sehen, wenn er dasteht.
				-->
				{#if p.vertretungsgrund}
					<p class="grundvermerk">
						{grundvermerk(p, data.schranke.stimmfuehrung)}: {vertretungsgrundInWorten(p)}
					</p>
				{/if}
				{#if p.bemerkung}<p class="bemerkung">{p.bemerkung}</p>{/if}

				<p class="nachweis">
					<strong>Nachweis:</strong>
					{#if p.herkunft === 'zugang'}
						<!-- Der Unterschied gehört benannt: Eine elektronische Erklärung ist
						     etwas anderes als ein vorgelegtes Original, und beides ist etwas
						     anderes als gar nichts. -->
						elektronisch über den persönlichen Zugang erklärt
					{/if}
					{#if p.herkunft === 'zugang' && (p.nachweisVorgelegt || p.nachweise.length > 0)}·{/if}
					{#if p.nachweisVorgelegt}{p.mitberechtigung === 'nicht_eingetragen'
							? 'Nachweis der Mitberechtigung hat vorgelegen'
							: 'Original hat vorgelegen'}{/if}
					{#if p.nachweisVorgelegt && p.nachweise.length > 0}·{/if}
					{#each p.nachweise as n (n.id)}
						<a href="/anhang/{n.pruefsumme}">{n.name}</a>{' '}
					{/each}
					<!--
						**Die Frage kommt aus dem Kern** (Code-Review 08.09.2026). Hier stand
						die Bedingung von Hand abgeschrieben, dieselbe, die `verlangeBestaetigbar`
						stellt. Kommt eine dritte Nachweisart dazu, sagte die Seite dann das
						Gegenteil dessen, was der Server tut.
					-->
					{#if !brauchtNachweis(p)}
						<!-- Die eingetragene Mitberechtigte (Produktentscheid 03.11.2026). -->
						{#if p.herkunft !== 'zugang'}nicht nötig, als Mitberechtigte im Register eingetragen{/if}
					{:else if nachweisFehlt({ nachweisVorgelegt: p.nachweisVorgelegt, anzahlDateien: p.nachweise.length, herkunft: p.herkunft, vertretungsgrund: p.vertretungsgrund, mitberechtigung: p.mitberechtigung })}
						<em>
							{p.mitberechtigung === 'nicht_eingetragen'
								? 'fehlt, ohne Nachweis der Mitberechtigung (bei Erben die Erbbescheinigung) keine Bestätigung'
								: 'fehlt, ohne Nachweis keine Bestätigung'}
						</em>
					{/if}
				</p>

				{#if p.weisungen.length > 0}
					<!-- **Weisungen sind Empfehlungen.** Sie stehen hier, weil sie Teil
					     dessen sind, was erklärt wurde — nicht, weil sie irgendetwas
					     automatisch bewirkten. -->
					<details class="weisungen">
						<summary>
							{p.weisungen.length}
							{p.weisungen.length === 1 ? 'Weisung' : 'Weisungen'} an die bevollmächtigte Person
						</summary>
						<ul>
							{#each p.weisungen as w (w.traktandumId)}
								<li>{w.titel}: <strong>{w.wahlName}</strong></li>
							{/each}
						</ul>
						<p class="klein">
							Empfehlungen, keine Stimmen: Sie erscheinen auf dem Telefon der bevollmächtigten
							Person, abgeben muss sie die Stimme selbst.
						</p>
					</details>
				{/if}

				<div class="knopfreihe">
					<!--
						Nicht bei der eingetragenen Mitberechtigten: Es gibt kein Blatt, und
						der Vermerk behauptete eines. Bei «nicht eingetragen» sagt der Knopf,
						welches Blatt gemeint ist.
					-->
					{#if !p.nachweisVorgelegt && brauchtNachweis(p)}
						<form method="POST" action="?/vorlegen" use:enhance>
							<input type="hidden" name="id" value={p.id} />
							<button type="submit">
								{p.mitberechtigung === 'nicht_eingetragen'
									? 'Nachweis der Mitberechtigung hat vorgelegen'
									: 'Original hat vorgelegen'}
							</button>
						</form>
					{/if}
					<!--
						**Kein Knopf, der nur scheitern kann** (Bedienbarkeitsprüfung
						05.09.2026, Befund 32; hier nachgezogen aus dem Code-Review vom
						06.09.2026). Der Hinweis «ohne Nachweis keine Bestätigung» stand
						schon oben in der Zeile — und daneben trotzdem der Knopf, der genau
						daran scheitert. Die Seite je Abend behandelt denselben Fall seit
						heute so; zwei Seiten mit derselben Handlung dürfen sie nicht
						verschieden beantworten.

						Anders als dort gibt es hier den zweiten Weg wirklich: «Nachweis
						hinterlegen» steht als Knopf daneben.
					-->
					{#if istBestaetigbar({ zustand: p.zustand, nachweisVorgelegt: p.nachweisVorgelegt, anzahlDateien: p.nachweise.length, herkunft: p.herkunft, vertretungsgrund: p.vertretungsgrund, mitberechtigung: p.mitberechtigung })}
						<form method="POST" action="?/bestaetigen" use:enhance>
							<input type="hidden" name="id" value={p.id} />
							<button type="submit" class="haupt">Bestätigen — sie wird wirksam</button>
						</form>
					{:else}
						<p class="ohneNachweis">
							{p.mitberechtigung === 'nicht_eingetragen'
								? 'Zum Bestätigen fehlt der Nachweis der Mitberechtigung: «Nachweis der Mitberechtigung hat vorgelegen» vermerken oder ihn hinterlegen.'
								: 'Zum Bestätigen fehlt der Nachweis: «Original hat vorgelegen» vermerken oder ihn hinterlegen.'}
						</p>
					{/if}
					<button type="button" onclick={() => umschalten(`weisen-${p.id}`)}>Zurückweisen</button>
					<button type="button" onclick={() => umschalten(`datei-${p.id}`)}>Nachweis hinterlegen</button>
					{#if p.bevollmaechtigtId === null}
						<!--
							**Das Häkchen an der bestehenden Vollmacht** (L8, Migration
							184; H-1, 07.11.2026): Über `/z/` erfasst, gibt es dort keinen
							Weg, es nachzutragen oder ein falsch gesetztes zu entfernen.
							Bei einer Partei der Versammlung gibt es die Knöpfe nicht
							(der CHECK verbietet es ohnehin).
						-->
						<form method="POST" action="?/verwaltung" use:enhance>
							<input type="hidden" name="id" value={p.id} />
							<!-- Nur einer der beiden Knöpfe steht je Zustand; Enter
							     soll keine der beiden Handlungen erraten. -->
							<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
							{#if p.istVerwaltung}
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
				</div>

				{#if offenesFormular === `weisen-${p.id}`}
					<form method="POST" action="?/zurueckweisen" class="begruendung" use:enhance>
						<input type="hidden" name="id" value={p.id} />
						<label for="grund-{p.id}">
							Begründung — sie steht im Verlauf und später im Protokoll
						</label>
						<input id="grund-{p.id}" name="grund" required minlength="3" />
						<button type="submit">Zurückweisen</button>
					</form>
				{/if}
				{#if offenesFormular === `datei-${p.id}`}
					<form
						method="POST"
						action="?/nachreichen"
						enctype="multipart/form-data"
						class="begruendung"
					>
						<input type="hidden" name="id" value={p.id} />
						<label for="datei-{p.id}">Vollmacht als PDF oder Foto — mehrere Seiten möglich</label>
						<input
							id="datei-{p.id}"
							aria-describedby="datei-grenze-{p.id}"
							type="file"
							name="datei"
							accept="image/*,application/pdf"
							multiple
							required
							{@attach nachweisgrenze}
						/>
						<small id="datei-grenze-{p.id}">{GRENZHINWEIS}</small>
						<button type="submit">Hinterlegen</button>
					</form>
				{/if}
			</article>
		{/each}
	{/if}

	<!-- ── Wirksam ────────────────────────────────────────────────────────── -->
	{#if wirksame.length > 0}
		<h2>Wirksam</h2>
		{#each wirksame as p (p.id)}
			<article class="vollmacht wirksam">
				<h3>{p.bevollmaechtigtName} <span class="fuer">bevollmächtigt für</span> {p.vertreteneName}</h3>
				<!--
					**Der Grund steht in der Liste** (Code-Review vom 24.09.2026, B7, und
					Sicherheitsprüfung Befund 1). Er nimmt die Zeile aus der Höchstzahl —
					und ohne ihn sah eine ausgenommene Vollmacht genau aus wie eine
					gewöhnliche. Die Warnung schweigt dann ebenfalls, denn sie zählt die
					Zeile nicht mit. Wer diese Seite vor der Versammlung durchgeht, ist
					der vorgesehene Kontrollpunkt; er kann einen falsch gesetzten Grund
					nur sehen, wenn er dasteht.
				-->
				{#if p.vertretungsgrund}
					<p class="grundvermerk">
						{grundvermerk(p, data.schranke.stimmfuehrung)}: {vertretungsgrundInWorten(p)}
					</p>
				{/if}
				<p class="klein">
					Bestätigt {datum(p.bestaetigtAm)}{#if p.bestaetigtDurch}{' '}von {p.bestaetigtDurch}{/if}
					{#if p.bevollmaechtigtAnwesend === true}· die bevollmächtigte Person ist im Saal{/if}
					{#if p.bevollmaechtigtAnwesend === false}· die bevollmächtigte Person ist noch nicht eingetroffen{/if}
					<!-- G7 (06.11.2026): wie bei den offenen Vollmachten. -->
					{#if p.istVerwaltung}· Verwaltung{/if}
				</p>
				<p class="nachweis">
					<strong>Nachweis:</strong>
					{#if !brauchtNachweis(p) && p.herkunft !== 'zugang'}nicht nötig, als Mitberechtigte im Register eingetragen{/if}
					{#if p.nachweisVorgelegt}{p.mitberechtigung === 'nicht_eingetragen'
							? 'Nachweis der Mitberechtigung hat vorgelegen'
							: 'Original hat vorgelegen'}{/if}
					{#each p.nachweise as n (n.id)}
						<a href="/anhang/{n.pruefsumme}">{n.name}</a>{' '}
					{/each}
				</p>
				<div class="knopfreihe">
					<button type="button" onclick={() => umschalten(`ende-${p.id}`)}>
						Vertretung beenden
					</button>
					<button type="button" onclick={() => umschalten(`datei-${p.id}`)}>
						Nachweis nachreichen
					</button>
					{#if p.bevollmaechtigtId === null}
						<!-- H-1 (07.11.2026): wie bei den offenen Vollmachten. -->
						<form method="POST" action="?/verwaltung" use:enhance>
							<input type="hidden" name="id" value={p.id} />
							<!-- Nur einer der beiden Knöpfe steht je Zustand; Enter
							     soll keine der beiden Handlungen erraten. -->
							<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
							{#if p.istVerwaltung}
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
				</div>
				{#if offenesFormular === `ende-${p.id}`}
					<form method="POST" action="?/widerrufen" class="begruendung" use:enhance>
						<input type="hidden" name="id" value={p.id} />
						<label for="ende-grund-{p.id}">Begründung</label>
						<input id="ende-grund-{p.id}" name="grund" required minlength="3" />
						<button type="submit">Beenden</button>
					</form>
				{/if}
				{#if offenesFormular === `datei-${p.id}`}
					<form
						method="POST"
						action="?/nachreichen"
						enctype="multipart/form-data"
						class="begruendung"
					>
						<input type="hidden" name="id" value={p.id} />
						<label for="nach-{p.id}">Vollmacht als PDF oder Foto — mehrere Seiten möglich</label>
						<input
							id="nach-{p.id}"
							aria-describedby="nach-grenze-{p.id}"
							type="file"
							name="datei"
							accept="image/*,application/pdf"
							multiple
							required
							{@attach nachweisgrenze}
						/>
						<small id="nach-grenze-{p.id}">{GRENZHINWEIS}</small>
						<button type="submit">Hinterlegen</button>
					</form>
				{/if}
			</article>
		{/each}
	{/if}

	<!-- ── Erfassen ───────────────────────────────────────────────────────── -->
	<!--
		**Erst wer, dann für wen.**

		Umgekehrt zur ersten Fassung, und aus einem Grund: Auf einem Blatt steht
		eine bevollmächtigte Person und oft **mehrere** Namen, für die sie gilt.
		Die Person zuerst zu wählen und dann anzukreuzen, folgt dem Blatt; die
		alte Reihenfolge zwang dazu, denselben Weg je Name noch einmal zu gehen.
	-->
	<h2>Vollmacht erfassen</h2>
	{#if nochOffen === 0}
		<p class="klein">
			Für jede Partei besteht bereits eine Vollmacht, oder sie ist selbst anwesend.
		</p>
	{:else}
		{#if data.versammlung.zustand === 'freigegeben' && data.vollmachten.length === 0}
			<!--
				**Die erste Vollmacht macht die Freigabe endgültig** (Nachzug Block 3,
				Entscheid E vom 03.10.2026). Gezählt wird in jedem Zustand, wie in
				der Schranke `nimmVersammlungsfreigabeZurueck`: Auch eine
				zurückgewiesene oder widerrufene Vollmacht sperrt die Rücknahme.
				Der Hinweis steht hier, weil eine Warnung auf der Freigabeseite
				die erste Vollmacht über den Eigentümerzugang nicht erreicht.
			-->
			<p class="freigabewarnung">
				<strong>Mit der ersten Vollmacht wird die Freigabe endgültig.</strong> Danach lässt
				sich die Freigabe der Versammlung nicht mehr zurücknehmen, auch nicht, wenn die
				Vollmacht später zurückgewiesen oder widerrufen wird. Dasselbe gilt für eine erste
				Vollmacht, die ein Eigentümer über den eigenen Zugang erklärt. Prüfen Sie, ob Termin
				und Traktanden stehen, bevor Sie erfassen.
			</p>
		{/if}
		<form method="POST" action="?/erfassen" class="erfassen" use:enhance>
			<fieldset class="wer">
				<legend>Bevollmächtigte Person — wer die Stimme ausübt</legend>
				<label>
					<input
						type="radio"
						name="art"
						value="eigentuemer"
						{...angekreuzt(art === 'eigentuemer')}
						onchange={() => (art = 'eigentuemer')}
					/>
					aus dieser Versammlung
				</label>
				<label>
					<input
						type="radio"
						name="art"
						value="dritte"
						{...angekreuzt(art === 'dritte')}
						onchange={() => {
							art = 'dritte';
							// Eine dritte Person steht in keiner Liste — dann ist niemand
							// gesperrt, und wer eben oben gewählt war, darf wieder vertreten
							// werden.
							bevollmaechtigt = '';
						}}
					/>
					eine dritte Person
				</label>
			</fieldset>

			{#if art === 'eigentuemer'}
				<div class="feld">
					<label for="bevollmaechtigt">Wer</label>
					<Suchauswahl
						id="bevollmaechtigt"
						name="bevollmaechtigt"
						beschriftung="Wer"
						leerText="— wählen —"
						pflicht
						bind:wert={bevollmaechtigt}
						eintraege={data.parteien.map((p) => ({
							wert: p.id,
							text: p.kannNichtAusueben ? `${p.name} — ${p.kannNichtAusueben}` : p.name,
							deaktiviert: !!p.kannNichtAusueben
						}))}
					/>
				</div>
			{:else}
				<div class="feld">
					<label for="bevollmaechtigtName">Name der bevollmächtigten Person</label>
					<input id="bevollmaechtigtName" name="bevollmaechtigtName" required minlength="2" />
					<p class="hilfe">
						Eine dritte Person ist selbst nicht stimmberechtigt; sie übt die Stimme der
						bevollmächtigenden Partei aus.
					</p>
				</div>
				<div class="feld">
					<!-- Wie der Papierhaken im Einlass: ein Häkchen mit Text daneben, nicht
					     untereinander wie die Textfelder darüber. M5 (06.11.2026): Der
					     Hilfetext steht in der Konstante, derselbe Wortlaut wie beim
					     Einlass durch Dritte. -->
					<label class="verwaltungshaken">
						<input type="checkbox" name="istVerwaltung" value="ja" />
						<span>Bevollmächtigt ist die Verwaltung</span>
					</label>
					<p class="hilfe">{VERWALTUNG_HAKEN_HILFE_LEITUNG}</p>
				</div>
			{/if}

			<div class="feld">
				<span class="beschriftung">Vollmacht für — mehrere möglich</span>
				<VollmachtFuer vertretbare={waehlbar} zwingend={true} mitNachweis={false} />
			</div>

			<!--
				**Der Grund der Vertretung** (Ä-28 der Zweitprüfung vom 17.09.2026).
				Organvertreter juristischer Personen, gesetzliche Vertreter und
				Mitberechtigte zählen nicht zur Höchstzahl des Reglements; Mitberechtigte
				doch, wenn die Gemeinschaft bei L15 «Zählt mit» gewählt hat. Ohne dieses
				Feld wiese die Sperre sie ab, und zwar ohne Weg daran vorbei.

				**Drei feste Werte, kein Freitext.** Der Befund R-2b hat am 23.09.2026
				ein Begründungsfeld entfernt, das eine Prüfung abschaltete. Hier werden
				Tatsachen erfasst, die zutreffen oder nicht — wer den falschen Wert
				wählt, benutzt keinen vorgesehenen Weg, sondern macht eine
				Falschangabe.

				**Alle drei stehen überall zur Wahl.** Bis zum 24.09.2026 waren «Organ»
				und «gesetzliche Vertretung» auf die dritte Person beschränkt, weil ein
				Organvertreter ja keine Eigentümerin sei. Der Code-Review hat gezeigt,
				dass das nicht trägt: Sie ist keine Eigentümerin der **vertretenen**
				Einheit, kann aber sehr wohl eine eigene besitzen — die
				Geschäftsführerin der GmbH, der Wohnung 5 gehört, wohnt selbst in
				Wohnung 3.

				**Seit dem 03.11.2026 ist «mitberechtigt» kein Klick mehr**
				(Produktentscheid, Fachprüfung F1). Wer im Register als Mitberechtigte
				der vertretenen Partei steht, wird erkannt; von Hand bleibt «nicht im
				Register», mit Nachweis der Mitberechtigung, seit der Fachprüfung C6
				auch für eine Einzelperson (Erbfall bei Alleineigentum). Jeder Grund
				gilt für genau eine Partei
				(`verlangeEinGrundEinePartei`).
			-->
			<div class="feld">
				<label for="vertretungsgrund">{GRUNDFRAGE}</label>
				<select id="vertretungsgrund" name="vertretungsgrund">
					<option value="">{GRUNDWAHL[0].text}</option>
					<option value="organ">{GRUNDWAHL[1].text}</option>
					<option value="gesetzlich">{GRUNDWAHL[2].text}</option>
					<option value="mitberechtigt">{GRUNDWAHL[3].text}</option>
				</select>
				<p class="hilfe">
					Nur ändern, wenn die Person nicht kraft gewöhnlicher Vollmacht handelt: als Organ
					einer Firma, als gesetzliche Vertretung oder als Mitberechtigte, die im Register
					fehlt. Votum zählt solche Vertretungen nicht zur Höchstzahl des Reglements{#if data.schranke.stimmfuehrung === 'mitzaehlen'},
					ausser die Stimme als Mitberechtigte: Sie zählt nach der Einstellung Ihrer Gemeinschaft
					mit{/if}. Gesichert
					ist das nur beim Organ; bei gesetzlicher Vertretung und Mitberechtigten ist es
					rechtlich nicht geklärt. Der Grund steht danach im Protokoll.
				</p>
				<p class="hilfe">{grundhilfe(data.schranke.stimmfuehrung)}</p>
			</div>

			<div class="feld">
				<label for="bemerkung">Bemerkung (freiwillig)</label>
				<input id="bemerkung" name="bemerkung" placeholder="etwa: Vollmacht datiert vom 28.07." />
			</div>

			<button type="submit" class="haupt">Erfassen</button>
			<p class="hilfe">
				Erfassen überträgt noch nichts. Die Vollmachten erscheinen danach unter «Zu prüfen» —
				dort bestätigen Sie sie, sobald der Nachweis vorliegt. Wer am Eingang mit dem Blatt in
				der Hand steht, geht den kürzeren Weg über die Anwesenheitsseite.
			</p>
		</form>
	{/if}

	<!-- ── Beendet ────────────────────────────────────────────────────────── -->
	{#if beendete.length > 0}
		<h2>Beendet</h2>
		<!--
			**Am Telefon Karten statt Spalten** (UI-Durchgang 06.10.2026). Die Tabelle
			stand ohne Bahn da und brauchte bei 390 px 504 px: Die Seite lief 130 px
			quer, und die Spalte «Wann» lag ganz ausserhalb des Bildes. Jetzt das
			Hausmuster aus `app.css`, `.tabellenbahn` mit `table.karten`.
		-->
		<div class="tabellenbahn">
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<table role="table" class="beendet karten">
				<thead>
					<!-- svelte-ignore a11y_no_redundant_roles -->
					<tr role="row">
						<th scope="col">Vollmacht</th>
						<th scope="col">Ausgang</th>
						<th scope="col">Begründung</th>
						<th scope="col">Wann</th>
					</tr>
				</thead>
				<tbody>
					{#each beendete as p (p.id)}
						<!-- svelte-ignore a11y_no_redundant_roles -->
						<tr role="row">
							<td role="cell" class="kopfzelle">{p.bevollmaechtigtName} für {p.vertreteneName}</td>
							<td role="cell" data-spalte="Ausgang">{p.zustandName}</td>
							<td role="cell" data-spalte="Begründung">{p.beendetGrund}</td>
							<td role="cell" data-spalte="Wann" class="klein">
								{datum(p.beendetAm)}{#if p.beendetDurch}, {p.beendetDurch}{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

<style>
	/* Der QR und der Text daneben — dasselbe Muster wie beim Einlass. */
	.telefonweg {
		margin: 0.5rem 0 1.25rem;
	}

	.telefonweg summary {
		min-height: var(--ziel-min);
		padding: 0.5rem 0;
		cursor: pointer;
	}

	.telefonweg .qr {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.telefonweg .qr :global(svg) {
		width: 8rem;
		height: 8rem;
	}

	.telefonweg .wohin {
		flex: 1 1 16rem;
		min-width: 0;
		max-width: 34rem;
	}

	/* Eine Adresse ohne Umbruchstelle sprengt sonst die Telefonbreite. */
	.telefonweg .adresse {
		overflow-wrap: anywhere;
	}

	.weisungen {
		font-size: 0.95rem;
		margin: 0.4rem 0;
	}

	.weisungen ul {
		margin: 0.3rem 0;
	}

	.zahlen {
		color: var(--text-leise);
		font-size: 0.95rem;
	}

	.vollmacht {
		border: 1px solid var(--linie);
		border-radius: 0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.75rem 1rem;
	}

	.vollmacht.offen {
		border-left: 4px solid var(--warnung);
	}

	.vollmacht.wirksam {
		border-left: 4px solid var(--akzent);
	}

	.vollmacht h3 {
		margin: 0 0 0.25rem;
	}

	.klein {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0.15rem 0;
	}

	/*
	 * **Die Kapitel brauchen Luft nach oben** (UI-Durchgang 06.10.2026). `app.css`
	 * gibt Überschriften keinen Abstand nach oben, und der Satz davor hat nur
	 * 0.15rem: «Beendet» stand 2 px unter dem letzten Satz, «Vollmacht
	 * erfassen» 12 px unter der Karte «Wirksam». Derselbe Wert wie auf den
	 * übrigen Seiten mit Kapiteln (etwa `zugaenge`, `historie`).
	 */
	h2 {
		margin-top: 2rem;
	}

	/* Der Hinweis vor der ersten Vollmacht: sachlich, aber nicht zu übersehen. */
	.freigabewarnung {
		border: 1px solid var(--warnung);
		border-left: 4px solid var(--warnung);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warnung) 8%, var(--flaeche));
		padding: 0.75rem 1rem;
		max-width: 46rem;
		margin: 0.75rem 0 1rem;
	}

	/* Sachlich abgesetzt, nicht alarmierend: Der Vermerk erklärt, warum diese
	   Zeile nicht mitzählt, und ist kein Fehler. */
	.grundvermerk {
		margin: 0.2rem 0 0;
		font-size: 0.9rem;
		font-weight: 550;
	}

	.bemerkung {
		font-style: italic;
		margin: 0.25rem 0;
	}

	.nachweis {
		margin: 0.4rem 0;
	}

	.knopfreihe {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.begruendung {
		align-items: end;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.6rem;
	}

	.begruendung input:not([type='file']):not([type='hidden']) {
		min-width: 26ch;
	}

	.begruendung label {
		display: block;
		font-size: 0.9rem;
		width: 100%;
	}

	.erfassen {
		border: 1px solid var(--linie);
		border-radius: 0.5rem;
		max-width: 46rem;
		padding: 1rem;
	}

	.feld {
		margin-bottom: 0.75rem;
	}

	.beschriftung {
		display: block;
		font-weight: 600;
		margin-bottom: 0.2rem;
	}

	.fuer {
		color: var(--text-leise);
		font-weight: 400;
	}

	.feld label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.2rem;
	}

	/*
	 * **`:global(…)`, weil das Auswahlfeld jetzt in `Suchauswahl.svelte` steht.**
	 * Svelte gestaltet nur Elemente, die in dieser Datei stehen; ohne `:global`
	 * fiele die Regel lautlos aus, und das Feld sähe anders aus als seine
	 * Nachbarn. Die Verankerung an der Klasse hält sie trotzdem auf dieser Seite.
	 */
	.feld :global(select),
	.feld :global(.auswahlsuche),
	.feld input {
		max-width: 34rem;
		width: 100%;
	}

	/* `.feld .verwaltungshaken` und nicht bloss `.verwaltungshaken`: `.feld
	 * label` darüber wiegt sonst stärker, und das Häkchen stünde unter
	 * fettgesetztem Text wie ein Textfeld. */
	.feld .verwaltungshaken {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 400;
	}

	.feld .verwaltungshaken input {
		width: auto;
		min-height: 0;
	}

	.wer {
		border: 0;
		margin: 0 0 0.75rem;
		padding: 0;
	}

	.wer legend {
		font-weight: 600;
		padding: 0;
	}

	.wer label {
		display: block;
		font-weight: 400;
	}

	.hilfe {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0.3rem 0 0;
	}

	.beendet {
		border-collapse: collapse;
		width: 100%;
	}

	/* `:where(.beendet)`, damit unter 46rem `table.karten td` aus app.css
	   gewinnt (Auftrag V2, 06.10.2026): Vorher trug in der Karte jede Angabe
	   eine Linie und seitliches Polster, gemessen 16 von 16 Zellen. */
	:where(.beendet) th,
	:where(.beendet) td {
		border-bottom: 1px solid var(--linie);
		padding: 0.4rem 0.5rem;
		text-align: left;
		vertical-align: top;
	}
	.ohneNachweis {
		margin: 0;
		color: var(--text-leise);
		font-size: 0.9375rem;
	}
</style>
