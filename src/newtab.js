function $(id) {
  return document.getElementById(id);
}

function formatGregorian(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}年${m}月${d}日`;
}

function formatGregorianISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekday(date = new Date()) {
  const list = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return list[date.getDay()];
}

function formatWeekdayFull(date = new Date()) {
  const list = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return list[date.getDay()];
}

let __uiLang = "en";
let __currentWallpaper = null;

function setBackground(item) {
  const bg = $("bg");
  const credit = $("bg-credit");

  if (item.kind === "gradient" && item.cssBackground) {
    bg.style.backgroundImage = item.cssBackground;
    bg.style.backgroundSize = "cover";
    bg.style.backgroundPosition = "center";
  } else if (item.imageUrl) {
    bg.style.backgroundImage = `url("${item.imageUrl}")`;
    bg.style.backgroundSize = "cover";
    bg.style.backgroundPosition = "center";
  }

  if (item.creditText) {
    const fullText = String(item.creditText);
    const showText = truncateWithEllipsis(fullText, 30);
    if (item.creditUrl) {
      credit.innerHTML = `<a href="${item.creditUrl}" target="_blank" rel="noopener" title="${escapeHtml(
        fullText
      )}">${escapeHtml(showText)}</a>`;
    } else {
      credit.textContent = showText;
      credit.title = fullText;
    }
    credit.hidden = false;
  } else {
    credit.hidden = true;
  }
}

function truncateWithEllipsis(s, maxChars) {
  const text = String(s || "").trim();
  const n = Number(maxChars);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (text.length <= n) return text;
  return text.slice(0, Math.max(0, n - 3)).trimEnd() + "...";
}

function pluralEn(n, singular, plural) {
  return n === 1 ? singular : plural;
}

