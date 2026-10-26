#!/usr/bin/env python3
"""Initialize server-only configuration without printing credentials."""
from pathlib import Path
import os
import secrets

config_dir = Path('/etc/postiz')
config_dir.mkdir(mode=0o700, exist_ok=True)
os.chmod(config_dir, 0o700)
env_path = config_dir / 'runtime.env'
if env_path.exists():
    raise SystemExit('Existing runtime.env preserved; inspect before reinitializing.')

example = Path('/opt/postiz/runtime.env.example').read_text()
for key in ('JWT_SECRET', 'POSTIZ_DB_PASSWORD', 'TEMPORAL_DB_PASSWORD'):
    example = example.replace(f'{key}=GENERATE_ON_SERVER', f'{key}={secrets.token_hex(32)}')
env_path.write_text(example)
os.chmod(env_path, 0o600)
r2_path = config_dir / 'r2.env'
if not r2_path.exists():
    r2_path.write_text('CLOUDFLARE_ACCESS_KEY=\nCLOUDFLARE_SECRET_ACCESS_KEY=\n')
os.chmod(r2_path, 0o600)
print('Root-only Postiz configuration created; secret values withheld.')
