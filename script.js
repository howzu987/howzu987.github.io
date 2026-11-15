document.addEventListener("DOMContentLoaded", () => {
    const worksGrid = document.getElementById("works-grid");
    
    // 確保只在有 works-grid 的頁面執行
    if (worksGrid) {
        loadWorks(worksGrid);
    }
});

async function loadWorks(container) {
    try {
        const response = await fetch("data/books.json");
        if (!response.ok) {
            throw new Error("無法讀取檔案庫資料");
        }
        const books = await response.json();
        
        // 清空載入提示
        container.innerHTML = "";

        books.forEach(book => {
            // 組合標籤 HTML
            const tagsHTML = book.tags
                .map(tag => `<span class="tag">${tag}</span>`)
                .join("");

            // 建立卡片連結（導向獨立小說頁面，並帶上作品 ID 參數）
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

            container.appendChild(card);
        });

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