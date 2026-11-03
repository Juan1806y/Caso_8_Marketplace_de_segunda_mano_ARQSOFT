# Marketplace de segunda mano · Grupo 8

Arquitectura de Software · UFPS · 2026-II · Ing. Daniel Andres Esteban

Plataforma regional de compraventa de artículos usados que conecta a compradores y vendedores de la misma zona; la venta y la entrega ocurren en persona, fuera del sistema.

## Segundo previo: el escenario que probamos

Elegimos **QA-3, el aviso al destinatario ausente**. Con el proveedor de notificaciones caído 20 s y el broker entregando al menos una vez, ningún aviso se pierde ni se duplica, y los pendientes salen en ≤ 10 s (p95) desde que el proveedor vuelve. Va antes que QA-1 y QA-2 porque es el primero en la prelación del ADR-000 y protege la función esencial F4: un aviso perdido no se reconstruye, mientras que una búsqueda desactualizada se corrige con la siguiente consulta y el costo de QA-2 se mide por mes. El escenario en seis partes, el origen de cada número y la ventana están en [docs/escenario-qa3.md](docs/escenario-qa3.md).

Táctica y costo: [ADR-003](docs/adr/ADR-003-reintento-e-idempotencia-del-aviso.md) · Modelo de lenguaje: [ADR-002](docs/adr/ADR-002-revision-previa-de-publicaciones.md) · Patrón: [ADR-001](docs/adr/ADR-001-evento-articulo-vendido.md). Lo que queda pendiente está al final del ADR-003 y en la verificación del ADR-001.

## Cómo correr la prueba

Requisito: Node.js 20.6 o superior; no hay dependencias que instalar.

| Comando | Qué hace |
|---|---|
| `npm test` | Corre el escenario sin la falla |
| `npm run test:falla` | Corre el escenario con la falla: proveedor caído 20 s y 1 de cada 10 confirmaciones perdida |
| `npm run medir` | Mide el costo, sin la falla y con ella |

Para ver la prueba en rojo, antes de la táctica: `git checkout sin-tactica` y `npm run test:falla`. Se vuelve con `git checkout main`.

## Video de sustentación

Enlace pendiente: se agrega cuando el video esté en YouTube (oculto).

## Quién hizo qué

| Integrante | Código | Parte del video | En el repositorio |
|---|---|---|---|
| Viviana Katherine Ortiz Gafaro | 1152331 | 1 · El escenario | `docs/escenario-qa3.md` |
| Sarith Valentina Parada Ramón | 1152253 | 2 · El ADR-002 | ADR-002 y vista de contenedores |
| Jorge Andres Forero Serrano | 1152328 | 3 · La prueba fallando | Código del camino y prueba del escenario |
| Juan David Ortiz Cano | 1152298 | 4 · La táctica | Reintento e idempotencia en el notificador |
| Maria Fernanda Corzo Castro | 1152300 | 5 · El costo | Medición y ADR-003 |
| Alison Brigitte Martinez Machado | 1152299 | 6 · Lo pendiente | ADR-001 final, flujo, visión y este README |

## Documentación

[Visión del sistema](docs/vision.md) · [ADR-000](docs/adr/ADR-000-atributos-y-frontera.md) · [Flujo](docs/flujo-marcar-vendido.md) · [Vista de contenedores](docs/contenedores.dsl) (imagen: `docs/contenedores.png`, exportada desde playground.structurizr.com; en rojo, el camino del escenario)

Para trabajar en el repositorio (convenciones, pendientes, sincronización con el Drive y agentes): [docs/00-INDEX.md](docs/00-INDEX.md).
