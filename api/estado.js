/**
 * La excepción de hoy: «hoy no salimos» o «hoy abrimos aunque no toque».
 *
 * Se guarda una sola cosa en el Global Config de Vercel, y siempre lleva la
 * fecha dentro:
 *
 *   { "fecha": "2026-08-13", "modo": "cerrado" }
 *   { "fecha": "2026-08-15", "modo": "abierto", "abre": "17:00", "cierra": "22:00" }
 *   null
 *
 * Que se guarde la fecha y no un sí/no es lo que hace que el truck vuelva solo
 * a su horario: en cuanto deja de ser hoy, la excepción deja de valer. Si al
 * dueño se le olvida deshacerla, no pasa nada. No hay nada que limpiar ni
 * ninguna tarea programada.
 *
 *   GET  /api/estado   ->  { "excepcion": {...} | null }
 *   POST /api/estado   ->  { clave, modo: "cerrado"|"abierto"|"normal", abre?, cierra? }
 *
 * Variables de entorno (todas en el panel de Vercel, nunca en el repositorio):
 *
 *   PANEL_CLAVE                la clave que escribe el dueño
 *   GLOBAL_CONFIG_ID           id del Global Config
 *   GLOBAL_CONFIG_READ_TOKEN   token de solo lectura
 *   VERCEL_API_TOKEN           token de la cuenta, solo para escribir
 *   VERCEL_TEAM_ID             opcional, si el proyecto está en un equipo
 */

import { fechaEnZona, aMinutos } from '../public/assets/js/horario.js';

export const config = { runtime: 'edge' };

const LLAVE = 'excepcion';
const ZONA = 'America/Puerto_Rico';
const LECTURA = 'https://global-config.vercel.com';
const ESCRITURA = 'https://api.vercel.com/v1/global-config';

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ES_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

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

/**
 * Deja pasar solo lo que la página sabe interpretar. Lo que venga raro se trata
 * como si no hubiera excepción, que es el estado seguro: el horario normal.
 */
function excepcionValida(v) {
	if (!v || typeof v !== 'object') return null;
	if (!ES_FECHA.test(v.fecha || '')) return null;

	if (v.modo === 'cerrado') return { fecha: v.fecha, modo: 'cerrado' };

	if (v.modo === 'abierto') {
		if (!ES_HORA.test(v.abre || '') || !ES_HORA.test(v.cierra || '')) return null;
		if (aMinutos(v.abre) >= aMinutos(v.cierra)) return null;
		return { fecha: v.fecha, modo: 'abierto', abre: v.abre, cierra: v.cierra };
	}

	return null;
}

async function leerExcepcion(env) {
	const { GLOBAL_CONFIG_ID: id, GLOBAL_CONFIG_READ_TOKEN: token } = env;
	if (!id || !token) return null;

	const respuesta = await fetch(`${LECTURA}/${id}/item/${LLAVE}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	// 404 significa que nunca se ha escrito: día normal.
	if (!respuesta.ok) return null;

	return excepcionValida(await respuesta.json());
}

/** Escribe la excepción, o null para volver al horario normal. */
async function escribirExcepcion(env, valor) {
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
		return json({ excepcion: await leerExcepcion(env) }, 200, {
			// Medio minuto de retraso como mucho al pulsar un botón, a cambio de
			// que mil visitas no sean mil invocaciones de la función.
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

	const hoy = fechaEnZona(ZONA);
	let valor = null;

	if (cuerpo.modo === 'cerrado') {
		valor = { fecha: hoy, modo: 'cerrado' };
	} else if (cuerpo.modo === 'abierto') {
		valor = excepcionValida({
			fecha: hoy,
			modo: 'abierto',
			abre: cuerpo.abre,
			cierra: cuerpo.cierra
		});

		if (!valor) {
			return json({ error: 'Revisa las horas: la de abrir tiene que ir antes.' }, 400);
		}
	} else if (cuerpo.modo !== 'normal') {
		return json({ error: 'No sé qué hacer con ese modo.' }, 400);
	}

	if (!(await escribirExcepcion(env, valor))) {
		return json({ error: 'No se pudo guardar. Inténtalo otra vez.' }, 502);
	}

	return json({ excepcion: valor }, 200, { 'cache-control': 'no-store' });
}
