/**
 * Plantilla de la portada.
 *
 * Genera HTML estático: la carta, los precios y el teléfono quedan escritos en
 * el archivo, no los pinta JavaScript. Así Google los lee, cargan al instante
 * y la página sirve aunque el JavaScript falle.
 */

import { precio } from '../../public/assets/js/formato.js';
import { resumenHorario, horarioSchema } from '../../public/assets/js/horario.js';
import { versiculoDelDia } from '../../public/assets/js/versiculo.js';

/** Escapa texto para meterlo en el HTML. */
const e = (s) =>
	String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

/** Escapa para atributos entre comillas simples de JSON embebido. */
const jsonSeguro = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

/* --- Trozos ------------------------------------------------------------- */

function botonAgregar(plato, clase = 'agregar') {
	return `<button type="button" class="${clase}" data-agregar="${e(plato.id)}" data-nombre="${e(plato.nombre)}" data-precio="${plato.precio}">Añadir <span class="agregar__precio">${e(precio(plato.precio))}</span></button>`;
}

function tarjetaPlato(plato) {
	return `
				<article class="plato">
					<div class="plato__foto">
						<img src="assets/img/${e(plato.foto)}" alt="${e(plato.alt || plato.nombre)}"
							width="${plato.ancho || 800}" height="${plato.alto || 600}" loading="lazy" decoding="async">
						<p class="plato__precio">${e(precio(plato.precio))}</p>
					</div>
					<div class="plato__cuerpo">
						<h4 class="plato__nombre">${e(plato.nombre)}</h4>
						<p class="plato__desc">${e(plato.desc)}</p>
						${botonAgregar(plato)}
					</div>
				</article>`;
}

function filaTablero(plato) {
	return `
					<li class="tablero__item">
						<p class="tablero__fila">
							<span>${e(plato.nombre)}</span>
							<span class="tablero__puntos" aria-hidden="true"></span>
							<span class="tablero__precio">${e(precio(plato.precio))}</span>
							${botonAgregar(plato, 'agregar agregar--mini')}
						</p>
						${plato.desc ? `<p class="tablero__desc">${e(plato.desc)}</p>` : ''}
					</li>`;
}

function grupo(g, conCabeza = true) {
	const conFoto = g.platos.filter((p) => p.foto);
	const sinFoto = g.platos.filter((p) => !p.foto);
	const solo = conFoto.length === 1 ? ' destacados--solo' : '';

	return `
			<div class="carta__grupo" data-revela>
				${
					conCabeza
						? `<div class="grupo__cabeza">
					<h3 class="grupo__titulo">${e(g.titulo)}</h3>
					${g.nota ? `<p class="grupo__nota">${e(g.nota)}</p>` : ''}
				</div>`
						: ''
				}
				${conFoto.length ? `<div class="destacados${solo}">${conFoto.map(tarjetaPlato).join('')}\n\t\t\t\t</div>` : ''}
				${sinFoto.length ? `<ul class="tablero tablero--dos">${sinFoto.map(filaTablero).join('')}\n\t\t\t\t</ul>` : ''}
			</div>`;
}

function fichas(nombre, opciones, tipo, leyenda) {
	return `
					<fieldset class="fichas">
						<legend>${e(leyenda)}</legend>
						${opciones
							.map((o, i) => {
								const valor = typeof o === 'string' ? o : o.nombre;
								const extra =
									typeof o === 'object' && o.precio !== undefined
										? ` data-precio="${o.precio}"`
										: '';
								const etiquetaExtra =
									typeof o === 'object' && o.precio !== undefined
										? ` <span class="ficha__extra">${e(precio(o.precio))}</span>`
										: '';
								const marcado = tipo === 'radio' && i === 0 ? ' checked' : '';
								return `<label class="ficha"><input type="${tipo}" name="${nombre}" value="${e(valor)}"${extra}${marcado}><span>${e(valor)}${etiquetaExtra}</span></label>`;
							})
							.join('\n\t\t\t\t\t\t')}
					</fieldset>`;
}

