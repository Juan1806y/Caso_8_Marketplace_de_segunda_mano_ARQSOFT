// Adaptador simulado del servicio de notificaciones push y correo (el sistema externo de la vista de contenedores).
// Cumple el mismo puerto que tendría el adaptador real, enviar(aviso), y es el mecanismo que reproduce la falla:
// durante los primeros caidoMs responde 503, como un proveedor que no está disponible.
// Además registra cada entrega, para que la prueba pueda contar avisos perdidos y duplicados.
const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
// Lo que tarda el proveedor simulado en responder cuando está arriba (supuesto; no forma parte de la medida).
const LATENCIA_PROVEEDOR_MS = 20;

export function crearProveedorSimulado({ caidoMs = 0, latenciaMs = LATENCIA_PROVEEDOR_MS, reloj = Date.now } = {}) {
  const inicio = reloj();
  const entregas = [];
  let llamadas = 0;

  return {
    async enviar(aviso) {
      llamadas++;
      await dormir(latenciaMs);
      if (reloj() - inicio < caidoMs) {
        throw new Error('503: el servicio de notificaciones no está disponible');
      }
      entregas.push({ ...aviso, entregadoEn: reloj() });
      return { aceptado: true };
    },
    recuperadoEn: inicio + caidoMs,
    get entregas() {
      return entregas;
    },
    get llamadas() {
      return llamadas;
    },
  };
}
