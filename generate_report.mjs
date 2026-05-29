import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, TabStopType,
  TabStopPosition
} = require('C:/Users/Jonathan/AppData/Roaming/npm/node_modules/docx');
import fs from 'fs';

const SS = 'C:/Users/Jonathan/Desktop/GrammarX/screenshots';
const DEST_ES = 'C:/Users/Jonathan/Desktop/Informe_GrammarX_ES.docx';
const DEST_EN = 'C:/Users/Jonathan/Desktop/Informe_GrammarX_EN.docx';

// ── Image loader ──────────────────────────────────────────────────────────────
function img(file, w, h, caption) {
  const data = fs.readFileSync(`${SS}/${file}`);
  const blocks = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 80 },
      children: [new ImageRun({ type: 'png', data, transformation: { width: w, height: h },
        altText: { title: caption, description: caption, name: caption } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: caption, italics: true, size: 20, color: '555555' })],
    }),
  ];
  return blocks;
}

// ── Shared style helpers ──────────────────────────────────────────────────────
const TNR = 'Times New Roman';
const body = (text, indent = true) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { line: 480, before: 0, after: 0 },
  indent: indent ? { firstLine: 720 } : {},
  children: [new TextRun({ text, font: TNR, size: 24 })],
});
const bodyNoIndent = text => body(text, false);
const blank = () => new Paragraph({ spacing: { line: 480 }, children: [new TextRun({ text: '', font: TNR, size: 24 })] });
const h1 = text => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  pageBreakBefore: true,
  spacing: { before: 0, after: 240 },
  children: [new TextRun({ text, bold: true, font: TNR, size: 28, allCaps: true })],
});
const h2 = text => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({ text, bold: true, font: TNR, size: 24 })],
});
const centered = (text, size = 24, bold = false, spacing = 240) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: spacing, after: spacing },
  children: [new TextRun({ text, font: TNR, size, bold })],
});

