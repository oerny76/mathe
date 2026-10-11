// Tägliches Kopfrechnen ("Kopf-Minute"): eigenständiger Bereich oben auf jeder
// Kinderseite, unabhängig von den wöchentlichen Arbeitsblättern. Erzeugt pro
// Kind und Kalendertag ~6 Aufgaben aus Addition/Subtraktion und
// Multiplikation/Division (ca. 10 Minuten), auf Basis der Stufe in
// KOPF_STUFE/KOPF_LEVELS (siehe shared.js, vor diesem Skript geladen).
//
// In eine eigene IIFE gekapselt, damit Variablen/Hilfsfunktionen nicht mit
// app.js kollidieren – beide Skripte laufen unabhängig voneinander auf
// derselben Seite.
(function () {
  const KOPF_TASK_COUNT = 6;

  const els = {
    section: document.getElementById("kopf-daily"),
    dateLabel: document.getElementById("kopf-daily-date"),
    taskList: document.getElementById("kopf-daily-tasks"),
    checkBtn: document.getElementById("kopf-daily-check"),
    retryBtn: document.getElementById("kopf-daily-retry"),
    resultBanner: document.getElementById("kopf-daily-result"),
  };

  if (!els.section) return; // Seite ohne Kopf-Minute-Markup (sollte nicht vorkommen)

  let kopfKid = null;
  let kopfDate = null;
  let kopfTasks = [];

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Kleiner seedbarer Zufallsgenerator (mulberry32): dieselbe Kind+Tag+Stufe
  // -Kombination liefert immer dieselbe Zahlenfolge, damit die Aufgaben beim
  // erneuten Laden der Seite am selben Tag gleich bleiben, aber am nächsten
  // Tag neu sind.
  function mulberry32(seed) {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFromString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function makeAddition(rng, max) {
    const a = randInt(rng, 1, max - 1);
    const b = randInt(rng, 1, max - a);
    return { frage: `${a} + ${b} = ?`, loesung: String(a + b) };
  }

  function makeSubtraction(rng, max) {
    const a = randInt(rng, 2, max);
    const b = randInt(rng, 1, a - 1);
    return { frage: `${a} − ${b} = ?`, loesung: String(a - b) };
  }

  function makeMultiplication(rng, tables) {
    const table = pick(rng, tables);
    const factor = randInt(rng, 1, 10);
    return { frage: `${table} × ${factor} = ?`, loesung: String(table * factor) };
  }

  function makeDivision(rng, tables) {
    const table = pick(rng, tables);
    const factor = randInt(rng, 1, 10);
    return { frage: `${table * factor} ÷ ${table} = ?`, loesung: String(factor) };
  }

  // Erzeugt die heutigen Kopfrechnen-Aufgaben eines Kindes: 3x
  // Addition/Subtraktion (gemischt) + 3x Multiplikation/Division (gemischt),
  // Schwierigkeit je nach aktueller Stufe des Kindes.
  function generateKopfAufgaben(kidId, dateStr) {
    const levels = KOPF_LEVELS[kidId];
    if (!levels || levels.length === 0) return [];

    const stufeIndex = Math.min(Math.max(KOPF_STUFE[kidId] || 0, 0), levels.length - 1);
    const level = levels[stufeIndex];
    const rng = mulberry32(seedFromString(`${kidId}:${dateStr}:${stufeIndex}`));

    const aufgaben = [];
    let id = 1;

    for (let i = 0; i < KOPF_TASK_COUNT / 2; i++) {
      const task = rng() < 0.5 ? makeAddition(rng, level.addSub.max) : makeSubtraction(rng, level.addSub.max);
      aufgaben.push({ id: id++, typ: "rechnen", ...task });
    }
    for (let i = 0; i < KOPF_TASK_COUNT / 2; i++) {
      const task = rng() < 0.5 ? makeMultiplication(rng, level.tables) : makeDivision(rng, level.tables);
      aufgaben.push({ id: id++, typ: "rechnen", ...task });
    }

    return aufgaben;
  }

  // ---------- Fortschritt (localStorage, pro Kind + Kalendertag) ----------
  function kopfProgressKey(kidId, dateStr) {
    return `mathe-pwa:kopf:${kidId}:${dateStr}`;
  }

  function loadKopfProgress() {
    try {
      const raw = localStorage.getItem(kopfProgressKey(kopfKid.id, kopfDate));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveKopfProgress(data) {
    try {
      localStorage.setItem(kopfProgressKey(kopfKid.id, kopfDate), JSON.stringify(data));
    } catch (e) {
      console.warn("Konnte Kopfrechnen-Fortschritt nicht speichern:", e);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function normalizeAnswer(value) {
    return String(value).trim().replace(",", ".").toLowerCase();
  }

  // ---------- Rendern ----------
  function renderKopfTasks() {
    const saved = loadKopfProgress();
    els.taskList.innerHTML = "";

    kopfTasks.forEach((task, index) => {
      const card = document.createElement("div");
      card.dataset.taskId = task.id;

      const savedAnswer = saved?.answers?.[task.id] ?? "";
      let initialState = "";
      if (savedAnswer !== "") {
        const isCorrect = normalizeAnswer(savedAnswer) === normalizeAnswer(task.loesung);
        initialState = isCorrect ? " correct" : " wrong";
      }
      card.className = "task-card" + initialState;

      card.innerHTML = `
        <span class="task-number">Aufgabe ${index + 1} von ${kopfTasks.length}</span>
        <p class="task-question">${escapeHtml(task.frage)}</p>
        <div class="task-input-row">
          <input
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="Deine Antwort"
            value="${escapeHtml(String(savedAnswer))}"
            data-task-id="${task.id}"
          />
          <span class="task-mark" aria-hidden="true"></span>
        </div>
      `;
      els.taskList.appendChild(card);
    });

    const allDone = !!saved && saved.correctCount === saved.total;
    els.checkBtn.hidden = allDone;
    els.retryBtn.hidden = !allDone;
    if (allDone) {
      showKopfResult(saved.correctCount, saved.total);
    } else {
      els.resultBanner.hidden = true;
    }
  }

  function showKopfResult(correct, total) {
    els.resultBanner.hidden = false;
    els.resultBanner.classList.toggle("needs-practice", correct < total);
    els.resultBanner.textContent =
      correct === total
        ? `🎉 Super! Alle ${total} Kopfrechnen-Aufgaben richtig!`
        : `Du hast ${correct} von ${total} richtig. Schau dir die roten Aufgaben nochmal an! 💪`;
  }

  function checkKopfAnswers() {
    let correctCount = 0;
    const answers = {};

    kopfTasks.forEach((task) => {
      const input = els.taskList.querySelector(`input[data-task-id="${task.id}"]`);
      const card = input.closest(".task-card");
      const given = normalizeAnswer(input.value);
      const expected = normalizeAnswer(task.loesung);

      answers[task.id] = input.value;

      card.classList.remove("correct", "wrong");
      if (given !== "" && given === expected) {
        card.classList.add("correct");
        correctCount++;
      } else {
        card.classList.add("wrong");
      }
      input.disabled = true;
    });

    saveKopfProgress({
      answers,
      correctCount,
      total: kopfTasks.length,
      completedAt: new Date().toISOString(),
    });

    showKopfResult(correctCount, kopfTasks.length);
    els.checkBtn.hidden = true;
    els.retryBtn.hidden = false;
  }

  function retryKopf() {
    els.resultBanner.hidden = true;
    els.retryBtn.hidden = true;
    renderKopfTasks();
  }

  function initKopfDaily(kid) {
    kopfKid = kid;
    kopfDate = todayStr();
    kopfTasks = generateKopfAufgaben(kid.id, kopfDate);

    if (kopfTasks.length === 0) {
      els.section.hidden = true;
      return;
    }

    els.dateLabel.textContent = new Date().toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
    });
    renderKopfTasks();
  }

  els.checkBtn.addEventListener("click", checkKopfAnswers);
  els.retryBtn.addEventListener("click", retryKopf);

  const activeKid = KIDS.find((k) => k.id === document.body.dataset.kidId);
  if (activeKid) initKopfDaily(activeKid);
})();
