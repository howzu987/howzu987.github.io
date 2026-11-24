document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const novelId = params.get("id");
    const chNum = params.get("ch");
    const type = getTypeFromURL(params);

    const contentContainer = document.getElementById("chapter-content");
    const backLink = document.getElementById("back-to-novel");

    if (!novelId || !chNum) {
        contentContainer.innerHTML = `<div class="error-box"><p>SYSTEM ERROR: 缺少作品代號或章節參數。</p></div>`;
        return;
    }

    // 小說返回章節目錄；散文 / 短篇沒有目錄，返回作品集的對應分頁
    if (type === "novel") {
        backLink.href = `novel.html?id=${novelId}`;
    } else {
        backLink.href = `works.html#${type}`;
        backLink.textContent = "← 返回作品集 BACK TO WORKS";
    }

    loadChapter(novelId, chNum, type);
});

// 小說排版預處理：
// 1. 去掉每行開頭的空白（避免 4 格縮排被 Markdown 當成程式碼區塊）
// 2. 每一行視為一個段落（單一換行也會分段）
// 3. 單獨一行的「...」當成場景分隔線
function prepareNovelText(raw) {
    return raw
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line !== "")
        .map(line => (line === "..." ? "* * *" : line))
        .join("\n\n");
}

async function loadChapter(novelId, chNum, type) {
    const contentContainer = document.getElementById("chapter-content");
    const base = `${getWorkDir(type)}/${novelId}`;

    try {
        const mdResponse = await fetch(`${base}/chapters/${chNum}.md`);
        if (!mdResponse.ok) {
            throw new Error("找不到指定的章節檔案");
        }
        const markdownText = await mdResponse.text();

        contentContainer.innerHTML = marked.parse(prepareNovelText(markdownText));

        const infoResponse = await fetch(`${base}/info.json`);
        if (infoResponse.ok) {
            const novelData = await infoResponse.json();
            const chapters = novelData.chapters;
            const currentIndex = chapters.findIndex(ch => String(ch.num) === String(chNum));

            if (currentIndex !== -1) {
                document.title = `${chapters[currentIndex].title} | ${novelData.title} | MY ARCHIVE`;
                setupReaderNavigation(novelId, chapters, currentIndex, type);
                saveReadingProgress(novelId, novelData.title, chapters[currentIndex], type);
            }
        }

    } catch (error) {
        console.error(error);
        contentContainer.innerHTML = `
            <div class="error-box">
                <p>SYSTEM ERROR: 無法載入文章內容。</p>
                <p style="font-size: 12px; margin-top: 8px; opacity: 0.7;">
                    請確認 ${base}/chapters/${chNum}.md 檔案是否存在。
                </p>
            </div>
        `;
    }
}

function setupReaderNavigation(novelId, chapters, currentIndex, type) {
    const navBar = document.getElementById("reader-nav");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const t = typeParam(type);

    // 只有一章（散文 / 短篇）時不顯示上下章按鈕
    if (chapters.length <= 1) return;

    navBar.style.display = "flex";

    if (currentIndex > 0) {
        prevBtn.style.visibility = "visible";
        prevBtn.onclick = () => {
            window.location.href = `reader.html?id=${novelId}&ch=${chapters[currentIndex - 1].num}${t}`;
        };
    } else {
        prevBtn.style.visibility = "hidden";
    }

    if (currentIndex < chapters.length - 1) {
        nextBtn.style.visibility = "visible";
        nextBtn.onclick = () => {
            window.location.href = `reader.html?id=${novelId}&ch=${chapters[currentIndex + 1].num}${t}`;
        };
    } else {
        nextBtn.style.visibility = "hidden";
    }
}

// 記錄最後閱讀的章節（首頁「繼續閱讀」使用，只存在讀者自己的瀏覽器）
function saveReadingProgress(novelId, novelTitle, chapter, type) {
    try {
        localStorage.setItem("archive:lastRead", JSON.stringify({
            id: novelId,
            type: type,
            ch: chapter.num,
            novelTitle: novelTitle,
            chTitle: chapter.title,
            time: Date.now()
        }));
    } catch (e) {
        // 無法儲存時略過
    }
}
