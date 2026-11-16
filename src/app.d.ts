import type { AngemeldeterBenutzer } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			benutzer: AngemeldeterBenutzer | null;
			/** Herkunft der Anfrage, oder null wenn ihr nicht zu trauen ist. */
			herkunft: string | null;
		}
	}
}

export {};