function formatRelativeTime(ms, lang, now = Date.now()) {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return "";
  const zh = lang === "zh";
  const diff = now - t;
  if (diff < 0) return zh ? "刚刚" : "just now";

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (diff < minute) return zh ? "刚刚" : "just now";
  if (diff < hour) {
    const n = Math.floor(diff / minute);
    return zh ? `${n}分钟前` : `${n} ${pluralEn(n, "minute", "minutes")} ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return zh ? `${n}小时前` : `${n} ${pluralEn(n, "hour", "hours")} ago`;
  }
  if (diff < week) {
    const n = Math.floor(diff / day);
    return zh ? `${n}天前` : `${n} ${pluralEn(n, "day", "days")} ago`;
  }
  if (diff < month) {
    const n = Math.floor(diff / week);
    return zh ? `${n}周前` : `${n} ${pluralEn(n, "week", "weeks")} ago`;
  }
  if (diff < year) {
    const n = Math.floor(diff / month);
    return zh ? `${n}个月前` : `${n} ${pluralEn(n, "month", "months")} ago`;
  }
  const n = Math.floor(diff / year);
  return zh ? `${n}年前` : `${n} ${pluralEn(n, "year", "years")} ago`;
}

function resolveNewsDateMs(it) {
  const direct = Number(it && it.dateMs);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const News = window.CalendarExtNews;
  if (News && typeof News.parsePubDateToMs === "function") {
    const fromPub = News.parsePubDateToMs(it && it.pubDate);
    if (Number.isFinite(fromPub) && fromPub > 0) return fromPub;
    const fromDate = News.parsePubDateToMs(it && it.date);
    if (Number.isFinite(fromDate) && fromDate > 0) return fromDate;
  }
  return NaN;
}

function refreshNewsRelativeTimes() {
  const list = $("news-list");
  if (!list) return;
  list.querySelectorAll(".news-date[data-date-ms]").forEach((el) => {
    const ms = Number(el.dataset.dateMs);
    if (!Number.isFinite(ms) || ms <= 0) return;
    el.textContent = formatRelativeTime(ms, __uiLang);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderCalendar() {
  const d = new Date();
  const weekdayEl = $("today-weekday");
  if (weekdayEl) weekdayEl.textContent = "";
  
  const full = formatGregorian(d);
  const weekdayFull = formatWeekdayFull(d);
  const dayEl = $("today-day");
  if (dayEl) {
    dayEl.textContent = __uiLang === "zh" ? `${full} ${weekdayFull}` : `${formatGregorianISO(d)} ${weekdayFull}`;
  }

  try {
    const lunar = window.CalendarExtLunar.toLunar(d);
    const prettyMonth = prettifyLunarMonth(lunar.monthCn || "");
    const prettyDay = prettifyLunarDay(lunar.dayCn || "");
    const zodiacYear = lunar.zodiac ? `${lunar.zodiac}年` : "";
    const lunarEl = $("today-lunar");
    if (lunarEl) lunarEl.textContent = `农历 ${prettyMonth}${prettyDay} ${zodiacYear}`;
  } catch (e) {
    const lunarEl = $("today-lunar");
    if (lunarEl) lunarEl.textContent = "农历：—";
  }
}

function prettifyLunarMonth(monthCn) {
  const s = String(monthCn || "");
  const isLeap = s.includes("闰");
  const core = s.replace("闰", "");
  return (isLeap ? "闰" : "") + core;
}

function prettifyLunarDay(dayCn) {
  const s = String(dayCn || "").trim();
  if (!s) return s;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return numberToLunarDayCn(n);
  }
  return s;
}

function numberToLunarDayCn(n) {
  if (!Number.isFinite(n) || n < 1 || n > 30) return "";
  const num = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (n === 10) return "初十";
  if (n === 20) return "二十";
  if (n === 30) return "三十";
  const tens = Math.floor((n - 1) / 10);
  const ones = (n - 1) % 10;
  const prefix = ["初", "十", "廿"][tens] || "";
  return prefix + num[ones];
}

async function renderWeather() {
  const weatherEl = $("weather-info");
  if (!weatherEl) {
    console.log("[Weather] Element not found");
    return;
  }
  
  const Storage = window.CalendarExtStorage;
  const Weather = window.CalendarExtWeather;
  const settings = await Storage.getSettings();
  
  console.log("[Weather] Settings:", {
    weatherEnabled: settings.weatherEnabled,
    weatherLocMethod: settings.weatherLocMethod,
    weatherLat: settings.weatherLat,
    weatherLon: settings.weatherLon,
    weatherCity: settings.weatherCity
  });
  
  // Check if weather is enabled
  if (!settings.weatherEnabled) {
    console.log("[Weather] Disabled, skipping");
    weatherEl.hidden = true;
    return;
  }
  
  const uiLang = settings.uiLang || "en";
  
  // Show loading state
  weatherEl.textContent = "⏳";
  weatherEl.title = uiLang === "zh" ? "正在获取天气..." : "Loading weather...";
  weatherEl.hidden = false;
  
  console.log("[Weather] Fetching weather data...");
  
  try {
    const result = await Weather.getWeather(settings, uiLang);
    console.log("[Weather] Result:", result);
    
    if (!result.success) {
      // Show error icon with tooltip
      weatherEl.innerHTML = `<span class="weather-error" title="${escapeHtml(result.errorMessage || result.error)}">📍❓</span>`;
      return;
    }
    
    const w = result.weather;
    const tempStr = `${Math.round(w.temperature)}°C`;
    const precipStr = w.precipitation > 0 ? ` 💧${w.precipitation}mm` : "";
    
    // Air quality
    let airQualityHtml = "";
    let airQualityTitle = "";
    if (w.airQuality) {
      const aq = w.airQuality;
      const aqLabel = uiLang === "zh" ? "空气" : "AQI";
      airQualityHtml = `<span class="weather-airquality">${aqLabel}:${aq.icon}${aq.aqi}</span>`;
      airQualityTitle = ` | ${uiLang === "zh" ? "空气质量" : "Air Quality"}: ${aq.level} (AQI ${aq.aqi})`;
    }
    
    // Tomorrow's weather
    let tomorrowHtml = "";
    let tomorrowTitle = "";
    if (w.tomorrow) {
      const t = w.tomorrow;
      const tomorrowLabel = uiLang === "zh" ? "明" : "Tmr";
      tomorrowHtml = `<span class="weather-tomorrow">${tomorrowLabel}:${t.icon}${Math.round(t.tempMin)}~${Math.round(t.tempMax)}°</span>`;
      tomorrowTitle = ` | ${uiLang === "zh" ? "明天" : "Tomorrow"}: ${t.text} ${Math.round(t.tempMin)}~${Math.round(t.tempMax)}°C`;
    }
    
    // Build weather display
    weatherEl.innerHTML = `
      <span class="weather-icon" title="${escapeHtml(w.text)} (code:${w.weatherCode})">${w.icon}</span>
      <span class="weather-temp">${tempStr}</span>
      ${precipStr ? `<span class="weather-precip">${precipStr}</span>` : ""}
      ${airQualityHtml}
      ${tomorrowHtml}
    `;
    weatherEl.title = `${w.text} ${tempStr}${precipStr}${airQualityTitle}${tomorrowTitle}`;
    
  } catch (e) {
    console.error("Weather error:", e);
    weatherEl.innerHTML = `<span class="weather-error" title="${escapeHtml(String(e))}">⚠️</span>`;
  }
}

async function renderEvents() {
  const Storage = window.CalendarExtStorage;
  const I18n = window.CalendarExtI18n;
  const settings = await Storage.getSettings();
  const uiLang = settings.uiLang || "en";
  const dateKey = Storage.nowISODateKey();
  const cacheKey = `${dateKey}__${settings.onThisDaySource || "baike"}`;

  const status = $("onthisday-status");
  const list = $("onthisday-list");
  const source = $("onthisday-source");

  const cacheByDay = await Storage.getEventsCacheByDay();
  const cached = cacheByDay[cacheKey];
  
  // Cache TTL: 1 hour
  const EVENTS_CACHE_TTL = 60 * 60 * 1000;
  const isCacheValid = cached && 
    Array.isArray(cached.events) && 
    cached.events.length &&
    cached.cachedAt && 
    (Date.now() - cached.cachedAt < EVENTS_CACHE_TTL);

  if (isCacheValid) {
    // Use cached data, no network request
    if (cached.mm && cached.dd) {
      $("onthisday-date").textContent = `${cached.mm}/${cached.dd}`;
    }
    fillEvents(cached.events, settings.onThisDaySource);
    status.hidden = true;
    source.textContent = `${I18n.t(uiLang, "eventsSource")}：${cached.source || "缓存"}`;
    source.hidden = false;
    return; // Skip network request
  }
  
  // No valid cache, fetch from network
  status.hidden = false;
  status.textContent = "加载中…";
  list.hidden = true;
  source.hidden = true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const res = await window.CalendarExtOnThisDay.getOnThisDayEvents(settings, controller.signal);
    if (res.events && res.events.length) {
      $("onthisday-date").textContent = `${res.mm}/${res.dd}`;
      cacheByDay[cacheKey] = { events: res.events, source: res.source, cachedAt: Date.now(), mm: res.mm, dd: res.dd };
      await Storage.setEventsCacheByDay(cacheByDay);
      fillEvents(res.events, settings.onThisDaySource);
      status.hidden = true;
      source.textContent = `${I18n.t(uiLang, "eventsSource")}：${res.source}`;
      source.hidden = false;
      return;
    }
  } catch (e) {
    // ignore
  } finally {
    clearTimeout(timeout);
  }

  // Network failed and no cache
  status.hidden = false;
  status.textContent = I18n.t(uiLang, "eventsUnavailable");
  list.hidden = true;
  source.hidden = true;

  function fillEvents(events, sourceType) {
    list.innerHTML = "";
    const sorted = events
      .slice()
      .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))
      .slice(0, 3);
    const maxChars = sourceType === "wikipedia" ? 60 : 30;
    for (const ev of sorted) {
      const li = document.createElement("li");
      const year = ev.year ? `<span class="events-year">${escapeHtml(ev.year)}</span>` : "";
      const fullText = String(ev.text || "");
      const showText = truncateWithEllipsis(fullText, maxChars);
      if (ev.url) {
        li.innerHTML = `${year}<a href="${ev.url}" target="_blank" rel="noopener" title="${escapeHtml(
          fullText
        )}">${escapeHtml(showText)}</a>`;
      } else {
        li.innerHTML = `${year}<span title="${escapeHtml(fullText)}">${escapeHtml(showText)}</span>`;
      }
      list.appendChild(li);
    }
    list.hidden = false;
  }
}

