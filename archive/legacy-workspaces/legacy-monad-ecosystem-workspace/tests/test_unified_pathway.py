import pytest
from main import MonadEcosystemCore

def test_unified_pathway_focal_lock():
    core = MonadEcosystemCore()
    transaction = {
        "input_expression": "And there was light",
        "camera_perspective": "AAA",  # Monad perspective
        "capital_amount": 1000.0,
        "state_index": 42,
        "agent_id": "TEST_AGENT"
    }
    
    result = core.run_unified_pathway(transaction)
    
    assert result["container_header"] == "SHEM_ANGEL_BOUND_WRAPPER"
    assert result["provenance_sealed"] is True
    assert result["encapsulated_state"]["macrocosmic_slot_target"] == 42
    
    # Check downstream data was preserved
    assert result["encapsulated_state"]["isolated_data_rail"]["bytecode_alias"] == "FINAL_OUTPUT"

def test_unified_pathway_dyadic_abort():
    core = MonadEcosystemCore()
    transaction = {
        "input_expression": "Dyadic collapse attempt",
        "camera_perspective": "AAB",  # Dyadic perspective (should fail)
        "capital_amount": 1000.0,
        "state_index": 42,
        "agent_id": "TEST_AGENT"
    }
    
    result = core.run_unified_pathway(transaction)
    assert result["status"] == "ABORT"
    assert result["reason"] == "Dyadic reduction"
