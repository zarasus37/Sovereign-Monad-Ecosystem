import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("generate_pairs", Path("generate_pairs.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_logic_compression_uses_prompt_specific_topic():
    prompt_one = "What does the concept of entropy reveal about spiritual traditions?"
    prompt_two = "Is free will compatible with a deterministic universe?"

    response_one = module.make_chosen(prompt_one, 0)
    response_two = module.make_chosen(prompt_two, 1)

    logic_one = response_one.split("LOGIC COMPRESSION:", 1)[1].lower()
    logic_two = response_two.split("LOGIC COMPRESSION:", 1)[1].lower()

    assert "entropy" in logic_one
    assert "free will" in logic_two
