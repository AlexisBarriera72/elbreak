/**
 * Panel del dueño.
 *
 * Una clave arriba y varios botones, cada uno con lo suyo: cerrar el día,
 * abrirlo aunque no toque, marcar lo que se acabó y poner el aviso de hoy.
 *
 * La clave no se guarda en ningún sitio: se escribe cada vez. Esto se usa dos
 * o tres veces al mes, y una clave guardada en el teléfono es una clave que se
 * puede leer.
 *
 * Cada botón manda solo su parte. La función la mezcla con lo que ya hubiera
 * hoy, así que marcar un plato agotado no borra el aviso ni el horario.
 */

import { fechaEnZona, horaLegible } from './horario.js';

const ZONA = 'America/Puerto_Rico';
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const formulario = $('[data-panel]');
const campoClave = $('#clave');
const campoAbre = $('#abre');
const campoCierra = $('#cierra');
const campoEspecial = $('#especial');
const aviso = $('[data-aviso]');
const resumen = $('[data-estado-actual]');
const botones = $$('[data-accion]');
const casillas = $$('[data-agotado]');

function decir(texto, tipo) {
	aviso.textContent = texto;
	aviso.dataset.tipo = tipo || 'info';
}

/** Deja la página contando lo que hay puesto ahora mismo. */
function pintar(excepcion) {
	const deHoy = excepcion && excepcion.fecha === fechaEnZona(ZONA);
	const hoy = deHoy ? excepcion : {};

	const partes = [];

	if (hoy.modo === 'cerrado') {
		partes.push('Hoy está marcado como cerrado.');
	} else if (hoy.modo === 'abierto') {
		partes.push(`Hoy abres de ${horaLegible(hoy.abre)} a ${horaLegible(hoy.cierra)}.`);
	} else {
		partes.push('Hoy el truck sigue su horario normal.');
	}

	const agotados = hoy.agotados || [];
	if (agotados.length === 1) partes.push('Hay 1 plato marcado como agotado.');
	else if (agotados.length > 1) partes.push(`Hay ${agotados.length} platos marcados como agotados.`);

	if (hoy.especial) partes.push(`Aviso puesto: «${hoy.especial}»`);

	resumen.textContent = partes.join(' ');

	// Y deja los controles reflejando ese estado, para no marcar dos veces.
	const fuera = new Set(agotados);
	casillas.forEach((c) => {
		c.checked = fuera.has(c.value);
	});
	campoEspecial.value = hoy.especial || '';
	if (hoy.modo === 'abierto') {
		campoAbre.value = hoy.abre;
		campoCierra.value = hoy.cierra;
	}
}

function ocupado(si) {
	botones.forEach((b) => {
		b.disabled = si;
	});
}

async function consultar() {
	try {
		const respuesta = await fetch('/api/estado', { cache: 'no-store' });
		if (!respuesta.ok) throw new Error('respuesta ' + respuesta.status);

		const { excepcion } = await respuesta.json();
		pintar(excepcion);
	} catch (e) {
		resumen.textContent = 'No se pudo leer el estado. Recarga la página.';
	}
}

const CONFIRMACION = {
	cerrado: 'Listo. La página ya avisa de que hoy no sales.',
	abierto: 'Listo. La página ya dice que hoy abres.',
	normal: 'Listo. El truck vuelve a su horario normal.',
	agotados: 'Listo. La carta ya lo marca.',
	especial: 'Listo.'
};

/** Qué manda cada botón. Devuelve null si falta algo por rellenar. */
function cuerpoDe(accion) {
	if (accion === 'abierto') {
		if (!campoAbre.value || !campoCierra.value) {
			decir('Pon la hora de abrir y la de cerrar.', 'error');
			return null;
		}
		return { modo: 'abierto', abre: campoAbre.value, cierra: campoCierra.value };
	}

	if (accion === 'agotados') {
		return { agotados: casillas.filter((c) => c.checked).map((c) => c.value) };
	}

	if (accion === 'especial') {
		return { especial: campoEspecial.value.trim() };
	}

	return { modo: accion };
}

async function enviar(accion) {
	const clave = campoClave.value;

	if (!clave) {
		decir('Escribe la clave primero.', 'error');
		campoClave.focus();
		return;
	}

	const cuerpo = cuerpoDe(accion);
	if (!cuerpo) return;

	ocupado(true);
	decir('Guardando…');

	try {
		const respuesta = await fetch('/api/estado', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ clave, ...cuerpo })
		});

		const datos = await respuesta.json().catch(() => ({}));

		if (!respuesta.ok) {
			decir(datos.error || 'No se pudo guardar.', 'error');
			return;
		}

		pintar(datos.excepcion);
		campoClave.value = '';

		if (accion === 'especial') {
			decir(cuerpo.especial ? 'Listo. El aviso ya sale en la portada.' : 'Listo. Aviso quitado.', 'bien');
		} else if (accion === 'agotados') {
			const n = cuerpo.agotados.length;
			decir(n ? `Listo. ${n} marcado${n > 1 ? 's' : ''} como agotado.` : 'Listo. Todo disponible otra vez.', 'bien');
		} else {
			decir(CONFIRMACION[accion], 'bien');
		}
	} catch (e) {
		decir('Sin conexión. Inténtalo otra vez.', 'error');
	} finally {
		ocupado(false);
	}
}

/**
 * Dice qué falta por poner en Vercel.
 *
 * Leer una excepción que no existe y no poder leer nada se parecen demasiado:
 * los dos acaban en «hoy no hay nada». Esto los separa sin enseñar ningún
 * valor, solo si está puesto o no.
 */
async function comprobar() {
	const clave = campoClave.value;

	if (!clave) {
		decir('Escribe la clave primero.', 'error');
		campoClave.focus();
		return;
	}

	ocupado(true);
	decir('Comprobando…');

	try {
		const respuesta = await fetch('/api/estado', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ clave, modo: 'diagnostico' })
		});

		const datos = await respuesta.json().catch(() => ({}));

		if (!respuesta.ok) {
			decir(datos.error || 'No se pudo comprobar.', 'error');
			return;
		}

		const puesto = datos.diagnostico || {};
		const faltan = ['GLOBAL_CONFIG', 'VERCEL_API_TOKEN'].filter((v) => !puesto[v]);

		if (faltan.length) {
			decir(
				`Falta poner en Vercel: ${faltan.join(' y ')}. ` +
					'Settings → Environment Variables, y después vuelve a desplegar.',
				'error'
			);
		} else {
			decir('La clave vale y está todo puesto. Los botones deberían funcionar.', 'bien');
		}
	} catch (e) {
		decir('Sin conexión. Inténtalo otra vez.', 'error');
	} finally {
		ocupado(false);
	}
}

formulario.addEventListener('submit', (e) => e.preventDefault());
botones.forEach((boton) => {
	boton.addEventListener('click', () => {
		if (boton.dataset.accion === 'diagnostico') comprobar();
		else enviar(boton.dataset.accion);
	});
});

consultar();
