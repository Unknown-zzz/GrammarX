import sys

def titulo2(text, bid=None, bname=None, pid="0BAA0001"):
    bookmark = ""
    bookmark_end = ""
    if bid is not None and bname:
        bookmark = f'\n      <w:bookmarkStart w:id="{bid}" w:name="{bname}"/>'
        bookmark_end = f'\n      <w:bookmarkEnd w:id="{bid}"/>'
    return f'    <w:p w14:paraId="{pid}" w14:textId="77777777" w:rsidR="00FF0001" w:rsidRDefault="00FF0001">\n      <w:pPr><w:pStyle w:val="Ttulo2"/></w:pPr>{bookmark}\n      <w:r><w:t>{text}</w:t></w:r>{bookmark_end}\n    </w:p>'

def body(text, pid="0BAA0002"):
    escaped = text.replace("&", "&amp;")
    return f'    <w:p w14:paraId="{pid}" w14:textId="77777777" w:rsidR="00FF0001" w:rsidRDefault="00FF0001">\n      <w:pPr>\n        <w:spacing w:line="480" w:lineRule="auto"/>\n        <w:ind w:firstLine="720"/>\n        <w:jc w:val="both"/>\n      </w:pPr>\n      <w:r><w:t xml:space="preserve">{escaped}</w:t></w:r>\n    </w:p>'

def body_runs(runs, pid="0BAA0003"):
    inner = ""
    for text, bold in runs:
        escaped = text.replace("&", "&amp;")
        rpr = "<w:rPr><w:b/><w:bCs/></w:rPr>" if bold else ""
        inner += f'\n      <w:r>{rpr}<w:t xml:space="preserve">{escaped}</w:t></w:r>'
    return f'    <w:p w14:paraId="{pid}" w14:textId="77777777" w:rsidR="00FF0001" w:rsidRDefault="00FF0001">\n      <w:pPr>\n        <w:spacing w:line="480" w:lineRule="auto"/>\n        <w:ind w:firstLine="720"/>\n        <w:jc w:val="both"/>\n      </w:pPr>{inner}\n    </w:p>'

def code_block(lines, pid_base, start=1):
    result = []
    for i, line in enumerate(lines):
        pid = f"{pid_base}{(start+i):04d}"
        escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        result.append(f'    <w:p w14:paraId="{pid}" w14:textId="77777777" w:rsidR="00FF0001" w:rsidRDefault="00FF0001">\n      <w:pPr>\n        <w:shd w:val="clear" w:color="auto" w:fill="EFEFEF"/>\n        <w:spacing w:line="240" w:lineRule="auto" w:before="30" w:after="30"/>\n        <w:ind w:left="540"/>\n      </w:pPr>\n      <w:r>\n        <w:rPr>\n          <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>\n          <w:sz w:val="18"/><w:szCs w:val="18"/>\n          <w:color w:val="1E1E3E"/>\n        </w:rPr>\n        <w:t xml:space="preserve">{escaped}</w:t>\n      </w:r>\n    </w:p>')
    return "\n".join(result)

parts = []

# 2.1
parts.append(titulo2("2.1 Descripción del Sistema", bid=6, bname="_Toc230634521", pid="0BA10001"))
parts.append(body("Grammar X es una Single Page Application (SPA) de tipo cliente-servidor que permite a un docente crear salas de juego multijugador en tiempo real. El sistema diferencia dos roles: el host (docente), quien configura y controla la partida desde un panel de administración proyectable, y los jugadores (estudiantes), quienes se unen mediante un código único de seis caracteres alfanuméricos o escaneando un código QR generado automáticamente.", "0BA10002"))
parts.append(body("Cada partida consta de diez rondas seleccionadas aleatoriamente de un banco de preguntas estructurado en cinco niveles de dificultad (Beginner, Easy, Medium, Hard y Expert), garantizando que cada sesión sea única. El flujo de una sesión es: el host crea la sala; los jugadores se unen; el host configura el minijuego y el tiempo por ronda; todos leen las instrucciones y confirman que están listos; la partida transcurre con temporizador sincronizado; al finalizar se muestra el podio de resultados. El servidor mantiene el estado autoritativo; los clientes son consumidores puros de ese estado.", "0BA10003"))

