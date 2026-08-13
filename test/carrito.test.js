/**
 * Carrito: las cuentas y el mensaje que acaba en el teléfono del dueño.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import * as carrito from '../public/assets/js/carrito.js';
import { precio } from '../public/assets/js/formato.js';

// carrito.js toca localStorage dentro de try/catch, así que en Node funciona
// en memoria sin necesidad de simular el navegador.
beforeEach(() => carrito.vaciar());

const BURGER = { id: 'burger-caramelizado', nombre: 'Burger Caramelizado', precio: 10 };
const AGUA = { id: 'agua', nombre: 'Agua', precio: 1 };

test('formato de precios: sin decimales cuando son .00', () => {
	assert.equal(precio(10), '$10');
	assert.equal(precio(11.5), '$11.50');
	assert.equal(precio(2.5), '$2.50');
	assert.equal(precio(0), '$0');
});

test('empieza vacío', () => {
	assert.equal(carrito.estaVacio(), true);
	assert.equal(carrito.total(), 0);
	assert.equal(carrito.cantidadTotal(), 0);
});

test('añadir dos veces el mismo plato sube la cantidad, no duplica la línea', () => {
	carrito.agregar(BURGER);
	carrito.agregar(BURGER);

	assert.equal(carrito.obtener().length, 1);
	assert.equal(carrito.obtener()[0].cantidad, 2);
	assert.equal(carrito.total(), 20);
	assert.equal(carrito.cantidadTotal(), 2);
});

test('dos bowls con distinto detalle son líneas distintas', () => {
	const base = { id: 'bowl-personalizado', nombre: 'Bowl personalizado', precio: 10 };

	carrito.agregar({ ...base, detalle: 'arroz mamposteado · pechuga al grill' });
	carrito.agregar({ ...base, detalle: 'pasta alfredo · churrasco' });

	assert.equal(carrito.obtener().length, 2);
});

test('bajar la cantidad a cero quita la línea', () => {
	carrito.agregar(BURGER);
	carrito.agregar(AGUA);
	carrito.cambiarCantidad(0, 0);

	assert.equal(carrito.obtener().length, 1);
	assert.equal(carrito.obtener()[0].nombre, 'Agua');
});

test('el total suma cantidades y precios con centavos', () => {
	carrito.agregar({ id: 'bowl', nombre: 'Bowl personalizado', precio: 11.5 });
	carrito.agregar({ id: 'tostones', nombre: 'Tostones de panas (4)', precio: 2.5 }, 2);

	assert.equal(carrito.total(), 16.5);
	assert.equal(precio(carrito.total()), '$16.50');
});

test('el mensaje de WhatsApp lleva líneas, total y datos del cliente', () => {
	carrito.agregar(BURGER);
	carrito.agregar(
		{ id: 'bowl-personalizado', nombre: 'Bowl personalizado', precio: 11.5, detalle: 'arroz mamposteado · churrasco' },
		1
	);

	const texto = carrito.mensajeOrden({ nombre: 'Alexis', modo: 'recogido', nota: 'sin cebolla' });

	assert.match(texto, /1× Burger Caramelizado — \$10/);
	assert.match(texto, /1× Bowl personalizado — \$11\.50/);
	assert.match(texto, /arroz mamposteado · churrasco/);
	assert.match(texto, /Total: \$21\.50/);
	assert.match(texto, /Nombre: Alexis/);
	assert.match(texto, /Recogido/);
	assert.match(texto, /Nota: sin cebolla/);
});

test('el precio de la línea se multiplica por la cantidad en el mensaje', () => {
	carrito.agregar(BURGER, 3);
	assert.match(carrito.mensajeOrden(), /3× Burger Caramelizado — \$30/);
});

test('el enlace de WhatsApp va codificado y al número correcto', () => {
	carrito.agregar(BURGER);
	const url = carrito.enlaceWhatsApp('17872048105', { nombre: 'Ana' });

	assert.ok(url.startsWith('https://wa.me/17872048105?text='));
	assert.ok(!url.includes(' '), 'el texto tiene que ir codificado');
	assert.match(decodeURIComponent(url), /Burger Caramelizado/);
});

test('descarta las líneas corruptas de localStorage en vez de enseñar "$NaN"', () => {
	const almacen = {
		'elbreak.carrito.v1': JSON.stringify([
			{ id: 'ok', nombre: 'Burger Caramelizado', precio: 10, cantidad: 2 },
			{ id: 'sin-precio', nombre: 'Sin precio', precio: null, cantidad: 1 },
			{ id: 'precio-texto', nombre: 'Precio en texto', precio: 'diez', cantidad: 1 },
			{ id: 'sin-nombre', nombre: '', precio: 5, cantidad: 1 }
		])
	};

	globalThis.localStorage = {
		getItem: (k) => (k in almacen ? almacen[k] : null),
		setItem: (k, v) => {
			almacen[k] = v;
		},
		removeItem: (k) => {
			delete almacen[k];
		}
	};

	try {
		carrito.cargar();

		assert.equal(carrito.obtener().length, 1, 'solo sobrevive la línea sumable');
		assert.equal(carrito.total(), 20);
		assert.equal(precio(carrito.total()), '$20', 'el total nunca sale como $NaN');
	} finally {
		delete globalThis.localStorage;
	}
});
