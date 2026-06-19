"""
Generate mapping manifests for all non-.py files in the workspace.
Outputs:
 - notebooklm_manifest/mapping_manifest.csv
 - notebooklm_manifest/mapping_manifest.json

Default encoding: HMAC-SHA256 authenticated token (auth-only fallback).
Set environment variable MAPPING_KEY for the keyed auth value.

Run:
 powershell -NoLogo -NoProfile -Command "Set-Location -LiteralPath 'G:\\My Drive\\The_Sovereign'; python -u 'scripts/generate_file_mapping_manifest.py'"
"""

import os
import sys
import hashlib
import hmac
import base64
import json
import csv
import unicodedata
import time


def normalize(s):
    return unicodedata.normalize('NFKC', str(s))


def compute_md5(path, chunk_size=8192):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def make_lexicon(size):
    return [f'NEUTRAL_{i:03d}' for i in range(1, size + 1)]


def minimal_sequence_length(lexicon_size, required):
    L = 1
    cap = lexicon_size
    while cap < required:
        L += 1
        cap *= lexicon_size
    return L


def index_to_sequence(index, lexicon_size, seq_len):
    digits = []
    idx = index
    base = lexicon_size
    for _ in range(seq_len):
        digits.append(idx % base)
        idx //= base
    digits = list(reversed(digits))
    return digits


def sequence_labels_from_digits(digits, lexicon):
    return [lexicon[d] for d in digits]


def composite_map(items, lexicon):
    n = len(items)
    base = len(lexicon)
    seq_len = minimal_sequence_length(base, n)
    mapping = {}
    for i, item in enumerate(items):
        digits = index_to_sequence(i, base, seq_len)
        labels = sequence_labels_from_digits(digits, lexicon)
        composite = '|'.join(labels)
        mapping[item] = {
            'index': i,
            'composite': composite,
            'sequence_digits': digits,
        }
    return mapping, seq_len


def hmac_token(key, composite):
    mac = hmac.new(key.encode('utf-8'), composite.encode('utf-8'), hashlib.sha256).digest()
    token_bytes = mac + b'|' + composite.encode('utf-8')
    return base64.urlsafe_b64encode(token_bytes).decode('ascii')


def main():
    start = time.time()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.abspath(os.path.join(script_dir, '..'))

    output_dir = os.path.join(base_dir, 'notebooklm_manifest')
    os.makedirs(output_dir, exist_ok=True)

    exclude_dirs = {'.git', '.git-rewrite', '.venv', 'node_modules', '__pycache__', '.claude', '.playwright-cli', '.azurite', 'notebooklm_manifest'}
    exclude_files = {os.path.abspath(__file__)}

    file_items = []
    for root, dirs, files in os.walk(base_dir):
        # prune excluded dirs in-place
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for fn in files:
            if fn.lower().endswith('.py'):
                continue
            full = os.path.join(root, fn)
            if os.path.abspath(full) in exclude_files:
                continue
            rel = os.path.relpath(full, base_dir)
            try:
                md5 = compute_md5(full)
            except Exception as e:
                md5 = None
            file_items.append({'relpath': normalize(rel), 'abspath': full, 'md5': md5})

    if not file_items:
        print('No non-.py files found to map.')
        return

    # lexicon
    lexicon_size = 144
    lexicon = make_lexicon(lexicon_size)

    # build composite mapping
    combos = [it['relpath'] for it in file_items]
    mapping, seq_len = composite_map(combos, lexicon)

    # keyed auth key
    key = os.environ.get('MAPPING_KEY', 'default-insecure-key-change-me')

    csv_path = os.path.join(output_dir, 'mapping_manifest.csv')
    json_path = os.path.join(output_dir, 'mapping_manifest.json')

    rows = []
    manifest = {}
    for it in file_items:
        rel = it['relpath']
        info = mapping[rel]
        composite = info['composite']
        token = hmac_token(key, composite)
        rows.append({
            'index': info['index'],
            'relative_path': rel,
            'md5': it['md5'],
            'sequence_digits': info['sequence_digits'],
            'composite': composite,
            'encoded_token': token,
            'encoding': 'hmac-sha256+composite-b64'
        })
        manifest[rel] = {
            'index': info['index'],
            'composite': composite,
            'encoded_token': token,
            'md5': it['md5']
        }

    # write CSV
    with open(csv_path, 'w', newline='', encoding='utf-8') as csvf:
        fieldnames = ['index', 'relative_path', 'md5', 'sequence_digits', 'composite', 'encoded_token', 'encoding']
        w = csv.DictWriter(csvf, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            # flatten sequence_digits for CSV
            r2 = r.copy()
            r2['sequence_digits'] = ','.join(str(x) for x in r2['sequence_digits'])
            w.writerow(r2)

    # write JSON (lookup map)
    with open(json_path, 'w', encoding='utf-8') as jh:
        json.dump({
            'created_at': time.time(),
            'base_dir': base_dir,
            'lexicon_size': lexicon_size,
            'seq_len': seq_len,
            'encoding': 'hmac-sha256+composite-b64',
            'items': manifest
        }, jh, indent=2, ensure_ascii=False)

    elapsed = time.time() - start
    print(f"Scanned files: {len(file_items)} — wrote CSV: {csv_path}")
    print(f"Wrote JSON manifest: {json_path} — elapsed {elapsed:.2f}s")
    print('\nNotes:')
    print('- Current encoding is AUTHENTICATED only (HMAC). This ensures anti-tamper but NOT confidentiality.')
    print('- For secrecy use an AEAD cipher (AES-GCM) or Fernet from the cryptography package.')


if __name__ == '__main__':
    main()