// Updated renderNews to support multiple feeds and tabs
async function renderNews() {
  const Storage = window.CalendarExtStorage;
  const I18n = window.CalendarExtI18n;
  const settings = await Storage.getSettings();
  const uiLang = settings.uiLang || "en";
  const feeds = (settings.rssFeeds || [])
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        const url = item.trim();
        return url ? { title: "", url } : null;
      }
      if (typeof item === "object") {
        const url = String(item.url || "").trim();
        const title = String(item.title || "").trim();
        return url ? { title, url } : null;
      }
      return null;
    })
    .filter(Boolean);
  const timeZone = settings.timeZone || "Asia/Shanghai";
  const dateKey = Storage.nowISODateKey();

  const tabsContainer = $("news-tabs");
  const status = $("news-status");
  const list = $("news-list");
  const source = $("news-source");
  
  if (!feeds.length) {
     status.textContent = "No RSS feeds configured";
     status.hidden = false;
     return;
  }

  // 1. Setup UI for tabs
  tabsContainer.innerHTML = "";
  let activeIndex = 0;
  let allData = []; // Will be populated after fetch
  
  // Create tab elements
  feeds.forEach((feed, idx) => {
      const url = feed.url;
      const el = document.createElement("div");
      el.className = "news-tab-item";
      // Temporary name until loaded
      let shortName = feed.title || "";
      try {
        if (!shortName) {
          shortName = new URL(url).hostname.replace("www.", "").split(".")[0];
        }
      } catch(e) {
        if (!shortName) shortName = "RSS";
      }
      // Special casing common ones for nicer names
      if (shortName === "chinanews") shortName = "中新网";
      if (shortName === "36kr") shortName = "36Kr";
      if (shortName === "voachinese") shortName = "VOA";
      
      el.textContent = shortName;
      el.dataset.index = idx;
      el.dataset.url = url;
      
      // Hover event to switch tab (only if data is loaded)
      el.addEventListener("mouseenter", () => {
          if (allData.length > 0) {
              switchTab(idx);
          }
      });
      
      tabsContainer.appendChild(el);
  });

  // 2. Fetch logic (Parallel)
  status.textContent = I18n.t(uiLang, "loading");
  status.hidden = false;
  
  // Try to load from cache first
  const cacheByDay = await Storage.getNewsCacheByDay();
  if (!cacheByDay[dateKey]) cacheByDay[dateKey] = {};
  
  // Helper to get feed data (cache -> network)
  const CACHE_TTL = 20 * 60 * 1000; // 20 minutes
  async function getFeedData(url) {
      // Check memory/storage cache (20 min TTL)
      const cached = cacheByDay[dateKey] && cacheByDay[dateKey][url];
      const isValid = cached && cached.items && cached.items.length &&
                      cached.cachedAt && (Date.now() - cached.cachedAt < CACHE_TTL);
      if (isValid) {
          return { ...cached, fromCache: true };
      }
      try {
          const res = await window.CalendarExtNews.getRssNews({ url, limit: 30, timeZone });
          if (res.success) {
              // update cache structure: dateKey -> url -> data
              cacheByDay[dateKey][url] = { 
                  items: res.items, 
                  sourceName: res.sourceName, 
                  sourceUrl: res.sourceUrl, 
                  cachedAt: Date.now() 
              };
              await Storage.setNewsCacheByDay(cacheByDay);
              return res;
          } else {
             console.error("RSS Fetch Failed:", res.error);
             return { items: [], sourceName: "Error", error: res.error, sourceUrl: url };
          }
      } catch(e) { 
          console.error(e); 
          return { items: [], sourceName: "Error", error: String(e), sourceUrl: url };
      }
  }

  // Use allSettled to ensure we don't block everything if one fails
  const feedPromises = feeds.map((feed) => getFeedData(feed.url));
  
  // Wait for all to load
  const results = await Promise.allSettled(feedPromises);
  allData = results.map(r => r.status === 'fulfilled' ? r.value : { items: [], sourceName: "Error" });
  
  status.hidden = true;

  function switchTab(idx) {
      activeIndex = idx;
      // update active class
      Array.from(tabsContainer.children).forEach((el, i) => {
          if (i === idx) el.classList.add("active");
          else el.classList.remove("active");
      });
      
      const data = allData[idx];
      if (!data || !data.items || !data.items.length) {
          list.innerHTML = `<li><span class='muted'>${data && data.error ? "Load failed" : "No news available"}</span></li>`;
          list.hidden = false;
          source.hidden = true;
          return;
      }
      
      fillNews(data.items);
      
      // Update source link
      source.innerHTML = `${I18n.t(uiLang, "eventsSource")}：<a href="${data.sourceUrl}" target="_blank" rel="noopener">${escapeHtml(data.sourceName)}</a>`;
      source.hidden = false;
  }

  function fillNews(items) {
    list.innerHTML = "";

    for (const it of items || []) {
      const li = document.createElement("li");
      const fullTitle = String(it.title || "");
      const link = it.link || "";
      const dateMs = resolveNewsDateMs(it);
      const absolute = it.date || "";
      const relative = Number.isFinite(dateMs) ? formatRelativeTime(dateMs, uiLang) : absolute;
      const dateAttr = Number.isFinite(dateMs)
        ? ` data-date-ms="${dateMs}" title="${escapeHtml(absolute)}"`
        : (absolute ? ` title="${escapeHtml(absolute)}"` : "");
      const dateHtml = relative
        ? `<span class="news-date muted"${dateAttr}>${escapeHtml(relative)}</span>`
        : "";
      const titleHtml = link
        ? `<a href="${link}" target="_blank" rel="noopener" title="${escapeHtml(fullTitle)}">${escapeHtml(fullTitle)}</a>`
        : `<span class="news-title" title="${escapeHtml(fullTitle)}">${escapeHtml(fullTitle)}</span>`;

      li.innerHTML = `<div class="news-item">${titleHtml}${dateHtml}</div>`;
      list.appendChild(li);
    }
    list.hidden = false;

    requestAnimationFrame(() => {
      let guard = 0;
      while (list.scrollHeight > list.clientHeight && list.lastElementChild && guard < 200) {
        list.removeChild(list.lastElementChild);
        guard++;
      }
    });
  }

  // Initial render
  switchTab(0);
}

