/**
 * El Break Food Truck — comportamiento de la página.
 *
 * Todo lo de aquí es mejora progresiva: la carta completa, los precios y el
 * teléfono ya están en el HTML. Sin JavaScript el sitio sigue sirviendo para
 * lo que existe — mirar la carta y llamar.
 */

import { estadoServicio } from './horario.js';
import { precio } from './formato.js';
import * as carrito from './carrito.js';

const datos = window.EL_BREAK || {};
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

/* --- Encabezado: sombra solo cuando hay algo debajo ---------------------- */

const cabecera = $('#cabecera');

if (cabecera) {
	const marcar = () => {
		cabecera.dataset.pegada = scrollY > 8 ? 'si' : 'no';
	};
	marcar();
	addEventListener('scroll', marcar, { passive: true });
}

/* --- Aparición al bajar -------------------------------------------------- */

const porRevelar = $$('[data-revela]');

if (porRevelar.length) {
	if (sinMovimiento || !('IntersectionObserver' in window)) {
		porRevelar.forEach((el) => (el.dataset.revela = 'visto'));
	} else {
		const observador = new IntersectionObserver(
			(entradas) => {
				entradas.forEach((e) => {
					if (!e.isIntersecting) return;
					e.target.dataset.revela = 'visto';
					observador.unobserve(e.target);
				});
			},
			{ rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
		);
		porRevelar.forEach((el) => observador.observe(el));
	}
}

/* --- Estado del servicio -------------------------------------------------
   El HTML trae el horario escrito. Aquí lo convertimos en "Abierto ahora" o
   "Mañana abrimos a las 11:00 am", y lo refrescamos cada minuto.            */

const COLOR_PUNTO = { abierto: '#1f7a34', 'cierra-pronto': '#c98200', cerrado: '#8a9aa0' };

function pintarEstado() {
	if (!datos.horario || !datos.zonaHoraria) return;

	const estado = estadoServicio(datos.horario, datos.zonaHoraria);

	$$('[data-estado-vivo]').forEach((pildora) => {
		pildora.dataset.estado = estado.estado;
		const etiqueta = $('.estado__etiqueta', pildora);
		if (etiqueta) etiqueta.textContent = estado.etiqueta;
	});

	$$('[data-estado-detalle]').forEach((nodo) => {
		const punto = $('.estado__punto', nodo);
		nodo.textContent = estado.detalle;
		if (punto) {
			punto.style.background = COLOR_PUNTO[estado.estado];
			nodo.prepend(punto);
		}
	});
}

pintarEstado();
setInterval(pintarEstado, 60000);

/* --- Creador de bowls ---------------------------------------------------- */

const creador = $('#creador-bowl');

if (creador && datos.creadorBowl) {
	const { toppingsIncluidos: incluidos, toppingExtra: extra } = datos.creadorBowl;
	const pista = $('[data-pista-toppings]', creador);
	const salida = (clave) => $(`[data-resumen="${clave}"]`, creador);

	const leer = () => {
		const base = $('input[name="base"]:checked', creador);
		const prot = $('input[name="proteina"]:checked', creador);
		const tops = $$('input[name="topping"]:checked', creador).map((t) => t.value);

		return {
			base: base ? base.value : '',
			proteina: prot ? prot.value : '',
			precioProteina: prot ? Number(prot.dataset.precio) : 0,
			toppings: tops
		};
	};

	const totalBowl = (sel) =>
		sel.precioProteina + Math.max(0, sel.toppings.length - incluidos) * extra;

	const descripcionBowl = (sel) => {
		const trozos = [sel.base.toLowerCase(), sel.proteina.toLowerCase()];
		if (sel.toppings.length) trozos.push(sel.toppings.map((t) => t.toLowerCase()).join(', '));
		return trozos.join(' · ');
	};

	const refrescar = () => {
		const sel = leer();

		salida('base').textContent = sel.base;
		salida('proteina').textContent = sel.proteina;
		salida('total').textContent = precio(totalBowl(sel));

		const casilla = salida('toppings');
		if (sel.toppings.length) {
			casilla.textContent = sel.toppings.join(', ');
		} else {
			casilla.innerHTML = '<span class="resumen__vacio">Ninguno todavía</span>';
		}

		if (pista) {
			const sobran = sel.toppings.length - incluidos;
			pista.textContent =
				sobran > 0
					? `${sobran} adicional${sobran > 1 ? 'es' : ''} · +${precio(sobran * extra)}`
					: `${incluidos - sel.toppings.length} de ${incluidos} disponibles`;
		}
	};

	creador.addEventListener('change', refrescar);
	creador.addEventListener('submit', (e) => e.preventDefault());
	refrescar();

	const botonBowl = $('[data-agregar-bowl]', creador);

	if (botonBowl) {
		botonBowl.addEventListener('click', () => {
			const sel = leer();
			carrito.agregar({
				id: 'bowl-personalizado',
				nombre: 'Bowl personalizado',
				precio: totalBowl(sel),
				detalle: descripcionBowl(sel)
			});
			confirmarBoton(botonBowl, 'Añadido');
			abrirCarrito();
		});
	}
}

/* --- Añadir platos de la carta ------------------------------------------- */

$$('[data-agregar]').forEach((boton) => {
	boton.addEventListener('click', () => {
		carrito.agregar({
			id: boton.dataset.agregar,
			nombre: boton.dataset.nombre,
			precio: Number(boton.dataset.precio)
		});
		confirmarBoton(boton, 'Añadido');
	});
});

function confirmarBoton(boton, texto) {
	if (boton.dataset.ocupado) return;
	const antes = boton.textContent;
	boton.dataset.ocupado = 'si';
	boton.textContent = texto;
	setTimeout(() => {
		boton.textContent = antes;
		delete boton.dataset.ocupado;
	}, 1400);
}

/* --- Panel del carrito --------------------------------------------------- */

const panel = $('#carrito');
const velo = $('#carrito-velo');
const listaCarrito = $('[data-carrito-lista]');
const totalCarrito = $('[data-carrito-total]');
const contadores = $$('[data-carrito-cuenta]');
const vacioCarrito = $('[data-carrito-vacio]');
const cuerpoCarrito = $('[data-carrito-cuerpo]');
const enlaceWA = $('[data-carrito-whatsapp]');
const campoNombre = $('#cliente-nombre');
const campoNota = $('#cliente-nota');

let ultimoFoco = null;

function abrirCarrito() {
	if (!panel) return;
	ultimoFoco = document.activeElement;
	panel.hidden = false;
	velo.hidden = false;
	requestAnimationFrame(() => {
		panel.dataset.abierto = 'si';
		velo.dataset.abierto = 'si';
	});
	document.body.style.overflow = 'hidden';
	const cerrar = $('[data-carrito-cerrar]', panel);
	if (cerrar) cerrar.focus();
}

function cerrarCarrito() {
	if (!panel) return;
	delete panel.dataset.abierto;
	delete velo.dataset.abierto;
	document.body.style.overflow = '';
	setTimeout(() => {
		panel.hidden = true;
		velo.hidden = true;
	}, sinMovimiento ? 0 : 260);
	if (ultimoFoco) ultimoFoco.focus();
}

$$('[data-carrito-abrir]').forEach((b) => b.addEventListener('click', abrirCarrito));
$$('[data-carrito-cerrar]').forEach((b) => b.addEventListener('click', cerrarCarrito));
if (velo) velo.addEventListener('click', cerrarCarrito);

addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && panel && !panel.hidden) cerrarCarrito();
});

