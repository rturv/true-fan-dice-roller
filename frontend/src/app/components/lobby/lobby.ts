import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lobby',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'lobby-page' },
  template: `
    <div class="lobby-container">
      <div class="lobby-card">
        <div class="lobby-logo">
          <span class="app-logo">True Fan Dice Roller</span>
        </div>

        <div class="lobby-subtitle">Conéctate con tus amigos para tirar dados y sacar cartas</div>

        <div class="lobby-form">
          <div class="field-group">
            <label for="nickname">Tu nickname</label>
            <input
              id="nickname"
              type="text"
              [(ngModel)]="nickname"
              (keydown.enter)="handleEnter()"
              placeholder="Ej: Mago"
              maxlength="20"
              class="lobby-input"
              [class.input-error]="nicknameError()"
            />
            @if (nicknameError()) {
              <span class="field-error">{{ nicknameError() }}</span>
            }
          </div>

          <div class="lobby-actions">
            <button class="btn-primary" (click)="createRoom()" [disabled]="!nickname().trim()">
              Crear Sala
            </button>
          </div>

          <div class="lobby-divider">
            <span>o</span>
          </div>

          <div class="field-group">
            <label for="roomCode">Código de sala</label>
            <input
              id="roomCode"
              type="text"
              [(ngModel)]="roomCode"
              (keydown.enter)="handleEnter()"
              placeholder="Ej: K7X2M9P"
              maxlength="7"
              class="lobby-input"
              [class.input-error]="roomCodeError()"
            />
            @if (roomCodeError()) {
              <span class="field-error">{{ roomCodeError() }}</span>
            }
          </div>

          <button class="btn-secondary" (click)="joinRoom()" [disabled]="!nickname().trim() || !roomCode().trim()">
            Unirse a Sala
          </button>

          @if (errorMessage()) {
            <div class="lobby-error">{{ errorMessage() }}</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: flex; height: 100%; }
    .lobby-container {
      display: flex; align-items: center; justify-content: center;
      width: 100%; padding: 24px;
      background: var(--bg);
    }
    .lobby-card {
      background: var(--surface); border-radius: 16px;
      border: 1px solid var(--border); padding: 40px 36px;
      max-width: 420px; width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }
    .lobby-logo {
      text-align: center; margin-bottom: 12px;
    }
    .app-logo {
      font-family: "Bangers", "Impact", "Arial Black", sans-serif;
      font-size: 32px; font-weight: 400;
      color: var(--accent); letter-spacing: 0.04em;
      text-transform: uppercase; line-height: 1.1;
      display: inline-block;
    }
    .lobby-subtitle {
      text-align: center; color: var(--muted); font-size: 14px;
      margin-bottom: 28px; line-height: 1.4;
    }
    .lobby-form { display: flex; flex-direction: column; gap: 16px; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .field-group label {
      font-size: 13px; font-weight: 600; color: var(--fg-2);
    }
    .lobby-input {
      height: 44px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg); color: var(--fg);
      padding: 0 14px; font-size: 15px;
      outline: none; transition: border-color 120ms;
    }
    .lobby-input:focus { border-color: var(--accent); }
    .lobby-input.input-error { border-color: var(--danger); }
    .field-error { font-size: 12px; color: var(--danger); }
    .lobby-actions { display: flex; flex-direction: column; }
    .btn-primary, .btn-secondary {
      height: 48px; border-radius: 8px; border: none;
      font-family: var(--font-display); font-size: 17px; font-weight: 700;
      cursor: pointer; transition: background 120ms, opacity 120ms;
      display: flex; align-items: center; justify-content: center;
    }
    .btn-primary {
      background: var(--accent); color: var(--accent-on);
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-secondary {
      background: var(--surface); color: var(--fg);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { background: var(--border-soft); }
    .btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
    .lobby-divider {
      display: flex; align-items: center; gap: 12px;
      color: var(--meta); font-size: 13px;
    }
    .lobby-divider::before, .lobby-divider::after {
      content: ''; flex: 1; height: 1px; background: var(--border-soft);
    }
    .lobby-error {
      background: rgba(220, 38, 38, 0.08); color: var(--danger);
      padding: 10px 14px; border-radius: 8px; font-size: 13px;
      text-align: center;
    }
  `
})
export class LobbyComponent {
  nickname = signal('');
  roomCode = signal('');
  nicknameError = signal('');
  roomCodeError = signal('');
  errorMessage = signal('');

  constructor(private router: Router) {}

  createRoom(): void {
    this.clearErrors();
    const nick = this.nickname().trim();
    if (!this.validateNickname(nick)) return;

    const roomCode = this.generateRoomCode();
    this.router.navigate(['/room', roomCode], {
      queryParams: { nick, admin: 'true', new: 'true' }
    });
  }

  joinRoom(): void {
    this.clearErrors();
    const nick = this.nickname().trim();
    const code = this.roomCode().trim().toUpperCase();

    if (!this.validateNickname(nick)) return;

    if (!code || code.length !== 7) {
      this.roomCodeError.set('El código debe tener 7 caracteres');
      return;
    }

    this.router.navigate(['/room', code], {
      queryParams: { nick, admin: 'false' }
    });
  }

  handleEnter(): void {
    if (this.roomCode().trim()) {
      this.joinRoom();
    } else if (this.nickname().trim()) {
      this.createRoom();
    }
  }

  private validateNickname(nick: string): boolean {
    if (!nick) {
      this.nicknameError.set('Elige un nickname');
      return false;
    }
    if (nick.length < 1 || nick.length > 20) {
      this.nicknameError.set('Entre 1 y 20 caracteres');
      return false;
    }
    return true;
  }

  private clearErrors(): void {
    this.nicknameError.set('');
    this.roomCodeError.set('');
    this.errorMessage.set('');
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
