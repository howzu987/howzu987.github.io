document.addEventListener("DOMContentLoaded", loadStats);

function setStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

async function loadStats() {
    try {
        const res = await fetch("data/books.json");
        if (!res.ok) throw new Error("books.json 讀取失敗");
        const books = await res.json();

        // 作品數
        setStat("stat-works", books.length);

        // 最近更新日（日期格式 YYYY.MM.DD，可直接用字串排序）
        const dates = books
            .map(b => b.updatedAt)
            .filter(d => !isNaN(Date.parse(String(d).replace(/\./g, "-"))))
            .sort();
        setStat("stat-updated", dates.length ? dates[dates.length - 1] : "--");

        // 章節總數：逐本讀取 info.json 後加總
        const infos = await Promise.all(
            books.map(b =>
                fetch(`novels/${b.id}/info.json`)
                    .then(r => (r.ok ? r.json() : null))
                    .catch(() => null)
            )
        );
        const total = infos.reduce(
            (sum, info) => sum + (info && info.chapters ? info.chapters.length : 0),
            0
        );
        setStat("stat-chapters", total);

    } catch (error) {
        console.error(error);
        ["stat-works", "stat-chapters", "stat-updated"].forEach(id => setStat(id, "--"));
    }
}