const { decodeEntities, hashId, readJson, sendJson, summarize, topTags } = require("./_utils");

class TranscriptError extends Error {}

function extractVideoId(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    const match = value.match(/(?<![A-Za-z0-9_-])([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
    if (match) return match[1];
    throw new TranscriptError("Paste a valid YouTube watch, shorts, live, embed, or youtu.be link.");
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const pathParts = parsed.pathname.split("/").filter(Boolean);
  if (host === "youtu.be" && pathParts[0]) return pathParts[0];
  if (host.endsWith("youtube.com")) {
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    if (pathParts.length >= 2 && ["embed", "shorts", "live"].includes(pathParts[0])) {
      return pathParts[1];
    }
  }

  throw new TranscriptError("Paste a valid YouTube watch, shorts, live, embed, or youtu.be link.");
}

function parseTimeValue(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  if (/^\d+s$/.test(text)) return Number(text.slice(0, -1));
  const match = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match || !match.slice(1).some(Boolean)) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function extractStartSeconds(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    return parseTimeValue(parsed.searchParams.get("t")) ?? parseTimeValue(parsed.searchParams.get("start"));
  } catch {
    return null;
  }
}

function extractJsonObject(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) throw new TranscriptError("YouTube did not include caption metadata on the watch page.");

  const start = text.indexOf("{", markerIndex);
  if (start < 0) throw new TranscriptError("Could not parse YouTube player metadata.");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
  }

  throw new TranscriptError("Could not parse YouTube player metadata.");
}

function extractInnertubeApiKey(text) {
  const match = text.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
  if (!match) throw new TranscriptError("Could not parse YouTube API metadata.");
  return match[1];
}

function setQueryParam(url, key, value) {
  const parsed = new URL(decodeEntities(url));
  parsed.searchParams.set(key, value);
  return parsed.toString();
}

function chooseCaptionTrack(captionTracks) {
  if (!captionTracks || captionTracks.length === 0) {
    throw new TranscriptError("This video does not expose any caption tracks.");
  }
  const english = captionTracks.filter((track) => {
    const languageCode = String(track.languageCode || "").toLowerCase();
    const vssId = String(track.vssId || "").toLowerCase();
    return languageCode.startsWith("en") || vssId.startsWith(".en") || vssId.startsWith("a.en");
  });
  const manualEnglish = english.filter((track) => track.kind !== "asr");
  return manualEnglish[0] || english[0] || captionTracks[0];
}

function parseJson3Transcript(payload) {
  return (payload.events || [])
    .map((event) => {
      const text = (event.segs || [])
        .map((segment) => segment.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      return {
        start: Math.round(Number(event.tStartMs || 0)) / 1000,
        duration: Math.round(Number(event.dDurationMs || 0)) / 1000,
        text: decodeEntities(text)
      };
    })
    .filter((entry) => entry.text);
}

function parseXmlTranscript(xmlText) {
  const entries = [];
  const pattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let match = pattern.exec(xmlText);
  while (match) {
    const attrs = match[1] || "";
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text) {
      entries.push({
        start: Number((attrs.match(/\bstart="([^"]+)"/) || [])[1] || 0),
        duration: Number((attrs.match(/\bdur="([^"]+)"/) || [])[1] || 0),
        text
      });
    }
    match = pattern.exec(xmlText);
  }
  return entries;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  if (!response.ok) throw new TranscriptError(`YouTube request failed with ${response.status}.`);
  return response.text();
}

async function fetchInnertubePlayer(videoId, apiKey) {
  const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 Askarp/1.0"
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38"
        }
      },
      videoId
    })
  });
  if (!response.ok) throw new TranscriptError(`YouTube player request failed with ${response.status}.`);
  const payload = await response.json();
  const status = payload?.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new TranscriptError(payload?.playabilityStatus?.reason || "YouTube did not allow transcript access.");
  }
  return payload;
}

