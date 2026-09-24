# ADR-001: Retirar del índice, cerrar los demás chats y avisar a los interesados van por evento

Estado: borrador
Proyecto: Marketplace de segunda mano · Grupo 8
Escenarios que lo motivan: QA-1 (frescura de la búsqueda), QA-3 (confiabilidad del chat), QA-2 (costo)

## Contexto

La plataforma solo conecta a comprador y vendedor; la venta y la entrega ocurren en persona. «Vendido» es una declaración del vendedor (RF-07), y cuando la hace varias piezas deben enterarse: el índice de búsqueda, que es una pieza distinta de la base (ADR-000); el chat, que es una unidad desplegable aparte (Pregunta 6); y los compradores interesados en el artículo. Ninguna de esas piezas comparte transacción con el catálogo.

## Decisión

El backend responde al vendedor cuando el artículo queda marcado como vendido en la base; ese es el paso síncrono del flujo, junto con la búsqueda del comprador. Retirar el artículo del índice, cerrar el chat de los demás compradores interesados y avisarles que el artículo ya se vendió se hacen después, consumiendo el evento ArticuloVendido desde un broker. Los consumidores son idempotentes y el indexador aplica el estado más reciente por versión, no por orden de llegada.

## Alternativa descartada: hacer todo síncrono

Habríamos tenido una pieza menos, ningún broker y la certeza de que, cuando el vendedor ve «marcado como vendido», el artículo ya salió de la búsqueda, los demás chats están cerrados y todos fueron avisados. A cambio, marcar vendido dependería de que el índice, el chat y el proveedor de notificaciones estuvieran arriba al mismo tiempo. Una caída del chat impediría marcar vendido, y el artículo seguiría apareciendo en búsqueda mientras tanto, que es peor que el desfase de 5 s que QA-1 acepta. Además contradice QA-3, que exige que el aviso quede pendiente cuando el proveedor cae, y deshace la separación del chat que decidimos en la Pregunta 6.

## Consecuencias

- Una pieza más que operar, el broker, para un equipo pequeño. Es costo que QA-2 mira con lupa.
- Consistencia eventual: durante unos segundos un artículo vendido puede seguir apareciendo en búsqueda (hasta 5 s, según QA-1) y sus chats pueden seguir abiertos, así que alguien puede escribirle al vendedor en ese intervalo.
- Cuando el vendedor ve «marcado como vendido», todavía no sabe si los interesados fueron avisados.
- Los consumidores deben ser idempotentes porque el broker entrega al menos una vez, y la memoria de lo ya procesado (ids de aviso, estado de cada chat) hay que persistirla.
- El aviso a los interesados no tiene compensación: una vez enviado no se retira. Por eso es el último paso del flujo.
