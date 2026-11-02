// Arma el camino del escenario QA-3 (servicio de chat → broker → notificador → proveedor), le aplica la carga
// y cuenta lo que pide la medida. Lo usan la prueba (test/escenario-qa3.test.js) y la medición (scripts/medir.js).
import { rmSync } from 'node:fs';
import { crearBroker } from '../../src/broker/memoria.js';
import { crearEnviarMensaje } from '../../src/chat/enviar-mensaje.js';
import { crearNotificador } from '../../src/notificador/notificador.js';
import { crearProveedorSimulado } from '../../src/adaptadores/proveedor-simulado.js';

// Carga del escenario (supuesto declarado en el README): 30 mensajes por segundo a destinatarios ausentes,
// durante 20 s, lo mismo que dura la caída del proveedor en config/falla.env.
export const CARGA = { mensajesPorSegundo: 30, duracionMs: 20_000 };
// Medida de QA-3 (ADR-000): el aviso al ausente sale en ≤ 10 s; con el proveedor caído, contado desde que vuelve.
export const LIMITE_P95_MS = 10_000;
// Vendedores distintos que reciben los mensajes: la carga reparte 30 mensajes/s entre ellos
// (supuesto de la prueba; no cambia la medida).
const CONVERSACIONES = 300;
// Margen después de la ventana de la medida para que lo que esté en vuelo termine antes de contar.
const MARGEN_CONTEO_MS = 2_000;

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

export function percentil(valores, p) {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.ceil((p / 100) * orden.length) - 1];
}

export async function simularEscenario(config, carga = CARGA) {
  rmSync(config.estadoDir, { recursive: true, force: true }); // cada corrida empieza sin estado de la anterior
  const inicio = Date.now();
  const historial = new Map();
  const broker = crearBroker(config);
  const proveedor = crearProveedorSimulado({ caidoMs: config.proveedorCaidoMs });
  const enviarMensaje = crearEnviarMensaje({
    repositorio: { guardar: async (mensaje) => void historial.set(mensaje.id, mensaje) },
    presencia: { estaConectado: () => false }, // en este escenario todos los destinatarios están ausentes
    broker,
  });
  // El notificador recibe config para la táctica de idempotencia (ADR-003), que guarda en
  // config.estadoDir los avisos ya enviados.
  // La medición envuelve el puerto del proveedor para anotar cuándo se le llama (ráfaga al volver).
  // Se hace aquí y no en src/ para que el costo en líneas del ADR-003 cuente solo las tácticas.
  const llamadasEn = [];
  const proveedorMedido = {
    enviar(aviso) {
      llamadasEn.push(Date.now());
      return proveedor.enviar(aviso);
    },
  };
  crearNotificador({ broker, proveedor: proveedorMedido, config, log: { warn() {} } });

  // 1. Carga: los compradores escriben a vendedores ausentes a ritmo constante.
  const total = Math.round((carga.mensajesPorSegundo * carga.duracionMs) / 1000);
  const intervaloMs = 1000 / carga.mensajesPorSegundo;
  const confirmaciones = [];
  for (let i = 0; i < total; i++) {
    await dormir(Math.max(0, inicio + i * intervaloMs - Date.now()));
    const antes = performance.now();
    await enviarMensaje({
      conversacionId: `conversacion-${i % CONVERSACIONES}`,
      remitenteId: `comprador-${i}`,
      destinatarioId: `vendedor-${i % CONVERSACIONES}`,
      texto: 'Hola, ¿todavía está disponible?',
    });
    confirmaciones.push(performance.now() - antes);
  }

  // 2. Espera: hasta que todo aviso haya salido y el broker quede quieto, o hasta 10 s después de que
  //    el proveedor vuelve (o de que termina la carga, si volvió antes), más 2 s de margen para medir.
  const avisados = () => new Set(proveedor.entregas.map((e) => e.idMensaje));
  const todosAvisados = () => avisados().size === historial.size;
  const limite = Math.max(proveedor.recuperadoEn, Date.now()) + LIMITE_P95_MS + MARGEN_CONTEO_MS;
  while (Date.now() < limite && !(todosAvisados() && broker.quieto())) await dormir(100);
  broker.detener();

  // 3. Conteo: perdidos, duplicados y tiempo de cada aviso desde que el proveedor pudo recibirlo.
  const veces = new Map();
  const primeraEntrega = new Map();
  for (const entrega of proveedor.entregas) {
    veces.set(entrega.idMensaje, (veces.get(entrega.idMensaje) ?? 0) + 1);
    if (!primeraEntrega.has(entrega.idMensaje)) primeraEntrega.set(entrega.idMensaje, entrega.entregadoEn);
  }
  const mensajes = [...historial.values()];
  const esperas = mensajes.map((m) =>
    primeraEntrega.has(m.id) ? primeraEntrega.get(m.id) - Math.max(proveedor.recuperadoEn, m.enviadoEn) : Infinity,
  );
  return {
    total: mensajes.length,
    perdidos: mensajes.filter((m) => !veces.has(m.id)).length,
    duplicados: [...veces.values()].reduce((suma, n) => suma + n - 1, 0),
    p95AvisoMs: percentil(esperas, 95), // Infinity = más del 5 % de los avisos nunca salió
    p95ConfirmacionMs: Number(percentil(confirmaciones, 95).toFixed(2)),
    llamadasProveedor: proveedor.llamadas,
    reentregasBroker: broker.estadisticas.reentregas,
    // Llamadas en el primer segundo después de que vuelve el proveedor: la ráfaga de reintentos (ADR-003).
    rafagaAlVolver: llamadasEn.filter((t) => t >= proveedor.recuperadoEn && t < proveedor.recuperadoEn + 1_000).length,
    duracionS: Number(((Date.now() - inicio) / 1000).toFixed(1)),
  };
}