// Mantiene el foco dentro del panel mientras está abierto.
if (panel) {
	panel.addEventListener('keydown', (e) => {
		if (e.key !== 'Tab') return;
		const focos = $$(
			'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
			panel
		).filter((el) => el.offsetParent !== null);
		if (!focos.length) return;

		const primero = focos[0];
		const ultimo = focos[focos.length - 1];

		if (e.shiftKey && document.activeElement === primero) {
			e.preventDefault();
			ultimo.focus();
		} else if (!e.shiftKey && document.activeElement === ultimo) {
			e.preventDefault();
			primero.focus();
		}
	});
}

/* --- Pintado del carrito ------------------------------------------------- */

function datosCliente() {
	return {
		nombre: campoNombre ? campoNombre.value.trim() : '',
		modo: (($('input[name="modo"]:checked') || {}).value) || 'recogido',
		nota: campoNota ? campoNota.value.trim() : ''
	};
}

function pintarCarrito(lineas) {
	const cuenta = carrito.cantidadTotal();

	contadores.forEach((c) => {
		c.textContent = cuenta;
		c.hidden = cuenta === 0;
	});

	if (!listaCarrito) return;

	const vacio = lineas.length === 0;
	if (vacioCarrito) vacioCarrito.hidden = !vacio;
	if (cuerpoCarrito) cuerpoCarrito.hidden = vacio;

	listaCarrito.innerHTML = '';

	lineas.forEach((linea, i) => {
		const li = document.createElement('li');
		li.className = 'linea';
		li.innerHTML = `
			<div class="linea__texto">
				<p class="linea__nombre">${escapar(linea.nombre)}</p>
				${linea.detalle ? `<p class="linea__detalle">${escapar(linea.detalle)}</p>` : ''}
			</div>
			<div class="linea__control">
				<div class="cantidad">
					<button type="button" class="cantidad__boton" data-menos aria-label="Quitar uno de ${escapar(linea.nombre)}">&minus;</button>
					<span class="cantidad__valor">${linea.cantidad}</span>
					<button type="button" class="cantidad__boton" data-mas aria-label="Añadir uno de ${escapar(linea.nombre)}">+</button>
				</div>
				<p class="linea__precio">${precio(linea.precio * linea.cantidad)}</p>
			</div>`;

		$('[data-menos]', li).addEventListener('click', () =>
			carrito.cambiarCantidad(i, linea.cantidad - 1)
		);
		$('[data-mas]', li).addEventListener('click', () =>
			carrito.cambiarCantidad(i, linea.cantidad + 1)
		);

		listaCarrito.appendChild(li);
	});

	if (totalCarrito) totalCarrito.textContent = precio(carrito.total());
	actualizarEnlace();
}

