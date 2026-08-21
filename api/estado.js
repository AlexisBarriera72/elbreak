/**
 * La excepción de hoy.
 *
 * Todo lo que el dueño puede cambiar sobre la marcha vive en un solo valor del
 * Global Config, y siempre lleva la fecha dentro:
 *
 *   {
 *     "fecha":    "2026-08-13",
 *     "modo":     "cerrado" | "abierto",   // opcional
 *     "abre":     "17:00", "cierra": "22:00",
 *     "agotados": ["pulled-pork-bbq"],
 *     "especial": "Hoy pastelón de amarillos $8"
 *   }
 *
 * Una sola fecha para las tres cosas, y por eso las tres caducan juntas: en
 * cuanto deja de ser hoy, el truck vuelve a su horario, los platos vuelven a
 * estar disponibles y el aviso desaparece. Si al dueño se le olvida
 * deshacerlo, no pasa nada. No hay nada que limpiar ni tarea programada.
 *
 *   GET  /api/estado   ->  { "excepcion": {...} | null }
 *   POST /api/estado   ->  { clave, ...lo que se quiera cambiar }
 *
 * El POST es un parche: solo toca lo que le mandas. Marcar un plato agotado no
 * borra el aviso del día ni el horario.
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
const ES_ID = /^[a-z0-9-]{1,40}$/;
const MAX_AGOTADOS = 60;
const MAX_ESPECIAL = 160;

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

/**
 * Deja pasar solo lo que la página sabe interpretar, y devuelve null si al
 * final no queda ninguna excepción de verdad. Lo que venga raro se descarta en
 * silencio: el estado seguro es el horario normal con todo disponible.
 */
export function excepcionValida(v) {
	if (!v || typeof v !== 'object') return null;
	if (!ES_FECHA.test(v.fecha || '')) return null;

	const limpia = { fecha: v.fecha };

	if (v.modo === 'cerrado') {
		limpia.modo = 'cerrado';
	} else if (
		v.modo === 'abierto' &&
		ES_HORA.test(v.abre || '') &&
		ES_HORA.test(v.cierra || '') &&
		aMinutos(v.abre) < aMinutos(v.cierra)
	) {
		limpia.modo = 'abierto';
		limpia.abre = v.abre;
		limpia.cierra = v.cierra;
	}

	if (Array.isArray(v.agotados)) {
		const ids = [...new Set(v.agotados.filter((i) => typeof i === 'string' && ES_ID.test(i)))];
		if (ids.length) limpia.agotados = ids.slice(0, MAX_AGOTADOS);
	}

	if (typeof v.especial === 'string' && v.especial.trim()) {
		limpia.especial = v.especial.trim().slice(0, MAX_ESPECIAL);
	}

	// Solo la fecha no es una excepción.
	return Object.keys(limpia).length > 1 ? limpia : null;
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
 * Escribe la excepción, o null para volver a la normalidad.
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

/**
 * Aplica el cambio pedido sobre lo que ya había hoy.
 *
 * Es un parche, no un reemplazo: marcar un plato agotado no puede borrar el
 * aviso del día ni el horario que se puso por la mañana.
 *
 * @returns {{base: object} | {error: string}}
 */
export function aplicarCambio(anterior, cuerpo, hoy) {
	// Si lo guardado es de otro día, ya no vale: se empieza de cero.
	const base = anterior && anterior.fecha === hoy ? { ...anterior } : {};
	base.fecha = hoy;

	if ('modo' in cuerpo) {
		if (cuerpo.modo === 'normal') {
			delete base.modo;
			delete base.abre;
			delete base.cierra;
		} else if (cuerpo.modo === 'cerrado') {
			base.modo = 'cerrado';
			delete base.abre;
			delete base.cierra;
		} else if (cuerpo.modo === 'abierto') {
			if (
				!ES_HORA.test(cuerpo.abre || '') ||
				!ES_HORA.test(cuerpo.cierra || '') ||
				aMinutos(cuerpo.abre) >= aMinutos(cuerpo.cierra)
			) {
				return { error: 'Revisa las horas: la de abrir tiene que ir antes.' };
			}
			base.modo = 'abierto';
			base.abre = cuerpo.abre;
			base.cierra = cuerpo.cierra;
		} else {
			return { error: 'No sé qué hacer con ese modo.' };
		}
	}

	if ('agotados' in cuerpo) {
		if (!Array.isArray(cuerpo.agotados)) return { error: 'La lista de agotados no es una lista.' };
		base.agotados = cuerpo.agotados;
	}

	if ('especial' in cuerpo) {
		if (typeof cuerpo.especial !== 'string') return { error: 'El aviso tiene que ser texto.' };
		base.especial = cuerpo.especial;
	}

	return { base };
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
	const cambio = aplicarCambio(await leerExcepcion(env), cuerpo, hoy);

	if (cambio.error) return json({ error: cambio.error }, 400);

	const valor = excepcionValida(cambio.base);
	const guardado = await escribirExcepcion(env, valor);

	if (!guardado.ok) {
		return json({ error: `No se pudo guardar: ${guardado.detalle}` }, 502);
	}

	return json({ excepcion: valor }, 200, { 'cache-control': 'no-store' });
}
