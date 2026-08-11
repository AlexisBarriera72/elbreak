/**
 * Endpoint de aviso: valida lo que recibe y no se cae si no hay Telegram.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { manejarOrden } from '../src/order-handler.js';

const pedir = (cuerpo, metodo = 'POST') =>
	new Request('https://elbreak.test/api/order', {
		method: metodo,
		headers: { 'content-type': 'application/json' },
		body: metodo === 'GET' ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
	});

const ORDEN_OK = {
	lineas: [{ nombre: 'Burger Caramelizado', precio: 10, cantidad: 1, detalle: '' }],
	total: 10,
	cliente: 'Ana',
	modo: 'recogido',
	nota: ''
};

test('sin Telegram configurado responde 204 y no es un error', async () => {
	const r = await manejarOrden(pedir(ORDEN_OK), {});
	assert.equal(r.status, 204);
});

test('rechaza métodos que no sean POST', async () => {
	const r = await manejarOrden(pedir(null, 'GET'), {});
	assert.equal(r.status, 405);
});

test('rechaza JSON roto', async () => {
	const r = await manejarOrden(pedir('{esto no es json'), {});
	assert.equal(r.status, 400);
});

test('rechaza una orden vacía', async () => {
	const r = await manejarOrden(pedir({ lineas: [], total: 0 }), {});
	assert.equal(r.status, 400);
});

test('rechaza cantidades y precios inválidos', async () => {
	const malas = [
		{ lineas: [{ nombre: 'X', precio: 10, cantidad: 0 }], total: 10 },
		{ lineas: [{ nombre: 'X', precio: 10, cantidad: 1.5 }], total: 10 },
		{ lineas: [{ nombre: 'X', precio: -5, cantidad: 1 }], total: 10 },
		{ lineas: [{ nombre: '', precio: 10, cantidad: 1 }], total: 10 },
		{ lineas: [{ nombre: 'X', precio: 10, cantidad: 1 }], total: 'mucho' }
	];

	for (const mala of malas) {
		const r = await manejarOrden(pedir(mala), {});
		assert.equal(r.status, 400, JSON.stringify(mala));
	}
});

test('rechaza cuerpos enormes', async () => {
	const r = await manejarOrden(pedir('x'.repeat(9000)), {});
	assert.equal(r.status, 413);
});

test('rechaza órdenes con demasiadas líneas', async () => {
	const lineas = Array.from({ length: 41 }, () => ({ nombre: 'X', precio: 1, cantidad: 1 }));
	const r = await manejarOrden(pedir({ lineas, total: 41 }), {});
	assert.equal(r.status, 400);
});

test('con Telegram configurado manda el mensaje y no filtra el token', async () => {
	const original = globalThis.fetch;
	let urlLlamada = '';
	let cuerpoEnviado = null;

	globalThis.fetch = async (url, opciones) => {
		urlLlamada = url;
		cuerpoEnviado = JSON.parse(opciones.body);
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	};

	try {
		const r = await manejarOrden(pedir(ORDEN_OK), {
			TELEGRAM_BOT_TOKEN: 'token-secreto',
			TELEGRAM_CHAT_ID: '123'
		});

		assert.equal(r.status, 200);
		assert.ok(urlLlamada.includes('api.telegram.org'));
		assert.equal(cuerpoEnviado.chat_id, '123');
		assert.match(cuerpoEnviado.text, /Burger Caramelizado/);
		assert.match(cuerpoEnviado.text, /Total: \$10/);
		assert.match(cuerpoEnviado.text, /Recogido/);

		const respuesta = await r.text();
		assert.ok(!respuesta.includes('token-secreto'), 'la respuesta no puede llevar el token');
	} finally {
		globalThis.fetch = original;
	}
});

test('si Telegram falla devuelve 502 sin filtrar nada', async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });

	try {
		const r = await manejarOrden(pedir(ORDEN_OK), {
			TELEGRAM_BOT_TOKEN: 'token-secreto',
			TELEGRAM_CHAT_ID: '123'
		});
		assert.equal(r.status, 502);
		const texto = await r.text();
		assert.ok(!texto.includes('token-secreto'));
	} finally {
		globalThis.fetch = original;
	}
});

test('escapa el HTML que venga en el nombre del cliente', async () => {
	const original = globalThis.fetch;
	let texto = '';

	globalThis.fetch = async (url, opciones) => {
		texto = JSON.parse(opciones.body).text;
		return new Response('{}', { status: 200 });
	};

	try {
		await manejarOrden(
			pedir({ ...ORDEN_OK, cliente: '<script>alert(1)</script>' }),
			{ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' }
		);
		assert.ok(!texto.includes('<script>'), 'el HTML del cliente tiene que ir escapado');
		assert.match(texto, /&lt;script&gt;/);
	} finally {
		globalThis.fetch = original;
	}
});