function actualizarEnlace() {
	if (!enlaceWA || !datos.whatsapp) return;
	enlaceWA.href = carrito.enlaceWhatsApp(datos.whatsapp, datosCliente());
}

[campoNombre, campoNota].forEach((campo) => {
	if (campo) campo.addEventListener('input', actualizarEnlace);
});
$$('input[name="modo"]').forEach((r) => r.addEventListener('change', actualizarEnlace));

const botonVaciar = $('[data-carrito-vaciar]');
if (botonVaciar) {
	botonVaciar.addEventListener('click', () => carrito.vaciar());
}

/* --- Envío ---------------------------------------------------------------
   WhatsApp es el camino principal: abre el chat del cliente con la orden ya
   escrita. Además avisamos al dueño por Telegram si está configurado, para
   que quede constancia aunque el cliente no llegue a darle a enviar.        */

if (enlaceWA) {
	enlaceWA.addEventListener('click', () => {
		if (carrito.estaVacio()) return;

		const orden = carrito.ordenJSON(datosCliente());

		// No bloquea la ida a WhatsApp: si falla o no está configurado, da igual.
		try {
			const cuerpo = JSON.stringify(orden);
			if (navigator.sendBeacon) {
				navigator.sendBeacon('/api/order', new Blob([cuerpo], { type: 'application/json' }));
			} else {
				fetch('/api/order', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: cuerpo,
					keepalive: true
				}).catch(() => {});
			}
		} catch (e) {
			/* el aviso es opcional; la orden va igual por WhatsApp */
		}
	});
}

carrito.alCambiar(pintarCarrito);
carrito.cargar();

/* --- Utilidades ---------------------------------------------------------- */

function escapar(texto) {
	const d = document.createElement('div');
	d.textContent = texto;
	return d.innerHTML;
}
