import re
from generate_pairs import make_chosen, PROMPTS


def opening_prefix(response):
    first_line = response.splitlines()[0]
    body = first_line.split(":", 1)[1].strip()
    return " ".join(body.split()[:7])


def test_chosen_responses_use_varied_openings():
    samples = [make_chosen(prompt) for prompt in PROMPTS[:12]]
    prefixes = {opening_prefix(sample) for sample in samples}
    assert len(prefixes) >= 4, f"Expected varied openings, got {sorted(prefixes)}"
