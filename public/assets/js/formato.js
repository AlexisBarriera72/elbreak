/**
 * Formato de precios.
 *
 * Lo usan el navegador y el script de build, para que un precio se escriba
 * igual en la carta, en el carrito y en el mensaje de WhatsApp.
 */

/** 10 -> "$10" · 11.5 -> "$11.50" */
export function precio(n) {
	if (n === null || n === undefined) return '';
	const centavos = Math.round(n * 100) % 100;
	return '$' + (centavos === 0 ? n.toFixed(0) : n.toFixed(2));
}
