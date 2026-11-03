# ADR-003: El notificador reintenta con espera creciente hasta 4 s y descarta los avisos repetidos con un registro en disco

Estado: aceptado
Proyecto: Marketplace de segunda mano · Grupo 8
Escenario que lo motiva: QA-3, el aviso al destinatario ausente (`docs/escenario-qa3.md`)

## Contexto

El escenario QA-3 pide que, con el proveedor de notificaciones caído 20 s y el broker entregando al menos una vez, ningún aviso al destinatario ausente se pierda ni se duplique, y que los pendientes salgan en ≤ 10 s (p95) desde que el proveedor vuelve. Con el notificador inicial (etiqueta `sin-tactica`), `npm run test:falla` falla: se pierden 595 de 600 avisos y no hay p95 medible. La causa está en el código: el notificador registra el error del proveedor y confirma igual, así que el broker olvida el mensaje.

El estímulo trae dos modos de falla distintos del mismo atributo (QA-3), y cada uno pide su propia táctica:

- **El proveedor no está disponible.** El aviso se pierde si se confirma sin haber salido.
- **El broker entrega al menos una vez (ADR-001).** Si una confirmación se pierde, el mismo aviso vuelve a llegar.

## Decisión

Aplicamos dos tácticas, las dos en el notificador; el servicio de chat no cambia.

1. **T1 · Reintento con espera creciente y tope (recuperar).** Si el proveedor falla, el notificador no confirma y le pide al broker volver a entregar el mensaje después de 0,5 s, 1 s, 2 s y, desde ahí, cada 4 s. El tope sale de la medida: con 4 s, un aviso pendiente sale unos 4 s después de que el proveedor vuelve, por debajo de los 10 s.
2. **T2 · Idempotencia por id del mensaje (prevenir).** Un registro en disco guarda el id de cada mensaje ya avisado; se escribe después de que el proveedor acepta y antes de confirmar. Si el mismo mensaje vuelve a llegar, se confirma sin enviarlo otra vez. Va en disco y no en memoria porque, si el notificador se reinicia, lo que vive en RAM se pierde y vuelven los duplicados (acto 4 del laboratorio).

El orden importa y quedó en el historial de commits: con T1 sola, los perdidos bajaron a 0 pero aparecieron 66 duplicados y la prueba siguió en rojo; T2 los cerró.

## Alternativas descartadas

| Alternativa | Lo que medimos o lo que costaría | Por qué la descartamos |
|---|---|---|
| Reintento sin tope (la espera se sigue duplicando) | 120 de 600 avisos no salen en los 10 s (122, 120 y 119 en las tres corridas); p95 sin entrega | Después de 20 s de caída, la siguiente espera ya es de 16 s. El tope es lo que conecta la táctica con la medida |
| Reintento inmediato, sin espera | ≈ 124.100 llamadas al proveedor durante la prueba (206,86 por aviso), unas 35 veces más que con espera creciente (≈ 3.576); p95 de 429 ms | Cumple la medida, pero golpea a un proveedor que ya está caído: uno real nos limitaría o bloquearía, y esa carga también la paga nuestro notificador |
| Proveedor de respaldo (redundancia) | Un segundo contrato y una segunda integración | Más costo en una plataforma gratuita (QA-2), y no quita la idempotencia: si el principal envió pero no respondió, el respaldo duplica. Se reconsidera si las caídas del proveedor pasan de minutos |
| Esperar al proveedor desde el chat (llamada síncrona) | El chat dejaría de confirmar mensajes mientras el proveedor esté caído | Devuelve el acoplamiento temporal que el ADR-001 quitó y rompe «0 mensajes perdidos tras confirmar» de QA-3 |
| Idempotencia solo en memoria | Pasa la prueba de hoy | Al reiniciar el notificador el registro se pierde y vuelven los duplicados |
| Cola de mensajes muertos con reintento manual | Ningún aviso perdido | Alguien tendría que reenviarlos a mano: no cumple los 10 s |

## Ventaja

Medida con `npm run medir` y la configuración con la falla:

| Medida | Sin táctica | Con táctica |
|---|---|---|
| Avisos perdidos | 595 de 600 | 0 |
| Avisos duplicados | 0 (casi ninguno alcanzó a salir) | 0 |
| p95 desde que vuelve el proveedor | sin entrega | 3,8 s |
| p95 de la confirmación al remitente | 0,16 ms | 0,12 ms |

La última fila muestra que el remitente no paga la táctica: todo el cambio vive en el notificador, después de que el chat ya confirmó.

## Costo

| Medida | Sin táctica | Con táctica | Lectura |
|---|---|---|---|
| Llamadas al proveedor con la falla | 666 (1,11 por aviso) | ≈ 3.576 (5,96 por aviso) | Cada aviso pendiente se intenta unas 6 veces durante la caída: 5,4 veces más llamadas a un proveedor caído |
| Llamadas en el primer segundo después de que vuelve el proveedor | ≈ 4 | 195 (la carga normal es de 30) | Ráfaga de reintentos: es la falla nueva que trae la táctica. El medidor la cuenta desde la versión sin táctica, para poder comparar |
| Reentregas del broker con la falla | 66 | 3.040 | El broker carga con el calendario de reintentos |
| Estado guardado en disco | 0 bytes | 22.200 bytes por 600 avisos (37 por aviso) | El registro crece sin límite si no se limpia |
| p95 del aviso sin la falla | 48 ms | 48 ms | Consultar y escribir el registro no se nota: el p95 es el mismo antes y después |
| Código | 282 líneas (`src/` y `test/`) | 38 líneas agregadas y 9 eliminadas, en 2 archivos | `git diff --shortstat sin-tactica con-tactica -- src/notificador` |