# 2.2
parts.append(titulo2("2.2 Decisiones de Stack Tecnológico", bid=7, bname="_Toc230634522", pid="0BA20001"))
parts.append(body("La selección de cada tecnología respondió a criterios específicos de funcionalidad, costo y facilidad de integración. A continuación se justifica la elección de cada componente del stack:", "0BA20002"))
parts.append(body_runs([
    ("React 18 + Vite 5 (Frontend). ", True),
    ("React 18 fue elegido porque permite construir interfaces reactivas mediante componentes declarativos: cuando el estado cambia (por ejemplo, llega un nuevo estado del juego vía Socket.io), solo se re-renderizan los componentes afectados. Esto es crítico en un juego donde el temporizador, el contador de respuestas y el marcador se actualizan simultáneamente. Vite 5 reemplaza a webpack: el servidor de desarrollo arranca en menos de 300 ms (frente a los 10–30 s de webpack) y genera bundles optimizados mediante tree-shaking automático.", False),
], "0BA20003"))
parts.append(body_runs([
    ("Node.js 24 + Express.js (Backend). ", True),
    ("Node.js es idóneo para tiempo real por su modelo de I/O no bloqueante. A diferencia de servidores que crean un hilo por conexión, Node.js maneja miles de conexiones WebSocket en un único hilo mediante su event loop. Express.js simplifica la definición de rutas HTTP, permitiendo servir los archivos estáticos del frontend compilado y la lógica del juego desde el mismo proceso.", False),
], "0BA20004"))
parts.append(body_runs([
    ("Socket.io 4.x (Comunicación en Tiempo Real). ", True),
    ("HTTP es un protocolo petición-respuesta; en un juego multijugador necesitamos el patrón inverso: el servidor debe notificar a todos los clientes cuando ocurre un evento. Socket.io implementa WebSockets con fallback automático a long-polling y añade salas virtuales (rooms) que permiten emitir mensajes selectivamente a todos los participantes de una partida con una única llamada io.to(code).emit().", False),
], "0BA20005"))
parts.append(body_runs([
    ("SQLite + node:sqlite (Persistencia). ", True),
    ("SQLite fue elegido sobre PostgreSQL o MongoDB porque es serverless: la base de datos es un archivo en disco, sin proceso separado ni credenciales. Node.js 22+ incluye soporte nativo vía node:sqlite sin instalar librerías adicionales. Para una aplicación de aula con sesiones cortas y sin necesidad de escalado horizontal, SQLite ofrece la relación funcionalidad/complejidad óptima.", False),
], "0BA20006"))
parts.append(body_runs([
    ("Web Audio API (Sistema de Sonido). ", True),
    ("En lugar de cargar archivos .mp3 o .wav, Grammar X sintetiza todos los sonidos en tiempo real en el navegador. Esto elimina peticiones HTTP adicionales, garantiza funcionamiento offline y permite personalizar cada sonido por código. La API está disponible en todos los navegadores modernos sin dependencias ni licencias.", False),
], "0BA20007"))

# 2.3
parts.append(titulo2("2.3 Arquitectura del Sistema", bid=8, bname="_Toc230634523", pid="0BA30001"))
parts.append(body("La arquitectura sigue el patrón cliente-servidor con un único proceso Node.js que cumple tres funciones: servir los archivos estáticos del frontend (carpeta dist/ generada por Vite), gestionar la lógica del juego y mantener conexiones WebSocket con todos los clientes. La base de datos SQLite corre embebida en el mismo proceso, eliminando la necesidad de infraestructura adicional.", "0BA30002"))
parts.append(body("El estado de la partida vive exclusivamente en el servidor. Los clientes son apátridas (stateless) respecto al juego: su única fuente de verdad es el último mensaje ‘state’ recibido por Socket.io. Si un jugador pierde conexión y se reconecta, solicita el estado actual con el evento ‘rejoin’ y retoma la partida desde donde estaba. La función push(code) centraliza toda la distribución de estado:", "0BA30003"))
parts.append(code_block([
    "// server/index.js",
    "function push(code) {",
    "  const state = db.getRoundState(code);",
    "  if (state) io.to(code).emit('state', state);",
    "}",
    "",
    "// Se invoca tras cualquier cambio: respuesta, avance de ronda, fin de juego",
    "socket.on('answer', ({ code, name, roundIndex, score, gameToken }) => {",
    "  db.submitAnswer(code, name, roundIndex, score, gameToken);",
    "  push(code);  // notifica a todos los participantes de la sala",
    "});",
], "0BA3A", 1))

