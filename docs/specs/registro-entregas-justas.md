# Spec — Registro inteligente de entregas y distribución justa

- Estado: propuesta validada para prototipo
- Prioridad: P0
- Usuario principal: voluntario del banco de alimentos
- Problema de negocio: entregas sin registro provocan duplicaciones y exclusión; el inventario no siempre descuenta correctamente los lotes.

## 1. Definición del problema

Jorge coordina un banco de alimentos con voluntarios rotativos y recursos limitados. Actualmente no existe un registro confiable de quién recibió qué alimentos ni cuándo. Esto genera conflictos y dificulta saber qué familias siguen pendientes. Además, si la entrega no se conecta con el inventario, pueden ofrecerse alimentos que ya no están disponibles o dejar sin salida lotes próximos a vencer.

## 2. Objetivo

Permitir que un voluntario registre una entrega en pocos pasos, comprobando la elegibilidad de la familia durante el periodo de reparto, la disponibilidad real de los productos y la prioridad FEFO (primero sale el lote con vencimiento más próximo). Al confirmar, el sistema debe guardar el movimiento y descontar el inventario de forma consistente.

## 3. Alcance del feature

### Incluye
- Listado de familias activas y estado de atención en el periodo.
- Periodo de reparto configurable en días; valor inicial: 30 días.
- Aviso visible si una familia ya recibió ayuda en el periodo.
- Excepción autorizada con motivo obligatorio.
- Selección de producto y cantidad a entregar.
- Descuento automático de lotes por FEFO.
- Exclusión de lotes vencidos.
- Rechazo de cantidades superiores al stock disponible.
- Historial de entregas con fecha, familia, producto, cantidad y voluntario.
- Datos de demostración para probar el flujo.

### No incluye
- Autenticación real ni roles multiusuario.
- Sincronización entre dispositivos o trabajo offline.
- Registro completo de donaciones, gestión de proveedores o recibos fiscales.
- Algoritmo que decida automáticamente cuánto necesita cada hogar.
- Envío de notificaciones.

## 4. Diseño de la solución

### Flujo principal
1. El voluntario selecciona una familia activa.
2. La interfaz muestra si está pendiente o si ya recibió ayuda durante los últimos 30 días.
3. Si ya recibió ayuda, solo se permite continuar activando una excepción y escribiendo un motivo.
4. El voluntario selecciona un producto y una cantidad.
5. El sistema calcula el stock utilizable, excluyendo lotes vencidos, y muestra la prioridad de salida.
6. Al confirmar, el sistema valida nuevamente elegibilidad, excepción, motivo y stock.
7. La cantidad se descuenta de los lotes disponibles en orden FEFO.
8. Se registra una entrega con fecha, voluntario, familia y detalle de los lotes consumidos.
9. La interfaz actualiza el estado de la familia, el inventario y el historial.

### Reglas de negocio
- Una familia está pendiente si no tiene una entrega dentro del periodo configurado.
- Una familia atendida no se bloquea ante una necesidad excepcional; la excepción requiere motivo.
- El stock utilizable de un lote es cero si su fecha de vencimiento es anterior a la fecha actual.
- Si no hay fecha de vencimiento, el lote no se incluye en la asignación automática FEFO del prototipo; debe revisarse manualmente.
- Los lotes con fecha conocida se consumen primero por fecha ascendente; en empate, por fecha de recepción ascendente.
- No se permite confirmar una cantidad mayor al stock utilizable.
- La operación se valida completa antes de modificar existencias.
- Las entregas no se eliminan desde la interfaz.

## 5. Criterios de aceptación verificables

### CA-1 — Estado de atención de la familia
**Dado** que existe un periodo de reparto de 30 días, **cuando** el voluntario selecciona una familia, **entonces** la interfaz muestra “Pendiente” si no tiene entregas en ese periodo y “Ya recibió ayuda” si tiene al menos una.

### CA-2 — Excepción justificada
**Dado** que una familia ya recibió ayuda en el periodo, **cuando** el voluntario intenta registrar otra entrega, **entonces** el sistema exige activar “Autorizar excepción” e introducir un motivo no vacío; sin ambos datos no permite confirmar.

### CA-3 — Prioridad FEFO y vencimiento
**Dado** que un producto tiene varios lotes con fechas de vencimiento distintas, **cuando** se registra una entrega, **entonces** el sistema descuenta primero el lote con vencimiento más próximo y nunca utiliza un lote vencido ni un lote sin fecha conocida en el descuento automático.

### CA-4 — Control de stock
**Dado** que el stock utilizable es menor que la cantidad solicitada, **cuando** el voluntario intenta confirmar, **entonces** la operación se rechaza y ninguna existencia ni historial cambia.

### CA-5 — Trazabilidad de entrega
**Dado** que una entrega válida se confirma, **cuando** finaliza la operación, **entonces** aparece en el historial con familia, fecha, voluntario, producto, cantidad y lotes descontados, y el inventario refleja exactamente el descuento.

## 6. Datos mínimos

- Familia: id, nombre/referencia, integrantes, activa.
- Lote: id, producto, cantidad disponible, fecha de recepción, fecha de vencimiento opcional.
- Entrega: id, familia, fecha/hora, voluntario, motivo de excepción opcional.
- Detalle de entrega: entrega, producto, cantidad.
- Consumo de lote: detalle, lote, cantidad descontada.

## 7. Supuestos y riesgos

- Para el prototipo, los datos se guardan en el navegador mediante almacenamiento local; no se comparten entre dispositivos.
- El periodo inicial es 30 días y debe poder cambiarse.
- El voluntario escribe su nombre para dejar trazabilidad; esto no equivale a autenticación.
- La fecha del dispositivo debe ser correcta.
- Una fecha de consumo preferente no siempre equivale a una fecha de caducidad. La decisión de aptitud alimentaria debe seguir las normas locales y revisión humana.
- Para producción se requiere backend, autenticación, permisos, auditoría persistente, copias de seguridad y transacciones atómicas.

## 8. Pruebas manuales mínimas
1. Seleccionar familia sin entrega reciente: aparece Pendiente.
2. Seleccionar familia atendida recientemente: aparece Ya recibió ayuda.
3. Intentar entregar de nuevo sin excepción: se bloquea.
4. Activar excepción sin motivo: se bloquea.
5. Entregar con excepción y motivo: se registra.
6. Probar lotes con dos fechas: se consume primero el más próximo.
7. Solicitar más que el stock: se rechaza y el stock no cambia.
8. Confirmar entrega válida: historial y existencias se actualizan.
