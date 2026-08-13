/**
 * Versículo del día.
 *
 * Igual que horario.js, este módulo lo cargan el navegador y el script de
 * build, para que la tarjeta impresa y la página no puedan decir cosas
 * distintas.
 *
 * La elección es una cuenta, no un sorteo: el número de días transcurridos
 * desde 1970, en la hora de Yauco, módulo cuántos versículos hay. De ahí
 * salen tres cosas que interesan:
 *
 *   - Todo el que abra la página el mismo día ve el mismo versículo.
 *   - No cambia al recargar ni al volver más tarde: cambia a medianoche.
 *   - No hay nada que guardar. Ni cookie, ni servidor, ni contador.
 *
 * Con 123 versículos el ciclo dura unos cuatro meses. Añadir más al JSON
 * alarga el ciclo solo; no hay que tocar este archivo.
 */

import { diaOrdinal } from './horario.js';

/**
 * @param {Array<{texto: string, cita: string}>} lista
 * @param {string} zona   Ej. "America/Puerto_Rico".
 * @param {Date} [ahora]  Momento a evaluar; por defecto, ahora mismo.
 * @returns {{texto: string, cita: string}|null}
 */
export function versiculoDelDia(lista, zona, ahora = new Date()) {
	if (!Array.isArray(lista) || lista.length === 0) return null;

	const total = lista.length;
	// El doble módulo mantiene el índice positivo para fechas anteriores a 1970.
	const indice = ((diaOrdinal(zona, ahora) % total) + total) % total;

	return lista[indice];
}
