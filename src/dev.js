/**
 * Servidor local para desarrollo.
 *
 * Compila y sirve dist/. El sitio es estático: las órdenes salen por WhatsApp
 * desde el teléfono del cliente, así que no hay nada de servidor que emular.
 *
 *   node src/dev.js          -> http://localhost:4321
 *   node src/dev.js --port 8080
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const salida = join(raiz, 'dist');

const argPuerto = process.argv.indexOf('--port');
const PUERTO = argPuerto > -1 ? Number(process.argv[argPuerto + 1]) : 4321;

const TIPOS = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.webmanifest': 'application/manifest+json'
};

// Compilamos antes de levantar, para no servir una versión vieja.
const compilacion = spawnSync(process.execPath, [join(aqui, 'build.js')], { stdio: 'inherit' });
if (compilacion.status !== 0) process.exit(compilacion.status ?? 1);

const servidor = createServer(async (req, res) => {
	const url = new URL(req.url, `http://localhost:${PUERTO}`);

	// Evita que ../../ se escape de dist/.
	const pedido = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
	let ruta = join(salida, pedido);

	try {
		if ((await stat(ruta)).isDirectory()) ruta = join(ruta, 'index.html');
	} catch (e) {
		ruta = join(salida, '404.html');
		res.statusCode = 404;
	}

	try {
		const cuerpo = await readFile(ruta);
		res.setHeader('content-type', TIPOS[extname(ruta)] || 'application/octet-stream');
		res.setHeader('cache-control', 'no-store');
		res.end(cuerpo);
	} catch (e) {
		res.statusCode = 404;
		res.end('No encontrado');
	}
});

servidor.listen(PUERTO, () => {
	console.log(`  Sirviendo en  http://localhost:${PUERTO}\n`);
});
