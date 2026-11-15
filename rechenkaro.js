// Rechenkaro: karierte Seite als Rechenhilfe.
//
// Jedes Kästchen nimmt genau ein Zeichen auf. Nach jeder Eingabe springt der
// Cursor in die gewählte Schreibrichtung weiter (→ ← ↓ ↑). So kann man
// schriftlich addieren, subtrahieren, multiplizieren und dividieren, auch von
// hinten nach vorne (Richtung ←). Kein Betriebssystem-Keyboard nötig: Die
// Zeichen kommen von einem eigenen Ziffernblock. Eine angeschlossene
// Tastatur funktioniert zusätzlich.
(function () {
  const COLS = 12;
  const START_ROWS = 8;
  const MAX_ROWS = 30;
  const DIRS = {
    right: { dr: 0, dc: 1, arrow: "→" },
    left: { dr: 0, dc: -1, arrow: "←" },
    down: { dr: 1, dc: 0, arrow: "↓" },
    up: { dr: -1, dc: 0, arrow: "↑" },
  };
  const OPPOSITE = { right: "left", left: "right", down: "up", up: "down" };
  const SYMBOLS = ["+", "−", "×", ":", ",", "=", "(", ")"];

  // Bleibt erhalten, wenn die Aufgabenliste neu gezeichnet wird.
  const states = new Map();

  function newRow() {
    return Array.from({ length: COLS }, () => ({ ch: "", line: false }));
  }

  function getState(key) {
    if (!states.has(key)) {
      states.set(key, {
        rows: Array.from({ length: START_ROWS }, newRow),
        r: 0,
        c: 0,
        dir: "right",
      });
    }
    return states.get(key);
  }

  function mount(container, key) {
    const state = getState(key);
    container.innerHTML = "";

    const root = document.createElement("div");
    root.className = "rk";

    const bar = document.createElement("div");
    bar.className = "rk-bar";
    bar.innerHTML = `
      <span class="rk-bar-label">Schreibrichtung:</span>
      <div class="rk-dirs" role="group" aria-label="Schreibrichtung">
        ${Object.entries(DIRS)
          .map(
            ([name, d]) =>
              `<button type="button" class="rk-dir" data-dir="${name}" aria-label="Richtung ${d.arrow}">${d.arrow}</button>`
          )
          .join("")}
      </div>
    `;

    const grid = document.createElement("div");
    grid.className = "rk-grid";
    grid.tabIndex = 0;
    grid.style.setProperty("--cols", COLS);

    const keys = document.createElement("div");
    keys.className = "rk-keys";
    const keyButtons = [
      ...["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"].map((k) => ({ k, cls: "" })),
      ...SYMBOLS.map((k) => ({ k, cls: "rk-sym" })),
    ];
    keys.innerHTML =
      keyButtons.map(({ k, cls }) => `<button type="button" class="rk-key ${cls}" data-ch="${k}">${k}</button>`).join("") +
      `<button type="button" class="rk-key rk-tool" data-act="line" title="Strich unter dem Kästchen">▁ Strich</button>` +
      `<button type="button" class="rk-key rk-tool" data-act="back" aria-label="Löschen">⌫</button>`;

    const footer = document.createElement("div");
    footer.className = "rk-footer";
    footer.innerHTML = `
      <button type="button" class="rk-small" data-act="addrow">＋ Zeile</button>
      <button type="button" class="rk-small" data-act="clear">🗑 Alles löschen</button>
    `;

    root.append(bar, grid, keys, footer);
    container.appendChild(root);

    // ---------- Zeichnen ----------
    function render() {
      grid.innerHTML = "";
      const frag = document.createDocumentFragment();
      state.rows.forEach((row, r) => {
        row.forEach((cell, c) => {
          const el = document.createElement("div");
          el.className = "rk-cell";
          if (cell.line) el.classList.add("line");
          if (r === state.r && c === state.c) {
            el.classList.add("sel");
            el.dataset.arrow = DIRS[state.dir].arrow;
          }
          el.dataset.r = r;
          el.dataset.c = c;
          el.textContent = cell.ch;
          frag.appendChild(el);
        });
      });
      grid.appendChild(frag);
      bar.querySelectorAll(".rk-dir").forEach((b) => {
        b.classList.toggle("active", b.dataset.dir === state.dir);
      });
      const addRow = footer.querySelector('[data-act="addrow"]');
      addRow.disabled = state.rows.length >= MAX_ROWS;
    }

    // ---------- Bewegen ----------
    function move(dirName) {
      const d = DIRS[dirName];
      let r = state.r + d.dr;
      const c = state.c + d.dc;
      if (c < 0 || c >= COLS || r < 0) return false;
      if (r >= state.rows.length) {
        if (state.rows.length >= MAX_ROWS) return false;
        state.rows.push(newRow());
      }
      state.r = r;
      state.c = c;
      return true;
    }

    // ---------- Eingaben ----------
    function typeChar(ch) {
      state.rows[state.r][state.c].ch = ch;
      move(state.dir);
      render();
    }

    function toggleLine() {
      const cell = state.rows[state.r][state.c];
      cell.line = !cell.line;
      move(state.dir);
      render();
    }

    function backspace() {
      const cell = state.rows[state.r][state.c];
      if (cell.ch === "" && !cell.line) {
        // Leeres Kästchen: ein Schritt zurück und dort löschen.
        if (!move(OPPOSITE[state.dir])) return;
      }
      const target = state.rows[state.r][state.c];
      target.ch = "";
      target.line = false;
      render();
    }

    function addRow() {
      if (state.rows.length >= MAX_ROWS) return;
      state.rows.push(newRow());
      render();
    }

    function clearAll() {
      if (!window.confirm("Das ganze Rechenfeld löschen?")) return;
      state.rows = Array.from({ length: START_ROWS }, newRow);
      state.r = 0;
      state.c = 0;
      render();
    }

    // ---------- Events ----------
    grid.addEventListener("click", (e) => {
      const cell = e.target.closest(".rk-cell");
      if (!cell) return;
      state.r = Number(cell.dataset.r);
      state.c = Number(cell.dataset.c);
      render();
      grid.focus({ preventScroll: true });
    });

    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".rk-dir");
      if (!btn) return;
      state.dir = btn.dataset.dir;
      render();
    });

    keys.addEventListener("click", (e) => {
      const btn = e.target.closest(".rk-key");
      if (!btn) return;
      if (btn.dataset.ch) typeChar(btn.dataset.ch);
      else if (btn.dataset.act === "line") toggleLine();
      else if (btn.dataset.act === "back") backspace();
    });

    footer.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.act === "addrow") addRow();
      else if (btn.dataset.act === "clear") clearAll();
    });

    // Angeschlossene Tastatur (z. B. am iPad oder Laptop).
    const KEY_MAP = { "-": "−", "*": "×", x: "×", X: "×", "/": ":", ".": "," };
    root.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let handled = true;
      const k = e.key;
      if (/^[0-9]$/.test(k)) typeChar(k);
      else if (KEY_MAP[k]) typeChar(KEY_MAP[k]);
      else if (SYMBOLS.includes(k)) typeChar(k);
      else if (k === "Backspace" || k === "Delete") backspace();
      else if (k === "ArrowRight") { move("right"); render(); }
      else if (k === "ArrowLeft") { move("left"); render(); }
      else if (k === "ArrowDown") { move("down"); render(); }
      else if (k === "ArrowUp") { move("up"); render(); }
      else handled = false;
      if (handled) e.preventDefault();
    });

    render();
  }

  window.Rechenkaro = { mount };
})();
