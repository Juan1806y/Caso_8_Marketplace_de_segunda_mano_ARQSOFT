// Caso de uso del servicio de chat: enviar un mensaje dentro de una conversación.
// El remitente recibe la confirmación solo cuando el mensaje quedó guardado (QA-3: 0 mensajes perdidos tras confirmar).
// Si el destinatario no está conectado, se publica MensajeNuevo para que el notificador le avise (función esencial F4).
import { randomUUID } from 'node:crypto';

export function crearEnviarMensaje({ repositorio, presencia, broker, reloj = Date.now }) {
  return async function enviarMensaje({ conversacionId, remitenteId, destinatarioId, texto }) {
    const mensaje = { id: randomUUID(), conversacionId, remitenteId, destinatarioId, texto, enviadoEn: reloj() };
    await repositorio.guardar(mensaje);

    if (!presencia.estaConectado(destinatarioId)) {
      await broker.publicar('mensaje.nuevo', {
        idMensaje: mensaje.id,
        conversacionId,
        destinatarioId,
        enviadoEn: mensaje.enviadoEn,
      });
    }
    return { id: mensaje.id, estado: 'guardado' };
  };
}
