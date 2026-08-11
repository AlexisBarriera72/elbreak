/**
 * Adaptador para Vercel (Edge Runtime).
 *
 * Vercel ignora los archivos de api/ que empiezan con guion bajo, por eso la
 * lógica vive en src/order-handler.js y aquí solo la enchufamos.
 */

import { manejarOrden } from '../src/order-handler.js';

export const config = { runtime: 'edge' };

export default function handler(request) {
	return manejarOrden(request, {
		TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
		TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID
	});
}
