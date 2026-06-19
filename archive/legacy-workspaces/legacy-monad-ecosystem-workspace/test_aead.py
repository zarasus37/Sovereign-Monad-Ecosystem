import hashlib
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class CryptographicExtraction:
    def __init__(self, key: str = "default-state-key-must-be-rotated"):
        self.key = key
        self._derived_key = hashlib.sha256(key.encode()).digest()
        self._aesgcm = AESGCM(self._derived_key)

    def extract_signature(self, state_index: int, b_attr: str, k_princ: str) -> str:
        canonical = f"{state_index:03d}|{b_attr}|{k_princ}"
        return hashlib.sha256(canonical.encode()).hexdigest()[:16]

    def encode_state_token(self, state_data: dict) -> str:
        signature = self.extract_signature(
            state_data.get("index", 0),
            state_data.get("B_attribute", ""),
            state_data.get("K_principle", ""),
        )
        payload = f"{signature}|{state_data.get('combination', '')}".encode('utf-8')
        nonce = os.urandom(12)
        ciphertext = self._aesgcm.encrypt(nonce, payload, b"sovereign-state-token")
        token_bytes = nonce + ciphertext
        return base64.urlsafe_b64encode(token_bytes).decode('utf-8')

    def decode_state_token(self, token: str) -> dict:
        try:
            token_bytes = base64.urlsafe_b64decode(token.encode('utf-8'))
            if len(token_bytes) < 28:
                return {"valid": False, "reason": "Invalid token length"}
            nonce = token_bytes[:12]
            ciphertext = token_bytes[12:]
            plaintext = self._aesgcm.decrypt(nonce, ciphertext, b"sovereign-state-token")
            parts = plaintext.decode('utf-8').split("|")
            return {
                "signature": parts[0],
                "combination": parts[1] if len(parts) > 1 else "",
                "valid": True,
            }
        except Exception as e:
            return {"valid": False, "reason": f"AEAD Decryption failed: {str(e)}"}

# Test
ce = CryptographicExtraction()
state = {
    "index": 42,
    "B_attribute": "Goodness",
    "K_principle": "Truth",
    "combination": "Goodness_Truth"
}
token = ce.encode_state_token(state)
print("Token:", token)
decoded = ce.decode_state_token(token)
print("Decoded:", decoded)
