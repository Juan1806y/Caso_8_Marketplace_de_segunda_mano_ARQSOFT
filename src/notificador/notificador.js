// Notificador: consume MensajeNuevo y le avisa al destinatario ausente por push o correo.
// Habla con el proveedor solo a través del puerto proveedor.enviar(aviso): no sabe si es el real o el simulado.
//
// Versión inicial, sin tácticas: si el proveedor falla, registra el error y confirma igual al broker.
// Tampoco es idempotente, aunque el ADR-001 lo exige: un mensaje que el broker reentrega se avisaría dos veces.
// En esta versión el rojo son los avisos perdidos; los duplicados aparecen al aplicar el reintento (T1), y
// el ADR-003 decide cómo se corrigen y cuánto cuesta.
export function crearNotificador({ broker, proveedor, log = console }) {
  broker.suscribir('mensaje.nuevo', async ({ datos }) => {
    try {
      await proveedor.enviar({
        idMensaje: datos.idMensaje,
        destinatarioId: datos.destinatarioId,
        texto: 'Tienes un mensaje nuevo en el marketplace',
      });
    } catch (error) {
      log.warn(`No se pudo avisar del mensaje ${datos.idMensaje}: ${error.message}`);
    }
    // Al terminar sin lanzar error, el broker da el mensaje por confirmado y lo olvida.
  });
}
