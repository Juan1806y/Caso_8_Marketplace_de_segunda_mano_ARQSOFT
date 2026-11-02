# Escenario QA-3 · El aviso al destinatario ausente

Es el escenario de calidad que probamos en la Parte B del segundo previo. Sale de QA-3 del ADR-000 (confiabilidad del chat), el primero en nuestra prelación: QA-3 > QA-1 > QA-2.

## Por qué este y no otro

- **Es el que más pesa en el ADR-000.** La regla D2 dice que ninguna optimización de búsqueda justifica arriesgar la durabilidad de un mensaje. Un resultado desactualizado se corrige con la siguiente consulta; un aviso perdido no se reconstruye.
- **Protege una función esencial.** F4 (avisar al destinatario ausente) existe porque una negociación entre dos personas que rara vez están conectadas a la vez muere sin el aviso.
- **Su falla se reproduce a voluntad.** El proveedor externo de notificaciones puede no estar disponible, y el broker entrega al menos una vez (ADR-001).
- **Los descartados.** QA-1 (búsqueda y frescura) va segundo en la prelación y su error se corrige con la siguiente consulta. QA-2 (costo de imágenes) se mide por mes y no tiene una falla que se reproduzca en una prueba de minutos.

## Las seis partes

| Parte | Contenido |
|---|---|
| Fuente | El servicio de notificaciones push y correo (sistema externo) |
| Estímulo | No está disponible durante 20 s (responde 503) mientras los compradores escriben a vendedores ausentes |
| Artefacto | El camino del aviso: servicio de chat, broker y notificador |
| Entorno | Hora pico, con 30 mensajes por segundo a destinatarios ausentes. El broker entrega al menos una vez (ADR-001): en la prueba, 1 de cada 10 confirmaciones se pierde y el mensaje vuelve a llegar |
| Respuesta | El chat guarda y confirma cada mensaje; el aviso queda pendiente, se reintenta y sale una sola vez cuando el proveedor vuelve |
| Medida | 0 avisos perdidos y 0 avisos duplicados (conteos exactos), y p95 ≤ 10 s entre el regreso del proveedor y la entrega de cada aviso pendiente |

## De dónde sale cada número

| Número | Origen |
|---|---|
| 0 avisos perdidos | Función esencial F4 y Pregunta 7 de `vision.md` («el aviso al ausente tiene que quedar pendiente, nunca perdido»); QA-3 del ADR-000 |
| 0 avisos duplicados | Paso 6 de `flujo-marcar-vendido.md`: los avisos no se duplican porque se usa el id del aviso |
| ≤ 10 s | QA-3 del ADR-000: aviso al servicio de notificaciones en ≤ 10 s si el destinatario está ausente. Con el proveedor caído, se cuenta desde que vuelve |
| 30 mensajes por segundo | Supuesto del equipo. El caso habla de «miles de conversaciones simultáneas»: tomamos 3.000 conversaciones activas en hora pico, un mensaje por conversación cada 60 s y el 60 % de los destinatarios ausentes. 3.000 ÷ 60 × 0,6 = 30 por segundo |
| 20 s de caída | Supuesto de la prueba: alcanza para acumular 600 avisos pendientes. La medida no depende de cuánto dure la caída |
| 1 de cada 10 confirmaciones perdida | Mecanismo de la prueba para reproducir la entrega «al menos una vez», como en el acto 4 del laboratorio |

**Ventana de medición:** los 20 s de caída más los 10 s siguientes al regreso del proveedor; la prueba espera 2 s más de margen para contar.

## Cómo se prueba

- `npm test` corre el escenario sin la falla.
- `npm run test:falla` lo corre con la falla.

La condición de éxito es la medida: son las tres comprobaciones de `test/escenario-qa3.test.js`.