function bloqueAcompanantes(bloque) {
	const filas = bloque.items
		.map((item) => {
			const p = bloque.precioFijo ?? item.precio;
			return filaTablero({ id: item.id, nombre: item.nombre, precio: p, desc: '' });
		})
		.join('');

	return `
				<div>
					<div class="grupo__cabeza">
						<h3 class="grupo__titulo">${e(bloque.titulo)}</h3>
						${bloque.precioFijo ? `<p class="grupo__nota">${e(precio(bloque.precioFijo))} cada uno</p>` : ''}
					</div>
					<ul class="tablero">${filas}
					</ul>
				</div>`;
}

/**
 * La carta en el formato que Google entiende (schema.org Menu).
 *
 * Sale de menu.json, igual que la carta visible, así que un precio sigue
 * escribiéndose una sola vez: si cambia, cambia en la página y en lo que lee
 * Google a la vez. Se incluyen los acompañantes porque también se venden.
 */
function menuSchema(menu) {
	const item = (p, precioFijo) => ({
		'@type': 'MenuItem',
		name: p.nombre,
		...(p.desc ? { description: p.desc } : {}),
		offers: {
			'@type': 'Offer',
			price: (precioFijo ?? p.precio).toFixed(2),
			priceCurrency: 'USD'
		}
	});

	const secciones = menu.grupos.map((g) => ({
		'@type': 'MenuSection',
		name: g.titulo,
		hasMenuItem: g.platos.map((p) => item(p))
	}));

	for (const bloque of menu.acompanantes || []) {
		secciones.push({
			'@type': 'MenuSection',
			name: bloque.titulo,
			hasMenuItem: bloque.items.map((i) => item(i, bloque.precioFijo))
		});
	}

	return { '@type': 'Menu', name: 'Carta', hasMenuSection: secciones };
}

/* --- Página ------------------------------------------------------------- */

export function paginaInicio({ sitio, menu, versiculos = [] }) {
	const horario = resumenHorario(sitio.horario);
	const bowls = menu.grupos.find((g) => g.id === 'bowls');
	const carta = menu.grupos.filter((g) => g.id !== 'bowls');
	const cb = menu.creadorBowl;

	// El del día que se compiló. El navegador lo recalcula al abrir la página,
	// así que un despliegue viejo no deja el versículo congelado.
	const versiculo = versiculoDelDia(versiculos, sitio.zonaHoraria);

	const schema = {
		'@context': 'https://schema.org',
		'@type': 'FoodEstablishment',
		name: sitio.nombre,
		description: sitio.descripcion,
		servesCuisine: ['Puertorriqueña', 'Criolla', 'Comfort food'],
		priceRange: '$',
		telephone: sitio.telefonoE164,
		url: sitio.url,
		image: `${sitio.url}/assets/img/burger-caramelizado.jpg`,
		address: {
			'@type': 'PostalAddress',
			streetAddress: sitio.calle,
			addressLocality: sitio.ciudad,
			addressRegion: sitio.region,
			addressCountry: sitio.pais
		},
		openingHours: horarioSchema(sitio.horario),
		acceptsReservations: false,
		hasMenu: menuSchema(menu),
		sameAs: [sitio.instagramUrl]
	};

	// Solo lo que el navegador necesita de verdad.
	const datosCliente = {
		whatsapp: sitio.whatsapp,
		zonaHoraria: sitio.zonaHoraria,
		horario: sitio.horario,
		versiculos,
		creadorBowl: {
			toppingsIncluidos: cb.toppingsIncluidos,
			toppingExtra: cb.toppingExtra
		}
	};

	return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(sitio.nombre)} · ${e(sitio.lema)}</title>
