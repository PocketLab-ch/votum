import { fail, redirect } from '@sveltejs/kit';
import { anmelden, SITZUNGS_COOKIE } from '$lib/server/auth';
import { SITZUNGSDAUER_SEKUNDEN } from '$lib/domain/anmeldeschutz';
import { anmeldewege, sicheresZiel } from '$lib/domain/anmeldewege';
import { istEingerichtet, pruefeErreichbarkeit, vermerkeRueckfall } from '$lib/server/authentik';
import { keksSicher } from '$lib/server/keks';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.benutzer) redirect(303, sicheresZiel(url.searchParams.get('weiter')));

	// Die Erreichbarkeit wird beim Öffnen der Seite geprüft, mit Zeitlimit
	// (AD-9). Erst wenn sie feststeht, weiss die Seite, welche Wege sie anbietet
	// — und im Versammlungsraum ohne Netz ist die Antwort in zwei Sekunden da.
	const erreichbarkeit = await pruefeErreichbarkeit();

	return {
		weiter: sicheresZiel(url.searchParams.get('weiter')),
		wege: anmeldewege({ eingerichtet: istEingerichtet(), erreichbarkeit }),
		fehlerAusOidc: url.searchParams.get('fehler')
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, locals }) => {
		const daten = await request.formData();
		const username = String(daten.get('username') ?? '').trim();
		const kennwort = String(daten.get('kennwort') ?? '');
		const weiter = String(daten.get('weiter') ?? '/');

		if (!username || !kennwort) {
			return fail(400, { fehler: 'Bitte Benutzername und Kennwort eingeben.', username });
		}

		// Die Herkunft kommt aus dem Wächter — dort entscheidet sich, ob ihr zu
		// trauen ist (siehe `hooks.server.ts`).
		const ergebnis = await anmelden(username, kennwort, Date.now(), locals.herkunft);

		if (ergebnis.art === 'gesperrt') {
			const minuten = Math.ceil(ergebnis.verbleibendSekunden / 60);
			return fail(429, {
				fehler: `Zu viele Fehlversuche. Bitte in ${minuten} Minute${minuten === 1 ? '' : 'n'} erneut versuchen.`,
				username
			});
		}

		if (ergebnis.art === 'abgelehnt') {
			// Bewusst keine Unterscheidung, ob der Benutzer existiert.
			return fail(401, { fehler: 'Benutzername oder Kennwort stimmt nicht.', username });
		}

		cookies.set(SITZUNGS_COOKIE, ergebnis.sitzungsmerkmal, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			// Im lokalen Betrieb ohne Zertifikat wäre secure hinderlich; dort läuft
			// die Verbindung über das eigene WLAN mit eigenem Zertifikat.
			secure: keksSicher(),
			maxAge: SITZUNGSDAUER_SEKUNDEN
		});

		// Wurde ausgewichen, weil die zentrale Anmeldung nicht erreichbar ist,
		// gehört das in den Verlauf (AD-9). Nur dann — wo Authentik gar nicht
		// eingerichtet ist, ist die lokale Anmeldung der vorgesehene Weg.
		const wege = anmeldewege({
			eingerichtet: istEingerichtet(),
			erreichbarkeit: await pruefeErreichbarkeit()
		});
		if (wege.rueckfall) {
			await vermerkeRueckfall({
				operatorId: ergebnis.benutzer.operatorId,
				userId: ergebnis.benutzer.id,
				label: ergebnis.benutzer.displayName
			});
		}

		redirect(303, sicheresZiel(weiter));
	}
};
