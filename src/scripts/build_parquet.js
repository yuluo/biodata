#!/usr/bin/env node
// One-time conversion: data/variant_mock_*.csv -> data_parquet/CHR=*/*.parquet
// Usage: npm run build-parquet [-- <csvGlob> <outDir>]

const path = require('path');
const fs = require('fs');
const duckdb = require('duckdb');

const ROOT = path.resolve(__dirname, '..', '..');
const CSV_GLOB = process.argv[2] || path.join(ROOT, 'data', 'variant_mock_*.csv');
const OUT_DIR  = process.argv[3] || path.join(ROOT, 'data_parquet');

if (fs.existsSync(OUT_DIR) && fs.readdirSync(OUT_DIR).length > 0) {
  console.error(`Output directory is not empty: ${OUT_DIR}`);
  console.error('Remove it first or pass a different path as the 2nd argument.');
  process.exit(1);
}

const db = new duckdb.Database(':memory:');
const conn = db.connect();

const threads = require('os').cpus().length;
console.log(`Reading: ${CSV_GLOB}`);
console.log(`Writing: ${OUT_DIR}`);
console.log(`Threads: ${threads}`);

function dirStats(dir) {
  let files = 0, bytes = 0;
  if (!fs.existsSync(dir)) return { files, bytes };
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) stack.push(p);
      else { files++; bytes += st.size; }
    }
  }
  return { files, bytes };
}

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}m${String(s % 60).padStart(2, '0')}s`;
}

const start = Date.now();

function report() {
  const { files, bytes } = dirStats(OUT_DIR);
  const mb = (bytes / 1e6).toFixed(1);
  console.log(`[progress] ${fmtElapsed(Date.now() - start)}  ${files} files  ${mb} MB`);
}

conn.exec(`PRAGMA threads=${threads};`, (err) => {
  if (err) throw err;
  const tick = setInterval(report, 30_000);
  conn.exec(
    `COPY (
       SELECT * FROM read_csv_auto(
         '${CSV_GLOB.replace(/'/g, "''")}',
         union_by_name=true,
         sample_size=-1
       )
     )
     TO '${OUT_DIR.replace(/'/g, "''")}'
     (FORMAT PARQUET, PARTITION_BY (CHR), COMPRESSION ZSTD, OVERWRITE_OR_IGNORE);`,
    (err2) => {
      clearInterval(tick);
      if (err2) {
        console.error('Parquet build failed:', err2.message);
        process.exit(1);
      }
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`Done in ${secs}s -> ${OUT_DIR}`);
      db.close();
    }
  );
});
