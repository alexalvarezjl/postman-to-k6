# Arquitectura del Sistema (SDD)

## El Contrato: Intermediate Object Interface (IOI)
El núcleo técnico del proyecto es el **IOI**. Este objeto estandariza las peticiones de Postman y cURL, permitiendo que la lógica de generación sea totalmente independiente de la fuente de datos[cite: 5].

## Flujo de Trabajo Basado en Agentes
La arquitectura sigue un ciclo de vida gobernado por habilidades específicas centralizadas en `.agent/skills/`[cite: 5, 7]:

1.  **Propuesta e Ideación**: `openspec-propose` y `writing-plans` definen el cambio en el esquema antes de ejecutar cualquier línea de código[cite: 5].
2.  **Exploración y Validación**: `openspec-explore` y `k6-docs` verifican la viabilidad técnica y consultan la documentación oficial para asegurar mejores prácticas[cite: 5].
3.  **Generación Políglota**:
    *   `k6-generator.js`: Crea scripts de performance con lógica de carga y reportes visuales[cite: 2, 5].
    *   `cypress-generator.js` (vía `cypress-author`): Produce suites funcionales y comandos personalizados[cite: 3, 5].
4.  **Aplicación de Cambios**: `openspec-apply-change` consolida la nueva lógica en el proyecto, asegurando que el esquema de OpenSpec se mantenga sincronizado[cite: 5].

## Desacoplamiento
Este diseño permite que un error en el generador de Cypress no afecte la creación de scripts de k6, manteniendo una alta cohesión y bajo acoplamiento[cite: 5].