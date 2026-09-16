function stripCData(s) {
  const t = String(s || "");
  return t.replace(/^<!\[CDATA\[\s*/i, "").replace(/\s*\]\]>$/i, "").trim();
}

function safeText(node) {
  return node && node.textContent ? node.textContent.trim() : "";
}

async function fetchRss(url, signal) {
  const u = String(url || "").trim();
  if (!u) throw new Error("rss url missing");
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7"
    },
    signal
  });
  if (!res.ok) throw new Error(`rss http ${res.status}`);
  const xml = await res.text();
  return xml;
}

function parseRss(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const out = [];
  
  // Try RSS 2.0 format first
  let channelTitle = stripCData(safeText(doc.getElementsByTagName("channel")[0]?.getElementsByTagName("title")[0]));
  let items = Array.from(doc.getElementsByTagName("item"));
  
  // Fallback to Atom format if no RSS items found
  if (!items.length) {
    const feed = doc.getElementsByTagName("feed")[0];
    if (feed) {
      channelTitle = stripCData(safeText(feed.getElementsByTagName("title")[0]));
      items = Array.from(doc.getElementsByTagName("entry"));
    }
  }
  
  for (const it of items.slice(0, 30)) {
    const title = stripCData(safeText(it.getElementsByTagName("title")[0]));
    
    // RSS uses <link>, Atom uses <link href="...">
    let link = stripCData(safeText(it.getElementsByTagName("link")[0]));
    if (!link) {
      // Atom format: <link href="..."/>
      const linkEl = it.getElementsByTagName("link")[0];
      if (linkEl) link = linkEl.getAttribute("href") || "";
    }
    link = link.replace(/^https:\/\/www\.chinanews\.com\.cnhttps:\/\/www\.chinanews\.com\.cn/i, "https://www.chinanews.com.cn");
    
    // RSS uses <pubDate>, Atom uses <updated> or <published>
    let pubDate = stripCData(safeText(it.getElementsByTagName("pubDate")[0]));
    if (!pubDate) {
      pubDate = stripCData(safeText(it.getElementsByTagName("updated")[0])) ||
                stripCData(safeText(it.getElementsByTagName("published")[0]));
    }
    
    if (!title || !link) continue;
    out.push({ title, link, pubDate });
  }
  return { items: out, channelTitle };
}

function parsePubDateToMs(pubDate) {
  const s = String(pubDate || "").trim();
  if (!s) return NaN;

  const direct = Date.parse(s);
  if (!Number.isNaN(direct)) return direct;

  // e.g. "2025-12-30 17:26:06 +0800" or "2025-12-30 17:26:06"
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s*([+-])(\d{2}):?(\d{2}))?/);
  if (m) {
    const tz = m[5] ? `${m[5]}${m[6]}:${m[7] || "00"}` : "";
    const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}${tz}`);
    if (!Number.isNaN(t)) return t;
  }

  // Standard RSS 2.0 (e.g. "Fri, 26 Dec 2025 19:59:00 +0800")
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}:\d{2}:\d{2})(?:\s*([+-]\d{2}):?(\d{2})|[A-Z]{1,5})?/);
  if (m) {
    const monthMap = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const mm = monthMap[m[2].toLowerCase()];
    if (mm) {
      const day = m[1].padStart(2, "0");
      let tz = "";
      if (m[5] && m[6] != null) tz = `${m[5]}:${m[6]}`;
      else if (m[5] && /^[+-]\d{2}$/.test(m[5])) tz = `${m[5]}:00`;
      const t = Date.parse(`${m[3]}-${mm}-${day}T${m[4]}${tz}`);
      if (!Number.isNaN(t)) return t;
    }
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
}

function formatPubDate(pubDate, timeZone) {
  const s = String(pubDate || "").trim();
  if (!s) return "";

  const ms = parsePubDateToMs(s);
  if (Number.isNaN(ms)) return s;

  try {
    const d = new Date(ms);
    const opts = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    };
    if (timeZone) opts.timeZone = timeZone;
    const parts = new Intl.DateTimeFormat("sv-SE", opts).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  } catch (e) {
    return s;
  }
}

async function getRssNews({ url, limit = 50, timeZone } = {}, signal) {
  try {
    const xml = await fetchRss(url, signal);
    const parsed = parseRss(xml);
    const items = (parsed.items || [])
      .map((x) => {
        const dateMs = parsePubDateToMs(x.pubDate);
        return {
          ...x,
          dateMs: Number.isFinite(dateMs) ? dateMs : null,
          date: x.pubDate ? formatPubDate(x.pubDate, timeZone) : ""
        };
      })
      .slice(0, limit);
    return {
      items,
      sourceName: parsed.channelTitle || "RSS",
      sourceUrl: url,
      success: true
    };
  } catch (err) {
    return {
        items: [],
        sourceName: "Load Error",
        sourceUrl: url,
        success: false,
        error: String(err)
    };
  }
}

async function getAllRssNews({ urls = [], limit = 50, timeZone } = {}, signal) {
  // Parallel fetch all
  const tasks = urls.map(url => 
    getRssNews({ url, limit, timeZone }, signal)
  );
  
  const results = await Promise.all(tasks);
  return results;
}

window.CalendarExtNews = {
  getRssNews,
  getAllRssNews,
  parsePubDateToMs
};
