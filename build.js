#!/usr/bin/env node
/*
 * ARCHIVE 站點建置工具（只需要安裝 Node.js，不需要任何套件）
 *
 *   node build.js                 掃描 novels/，自動產生所有資料檔
 *   node build.js chapter <id>    為某部小說建立下一章的 .md 範本
 *   node build.js new <id>        建立一部新小說的資料夾與 meta.json 範本
 *
 * 自動產生：novels/<id>/info.json、data/books.json，
 * 並在偵測到新章節時，於 data/announcements.json 最前面加一則公告。
 * 手寫的公告不會被動到。
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const NOVELS = path.join(ROOT, "novels");
const DATA = path.join(ROOT, "data");

const readJSON = (p, fallback) => {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
};
const writeJSON = (p, obj) =>
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
const byNumeric = (a, b) => a.localeCompare(b, undefined, { numeric: true });

function today() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

// 章節標題 = .md 檔第一個「# 標題」
function chapterTitle(file, num) {
    const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const m = text.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : `第 ${parseInt(num, 10) || num} 章`;
}

function listChapterFiles(id) {
    const chDir = path.join(NOVELS, id, "chapters");
    if (!fs.existsSync(chDir)) return [];
    // 檔名以 _ 開頭的視為草稿，不會公開
    return fs.readdirSync(chDir)
        .filter(f => f.endsWith(".md") && !f.startsWith("_"))
        .sort(byNumeric);
}

function build() {
    fs.mkdirSync(DATA, { recursive: true });
    const oldBooks = readJSON(path.join(DATA, "books.json"), []);
    const announcements = readJSON(path.join(DATA, "announcements.json"), []);

    const ids = fs.readdirSync(NOVELS, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name);

    const books = [];
    const newLogs = [];

    for (const id of ids) {
        const dir = path.join(NOVELS, id);
        const metaPath = path.join(dir, "meta.json");
        if (!fs.existsSync(metaPath)) {
            console.warn(`略過 ${id}：找不到 meta.json`);
            continue;
        }
        let meta;
        try {
            meta = JSON.parse(fs.readFileSync(metaPath, "utf8").replace(/^\uFEFF/, ""));
        } catch (e) {
            // 格式錯誤時直接中止：不會覆蓋任何現有資料，Actions 會顯示紅色叉叉
            console.error(`✖ novels/${id}/meta.json 格式錯誤：${e.message}`);
            console.error(`  常見原因：使用了中文引號 “ ” 、缺少逗號，或多了結尾逗號。請全部改成半形 " 。`);
            process.exit(1);
        }

        const oldInfo = readJSON(path.join(dir, "info.json"), null);
        const oldBook = oldBooks.find(b => b.id === id);
        const fallbackDate = oldBook ? oldBook.updatedAt : today();
        const oldChapters = new Map(((oldInfo && oldInfo.chapters) || []).map(c => [c.num, c]));

        const chapters = listChapterFiles(id).map(f => {
            const num = path.basename(f, ".md");
            const old = oldChapters.get(num);
            return {
                num,
                title: chapterTitle(path.join(dir, "chapters", f), num),
                // 舊章節沿用原日期；全新的章節記為今天
                date: old ? (old.date || fallbackDate) : today()
            };
        });

        const added = chapters.filter(c => !oldChapters.has(c.num));
        if (added.length > 0) {
            const last = added[added.length - 1];
            newLogs.push({
                date: today(),
                text: added.length === 1
                    ? `《${meta.title}》${last.title} 更新。`
                    : `《${meta.title}》新增 ${added.length} 章，最新：${last.title}。`,
                link: `reader.html?id=${id}&ch=${last.num}`
            });
        }

        const updatedAt = chapters.length > 0
            ? chapters.map(c => c.date).sort().pop()
            : (meta.updatedAt || fallbackDate);

        writeJSON(path.join(dir, "info.json"), {
            id,
            code: meta.code,
            title: meta.title,
            enTitle: meta.enTitle,
            status: meta.status,
            author: meta.author,
            summary: meta.summary,
            chapters
        });

        books.push({
            id,
            code: meta.code,
            title: meta.title,
            enTitle: meta.enTitle,
            status: meta.status,
            tags: meta.tags || [],
            summary: meta.summary,
            updatedAt
        });

        console.log(`✔ ${id}：${chapters.length} 章，更新日 ${updatedAt}`);
    }

    books.sort((a, b) => byNumeric(a.code, b.code));
    writeJSON(path.join(DATA, "books.json"), books);

    if (newLogs.length > 0) {
        writeJSON(path.join(DATA, "announcements.json"), [...newLogs, ...announcements]);
        newLogs.forEach(l => console.log(`＋ 新公告：${l.text}`));
    }
    console.log("完成。");
}

function newChapter(id) {
    const chDir = path.join(NOVELS, id, "chapters");
    if (!fs.existsSync(path.join(NOVELS, id))) {
        console.error(`找不到小說 ${id}，請先執行：node build.js new ${id}`);
        process.exit(1);
    }
    fs.mkdirSync(chDir, { recursive: true });
    const nums = fs.readdirSync(chDir)
        .map(f => parseInt(f.replace(/^_/, ""), 10))
        .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    const name = String(next).padStart(3, "0");
    const file = path.join(chDir, `${name}.md`);
    fs.writeFileSync(file, `# 第${next}章：\n\n`, "utf8");
    console.log(`已建立 ${path.relative(ROOT, file)}，寫完後執行 node build.js`);
}

function newNovel(id) {
    const dir = path.join(NOVELS, id);
    if (fs.existsSync(dir)) {
        console.error(`${id} 已經存在`);
        process.exit(1);
    }
    fs.mkdirSync(path.join(dir, "chapters"), { recursive: true });
    const count = fs.readdirSync(NOVELS, { withFileTypes: true }).filter(d => d.isDirectory()).length;
    writeJSON(path.join(dir, "meta.json"), {
        code: `FILE // ${String(count).padStart(3, "0")}`,
        title: "作品名稱",
        enTitle: id.toUpperCase().replace(/-/g, " "),
        status: "企劃中 PLANNING",
        author: "筆名還沒想",
        tags: [],
        summary: "簡介",
        updatedAt: today()
    });
    console.log(`已建立 novels/${id}/meta.json，請編輯後執行 node build.js`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "chapter" && arg) newChapter(arg);
else if (cmd === "new" && arg) newNovel(arg);
else if (!cmd) build();
else console.log("用法：node build.js | node build.js chapter <id> | node build.js new <id>");