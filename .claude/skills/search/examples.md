# NL → SQL examples

Use these as translation anchors. They cover the common shapes: equality,
range, substring, `IN`-list, regex extraction, casting, limit overrides,
and partition-key filters.

Every example targets the `variants` view. When translating, **always use
`SELECT *`** unless the user explicitly names columns.

---

### 1. Gene + impact filter

> *"find high-impact variants in BRCA1"*

```sql
SELECT *
FROM variants
WHERE GENE = 'BRCA1' AND IMPACT = 'HIGH'
LIMIT 100;
```

---

### 2. Rare + high-CADD missense

> *"rare missense variants in BRCA1 with CADD at least 25"*

Interpretation note: "rare" → `gnomADV3_AF < 1e-4` (state this assumption
to the user).

```sql
SELECT *
FROM variants
WHERE GENE = 'BRCA1'
  AND CONSEQ = 'missense_variant'
  AND "CADD_v1.6" >= 25
  AND gnomADV3_AF < 1e-4
LIMIT 100;
```

---

### 3. Substring + IN-list

> *"splice-affecting variants in BRCA1, BRCA2, or TP53"*

```sql
SELECT *
FROM variants
WHERE GENE IN ('BRCA1', 'BRCA2', 'TP53')
  AND CONSEQ LIKE '%splice%'
LIMIT 100;
```

---

### 4. Partition-key filter (fast)

> *"all HIGH impact variants on chromosome 17"*

`CHR` is the partition key — filtering on it prunes most of the dataset.

```sql
SELECT *
FROM variants
WHERE CHR = '17' AND IMPACT = 'HIGH'
LIMIT 100;
```

---

### 5. No-limit override

> *"export every BRCA1 stop_gained variant, no limit"*

Drop `LIMIT` when the user says "all", "no limit", "export",
"everything".

```sql
SELECT *
FROM variants
WHERE GENE = 'BRCA1' AND CONSEQ = 'stop_gained';
```

The skill always writes the full result to `query-result/<slug>.csv`;
"no limit" simply means no `LIMIT` clause is added to the dump query.

---

### 6. Range on AlphaMissense (DOUBLE, NULL-aware)

> *"missense variants with AlphaMissense above 0.9"*

`am_pathogenicity` is DOUBLE and NULL for non-missense rows — no cast
needed, but `>` already excludes NULLs.

```sql
SELECT *
FROM variants
WHERE am_pathogenicity > 0.9
LIMIT 100;
```

---

### 7. Extracting a score from a VARCHAR column

> *"variants where SIFT score is below 0.05"*

`SIFT` is a string like `deleterious(0.03)`. Extract the numeric score.

```sql
SELECT *
FROM variants
WHERE CAST(regexp_extract(SIFT, '\(([0-9.]+)\)', 1) AS DOUBLE) < 0.05
LIMIT 100;
```

---

### 8. High-quality genotype calls

> *"high-quality homozygous LoF calls in CFTR"*

LoF expands to the standard set of consequences (`stop_gained`,
`frameshift_variant`, `splice_donor_variant`, `splice_acceptor_variant`,
`stop_lost`, `start_lost`).

```sql
SELECT *
FROM variants
WHERE GENE = 'CFTR'
  AND ZYGO = 'HOM'
  AND CONSEQ IN ('stop_gained','frameshift_variant',
                 'splice_donor_variant','splice_acceptor_variant',
                 'stop_lost','start_lost')
  AND DP >= 20 AND GQ >= 90 AND QUAL >= 100
LIMIT 100;
```

---

### 9. Population-specific AF

> *"variants common in East Asian but rare overall"*

```sql
SELECT *
FROM variants
WHERE gnomADV3_eas_AF > 0.01
  AND gnomADV3_AF < 1e-3
LIMIT 100;
```

---

### 10. User-specified columns (only time we deviate from `SELECT *`)

> *"just show me GENE, POS, and CADD for BRCA1 high-impact variants"*

User explicitly named columns — honor that projection.

```sql
SELECT GENE, POS, "CADD_v1.6"
FROM variants
WHERE GENE = 'BRCA1' AND IMPACT = 'HIGH'
LIMIT 100;
```
