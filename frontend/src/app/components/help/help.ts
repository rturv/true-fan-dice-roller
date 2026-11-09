import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-help',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="help-page">
      <nav class="help-top">
        <a class="back-link" routerLink="/">← Volver a la mesa</a>
        <span class="help-badge">MANUAL OFICIAL</span>
      </nav>

      <header class="hero">
        <h1>TRUE FAN ROLL DICE: EL MANUAL</h1>
        <p class="lead">
          Todo lo que necesitas para no hacer el ridículo en tu primera partida. En la segunda
          tampoco prometemos nada.
        </p>
      </header>

      <section class="section">
        <h2>1. BIENVENIDO</h2>
        <p>
          Esto no es un simulador de rol con 400 páginas de trasfondo. Es una app para tirar dados,
          sacar cartas de la baraja española y reírte de tus colegas en tiempo real. Entras, montas
          una sala, compartes el código y a jugar.
        </p>
        <figure class="shot">
          <img src="/help/lobby.png" alt="Pantalla de acceso con nickname, código de sala y botón de unirse" loading="lazy" width="1100" height="800" />
          <figcaption>La puerta de entrada. No muerde.</figcaption>
        </figure>
        <p>
          Aqui entra lo justito, justito, para poder hacer tiradas para el <a href="https://shadowlands.es/fh-true-fan-system/">True Fan Dice System</a>. Las risas y el buen rollo las teneis que traer de casa.
        </p>
      </section>

      <section class="section">
        <h2>2. MONTA TU SALA EN 30 SEGUNDOS</h2>
        <ol class="steps">
          <li><strong>Escribe tu nickname.</strong> El que sea, pero que se te reconozca, copon. Nada de "xX_dark_Xx".</li>
          <li><strong>Pulsa "Crear mi propia Sala".</strong> Se genera un código de 7 caracteres.</li>
          <li><strong>Comparte el código.</strong> Clic en el código de la cabecera y se copia solo.</li>          
        </ol>
        <p class="tip">
          El primero que entra es el <strong>admin</strong> de la sala. No es un puesto de poder, pero
          mola decirlo en voz alta.
        </p>
        <p class="tip">
          Si los botones salen apagados y no te dejan hacer nada, mira el chivato de arriba:
          el backend todavía no está <strong>en línea</strong>. Dale unos segundos y vuelve a intentarlo.
        </p>
        <p>
          Si tienes amigos con los que querias echar unas tiradas en la misma, le tienes que pasar ese codigo de sala para que entren. Sino tienes amigos tampoco pasa nada, que aqui no juzgamos a nadie.
        </p>
      </section>

      <section class="section">
        <h2>3. TE HAN PASADO UN CÓDIGO</h2>
        <p>
          Nickname + código + <strong>Unirse a Sala</strong>. Ya está. No hay registro, no hay correo,
          no hay "verifica tu cuenta". Entras y punto, que tampoco es que esto sea la NASA.
        </p>
      </section>

      <section class="section">
        <h2>4. LA SALA DE UN VISTAZO</h2>
        <figure class="shot">
          <img src="/help/sala.png" alt="Sala de juego con una tirada de dados en el chat" loading="lazy" width="1100" height="800" />
          <figcaption>Aquí se viene a liarla.</figcaption>
        </figure>
        <div class="grid">
          <div class="card"><strong>Cabecera</strong><p>Código de sala, estado del backend, temas, jugadores, cartas y salir.</p></div>
          <div class="card"><strong>Chat</strong><p>Tiradas, cartas, mensajes y avisos del sistema. Todo queda en el historial reciente.</p></div>
          <div class="card"><strong>Barra inferior</strong><p>Reserva, número de dados, modificador, lanzar y sacar carta.</p></div>
          <div class="card"><strong>Comandos</strong><p>Escribe en el chat para tirar o sacar carta sin tocar los botones.</p></div>
        </div>
      </section>

      <section class="section">
        <h2>5. DADOS QUE EXPLOTAN</h2>
        <p>
          Se tiran dados de 6 caras. Y sí, explotan: cada <strong>6</strong> genera otra tirada
          automática. Un 6 seguido de otro 6 es una experiencia religiosa.
        </p>
        <ul class="bullets">
          <li><strong>Modificador:</strong> suma o resta al total (de -99 a +99).</li>
          <li><strong>Reserva:</strong> contador compartido de la sala. Se mueve con los botones o con <kbd>[</kbd> y <kbd>]</kbd>.</li>
          <li><strong>Dados:</strong> de 1 a 20. El total se calcula con todas las explosiones.</li>
        </ul>
        <figure class="shot">
          <img src="/help/carta.png" alt="Carta de la baraja española sacada en el chat, con el mazo restante" loading="lazy" width="1100" height="800" />
          <figcaption>El dado explota. La carta simplemente aparece y ya.</figcaption>
        </figure>
      </section>

      <section class="section">
        <h2>6. LA BARAJA</h2>
        <p class="lead">
                  Si, lo sabemos, era una regla opcional. Pero me mola y aqui el que progama la app soy yo. 
        </p>
        <p>
          50 naipes, incluidos los dos comodines. Cada robo descuenta del mazo y el chat te dice
          cuántos quedan. Cuando se acaba, se baraja y a seguir.
        </p>
        <ul class="bullets">
          <li>El admin puede <strong>desactivar las cartas</strong> si la partida va de solo dados.</li>
          <li>También puede <strong>barajar</strong> el mazo cuando toque.</li>
        </ul>
      </section>

      <section class="section">
        <h2>7. COMANDOS, CRACK</h2>
        <p>
          La barra de chat también obedece. Escribe un comando y pulsa Enter. Si no encaja con
          ninguno, se manda como mensaje normal y no pasa nada.
        </p>
        <table class="commands">
          <thead>
            <tr><th>Comando</th><th>Qué hace</th></tr>
          </thead>
          <tbody>
            <tr><td><code>/carta</code></td><td>Saca una carta de la baraja</td></tr>
            <tr><td><code>/roll</code></td><td>Tira con los dados y modificador que tengas puestos</td></tr>
            <tr><td><code>/3d6+3</code></td><td>Tira 3 dados con +3 y deja los controles listos</td></tr>
            <tr><td><code>/2d6-4</code></td><td>Tira 2 dados con -4</td></tr>
            <tr><td><code>/d6</code></td><td>Un solo dado</td></tr>
          </tbody>
        </table>
        <p class="muted">Mayúsculas y espacios dan igual: <code>/CARTA</code> y <code>/ 3d6 + 3</code> también valen.</p>
        <figure class="shot">
          <img src="/help/comandos.png" alt="Barra de chat mostrando la ayuda de comandos al escribir una barra" loading="lazy" width="1100" height="800" />
          <figcaption>Escribe "/" y la app te chiva los comandos.</figcaption>
        </figure>
      </section>

      <section class="section">
        <h2>8. MODO ADMIN</h2>
        <p>El admin de la sala tiene tres botones extra. Úsalos con cabeza (o no).</p>
        <ul class="bullets">
          <li><strong>Cartas on/off:</strong> activa o desactiva el mazo para todos.</li>
          <li><strong>Barajar:</strong> rebaraja los 50 naipes.</li>
          <li><strong>Expulsar:</strong> manda a alguien a la calle. Sin drama, luego puede volver.</li>
        </ul>
      </section>

      <section class="section">
        <h2>9. PONTE GUAPO</h2>
        <p>
          14 temas: del clásico rojo al verde Matrix, pasando por pergamino, sakura, Drácula o
          playeo. El que elijas se queda guardado en tu navegador.
        </p>
        <figure class="shot">
          <img src="/help/temas.png" alt="Selector de temas de la sala con varias opciones" loading="lazy" width="1100" height="800" />
          <figcaption>El mismo juego, 14 personalidades.</figcaption>
        </figure>
      </section>

      <section class="section">
        <h2>10. ¿QUIÉN ANDA AHÍ?</h2>
        <p>
          Pulsa el contador de <strong>Jugadores</strong> de la cabecera y verás la lista de los que
          están conectados, en orden de llegada. Tu nick sale marcado como <em>tú</em>.
        </p>
        <figure class="shot">
          <img src="/help/jugadores.png" alt="Listado de jugadores conectados desplegado desde la cabecera" loading="lazy" width="1100" height="800" />
          <figcaption>Aquí no hay espías: están todos los que son.</figcaption>
        </figure>
      </section>

      <section class="section">
        <h2>11. SI ALGO PETA</h2>
        <p>
          En el lobby y en la cabecera de la sala tienes un chivato con el estado del backend:
          <strong>Comprobando…</strong>, <strong>Backend en línea</strong> o <strong>Sin conexión</strong>.
          Con el punto verde, adelante. Si pone "Sin conexión", no entres en pánico: en los hostings
          gratuitos el backend se echa la siesta y tarda en arrancar. Espera tranquilamente
          <strong>30-60 segundos</strong>; la app vuelve a comprobar sola cada 15 segundos.
        </p>
        <ul class="bullets">
          <li><strong>Sigue sin conexión después de un par de minutos:</strong> entonces sí, algo se ha roto. Avisa a quien haya montado el tinglado.</li>
          <li><strong>Recargas la página:</strong> la sesión se recupera si el token no ha caducado (dura 60 minutos).</li>
          <li><strong>Te sale "Not Found" al refrescar:</strong> es el hosting, no tú. El sitio estático necesita una regla de rewrite; avisa a quien corresponda.</li>
          <li><strong>El móvil va raro:</strong> prueba a girarlo o a cerrar pestañas. La sala se adapta, pero no hace milagros.</li>
        </ul>
        <figure class="shot narrow">
          <img src="/help/movil.png" alt="Vista de la sala en un móvil estrecho" loading="lazy" width="380" height="800" />
          <figcaption>En el móvil también se juega.</figcaption>
        </figure>
      </section>

      <section class="section">
        <h2>12. SECRETOS DE LA CASA</h2>
        <p>
          Hay cosas que no están en este manual. Comandos raros, efectos que salen cuando menos
          te lo esperas y algún que otro guiño. Si descubres algo, no lo revientes en el chat.
        </p>
        <p class="secret">// sigue jugando //</p>
      </section>

      <footer class="help-footer">
        <a class="back-link" routerLink="/">← Volver a la mesa</a>
        <p class="muted">Hecho con dados, cartas y malas decisiones.</p>
      </footer>
    </div>
  `,
  styles: `
    :host {
      display: block;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      overflow-y: auto;
      background: var(--bg);
      color: var(--fg);
    }

    .help-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 28px 20px 64px;
    }

    .help-top {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3); margin-bottom: 18px;
    }

    .back-link {
      color: var(--accent); text-decoration: none; font-weight: 600;
      font-size: 14px; padding: 6px 10px; border-radius: var(--radius-sm);
      transition: background var(--motion-fast);
    }
    .back-link:hover { background: var(--surface); }

    .help-badge {
      font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em;
      color: var(--meta); border: 1px solid var(--border-soft);
      border-radius: var(--radius-pill); padding: 3px 10px;
    }

    .hero { text-align: center; padding: 18px 0 6px; }
    .hero h1 {
      font-family: "Bangers", "Impact", "Arial Black", sans-serif;
      font-size: clamp(40px, 8vw, 72px); line-height: 0.95;
      letter-spacing: 0.04em; color: var(--accent);
      margin: 0 0 10px; transform: rotate(-1.5deg);
      text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.18);
    }
    .lead { color: var(--fg-2); font-size: 15px; max-width: 640px; margin: 0 auto; }

    .section { margin-top: 42px; }
    .section h2 {
      font-family: "Bangers", "Impact", "Arial Black", sans-serif;
      font-size: clamp(24px, 4vw, 34px); letter-spacing: 0.03em;
      color: var(--fg); margin: 0 0 10px; line-height: 1.05;
    }
    .section p { color: var(--fg-2); font-size: 15px; line-height: 1.6; margin-bottom: 10px; }
    .section p:last-child { margin-bottom: 0; }

    .steps { margin: 12px 0 16px; padding-left: 22px; color: var(--fg-2); font-size: 15px; }
    .steps li { margin-bottom: 8px; }

    .bullets { margin: 10px 0 14px; padding-left: 20px; color: var(--fg-2); font-size: 15px; }
    .bullets li { margin-bottom: 7px; }

    .grid {
      display: grid; gap: 12px; margin-top: 14px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .card {
      background: var(--surface); border: 1px solid var(--border-soft);
      border-radius: var(--radius-md); padding: 14px 16px;
    }
    .card strong { color: var(--fg); font-size: 14px; }
    .card p { margin: 4px 0 0; font-size: 13px; color: var(--muted); }

    .tip {
      background: color-mix(in oklab, var(--accent) 9%, var(--surface));
      border-left: 4px solid var(--accent);
      border-radius: var(--radius-sm); padding: 10px 14px;
      font-size: 14px; color: var(--fg-2);
    }

    .shot { margin: 16px 0 4px; }
    .shot img {
      display: block; width: 100%; height: auto;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
      background: var(--surface);
    }
    .shot.narrow { max-width: 380px; margin-left: auto; margin-right: auto; }
    .shot figcaption {
      margin-top: 7px; text-align: center;
      font-size: 12px; color: var(--muted);
    }

    .commands { width: 100%; border-collapse: collapse; margin: 14px 0 10px; font-size: 14px; }
    .commands th, .commands td {
      text-align: left; padding: 8px 10px;
      border-bottom: 1px solid var(--border-soft);
    }
    .commands th {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--meta); font-weight: 600;
    }
    .commands td { color: var(--fg-2); }
    .commands code {
      font-family: var(--font-mono); font-size: 12px;
      color: var(--accent); background: var(--surface);
      padding: 2px 6px; border-radius: 4px;
    }

    code {
      font-family: var(--font-mono); font-size: 0.92em;
      background: var(--surface); padding: 1px 5px; border-radius: 4px;
    }
    kbd {
      font-family: var(--font-mono); font-size: 12px;
      background: var(--bg); border: 1px solid var(--border);
      border-bottom-width: 2px; border-radius: 4px; padding: 1px 6px;
    }

    .muted { color: var(--muted) !important; font-size: 13px !important; }

    .secret {
      font-family: var(--font-mono); font-size: 12px;
      color: var(--meta); text-align: center; letter-spacing: 0.14em;
      margin-top: 14px;
    }

    .help-footer {
      margin-top: 54px; padding-top: 20px;
      border-top: 1px solid var(--border-soft);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }

    @media (max-width: 600px) {
      .help-page { padding: 18px 14px 48px; }
      .help-top { flex-direction: column; align-items: flex-start; }
    }
  `,
})
export class HelpComponent {}
