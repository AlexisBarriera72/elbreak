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
 * Variables de entorno (en el panel de Vercel, nunca en el repositorio):
 *
 *   GLOBAL_CONFIG      la crea Vercel sola al conectar el store al proyecto
 *   PANEL_CLAVE        la clave que escribe el dueño
 *   VERCEL_API_TOKEN   token de la cuenta, solo para escribir
 *   VERCEL_TEAM_ID     solo si el proyecto está dentro de un equipo
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

/**
 * De dónde salen el id y el token de lectura.
 *
 * Al conectar el Global Config al proyecto, Vercel crea sola la variable
 * GLOBAL_CONFIG con la cadena de conexión entera:
 *
 *   https://global-config.vercel.com/ecfg_xxx?token=yyy
 *
 * Se lee de ahí en vez de pedir que se copien los dos trozos a mano: son dos
 * cosas menos que pegar mal, y si algún día se rota el token, Vercel actualiza
 * la variable y esto sigue funcionando.
 */
export function conexion(env) {
	if (env.GLOBAL_CONFIG) {
		try {
			const url = new URL(env.GLOBAL_CONFIG);
			const id = url.pathname.replace(/^\/+/, '');
			const token = url.searchParams.get('token');

			if (id && token) return { id, token };
		} catch (e) {
			// Cadena mal formada: se prueba con las variables sueltas.
		}
	}

	// Salida de emergencia por si se prefiere ponerlas por separado.
	if (env.GLOBAL_CONFIG_ID && env.GLOBAL_CONFIG_READ_TOKEN) {
		return { id: env.GLOBAL_CONFIG_ID, token: env.GLOBAL_CONFIG_READ_TOKEN };
	}

	return null;
}

async function leerExcepcion(env) {
	const conf = conexion(env);
	if (!conf) return null;

	const respuesta = await fetch(`${LECTURA}/${conf.id}/item/${LLAVE}`, {
		headers: { Authorization: `Bearer ${conf.token}` }
	});

	// 404 significa que nunca se ha escrito: día normal.
	if (!respuesta.ok) return null;

	return excepcionValida(await respuesta.json());
}

/**
 * Escribe la excepción, o null para volver al horario normal.
 *
 * Devuelve el error de Vercel tal cual cuando falla. Casi siempre es una de
 * dos cosas: el token no alcanza al Global Config, o el proyecto está en un
 * equipo y falta VERCEL_TEAM_ID. Sin el mensaje de arriba no hay forma de
 * distinguirlas desde el teléfono.
 */
async function escribirExcepcion(env, valor) {
	const conf = conexion(env);
	const token = env.VERCEL_API_TOKEN;
	const equipo = env.VERCEL_TEAM_ID;

	if (!conf) return { ok: false, detalle: 'Falta GLOBAL_CONFIG.' };
	if (!token) return { ok: false, detalle: 'Falta VERCEL_API_TOKEN.' };

	const url = `${ESCRITURA}/${conf.id}/items${equipo ? `?teamId=${encodeURIComponent(equipo)}` : ''}`;

	const respuesta = await fetch(url, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({ items: [{ operation: 'upsert', key: LLAVE, value: valor }] })
	});

	if (respuesta.ok) return { ok: true };

	const cuerpo = await respuesta.json().catch(() => ({}));
	const mensaje = (cuerpo.error && cuerpo.error.message) || `HTTP ${respuesta.status}`;

	return { ok: false, detalle: mensaje };
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

	// Qué hay puesto y qué falta. Va detrás de la clave, así que no cuenta
	// nada a quien no debería saberlo, y nunca devuelve valores: solo si están.
	if (cuerpo.modo === 'diagnostico') {
		return json(
			{
				diagnostico: {
					GLOBAL_CONFIG: Boolean(conexion(env)),
					PANEL_CLAVE: true,
					VERCEL_API_TOKEN: Boolean(env.VERCEL_API_TOKEN),
					VERCEL_TEAM_ID: Boolean(env.VERCEL_TEAM_ID)
				}
			},
			200,
			{ 'cache-control': 'no-store' }
		);
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

	const guardado = await escribirExcepcion(env, valor);

	if (!guardado.ok) {
		return json({ error: `No se pudo guardar: ${guardado.detalle}` }, 502);
	}

	return json({ excepcion: valor }, 200, { 'cache-control': 'no-store' });
}
