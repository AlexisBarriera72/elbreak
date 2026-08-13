/**
 * Interruptor de «hoy no salimos».
 *
 * Guarda una sola cosa en el Global Config de Vercel: la fecha del día que el
 * dueño marcó como cerrado. No un `true`, una fecha. De ahí sale la propiedad
 * que pidió el dueño: si se le olvida volver a abrir, a medianoche el valor
 * deja de coincidir con hoy y el truck vuelve solo a su horario normal. No hay
 * nada que limpiar ni ninguna tarea programada.
 *
 *   GET  /api/estado   ->  { "cerrado": "2026-08-13" }  o  { "cerrado": null }
 *   POST /api/estado   ->  { clave, cerrado: true|false }
 *
 * Variables de entorno (todas en el panel de Vercel, nunca en el repositorio):
 *
 *   PANEL_CLAVE                la clave que escribe el dueño
 *   GLOBAL_CONFIG_ID           id del Global Config
 *   GLOBAL_CONFIG_READ_TOKEN   token de solo lectura
 *   VERCEL_API_TOKEN           token de la cuenta, solo para escribir
 *   VERCEL_TEAM_ID             opcional, si el proyecto está en un equipo
 */

import { fechaEnZona } from '../public/assets/js/horario.js';

export const config = { runtime: 'edge' };

const LLAVE = 'cierre';
const ZONA = 'America/Puerto_Rico';
const LECTURA = 'https://global-config.vercel.com';
const ESCRITURA = 'https://api.vercel.com/v1/global-config';

const json = (cuerpo, estado = 200, cabeceras = {}) =>
	new Response(JSON.stringify(cuerpo), {
		status: estado,
		headers: { 'content-type': 'application/json; charset=utf-8', ...cabeceras }
	});

/**
 * Compara dos claves sin filtrar por dónde dejan de parecerse.
 *
 * Se comparan los SHA-256, no los textos: así todas las comparaciones duran lo
 * mismo y ni siquiera se escapa la longitud de la clave buena.
 */
async function mismaClave(dada, buena) {
	if (typeof dada !== 'string' || typeof buena !== 'string' || buena === '') return false;

	const texto = new TextEncoder();
	const [a, b] = await Promise.all([
		crypto.subtle.digest('SHA-256', texto.encode(dada)),
		crypto.subtle.digest('SHA-256', texto.encode(buena))
	]);

	const va = new Uint8Array(a);
	const vb = new Uint8Array(b);

	let diferencia = 0;
	for (let i = 0; i < va.length; i++) diferencia |= va[i] ^ vb[i];

	return diferencia === 0;
}

/** La fecha guardada, o null si no hay ninguna o el valor no tiene sentido. */
async function leerCierre(env) {
	const { GLOBAL_CONFIG_ID: id, GLOBAL_CONFIG_READ_TOKEN: token } = env;
	if (!id || !token) return null;

	const respuesta = await fetch(`${LECTURA}/${id}/item/${LLAVE}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	// 404 significa que nunca se ha escrito: día normal.
	if (!respuesta.ok) return null;

	const valor = await respuesta.json();
	return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

/** Escribe la fecha, o null para volver al horario normal. */
async function escribirCierre(env, valor) {
	const { GLOBAL_CONFIG_ID: id, VERCEL_API_TOKEN: token, VERCEL_TEAM_ID: equipo } = env;
	if (!id || !token) return false;

	const url = `${ESCRITURA}/${id}/items${equipo ? `?teamId=${encodeURIComponent(equipo)}` : ''}`;

	const respuesta = await fetch(url, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({ items: [{ operation: 'upsert', key: LLAVE, value: valor }] })
	});

	return respuesta.ok;
}

export default async function handler(peticion) {
	const env = process.env;

	if (peticion.method === 'GET') {
		return json({ cerrado: await leerCierre(env) }, 200, {
			// Medio minuto de retraso como mucho al pulsar el interruptor, a
			// cambio de que mil visitas no sean mil invocaciones de la función.
			'cache-control': 'public, s-maxage=30'
		});
	}

	if (peticion.method !== 'POST') {
		return json({ error: 'Método no permitido.' }, 405, { allow: 'GET, POST' });
	}

	if (!env.PANEL_CLAVE) {
		return json({ error: 'El panel todavía no está configurado.' }, 503);
	}

	let cuerpo;
	try {
		cuerpo = await peticion.json();
	} catch (e) {
		return json({ error: 'No se entendió la petición.' }, 400);
	}

	if (!(await mismaClave(String(cuerpo.clave ?? ''), env.PANEL_CLAVE))) {
		// Frena la fuerza bruta sin tener que guardar nada por IP.
		await new Promise((listo) => setTimeout(listo, 700));
		return json({ error: 'Clave incorrecta.' }, 401);
	}

	const valor = cuerpo.cerrado ? fechaEnZona(ZONA) : null;

	if (!(await escribirCierre(env, valor))) {
		return json({ error: 'No se pudo guardar. Inténtalo otra vez.' }, 502);
	}

	return json({ cerrado: valor }, 200, { 'cache-control': 'no-store' });
}
