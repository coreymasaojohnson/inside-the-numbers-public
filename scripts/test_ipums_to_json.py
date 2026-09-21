import sys
import unittest
from unittest.mock import MagicMock

# Pre-populate missing binary dependencies before importing ipums_to_json_v2
for mod in ["pandas", "lxml", "lxml.etree"]:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

import scripts.ipums_to_json_v2 as ipums


class TestIpumsToJson(unittest.TestCase):
    def test_module_constants(self):
        self.assertEqual(ipums.BPL_FOREIGN_BORN_CUTOFF, 100)
        self.assertEqual(ipums.WEIGHT_COL, "PERWT")
        self.assertEqual(ipums.OTHER_ASIAN, "Other Asian")
        self.assertEqual(ipums.OTHER_NHPI, "Other NHPI")
        self.assertIn(4, ipums.AANHPI_RACE_CODES)
        self.assertIn(5, ipums.AANHPI_RACE_CODES)


if __name__ == "__main__":
    unittest.main()