<meta name="description" content="${e(sitio.descripcion)} ${e(horario)}. Ordena al ${e(sitio.telefono)}.">
<meta name="theme-color" content="#0d6376">
<link rel="canonical" href="${e(sitio.url)}/">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="assets/img/logo.png">
<link rel="manifest" href="site.webmanifest">
<meta property="og:type" content="restaurant.restaurant">
<meta property="og:site_name" content="${e(sitio.nombre)}">
<meta property="og:url" content="${e(sitio.url)}/">
<meta property="og:title" content="${e(sitio.nombre)} · ${e(sitio.lema)}">
<meta property="og:description" content="${e(sitio.descripcion)}">
<meta property="og:image" content="${e(sitio.url)}/assets/img/burger-caramelizado.jpg">
<meta property="og:image:alt" content="${e(sitio.nombre)}: burger caramelizado recién hecha.">
<meta property="og:locale" content="es_PR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${e(sitio.url)}/assets/img/burger-caramelizado.jpg">
<link rel="preload" href="assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/instrumentsans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/app.css">
<script type="application/ld+json">${jsonSeguro(schema)}</script>
</head>
<body>

<a class="saltar" href="#contenido">Saltar al contenido</a>

<header class="cabecera" id="cabecera">
	<div class="envoltura cabecera__fila">

		<a class="marca" href="#inicio">
			<img class="marca__logo" src="assets/img/logo.png" alt="" width="48" height="48" aria-hidden="true">
			<span class="marca__texto">
				<span class="marca__nombre">El Break</span>
				<span class="marca__sub">Food Truck</span>
			</span>
		</a>

		<nav class="nav" aria-label="Secciones de la carta">
			<ul class="nav__lista">
				<li><a class="nav__enlace" href="#carta">Carta</a></li>
				<li><a class="nav__enlace" href="#bowls">Bowls</a></li>
				<li><a class="nav__enlace" href="#crea">Crea tu bowl</a></li>
				<li><a class="nav__enlace" href="#visita">Visítanos</a></li>
			</ul>
		</nav>

		<p class="estado" data-estado="horario" data-estado-vivo>
			<span class="estado__punto" aria-hidden="true"></span>
			<span class="estado__etiqueta">${e(horario)}</span>
		</p>

		<button type="button" class="carrito-boton" data-carrito-abrir aria-label="Ver tu orden">
			<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h2l1.6 9.2a2 2 0 0 0 2 1.7h6.9a2 2 0 0 0 2-1.6L20 8H6.5"/><circle cx="10" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></svg>
			<span class="carrito-boton__texto">Orden</span>
			<span class="carrito-boton__cuenta" data-carrito-cuenta hidden>0</span>
		</button>

		<a class="boton boton--sol cabecera__llamar" href="tel:${e(sitio.telefonoE164)}">${e(sitio.telefono)}</a>

	</div>
	<div class="toldo" aria-hidden="true"></div>
</header>

<main id="contenido">

<!-- El aviso del día, si el dueño puso uno desde /panel. Nace oculto: lo
     enciende app.js cuando hay algo que decir, y se apaga solo a medianoche. -->
<p class="especial" data-especial hidden></p>

<section class="hero" id="inicio">
	<div class="envoltura hero__interior">
		<div class="hero__texto">
			<h1 class="hero__titulo">Tu break <em>perfecto</em></h1>
			<p class="hero__entrada">${e(sitio.descripcion)}</p>

			<p class="hero__estado" data-estado-detalle>
				<span class="estado__punto" aria-hidden="true"></span>${e(horario)}
			</p>

			<div class="hero__acciones">
				<a class="boton boton--sol" href="tel:${e(sitio.telefonoE164)}">Llamar ${e(sitio.telefono)}</a>
				<a class="boton boton--crema" href="#carta">Ver la carta</a>
			</div>

			<p class="hero__pie">
				<span>${e(horario)}</span>
				<span>${e(sitio.zona)}</span>
			</p>
		</div>

		<figure class="hero__ventana">
			<span class="hero__marco">
				<img class="hero__foto" src="assets/img/burger-caramelizado.jpg"
					alt="Burger Caramelizado de El Break sostenida frente al mar."
					width="728" height="493" fetchpriority="high" decoding="async">
			</span>
			<img class="hero__sello" src="assets/img/logo.png" alt="" aria-hidden="true" width="116" height="116">
		</figure>
	</div>
