import { describe, expect, it } from 'vitest';
import atlasJson from '../../src/data/atlas.json';
import { atlasPageVersion } from '../../src/core/atlas';

describe('atlas page version (fix B2: a phone kept an old sheet and drew a food tray instead of the gate chest)', () => {
  it('gives every sheet its own stable version so a changed sheet gets a new address', () => {
    const versions = atlasJson.pages.map((_, index) => atlasPageVersion(index));
    expect(new Set(versions).size).toBe(versions.length);
    expect(atlasJson.pages.map((_, index) => atlasPageVersion(index))).toEqual(versions);
    for (const version of versions) expect(version).toMatch(/^[0-9a-z]+$/);
  });
});
