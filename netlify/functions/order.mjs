/**
 * Adaptador para Netlify Functions (v2).
 *
 * El `config.path` publica la función en /api/order, igual que en los otros
 * dos hosts, para que el navegador llame siempre a la misma ruta.
 */

import { manejarOrden } from '../../src/order-handler.js';

export default (request) =>
	manejarOrden(request, {
		TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
		TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID
	});

export const config = { path: '/api/order' };
