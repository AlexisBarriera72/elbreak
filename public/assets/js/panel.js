/**
 * Panel del dueño.
 *
 * Una clave y dos botones. La clave no se guarda en ningún sitio: se escribe
 * cada vez, porque esto se usa dos o tres veces al mes y una clave guardada en
 * el teléfono es una clave que se puede leer.
 *
 * Quien decide si la clave vale es la función, no esta página: aquí solo se
 * manda y se enseña la respuesta.
 */

import { fechaEnZona } from './horario.js';

const ZONA = 'America/Puerto_Rico';
const $ = (sel) => document.querySelector(sel);

const formulario = $('[data-panel]');
const campoClave = $('#clave');
const aviso = $('[data-aviso]');
const resumen = $('[data-estado-actual]');
const botones = Array.from(document.querySelectorAll('[data-accion]'));

function decir(texto, tipo) {
	aviso.textContent = texto;
	aviso.dataset.tipo = tipo || 'info';
}

function pintar(cerrado) {
	const cerradoHoy = typeof cerrado === 'string' && cerrado === fechaEnZona(ZONA);

	resumen.textContent = cerradoHoy
		? 'Hoy está marcado como CERRADO. Mañana vuelve solo al horario normal.'
		: 'Hoy el truck sigue su horario normal.';

	resumen.dataset.cerrado = cerradoHoy ? 'si' : 'no';
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

		const { cerrado } = await respuesta.json();
		pintar(cerrado);
	} catch (e) {
		resumen.textContent = 'No se pudo leer el estado. Recarga la página.';
	}
}

async function enviar(cerrado) {
	const clave = campoClave.value;

	if (!clave) {
		decir('Escribe la clave primero.', 'error');
		campoClave.focus();
		return;
	}

	ocupado(true);
	decir('Guardando…');

	try {
		const respuesta = await fetch('/api/estado', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ clave, cerrado })
		});

		const datos = await respuesta.json().catch(() => ({}));

		if (!respuesta.ok) {
			decir(datos.error || 'No se pudo guardar.', 'error');
			return;
		}

		pintar(datos.cerrado);
		campoClave.value = '';
		decir(
			cerrado
				? 'Listo. La página ya avisa de que hoy no sales.'
				: 'Listo. El truck vuelve a su horario normal.',
			'bien'
		);
	} catch (e) {
		decir('Sin conexión. Inténtalo otra vez.', 'error');
	} finally {
		ocupado(false);
	}
}

formulario.addEventListener('submit', (e) => e.preventDefault());
botones.forEach((boton) => {
	boton.addEventListener('click', () => enviar(boton.dataset.accion === 'cerrar'));
});

consultar();
