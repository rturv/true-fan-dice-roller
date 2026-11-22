import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_VERSION } from '../../version';
import { CHANGELOG_RELEASES } from './changelog.generated';

@Component({
  selector: 'app-changelog',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="changelog-page">
      <nav class="changelog-top">
        <a class="back-link" routerLink="/">← Volver a la mesa</a>
        <span class="changelog-badge">REGISTRO DE CAMBIOS</span>
      </nav>

      <header class="hero">
        <h1>TRUE FAN DICE ROLLER: EL CHANGELOG</h1>
        <p class="lead">
          Todo lo que ha cambiado desde la primera tirada. Sin letra pequeña y sin prometer que el
          próximo 6 no vuelva a explotar.
        </p>
        <p class="lead muted">De la versión más reciente a la más antigua.</p>
      </header>

      @for (release of releases; track release.version) {
        <article class="release" [class.latest]="$first">
          <header class="release-head">
            <h2>v{{ release.version }}</h2>
            @if ($first) {
              <span class="latest-badge">ÚLTIMA</span>
            }
            <span class="release-date">{{ release.date }}</span>
          </header>

          @if (release.summary) {
            <p class="summary">
              @for (part of release.summary; track $index) {
                @if (part.code) {
                  <code>{{ part.text }}</code>
                } @else if (part.bold) {
                  <strong>{{ part.text }}</strong>
                } @else if (part.href) {
                  <a [href]="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
                } @else {
                  <span>{{ part.text }}</span>
                }
              }
            </p>
          }

          @for (section of release.sections; track section.title) {
            <section class="release-section">
              <h3>{{ section.title }}</h3>
              <ul class="bullets">
                @for (item of section.items; track $index) {
                  <li>
                    @for (part of item; track $index) {
                      @if (part.code) {
                        <code>{{ part.text }}</code>
                      } @else if (part.bold) {
                        <strong>{{ part.text }}</strong>
                      } @else if (part.href) {
                        <a [href]="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
                      } @else {
                        <span>{{ part.text }}</span>
                      }
                    }
                  </li>
                }
              </ul>
            </section>
          }
        </article>
      }

      <footer class="changelog-footer">
        <a class="back-link" routerLink="/">← Volver a la mesa</a>
        <p class="muted">Cada tirada deja huella. Estas son las que hemos apuntado.</p>
        <p class="version">v{{ version }}</p>
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

    .changelog-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 28px 20px 64px;
    }

    .changelog-top {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3); margin-bottom: 18px;
    }

    .back-link {
      font-family: var(--font-body);
      color: var(--accent); text-decoration: none; font-weight: 700;
      font-size: 16px; padding: 6px 12px; border-radius: var(--radius-pill);
      border: 1px solid color-mix(in oklab, var(--accent) 55%, var(--border-soft));
      transition: border-color var(--motion-fast);
    }
    .back-link:hover {
      border-color: var(--accent);
    }

    .changelog-badge {
      font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em;
      color: var(--meta); border: 1px solid var(--border-soft);
      border-radius: var(--radius-pill); padding: 3px 10px;
    }

    .hero { text-align: center; padding: 18px 0 6px; }
    .hero h1 {
      font-family: "Bangers", "Impact", "Arial Black", sans-serif;
      font-size: clamp(36px, 7vw, 64px); line-height: 0.95;
      letter-spacing: 0.04em; color: var(--accent);
      margin: 0 0 10px; transform: rotate(-1.5deg);
      text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.18);
    }
    .lead { color: var(--fg-2); font-size: 15px; max-width: 640px; margin: 0 auto; }
    .lead.muted { margin-top: 8px; }

    .release {
      margin-top: 32px; padding: 22px 24px;
      background: var(--surface);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-lg);
    }
    .release.latest {
      border-color: color-mix(in oklab, var(--accent) 55%, var(--border-soft));
    }

    .release-head {
      display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
      padding-bottom: 12px; border-bottom: 1px solid var(--border-soft);
    }
    .release-head h2 {
      margin: 0;
      font-family: "Bangers", "Impact", "Arial Black", sans-serif;
      font-size: clamp(26px, 4vw, 34px); letter-spacing: 0.03em;
      line-height: 1; color: var(--fg);
    }
    .latest-badge {
      font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em;
      background: var(--accent); color: var(--accent-on);
      border-radius: var(--radius-pill); padding: 3px 9px;
    }
    .release-date {
      margin-left: auto;
      font-family: var(--font-mono); font-size: 11px;
      letter-spacing: 0.1em; color: var(--meta);
    }

    .summary {
      margin: 14px 0 0; padding: 10px 14px;
      background: color-mix(in oklab, var(--accent) 9%, var(--surface));
      border-left: 4px solid var(--accent);
      border-radius: var(--radius-sm);
      color: var(--fg-2); font-size: 14px; line-height: 1.55;
    }

    .release-section { margin-top: 18px; }
    .release-section h3 {
      margin: 0 0 8px;
      font-family: var(--font-mono); font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.12em;
      color: var(--accent);
    }

    .bullets {
      margin: 0; padding-left: 20px;
      color: var(--fg-2); font-size: 15px; line-height: 1.55;
    }
    .bullets li { margin-bottom: 7px; }
    .bullets li:last-child { margin-bottom: 0; }

    .bullets code, .summary code {
      font-family: var(--font-mono); font-size: 0.9em;
      background: var(--bg); border: 1px solid var(--border-soft);
      padding: 1px 5px; border-radius: 4px;
    }
    .bullets a, .summary a {
      color: var(--accent); font-weight: 700;
      text-decoration: none;
      border-bottom: 2px solid color-mix(in oklab, var(--accent) 55%, transparent);
    }
    .bullets a:hover, .summary a:hover {
      border-bottom-color: var(--accent);
    }

    .muted { color: var(--muted) !important; font-size: 13px !important; }

    .changelog-footer {
      margin-top: 54px; padding-top: 20px;
      border-top: 1px solid var(--border-soft);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .version {
      margin: 0; font-family: var(--font-mono); font-size: 11px;
      color: var(--meta); letter-spacing: 0.12em;
    }

    @media (max-width: 600px) {
      .changelog-page { padding: 18px 14px 48px; }
      .changelog-top { flex-direction: column; align-items: flex-start; }
      .release { padding: 18px 16px; }
      .release-date { margin-left: 0; width: 100%; }
    }
  `,
})
export class ChangelogComponent {
  protected readonly version = APP_VERSION;
  protected readonly releases = CHANGELOG_RELEASES;
}
