import { readFileSync } from 'fs';
import { join } from 'path';

// deploy/postdelegate/Caddyfile is the committed copy of what runs in front of
// the app. Whether it LOADS is checked by Caddy itself, in the Caddy config
// step of .github/workflows/build.yml - it had drifted into a state Caddy
// refuses (a matcher declared twice) and nothing noticed. These are the two
// things Caddy cannot judge: what belongs in the file and what does not.
// (The spec lives here because jest only looks under apps/*/src and
// libraries/*/src.)

const caddyfile = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'deploy', 'postdelegate', 'Caddyfile'),
  'utf8'
);

describe('the committed Caddyfile', () => {
  it('carries no credential', () => {
    // the staging login lives only in the live /opt/postiz/Caddyfile
    expect(caddyfile).not.toMatch(/\$2[aby]\$\d\d\$/);
    expect(caddyfile).toContain('{$STAGING_BASIC_AUTH_USER}');
    expect(caddyfile).toContain('{$STAGING_BASIC_AUTH_HASH}');
  });

  it('offers the source at a name a release does not have to edit', () => {
    // a per-release filename here is what made the live and committed copies
    // drift in the first place, and it cost a caddy restart every release
    expect(caddyfile).toContain('redir * /source/postdelegate-latest.tar.gz');
    expect(caddyfile).not.toMatch(
      /redir \* \/source\/postdelegate-[0-9a-f]{6,}\.tar\.gz/
    );
  });
});
