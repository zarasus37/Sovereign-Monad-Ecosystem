import pytest
from compiler import TargetGenerator, SignGraph, SemioticDialect, ProvenanceWrapper
from compiler.target_gen import PipelineHaltException

def test_target_generator_perspective_validation():
    generator = TargetGenerator()
    # Test valid dyadic interception (pure monads or triads)
    assert generator.validate_camera_perspective("AAA") is True
    assert generator.validate_camera_perspective("ABC") is True
    # Dyadic collapse should be intercepted
    assert generator.validate_camera_perspective("AAB") is False
    assert generator.validate_camera_perspective("ABB") is False
    # Invalid length
    assert generator.validate_camera_perspective("AB") is False
    assert generator.validate_camera_perspective("ABCD") is False

def test_target_generator_compute_pps():
    generator = TargetGenerator()
    # PPS for pure monad
    pps_monad = generator.compute_pps("AAA", macrocosmic_slot=72)
    assert pps_monad >= 0.5  # Should be close to 1.0 depending on friction
    
    # PPS for pure triad
    pps_triad = generator.compute_pps("ABC", macrocosmic_slot=72)
    assert pps_triad >= 0.0  # Should be around 0.3 - friction

def test_provenance_dialect():
    provenance = ProvenanceWrapper()
    token = provenance.initialize_linear_token(index=1, parent_signature="TEST_PARENT")
    assert token.startswith("TK-")
    
    key_cap = provenance.issue_key_cap(token_id=token, wheel_domain="WHEEL_TEST", coordinate_key=42)
    assert key_cap.startswith("KC-WHEEL_TEST-42")
    
    payload = {"downstream_data": {"bytecode_alias": "TEST_OP"}}
    wrapped = provenance.consume_and_wrap_payload(key_cap, payload, macrocosmic_slot=42)
    assert wrapped["container_header"] == "SHEM_ANGEL_BOUND_WRAPPER"
    assert wrapped["encapsulated_state"]["macrocosmic_slot_target"] == 42
    
    # Verify replay attack protection
    replay = provenance.consume_and_wrap_payload(key_cap, payload, macrocosmic_slot=42)
    assert replay["status"] == "PROVENANCE_FAIL"
