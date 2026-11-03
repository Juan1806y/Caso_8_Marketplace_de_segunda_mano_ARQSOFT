// Notificador: consume MensajeNuevo y le avisa al destinatario ausente por push o correo.
// Habla con el proveedor solo a través del puerto proveedor.enviar(aviso): no sabe si es el real o el simulado.
import { join } from 'node:path';
import { crearRegistroEnviados } from './registro-enviados.js';

// T1 · Reintento con espera creciente y tope (táctica de disponibilidad: recuperar).
// Si el proveedor falla, el mensaje NO se confirma: el broker lo vuelve a entregar después de una espera
// que se duplica (0,5 s, 1 s, 2 s) hasta un tope de 4 s. El tope sale de la medida de QA-3: con 4 s,
// un aviso pendiente sale unos 4 s después de que el proveedor vuelve, por debajo de los 10 s.
const ESPERA_INICIAL_MS = 500;
const ESPERA_TOPE_MS = 4_000;
const esperaParaElIntento = (intento) => Math.min(ESPERA_INICIAL_MS * 2 ** (intento - 1), ESPERA_TOPE_MS);

// T2 · Idempotencia por id del mensaje (táctica de disponibilidad: prevenir).
// El broker entrega al menos una vez: si una confirmación se pierde, el mismo MensajeNuevo vuelve a llegar.
// Un registro en disco de los mensajes ya avisados hace que la reentrega se confirme sin volver a enviar.
export function crearNotificador({ broker, proveedor, config, log = console }) {
  const enviados = crearRegistroEnviados(join(config.estadoDir, 'avisos-enviados.log'));

  broker.suscribir('mensaje.nuevo', async ({ datos, intento }) => {
    if (enviados.contiene(datos.idMensaje)) return; // ya se avisó: se confirma sin volver a enviar
    try {
      await proveedor.enviar({
        idMensaje: datos.idMensaje,
        destinatarioId: datos.destinatarioId,
        texto: 'Tienes un mensaje nuevo en el marketplace',
      });
    } catch (error) {
      log.warn(`No se pudo avisar del mensaje ${datos.idMensaje} (intento ${intento}): ${error.message}`);
      return { reintentarEn: esperaParaElIntento(intento) }; // sin confirmar: el broker lo vuelve a entregar
    }
    enviados.agregar(datos.idMensaje); // queda en disco antes de confirmar
  });
}
