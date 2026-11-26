// Hosted POSIX filesystem gate only; requires an explicitly prepared private
// test root under trusted, non-world-writable ancestors. Never run locally now.
import * as fs from 'fs';
import { join } from 'path';
import {
  readProtected,
  writeProtected,
  replaceProtected,
  openProtectedJournal,
} from './protected-store';
const suite = process.env.PD_QA_FS_TEST_ROOT ? describe : describe.skip;
suite('protected fixture descriptor boundaries', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(join(process.env.PD_QA_FS_TEST_ROOT!, 'owned-'));
    fs.chmodSync(root, 0o700);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true });
  }); // only this test's owned tree
  it('reads/writes/checkpoints privately and refuses an exclusive collision', () => {
    const file = join(root, 'ref.json');
    writeProtected(file, { owner: 'one', revision: 0 });
    expect(() => writeProtected(file, { owner: 'other' })).toThrow();
    replaceProtected<any>(
      file,
      { owner: 'one', revision: 1 },
      (old) => old.owner === 'one' && old.revision === 0
    );
    expect(readProtected(file)).toEqual({ owner: 'one', revision: 1 });
    expect(() =>
      replaceProtected<any>(
        file,
        { owner: 'other' },
        (old) => old.owner === 'other'
      )
    ).toThrow();
    expect(readProtected(file)).toEqual({ owner: 'one', revision: 1 });
  });
  it('rejects leaf/ancestor symlinks and a public leaf mode', () => {
    const dir = join(root, 'private');
    fs.mkdirSync(dir, { mode: 0o700 });
    const file = join(dir, 'ref.json');
    writeProtected(file, { example: 'not a credential' });
    const leaf = join(root, 'leaf.json');
    fs.symlinkSync(file, leaf);
    expect(() => readProtected(leaf)).toThrow();
    const ancestor = join(root, 'alias');
    fs.symlinkSync(dir, ancestor);
    expect(() => readProtected(join(ancestor, 'ref.json'))).toThrow();
    fs.chmodSync(file, 0o644);
    expect(() => readProtected(file)).toThrow();
  });
  it('rejects a wrong descriptor owner and hardlinked leaf', () => {
    const file = join(root, 'ref.json');
    writeProtected(file, { example: true });
    const nodeFs = require('fs'),
      original = nodeFs.fstatSync;
    jest.spyOn(nodeFs, 'fstatSync').mockImplementationOnce((fd: any) => {
      const st = original(fd),
        wrong = Object.create(st);
      Object.defineProperty(wrong, 'uid', { value: st.uid + 1 });
      return wrong;
    });
    expect(() => readProtected(file)).toThrow();
    jest.restoreAllMocks();
    fs.linkSync(file, join(root, 'second-link'));
    expect(() => readProtected(file)).toThrow();
  });
  it('uses one opened descriptor for append/read/fsync and detects leaf replacement', () => {
    const file = join(root, 'events.ndjson'),
      journal = openProtectedJournal(file);
    try {
      journal.append({ n: 1 });
      expect(journal.read()).toEqual([{ n: 1 }]);
      journal.append({ n: 2 });
      expect(journal.read()).toEqual([{ n: 1 }, { n: 2 }]);
      fs.renameSync(file, join(root, 'old-events'));
      fs.writeFileSync(file, 'replacement', { mode: 0o600 });
      expect(() => journal.append({ n: 3 })).toThrow();
      expect(fs.readFileSync(file, 'utf8')).toBe('replacement');
    } finally {
      journal.close();
    }
  });
  it('detects a parent swapped after the journal opened', () => {
    const dir = join(root, 'private');
    fs.mkdirSync(dir, { mode: 0o700 });
    const file = join(dir, 'events');
    const journal = openProtectedJournal(file);
    try {
      fs.renameSync(dir, join(root, 'old-private'));
      fs.mkdirSync(dir, { mode: 0o700 });
      fs.writeFileSync(file, 'replacement', { mode: 0o600 });
      expect(() => journal.read()).toThrow();
      expect(() => journal.append({ n: 1 })).toThrow();
    } finally {
      journal.close();
    }
  });
});
