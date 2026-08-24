/**
 * Páginas legales: /privacidad y /terminos.
 *
 * Las dos comparten cáscara —misma cabecera, mismo pie, mismos estilos— y solo
 * cambian el título y el cuerpo. Se generan desde site.json para que el
 * teléfono, la dirección y el nombre no puedan quedarse viejos en un rincón.
 *
 * Aviso: los textos de /terminos son un borrador en lenguaje llano, no un
 * documento revisado por un abogado. Están para que el sitio no salga sin
 * nada, no para confiarles un pleito.
 */

const e = (s) =>
	String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

/** La cáscara común. El cuerpo entra ya como HTML. */
export function paginaLegal(sitio, { titulo, descripcion, cuerpo, actualizado }) {
	return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titulo)} · ${e(sitio.nombre)}</title>
<meta name="description" content="${e(descripcion)}">
<meta name="theme-color" content="#0d6376">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
<main class="seccion seccion--crema pagina">
	<div class="envoltura legal">
		<p class="rotulo"><a href="/">${e(sitio.nombre)}</a></p>
		<h1 class="pagina__titulo">${e(titulo)}</h1>
		<p class="legal__fecha">Actualizado el ${e(actualizado)}.</p>
		${cuerpo}
		<p class="legal__volver">
			<a class="boton boton--sol" href="/">Volver a la carta</a>
		</p>
	</div>
