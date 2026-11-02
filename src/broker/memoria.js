// Broker en memoria con entrega «al menos una vez», como RabbitMQ en el laboratorio (ADR-001):
// guarda el mensaje, se lo entrega a quien esté suscrito y solo lo olvida cuando recibe la confirmación.
// Si la confirmación no llega, lo vuelve a entregar; por eso un consumidor puede recibir el mismo mensaje dos veces.
import { randomUUID } from 'node:crypto';

export function crearBroker({ confirmacionPerdidaCada = 0, reentregaMs = 1000 } = {}) {
  const suscriptores = new Map();
  const temporizadores = new Set();
  const estadisticas = { entregas: 0, reentregas: 0 };
  let enProceso = 0;
  let confirmaciones = 0;

  function programar(mensaje, esperaMs) {
    const temporizador = setTimeout(() => {
      temporizadores.delete(temporizador);
      entregar(mensaje);
    }, esperaMs);
    temporizadores.add(temporizador);
  }

  async function entregar(mensaje) {
    const manejador = suscriptores.get(mensaje.tema);
    if (!manejador) return programar(mensaje, reentregaMs); // nadie escucha todavía: el mensaje espera
    estadisticas.entregas++;
    if (mensaje.intento > 1) estadisticas.reentregas++;
    enProceso++;
    let respuesta;
    try {
      respuesta = await manejador(mensaje);
    } catch {
      respuesta = { reintentarEn: reentregaMs }; // el consumidor falló sin confirmar: se vuelve a entregar
    } finally {
      enProceso--;
    }
    const siguiente = { ...mensaje, intento: mensaje.intento + 1 };
    if (respuesta?.reintentarEn !== undefined) return programar(siguiente, respuesta.reintentarEn);

    confirmaciones++; // el consumidor terminó: confirmación (ack)
    if (confirmacionPerdidaCada > 0 && confirmaciones % confirmacionPerdidaCada === 0) {
      programar(siguiente, reentregaMs); // la confirmación se perdió: el broker no la vio y vuelve a entregar
    }
  }

  return {
    async publicar(tema, datos) {
      const mensaje = { id: randomUUID(), tema, datos, intento: 1 };
      programar(mensaje, 0);
      return mensaje.id;
    },
    suscribir(tema, manejador) {
      suscriptores.set(tema, manejador);
    },
    quieto: () => enProceso === 0 && temporizadores.size === 0,
    detener() {
      temporizadores.forEach(clearTimeout);
      temporizadores.clear();
    },
    estadisticas,
  };
}
