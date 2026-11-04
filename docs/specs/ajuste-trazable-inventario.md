# SPEC — Ajuste trazable de inventario tras conteo físico

- **Estado:** aprobada como especificación funcional para la primera versión.
- **Prioridad sugerida:** P1.
- **Usuario principal:** voluntario o coordinador con cuenta activa.
- **Esquema:** primera versión sin cambios de esquema ni campos nuevos.

## 1. Contexto y problema

El inventario usa `lots.quantityAvailable` como saldo actual. Las operaciones existentes actualizan esa cantidad y registran movimientos en `movements`, pero no se encontró una acción para conciliar el saldo con un conteo físico.

Una diferencia entre el almacén y el saldo registrado puede llevar a preparar entregas con cantidades incorrectas y dificulta explicar el estado real de un lote. Para corregirlo con trazabilidad, el sistema debe registrar la diferencia como un movimiento nuevo, sin alterar los anteriores.

## 2. Objetivo de la funcionalidad

Permitir que un voluntario activo o coordinador activo registre la cantidad física de un lote elegible. Antes de guardar, la interfaz mostrará el stock anterior, el conteo, la diferencia y su consecuencia sobre el inventario.

Al confirmar, el servidor validará el lote y la cantidad vigente, actualizará el saldo al conteo físico y registrará el movimiento de ajuste en una única transacción.

## 3. Usuario principal y necesidades

**Usuario principal:** voluntario activo que participa en un conteo físico y puede tener poca experiencia tecnológica.

Necesita:

- encontrar el lote contado;
- reconocer con facilidad el stock que indica el sistema y su unidad;
- ingresar lo que observó físicamente;
- explicar una diferencia;
- revisar el efecto antes de confirmar;
- entender si el cambio se guardó o si debe volver a contar.

La coordinación necesita que el historial identifique quién realizó el ajuste, cuándo y por qué.

## 4. Alcance funcional

Incluye:

- Iniciar un conteo desde el detalle de un lote disponible o agotado, siempre que no esté reservado, descartado ni vencido.
- Mostrar el stock actual del sistema, el conteo físico y la unidad.
- Calcular la diferencia como **conteo físico menos stock anterior**.
- Exigir una explicación cuando exista una diferencia.
- Mostrar una pantalla de confirmación con:
  - stock anterior;
  - conteo físico;
  - diferencia con signo y unidad;
  - consecuencia: stock final esperado.
- No registrar ni modificar nada si no hay diferencia.
- Confirmar mediante una operación atómica que actualice `lots.quantityAvailable` e inserte un movimiento `ajuste`.
- Incluir en `movements.reason` la explicación, el stock anterior y el conteo físico, con un máximo de 500 caracteres para el texto completo.
- Proteger el guardado con bloqueo del lote y comparación contra el stock esperado enviado al abrir el conteo.
- Si un lote elegible queda con cantidad cero, conservar su estado almacenado y mostrarlo como **“Agotado”** según la cantidad disponible.
- Si un lote `distribuido` queda con cantidad física positiva, cambiarlo a `disponible`, siempre que no esté vencido ni descartado.
- No reactivar lotes descartados o vencidos.
- Mostrar el nuevo movimiento en el historial existente del lote.

## 5. Fuera de alcance

- Cambiar o borrar movimientos anteriores.
- Cambiar la cantidad recibida originalmente (`quantityReceived`).
- Usar `quantityReceived` como máximo permitido para el conteo o el saldo ajustado.
- Crear tablas o campos nuevos, incluida una clave de idempotencia, en esta primera versión.
- Contar varios lotes en una sola operación.
- Cambiar los flujos de donaciones, entregas, descartes o correcciones.
- Sincronización offline, exportación de informes y notificaciones.
- Cambiar autenticación o roles existentes.
- Ajustar lotes reservados, descartados o vencidos.
- Guardar un movimiento cuando el conteo coincida con el stock vigente.

## 6. Flujo de usuario paso a paso

1. El voluntario activo abre el detalle de un lote disponible o agotado.
2. La pantalla muestra el producto, código, estado, stock vigente y unidad.
3. Selecciona **“Registrar conteo físico”**.
4. Ingresa la cantidad observada. Puede ingresar cero.
5. Si el conteo difiere del stock, explica el motivo.
6. La pantalla de confirmación muestra stock anterior, conteo físico, diferencia y stock que quedará.
7. Si no hay diferencia, el sistema informa que no hay cambios que guardar y no permite crear un movimiento vacío.
8. El voluntario confirma el ajuste.
9. El servidor comprueba la sesión y autorización, bloquea y vuelve a leer el lote, y compara el stock vigente con el stock anterior que se mostró al usuario.
10. Si el stock cambió, el sistema no aplica el conteo obsoleto y pide revisar el lote y volver a contar.
11. Si las validaciones pasan, se actualizan saldo y movimiento dentro de la misma transacción.
12. La interfaz muestra una confirmación y el movimiento aparece en el historial del lote.

