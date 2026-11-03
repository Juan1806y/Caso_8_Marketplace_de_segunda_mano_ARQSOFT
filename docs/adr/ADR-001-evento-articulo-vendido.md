# ADR-001: Retirar del índice, cerrar los demás chats y avisar a los interesados van por evento

Estado: aceptado
Proyecto: Marketplace de segunda mano · Grupo 8
Escenarios que lo motivan: QA-1 (M2: un vendido sale de la búsqueda en ≤ 5 s y ningún resultado muestra un vendido de hace más de 60 s), QA-3 (aviso al servicio de notificaciones en ≤ 10 s; la visión añade que quede pendiente y nunca se pierda, Pregunta 7) y QA-2 (costo)

## Contexto

La plataforma solo conecta a comprador y vendedor; la venta y la entrega ocurren en persona. «Vendido» es una declaración del vendedor (RF-07), y cuando la hace varias piezas deben enterarse: el índice de búsqueda, que es una pieza distinta de la base (ADR-000); el chat, que es una unidad desplegable aparte (Pregunta 6); y los compradores interesados en el artículo. Ninguna de esas piezas comparte transacción con el catálogo. El flujo completo, con la decisión paso por paso, está en `docs/flujo-marcar-vendido.md`.

## Decisión

El backend responde al vendedor cuando el artículo queda marcado como vendido en la base; ese es el paso síncrono del flujo, junto con la búsqueda del comprador y el envío del mensaje, que se confirma cuando queda guardado (paso 2 del flujo). Retirar el artículo del índice, cerrar el chat de los demás compradores interesados y avisarles que el artículo ya se vendió se hacen después, consumiendo el evento ArticuloVendido desde un broker. Es una coreografía: el backend publica el hecho y cada consumidor reacciona por su cuenta, porque son reacciones independientes entre sí.

- **El evento no se pierde (outbox).** El cambio de estado y el evento se escriben en la misma transacción de la base, en una tabla outbox. Un publicador del backend lee el outbox, entrega el evento al broker y solo lo marca como publicado cuando el broker lo confirma. Si el broker está caído, el evento espera en la base.
- **La compensación es reactivar.** Si el vendedor marcó vendido por error, reactiva la publicación: eso publica ArticuloReactivado y el artículo vuelve al índice. Los chats cerrados no se reabren solos; el comprador puede escribir de nuevo.
- **El aviso de mensaje nuevo sigue la misma regla.** Si el destinatario está ausente, el chat publica `MensajeNuevo` en el mismo broker y el notificador lo consume. El notificador **confirma al broker solo cuando el proveedor aceptó el aviso**; si falla, no confirma y el broker lo vuelve a entregar (reintento del ADR-003). Es el camino que implementa y prueba la Parte B del segundo previo. El chat todavía no tiene outbox: si cae entre guardar el mensaje y publicar, el aviso se pierde (ADR-003, «Lo que no cubre»).
- **Consumidores idempotentes y por versión.** Cada evento lleva la versión del artículo. El indexador aplica el estado de mayor versión y no el último que llega, así vendido y reactivado pueden llegar repetidos o desordenados sin dejar mal el índice. El notificador descarta los avisos repetidos con un registro de ids, como quedó implementado y medido en el ADR-003.

## Alternativas consideradas

**A. Hacer todo síncrono (descartada).** Habríamos tenido una pieza menos, ningún broker y la certeza de que, cuando el vendedor ve «marcado como vendido», el artículo ya salió de la búsqueda, los demás chats están cerrados y todos fueron avisados. A cambio, marcar vendido dependería de que el índice, el chat y el proveedor de notificaciones estuvieran arriba al mismo tiempo. Una caída del chat impediría marcar vendido, y el artículo seguiría apareciendo en búsqueda mientras tanto, que es peor que el desfase de 5 s que QA-1 acepta. Además contradice QA-3, que exige que el aviso quede pendiente cuando el proveedor cae, y deshace la separación del chat que decidimos en la Pregunta 6.

**B. Sondeo de la base, sin broker (descartada).** El indexador, el chat y el notificador consultarían cada pocos segundos una tabla de cambios. Ganábamos una pieza menos que operar, que es lo que QA-2 premia. Pero para cumplir los 5 s de QA-1, cada consumidor tendría que consultar al menos cada 2 o 3 s: entre 28.800 y 43.200 consultas diarias por consumidor, casi todas vacías, sobre la misma base que atiende la publicación y la moderación. Cada consumidor nuevo suma otra consulta periódica, y cada uno tiene que guardar por su cuenta hasta dónde leyó.

**C. Publicar directo al broker después de guardar, sin outbox (descartada).** Es más simple: guardar y luego publicar. Pero son dos escrituras sin transacción común: si el broker falla justo después de que la base confirma, el artículo queda vendido y el evento no sale. Seguiría apareciendo en la búsqueda hasta que la reconciliación periódica de la Pregunta 7 lo notara, y eso rompe la medida de QA-1 de que ningún resultado muestre un vendido de hace más de 60 s.

## Consecuencias

- Una pieza más que operar, el broker, para un equipo pequeño. Es costo, y QA-2 acota cómo se gasta (ADR-000, D2).
- Una tabla outbox y su publicador: si el publicador se detiene, los eventos se acumulan en la base. La alarma de desfase de la Pregunta 7 (60 s) debe medir también la antigüedad del evento más viejo del outbox.
- Consistencia eventual: durante unos segundos un artículo vendido puede seguir apareciendo en búsqueda (hasta 5 s, según QA-1) y sus chats pueden seguir abiertos, así que alguien puede escribirle al vendedor en ese intervalo.
- Cuando el vendedor ve «marcado como vendido», todavía no sabe si los interesados fueron avisados.
- Los consumidores deben ser idempotentes porque el broker entrega al menos una vez, y la memoria de lo ya procesado (ids de aviso, estado de cada chat) hay que persistirla. En el notificador, la deduplicación quedó implementada y medida en el ADR-003 (66 duplicados → 0); que el registro sobreviva a un reinicio no está probado (ADR-003, «Fallas nuevas»).
- Los eventos tienen que llevar la versión del artículo para que el orden de llegada no importe.
- Un error del vendedor corregido rápido produce dos avisos seguidos a los interesados, y el aviso no tiene compensación: una vez enviado no se retira. Por eso es el último paso del flujo.

## Verificación

- **Probado (Parte B del segundo previo, ADR-003), en el camino `MensajeNuevo`:** con el proveedor de notificaciones caído y el broker entregando dos veces, el notificador no pierde ni duplica avisos; `npm run test:falla` pasa.
- **Sin prueba automatizada todavía:** el camino al índice, es decir, que un vendido salga de la búsqueda en ≤ 5 s aunque ArticuloVendido y ArticuloReactivado lleguen repetidos o desordenados. Se probaría con un adaptador simulado del índice que reciba eventos fuera de orden.
- **En operación:** la antigüedad del evento más viejo del outbox y el desfase de la cola del indexador, con alarma a los 60 s (Pregunta 7).
