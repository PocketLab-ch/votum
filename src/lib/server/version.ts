import { env } from '$env/dynamic/private';
import { versionAusUmgebung } from '$lib/domain/version';

/**
 * Die Version des laufenden Abbilds (Entscheid 0053): `VOTUM_VERSION`, beim
 * Bau aus dem Abbild-Tag gesetzt (`Dockerfile`, `scripts/abbild-bauen.sh`).
 * Im Entwicklungsstapel fehlt sie, dann `null`.
 */
export function anwendungsversion(): string | null {
	return versionAusUmgebung(env.VOTUM_VERSION);
}
