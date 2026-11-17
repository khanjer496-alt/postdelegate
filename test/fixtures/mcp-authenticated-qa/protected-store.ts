// Fixture-local POSIX file primitives. RE must own/protect immutable ancestors;
// these checks do not defend against a hostile root or concurrent same-UID writer.
import * as fs from 'fs';
import { basename, dirname, isAbsolute, join, parse } from 'path';
import { randomUUID } from 'crypto';

const noFollow = fs.constants.O_NOFOLLOW;
if (noFollow === undefined)
  throw new Error('POSIX no-follow file support required.');
type Anchor = { path: string; dev: number; ino: number };
function parents(file: string): Anchor[] {
  if (!isAbsolute(file))
    throw new Error('Absolute protected reference required.');
  const uid = process.getuid?.();
  if (uid === undefined) throw new Error('POSIX owner identity required.');
  const result: Anchor[] = [];
  let current = parse(file).root;
  for (const part of [
    current,
    ...dirname(file).slice(current.length).split('/').filter(Boolean),
  ]) {
    current = part === parse(file).root ? part : join(current, part);
    const st = fs.lstatSync(current);
    if (
      !st.isDirectory() ||
      st.isSymbolicLink() ||
      st.mode & 0o022 ||
      ![0, uid].includes(st.uid)
    )
      throw new Error('Trusted immutable protected ancestors required.');
    result.push({ path: current, dev: st.dev, ino: st.ino });
  }
  const parent = fs.lstatSync(dirname(file));
  if (parent.uid !== uid || parent.mode & 0o077)
    throw new Error('Owned 0700 protected parent required.');
  return result;
}
function unchanged(anchors: Anchor[]) {
  for (const [index, anchor] of anchors.entries()) {
    const st = fs.lstatSync(anchor.path);
    if (
      !st.isDirectory() ||
      st.isSymbolicLink() ||
      st.dev !== anchor.dev ||
      st.ino !== anchor.ino ||
      st.mode & 0o022 ||
      ![0, process.getuid!()].includes(st.uid)
    )
      throw new Error('Protected ancestor changed.');
    if (
      index === anchors.length - 1 &&
      (st.uid !== process.getuid!() || st.mode & 0o077)
    )
      throw new Error('Protected parent permissions changed.');
  }
}
function bound(fd: number, file: string, anchors: Anchor[]) {
  unchanged(anchors);
  const st = fs.fstatSync(fd),
    leaf = fs.lstatSync(file);
  if (
    !st.isFile() ||
    st.nlink !== 1 ||
    st.uid !== process.getuid!() ||
    st.mode & 0o077 ||
    leaf.isSymbolicLink() ||
    st.dev !== leaf.dev ||
    st.ino !== leaf.ino
  )
    throw new Error('Protected descriptor/leaf identity changed.');
  return st;
}
function open(file: string, flags: number) {
  const anchors = parents(file);
  const fd = fs.openSync(file, flags | noFollow, 0o600);
  try {
    bound(fd, file, anchors);
    return { fd, anchors };
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
}
function syncParent(file: string, anchors: Anchor[]) {
  unchanged(anchors);
  const fd = fs.openSync(
    dirname(file),
    fs.constants.O_RDONLY | noFollow | fs.constants.O_DIRECTORY
  );
  try {
    const st = fs.fstatSync(fd),
      parent = anchors[anchors.length - 1];
    if (!st.isDirectory() || st.dev !== parent.dev || st.ino !== parent.ino)
      throw new Error('Protected parent changed.');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function text(fd: number, maxBytes = 4 * 1024 * 1024) {
  const size = fs.fstatSync(fd).size;
  if (size > maxBytes)
    throw new Error('Protected reference exceeds fixture bound.');
  const buffer = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const got = fs.readSync(fd, buffer, offset, size - offset, offset);
    if (!got) throw new Error('Protected read interrupted.');
    offset += got;
  }
  return buffer.toString('utf8');
}
export function readProtected<T>(file: string): T {
  const handle = open(file, fs.constants.O_RDONLY);
  try {
    const value = JSON.parse(text(handle.fd));
    bound(handle.fd, file, handle.anchors);
    return value;
  } finally {
    fs.closeSync(handle.fd);
  }
}
export function writeProtectedText(file: string, value: string) {
  const handle = open(
    file,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL
  );
  try {
    fs.writeFileSync(handle.fd, value);
    fs.fsyncSync(handle.fd);
    bound(handle.fd, file, handle.anchors);
    syncParent(file, handle.anchors);
  } finally {
    fs.closeSync(handle.fd);
  }
}
export function writeProtected(file: string, value: unknown) {
  writeProtectedText(file, JSON.stringify(value));
}
export function replaceProtected<T>(
  file: string,
  value: T,
  expected: (old: T) => boolean
) {
  const old = open(file, fs.constants.O_RDONLY);
  const temporary = join(
    dirname(file),
    `.${basename(file)}.${randomUUID()}.tmp`
  );
  let next: ReturnType<typeof open> | undefined;
  try {
    if (!expected(JSON.parse(text(old.fd))))
      throw new Error('Protected journal owner/revision changed.');
    next = open(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL
    );
    fs.writeFileSync(next.fd, JSON.stringify(value));
    fs.fsyncSync(next.fd);
    bound(old.fd, file, old.anchors);
    bound(next.fd, temporary, next.anchors);
    fs.renameSync(temporary, file);
    bound(next.fd, file, next.anchors);
    syncParent(file, next.anchors);
  } finally {
    if (next) fs.closeSync(next.fd);
    fs.closeSync(old.fd);
  }
  // A failed/interrupted checkpoint may leave a protected .tmp for RE inspection.
  // Never delete/replace an unknown leaf or automatically retry issuance.
}
export function openProtectedJournal(file: string) {
  const handle = open(
    file,
    fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_APPEND
  );
  try {
    syncParent(file, handle.anchors);
  } catch (error) {
    fs.closeSync(handle.fd);
    throw error;
  }
  return {
    read(): any[] {
      bound(handle.fd, file, handle.anchors);
      const rows = text(handle.fd)
        .split('\n')
        .filter(Boolean)
        .map((s) => JSON.parse(s));
      bound(handle.fd, file, handle.anchors);
      return rows;
    },
    append(value: unknown) {
      bound(handle.fd, file, handle.anchors);
      fs.writeFileSync(handle.fd, JSON.stringify(value) + '\n');
      fs.fsyncSync(handle.fd);
      bound(handle.fd, file, handle.anchors);
    },
    close() {
      fs.closeSync(handle.fd);
    },
  };
}