async function renderWallpaper({ forceRefresh = false } = {}) {
  const Wallpaper = window.CalendarExtWallpaper;
  const item = await Wallpaper.getWallpaper({ forceRefresh });
  setBackground(item);
  __currentWallpaper = item;
  return item;
}

async function main() {
  try {
    const settings = await window.CalendarExtStorage.getSettings();
    const uiLang = settings.uiLang || "en";
    __uiLang = uiLang;
    
    const labelOnThisDay = $("label-onthisday");
    if (labelOnThisDay) labelOnThisDay.textContent = window.CalendarExtI18n.t(uiLang, "onThisDay");
    
    const settingsLabel = window.CalendarExtI18n.t(uiLang, "settings");
    const btnSettings = $("btn-settings");
    if (btnSettings) {
      btnSettings.textContent = truncateWithEllipsis(settingsLabel, 30);
      btnSettings.title = settingsLabel;
      btnSettings.addEventListener("click", () => {
        if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open("options.html", "_blank");
        }
      });
    }

    const refreshLabel = window.CalendarExtI18n.t(uiLang, "refreshWallpaper");
    const btnRefresh = $("btn-refresh-wallpaper");
    if (btnRefresh) {
      btnRefresh.textContent = truncateWithEllipsis(refreshLabel, 30);
      btnRefresh.title = refreshLabel;
      btnRefresh.addEventListener("click", async () => {
        btnRefresh.disabled = true;
        try {
          await renderWallpaper({ forceRefresh: true });
        } finally {
          btnRefresh.disabled = false;
        }
      });
    }
    
    const newsStatus = $("news-status");
    if (newsStatus) newsStatus.textContent = window.CalendarExtI18n.t(uiLang, "loading");
    
    const onthisdayStatus = $("onthisday-status");
    if (onthisdayStatus) onthisdayStatus.textContent = window.CalendarExtI18n.t(uiLang, "loading");
  } catch (e) {
    console.error(e);
  }

  renderCalendar();
  setInterval(renderCalendar, 60 * 1000);
  setInterval(refreshNewsRelativeTimes, 60 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshNewsRelativeTimes();
  });
  window.addEventListener("focus", refreshNewsRelativeTimes);

  // Render weather (non-blocking, runs in background)
  renderWeather().catch(e => console.error("Weather render error:", e));

  await Promise.all([renderNews(), renderEvents(), renderWallpaper()]);

  const credit = $("bg-credit");
  if (credit) {
    credit.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      try {
        if (__currentWallpaper) {
          await window.CalendarExtWallpaper.blockCurrentWallpaper(__currentWallpaper);
          await renderWallpaper({ forceRefresh: true });
        }
      } catch (err) {
        // ignore
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  main().catch((e) => {
    console.error("Main error:", e);
  });
});