</section>


<section class="seccion seccion--crema" id="carta">
	<div class="envoltura">
		<div class="seccion__cabeza" data-revela>
			<p class="rotulo">La carta</p>
			<h2 class="seccion__titulo">Del truck a tu mano</h2>
			<p class="seccion__nota">Todo se hace al momento. Las burgers y los sándwiches salen con papas fritas.</p>
		</div>
		${carta.map((g) => grupo(g)).join('')}
	</div>
</section>


<section class="seccion seccion--arena" id="bowls">
	<div class="envoltura">
		<div class="seccion__cabeza" data-revela>
			<p class="rotulo">Bowls de la casa</p>
			<h2 class="seccion__titulo">Cinco bowls, un precio</h2>
			<p class="seccion__nota">${e(bowls.nota)} Si prefieres armarlo tú, baja a <a href="#crea">crea tu bowl</a>.</p>
		</div>
		${grupo(bowls, false)}
	</div>
</section>


<section class="seccion seccion--crema" id="crea">
	<div class="envoltura">

		<div class="crea__intro" data-revela>
			<div class="seccion__cabeza">
				<p class="rotulo">Crea tu bowl</p>
				<h2 class="seccion__titulo">Ármalo a tu manera</h2>
				<p class="seccion__nota">Escoge base, proteína y hasta ${cb.toppingsIncluidos} toppings. El total lo define la proteína.</p>
			</div>
			<figure class="crea__muestra">
				<img src="assets/img/${e(cb.foto)}" alt="${e(cb.fotoAlt)}" width="900" height="650" loading="lazy" decoding="async">
				<figcaption>${e(cb.fotoPie)}</figcaption>
			</figure>
		</div>

		<form class="crea" id="creador-bowl" data-revela>
			<div class="crea__pasos">

				<div class="paso">
					<div class="paso__cabeza">
						<span class="paso__numero" aria-hidden="true">01</span>
						<h3 class="paso__titulo">Escoge tu base</h3>
					</div>
					${fichas('base', cb.bases, 'radio', 'Base del bowl')}
				</div>

				<div class="paso">
					<div class="paso__cabeza">
						<span class="paso__numero" aria-hidden="true">02</span>
						<h3 class="paso__titulo">Escoge tu proteína</h3>
						<p class="paso__pista">Define el precio del bowl</p>
					</div>
					${fichas('proteina', cb.proteinas, 'radio', 'Proteína del bowl')}
				</div>

				<div class="paso">
					<div class="paso__cabeza">
						<span class="paso__numero" aria-hidden="true">03</span>
						<h3 class="paso__titulo">Añade toppings</h3>
						<p class="paso__pista" data-pista-toppings>${cb.toppingsIncluidos} de ${cb.toppingsIncluidos} disponibles</p>
					</div>
					${fichas('topping', cb.toppings, 'checkbox', 'Toppings del bowl')}
				</div>

			</div>

			<aside class="resumen" aria-live="polite">
				<p class="resumen__titulo">Tu bowl</p>
				<dl class="resumen__lista">
					<div class="resumen__linea"><dt>Base</dt><dd data-resumen="base">${e(cb.bases[0])}</dd></div>
					<div class="resumen__linea"><dt>Proteína</dt><dd data-resumen="proteina">${e(cb.proteinas[0].nombre)}</dd></div>
					<div class="resumen__linea"><dt>Toppings</dt><dd data-resumen="toppings"><span class="resumen__vacio">Ninguno todavía</span></dd></div>
				</dl>
				<p class="resumen__total">
					<span>Total</span>
					<span data-resumen="total">${e(precio(cb.proteinas[0].precio))}</span>
				</p>
				<div class="resumen__acciones">
					<button type="button" class="boton boton--sol" data-agregar-bowl>Añadir a mi orden</button>
					<a class="boton boton--linea" href="tel:${e(sitio.telefonoE164)}">Llamar para ordenar</a>
				</div>
			</aside>
		</form>

	</div>
