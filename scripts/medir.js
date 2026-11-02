// Mide lo que cuesta la táctica: corre el escenario varias veces con la configuración recibida
// (config/*.env) y muestra la mediana de cada número que va al ADR-003. Se corre antes y después:
//   git checkout sin-tactica && npm run medir
//   git checkout con-tactica && npm run medir
// Corridas por configuración: MEDIR_CORRIDAS (3 por defecto). Repetir muestra que el número es estable en
// este equipo (en uno dio 595 en seis corridas seguidas); entre equipos sí cambia (otro dio 596), por eso el
// ADR-003 debe decir en qué equipo se midió. La línea «Por corrida» deja ver si alguna se sale.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config.js';
import { simularEscenario } from '../test/apoyo/simular-escenario.js';

const CORRIDAS = Number(process.env.MEDIR_CORRIDAS ?? 3);

const bytesEnDisco = (carpeta) =>
  existsSync(carpeta) ? readdirSync(carpeta).reduce((suma, f) => suma + statSync(join(carpeta, f)).size, 0) : 0;

const mediana = (valores) => {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
};

// Líneas que añaden las tácticas, entre las dos etiquetas y solo en el notificador (el enunciado las pide
// en el costo). Solo src/notificador: la medición vive en test/ y no debe contar como costo de la táctica.
function lineasDesdeSinTactica() {
  try {
    return execSync('git diff --shortstat sin-tactica con-tactica -- src/notificador', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim() || 'sin cambios en src/';
  } catch {
    return 'no disponible (faltan las etiquetas sin-tactica y con-tactica)';
  }
}

const corridas = [];
for (let i = 1; i <= CORRIDAS; i++) {
  const r = await simularEscenario(config);
  corridas.push({ ...r, bytes: bytesEnDisco(config.estadoDir) });
  process.stdout.write(`corrida ${i}/${CORRIDAS} lista\n`);
}

const de = (campo) => mediana(corridas.map((r) => r[campo]));
const p95Aviso = corridas.map((r) => r.p95AvisoMs);
const formatoP95 = p95Aviso.includes(Infinity)
  ? `sin entrega en ${p95Aviso.filter((v) => v === Infinity).length} de ${CORRIDAS} corridas`
  : mediana(p95Aviso);

console.log(`\nEscenario QA-3 · ${config.proveedorCaidoMs > 0 ? 'con la falla' : 'sin la falla'} · mediana de ${CORRIDAS} corridas`);
console.log('\nLo que mide la prueba');
console.table({
  'Avisos que el chat pidió enviar': de('total'),
  'Perdidos': de('perdidos'),
  'Duplicados': de('duplicados'),
  'p95 del aviso desde que el proveedor pudo recibirlo (ms)': formatoP95,
});
console.log('Lo que cuesta (va al ADR-003)');
console.table({
  'Llamadas al proveedor por aviso': Number((de('llamadasProveedor') / de('total')).toFixed(2)),
  'Llamadas en el primer segundo después de que vuelve el proveedor': de('rafagaAlVolver'),
  'Reentregas del broker': de('reentregasBroker'),
  'Estado guardado en disco (bytes)': de('bytes'),
  'Líneas de las tácticas (src/notificador, entre etiquetas)': lineasDesdeSinTactica(),
  'Duración de la corrida (s)': de('duracionS'),
});
// La confirmación al remitente no depende del notificador (el envío es asíncrono): se muestra para
// poder decir con un dato que la táctica no la empeora, no como costo.
// La latencia que se compara antes y después es el p95 del aviso SIN la falla: con la falla, el «antes»
// sale «sin entrega» y no hay número con el que comparar.
if (config.proveedorCaidoMs === 0) console.log(`Latencia para el ADR-003 (antes y después): p95 del aviso = ${formatoP95} ms`);
console.log(`Control: p95 de la confirmación al remitente = ${de('p95ConfirmacionMs')} ms (no debe cambiar con la táctica)`);
console.log(`Por corrida: perdidos ${corridas.map((r) => r.perdidos).join(' / ')} · duplicados ${corridas.map((r) => r.duplicados).join(' / ')}`);
