# Inside the Numbers

An interactive web application for exploring demographic data on Asian American,
Native Hawaiian and Pacific Islander (AANHPI) populations, built to turn static policy
reports into something a reader can interrogate directly.

Live: **https://inside-the-numbers.vercel.app**

Built by Corey Masao Johnson as a consulting engagement for Asian Americans Advancing
Justice | AAJC.

---

## What this repository is

This is a **public carve-out of a private working repository**, prepared so the code can
be read. It contains the application source and the data pipeline. It deliberately
excludes three things that live in the private original:

- **Licensed typefaces.** The design system uses Adobe Jenson Pro. Those font files are
  commercially licensed and are not redistributable, so they are not here. The
  `@font-face` rules and the generator that writes them are — see
  `scripts/gen-font-css.mjs` and `src/lib/styles/fonts.css`. The app falls back to system
  serif without them.
- **Published PDFs**, which are documents rather than code.
- **Working drafts** of the pipeline scripts. One finished version of each is here
  instead of a dozen iterations.

## The interesting part: the data pipeline

The hard problem in this project is not the charts. It is that IPUMS census microdata
does not answer the question you actually want to ask.

Microdata arrives as one row per person with coded variables — race and ancestry recorded
across several code systems that changed between survey years. Producing a defensible
count of, say, foreign-born Marshallese residents over time means reconciling those code
systems across years, deciding which ancestry codes roll up into which categories, and
being explicit about where a category boundary was drawn rather than letting the chart
imply a precision the source does not support.

- `scripts/ipums_to_json.py` — reads IPUMS extracts and emits app-ready JSON
- `scripts/ipums_to_json_v2.py` — the time-series version
- `scripts/merge_timeseries.py` — joins survey years into a single series
- `static/data/pums/ipums_*_codes_*.json` — the code books the reconciliation runs against

## What I would walk through

Start with `scripts/test_ipums_to_json.py` and the five functions it exercises in
`scripts/ipums_to_json_v2.py`. Sixteen tests pin down the decisions the charts depend on:

- **`normalize_ancestry_code`** — what counts as a missing code, across the forms it actually
  arrives in. Pandas reads an integer column containing blanks as float64, so `0.0` has to be
  treated the same as `0`, `"000"` and `999`.
- **`get_subgroup_from_ancestry`** — `ANCESTR1` first, `ANCESTR2` only when the first is
  uninformative, plus the three-to-four-digit conversion that reconciles code systems which
  changed between survey years.
- **`get_subgroup_from_race_fallback`** — what happens when ancestry cannot answer and race
  has to carry it.
- **`is_foreign_born_robust`** — `NATIVITY` where it is present, `BPL` otherwise, with the
  boundary at 100 domestic and 101 foreign.
- **`family_from_subgroup`** — Asian or NHPI.

Writing those tests found a defect I had shipped. On the race-fallback path, a respondent
recorded as Native Hawaiian or Pacific Islander whose race label matched no recognized term
fell through into the Asian residual category — the exact failure a disaggregation project
exists to prevent. `test_race_fallback_nhpi_alone_no_asian_leak` covers it now, and the fix is
the race-code check before the residual assignment in `get_subgroup_from_race_fallback`.

```bash
pip install pytest pandas lxml
python -m pytest -v
```

GitHub Actions runs these alongside the application's type, format, lint and build gates, so a
clean clone either passes all of them or fails visibly.

## The application

SvelteKit and D3, deployed on Vercel.

- `src/lib/components` — visualization components
- `src/lib/styles` — a tokenized type and colour system (`tokens.css`)
- `src/lib/stores` — shared state
- `src/routes` — pages, plus a small API route

## Running it

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build
pnpm preview
```

The three data files the app loads are committed under `static/data/`, so it runs without
an IPUMS extract. Regenerating them needs your own IPUMS USA extract — the raw microdata
is not redistributable either.

## License

Application code is available for reading and review. The data are derived from IPUMS USA
(University of Minnesota, www.ipums.org) and carry IPUMS' own terms.