// ── Running head footer ───────────────────────────────────────────────────────
const mkHeader = runHead => new Header({
  children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 4 } },
    children: [
      new TextRun({ text: runHead.toUpperCase(), font: TNR, size: 20 }),
      new TextRun({ text: '\t', font: TNR, size: 20 }),
      new TextRun({ children: [PageNumber.CURRENT], font: TNR, size: 20 }),
    ],
  })],
});
const blankHeader = () => new Header({ children: [new Paragraph({ children: [new TextRun('')] })] });

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function buildDoc(lang) {
  const ES = lang === 'es';
  const runHead = ES ? 'GRAMMARX: JUEGO INTERACTIVO DE GRAMÁTICA INGLESA'
                     : 'GRAMMARX: INTERACTIVE ENGLISH GRAMMAR GAME';

  const marginProps = { top: 1440, right: 1440, bottom: 1440, left: 1440 };
  const pageProps = { size: { width: 12240, height: 15840 }, margin: marginProps };

  // ── COVER (no header) ───────────────────────────────────────────────────────
  const coverSection = {
    properties: { page: pageProps, titlePage: true },
    headers: { default: blankHeader(), first: blankHeader() },
    children: [
      blank(), blank(),
      centered(ES ? 'Universidad Autónoma' : 'Universidad Autónoma', 28, true),
      centered(ES ? '[Nombre de la Carrera]' : '[Name of the Program]', 24),
      blank(), blank(),
      centered('GRAMMAR X', 40, true, 480),
      centered(
        ES ? 'Juego Interactivo de Gramática Inglesa'
           : 'Interactive English Grammar Game',
        28, false, 240
      ),
      blank(), blank(),
      centered(ES ? 'Informe de Proyecto' : 'Project Report', 24),
      blank(), blank(),
      centered(ES ? 'Asignatura: Inglés' : 'Course: English', 24),
      centered(ES ? 'Docente: [Nombre del Docente]' : 'Instructor: [Instructor Name]', 24),
      blank(),
      centered(ES ? 'Presentado por: [Tu Nombre]' : 'Submitted by: [Your Name]', 24),
      blank(),
      centered(ES ? 'Fecha: Mayo 2026' : 'Date: May 2026', 24),
    ],
    type: 'nextPage',
  };

  // ── TOC page ────────────────────────────────────────────────────────────────
  function tocLine(label, page) {
    return new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 8640 }],
      spacing: { line: 480, before: 0, after: 0 },
      children: [
        new TextRun({ text: label, font: TNR, size: 24 }),
        new TextRun({ text: `\t${page}`, font: TNR, size: 24 }),
      ],
    });
  }

  const tocSection = {
    properties: { page: pageProps },
    headers: { default: mkHeader(runHead) },
    children: [
      new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 480 },
        children: [new TextRun({ text: ES ? 'ÍNDICE' : 'TABLE OF CONTENTS', bold: true, font: TNR, size: 28, allCaps: true })] }),
      tocLine(ES ? '1. Introducción' : '1. Introduction', '3'),
      tocLine(ES ? '2. Desarrollo' : '2. Development', '4'),
      tocLine(ES ? '   2.1 Descripción del Sistema' : '   2.1 System Description', '4'),
      tocLine(ES ? '   2.2 Stack Tecnológico' : '   2.2 Technology Stack', '5'),
      tocLine(ES ? '   2.3 Arquitectura' : '   2.3 Architecture', '6'),
      tocLine(ES ? '   2.4 Funcionalidades' : '   2.4 Features', '7'),
      tocLine(ES ? '3. Capturas de Pantalla' : '3. Screenshots', '8'),
      tocLine(ES ? '4. Conclusión' : '4. Conclusion', '12'),
      tocLine(ES ? '5. Bibliografía' : '5. Bibliography', '13'),
    ],
    type: 'nextPage',
  };

  // ── BODY ────────────────────────────────────────────────────────────────────
  const bodySection = {
    properties: { page: pageProps },
    headers: { default: mkHeader(runHead) },
    children: [

      // ── 1. Introducción ────────────────────────────────────────────────────
      h1(ES ? '1. Introducción' : '1. Introduction'),
      body(ES
        ? 'El presente informe describe el desarrollo de Grammar X, una aplicación web de tipo multijugador diseñada para el aprendizaje interactivo de la gramática inglesa en el contexto de un aula escolar. El proyecto fue desarrollado como parte de la asignatura de Inglés, con el objetivo de ofrecer una herramienta pedagógica atractiva y tecnológicamente moderna que motive a los estudiantes a practicar estructuras gramaticales de manera lúdica.'
        : 'This report describes the development of Grammar X, a multiplayer web application designed for interactive English grammar learning in a classroom context. The project was developed as part of an English course, with the goal of providing an engaging and technologically modern pedagogical tool that motivates students to practice grammatical structures through play.'),
      blank(),
      body(ES
        ? 'La aplicación se inspira en plataformas de gamificación educativa como Kahoot!, pero incorpora mecánicas de juego originales organizadas en cuatro minijuegos temáticos que cubren distintos tiempos verbales y estructuras del idioma inglés. Cada partida puede ser creada por un docente en el rol de host y jugada simultáneamente por múltiples estudiantes desde sus dispositivos móviles o computadoras.'
        : 'The application is inspired by educational gamification platforms such as Kahoot!, but incorporates original gameplay mechanics organized into four thematic mini-games that cover different tenses and structures of the English language. Each session can be created by a teacher acting as host and played simultaneously by multiple students from their mobile devices or computers.'),
      blank(),
      body(ES
        ? 'El sistema fue construido íntegramente con tecnologías de código abierto, sin costos de licencia, lo que lo hace accesible para instituciones educativas con recursos limitados. El despliegue de la aplicación se realizó en la nube mediante la plataforma Railway, garantizando su disponibilidad desde cualquier dispositivo con conexión a internet.'
        : 'The system was built entirely with open-source technologies, with no licensing costs, making it accessible to educational institutions with limited resources. The application was deployed to the cloud using the Railway platform, ensuring its availability from any device with an internet connection.'),

      // ── 2. Desarrollo ──────────────────────────────────────────────────────
      h1(ES ? '2. Desarrollo' : '2. Development'),

      h2(ES ? '2.1 Descripción del Sistema' : '2.1 System Description'),
      body(ES
        ? 'Grammar X es una Single Page Application (SPA) de tipo cliente-servidor que permite a un docente crear salas de juego multijugador en tiempo real. El sistema diferencia dos roles: el host (docente), quien configura y controla la partida, y los jugadores (estudiantes), quienes se unen a la sala mediante un código único de seis caracteres o escaneando un código QR.'
        : 'Grammar X is a client-server Single Page Application (SPA) that allows a teacher to create real-time multiplayer game rooms. The system distinguishes two roles: the host (teacher), who configures and controls the session, and the players (students), who join the room using a unique six-character code or by scanning a QR code.'),
      blank(),
      body(ES
        ? 'Cada partida consta de diez rondas seleccionadas aleatoriamente de un banco de preguntas, distribuidas en cinco niveles de dificultad (Beginner, Easy, Medium, Hard y Expert), lo que asegura que cada sesión sea única. El sistema otorga puntos en función de la corrección de la respuesta y la velocidad con que se responde, incentivando tanto la precisión como la rapidez de pensamiento.'
        : 'Each session consists of ten rounds randomly selected from a question bank, distributed across five difficulty levels (Beginner, Easy, Medium, Hard, and Expert), ensuring that each session is unique. The system awards points based on the correctness of the answer and the speed with which it is answered, incentivizing both accuracy and quick thinking.'),

      h2(ES ? '2.2 Stack Tecnológico' : '2.2 Technology Stack'),
      body(ES
        ? 'El frontend fue desarrollado con React 18 y Vite 5. React permite construir interfaces de usuario reactivas mediante componentes reutilizables, mientras que Vite proporciona un entorno de desarrollo ultrarrápido con Hot Module Replacement (HMR) y genera bundles optimizados para producción.'
        : 'The frontend was developed with React 18 and Vite 5. React enables building reactive user interfaces through reusable components, while Vite provides an ultra-fast development environment with Hot Module Replacement (HMR) and generates optimized production bundles.'),
      blank(),
      body(ES
        ? 'El backend utiliza Node.js 24 con Express.js como framework HTTP. La comunicación en tiempo real entre el servidor y los clientes se implementó con Socket.io 4.x, que establece canales de comunicación bidireccionales basados en WebSockets. La persistencia de datos se maneja con SQLite a través del módulo nativo node:sqlite de Node.js, que no requiere dependencias externas. El despliegue se realizó en Railway.app, plataforma que gestiona el proceso de build y proporciona TLS automático.'
        : 'The backend uses Node.js 24 with Express.js as the HTTP framework. Real-time communication between the server and clients was implemented with Socket.io 4.x, which establishes bidirectional WebSocket-based communication channels. Data persistence is handled with SQLite through Node.js\'s native node:sqlite module, which requires no external dependencies. Deployment was done on Railway.app, a platform that manages the build process and provides automatic TLS.'),

      h2(ES ? '2.3 Arquitectura' : '2.3 Architecture'),
      body(ES
        ? 'La arquitectura del sistema sigue el patrón cliente-servidor con comunicación en tiempo real. El servidor Node.js sirve tanto la API REST como los archivos estáticos del frontend compilado. Cuando un host inicia una partida, el servidor genera un token de juego único y emite el estado inicial a todos los clientes conectados a esa sala mediante el canal de Socket.io.'
        : 'The system architecture follows the client-server pattern with real-time communication. The Node.js server serves both the REST API and the compiled frontend static files. When a host starts a game, the server generates a unique game token and emits the initial state to all clients connected to that room via the Socket.io channel.'),
      blank(),
      body(ES
        ? 'Los clientes implementan corrección de desfase de reloj (clock skew correction) para sincronizar el temporizador de cuenta regresiva con el servidor, garantizando que todos los jugadores vean el mismo tiempo restante independientemente de la latencia de su conexión. Cada respuesta se valida en el servidor y se almacena en la base de datos SQLite junto con el token de juego, lo que permite reconstruir los resultados finales de manera confiable.'
        : 'Clients implement clock skew correction to synchronize the countdown timer with the server, ensuring that all players see the same remaining time regardless of their connection latency. Each answer is validated on the server and stored in the SQLite database along with the game token, allowing final results to be reliably reconstructed.'),

      h2(ES ? '2.4 Funcionalidades' : '2.4 Features'),
      body(ES
        ? 'Grammar X ofrece cuatro minijuegos distintos. Time Machine (Past Simple) presenta palabras desordenadas que el jugador debe organizar para formar una oración correcta en pasado simple. Duel Mode (Comparatives & Superlatives) muestra dos objetos o conceptos y el jugador debe completar la oración eligiendo la forma comparativa o superlativa correcta. Evidence File (Present Perfect) presenta un párrafo de lectura con un texto breve en present perfect, seguido de una pregunta de comprensión. Crystal Ball (Future Tense) describe una situación y el jugador debe seleccionar la forma del tiempo futuro apropiada (will, going to, present continuous para futuro).'
        : 'Grammar X offers four distinct mini-games. Time Machine (Past Simple) presents scrambled words that the player must arrange to form a correct sentence in the past simple tense. Duel Mode (Comparatives & Superlatives) shows two objects or concepts and the player must complete the sentence by choosing the correct comparative or superlative form. Evidence File (Present Perfect) presents a reading paragraph with a short text in the present perfect, followed by a comprehension question. Crystal Ball (Future Tense) describes a situation and the player must select the appropriate future tense form (will, going to, present continuous for future).'),
      blank(),
      body(ES
        ? 'El sistema de puntuación es dinámico: cada pregunta vale una cantidad base de puntos proporcional a su nivel de dificultad, más un bono de velocidad que disminuye con el paso del tiempo. Esto significa que los jugadores que responden correctamente y rápido obtienen más puntos, creando una experiencia competitiva similar a la de los juegos de arcade. Al finalizar cada partida se muestra un podio con el ranking de los jugadores.'
        : 'The scoring system is dynamic: each question is worth a base number of points proportional to its difficulty level, plus a speed bonus that decreases over time. This means that players who answer correctly and quickly earn more points, creating a competitive experience similar to arcade games. At the end of each session, a podium is displayed showing the player rankings.'),

      // ── 3. Capturas de Pantalla ────────────────────────────────────────────
      h1(ES ? '3. Capturas de Pantalla' : '3. Screenshots'),
      body(ES
        ? 'A continuación se presentan las capturas de pantalla de las principales vistas de la aplicación, ilustrando el flujo completo desde el inicio de sesión hasta la visualización de resultados finales.'
        : 'The following screenshots show the main views of the application, illustrating the complete flow from login to the display of final results.', false),
      blank(),

      h2(ES ? '3.1 Pantalla de Inicio' : '3.1 Login Screen'),
      body(ES
        ? 'La pantalla de inicio permite al usuario ingresar su nombre y seleccionar entre el rol de Host (docente) y Jugador (estudiante). El diseño oscuro con tipografía contrastante crea una estética de videojuego que resulta atractiva para el público estudiantil.'
        : 'The login screen allows the user to enter their name and choose between the Host (teacher) and Player (student) roles. The dark design with contrasting typography creates a video game aesthetic that appeals to the student audience.', false),
      blank(),
      ...img('01_login.png', 500, 313, ES ? 'Figura 1. Pantalla de inicio — selección de rol' : 'Figure 1. Login screen — role selection'),
      ...img('02_login_host_role.png', 500, 313, ES ? 'Figura 2. Pantalla de inicio con rol Host seleccionado' : 'Figure 2. Login screen with Host role selected'),

      h2(ES ? '3.2 Sala de Espera (Lobby)' : '3.2 Waiting Room (Lobby)'),
      body(ES
        ? 'Una vez que el docente crea la sala, se muestra un código único de seis caracteres y un código QR que los estudiantes pueden escanear con su dispositivo para unirse automáticamente. El host puede seleccionar el minijuego y el tiempo por pregunta antes de iniciar la partida.'
        : 'Once the teacher creates the room, a unique six-character code and a QR code are displayed, which students can scan with their device to join automatically. The host can select the mini-game and the time per question before starting the session.', false),
      blank(),
      ...img('03_host_lobby.png', 500, 340, ES ? 'Figura 3. Sala del host — selección de minijuego y código de sala' : 'Figure 3. Host lobby — mini-game selection and room code'),
      ...img('04_host_lobby_qr.png', 500, 340, ES ? 'Figura 4. Sala del host con código QR visible' : 'Figure 4. Host lobby with QR code visible'),
      ...img('07_player_lobby_waiting.png', 260, 565, ES ? 'Figura 5. Vista del jugador esperando en la sala (vista móvil)' : 'Figure 5. Player view waiting in the lobby (mobile view)'),

      h2(ES ? '3.3 Vista del Host Durante el Juego' : '3.3 Host View During the Game'),
      body(ES
        ? 'El panel de control del host muestra la pregunta actual, el temporizador en cuenta regresiva, el estado de respuesta de cada jugador y el marcador en tiempo real. El botón de avance se activa automáticamente cuando todos los jugadores han respondido o cuando el tiempo se agota.'
        : 'The host control panel displays the current question, the countdown timer, each player\'s answer status, and the real-time scoreboard. The advance button activates automatically when all players have answered or when the time runs out.', false),
      blank(),
      ...img('08_host_lobby_player_connected.png', 560, 380, ES ? 'Figura 6. Sala del host con un jugador conectado' : 'Figure 6. Host lobby with a connected player'),
      ...img('09_host_dashboard_g1.png', 560, 360, ES ? 'Figura 7. Dashboard del host durante Time Machine (Past Simple)' : 'Figure 7. Host dashboard during Time Machine (Past Simple)'),

      h2(ES ? '3.4 Vista del Jugador Durante el Juego' : '3.4 Player View During the Game'),
      body(ES
        ? 'La vista del jugador se adapta a dispositivos móviles con un diseño vertical optimizado. En Time Machine, el jugador ve las palabras mezcladas como fichas interactivas y debe tocarlas en el orden correcto para formar la oración. Un temporizador visible en la parte superior indica el tiempo restante para responder.'
        : 'The player view adapts to mobile devices with an optimized vertical layout. In Time Machine, the player sees the scrambled words as interactive chips and must tap them in the correct order to form the sentence. A visible timer at the top indicates the remaining time to answer.', false),
      blank(),
      ...img('10_player_game_g1.png', 260, 565, ES ? 'Figura 8. Vista del jugador en Time Machine (palabras sin ordenar)' : 'Figure 8. Player view in Time Machine (unordered words)'),
      ...img('11_player_placing_words.png', 260, 565, ES ? 'Figura 9. Jugador colocando palabras en el orden correcto' : 'Figure 9. Player placing words in the correct order'),

      h2(ES ? '3.5 Resultados Finales' : '3.5 Final Results'),
      body(ES
        ? 'Al concluir todas las rondas, el host ve la pantalla de resultados con el podio de ganadores y las puntuaciones finales. Los jugadores reciben simultáneamente la notificación de fin de juego con su puntuación total. El host puede iniciar una nueva partida o cerrar la sesión.'
        : 'Once all rounds are completed, the host sees the results screen with the winners\' podium and final scores. Players simultaneously receive the end-of-game notification with their total score. The host can start a new session or close the room.', false),
      blank(),
      ...img('14_host_final_results.png', 560, 360, ES ? 'Figura 10. Pantalla de resultados finales — vista del host' : 'Figure 10. Final results screen — host view'),
      ...img('15_player_final_podium.png', 260, 565, ES ? 'Figura 11. Pantalla de fin de juego — vista del jugador (móvil)' : 'Figure 11. End-of-game screen — player view (mobile)'),

      // ── 4. Conclusión ──────────────────────────────────────────────────────
      h1(ES ? '4. Conclusión' : '4. Conclusion'),
      body(ES
        ? 'Grammar X demuestra que es posible desarrollar herramientas educativas digitales de alta calidad utilizando exclusivamente tecnologías de código abierto. El proyecto integra conceptos avanzados de desarrollo web —como la comunicación en tiempo real mediante WebSockets, la sincronización de relojes entre cliente y servidor, y el despliegue en la nube— aplicándolos a un contexto educativo concreto.'
        : 'Grammar X demonstrates that it is possible to develop high-quality digital educational tools using exclusively open-source technologies. The project integrates advanced web development concepts—such as real-time communication via WebSockets, client-server clock synchronization, and cloud deployment—applying them to a concrete educational context.'),
      blank(),
      body(ES
        ? 'Desde la perspectiva del aprendizaje del idioma inglés, la aplicación contribuye a la práctica de cuatro estructuras gramaticales fundamentales: el pasado simple, los comparativos y superlativos, el present perfect y el tiempo futuro. La mecánica de juego competitiva motiva a los estudiantes a concentrarse y responder rápidamente, creando un ambiente de aprendizaje activo y participativo que complementa eficazmente los métodos de enseñanza tradicionales.'
        : 'From the perspective of English language learning, the application contributes to the practice of four fundamental grammatical structures: the past simple, comparatives and superlatives, the present perfect, and the future tense. The competitive gameplay mechanic motivates students to focus and respond quickly, creating an active and participatory learning environment that effectively complements traditional teaching methods.'),
      blank(),
      body(ES
        ? 'Entre las posibles mejoras futuras se identifican: la incorporación de más minijuegos que cubran estructuras adicionales como los condicionales o el passive voice; el desarrollo de un sistema de cuentas de usuario que permita a los docentes gestionar sus grupos y hacer seguimiento del progreso individual de cada estudiante; y la optimización del rendimiento para salas con un mayor número de participantes simultáneos.'
        : 'Among the possible future improvements identified are: the incorporation of more mini-games covering additional structures such as conditionals or the passive voice; the development of a user account system allowing teachers to manage their groups and track each student\'s individual progress; and performance optimization for rooms with a larger number of simultaneous participants.'),

      // ── 5. Bibliografía ────────────────────────────────────────────────────
      h1(ES ? '5. Bibliografía' : '5. Bibliography'),
      body('Meta Platforms. (2024). React – A JavaScript library for building user interfaces. https://react.dev', false),
      blank(),
      body('Vite. (2024). Vite: Next Generation Frontend Tooling. https://vitejs.dev', false),
      blank(),
      body('Socket.IO. (2024). Socket.IO documentation. https://socket.io/docs/v4/', false),
      blank(),
      body('Node.js Foundation. (2024). Node.js documentation – node:sqlite. https://nodejs.org/api/sqlite.html', false),
      blank(),
      body('Railway. (2024). Railway documentation. https://docs.railway.app', false),
      blank(),
      body(ES
        ? 'Brown, H. D. (2014). Principles of Language Learning and Teaching (6.a ed.). Pearson Education.'
        : 'Brown, H. D. (2014). Principles of Language Learning and Teaching (6th ed.). Pearson Education.', false),
      blank(),
      body(ES
        ? 'Prensky, M. (2001). Digital game-based learning. McGraw-Hill.'
        : 'Prensky, M. (2001). Digital game-based learning. McGraw-Hill.', false),
    ],
  };

  return new Document({
    styles: {
      default: {
        document: { run: { font: TNR, size: 24 } },
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: TNR },
          paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: TNR },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      ],
    },
    sections: [coverSection, tocSection, bodySection],
  });
}

// ── Generate both ─────────────────────────────────────────────────────────────
const docES = buildDoc('es');
const docEN = buildDoc('en');

const bufES = await Packer.toBuffer(docES);
const bufEN = await Packer.toBuffer(docEN);

fs.writeFileSync(DEST_ES, bufES);
fs.writeFileSync(DEST_EN, bufEN);

console.log('✅ Informe_GrammarX_ES.docx creado');
console.log('✅ Informe_GrammarX_EN.docx creado');
