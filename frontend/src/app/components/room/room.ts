import { Component, ChangeDetectionStrategy, signal, computed, AfterViewInit, ElementRef, viewChild, effect, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { WebsocketService } from '../../services/websocket';
import { BackendHealthService } from '../../services/backend-health';
import { BackendStatusIndicatorComponent } from '../backend-status-indicator/backend-status-indicator';
import type {
  ChatDisplayEntry, DiceResult, CardInfo,
  JoinedMessage, DiceRollMessage, CardDrawMessage,
  TextMessage, UserJoinedMessage, UserLeftMessage,
  UserKickedMessage, AdminChangedMessage, DeckReshuffledMessage,
  UserListMessage, HistoryEntry, DrawResult, PoolUpdatedMessage, CardsToggledMessage
} from '../../models/game.models';
import { parseChatCommand } from './chat-commands';
import { EasterEggComponent } from './easter-egg/easter-egg';
import {
  nextEasterEgg,
  readEasterEggIndex,
  writeEasterEggIndex,
  type EasterEggEffect,
} from './easter-egg/rotation';

@Component({
  selector: 'app-room',
  imports: [DatePipe, BackendStatusIndicatorComponent, EasterEggComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'room-page',
    '(window:keydown)': 'onKeydown($event)',
    '(window:resize)': 'onResize()',
    '(document:click)': 'onDocumentClick($event)'
  },
  template: `
    <header class="app-header">
      <div class="app-header-inner">
        <span class="app-logo" title="True Fan Dice Roller">
          <span class="logo-full">True Fan Dice Roller</span>
          <span class="logo-abbr">T.F.C.R.</span>
        </span>
        <span class="room-code" (click)="copyRoomCode()" title="Click para copiar">{{ copied() ? 'Copiado!' : roomCode() }}</span>
        <div class="header-right" #headerRight>
        <app-backend-status-indicator compactMobile />
        <button
          type="button"
          class="header-menu-btn"
          (click)="toggleHeaderMenu()"
          [attr.aria-expanded]="headerMenuOpen()"
          aria-haspopup="true"
          aria-controls="header-menu"
          aria-label="Menú de la sala"
          title="Menú"
        >☰</button>
        <div class="header-controls" id="header-menu" [class.menu-open]="headerMenuOpen()">
          <div class="style-picker">
            <label>Tema</label>
            <select [value]="currentStyle()" (change)="setStyle($any($event.target).value)">
              <option value="classic">Clasico</option>
              <option value="alejo">Alejo</option>
              <option value="ocean">Ocean</option>
              <option value="sunset">Tardeo</option>
              <option value="forest">Bosque</option>
              <option value="pergamino">Pergamino</option>
              <option value="sakura">Sakura</option>
              <option value="neon">Neon</option>
              <option value="playeo">Playeo</option>
              <option value="dracula">Dracula</option>
              <option value="halloween">Halloween</option>
              <option value="matrix">Matrix</option>
              <option value="batman">Batman</option>
              <option value="spaceship">Espacial</option>
            </select>
          </div>
          @if (connectedUsers().length > 0) {
            <div class="user-picker-wrap" #playersWrap>
              <button
                #playersButton
                type="button"
                class="user-picker"
                (click)="togglePlayers()"
                [attr.aria-expanded]="playersOpen()"
                aria-haspopup="true"
                aria-controls="players-popover"
                [attr.aria-label]="'Jugadores conectados: ' + connectedUsers().length"
              >
                <span class="user-picker-label">Jugadores</span>
                <span class="user-count">{{ connectedUsers().length }}</span>
                <span class="user-chevron" aria-hidden="true">▾</span>
              </button>
              @if (playersOpen()) {
                <div class="players-popover" id="players-popover" [style]="playersPopoverStyle()">
                  <div class="players-popover-title">Jugadores conectados</div>
                  <ul class="players-list">
                    @for (user of connectedUsers(); track user) {
                      <li class="player-item" [class.is-self]="user === myNickname()">
                        <span class="player-avatar" aria-hidden="true">{{ user.charAt(0).toUpperCase() }}</span>
                        <span class="player-name">{{ user }}</span>
                        @if (user === myNickname()) {
                          <span class="player-you">tú</span>
                        }
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
          }
          @if (isAdmin()) {
            <label class="cards-toggle" title="Activar/desactivar cartas">
              <span class="cards-toggle-label">Cartas</span>
              <input type="checkbox" [checked]="cardsEnabled()" (change)="doToggleCards()" />
              <span class="cards-toggle-switch"></span>
            </label>
            <button class="admin-menu-btn" (click)="doReshuffle()" [disabled]="!backendOnline()" title="Reiniciar Baraja">
              <span aria-hidden="true">⟳</span>
              <span class="menu-label">Reiniciar baraja</span>
            </button>
          }
          <a class="help-btn" href="/ayuda" target="_blank" rel="noopener" title="Manual de usuario" aria-label="Abrir el manual de usuario" (click)="headerMenuOpen.set(false)">
            <span aria-hidden="true">?</span>
            <span class="menu-label">Ayuda</span>
          </a>
          <button class="logout-btn" (click)="doLogout()" title="Salir de la sala" aria-label="Salir de la sala">
            <span aria-hidden="true">✕</span>
            <span class="menu-label">Salir de la sala</span>
          </button>
        </div>
        </div>
      </div>
    </header>

    <main class="chat-log" #chatLog>
      <div class="chat-log-inner">
        @if (entries().length === 0) {
          <div class="welcome-prompt">
            <h2>¡Vamos a Lanzar dados!</h2>
            <p>Puedes escribir mensajes, lanzar dados o sacar cartas de la baraja española. Hacer click en el codigo de la sala te deja copiarlo para pasarlo a tus coleguis.</p>
            <div class="example-dice">
              <span class="die">1</span>
              <span class="die">3</span>
              <span class="die pip-6">6</span>
              <span class="die">2</span>
              <span class="die">5</span>
              <span class="die">4</span>
            </div>
            @if (!wsConnected()) {
              <div class="connecting-msg">Conectando al servidor...</div>
            }
          </div>
        }

        @for (entry of entries(); track entry.id) {
          @if (entry.type === 'dice_roll') {
            <div class="roll-entry fade-in" [class.self-roll]="entry.isSelf">
              <div class="roll-entry-header">
                <span class="roll-user">{{ entry.nickname }}@if (entry.isSelf) {<span class="badge-you">you</span>}<span class="roll-formula">{{ rollFormula(entry.result!) }}</span></span>
                <span class="roll-time">{{ entry.timestamp | date:'HH:mm' }}</span>
              </div>
              <div class="dice-row">
                @for (val of entry.result!.values; track $index) {
                  @if ($index === entry.result!.initialCount) { <span class="roll-detail">+</span> }
                  <span class="die" [class.pip-6]="val === 6" [class.added]="$index >= entry.result!.initialCount">{{ val }}</span>
                }
                @if (entry.result!.explosions > 0) {
                  <span class="roll-explosion">EXPLOTAN {{ entry.result!.explosions }}</span>
                }
              </div>
              <div class="roll-summary">
                <span class="roll-total">= {{ entry.result!.total }}</span>
                <span class="roll-detail">{{ entry.result!.values.length }} die{{ entry.result!.values.length !== 1 ? 's' : '' }}
                  @if (entry.result!.modifier !== 0) {
                    ({{ entry.result!.diceTotal }}{{ entry.result!.modifier >= 0 ? '+' : '' }}{{ entry.result!.modifier }})
                  }
                </span>
                @if (entry.result!.modifier !== 0) {
                  <span class="roll-modifier" [class.positive]="entry.result!.modifier > 0" [class.negative]="entry.result!.modifier < 0">
                    {{ entry.result!.modifier > 0 ? '+' : '' }}{{ entry.result!.modifier }} mod
                  </span>
                }
              </div>
            </div>
          } @else if (entry.type === 'card_draw') {
            <div class="roll-entry fade-in" [class.self-roll]="entry.isSelf">
              <div class="roll-entry-header">
                <span class="roll-user">{{ entry.nickname }}@if (entry.isSelf) {<span class="badge-you">you</span>}</span>
                <span class="roll-time">{{ entry.timestamp | date:'HH:mm' }}</span>
              </div>
              <div class="card-draw-wrap">
                <div class="spanish-card" [class.joker-card]="entry.card?.kind === 'joker'" [class.suit-oros]="entry.card?.suit === 'oros'" [class.suit-copas]="entry.card?.suit === 'copas'" [class.suit-espadas]="entry.card?.suit === 'espadas'" [class.suit-bastos]="entry.card?.suit === 'bastos'">
                  <div class="card-corner top">
                    <span>{{ entry.card!.kind === 'joker' ? '★' : entry.card!.rank }}</span>
                    @if (entry.card!.kind === 'joker') {
                      <span class="card-corner-mark">☆</span>
                    } @else {
                      <span class="card-corner-mark"><img [src]="suitIcon(entry.card!.suit!)" alt="" /></span>
                    }
                  </div>
                  <div class="card-corner bottom">
                    <span>{{ entry.card!.kind === 'joker' ? '★' : entry.card!.rank }}</span>
                    @if (entry.card!.kind === 'joker') {
                      <span class="card-corner-mark">☆</span>
                    } @else {
                      <span class="card-corner-mark"><img [src]="suitIcon(entry.card!.suit!)" alt="" /></span>
                    }
                  </div>
                  <div class="card-center">
                    @if (entry.card!.kind === 'joker') {
                      <span class="card-suit-glyph">🃏</span>
                    } @else {
                      <span class="card-suit-glyph"><img [src]="suitIcon(entry.card!.suit!)" alt="" /></span>
                    }
                    <span class="card-suit-label">{{ entry.card!.kind === 'joker' ? 'Comodín' : entry.card!.suitName }}</span>
                  </div>
                </div>
                <div class="card-copy">
                  <div class="card-title">{{ entry.card!.label }}</div>
                  <div class="card-meta">{{ entry.card!.kind === 'joker' ? 'Comodín de la baraja española' : 'Carta sacada de la baraja española' }}</div>
                  <div class="deck-pill">Mazo <strong>{{ entry.remaining }}</strong> restantes</div>
                  @if (entry.reshuffledNext) {
                    <div class="card-meta">El siguiente robo volverá a barajar los 50 naipes.</div>
                  }
                </div>
              </div>
            </div>
          } @else if (entry.type === 'text_message') {
            <div class="roll-entry fade-in msg-entry" [class.self-roll]="entry.isSelf">
              <div class="roll-entry-header">
                <span class="roll-user">{{ entry.nickname }}@if (entry.isSelf) {<span class="badge-you">you</span>}</span>
                <span class="roll-time">{{ entry.timestamp | date:'HH:mm' }}</span>
              </div>
              <div class="msg-text">{{ entry.text }}</div>
            </div>
           } @else if (entry.type === 'system' || entry.type === 'user_joined' || entry.type === 'user_left' || entry.type === 'user_kicked' || entry.type === 'admin_changed' || entry.type === 'deck_reshuffled' || entry.type === 'pool_updated' || entry.type === 'cards_toggled') {
            <div class="entry-connector">{{ systemMessage(entry) }}</div>
          }
        }
      </div>
    </main>

    <div class="chat-input-bar">
      <input class="chat-input" type="text" [value]="chatText()" (input)="chatText.set($any($event.target).value)" (keydown.enter)="doSendMessage()" placeholder="Escribe un mensaje..." maxlength="500" />
      <button class="chat-send-btn" (click)="doSendMessage()" [disabled]="!chatText().trim() || !wsConnected() || !backendOnline()">Enviar</button>
      @if (chatText().trim().startsWith('/')) {
        <div class="cmd-hint">Comandos: <code>/carta</code> · <code>/roll</code> · <code>/3d6+3</code></div>
      }
    </div>

    <footer class="controls-bar">
      <div class="controls-inner">
        <div class="pool-control">
          <span class="pool-label">Reserva</span>
          <div class="pool-value-wrap">
            <button class="pool-btn" (click)="doPoolDelta(-1)" [disabled]="poolValue() <= 0 || !backendOnline()" aria-label="Decrement pool">−</button>
            <span class="pool-value" [class.pool-empty]="poolValue() === 0" [class.pool-filled]="poolValue() > 0">{{ poolValue() }}</span>
            <button class="pool-btn" (click)="doPoolDelta(1)" [disabled]="!backendOnline()" aria-label="Increment pool">+</button>
            @if (isAdmin()) {
              <button class="pool-edit-btn" (click)="openPoolModal()" [disabled]="!backendOnline()" title="Set pool value">✎</button>
            }
          </div>
        </div>
        <div class="dice-counter">
          <button (click)="decDice()" aria-label="Fewer dice">−</button>
          <div class="dice-count-display">
            <span class="count-label">{{ diceCount() }}</span>
            <span class="dice-label">d6</span>
          </div>
          <button (click)="incDice()" aria-label="More dice">+</button>
        </div>
        <div class="modifier-control">
          <span class="mod-label">±</span>
          <input type="number" [value]="modifier()" (input)="setModifier($any($event.target).value)" min="-99" max="99" placeholder="0" aria-label="Roll modifier" />
        </div>
        <button class="roll-btn" [class.rolling]="isRolling()" (click)="doRoll()" [disabled]="isRolling() || !wsConnected() || !backendOnline()" aria-label="Lanzar dados" title="Lanzar dados">
          <span class="roll-icon" aria-hidden="true"></span>
          <span class="btn-label">Lanzar</span>
        </button>
        <button class="draw-card-btn" (click)="doDrawCard()" [disabled]="isRolling() || !wsConnected() || !backendOnline() || !cardsEnabled()" aria-label="Sacar carta" [title]="!cardsEnabled() ? 'Cartas desactivadas por el admin' : 'Sacar carta'">
          <span class="draw-card-icon" aria-hidden="true"></span>
          <span class="btn-label">¡Carta!</span>
        </button>
        @if (isAdmin()) {
          <button class="admin-btn" (click)="doReshuffle()" [disabled]="!backendOnline()" title="Reiniciar Baraja">⟳</button>
        }
      </div>
    </footer>

    @if (poolModalOpen()) {
      <div class="pool-modal-overlay" (click)="closePoolModal()">
        <div class="pool-modal" (click)="$event.stopPropagation()">
          <h3 class="pool-modal-title">Fijar Reserva</h3>
          <input class="pool-modal-input" type="number" [value]="poolModalInput()" (input)="poolModalInput.set($any($event.target).value)" min="0" placeholder="0" autofocus (keydown.enter)="doPoolSet()" />
          @if (poolModalError()) {
            <p class="pool-modal-error">{{ poolModalError() }}</p>
          }
          <div class="pool-modal-actions">
            <button class="pool-modal-btn cancel" (click)="closePoolModal()">Cancelar</button>
            <button class="pool-modal-btn set" (click)="doPoolSet()">Fijar</button>
          </div>
        </div>
      </div>
    }

    @if (easterEggActive()) {
      <app-easter-egg [effect]="easterEggEffect()" (done)="easterEggActive.set(false)" />
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }

    .app-header {
      flex-shrink: 0;
      background: var(--header-bg);
      box-shadow: var(--header-glow);
      padding: var(--space-4) var(--space-6);
    }
    .app-header-inner {
      max-width: 1200px; margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
    }
    .app-logo {
      font-family: "Bangers", "Impact", "Arial Black", sans-serif;
      font-size: 38px; font-weight: 400;
      color: var(--logo-fg); letter-spacing: 0.08em;
      line-height: 1; text-transform: uppercase;
      text-shadow: var(--logo-shadow);
      transform: rotate(-2deg) skewX(-3deg);
      display: inline-block; padding: 4px 12px;
      white-space: nowrap; flex-shrink: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%);
      border-radius: 4px;
    }
    .logo-abbr { display: none; }
    .room-code {
      font-family: var(--font-mono); font-size: 14px; color: var(--header-fg);
      background: var(--header-surface); padding: 4px 12px; border-radius: 6px;
      letter-spacing: 0.15em; font-weight: 600; cursor: pointer;
      user-select: all; transition: background var(--motion-fast);
    }
    .room-code:hover { background: var(--header-surface-hover); }
    .header-right {
      display: flex; align-items: center; gap: var(--space-3);
      min-width: 0;
    }
    .header-controls {
      display: flex; align-items: center; gap: var(--space-3);
      flex-wrap: wrap; justify-content: flex-end; min-width: 0;
    }
    .header-menu-btn {
      display: none; width: 40px; height: 40px; border-radius: var(--radius-sm);
      border: none; background: var(--header-surface); color: var(--header-fg);
      font-size: 18px; cursor: pointer; place-items: center; flex-shrink: 0;
    }
    .menu-label { display: none; }
    .admin-menu-btn { display: none; }
    .user-picker-wrap { position: relative; display: inline-flex; }
    .user-picker, .style-picker {
      display: flex; align-items: center; gap: var(--space-2);
      background: var(--header-surface); border-radius: var(--radius-md);
      border: 1px solid var(--header-border);
      padding: var(--space-1) var(--space-3); backdrop-filter: blur(8px);
    }
    .user-picker {
      font: inherit; color: var(--header-fg); cursor: pointer; appearance: none;
      transition: background var(--motion-fast) var(--ease-standard);
    }
    .user-picker:hover { background: var(--header-surface-hover); }
    .user-picker-label, .style-picker label {
      font-size: 12px; color: var(--header-fg-muted); font-weight: 500; white-space: nowrap;
    }
    .user-chevron {
      font-size: 10px; line-height: 1; color: var(--header-fg-muted);
      transition: transform var(--motion-fast) var(--ease-standard);
    }
    .user-picker[aria-expanded='true'] .user-chevron { transform: rotate(180deg); }
    .style-picker select {
      background: transparent; border: 1px solid var(--header-border);
      color: var(--header-fg); border-radius: var(--radius-sm);
      padding: 4px 28px 4px 10px; font-size: 13px; font-weight: 600;
      appearance: none; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 8px center;
    }
    .style-picker select option { color: var(--fg); background: var(--bg); }
    .user-count {
      font-family: var(--font-mono); font-size: 13px; color: var(--header-fg); font-weight: 700;
    }

    /* Players popover */
    .players-popover {
      position: fixed; z-index: 60;
      min-width: 180px; max-width: 260px;
      background: var(--bg); color: var(--fg);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
      padding: var(--space-2);
      animation: popover-in 140ms var(--ease-standard);
    }
    .players-popover-title {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--meta); padding: 2px 8px 6px;
    }
    .players-list { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto; }
    .player-item {
      display: flex; align-items: center; gap: var(--space-2);
      padding: 6px 8px; border-radius: var(--radius-sm); font-size: 13px;
    }
    .player-item:hover { background: var(--surface); }
    .player-item.is-self { font-weight: 600; }
    .player-avatar {
      width: 24px; height: 24px; border-radius: 50%; flex: 0 0 auto;
      display: grid; place-items: center;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      background: color-mix(in oklab, var(--accent) 18%, var(--surface));
      color: var(--accent);
    }
    .player-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .player-you {
      margin-left: auto; font-family: var(--font-mono); font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent);
    }
    @keyframes popover-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Cards toggle */
    .cards-toggle {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 2px 10px; border-radius: var(--radius-sm);
      background: var(--header-surface); cursor: pointer;
      user-select: none; height: 32px;
    }
    .cards-toggle-label {
      font-size: 11px; color: var(--header-fg); font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .cards-toggle input { display: none; }
    .cards-toggle-switch {
      width: 32px; height: 18px; background: var(--header-border);
      border-radius: 9999px; position: relative; transition: background 120ms;
    }
    .cards-toggle-switch::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 14px; height: 14px; border-radius: 50%;
      background: var(--header-fg); transition: transform 120ms;
    }
    .cards-toggle input:checked + .cards-toggle-switch { background: var(--success); }
    .cards-toggle input:checked + .cards-toggle-switch::after { transform: translateX(14px); }
    .cards-toggle:hover { background: var(--header-surface-hover); }

    /* Logout */
    .logout-btn, .help-btn {
      width: 40px; height: 40px; border-radius: var(--radius-sm); border: none;
      background: var(--header-surface); backdrop-filter: blur(8px);
      color: var(--header-fg); font-size: 18px; cursor: pointer;
      display: grid; place-items: center;
      transition: background var(--motion-fast); flex-shrink: 0;
    }
    .help-btn { text-decoration: none; font-family: var(--font-display); font-weight: 700; }
    .logout-btn:hover, .help-btn:hover { background: var(--header-surface-hover); }

    .chat-log {
      flex: 1; overflow-y: auto; padding: var(--space-5) var(--space-6);
      scroll-behavior: smooth;
    }
    .chat-log-inner {
      max-width: 680px; margin: 0 auto;
      display: flex; flex-direction: column; gap: var(--space-3);
    }
    .chat-log::-webkit-scrollbar { width: 6px; }
    .chat-log::-webkit-scrollbar-track { background: transparent; }
    .chat-log::-webkit-scrollbar-thumb { background: var(--border-soft); border-radius: 9999px; }

    .roll-entry {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: var(--space-4) var(--space-6);
      transition: opacity var(--motion-base) var(--ease-standard);
    }
    .roll-entry.self-roll { background: var(--bg); border-width: 2px; }
    .roll-entry-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: var(--space-3); gap: var(--space-2);
    }
    .roll-user { font-weight: 600; font-size: 14px; color: var(--fg); }
    .roll-formula {
      font-family: var(--font-mono); font-size: 11px; font-weight: 400;
      color: var(--meta); margin-left: 6px; white-space: nowrap;
    }
    .badge-you {
      display: inline-block; background: var(--success); color: white;
      font-size: 10px; font-family: var(--font-mono); text-transform: uppercase;
      letter-spacing: 0.05em; padding: 1px 8px; border-radius: var(--radius-sm);
      margin-left: 6px; vertical-align: middle;
    }
    .roll-time { font-family: var(--font-mono); font-size: 12px; color: var(--meta); }
    .dice-row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin-bottom: var(--space-2); }
    .die {
      display: flex; align-items: center; justify-content: center;
      width: 42px; height: 42px;
      background: linear-gradient(145deg, var(--surface) 0%, var(--bg) 100%);
      border: 2px solid var(--border); border-radius: 6px;
      font-family: var(--font-display); font-size: 20px; font-weight: 700;
      color: var(--fg);
      box-shadow: inset 1px 1px 0 rgba(255,255,255,0.4), inset -1px -1px 0 rgba(0,0,0,0.08), 2px 3px 4px rgba(0,0,0,0.15);
      transform: rotate(-1deg);
    }
    .die:nth-child(even) { transform: rotate(1.5deg); }
    .die:nth-child(3n) { transform: rotate(-0.5deg); }
    .die.pip-6 { background: linear-gradient(145deg, color-mix(in oklch, var(--accent) 18%, var(--surface)), color-mix(in oklch, var(--accent) 10%, var(--bg))); border-color: var(--accent); color: var(--accent); }
    .die.added { border-color: var(--accent); border-style: dashed; }
    .roll-summary { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
    .roll-total { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--fg); }
    .roll-detail { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
    .roll-explosion { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-size: 11px; color: var(--success); text-transform: uppercase; }
    .roll-modifier { font-family: var(--font-mono); font-size: 12px; }
    .roll-modifier.positive { color: var(--success); }
    .roll-modifier.negative { color: var(--danger); }

    .entry-connector {
      text-align: center; padding: var(--space-2) 0;
      font-family: var(--font-mono); font-size: 11px; color: var(--meta); text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .welcome-prompt { text-align: center; padding: var(--space-12) var(--space-4); color: var(--muted); }
    .welcome-prompt h2 { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--fg); margin: 0 0 var(--space-2); }
    .welcome-prompt p { font-size: 15px; max-width: 36ch; margin: 0 auto var(--space-4); }
    .welcome-prompt .example-dice { display: inline-flex; gap: var(--space-2); justify-content: center; }
    .welcome-prompt .example-dice .die { width: 38px; height: 38px; font-size: 18px; transform: rotate(0deg); }
    .connecting-msg { margin-top: 16px; font-size: 13px; color: var(--meta); }
    .msg-entry .msg-text { font-size: 14px; color: var(--fg); line-height: 1.5; }

    .chat-input-bar {
      flex-shrink: 0; display: flex; flex-wrap: wrap; gap: var(--space-2);
      padding: var(--space-2) var(--space-6); border-top: 1px solid var(--border-soft);
      background: var(--bg);
    }
    .cmd-hint {
      flex-basis: 100%;
      font-size: 12px; color: var(--muted); line-height: 1.2;
      padding: 0 2px;
    }
    .cmd-hint code {
      font-family: var(--font-mono); font-size: 11px;
      color: var(--fg-2); background: var(--surface);
      padding: 1px 5px; border-radius: 4px;
    }
    .chat-input {
      flex: 1; height: 38px; border-radius: var(--radius-sm);
      border: 1px solid var(--border); background: var(--surface);
      color: var(--fg); font-size: 14px; padding: 0 12px; outline: none;
    }
    .chat-input:focus { border-color: var(--accent); }
    .chat-send-btn {
      height: 38px; border-radius: var(--radius-sm); border: none;
      background: var(--accent); color: var(--accent-on);
      font-size: 13px; font-weight: 600; padding: 0 16px; cursor: pointer;
      transition: opacity var(--motion-fast);
    }
    .chat-send-btn:hover { opacity: 0.9; }
    .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .controls-bar {
      flex-shrink: 0; border-top: 1px solid var(--border);
      background: var(--bg); padding: var(--space-4) var(--space-6);
    }
    .controls-inner {
      max-width: 680px; margin: 0 auto;
      display: flex; align-items: center; gap: var(--space-4);
    }
    .dice-counter {
      display: flex; align-items: center; gap: var(--space-2);
      background: var(--surface); border-radius: var(--radius-md);
      padding: var(--space-1); border: 1px solid var(--border);
    }
    .dice-counter button {
      width: 36px; height: 36px; border-radius: var(--radius-sm);
      border: none; background: transparent; font-size: 18px; font-weight: 600;
      color: var(--fg); display: grid; place-items: center; cursor: pointer;
      transition: background var(--motion-fast) var(--ease-standard);
    }
    .dice-counter button:hover { background: var(--surface); }
    .dice-counter .count-label { font-family: var(--font-display); font-size: 20px; font-weight: 700; min-width: 36px; text-align: center; color: var(--fg); }
    .dice-counter .dice-label { font-size: 13px; color: var(--muted); font-weight: 500; padding-right: var(--space-2); }
    .modifier-control {
      display: flex; align-items: center; gap: var(--space-2);
      background: var(--surface); border-radius: var(--radius-md);
      padding: var(--space-1) var(--space-3); border: 1px solid var(--border);
    }
    .modifier-control .mod-label { font-size: 13px; color: var(--muted); font-weight: 500; }
    .modifier-control input {
      width: 56px; height: 36px; border-radius: var(--radius-sm);
      border: 1px solid var(--border); background: var(--bg); color: var(--fg);
      font-family: var(--font-display); font-size: 16px; font-weight: 700;
      text-align: center; padding: 0 var(--space-2);
    }
    .modifier-control input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
    .roll-btn, .draw-card-btn {
      height: 48px; border-radius: var(--radius-md); border: none;
      font-family: var(--font-display); font-weight: 700; font-size: 18px;
      letter-spacing: -0.01em; cursor: pointer;
      transition: background var(--motion-fast) var(--ease-standard), transform 0.05s ease;
      display: flex; align-items: center; justify-content: center; gap: var(--space-2);
    }
    .roll-btn {
      flex: 1; background: var(--accent); color: var(--accent-on);
      padding: 0 var(--space-8);
    }
    .roll-btn:hover { background: color-mix(in oklab, var(--accent), black 8%); }
    .roll-btn:active { transform: translateY(1px); }
    .roll-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .roll-btn .roll-icon {
      display: inline-block; width: 20px; height: 20px;
      border: 2px solid var(--accent-on); border-radius: var(--radius-sm);
    }
    .roll-btn.rolling .roll-icon { animation: spin 400ms linear infinite; }
    .draw-card-btn {
      background: var(--surface); border: 1px solid var(--border); color: var(--fg);
      padding: 0 var(--space-5);
    }
    .draw-card-btn:hover { background: color-mix(in oklab, var(--surface), var(--accent) 8%); border-color: var(--accent); }
    .draw-card-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .draw-card-btn .draw-card-icon {
      width: 16px; height: 22px; border: 2px solid currentColor;
      border-radius: 4px; flex: 0 0 auto;
    }
    .admin-btn {
      width: 48px; height: 48px; border-radius: var(--radius-md);
      border: 1px solid var(--warn); background: var(--surface);
      color: var(--warn); font-size: 22px; cursor: pointer;
      display: grid; place-items: center;
      transition: background var(--motion-fast);
    }
    .admin-btn:hover { background: color-mix(in oklab, var(--surface), var(--warn) 10%); }
    .admin-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pool-edit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Pool controls */
    .pool-control { display: flex; align-items: center; gap: var(--space-2); }
    .pool-label { font-size: 11px; color: var(--meta); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
    .pool-value-wrap { display: flex; align-items: center; gap: 2px; }
    .pool-btn {
      width: 26px; height: 26px; border-radius: var(--radius-sm);
      border: 1px solid var(--border-soft); background: var(--surface);
      color: var(--fg); font-size: 14px; font-weight: 600;
      display: grid; place-items: center; cursor: pointer;
      transition: background var(--motion-fast);
    }
    .pool-btn:hover { background: color-mix(in oklab, var(--surface), var(--accent) 6%); }
    .pool-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .pool-value {
      font-family: var(--font-display); font-size: 20px; font-weight: 700;
      min-width: 28px; text-align: center; line-height: 1;
    }
    .pool-value.pool-empty { color: var(--meta); }
    .pool-value.pool-filled { color: var(--accent); }
    .pool-edit-btn {
      width: 24px; height: 24px; border-radius: var(--radius-sm);
      border: none; background: transparent; color: var(--meta);
      font-size: 14px; display: grid; place-items: center; cursor: pointer;
      transition: color var(--motion-fast);
    }
    .pool-edit-btn:hover { color: var(--accent); }

    /* Pool modal */
    .pool-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .pool-modal {
      background: var(--surface); border-radius: var(--radius-lg);
      padding: 24px; border: 1px solid var(--border);
      box-shadow: 0 12px 32px rgba(0,0,0,0.15);
      min-width: 240px;
    }
    .pool-modal-title {
      font-family: var(--font-display); font-size: 20px; font-weight: 700;
      margin: 0 0 16px; color: var(--fg);
    }
    .pool-modal-input {
      width: 100%; height: 44px; border-radius: 8px;
      border: 1px solid var(--border); background: var(--bg);
      color: var(--fg); font-size: 24px; font-weight: 700; text-align: center;
      padding: 0 12px; outline: none;
      font-family: var(--font-display);
    }
    .pool-modal-input:focus { border-color: var(--accent); }
    .pool-modal-error { font-size: 12px; color: var(--danger); margin: 8px 0 0; text-align: center; }
    .pool-modal-actions { display: flex; gap: 8px; margin-top: 16px; }
    .pool-modal-btn {
      flex: 1; height: 40px; border-radius: 8px; border: none;
      font-size: 15px; font-weight: 600; cursor: pointer;
      transition: opacity var(--motion-fast);
    }
    .pool-modal-btn.cancel { background: var(--surface); color: var(--fg); border: 1px solid var(--border); }
    .pool-modal-btn.set { background: var(--accent); color: var(--accent-on); }
    .pool-modal-btn:hover { opacity: 0.85; }

    @keyframes spin { to { transform: rotate(360deg); } }

    .card-draw-wrap { display: flex; align-items: flex-start; gap: var(--space-4); flex-wrap: wrap; }
    .spanish-card {
      position: relative; width: 102px; min-height: 148px;
      background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,248,248,0.94));
      border: 2px solid var(--border); border-radius: 12px;
      box-shadow: 0 10px 24px rgba(0,0,0,0.08);
      padding: 12px 10px; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; overflow: hidden;
    }
    .spanish-card::after {
      content: ''; position: absolute; inset: 6px;
      border: 1px solid color-mix(in oklab, var(--border) 18%, transparent);
      border-radius: 8px; pointer-events: none;
    }
    .card-corner {
      position: absolute; display: inline-flex; flex-direction: column;
      align-items: center; gap: 2px;
      font-family: var(--font-display); font-size: 14px; font-weight: 700; line-height: 1;
    }
    .card-corner.top { top: 10px; left: 10px; }
    .card-corner.bottom { right: 10px; bottom: 10px; transform: rotate(180deg); }
    .card-corner-mark { width: 15px; height: 15px; display: inline-flex; align-items: center; justify-content: center; }
    .card-corner-mark img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .card-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; padding: 20px 0; }
    .card-suit-glyph { width: 58px; height: 66px; display: inline-flex; align-items: center; justify-content: center; font-size: 48px; }
    .card-suit-glyph img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .card-suit-label { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .card-copy { display: flex; flex-direction: column; gap: var(--space-2); padding-top: var(--space-1); min-width: 180px; }
    .card-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; line-height: 1.05; color: var(--fg); }
    .card-meta { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
    .deck-pill { display: inline-flex; align-items: center; gap: 6px; width: fit-content; padding: 5px 10px; border-radius: var(--radius-sm); background: color-mix(in oklab, var(--surface), var(--bg) 40%); border: 1px solid var(--border-soft); font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; color: var(--muted); }
    .deck-pill strong { color: var(--fg); font-weight: 700; }
    .suit-oros .card-corner, .suit-oros .card-suit-label { color: #d4a017; }
    .suit-copas .card-corner, .suit-copas .card-suit-label { color: #b93118; }
    .suit-espadas .card-corner, .suit-espadas .card-suit-label { color: #405c78; }
    .suit-bastos .card-corner, .suit-bastos .card-suit-label { color: #77522f; }
    .joker-card { background: linear-gradient(180deg, color-mix(in oklab, var(--surface), white 40%), color-mix(in oklab, var(--accent) 14%, var(--surface))); }
    .joker-card .card-corner, .joker-card .card-suit-label { color: var(--fg); }
    .joker-card .card-suit-glyph { color: var(--accent); }

    /* Below this width the header controls need their own row so the logo can
       stay on a single line (the admin cards toggle makes them too wide). */
    @media (max-width: 1240px) {
      .app-header-inner { flex-wrap: wrap; }
      .header-right { width: 100%; justify-content: flex-end; margin-top: var(--space-2); }
      .header-controls { width: auto; justify-content: flex-end; flex-wrap: wrap; }
    }

    @media (max-width: 600px) {
      .app-header { padding: var(--space-3); }
      .app-logo { font-size: 26px; }
      .header-controls { justify-content: space-between; }
      .chat-log { padding: var(--space-3); }
      .roll-entry { padding: var(--space-3) var(--space-4); }
      .controls-bar { padding: var(--space-3); }
      .controls-inner { gap: var(--space-3); flex-wrap: wrap; }
      .spanish-card { width: 88px; min-height: 128px; }
      .card-copy { min-width: 0; flex: 1; }
    }

    /* Modo compacto para moviles, incluido el movil en horizontal (pantallas
       anchas pero de poca altura). En escritorio no se aplica. */
    @media (max-width: 600px), (max-width: 1000px) and (max-height: 520px) {
      .logo-full { display: none; }
      .logo-abbr { display: inline; }

      /* Cabecera en una sola fila: el resto de opciones van al menu. */
      .app-header { padding: var(--space-2) var(--space-3); }
      .app-header-inner { flex-wrap: nowrap; gap: var(--space-2); }
      .header-right { position: relative; gap: var(--space-2); flex-shrink: 0; width: auto; margin-top: 0; }
      .room-code { flex: 0 0 auto; white-space: nowrap; letter-spacing: 0.06em; padding: 3px 9px; }
      .header-menu-btn { display: grid; }
      .header-controls {
        display: none;
        position: absolute; top: calc(100% + 8px); right: 0;
        width: min(260px, calc(100vw - 24px));
        flex-direction: column; flex-wrap: nowrap; align-items: stretch;
        justify-content: flex-start; gap: 6px;
        margin-top: 0; padding: var(--space-2);
        background: var(--header-bg); color: var(--header-fg);
        border: 1px solid var(--header-border); border-radius: var(--radius-md);
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
        z-index: 55;
      }
      .header-controls.menu-open { display: flex; }
      .header-controls .style-picker,
      .header-controls .user-picker-wrap,
      .header-controls .cards-toggle { width: 100%; }
      .header-controls .style-picker select { flex: 1; }
      .header-controls .user-picker { width: 100%; }
      .header-controls .cards-toggle { justify-content: space-between; }
      .header-controls .admin-menu-btn {
        display: flex; align-items: center; gap: 8px; width: 100%;
        height: 36px; padding: 0 10px; cursor: pointer;
        border: 1px solid var(--header-border); border-radius: var(--radius-sm);
        background: var(--header-surface); color: var(--header-fg);
        font: inherit; font-size: 16px;
      }
      .header-controls .help-btn,
      .header-controls .logout-btn {
        width: 100%; height: 36px; display: flex; align-items: center;
        justify-content: flex-start; gap: 8px; padding: 0 10px;
      }
      .header-controls .menu-label { display: inline; font-size: 13px; }

      /* Pie en una sola fila, sin la etiqueta "Reserva". */
      .controls-inner { flex-wrap: nowrap; gap: 4px; }
      .pool-control { flex: 0 0 auto; gap: 2px; }
      .pool-label { display: none; }
      .pool-value-wrap { gap: 1px; }
      .pool-btn { width: 22px; height: 26px; font-size: 13px; }
      .pool-value { font-size: 17px; min-width: 18px; }
      .pool-edit-btn { width: 20px; height: 22px; font-size: 12px; }
      .dice-counter { flex: 0 0 auto; gap: 0; padding: 2px; }
      .dice-counter button { width: 26px; height: 32px; font-size: 16px; }
      .dice-counter .count-label { font-size: 17px; min-width: 22px; }
      .dice-counter .dice-label { font-size: 11px; padding-right: 4px; }
      .modifier-control { flex: 0 0 auto; gap: 0; padding: 2px 4px; }
      .modifier-control .mod-label { display: none; }
      .modifier-control input { width: 42px; height: 32px; font-size: 14px; padding: 0 2px; }
      .roll-btn, .draw-card-btn { height: 40px; }
      .btn-label { display: none; }
      .roll-btn { flex: 1 1 40px; min-width: 40px; padding: 0; }
      .draw-card-btn { flex: 0 0 44px; width: 44px; padding: 0; }
      .admin-btn { display: none; }
    }

    /* Moviles estrechos: mantiene cabecera y pie en una sola fila. */
    @media (max-width: 380px) {
      .app-header { padding: var(--space-2); }
      .app-header-inner { gap: 4px; }
      .app-logo { font-size: 20px; }
      .room-code { font-size: 12px; letter-spacing: 0.04em; padding: 2px 7px; }
      .status-pill { font-size: 11px; padding: 3px 7px; gap: 4px; }
      .header-menu-btn { width: 34px; height: 34px; font-size: 16px; }
      .controls-inner { gap: 2px; }
      .pool-btn { width: 20px; }
      .pool-edit-btn { width: 16px; }
      .dice-counter button { width: 22px; }
      .modifier-control input { width: 36px; }
    }
    .fade-in { animation: fadeIn 300ms var(--ease-standard); }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class RoomComponent implements AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  ws = inject(WebsocketService);
  private readonly health = inject(BackendHealthService);
  protected readonly backendOnline = this.health.online;

  protected roomCode = signal('');
  protected myNickname = signal('');
  protected isAdmin = signal(false);
  protected isRolling = signal(false);
  protected isNewRoom = signal(false);
  protected easterEggActive = signal(false);
  protected easterEggEffect = signal<EasterEggEffect>('glitch-dice');
  private easterEggTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionToken = '';
  private wsInitialized = false;
  private renewTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SESSION_KEY = 'diced-session';

  protected diceCount = signal(2);
  protected modifier = signal(0);
  protected wsConnected = signal(false);
  protected poolValue = signal(0);
  protected cardsEnabled = signal(true);
  protected poolModalOpen = signal(false);
  protected poolModalInput = signal('');
  protected copied = signal(false);
  protected chatText = signal('');

  protected entries = signal<ChatDisplayEntry[]>([]);
  protected connectedUsers = signal<string[]>([]);
  protected currentStyle = signal('classic');
  protected playersOpen = signal(false);
  protected headerMenuOpen = signal(false);
  protected playersPopoverStyle = signal<Record<string, string>>({});

  private chatLogEl = viewChild<ElementRef<HTMLElement>>('chatLog');
  private playersButton = viewChild<ElementRef<HTMLButtonElement>>('playersButton');
  private playersWrap = viewChild<ElementRef<HTMLElement>>('playersWrap');
  private headerRight = viewChild<ElementRef<HTMLElement>>('headerRight');
  private entryCounter = 0;
  private cleanupFns: (() => void)[] = [];

  constructor() {
    effect(() => {
      if (this.entries().length > 0) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initStyle();

    this.route.params.subscribe(params => {
      this.roomCode.set(params['code'] || '');
    });

    this.route.queryParams.subscribe(qp => {
      this.myNickname.set(qp['nick'] || '');
      this.isAdmin.set(qp['admin'] === 'true');
      this.isNewRoom.set(qp['new'] === 'true');

      // Try to restore session from localStorage if available
      const stored = this.loadSession();
      if (stored && stored.roomCode === this.roomCode()) {
        this.sessionToken = stored.sessionToken;
        this.isAdmin.set(stored.isAdmin);
        this.myNickname.set(stored.nick);
        this.isNewRoom.set(false);
      }

      this.connectWebSocket();
    });
  }

  ngOnDestroy(): void {
    this.cleanupFns.forEach(fn => fn());
    if (this.renewTimer) clearTimeout(this.renewTimer);
    if (this.easterEggTimer) clearTimeout(this.easterEggTimer);
    this.ws.disconnect();
  }

  private connectWebSocket(): void {
    if (this.wsInitialized) return;
    this.wsInitialized = true;

    const win = window as unknown as Record<string, Record<string, string>>;
    const configuredWsUrl = (win['__env']?.['backendWsUrl'] ?? '').trim();
    const isDev = window.location.port === '4200';
    const host = configuredWsUrl || (isDev ? 'localhost:8080' : window.location.host);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = configuredWsUrl
      ? configuredWsUrl
      : `${protocol}//${host}/ws/room`;

    this.ws.connect(wsUrl);

    this.cleanupFns.push(this.ws.on('joined', (data: unknown) => {
      const msg = data as JoinedMessage;
      this.sessionToken = msg.sessionToken;
      this.saveSession(msg.roomCode, this.myNickname(), msg.sessionToken, msg.isAdmin);
      // From now on, any reconnection must restore THIS room (reconnect),
      // never create a new one. Store it without sending it immediately.
      this.ws.setAuthMessage({
        type: 'reconnect',
        roomCode: msg.roomCode,
        nickname: this.myNickname(),
        sessionToken: msg.sessionToken,
      }, false);
      this.scheduleTokenRenewal();
      this.wsConnected.set(true);
      this.isAdmin.set(msg.isAdmin);
      this.connectedUsers.set(msg.users);
      this.poolValue.set(msg.poolValue ?? 0);
      this.cardsEnabled.set(msg.cardsEnabled ?? true);

      if (msg.roomCode && msg.roomCode !== this.roomCode()) {
        this.roomCode.set(msg.roomCode);
        const url = this.router.createUrlTree(['/room', msg.roomCode], {
          queryParams: { nick: this.myNickname(), admin: msg.isAdmin ? 'true' : 'false' }
        }).toString();
        window.history.replaceState({}, '', url);
      }

      if (msg.history) {
        const historyEntries = msg.history
          .filter(h => h.type === 'dice_roll' || h.type === 'card_draw' || h.type === 'text_message')
          .map(h => this.historyToEntry(h));
        this.entries.set(historyEntries);
      }
    }));

    this.cleanupFns.push(this.ws.on('error', (data: unknown) => {
      const msg = data as { message?: string };
      const criticalErrors = ['Room not found', 'Nickname already taken', 'Room is full', 'nickname is required', 'roomCode and nickname are required', 'Invalid'];
      const isCritical = criticalErrors.some(e => msg.message?.includes(e));
      if (isCritical) {
        this.clearSession();
        alert('Error: ' + (msg.message || 'Unknown error'));
        this.router.navigate(['/']);
      } else {
        console.warn('WebSocket error:', msg.message);
      }
    }));

    this.cleanupFns.push(this.ws.on('dice_roll', (data: unknown) => {
      const msg = data as DiceRollMessage;
      this.addEntry({
        id: this.nextId(),
        type: 'dice_roll',
        nickname: msg.nickname,
        timestamp: msg.timestamp,
        isSelf: msg.nickname === this.myNickname(),
        result: msg.result,
        remaining: undefined
      });
    }));

    this.cleanupFns.push(this.ws.on('card_draw', (data: unknown) => {
      const msg = data as CardDrawMessage;
      this.addEntry({
        id: this.nextId(),
        type: 'card_draw',
        nickname: msg.nickname,
        timestamp: msg.timestamp,
        isSelf: msg.nickname === this.myNickname(),
        card: msg.card,
        remaining: msg.remaining,
        reshuffledNext: msg.reshuffledNext
      });
    }));

    this.cleanupFns.push(this.ws.on('text_message', (data: unknown) => {
      const msg = data as TextMessage;
      this.addEntry({
        id: this.nextId(),
        type: 'text_message',
        nickname: msg.nickname,
        timestamp: msg.timestamp,
        isSelf: msg.nickname === this.myNickname(),
        text: msg.text
      });
    }));

    this.cleanupFns.push(this.ws.on('user_joined', (data: unknown) => {
      const msg = data as UserJoinedMessage;
      this.addEntry({
        id: this.nextId(),
        type: 'user_joined',
        nickname: msg.nickname,
        timestamp: new Date().toISOString(),
        isSelf: false
      });
    }));

    this.cleanupFns.push(this.ws.on('user_left', (data: unknown) => {
      const msg = data as UserLeftMessage;
      this.addEntry({
        id: this.nextId(),
        type: 'user_left',
        nickname: msg.nickname,
        timestamp: new Date().toISOString(),
        isSelf: false,
        reason: msg.reason
      });
    }));

    this.cleanupFns.push(this.ws.on('user_kicked', (data: unknown) => {
      const msg = data as UserKickedMessage;
      this.addEntry({
        id: this.nextId(),
        type: 'user_kicked',
        nickname: msg.nickname,
        timestamp: new Date().toISOString(),
        isSelf: false,
        byNickname: msg.byNickname
      });
    }));

    this.cleanupFns.push(this.ws.on('admin_changed', (data: unknown) => {
      const msg = data as AdminChangedMessage;
      this.addEntry({
        id: this.nextId(),
        type: 'admin_changed',
        nickname: '',
        timestamp: new Date().toISOString(),
        isSelf: false,
        newAdminNickname: msg.newAdminNickname
      });
      this.isAdmin.set(msg.newAdminNickname === this.myNickname());
    }));

    this.cleanupFns.push(this.ws.on('deck_reshuffled', (data: unknown) => {
      const msg = data as DeckReshuffledMessage;
      this.addEntry({
        id: this.nextId(),
        type: 'deck_reshuffled',
        nickname: msg.byNickname,
        timestamp: msg.timestamp,
        isSelf: false
      });
    }));

    this.cleanupFns.push(this.ws.on('pool_updated', (data: unknown) => {
      const msg = data as PoolUpdatedMessage;
      this.poolValue.set(msg.value);
      this.addEntry({
        id: this.nextId(),
        type: 'pool_updated',
        nickname: msg.byNickname,
        timestamp: msg.timestamp,
        isSelf: msg.byNickname === this.myNickname(),
        poolValue: msg.value,
        delta: msg.delta
      });
    }));

    this.cleanupFns.push(this.ws.on('cards_toggled', (data: unknown) => {
      const msg = data as CardsToggledMessage;
      this.cardsEnabled.set(msg.enabled);
      this.addEntry({
        id: this.nextId(),
        type: 'cards_toggled',
        nickname: msg.byNickname,
        timestamp: msg.timestamp,
        isSelf: msg.byNickname === this.myNickname(),
        enabled: msg.enabled
      });
    }));

    this.cleanupFns.push(this.ws.on('token_renewed', (data: unknown) => {
      const msg = data as { sessionToken: string };
      this.sessionToken = msg.sessionToken;
      // Update stored session with new token
      const stored = this.loadSession();
      if (stored) {
        this.saveSession(stored.roomCode, stored.nick, msg.sessionToken, stored.isAdmin);
      }
      this.ws.setAuthMessage({ type: 'reconnect', roomCode: this.roomCode(), nickname: this.myNickname(), sessionToken: msg.sessionToken }, false);
      this.scheduleTokenRenewal();
    }));

    this.cleanupFns.push(this.ws.on('user_list', (data: unknown) => {
      const msg = data as UserListMessage;
      this.connectedUsers.set(msg.users);
    }));

    this.cleanupFns.push(this.ws.on('you_kicked', () => {
      alert('Has sido expulsado de la sala');
      this.ws.disconnect();
      this.router.navigate(['/']);
    }));

    this.cleanupFns.push(this.ws.on('*', (data: unknown) => {
      const msg = data as { type?: string };
      if (msg.type === 'joined') {
        this.wsConnected.set(true);
      }
    }));

    const msg = this.sessionToken
      ? { type: 'reconnect', roomCode: this.roomCode(), nickname: this.myNickname(), sessionToken: this.sessionToken }
      : this.isNewRoom()
        ? { type: 'create_room', nickname: this.myNickname() }
        : { type: 'join', roomCode: this.roomCode(), nickname: this.myNickname() };
    this.ws.setAuthMessage(msg);
  }

  protected copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  /** Plays the next easter egg effect, advancing the persisted rotation. */
  private triggerEasterEgg(): void {
    const { effect, next } = nextEasterEgg(readEasterEggIndex());
    writeEasterEggIndex(next);
    this.easterEggEffect.set(effect);

    if (this.easterEggActive()) {
      // Recreate the component so the timeline restarts from zero.
      this.easterEggActive.set(false);
      if (this.easterEggTimer) clearTimeout(this.easterEggTimer);
      this.easterEggTimer = setTimeout(() => this.easterEggActive.set(true));
    } else {
      this.easterEggActive.set(true);
    }
  }

  /** Compact notation of the roll that was requested, e.g. `3d6+3`. */
  protected rollFormula(result: DiceResult): string {
    const count = result.initialCount || result.values.length;
    const modifier =
      result.modifier > 0 ? `+${result.modifier}` : result.modifier < 0 ? `${result.modifier}` : '';
    return `${count}d6${modifier}`;
  }

  protected doRoll(): void {
    if (this.isRolling() || !this.backendOnline()) return;
    this.isRolling.set(true);
    this.ws.send({ type: 'roll_dice', count: this.diceCount(), modifier: this.modifier() });
    setTimeout(() => this.isRolling.set(false), 500);
  }

  protected doDrawCard(): void {
    if (this.isRolling() || !this.backendOnline()) return;
    this.isRolling.set(true);
    this.ws.send({ type: 'draw_card' });
    setTimeout(() => this.isRolling.set(false), 400);
  }

  protected doReshuffle(): void {
    if (!this.backendOnline()) return;
    this.headerMenuOpen.set(false);
    this.ws.send({ type: 'reshuffle_deck' });
  }

  protected doToggleCards(): void {
    if (!this.backendOnline()) return;
    this.headerMenuOpen.set(false);
    this.ws.send({ type: 'toggle_cards' });
  }

  private scheduleTokenRenewal(): void {
    if (this.renewTimer) clearTimeout(this.renewTimer);
    // Renew 5 minutes before expiry (default 60-min token)
    this.renewTimer = setTimeout(() => this.ws.send({ type: 'renew_token' }), 55 * 60 * 1000);
  }

  protected doSendMessage(): void {
    const text = this.chatText().trim();
    if (!text) return;

    // Commands are evaluated first so purely local ones (the easter egg) work
    // even when the backend is not reachable.
    if (text.startsWith('/')) {
      const outcome = this.runCommand(text);
      if (outcome === 'sent') {
        this.chatText.set('');
        return;
      }
      if (outcome === 'blocked') return;
    }

    if (!this.backendOnline()) return;

    this.ws.send({ type: 'send_message', text });
    this.chatText.set('');
  }

  /**
   * Executes a chat command such as `/carta` or `/3d6+3`.
   *
   * - `sent`: the command matched and was executed.
   * - `blocked`: the command matched but cannot run right now (no connection,
   *   roll in progress, cards disabled). The input text is kept.
   * - `null`: the text is not a command, so it must go to the chat as-is.
   */
  private runCommand(raw: string): 'sent' | 'blocked' | null {
    const command = parseChatCommand(raw);
    if (!command) return null;

    if (command.kind === 'easter_egg') {
      this.triggerEasterEgg();
      return 'sent';
    }

    if (!this.wsConnected() || !this.backendOnline()) return 'blocked';

    switch (command.kind) {
      case 'draw_card':
        if (this.isRolling() || !this.cardsEnabled()) return 'blocked';
        this.doDrawCard();
        return 'sent';
      case 'roll_current':
        if (this.isRolling()) return 'blocked';
        this.doRoll();
        return 'sent';
      case 'roll':
        if (this.isRolling()) return 'blocked';
        this.diceCount.set(command.count);
        this.modifier.set(command.modifier);
        this.doRoll();
        return 'sent';
      default:
        return null;
    }
  }

  protected togglePlayers(): void {
    const open = !this.playersOpen();
    this.playersOpen.set(open);
    if (open) this.positionPlayersPopover();
  }

  protected toggleHeaderMenu(): void {
    this.headerMenuOpen.update(open => !open);
    if (!this.headerMenuOpen()) this.playersOpen.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.playersOpen()) {
      const wrap = this.playersWrap()?.nativeElement;
      if (wrap && !wrap.contains(target)) {
        this.playersOpen.set(false);
      }
    }
    if (this.headerMenuOpen()) {
      const right = this.headerRight()?.nativeElement;
      if (right && !right.contains(target)) {
        this.headerMenuOpen.set(false);
        this.playersOpen.set(false);
      }
    }
  }

  protected onResize(): void {
    if (this.playersOpen()) this.positionPlayersPopover();
  }

  /** Keeps the popover anchored to the pill and inside the viewport. */
  private positionPlayersPopover(): void {
    const button = this.playersButton()?.nativeElement;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.right - width),
      window.innerWidth - 12 - width
    );

    this.playersPopoverStyle.set({
      top: `${Math.round(rect.bottom + 8)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.playersOpen() || this.headerMenuOpen()) {
        this.playersOpen.set(false);
        this.headerMenuOpen.set(false);
        return;
      }
    }

    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    if (event.key === '[' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.doPoolDelta(-1);
    } else if (event.key === ']' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.doPoolDelta(1);
    }
  }

  protected doLogout(): void {
    this.headerMenuOpen.set(false);
    this.clearSession();
    this.ws.disconnect();
    this.router.navigate(['/']);
  }

  private saveSession(code: string, nick: string, token: string, admin: boolean): void {
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify({
        roomCode: code, nick, sessionToken: token, isAdmin: admin
      }));
    } catch {}
  }

  private loadSession(): { roomCode: string; nick: string; sessionToken: string; isAdmin: boolean } | null {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private clearSession(): void {
    try { localStorage.removeItem(this.SESSION_KEY); } catch {}
  }

  protected decDice(): void {
    if (this.diceCount() > 1) this.diceCount.update(v => v - 1);
  }

  protected incDice(): void {
    if (this.diceCount() < 20) this.diceCount.update(v => v + 1);
  }

  protected setModifier(val: string): void {
    const n = parseInt(val, 10);
    if (!isNaN(n)) this.modifier.set(Math.max(-99, Math.min(99, n)));
    else this.modifier.set(0);
  }

  protected poolModalError = signal('');

  protected doPoolDelta(delta: number): void {
    if (!this.backendOnline()) return;
    const newVal = this.poolValue() + delta;
    if (newVal < 0) return;
    this.ws.send({ type: 'pool_delta', delta });
  }

  protected openPoolModal(): void {
    this.poolModalInput.set(String(this.poolValue()));
    this.poolModalError.set('');
    this.poolModalOpen.set(true);
  }

  protected closePoolModal(): void {
    this.poolModalOpen.set(false);
    this.poolModalError.set('');
  }

  protected doPoolSet(): void {
    if (!this.backendOnline()) return;
    const val = parseInt(this.poolModalInput(), 10);
    if (isNaN(val) || val < 0) {
      this.poolModalError.set('El valor debe ser >= 0');
      return;
    }
    this.ws.send({ type: 'pool_set', value: val });
    this.closePoolModal();
  }

  protected suitIcon(suit: string): string {
    return `assets/suits/${suit}.svg`;
  }

  protected suitSymbol(suit: string): string {
    const symbols: Record<string, string> = { oros: '◎', copas: '◠', espadas: '✦', bastos: '✣' };
    return symbols[suit] || '?';
  }

  protected systemMessage(entry: ChatDisplayEntry): string {
    switch (entry.type) {
      case 'user_joined': return `${entry.nickname} se ha conectado`;
      case 'user_left': return `${entry.nickname} se ha desconectado`;
      case 'user_kicked': return `${entry.nickname} fue expulsado por ${entry.byNickname}`;
      case 'admin_changed': return `${entry.newAdminNickname} es ahora el administrador`;
      case 'deck_reshuffled': return `${entry.nickname} ha reiniciado la baraja (50 cartas)`;
      case 'cards_toggled': return entry.enabled
        ? `${entry.nickname} activó las cartas`
        : `${entry.nickname} desactivó las cartas`;
      case 'pool_updated': {
        const d = entry.delta ?? 0;
        if (d > 0) return `${entry.nickname} aumentó la reserva a ${entry.poolValue}`;
        if (d < 0) return `${entry.nickname} redujo la reserva a ${entry.poolValue}`;
        return `${entry.nickname} fijó la reserva a ${entry.poolValue}`;
      }
      case 'system': return entry.text || '';
      default: return '';
    }
  }

  protected setStyle(style: string): void {
    this.currentStyle.set(style);
    document.documentElement.setAttribute('data-style', style);
    localStorage.setItem('diced-style', style);
    this.headerMenuOpen.set(false);
  }

  /** Keep in sync with the <option> list and the blocks in styles.scss. */
  private static readonly THEMES = [
    'classic', 'alejo', 'ocean', 'sunset', 'forest', 'pergamino', 'sakura',
    'neon', 'playeo', 'dracula', 'halloween', 'matrix', 'batman', 'spaceship'
  ];

  private initStyle(): void {
    const stored = localStorage.getItem('diced-style') || 'classic';
    // Ignore themes that no longer exist (e.g. a removed one left in storage).
    const style = RoomComponent.THEMES.includes(stored) ? stored : 'classic';
    this.currentStyle.set(style);
    document.documentElement.setAttribute('data-style', style);
  }

  private addEntry(entry: ChatDisplayEntry): void {
    this.entries.update(entries => [...entries, entry]);
  }

  private nextId(): string {
    return 'e' + (++this.entryCounter) + '_' + Date.now();
  }

  private historyToEntry(h: HistoryEntry): ChatDisplayEntry {
    return {
      id: 'h' + (++this.entryCounter),
      type: h.type as ChatDisplayEntry['type'],
      nickname: h.nickname,
      timestamp: h.timestamp,
      isSelf: h.nickname === this.myNickname(),
      text: h.text,
      result: (h.data as DiceResult) || undefined,
      card: (h.data as DrawResult)?.card || undefined,
      remaining: (h.data as DrawResult)?.remaining || undefined,
      reshuffledNext: (h.data as DrawResult)?.reshuffledNext || undefined
    };
  }

  private scrollToBottom(): void {
    const el = this.chatLogEl()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
