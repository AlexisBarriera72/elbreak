/**
 * Panel del dueño.
 *
 * Una clave y tres botones: cerrar hoy, abrir hoy aunque no toque, y deshacer.
 * La clave no se guarda en ningún sitio: se escribe cada vez, porque esto se
 * usa dos o tres veces al mes y una clave guardada en el teléfono es una clave
 * que se puede leer.
 *
 * Quien decide si la clave vale es la función, no esta página: aquí solo se
 * manda y se enseña la respuesta.
 */

import { fechaEnZona, horaLegible } from './horario.js';

const ZONA = 'America/Puerto_Rico';
const $ = (sel) => document.querySelector(sel);

const formulario = $('[data-panel]');
const campoClave = $('#clave');
const campoAbre = $('#abre');
const campoCierra = $('#cierra');
const aviso = $('[data-aviso]');
const resumen = $('[data-estado-actual]');
const botones = Array.from(document.querySelectorAll('[data-accion]'));

function decir(texto, tipo) {
	aviso.textContent = texto;
	aviso.dataset.tipo = tipo || 'info';
}

function pintar(excepcion) {
	const deHoy = excepcion && excepcion.fecha === fechaEnZona(ZONA);

	if (deHoy && excepcion.modo === 'cerrado') {
		resumen.textContent =
			'Hoy está marcado como cerrado. Mañana vuelve solo al horario normal.';
	} else if (deHoy && excepcion.modo === 'abierto') {
		resumen.textContent =
			`Hoy está marcado como abierto de ${horaLegible(excepcion.abre)} a ` +
			`${horaLegible(excepcion.cierra)}. Mañana vuelve solo al horario normal.`;
	} else {
		resumen.textContent = 'Hoy el truck sigue su horario normal.';
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
	normal: 'Listo. El truck vuelve a su horario normal.'
};

async function enviar(modo) {
	const clave = campoClave.value;

	if (!clave) {
		decir('Escribe la clave primero.', 'error');
		campoClave.focus();
		return;
	}

	const cuerpo = { clave, modo };

	if (modo === 'abierto') {
		if (!campoAbre.value || !campoCierra.value) {
			decir('Pon la hora de abrir y la de cerrar.', 'error');
			return;
		}
		cuerpo.abre = campoAbre.value;
		cuerpo.cierra = campoCierra.value;
	}

	ocupado(true);
	decir('Guardando…');

	try {
		const respuesta = await fetch('/api/estado', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(cuerpo)
		});

		const datos = await respuesta.json().catch(() => ({}));

		if (!respuesta.ok) {
			decir(datos.error || 'No se pudo guardar.', 'error');
			return;
		}

		pintar(datos.excepcion);
		campoClave.value = '';
		decir(CONFIRMACION[modo], 'bien');
	} catch (e) {
		decir('Sin conexión. Inténtalo otra vez.', 'error');
	} finally {
		ocupado(false);
	}
}

formulario.addEventListener('submit', (e) => e.preventDefault());
botones.forEach((boton) => {
	boton.addEventListener('click', () => enviar(boton.dataset.accion));
});

consultar();
