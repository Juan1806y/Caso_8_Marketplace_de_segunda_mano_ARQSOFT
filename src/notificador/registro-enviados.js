// Registro de los mensajes que ya se avisaron, guardado en disco (un id por línea) para que sobreviva
// a un reinicio del notificador. Si viviera solo en memoria, al reiniciar volverían los duplicados.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function crearRegistroEnviados(ruta) {
  mkdirSync(dirname(ruta), { recursive: true });
  const ids = new Set(existsSync(ruta) ? readFileSync(ruta, 'utf8').split('\n').filter(Boolean) : []);
  return {
    contiene: (id) => ids.has(id),
    agregar(id) {
      appendFileSync(ruta, `${id}\n`);
      ids.add(id);
    },
  };
}
