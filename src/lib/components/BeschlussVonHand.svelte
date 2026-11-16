<script lang="ts">
	/**
	 * Die Maske des Beschlusses von Hand (Plan `docs/plan-beschluss-von-hand-2026-09-30.md`,
	 * Block 2).
	 *
	 * **Der Anlass.** Block 1 hat Kern und Server gebaut; von keiner Seite
	 * erreichbar. Diese Maske ist der einzige Weg dorthin. Sie steht unter
	 * «Jetzt möglich» am aufgerufenen Traktandum und zeigt vor dem Knopf, was
	 * das Werkzeug empfehlen würde (die trockenen Prüfungen des Eröffnens, als
	 * Absagen im Wortlaut) und was überholt wird.
	 *
	 * **Die Sätze stehen in `domain/vonhand.ts`, nicht hier**, samt dem, was die
	 * Laien- und die Fachprüfung an ihnen gefunden haben. Der Ausweg für «nicht
	 * abgestimmt» wird von dort eingebunden (`VON_HAND_OHNE_BESCHLUSS`), nicht
	 * abgeschrieben.
	 *
	 * **Am gemeinsamen Abend steht sie im Notweg-Kasten** der Einzelleitung
	 * (Block 2b, 01.10.2026): dieselbe Maske, mit `notweg=ja` geschickt wie die
	 * vier Formulare daneben. Ohne Abend bleibt sie unter «Jetzt möglich».
	 */
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { gefuehrteWahl } from '$lib/felder';
	import Rueckfrage from './Rueckfrage.svelte';
	import {
		VON_HAND_ABGELEHNT,
		VON_HAND_ANGENOMMEN,
		VON_HAND_BEGRUENDUNG_HOECHSTENS,
		VON_HAND_BEGRUENDUNG_LABEL,
		VON_HAND_EINLEITUNG,
		VON_HAND_ENTHALTUNG,
		VON_HAND_ERFASSUNG,
		VON_HAND_ERGEBNIS,
		VON_HAND_ERGEBNIS_BLEIBT,
		VON_HAND_EINFUEHRUNG_HOECHSTENS,
		VON_HAND_EINFUEHRUNG_LABEL,
		VON_HAND_EINFUEHRUNG_PLATZHALTER,
		VON_HAND_EINWAND_BEDINGUNGEN,
		VON_HAND_EINWAND_EINLEITUNG,
		VON_HAND_EINWAND_ERGEBNIS,
		VON_HAND_EINWAND_FOLGE,
		VON_HAND_EINWAND_HOECHSTENS,
		VON_HAND_EINWAND_LABEL,
		VON_HAND_EINWAND_NICHT_FEST,
		VON_HAND_EINWAND_OFFEN,
		VON_HAND_EINWAND_PLATZHALTER,
		VON_HAND_EINWAND_ZEIGER,
		VON_HAND_GRUND,
		VON_HAND_GRUND_EINWAND,
		VON_HAND_GRUND_NOTWEG,
		VON_HAND_JA,
		VON_HAND_KOEPFE,
		VON_HAND_MIT_ABWEICHUNG,
		VON_HAND_NEIN,
		VON_HAND_NICHTIGKEITSRISIKO,
		VON_HAND_NEU_GESPERRT_RISIKO,
		VON_HAND_AUSSTAND_RISIKO,
		VON_HAND_NICHTS,
		VON_HAND_NOTWEG_WARNUNG,
		VON_HAND_OHNE_ABWEICHUNG,
		VON_HAND_OHNE_BESCHLUSS,
		VON_HAND_PARTEIEN,
		VON_HAND_PARTEIEN_HINWEIS,
		VON_HAND_QUOTEN,
		VON_HAND_RUECKFRAGE,
		VON_HAND_RUECKFRAGE_FOLGE,
		VON_HAND_RUECKFRAGE_JA,
		VON_HAND_SUMMEN,
		VON_HAND_TITEL,
		VON_HAND_VERLAUF_HINWEIS,
		VON_HAND_WAEHLEN
	} from '$lib/domain/vonhand';
	import { einstimmigkeitImSaalSatz, type EinstimmigkeitImSaal } from '$lib/domain/entscheidbaum';

	interface Partei {
		id: string;
		name: string;
		einheiten: { label: string; quote: number }[];
	}

	interface Eigenschaften {
		traktandumId: string;
		/*
		 * Was die Seite aus `holeVonHandVorschau` aufbereitet hat: entweder das
		 * Formular mit der Empfehlung, oder der Satz, warum der Weg hier nicht
		 * geht (zurückgezogener Antrag). `null` heisst, dass es die Maske gar
		 * nicht gibt (Versammlung läuft nicht, oder kein Traktandum aufgerufen).
		 */
		lage:
			| {
					moeglich: true;
					uebergangen: { kennung: string; satz: string }[];
					ueberholt: string[];
					durchgangOffen: boolean;
					ergebnisSteht: boolean;
					/*
					 * Welcher Anwesenheitsstand festgehalten wird, als Satz mit
					 * Zahlen (`vonHandStandSatz` im Kern, Block 6). `null` ohne
					 * Momentaufnahme; dann steht die Zeile nicht.
					 */
					stand: string | null;
					parteien: Partei[];
			  }
			| { moeglich: false; satz: string };
		/*
		 * Am gemeinsamen Abend gesetzt: Dann schickt das Formular `notweg=ja`
		 * mit, wie die vier Formulare des Notweg-Kastens (`nurWennNichtAmAbend`
		 * lässt die Handlung nur damit durch, und der Verlauf hält die Wahl
		 * fest).
		 */
		notweg?: boolean;
		/*
		 * Das Mehr des Traktandums, wie es vor dem Eröffnen dasteht: Titel des
		 * Erfordernisses und der Satz der Mehrheitsvorschau mit Bezugsgrösse.
		 * `null`, wo die Seite keines kennt; dann steht die Zeile nicht.
		 */
		mehr?: { erfordernis: string | null; satz: string } | null;
		/*
		 * Wo der Grund «Eingewendete Bestimmung» an diesem Traktandum gilt
		 * (`einwandLageAm`): dann steht der Hinweis vor der Maske, und die
		 * Ausnahme der Zustimmung aller je Karte. `null` anderswo.
		 */
		einwand?: { einstimmigkeit: EinstimmigkeitImSaal | null } | null;
	}

	let { traktandumId, lage, notweg = false, mehr = null, einwand = null }: Eigenschaften = $props();

	let erfassung = $state<'summen' | 'parteien'>('summen');
	/*
	 * **Der Grund steht zuerst und ist vorgewählt** (Entscheid 0046, A7): Der
	 * Notweg bleibt ohne neue Frage erreichbar (Leitplanken: eine Pflichtfrage
	 * wäre eine halbe Sperre). Mit «Eingewendete Bestimmung» ist der Weg kein
	 * Notweg: Warnung, Einleitung und Ausweg des Notwegs stehen dann nicht,
	 * das Ergebnis ist «Abgelehnt», und am Abend geht `notweg` nicht mit.
	 */
	let grund = $state<'notweg' | 'eingewendete_bestimmung'>('notweg');
	const mitEinwand = $derived(grund === 'eingewendete_bestimmung');
	const formId = $derived(`vonhand-${traktandumId}`);

	/** Nur, wo die Beschlussfähigkeit fehlt, steht die Rechtsfolge. */
	const neuGesperrt = $derived(
		lage.moeglich && lage.uebergangen.some((u) => u.kennung === 'neues_traktandum_gesperrt')
	);
	/** L7 unter «Zählt nicht mit» (Migration 183; Fachprüfung L7, F-2). */
	const ausstandGesperrt = $derived(
		lage.moeglich && lage.uebergangen.some((u) => u.kennung === 'ausstand_nicht_beschlussfaehig')
	);
	const nichtBeschlussfaehig = $derived(
		lage.moeglich && lage.uebergangen.some((u) => u.kennung === 'nicht_beschlussfaehig')
	);