## 7. Reglas de negocio y validaciones

1. **Fuente del stock:** el saldo actual es `lots.quantityAvailable`; no se calcula sumando los movimientos. Las acciones existentes actualizan ese saldo y registran movimientos por separado.
2. **Cálculo:** `diferencia = conteo físico − stock anterior`.
3. **Movimiento:** `movements.quantity` guarda la diferencia con signo: positiva si aumenta el saldo y negativa si lo reduce.
4. **Saldo final:** tras un ajuste válido, `lots.quantityAvailable` debe ser igual al conteo físico y nunca negativo.
5. **Cantidad recibida:** `lots.quantityReceived` no es un límite para el conteo ni para el saldo resultante.
6. **Estados elegibles:** permitir lotes con estado almacenado `disponible` o `distribuido`, siempre que no estén vencidos ni descartados. Rechazar `reservado`, `descartado` y `vencido`.
7. **Lote agotado:** el estado almacenado se conserva si el conteo final es cero. La interfaz debe mostrar la etiqueta textual “Agotado” cuando `quantityAvailable` sea cero, sin inferirla únicamente del color.
8. **Lote distribuido con cantidad positiva:** si el conteo es positivo y el lote no está vencido ni descartado, actualizar su estado a `disponible`.
9. **Validación numérica:** las columnas PostgreSQL `numeric` no declaran precisión o escala, pero el esquema Drizzle las convierte a `number` de JavaScript. Por tanto, se necesita un límite aplicativo compatible con esa conversión.
10. **Límite técnico provisional:** aceptar cantidades finitas, no negativas, de hasta dos decimales y no mayores que **35.184.372.088.832**. Este tope es provisional y debe comprobarse en implementación con la representación y conversión numérica reales. No es un máximo de negocio ni depende de `quantityReceived`.
11. **Aritmética de cantidades:** validar y calcular usando centésimas enteras después de validar la entrada, para reducir errores de redondeo binario. Antes de implementar debe comprobarse el comportamiento en los límites y con decimales frecuentes.
12. **Motivo:** exigir explicación si hay diferencia. El texto completo persistido —explicación, stock anterior, conteo y unidades— no puede exceder 500 caracteres. El texto de explicación debe truncarse o rechazarse con un mensaje claro si no cabe junto a los valores.
13. **Formato de `reason`:** guardar una cadena con explicación, stock anterior, conteo y unidades, por ejemplo: `Conteo físico: diferencia por envase roto; stock anterior: 12,5 unidades; conteo: 10 unidades`.
14. **Sin diferencia:** comparar con el saldo vigente bajo bloqueo. Si el conteo coincide, no actualizar el lote ni insertar un movimiento.
15. **Autorización:** usar `requireVolunteer()` en servidor. La comprobación existente acepta cualquier voluntario o coordinador con cuenta activa; no restringir por rol en esta funcionalidad.
16. **Concurrencia:** bloquear el lote dentro de la transacción y comparar `quantityAvailable` vigente con el stock anterior recibido. Si no coincide, abortar sin modificar saldo ni historial.
17. **Reintentos:** la primera versión no añade una clave de idempotencia ni modifica el esquema. La protección cubre los reintentos habituales mediante el bloqueo de fila y la comparación del stock esperado. No garantiza deduplicación absoluta en todos los escenarios, por ejemplo, si el stock cambia y vuelve al mismo valor anterior.
18. **Atomicidad:** actualización del lote e inserción del movimiento deben confirmarse o revertirse juntas.
19. **Historial:** no se modifican ni eliminan movimientos previos.
20. **Vencimiento:** el ajuste no puede cambiar a disponible un lote vencido. La elegibilidad debe comprobar tanto el estado almacenado como la fecha de vencimiento, conforme a la regla que se acuerde en implementación.

## 8. Criterios de aceptación numerados y verificables

### CA-1 — Cantidades y estados elegibles
**Dado** un lote `disponible` o `distribuido` no reservado, descartado ni vencido, **cuando** el voluntario abre la acción de conteo, **entonces** puede iniciar el flujo aunque el stock sea cero.

