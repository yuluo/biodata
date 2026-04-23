#!/usr/bin/env node
// Generate many mock-variant CSVs in parallel using worker_threads.
// Usage: node scripts/generate_batch.js [count] [rowsPerFile] [outDir] [concurrency]
// Defaults: 10000 files, 20000 rows/file, data/batch_<TS>/, CPU count workers.

const {
  Worker, isMainThread, parentPort, workerData
} = require('worker_threads');
const fs = require('fs');
const path = require('path');
const os = require('os');

function tsStamp() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
         `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function sizeTag(rows) {
  return rows >= 1000 && rows % 1000 === 0 ? `${rows / 1000}k` : `${rows}`;
}

if (isMainThread) {
  const COUNT = parseInt(process.argv[2], 10) || 10000;
  const ROWS = parseInt(process.argv[3], 10) || 20000;
  const RUN_TS = tsStamp();
  const OUT_DIR = process.argv[4] ||
    path.join(__dirname, '..', '..', 'data', `batch_${RUN_TS}`);
  const CONCURRENCY = Math.max(1,
    parseInt(process.argv[5], 10) || os.cpus().length);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const padW = String(COUNT - 1).length;
  // Empirical: ~437 bytes per row at 64 columns.
  const estGB = (COUNT * ROWS * 437 / 1e9).toFixed(2);

  console.log(`Generating ${COUNT} files x ${ROWS} rows`);
  console.log(`Output dir : ${OUT_DIR}`);
  console.log(`Concurrency: ${CONCURRENCY} workers`);
  console.log(`Estimated total size: ~${estGB} GB`);
  console.log('');

  const start = Date.now();
  let nextIdx = 0;
  let done = 0;
  let workersAlive = 0;

  function dispatchTo(worker) {
    if (nextIdx >= COUNT) {
      worker.postMessage({ type: 'exit' });
      return;
    }
    const idx = nextIdx++;
    const name = `variant_mock_${sizeTag(ROWS)}_${RUN_TS}_${String(idx).padStart(padW, '0')}.csv`;
    worker.postMessage({ type: 'job', path: path.join(OUT_DIR, name) });
  }

  function spawn() {
    const w = new Worker(__filename, { workerData: { rows: ROWS } });
    workersAlive++;
    w.on('message', (msg) => {
      if (msg.type === 'done') {
        done++;
        if (done % 50 === 0 || done === COUNT) {
          const elapsed = (Date.now() - start) / 1000;
          const rate = done / elapsed;
          const eta = rate > 0 ? (COUNT - done) / rate : 0;
          process.stdout.write(
            `  ${done}/${COUNT}  ${rate.toFixed(1)} files/s  ETA ${eta.toFixed(0)}s\n`
          );
        }
        dispatchTo(w);
      }
    });
    w.on('exit', () => {
      workersAlive--;
      if (workersAlive === 0) {
        const total = (Date.now() - start) / 1000;
        console.log(`\nDone. ${COUNT} files in ${total.toFixed(1)}s -> ${OUT_DIR}`);
      }
    });
    dispatchTo(w);
  }

  for (let i = 0; i < CONCURRENCY; i++) spawn();
} else {
  // Worker
  const { generateRow, HEADERS } = require('./generate_mock_variants.js');
  const rows = workerData.rows;

  parentPort.on('message', (msg) => {
    if (msg.type === 'exit') {
      process.exit(0);
    }
    if (msg.type === 'job') {
      const stream = fs.createWriteStream(msg.path);
      stream.write(HEADERS.join(',') + '\n');

      const BATCH = 2000;
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
        stream.end(() => parentPort.postMessage({ type: 'done', path: msg.path }));
      }
      pump();
    }
  });
}