# 2.4
parts.append(titulo2("2.4 Comunicación en Tiempo Real: Socket.io", pid="0BA40001"))
parts.append(body("La capa de comunicación define eventos específicos para cada acción del juego. Todos siguen el mismo patrón: el cliente emite un evento con datos y un callback de confirmación (ack), el servidor valida y persiste el cambio en SQLite, y llama a push() para distribuir el nuevo estado a todos los participantes de la sala.", "0BA40002"))
parts.append(body("En el cliente se usa un patrón dual ref + state de React: el estado (useState) gestiona el re-render de la UI, mientras que la ref (useRef) garantiza que el temporizador, que corre en un setInterval independiente, siempre lea el valor más reciente sin problemas de closures obsoletas:", "0BA40003"))
parts.append(code_block([
    "// index.jsx — PlayerGameScreen",
    "const rsRef = useRef(null);          // para el intervalo del timer",
    "const [rs, setRs] = useState(null);  // para el renderizado de React",
    "",
    "useEffect(() => {",
    "  socket.on('state', data => {",
    "    rsRef.current = data;  // actualiza la ref inmediatamente",
    "    setRs(data);           // dispara re-render de la UI",
    "  });",
    "  return () => socket.off('state');",
    "}, [sessionCode]);",
    "",
    "// El timer lee rsRef.current, nunca el estado de React directamente",
    "setInterval(() => {",
    "  const cur = rsRef.current;",
    "  const left = cur.timePerRound - (syncedNow - cur.roundStartedAt) / 1000;",
    "  setTimeLeft(Math.max(0, left));",
    "}, 200);",
], "0BA4A", 1))

# 2.5
parts.append(titulo2("2.5 Persistencia con SQLite Nativo", pid="0BA50001"))
parts.append(body("La base de datos tiene tres tablas principales. La tabla sessions almacena el estado global de cada partida: código de sala, status del ciclo de vida (waiting / instructions / playing / ended / closed), las rondas serializadas como JSON, la ronda actual y el timestamp de inicio de ronda activa. La tabla players registra a los participantes. La tabla answers guarda cada respuesta individual:", "0BA50002"))
parts.append(code_block([
    "-- server/db.js — esquema SQLite",
    "CREATE TABLE sessions (",
    "  code             TEXT PRIMARY KEY,",
    "  status           TEXT DEFAULT 'waiting',",
    "  game_id          TEXT NOT NULL,",
    "  rounds           TEXT NOT NULL DEFAULT '[]',   -- JSON array de rondas",
    "  current_round    INTEGER DEFAULT 0,",
    "  round_started_at INTEGER DEFAULT 0,            -- timestamp ms",
    "  time_per_round   INTEGER DEFAULT 20,",
    "  game_token       TEXT NOT NULL DEFAULT ''      -- aislador entre partidas",
    ");",
    "",
    "CREATE TABLE answers (",
    "  session_code TEXT,    player_name  TEXT,",
    "  round_index  INTEGER, score        INTEGER,",
    "  game_token   TEXT,",
    "  PRIMARY KEY (session_code, player_name, round_index, game_token)",
    ");",
], "0BA5A", 1))
parts.append(body("El campo game_token es un timestamp en milisegundos generado al iniciar cada partida. Permite jugar múltiples partidas consecutivas en la misma sala sin que las respuestas de una contaminen las puntuaciones de la siguiente: al calcular resultados, solo se consideran las respuestas cuyo game_token coincida con el de la partida activa.", "0BA50003"))

# 2.6
parts.append(titulo2("2.6 Corrección de Desfase de Reloj (Clock Skew)", pid="0BA60001"))
parts.append(body("En un juego multijugador con temporizador compartido, cada dispositivo tiene su propio reloj del sistema, que puede diferir del servidor por decenas o cientos de milisegundos. Sin corrección, un jugador podría ver 3 segundos restantes mientras otro ve 1 segundo, creando una ventaja injusta.", "0BA60002"))
parts.append(body("Grammar X implementa corrección de desfase en el cliente: el servidor incluye su timestamp (serverTime) en cada mensaje de estado. El cliente calcula la diferencia entre su reloj local y el del servidor (clockOffset) y la aplica en cada tick del temporizador:", "0BA60003"))
parts.append(code_block([
    "// index.jsx — al recibir cualquier estado del servidor",
    "if (data.serverTime) {",
    "  clockOffset.current = Date.now() - data.serverTime;",
    "}",
    "",
    "// En el intervalo del temporizador (ejecuta cada 200 ms)",
    "const syncedNow = Date.now() - clockOffset.current;",
    "const left = Math.max(0,",
    "  data.timePerRound - (syncedNow - data.roundStartedAt) / 1000",
    ");",
    "setTimeLeft(left);",
    "",
    "// Si el reloj del dispositivo está +500 ms adelantado:",
    "// clockOffset = +500  =>  syncedNow = ahora - 500 aprox. tiempo del servidor",
], "0BA6A", 1))

