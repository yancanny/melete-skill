# Melete Skill

[English](README.md) | [简体中文](README.zh-CN.md) | Español

Revisa cómo trabajáis tú y la IA.

Melete es una habilidad para agentes que ayuda a reflexionar sobre tus conversaciones con la IA. Pídele una revisión y podrá presentar observaciones con sus fuentes, posibles interpretaciones, una pregunta y, si has expresado un objetivo, pequeños experimentos para revisar más adelante. La conducta de la propia IA también forma parte de la revisión. Melete no asigna puntuaciones ni decide por ti qué es un buen uso.

## Qué puede hacer

- Revisar un año natural, los últimos 7, 30 o 90 días, los últimos 12 meses, todo el historial disponible o un periodo elegido. La cobertura depende del agente y de lo que pueda consultar.
- Mostrar varias observaciones con sus fuentes y al menos dos posibles lecturas; revisar tanto las respuestas de la IA como tus decisiones.
- Plantear una pregunta y, si has indicado una intención, uno o dos pequeños experimentos para una revisión posterior.
- Ofrecer una carta privada basada en tus propias palabras. Puede incluir hipótesis de la IA sobre emociones o salud; pueden ser erróneas y no constituyen un diagnóstico médico. La carta permanece cerrada por defecto y nunca se incluye al compartir.
- Crear, a petición tuya, una imagen o un HTML para compartir, guardado en tu dispositivo.

## Instalación y uso

Copia el contenido del repositorio en la carpeta de habilidades de tu herramienta, por ejemplo `~/.claude/skills/melete/` para Claude Code o `~/.codex/skills/melete/` para Codex. Otras herramientas compatibles con `SKILL.md` pueden usar su propia carpeta; la compatibilidad con WorkBuddy aún no se ha verificado. Después pregunta, por ejemplo: «Revisa cómo he trabajado con IA este año».

En un chat web sin instalador de habilidades, sube `references/lens/export/lens-for-chat.md` y pide una revisión basada en ese archivo. La revisión se limita a las conversaciones y recuerdos a los que la IA realmente puede acceder y debe indicarlo.

La revisión no necesita dependencias de software. Para generar una imagen larga se necesita Node.js 22 o posterior y Chrome, Edge o Chromium instalado; si no, se puede usar HTML.

## Principios y privacidad

Melete hace visible tu forma de trabajar y deja el juicio en tus manos. Las observaciones deben remitir a conversaciones y ofrecer más de una lectura cuando sea posible. La IA también se revisa. El proyecto no opera servidores ni recopila datos; el tratamiento de las conversaciones depende de la herramienta y el modelo que elijas. La carta privada nunca se incluye en lo compartido. Puedes pedir que se borren los archivos generados y Melete no sirve para consultar datos de otras personas.

El marco, la perspectiva social, la carta privada, las posibles prácticas de referencia, las cifras al compartir, las cuentas, la sincronización y las licencias futuras siguen abiertos a revisión. Las versiones publicadas conservan sus licencias. Se agradecen críticas y contribuciones; futuros rediseños pueden cambiar el comportamiento existente.

## Otras versiones de Melete

- [Melete DSH](https://github.com/yancanny/dsh-plugin-melete): complemento para DeepSeek Harness.
- [Melete Magpie](https://github.com/yancanny/magpie-plugin-melete): revisa DSH o Codex desde Magpie.

## Estructura y licencia

`SKILL.md` es la entrada; `references/` contiene los principios, el mapa y las pautas del informe; `scripts/` incluye herramientas locales opcionales y `assets/share.html` la plantilla para compartir.

Código y recursos: Apache-2.0. El mapa y la especificación escrita: CC BY 4.0. El nombre Melete está reservado por su autora o autor; la atribución y los límites sobre la consulta de datos ajenos se describen en [NOTICE](NOTICE).
