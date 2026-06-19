"""
Hardened/stress test for the neutral worked example.
- Uses lexicon size 144 (the "144 names" analogue)
- Generates combos from a small alphabet up to length 4 (340 combos)
- Demonstrates modulo mapping collision case
- Implements composite-token mapping (base-lexicon sequences) to guarantee uniqueness
- Runs Trithemius encode/decode and verifies full recoverability
- Writes a JSON manifest with mapping, encoded strings, and reconstruction results

Run: powershell -NoLogo -NoProfile -Command "Set-Location -LiteralPath 'G:\\My Drive\\The_Sovereign'; python -u 'docs/neutral_worked_example_harden.py'"
"""

import json
import time
import unicodedata
from itertools import product
import os


def normalize(s):
    return unicodedata.normalize('NFKC', str(s))


def generate_combinations(alphabet, max_len):
    combos = []
    for L in range(1, max_len + 1):
        for p in product(alphabet, repeat=L):
            combos.append(''.join(p))
    return combos


def make_lexicon(size):
    return [f'NEUTRAL_{i:03d}' for i in range(1, size + 1)]


def shift_char(ch, shift):
    if 'A' <= ch <= 'Z':
        return chr((ord(ch) - 65 + shift) % 26 + 65)
    if 'a' <= ch <= 'z':
        return chr((ord(ch) - 97 + shift) % 26 + 97)
    if '0' <= ch <= '9':
        return str((int(ch) + shift) % 10)
    return ch


def trithemius_encode(token, base=1):
    out = []
    for i, ch in enumerate(token):
        shift = (base + i) % 26
        out.append(shift_char(ch, shift))
    return ''.join(out)


def trithemius_decode(encoded, base=1):
    out = []
    for i, ch in enumerate(encoded):
        shift = (base + i) % 26
        if 'A' <= ch <= 'Z':
            out.append(chr((ord(ch) - 65 - shift) % 26 + 65))
        elif 'a' <= ch <= 'z':
            out.append(chr((ord(ch) - 97 - shift) % 26 + 97))
        elif '0' <= ch <= '9':
            out.append(str((int(ch) - shift) % 10))
        else:
            out.append(ch)
    return ''.join(out)


def minimal_sequence_length(lexicon_size, required):
    # smallest L such that lexicon_size**L >= required
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


def sequence_to_index_from_labels(labels, lexicon_to_idx):
    base = len(lexicon_to_idx)
    idx = 0
    for label in labels:
        idx = idx * base + lexicon_to_idx[label]
    return idx


def composite_map(combos, lexicon):
    n = len(combos)
    base = len(lexicon)
    seq_len = minimal_sequence_length(base, n)
    lex_to_idx = {lbl: i for i, lbl in enumerate(lexicon)}
    mapping = {}
    for i, combo in enumerate(combos):
        digits = index_to_sequence(i, base, seq_len)
        labels = sequence_labels_from_digits(digits, lexicon)
        composite = '|'.join(labels)  # '|' chosen as separator (preserved by encode)
        mapping[combo] = {
            'index': i,
            'composite': composite,
            'sequence_digits': digits,
        }
    return mapping, seq_len, lex_to_idx


def reconstruct_composite(encoded, lexicon_set, lex_to_idx, seq_len, max_base_guess=12):
    # brute-force base key; find a decode that splits into lexicon labels
    for base_guess in range(max_base_guess + 1):
        decoded = trithemius_decode(encoded, base=base_guess)
        parts = decoded.split('|')
        if len(parts) != seq_len:
            continue
        valid = all(p in lexicon_set for p in parts)
        if valid:
            idx = sequence_to_index_from_labels(parts, lex_to_idx)
            return base_guess, decoded, idx, parts
    return None, None, None, None


def main():
    start = time.time()

    alphabet = ['A', 'B', 'C', 'D']
    combos = generate_combinations(alphabet, 4)
    combos = [normalize(c) for c in combos]
    combos_count = len(combos)

    lexicon_size = 144
    lexicon = make_lexicon(lexicon_size)
    lexicon = [normalize(x) for x in lexicon]

    print(f"Combos: {combos_count}, Lexicon size: {lexicon_size}")

    # Demonstrate naive modulo mapping and collisions
    modulo_map = {}
    for i, combo in enumerate(combos):
        modulo_map[combo] = lexicon[i % len(lexicon)]

    # Count collisions: how many combos map to same lexicon token
    counts = {}
    for combo, tok in modulo_map.items():
        counts[tok] = counts.get(tok, 0) + 1
    max_collision = max(counts.values())
    colliding_tokens = sum(1 for v in counts.values() if v > 1)
    print(f"Naive modulo mapping: colliding tokens: {colliding_tokens}, max combos per token: {max_collision}")

    # Now build composite mapping to guarantee unique mapping
    composite_map_result, seq_len, lex_to_idx = composite_map(combos, lexicon)
    lexicon_set = set(lexicon)

    print(f"Composite sequence length chosen: {seq_len} (capacity: {lexicon_size}**{seq_len})")

    # Encode all composite tokens with Trithemius base key
    base_key = 7
    manifest = {}
    success = 0
    failures = 0
    for combo, info in composite_map_result.items():
        composite = info['composite']
        encoded = trithemius_encode(composite, base=base_key)
        # attempt reconstruction
        base_guess, decoded, idx, parts = reconstruct_composite(encoded, lexicon_set, lex_to_idx, seq_len, max_base_guess=12)
        ok = (base_guess == base_key and decoded == composite and idx == info['index'])
        manifest[combo] = {
            'index': info['index'],
            'composite': composite,
            'encoded': encoded,
            'recovered_base': base_guess,
            'recovered_index': idx,
            'recovered_parts': parts,
            'ok': ok,
        }
        if ok:
            success += 1
        else:
            failures += 1

    elapsed = time.time() - start
    print(f"Test complete in {elapsed:.2f}s — success: {success}, failures: {failures}")

    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'neutral_worked_example_harden_manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as fh:
        json.dump({
            'combos_count': combos_count,
            'lexicon_size': lexicon_size,
            'seq_len': seq_len,
            'base_key': base_key,
            'success': success,
            'failures': failures,
            'mappings_sample': dict(list(manifest.items())[:20])
        }, fh, indent=2, ensure_ascii=False)

    print(f"Wrote manifest: {manifest_path}")

    print("\nFindings and recommendations:")
    print("- Naive modulo mapping causes collisions when combos > lexicon size; original combo isn't recoverable from token alone.")
    print("- Composite-token mapping (sequence of lexicon tokens) guarantees unique, reversible mapping; sequence length chosen to fit combos.")
    print("- Trithemius decoding by brute-force base is feasible for small base ranges; for production, store the base key or use a keyed cipher/HMAC for authenticity.")
    print("- Persist mapping manifest (done). Use normalization and avoid exotic unicode in lexicon labels for robustness.")


if __name__ == '__main__':
    main()