async function fetchTranscriptEntries(baseUrl) {
  const cleanBaseUrl = decodeEntities(baseUrl).replace("&fmt=srv3", "");
  if (cleanBaseUrl.includes("&exp=xpe")) {
    throw new TranscriptError("That caption URL requires a YouTube proof token.");
  }

  const jsonUrl = setQueryParam(cleanBaseUrl, "fmt", "json3");
  try {
    const payload = JSON.parse(await fetchText(jsonUrl));
    const entries = parseJson3Transcript(payload);
    if (entries.length) return entries;
  } catch {
    // Some caption tracks only expose XML. Fall through to the legacy format.
  }

  const xmlText = await fetchText(cleanBaseUrl);
  const entries = parseXmlTranscript(xmlText);
  if (!entries.length) throw new TranscriptError("Caption track exists, but it did not contain transcript text.");
  return entries;
}

function getTrackName(track) {
  const name = track?.name?.simpleText || track?.name?.runs?.map((run) => run.text).join("") || "";
  return name || track?.languageCode || "English";
}

async function transcriptSource(rawUrl) {
  const videoId = extractVideoId(rawUrl);
  const requestedStartSeconds = extractStartSeconds(rawUrl);
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const sourceUrl = requestedStartSeconds !== null ? `${watchUrl}&t=${requestedStartSeconds}s` : watchUrl;

  let title = `YouTube video ${videoId}`;
  let captionTracks = [];
  let transcriptMethod = "innertubeCaptionTracks";
  try {
    const configuredApiKey = String(process.env.YOUTUBE_INNERTUBE_API_KEY || "").trim();
    if (!configuredApiKey) throw new TranscriptError("YOUTUBE_INNERTUBE_API_KEY is not configured.");
    const directPlayer = await fetchInnertubePlayer(videoId, configuredApiKey);
    title = directPlayer?.videoDetails?.title || title;
    captionTracks = directPlayer?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  } catch (error) {
    const watchHtml = await fetchText(watchUrl);
    const player = extractJsonObject(watchHtml, "ytInitialPlayerResponse");
    title = player?.videoDetails?.title || title;
    captionTracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    try {
      const fallbackPlayer = await fetchInnertubePlayer(videoId, extractInnertubeApiKey(watchHtml));
      title = fallbackPlayer?.videoDetails?.title || title;
      captionTracks = fallbackPlayer?.captions?.playerCaptionsTracklistRenderer?.captionTracks || captionTracks;
    } catch {
      transcriptMethod = "captionTracks";
      if (!captionTracks.length) throw error;
    }
  }

  const track = chooseCaptionTrack(captionTracks);
  const entries = await fetchTranscriptEntries(track.baseUrl);
  const transcriptText = entries.map((entry) => `[${entry.start.toFixed(2)}s] ${entry.text}`).join("\n");
  const plainText = entries.map((entry) => entry.text).join(" ");

  return {
    source: {
      id: `youtube-${videoId || hashId(sourceUrl)}`,
      title,
      kind: "YouTube transcript",
      year: "Fetched",
      url: sourceUrl,
      tags: topTags(title, plainText),
      summary: `Transcript from YouTube captions via ${transcriptMethod}. ${summarize(plainText)}`,
      principles: [
        "Use the transcript text as the grounding for questions about this video.",
        "Cite the original YouTube link when using this source."
      ],
      patterns: [
        "Ask a focused question about the video and the retriever will search this transcript.",
        "Download the transcript if you want to inspect the raw caption text."
      ],
      codeHint: "const transcript = await fetch('/api/youtube-transcript', { method: 'POST' });",
      text: transcriptText,
      requestedStartSeconds
    },
    video_id: videoId,
    track_language: track.languageCode || "en",
    track_name: getTrackName(track),
    method: transcriptMethod,
    segment_count: entries.length
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body." });
  }

  try {
    const url = String(body.url || "").trim();
    if (!url) return sendJson(res, 400, { error: "YouTube URL is required." });
    return sendJson(res, 200, await transcriptSource(url));
  } catch (error) {
    const status = error instanceof TranscriptError ? 400 : 502;
    return sendJson(res, status, { error: error.message || "Transcript extraction failed." });
  }
};
