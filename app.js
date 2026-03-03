/* =====================================================
   TimeSheet Tracker — app.js
   ===================================================== */

(() => {
  'use strict';

  /* ── State ── */
  let entries = [];     // [{ id, label, time, leveling }]
  let nextId = 1;

  /* ── DOM refs ── */
  const tbody = document.getElementById('entries-body');
  const btnAdd1 = document.getElementById('btn-add-entry');
  const btnAdd2 = document.getElementById('btn-add-entry-2');
  const btnClear = document.getElementById('btn-clear-all');
  const sumTotalTime = document.getElementById('summary-total-time');
  const sumTotalLevel = document.getElementById('summary-total-leveling');
  const sumAvgTime = document.getElementById('summary-avg-time');
  const sumEntries = document.getElementById('summary-entries');
  const footTotalTime = document.getElementById('foot-total-time');
  const footTotalLvl = document.getElementById('foot-total-level');
  const footAvgTime = document.getElementById('foot-avg-time');
  const toastContainer = document.getElementById('toast-container');

  /* ── Init with 3 default rows ── */
  addEntry(); addEntry(); addEntry();

  /* ── Listeners ── */
  btnAdd1.addEventListener('click', () => addEntry());
  btnAdd2.addEventListener('click', () => addEntry());
  btnClear.addEventListener('click', clearAll);

  /* ─────────────────────────────────────────────────────────
     Entry management
  ───────────────────────────────────────────────────────── */

  function addEntry() {
    const entry = { id: nextId++, time: '', leveling: '' };
    entries.push(entry);

    const tr = buildRow(entry);
    tbody.appendChild(tr);

    recalculate();
    updateEntryNumbers();

    // Focus the label field of the new row
    const labelInput = tr.querySelector('.input-label');
    if (labelInput) {
      setTimeout(() => labelInput.focus(), 50);
    }

    showToast('New entry added ✓', 1600);
    return entry;
  }

  function deleteEntry(id) {
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return;

    const row = document.getElementById(`row-${id}`);
    if (row) {
      row.style.opacity = '0';
      row.style.transform = 'translateX(12px)';
      row.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => {
        row.remove();
        entries.splice(idx, 1);
        recalculate();
        updateEntryNumbers();
      }, 200);
    }
  }

  function clearAll() {
    if (entries.length === 0) return;
    if (!confirm('Clear all entries? This cannot be undone.')) return;
    entries = [];
    tbody.innerHTML = '';
    recalculate();
    showToast('All entries cleared', 2000);
    // Add one fresh row
    addEntry();
  }

  /* ─────────────────────────────────────────────────────────
     Build a table row
  ───────────────────────────────────────────────────────── */

  function buildRow(entry) {
    const tr = document.createElement('tr');
    tr.id = `row-${entry.id}`;

    const idCell = document.createElement('td');
    idCell.className = 'row-num';
    idCell.textContent = entries.length;

    const timeCell = document.createElement('td');
    const timeInput = createInput('text', 'input-small', 'HH:MM:SS', entry.time);
    timeInput.setAttribute('inputmode', 'numeric');
    timeInput.setAttribute('maxlength', '8');
    timeInput.addEventListener('input', e => {
      formatTimeInput(e.target);
      entry.time = e.target.value;
      validateTime(e.target);
      recalculate();
      updateRowAvg(tr, entry);
    });
    timeInput.addEventListener('blur', e => validateTime(e.target));
    timeCell.appendChild(timeInput);

    const levelCell = document.createElement('td');
    const levelInput = createInput('number', 'input-small', '0', entry.leveling);
    levelInput.setAttribute('min', '0');
    levelInput.addEventListener('input', e => {
      entry.leveling = e.target.value;
      recalculate();
      updateRowAvg(tr, entry);
    });
    levelCell.appendChild(levelInput);

    const avgCell = document.createElement('td');
    const avgSpan = document.createElement('span');
    avgSpan.className = 'row-avg empty';
    avgSpan.textContent = '—';
    avgSpan.id = `avg-${entry.id}`;
    avgCell.appendChild(avgSpan);

    const actionCell = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger-icon';
    delBtn.setAttribute('title', 'Delete entry');
    delBtn.setAttribute('aria-label', 'Delete entry');
    delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
    </svg>`;
    delBtn.addEventListener('click', () => deleteEntry(entry.id));
    actionCell.appendChild(delBtn);

    tr.append(idCell, timeCell, levelCell, avgCell, actionCell);
    return tr;
  }

  function createInput(type, cls, placeholder, value) {
    const inp = document.createElement('input');
    inp.type = type;
    inp.className = `entry-input ${cls}`;
    inp.placeholder = placeholder;
    if (value) inp.value = value;
    return inp;
  }


  /* ─────────────────────────────────────────────────────────
     Time formatting helper — auto-inserts ":"
  ───────────────────────────────────────────────────────── */

  function formatTimeInput(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    if (val.length > 6) val = val.slice(0, 6);
    if (val.length > 4) {
      val = val.slice(0, 2) + ':' + val.slice(2, 4) + ':' + val.slice(4);
    } else if (val.length > 2) {
      val = val.slice(0, 2) + ':' + val.slice(2);
    }
    input.value = val;
  }

  function validateTime(input) {
    const val = input.value.trim();
    if (!val) { input.classList.remove('input-invalid'); return true; }
    // Accept HH:MM or HH:MM:SS
    const valid = /^\d{1,3}:\d{2}(:\d{2})?$/.test(val);
    if (valid) {
      const parts = val.split(':').map(Number);
      if (parts[1] >= 60 || (parts[2] !== undefined && parts[2] >= 60)) {
        input.classList.add('input-invalid'); return false;
      }
    }
    input.classList.toggle('input-invalid', !valid);
    return valid;
  }

  /* ─────────────────────────────────────────────────────────
     Calculations
  ───────────────────────────────────────────────────────── */

  /** Parse "HH:MM" or "HH:MM:SS" → total seconds, or null */
  function parseTime(str) {
    if (!str || !str.trim()) return null;
    const m = str.trim().match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    const mm = parseInt(m[2], 10);
    const ss = m[3] !== undefined ? parseInt(m[3], 10) : 0;
    if (mm >= 60 || ss >= 60) return null;
    return parseInt(m[1], 10) * 3600 + mm * 60 + ss;
  }

  /** Format total seconds → "Xh YYm ZZs" */
  function formatSeconds(totalSec) {
    if (totalSec === null || totalSec < 0) return '—';
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h === 0 && m === 0) return `${s}s`;
    if (h === 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  /** Format fractional seconds (for averages) */
  function formatAvg(totalSec) {
    if (totalSec === null || isNaN(totalSec)) return '—';
    const rounded = Math.round(totalSec);
    return formatSeconds(rounded);
  }

  function recalculate() {
    let totalSecs = 0;
    let totalLeveling = 0;
    let validTimeCount = 0;

    entries.forEach(entry => {
      const secs = parseTime(entry.time);
      if (secs !== null) { totalSecs += secs; validTimeCount++; }
      const lv = parseFloat(entry.leveling) || 0;
      if (lv > 0) totalLeveling += lv;
    });

    const avgSec = totalLeveling > 0 ? totalSecs / totalLeveling : null;

    const totalTimeStr = formatSeconds(totalSecs);
    const avgStr = avgSec !== null ? formatAvg(avgSec) : '—';

    // Summary cards
    sumTotalTime.textContent = totalTimeStr;
    sumTotalLevel.textContent = totalLeveling;
    sumAvgTime.textContent = avgStr;
    sumEntries.textContent = entries.length;

    // Table footer
    footTotalTime.textContent = totalTimeStr;
    footTotalLvl.textContent = totalLeveling;
    footAvgTime.textContent = avgStr;

    // Animate summary cards on change
    [sumTotalTime, sumTotalLevel, sumAvgTime].forEach(el => pulse(el));
  }

  function updateRowAvg(tr, entry) {
    const avgSpan = document.getElementById(`avg-${entry.id}`);
    if (!avgSpan) return;
    const secs = parseTime(entry.time);
    const lv = parseFloat(entry.leveling) || 0;
    if (secs !== null && lv > 0) {
      avgSpan.textContent = formatAvg(secs / lv);
      avgSpan.className = 'row-avg';
    } else {
      avgSpan.textContent = '—';
      avgSpan.className = 'row-avg empty';
    }
  }

  function updateEntryNumbers() {
    const nums = tbody.querySelectorAll('.row-num');
    nums.forEach((cell, i) => { cell.textContent = i + 1; });
  }

  /* ─────────────────────────────────────────────────────────
     UI helpers
  ───────────────────────────────────────────────────────── */

  function pulse(el) {
    el.classList.remove('pulse');
    void el.offsetWidth; // reflow
    el.classList.add('pulse');
    el.addEventListener('animationend', () => el.classList.remove('pulse'), { once: true });
  }

  function showToast(msg, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  }

  // Pulse animation (injected into <style>)
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes pulse-num {
      0%   { transform: scale(1);    color: inherit; }
      50%  { transform: scale(1.12); color: #63b3ed; }
      100% { transform: scale(1);    color: inherit; }
    }
    .pulse { animation: pulse-num 0.35s ease; }
  `;
  document.head.appendChild(styleTag);

})();
