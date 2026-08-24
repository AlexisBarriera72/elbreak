/**
 * Genera el sitio en dist/.
 *
 * Sin dependencias: solo Node. Lee los datos, escribe el HTML y copia
 * public/ tal cual. No hay framework que actualizar ni node_modules que subir.
 *
 *   node src/build.js
 */

import { mkdir, readFile, writeFile, cp, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { paginaInicio } from './templates/pagina.js';
import { paginaPanel } from './templates/panel.js';
import { paginaPrivacidad, paginaTerminos } from './templates/legal.js';
import { conCSP } from './csp.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const salida = join(raiz, 'dist');

const leerJSON = async (ruta) => JSON.parse(await readFile(ruta, 'utf8'));

/** Tamaño total de una carpeta, en bytes. */
async function pesar(carpeta) {
	let total = 0;
	for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
		const ruta = join(carpeta, entrada.name);
		total += entrada.isDirectory() ? await pesar(ruta) : (await stat(ruta)).size;
	}
	return total;
}

/** Lista los archivos de una carpeta con su tamaño, ordenados de mayor a menor. */
async function inventario(carpeta, base = carpeta) {
	const filas = [];
	for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
		const ruta = join(carpeta, entrada.name);
		if (entrada.isDirectory()) {
			filas.push(...(await inventario(ruta, base)));
		} else {
			filas.push({
				ruta: relative(base, ruta).replace(/\\/g, '/'),
				kb: (await stat(ruta)).size / 1024
			});
		}
	}
	return filas.sort((a, b) => b.kb - a.kb);
}

async function construir() {
	const inicio = Date.now();

	const sitio = await leerJSON(join(raiz, 'src/data/site.json'));
	const menu = await leerJSON(join(raiz, 'src/data/menu.json'));
	const versiculos = (await leerJSON(join(raiz, 'src/data/versiculos.json'))).lista;

	// Empezamos de cero para que no queden restos de una compilación anterior.
	if (existsSync(salida)) await rm(salida, { recursive: true });
	await mkdir(salida, { recursive: true });

	await cp(join(raiz, 'public'), salida, { recursive: true });

	const html = paginaInicio({ sitio, menu, versiculos });
	await writeFile(join(salida, 'index.html'), conCSP(html), 'utf8');

	// 404 con la misma cabecera y un camino de vuelta.
	await writeFile(join(salida, '404.html'), conCSP(pagina404(sitio)), 'utf8');

	// Panel del dueño. Ni se enlaza ni se indexa.
	await writeFile(join(salida, 'panel.html'), conCSP(paginaPanel(sitio, menu)), 'utf8');

	// Privacidad y términos. La fecha sale de site.json, no del día en que se
	// compila: cambiar una coma del código no es cambiar la política.
	const actualizado = fechaLarga(sitio.legalActualizado);
	await writeFile(join(salida, 'privacidad.html'), conCSP(paginaPrivacidad(sitio, actualizado)), 'utf8');
	await writeFile(join(salida, 'terminos.html'), conCSP(paginaTerminos(sitio, actualizado)), 'utf8');

	// Para buscadores y para poder instalar el sitio en el teléfono.
	await writeFile(join(salida, 'robots.txt'), robots(sitio), 'utf8');
	await writeFile(join(salida, 'sitemap.xml'), sitemap(sitio), 'utf8');
	await writeFile(join(salida, 'site.webmanifest'), manifiesto(sitio), 'utf8');

	const bytes = await pesar(salida);
	const archivos = await inventario(salida);

	console.log(`\n  El Break — sitio generado en ${Date.now() - inicio} ms\n`);
	for (const a of archivos) {
		console.log(`  ${a.kb.toFixed(1).padStart(7)} KB  ${a.ruta}`);
	}
	console.log(`  ${'—'.repeat(46)}`);
	console.log(`  ${(bytes / 1024).toFixed(1).padStart(7)} KB  total en dist/\n`);
}


/** "2026-08-13" -> "13 de agosto de 2026" */
function fechaLarga(iso) {
	const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
		'septiembre','octubre','noviembre','diciembre'];
	const [a, m, d] = String(iso).split('-').map(Number);
	return `${d} de ${meses[m - 1]} de ${a}`;
}

/** Las páginas públicas. El panel se queda fuera del índice. */
function robots(sitio) {
	return `User-agent: *
Allow: /
Disallow: /panel

Sitemap: ${sitio.url}/sitemap.xml
`;
}

function sitemap(sitio) {
	const hoy = new Date().toISOString().slice(0, 10);
	const paginas = [
		{ ruta: '/', cada: 'weekly', peso: '1.0', cuando: hoy },
		{ ruta: '/privacidad', cada: 'yearly', peso: '0.3', cuando: sitio.legalActualizado },
		{ ruta: '/terminos', cada: 'yearly', peso: '0.3', cuando: sitio.legalActualizado }
	];

	const urls = paginas
		.map((p) =>
			[
				'	<url>',
				`		<loc>${sitio.url}${p.ruta}</loc>`,
				`		<lastmod>${p.cuando}</lastmod>`,
				`		<changefreq>${p.cada}</changefreq>`,
				`		<priority>${p.peso}</priority>`,
				'	</url>'
			].join('\n')
		)
		.join('\n');

	return [
		'<?xml version=\"1.0\" encoding=\"UTF-8\"?>',
		'<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">',
		urls,
		'</urlset>',
		''
	].join('\n');
}

/** Deja añadir el sitio a la pantalla de inicio como si fuera una app. */
function manifiesto(sitio) {
	return JSON.stringify(
		{
			name: sitio.nombre,
			short_name: 'El Break',
			description: sitio.descripcion,
			lang: 'es',
			start_url: '/',
			scope: '/',
			display: 'standalone',
			orientation: 'portrait',
			background_color: '#fdf4e3',
			theme_color: '#0d6376',
			icons: [
				{ src: '/assets/img/favicon.png', sizes: '64x64', type: 'image/png' },
				{ src: '/assets/img/logo.png', sizes: '160x160', type: 'image/png' }
			]
		},
		null,
		'	'
	);
}

function pagina404(sitio) {
	const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Esa página no existe · ${esc(sitio.nombre)}</title>
<meta name="description" content="La página que buscas no existe. La carta, los bowls y el horario están en la portada.">
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
<main class="seccion seccion--crema pagina">
	<div class="envoltura">
		<img src="/assets/img/logo.png" alt="" width="96" height="96" style="margin-bottom:1.5rem">
		<h1 class="pagina__titulo">Esa página no existe</h1>
		<p class="contenido">Puede que el enlace esté viejo. La carta completa, los bowls y el horario están en la portada.</p>
		<p class="hero__acciones">
			<a class="boton boton--sol" href="/">Ver la carta</a>
			<a class="boton boton--linea" href="tel:${esc(sitio.telefonoE164)}">Llamar ${esc(sitio.telefono)}</a>
		</p>
	</div>
</main>
</body>
</html>
`;
}

construir().catch((error) => {
	console.error('\n  Falló la compilación:', error.message, '\n');
	process.exit(1);
});
