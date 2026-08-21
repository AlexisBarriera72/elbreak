/**
 * El Break Food Truck — comportamiento de la página.
 *
 * Todo lo de aquí es mejora progresiva: la carta completa, los precios y el
 * teléfono ya están en el HTML. Sin JavaScript el sitio sigue sirviendo para
 * lo que existe — mirar la carta y llamar.
 */

import { estadoServicio, fechaEnZona } from './horario.js';
import { versiculoDelDia } from './versiculo.js';
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

// La pone el dueño desde /panel. Empieza en null: si la consulta falla, manda
// el horario de siempre y la página nunca se queda muda.
let excepcionHoy = null;

function pintarEstado() {
	if (!datos.horario || !datos.zonaHoraria) return;

	const estado = estadoServicio(datos.horario, datos.zonaHoraria, new Date(), {
		cerradoHoy: Boolean(excepcionHoy) && excepcionHoy.modo === 'cerrado',
		abiertoHoy: excepcionHoy && excepcionHoy.modo === 'abierto' ? excepcionHoy : null
	});

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

/* --- Versículo del día ---------------------------------------------------
   El HTML trae el del día en que se compiló. Si el despliegue lleva semanas
   parado, aquí lo corregimos al que toca hoy en Yauco.                      */

function pintarVersiculo() {
	if (!datos.versiculos || !datos.zonaHoraria) return;

	const hoy = versiculoDelDia(datos.versiculos, datos.zonaHoraria);
	if (!hoy) return;

	const texto = $('[data-versiculo-texto]');
	const cita = $('[data-versiculo-cita]');

	if (texto) texto.textContent = hoy.texto;
	if (cita) cita.textContent = hoy.cita;
}

/* --- Aviso del día ------------------------------------------------------- */

function pintarEspecial() {
	const banda = $('[data-especial]');
	if (!banda) return;

	const texto = excepcionHoy && excepcionHoy.especial ? excepcionHoy.especial : '';

	banda.textContent = texto;
	banda.hidden = texto === '';
}

/* --- Platos agotados -----------------------------------------------------
   El plato no se quita de la carta: interesa que se vea que existe. Se atenúa
   y se desactiva el botón, que es lo que impide meterlo en el carrito.      */

function pintarAgotados() {
	const fuera = new Set(excepcionHoy && excepcionHoy.agotados ? excepcionHoy.agotados : []);

	$$('[data-agregar]').forEach((boton) => {
		const agotado = fuera.has(boton.dataset.agregar);
		if (boton.disabled === agotado) return;

		boton.disabled = agotado;

		if (agotado) {
			// Se guarda la etiqueta con su precio para poder devolverla luego.
			if (!boton.dataset.etiqueta) boton.dataset.etiqueta = boton.innerHTML;
			boton.textContent = 'Agotado hoy';
		} else if (boton.dataset.etiqueta) {
			boton.innerHTML = boton.dataset.etiqueta;
			delete boton.dataset.etiqueta;
		}

		const ficha = boton.closest('.plato, .tablero__item');
		if (ficha) ficha.dataset.agotado = agotado ? 'si' : 'no';
	});
}

/* Un solo latido para todo lo que depende de la hora: así la página que se
   queda abierta cruza la medianoche y el mediodía sin recargar. */
function latido() {
	pintarEstado();
	pintarVersiculo();
	pintarEspecial();
	pintarAgotados();
}

/* --- La excepción de hoy -------------------------------------------------
   Desde /panel el dueño puede marcar que hoy no sale, o que hoy abre aunque
   no toque. Lo guardado lleva la fecha dentro, así que en cuanto deja de ser
   hoy el truck vuelve solo a su horario: olvidarse de deshacerlo no deja el
   sitio mintiendo para siempre.

   Va después de pintar, no antes: si la red falla o la función no responde,
   la página ya está enseñando el horario normal.                            */

async function consultarExcepcion() {
	if (!datos.zonaHoraria) return;

	try {
		const respuesta = await fetch('/api/estado', { headers: { accept: 'application/json' } });
		if (!respuesta.ok) return;

		const { excepcion } = await respuesta.json();
		const vale = excepcion && excepcion.fecha === fechaEnZona(datos.zonaHoraria);
		const nueva = vale ? excepcion : null;

		// Solo se repinta si de verdad cambió algo.
		if (JSON.stringify(nueva) !== JSON.stringify(excepcionHoy)) {
			excepcionHoy = nueva;
			latido();
		}
	} catch (e) {
		// Sin respuesta, manda el horario de siempre.
	}
}

latido();
setInterval(latido, 60000);

consultarExcepcion();
// Cada diez minutos, por si el dueño lo marca con la página ya abierta.
setInterval(consultarExcepcion, 600000);

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
   La orden va por WhatsApp desde el teléfono del cliente. No hay servidor de
   por medio: el enlace ya lleva la orden escrita y solo hay que darle a
   enviar.                                                                   */

carrito.alCambiar(pintarCarrito);
carrito.cargar();

/* --- Utilidades ---------------------------------------------------------- */

/**
 * Escapa texto para meterlo en el HTML del carrito.
 *
 * Tiene que escapar también las comillas dobles: parte de lo que sale de aquí
 * va dentro de un atributo (`aria-label="…"`), y un plato que se llamara
 * `Burger "El Break"` rompería el atributo. El truco de textContent+innerHTML
 * no escapa comillas, así que se hace a mano — igual que `e()` en el build.
 */
function escapar(texto) {
	return String(texto ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
