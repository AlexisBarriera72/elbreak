/**
 * La excepción de hoy: de dónde salen las credenciales y cómo se mezcla un
 * cambio con lo que ya hubiera puesto.
 *
 * Lo de mezclar es lo que más importa aquí. El panel manda solo la parte que
 * tocas, así que si el parche se aplicara mal, marcar un plato agotado a las
 * doce borraría el cierre que se puso a las nueve — y nadie se enteraría hasta
 * que un cliente se presentara en el solar.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { conexion, excepcionValida, aplicarCambio } from '../api/estado.js';

const ID = 'ecfg_eazhhb186lkp4cxc2tkjniwrnoxv';
const TOKEN = '43eabcdefghijklmnop';
const HOY = '2026-08-13';
const AYER = '2026-08-12';

/* --- De dónde salen el id y el token ------------------------------------ */

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
	assert.deepEqual(conexion({ GLOBAL_CONFIG_ID: ID, GLOBAL_CONFIG_READ_TOKEN: TOKEN }), {
		id: ID,
		token: TOKEN
	});
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

/* --- Qué se guarda y qué se descarta ------------------------------------ */

test('solo la fecha no es una excepción', () => {
	assert.equal(excepcionValida({ fecha: HOY }), null);
});

test('sin fecha válida no se guarda nada', () => {
	assert.equal(excepcionValida({ modo: 'cerrado' }), null);
	assert.equal(excepcionValida({ fecha: '13-08-2026', modo: 'cerrado' }), null);
});

test('una apertura con las horas al revés se descarta', () => {
	const r = excepcionValida({ fecha: HOY, modo: 'abierto', abre: '22:00', cierra: '17:00' });
	assert.equal(r, null, 'sin nada más que guardar, no queda excepción');
});

test('los ids raros de agotados se caen', () => {
	const r = excepcionValida({
		fecha: HOY,
		agotados: ['bowl-pasta', 'MAYÚSCULAS', '../../etc', '', 'bowl-pasta']
	});
	assert.deepEqual(r.agotados, ['bowl-pasta'], 'limpia y quita repetidos');
});

test('el aviso se recorta y se le quitan los espacios', () => {
	const r = excepcionValida({ fecha: HOY, especial: '   Hoy pastelón   ' });
	assert.equal(r.especial, 'Hoy pastelón');

	const largo = excepcionValida({ fecha: HOY, especial: 'x'.repeat(400) });
	assert.equal(largo.especial.length, 160);
});

test('un aviso en blanco no cuenta como excepción', () => {
	assert.equal(excepcionValida({ fecha: HOY, especial: '    ' }), null);
});

/* --- Mezclar el cambio con lo que ya había ------------------------------ */

test('marcar agotados no borra el cierre ni el aviso', () => {
	const antes = { fecha: HOY, modo: 'cerrado', especial: 'Hoy pastelón' };
	const { base } = aplicarCambio(antes, { agotados: ['bowl-pasta'] }, HOY);

	assert.equal(base.modo, 'cerrado', 'el cierre sigue');
	assert.equal(base.especial, 'Hoy pastelón', 'el aviso sigue');
	assert.deepEqual(base.agotados, ['bowl-pasta']);
});

test('poner el aviso no borra lo agotado', () => {
	const antes = { fecha: HOY, agotados: ['tenders'] };
	const { base } = aplicarCambio(antes, { especial: 'Hay flan' }, HOY);

	assert.deepEqual(base.agotados, ['tenders']);
	assert.equal(base.especial, 'Hay flan');
});

test('"volver al horario normal" quita el horario pero respeta lo demás', () => {
	const antes = { fecha: HOY, modo: 'cerrado', agotados: ['tenders'], especial: 'Hay flan' };
	const { base } = aplicarCambio(antes, { modo: 'normal' }, HOY);

	assert.equal('modo' in base, false, 'el cierre se va');
	assert.deepEqual(base.agotados, ['tenders'], 'lo agotado se queda');
	assert.equal(base.especial, 'Hay flan', 'el aviso se queda');
});

test('lo guardado ayer no se arrastra a hoy', () => {
	const ayer = { fecha: AYER, modo: 'cerrado', agotados: ['tenders'], especial: 'viejo' };
	const { base } = aplicarCambio(ayer, { especial: 'de hoy' }, HOY);

	assert.equal(base.fecha, HOY);
	assert.equal('modo' in base, false, 'el cierre de ayer no sigue vigente');
	assert.equal('agotados' in base, false, 'lo agotado de ayer vuelve a estar disponible');
	assert.equal(base.especial, 'de hoy');
});

test('pasar de cerrado a abierto limpia las horas viejas y pone las nuevas', () => {
	const antes = { fecha: HOY, modo: 'abierto', abre: '11:00', cierra: '14:00' };
	const { base } = aplicarCambio(antes, { modo: 'cerrado' }, HOY);

	assert.equal(base.modo, 'cerrado');
	assert.equal('abre' in base, false, 'no quedan horas de una apertura que ya no existe');
});

test('una apertura con horas imposibles se rechaza con mensaje', () => {
	const r = aplicarCambio(null, { modo: 'abierto', abre: '22:00', cierra: '17:00' }, HOY);
	assert.match(r.error, /horas/);
	assert.equal(r.base, undefined);
});

test('un modo inventado se rechaza', () => {
	assert.match(aplicarCambio(null, { modo: 'fiesta' }, HOY).error, /modo/);
});

test('vaciar la lista de agotados vuelve a dejar todo disponible', () => {
	const antes = { fecha: HOY, agotados: ['tenders', 'bowl-pasta'] };
	const { base } = aplicarCambio(antes, { agotados: [] }, HOY);

	assert.deepEqual(base.agotados, []);
	assert.equal(excepcionValida(base), null, 'sin nada más, deja de haber excepción');
});