</section>


<section class="seccion seccion--arena" id="sides">
	<div class="envoltura">
		<div class="seccion__cabeza" data-revela>
			<p class="rotulo">Para acompañar</p>
			<h2 class="seccion__titulo">Sides y bebidas</h2>
		</div>
		<div class="acompana" data-revela>
			${menu.acompanantes.map(bloqueAcompanantes).join('')}
		</div>
	</div>
</section>


<section class="seccion seccion--mar" id="nosotros">
	<div class="envoltura">
		<div class="seccion__cabeza" data-revela>
			<p class="rotulo">Fe, familia y propósito</p>
			<h2 class="seccion__titulo">Comida que nutre el cuerpo y el alma</h2>
			${
				versiculo
					? `<blockquote class="versiculo" data-versiculo>
				<span data-versiculo-texto>${e(versiculo.texto)}</span>
				<cite data-versiculo-cita>${e(versiculo.cita)}</cite>
			</blockquote>`
					: ''
			}
		</div>
		<div class="valores" data-revela>
			${sitio.valores
				.map(
					(v) => `<div class="valor">
				<h3 class="valor__titulo">${e(v.titulo)}</h3>
				<p class="valor__texto">${e(v.texto)}</p>
			</div>`
				)
				.join('\n\t\t\t')}
		</div>
	</div>
</section>


<section class="seccion seccion--crema" id="visita">
	<div class="envoltura">
		<div class="seccion__cabeza" data-revela>
			<p class="rotulo">Visítanos</p>
			<h2 class="seccion__titulo">Dónde y cuándo</h2>
		</div>
		<div class="visita" data-revela>
			<div class="dato">
				<p class="dato__etiqueta">Horario</p>
				<p class="dato__valor">${e(horario)}</p>
				<!-- Lo rellena app.js con el estado en vivo. Vacío sin JavaScript:
				     el horario completo ya está en la línea de arriba. -->
				<p class="dato__extra" data-estado-detalle></p>
			</div>
			<div class="dato">
				<p class="dato__etiqueta">Dónde estamos</p>
				<a class="dato__valor" href="${e(sitio.mapaUrl)}" rel="noopener">${e(sitio.zona)}</a>
				<p class="dato__extra">${e(sitio.entrega)}</p>
			</div>
			<div class="dato">
				<p class="dato__etiqueta">Ordena</p>
				<a class="dato__valor" href="tel:${e(sitio.telefonoE164)}">${e(sitio.telefono)}</a>
				<p class="dato__extra">Llama y recoge, o arma tu orden aquí y envíala por WhatsApp.</p>
			</div>
			<div class="dato">
				<p class="dato__etiqueta">Síguenos</p>
				<a class="dato__valor" href="${e(sitio.instagramUrl)}" rel="noopener">@${e(sitio.instagram)}</a>
				<p class="dato__extra">Ahí publicamos los especiales del día.</p>
			</div>
		</div>
		<p class="aviso">${e(sitio.avisoAlergias)}</p>
	</div>
</section>

</main>

<footer class="pie">
	<div class="envoltura">
		<div class="pie__fila">
			<div class="pie__marca">
				<img class="pie__logo" src="assets/img/logo.png" alt="" width="54" height="54" aria-hidden="true" loading="lazy">
				<span class="pie__lema">El Break,<br>tu break perfecto</span>
			</div>
			<ul class="pie__enlaces">
				<li><a href="tel:${e(sitio.telefonoE164)}">${e(sitio.telefono)}</a></li>
				<li><a href="${e(sitio.instagramUrl)}" rel="noopener">@${e(sitio.instagram)}</a></li>
				<li><a href="${e(sitio.mapaUrl)}" rel="noopener">Cómo llegar</a></li>
			</ul>
		</div>
		<div class="pie__legal">
			<span>${e(horario)}</span>
			<span>&copy; ${new Date().getFullYear()} ${e(sitio.nombre)} · ${e(sitio.ciudad)}, Puerto Rico</span>
			<span class="pie__enlaces">
				<a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a>
			</span>
		</div>
	</div>
