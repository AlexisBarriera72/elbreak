/**
 * De dónde saca la función el id y el token del Global Config.
 *
 * Es el trozo que más fácil se rompe al cambiar de proyecto o rotar el token,
 * y el que peor se diagnostica en producción: si sale mal, la página no falla,
 * simplemente se queda sin enterarse de que hoy hay excepción.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { conexion } from '../api/estado.js';

const ID = 'ecfg_eazhhb186lkp4cxc2tkjniwrnoxv';
const TOKEN = '43eabcdefghijklmnop';

test('saca id y token de la cadena que crea Vercel', () => {
	assert.deepEqual(
		conexion({ GLOBAL_CONFIG: `https://global-config.vercel.com/${ID}?token=${TOKEN}` }),
		{ id: ID, token: TOKEN }
	);
});

test('aguanta parámetros de más en la cadena', () => {
	assert.deepEqual(
		conexion({ GLOBAL_CONFIG: `https://global-config.vercel.com/${ID}?token=${TOKEN}&teamId=abc` }),
		{ id: ID, token: TOKEN }
	);
});

test('acepta las variables sueltas si no hay cadena', () => {
	assert.deepEqual(
		conexion({ GLOBAL_CONFIG_ID: ID, GLOBAL_CONFIG_READ_TOKEN: TOKEN }),
		{ id: ID, token: TOKEN }
	);
});

test('la cadena manda sobre las variables sueltas', () => {
	const conf = conexion({
		GLOBAL_CONFIG: `https://global-config.vercel.com/${ID}?token=${TOKEN}`,
		GLOBAL_CONFIG_ID: 'ecfg_viejo',
		GLOBAL_CONFIG_READ_TOKEN: 'token_viejo'
	});

	assert.equal(conf.id, ID);
});

test('sin nada configurado devuelve null, no revienta', () => {
	assert.equal(conexion({}), null);
});

test('una cadena rota devuelve null en vez de un id a medias', () => {
	assert.equal(conexion({ GLOBAL_CONFIG: 'esto no es una url' }), null);
	assert.equal(conexion({ GLOBAL_CONFIG: 'https://global-config.vercel.com/ecfg_x' }), null);
	assert.equal(conexion({ GLOBAL_CONFIG: `https://global-config.vercel.com/?token=${TOKEN}` }), null);
});