### CA-2 — Lotes no elegibles
**Dado** un lote `reservado`, `descartado` o `vencido`, **cuando** se intenta iniciar o enviar un ajuste, **entonces** el servidor lo rechaza y no cambia stock ni historial.

### CA-3 — Pantalla de confirmación
**Dado** un conteo con diferencia, **cuando** el voluntario termina de ingresar los datos, **entonces** la pantalla muestra claramente el stock anterior, conteo físico, diferencia con signo y unidad, y stock que quedará antes de guardar.

### CA-4 — Motivo obligatorio
**Dado** un conteo distinto del stock vigente, **cuando** se intenta confirmar sin una explicación no vacía, **entonces** el servidor rechaza la operación y no cambia el lote ni el historial.

### CA-5 — Conteo de cero
**Dado** un lote elegible con stock positivo, **cuando** el voluntario ingresa cero y un motivo válido, **entonces** el saldo final es cero, el estado almacenado no cambia y la interfaz muestra “Agotado”.

### CA-6 — Conteo por encima de lo recibido
**Dado** un lote cuyo conteo físico supera `quantityReceived`, **cuando** se registra una cantidad que no excede el límite técnico provisional, **entonces** no se rechaza solo por superar la cantidad recibida.

### CA-7 — Límite técnico y precisión
**Dado** un conteo negativo, no finito, con más de dos decimales o por encima del límite técnico provisional, **cuando** se envía al servidor, **entonces** se rechaza sin modificar el saldo ni insertar un movimiento.

### CA-8 — Sin diferencia
**Dado** que el conteo físico es igual al saldo vigente bloqueado, **cuando** el voluntario confirma, **entonces** se informa que no hay cambios y no se actualiza el lote ni se registra un movimiento.

### CA-9 — Detección de stock obsoleto
**Dado** que otra operación cambia el stock después de abrir el formulario, **cuando** se confirma el conteo basado en el saldo anterior, **entonces** el servidor lo rechaza, no registra movimientos y pide volver a revisar el lote.

### CA-10 — Reintento de un ajuste
**Dado** que un envío se guardó, **cuando** se repite usando el stock anterior del primer intento, **entonces** la comparación del stock esperado debe rechazarlo cuando el saldo haya cambiado y no aplicar dos veces el ajuste. La interfaz informa que el stock ya no coincide o que se debe revisar el lote.  
**Límite conocido:** esta comprobación no garantiza deduplicación absoluta en todos los escenarios; la primera versión no persiste una clave de idempotencia.

### CA-11 — Atomicidad
**Dado** un ajuste válido, **cuando** se produce un error al guardar el saldo o el movimiento, **entonces** ambos cambios se revierten; no queda un ajuste parcial.

### CA-12 — Registro del movimiento
**Dado** un ajuste exitoso, **cuando** se abre el historial del lote, **entonces** aparece un movimiento de tipo `ajuste` con diferencia con signo, autor, fecha y motivo que incluye stock anterior y conteo físico, dentro del límite de 500 caracteres.

### CA-13 — Conservación del historial
**Dado** que el lote ya tenía movimientos previos, **cuando** se registra el ajuste, **entonces** esos movimientos siguen intactos y aparecen junto al nuevo movimiento.

### CA-14 — Autorización en servidor
**Dado** un usuario sin sesión o con cuenta inactiva, **cuando** intenta guardar un ajuste, **entonces** el servidor lo rechaza. **Dado** un voluntario activo o coordinador activo, **cuando** los datos son válidos, **entonces** puede completar la operación.

### CA-15 — Estado tras un conteo positivo
**Dado** un lote con estado `distribuido` y conteo físico positivo, **cuando** se confirma el ajuste, **entonces** el saldo se actualiza y el estado pasa a `disponible` si el lote no está vencido ni descartado.

### CA-16 — Estado conservado al quedar agotado
**Dado** un lote elegible que queda con cantidad cero, **cuando** se confirma el ajuste, **entonces** conserva su estado almacenado y se muestra como “Agotado” en función de su cantidad disponible.

## 9. Métricas de éxito

Los valores siguientes son **objetivos propuestos**, no resultados ya alcanzados ni medidos. El repositorio revisado no contiene un evento de analítica específico para ajustes; el tiempo de uso requerirá medirlo en pruebas de usabilidad o instrumentar una medición aprobada.

