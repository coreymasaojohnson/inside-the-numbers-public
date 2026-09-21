#!/usr/bin/env python3
"""
Convert IPUMS ACS PUMS CSV + DDI to AANHPI foreign-born treemap.

Key features:
- Filters for foreign-born only (BPL > 100)
- Uses comprehensive ancestry JSON mapping
- Correctly handles AANHPI RACE codes (4, 5, 6)
- Minimizes "Other Asian" residual through robust code matching
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Tuple, Optional, List, Any

import pandas as pd
from lxml import etree

# =========================
# Constants
# =========================
BPL_FOREIGN_BORN_CUTOFF = 100  # IPUMS standard: 1-100 US/territories, 101+ foreign
WEIGHT_COL = "PERWT"
OTHER_ASIAN = "Other Asian"
OTHER_NHPI = "Other NHPI"

# IPUMS RACE codes for AANHPI (modern ACS coding)
# 4 = Asian alone
# 5 = Native Hawaiian and Other Pacific Islander alone
# 6 = Some other race alone (rarely AANHPI, but check ancestry)
AANHPI_RACE_CODES = {4, 5, 6}

# NHPI subgroups (for family classification)
NHPI_SUBGROUPS = {
    "Native Hawaiian", "Part Hawaiian", "Samoan", "American Samoan", 
    "Tongan", "Tokelauan", "Polynesian", "Micronesian", 
    "Guamanian/Chamorro", "Guamanian", "Chamorro", "Chamorro Islander",
    "Marshallese", "Palauan", "Melanesian", "Fijian", 
    "Other Pacific Islander", OTHER_NHPI
}

# =========================
# DDI Parsing
# =========================
def load_value_labels_from_ddi(ddi_path: Path) -> Dict[str, Dict[int, str]]:
    """Parse DDI XML to extract value labels for all variables."""
    maps: Dict[str, Dict[int, str]] = {}
    tree = etree.parse(str(ddi_path))
    root = tree.getroot()
    
    # Handle DDI namespace
    ns_uri = root.nsmap.get(None) or root.nsmap.get("ddi") or "ddi:codebook:2_5"
    
    def q(name: str) -> str:
        return f"{{{ns_uri}}}{name}"
    
    for var in root.findall(f".//{q('dataDscr')}/{q('var')}"):
        vname = (var.get("name") or "").strip().upper()
        if not vname:
            continue
        
        cmap: Dict[int, str] = {}
        for cat in var.findall(f"./{q('catgry')}"):
            val_node = cat.find(f"./{q('catValu')}")
            lab_node = cat.find(f"./{q('labl')}")
            if val_node is None or lab_node is None:
                continue
            
            try:
                code = int((val_node.text or "").strip())
                label = (lab_node.text or "").strip()
                if label:
                    cmap[code] = label
            except Exception:
                continue
        
        if cmap:
            maps[vname] = cmap
    
    return maps

# =========================
# Ancestry Mapping
# =========================
def normalize_ancestry_code(code_value: Any) -> Optional[str]:
    """Convert ancestry value to standardized string code."""
    if pd.isna(code_value) or code_value is None:
        return None
    try:
        code_int = int(code_value)
        if code_int == 999:  # Not applicable/missing
            return None
        return str(code_int)
    except Exception:
        return None

def get_subgroup_from_ancestry(row: pd.Series, ancestry_map: Dict[str, str]) -> Optional[str]:
    """
    Map ancestry codes to subgroup names using the comprehensive JSON mapping.
    Tries ANCESTR1 first, then ANCESTR2.
    """
    for col in ["ANCESTR1", "ANCESTR2"]:
        if col not in row:
            continue
        
        code_str = normalize_ancestry_code(row.get(col))
        if not code_str:
            continue
        
        # Direct lookup
        if code_str in ancestry_map:
            subgroup = ancestry_map[code_str]
            if subgroup != "Not Applicable/Missing/Unknown":
                return subgroup
        
        # Try 3-digit to 4-digit conversion (e.g., "706" -> "7060")
        if len(code_str) == 3:
            padded = code_str + "0"
            if padded in ancestry_map:
                subgroup = ancestry_map[padded]
                if subgroup != "Not Applicable/Missing/Unknown":
                    return subgroup
        
        # Try 4-digit to 3-digit conversion (e.g., "7060" -> "706")
        if len(code_str) == 4 and code_str.endswith("0"):
            truncated = code_str[:3]
            if truncated in ancestry_map:
                subgroup = ancestry_map[truncated]
                if subgroup != "Not Applicable/Missing/Unknown":
                    return subgroup
    
    return None

def get_subgroup_from_race_fallback(race_code: Any, race_label: str) -> Optional[str]:
    """
    Fallback classification based on RACE code/label when ancestry is unavailable.
    Returns residual category only for confirmed AANHPI records.
    """
    try:
        race_int = int(race_code) if pd.notna(race_code) else None
    except Exception:
        race_int = None
    
    # Only return residual for confirmed AANHPI RACE codes
    if race_int not in AANHPI_RACE_CODES:
        return None
    
    # Check label for NHPI indicators
    label_lower = (race_label or "").lower()
    if any(term in label_lower for term in ["hawaiian", "pacific", "samoan", "guamanian", "chamorro"]):
        return OTHER_NHPI
    
    # Default AANHPI residual
    return OTHER_ASIAN

def family_from_subgroup(subgroup: str) -> str:
    """Determine if subgroup belongs to Asian or NHPI family."""
    return "nhpi" if subgroup in NHPI_SUBGROUPS else "asian"

# =========================
# Data Processing
# =========================
def is_foreign_born_robust(row: pd.Series, nativity_map: Dict[int, str]) -> bool:
    """
    Determine foreign-born status using NATIVITY (preferred) or BPL (fallback).
    IPUMS standard: BPL 1-100 = US/territories, 101+ = foreign country
    """
    # Method 1: NATIVITY variable (most reliable when present)
    if "NATIVITY" in row and pd.notna(row.get("NATIVITY")):
        try:
            natv_code = int(row["NATIVITY"])
            if nativity_map and natv_code in nativity_map:
                label = nativity_map[natv_code].lower()
                if "foreign" in label:
                    return True
                if "native" in label:
                    return False
            # IPUMS convention: 1=native, 2=foreign-born
            return natv_code == 2
        except Exception:
            pass
    
    # Method 2: BPL numeric code (standard fallback)
    try:
        bpl_code = int(row.get("BPL", 0))
        return bpl_code > BPL_FOREIGN_BORN_CUTOFF
    except Exception:
        return False

def map_label(series: pd.Series, lut: Dict[int, str]) -> pd.Series:
    """Map integer codes to labels using lookup table."""
    def _map(x):
        if pd.isna(x):
            return ""
        try:
            return lut.get(int(x), "")
        except Exception:
            return ""
    return series.map(_map)

# =========================
# Main Processing Function
# =========================
def main(csv_path: Path, ddi_path: Path, out_dir: Path, 
         ancestry_json_path: Path, debug: bool = False):
    
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # 1) Load ancestry mapping JSON
    print(f"• Loading ancestry mapping from: {ancestry_json_path}")
    if not ancestry_json_path.exists():
        raise FileNotFoundError(f"Ancestry JSON not found: {ancestry_json_path}")
    
    with ancestry_json_path.open("r", encoding="utf-8") as f:
        ancestry_map = json.load(f)
    print(f"  ✓ Loaded {len(ancestry_map)} ancestry codes")
    
    # 2) Parse DDI for value labels
    print(f"• Parsing DDI: {ddi_path}")
    label_maps = load_value_labels_from_ddi(ddi_path)
    race_map = label_maps.get("RACE", {})
    nativity_map = label_maps.get("NATIVITY", {})
    print(f"  ✓ Loaded value labels for {len(label_maps)} variables")
    
    # 3) Read CSV with required columns
    print(f"• Reading CSV: {csv_path}")
    needed = ["YEAR", WEIGHT_COL, "RACE", "BPL", "NATIVITY", "ANCESTR1", "ANCESTR2", "SERIAL"]
    
    # Scan header
    header = list(pd.read_csv(csv_path, nrows=0).columns)
    header_map = {c.strip().upper(): c for c in header}
    usecols = [header_map[col] for col in needed if col in header_map]
    
    missing = [col for col in needed if col not in header_map]
    if missing:
        print(f"  ⚠ Missing columns (will proceed): {', '.join(missing)}")
    
    # Read data
    df = pd.read_csv(csv_path, usecols=usecols, low_memory=False)
    df.columns = [c.strip().upper() for c in df.columns]
    print(f"  ✓ Loaded {len(df):,} rows")
    
    # Validate weight column
    if WEIGHT_COL not in df.columns:
        raise ValueError(f"Missing required column: {WEIGHT_COL}")
    
    # 4) Normalize data types
    df[WEIGHT_COL] = pd.to_numeric(df[WEIGHT_COL], errors="coerce").fillna(0.0)
    for col in ["YEAR", "RACE", "BPL", "NATIVITY", "ANCESTR1", "ANCESTR2", "SERIAL"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
    
    # Add race label
    df["RACE_L"] = map_label(df["RACE"], race_map) if "RACE" in df.columns else ""
    
    # 5) Filter to AANHPI by RACE code
    print(f"• Filtering to AANHPI (RACE in {AANHPI_RACE_CODES})")
    df = df[df["RACE"].isin(list(AANHPI_RACE_CODES))].copy()
    print(f"  ✓ {len(df):,} AANHPI rows ({df[WEIGHT_COL].sum():,.0f} weighted)")
    
    if df.empty:
        print("  ⚠ No AANHPI records found")
        (out_dir / "aanhpi_treemap_2021.json").write_text("[]")
        return
    
    # 6) Filter to FOREIGN-BORN ONLY
    print(f"• Filtering to foreign-born (BPL > {BPL_FOREIGN_BORN_CUTOFF})")
    df["FOREIGN_BORN"] = df.apply(lambda r: is_foreign_born_robust(r, nativity_map), axis=1)
    df = df[df["FOREIGN_BORN"] == True].copy()
    print(f"  ✓ {len(df):,} foreign-born rows ({df[WEIGHT_COL].sum():,.0f} weighted)")
    
    if df.empty:
        print("  ⚠ No foreign-born AANHPI records found")
        (out_dir / "aanhpi_treemap_2021.json").write_text("[]")
        return
    
    # 7) Map to subgroups using ancestry codes
    print("• Mapping subgroups from ancestry codes...")
    
    def get_subgroup(row):
        # Try ancestry mapping first (most specific)
        subgroup = get_subgroup_from_ancestry(row, ancestry_map)
        if subgroup:
            return subgroup
        # Fallback to race-based residual
        return get_subgroup_from_race_fallback(row.get("RACE"), row.get("RACE_L", ""))
    
    df["SUBGROUP"] = df.apply(get_subgroup, axis=1)
    df = df[df["SUBGROUP"].notna()].copy()
    
    if df.empty:
        print("  ⚠ No records mapped to AANHPI subgroups")
        (out_dir / "aanhpi_treemap_2021.json").write_text("[]")
        return
    
    print(f"  ✓ Mapped {len(df):,} rows to subgroups")
    
    # 8) Add family classification
    df["FAMILY"] = df["SUBGROUP"].apply(family_from_subgroup)
    
    # 9) Calculate weighted totals
    print("• Calculating weighted totals...")
    by_subgroup = df.groupby("SUBGROUP", dropna=False)[WEIGHT_COL].sum()
    
    total_asian = df[df["FAMILY"] == "asian"][WEIGHT_COL].sum()
    total_nhpi = df[df["FAMILY"] == "nhpi"][WEIGHT_COL].sum()
    
    # Calculate explicit (non-residual) sums
    explicit_asian = sum(
        val for name, val in by_subgroup.items() 
        if family_from_subgroup(name) == "asian" and name != OTHER_ASIAN
    )
    explicit_nhpi = sum(
        val for name, val in by_subgroup.items() 
        if family_from_subgroup(name) == "nhpi" and name != OTHER_NHPI
    )
    
    # Calculate residuals
    other_asian_val = max(0.0, float(total_asian - explicit_asian))
    other_nhpi_val = max(0.0, float(total_nhpi - explicit_nhpi))
    
    # 10) Build treemap data
    treemap_rows = []
    
    # Add explicit subgroups
    for name, val in by_subgroup.items():
        if name not in (OTHER_ASIAN, OTHER_NHPI):
            treemap_rows.append({"name": str(name), "value": float(val)})
    
    # Add residuals
    if other_asian_val > 0:
        treemap_rows.append({"name": OTHER_ASIAN, "value": other_asian_val})
    if other_nhpi_val > 0:
        treemap_rows.append({"name": OTHER_NHPI, "value": other_nhpi_val})
    
    treemap_rows.sort(key=lambda d: d["value"], reverse=True)
    
    # 11) Write output
    year = int(df["YEAR"].mode().iloc[0]) if "YEAR" in df.columns else 2021
    output_path = out_dir / f"aanhpi_treemap_{year}.json"
    
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(treemap_rows, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Wrote treemap: {output_path}")
    
    # 12) Summary statistics
    total_weighted = df[WEIGHT_COL].sum()
    print(f"\n{'='*60}")
    print(f"SUMMARY - Foreign-Born AANHPI Population")
    print(f"{'='*60}")
    print(f"Total weighted population: {total_weighted:,.0f}")
    print(f"Asian family total:        {total_asian:,.0f} ({total_asian/total_weighted*100:.1f}%)")
    print(f"NHPI family total:         {total_nhpi:,.0f} ({total_nhpi/total_weighted*100:.1f}%)")
    print(f"\nResidual categories:")
    print(f"  Other Asian: {other_asian_val:,.0f} ({other_asian_val/total_asian*100:.1f}% of Asian)")
    print(f"  Other NHPI:  {other_nhpi_val:,.0f} ({other_nhpi_val/total_nhpi*100:.1f}% of NHPI)")
    
    print(f"\nTop 15 subgroups:")
    print(f"{'-'*60}")
    for i, row in enumerate(sorted(treemap_rows, key=lambda x: x['value'], reverse=True)[:15], 1):
        pct = row['value'] / total_weighted * 100
        print(f"{i:2}. {row['name']:<30} {row['value']:>12,.0f}  ({pct:5.2f}%)")
    
    # 13) Debug output
    if debug:
        print(f"\n{'='*60}")
        print("DEBUG OUTPUT")
        print(f"{'='*60}")
        
        # Detailed aggregation
        debug_agg = df.groupby("SUBGROUP", dropna=False).agg(
            Count=(WEIGHT_COL, "count"),
            Weighted_Total=(WEIGHT_COL, "sum"),
            Family=("FAMILY", "first")
        ).reset_index()
        debug_agg = debug_agg.sort_values("Weighted_Total", ascending=False)
        
        debug_json_path = out_dir / "aanhpi_treemap_debug.json"
        with debug_json_path.open("w", encoding="utf-8") as f:
            json.dump(debug_agg.to_dict(orient="records"), f, ensure_ascii=False, indent=2)
        print(f"✓ Wrote debug JSON: {debug_json_path}")
        
        # Sample CSV
        debug_cols = [WEIGHT_COL, "YEAR", "SERIAL", "RACE", "RACE_L", "BPL", 
                     "ANCESTR1", "ANCESTR2", "SUBGROUP", "FAMILY"]
        debug_cols = [c for c in debug_cols if c in df.columns]
        
        debug_csv_path = out_dir / "_debug_sample.csv"
        df[debug_cols].head(100).to_csv(debug_csv_path, index=False)
        print(f"✓ Wrote debug sample: {debug_csv_path}")
        
        # Ancestry code coverage analysis
        anc1_mapped = df[df["ANCESTR1"].notna()]["ANCESTR1"].apply(
            lambda x: normalize_ancestry_code(x) in ancestry_map
        ).sum()
        anc1_total = df["ANCESTR1"].notna().sum()
        
        print(f"\nAncestry code coverage:")
        print(f"  ANCESTR1 mapped: {anc1_mapped:,} / {anc1_total:,} ({anc1_mapped/anc1_total*100:.1f}%)")
        
        if "ANCESTR2" in df.columns:
            anc2_mapped = df[df["ANCESTR2"].notna()]["ANCESTR2"].apply(
                lambda x: normalize_ancestry_code(x) in ancestry_map
            ).sum()
            anc2_total = df["ANCESTR2"].notna().sum()
            print(f"  ANCESTR2 mapped: {anc2_mapped:,} / {anc2_total:,} ({anc2_mapped/anc2_total*100:.1f}%)")

# =========================
# CLI
# =========================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert IPUMS PUMS to AANHPI foreign-born treemap JSON"
    )
    parser.add_argument("--csv", required=True, type=Path,
                       help="Path to IPUMS CSV file")
    parser.add_argument("--ddi", required=True, type=Path,
                       help="Path to IPUMS DDI XML file")
    parser.add_argument("--out-dir", required=True, type=Path,
                       help="Output directory for JSON files")
    parser.add_argument("--ancestry-json", type=Path,
                       default=Path("static/data/pums/ipums_ancestry_codes_asian_nhpi.json"),
                       help="Path to ancestry code mapping JSON")
    parser.add_argument("--debug", action="store_true",
                       help="Generate debug outputs")
    
    args = parser.parse_args()
    
    try:
        main(args.csv, args.ddi, args.out_dir, args.ancestry_json, args.debug)
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)