let allBooks = [];

// 系統公告預設顯示幾則（其餘可按「展開」查看）
const LOG_VISIBLE = 4;

document.addEventListener("DOMContentLoaded", () => {
    renderContinueReading();
    loadLatest();
    loadAnnouncements();
});

/* ---------- 工具 ---------- */

// "2026.11.15" -> 時間戳；無法解析（例如 "test"）回傳 0
function toTime(str) {
    const t = Date.parse(String(str).replace(/\./g, "-"));
    return isNaN(t) ? 0 : t;
}

/* ---------- 繼續閱讀 ---------- */

function renderContinueReading() {
    try {
        const raw = localStorage.getItem("archive:lastRead");
        if (!raw) return;
        const last = JSON.parse(raw);
        if (!last.id || !last.ch) return;

        document.getElementById("continue-link").href =
            `reader.html?id=${encodeURIComponent(last.id)}&ch=${encodeURIComponent(last.ch)}`;
        document.getElementById("continue-num").textContent = last.novelTitle || last.id;
        document.getElementById("continue-title").textContent = last.chTitle || `CHAPTER ${last.ch}`;
        document.getElementById("continue-section").hidden = false;
    } catch (e) {
        // 瀏覽器禁用儲存時直接略過
    }
}

/* ---------- 最新更新 + 隨機抽一篇 ---------- */

async function loadLatest() {
    const grid = document.getElementById("latest-grid");
    try {
        const res = await fetch("data/books.json");
        if (!res.ok) throw new Error("books.json 讀取失敗");
        allBooks = await res.json();

        // 啟用隨機按鈕
        const randomBtn = document.getElementById("random-btn");
        randomBtn.disabled = false;
        randomBtn.addEventListener("click", goRandom);

        // 依更新日期由新到舊，取前 3 筆
        const latest = [...allBooks]
            .sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt))
            .slice(0, 3);

        grid.innerHTML = "";
        latest.forEach(book => {
            const tagsHTML = (book.tags || [])
                .map(tag => `<span class="tag">${tag}</span>`)
                .join("");

            const card = document.createElement("a");
            card.href = `novel.html?id=${book.id}`;
            card.className = "work-card";
            card.innerHTML = `
                <div class="card-header">
                    <span class="file-code">${book.code}</span>
                    <span class="status-badge">${book.status}</span>
                </div>
                <div class="card-body">
                    <h2 class="work-title">${book.title}</h2>
                    <div class="work-en-title">${book.enTitle}</div>
                    <p class="work-summary">${book.summary}</p>
                </div>
                <div class="card-footer">
                    <div class="tags">${tagsHTML}</div>
                    <div class="update-date">UPD: ${book.updatedAt}</div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<div class="error-box"><p>SYSTEM ERROR: 無法載入作品資料。</p></div>`;
    }
}

function goRandom() {
    if (allBooks.length === 0) return;
    const pick = allBooks[Math.floor(Math.random() * allBooks.length)];
    window.location.href = `novel.html?id=${pick.id}`;
}

/* ---------- 系統公告 ---------- */

async function loadAnnouncements() {
    const list = document.getElementById("log-list");
    try {
        const res = await fetch("data/announcements.json");
        if (!res.ok) throw new Error("announcements.json 讀取失敗");
        const logs = await res.json();

        if (logs.length === 0) {
            list.innerHTML = `<li class="log-empty">// NO LOGS</li>`;
            return;
        }

        const sorted = [...logs].sort((a, b) => toTime(b.date) - toTime(a.date));

        // 預設只顯示最新 LOG_VISIBLE 則，其餘先收起來，按鈕可展開
        list.innerHTML = sorted
            .map((log, i) => {
                const text = log.link
                    ? `<a href="${log.link}">${log.text}</a>`
                    : log.text;
                const extra = i >= LOG_VISIBLE ? ' class="log-extra" hidden' : "";
                return `<li${extra}><span class="log-date">[${log.date}]</span> <span class="log-text">${text}</span></li>`;
            })
            .join("");

        if (sorted.length > LOG_VISIBLE) {
            setupLogToggle(list, sorted.length);
        }
    } catch (error) {
        console.error(error);
        list.innerHTML = `<li class="log-empty">// LOG UNAVAILABLE</li>`;
    }
}

function setupLogToggle(list, total) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "log-toggle";
    let open = false;

    const render = () => {
        btn.textContent = open
            ? "▲ 收合 COLLAPSE"
            : `▼ 展開全部 SHOW ALL (${total})`;
    };

    btn.addEventListener("click", () => {
        open = !open;
        list.querySelectorAll(".log-extra").forEach(li => { li.hidden = !open; });
        render();
    });

    render();
    list.insertAdjacentElement("afterend", btn);
}
