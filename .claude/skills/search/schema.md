# `variants` view — schema reference

The skill queries a DuckDB view named **`variants`** backed by a Parquet
dataset partitioned on `CHR`. Around **200M rows**, **64 columns**.

Connection is established by `scripts/query.js`; the SQL passed to
`npm run query -- "<SQL>"` runs against this view.

---

## Columns (authoritative — from `DESCRIBE variants`)

| # | Column | Type | Meaning |
|---|---|---|---|
| 1 | `AR` | BIGINT | Autosomal-recessive candidate flag (0/1) |
| 2 | `CHR` | VARCHAR | Chromosome — `'1'`…`'22'`, `'X'`, `'Y'`, `'MT'`. **Partition key** — filter on this for big speedups |
| 3 | `POS` | BIGINT | GRCh38 position |
| 4 | `ID` | VARCHAR | dbSNP rsID, or `'.'` |
| 5 | `REF` | VARCHAR | Reference allele (single base: A/C/G/T) |
| 6 | `ALT` | VARCHAR | Alternate allele (single base) |
| 7 | `Hg19_B37_POS` | BIGINT | Lifted GRCh37 position |
| 8 | `GENE` | VARCHAR | HGNC gene symbol — small panel (see enums below) |
| 9 | `PID` | VARCHAR | Synthetic patient ID like `P12345` |
| 10 | `CONSEQ` | VARCHAR | Primary VEP consequence (see enums) |
| 11 | `CONSEQ_others` | VARCHAR | Secondary consequence, often empty |
| 12 | `ZYGO` | VARCHAR | `HET` \| `HOM` \| `HEMI` |
| 13 | `MANE` | VARCHAR | MANE RefSeq transcript, e.g. `NM_007294.4` |
| 14 | `ENSG` | VARCHAR | Ensembl gene ID |
| 15 | `ENST` | VARCHAR | Ensembl transcript ID |
| 16 | `cDNA_POS` | BIGINT | cDNA position |
| 17 | `CDS_POS` | BIGINT | CDS position |
| 18 | `ENSP` | VARCHAR | Ensembl protein ID |
| 19 | `PROT_POS` | BIGINT | Protein (AA) position |
| 20 | `AA_CHANGE` | VARCHAR | HGVS p.-style change, e.g. `p.Arg175His` |
| 21 | `gnomADV3_AFMAX` | DOUBLE | gnomAD v3 max population AF |
| 22 | `gnomADV3_AF` | DOUBLE | gnomAD v3 overall AF |
| 23 | `gnomADV3_hom` | BIGINT | gnomAD v3 homozygote count |
| 24 | `gnomADV2_AF_MAX` | DOUBLE | gnomAD v2 max population AF |
| 25 | `gnomADV2_AF` | DOUBLE | gnomAD v2 overall AF |
| 26 | `gnomADgV2_AF` | DOUBLE | gnomAD v2 genomes AF |
| 27 | `gnomADeV2_AF` | DOUBLE | gnomAD v2 exomes AF |
| 28 | `gnomADgV2_hom` | BIGINT | gnomAD v2 genomes homozygote count |
| 29 | `gnomADeV2_hom` | BIGINT | gnomAD v2 exomes homozygote count |
| 30 | `gnomADg_segdup` | BIGINT | Segmental-duplication flag in genomes (0/1) |
| 31 | `gnomADe_segdup` | BIGINT | Segmental-duplication flag in exomes (0/1) |
| 32 | `gnomADV3_afr_AF` | DOUBLE | gnomAD v3 African AF |
| 33 | `gnomADV3_amr_AF` | DOUBLE | gnomAD v3 Latino/Admixed-American AF |
| 34 | `gnomADV3_asj_AF` | DOUBLE | gnomAD v3 Ashkenazi Jewish AF |
| 35 | `gnomADV3_eas_AF` | DOUBLE | gnomAD v3 East Asian AF |
| 36 | `gnomADV3_fin_AF` | DOUBLE | gnomAD v3 Finnish AF |
| 37 | `gnomADV3_nfe_AF` | DOUBLE | gnomAD v3 Non-Finnish European AF |
| 38 | `gnomADV3_oth_AF` | DOUBLE | gnomAD v3 Other AF |
| 39 | `gnomADV3_sas_AF` | DOUBLE | gnomAD v3 South Asian AF |
| 40 | `gnomADV3_segdup` | BIGINT | gnomAD v3 segmental-duplication flag (0/1) |
| 41 | `MiddleEast_AF` | DOUBLE | Middle East cohort AF |
| 42 | `MiddleEast_hom` | BIGINT | Middle East homozygote count |
| 43 | `IMPACT` | VARCHAR | `HIGH` \| `MODERATE` \| `LOW` \| `MODIFIER` |
| 44 | `SIFT` | VARCHAR | `deleterious(0.03)` / `tolerated(0.61)` — string, see casting below |
| 45 | `PolyPhen` | VARCHAR | `probably_damaging(0.98)` / `possibly_damaging(0.62)` / `benign(0.12)` |
| 46 | `AGAIN` | BIGINT | Gene-level constraint flag (0/1) |
| 47 | `BPHunter` | BIGINT | Branchpoint annotation (small int, often 0) |
| 48 | `IVS_pLOF` | BIGINT | Intronic predicted-LoF flag (0/1) |
| 49 | `SpliceAI_MAX` | DOUBLE | Max SpliceAI Δ score (0–1) |
| 50 | `SpliceAI_FULL` | VARCHAR | Pipe-joined `DS_AG\|DS_AL\|DS_DG\|DS_DL`, e.g. `0.01\|0.07\|0.02\|0.04` |
| 51 | `CADD_v1.6` | DOUBLE | CADD PHRED (0–50). **Quote this column name** — has a dot |
| 52 | `MSC95` | DOUBLE | Gene-specific CADD 95% threshold |
| 53 | `CADD_MSC` | DOUBLE | `CADD_v1.6 - MSC95` (above-threshold when > 0) |
| 54 | `GDI` | DOUBLE | Gene damage index |
| 55 | `CoNeS` | DOUBLE | Gene constraint Z-score (~-5..5) |
| 56 | `pLI` | DOUBLE | Loss-of-function intolerance (0–1, bimodal) |
| 57 | `MQ` | DOUBLE | Mapping quality (0–60) |
| 58 | `AD` | VARCHAR | Allele depths as a string `"ref,alt"` — e.g. `"18,20"` |
| 59 | `DP` | BIGINT | Total read depth |
| 60 | `GQ` | BIGINT | Genotype quality (0–99) |
| 61 | `QUAL` | BIGINT | Variant QUAL |
| 62 | `MRR` | DOUBLE | Minor read ratio |
| 63 | `am_class` | VARCHAR | `likely_pathogenic` \| `ambiguous` \| `likely_benign` \| `''` (non-missense) |
| 64 | `am_pathogenicity` | DOUBLE | AlphaMissense score (0–1), NULL for non-missense |

