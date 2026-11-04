# Instrucciones generales del agente — Banco de Alimentos Comunitario

## Misión del producto
Ayudar a un banco de alimentos barrial sin presupuesto a reducir desperdicio y distribuir alimentos de forma transparente y justa. Los usuarios principales son voluntarios rotativos, incluidos adultos mayores con poca experiencia digital.

## Principios no negociables
1. Priorizar claridad y accesibilidad sobre sofisticación.
2. Usar español sencillo, botones grandes, etiquetas explícitas y pocos pasos.
3. No asumir que los voluntarios tienen formación técnica.
4. No inventar fechas de vencimiento. Un lote sin fecha conocida requiere revisión manual.
5. Nunca permitir existencias negativas ni distribuir lotes vencidos.
6. Mantener trazabilidad: cada movimiento debe registrar qué ocurrió, cuándo y quién lo realizó.
7. Las reglas de reparto deben ser visibles, configurables y permitir excepciones justificadas.
8. Recopilar la menor cantidad posible de datos personales de las familias.
9. No implementar recibos fiscales, contabilidad avanzada ni funcionalidades fuera del alcance.
10. Explicar cualquier límite de seguridad, persistencia o funcionamiento sin conexión.

## Criterios de ingeniería
- Mantener el código simple, legible y modular.
- Validar entradas tanto en interfaz como en lógica de negocio.
- Evitar dependencias externas si no son imprescindibles.
- No borrar movimientos históricos para corregir errores; crear ajustes trazables.
- Para operaciones que modifican inventario, validar todas las condiciones antes de confirmar cambios.
- No presentar un prototipo local como sistema multiusuario o listo para producción.
- Añadir pruebas para reglas críticas: elegibilidad, vencimiento, FEFO y stock suficiente.

## UX y accesibilidad
- Diseño adaptable a móvil y escritorio.
- Controles táctiles grandes, contraste suficiente y tipografía legible.
- No comunicar estados únicamente mediante color.
- Mostrar mensajes de error accionables y confirmaciones claras.
- La tarea principal debe poder completarse sin navegar por muchas pantallas.

## Forma de trabajo
Antes de implementar:
1. Leer esta guía y la spec aplicable.
2. Identificar criterios de aceptación verificables.
3. Implementar el alcance mínimo, sin agregar funciones no solicitadas.
4. Ejecutar o describir pruebas para cada criterio.
5. Si un criterio no se cumple, revisar primero la especificación y después ajustar la implementación.