**Fallas nuevas que pueden aparecer**

- **Duplicado residual.** Si el notificador cae entre que el proveedor acepta y el registro se escribe, la reentrega vuelve a enviar. La ventana es de milisegundos; cerrarla del todo exige que el proveedor acepte una clave de idempotencia.
- **Ráfaga al volver.** 195 llamadas en el primer segundo, contra 30 de la carga normal. Crece con los avisos pendientes, y en producción la carga sigue durante la caída: cada segundo que el proveedor tarde en volver suma pendientes. Podría tumbar otra vez al proveedor; la mitigación siguiente es sumarle a la espera un componente aleatorio (jitter).
- **Registro que crece.** 37 bytes por aviso, sin límite; necesita una política de retención, por ejemplo borrar los ids de más de 7 días.
- **Aviso tardío.** Un aviso que sale 4 s después puede llegar cuando el destinatario ya leyó el mensaje; se podría consultar si ya se leyó antes de enviarlo.
- **Duplicado con réplicas o con una reentrega en vuelo.** El notificador comprueba el registro y luego envía, sin marcar el aviso «en curso», y el registro es un fichero local de cada instancia. Con dos réplicas del notificador, o si el broker reentrega mientras el primer envío sigue en vuelo, salen dos avisos. El broker en memoria de la prueba no puede provocarlo; con RabbitMQ sí.
- **El reinicio no está probado.** Guardar el registro en disco se justifica por el reinicio del notificador, pero la prueba borra el estado al empezar y no reinicia el notificador a mitad. Y sin `fsync`, la última línea escrita puede perderse en una caída.
- **Reenvío sin fin si falla el registro.** Si escribir en el registro falla después de que el proveedor aceptó, el notificador no confirma y el broker reentrega, una y otra vez.
- **En RabbitMQ, la espera de reintento no es gratis.** El broker en memoria de la prueba reentrega con la espera que le pide el notificador; en RabbitMQ eso exige colas con tiempo de vida y reenvío a otra cola (dead-letter), o un plugin de mensajes diferidos: una pieza de configuración más que operar.

## Cómo se verifica que funciona

- `npm run test:falla` pasa. Su condición de éxito es la medida del escenario: 0 perdidos, 0 duplicados y p95 ≤ 10 s desde que vuelve el proveedor.
- `npm test` sigue pasando sin la falla, con el mismo p95 de 48 ms.
- El rojo sigue a la vista: `git checkout sin-tactica` y `npm run test:falla`.
- El costo se repite con `npm run medir` en las dos etiquetas. Las alternativas se reproducen cambiando `ESPERA_TOPE_MS` a `Infinity` (sin tope) o `ESPERA_INICIAL_MS` a `0` (reintento inmediato) en `src/notificador/notificador.js`.
- En operación: la edad del aviso pendiente más viejo (alarma si pasa de 10 s con el proveedor sano), los reintentos por minuto y los duplicados que reporte el proveedor en su webhook de resultado.

**Lo que la prueba no cubre**

La prueba reproduce un proveedor que responde 503 durante 20 s y un broker que repite mensajes. Con otro modo de falla, el código actual se comporta así:

| Modo de falla | Qué pasaría con el código actual | Qué haría falta |
|---|---|---|
| La caída dura más | Con 60 s de caída la prueba sigue pasando (0 perdidos, 0 duplicados, p95 de 3,8 s), pero las llamadas al proveedor casi se triplican: de ≈ 3.576 a ≈ 9.588 (15,98 por aviso), y las reentregas del broker pasan de 3.040 a 9.056. Se reproduce cambiando `PROVEEDOR_CAIDO_MS` a 60000 en `config/falla.env`. Si dura horas, los avisos se reintentan cada 4 s sin fin | Un tope de edad (por ejemplo, 24 h) con una cola de mensajes muertos y una alarma |
| El proveedor se cuelga en vez de responder 503 | `proveedor.enviar` no tiene tiempo máximo de espera: el aviso se queda esperando, sin confirmar ni reintentarse, y la prueba lo contaría como no entregado | Un timeout en el puerto, por ejemplo de 2 s: sumado al tope de 4 s, un aviso pendiente seguiría saliendo antes de 10 s |
| El proveedor acepta el aviso pero no lo entrega | El notificador lo registra como enviado y T2 impide reenviarlo: se pierde sin que nadie lo note | Consumir el webhook «Resultado de la entrega», que ya está en la vista de contenedores, y reintentar los rechazados |
| El broker cae antes de que el chat publique MensajeNuevo | El aviso se pierde antes de llegar al notificador; ninguna de las dos tácticas lo alcanza | Un outbox en el chat, como el que el ADR-001 pone en el catálogo |

El escenario que sigue sin prueba es QA-1 (M2): que un artículo vendido salga de la búsqueda en ≤ 5 s aunque los eventos lleguen repetidos o desordenados. Está en la verificación del ADR-001.

Las cifras se midieron en un portátil Dell con Windows 11 y Node.js 24.20.0, con `npm run medir` (mediana de tres corridas por configuración) en las etiquetas `sin-tactica` y `con-tactica`; las alternativas, con la configuración con la falla sobre `con-tactica`. Los totales de llamadas son las llamadas por aviso que imprime el medidor × 600. En otro equipo los p95 y las cifras de las alternativas pueden variar bastante; los perdidos, los duplicados y la ráfaga casi no cambian.
