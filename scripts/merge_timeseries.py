# scripts/merge_timeseries.py
import json
from pathlib import Path

out_dir = Path("static/data/derived")
files = [
    "aanhpi_timeseries_midpoint_2009.json",
    "aanhpi_timeseries_midpoint_2014.json",
    "aanhpi_timeseries_midpoint_2019.json"
]

merged_data = []
for file in files:
    with open(out_dir / file, 'r') as f:
        merged_data.extend(json.load(f))

# Sort by year and name for consistency
merged_data.sort(key=lambda x: (x['year'], x['name']))

with open(out_dir / "aanhpi_timeseries_2009_2019.json", 'w') as f:
    json.dump(merged_data, f, indent=2)

print(f"✓ Merged {len(merged_data)} data points")