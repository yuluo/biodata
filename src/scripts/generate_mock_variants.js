#!/usr/bin/env node
// Generate a CSV of statistically plausible mock variant annotations.
// Usage: node scripts/generate_mock_variants.js [rows] [outPath]
// Defaults: 20000 rows -> data/variant_mock_<rows>.csv

const fs = require('fs');
const path = require('path');

const N = parseInt(process.argv[2], 10) || 20000;
const sizeTag = N >= 1000 && N % 1000 === 0 ? `${N / 1000}k` : `${N}`;
const OUT = process.argv[3] ||
  path.join(__dirname, '..', '..', 'data', `variant_mock_${sizeTag}.csv`);

const HEADERS = [
  'AR','CHR','POS','ID','REF','ALT','Hg19_B37_POS','GENE','PID','CONSEQ',
  'CONSEQ_others','ZYGO','MANE','ENSG','ENST','cDNA_POS','CDS_POS','ENSP',
  'PROT_POS','AA_CHANGE','gnomADV3_AFMAX','gnomADV3_AF','gnomADV3_hom',
  'gnomADV2_AF_MAX','gnomADV2_AF','gnomADgV2_AF','gnomADeV2_AF',
  'gnomADgV2_hom','gnomADeV2_hom','gnomADg_segdup','gnomADe_segdup',
  'gnomADV3_afr_AF','gnomADV3_amr_AF','gnomADV3_asj_AF','gnomADV3_eas_AF',
  'gnomADV3_fin_AF','gnomADV3_nfe_AF','gnomADV3_oth_AF','gnomADV3_sas_AF',
  'gnomADV3_segdup','MiddleEast_AF','MiddleEast_hom','IMPACT','SIFT',
  'PolyPhen','AGAIN','BPHunter','IVS_pLOF','SpliceAI_MAX','SpliceAI_FULL',
  'CADD_v1.6','MSC95','CADD_MSC','GDI','CoNeS','pLI','MQ','AD','DP','GQ',
  'QUAL','MRR','am_class','am_pathogenicity'
];

