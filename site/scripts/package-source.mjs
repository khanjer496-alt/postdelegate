import {spawnSync} from 'node:child_process';
import {copyFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
if(!existsSync(new URL('LICENSE',root)))copyFileSync(new URL('../../LICENSE',import.meta.url),new URL('LICENSE',root));
const args=['-czf','public/website-source.tar.gz','--exclude=public/website-source.tar.gz','--exclude=.DS_Store','--exclude=._*','src','public','scripts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','astro.config.mjs','tsconfig.json','.gitignore','LICENSE','README.md'];
const result=spawnSync('tar',args,{cwd:root,stdio:'inherit',env:{...process.env,COPYFILE_DISABLE:'1'}});
if(result.status!==0)process.exit(result.status??1);
