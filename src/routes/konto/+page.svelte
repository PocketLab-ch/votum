<script lang="ts">
	import Meldung from '$lib/components/Meldung.svelte';
	let { data, form } = $props();

	const fehler = $derived(form && 'fehler' in form ? form.fehler : null);
	const hinweis = $derived(form && 'hinweis' in form ? form.hinweis : null);
</script>

<svelte:head><title>Mein Konto</title></svelte:head>

	<h1>Mein Konto</h1>

	{#if hinweis}
		<Meldung ton="gut" marke={form}>{hinweis}</Meldung>
	{:else if fehler}
		<Meldung ton="fehler" marke={form}>{fehler.nachricht}</Meldung>
	{/if}

	<!--
		`.kachel` statt `karte` (UI-Durchgang 06.10.2026): Die Klasse `karte` trug
		keinen Stil, die drei Abschnitte standen ohne Rahmen, und am Telefon stand
		jede Überschrift 12 px unter dem letzten Absatz des vorigen Abschnitts.
	-->
	<div class="kacheln">
		<section class="kachel">
			<h2>Wer bin ich hier?</h2>
			<p class="antwort">{data.konto.displayName}</p>
			<dl>
				<dt>Benutzername</dt>
				<dd>{data.konto.username}</dd>
				<dt>Rolle</dt>
				<dd>{data.konto.rolle}</dd>
			</dl>
			{#if data.authentikEingerichtet}
				<p class="hilfe">
					Melden Sie sich über die zentrale Anmeldung an, ändern Sie Ihr Kennwort dort. Das
					Kennwort hier gilt für den Weg, der auch ohne Netz funktioniert.
				</p>
			{/if}
		</section>

		{#if data.authentikEingerichtet}
			<!--
				**Der Stand der eigenen Verknüpfung gehört hierher** (Auftraggeber, 16.09.2026).
				Gesucht wurde er zuerst auf dieser Seite, und hier stand nichts darüber —
				die Auskunft gab es nur in der Kontenliste, und die ist der Verwaltung
				vorbehalten. Eine Sitzungsleitung konnte über ihr eigenes Konto also
				nicht erfahren, ob es an eine Authentik-Identität gebunden ist.
			-->
			<section class="kachel">
				<h2>Anmeldung über Authentik</h2>
				<p class="antwort">
					{#if data.konto.ueberAuthentik}
						Verknüpft. Ihre Anmeldung läuft über die hinterlegte Kennung.
					{:else}
						Nicht verknüpft. Sie melden sich mit Benutzername und Kennwort an.
					{/if}
				</p>

				{#if data.konto.ueberAuthentik}
					<form method="POST" action="?/verknuepfungLoesen" class="formular">
						<p class="hilfe">
							Nach dem Lösen kommen Sie nur noch über Benutzername und Kennwort herein.
							Ihre übrigen angemeldeten Geräte werden dabei beendet, dieses bleibt
							angemeldet.
						</p>
						{#if !data.konto.hatKennwort}
							<p class="warnung">
								Für Ihr Konto ist <strong>kein Kennwort</strong> hinterlegt. Ohne die
								Verknüpfung kämen Sie nicht mehr herein. Setzen Sie zuerst eines — dafür
								braucht es allerdings das bisherige, das es nicht gibt; wenden Sie sich an
								die Verwaltung.
							</p>
						{/if}
						<button type="submit" disabled={!data.konto.hatKennwort}>Verknüpfung lösen</button>
					</form>
				{:else}
					<p class="hilfe">
						Die Verknüpfung stellt die Verwaltung her: Sie trägt Ihre Adresse ein und gibt
						die erste Anmeldung frei. Danach genügt «Mit Authentik anmelden».
					</p>
				{/if}
			</section>
		{/if}

		<section class="kachel">
			<h2>Kennwort ändern</h2>
			<p class="hilfe">
				Mindestens {data.mindestlaenge} Zeichen. Am einfachsten ist eine Wortfolge, die Sie sich
				merken können — Länge trägt mehr als Sonderzeichen.
			</p>

			<form method="POST" action="?/kennwort" class="formular">
				<label>
					Bisheriges Kennwort
					<input type="password" name="alt" required autocomplete="current-password" />
				</label>
				<label>
					Neues Kennwort
					<input
						type="password"
						name="neu"
						required
						minlength={data.mindestlaenge}
						autocomplete="new-password"
					/>
				</label>
				<label>
					Neues Kennwort wiederholen
					<input
						type="password"
						name="wiederholung"
						required
						minlength={data.mindestlaenge}
						autocomplete="new-password"
					/>
				</label>
				<!--
					**Was dabei sonst noch geschieht**, steht vorher da und nicht als
					Überraschung nachher: Wer sein Kennwort wechselt, tut das im Zweifel,
					weil es jemand kennt — dann hilft ein neues nichts, solange die alte
					Sitzung weiterläuft.
				-->
				<p class="hilfe">
					Alle anderen angemeldeten Geräte werden dabei abgemeldet. Dieses bleibt angemeldet.
				</p>
				<button type="submit" class="haupt">Kennwort ändern</button>
			</form>
		</section>
	</div>


<style>

	/*
	 * Der Satz, der den gesperrten Knopf erklärt, muss stärker wirken als der
	 * graue Hilfetext darüber — sonst liest man über ihn hinweg. Dieselbe Bauart
	 * wie `p.warnung` auf der Leitungsseite (Code-Review 16.09.2026).
	 */
	p.warnung {
		color: var(--warnung);
		font-size: 0.9rem;
		margin: 0;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.8rem;
		margin: 0.5rem 0 0;
		font-size: 0.92rem;
	}

	dt {
		color: var(--text-leise);
	}

	dd {
		margin: 0;
	}

	.antwort {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.formular {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.6rem;
	}

	.formular label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.92rem;
	}

	.hilfe {
		margin: 0.3rem 0 0;
		color: var(--text-leise);
		font-size: 0.88rem;
	}
</style>
