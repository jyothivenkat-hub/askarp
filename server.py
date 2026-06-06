#!/usr/bin/env python3
import html
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import warnings
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PERSONA_BACKEND = os.environ.get("PERSONA_BACKEND", "http://127.0.0.1:8765").rstrip("/")


STOP_WORDS = {
    "about",
    "after",
    "again",
    "also",
    "and",
    "are",
    "because",
    "been",
    "but",
    "can",
    "for",
    "from",
    "have",
    "into",
    "just",
    "like",
    "more",
    "not",
    "now",
    "one",
    "our",
    "out",
    "that",
    "the",
    "then",
    "there",
    "this",
    "was",
    "what",
    "when",
    "with",
    "you",
    "your",
}


class TranscriptError(Exception):
    pass


class ArticleError(Exception):
    pass


class ArticleTextExtractor(HTMLParser):
    CONTENT_TAGS = {"p", "h1", "h2", "h3", "li", "blockquote"}
    SKIP_TAGS = {"script", "style", "svg", "noscript", "nav", "footer", "header", "form"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self._skip_depth = 0
        self._capture_tag = None
        self._buffer = []
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag == "title":
            self._in_title = True
            return
        if tag in self.CONTENT_TAGS and self._capture_tag is None:
            self._capture_tag = tag
            self._buffer = []

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag == "title":
            self._in_title = False
            return
        if tag == self._capture_tag:
            text = " ".join(" ".join(self._buffer).split())
            if len(text) >= 35:
                self.blocks.append(text)
            self._capture_tag = None
            self._buffer = []

    def handle_data(self, data):
        if self._skip_depth:
            return
        text = data.strip()
        if not text:
            return
        if self._in_title:
            self.title = " ".join(f"{self.title} {text}".split())
        if self._capture_tag:
            self._buffer.append(text)


def fetch_text(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def extract_video_id(raw_url):
    value = raw_url.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", value):
        return value

    parsed = urllib.parse.urlparse(value)
    host = parsed.netloc.lower().replace("www.", "")
    path_parts = [part for part in parsed.path.split("/") if part]

    if host == "youtu.be" and path_parts:
        return path_parts[0]

    if host.endswith("youtube.com"):
        query = urllib.parse.parse_qs(parsed.query)
        if query.get("v"):
            return query["v"][0]
        if len(path_parts) >= 2 and path_parts[0] in {"embed", "shorts", "live"}:
            return path_parts[1]

    match = re.search(r"(?<![A-Za-z0-9_-])([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])", value)
    if match:
        return match.group(1)

    raise TranscriptError("Paste a valid YouTube watch, shorts, live, embed, or youtu.be link.")


def parse_time_value(value):
    if not value:
        return None
    text = value.strip().lower()
    if text.isdigit():
        return int(text)
    if re.fullmatch(r"\d+s", text):
        return int(text[:-1])

    match = re.fullmatch(
        r"(?:(?P<hours>\d+)h)?(?:(?P<minutes>\d+)m)?(?:(?P<seconds>\d+)s?)?",
        text,
    )
    if not match or not any(match.groupdict().values()):
        return None
    return (
        int(match.group("hours") or 0) * 3600
        + int(match.group("minutes") or 0) * 60
        + int(match.group("seconds") or 0)
    )


def extract_start_seconds(raw_url):
    parsed = urllib.parse.urlparse(raw_url.strip())
    query = urllib.parse.parse_qs(parsed.query)
    for key in ("t", "start"):
        if query.get(key):
            seconds = parse_time_value(query[key][0])
            if seconds is not None:
                return seconds
    return None


def extract_json_object(text, marker):
    marker_index = text.find(marker)
    if marker_index < 0:
        raise TranscriptError("YouTube did not include caption metadata on the watch page.")

    start = text.find("{", marker_index)
    if start < 0:
        raise TranscriptError("Could not parse YouTube player metadata.")

    depth = 0
    in_string = False
    escape = False

    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : index + 1])

    raise TranscriptError("Could not parse YouTube player metadata.")


def set_query_param(url, key, value):
    parsed = urllib.parse.urlsplit(url)
    pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    filtered = [(item_key, item_value) for item_key, item_value in pairs if item_key != key]
    filtered.append((key, value))
    query = urllib.parse.urlencode(filtered)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))


def choose_caption_track(caption_tracks):
    if not caption_tracks:
        raise TranscriptError("This video does not expose any caption tracks.")

    english_tracks = [
        track
        for track in caption_tracks
        if track.get("languageCode", "").lower().startswith("en")
        or track.get("vssId", "").lower().startswith((".en", "a.en"))
    ]
    manual_english = [track for track in english_tracks if track.get("kind") != "asr"]

    return (manual_english or english_tracks or caption_tracks)[0]


