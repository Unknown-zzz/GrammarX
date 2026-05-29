const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak } = require('docx');
const fs = require('fs');

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22 } // 11pt
      }
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 28, bold: true, font: "Calibri" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 }
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 26, bold: true, font: "Calibri" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 }
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 24, bold: true, font: "Calibri" },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch margins
      }
    },
    children: [
      // ═════════════════════════════════════════════════════════════════
      // PORTADA / TITLE PAGE
      // ═════════════════════════════════════════════════════════════════
      new Paragraph({ text: "", spacing: { after: 200 } }),
      new Paragraph({
        text: "UNIVERSIDAD PRIVADA DOMINGO SAVIO",
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        run: { size: 24, bold: true }
      }),
      new Paragraph({
        text: "GRAMMAR X",
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        run: { size: 32, bold: true }
      }),
      new Paragraph({
        text: "Juego Interactivo de Gramática Inglesa",
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        run: { size: 24, italics: true }
      }),
      new Paragraph({ text: "", spacing: { after: 200 } }),
      new Paragraph({
        text: "Informe de Proyecto",
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        run: { size: 22, bold: true }
      }),
      new Paragraph({ text: "", spacing: { after: 200 } }),
      new Paragraph({
        text: "Asignatura: Inglés",
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 }
      }),
      new Paragraph({
        text: "Docente: Ruth Gascher Portales",
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 }
      }),
      new Paragraph({
        text: "Carrera: Ingeniería en Sistemas",
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({ text: "", spacing: { after: 200 } }),
      new Paragraph({
        text: "Autores:",
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        run: { bold: true }
      }),
      new Paragraph({
        text: "Jonathan Campos\nLuis Rodrigo Vargas\nCarla Nohelia Cano\nDiego Justiniano Viera",
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({ text: "", spacing: { after: 400 } }),
      new Paragraph({
        text: "Santa Cruz, Bolivia\nMayo 2026",
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 }
      }),

      new PageBreak(),

      // ═════════════════════════════════════════════════════════════════
      // ÍNDICE
      // ═════════════════════════════════════════════════════════════════
      new Paragraph({ heading: HeadingLevel.HEADING_1, text: "ÍNDICE", spacing: { after: 240 } }),
      new Paragraph({ text: "1. Introducción ............................................................... 3" }),
      new Paragraph({ text: "2. Desarrollo ............................................................... 4" }),
      new Paragraph({ text: "   2.1 Descripción del Sistema" }),
      new Paragraph({ text: "   2.2 Decisiones de Stack Tecnológico" }),
      new Paragraph({ text: "   2.3 Arquitectura del Sistema" }),
      new Paragraph({ text: "   2.4 Comunicación en Tiempo Real" }),
      new Paragraph({ text: "   2.5 Sistema de Puntuación" }),
      new Paragraph({ text: "3. Resultados ............................................................... 10" }),
      new Paragraph({ text: "4. Conclusión ............................................................... 12" }),
      new Paragraph({ text: "5. Bibliografía ............................................................... 13", spacing: { after: 240 } }),

      new PageBreak(),

      // ═════════════════════════════════════════════════════════════════
      // 1. INTRODUCCIÓN
      // ═════════════════════════════════════════════════════════════════
      new Paragraph({ heading: HeadingLevel.HEADING_1, text: "1. Introducción", spacing: { after: 120 } }),
      new Paragraph({
        text: "Las aplicaciones web son sistemas de software que funcionan mediante navegadores de internet, permitiendo a usuarios interactuar con diferentes funcionalidades sin necesidad de instalar programas adicionales. Su accesibilidad, compatibilidad multiplataforma y facilidad de actualización las han convertido en herramientas ampliamente utilizadas en la educación.",
        spacing: { after: 120 }
      }),
      new Paragraph({
        text: "La incorporación de tecnologías digitales en la educación ha generado nuevas metodologías orientadas a mejorar procesos de enseñanza y aprendizaje. Entre estas destacan la gamificación y el aprendizaje basado en juegos digitales (Game-Based Learning, GBL), enfoques que incorporan elementos de videojuegos como sistemas de puntuación, recompensas, niveles y retroalimentación inmediata con fines pedagógicos.",
        spacing: { after: 120 }
      }),
      new Paragraph({
        text: "Investigaciones han demostrado que los juegos digitales favorecen significativamente el desarrollo de habilidades lingüísticas como vocabulario, comprensión lectora y gramática. Sin embargo, muchas plataformas actuales se enfocan principalmente en ejercicios de opción múltiple, limitando la práctica profunda de estructuras gramaticales en contextos interactivos.",
        spacing: { after: 120 }
      }),
      new Paragraph({
        text: "En respuesta a esta necesidad, se desarrolló Grammar X, una aplicación web multijugador en tiempo real orientada al aprendizaje interactivo de gramática inglesa. La aplicación contiene cuatro minijuegos diseñados para reforzar temas gramaticales fundamentales: Past Simple, Comparatives and Superlatives, Present Perfect y Future Tenses. El sistema incluye cinco niveles de dificultad e implementa un sistema de puntuación dinámico que recompensa tanto precisión como rapidez.",
        spacing: { after: 0 }
      }),

      new PageBreak(),

      // ═════════════════════════════════════════════════════════════════
      // 2. DESARROLLO
      // ═════════════════════════════════════════════════════════════════
      new Paragraph({ heading: HeadingLevel.HEADING_1, text: "2. Desarrollo", spacing: { after: 120 } }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.1 Descripción del Sistema", spacing: { after: 80 } }),
      new Paragraph({
        text: "Grammar X es una Single Page Application (SPA) cliente-servidor que permite a docentes crear salas de juego multijugador en tiempo real. El sistema diferencia dos roles: el host (docente), quien configura la partida desde un panel de administración, y los jugadores (estudiantes), quienes se unen mediante un código de seis caracteres alfanuméricos o escaneando un código QR generado automáticamente.",
        spacing: { after: 120 }
      }),
      new Paragraph({
        text: "Cada partida consta de 10 rondas seleccionadas aleatoriamente de un banco de preguntas estructurado en cinco niveles de dificultad (Beginner, Easy, Medium, Hard, Expert). El flujo de sesión es: creación de sala, conexión de jugadores, configuración del juego, lectura de instrucciones, desarrollo de la partida con temporizador sincronizado, y visualización de resultados. El servidor mantiene autoridad sobre el estado; los clientes son consumidores puros de ese estado.",
        spacing: { after: 0 }
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.2 Decisiones de Stack Tecnológico", spacing: { after: 80 } }),
      new Paragraph({
        text: "React 18 + Vite 5 (Frontend): React permite construir interfaces reactivas mediante componentes declarativos. Vite 5 reemplaza webpack, generando bundles optimizados mediante tree-shaking automático.",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Node.js 24 + Express.js (Backend): Node.js es idóneo para tiempo real gracias a su modelo de I/O no bloqueante, manejando miles de conexiones WebSocket desde un único proceso.",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Socket.io 4.x (Comunicación): Implementa WebSockets con fallback automático a long-polling y salas virtuales que permiten emitir mensajes selectivamente a participantes de una partida.",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "SQLite + node:sqlite (Persistencia): Base de datos serverless embebida en el proceso Node.js, eliminando necesidad de infraestructura adicional.",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Web Audio API (Sonido): Síntesis de audio en tiempo real en el navegador, eliminando peticiones HTTP adicionales y garantizando funcionamiento offline.",
        spacing: { after: 0 }
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.3 Arquitectura del Sistema", spacing: { after: 80 } }),
      new Paragraph({
        text: "La arquitectura sigue el patrón cliente-servidor con un único proceso Node.js que cumple tres funciones: servir archivos estáticos del frontend, gestionar lógica del juego y mantener conexiones WebSocket. El estado de la partida vive exclusivamente en el servidor. Los clientes son apátridas respecto al juego; su única fuente de verdad es el último mensaje 'state' recibido por Socket.io. Si un jugador pierde conexión, solicita el estado actual con 'rejoin' y retoma la partida desde donde estaba.",
        spacing: { after: 0 }
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.4 Comunicación en Tiempo Real", spacing: { after: 80 } }),
      new Paragraph({
        text: "Los eventos específicos siguen un patrón: el cliente emite un evento con datos y callback de confirmación, el servidor valida y persiste el cambio en SQLite, y distribuye el nuevo estado a todos los participantes. Se implementa un patrón dual ref+state en React: useState gestiona re-render de UI, mientras que useRef garantiza que el temporizador siempre lea valores actuales sin problemas de closures obsoletas.",
        spacing: { after: 0 }
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, text: "2.5 Sistema de Puntuación", spacing: { after: 80 } }),
      new Paragraph({
        text: "La puntuación de cada respuesta combina dificultad y velocidad. La fórmula es: Score = (dificultad × 100) + ((timeLeft / totalTime) × dificultad × 50). El bono de velocidad decrece linealmente con el tiempo transcurrido. Al finalizar, el servidor suma todas las puntuaciones, las persiste y las devuelve ordenadas para construir el podio.",
        spacing: { after: 0 }
      }),

      new PageBreak(),

      // ═════════════════════════════════════════════════════════════════
      // 3. RESULTADOS
      // ═════════════════════════════════════════════════════════════════
      new Paragraph({ heading: HeadingLevel.HEADING_1, text: "3. Resultados", spacing: { after: 120 } }),
      new Paragraph({
        text: "Grammar X fue desarrollado exitosamente como una aplicación web multijugador completa que integra:",
        spacing: { after: 120 }
      }),
      new Paragraph({ text: "• Cuatro minijuegos independientes orientados a diferentes estructuras gramaticales", spacing: { after: 60 } }),
      new Paragraph({ text: "• Sistema de comunicación en tiempo real mediante WebSockets", spacing: { after: 60 } }),
      new Paragraph({ text: "• Sincronización de relojes entre cliente-servidor eliminando desfases temporales", spacing: { after: 60 } }),
      new Paragraph({ text: "• Sistema dinámico de puntuación considerando dificultad y velocidad", spacing: { after: 60 } }),
      new Paragraph({ text: "• Interfaz responsiva optimizada para dispositivos móviles y de escritorio", spacing: { after: 60 } }),
      new Paragraph({ text: "• Síntesis de audio en tiempo real sin dependencias externas", spacing: { after: 120 } }),
      new Paragraph({
        text: "La aplicación ha sido probada con múltiples usuarios simultáneos, demostrando estabilidad en la comunicación en tiempo real y precisión en la sincronización de temporizadores. Los jugadores pueden unirse fácilmente mediante código de sala o escaneo de código QR, facilitando su uso en contextos educativos.",
        spacing: { after: 120 }
      }),
      new Paragraph({
        text: "El sistema de podio y ranking instantáneo crea un ambiente competitivo motivador que mantiene el engagement de los estudiantes. La arquitectura modular permite fácil extensión con minijuegos adicionales que cubran otras estructuras gramaticales.",
        spacing: { after: 0 }
      }),

      new PageBreak(),

      // ═════════════════════════════════════════════════════════════════
      // 4. CONCLUSIÓN
      // ═════════════════════════════════════════════════════════════════
      new Paragraph({ heading: HeadingLevel.HEADING_1, text: "4. Conclusión", spacing: { after: 120 } }),
      new Paragraph({
        text: "Grammar X demuestra que es posible desarrollar herramientas educativas digitales de alta calidad utilizando exclusivamente tecnologías de código abierto. El proyecto integra conceptos avanzados de desarrollo web—comunicación en tiempo real mediante WebSockets, sincronización de relojes entre cliente y servidor, y despliegue en la nube—aplicándolos a un contexto educativo concreto.",
        spacing: { after: 120 }
      }),
      new Paragraph({
        text: "Desde la perspectiva del aprendizaje del inglés, la aplicación contribuye a la práctica de cuatro estructuras gramaticales fundamentales mediante mecánicas de juego competitivas que motivan a estudiantes a concentrarse y responder rápidamente, creando un ambiente de aprendizaje activo que complementa eficazmente los métodos de enseñanza tradicionales.",
        spacing: { after: 120 }
      }),
      new Paragraph({
        text: "Posibles mejoras futuras incluyen: incorporación de más minijuegos para estructuras adicionales como condicionales o passive voice; desarrollo de sistema de cuentas de usuario para gestión de grupos y seguimiento del progreso individual; y optimización de rendimiento para salas con mayor número de participantes simultáneos.",
        spacing: { after: 0 }
      }),

      new PageBreak(),

      // ═════════════════════════════════════════════════════════════════
      // 5. BIBLIOGRAFÍA
      // ═════════════════════════════════════════════════════════════════
      new Paragraph({ heading: HeadingLevel.HEADING_1, text: "5. Bibliografía", spacing: { after: 120 } }),
      new Paragraph({
        text: "Brown, H. D. (2014). Principles of language learning and teaching (6.ª ed.). Pearson Education.",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Meta Platforms. (2024). React—A JavaScript library for building user interfaces. https://react.dev",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Node.js Foundation. (2024). Node.js documentation—node:sqlite. https://nodejs.org/api/sqlite.html",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Prensky, M. (2001). Digital game-based learning. McGraw-Hill.",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Railway. (2024). Railway documentation. https://docs.railway.app",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Socket.IO. (2024). Socket.IO documentation. https://socket.io/docs/v4/",
        spacing: { after: 80 }
      }),
      new Paragraph({
        text: "Vite. (2024). Vite: Next generation frontend tooling. https://vitejs.dev",
        spacing: { after: 0 }
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:\\Users\\Jonathan\\Desktop\\GrammarX\\Informe\\Informe_Condensado.docx", buffer);
  console.log("✓ Informe condensado creado: Informe_Condensado.docx (13 páginas)");
});
