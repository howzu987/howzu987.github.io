const FILTERS = ["all", "novel", "essay", "short"];
let works = [];

document.addEventListener("DOMContentLoaded", () => {
    const worksGrid = document.getElementById("works-grid");
    // 確保只在有 works-grid 的頁面執行
    if (worksGrid) {
        loadWorks(worksGrid);
    }
});

// 從網址 # 取得目前的篩選（例如 works.html#essay）
function currentFilter() {
    const h = window.location.hash.replace("#", "");
    return FILTERS.includes(h) ? h : "all";
}

async function loadWorks(container) {
    try {
        const response = await fetch("data/books.json");
        if (!response.ok) {
            throw new Error("無法讀取檔案庫資料");
        }
        works = await response.json();

        setupFilters(container);
        renderWorks(container);

        window.addEventListener("hashchange", () => renderWorks(container));

    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="error-box">
                <p>SYSTEM ERROR: 無法載入作品資料。</p>
                <p style="font-size: 12px; margin-top: 8px; opacity: 0.7;">
                    提示：若在本地端直接雙擊 HTML 開啟，瀏覽器會阻擋讀取 JSON。請使用 VS Code 的「Live Server」套件預覽。
                </p>
            </div>
        `;
    }
}

function setupFilters() {
    const bar = document.getElementById("filter-bar");
    if (!bar) return;

    bar.querySelectorAll(".filter-btn").forEach(btn => {
        const f = btn.dataset.filter;
        const count = f === "all"
            ? works.length
            : works.filter(b => getBookType(b) === f).length;
        const countEl = btn.querySelector(".count");
        if (countEl) countEl.textContent = count;

        btn.addEventListener("click", () => {
            window.location.hash = f;
        });
    });
}

function renderWorks(container) {
    const filter = currentFilter();

    // 標示目前選到的分頁
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === filter);
    });

    const list = filter === "all"
        ? works
        : works.filter(b => getBookType(b) === filter);

    container.innerHTML = "";
    if (list.length === 0) {
        container.innerHTML = `<p class="loading-text">// NO FILES</p>`;
        return;
    }
    list.forEach(book => container.appendChild(buildWorkCard(book)));
}
