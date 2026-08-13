/**
 * Carrito.
 *
 * Vive en localStorage, así que la orden sobrevive si se recarga la página o
 * se cierra el navegador sin querer. No hay servidor ni cuentas: la orden se
 * envía por WhatsApp desde el teléfono del cliente.
 *
 * Sin acceso a `window` fuera de las funciones, para que el script de build
 * pueda importar este archivo en Node sin romperse.
 */

import { precio } from './formato.js';

const LLAVE = 'elbreak.carrito.v1';

let lineas = [];
const oyentes = new Set();

/* --- Persistencia ------------------------------------------------------- */

function guardar() {
	try {
		localStorage.setItem(LLAVE, JSON.stringify(lineas));
	} catch (e) {
		// Modo privado o almacenamiento lleno: el carrito sigue funcionando en
		// memoria durante la visita, que es lo que importa.
	}
}

/** Una línea guardada solo vale si puede sumarse: si no, el total sale "$NaN". */
function lineaValida(l) {
	return (
		l &&
		typeof l.nombre === 'string' &&
		l.nombre !== '' &&
		Number.isFinite(l.precio) &&
		Number.isFinite(l.cantidad) &&
		l.cantidad > 0
	);
}

export function cargar() {
	try {
		const crudo = localStorage.getItem(LLAVE);
		const datos = crudo ? JSON.parse(crudo) : [];
		lineas = Array.isArray(datos) ? datos.filter(lineaValida) : [];
	} catch (e) {
		lineas = [];
	}
	avisar();
}

/* --- Lectura ------------------------------------------------------------ */

export function obtener() {
	return lineas.map((l) => ({ ...l }));
}

export function cantidadTotal() {
	return lineas.reduce((n, l) => n + l.cantidad, 0);
}

export function total() {
	return lineas.reduce((n, l) => n + l.precio * l.cantidad, 0);
}

export function estaVacio() {
	return lineas.length === 0;
}

/* --- Escritura ---------------------------------------------------------- */

/**
 * Añade una línea. Si ya existe una idéntica, sube la cantidad.
 * @param {{id: string, nombre: string, precio: number, detalle?: string}} plato
 * @param {number} [cantidad]
 */
export function agregar(plato, cantidad = 1) {
	const clave = plato.id + '|' + (plato.detalle || '');
	const existente = lineas.find((l) => l.id + '|' + (l.detalle || '') === clave);

	if (existente) {
		existente.cantidad += cantidad;
	} else {
		lineas.push({
			id: plato.id,
			nombre: plato.nombre,
			precio: plato.precio,
			detalle: plato.detalle || '',
			cantidad
		});
	}

	guardar();
	avisar();
}

export function cambiarCantidad(indice, cantidad) {
	const linea = lineas[indice];
	if (!linea) return;

	if (cantidad <= 0) {
		lineas.splice(indice, 1);
	} else {
		linea.cantidad = cantidad;
	}

	guardar();
	avisar();
}

export function vaciar() {
	lineas = [];
	guardar();
	avisar();
}

/* --- Avisos a la interfaz ----------------------------------------------- */

export function alCambiar(fn) {
	oyentes.add(fn);
	return () => oyentes.delete(fn);
}

function avisar() {
	oyentes.forEach((fn) => fn(obtener()));
}

/* --- Mensaje de WhatsApp ------------------------------------------------
   Esto es lo que el dueño va a leer en su teléfono, así que se escribe para
   que se entienda de un vistazo y se pueda cocinar directo desde ahí.       */

/**
 * @param {{nombre?: string, modo?: string, nota?: string}} datos
 * @returns {string}
 */
export function mensajeOrden(datos = {}) {
	const partes = ['Hola El Break, quiero ordenar:', ''];

	lineas.forEach((l) => {
		partes.push(`• ${l.cantidad}× ${l.nombre} — ${precio(l.precio * l.cantidad)}`);
		if (l.detalle) partes.push(`   ${l.detalle}`);
	});

	partes.push('');
	partes.push(`Total: ${precio(total())}`);

	if (datos.nombre) partes.push(`Nombre: ${datos.nombre}`);
	if (datos.modo) partes.push(datos.modo === 'delivery' ? 'Delivery' : 'Recogido');
	if (datos.nota) partes.push(`Nota: ${datos.nota}`);

	return partes.join('\n');
}

/** Enlace wa.me con la orden ya escrita. */
export function enlaceWhatsApp(numero, datos = {}) {
	return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeOrden(datos))}`;
}
