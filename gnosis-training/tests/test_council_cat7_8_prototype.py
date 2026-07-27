"""GP-3 council CAT7/CAT8 prototype generator."""
from __future__ import annotations

import importlib.util
from pathlib import Path

from gnosis_training.preference import validate_pair


def _load_gen():
    path = Path(__file__).resolve().parents[1] / "scripts" / "generate_council_cat7_8_prototype.py"
    spec = importlib.util.spec_from_file_location("council_proto", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_council_prototype_50_valid_g1():
    mod = _load_gen()
    pairs = mod.build_prototype_pairs()
    assert len(pairs) == 50
    cat7 = [p for p in pairs if p.category == "CAT7"]
    cat8 = [p for p in pairs if p.category == "CAT8"]
    assert len(cat7) == 28
    assert len(cat8) == 22
    for p in pairs:
        assert p.provenance_tier == "G1"
        assert p.generator and p.generator.startswith("council:")
        assert p.synthetic is True
        assert validate_pair(p) == []
        if p.category == "CAT8":
            assert p.apeiron is True