# 2.7
parts.append(titulo2("2.7 Sistema de Sonido: Web Audio API", pid="0BA70001"))
parts.append(body("Todos los efectos de sonido y la música de fondo se generan por síntesis de audio directamente en el navegador, sin archivos externos. La función base tone() crea un oscilador (fuente de sonido), lo conecta a un nodo de ganancia (volumen) y programa su inicio y fin con precisión de microsegundos mediante la API de tiempo del AudioContext:", "0BA70002"))
parts.append(code_block([
    "// src/sounds.js",
    "function tone(type, freq, startT, dur, vol, freqEnd = null) {",
    "  const o = ctx.createOscillator();  // genera la onda sonora",
    "  const g = ctx.createGain();        // controla el volumen",
    "  o.connect(g); g.connect(ctx.destination);",
    "  o.type = type;  // 'sine' | 'square' | 'sawtooth' | 'triangle'",
    "  o.frequency.setValueAtTime(freq, startT);",
    "  if (freqEnd != null)",
    "    o.frequency.exponentialRampToValueAtTime(freqEnd, startT + dur * 0.88);",
    "  g.gain.setValueAtTime(vol, startT);",
    "  g.gain.exponentialRampToValueAtTime(0.0001, startT + dur * 0.92);",
    "  o.start(startT); o.stop(startT + dur + 0.05);",
    "}",
], "0BA7A", 1))
parts.append(body("Sobre esta función base se construyen todos los sonidos. El acorde de respuesta correcta encadena cuatro tonos sinusoidales en Do mayor ascendente (523, 659, 784, 1047 Hz con intervalos de 80 ms). El sonido de error usa una onda diente de sierra con glissando descendente de 230 a 95 Hz. La música de fondo es un bucle de 4.5 segundos: 24 notas en pentátonica de Do mayor (onda triangular, vol. 0.055) con línea de bajo de 8 notas (onda seno, vol. 0.07), reprogramadas automáticamente via setTimeout antes de que termine cada ciclo.", "0BA70003"))

# 2.8
parts.append(titulo2("2.8 Sistema de Puntuación Dinámico", bid=9, bname="_Toc230634524", pid="0BA80001"))
parts.append(body("La puntuación de cada respuesta combina la dificultad de la pregunta y la velocidad de respuesta. La fórmula implementada en el cliente es:", "0BA80002"))
parts.append(code_block([
    "// index.jsx",
    "function calcScore(correct, timeLeft, tpr, diff) {",
    "  if (!correct) return 0;",
    "  return diff * 100 + Math.round((timeLeft / tpr) * diff * 50);",
    "}",
    "// diff     : nivel de dificultad (1 a 5)",
    "// tpr      : tiempo total de la ronda en segundos",
    "// timeLeft : segundos restantes al momento de responder",
    "",
    "// Ejemplo con dificultad 5 y ronda de 20 s:",
    "// Responder al instante : 5x100 + (20/20)x5x50 = 750 pts",
    "// Responder al ultimo s : 5x100 + (1/20)x5x50  = 512 pts",
    "// Respuesta incorrecta  : 0 pts",
], "0BA8A", 1))
parts.append(body("El bono de velocidad va de 0 a diff×50 puntos, decreciendo linealmente con el tiempo transcurrido. Al finalizar, el servidor suma todas las puntuaciones via SQL, las persiste en la tabla scores y las devuelve ordenadas de mayor a menor para construir el podio.", "0BA80003"))

# 2.9
parts.append(titulo2("2.9 Arquitectura de Componentes React", pid="0BA90001"))
parts.append(body("La interfaz está organizada como una máquina de estados controlada por el componente raíz App. La variable screen determina qué pantalla se renderiza; las transiciones ocurren cuando los componentes hijos invocan callbacks que App les pasa como props:", "0BA90002"))
parts.append(code_block([
    "// App (index.jsx) — máquina de estados de navegación",
    "'login'         =>  LoginScreen        // selección de rol (host / jugador)",
    "'join'          =>  JoinScreen         // ingresar código de sala",
    "'host-lobby'    =>  HostLobbyScreen    // configurar y esperar jugadores",
    "'host-game'     =>  HostGameScreen     // dashboard durante la partida",
    "'host-results'  =>  HostResultsScreen  // podio final del host",
    "'player-lobby'  =>  PlayerLobbyScreen  // esperar + pantalla instrucciones",
    "'player-game'   =>  PlayerGameScreen   // responder preguntas",
    "'podium'        =>  PodiumScreen       // leaderboard histórico global",
], "0BA9A", 1))
parts.append(body("Los minijuegos G1 (ordenar palabras) y G2–G4 (opción múltiple) están encapsulados en componentes separados (QuestionG1 y QuestionMCQ) que reciben la ronda actual como prop y emiten un callback onAnswer con el resultado, manteniendo separada la lógica de presentación de la lógica de puntuación. Todos los estilos CSS se inyectan mediante la función injectCSS() en el head del documento al montar la app, eliminando archivos CSS externos y garantizando que el bundle de producción generado por Vite sea un único archivo JavaScript autocontenido.", "0BA90003"))

output = "\n".join(parts)
with open(r"C:\Users\Jonathan\Desktop\GrammarX\informe\new_desarrollo.xml", "w", encoding="utf-8") as f:
    f.write(output)
print(f"OK: {len(output.splitlines())} lines written")