def parse_json3_transcript(payload):
    entries = []
    for event in payload.get("events", []):
        text = "".join(segment.get("utf8", "") for segment in event.get("segs", []))
        text = " ".join(html.unescape(text).split())
        if not text:
            continue
        entries.append(
            {
                "start": round(event.get("tStartMs", 0) / 1000, 2),
                "duration": round(event.get("dDurationMs", 0) / 1000, 2),
                "text": text,
            }
        )
    return entries


def parse_xml_transcript(xml_text):
    entries = []
    root = ET.fromstring(xml_text)
    for node in root.iter("text"):
        text = " ".join(html.unescape("".join(node.itertext())).split())
        if not text:
            continue
        entries.append(
            {
                "start": round(float(node.attrib.get("start", 0)), 2),
                "duration": round(float(node.attrib.get("dur", 0)), 2),
                "text": text,
            }
        )
    return entries


def fetch_transcript_entries(base_url):
    json_url = set_query_param(html.unescape(base_url), "fmt", "json3")
    try:
        payload = json.loads(fetch_text(json_url))
        entries = parse_json3_transcript(payload)
        if entries:
            return entries
    except (json.JSONDecodeError, urllib.error.URLError, ET.ParseError):
        pass

    try:
        xml_text = fetch_text(html.unescape(base_url))
        entries = parse_xml_transcript(xml_text)
    except (urllib.error.URLError, ET.ParseError) as exc:
        raise TranscriptError("Caption track exists, but the transcript could not be downloaded.") from exc

    if not entries:
        raise TranscriptError("Caption track exists, but it did not contain transcript text.")
    return entries


def fetch_transcript_entries_with_library(video_id):
    try:
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL")
            from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError as exc:
        raise TranscriptError("youtube-transcript-api is not installed in this Python environment.") from exc

    try:
        transcript = YouTubeTranscriptApi().fetch(video_id, languages=("en",))
    except Exception as exc:
        raise TranscriptError(f"Transcript library could not fetch captions: {exc}") from exc

    entries = [
        {
            "start": round(float(snippet.start), 2),
            "duration": round(float(snippet.duration), 2),
            "text": " ".join(html.unescape(snippet.text).split()),
        }
        for snippet in transcript
        if snippet.text.strip()
    ]
    if not entries:
        raise TranscriptError("Transcript library returned no transcript text.")
    return entries


def summarize(text):
    compact = " ".join(text.split())
    if len(compact) <= 340:
        return compact
    cutoff = compact.rfind(".", 0, 340)
    if cutoff < 160:
        cutoff = 337
    return compact[: cutoff + 1].strip() + "..."


def top_tags(title, text):
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]{2,}", f"{title} {text}".lower())
    counts = Counter(token for token in tokens if token not in STOP_WORDS)
    return [token for token, _ in counts.most_common(10)]


def extract_meta_title(page_html):
    patterns = [
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']twitter:title["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, page_html, flags=re.I)
        if match:
            return " ".join(html.unescape(match.group(1)).split())
    return ""


def article_source(raw_url):
    value = raw_url.strip()
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ArticleError("Paste a valid public article URL.")

    page_html = fetch_text(value)
    extractor = ArticleTextExtractor()
    extractor.feed(page_html)

    title = extract_meta_title(page_html) or extractor.title or parsed.netloc
    blocks = []
    seen = set()
    for block in extractor.blocks:
        compact = " ".join(block.split())
        key = compact.lower()
        if key not in seen:
            seen.add(key)
            blocks.append(compact)

    text = "\n\n".join(blocks)
    if len(text.split()) < 120:
        raise ArticleError("Could not extract enough article text from that page.")

    source_id = hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]
    return {
        "source": {
            "id": f"article-{source_id}",
            "title": title,
            "kind": "Article",
            "year": "Fetched",
            "url": value,
            "tags": top_tags(title, text),
            "summary": f"Article text extracted from the public page. {summarize(text)}",
            "principles": [
                "Use the article text as grounding when answering questions about this source.",
                "Cite the original article URL when using this source."
            ],
            "patterns": [
                "Break the article into compact chunks before retrieval.",
                "Prefer direct source-grounded explanations over generic persona guesses."
            ],
            "codeHint": "const article = await fetch('/api/article-source', { method: 'POST' });",
            "text": text,
        },
        "word_count": len(text.split()),
    }


