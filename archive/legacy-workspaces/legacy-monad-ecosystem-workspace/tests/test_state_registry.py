import pytest
from state_registry import AlphabetWheel, CryptographicExtraction, ApoptosisLifecycle

def test_alphabet_wheel():
    wheel = AlphabetWheel()
    assert len(wheel.matrix) == 144
    
    # Check valid state
    state = wheel.get_state(72)
    assert state is not None
    assert state["index"] == 72
    
    # Check bounds
    assert wheel.get_state(-1) is None
    assert wheel.get_state(144) is None

def test_cryptographic_extraction_aead():
    crypto = CryptographicExtraction()
    
    state_data = {
        "index": 42,
        "B_attribute": "Goodness",
        "K_principle": "Truth",
        "combination": "Goodness_Truth"
    }
    
    token = crypto.encode_state_token(state_data)
    assert isinstance(token, str)
    assert len(token) > 20
    
    decoded = crypto.decode_state_token(token)
    assert decoded["valid"] is True
    assert decoded["combination"] == "Goodness_Truth"
    assert "signature" in decoded
    
    # Test invalid token decode
    invalid = crypto.decode_state_token("INVALID_TOKEN_STRING_THAT_IS_NOT_BASE64")
    assert invalid["valid"] is False

def test_boustrophedon_parse():
    crypto = CryptographicExtraction()
    text = "LINE1\nLINE2\nLINE3"
    parsed = crypto.boustrophedon_parse(text)
    
    # LINE1 -> left-to-right
    # LINE2 -> right-to-left
    # LINE3 -> left-to-right
    expected = "LINE1\n2ENIL\nLINE3"
    assert parsed == expected

def test_apoptosis_lifecycle():
    apoptosis = ApoptosisLifecycle()
    apoptosis.trigger_isolation("AGENT_X", 0.65)
    
    status = apoptosis.get_isolation_status()
    assert status["total_isolated"] == 1
    assert "AGENT_X" in apoptosis.isolated_states