---

## Enum-like columns — exact values

**`CHR`** (partition key — prefer equality / `IN`):
`'1'`, `'2'`, …, `'22'`, `'X'`, `'Y'`, `'MT'`

**`IMPACT`**:
`'HIGH'`, `'MODERATE'`, `'LOW'`, `'MODIFIER'`

**`ZYGO`**:
`'HET'`, `'HOM'`, `'HEMI'`

**`CONSEQ`** (VEP vocabulary — 14 values):
```
missense_variant, synonymous_variant, intron_variant,
5_prime_UTR_variant, 3_prime_UTR_variant,
splice_region_variant, splice_donor_variant, splice_acceptor_variant,
stop_gained, stop_lost, start_lost,
frameshift_variant, inframe_insertion, inframe_deletion
```

**`GENE`** (panel of 20):
```
BRCA1, BRCA2, TP53, EGFR, KRAS, APC, MLH1, MSH2, CFTR, DMD,
LDLR, MYH7, SCN5A, PTEN, NF1, VHL, RET, RB1, ATM, STK11
```

**`am_class`**: `'likely_pathogenic'`, `'ambiguous'`, `'likely_benign'`,
or empty string `''` when `CONSEQ != 'missense_variant'`.

---

## Quoting rules

DuckDB requires double quotes around identifiers containing a dot or
other special chars. **Always quote these**:

- `"CADD_v1.6"` — dot in the name
- Any other column with a dot would need quoting (none in this schema)

All other column names are safe unquoted, but double-quoting is never
wrong — use it when unsure.

String literals use single quotes: `GENE = 'BRCA1'`.

---

## Numeric ranges (for sanity-checking filters)

| Column | Typical range | Notes |
|---|---|---|
| `"CADD_v1.6"` | 0–50 | PHRED; ≥20 is top 1%, ≥30 is high-impact |
| `gnomADV3_AF`, `gnomADV2_AF`, pop AFs | 0–0.5 | Heavily skewed toward 0; "rare" ≈ < 1e-4, "very rare" ≈ < 1e-5 |
| `SpliceAI_MAX` | 0–1 | ≥0.5 is high-confidence splice-altering |
| `pLI` | 0–1 | Bimodal; ≥0.9 is LoF-intolerant |
| `GDI` | 0–~50000 | Log-scale; low = more constrained |
| `CoNeS` | ~-5..5 | Z-score |
| `MQ` | 0–60 | Mapping quality |
| `DP` | ~5–100 | Typical sequencing depth |
| `GQ` | 0–99 | Genotype quality |
| `QUAL` | 0–10000+ | Variant call quality |
| `am_pathogenicity` | 0–1 | NULL when `CONSEQ != 'missense_variant'` |

---

## Casting gotchas

These columns are VARCHAR but contain structured numeric data. Extract
with a regex when you need a numeric comparison:

- **`SIFT`** — format `method(score)` like `deleterious(0.03)`.
  Extract score: `CAST(regexp_extract(SIFT, '\(([0-9.]+)\)', 1) AS DOUBLE)`
- **`PolyPhen`** — same shape. Use the same `regexp_extract` pattern.
- **`SpliceAI_FULL`** — pipe-joined 4 scores. Prefer `SpliceAI_MAX`
  (DOUBLE) for filtering.
- **`AD`** — `"ref,alt"` string. For allele-balance filters use
  `MRR` or split:
  `CAST(split_part(AD, ',', 2) AS BIGINT)` for alt-depth.
- **`am_pathogenicity`** is already DOUBLE — no cast needed. Empty
  strings in the source CSV became NULL.

---

## Common idioms

```sql
-- Rare in v3 gnomAD
gnomADV3_AF < 1e-4

-- Very rare
gnomADV3_AF < 1e-5

-- Protein-altering missense
CONSEQ = 'missense_variant'

-- Any splice-affecting
CONSEQ LIKE '%splice%'

-- LoF class
CONSEQ IN ('stop_gained','stop_lost','start_lost','frameshift_variant',
           'splice_donor_variant','splice_acceptor_variant')

-- High-confidence pathogenic missense
CONSEQ = 'missense_variant' AND am_class = 'likely_pathogenic'

-- High-quality genotype
DP >= 20 AND GQ >= 90 AND QUAL >= 100 AND MQ >= 50

-- CADD above MSC threshold
"CADD_v1.6" > MSC95  -- equivalently: CADD_MSC > 0
```