// ----- RNG helpers -----
const rand = () => Math.random();
const randInt = (lo, hi) => Math.floor(lo + rand() * (hi - lo + 1));
const choice = (arr) => arr[Math.floor(rand() * arr.length)];
const weightedChoice = (items, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
};
// Box-Muller standard normal
const randNormal = (mean = 0, sd = 1) => {
  const u = 1 - rand(), v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
// Allele frequencies are heavy-skewed toward 0; lognormal with truncation.
// Most variants in gnomAD are rare (~95% with AF < 1%). Returns [0, 0.5].
const randAF = () => {
  if (rand() < 0.15) return 0; // truly absent
  const x = Math.exp(randNormal(-9, 3)); // median ~ 1.2e-4
  return Math.min(0.5, x);
};
const randAFCommon = () => {
  // More common variant track (still skewed)
  if (rand() < 0.05) return 0;
  return Math.min(0.5, Math.exp(randNormal(-7, 2.5)));
};

// ----- Reference data -----
// GRCh38 chromosome lengths (approx, bp)
const CHROMS = [
  ['1', 248956422], ['2', 242193529], ['3', 198295559], ['4', 190214555],
  ['5', 181538259], ['6', 170805979], ['7', 159345973], ['8', 145138636],
  ['9', 138394717], ['10', 133797422], ['11', 135086622], ['12', 133275309],
  ['13', 114364328], ['14', 107043718], ['15', 101991189], ['16', 90338345],
  ['17', 83257441], ['18', 80373285], ['19', 58617616], ['20', 64444167],
  ['21', 46709983], ['22', 50818468], ['X', 156040895], ['Y', 57227415],
  ['MT', 16569]
];
const CHROM_TOTAL = CHROMS.reduce((s, c) => s + c[1], 0);

const pickChrom = () => {
  let r = rand() * CHROM_TOTAL;
  for (const [name, len] of CHROMS) {
    r -= len;
    if (r <= 0) return [name, len];
  }
  return CHROMS[0];
};

const NUCS = ['A', 'C', 'G', 'T'];
const randAlt = (ref) => {
  let a;
  do { a = choice(NUCS); } while (a === ref);
  return a;
};

// A small panel of well-known disease-associated genes
const GENES = [
  ['BRCA1', 'NM_007294.4', 'ENSG00000012048', 'ENST00000357654', 'ENSP00000350283', 1863],
  ['BRCA2', 'NM_000059.4', 'ENSG00000139618', 'ENST00000380152', 'ENSP00000369497', 3418],
  ['TP53',  'NM_000546.6', 'ENSG00000141510', 'ENST00000269305', 'ENSP00000269305', 393],
  ['EGFR',  'NM_005228.5', 'ENSG00000146648', 'ENST00000275493', 'ENSP00000275493', 1210],
  ['KRAS',  'NM_004985.5', 'ENSG00000133703', 'ENST00000256078', 'ENSP00000256078', 189],
  ['APC',   'NM_000038.6', 'ENSG00000134982', 'ENST00000257430', 'ENSP00000257430', 2843],
  ['MLH1',  'NM_000249.4', 'ENSG00000076242', 'ENST00000231790', 'ENSP00000231790', 756],
  ['MSH2',  'NM_000251.3', 'ENSG00000095002', 'ENST00000233146', 'ENSP00000233146', 934],
  ['CFTR',  'NM_000492.4', 'ENSG00000001626', 'ENST00000003084', 'ENSP00000003084', 1480],
  ['DMD',   'NM_004006.3', 'ENSG00000198947', 'ENST00000357033', 'ENSP00000354923', 3685],
  ['LDLR',  'NM_000527.5', 'ENSG00000130164', 'ENST00000558518', 'ENSP00000454071', 860],
  ['MYH7',  'NM_000257.4', 'ENSG00000092054', 'ENST00000355349', 'ENSP00000347507', 1935],
  ['SCN5A', 'NM_198056.3', 'ENSG00000183873', 'ENST00000333535', 'ENSP00000328968', 2016],
  ['PTEN',  'NM_000314.8', 'ENSG00000171862', 'ENST00000371953', 'ENSP00000361021', 403],
  ['NF1',   'NM_000267.3', 'ENSG00000196712', 'ENST00000358273', 'ENSP00000351015', 2818],
  ['VHL',   'NM_000551.4', 'ENSG00000134086', 'ENST00000256474', 'ENSP00000256474', 213],
  ['RET',   'NM_020975.6', 'ENSG00000165731', 'ENST00000355710', 'ENSP00000347942', 1114],
  ['RB1',   'NM_000321.3', 'ENSG00000139687', 'ENST00000267163', 'ENSP00000267163', 928],
  ['ATM',   'NM_000051.4', 'ENSG00000149311', 'ENST00000675843', 'ENSP00000502572', 3056],
  ['STK11', 'NM_000455.5', 'ENSG00000118046', 'ENST00000326873', 'ENSP00000324856', 433]
];

// VEP consequences with relative weights (missense/synonymous most common)
const CONSEQUENCES = [
  ['missense_variant', 35],
  ['synonymous_variant', 25],
  ['intron_variant', 12],
  ['5_prime_UTR_variant', 4],
  ['3_prime_UTR_variant', 6],
  ['splice_region_variant', 5],
  ['splice_donor_variant', 2],
  ['splice_acceptor_variant', 2],
  ['stop_gained', 3],
  ['stop_lost', 1],
  ['start_lost', 1],
  ['frameshift_variant', 2],
  ['inframe_insertion', 1],
  ['inframe_deletion', 1]
];
const HIGH_IMPACT = new Set([
  'splice_donor_variant','splice_acceptor_variant','stop_gained',
  'stop_lost','start_lost','frameshift_variant'
]);
const MODERATE_IMPACT = new Set([
  'missense_variant','inframe_insertion','inframe_deletion'
]);
const LOW_IMPACT = new Set([
  'synonymous_variant','splice_region_variant','start_retained_variant',
  'stop_retained_variant'
]);

const AA = {
  A:'Ala', R:'Arg', N:'Asn', D:'Asp', C:'Cys', E:'Glu', Q:'Gln', G:'Gly',
  H:'His', I:'Ile', L:'Leu', K:'Lys', M:'Met', F:'Phe', P:'Pro', S:'Ser',
  T:'Thr', W:'Trp', Y:'Tyr', V:'Val'
};
const AA_KEYS = Object.keys(AA);

// ----- Per-row generation -----
const pad = (n, len) => String(n).padStart(len, '0');

function generateRow() {
  const [chr, chrLen] = pickChrom();
  const pos = randInt(1, chrLen);
  const ref = choice(NUCS);
  const alt = randAlt(ref);
  const id = rand() < 0.55 ? `rs${randInt(1e6, 9.99e8)}` : '.';
  // GRCh38 -> GRCh37 lift; usually within ~few kb on autosomes; keep simple
  const hg19Pos = Math.max(1, pos + randInt(-50000, 50000));

  const gene = choice(GENES);
  const [geneSym, mane, ensg, enst, ensp, protLen] = gene;
  const pid = `P${randInt(10000, 99999)}`;

  const conseq = weightedChoice(
    CONSEQUENCES.map(c => c[0]),
    CONSEQUENCES.map(c => c[1])
  );
  const conseqOthers = rand() < 0.25
    ? weightedChoice(CONSEQUENCES.map(c => c[0]), CONSEQUENCES.map(c => c[1]))
    : '';

  const zygo = weightedChoice(['HET', 'HOM', 'HEMI'], [80, 18, 2]);

  // Coordinates within transcript
  const cdsLen = protLen * 3;
  const cdsPos = randInt(1, cdsLen);
  // cDNA includes UTRs; assume CDS starts ~200bp into cDNA
  const cdnaPos = cdsPos + randInt(50, 400);
  const protPos = Math.ceil(cdsPos / 3);

  // AA change only meaningful for coding-changing variants
  let aaChange = '';
  if (conseq === 'missense_variant') {
    const from = choice(AA_KEYS), to = randAlt(from) && choice(AA_KEYS.filter(a => a !== from));
    aaChange = `p.${AA[from]}${protPos}${AA[to]}`;
  } else if (conseq === 'synonymous_variant') {
    const aa = choice(AA_KEYS);
    aaChange = `p.${AA[aa]}${protPos}=`;
  } else if (conseq === 'stop_gained') {
    const from = choice(AA_KEYS);
    aaChange = `p.${AA[from]}${protPos}Ter`;
  } else if (conseq === 'frameshift_variant') {
    const from = choice(AA_KEYS);
    aaChange = `p.${AA[from]}${protPos}fs`;
  } else if (conseq === 'inframe_deletion') {
    const from = choice(AA_KEYS);
    aaChange = `p.${AA[from]}${protPos}del`;
  }

  // gnomAD allele frequencies: most variants are rare; pop AFs vary around overall AF
  const v3AF = randAF();
  const v3AFMax = Math.min(0.5, v3AF * (1 + Math.abs(randNormal(0, 1.5))));
  const v3Hom = v3AF === 0 ? 0 : randInt(0, Math.max(0, Math.floor(v3AF * 76000)));

  const v2AF = randAF();
  const v2AFMax = Math.min(0.5, v2AF * (1 + Math.abs(randNormal(0, 1.5))));
  const v2gAF = v2AF === 0 ? 0 : Math.max(0, v2AF * (1 + randNormal(0, 0.3)));
  const v2eAF = v2AF === 0 ? 0 : Math.max(0, v2AF * (1 + randNormal(0, 0.3)));
  const v2gHom = v2gAF === 0 ? 0 : randInt(0, Math.max(0, Math.floor(v2gAF * 15000)));
  const v2eHom = v2eAF === 0 ? 0 : randInt(0, Math.max(0, Math.floor(v2eAF * 125000)));

  const popPerturb = (af) =>
    af === 0 ? 0 : Math.max(0, Math.min(0.5, af * (1 + randNormal(0, 0.5))));
  const v3Afr = popPerturb(v3AF);
  const v3Amr = popPerturb(v3AF);
  const v3Asj = popPerturb(v3AF);
  const v3Eas = popPerturb(v3AF);
  const v3Fin = popPerturb(v3AF);
  const v3Nfe = popPerturb(v3AF);
  const v3Oth = popPerturb(v3AF);
  const v3Sas = popPerturb(v3AF);

  const segdupG = rand() < 0.06 ? 1 : 0;
  const segdupE = rand() < 0.04 ? 1 : 0;
  const segdupV3 = rand() < 0.06 ? 1 : 0;

  const meAF = randAF();
  const meHom = meAF === 0 ? 0 : randInt(0, Math.max(0, Math.floor(meAF * 3000)));

  // IMPACT derived from consequence
  let impact;
  if (HIGH_IMPACT.has(conseq)) impact = 'HIGH';
  else if (MODERATE_IMPACT.has(conseq)) impact = 'MODERATE';
  else if (LOW_IMPACT.has(conseq)) impact = 'LOW';
  else impact = 'MODIFIER';

  // SIFT 0-1; deleterious near 0
  const siftScore = Math.max(0, Math.min(1, conseq === 'missense_variant'
    ? Math.abs(randNormal(0.3, 0.3))
    : rand()));
  const siftCall = siftScore < 0.05 ? 'deleterious' : 'tolerated';
  const sift = `${siftCall}(${siftScore.toFixed(3)})`;

  // PolyPhen 0-1; damaging near 1
  const ppScore = Math.max(0, Math.min(1, conseq === 'missense_variant'
    ? Math.abs(randNormal(0.5, 0.35))
    : rand()));
  const ppCall = ppScore > 0.908 ? 'probably_damaging'
    : ppScore > 0.446 ? 'possibly_damaging' : 'benign';
  const polyphen = `${ppCall}(${ppScore.toFixed(3)})`;

  // AGAIN: gene-level constraint flag (0/1, ~10%)
  const again = rand() < 0.1 ? 1 : 0;
  // BPHunter: branchpoint annotation (mostly empty / 0)
  const bpHunter = rand() < 0.04 ? randInt(1, 5) : 0;
  // IVS_pLOF: intronic predicted LoF (rare 0/1)
  const ivsPlof = rand() < 0.03 ? 1 : 0;

  // SpliceAI: 4 delta scores (DS_AG, DS_AL, DS_DG, DS_DL); usually all near 0
  const isSplice = conseq.includes('splice');
  const ds = Array.from({ length: 4 }, () =>
    isSplice ? Math.min(1, Math.abs(randNormal(0.4, 0.3)))
             : Math.max(0, Math.min(1, Math.abs(randNormal(0, 0.05)))));
  const spliceMax = Math.max(...ds);
  const spliceFull = ds.map(x => x.toFixed(2)).join('|');

  // CADD v1.6 PHRED 0-50, mostly low; high-impact skews higher
  const caddBase = HIGH_IMPACT.has(conseq) ? 30 : MODERATE_IMPACT.has(conseq) ? 22 : 8;
  const cadd = Math.max(0, Math.min(50, randNormal(caddBase, 7)));
  // MSC95 gene-specific CADD threshold; varies 1-25
  const msc95 = Math.max(0.5, Math.min(25, randNormal(10.6, 4)));
  const caddMsc = (cadd - msc95);

  // GDI: gamma-like distribution; most genes 0-2000, tail to ~50000
  const gdi = Math.max(0.1, Math.exp(randNormal(5.5, 1.5)));
  // CoNeS: gene constraint Z-score, roughly normal -5..5
  const coNes = randNormal(0, 1.5);
  // pLI: bimodal at 0 and 1
  const pli = rand() < 0.45 ? Math.min(1, Math.abs(randNormal(0, 0.1)))
            : rand() < 0.7  ? Math.max(0, Math.min(1, randNormal(0.5, 0.2)))
            : Math.max(0, Math.min(1, 1 - Math.abs(randNormal(0, 0.05))));

  // Call quality: MQ usually 60, DP ~30, GQ ~99, QUAL high
  const mq = Math.max(0, Math.min(60, randNormal(58, 4)));
  const dp = Math.max(1, Math.round(randNormal(35, 12)));
  let altDepth;
  if (zygo === 'HOM' || zygo === 'HEMI') altDepth = dp - randInt(0, Math.min(2, dp));
  else altDepth = Math.max(1, Math.min(dp - 1, Math.round(dp * (0.5 + randNormal(0, 0.08)))));
  const refDepth = dp - altDepth;
  const ad = `"${refDepth},${altDepth}"`;
  const gq = Math.max(0, Math.min(99, Math.round(randNormal(90, 12))));
  const qual = Math.max(0, Math.round(Math.exp(randNormal(6, 1))));
  // MRR: minor read ratio (ref/total for het, near 0 for hom)
  const mrr = (zygo === 'HOM' || zygo === 'HEMI')
    ? Math.min(0.1, Math.abs(randNormal(0, 0.02)))
    : Math.min(0.5, Math.abs(0.5 - Math.abs(randNormal(0, 0.08))));

  // AlphaMissense: only meaningful for missense; otherwise blank
  let amClass = '', amPath = '';
  if (conseq === 'missense_variant') {
    amPath = Math.max(0, Math.min(1, randNormal(0.4, 0.3)));
    amClass = amPath >= 0.564 ? 'likely_pathogenic'
            : amPath >= 0.34  ? 'ambiguous'
            : 'likely_benign';
    amPath = amPath.toFixed(4);
  }

  // AR (autosomal recessive candidate flag): mark a small subset
  const ar = rand() < 0.08 ? 1 : 0;

  return [
    ar, chr, pos, id, ref, alt, hg19Pos, geneSym, pid, conseq,
    conseqOthers, zygo, mane, ensg, enst, cdnaPos, cdsPos, ensp,
    protPos, aaChange,
    v3AFMax.toExponential(3), v3AF.toExponential(3), v3Hom,
    v2AFMax.toExponential(3), v2AF.toExponential(3),
    v2gAF.toExponential(3), v2eAF.toExponential(3), v2gHom, v2eHom,
    segdupG, segdupE,
    v3Afr.toExponential(3), v3Amr.toExponential(3), v3Asj.toExponential(3),
    v3Eas.toExponential(3), v3Fin.toExponential(3), v3Nfe.toExponential(3),
    v3Oth.toExponential(3), v3Sas.toExponential(3), segdupV3,
    meAF.toExponential(3), meHom,
    impact, sift, polyphen, again, bpHunter, ivsPlof,
    spliceMax.toFixed(2), spliceFull,
    cadd.toFixed(2), msc95.toFixed(2), caddMsc.toFixed(2),
    gdi.toFixed(2), coNes.toFixed(3), pli.toFixed(3),
    mq.toFixed(1), ad, dp, gq, qual,
    mrr.toFixed(3), amClass, amPath
  ].join(',');
}

// ----- Stream output (single-file API) -----
function writeFile(outPath, rows, { quiet = false } = {}) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const stream = fs.createWriteStream(outPath);
    stream.write(HEADERS.join(',') + '\n');
    const BATCH = 1000;
    let written = 0;

    function pump() {
      while (written < rows) {
        let chunk = '';
        const end = Math.min(written + BATCH, rows);
        for (let i = written; i < end; i++) chunk += generateRow() + '\n';
        written = end;
        if (!stream.write(chunk)) {
          stream.once('drain', pump);
          return;
        }
      }
      stream.end(() => {
        if (!quiet) console.log(`Wrote ${rows} rows to ${outPath}`);
        resolve(outPath);
      });
    }
    pump();
  });
}

module.exports = { HEADERS, generateRow, writeFile };

if (require.main === module) {
  writeFile(OUT, N);
}
