import { describe, expect, it } from 'vitest';
import { CHANGELOG_RELEASES } from './changelog.generated';

describe('CHANGELOG_RELEASES', () => {
  it('lista las versiones publicadas de la más reciente a la más antigua', () => {
    expect(CHANGELOG_RELEASES.map((release) => release.version)).toEqual([
      '1.1.1',
      '1.1.0',
      '1.0.1',
      '1.0.0',
    ]);
  });

  it('cada versión tiene fecha, secciones y elementos', () => {
    for (const release of CHANGELOG_RELEASES) {
      expect(release.date.length).toBeGreaterThan(0);
      expect(release.sections.length).toBeGreaterThan(0);
      for (const section of release.sections) {
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.items.length).toBeGreaterThan(0);
      }
    }
  });
});
