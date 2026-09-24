# ADR-000 — Atributos de calidad rectores y frontera del sistema

**Proyecto:** Marketplace de segunda mano · Grupo 8 — Arquitectura de Software, UFPS 2026-II
**Estado:** Propuesto · **Fecha:** 9 de septiembre de 2026
**Ámbito:** todo el sistema; vinculante para los ADR posteriores

**Autores:** Sarith Valentina Parada Ramón (1152253), Juan David Ortiz Cano (1152298), Alison Brigitte Martinez Machado (1152299), Maria Fernanda Corzo Castro (1152300), Jorge Andres Forero Serrano (1152328), Viviana Katherine Ortiz Gafaro (1152331)

## 1. Contexto

**El negocio.** Se trata de una plataforma regional de compraventa de artículos usados: 200.000 publicaciones activas como objetivo del primer año, de 3 a 10 fotos cada una, sobre un inventario que no se queda quieto. El producto no es el catálogo, es el encuentro entre comprador y vendedor: alguien ve algo cerca, escribe, negocia y cierra. Solo dos piezas hacen posible ese encuentro, una búsqueda que responda en menos de un segundo y un chat donde se negocie, y una tercera lo sostiene: la moderación. La plataforma es gratuita y la monetización llega después; los usuarios están mayoritariamente en móvil con datos limitados; el equipo de moderación es pequeño; y el contenido de las conversaciones es privado.

**Qué está en juego si funciona mal.** Un marketplace es una red de dos lados que vive de su liquidez, y cada falla la ataca por un flanco distinto.

- **Búsqueda lenta o desactualizada:** el comprador no encuentra, o escribe por algo vendido ayer, y se va; sin compradores, el vendedor deja de publicar donde nadie mira. El círculo se cierra solo y hacia abajo, y recuperar la liquidez perdida cuesta mucho más que construirla.
- **Chat que pierde mensajes o los entrega tarde:** se rompe el único mecanismo de conversión que existe. Aquí no hay carrito ni pasarela a la que caerse.
- **Costo por usuario sin techo:** el millón largo de imágenes se come la infraestructura de un producto que todavía no factura. No es una ineficiencia técnica: es una pista de despegue que se acaba antes de despegar.
- **Moderación que no alcanza, o filtración de una conversación:** se erosiona la confianza, que en una plataforma donde dos desconocidos quedan de verse es literalmente el producto.

**El problema del método.** Llegamos a la entrega con adjetivos en lugar de atributos: «rápido», «seguro», «que escale». Un atributo sin apellido no permite escribir una medida, y sin medida hay un deseo, no un escenario (Bass et al., 2021). Este ADR fija el orden: primero el escenario, después el patrón, y usa el formato de registro de decisión de arquitectura, que existe para que la razón de una decisión sobreviva a quien la tomó (Nygard, 2011).

## 2. Decisión

Adoptamos tres atributos de calidad rectores, cada uno con su apellido y su medida, como único criterio de arbitraje de las decisiones arquitectónicas del proyecto; fijamos entre ellos un orden de prelación; y declaramos de forma explícita qué atributos no rigen el diseño.

### D1 · Los tres que mandan

