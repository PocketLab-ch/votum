import { redirect } from '@sveltejs/kit';
import { abmelden, SITZUNGS_COOKIE } from '$lib/server/auth';
import { keksSicher } from '$lib/server/keks';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies, locals }) => {
		await abmelden(cookies.get(SITZUNGS_COOKIE), locals.benutzer);
		cookies.delete(SITZUNGS_COOKIE, { path: '/', secure: keksSicher() });
		redirect(303, '/anmelden');
	}
};
