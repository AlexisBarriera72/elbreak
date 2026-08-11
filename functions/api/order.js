/**
 * Adaptador para Cloudflare Pages Functions.
 *
 * La ruta sale de la carpeta: functions/api/order.js -> /api/order
 * Las variables van en el panel de Pages, en Settings > Environment variables.
 */

import { manejarOrden } from '../../src/order-handler.js';

export const onRequest = ({ request, env }) => manejarOrden(request, env);
