// 作品卡片的共用程式（作品集頁與首頁都會用到）
const TYPE_LABELS = {
    novel: "NOVEL 小說",
    essay: "ESSAY 散文",
    short: "SHORT STORY 短篇"
};

// 三種作品各自的資料夾
const TYPE_DIRS = {
    novel: "novels",
    essay: "essays",
    short: "shorts"
};

function isKnownType(t) {
    return Object.prototype.hasOwnProperty.call(TYPE_DIRS, t);
}

// 類型 -> 資料夾名稱
function getWorkDir(type) {
    return isKnownType(type) ? TYPE_DIRS[type] : TYPE_DIRS.novel;
}

// 網址參數 t（小說可省略）-> 類型
function getTypeFromURL(params) {
    const t = params.get("t");
    return isKnownType(t) ? t : "novel";
}

// 連結要附上的類型參數（小說不用）
function typeParam(type) {
    return type && type !== "novel" ? `&t=${type}` : "";
}

function getBookType(book) {
    return book.type || "novel";   // 舊資料沒有 type 時視為小說
}

// 小說 → 章節目錄頁；短篇 / 散文 → 直接進閱讀頁
function getBookLink(book) {
    const id = encodeURIComponent(book.id);
    if (getBookType(book) !== "novel" && book.firstChapter) {
        return `reader.html?id=${id}&ch=${encodeURIComponent(book.firstChapter)}${typeParam(getBookType(book))}`;
    }
    return `novel.html?id=${id}`;
}

function formatWordCount(n) {
    return `${Number(n || 0).toLocaleString("en-US")} 字`;
}

function buildWorkCard(book) {
    const type = getBookType(book);
    const tagsHTML = (book.tags || [])
        .map(tag => `<span class="tag">${tag}</span>`)
        .join("");

    // 檔案編號與連載狀態只有小說才有
    let headerLeft, headerRight;
    if (type === "novel") {
        headerLeft = `<span class="file-code">${book.code || ""}</span>`;
        headerRight = `<span class="status-badge">${book.status || ""}</span>`;
    } else {
        headerLeft = `<span class="type-label type-${type}">${TYPE_LABELS[type]}</span>`;
        headerRight = `<span class="status-badge">${formatWordCount(book.wordCount)}</span>`;
    }

    const enTitleHTML = book.enTitle
        ? `<div class="work-en-title">${book.enTitle}</div>`
        : "";

    const card = document.createElement("a");
    card.href = getBookLink(book);
    card.className = `work-card type-${type}`;
    card.innerHTML = `
        <div class="card-header">
            ${headerLeft}
            ${headerRight}
        </div>
        <div class="card-body">
            <h2 class="work-title">${book.title}</h2>
            ${enTitleHTML}
            <p class="work-summary">${book.summary || ""}</p>
        </div>
        <div class="card-footer">
            <div class="tags">${tagsHTML}</div>
            <div class="update-date">UPD: ${book.updatedAt}</div>
        </div>
    `;
    return card;
}
