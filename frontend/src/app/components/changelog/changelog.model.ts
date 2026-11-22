/** Texto con formato en línea procedente del changelog Markdown. */
export interface ChangelogInline {
  readonly text: string;
  readonly bold?: boolean;
  readonly code?: boolean;
  readonly href?: string;
}

/** Bloque de cambios agrupado por categoría dentro de una versión. */
export interface ChangelogSection {
  readonly title: string;
  readonly items: readonly ChangelogInline[][];
}

/** Una versión del changelog con su fecha y sus bloques de cambios. */
export interface ChangelogRelease {
  readonly version: string;
  readonly date: string;
  readonly summary?: readonly ChangelogInline[];
  readonly sections: readonly ChangelogSection[];
}
