import test from 'node:test';
import assert from 'node:assert/strict';

import { versiculoDelDia } from '../public/assets/js/versiculo.js';
import { diaOrdinal, fechaEnZona } from '../public/assets/js/horario.js';

const ZONA = 'America/Puerto_Rico';
const LISTA = Array.from({ length: 5 }, (_, i) => ({ texto: `Texto ${i}`, cita: `Cita ${i}` }));

/** Mediodía en Puerto Rico (AST = UTC-4) del día indicado. */
const mediodia = (a, m, d) => new Date(Date.UTC(a, m - 1, d, 16, 0));

test('el mismo día devuelve siempre el mismo versículo', () => {
	const manana = new Date(Date.UTC(2026, 7, 13, 13, 0)); // 9:00 am en Yauco
	const noche = new Date(Date.UTC(2026, 7, 13, 23, 30)); // 7:30 pm en Yauco

	assert.deepEqual(versiculoDelDia(LISTA, ZONA, manana), versiculoDelDia(LISTA, ZONA, noche));
});

test('cambia al día siguiente', () => {
	const hoy = versiculoDelDia(LISTA, ZONA, mediodia(2026, 8, 13));
	const manana = versiculoDelDia(LISTA, ZONA, mediodia(2026, 8, 14));

	assert.notDeepEqual(hoy, manana);
});

test('recorre la lista entera antes de repetir, y entonces vuelve a empezar', () => {
	const vistos = [];
	for (let i = 0; i < LISTA.length; i++) {
		vistos.push(versiculoDelDia(LISTA, ZONA, mediodia(2026, 8, 13 + i)).texto);
	}

	assert.equal(new Set(vistos).size, LISTA.length, 'no repite dentro del ciclo');
	assert.equal(
		versiculoDelDia(LISTA, ZONA, mediodia(2026, 8, 13 + LISTA.length)).texto,
		vistos[0],
		'al cerrar el ciclo vuelve al primero'
	);
});

test('el día se cuenta en Yauco, no en la zona del visitante', () => {
	// 01:00 UTC del día 14 es todavía el día 13 en Puerto Rico (21:00 AST).
	const justoDespuesDeMedianocheUTC = new Date(Date.UTC(2026, 7, 14, 1, 0));

	assert.equal(fechaEnZona(ZONA, justoDespuesDeMedianocheUTC), '2026-08-13');
	assert.deepEqual(
		versiculoDelDia(LISTA, ZONA, justoDespuesDeMedianocheUTC),
		versiculoDelDia(LISTA, ZONA, mediodia(2026, 8, 13))
	);
});

test('el ordinal avanza exactamente uno por día', () => {
	const a = diaOrdinal(ZONA, mediodia(2026, 8, 13));
	const b = diaOrdinal(ZONA, mediodia(2026, 8, 14));

	assert.equal(b - a, 1);
});

test('una lista vacía no rompe la página', () => {
	assert.equal(versiculoDelDia([], ZONA), null);
	assert.equal(versiculoDelDia(undefined, ZONA), null);
});

test('los 123 versículos reales son únicos y están completos', async () => {
	const { lista } = (await import('../src/data/versiculos.json', { with: { type: 'json' } })).default;

	assert.ok(lista.length >= 120, 'hay al menos 120');
	assert.equal(new Set(lista.map((v) => v.texto)).size, lista.length, 'sin textos repetidos');
	assert.ok(
		lista.every((v) => v.texto && v.cita),
		'todos llevan texto y cita'
	);
});
