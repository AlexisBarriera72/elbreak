/**
 * Panel del dueño: /panel
 *
 * No se enlaza desde ninguna parte del sitio y lleva `noindex`, pero lo que de
 * verdad lo protege es la clave, que se comprueba en la función. Una dirección
 * difícil de adivinar no es una cerradura.
 *
 * Los estilos del formulario van aquí dentro a propósito: es una página que
 * abre una sola persona, y no merece la pena engordar app.css —que sí descarga
 * todo el mundo— por cuatro reglas.
 */

const e = (s) =>
	String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

export function paginaPanel(sitio) {
	return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel · ${e(sitio.nombre)}</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="stylesheet" href="/assets/css/app.css">
<style>
	.panel { max-width: 32rem; }
	.panel__campo { display: block; margin: 2rem 0 0.5rem; font-size: 0.78rem;
		font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; }
	.panel__clave { width: 100%; padding: 0.85rem 1rem; font: inherit; font-size: 1rem;
		border: 2px solid rgba(13, 99, 118, 0.25); border-radius: 0.7rem; background: #fff; }
	.panel__clave:focus { outline: 3px solid var(--oro); outline-offset: 1px; }
	.panel__botones { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
	.panel__botones button[disabled] { opacity: 0.5; cursor: progress; }
	.panel__aviso { min-height: 1.5rem; margin-top: 1.25rem; font-weight: 600; }
	.panel__aviso[data-tipo="error"] { color: #b3261e; }
	.panel__aviso[data-tipo="bien"] { color: #1f7a34; }
	.panel__estado { padding: 1rem 1.15rem; border-radius: 0.8rem; font-weight: 600;
		background: rgba(13, 99, 118, 0.08); border-left: 4px solid var(--mar, #0d6376); }
	.panel__estado[data-cerrado="si"] { background: rgba(201, 130, 0, 0.12); border-left-color: #c98200; }
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
				autocomplete="current-password" inputmode="text" required>

			<div class="panel__botones">
				<button type="button" class="boton boton--sol" data-accion="cerrar">
					Hoy no salimos
				</button>
				<button type="button" class="boton boton--linea" data-accion="abrir">
					Volver al horario normal
				</button>
			</div>
		</form>

		<p class="panel__aviso" data-aviso role="status" aria-live="polite"></p>

		<p class="panel__nota">
			Marcar el cierre solo vale para hoy. A medianoche el truck vuelve solo a
			su horario, así que si se te olvida darle a «Volver al horario normal»
			no pasa nada.
		</p>
	</div>
</main>
<script type="module" src="/assets/js/panel.js"></script>
</body>
</html>
`;
}
