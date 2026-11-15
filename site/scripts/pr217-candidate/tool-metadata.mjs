// Future hosted producer only. Read package/native identity; never execute workerd/runtime.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const [cli,output]=process.argv.slice(2),root=createRequire(join(cli,'package.json'));
const wrangler=root.resolve('wrangler/package.json'),installed=createRequire(wrangler);
const miniflare=installed.resolve('miniflare/package.json'),mf=createRequire(miniflare);
const workerd=mf.resolve('workerd/package.json'),wd=createRequire(workerd);
const native=wd.resolve('@cloudflare/workerd-linux-64/bin/workerd');
const esbuild=installed.resolve('esbuild/package.json');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const version=p=>{const v=JSON.parse(readFileSync(p)).version;if(!/^[0-9][a-zA-Z0-9.+-]{0,80}$/.test(v))throw Error();return v;};
const pnpm=execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim();if(!/^\d+\.\d+\.\d+$/.test(pnpm))throw Error();
const tools={node:process.versions.node,pnpm,wrangler:version(wrangler),miniflare:version(miniflare),workerd:version(workerd),esbuild:version(esbuild)};
const toolFileSha256=Object.fromEntries(Object.entries({cliLockfile:join(cli,'pnpm-lock.yaml'),wranglerPackage:wrangler,
 miniflarePackage:miniflare,workerdPackage:workerd,nativeWorkerd:native,esbuildPackage:esbuild}).map(([k,p])=>[k,hash(p)]));
writeFileSync(output,JSON.stringify({tools,toolFileSha256},null,2)+'\n',{flag:'wx'});