| Métrica | Fórmula | Objetivo propuesto |
|---|---|---|
| Integridad de los ajustes | Ajustes confirmados con saldo y movimiento guardados conjuntamente ÷ ajustes confirmados × 100 | 100% |
| Trazabilidad completa | Movimientos de ajuste con autor, fecha, diferencia y motivo que contiene stock anterior y conteo ÷ movimientos de ajuste × 100 | 100% |
| Prevención de saldo negativo | Ajustes confirmados que dejan saldo negativo ÷ ajustes confirmados × 100 | 0% |
| Tiempo de registro | Tareas de conteo completadas en 2 minutos o menos ÷ total de tareas observadas × 100 | ≥90% en prueba piloto |
| Reintentos duplicados | Reintentos habituales del mismo envío que crean más de un movimiento ÷ reintentos habituales observados × 100 | 0% en las pruebas de reintento cubiertas |

La métrica de reintentos mide la protección habitual por comparación de stock; no implica una garantía de deduplicación absoluta, ya que no se persiste un identificador de solicitud en esta versión.

## 10. Casos límite y errores

- **Lote inexistente:** informar que no se encuentra y no guardar cambios.
- **Lote reservado, descartado o vencido:** rechazar y explicar que su estado no permite el ajuste.
- **Lote agotado:** permitir abrir el conteo si no está reservado, descartado ni vencido.
- **Conteo cero:** aceptarlo si el lote es elegible y hay motivo para la diferencia; conservar su estado y mostrarlo como agotado.
- **Conteo idéntico al saldo vigente:** no guardar movimiento; mostrar “No hay diferencias que guardar”.
- **Motivo vacío o demasiado extenso:** indicar el problema y no guardar.
- **Motivo completo superior a 500 caracteres:** rechazar antes de guardar; explicar que se debe resumir la causa.
- **Cantidad negativa, no finita, con decimales excesivos o superior al límite técnico provisional:** rechazar junto al campo.
- **Saldo obsoleto:** cancelar la operación y pedir que se vuelva a revisar o contar.
- **Reintento de un envío guardado:** la comparación con el stock esperado debe bloquear el reintento habitual; no hay garantía absoluta de deduplicación sin una clave persistida.
- **Error durante la transacción:** mostrar que el ajuste no se guardó y no afirmar éxito.
- **Conteo positivo sobre lote distribuido:** ponerlo disponible solo si no está vencido ni descartado.
- **Problema de conexión:** informar que el resultado no pudo confirmarse; al reintentar, volver a validar el saldo, no reutilizar ciegamente una diferencia calculada antes.

## 11. Datos necesarios y tablas involucradas

No se proponen cambios a los datos existentes para representar el conteo:

- **`lots`:** `id`, `code`, `name`, `unit`, `quantityAvailable`, `quantityReceived` y `status`. `quantityAvailable` es el saldo de partida y el campo que recibirá el conteo final; `quantityReceived` no será un límite.
- **`movements`:** `lotId`, `type`, `quantity`, `reason`, `createdBy` y `createdAt`. `type` ya contempla `ajuste`; `quantity` guardará la diferencia; `reason` contendrá explicación, stock anterior y conteo, con máximo 500 caracteres.
- **Autorización:** la sesión del usuario y `volunteers.active` se comprueban con la lógica existente del servidor.

No se añadirá una clave de idempotencia ni otra estructura de datos en esta primera versión.

## 12. Riesgos técnicos y consideraciones de seguridad

- El saldo es un valor almacenado, no un agregado calculado de movimientos; ambos deben actualizarse juntos.
- Las columnas `numeric` no declaran precisión o escala, mientras que Drizzle las lee como `number` de JavaScript. El límite provisional debe comprobarse en implementación antes de depender de él.
- El máximo propuesto, **35.184.372.088.832**, y la precisión de dos decimales deben probarse en su representación y conversión numérica, especialmente cerca del límite y con decimales comunes.
- Se recomienda hacer las validaciones y cálculos en centésimas enteras para reducir errores de redondeo; hay que verificar conversión de entrada y salida entre centésimas y `number`.
- El bloqueo con `FOR UPDATE` y la comparación del saldo esperado protegen contra escrituras concurrentes y reintentos habituales, pero no garantizan deduplicación absoluta si el valor del stock vuelve a coincidir con el original.
- El servidor debe autorizar cada operación; ocultar botones en la interfaz no es una medida de permiso suficiente.
- El estado `distribuido` representa actualmente un lote entregado por completo. Reactivarlo al encontrar stock físico es una regla intencional de esta funcionalidad.
- El estado “Agotado” se deriva de la cantidad disponible, no es un estado almacenado dedicado. La vista de detalle debe mostrar ese texto de manera consistente.
- El sistema tiene una lógica de alertas que puede permitir distribuir ciertos productos con fecha pasada tras una revisión humana. Antes de implementar, debe aclararse cómo reconciliar esa regla con el requisito de no ajustar lotes vencidos y cómo distinguir caducidad de consumo preferente. El ajuste no debe reactivar por sí solo lotes vencidos.
- La operación depende de la conexión al backend y PostgreSQL. No funciona offline.
- Los motivos deben describir el conteo y evitar datos personales innecesarios.
- La interfaz debe estar en español, usar etiquetas persistentes, controles grandes, foco visible, contraste suficiente y comunicar estados con texto, no solo color.