</main>
</body>
</html>
`;
}

/**
 * Privacidad.
 *
 * Sale corta porque el sitio de verdad no recoge casi nada, y eso conviene
 * decirlo claro: es de las pocas páginas de privacidad que son una ventaja
 * competitiva en vez de un trámite.
 */
export function paginaPrivacidad(sitio, actualizado) {
	const cuerpo = `
		<h2 class="legal__titulo">Lo corto</h2>
		<p class="contenido">
			Este sitio no te pide una cuenta, no usa cookies, no lleva analítica y no
			guarda nada tuyo en ningún servidor. La orden se arma en tu propio
			teléfono y se manda por WhatsApp desde tu número, como cualquier otro
			mensaje que escribes tú.
		</p>

		<h2 class="legal__titulo">Qué se queda en tu teléfono</h2>
		<p class="contenido">
			Lo que echas al carrito se guarda en el almacenamiento de tu propio
			navegador para que no se pierda si recargas la página. No sale de ahí, no
			nos llega y no lo puede leer nadie más. El botón <strong>Vaciar</strong>
			del carrito lo borra, y borrar los datos del navegador también.
		</p>

		<h2 class="legal__titulo">Qué pasa al ordenar</h2>
		<p class="contenido">
			Al darle a «Enviar por WhatsApp» se abre WhatsApp con la orden ya escrita
			—los platos, el total y, si los pusiste, tu nombre y tu nota—. El mensaje
			no se manda solo: lo mandas tú. A partir de ahí es una conversación de
			WhatsApp normal entre tú y ${e(sitio.nombre)}, con las mismas condiciones
			de privacidad que WhatsApp aplica a cualquier chat.
		</p>
		<p class="contenido">
			Si prefieres no escribir tu nombre, el sitio funciona igual: esos campos
			son opcionales.
		</p>

		<h2 class="legal__titulo">Cookies y rastreo</h2>
		<p class="contenido">
			Ninguna. No hay cookies, ni píxeles de Facebook, ni Google Analytics, ni
			scripts de terceros. Las fotos, las tipografías y el código se sirven
			desde este mismo dominio.
		</p>

		<h2 class="legal__titulo">Borrar tus datos</h2>
		<p class="contenido">
			No hay nada que pedirnos que borremos, porque no guardamos nada. Lo único
			que existe es el carrito de tu propio navegador, que borras tú cuando
			quieras. Los mensajes de WhatsApp los puedes borrar desde WhatsApp.
		</p>

		<h2 class="legal__titulo">Inteligencia artificial</h2>
		<p class="contenido">
			Para que quede dicho: <strong>ninguna IA procesa datos de clientes</strong>,
			porque no hay datos de clientes que procesar. Se usó asistencia de IA para
			escribir el código de esta página, que es una herramienta de programación
			y no toca nada tuyo.
		</p>

		<h2 class="legal__titulo">Menores</h2>
		<p class="contenido">
			Este sitio es una carta de comida. No pide datos a nadie, así que tampoco
			se los pide a un menor.
		</p>

		<h2 class="legal__titulo">Preguntas</h2>
		<p class="contenido">
			Llama al <a href="tel:${e(sitio.telefonoE164)}">${e(sitio.telefono)}</a> o
			escribe por <a href="${e(sitio.instagramUrl)}" rel="noopener">Instagram</a>.
		</p>`;

	return paginaLegal(sitio, {
		titulo: 'Privacidad',
		descripcion: `Qué recoge y qué no recoge el sitio de ${sitio.nombre}. Resumen: casi nada.`,
		cuerpo,
		actualizado
	});
}

/**
 * Términos.
 *
 * Borrador. Las cuatro cláusulas que suelen pedirse —ley aplicable, límite de
 * responsabilidad, indemnización y arbitraje— escritas en llano. El aviso de
 * alérgenos sale de site.json, que es donde ya vivía.
 */
export function paginaTerminos(sitio, actualizado) {
	const cuerpo = `
		<p class="legal__aviso">
			Este texto está escrito en lenguaje llano para que se entienda, no por un
			abogado. Si algo aquí llegara a importar de verdad, que lo revise uno.
		</p>

		<h2 class="legal__titulo">Qué es este sitio</h2>
		<p class="contenido">
			La carta de ${e(sitio.nombre)}, en ${e(sitio.zona)}. Sirve para ver los
			platos, los precios y el horario, y para armar una orden que se manda por
			WhatsApp. <strong>No se cobra nada aquí</strong>: no hay pagos, no hay
			cuentas y no se reserva nada. El pago se hace en persona.
		</p>

		<h2 class="legal__titulo">Precios y disponibilidad</h2>
		<p class="contenido">
			Los precios y el horario que ves son los que hay al cargar la página, pero
			pueden cambiar. Un plato puede acabarse durante el servicio, y algún día
			el truck puede no salir. Mandar una orden por WhatsApp no es una compra
			cerrada: la orden queda confirmada cuando la confirmamos por el chat.
		</p>

		<h2 class="legal__titulo">Alérgenos</h2>
		<p class="contenido">
			<strong>${e(sitio.avisoAlergias)}</strong> La comida se prepara en un
			espacio pequeño donde se manejan a la vez gluten, lácteos, huevo, soya,
			frutos secos y mariscos, así que no podemos garantizar que no haya
			contacto cruzado. Si tienes una alergia seria, dilo al ordenar y
			pregúntanos antes.
		</p>

		<h2 class="legal__titulo">Hasta dónde respondemos</h2>
		<p class="contenido">
			Ponemos cuidado en que la carta, los precios y el horario estén al día,
			pero el sitio se ofrece tal cual. No respondemos por daños indirectos
			—un viaje en balde porque el horario estaba mal, una orden que no llegó a
			mandarse, el sitio caído—. Si algo se torció con tu comida, háblanos: lo
			arreglamos como se arreglan estas cosas, en persona.
		</p>
		<p class="contenido">
			En cualquier caso, nuestra responsabilidad no pasa de lo que hayas pagado
			por esa orden. Nada de esto quita los derechos que la ley de Puerto Rico
			te dé como consumidor, que están por encima de lo que diga esta página.
		</p>

		<h2 class="legal__titulo">Uso indebido</h2>
		<p class="contenido">
			Si usas este sitio para algo que no es pedir comida —mandar órdenes falsas
			en nombre de otro, intentar romper la página, suplantar al negocio— te
			haces responsable de lo que salga de ahí, incluidos los gastos que nos
			cause.
		</p>

		<h2 class="legal__titulo">Si hay un desacuerdo</h2>
		<p class="contenido">
			Lo primero es hablarlo: llama al
			<a href="tel:${e(sitio.telefonoE164)}">${e(sitio.telefono)}</a>. Casi todo
			se resuelve así.
		</p>
		<p class="contenido">
			Si no, y las dos partes están de acuerdo, se puede llevar a arbitraje en
			Puerto Rico en vez de a los tribunales, que suele ser más rápido y más
			barato. <strong>Esto no te obliga</strong>: si prefieres ir a los
			tribunales de Puerto Rico, puedes.
		</p>

		<h2 class="legal__titulo">Ley aplicable</h2>
		<p class="contenido">
			Rige la ley del Estado Libre Asociado de Puerto Rico, y los tribunales que
			corresponden son los de Yauco o los que por ley toquen.
		</p>

		<h2 class="legal__titulo">Cambios</h2>
		<p class="contenido">
			Si esto cambia, cambia la fecha de arriba. No avisamos de otra forma
			porque no tenemos tu correo.
		</p>`;

	return paginaLegal(sitio, {
		titulo: 'Términos',
		descripcion: `Condiciones de uso, aviso de alérgenos y ley aplicable de ${sitio.nombre}.`,
		cuerpo,
		actualizado
	});
}
