"""
Neutral worked example demonstrating:
- Llull combinatory generation (alphabet -> combos)
- mapping combos -> neutral lexicon tokens (scaled-down)
- Trithemius-style progressive shift encoding
- Peircean interpretive reconstruction (abduction → deduction → induction)

Run: python docs/neutral_worked_example.py
"""

from itertools import product


def generate_combinations(alphabet, max_len):
    combos = []
    for L in range(1, max_len + 1):
        for p in product(alphabet, repeat=L):
            combos.append(''.join(p))
    return combos


def make_lexicon(size):
    return [f'NEUTRAL_{i:03d}' for i in range(1, size + 1)]


def map_combinations(combos, lexicon):
    mapping = {}
    for i, c in enumerate(combos):
        mapping[c] = lexicon[i % len(lexicon)]
    return mapping


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


def reconstruct_mapping(encoded_token, lexicon, max_base_guess=10):
    # Abduction: hypothesize progressive-shift encoding; brute-force base key
    for base_guess in range(max_base_guess + 1):
        decoded = trithemius_decode(encoded_token, base=base_guess)
        if decoded in lexicon:
            return base_guess, decoded
    return None, None


def main():
    alphabet = ['A', 'B', 'C']  # Llull-style primitives (scaled-down)
    combos = generate_combinations(alphabet, 3)  # lengths 1..3
    lexicon = make_lexicon(12)  # scaled-down neutral lexicon
    mapping = map_combinations(combos, lexicon)

    print("Example: first 12 combinations -> tokens")
    for i, (comb, tok) in enumerate(list(mapping.items())[:12], 1):
        print(f"{i:02d}. {comb} -> {tok}")

    base_key = 3
    print(f"\nEncoding tokens with Trithemius-style progressive shift (base={base_key}):")
    encoded_map = {}
    for comb, tok in list(mapping.items())[:12]:
        enc = trithemius_encode(tok, base=base_key)
        encoded_map[comb] = (tok, enc)
        print(f"{comb} : {tok} -> {enc}")

    print("\nPeircean-style reconstruction (abduction → deduction → induction):")
    for comb, (tok, enc) in encoded_map.items():
        base_guess, decoded = reconstruct_mapping(enc, lexicon, max_base_guess=8)
        if base_guess is not None:
            print(f"Recovered for {comb}: encoded={enc} → decoded={decoded} (base_guess={base_guess})")
        else:
            print(f"Failed to recover {comb}: encoded={enc} (no lexicon match within base guesses)")

    print("\nSummary: this scaled-down worked example shows:")
    print("- Llull combinatory generation (3 primitives, lengths 1..3)")
    print("- Deterministic mapping to a neutral lexicon (12 tokens)")
    print("- Trithemius progressive-shift encoding (per-character incremental shift)")
    print("- Peircean reconstruction via abductive hypothesis and brute-force deduction")


if __name__ == '__main__':
    main()
