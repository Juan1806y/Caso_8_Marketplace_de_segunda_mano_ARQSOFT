workspace "Marketplace de segunda mano" {
  model {
    vendedor = person "Vendedor" "Publica, ajusta precio, conversa y marca vendido"
    comprador = person "Comprador" "Busca, guarda favoritos, conversa, califica y reporta"
    moderador = person "Moderador" "Resuelve reportes, sanciona y gestiona listas de bloqueo"

    marketplace = softwareSystem "Marketplace de segunda mano" {
      backend = container "Backend (monolito modular)" "Catálogo, Búsqueda, Favoritos, Reputación y Moderación" "Node.js"
      db = container "Base de datos" "Inventario, favoritos, reputación y reportes" "PostgreSQL" "Database"
      broker = container "Broker" "Guarda los eventos hasta que alguien los procese" "RabbitMQ"
      indexador = container "Indexador" "Mantiene el índice al día con el inventario" "Worker del monolito"
      indice = container "Índice de búsqueda" "Copia de lectura del inventario" "OpenSearch" "Database"
      notificador = container "Notificador" "Entrega avisos: mensaje nuevo, artículo vendido" "Worker del monolito"
      chat = container "Servicio de chat" "Unidad aparte: conversaciones, presencia e historial" "Node.js, WebSocket"
    }

    notificaciones = softwareSystem "Servicio de notificaciones" "Push y correo" "Externo"

    vendedor -> backend "Publica, ajusta precio y marca vendido" "HTTPS, síncrono"
    comprador -> backend "Busca, guarda favoritos, califica y reporta" "HTTPS, síncrono"
    moderador -> backend "Revisa la cola priorizada y dicta retiros y sanciones" "HTTPS, síncrono"
    vendedor -> chat "Conversa con los interesados" "WebSocket"
    comprador -> chat "Conversa con el vendedor" "WebSocket"
    moderador -> chat "Lee una conversación solo con reporte de por medio" "HTTPS, síncrono"

    backend -> db "Guarda el estado del artículo" "SQL, síncrono"
    backend -> indice "Búsqueda con filtros (corte a 600 ms)" "HTTPS, síncrono"
    backend -> broker "Publica cambios de inventario y ArticuloVendido" "AMQP, asíncrono" "Asincrono"
    chat -> broker "Publica MensajeNuevo si el destinatario está ausente" "AMQP, asíncrono" "Asincrono"

    broker -> indexador "Entrega cambios de inventario" "al menos una vez" "Asincrono"
    broker -> chat "Entrega ArticuloVendido para cerrar los demás chats" "al menos una vez" "Asincrono"
    broker -> notificador "Entrega ArticuloVendido y MensajeNuevo" "al menos una vez" "Asincrono"

    indexador -> indice "Actualiza o retira el artículo" "HTTPS, síncrono"
    notificador -> db "Consulta a quién avisar" "SQL, síncrono"
    notificador -> notificaciones "Envía el aviso" "HTTPS, síncrono"
    notificaciones -> notificador "Resultado de la entrega" "HTTPS, webhook"
    notificaciones -> vendedor "Mensaje nuevo, aviso de moderación" "Push / correo"
    notificaciones -> comprador "Mensaje nuevo, el artículo ya se vendió" "Push / correo"
  }

  views {
    container marketplace {
      include vendedor comprador moderador
      include backend chat db broker indexador indice notificador
      include notificaciones
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
    }
  }
}