| Cód. | Atributo | Medida | Por qué manda |
|---|---|---|---|
| QA-1 | Rendimiento: latencia de la búsqueda del catálogo (p95, en el cliente móvil) bajo consistencia eventual acotada del índice | p95 ≤ 1.000 ms y p99 ≤ 2.000 ms en hora pico sobre 200.000 publicaciones activas. Frescura: alta o cambio de precio visible en ≤ 30 s (p95); baja por venta en ≤ 5 s (p95) y ningún resultado con un artículo vendido hace más de 60 s | Es la función por la que entra el comprador y obliga a la decisión más cara de revertir: índice y base de datos como piezas distintas. La frescura es el trade-off rendimiento contra consistencia escrito como número, y es asimétrica a propósito: aparecer tarde cuesta una venta demorada; desaparecer tarde cuesta un mensaje a alguien que ya vendió |
| QA-2 | Eficiencia de costo: costo de infraestructura de imágenes por usuario activo mensual y datos servidos por sesión | ≤ 300 KB por pantalla de 20 resultados y ≤ 900 KB por ficha con 10 fotos; ≤ 25 MB por usuario activo al mes; ≤ USD 0,002 mensuales por usuario activo y ≤ 60 % del costo total de infraestructura; cero imágenes huérfanas con más de 30 días | Con más de un millón de imágenes, plataforma gratuita y usuarios con datos limitados, el costo deja de ser nota al pie del área financiera y pasa a ser propiedad medible del sistema. Se apoya en la eficiencia de desempeño y la utilización de recursos de la ISO/IEC 25010 (ISO e IEC, 2023) |
| QA-3 | Confiabilidad del chat: durabilidad de los mensajes aceptados y latencia de entrega extremo a extremo | 0 mensajes perdidos tras confirmar el envío; entrega al destinatario conectado con p95 ≤ 500 ms; aviso al servicio de notificaciones en ≤ 10 s si el destinatario está ausente; 100 % del historial recuperable | Es el único punto del sistema donde se pierde algo que no se puede reconstruir. Un resultado desactualizado se corrige con la siguiente consulta; un mensaje perdido es una negociación perdida y una promesa rota al usuario |

### D2 · Prelación cuando compiten: QA-3 > QA-1 > QA-2

Ninguna optimización de búsqueda justifica arriesgar la durabilidad de un mensaje, y ninguna economía justifica incumplir el segundo de la búsqueda. Pero QA-2 no es simplemente «el que pierde»: acota el cómo, no el qué. Una solución que satisface QA-1 y QA-3 pero rompe QA-2 no es una solución cara: es una solución rechazada.

### D3 · Lo que explícitamente no manda

Si todo es prioridad alta, nadie prioriza. La confidencialidad de las conversaciones entra como restricción de obligado cumplimiento, no como driver: no admite grados y por eso no sirve para arbitrar. La modificabilidad importa (llegarán requisitos nuevos, incluidos componentes de IA), pero hoy no sabemos por qué eje va a cambiar el sistema; la atendemos con una regla barata: mantener costosas de revertir solo las decisiones que este ADR nombra, y baratas todas las demás. La disponibilidad del catálogo entra como requisito de servicio del 99,5 % mensual. Usabilidad, antifraude y escalabilidad futura son requisitos y trabajo de producto, no ejes de arbitraje en esta fase.

### D4 · Regla de método

Ningún patrón entra al proyecto sin un escenario previo que lo obligue, y todo ADR posterior cita el escenario que lo motiva. Todo atributo se escribe con apellido: «seguridad», como confidencialidad, integridad o disponibilidad; «rendimiento», con su punto de medición y su percentil.

### D5 · Frontera del sistema

Comprende publicación, búsqueda, chat, favoritos, reputación y moderación. Sus interlocutores son tres personas (vendedor, comprador y moderador) y un solo sistema externo: el servicio de notificaciones push y correo. El índice de búsqueda, el almacenamiento de imágenes y la cola de moderación son partes internas, no actores; no hay pasarela de pagos en el alcance.

## 3. Alternativas consideradas

