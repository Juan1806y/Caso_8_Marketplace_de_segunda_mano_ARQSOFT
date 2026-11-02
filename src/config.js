// Configuración del escenario QA-3. Los valores llegan de config/normal.env o de config/falla.env
// por medio de node --env-file, así los comandos son los mismos en Windows, macOS y Linux.
const numero = (nombre, porDefecto) => Number(process.env[nombre] ?? porDefecto);

export const config = {
  // Milisegundos que el proveedor de notificaciones pasa caído desde que arranca el escenario (0 = nunca)
  proveedorCaidoMs: numero('PROVEEDOR_CAIDO_MS', 0),
  // El broker pierde 1 de cada N confirmaciones, como si el notificador se reiniciara antes de confirmar (0 = nunca)
  confirmacionPerdidaCada: numero('CONFIRMACION_PERDIDA_CADA', 0),
  // Milisegundos que el broker espera una confirmación que no llegó antes de volver a entregar el mensaje
  reentregaMs: numero('REENTREGA_MS', 1000),
  // Carpeta donde los componentes guardan su estado en disco; cada corrida del escenario empieza con ella vacía.
  // Sin táctica nadie escribe aquí; la usará el almacén de idempotencia del notificador (ADR-001 la exige persistida)
  estadoDir: process.env.ESTADO_DIR ?? '.datos',
};
