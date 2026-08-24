/**
 * Content-Security-Policy.
 *
 * Esto se prueba porque falla de la peor manera: si un hash no cuadra, el
 * navegador no avisa en la página — simplemente no ejecuta el script, y el
 * sitio se queda sin horario en vivo, sin versículo y sin carrito, con la
 * carta intacta para que no se note a simple vista.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { conCSP } from '../src/csp.js';

const sha = (s) => 'sha256-' + createHash('sha256').update(s, 'utf8').digest('base64');
const pagina = (dentro) => `<!DOCTYPE html>\n<html><head>\n<meta charset="utf-8">\n</head>\n<body>${dentro}</body></html>`;
const politica = (html) => (html.match(/content="(default-src[^"]*)"/) || [])[1] || '';

test('mete la política justo después del charset', () => {
	const html = conCSP(pagina(''));
	assert.match(html, /<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy"/);
});

test('un script en línea queda cubierto por su hash', () => {
	const codigo = 'window.EL_BREAK={"whatsapp":"17872048105"};';
	const csp = politica(conCSP(pagina(`<script>${codigo}</script>`)));

	assert.ok(csp.includes(sha(codigo)), 'el hash del script tiene que estar en la política');
});

test('cubre también el bloque de schema.org, que también es un <script>', () => {
	const datos = '{"@type":"FoodEstablishment"}';
	const codigo = 'window.EL_BREAK={};';
	const csp = politica(
		conCSP(pagina(`<script type="application/ld+json">${datos}</script><script>${codigo}</script>`))
	);

	assert.ok(csp.includes(sha(datos)), 'falta el hash del JSON-LD');
	assert.ok(csp.includes(sha(codigo)), 'falta el hash del bloque de datos');
});

test('un script con src no necesita hash: lo cubre self', () => {
	const csp = politica(conCSP(pagina('<script type="module" src="/assets/js/app.js"></script>')));

	assert.equal((csp.match(/sha256-/g) || []).length, 0, 'no debería inventar hashes');
	assert.match(csp, /script-src 'self'/);
});

test('cambiar un solo carácter cambia el hash', () => {
	const a = politica(conCSP(pagina('<script>const precio = 9;</script>')));
	const b = politica(conCSP(pagina('<script>const precio = 10;</script>')));

	assert.notEqual(a, b, 'si no cambiara, un cambio de precio dejaría la página sin JavaScript');
});

test('la política cierra lo que no se usa', () => {
	const csp = politica(conCSP(pagina('')));

	assert.match(csp, /default-src 'self'/);
	assert.match(csp, /object-src 'none'/, 'nada de plugins');
	assert.match(csp, /base-uri 'none'/, 'que no puedan reescribir las rutas relativas');
	assert.match(csp, /connect-src 'self'/, 'solo /api/estado, del mismo dominio');
	assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"), 'jamás unsafe-inline en scripts');
});

test('el sitio ya construido no tiene ningún script sin cubrir', async () => {
	const { readFile } = await import('node:fs/promises');
	const { existsSync } = await import('node:fs');

	for (const nombre of ['index', '404', 'panel', 'privacidad', 'terminos']) {
		const ruta = new URL(`../dist/${nombre}.html`, import.meta.url);
		if (!existsSync(ruta)) continue;

		const html = await readFile(ruta, 'utf8');
		const csp = politica(html);
		const enLinea = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];

		for (const m of enLinea) {
			assert.ok(csp.includes(sha(m[1])), `${nombre}.html tiene un script que el navegador bloquearía`);
		}
	}
});