</script>

<!-- Sichtbar ohne die Maske zu öffnen (Laienprüfung E2, R2-L-2). -->
<!-- Am Abend steht die Maske im zugeklappten Notweg-Kasten; dort zeigt die Seite
     den Hinweis über dem Kasten (`VON_HAND_EINWAND_ZEIGER_ABEND`, Codeprüfung E2, M2). -->
{#if einwand && lage.moeglich && !notweg}
	<p class="zeiger">{VON_HAND_EINWAND_ZEIGER}</p>
{/if}
<details class="vonhand">
	<!--
		**Die Marke steht vor dem Titel, `VON_HAND_TITEL` selbst bleibt
		unverändert** (03.10.2026, B3): `server/protokoll.ts` zitiert ihn als
		Knopfnamen, die Rückfrage und beide Durchstiche lesen ihn. Das Dreieck
		des `summary` bleibt; es entsteht aus `display: list-item` und nicht aus
		einem eigenen Zeichen.
	-->
	<summary><span class="marke">Notweg</span> {VON_HAND_TITEL}</summary>

	{#if !lage.moeglich}
		<!-- Der Weg geht hier nicht; der Satz aus dem Kern nennt den Grund und
		     den Ausweg (etwa den Rückzug zurücknehmen). -->
		<p class="meldung warnung">{lage.satz}</p>
	{:else}
		<!--
			**Zugeklappt wie aufgeklappt als Notweg erkennbar** (03.10.2026,
			B3). Der Kasten stand nur unter «Jetzt möglich» bzw. im Notweg-Kasten
			und sah sonst aus wie jede andere Funktion. Er steht an beiden
			Stellen und vor der Einleitung.
		-->
		<!--
			Der Grund vor allem anderen: Er entscheidet, welche Sätze gelten. Das
			Feld gehört über `form` zum Formular weiter unten.
		-->
		<!-- Nur, wo der Grund gilt (`einwandLageAm`); sonst bleibt es beim Notweg ohne Frage. -->
		{#if einwand}
			<label class="grund">
				{VON_HAND_GRUND}
				<select
					name="grund"
					form={formId}
					use:gefuehrteWahl={(w) =>
						(grund = w === 'eingewendete_bestimmung' ? 'eingewendete_bestimmung' : 'notweg')}
				>
					<option value="notweg" selected={grund === 'notweg'}>{VON_HAND_GRUND_NOTWEG}</option>
					<option value="eingewendete_bestimmung" selected={grund === 'eingewendete_bestimmung'}
						>{VON_HAND_GRUND_EINWAND}</option
					>
				</select>
			</label>
		{/if}
		{#if mitEinwand}
			<div class="meldung">
				<p>{VON_HAND_EINWAND_EINLEITUNG}</p>
				<ol class="bedingungen">
					{#each VON_HAND_EINWAND_BEDINGUNGEN as b, i (i)}
						<li>{b}</li>
					{/each}
				</ol>
				{#if einwand?.einstimmigkeit}<p>{einstimmigkeitImSaalSatz(einwand.einstimmigkeit)}</p>{/if}
				<p>{VON_HAND_EINWAND_NICHT_FEST}</p>
				<p>{VON_HAND_EINWAND_FOLGE}</p>
			</div>
			{#if lage.durchgangOffen}
				<p class="meldung warnung">{VON_HAND_EINWAND_OFFEN}</p>
			{/if}
		{:else}
			<p class="meldung warnung">{VON_HAND_NOTWEG_WARNUNG}</p>
		{/if}
		<!--
			**Das Mehr steht in der Maske** (Laien- und Fachprüfung, Lauf B,
			Runde 3). Der Warnkasten verlangt, dass die Leitung selbst prüft; bei
			offener Abstimmung zeigt die Seite das Mehr aber nirgends sonst, und
			die Bezugsgrösse kann nach Reglement abweichen (Rz. 186, 192a ad
			Art. 712m). Derselbe Satz wie vor dem Eröffnen (`mehrheitsvorschau`).
		-->
		{#if mehr}
			<p class="mehr">
				{#if mehr.erfordernis}<strong>{mehr.erfordernis}.</strong>{' '}{/if}{mehr.satz}
			</p>
		{/if}
		{#if !mitEinwand}<p class="hilfe">{VON_HAND_EINLEITUNG}</p>{/if}

		{#if lage.uebergangen.length > 0}
			<p class="hilfe">{VON_HAND_MIT_ABWEICHUNG}</p>
			<ul class="absagen">
				{#each lage.uebergangen as u (u.kennung)}
					<li>{u.satz}</li>
				{/each}
			</ul>
			{#if nichtBeschlussfaehig}
				<p class="meldung warnung">{VON_HAND_NICHTIGKEITSRISIKO}</p>
			{:else if neuGesperrt}
				<!-- L5 (Migration 174; Codeprüfung Block 7, M1): vor dem Klick, nicht erst in der Quittung. -->
				<p class="meldung warnung">{VON_HAND_NEU_GESPERRT_RISIKO}</p>
			{:else if ausstandGesperrt}
				<p class="meldung warnung">{VON_HAND_AUSSTAND_RISIKO}</p>
			{/if}
		{:else}
			<p class="hilfe">{VON_HAND_OHNE_ABWEICHUNG}</p>
		{/if}

		{#if lage.ueberholt.length > 0}
			<ul class="ueberholt">
				{#each lage.ueberholt as satz, i (i)}
					<li>{satz}</li>
				{/each}
			</ul>
		{/if}

		<p class="hilfe">{VON_HAND_VERLAUF_HINWEIS}</p>

		<!-- Der Ausweg für «nicht abgestimmt», aus dem Kern eingebunden. Nicht
		     bei offenem Durchgang: Dort riete er vom einzigen Weg ab, der den
		     Durchgang beendet (Kommentar an der Konstante). -->
		{#if !lage.durchgangOffen && !mitEinwand}
			<p class="ausweg">
				{VON_HAND_OHNE_BESCHLUSS}
				{#if lage.ergebnisSteht}{VON_HAND_ERGEBNIS_BLEIBT}{/if}
			</p>
		{/if}

		<form
			id={formId}
			method="POST"
			action="?/beschlussVonHand"
			class="formular"
			use:enhance={absenden()}
		>
			<input type="hidden" name="traktandum" value={traktandumId} />
			{#if notweg && !mitEinwand}<input type="hidden" name="notweg" value="ja" />{/if}

			<label>
				{VON_HAND_ERFASSUNG}
				<select
					name="erfassung"
					use:gefuehrteWahl={(w) => (erfassung = w === 'parteien' ? 'parteien' : 'summen')}
				>
					<option value="summen" selected={erfassung === 'summen'}>{VON_HAND_SUMMEN}</option>
					<option value="parteien" selected={erfassung === 'parteien'}>{VON_HAND_PARTEIEN}</option>
				</select>
			</label>

			{#if erfassung === 'summen'}
				<fieldset>
					<legend>{VON_HAND_KOEPFE}</legend>
					<div class="dreier">
						<label>{VON_HAND_JA}<input type="number" name="koepfe_ja" min="0" step="1" /></label>
						<label>{VON_HAND_NEIN}<input type="number" name="koepfe_nein" min="0" step="1" /></label>
						<label
							>{VON_HAND_ENTHALTUNG}<input
								type="number"
								name="koepfe_enthaltung"
								min="0"
								step="1"
							/></label
						>
					</div>
				</fieldset>
				<fieldset>
					<!-- Leer heisst «nicht eingetragen»; das ist nicht «null
					     Wertquoten» (Kommentar an `eingabeAusFormular`). -->
					<legend>{VON_HAND_QUOTEN}</legend>
					<div class="dreier">
						<label>{VON_HAND_JA}<input type="number" name="quoten_ja" min="0" step="any" /></label>
						<label
							>{VON_HAND_NEIN}<input type="number" name="quoten_nein" min="0" step="any" /></label
						>
						<label
							>{VON_HAND_ENTHALTUNG}<input
								type="number"
								name="quoten_enthaltung"
								min="0"
								step="any"
							/></label
						>
					</div>
				</fieldset>
			{:else}
				<p class="hilfe">{VON_HAND_PARTEIEN_HINWEIS}</p>
				<ul class="parteien">
					{#each lage.parteien as p (p.id)}
						<li>
							<label>
								{p.name}
								<select name={`wahl_${p.id}`}>
									<option value="">{VON_HAND_NICHTS}</option>
									<option value="yes">{VON_HAND_JA}</option>
									<option value="no">{VON_HAND_NEIN}</option>
									<option value="abstain">{VON_HAND_ENTHALTUNG}</option>
								</select>
							</label>
							<span class="einheiten">
								{p.einheiten.map((e) => `${e.label} (${e.quote})`).join(', ')}
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			{#if mitEinwand}
				<!-- Mit diesem Grund steht das Ergebnis fest (`einwandVonHand`). -->
				<input type="hidden" name="ergebnis" value="abgelehnt" />
				<p class="hilfe">{VON_HAND_EINWAND_ERGEBNIS}</p>
				<label>
					{VON_HAND_EINWAND_LABEL}
					<textarea
						name="einwand"
						required
						maxlength={VON_HAND_EINWAND_HOECHSTENS}
						rows="3"
						placeholder={VON_HAND_EINWAND_PLATZHALTER}
					></textarea>
				</label>
				<label>
					{VON_HAND_EINFUEHRUNG_LABEL}
					<textarea
						name="einfuehrung"
						required
						maxlength={VON_HAND_EINFUEHRUNG_HOECHSTENS}
						rows="2"
						placeholder={VON_HAND_EINFUEHRUNG_PLATZHALTER}
					></textarea>
				</label>
			{:else}
				<label>
					{VON_HAND_ERGEBNIS}
					<!-- Ohne Vorgabe: Der Weg hält fest, was der Saal entschieden hat,
					     nicht was das Werkzeug erwarten würde. -->
					<select name="ergebnis" required>
						<option value="">{VON_HAND_WAEHLEN}</option>
						<option value="angenommen">{VON_HAND_ANGENOMMEN}</option>
						<option value="abgelehnt">{VON_HAND_ABGELEHNT}</option>
					</select>
				</label>
			{/if}

			<label>
				{VON_HAND_BEGRUENDUNG_LABEL}
				<textarea name="begruendung" maxlength={VON_HAND_BEGRUENDUNG_HOECHSTENS} rows="2"></textarea>
			</label>

			<!-- Der Stand, den der Eintrag einfriert, unmittelbar vor dem Knopf
			     (Produktentscheid 02.10.2026). Beim Nachtragen nach einem
			     Ausfall ist er nicht der Stand bei der Abstimmung; die Zeile
			     nennt die Zahlen und den Handgriff. -->
			{#if lage.stand}
				<p class="stand">{lage.stand}</p>
			{/if}

			<!-- Mit Rückfrage: Der Eintrag ist festgeschrieben, und Enter in
			     einem Zahlenfeld öffnet so das Fenster, statt abzuschicken. -->
			<Rueckfrage
				beschriftung={VON_HAND_TITEL}
				gewicht="haupt"
				ton="warnung"
				marke="eingriff:{traktandumId}"
				frage={VON_HAND_RUECKFRAGE}
				folge={VON_HAND_RUECKFRAGE_FOLGE}
				bestaetigen={VON_HAND_RUECKFRAGE_JA}
			/>
		</form>
	{/if}
</details>

<style>
	.vonhand {
		margin-top: 0.6rem;
		font-size: 0.9rem;
	}

	/*
	 * Kein `display` am `summary`: Es nimmt ihm das Dreieck
	 * (`versammlung/dreieck-am-summary`), und ein Satz ohne Dreieck sieht aus
	 * wie ein Satz.
	 */
	.vonhand summary {
		cursor: pointer;
		color: var(--akzent);
		padding: 0.65rem 0;
		font-weight: 600;
	}

	/*
	 * Die Marke «Notweg» in der Warnfarbe, wie `.marke.warnung` auf der
	 * Leitungsseite: Sie sagt dasselbe wie der Warnkasten darunter, und zwei
	 * verschiedene Farben für dieselbe Aussage müsste man erst verbinden.
	 */
	.marke {
		display: inline-block;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--warnung) 25%, transparent);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	/*
	 * **Die Breite des Kastens ist das Mass, nicht eine Zeichenzahl** (Befund
	 * Praxisdurchlauf 03.10.2026, Punkt 9). Die Texte standen auf `62ch` und
	 * endeten damit bei rund 568 px, während der Notweg-Kasten bei offener
	 * Abstimmung über die ganze Breite läuft (gemessen 1041 px) — die Hälfte
	 * der Fläche blieb leer. Schmal bleibt es von selbst schmal: Die Spalte
	 * gibt die Breite vor.
	 */
	.mehr {
		margin: 0.3rem 0;
	}

	.vonhand .hilfe {
		margin: 0.3rem 0;
		color: var(--text-leise);
	}

	.absagen,
	.ueberholt {
		margin: 0.3rem 0;
		padding-left: 1.2rem;
	}

	.absagen li,
	.ueberholt li {
		margin: 0.15rem 0;
	}

	/*
	 * Der Ausweg ist ein Hinweis, keine Absage: Er steht für den Fall, dass
	 * kein Beschluss zustande kam, und nimmt niemandem den Weg.
	 */
	.ausweg {
		margin: 0.6rem 0;
		padding: 0.7rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		border-left: 3px solid var(--warnung);
	}

	/*
	 * Kein leiser Hilfetext: Die Zeile sagt, was mit dem Knopf darunter
	 * festgeschrieben wird. Dieselbe Randmarke wie der Ausweg, in der
	 * Akzentfarbe, weil sie nicht warnt, sondern benennt.
	 */
	.stand {
		margin: 0.2rem 0 0;
		padding: 0.55rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		border-left: 3px solid var(--akzent);
	}

	/* Der Hinweis vor der Maske: benennt, warnt nicht (wie `.stand`). */
	.zeiger {
		margin: 0.6rem 0 0;
		padding: 0.55rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		border-left: 3px solid var(--akzent);
		font-size: 0.9rem;
	}

	.bedingungen {
		margin: 0.3rem 0;
		padding-left: 1.3rem;
	}

	.bedingungen li {
		margin: 0.2rem 0;
	}

	/* Wie die Felder im Formular: Der Grund steht davor, gehört aber dazu. */
	.grund {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-weight: 550;
		max-width: 30rem;
		margin: 0.3rem 0 0.6rem;
	}

	.formular {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.6rem;
	}

	.formular > label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-weight: 550;
		max-width: 30rem;
	}

	fieldset {
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		padding: 0.5rem 0.7rem;
		margin: 0;
		/*
		 * Ohne das bleibt ein `fieldset` browserseitig bei `min-width:
		 * min-content` und läuft auf schmalen Geräten quer
		 * (`docs/gestaltung.md`).
		 */
		min-width: 0;
	}

	legend {
		font-weight: 550;
		font-size: 0.875rem;
	}

	.dreier {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.dreier label {
		flex: 1 1 5rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.875rem;
	}

	.parteien {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-width: 40rem;
	}

	.parteien li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.3rem;
		border-bottom: 1px solid var(--linie);
	}

	.parteien label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.einheiten {
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	/*
	 * Derselbe Kasten wie auf der Leitungsseite und in `Eingriffe`; `.meldung`
	 * ist dort je Datei gestaltet, nicht in `app.css`.
	 */
	.meldung.warnung {
		padding: 0.7rem 0.95rem;
		border-radius: var(--radius);
		border: 1px solid var(--linie);
		margin: 0.5rem 0;
		background: color-mix(in srgb, var(--warnung) 15%, transparent);
	}
</style>
