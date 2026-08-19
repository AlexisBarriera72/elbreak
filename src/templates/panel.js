/**
 * Panel del dueño: /panel
 *
 * No se enlaza desde ninguna parte del sitio y lleva `noindex`, pero lo que de
 * verdad lo protege es la clave, que se comprueba en la función. Una dirección
 * difícil de adivinar no es una cerradura.
 *
 * Los estilos van aquí dentro a propósito: es una página que abre una sola
 * persona, y no merece la pena engordar app.css —que sí descarga todo el
 * mundo— por unas cuantas reglas.
 */

import { ventanaHabitual, horaLegible } from '../../public/assets/js/horario.js';

const e = (s) =>
	String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

export function paginaPanel(sitio) {
	// Se proponen las horas de siempre para no tener que escribirlas cada vez.
	const habitual = ventanaHabitual(sitio.horario);

	return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel · ${e(sitio.nombre)}</title>
<meta name="description" content="Panel privado del dueño.">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/app.css">
<style>
	.panel { max-width: 32rem; }
	.panel__estado { margin: 0 0 2.5rem; font-size: 1.15rem; line-height: 1.5; font-weight: 500; }
	.panel__campo { display: block; margin: 0 0 0.5rem; font-size: 0.78rem;
		font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; }
	.panel__clave, .panel__hora { padding: 0.8rem 0.95rem; font: inherit; font-size: 1rem;
		border: 2px solid rgba(13, 99, 118, 0.25); border-radius: 0.7rem; background: #fff; }
	.panel__clave { width: 100%; }
	.panel__clave:focus, .panel__hora:focus { outline: 3px solid var(--oro); outline-offset: 1px; }
	.panel__grupo { margin-top: 2.5rem; padding-top: 2rem; border-top: 1px solid rgba(0, 0, 0, 0.12); }
	.panel__titulo { margin: 0 0 0.4rem; font-size: 1rem; font-weight: 700; }
	.panel__pie { margin: 0 0 1.25rem; font-size: 0.9rem; opacity: 0.75; }
	.panel__horas { display: flex; flex-wrap: wrap; align-items: end; gap: 0.75rem; margin-bottom: 1.25rem; }
	.panel__horas label { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.16em;
		text-transform: uppercase; display: block; margin-bottom: 0.4rem; }
	.panel__botones { display: flex; flex-wrap: wrap; gap: 0.75rem; }
	.panel__botones button[disabled] { opacity: 0.5; cursor: progress; }
	.panel__aviso { min-height: 1.5rem; margin-top: 1.5rem; font-weight: 600; }
	.panel__aviso[data-tipo="error"] { color: #b3261e; }
	.panel__aviso[data-tipo="bien"] { color: #1f7a34; }
	.panel__nota { margin-top: 2.5rem; font-size: 0.9rem; opacity: 0.75; }
</style>
</head>
<body>
<main class="seccion seccion--crema pagina">
	<div class="envoltura panel">
		<h1 class="pagina__titulo">Panel</h1>

		<p class="panel__estado" data-estado-actual>Leyendo el estado…</p>

		<form data-panel autocomplete="off">
			<label class="panel__campo" for="clave">Clave</label>
			<input class="panel__clave" id="clave" name="clave" type="password"
				autocomplete="current-password" required>

			<div class="panel__grupo">
				<p class="panel__titulo">Hoy no salimos</p>
				<p class="panel__pie">
					Para un día que tocaba trabajar y al final no sales.
				</p>
				<div class="panel__botones">
					<button type="button" class="boton boton--sol" data-accion="cerrado">
						Marcar cerrado
					</button>
				</div>
			</div>

			<div class="panel__grupo">
				<p class="panel__titulo">Abrir un día que no toca</p>
				<p class="panel__pie">
					Para una fiesta, un evento o un domingo suelto. Se proponen las horas
					de siempre (${e(horaLegible(habitual.abre))} – ${e(horaLegible(habitual.cierra))});
					cámbialas si ese día es distinto.
				</p>
				<div class="panel__horas">
					<div>
						<label for="abre">Abre</label>
						<input class="panel__hora" id="abre" type="time" value="${e(habitual.abre)}" required>
					</div>
					<div>
						<label for="cierra">Cierra</label>
						<input class="panel__hora" id="cierra" type="time" value="${e(habitual.cierra)}" required>
					</div>
				</div>
				<div class="panel__botones">
					<button type="button" class="boton boton--sol" data-accion="abierto">
						Abrir hoy
					</button>
				</div>
			</div>

			<div class="panel__grupo">
				<p class="panel__titulo">Deshacer</p>
				<p class="panel__pie">
					Quita lo que hayas marcado y deja el horario de siempre.
				</p>
				<div class="panel__botones">
					<button type="button" class="boton boton--linea" data-accion="normal">
						Volver al horario normal
					</button>
					<button type="button" class="boton boton--linea" data-accion="diagnostico">
						Comprobar configuración
					</button>
				</div>
			</div>
		</form>

		<p class="panel__aviso" data-aviso role="status" aria-live="polite"></p>

		<p class="panel__nota">
			Lo que marques vale solo para hoy. A medianoche el truck vuelve solo a su
			horario, así que si se te olvida deshacerlo no pasa nada.
		</p>
	</div>
</main>
<script type="module" src="/assets/js/panel.js"></script>
</body>
</html>
`;
}
