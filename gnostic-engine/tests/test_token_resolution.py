import json
import sys
from pathlib import Path

import pytest

# Ensure the package `gnostic_engine` (under src/) is importable when tests run
_cur = Path(__file__).resolve()
for _parent in [ _cur.parent ] + list(_cur.parents):
    _candidate_src = _parent / "src"
    if _candidate_src.exists():
        sys.path.insert(0, str(_candidate_src))
        break

from gnostic_engine import VolumetricScanner


def _find_manifest() -> Path | None:
    cur = Path(__file__).resolve()
    for parent in [cur.parent] + list(cur.parents):
        candidate = parent / "archive" / "generated" / "notebooklm-manifest-export" / "mapping_manifest.json"
        if candidate.exists():
            return candidate
    return None


def test_token_resolution_roundtrip():
    manifest_path = _find_manifest()
    if manifest_path is None:
        pytest.skip("mapping_manifest.json not found in repository")

    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    items = data.get("items") or data.get("files") or {}

    # pick the first entry that has an encoded_token
    encoded_token = None
    expected_rel = None
    expected_md5 = None
    expected_index = None
    for rel, info in items.items():
        if isinstance(info, dict) and info.get("encoded_token"):
            encoded_token = info.get("encoded_token")
            expected_rel = rel
            expected_md5 = info.get("md5")
            expected_index = info.get("index")
            break

    if encoded_token is None:
        pytest.skip("no encoded_token entries found in mapping_manifest.json")

    scanner = VolumetricScanner("test_token")
    result = scanner.ingest(0.12345, encoded_token=encoded_token)

    assert "mapped_file" in result
    assert result["mapped_file"] is not None
    mapped = result["mapped_file"]
    assert mapped.get("relative_path") == expected_rel
    assert mapped.get("md5") == expected_md5
    assert mapped.get("index") == expected_index
