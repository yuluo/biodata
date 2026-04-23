---
name: search
description: Translate natural-language questions about the variant dataset into DuckDB SQL and run them against the `variants` view. Use when the user asks about variants, genes, CADD scores, allele frequencies, consequences, splice/missense filters, zygosity, AlphaMissense, SIFT/PolyPhen, population AFs, or any ad-hoc filter over the mock variant dataset. Also triggered by `/search <question>`.
---

# search — natural-language query of the `variants` dataset

You (Claude) are the translator. This skill turns a plain-English question
into a DuckDB SELECT, runs it via the project's `npm run query` helper,
and shows the result.

## Step 0 — Load the reference files

**Before translating any question, read both companion files in this
skill's directory:**

- `schema.md` — authoritative column list, types, enums, quoting rules,
  and VARCHAR-casting gotchas.
- `examples.md` — canonical NL → SQL shapes. Match the user's question to
  the closest example's structure.

These files are the source of truth. Don't guess column names or values
from memory.

CSV dumps go to the project-root `query-result/` directory. The directory
is created on demand. Old files are not auto-cleaned.

## Step 1 — Translate

Build a single SELECT against the view **`variants`**.

**Hard rules:**

1. **Always `SELECT *`** — never a projected column subset — **unless**
   the user explicitly names the columns they want (example 10 in
   `examples.md`).
2. **Default `LIMIT 100`**. Drop the `LIMIT` only when the user uses
   words like *"all"*, *"no limit"*, *"everything"*, *"export"*,
   *"every"*, *"complete list"*.
3. **Quote identifiers with dots**: `"CADD_v1.6"` must be double-quoted.
   Everything else in this schema can stay unquoted.
4. **String literals** use single quotes and are case-sensitive:
   `GENE = 'BRCA1'`, not `'brca1'`. Use `ILIKE` for fuzzy string matches
   the user specifically asks for.
5. **VARCHAR-with-embedded-number columns** (`SIFT`, `PolyPhen`, `AD`):
   extract the number with `regexp_extract` / `split_part` before numeric
   comparison. See `schema.md` → "Casting gotchas".
6. **Partition pushdown**: when the user mentions a chromosome, filter
   on `CHR = '<n>'` (VARCHAR, not int) to prune partitions.
7. **State any assumptions in one line** before the SQL when the question
   is vague (e.g. "rare" → `gnomADV3_AF < 1e-4`, picking v3 over v2).

## Step 2 — Execute

Run **three** commands using the same `npm run query` helper from
`src/scripts/query.js`. Use `npm --prefix src run query -- …` so the
shell stays in the project root and CSV redirects (step c) write to
`query-result/` correctly.

**(a) Count first.** This is cheap thanks to Parquet predicate pushdown
and gives the user a total before they see the sample.

```bash
npm --prefix src run query -- "SELECT COUNT(*) AS total FROM variants WHERE <predicate>"
```

**(b) Inline preview.** Always 10 rows, table format, for in-chat
display.

```bash
npm --prefix src run query -- --table "SELECT * FROM variants WHERE <predicate> LIMIT 10"
```

**(c) Full CSV dump.** Write the user-requested result set to
`query-result/<slug>.csv` at the project root. Use the user-supplied
`LIMIT` (default 100; drop `LIMIT` entirely on "all" / "no limit" /
"export" / "everything" / "every" / "complete list").

```bash
mkdir -p query-result
npm --prefix src run query -- --csv "SELECT * FROM variants WHERE <predicate> LIMIT 100" \
  > query-result/<slug>.csv
```

`<slug>` is a short kebab-case summary of the query (e.g.
`tp53-pten-pathogenic-missense-rare`) with a UTC timestamp suffix
`-YYYYMMDDTHHMMSS` so repeated runs don't clobber.

If the user supplied no predicate (e.g. *"show me some variants"*), skip
both the count and the CSV dump — just run the 10-row preview.

## Step 3 — Respond

Format the reply as:

1. **One-line assumption note** (only if you made an interpretation call
   — otherwise skip).
2. **Translated SQL**, in a ```sql fenced block.
3. **Total matches**: `**Total matches: 12,453**` on its own line.
4. **10-row preview table** from step 2b.
5. **Saved-to line**: `Full result (N rows) saved to query-result/<slug>.csv.`
   — where N is the row count actually written (the `LIMIT`, or `total`
   for no-limit queries).
6. If the CSV was capped (`total > LIMIT`), add: *"Increase the limit or
   say 'no limit' to capture more."*

## Step 4 — Follow-ups

If the user's question references a column or concept that isn't in
`schema.md`, ask **one** clarifying question rather than guessing. Good
clarifiers:

- *"By 'rare' do you mean gnomAD v3 AF < 1e-4, or a different threshold?"*
- *"Which gene panel? (our dataset only contains: BRCA1, BRCA2, TP53, …)"*

Don't invent columns. Don't fabricate values that aren't in the enums in
`schema.md`.
