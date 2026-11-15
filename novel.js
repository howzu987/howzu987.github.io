document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("novel-container");
    
    // 取得網址列的 id 參數（例如 novel.html?id=deep-dive）
    const params = new URLSearchParams(window.location.search);
    const novelId = params.get("id");

    if (!novelId) {
        container.innerHTML = `<div class="error-box"><p>SYSTEM ERROR: 找不到指定的小說代號。</p></div>`;
        return;
    }

    loadNovelData(novelId, container);
});

async function loadNovelData(id, container) {
    try {
        // 讀取對應小說目錄下的 info.json
        const response = await fetch(`novels/${id}/info.json`);
        if (!response.ok) throw new Error("無法讀取小說資訊");
        
        const novel = await response.json();

        // 動態修改網頁標題
        document.title = `${novel.title} | MY ARCHIVE`;

        // 產生章節列表 HTML
        const chaptersHTML = novel.chapters.map(ch => `
            <a href="reader.html?id=${novel.id}&ch=${ch.num}" class="chapter-item">
                <span class="ch-num">CHAPTER ${ch.num}</span>
                <span class="ch-title">${ch.title}</span>
                <span class="ch-action">READ →</span>
            </a>
        `).join("");

        container.innerHTML = `
            <div class="novel-header">
                <div class="system-tag">${novel.code} // ${novel.status}</div>
                <h1 class="novel-title">${novel.title}</h1>
                <div class="novel-en-title">${novel.enTitle}</div>
                <p class="novel-summary">${novel.summary}</p>
            </div>

            <div class="chapter-section">
                <h2 class="section-heading">CHAPTERS <span class="zh">章節目錄</span></h2>
                <div class="chapter-list">
                    ${chaptersHTML}
                </div>
            </div>
        `;

    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="error-box">
                <p>SYSTEM ERROR: 無法載入該作品的詳細檔案。</p>
            </div>
        `;
    }
}