</footer>

<div class="barra-movil">
	<a class="boton boton--linea barra-movil__llamar" href="tel:${e(sitio.telefonoE164)}" aria-label="Llamar ${e(sitio.telefono)}">
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3h3l1.5 4-2 1.4a12 12 0 0 0 5.5 5.5l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3z"/></svg>
		Llamar
	</a>
	<button type="button" class="boton boton--sol barra-movil__orden" data-carrito-abrir>
		Ver mi orden <span class="carrito-boton__cuenta" data-carrito-cuenta hidden>0</span>
	</button>
</div>

<div class="velo" id="carrito-velo" hidden></div>

<aside class="carrito" id="carrito" role="dialog" aria-modal="true" aria-labelledby="carrito-titulo" hidden>
	<div class="carrito__cabeza">
		<h2 class="carrito__titulo" id="carrito-titulo">Tu orden</h2>
		<button type="button" class="carrito__cerrar" data-carrito-cerrar aria-label="Cerrar la orden">
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
		</button>
	</div>

	<div class="carrito__vacio" data-carrito-vacio>
		<p>Todavía no has añadido nada.</p>
		<p class="carrito__vacio-pista">Añade algo de la carta o arma tu bowl, y aquí te aparece.</p>
		<button type="button" class="boton boton--linea" data-carrito-cerrar>Ver la carta</button>
	</div>

	<div class="carrito__cuerpo" data-carrito-cuerpo hidden>
		<ul class="carrito__lista" data-carrito-lista></ul>

		<div class="carrito__datos">
			<label class="campo">
				<span class="campo__etiqueta">Tu nombre</span>
				<input type="text" id="cliente-nombre" autocomplete="name" placeholder="Para saber de quién es la orden">
			</label>

			<fieldset class="campo campo--modo">
				<legend class="campo__etiqueta">¿Recogido o delivery?</legend>
				<div class="modo">
					<label class="ficha"><input type="radio" name="modo" value="recogido" checked><span>Recogido</span></label>
					<label class="ficha"><input type="radio" name="modo" value="delivery"><span>Delivery</span></label>
				</div>
			</fieldset>

			<label class="campo">
				<span class="campo__etiqueta">Nota <span class="campo__opcional">(opcional)</span></span>
				<textarea id="cliente-nota" rows="2" placeholder="Alergias, sin cebolla, hora de recogido…"></textarea>
			</label>
		</div>

		<div class="carrito__pie">
			<p class="carrito__total">
				<span>Total</span>
				<span data-carrito-total>$0</span>
			</p>
			<p class="carrito__pago">Se paga al recoger. Efectivo o ATH Móvil.</p>

			<a class="boton boton--wa" data-carrito-whatsapp href="#" target="_blank" rel="noopener">
				<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1s-.6.8-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.4 0-.5s-.6-1.4-.8-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.7.7-1 1.6-1 2.6a6 6 0 0 0 1.3 3.2 10.4 10.4 0 0 0 4.5 3.6c1.7.6 2.3.7 3.1.6.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>
				Enviar por WhatsApp
			</a>

			<div class="carrito__secundario">
				<a class="carrito__enlace" href="tel:${e(sitio.telefonoE164)}">Prefiero llamar</a>
				<button type="button" class="carrito__enlace" data-carrito-vaciar>Vaciar orden</button>
			</div>
		</div>
	</div>
</aside>

<script>window.EL_BREAK=${jsonSeguro(datosCliente)};</script>
<script type="module" src="assets/js/app.js"></script>
</body>
</html>
`;
}
