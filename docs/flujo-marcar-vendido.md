# Flujo: marcar un artículo como vendido

Actividad por grupos «del flujo al patrón» · Grupo 8 · Marketplace de segunda mano

La plataforma solo conecta a comprador y vendedor. La venta y la entrega se acuerdan por el chat y ocurren en persona; no hay pagos ni entregas gestionadas por la plataforma. Por eso el flujo del grupo no es una compra: es el camino desde que el comprador ve un artículo hasta que el vendedor lo marca como vendido (RF-07) y el sistema cierra el ciclo con los demás interesados.

## Paso 1. El flujo

| # | Paso | Quién lo hace |
|---|---|---|
| 1 | El comprador revisa un producto | Comprador, a través del buscador |
| 2 | El comprador contacta al vendedor e inicia la negociación del artículo por chat | Comprador, a través del servicio de chat |
| 3 | El vendedor marca el artículo como vendido para retirarlo del índice de búsqueda | Vendedor, a través del catálogo |
| 4 | El sistema cierra el chat de los demás compradores interesados | Servicio de chat |
| 5 | El sistema avisa a los compradores interesados que el artículo ya se vendió | Servicio de notificaciones |

## Paso 2. Decisión paso por paso

| Paso | Quién | Síncrono o evento | Si falla | Si se repite |
|---|---|---|---|---|
| 1. Comprador revisa un producto | Comprador / Buscador | Síncrono | Solo es lectura, no hay nada que compensar | Se vuelve a leer el catálogo; no cambia nada |
| 2. Comprador contacta al vendedor | Comprador / Chat | Evento | No se confirma el envío y el aviso queda retenido en la cola; no se guardó nada que haya que deshacer | Se generaría un mensaje duplicado; el mensaje necesita idempotencia por su id |
| 3. Vendedor marca el artículo como vendido | Vendedor / Catálogo | Síncrono | No cambia nada y el vendedor reintenta | Un artículo ya vendido sigue vendido; idempotente por el estado del artículo |
| 4. El sistema cierra el chat | Servicio de chat | Evento | Los chats siguen abiertos un rato, hasta que el evento se procese | Cerrar un chat dos veces no cambia nada |
| 5. El sistema avisa a los compradores | Servicio de notificaciones | Evento | Los avisos quedan pendientes en la cola, no se pierden | Los avisos no se duplican porque se usa el id del aviso |

## Notas sobre la tabla

- **Los pasos síncronos son los que el usuario necesita ver terminados.** El comprador necesita el resultado de la búsqueda para seguir (Pregunta 7 del cuestionario) y el vendedor necesita saber que su artículo quedó marcado como vendido.
- **Lo demás es consecuencia de marcar vendido, no parte de ello.** Retirar el artículo del índice, cerrar los chats y avisar a los interesados van por evento. En la Pregunta 6 ya habíamos anticipado que «marcar como vendido y cerrar los chats abiertos de ese artículo» deja de ser una operación atómica al tener el chat en su propia unidad, y que hay que resolverla por eventos.
- **El aviso no tiene compensación.** Un aviso enviado no se puede retirar. Por eso va de último, después de que el artículo ya quedó marcado como vendido.
- **El artículo tarda un poco en salir de la búsqueda.** El índice se actualiza por cola (Pregunta 7) con un presupuesto de frescura de ≤ 5 s (p95) para la baja por venta (QA-1). En ese intervalo alguien todavía puede escribirle al vendedor.
