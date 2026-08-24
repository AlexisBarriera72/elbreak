/**
 * Content-Security-Policy del sitio.
 *
 * Módulo aparte de build.js porque build.js se compila al importarlo, y las
 * pruebas necesitan esto sin que se regenere dist/ de paso.
 */

import { createHash } from 'node:crypto';

/**
 * Añade la Content-Security-Policy a una página ya generada.
 *
 * Es defensa en profundidad: los textos ya se escapan al generarlos, y esto
 * es el segundo cerrojo por si alguna vez se escapa algo. El navegador solo
 * ejecuta scripts de este dominio o cuyo contenido case exactamente con uno
 * de los hashes de abajo, así que un script inyectado no corre aunque llegue
 * al HTML.
 *
 * Los hashes se calculan aquí, sobre el HTML final, porque el bloque de datos
 * cambia en cada compilación. Escritos a mano se quedarían viejos al primer
 * cambio de precio, y la página entera dejaría de funcionar.
 */
export function conCSP(html) {
	// Todo <script> sin src: el de datos y el de schema.org.
	const enLinea = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
	const hashes = enLinea
		.map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`)
		.join(' ');

	const politica = [
		"default-src 'self'",
		`script-src 'self' ${hashes}`.trim(),
		// Los estilos en línea son del panel y de un par de atributos nuestros.
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self'",
		// Solo /api/estado, que es del mismo dominio.
		"connect-src 'self'",
		"base-uri 'none'",
		"form-action 'self'",
		"object-src 'none'"
	].join('; ');

	return html.replace(
		'<meta charset="utf-8">',
		`<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${politica}">`
	);
}
