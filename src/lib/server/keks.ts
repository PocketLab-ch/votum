/**
 * Ob Kekse das Secure-Attribut tragen.
 *
 * Massgebend ist die Adresse, unter der die Anwendung erreichbar ist (ORIGIN),
 * nicht die Betriebsart: Das Betriebsabbild läuft ausdrücklich auch ohne
 * Zertifikat — auf dem Notebook im Versammlungsraum und im IP-Betrieb ohne
 * Proxy. Das frühere `secure: !dev` sperrte dort jede Anmeldung aus, und zwar
 * ohne Fehlermeldung: Der Browser verwirft einen Secure-Keks über http
 * kommentarlos, die Anmeldung antwortet mit einer Umleitung, und die Zielseite
 * schickt einen zurück zur Anmeldung (gefunden beim ersten Aufsetzen des
 * Betriebsstapels auf dem Dev-Host, 15.08.2026). Hinter https bleibt Secure gesetzt.
 */
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export function keksSicher(): boolean {
	if (dev) return false;
	return (env.ORIGIN ?? '').startsWith('https://');
}
