import { readFileSync } from 'fs';
import { join } from 'path';

// deploy/postdelegate/Caddyfile is the committed copy of what runs in front of
// the app. Nothing compiles it, so it drifted from the live one until it no
// longer loaded at all: a second `@swagger` had been added to a block that
// already had one, which Caddy refuses with "matcher is defined more than
// once", and a rebuild from this repo would have come up with no web server.
// These are the three ways that file can be wrong without anyone noticing.
// (The spec lives here because jest only looks under apps/*/src and
// libraries/*/src.)

const caddyfile = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'deploy', 'postdelegate', 'Caddyfile'),
  'utf8'
);

// each `name {` at the left margin opens a site block, and matchers are scoped
// to the block they are declared in
const siteBlocks = () => {
  const blocks: { site: string; body: string[] }[] = [];
  let current: { site: string; body: string[] } | undefined;
  for (const line of caddyfile.split('\n')) {
    const opens = line.match(/^(\S.*?)\s*\{\s*$/);
    if (opens) {
      current = { site: opens[1], body: [] };
      blocks.push(current);
      continue;
    }
    if (/^\}/.test(line)) {
      current = undefined;
      continue;
    }
    current?.body.push(line);
  }
  return blocks;
};

describe('the committed Caddyfile', () => {
  it('declares each matcher once per site block', () => {
    for (const { site, body } of siteBlocks()) {
      const declared = body
        .map((line) => line.match(/^\s*(@\w+)\s+\S/))
        .filter(Boolean)
        .map((match) => (match as RegExpMatchArray)[1]);
      const twice = declared.filter(
        (name, index) => declared.indexOf(name) !== index
      );
      expect({ site, twice }).toEqual({ site, twice: [] });
    }
  });

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