| Alternativa | Por qué la descartamos | Costos |
|---|---|---|
| A. Dirigir por disponibilidad y seguridad (el reflejo por defecto) | Ninguna explica las decisiones caras de este caso, y un atributo que no se puede perder no sirve para arbitrar porque nunca cede: por eso la confidencialidad quedó como restricción | Redundancia y controles mientras el índice, el chat y las imágenes quedaban sin criterio |
| B. Dirigir por consistencia fuerte del catálogo: indexar dentro de la misma transacción que la publicación | Convierte cada alta en una escritura distribuida, acopla la disponibilidad de publicar a la del buscador y degrada justo lo que el caso pide proteger | Perder el segundo de latencia bajo carga y la capacidad de publicar con el índice caído, a cambio de una exactitud que el usuario no percibe. El costo de la opción que sí tomamos es el simétrico, y está escrito en la frescura de QA-1 |
| C. Declarar cinco o seis rectores (rendimiento, disponibilidad, seguridad, modificabilidad, usabilidad, costo) | Si todo es prioridad alta, nadie prioriza. Es la alternativa que más tranquiliza al escribirla y la que más cuesta al ejecutarla | Cuando dos de ellos chocan (y chocan) no habría criterio escrito, y decidiría quien hablara más fuerte en la reunión |
| D. Dirigir por modificabilidad y time-to-market: salir rápido y rehacer después | Correcta para las decisiones baratas, y por eso la adoptamos en D3 para todo lo que no está en QA-1 a QA-3. No sirve como rectora porque la sincronización índice-inventario y la frontera del chat son las decisiones caras de revertir | Velocidad ahora y, después, migrar 200.000 publicaciones y un historial de conversaciones con usuarios encima |

## 4. Consecuencias

**Lo que mejora.** Toda decisión posterior tiene un criterio de arbitraje escrito y una medida contra la cual verificarse: a «la búsqueda es rápida» ahora se le responde «¿según quién?» y hay respuesta. Las cuatro preguntas abiertas del caso quedan asignadas a ADR concretos, y el costo entra al diseño como propiedad medible desde el día uno.

**Lo que empeora, y aceptamos a sabiendas.**

- **Mostrar información desactualizada.** Hasta 30 s una publicación nueva no aparece; hasta 5 s una vendida sigue apareciendo. Habrá compradores que escriban por algo ya vendido: el producto necesita un mensaje para ese caso, y soporte, saberlo esperado y no un defecto.
- **Entregar una imagen peor que la que subió el vendedor.** A 15 KB por miniatura el detalle fino no se aprecia en el listado, y algunos vendedores lo leerán como que la plataforma les estropea las fotos.
- **Complejidad operativa que un equipo pequeño tendrá que sostener.** Un índice separado obliga a medir el desfase, a armarlo y a mantener la indexación. Sin eso, el presupuesto de frescura es una frase y el sistema mentiría sin saberlo.
- **La modificabilidad no queda protegida por diseño.** Habrá refactorizaciones que un diseño dirigido por ella habría evitado. Es una apuesta consciente, con fecha de revisión: la llegada del primer requisito nuevo.
- **Este ADR no decide nada técnico.** No dice qué motor de búsqueda, ni cómo se despliega, ni por dónde viaja un mensaje. Su valor es acotar el espacio de esas decisiones; si los ADR siguientes no lo citan, no habrá servido para nada.

**Verificación y revisión.** QA-1 se mide con telemetría en el cliente sobre la hora pico (no sobre el promedio diario) y con la marca de tiempo del evento contra su aparición en resultados, con alarma cuando el desfase de la cola supera 60 s; QA-2, por versión con una prueba sintética en un dispositivo de referencia y mensualmente dividiendo la facturación entre los usuarios activos; QA-3, comparando mensajes confirmados contra entregados. Este ADR se revisa con la llegada del primer requisito nuevo, o ante el incumplimiento sostenido de cualquiera de las tres medidas durante dos semanas. Las cifras de inventario, fotos y latencia vienen del caso; las de tráfico, costo y volumen de datos son supuestos del equipo declarados en los escenarios, y deben validarse con la plataforma.

## Referencias

- Bass, L., Clements, P., y Kazman, R. (2021). *Software architecture in practice* (4.ª ed.). Addison-Wesley.
- International Organization for Standardization e International Electrotechnical Commission. (2023). *ISO/IEC 25010:2023*.
- Nygard, M. T. (15 de noviembre de 2011). *Documenting architecture decisions* [Publicación en blog]. Cognitect.
