"""
Cryptographic Extraction — Boustrophedon Triad Parsing
Extracts canonical state signatures from the 144-fold matrix.
Implements reversible AEAD token encoding for state identity.
"""

import hashlib
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class CryptographicExtraction:
    """
    Implements boustrophedon (alternating direction) parsing.
    Extracts canonical signatures from combinatorial states.
    Produces reversible AEAD (AES-GCM) cryptographic tokens for state identity.
    """

    def __init__(self, key: str = "default-state-key-must-be-rotated"):
        self.key = key
        # Derive a 32-byte key for AES-256-GCM
        self._derived_key = hashlib.sha256(key.encode()).digest()
        self._aesgcm = AESGCM(self._derived_key)

    def boustrophedon_parse(self, text: str) -> str:
        """
        Parse text in boustrophedon pattern (left→right, then right→left).
        Simulates ancient writing system symmetry.
        """
        lines = text.split("\n")
        result = []
        for i, line in enumerate(lines):
            if i % 2 == 0:
                result.append(line)  # Left to right
            else:
                result.append(line[::-1])  # Right to left
        return "\n".join(result)

    def extract_signature(self, state_index: int, b_attr: str, k_princ: str) -> str:
        """
        Extract canonical signature from a combinatorial state.
        Combines index, attributes, and principles.
        """
        canonical = f"{state_index:03d}|{b_attr}|{k_princ}"
        return hashlib.sha256(canonical.encode()).hexdigest()[:16]

    def encode_state_token(self, state_data: dict) -> str:
        """
        Encode a state into a cryptographic token using AES-GCM.
        Token contains nonce + ciphertext (payload + auth tag).
        """
        signature = self.extract_signature(
            state_data.get("index", 0),
            state_data.get("B_attribute", ""),
            state_data.get("K_principle", ""),
        )
        
        payload = f"{signature}|{state_data.get('combination', '')}".encode('utf-8')
        
        # 96-bit nonce
        nonce = os.urandom(12)
        
        # Encrypt with a fixed AAD
        ciphertext = self._aesgcm.encrypt(nonce, payload, b"sovereign-state-token")
        
        # Combine nonce and ciphertext and encode as base64
        token_bytes = nonce + ciphertext
        token = base64.urlsafe_b64encode(token_bytes).decode('utf-8')
        return token

    def decode_state_token(self, token: str) -> dict:
        """Decode and authenticate a state token using AES-GCM."""
        try:
            token_bytes = base64.urlsafe_b64decode(token.encode('utf-8'))
            if len(token_bytes) < 28:  # 12 (nonce) + 16 (tag)
                return {"valid": False, "reason": "Invalid token length"}
                
            nonce = token_bytes[:12]
            ciphertext = token_bytes[12:]
            
            # Decrypt and authenticate
            plaintext = self._aesgcm.decrypt(nonce, ciphertext, b"sovereign-state-token")
            parts = plaintext.decode('utf-8').split("|")
            
            return {
                "signature": parts[0],
                "combination": parts[1] if len(parts) > 1 else "",
                "valid": True,
            }
        except Exception as e:
            return {"valid": False, "reason": f"AEAD Decryption failed: {str(e)}"}
