/**
 * Aviso de orden al teléfono del dueño.
 *
 * Una sola función escrita con Request/Response estándar, así corre igual en
 * Vercel, Cloudflare Pages y Netlify. Los tres adaptadores de api/, functions/
 * y netlify/ no hacen más que llamar aquí.
 *
 * Importante: si no hay credenciales de Telegram configuradas, esto responde
 * 204 y ya. El sitio se despliega y funciona sin configurar nada — WhatsApp
 * sigue siendo el camino principal de la orden.
 */

const LIMITE_BYTES = 8000;
const LIMITE_LINEAS = 40;

const json = (datos, estado = 200) =>
	new Response(JSON.stringify(datos), {
		status: estado,
		headers: { 'content-type': 'application/json; charset=utf-8' }
	});

/** 10 -> "$10" · 11.5 -> "$11.50" */
function precio(n) {
	const centavos = Math.round(n * 100) % 100;
	return '$' + (centavos === 0 ? n.toFixed(0) : n.toFixed(2));
}

/** Escapa los caracteres que rompen el modo HTML de Telegram. */
function esc(texto) {
	return String(texto ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * Da forma al mensaje que le llega al dueño.
 * Se escribe para leerlo de un vistazo con el truck lleno.
 */
function componerMensaje(orden) {
	const lineas = [
		'<b>🔔 Nueva orden desde la web</b>',
		''
	];

	orden.lineas.forEach((l) => {
		lineas.push(`<b>${l.cantidad}×</b> ${esc(l.nombre)} — ${precio(l.precio * l.cantidad)}`);
		if (l.detalle) lineas.push(`<i>${esc(l.detalle)}</i>`);
	});

	lineas.push('');
	lineas.push(`<b>Total: ${precio(orden.total)}</b>`);
	lineas.push(orden.modo === 'delivery' ? '🛵 Delivery' : '🏪 Recogido');

	if (orden.cliente) lineas.push(`👤 ${esc(orden.cliente)}`);
	if (orden.nota) lineas.push(`📝 ${esc(orden.nota)}`);

	lineas.push('');
	lineas.push('<i>Aviso automático. El cliente puede enviarte la misma orden por WhatsApp.</i>');

	return lineas.join('\n');
}

/**
 * Comprueba que lo recibido tenga forma de orden.
 * No confiamos en el navegador: cualquiera puede llamar a este endpoint.
 */
function validar(datos) {
	if (!datos || typeof datos !== 'object') return 'Cuerpo inválido';
	if (!Array.isArray(datos.lineas) || datos.lineas.length === 0) return 'La orden va vacía';
	if (datos.lineas.length > LIMITE_LINEAS) return 'Demasiadas líneas';

	for (const l of datos.lineas) {
		if (typeof l.nombre !== 'string' || !l.nombre.trim()) return 'Línea sin nombre';
		if (typeof l.precio !== 'number' || !isFinite(l.precio) || l.precio < 0) return 'Precio inválido';
		if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > 99) return 'Cantidad inválida';
	}

	if (typeof datos.total !== 'number' || !isFinite(datos.total) || datos.total < 0) {
		return 'Total inválido';
	}

	return null;
}

/** Recorta los textos libres antes de reenviarlos. */
function limpiar(orden) {
	const corta = (s, n) => String(s ?? '').slice(0, n);

	return {
		lineas: orden.lineas.slice(0, LIMITE_LINEAS).map((l) => ({
			nombre: corta(l.nombre, 80),
			detalle: corta(l.detalle, 200),
			precio: l.precio,
			cantidad: l.cantidad
		})),
		total: orden.total,
		cliente: corta(orden.cliente, 60),
		modo: orden.modo === 'delivery' ? 'delivery' : 'recogido',
		nota: corta(orden.nota, 300)
	};
}

/**
 * @param {Request} request
 * @param {Record<string, string|undefined>} env
 * @returns {Promise<Response>}
 */
export async function manejarOrden(request, env = {}) {
	if (request.method !== 'POST') {
		return json({ error: 'Usa POST' }, 405);
	}

	const crudo = await request.text();

	if (crudo.length > LIMITE_BYTES) {
		return json({ error: 'Orden demasiado grande' }, 413);
	}

	let datos;
	try {
		datos = JSON.parse(crudo);
	} catch (e) {
		return json({ error: 'JSON inválido' }, 400);
	}

	const problema = validar(datos);
	if (problema) {
		return json({ error: problema }, 400);
	}

	const token = env.TELEGRAM_BOT_TOKEN;
	const chat = env.TELEGRAM_CHAT_ID;

	// Sin configurar: la orden va por WhatsApp igual, así que no es un error.
	if (!token || !chat) {
		return new Response(null, { status: 204 });
	}

	const orden = limpiar(datos);

	try {
		const respuesta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				chat_id: chat,
				text: componerMensaje(orden),
				parse_mode: 'HTML',
				disable_web_page_preview: true
			})
		});

		if (!respuesta.ok) {
			// No devolvemos el detalle de Telegram: llevaría el token en la URL.
			console.error('Telegram respondió', respuesta.status);
			return json({ ok: false }, 502);
		}
	} catch (e) {
		console.error('No se pudo avisar por Telegram:', e.message);
		return json({ ok: false }, 502);
	}

	return json({ ok: true });
}
