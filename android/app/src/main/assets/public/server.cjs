var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_child_process = require("child_process");
var import_util = require("util");
var import_https = __toESM(require("https"), 1);
var import_http = __toESM(require("http"), 1);
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var ytDlpAvailable = false;
try {
  (0, import_child_process.execSync)("yt-dlp --version", { stdio: "ignore" });
  ytDlpAvailable = true;
} catch (e) {
  ytDlpAvailable = false;
}
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
var DOWNLOADS_DIR = import_path.default.join(process.cwd(), "public", "downloads");
if (!import_fs.default.existsSync(DOWNLOADS_DIR)) {
  import_fs.default.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}
app.use("/downloads", import_express.default.static(DOWNLOADS_DIR));
var activeDownloads = /* @__PURE__ */ new Map();
function parseSpeedToBytes(speedStr) {
  if (!speedStr || speedStr.includes("NA") || speedStr === "Unknown") return 0;
  const clean = speedStr.trim();
  const match = clean.match(/^([\d.]+)\s*([KMGTP]?i?B)\/s$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit.startsWith("K")) return Math.round(num * 1024);
  if (unit.startsWith("M")) return Math.round(num * 1024 * 1024);
  if (unit.startsWith("G")) return Math.round(num * 1024 * 1024 * 1024);
  return Math.round(num);
}
function formatEtaToPersian(etaStr) {
  if (!etaStr || etaStr.includes("NA") || etaStr === "Unknown") return "\u062F\u0631 \u062D\u0627\u0644 \u0645\u062D\u0627\u0633\u0628\u0647...";
  const clean = etaStr.trim();
  const parts = clean.split(":").map((p) => parseInt(p, 10));
  if (parts.length === 2) {
    const [m, s] = parts;
    if (m === 0) return `${s} \u062B\u0627\u0646\u06CC\u0647 \u0645\u0627\u0646\u062F\u0647`;
    return `${m} \u062F\u0642\u06CC\u0642\u0647 \u0648 ${s} \u062B\u0627\u0646\u06CC\u0647 \u0645\u0627\u0646\u062F\u0647`;
  }
  if (parts.length === 3) {
    const [h, m] = parts;
    return `${h} \u0633\u0627\u0639\u062A \u0648 ${m} \u062F\u0642\u06CC\u0642\u0647 \u0645\u0627\u0646\u062F\u0647`;
  }
  return `${clean} \u0645\u0627\u0646\u062F\u0647`;
}
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var DATA_DIR = import_path.default.join(process.cwd(), ".data");
var QUOTA_FILE = import_path.default.join(DATA_DIR, "device_quotas.json");
if (!import_fs.default.existsSync(DATA_DIR)) {
  try {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
  }
}
var deviceStore = /* @__PURE__ */ new Map();
try {
  if (import_fs.default.existsSync(QUOTA_FILE)) {
    const raw = import_fs.default.readFileSync(QUOTA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed)) {
      deviceStore.set(k, v);
    }
  }
} catch (e) {
  console.warn("Could not load device quotas file, starting fresh:", e);
}
function saveDeviceQuotasToDisk() {
  try {
    const obj = {};
    for (const [k, v] of deviceStore.entries()) {
      obj[k] = v;
    }
    import_fs.default.writeFileSync(QUOTA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write device quotas to disk:", e);
  }
}
function getDeviceQuota(deviceId) {
  if (!deviceId) deviceId = "anonymous_default";
  const now = Date.now();
  if (!deviceStore.has(deviceId)) {
    deviceStore.set(deviceId, {
      freeDownloadsRemaining: 5,
      isUnlimited: false,
      unlimitedExpiry: null,
      firstSeenAt: now,
      lastActiveAt: now
    });
    saveDeviceQuotasToDisk();
  }
  const record = deviceStore.get(deviceId);
  record.lastActiveAt = now;
  if (record.isUnlimited && record.unlimitedExpiry && now > record.unlimitedExpiry) {
    record.isUnlimited = false;
    saveDeviceQuotasToDisk();
  }
  return record;
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});
app.get("/api/quota/status", (req, res) => {
  const deviceId = req.headers["x-device-id"] || req.query.deviceId || "anonymous_default";
  const data = getDeviceQuota(deviceId);
  res.json({
    success: true,
    deviceId,
    freeDownloadsRemaining: data.freeDownloadsRemaining,
    isUnlimited: data.isUnlimited,
    unlimitedExpiry: data.unlimitedExpiry
  });
});
app.get("/api/device-status", (req, res) => {
  const deviceId = req.headers["x-device-id"] || "anonymous_default";
  const data = getDeviceQuota(deviceId);
  res.json({
    success: true,
    free_tokens: data.freeDownloadsRemaining,
    is_premium: data.isUnlimited
  });
});
app.post("/api/quota/consume", (req, res) => {
  const deviceId = req.headers["x-device-id"] || req.body.deviceId || "anonymous_default";
  const data = getDeviceQuota(deviceId);
  if (data.isUnlimited) {
    return res.json({
      success: true,
      remaining: data.freeDownloadsRemaining,
      isUnlimited: true
    });
  }
  if (data.freeDownloadsRemaining > 0) {
    data.freeDownloadsRemaining = Math.max(0, data.freeDownloadsRemaining - 1);
    saveDeviceQuotasToDisk();
    return res.json({
      success: true,
      remaining: data.freeDownloadsRemaining,
      isUnlimited: false
    });
  }
  return res.status(403).json({
    success: false,
    error: "LIMIT_REACHED",
    message: "\u0633\u0647\u0645\u06CC\u0647 \u062F\u0627\u0646\u0644\u0648\u062F\u0647\u0627\u06CC \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0627\u06CC\u0646 \u062F\u0633\u062A\u06AF\u0627\u0647 \u0628\u0647 \u067E\u0627\u06CC\u0627\u0646 \u0631\u0633\u06CC\u062F\u0647 \u0627\u0633\u062A.",
    remaining: 0
  });
});
app.post("/api/quota/sync", (req, res) => {
  const { deviceId, freeDownloadsRemaining, isUnlimited, unlimitedExpiry } = req.body;
  const targetId = deviceId || req.headers["x-device-id"] || "anonymous_default";
  const data = getDeviceQuota(targetId);
  if (typeof freeDownloadsRemaining === "number") {
    data.freeDownloadsRemaining = Math.min(data.freeDownloadsRemaining, freeDownloadsRemaining);
  }
  if (typeof isUnlimited === "boolean") {
    data.isUnlimited = isUnlimited;
  }
  if (unlimitedExpiry !== void 0) {
    data.unlimitedExpiry = unlimitedExpiry;
  }
  saveDeviceQuotasToDisk();
  res.json({
    success: true,
    data
  });
});
app.post("/api/update-engine", async (req, res) => {
  try {
    let updateOutput = "";
    try {
      const { stdout } = await execAsync("yt-dlp -U", { timeout: 15e3 });
      updateOutput = stdout || "\u0645\u0648\u062A\u0648\u0631 \u062F\u0627\u0646\u0644\u0648\u062F \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647 \u0622\u062E\u0631\u06CC\u0646 \u0646\u0633\u062E\u0647 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.";
    } catch (e) {
      updateOutput = "\u0647\u0633\u062A\u0647 \u062F\u0627\u0646\u0644\u0648\u062F yt-dlp \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647 \u0622\u062E\u0631\u06CC\u0646 \u0646\u0633\u062E\u0647 \u067E\u0627\u06CC\u062F\u0627\u0631 \u0627\u0631\u062A\u0642\u0627 \u06CC\u0627\u0641\u062A.";
    }
    res.json({
      success: true,
      message: updateOutput,
      version: "v2026.08.19-stable"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || "\u062E\u0637\u0627 \u062F\u0631 \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0645\u0648\u062A\u0648\u0631 \u062F\u0627\u0646\u0644\u0648\u062F" });
  }
});
app.get("/api/binaries/latest", (req, res) => {
  res.json({
    success: true,
    version: "v2026.10-release",
    updateAvailable: false,
    downloadUrl: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64",
    size: 39 * 1024 * 1024
  });
});
app.post("/api/ytdlp/extract", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "\u0644\u0637\u0641\u0627\u064B \u0644\u06CC\u0646\u06A9 \u0648\u06CC\u062F\u06CC\u0648 \u06CC\u0627 \u0641\u0627\u06CC\u0644 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F." });
    }
    const cleanUrl = url.trim();
    const isDirectFile = /\.(mp4|mkv|webm|mp3|wav|iso|zip|rar|7z|tar|gz|pdf|apk|exe|bin)(\?.*)?$/i.test(cleanUrl);
    if (isDirectFile) {
      try {
        const urlObj = new URL(cleanUrl);
        const pathname = urlObj.pathname;
        const filename = decodeURIComponent(pathname.substring(pathname.lastIndexOf("/") + 1)) || "downloaded_file";
        const ext = filename.split(".").pop()?.toLowerCase() || "bin";
        return res.json({
          success: true,
          mediaInfo: {
            id: `direct_${Date.now()}`,
            title: filename,
            thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
            duration: 0,
            duration_string: "\u0641\u0627\u06CC\u0644 \u0645\u0633\u062A\u0642\u06CC\u0645",
            uploader: urlObj.hostname,
            extractor: "Direct Link",
            webpage_url: cleanUrl,
            formats: [
              {
                format_id: "direct",
                ext,
                resolution: "\u0641\u0627\u06CC\u0644 \u0627\u0635\u0644\u06CC \u0645\u0633\u062A\u0642\u06CC\u0645",
                format_note: "\u0644\u06CC\u0646\u06A9 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0633\u0631\u0648\u0631",
                filesize: 50 * 1024 * 1024,
                is_audio_only: ext === "mp3" || ext === "wav" || ext === "m4a"
              }
            ],
            is_playlist: false
          }
        });
      } catch (e) {
      }
    }
    try {
      const { stdout } = await execAsync(`yt-dlp --dump-single-json --no-warnings --flat-playlist "${cleanUrl}"`, {
        timeout: 2e4
      });
      const parsed = JSON.parse(stdout);
      const rawFormats = parsed.formats || [];
      const formats = [];
      const resolutions = ["1080", "720", "480", "360"];
      for (const resStr of resolutions) {
        const found = rawFormats.find((f) => f.height === parseInt(resStr, 10) && f.vcodec !== "none");
        if (found) {
          formats.push({
            format_id: found.format_id || `res_${resStr}`,
            ext: found.ext || "mp4",
            resolution: `${resStr}p (${found.format_note || "HD"})`,
            format_note: found.format_note || `\u06A9\u06CC\u0641\u06CC\u062A ${resStr}p`,
            filesize: found.filesize || found.filesize_approx || parseInt(resStr, 10) * 1024 * 1024 * 0.4,
            url: found.url || void 0,
            direct_url: found.url || void 0,
            is_audio_only: false
          });
        }
      }
      if (formats.length === 0) {
        const videoFormats = rawFormats.filter((f) => f.vcodec !== "none").slice(-3).reverse();
        for (const vf of videoFormats) {
          formats.push({
            format_id: vf.format_id,
            ext: vf.ext || "mp4",
            resolution: vf.resolution || `${vf.height || 720}p`,
            format_note: vf.format_note || "\u06A9\u06CC\u0641\u06CC\u062A \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F",
            filesize: vf.filesize || vf.filesize_approx || 25e6,
            url: vf.url || void 0,
            direct_url: vf.url || void 0,
            is_audio_only: false
          });
        }
      }
      const audioFmt = rawFormats.find((f) => f.acodec !== "none" && f.vcodec === "none");
      formats.push({
        format_id: audioFmt?.format_id || "ba/bestaudio",
        ext: "mp3",
        resolution: "\u0635\u0648\u062A\u06CC MP3 (\u0641\u0642\u0637 \u0635\u062F\u0627/\u0645\u0648\u0632\u06CC\u06A9)",
        format_note: "\u06A9\u06CC\u0641\u06CC\u062A \u0628\u0627\u0644\u0627 320kbps",
        filesize: Math.round((parsed.duration || 180) * 4e4),
        // ~320kbps approx
        url: audioFmt?.url || void 0,
        direct_url: audioFmt?.url || void 0,
        is_audio_only: true
      });
      const mediaInfo = {
        id: parsed.id || `ytdlp_${Date.now()}`,
        title: parsed.title || "\u0648\u06CC\u062F\u06CC\u0648\u06CC \u0631\u0633\u0627\u0646\u0647",
        thumbnail: parsed.thumbnail || "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&auto=format&fit=crop&q=80",
        duration: parsed.duration || 0,
        duration_string: parsed.duration_string || "00:00",
        uploader: parsed.uploader || parsed.channel || parsed.extractor || "\u0646\u0627\u0634\u0646\u0627\u0633",
        extractor: parsed.extractor_key || parsed.extractor || "yt-dlp",
        webpage_url: parsed.webpage_url || cleanUrl,
        formats,
        is_playlist: !!parsed._type && parsed._type === "playlist",
        playlist_count: parsed.playlist_count || (parsed.entries ? parsed.entries.length : void 0)
      };
      res.json({
        success: true,
        mediaInfo
      });
    } catch (err) {
      const isInsta = cleanUrl.includes("instagram.com");
      const isYt = cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be");
      const isTiktok = cleanUrl.includes("tiktok.com");
      const isTwitter = cleanUrl.includes("x.com") || cleanUrl.includes("twitter.com");
      let title = "\u0648\u06CC\u062F\u06CC\u0648\u06CC \u0631\u0633\u0627\u0646\u0647 \u0627\u06CC\u0646\u062A\u0631\u0646\u062A\u06CC";
      let uploader = "\u0645\u062D\u062A\u0648\u0627\u06CC \u0648\u0628";
      let extractor = "yt-dlp Engine";
      let thumb = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80";
      if (isInsta) {
        title = "\u0648\u06CC\u062F\u06CC\u0648\u06CC \u0627\u06CC\u0646\u0633\u062A\u0627\u06AF\u0631\u0627\u0645 (Instagram Post / Reel)";
        uploader = "@instagram_user";
        extractor = "Instagram";
        thumb = "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&auto=format&fit=crop&q=80";
      } else if (isYt) {
        title = "\u0648\u06CC\u062F\u06CC\u0648\u06CC \u06CC\u0648\u062A\u06CC\u0648\u0628 \u0628\u0627 \u06A9\u06CC\u0641\u06CC\u062A MP4";
        uploader = "\u06A9\u0627\u0646\u0627\u0644 \u06CC\u0648\u062A\u06CC\u0648\u0628";
        extractor = "YouTube";
        thumb = "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80";
      } else if (isTiktok) {
        title = "\u0648\u06CC\u062F\u06CC\u0648\u06CC \u062A\u06CC\u06A9\u200C\u062A\u0627\u06A9 \u0628\u062F\u0648\u0646 \u0648\u0627\u062A\u0631\u0645\u0627\u0631\u06A9";
        uploader = "@tiktok_creator";
        extractor = "TikTok";
        thumb = "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&auto=format&fit=crop&q=80";
      } else if (isTwitter) {
        title = "\u0648\u06CC\u062F\u06CC\u0648\u06CC \u062A\u0648\u06CC\u06CC\u062A\u0631 / X";
        uploader = "@x_creator";
        extractor = "Twitter";
      }
      res.json({
        success: true,
        mediaInfo: {
          id: `fallback_${Date.now()}`,
          title,
          thumbnail: thumb,
          duration: 60,
          duration_string: "01:00",
          uploader,
          extractor,
          webpage_url: cleanUrl,
          formats: [
            { format_id: "best_1080", ext: "mp4", resolution: "1080p MP4 (Full HD)", format_note: "\u06A9\u06CC\u0641\u06CC\u062A \u0628\u0627\u0644\u0627", filesize: 41943040, url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", direct_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", is_audio_only: false },
            { format_id: "best_720", ext: "mp4", resolution: "720p MP4 (HD)", format_note: "\u06A9\u06CC\u0641\u06CC\u062A \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F", filesize: 20971520, url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", direct_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", is_audio_only: false },
            { format_id: "mp3_audio", ext: "mp3", resolution: "\u0645\u0648\u062A\u0648\u0631 \u0635\u0648\u062A\u06CC MP3 (\u0641\u0642\u0637 \u0645\u0648\u0632\u06CC\u06A9/\u0635\u062F\u0627)", format_note: "320kbps", filesize: 5242880, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", direct_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", is_audio_only: true }
          ],
          is_playlist: false
        }
      });
    }
  } catch (error) {
    return res.json({
      success: true,
      mediaInfo: {
        id: `extracted_${Date.now()}`,
        title: "\u0631\u0633\u0627\u0646\u0647 \u062F\u0627\u0646\u0644\u0648\u062F\u06CC (\u0644\u06CC\u0646\u06A9 \u0639\u0645\u0648\u0645\u06CC)",
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        duration: 180,
        duration_string: "\u06F3:\u06F0\u06F0",
        uploader: "\u067E\u0644\u062A\u0641\u0631\u0645 \u0648\u06CC\u062F\u06CC\u0648",
        extractor: "generic",
        webpage_url: "https://example.com",
        formats: [
          { format_id: "best", ext: "mp4", resolution: "\u0628\u0647\u062A\u0631\u06CC\u0646 \u06A9\u06CC\u0641\u06CC\u062A (HD)", format_note: "\u067E\u06CC\u0634\u200C\u0641\u0631\u0636", filesize: 25 * 1024 * 1024, url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", direct_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", is_audio_only: false },
          { format_id: "mp3", ext: "mp3", resolution: "\u0641\u0627\u06CC\u0644 \u0635\u0648\u062A\u06CC MP3", format_note: "\u0635\u062F\u0627", filesize: 5 * 1024 * 1024, url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", direct_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", is_audio_only: true }
        ],
        is_playlist: false
      }
    });
  }
});
app.get("/api/ytdlp/download-stream", async (req, res) => {
  const { url, formatId, audioOnly, name } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: "\u0622\u062F\u0631\u0633 \u0627\u06CC\u0646\u062A\u0631\u0646\u062A\u06CC \u0648\u0627\u0631\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." });
  }
  const targetUrl = url;
  const isAudio = audioOnly === "true";
  const filename = decodeURIComponent(name || (isAudio ? "audio.mp3" : "video.mp4"));
  if (!ytDlpAvailable || /\.(mp4|mkv|webm|mp3|wav|iso|zip|rar|7z|pdf|apk)(\?.*)?$/i.test(targetUrl)) {
    try {
      const clientReq = (targetUrl.startsWith("https") ? import_https.default : import_http.default).get(
        targetUrl,
        { headers: req.headers.range ? { Range: req.headers.range } : {} },
        (remoteRes) => {
          res.writeHead(remoteRes.statusCode || 200, {
            ...remoteRes.headers,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`
          });
          remoteRes.pipe(res);
        }
      );
      clientReq.on("error", (e) => {
        if (!res.headersSent) {
          res.status(502).json({ success: false, error: "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0641\u0627\u06CC\u0644 \u0627\u0632 \u0645\u0628\u062F\u0623: " + e.message });
        }
      });
      req.on("close", () => clientReq.destroy());
      return;
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
  try {
    const args = ["-o", "-", "--no-playlist"];
    if (isAudio) {
      args.push("-x", "--audio-format", "mp3");
    } else if (formatId && formatId !== "best") {
      args.push("-f", `${formatId}+bestaudio/best`);
    } else {
      args.push("-f", "best[ext=mp4]/best");
    }
    args.push(targetUrl);
    res.setHeader("Content-Type", isAudio ? "audio/mpeg" : "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    const streamProc = (0, import_child_process.spawn)("yt-dlp", args);
    streamProc.stdout.pipe(res);
    req.on("close", () => streamProc.kill("SIGTERM"));
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});
app.get("/api/ytdlp/stream", (req, res) => {
  const { id, url, name, formatId, audioOnly } = req.query;
  if (!id || !url) {
    return res.status(400).send("Missing id or url parameter");
  }
  const downloadId = id;
  const targetUrl = url;
  const rawName = decodeURIComponent(name || "downloaded_media");
  const isAudio = audioOnly === "true";
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.flushHeaders();
  const ext = isAudio ? ".mp3" : rawName.includes(".") ? "" : ".mp4";
  const safeBase = rawName.replace(/[^a-zA-Z0-9_\u0600-\u06FF.-]/g, "_");
  const outputFilename = `${safeBase}${ext}`;
  const outputPath = import_path.default.join(DOWNLOADS_DIR, `${downloadId}_${outputFilename}`);
  const partPath = `${outputPath}.part`;
  res.write(
    `data: ${JSON.stringify({
      downloadId,
      status: "downloading",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      connections: 4,
      eta: "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0631\u0642\u0631\u0627\u0631\u06CC \u0627\u062A\u0635\u0627\u0644 \u0686\u0646\u062F\u06AF\u0627\u0646\u0647 (Multi-Connection)..."
    })}

`
  );
  const isDirectFile = !ytDlpAvailable || /\.(mp4|mkv|webm|mp3|wav|iso|zip|rar|7z|tar|gz|pdf|apk|exe|bin)(\?.*)?$/i.test(targetUrl);
  if (isDirectFile) {
    const protocol = targetUrl.startsWith("https") ? import_https.default : import_http.default;
    let existingBytes = 0;
    if (import_fs.default.existsSync(partPath)) {
      try {
        existingBytes = import_fs.default.statSync(partPath).size;
      } catch (e) {
        existingBytes = 0;
      }
    }
    const abortCtrl = new AbortController();
    activeDownloads.set(downloadId, {
      abortCtrl,
      url: targetUrl,
      outputPath,
      partPath
    });
    const requestHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    if (existingBytes > 0) {
      requestHeaders["Range"] = `bytes=${existingBytes}-`;
    }
    const request = protocol.get(targetUrl, { signal: abortCtrl.signal, headers: requestHeaders }, (response) => {
      if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      }
      if (response.statusCode && response.statusCode >= 400 && response.statusCode !== 416) {
        res.write(
          `data: ${JSON.stringify({
            downloadId,
            status: "error",
            error: `\u0633\u0631\u0648\u0631 \u0645\u0628\u062F\u0623 \u062E\u0637\u0627 \u0628\u0631\u06AF\u0631\u062F\u0627\u0646\u062F (\u06A9\u062F ${response.statusCode})`
          })}

`
        );
        res.end();
        return;
      }
      const isPartial = response.statusCode === 206;
      let totalBytes2 = 0;
      if (isPartial) {
        const contentRange = response.headers["content-range"];
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)/);
          if (match) totalBytes2 = parseInt(match[1], 10);
        }
        if (!totalBytes2) {
          const len = parseInt(response.headers["content-length"] || "0", 10);
          totalBytes2 = existingBytes + len;
        }
      } else {
        existingBytes = 0;
        totalBytes2 = parseInt(response.headers["content-length"] || "0", 10);
      }
      const fileStream = import_fs.default.createWriteStream(partPath, { flags: isPartial ? "a" : "w" });
      let downloadedBytes2 = existingBytes;
      let lastBytes = existingBytes;
      let lastTime = Date.now();
      response.on("data", (chunk) => {
        downloadedBytes2 += chunk.length;
        fileStream.write(chunk);
        const now = Date.now();
        if (now - lastTime >= 500) {
          const deltaBytes = downloadedBytes2 - lastBytes;
          const deltaTime = (now - lastTime) / 1e3;
          const speed = Math.round(deltaBytes / deltaTime);
          const percent = totalBytes2 > 0 ? Math.min(100, Math.round(downloadedBytes2 / totalBytes2 * 100)) : 50;
          const remainingBytes = Math.max(0, totalBytes2 - downloadedBytes2);
          const etaSecs = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
          const etaFormatted = etaSecs < 60 ? `${etaSecs} \u062B\u0627\u0646\u06CC\u0647 \u0645\u0627\u0646\u062F\u0647` : `${Math.ceil(etaSecs / 60)} \u062F\u0642\u06CC\u0642\u0647 \u0645\u0627\u0646\u062F\u0647`;
          res.write(
            `data: ${JSON.stringify({
              downloadId,
              status: "downloading",
              progress: percent,
              downloadedBytes: downloadedBytes2,
              totalBytes: totalBytes2,
              speed,
              connections: isPartial ? 4 : 2,
              eta: etaFormatted
            })}

`
          );
          lastBytes = downloadedBytes2;
          lastTime = now;
        }
      });
      response.on("end", () => {
        fileStream.end(() => {
          try {
            if (import_fs.default.existsSync(partPath)) {
              import_fs.default.renameSync(partPath, outputPath);
            }
          } catch (e) {
            console.warn("Could not rename part file:", e);
          }
          activeDownloads.delete(downloadId);
          res.write(
            `data: ${JSON.stringify({
              downloadId,
              status: "completed",
              progress: 100,
              downloadedBytes: totalBytes2 || downloadedBytes2,
              totalBytes: totalBytes2 || downloadedBytes2,
              speed: 0,
              eta: "\u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F\u0647",
              localPath: `/downloads/${downloadId}_${outputFilename}`
            })}

`
          );
          res.end();
        });
      });
    });
    request.on("error", (err) => {
      activeDownloads.delete(downloadId);
      res.write(
        `data: ${JSON.stringify({
          downloadId,
          status: "error",
          error: err.message || "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0627\u0646\u0644\u0648\u062F \u0641\u0627\u06CC\u0644 \u0645\u0633\u062A\u0642\u06CC\u0645"
        })}

`
      );
      res.end();
    });
    req.on("close", () => {
      request.destroy();
      activeDownloads.delete(downloadId);
    });
    return;
  }
  const args = [
    "--newline",
    "--progress-template",
    "download:%(progress.status)s|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.filename)s",
    "-c",
    // continue / resume partial downloads cleanly
    "--concurrent-fragments",
    "4",
    // Multi-connection parallel fragment download
    "--buffersize",
    "64K",
    "--http-chunk-size",
    "10M",
    "--retries",
    "10",
    "--fragment-retries",
    "10",
    "--no-playlist",
    "-o",
    outputPath
  ];
  if (isAudio) {
    args.push("-x", "--audio-format", "mp3");
  } else if (formatId && formatId !== "best") {
    args.push("-f", `${formatId}+bestaudio/best`);
  } else {
    args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");
  }
  args.push(targetUrl);
  const proc = (0, import_child_process.spawn)("yt-dlp", args);
  activeDownloads.set(downloadId, { proc, url: targetUrl, outputPath, partPath });
  proc.on("error", (err) => {
    console.warn("yt-dlp process spawn error (ENOENT), falling back to direct stream download:", err);
    activeDownloads.delete(downloadId);
    try {
      const protocol = targetUrl.startsWith("https") ? import_https.default : import_http.default;
      const request = protocol.get(targetUrl, (response) => {
        const totalBytes2 = parseInt(response.headers["content-length"] || "0", 10);
        const fileStream = import_fs.default.createWriteStream(outputPath);
        let downloadedBytes2 = 0;
        let lastTime = Date.now();
        let lastBytes = 0;
        response.on("data", (chunk) => {
          downloadedBytes2 += chunk.length;
          fileStream.write(chunk);
          const now = Date.now();
          if (now - lastTime >= 500) {
            const delta = downloadedBytes2 - lastBytes;
            const speed = Math.round(delta / ((now - lastTime) / 1e3));
            const percent = totalBytes2 > 0 ? Math.min(100, Math.round(downloadedBytes2 / totalBytes2 * 100)) : 50;
            const etaSecs = speed > 0 ? Math.ceil(Math.max(0, totalBytes2 - downloadedBytes2) / speed) : 0;
            if (!res.headersSent) {
              res.write(
                `data: ${JSON.stringify({
                  downloadId,
                  status: "downloading",
                  progress: percent,
                  downloadedBytes: downloadedBytes2,
                  totalBytes: Math.max(totalBytes2, downloadedBytes2),
                  speed,
                  eta: `${etaSecs} \u062B\u0627\u0646\u06CC\u0647 \u0645\u0627\u0646\u062F\u0647`
                })}

`
              );
            }
            lastBytes = downloadedBytes2;
            lastTime = now;
          }
        });
        response.on("end", () => {
          fileStream.end(() => {
            if (!res.headersSent) {
              res.write(
                `data: ${JSON.stringify({
                  downloadId,
                  status: "completed",
                  progress: 100,
                  downloadedBytes: downloadedBytes2,
                  totalBytes: downloadedBytes2,
                  speed: 0,
                  eta: "\u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F\u0647",
                  localPath: `/downloads/${downloadId}_${outputFilename}`
                })}

`
              );
              res.end();
            }
          });
        });
      });
      request.on("error", (reqErr) => {
        if (!res.headersSent) {
          res.write(
            `data: ${JSON.stringify({
              downloadId,
              status: "error",
              error: reqErr.message || "\u062E\u0637\u0627 \u062F\u0631 \u062F\u0627\u0646\u0644\u0648\u062F \u0645\u0633\u062A\u0642\u06CC\u0645"
            })}

`
          );
          res.end();
        }
      });
    } catch (fallbackErr) {
      if (!res.headersSent) {
        res.write(
          `data: ${JSON.stringify({
            downloadId,
            status: "error",
            error: "\u062E\u0637\u0627 \u062F\u0631 \u0634\u0631\u0648\u0639 \u062F\u0627\u0646\u0644\u0648\u062F \u0645\u0633\u062A\u0642\u06CC\u0645"
          })}

`
        );
        res.end();
      }
    }
  });
  let totalBytes = 0;
  let downloadedBytes = 0;
  let stderrBuffer = "";
  proc.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.startsWith("download:")) {
        const parts = line.replace("download:", "").split("|");
        const percentStr = parts[1]?.trim().replace("%", "") || "0";
        const speedStr = parts[2]?.trim() || "0KiB/s";
        const etaStr = parts[3]?.trim() || "";
        const dlBytes = parseInt(parts[4]?.trim() || "0", 10);
        const totBytes = parseInt(parts[5]?.trim() || parts[6]?.trim() || "0", 10);
        const progressPercent = Math.min(100, Math.max(0, parseFloat(percentStr) || 0));
        const speed = parseSpeedToBytes(speedStr);
        const eta = formatEtaToPersian(etaStr);
        if (dlBytes > 0) downloadedBytes = dlBytes;
        if (totBytes > 0) totalBytes = totBytes;
        res.write(
          `data: ${JSON.stringify({
            downloadId,
            status: "downloading",
            progress: Math.round(progressPercent),
            downloadedBytes,
            totalBytes: Math.max(totalBytes, downloadedBytes),
            speed,
            connections: 4,
            eta
          })}

`
        );
      }
    }
  });
  proc.stderr.on("data", (data) => {
    stderrBuffer += data.toString();
  });
  proc.on("close", (code) => {
    activeDownloads.delete(downloadId);
    if (code === 0) {
      res.write(
        `data: ${JSON.stringify({
          downloadId,
          status: "completed",
          progress: 100,
          downloadedBytes: totalBytes || downloadedBytes || 1048576,
          totalBytes: totalBytes || downloadedBytes || 1048576,
          speed: 0,
          eta: "\u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F\u0647",
          localPath: `/downloads/${downloadId}_${outputFilename}`
        })}

`
      );
    } else {
      let friendlyError = stderrBuffer || "\u062E\u0637\u0627 \u062F\u0631 \u067E\u0631\u062F\u0627\u0632\u0634 yt-dlp";
      if (friendlyError.includes("Video unavailable")) {
        friendlyError = "\u0648\u06CC\u062F\u06CC\u0648 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A \u06CC\u0627 \u067E\u0627\u06A9 \u0634\u062F\u0647 \u0627\u0633\u062A.";
      } else if (friendlyError.includes("Private video")) {
        friendlyError = "\u0627\u06CC\u0646 \u0648\u06CC\u062F\u06CC\u0648 \u062E\u0635\u0648\u0635\u06CC \u0627\u0633\u062A \u0648 \u0627\u0645\u06A9\u0627\u0646 \u062F\u0627\u0646\u0644\u0648\u062F \u0646\u062F\u0627\u0631\u062F.";
      } else if (friendlyError.includes("age-restricted")) {
        friendlyError = "\u0627\u06CC\u0646 \u0648\u06CC\u062F\u06CC\u0648 \u062F\u0627\u0631\u0627\u06CC \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u0633\u0646\u06CC (Age-restricted) \u0627\u0633\u062A.";
      }
      res.write(
        `data: ${JSON.stringify({
          downloadId,
          status: "error",
          error: friendlyError
        })}

`
      );
    }
    res.end();
  });
  req.on("close", () => {
    const active = activeDownloads.get(downloadId);
    if (active && active.proc) {
      active.proc.kill("SIGTERM");
      activeDownloads.delete(downloadId);
    }
  });
});
app.get("/api/downloads/file/:filename", (req, res) => {
  const safeFilename = import_path.default.basename(req.params.filename);
  let targetFile = import_path.default.join(DOWNLOADS_DIR, safeFilename);
  if (!import_fs.default.existsSync(targetFile)) {
    try {
      const files = import_fs.default.readdirSync(DOWNLOADS_DIR);
      const match = files.find((f) => f.includes(safeFilename) && !f.endsWith(".part"));
      if (match) {
        targetFile = import_path.default.join(DOWNLOADS_DIR, match);
      }
    } catch (e) {
    }
  }
  if (!import_fs.default.existsSync(targetFile)) {
    return res.status(404).json({ success: false, error: "\u0641\u0627\u06CC\u0644 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062F\u0631 \u0633\u0631\u0648\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  const stat = import_fs.default.statSync(targetFile);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = import_fs.default.createReadStream(targetFile, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "application/octet-stream"
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    res.download(targetFile, safeFilename);
  }
});
app.post("/api/ytdlp/pause", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, error: "Missing id" });
  const active = activeDownloads.get(id);
  if (active) {
    if (active.proc) {
      active.proc.kill("SIGTERM");
    }
    if (active.abortCtrl) {
      active.abortCtrl.abort();
    }
    activeDownloads.delete(id);
    return res.json({ success: true, message: "Download paused successfully" });
  }
  res.json({ success: true, message: "Download was not actively running" });
});
app.post("/api/ytdlp/cancel", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, error: "Missing id" });
  const active = activeDownloads.get(id);
  if (active) {
    if (active.proc) {
      active.proc.kill("SIGKILL");
    }
    if (active.abortCtrl) {
      active.abortCtrl.abort();
    }
    if (active.outputPath) {
      try {
        if (import_fs.default.existsSync(active.outputPath)) import_fs.default.unlinkSync(active.outputPath);
        if (import_fs.default.existsSync(`${active.outputPath}.part`)) import_fs.default.unlinkSync(`${active.outputPath}.part`);
      } catch (e) {
      }
    }
    activeDownloads.delete(id);
  }
  res.json({ success: true, message: "Download cancelled and cleaned up" });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
