# Cocina en comunidad

Aplicación modular para coordinar la cocina de la iglesia. Interfaz en español, calendario mensual, reservas por sector, responsable y contacto, servicio de comida o uso físico, comensales, observaciones, edición y cancelación. Plan de cocina imprimible con estado de preparación. Nombre de iglesia y sectores editables.

## Datos y acceso

Las reservas y la configuración se guardan en D1 compartido. La publicación inicial es privada para el propietario; habilitar acceso a los miembros desde la configuración de acceso de Sites antes de usarla en equipo. Los miembros con acceso a esta versión pueden modificar todas las reservas y la configuración. No hay roles diferenciados en esta versión.

Las reservas ocupan un horario dentro de un mismo día. La prevención de superposición se aplica en un solo INSERT o UPDATE SQL para evitar carreras entre solicitudes simultáneas. Los horarios incluyen preparación y limpieza. La edición restablece el estado de preparación. La lista del mes se actualiza cada 30 segundos o manualmente.

## Estructura y crecimiento

- app/page.tsx: vistas Calendario, Para cocina y Configuración.
- app/api/reservations: operaciones de reservas.
- app/api/settings: configuración compartida.
- lib/reservations.ts: acceso a datos, validación y protección de solicitudes.
- db/schema.ts y drizzle/: esquema y migraciones.

Viajes misioneros es una ampliación futura, aún no implementada. Agregar un módulo separado con tablas de viajes, zonas y responsables, sus propias rutas de interfaz y API. Mantener los identificadores de las entidades independientes de sus nombres editables. Las migraciones publicadas deben permanecer inmutables; las ampliaciones requieren nuevas migraciones.

## Desarrollo

El starter usa Vinext/React y Cloudflare Workers. Los comandos habituales son npm run dev, npm run build, npm run db:generate. Las migraciones de previsualización se aplican con Wrangler de forma local; Sites aplica las migraciones de producción al publicar. El manifest .openai/hosting.json identifica el mismo Site para futuras actualizaciones.

## Reservas mensuales

En Nueva reserva, activar Repetir mensualmente y elegir posición (primer, segundo, tercer, cuarto, quinto o último), día de semana y fecha de finalización. Se muestra la lista de fechas antes de guardar. El inicio y final se incluyen; la primera ocurrencia es la primera fecha del patrón igual o posterior al inicio. Los meses sin un quinto día de semana se omiten. Máximo de 60 meses por serie.

La serie se materializa en reservas individuales con un identificador compartido. Un único INSERT SQL, con candidatos materializados, comprueba todos los cruces y guarda todas las fechas o ninguna. No necesita una tarea programada. Las fechas quedan disponibles en todos los calendarios de mes inmediatamente después de guardar.

Al editar o cancelar una reserva de serie se puede elegir solo esa fecha o todas las fechas restantes en la base, incluidas las pasadas. Editar toda la serie modifica los datos y horarios conservando las fechas. La edición individual permite excepciones. Si el nuevo horario produce un cruce, no se actualiza ninguna reserva. La cancelación individual elimina esa ocurrencia y no se vuelve a generar.

Validación: cálculo de segundo y quinto domingo, último día de semana, año bisiesto, inicio parcial, límites y fechas inválidas; API local con concurrencia, cruces sin cambios parciales, edición individual/serie, cancelación individual/serie y configuración intacta.

## Mes por medio y meses elegidos

Repetir evento permite Todos los meses, Mes por medio (cada dos meses desde el mes de inicio) y Elegir meses (meses concretos con su año). Los meses sin marcar se omiten. Los botones permiten marcar todos, desmarcar todos o seleccionar meses alternos. Elegir meses comienza sin selección para evitar reservas no deseadas.

Día o fin de semana permite un día individual o Sábado y domingo. Para ambos días se toma el sábado correspondiente a la posición elegida en el mes y el domingo siguiente. El domingo puede pertenecer al mes siguiente; se incluyen solamente fechas dentro del período. El horario y cantidad de personas se aplican por día. Las reservas de ambos días comparten la misma serie y las mismas comprobaciones de conflictos.

