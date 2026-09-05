"""
Deploy script for Aura.

Run with:
    python -c "import sys; sys.argv=['gltest','scripts/deploy_aura.py','-v','-s','--network','studionet']; from gltest_cli.main import main; main()"

(gltest.exe hits a Permission denied error in this environment, so it's
invoked via its Python entrypoint directly.)
"""

import time
from pathlib import Path

from gltest import get_contract_factory, get_accounts

CONTRACTS_DIR = Path(__file__).parent.parent / "contracts"


def test_deploy_aura_v1():
    account = get_accounts()[0]
    factory = get_contract_factory(contract_file_path=CONTRACTS_DIR / "Aura.py")
    contract = factory.deploy(args=[], account=account)
    print("DEPLOYED_ADDRESS:", contract.address)
    time.sleep(1)
