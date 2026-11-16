/**
 * Stammdaten aus immotool holen — die Schale (FR-7).
 *
 * **Ein Dienst wie jeder andere: hilfreich, nie Voraussetzung** (FR-7, dritte
 * Konsequenz). Ist nichts eingerichtet, gibt es die Wahl auf der
 * Übernahmeseite gar nicht erst; antwortet immotool nicht, steht das im
 * Betriebsband, und die CSV-Datei sowie die Erfassung von Hand funktionieren
 * unverändert. Keine Versammlung hängt daran — die Übernahme geschieht bei der
 * Vorbereitung, nicht im Saal.
 *
 * **Nur lesen, und nur an einer Stelle.** Diese Datei fragt zwei Endpunkte ab
 * und gibt weiter, was sie bekommt. Umgerechnet wird im Kern
 * (`domain/immotool.ts`), geschrieben über den bestehenden Weg
 * (`server/uebernahme.ts`) — so gibt es keinen zweiten Schreibpfad in die
 * Stammdaten, den man einzeln absichern müsste.
 *
 * **Zeitlimit an jedem Aufruf** (AD-9). Ohne eines hinge die Übernahmeseite,
 * bis das Betriebssystem aufgibt.
 */
import { env } from '$env/dynamic/private';
import { ERREICHBARKEIT_ZEITLIMIT_MS, type Erreichbarkeit } from '$lib/domain/anmeldewege';
import type { ImmotoolStammdaten } from '$lib/domain/immotool';

export interface ImmotoolEinstellungen {
	/** Basisadresse ohne Pfad, etwa `https://immotool.example.ch`. */
	basis: string;
	token: string;
}

export function einstellungen(): ImmotoolEinstellungen | null {
	const basis = env.VERSAMMLUNG_IMMOTOOL_URL?.replace(/\/+$/, '');
	const token = env.VERSAMMLUNG_IMMOTOOL_TOKEN;
	if (!basis || !token) return null;
	return { basis, token };
}

export function istEingerichtet(): boolean {
	return einstellungen() !== null;
}

/**
 * Ein Aufruf gegen immotool, mit Zeitlimit und Schlüssel im Kopf.
 *
 * Der Schlüssel geht als `Authorization`-Kopfzeile mit, nie in der Adresse:
 * Adressen stehen in Zugriffsprotokollen, Kopfzeilen nicht.
 */
async function frage<T>(pfad: string, zeitlimit: number): Promise<T> {
	const e = einstellungen();
	if (!e) throw new Error('immotool ist nicht eingerichtet.');

	const antwort = await fetch(`${e.basis}${pfad}`, {
		headers: { authorization: `Bearer ${e.token}` },
		signal: AbortSignal.timeout(zeitlimit)
	});

	if (antwort.status === 401 || antwort.status === 403) {
		throw new ImmotoolFehler(
			'immotool weist den hinterlegten Schlüssel zurück. Er gehört in ' +
				'VERSAMMLUNG_IMMOTOOL_TOKEN und muss demselben Wert entsprechen, der dort als ' +
				'IMMOTOOL_VERSAMMLUNG_EXPORT_TOKEN steht.'
		);
	}
	if (antwort.status === 503) {
		throw new ImmotoolFehler(
			'In immotool ist für die Übernahme kein Schlüssel hinterlegt; der Endpunkt ist ' +
				'deshalb abgeschaltet (IMMOTOOL_VERSAMMLUNG_EXPORT_TOKEN).'
		);
	}
	if (!antwort.ok) {
		throw new ImmotoolFehler(`immotool antwortet mit ${antwort.status}.`);
	}

	return (await antwort.json()) as T;
}

/** Was schiefgehen kann, in Worten, die auf der Seite stehen dürfen. */
export class ImmotoolFehler extends Error {}

/**
 * Prüft, ob immotool antwortet.
 *
 * Gefragt wird die Liegenschaftsliste — sie ist der kleinste Aufruf, der
 * zugleich den Schlüssel prüft. Ein reiner Erreichbarkeitspfad ohne Schlüssel
 * sagte «antwortet» und verschwiege, dass jeder Abruf danach an der Anmeldung
 * scheitert.
 */
let gemerkt: { bis: number; wert: Erreichbarkeit } | null = null;

export async function pruefeErreichbarkeit(): Promise<Erreichbarkeit> {
	if (!istEingerichtet()) return 'nicht_eingerichtet';
	if (gemerkt && Date.now() < gemerkt.bis) return gemerkt.wert;

	let wert: Erreichbarkeit = 'nicht_erreichbar';
	try {
		await frage<unknown>('/api/integration/versammlung/liegenschaften', ERREICHBARKEIT_ZEITLIMIT_MS);
		wert = 'erreichbar';
	} catch {
		wert = 'nicht_erreichbar';
	}

	// Wie bei Authentik: erreichbar länger gemerkt als nicht erreichbar.
	gemerkt = { wert, bis: Date.now() + (wert === 'erreichbar' ? 60_000 : 15_000) };
	return wert;
}

export interface ImmotoolLiegenschaft {
	id: string;
	short_code: string;
	name: string;
	/** Der Mandant in immotool — dieselbe Kurzbezeichnung kann es zweimal geben. */
	mandant: string;
	einheiten: number;
}

export async function holeLiegenschaften(): Promise<ImmotoolLiegenschaft[]> {
	const antwort = await frage<{ liegenschaften: ImmotoolLiegenschaft[] }>(
		'/api/integration/versammlung/liegenschaften',
		ERREICHBARKEIT_ZEITLIMIT_MS * 4
	);
	return antwort.liegenschaften ?? [];
}

/**
 * Die Stammdaten einer Liegenschaft zum Stichtag.
 *
 * **Der Stichtag ist derselbe, ab dem die Zuordnung hier gilt.** immotool führt
 * Eigentum mit Gültigkeitszeitraum; wer zum 1. Januar übernimmt, will die
 * Eigentümer vom 1. Januar, nicht die von heute. Ohne Stichtag wären es zwei
 * verschiedene Tage in einem Vorgang, und niemand sähe, welcher gilt.
 *
 * Grosszügigeres Zeitlimit als bei der Erreichbarkeitsprüfung: Der Aufruf holt
 * die Namen der Eigentümer aus Tryton, und das ist kein Datenbankzugriff,
 * sondern ein zweiter Dienst hinter dem ersten.
 */
export async function holeStammdaten(
	liegenschaftId: string,
	stichtag: string
): Promise<ImmotoolStammdaten> {
	const pfad =
		`/api/integration/versammlung/stammdaten/${encodeURIComponent(liegenschaftId)}` +
		`?stichtag=${encodeURIComponent(stichtag)}`;
	return frage<ImmotoolStammdaten>(pfad, 30_000);
}
