import json
from pathlib import Path
import re

INPUT_DIR = Path(__file__).parent / "preference_pairs_output"
OUTPUT_DIR = Path(__file__).parent / "preference_pairs_output_qc"
OUTPUT_DIR.mkdir(exist_ok=True)

DOMAIN_MAP = [
    (r"market|markets|trader|trading|boom-bust|pareto|decentral|compound", "DeFi/markets"),
    (r"poker|gambler|speculator|house", "Poker/Game-theory"),
    (r"ai|model|training|smart contract|code|algorithm", "AI/Model Design"),
    (r"theolog|mystic|spiritual|mystical|symbol", "Theology/Cosmology"),
    (r"sovereign|sovereignty|decision-making|exit a position|betrayal|alignment", "Personal Sovereignty"),
]


def detect_domain(prompt):
    p = prompt.lower()
    hits = []
    for pattern, name in DOMAIN_MAP:
        if re.search(pattern, p):
            hits.append(name)
    return hits[0] if hits else None


def deepen_lens(lens_label, prompt, domain):
    # Provide a more domain-specific sentence for each lens
    if domain == "DeFi/markets":
        if lens_label == "THEOLOGICAL LENS":
            return f"{lens_label}: Market beliefs and covenant-like trust structures form the origin pattern that orients agent incentives in {domain}."
        if lens_label == "TECHNOLOGICAL LENS":
            return f"{lens_label}: Mechanically, price-discovery, liquidity provision, and arbitrage act as the system-level mechanisms driving observable cycles."
        if lens_label == "COSMOLOGICAL LENS":
            return f"{lens_label}: Over long horizons, fat tails, compounding, and network effects produce systemic centralization or collapse."
        if lens_label == "LOGIC COMPRESSION":
            return f"{lens_label}: The belief structure constrains incentives, incentives shape mechanisms, and mechanisms compound across scale to produce the market-level phenomenon."
    if domain == "Poker/Game-theory":
        if lens_label == "THEOLOGICAL LENS":
            return f"{lens_label}: The archetype is risk-and-information, where ritualized play exposes strategic truth."
        if lens_label == "TECHNOLOGICAL LENS":
            return f"{lens_label}: Mechanisms: expected value calculation, variance, bluffing as signaling, and equilibrium strategies."
        if lens_label == "COSMOLOGICAL LENS":
            return f"{lens_label}: At scale, small edge advantages compound and shape population-level distributions of winners and losers."
        if lens_label == "LOGIC COMPRESSION":
            return f"{lens_label}: Signal, strategy, and aggregation fuse: signaling rules determine exploitable patterns that compound into long-run advantage."
    if domain == "AI/Model Design":
        if lens_label == "THEOLOGICAL LENS":
            return f"{lens_label}: At the origin is a design rationale: what task the model is meant to reveal about the world."
        if lens_label == "TECHNOLOGICAL LENS":
            return f"{lens_label}: Architecturally, learning dynamics, loss landscapes, and data curation produce the observed capabilities and biases."
        if lens_label == "COSMOLOGICAL LENS":
            return f"{lens_label}: Over training scale and deployment, minor inductive biases become dominant behaviors at system scale."
        if lens_label == "LOGIC COMPRESSION":
            return f"{lens_label}: Task definition constrains training regimes, which shape inductive priors and thus emergent model behavior."
    if domain == "Theology/Cosmology":
        if lens_label == "THEOLOGICAL LENS":
            return f"{lens_label}: The origin story encodes symbolic operators that order meaning across practices."
        if lens_label == "TECHNOLOGICAL LENS":
            return f"{lens_label}: Ritual and institutional forms act as mechanisms translating symbols into durable social structure."
        if lens_label == "COSMOLOGICAL LENS":
            return f"{lens_label}: Mythic timeframes and cosmologies scale individual acts into cultural patterns across generations."
        if lens_label == "LOGIC COMPRESSION":
            return f"{lens_label}: Symbols enable mechanisms to stabilize across time, producing predictable cultural arcs."
    if domain == "Personal Sovereignty":
        if lens_label == "THEOLOGICAL LENS":
            return f"{lens_label}: The origin is the individual's narrative of agency and boundary-setting."
        if lens_label == "TECHNOLOGICAL LENS":
            return f"{lens_label}: Mechanisms include commitment devices, signalling, and institution design that preserve autonomy."
        if lens_label == "COSMOLOGICAL LENS":
            return f"{lens_label}: Over life horizons, decisions compound into a trajectory that defines sovereignty."
        if lens_label == "LOGIC COMPRESSION":
            return f"{lens_label}: Narrative, mechanism, and trajectory fuse into actionable rules for sustained autonomy."
    # Fallback: make generic deeper lens
    return f"{lens_label}: {prompt} — a focused reflection linking origin, mechanism, and scale."


def improve_pair(pair):
    prompt = pair.get("prompt", "")
    domain = detect_domain(prompt)
    chosen_text = pair["chosen"]["response"]

    # Attempt to split into lines and replace lens lines
    lines = chosen_text.splitlines()
    labels = ["THEOLOGICAL LENS:", "TECHNOLOGICAL LENS:", "COSMOLOGICAL LENS:", "LOGIC COMPRESSION:"]
    new_lines = []
    for label in labels:
        new_lines.append(deepen_lens(label.rstrip(':'), prompt, domain))

    new_response = "\n".join(new_lines)
    pair["chosen"]["response"] = new_response
    # Update chosen notes to mention domain
    if domain:
        pair["chosen"]["notes"] = f"Chosen deepens domain: {domain}. Shows fused JOIN across lenses."
    else:
        pair["chosen"]["notes"] = "Chosen deepens tripartite lenses and clarifies the JOIN."
    return pair


def process_file(inpath, outpath):
    updated = 0
    with inpath.open("r", encoding="utf-8") as inf, outpath.open("w", encoding="utf-8") as outf:
        for line in inf:
            if not line.strip():
                continue
            pair = json.loads(line)
            pair = improve_pair(pair)
            outf.write(json.dumps(pair, ensure_ascii=False) + "\n")
            updated += 1
    return updated


def main():
    files = sorted(INPUT_DIR.glob("preference_pairs_*.jsonl"))
    total = 0
    for f in files:
        out = OUTPUT_DIR / f.name
        n = process_file(f, out)
        print(f"Processed {n} pairs: {f.name} -> {out}")
        total += n
    # Merge
    all_out = OUTPUT_DIR / "preference_pairs_ALL.jsonl"
    with all_out.open("w", encoding="utf-8") as aout:
        for f in sorted(OUTPUT_DIR.glob("preference_pairs_*.jsonl")):
            if f.name == "preference_pairs_ALL.jsonl":
                continue
            with f.open("r", encoding="utf-8") as inf:
                for line in inf:
                    aout.write(line)
    print(f"Wrote merged QC ALL file: {all_out}")


if __name__ == "__main__":
    main()