repeat_rule guarda el patrón completo sin cambiar los campos existentes. Las series anteriores conservan su comportamiento y la ampliación solo agrega una columna nullable. La selección de meses se hace al crear una serie; editar una serie existente conserva las fechas ya reservadas.

## Reservas compartidas y almanaques

Una reserva puede incluir de 1 a 12 sectores. sectors_json guarda la lista; sector conserva una etiqueta compatible con versiones anteriores. Las reservas antiguas sin lista se interpretan como un solo sector. El filtro de sector incluye las comidas compartidas. Los comensales representan el total de todos los sectores, sin duplicar la reserva ni su cantidad.

Almanaque / JPG abre una vista mensual (A4 horizontal) o anual (A4 vertical). Un dibujo de calendario en canvas produce un JPG de alta resolución y la misma imagen se imprime dentro de una página con tamaño A4 y márgenes de 10 mm. El mensual incluye horarios, sectores y cantidades, con hasta dos reservas por día y un indicador de reservas adicionales. El anual muestra los 12 meses, días ocupados y cantidad de reservas por día. No incluye contactos ni observaciones personales.

Descargar JPG permite adjuntar la imagen a WhatsApp. Compartir JPG usa la función de compartir archivos del dispositivo cuando está disponible; no envía mensajes automáticamente. La consulta anual usa el mismo índice por fecha y datos compartidos que la vista mensual.


Viajes Misioneros es un módulo independiente: almacena fecha, lugar, hermanos asignados y observaciones en tablas propias, sin afectar disponibilidad ni comensales de cocina. La nómina y los lugares se editan por ID; desactivar los oculta de nuevas asignaciones y conserva el historial. Los cambios de nombre se reflejan también en atenciones existentes. Cada módulo tiene su almanaque mensual/anual A4 y JPG. Estadísticas generales reúne por año y mes las reservas y atenciones como actividades, y presenta comensales y asignaciones de hermanos por separado. La migración 0004 solo agrega tablas e índice; las listas iniciales están vacías.
La carga inicial conserva las localidades existentes; 0006 consolida exclusivamente los dos duplicados generados de Neuquén y Cutral Có, reasignando sus atenciones al registro previo con tilde.

El catálogo ofrece Eliminar y Recuperar. active=-1 identifica registros eliminados recuperables, conservando los nombres y referencias de atenciones pasadas; las nuevas asignaciones solo admiten active=1. El desplegable de hermanos agrega uno o varios seleccionados y permite quitarlos antes de guardar.

Viajes Misioneros incluye una planilla mensual de fines de semana: localidades en filas y fechas de sábados y domingos del mes en columnas. Permite todas las localidades o una sola, A4 horizontal y JPG. Las atenciones de lunes a viernes permanecen en Calendario y se avisa si quedaron fuera; los textos largos se abrevian para mantener una hoja. No incluye contactos ni observaciones.

La planilla de fines de semana incluye las observaciones completas al pie, numeradas y vinculadas a sus celdas. Incluye también notas de atenciones entre semana del período seleccionado. Reserva espacio para ellas en la misma A4; si no caben completas, solicita seleccionar una localidad o acortar los textos en lugar de omitir información.

## Uso móvil e instalación
Vista Semana en ambos módulos, predeterminada en pantallas de hasta 700 px. Consulta todas las fechas de lunes a domingo y carga los dos meses cuando corresponde. Mantiene filtros, observaciones y selección del día. Navegación inferior con cinco módulos y áreas táctiles amplias. Manifest e iconos para acceso instalado; el botón Instalar aplicación ofrece el aviso del navegador cuando está disponible e instrucciones de Android/iPhone. Requiere conexión y conserva el acceso actual de ChatGPT; no almacena datos privados sin conexión. Los usuarios propios y permisos todavía no están implementados y requieren resolver la autenticación independiente y el acceso de alojamiento antes de habilitarlos.
