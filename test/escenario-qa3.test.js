// Prueba del escenario QA-3 (ver README): con el proveedor de notificaciones caído y el broker entregando
// al menos una vez, ningún aviso al destinatario ausente se pierde ni se duplica, y los pendientes salen
// en ≤ 10 s (p95) desde que el proveedor vuelve. La condición de éxito es la medida del escenario.
//   npm test             → sin la falla (config/normal.env)
//   npm run test:falla   → con la falla (config/falla.env)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { simularEscenario, CARGA, LIMITE_P95_MS } from './apoyo/simular-escenario.js';

const comoTexto = (ms) => (ms === Infinity ? 'sin entrega' : `${ms} ms`);

test('QA-3 · aviso al destinatario ausente', async (t) => {
  const r = await simularEscenario(config);
  t.diagnostic(
    `Carga: ${CARGA.mensajesPorSegundo} mensajes/s durante ${CARGA.duracionMs / 1000} s · ` +
      `proveedor caído ${config.proveedorCaidoMs / 1000} s · ` +
      `confirmaciones perdidas: ${config.confirmacionPerdidaCada ? `1 de cada ${config.confirmacionPerdidaCada}` : 'ninguna'}`,
  );
  t.diagnostic(
    `Avisos: ${r.total} · perdidos: ${r.perdidos} · duplicados: ${r.duplicados} · ` +
      `p95 desde que el proveedor volvió: ${comoTexto(r.p95AvisoMs)}`,
  );

  await t.test('0 avisos perdidos', () => {
    assert.equal(r.perdidos, 0, `se perdieron ${r.perdidos} de ${r.total} avisos`);
  });
  await t.test('0 avisos duplicados', () => {
    assert.equal(r.duplicados, 0, `${r.duplicados} avisos llegaron más de una vez`);
  });
  await t.test(`p95 ≤ ${LIMITE_P95_MS / 1000} s desde que el proveedor vuelve`, () => {
    assert.ok(r.p95AvisoMs <= LIMITE_P95_MS, `el p95 fue ${comoTexto(r.p95AvisoMs)}`);
  });
});
