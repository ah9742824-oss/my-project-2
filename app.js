/* =========================================================
   مكتبتي التعليمية - المنطق المشترك لكل الصفحات
   كل قسم مستقل وآمن (يشتغل بس لو العناصر الخاصة بيه موجودة
   في الصفحة)، عشان نقدر نحمّل نفس الملف في كل الصفحات.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
   * 1) الوضع الليلي (Dark Mode) - موحّد وثابت عبر كل الصفحات
   * ------------------------------------------------------- */
  function initDarkMode() {
    const KEY = "theme";
    const root = document.documentElement;

    function apply(theme) {
      root.classList.toggle("dark", theme === "dark");
    }

    const saved = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    apply(saved || (prefersDark ? "dark" : "light"));

    let btn = document.getElementById("mode-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "mode-toggle";
      btn.className = "mode-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "تبديل الوضع الليلي");
      document.body.appendChild(btn);
    }
    btn.textContent = root.classList.contains("dark") ? "☀️" : "🌙";

    btn.addEventListener("click", () => {
      const isDark = root.classList.toggle("dark");
      localStorage.setItem(KEY, isDark ? "dark" : "light");
      btn.textContent = isDark ? "☀️" : "🌙";
    });
  }

  /* ---------------------------------------------------------
   * أداة صغيرة: توليد id ثابت لأي درس بناءً على رابطه
   * (بدل الاعتماد على ترتيبه في الصفحة، عشان لو اتضاف/اتشال
   * درس أو مادة، تقدم باقي الدروس متتأثرش)
   * ------------------------------------------------------- */
  function hashId(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return "lesson-" + (h >>> 0).toString(36);
  }

  /* ---------------------------------------------------------
   * 2) تتبع التقدم: شريط لكل مادة + شريط عام + زرار ✔️ لكل درس
   * ------------------------------------------------------- */
  function initProgressTracking() {
    const lessonLists = document.querySelectorAll(".subject ul");
    if (!lessonLists.length) return;

    function updateGlobalProgress() {
      const links = document.querySelectorAll(".subject ul li a[data-lesson-id]");
      const total = links.length;
      let done = 0;
      links.forEach((link) => {
        if (localStorage.getItem(link.dataset.lessonId) === "true") done++;
      });
      const bar = document.querySelector(".global-progress-bar");
      if (!bar) return;
      const percent = total ? Math.round((done / total) * 100) : 0;
      bar.style.width = percent + "%";
      bar.textContent = percent + "%";
    }

    lessonLists.forEach((ul) => {
      const lessons = ul.querySelectorAll("li a");
      if (!lessons.length) return; // يمنع باج شريط NaN% على القوائم الفاضية

      const progressContainer = document.createElement("div");
      progressContainer.className = "progress-container";
      const progressBar = document.createElement("div");
      progressBar.className = "progress-bar";
      progressBar.textContent = "0%";
      progressContainer.appendChild(progressBar);
      ul.before(progressContainer);

      function updateThisBar() {
        let done = 0;
        lessons.forEach((link) => {
          if (localStorage.getItem(link.dataset.lessonId) === "true") done++;
        });
        const percent = Math.round((done / lessons.length) * 100);
        progressBar.style.width = percent + "%";
        progressBar.textContent = percent + "%";
      }

      lessons.forEach((link) => {
        const id = hashId(link.getAttribute("href") || link.textContent);
        link.dataset.lessonId = id;

        const check = document.createElement("button");
        check.type = "button";
        check.className = "lesson-check";
        check.innerHTML = "✓";
        check.setAttribute("aria-label", "علّم الدرس كمكتمل");
        link.before(check);

        function refreshCheckUI() {
          const isDone = localStorage.getItem(id) === "true";
          check.classList.toggle("done", isDone);
          link.classList.toggle("lesson-done", isDone);
        }

        check.addEventListener("click", () => {
          const isDone = localStorage.getItem(id) === "true";
          localStorage.setItem(id, isDone ? "false" : "true");
          refreshCheckUI();
          updateThisBar();
          updateGlobalProgress();
        });

        refreshCheckUI();
      });

      updateThisBar();
    });

    updateGlobalProgress();

    // تصدير / استيراد التقدم بالكامل
    window.exportProgress = function exportProgress() {
      const data = JSON.stringify(localStorage);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "progress.json";
      a.click();
      URL.revokeObjectURL(url);
    };

    window.importProgress = function importProgress() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            Object.keys(data).forEach((key) => localStorage.setItem(key, data[key]));
            alert("✅ تم استيراد التقدم بنجاح، هيتم تحديث الصفحة الآن.");
            location.reload();
          } catch (err) {
            alert("❌ الملف غير صالح.");
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };

    const toggleMenuBtn = document.getElementById("toggleMenu");
    const menuContent = document.getElementById("menuContent");
    if (toggleMenuBtn && menuContent) {
      toggleMenuBtn.addEventListener("click", () => {
        menuContent.style.display = menuContent.style.display === "block" ? "none" : "block";
      });
    }
  }

  /* ---------------------------------------------------------
   * 3) نافذة عرض الدرس (يوتيوب / جوجل درايف / أي رابط تاني)
   * ------------------------------------------------------- */
  function initVideoModal() {
    const modal = document.getElementById("videoModal");
    const frame = document.getElementById("videoFrame");
    const closeBtn = document.getElementById("closeModal");
    if (!modal || !frame) return;

    function extractEmbedUrl(url) {
      if (url.includes("watch?v=")) {
        const id = url.split("watch?v=")[1].split("&")[0];
        return `https://www.youtube.com/embed/${id}`;
      }
      if (url.includes("youtu.be/")) {
        const id = url.split("youtu.be/")[1].split("?")[0];
        return `https://www.youtube.com/embed/${id}`;
      }
      if (url.includes("drive.google.com")) {
        let fileId = "";
        if (url.includes("/file/d/")) fileId = url.split("/file/d/")[1].split("/")[0];
        else if (url.includes("id=")) fileId = url.split("id=")[1].split("&")[0];
        if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
      }
      return null;
    }

    function openModal(src) {
      frame.src = src;
      modal.classList.add("show");
    }
    function closeModal() {
      modal.classList.remove("show");
      frame.src = "";
    }

    document.querySelectorAll(".subject ul li a").forEach((link) => {
      link.addEventListener("click", (e) => {
        const url = link.getAttribute("href").trim();
        const embedUrl = extractEmbedUrl(url);
        if (embedUrl) {
          e.preventDefault();
          openModal(embedUrl);
        } else {
          // روابط مش فيديو (ملفات، مجلدات، تليجرام...) تتفتح عادي في تاب جديد
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
        }
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("show")) closeModal();
    });
  }

  /* ---------------------------------------------------------
   * 4) الشريط الجانبي: ملخص التقدم لكل مادة + إمكانية السحب
   * ------------------------------------------------------- */
  function initSidebar() {
    const sidebar = document.getElementById("sidebar");
    const openBtn = document.getElementById("openSidebar");
    if (!sidebar || !openBtn) return;

    function getSubjectsFromDOM() {
      return Array.from(document.querySelectorAll(".subject")).map((subject, i) => {
        const summaryEl = subject.querySelector("summary");
        const name = summaryEl ? summaryEl.textContent.replace(/\s+/g, " ").trim() : `مادة ${i + 1}`;
        const links = subject.querySelectorAll("ul li a[data-lesson-id]");
        let done = 0;
        links.forEach((link) => {
          if (localStorage.getItem(link.dataset.lessonId) === "true") done++;
        });
        return { name, total: links.length, done };
      });
    }

    function renderSidebar() {
      const list = document.getElementById("subjectsList");
      if (!list) return;
      const data = getSubjectsFromDOM();
      list.innerHTML = "";
      if (!data.length) {
        list.innerHTML = '<li style="color:#888">لا توجد مواد بعد</li>';
        return;
      }
      data.forEach((s) => {
        const li = document.createElement("li");
        const nameSpan = document.createElement("span");
        nameSpan.textContent = s.name;
        const countSpan = document.createElement("span");
        countSpan.textContent = `${s.done} / ${s.total} درس`;
        li.append(nameSpan, countSpan);
        list.appendChild(li);
      });
    }

    function toggleSidebar() {
      sidebar.classList.toggle("show");
      if (sidebar.classList.contains("show")) {
        renderSidebar();
        showReviewList();
      }
    }

    openBtn.addEventListener("click", toggleSidebar);
    window.toggleSidebar = toggleSidebar; // للتوافق مع زرار الإغلاق جوه الشريط
    window.addEventListener("storage", renderSidebar);

    // السحب لتغيير عرض الشريط
    const handle = sidebar.querySelector(".resize-handle");
    if (handle) {
      let resizing = false;
      handle.addEventListener("mousedown", () => {
        resizing = true;
        document.body.style.userSelect = "none";
      });
      window.addEventListener("mousemove", (e) => {
        if (!resizing) return;
        let width = window.innerWidth - e.clientX;
        width = Math.min(500, Math.max(220, width));
        sidebar.style.width = width + "px";
      });
      window.addEventListener("mouseup", () => {
        resizing = false;
        document.body.style.userSelect = "auto";
      });
    }

    /* ---- تذكير المراجعة: الدروس اللي اتشافت من 4 أيام أو أكتر ---- */
    function getLessonsToReview() {
      const viewed = JSON.parse(localStorage.getItem("viewedLessons") || "{}");
      const now = new Date();
      return Object.entries(viewed)
        .map(([name, dateStr]) => {
          const days = Math.floor((now - new Date(dateStr)) / (1000 * 60 * 60 * 24));
          return { name, days };
        })
        .filter((l) => l.days >= 4)
        .sort((a, b) => b.days - a.days);
    }

    function colorFor(days) {
      if (days >= 10) return "#f8d7da";
      if (days >= 7) return "#ffe5b4";
      return "#fff3cd";
    }

    window.removeLesson = function removeLesson(name) {
      if (!confirm(`هل أنت متأكد من حذف "${name}" من قائمة المراجعة؟`)) return;
      const li = document.querySelector(`[data-lesson="${CSS.escape(name)}"]`);
      const finish = () => {
        const viewed = JSON.parse(localStorage.getItem("viewedLessons") || "{}");
        delete viewed[name];
        localStorage.setItem("viewedLessons", JSON.stringify(viewed));
        showReviewList();
      };
      if (li) {
        li.classList.add("fade-out");
        setTimeout(finish, 400);
      } else {
        finish();
      }
    };

    function showReviewList() {
      const existing = document.getElementById("reviewSection");
      if (existing) existing.remove();

      const lessons = getLessonsToReview();
      const section = document.createElement("div");
      section.id = "reviewSection";
      section.classList.add("fade-in");

      const heading = document.createElement("h2");
      heading.textContent = "📅 دروس للمراجعة ";
      const refreshBtn = document.createElement("button");
      refreshBtn.id = "refreshReview";
      refreshBtn.type = "button";
      refreshBtn.textContent = "🔄 تحديث";
      refreshBtn.style.cssText = "background:#007bff;color:#fff;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:14px;";
      heading.appendChild(refreshBtn);
      section.appendChild(heading);

      const ul = document.createElement("ul");
      ul.style.cssText = "list-style:none;padding:0;margin-top:10px;";
      if (!lessons.length) {
        ul.innerHTML = "<li>لا يوجد دروس تحتاج مراجعة ✅</li>";
      } else {
        lessons.forEach((l) => {
          const li = document.createElement("li");
          li.dataset.lesson = l.name;
          li.style.cssText = `background:${colorFor(l.days)};padding:8px;margin:6px 0;border-radius:6px;display:flex;justify-content:space-between;align-items:center;transition:all .3s;color:#222;`;
          const span = document.createElement("span");
          span.textContent = `${l.name} 🕓 (${l.days} يوم)`;
          const delBtn = document.createElement("button");
          delBtn.textContent = "❌";
          delBtn.style.cssText = "background:#dc3545;color:#fff;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;";
          delBtn.addEventListener("click", () => window.removeLesson(l.name));
          li.append(span, delBtn);
          ul.appendChild(li);
        });
      }
      section.appendChild(ul);
      sidebar.appendChild(section);

      refreshBtn.addEventListener("click", () => {
        section.classList.add("fade-out");
        setTimeout(showReviewList, 400);
      });
    }

    // نسجّل وقت مشاهدة أي درس فيديو عشان نظام المراجعة
    document.querySelectorAll(".subject ul li a").forEach((link) => {
      link.addEventListener("click", () => {
        const name = link.textContent.trim();
        const viewed = JSON.parse(localStorage.getItem("viewedLessons") || "{}");
        viewed[name] = new Date().toISOString();
        localStorage.setItem("viewedLessons", JSON.stringify(viewed));
      });
    });
  }

  /* ---------------------------------------------------------
   * 5) لائحة المهام (Todo List)
   * ------------------------------------------------------- */
  function initTodoList() {
    const input = document.getElementById("taskInput");
    const addBtn = document.getElementById("addTask");
    const list = document.getElementById("taskList");
    if (!input || !addBtn || !list) return;

    let tasks = [];
    try {
      tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    } catch (e) {
      tasks = [];
    }

    function save() {
      localStorage.setItem("tasks", JSON.stringify(tasks));
      render();
    }

    function render() {
      list.innerHTML = "";
      tasks.forEach((task, i) => {
        const li = document.createElement("li");
        if (task.done) li.classList.add("done");

        const span = document.createElement("span");
        span.textContent = task.text;

        const actions = document.createElement("span");
        actions.className = "task-actions";

        const doneBtn = document.createElement("button");
        doneBtn.type = "button";
        doneBtn.textContent = "✅";
        doneBtn.setAttribute("aria-label", "تم الإنجاز");
        doneBtn.addEventListener("click", () => {
          tasks[i].done = !tasks[i].done;
          save();
        });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "❌";
        delBtn.setAttribute("aria-label", "حذف المهمة");
        delBtn.addEventListener("click", () => {
          tasks.splice(i, 1);
          save();
        });

        actions.append(doneBtn, delBtn);
        li.append(span, actions);
        list.appendChild(li);
      });
    }

    addBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) return;
      tasks.push({ text, done: false });
      input.value = "";
      save();
    });
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addBtn.click();
    });

    render();
  }

  /* ---------------------------------------------------------
   * 6) سجل النشاط الكامل (كل درس اتفتح وإمتى)
   * ------------------------------------------------------- */
  function initActivityLog() {
    const logContainer = document.getElementById("logContainer");
    const toggleLogBtn = document.getElementById("toggleLog");
    const logContent = document.getElementById("logContent");
    if (!logContainer || !toggleLogBtn || !logContent) return;

    const LOG_KEY = "allLogs";
    let allLogs = {};
    try {
      allLogs = JSON.parse(localStorage.getItem(LOG_KEY) || "{}");
    } catch (e) {
      allLogs = {};
    }

    function render() {
      logContainer.innerHTML = "";
      const dates = Object.keys(allLogs).sort((a, b) => b.localeCompare(a));
      if (!dates.length) {
        logContainer.innerHTML = '<p style="text-align:center;color:#888;margin:12px 0;">لا يوجد سجلات بعد</p>';
        return;
      }
      dates.forEach((date) => {
        const section = document.createElement("div");
        section.style.marginBottom = "18px";

        const h3 = document.createElement("h3");
        const dateSpan = document.createElement("span");
        dateSpan.textContent = "📅 " + date;
        const delDayBtn = document.createElement("button");
        delDayBtn.textContent = "❌";
        delDayBtn.style.cssText = "background:crimson;border:none;color:#fff;padding:2px 8px;border-radius:6px;cursor:pointer;";
        delDayBtn.addEventListener("click", () => {
          if (confirm(`هل تريد مسح يوم ${date} بالكامل؟`)) {
            delete allLogs[date];
            localStorage.setItem(LOG_KEY, JSON.stringify(allLogs));
            render();
          }
        });
        h3.append(dateSpan, delDayBtn);
        section.appendChild(h3);

        const ul = document.createElement("ul");
        allLogs[date].forEach((item) => {
          const li = document.createElement("li");
          li.textContent = `${item.time} - ${item.title}`;
          ul.appendChild(li);
        });
        section.appendChild(ul);
        logContainer.appendChild(section);
      });
    }
    render();

    document.querySelectorAll(".subject ul li a").forEach((link) => {
      link.addEventListener("click", () => {
        const now = new Date();
        const date = now.toLocaleDateString("en-CA");
        const time = now.toLocaleTimeString();
        const title = (link.textContent || link.href).trim();
        if (!allLogs[date]) allLogs[date] = [];
        allLogs[date].push({ time, title });
        localStorage.setItem(LOG_KEY, JSON.stringify(allLogs));
        render();
      });
    });

    const clearBtn = document.getElementById("clearLogBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (confirm("هل أنت متأكد أنك تريد مسح السجل بالكامل؟")) {
          localStorage.removeItem(LOG_KEY);
          allLogs = {};
          render();
        }
      });
    }

    const exportBtn = document.getElementById("exportLogBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const data = JSON.stringify(allLogs, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "logs.json";
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    const importBtn = document.getElementById("importLogBtn");
    const importFile = document.getElementById("importFile");
    if (importBtn && importFile) {
      importBtn.addEventListener("click", () => importFile.click());
      importFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (typeof data === "object") {
              allLogs = data;
              localStorage.setItem(LOG_KEY, JSON.stringify(allLogs));
              render();
              alert("✅ تم استيراد السجل بنجاح");
            }
          } catch (err) {
            alert("❌ خطأ في استيراد الملف");
          }
        };
        reader.readAsText(file);
      });
    }

    toggleLogBtn.addEventListener("click", () => {
      logContent.classList.toggle("hidden");
      toggleLogBtn.textContent = logContent.classList.contains("hidden") ? "📒 السجل الكامل ▾" : "📒 السجل الكامل ▴";
    });
  }

  /* ---------------------------------------------------------
   * 7) تسجيل الدخول لجوجل شيت (اختياري - يفشل بهدوء لو مفيش نت)
   * ------------------------------------------------------- */
  function initSheetLogging() {
    const links = document.querySelectorAll(".subject ul li a");
    if (!links.length) return;

    const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxRyDuUMxWaqM9rKvmHPqwyRZPYIV1PggbF8PFENf-_rWVO6Yxnjubnb8u18BI8Vank/exec";

    function getStudentName() {
      let name = localStorage.getItem("studentName");
      if (!name) {
        name = prompt("اكتب اسمك (هيتسجل بجانب نشاطك في السجل):", "") || "ضيف";
        localStorage.setItem("studentName", name);
      }
      return name;
    }

    async function saveLogToSheet(name, title) {
      const now = new Date();
      try {
        await fetch(SHEET_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: name,
            date: now.toISOString().split("T")[0],
            time: now.toLocaleTimeString(),
            title,
          }),
        });
      } catch (err) {
        // ما نوقفش المستخدم لو النت مقطوع أو الرابط اتغير
        console.warn("تعذر إرسال السجل لجوجل شيت:", err);
      }
    }

    links.forEach((link) => {
      link.addEventListener("click", () => {
        const title = (link.textContent || link.href).trim();
        saveLogToSheet(getStudentName(), title);
      });
    });
  }

  /* ---------------------------------------------------------
   * تشغيل كل حاجة لما الصفحة تجهز
   * ------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initDarkMode();
    initProgressTracking();
    initVideoModal();
    initSidebar();
    initTodoList();
    initActivityLog();
    initSheetLogging();
  });
})();
