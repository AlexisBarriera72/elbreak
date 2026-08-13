/**
 * Horario de servicio.
 *
 * Este módulo lo cargan dos sitios: el navegador (para el estado en vivo) y el
 * script de build (para el pie de página y el marcado de Google). Una sola
 * copia de la lógica, así no puede haber dos versiones que se contradigan.
 *
 * Todo se calcula en la zona horaria del truck, no en la del visitante:
 * alguien mirando desde Florida necesita saber si está abierto en Yauco.
 */

export const DIAS = {
	1: 'lunes',
	2: 'martes',
	3: 'miércoles',
	4: 'jueves',
	5: 'viernes',
	6: 'sábado',
	7: 'domingo'
};

const DIAS_SCHEMA = {
	1: 'Monday',
	2: 'Tuesday',
	3: 'Wednesday',
	4: 'Thursday',
	5: 'Friday',
	6: 'Saturday',
	7: 'Sunday'
};

/** "14:00" -> 840 */
export function aMinutos(hhmm) {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
}

/** "14:00" -> "2:00 pm" */
export function horaLegible(hhmm) {
	const [h, m] = hhmm.split(':');
	const hora = Number(h);
	const sufijo = hora >= 12 ? 'pm' : 'am';
	return `${hora % 12 || 12}:${m} ${sufijo}`;
}

/**
 * Día de la semana (1-7) y minutos transcurridos, en la zona indicada.
 * @param {string} zona  Ej. "America/Puerto_Rico".
 * @param {Date} [ahora] Momento a evaluar; por defecto, ahora mismo.
 */
export function momentoEnZona(zona, ahora = new Date()) {
	const partes = new Intl.DateTimeFormat('en-US', {
		timeZone: zona,
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).formatToParts(ahora);

	const leer = (tipo) => (partes.find((p) => p.type === tipo) || {}).value || '';
	const semana = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

	// Algunos motores devuelven "24" a la medianoche.
	const hora = Number(leer('hour')) % 24;

	return {
		dia: semana[leer('weekday')] || 1,
		minutos: hora * 60 + Number(leer('minute'))
	};
}

/**
 * Fecha civil en la zona indicada, como "2026-08-13".
 *
 * Hace falta para dos cosas que no pueden usar la fecha del visitante: saber
 * qué versículo toca hoy y saber si el cierre que guardó el dueño es de hoy.
 */
export function fechaEnZona(zona, ahora = new Date()) {
	const partes = new Intl.DateTimeFormat('en-CA', {
		timeZone: zona,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(ahora);

	const leer = (tipo) => (partes.find((p) => p.type === tipo) || {}).value || '';

	return `${leer('year')}-${leer('month')}-${leer('day')}`;
}

/**
 * Días transcurridos desde 1970-01-01, contados en la zona indicada.
 * Es el número que hace girar el versículo: cambia una vez al día, a
 * medianoche en Yauco, y es el mismo para todo el que abra la página.
 */
export function diaOrdinal(zona, ahora = new Date()) {
	const [a, m, d] = fechaEnZona(zona, ahora).split('-').map(Number);
	return Math.round(Date.UTC(a, m - 1, d) / 86400000);
}

/**
 * Estado del servicio.
 *
 * `opciones.cerradoHoy` es el interruptor del panel: cuando el dueño marca que
 * hoy no sale, se ignora la ventana de hoy y se busca directamente el próximo
 * día de servicio. Toda la cuenta de «cuándo volvemos» es la misma de siempre,
 * así no hay dos versiones que puedan contradecirse.
 *
 * @returns {{estado: 'abierto'|'cierra-pronto'|'cerrado', etiqueta: string, detalle: string}}
 */
export function estadoServicio(horario, zona, ahora = new Date(), opciones = {}) {
	const { dia, minutos } = momentoEnZona(zona, ahora);
	const cerradoHoy = Boolean(opciones.cerradoHoy);
	const hoy = cerradoHoy ? null : horario[dia] || horario[String(dia)];

	if (hoy) {
		const abre = aMinutos(hoy.abre);
		const cierra = aMinutos(hoy.cierra);

		if (minutos >= abre && minutos < cierra) {
			const faltan = cierra - minutos;

			if (faltan <= 30) {
				return {
					estado: 'cierra-pronto',
					etiqueta: 'Cierra pronto',
					detalle:
						faltan === 1
							? 'Queda 1 minuto de servicio. Llama ya.'
							: `Quedan ${faltan} minutos de servicio. Llama ya.`
				};
			}

			return {
				estado: 'abierto',
				etiqueta: 'Abierto ahora',
				detalle: `Estamos sirviendo hasta las ${horaLegible(hoy.cierra)}.`
			};
		}

		if (minutos < abre) {
			return {
				estado: 'cerrado',
				etiqueta: 'Cerrado',
				detalle: `Hoy abrimos a las ${horaLegible(hoy.abre)}.`
			};
		}
	}

	for (let salto = 1; salto <= 7; salto++) {
		const siguiente = ((dia - 1 + salto) % 7) + 1;
		const ventana = horario[siguiente] || horario[String(siguiente)];

		if (!ventana) continue;

		const nombre = DIAS[siguiente];
		const cuando = salto === 1 ? 'Mañana' : nombre.charAt(0).toUpperCase() + nombre.slice(1);
		const vuelta = `${cuando} abrimos a las ${horaLegible(ventana.abre)}.`;

		return {
			estado: 'cerrado',
			etiqueta: cerradoHoy ? 'Cerrado hoy' : 'Cerrado',
			detalle: cerradoHoy ? `Hoy no salimos. ${vuelta}` : vuelta
		};
	}

	return {
		estado: 'cerrado',
		etiqueta: cerradoHoy ? 'Cerrado hoy' : 'Cerrado',
		detalle: 'Escríbenos por Instagram para saber cuándo abrimos.'
	};
}

/**
 * "Miércoles a viernes · 11:00 am – 2:00 pm".
 * Agrupa los días seguidos que comparten la misma ventana.
 */
export function resumenHorario(horario) {
	const dias = Object.keys(horario).map(Number).sort((a, b) => a - b);
	if (!dias.length) return '';

	const primero = dias[0];
	const ultimo = dias[dias.length - 1];
	const ventana = horario[primero] || horario[String(primero)];
	const seguidos = dias.length === ultimo - primero + 1;

	const capital = (n) => DIAS[n].charAt(0).toUpperCase() + DIAS[n].slice(1);

	const etiqueta =
		seguidos && primero !== ultimo
			? `${capital(primero)} a ${DIAS[ultimo]}`
			: dias.map(capital).join(', ');

	return `${etiqueta} · ${horaLegible(ventana.abre)} – ${horaLegible(ventana.cierra)}`;
}

/** Formato openingHours de schema.org, para que Google muestre "Abierto ahora". */
export function horarioSchema(horario) {
	return Object.keys(horario)
		.map(Number)
		.sort((a, b) => a - b)
		.map((d) => {
			const v = horario[d] || horario[String(d)];
			return `${DIAS_SCHEMA[d]} ${v.abre}-${v.cierra}`;
		});
}