## 13. Pruebas manuales propuestas

1. Ajustar un lote disponible a una cantidad menor; verificar saldo y movimiento negativo.
2. Ajustar un lote disponible a una cantidad mayor que la recibida; verificar que `quantityReceived` no lo bloquea.
3. Ajustar un lote distribuido agotado a una cantidad positiva; verificar saldo actualizado y estado `disponible` si no está vencido ni descartado.
4. Contar cero con motivo; verificar saldo cero, estado almacenado conservado y etiqueta “Agotado”.
5. Contar la misma cantidad que el saldo actual; verificar que no aparece movimiento.
6. Omitir el motivo o enviar uno inválido; verificar rechazo sin cambios.
7. Probar motivo completo de 500 caracteres y otro de más de 500; verificar aceptación y rechazo, respectivamente.
8. Probar valor negativo, no numérico, no finito, con más de dos decimales y sobre el tope técnico provisional; verificar rechazo.
9. Intentar ajustar lotes reservados, descartados y vencidos; verificar rechazo.
10. Abrir el formulario, cambiar el lote por otra operación y luego confirmar; verificar conflicto y ausencia de cambios por el intento obsoleto.
11. Reenviar una solicitud ya exitosa; verificar que el stock esperado obsoleto bloquea el reintento habitual y no duplica el ajuste en ese escenario.
12. Verificar los límites numéricos propuestos y la conversión de valores con decimales a centésimas y de vuelta.
13. Provocar un error en la operación transaccional; verificar que no persiste solo el saldo o solo el movimiento.
14. Revisar el historial tras un ajuste y comprobar autor, fecha, diferencia, motivo, stock anterior y conteo físico.
15. Usar cuentas activas de voluntario y coordinador; verificar que ambas pueden ajustar. Repetir con cuenta inactiva y sin sesión; verificar rechazo.
16. Comprobar que la vista de inventario y el detalle muestran “Agotado” cuando `quantityAvailable` es cero, aunque el estado almacenado se conserve.

## 14. Dependencias con funcionalidades existentes

- La autorización se apoya en `requireVolunteer()` de [`lib/session.ts`](../../lib/session.ts); permite voluntarios y coordinadores activos.
- La escritura debe seguir el patrón transaccional de bloqueo de fila usado por [`app/actions/lots.ts`](../../app/actions/lots.ts).
- El stock y los movimientos se definen en [`lib/db/schema.ts`](../../lib/db/schema.ts).
- El historial del lote se carga en [`lib/queries.ts`](../../lib/queries.ts) y ya muestra tipo, cantidad, motivo, autor y fecha.
- La vista de lote reconoce el tipo `ajuste`, pero actualmente solo presenta las acciones del lote cuando su alerta no es “cerrado”. Para contar agotados habrá que habilitar un punto de entrada apropiado en [`app/(app)/inventario/[id]/page.tsx`](../../app/(app)/inventario/[id]/page.tsx).
- El detalle actual muestra una etiqueta “Sin existencias” para el estado cerrado; la funcionalidad debe asegurar que la etiqueta legible “Agotado” también esté disponible, aunque el estado almacenado no cambie.

## Advertencias técnicas que deben comprobarse durante la implementación

1. Probar la representación y conversión numérica del límite provisional y de cantidades con hasta dos decimales antes de usarlo como validación definitiva.
2. Confirmar la regla para determinar que un lote está vencido, considerando la fecha, el estado almacenado y la lógica existente de revisión humana.
3. Verificar que la vista del lote permite iniciar conteos agotados y representa “Agotado” de acuerdo con `quantityAvailable`.
4. Probar la comparación del stock esperado con concurrencia realista; la protección de esta versión cubre reintentos habituales, no deduplicación absoluta.
