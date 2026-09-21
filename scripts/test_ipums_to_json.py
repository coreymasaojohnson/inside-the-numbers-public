import unittest
import pandas as pd
import scripts.ipums_to_json_v2 as ipums


class TestIpumsReconciliation(unittest.TestCase):
    def setUp(self):
        self.ancestry_map = {
            "706": "Chinese",
            "700": "Taiwanese",
            "720": "Asian Indian",
            "730": "Filipino",
            "740": "Japanese",
            "750": "Korean",
            "760": "Vietnamese",
            "800": "Native Hawaiian",
            "811": "Samoan",
            "820": "Chamorro",
            "850": "Tongan",
        }
        self.nativity_map = {
            1: "Native",
            2: "Foreign born",
        }

    # -------------------------------------------------------------------------
    # 1. BPL Boundary & Nativity Overrides (is_foreign_born_robust)
    # -------------------------------------------------------------------------
    def test_bpl_boundary_domestic(self):
        # States & territories (1-100) are native-born
        self.assertFalse(ipums.is_foreign_born_robust({"BPL": 1}, {}))
        self.assertFalse(ipums.is_foreign_born_robust({"BPL": 25}, {}))
        self.assertFalse(ipums.is_foreign_born_robust({"BPL": 100}, {}))

    def test_bpl_boundary_foreign(self):
        # 101+ are foreign-born locations
        self.assertTrue(ipums.is_foreign_born_robust({"BPL": 101}, {}))
        self.assertTrue(ipums.is_foreign_born_robust({"BPL": 200}, {}))
        self.assertTrue(ipums.is_foreign_born_robust({"BPL": 500}, {}))

    def test_nativity_overrides_bpl(self):
        # NATIVITY variable takes precedence over BPL code
        self.assertTrue(ipums.is_foreign_born_robust({"NATIVITY": 2, "BPL": 25}, self.nativity_map))
        self.assertFalse(ipums.is_foreign_born_robust({"NATIVITY": 1, "BPL": 500}, self.nativity_map))

    def test_bpl_missing_or_invalid(self):
        self.assertFalse(ipums.is_foreign_born_robust({"BPL": None}, {}))
        self.assertFalse(ipums.is_foreign_born_robust({"BPL": 0}, {}))
        self.assertFalse(ipums.is_foreign_born_robust({}, {}))

    # -------------------------------------------------------------------------
    # 2. Ancestry Code Normalization (normalize_ancestry_code)
    # -------------------------------------------------------------------------
    def test_normalize_ancestry_standard_codes(self):
        self.assertEqual(ipums.normalize_ancestry_code(706), "706")
        self.assertEqual(ipums.normalize_ancestry_code(706.0), "706")
        self.assertEqual(ipums.normalize_ancestry_code("706"), "706")
        self.assertEqual(ipums.normalize_ancestry_code(" 706 "), "706")

    def test_normalize_ancestry_4_digit_string_conversion(self):
        # normalize_ancestry_code cleans types to standard strings; 4-to-3 truncation is handled in get_subgroup_from_ancestry
        self.assertEqual(ipums.normalize_ancestry_code(7060), "7060")
        self.assertEqual(ipums.normalize_ancestry_code("7060"), "7060")
        self.assertEqual(ipums.normalize_ancestry_code(7500.0), "7500")

    def test_normalize_ancestry_missing_and_zero(self):
        # 0 / '0' / '000' and 999 are Census missing markers; must normalize to None
        self.assertIsNone(ipums.normalize_ancestry_code(0))
        self.assertIsNone(ipums.normalize_ancestry_code("0"))
        self.assertIsNone(ipums.normalize_ancestry_code("000"))
        self.assertIsNone(ipums.normalize_ancestry_code(999))
        self.assertIsNone(ipums.normalize_ancestry_code("999"))
        self.assertIsNone(ipums.normalize_ancestry_code(""))
        self.assertIsNone(ipums.normalize_ancestry_code(None))
        self.assertIsNone(ipums.normalize_ancestry_code(float("nan")))

    # -------------------------------------------------------------------------
    # 3. Subgroup Resolution via Ancestry (get_subgroup_from_ancestry)
    # -------------------------------------------------------------------------
    def test_subgroup_ancestry_primary_match(self):
        row = {"ANCESTR1": 706, "ANCESTR2": None}
        self.assertEqual(ipums.get_subgroup_from_ancestry(row, self.ancestry_map), "Chinese")

    def test_subgroup_ancestry_4_digit_primary_match(self):
        # 4-digit code ending in '0' matches truncated 3-digit key
        row = {"ANCESTR1": 7060, "ANCESTR2": None}
        self.assertEqual(ipums.get_subgroup_from_ancestry(row, self.ancestry_map), "Chinese")

    def test_subgroup_ancestry_secondary_fallback(self):
        # ANCESTR1 missing (999 or 0); falls back to ANCESTR2
        row_999 = {"ANCESTR1": 999, "ANCESTR2": 750}
        self.assertEqual(ipums.get_subgroup_from_ancestry(row_999, self.ancestry_map), "Korean")

        row_zero = {"ANCESTR1": 0, "ANCESTR2": 720}
        self.assertEqual(ipums.get_subgroup_from_ancestry(row_zero, self.ancestry_map), "Asian Indian")

    def test_subgroup_ancestry_unmatched(self):
        row = {"ANCESTR1": 999, "ANCESTR2": 998}
        self.assertIsNone(ipums.get_subgroup_from_ancestry(row, self.ancestry_map))

    # -------------------------------------------------------------------------
    # 4. Race Fallback Resolution (get_subgroup_from_race_fallback)
    # -------------------------------------------------------------------------
    def test_race_fallback_asian_alone(self):
        # RACE code 4 = Asian alone
        self.assertEqual(ipums.get_subgroup_from_race_fallback(4, ""), ipums.OTHER_ASIAN)
        self.assertEqual(ipums.get_subgroup_from_race_fallback("4", "Asian"), ipums.OTHER_ASIAN)

    def test_race_fallback_nhpi_alone_no_asian_leak(self):
        # RACE code 5 = NHPI alone; must NEVER fall into Other Asian
        self.assertEqual(ipums.get_subgroup_from_race_fallback(5, ""), ipums.OTHER_NHPI)
        self.assertEqual(ipums.get_subgroup_from_race_fallback("5", "Other Pacific Islander"), ipums.OTHER_NHPI)

    def test_race_fallback_label_routing(self):
        # Specific labels route to exact NHPI subgroups; general terms route to OTHER_NHPI
        self.assertEqual(ipums.get_subgroup_from_race_fallback(6, "Native Hawaiian"), "Native Hawaiian")
        self.assertEqual(ipums.get_subgroup_from_race_fallback(6, "Samoan"), "Samoan")
        self.assertEqual(ipums.get_subgroup_from_race_fallback(6, "Other Pacific Islander"), ipums.OTHER_NHPI)

    def test_race_fallback_non_aanhpi_returns_none(self):
        # RACE code 1 = White, 2 = Black
        self.assertIsNone(ipums.get_subgroup_from_race_fallback(1, "White"))
        self.assertIsNone(ipums.get_subgroup_from_race_fallback(2, "Black"))
        self.assertIsNone(ipums.get_subgroup_from_race_fallback(None, ""))

    # -------------------------------------------------------------------------
    # 5. Family Classification (family_from_subgroup)
    # -------------------------------------------------------------------------
    def test_family_from_subgroup_lowercase(self):
        self.assertEqual(ipums.family_from_subgroup("Chinese"), "asian")
        self.assertEqual(ipums.family_from_subgroup("Asian Indian"), "asian")
        self.assertEqual(ipums.family_from_subgroup(ipums.OTHER_ASIAN), "asian")

        self.assertEqual(ipums.family_from_subgroup("Native Hawaiian"), "nhpi")
        self.assertEqual(ipums.family_from_subgroup("Samoan"), "nhpi")
        self.assertEqual(ipums.family_from_subgroup("Chamorro"), "nhpi")
        self.assertEqual(ipums.family_from_subgroup(ipums.OTHER_NHPI), "nhpi")


if __name__ == "__main__":
    unittest.main()