def transcript_source(raw_url):
    video_id = extract_video_id(raw_url)
    requested_start_seconds = extract_start_seconds(raw_url)
    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    source_url = (
        f"{watch_url}&t={requested_start_seconds}s"
        if requested_start_seconds is not None
        else watch_url
    )
    watch_html = fetch_text(watch_url)
    player = extract_json_object(watch_html, "ytInitialPlayerResponse")
    video_details = player.get("videoDetails", {})
    title = video_details.get("title") or f"YouTube video {video_id}"
    captions = player.get("captions", {}).get("playerCaptionsTracklistRenderer", {}).get("captionTracks", [])

    track = {}
    transcript_method = "youtube-transcript-api"
    try:
        entries = fetch_transcript_entries_with_library(video_id)
    except TranscriptError:
        track = choose_caption_track(captions)
        transcript_method = "captionTracks"
        entries = fetch_transcript_entries(track["baseUrl"])

    transcript_text = "\n".join(
        f"[{entry['start']:0.2f}s] {entry['text']}" for entry in entries
    )
    plain_text = " ".join(entry["text"] for entry in entries)

    return {
        "source": {
            "id": f"youtube-{video_id}",
            "title": title,
            "kind": "YouTube transcript",
            "year": "Fetched",
            "url": source_url,
            "tags": top_tags(title, plain_text),
            "summary": f"Transcript from YouTube captions via {transcript_method}. {summarize(plain_text)}",
            "principles": [
                "Use the transcript text as the grounding for questions about this video.",
                "Cite the original YouTube link when using this source."
            ],
            "patterns": [
                "Ask a focused question about the video and the local retriever will search this transcript.",
                "Download the transcript if you want to inspect the raw caption text."
            ],
            "codeHint": "const transcript = await fetch('/api/youtube-transcript', { method: 'POST' });",
            "text": transcript_text,
            "requestedStartSeconds": requested_start_seconds,
        },
        "video_id": video_id,
        "track_language": track.get("languageCode", "en"),
        "track_name": track.get("name", {}).get("simpleText", track.get("languageCode", "English")),
        "method": transcript_method,
        "segment_count": len(entries),
    }


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self, max_bytes=64 * 1024):
        length = int(self.headers.get("Content-Length", "0"))
        if length > max_bytes:
            raise TranscriptError("Request is too large.")
        return self.rfile.read(length)

    def proxy_persona_api(self, method, path, body=None):
        headers = {}
        content_type = self.headers.get("Content-Type")
        if content_type:
            headers["Content-Type"] = content_type

        request = urllib.request.Request(
            f"{PERSONA_BACKEND}{path}",
            data=body,
            headers=headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                self.send_response(response.status)
                self.send_header(
                    "Content-Type",
                    response.headers.get("Content-Type", "application/json; charset=utf-8"),
                )
                if response.headers.get("Cache-Control"):
                    self.send_header("Cache-Control", response.headers["Cache-Control"])
                self.end_headers()

                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except urllib.error.HTTPError as exc:
            body = exc.read()
            self.send_response(exc.code)
            self.send_header(
                "Content-Type",
                exc.headers.get("Content-Type", "application/json; charset=utf-8"),
            )
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", str(exc))
            self.send_json(
                503,
                {
                    "error": (
                        f"Indexed persona backend is not reachable at {PERSONA_BACKEND}: {reason}"
                    )
                },
            )

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in {"/api/persona", "/api/sources/status"}:
            self.proxy_persona_api("GET", path)
            return
        super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        if path in {"/api/chat", "/api/reset", "/api/tts", "/api/sources"}:
            try:
                self.proxy_persona_api("POST", path, self.read_body())
            except TranscriptError as exc:
                self.send_json(400, {"error": str(exc)})
            return

        if path == "/api/article-source":
            try:
                payload = json.loads(self.read_body(8192).decode("utf-8"))
                url = payload.get("url", "")
                if not url:
                    raise ArticleError("Paste an article URL first.")
                self.send_json(200, article_source(url))
            except ArticleError as exc:
                self.send_json(400, {"error": str(exc)})
            except urllib.error.URLError as exc:
                reason = getattr(exc, "reason", str(exc))
                self.send_json(502, {"error": f"Article request failed: {reason}"})
            except Exception as exc:
                self.send_json(500, {"error": f"Article extraction failed: {exc}"})
            return

        if path != "/api/youtube-transcript":
            self.send_json(404, {"error": "Unknown API route."})
            return

        try:
            payload = json.loads(self.read_body(8192).decode("utf-8"))
            url = payload.get("url", "")
            if not url:
                raise TranscriptError("Paste a YouTube URL first.")
            self.send_json(200, transcript_source(url))
        except TranscriptError as exc:
            self.send_json(400, {"error": str(exc)})
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", str(exc))
            self.send_json(502, {"error": f"YouTube request failed: {reason}"})
        except Exception as exc:
            self.send_json(500, {"error": f"Transcript generation failed: {exc}"})


def resolve_port():
    env_port = os.environ.get("PORT", "").strip()
    if env_port:
        return int(env_port)
    return None


def bind_server():
    preferred = resolve_port()
    ports = [preferred] if preferred is not None else list(range(8001, 8006))
    last_error = None

    for port in ports:
        if port is None:
            continue
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            return server, port
        except OSError as exc:
            if exc.errno == 48:
                last_error = exc
                continue
            raise

    raise OSError(
        48,
        "Ports 8001-8005 are in use. Stop stale servers with: lsof -i :8001",
    ) from last_error


def main():
    server, port = bind_server()
    print(f"Serving Karpathy Companion on http://127.0.0.1:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
