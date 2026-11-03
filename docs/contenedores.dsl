workspace "Marketplace de segunda mano" {
  model {
    vendedor = person "Vendedor" "Publica, ajusta precio, conversa y marca vendido"
    comprador = person "Comprador" "Busca, guarda favoritos, conversa, califica y reporta"
    moderador = person "Moderador" "Resuelve reportes y la cola de revisión, sanciona y gestiona listas de bloqueo"

    marketplace = softwareSystem "Marketplace de segunda mano" {
      backend = container "Backend (monolito modular)" "Catálogo, Búsqueda, Favoritos, Reputación y Moderación; publica los eventos del outbox" "Node.js"
      db = container "Base de datos" "Inventario, favoritos, reputación, reportes, cola de moderación y outbox" "PostgreSQL" "Database"
      broker = container "Broker" "Guarda los eventos hasta que alguien los procese" "RabbitMQ"
      indexador = container "Indexador" "Mantiene el índice al día con el inventario" "Worker del monolito"
      indice = container "Índice de búsqueda" "Copia de lectura del inventario" "OpenSearch" "Database"
      revisor = container "Revisor de publicaciones" "Reglas, modelo de lenguaje y guardrails antes de publicar (ADR-002)" "Worker del monolito"
      notificador = container "Notificador" "Entrega avisos: mensaje nuevo, artículo vendido y resultado de la revisión; reintenta y no duplica con un registro local de avisos enviados (ADR-003)" "Worker del monolito"
      chat = container "Servicio de chat" "Unidad aparte: conversaciones, presencia e historial, guardados en su propio almacén" "Node.js, WebSocket"
    }

    notificaciones = softwareSystem "Servicio de notificaciones" "Push y correo" "Externo"
    modelo = softwareSystem "Proveedor del modelo de lenguaje" "Clasifica el texto de una publicación" "Externo"

    vendedor -> backend "Publica, ajusta precio y marca vendido" "HTTPS, síncrono"
    comprador -> backend "Busca, guarda favoritos, califica y reporta" "HTTPS, síncrono"
    moderador -> backend "Revisa la cola priorizada y dicta retiros y sanciones" "HTTPS, síncrono"
    vendedor -> chat "Conversa con los interesados" "WebSocket"
    comprador -> chat "Conversa con el vendedor" "WebSocket" "EscenarioQA3"
    moderador -> chat "Lee una conversación solo con reporte de por medio" "HTTPS, síncrono"

    backend -> db "Estado y outbox en una misma transacción" "SQL, síncrono"
    backend -> indice "Búsqueda con filtros (corte a 600 ms)" "HTTPS, síncrono"
    backend -> broker "Publica desde el outbox PublicacionCreada, PublicacionEditada, PublicacionAprobada y PublicacionRetirada (decisiones del moderador), ArticuloVendido y ArticuloReactivado" "AMQP, asíncrono" "Asincrono"
    chat -> broker "Publica MensajeNuevo si el destinatario está ausente" "AMQP, asíncrono" "Asincrono,EscenarioQA3"

    broker -> revisor "Entrega PublicacionCreada y PublicacionEditada" "al menos una vez" "Asincrono"
    revisor -> modelo "Clasifica el texto de la publicación" "HTTPS, síncrono, timeout 8 s y 1 reintento"
    revisor -> db "Guarda la decisión y encola en moderación" "SQL, síncrono"
    revisor -> broker "Publica PublicacionAprobada" "AMQP, asíncrono" "Asincrono"
    broker -> indexador "Entrega PublicacionAprobada (también con precio nuevo), PublicacionRetirada, ArticuloVendido y ArticuloReactivado" "al menos una vez" "Asincrono"
    broker -> chat "Entrega ArticuloVendido para cerrar los demás chats" "al menos una vez" "Asincrono"
    broker -> notificador "Entrega ArticuloVendido, MensajeNuevo y el resultado de la revisión (PublicacionAprobada o PublicacionRetirada)" "al menos una vez" "Asincrono,EscenarioQA3"

    indexador -> indice "Actualiza o retira el artículo según su versión" "HTTPS, síncrono"
    notificador -> db "Consulta a quién avisar" "SQL, síncrono"
    notificador -> notificaciones "Envía el aviso; si falla, reintenta con espera creciente" "HTTPS, síncrono" "EscenarioQA3"
    notificaciones -> notificador "Resultado de la entrega" "HTTPS, webhook"
    notificaciones -> vendedor "Mensaje nuevo, resultado de la revisión, aviso de moderación" "Push / correo" "EscenarioQA3"
    notificaciones -> comprador "Mensaje nuevo, el artículo ya se vendió" "Push / correo"
  }

  views {
    container marketplace "Contenedores" "Vista de contenedores; en rojo, el camino del escenario QA-3" {
      include vendedor comprador moderador
      include backend chat db broker indexador indice revisor notificador
      include notificaciones modelo
      autoLayout lr
    }

    dynamic marketplace "EscenarioQA3" "Camino del escenario QA-3: aviso al destinatario ausente con el proveedor caído" {
      comprador -> chat "Escribe al vendedor ausente; el chat guarda y confirma"
      chat -> broker "Publica MensajeNuevo"
      broker -> notificador "Entrega MensajeNuevo, al menos una vez"
      notificador -> notificaciones "Envía el aviso; si responde 503, no confirma y reintenta (0,5 s, 1 s, 2 s, 4 s)"
      notificaciones -> vendedor "Push o correo: mensaje nuevo"
      autoLayout lr
    }

    styles {
      element "Person" {
        shape Person
        background #08427b
        color #ffffff
      }
      element "Container" {
        background #1168bd
        color #ffffff
      }
      element "Database" {
        shape Cylinder
      }
      element "Externo" {
        background #999999
        color #ffffff
      }
      relationship "Relationship" {
        dashed false
      }
      relationship "Asincrono" {
        dashed true
      }
      relationship "EscenarioQA3" {
        color #d6292b
        thickness 4
      }
    }
  }
}
