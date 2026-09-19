#!/usr/bin/env bash
# Prepare a local review archive. This script never reads credentials or uploads.
set -euo pipefail
cd "$(dirname "$0")"
python3 - "${1:-}" <<'PY'
from pathlib import Path
import hashlib, json, re, struct, sys, zipfile
root = Path.cwd()
files = ['manifest.json','config.js','supabase.js','background.js','panel.html','panel.js','panel.css','layout.js','survey-fields.js','survey-rent.js','survey-spaces.js','survey-flyers.js','icons/icon16.png','icons/icon48.png','icons/icon128.png']
manifest = json.loads((root/'manifest.json').read_text())
assert manifest['manifest_version'] == 3
assert manifest['version'] == '1.4.3', 'Manifest differs from the prepared candidate version.'
for size, icon in manifest['icons'].items():
    data=(root/icon).read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24]) == (int(size),int(size))
refs = re.findall(r'<(?:script|link)[^>]+(?:src|href)="([^"]+)"', (root/'panel.html').read_text())
refs += re.findall(r'["\']([^"\']+\.js)["\']',re.search(r'importScripts\(([^)]+)\)',(root/'background.js').read_text()).group(1))
assert set(refs) <= set(files), f'Missing runtime imports: {set(refs)-set(files)}'
output=Path(sys.argv[1] or f"output/masterappsurvey-v{manifest['version']}.zip").resolve(); output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in files: archive.write(root/name,name)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(files)
    for name in files: assert archive.read(name) == (root/name).read_bytes(), name
print(json.dumps({'archive':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'runtime_files':len(files),'manifest_version':manifest['version'],'status':'LOCAL PACKAGE ONLY; no upload, publication or installation'},indent=2))
PY
