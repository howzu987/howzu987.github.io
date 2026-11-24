#!/usr/bin/env node
/*
 * ARCHIVE 站點建置工具（只需要 Node.js，不需要任何套件；GitHub Actions 會自動執行）
 *
 *   node build.js                                掃描三個作品資料夾，自動產生所有資料檔
 *   node build.js chapter <id> [novel|essay|short]   為作品建立下一章的 .md 範本
 *   node build.js new <id> [novel|essay|short]       建立新作品（預設 novel）
 *
 * 作品放哪個資料夾，就是哪種類型：
 *   novels/  小說：多章節，有檔案編號與連載狀態；點卡片進入章節目錄
 *   essays/  散文：一篇一張卡片；點卡片直接閱讀
 *   shorts/  短篇：單章短文；點卡片直接閱讀
 *
 * 自動產生：<資料夾>/<id>/info.json、data/books.json，
 * 並在偵測到新章節 / 新作品時，於 data/announcements.json 最前面加一則公告。
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA = path.join(ROOT, "data");

const SOURCES = [
    { type: "novel", dir: "novels", label: "小說" },
    { type: "essay", dir: "essays", label: "散文" },
    { type: "short", dir: "shorts", label: "短篇" }
];
const RANK = { novel: 0, essay: 1, short: 2 };
const sourceOf = type => SOURCES.find(s => s.type === type);

const readJSON = (p, fallback) => {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return fallback; }
};
const writeJSON = (p, obj) =>
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
const byNumeric = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const readText = file => fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const typeParam = type => (type === "novel" ? "" : `&t=${type}`);

function today() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

// 章節標題 = .md 檔第一個「# 標題」
function chapterTitle(text, num) {
    const m = text.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : `第 ${parseInt(num, 10) || num} 章`;
}

// 內文行（排除標題與「...」分隔線）
function bodyLines(text) {
    return text.split("\n").map(l => l.trim())
        .filter(l => l !== "" && !/^#/.test(l) && l !== "...");
}
const countWords = text => bodyLines(text).join("").replace(/\s/g, "").length;
function excerpt(text, max) {
    const first = bodyLines(text)[0] || "";
    return first.length > max ? first.slice(0, max) + "…" : first;
}

function listChapterFiles(chDir) {
    if (!fs.existsSync(chDir)) return [];
    // 檔名以 _ 開頭的視為草稿，不會公開
    return fs.readdirSync(chDir)
        .filter(f => f.endsWith(".md") && !f.startsWith("_"))
        .sort(byNumeric);
}

function listWorkIds(dir) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) return [];
    return fs.readdirSync(full, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name);
}

function build() {
    fs.mkdirSync(DATA, { recursive: true });
    const oldBooks = readJSON(path.join(DATA, "books.json"), []);
    const announcements = readJSON(path.join(DATA, "announcements.json"), []);

    const books = [];
    const newLogs = [];

    for (const { type, dir: rootDir, label } of SOURCES) {
        for (const id of listWorkIds(rootDir)) {
            const dir = path.join(ROOT, rootDir, id);
            const metaPath = path.join(dir, "meta.json");
            if (!fs.existsSync(metaPath)) {
                console.warn(`略過 ${rootDir}/${id}：找不到 meta.json`);
                continue;
            }
            let meta;
            try {
                meta = JSON.parse(readText(metaPath));
            } catch (e) {
                // 格式錯誤時直接中止：不會覆蓋任何現有資料，Actions 會顯示紅色叉叉
                console.error(`✖ ${rootDir}/${id}/meta.json 格式錯誤：${e.message}`);
                console.error(`  常見原因：使用了中文引號 “ ” 、缺少逗號，或多了結尾逗號。請全部改成半形 " 。`);
                process.exit(1);
            }

            // 舊版曾把散文 / 短篇放在 novels/ 並用 type 區分，現在請移到各自的資料夾
            if (type === "novel" && meta.type && meta.type !== "novel") {
                const target = sourceOf(meta.type) ? sourceOf(meta.type).dir : "essays 或 shorts";
                console.error(`✖ novels/${id} 是${sourceOf(meta.type) ? sourceOf(meta.type).label : "非小說"}，請把整個資料夾移到 ${target}/ 底下。`);
                process.exit(1);
            }

            const oldInfo = readJSON(path.join(dir, "info.json"), null);
            const oldBook = oldBooks.find(b => b.id === id && (b.type || "novel") === type);
            const fallbackDate = oldBook ? oldBook.updatedAt : today();
            const oldChapters = new Map(((oldInfo && oldInfo.chapters) || []).map(c => [c.num, c]));

            let totalWords = 0;
            let firstText = "";
            const chDir = path.join(dir, "chapters");
            const chapters = listChapterFiles(chDir).map((f, i) => {
                const num = path.basename(f, ".md");
                const text = readText(path.join(chDir, f));
                if (i === 0) firstText = text;
                totalWords += countWords(text);
                const old = oldChapters.get(num);
                return {
                    num,
                    title: chapterTitle(text, num),
                    // 舊章節沿用原日期；全新的章節記為今天
                    date: old ? (old.date || fallbackDate) : today()
                };
            });

            const title = meta.title || (chapters[0] && chapters[0].title) || id;
            const summary = meta.summary || excerpt(firstText, 60);

            // ---- 公告 ----
            const added = chapters.filter(c => !oldChapters.has(c.num));
            if (added.length > 0) {
                const last = added[added.length - 1];
                let text;
                if (type === "novel") {
                    text = added.length === 1
                        ? `《${title}》${last.title} 更新。`
                        : `《${title}》新增 ${added.length} 章，最新：${last.title}。`;
                } else {
                    text = `${label}《${title}》發布。`;
                }
                const target = type === "novel" ? last : chapters[0];
                newLogs.push({
                    date: today(),
                    text,
                    link: `reader.html?id=${id}&ch=${target.num}${typeParam(type)}`
                });
            }

            const updatedAt = chapters.length > 0
                ? chapters.map(c => c.date).sort().pop()
                : (meta.updatedAt || fallbackDate);

            // ---- info.json ----
            const info = { id, type };
            if (type === "novel") info.code = meta.code;
            info.title = title;
            info.enTitle = meta.enTitle || "";
            if (type === "novel") info.status = meta.status;
            info.author = meta.author || "";
            info.summary = summary;
            info.chapters = chapters;
            writeJSON(path.join(dir, "info.json"), info);

            // ---- books.json 的一筆（作品集卡片）----
            const book = { id, type };
            if (type === "novel") {
                book.code = meta.code;
                book.status = meta.status;
            }
            book.title = title;
            book.enTitle = meta.enTitle || "";
            book.tags = meta.tags || [];
            book.summary = summary;
            book.updatedAt = updatedAt;
            book.wordCount = totalWords;
            book.firstChapter = chapters.length > 0 ? chapters[0].num : null;
            books.push(book);

            console.log(`✔ [${type}] ${rootDir}/${id}：${chapters.length} 章，${totalWords} 字，更新日 ${updatedAt}`);
        }
    }

    // 排序：小說（依編號）→ 散文（新到舊）→ 短篇（新到舊）
    books.sort((a, b) =>
        RANK[a.type] - RANK[b.type] ||
        (a.type === "novel"
            ? byNumeric(a.code || "", b.code || "")
            : b.updatedAt.localeCompare(a.updatedAt))
    );
    writeJSON(path.join(DATA, "books.json"), books);

    if (newLogs.length > 0) {
        writeJSON(path.join(DATA, "announcements.json"), [...newLogs, ...announcements]);
        newLogs.forEach(l => console.log(`＋ 新公告：${l.text}`));
    }
    console.log("完成。");
}

function findWork(id, type) {
    return SOURCES
        .filter(s => !type || s.type === type)
        .filter(s => fs.existsSync(path.join(ROOT, s.dir, id)));
}

function newChapter(id, type) {
    const found = findWork(id, type);
    if (found.length === 0) {
        console.error(`找不到作品 ${id}，請先執行：node build.js new ${id} [novel|essay|short]`);
        process.exit(1);
    }
    if (found.length > 1) {
        console.error(`${id} 同時存在於 ${found.map(f => f.dir).join("、")}，請指定類型：node build.js chapter ${id} <novel|essay|short>`);
        process.exit(1);
    }
    const chDir = path.join(ROOT, found[0].dir, id, "chapters");
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

function newWork(id, type) {
    type = type || "novel";
    const src = sourceOf(type);
    if (!src) {
        console.error(`類型只能是 novel、essay、short`);
        process.exit(1);
    }
    const dir = path.join(ROOT, src.dir, id);
    if (fs.existsSync(dir)) {
        console.error(`${src.dir}/${id} 已經存在`);
        process.exit(1);
    }
    fs.mkdirSync(path.join(dir, "chapters"), { recursive: true });

    if (type === "novel") {
        const count = listWorkIds("novels").filter(n => n !== id).length + 1;
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
    } else {
        writeJSON(path.join(dir, "meta.json"), {
            title: "作品名稱",
            tags: [],
            summary: ""
        });
        fs.writeFileSync(path.join(dir, "chapters", "001.md"), "# 作品名稱\n\n", "utf8");
    }
    console.log(`已建立 ${src.dir}/${id}/（${src.label}），請編輯後執行 node build.js`);
}

const [cmd, arg, arg2] = process.argv.slice(2);
if (cmd === "chapter" && arg) newChapter(arg, arg2);
else if (cmd === "new" && arg) newWork(arg, arg2);
else if (!cmd) build();
else console.log("用法：node build.js | node build.js chapter <id> [類型] | node build.js new <id> [novel|essay|short]");
