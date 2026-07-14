"""``python -m gnosis_training`` entry point — delegates to ``cli.main``."""
from __future__ import annotations

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())