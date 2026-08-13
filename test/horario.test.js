/**
 * Horario de servicio: los bordes son lo que importa (abrir, avisar, cerrar).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
	estadoServicio,
	resumenHorario,
	horarioSchema,
	horaLegible
} from '../public/assets/js/horario.js';

const sitio = JSON.parse(await readFile(new URL('../src/data/site.json', import.meta.url), 'utf8'));
const { horario, zonaHoraria } = sitio;

/** Un instante concreto en la hora de Puerto Rico (UTC-4, sin horario de verano). */
const enPR = (fecha, hora) => new Date(`${fecha}T${hora}:00-04:00`);

test('estado a lo largo de la semana', () => {
	// 2026-08-10 es lunes.
	const casos = [
		['2026-08-10', '12:00', 'cerrado', 'lunes'],
		['2026-08-11', '09:00', 'cerrado', 'martes, abre mañana'],
		['2026-08-12', '10:59', 'cerrado', 'miércoles justo antes de abrir'],
		['2026-08-12', '11:00', 'abierto', 'miércoles al abrir'],
		['2026-08-12', '12:30', 'abierto', 'media jornada'],
		['2026-08-12', '13:29', 'abierto', '31 min para cerrar'],
		['2026-08-12', '13:30', 'cierra-pronto', '30 min para cerrar'],
		['2026-08-12', '13:59', 'cierra-pronto', '1 min para cerrar'],
		['2026-08-12', '14:00', 'cerrado', 'justo al cerrar'],
		['2026-08-14', '15:00', 'cerrado', 'viernes tarde'],
		['2026-08-15', '12:00', 'cerrado', 'sábado'],
		['2026-08-16', '12:00', 'cerrado', 'domingo']
	];

	for (const [fecha, hora, esperado, nota] of casos) {
		const r = estadoServicio(horario, zonaHoraria, enPR(fecha, hora));
		assert.equal(r.estado, esperado, `${fecha} ${hora} (${nota}) -> ${r.estado}`);
	}
});

test('el singular de "1 minuto" está bien escrito', () => {
	const r = estadoServicio(horario, zonaHoraria, enPR('2026-08-12', '13:59'));
	assert.equal(r.detalle, 'Queda 1 minuto de servicio. Llama ya.');
});

test('en plural dice cuántos minutos quedan', () => {
	const r = estadoServicio(horario, zonaHoraria, enPR('2026-08-12', '13:45'));
	assert.equal(r.detalle, 'Quedan 15 minutos de servicio. Llama ya.');
});

test('el martes anuncia que abre mañana', () => {
	const r = estadoServicio(horario, zonaHoraria, enPR('2026-08-11', '09:00'));
	assert.equal(r.detalle, 'Mañana abrimos a las 11:00 am.');
});

test('el sábado apunta al próximo miércoles', () => {
	const r = estadoServicio(horario, zonaHoraria, enPR('2026-08-15', '12:00'));
	assert.equal(r.detalle, 'Miércoles abrimos a las 11:00 am.');
});

test('el estado se calcula en la hora del truck, no en la del visitante', () => {
	// Mismo instante: miércoles 11:30 en Puerto Rico = 15:30 UTC.
	// Para alguien en Madrid son las 17:30, pero el truck está abierto.
	const instante = new Date('2026-08-12T15:30:00Z');
	assert.equal(estadoServicio(horario, zonaHoraria, instante).estado, 'abierto');
});

test('resumen agrupa los días seguidos', () => {
	assert.equal(resumenHorario(horario), 'Miércoles a viernes · 11:00 am – 2:00 pm');
});

test('formato de hora legible', () => {
	assert.equal(horaLegible('11:00'), '11:00 am');
	assert.equal(horaLegible('14:00'), '2:00 pm');
	assert.equal(horaLegible('00:30'), '12:30 am');
	assert.equal(horaLegible('12:15'), '12:15 pm');
});

test('schema.org sale en el formato que espera Google', () => {
	assert.deepEqual(horarioSchema(horario), [
		'Wednesday 11:00-14:00',
		'Thursday 11:00-14:00',
		'Friday 11:00-14:00'
	]);
});

/* --- El interruptor de /panel ------------------------------------------- */

// Miércoles 12:00 en Yauco: día de servicio, en plena hora de servicio.
const MIERCOLES_MEDIODIA = new Date(Date.UTC(2026, 7, 12, 16, 0));

test('sin cierre, un miércoles al mediodía está abierto', () => {
	const estado = estadoServicio(horario, zonaHoraria, MIERCOLES_MEDIODIA);

	assert.equal(estado.estado, 'abierto');
	assert.equal(estado.etiqueta, 'Abierto ahora');
});

test('con el cierre puesto, ese mismo momento aparece cerrado', () => {
	const estado = estadoServicio(horario, zonaHoraria, MIERCOLES_MEDIODIA, { cerradoHoy: true });

	assert.equal(estado.estado, 'cerrado');
	assert.equal(estado.etiqueta, 'Cerrado hoy');
});

test('el cierre dice cuándo se vuelve, sin repetir la cuenta del horario', () => {
	const estado = estadoServicio(horario, zonaHoraria, MIERCOLES_MEDIODIA, { cerradoHoy: true });

	// Jueves también es día de servicio, así que la vuelta es mañana.
	assert.equal(estado.detalle, 'Hoy no salimos. Mañana abrimos a las 11:00 am.');
});

test('cerrar un viernes salta el fin de semana igual que siempre', () => {
	const viernes = new Date(Date.UTC(2026, 7, 14, 16, 0));
	const estado = estadoServicio(horario, zonaHoraria, viernes, { cerradoHoy: true });

	assert.equal(estado.detalle, 'Hoy no salimos. Miércoles abrimos a las 11:00 am.');
});

test('el cierre no se contagia al día siguiente', () => {
	// El mismo horario, un día después y sin el interruptor: todo normal.
	const jueves = new Date(Date.UTC(2026, 7, 13, 16, 0));

	assert.equal(estadoServicio(horario, zonaHoraria, jueves).etiqueta, 'Abierto ahora');
});
