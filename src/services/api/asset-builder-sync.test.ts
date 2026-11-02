// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error The build script has no type declarations.
import { bundleAssetBuilder } from '../../../scripts/build-asset-builder.mjs';

describe('asset-builder.generated.js', () => {
  it('matches the source; run npm run build:asset-builder after changing it', async () => {
    const generated = readFileSync(
      new URL('../../../supabase/functions/yahoo-finance-proxy/asset-builder.generated.js', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n');
    expect(generated).toBe(await bundleAssetBuilder());
  });
});
