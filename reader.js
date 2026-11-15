document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const novelId = params.get("id");
    const chNum = params.get("ch");

    const contentContainer = document.getElementById("chapter-content");
    const backLink = document.getElementById("back-to-novel");

    if (!novelId || !chNum) {
        contentContainer.innerHTML = `<div class="error-box"><p>SYSTEM ERROR: 缺少小說代號或章節參數。</p></div>`;
        return;
    }

    // 設定「返回目錄」的連結
    backLink.href = `novel.html?id=${novelId}`;

    // 載入章節 Markdown 檔案與小說資訊（用來做上下章切換）
    loadChapter(novelId, chNum);
});

async function loadChapter(novelId, chNum) {
    const contentContainer = document.getElementById("chapter-content");

    try {
        // 1. 讀取該章節的 .md 檔案
        const mdResponse = await fetch(`novels/${novelId}/chapters/${chNum}.md`);
        if (!mdResponse.ok) {
            throw new Error("找不到指定的章節檔案");
        }
        const markdownText = await mdResponse.text();

        // 2. 使用 Marked.js 將 Markdown 轉為 HTML
        contentContainer.innerHTML = marked.parse(markdownText);

        // 3. 同步讀取 info.json 來設定網頁標題與上下章按鈕
        const infoResponse = await fetch(`novels/${novelId}/info.json`);
        if (infoResponse.ok) {
            const novelData = await infoResponse.json();
            
            // 找出當前章節在陣列中的位置
            const chapters = novelData.chapters;
            const currentIndex = chapters.findIndex(ch => ch.num === chNum);
            
            if (currentIndex !== -1) {
                document.title = `${chapters[currentIndex].title} | ${novelData.title} | MY ARCHIVE`;
                setupReaderNavigation(novelId, chapters, currentIndex);
            }
        }

    } catch (error) {
        console.error(error);
        contentContainer.innerHTML = `
            <div class="error-box">
                <p>SYSTEM ERROR: 無法載入文章內容。</p>
                <p style="font-size: 12px; margin-top: 8px; opacity: 0.7;">
                    請確認 novels/${novelId}/chapters/${chNum}.md 檔案是否存在。
                </p>
            </div>
        `;
    }
}

// 設定上下章切換邏輯
function setupReaderNavigation(novelId, chapters, currentIndex) {
    const navBar = document.getElementById("reader-nav");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");

    navBar.style.display = "flex";

    // 上一章
    if (currentIndex > 0) {
        prevBtn.style.visibility = "visible";
        prevBtn.onclick = () => {
            window.location.href = `reader.html?id=${novelId}&ch=${chapters[currentIndex - 1].num}`;
        };
    } else {
        prevBtn.style.visibility = "hidden";
    }

    // 下一章
    if (currentIndex < chapters.length - 1) {
        nextBtn.style.visibility = "visible";
        nextBtn.onclick = () => {
            window.location.href = `reader.html?id=${novelId}&ch=${chapters[currentIndex + 1].num}`;
        };
    } else {
        nextBtn.style.visibility = "hidden";
    }
}