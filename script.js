(function () {
  const sources = window.KARPATHY_COMPANION_SOURCES || [];
  const app = document.querySelector(".app-shell");
  const answerText = document.querySelector("#answerText");
  const askForm = document.querySelector("#askForm");
  const questionInput = document.querySelector("#questionInput");
  const sourceList = document.querySelector("#sourceList");
  const groundingLabel = document.querySelector("#groundingLabel");
  const personaBadge = document.querySelector("#personaBadge");
  const resetButton = document.querySelector("#resetButton");
  const panelToggle = document.querySelector("#panelToggle");
  const sourcePanel = document.querySelector("#sourcePanel");
  const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
  const micButton = document.querySelector("#micButton");
  const voiceToggle = document.querySelector("#voiceToggle");
  const voiceToggleLabel = document.querySelector("#voiceToggleLabel");
  const voiceSelect = document.querySelector("#voiceSelect");
  const voicePreviewButton = document.querySelector("#voicePreviewButton");
  const insightModeLabel = document.querySelector("#insightModeLabel");
  const insightModeHint = document.querySelector("#insightModeHint");
  const sourceForm = document.querySelector("#sourceForm") || document.querySelector("#youtubeForm");
  const sourceUrl = document.querySelector("#sourceUrl") || document.querySelector("#youtubeUrl");
  const sourceStatus = document.querySelector("#sourceStatus") || document.querySelector("#youtubeStatus");
  const serverBanner = document.querySelector("#serverBanner");
  const knowledgeLayerStatus = document.querySelector("#knowledgeLayerStatus");
  const compilerStatusText = document.querySelector("#compilerStatusText");
  const answerLayerStatus = document.querySelector("#answerLayerStatus");
  const layerSummary = document.querySelector("#layerSummary");
  const sourceCountLabel = document.querySelector("#sourceCountLabel");
  const avatarUpload = document.querySelector("#avatarUpload");
  const avatarDropZone = document.querySelector("#avatarDropZone");
  const petAvatar = document.querySelector("#petAvatar");
  const petImage = document.querySelector("#petImage");

  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "does",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "of",
    "on",
    "or",
    "should",
    "that",
    "the",
    "this",
    "to",
    "what",
    "when",
    "why",
    "with",
    "you"
  ]);

  let activeMode = "simple";
  const modeProfiles = {
    simple: {
      label: "Simple",
      hint: "Quick source-grounded answer",
      prompt:
        "Use Simple mode. Give a short answer in plain language: answer first, explain why it matters, then give one practical takeaway. Keep it to 2-4 compact paragraphs. This mode should work for learning companions, customer profiles, buyer personas, and research personas as a quick read."
    },
    code: {
      label: "Code",
      hint: "Prototype, workflow, or test plan",
      prompt:
        "Use Code mode. Convert the answer into something operational: a minimal implementation, prototype plan, decision rule, experiment, interview script, or testing workflow. Include code only when the question is technical; otherwise provide concrete steps, variables to observe, and a way to know if it worked."
    },
    deep: {
      label: "Deep",
      hint: "Synthesis, tradeoffs, and implications",
      prompt:
        "Use Deep mode. Build a source-grounded synthesis: mental model, mechanism, tradeoffs, failure modes, and implications. This is for expert-style education, research synthesis, critique personas, and strategy questions. Be coherent, not a bullet dump."
    },
    quiz: {
      label: "Quiz",
      hint: "Practice, interview, or concept-test prompts",
      prompt:
        "Use Quiz mode. Do not just explain. Ask 4-6 targeted questions that test understanding or surface a persona/profile reaction. For learning, make them practice questions. For consumer or buyer personas, make them concept-testing or decision prompts. End by asking the user to reply so you can grade or synthesize the responses."
    }
  };
  let typingTimer = null;
  let recognition = null;
  let speakingTimers = [];
  let availableVoices = [];
  let lastSpokenAnswer = "";
  let speechRunId = 0;
  let activeTranscriptSourceId = null;
  let indexedPersonaReady = false;
  let indexedPersonaName = "Andrej";
  const sourceStorageKey = "karpathy-companion-user-sources";
  const legacyTranscriptStorageKey = "karpathy-companion-transcripts";
  const avatarStorageKey = "karpathy-companion-avatar";
  const voiceMutedStorageKey = "karpathy-companion-voice-muted";
  const selectedVoiceStorageKey = "karpathy-companion-selected-voice";
  const voiceStylePrefix = "__voice_style:";
  let voiceMuted = localStorage.getItem(voiceMutedStorageKey) === "true";

  function resolveApiBase() {
    if (window.location.protocol === "file:") {
      return "http://127.0.0.1:8001";
    }
    return "";
  }

  let apiBase = resolveApiBase();

  const defaultPetSrc = "assets/andrej-pixel-pet.png";

  function setAvatarState(hasCustomAvatar) {
    app.classList.toggle("has-custom-avatar", hasCustomAvatar);
    petAvatar.classList.toggle("has-custom-avatar", hasCustomAvatar);
  }

  const transcriptTopics = [
    {
      label: "Agentic coding crossed a reliability threshold",
      patterns: ["never felt more behind", "vibe coding", "chunks just came out fine", "december"],
      summary:
        "he describes a sharp shift where coding agents moved from occasionally useful chunks to coherent workflows he could increasingly trust."
    },
    {
      label: "Software 3.0 is a new programming interface",
      patterns: ["software 3.0", "context window", "prompting", "interpreter that is the llm"],
      summary:
        "he frames prompts, context, and tool instructions as the new way of programming an LLM-as-computer."
    },
    {
      label: "Apps and infrastructure should become agent-native",
      patterns: ["agent native", "copy paste to my agent", "sensors and actuators", "deployed in that same way"],
      summary:
        "he wants systems, docs, deployment, and services designed for agents to act directly, not only for humans clicking around."
    },
    {
      label: "Taste and engineering judgment still matter",
      patterns: ["taste and judgment", "heart attack", "bloated", "awkward abstractions", "unique user ids"],
      summary:
        "he says humans still have to supply taste, architecture, product judgment, and the right constraints because generated code can work while still being messy."
    },
    {
      label: "Current models are jagged intelligences",
      patterns: ["jagged", "statistical simulation circuits", "pre-training", "reward functions"],
      summary:
        "he treats models as uneven systems shaped by pretraining and reinforcement learning, so they need suspicion, evaluation, and careful use."
    },
    {
      label: "Understanding cannot be outsourced",
      patterns: ["outsource your thinking", "can't outsource your understanding", "good director", "enhance understanding"],
      summary:
        "he argues that cheap intelligence does not remove the need to understand; you still need enough understanding to direct the work."
    }
  ];

  function setState(state) {
    app.dataset.state = state;
  }

  function showServerBanner() {
    if (!serverBanner) return;
    const port = window.location.port || "8001";
    const url = `http://127.0.0.1:${port}/`;
    serverBanner.hidden = false;
    serverBanner.innerHTML = [
      "<strong>Server not reachable.</strong>",
      " Start the backend, then open the app in your browser:",
      ` <code>${escapeHtml(url)}</code>`,
      "<br><br>Run: <code>./start.sh</code> or <code>.venv/bin/python server.py</code>",
      "<br>Do not open <code>index.html</code> directly from the file system."
    ].join("");
  }

  function hideServerBanner() {
    if (serverBanner) serverBanner.hidden = true;
  }

  async function checkBackendHealth() {
    try {
      const response = await fetch(`${apiBase}/api/youtube-transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "" })
      });
      if (response.status === 400 || response.ok) {
        hideServerBanner();
        return true;
      }
    } catch {
      // Backend is down or blocked (common when opening index.html via file://).
    }
    showServerBanner();
    return false;
  }

  async function loadIndexedPersona() {
    try {
      const response = await fetch(`${apiBase}/api/persona`);
      if (!response.ok) throw new Error("Indexed persona backend is offline.");
      const persona = await response.json();
      indexedPersonaReady = true;
      indexedPersonaName = (persona.name || "Andrej").split(" ")[0];
      if (personaBadge) personaBadge.textContent = persona.model ? `Indexed · ${persona.model}` : "Indexed persona";
      groundingLabel.textContent = "Indexed persona ready";
      updateLayerPanel("Tone and answer layers are connected to the indexed backend.");
      return true;
    } catch {
      indexedPersonaReady = false;
      if (personaBadge) personaBadge.textContent = "Local sources";
      updateLayerPanel("Indexed backend is offline; using local chunks only.");
      return false;
    }
  }

  function tokenize(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9+#. ]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !stopWords.has(token));
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function sourceText(source) {
    return [
      source.title,
      source.kind,
      source.summary,
      list(source.tags).join(" "),
      list(source.principles).join(" "),
      list(source.patterns).join(" "),
      source.text || ""
    ].join(" ");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeSource(source) {
    return {
      id: source.id,
      title: source.title || "Untitled source",
      kind: source.kind || "Source",
      year: source.year || "Loaded",
      url: source.url || "#",
      tags: list(source.tags),
      summary: source.summary || "No summary available.",
      principles: list(source.principles).length
        ? source.principles
        : ["Use the retrieved source text as the grounding for this answer."],
      patterns: list(source.patterns).length
        ? source.patterns
        : ["Ask a focused question and inspect the cited source."],
      codeHint: source.codeHint || "// No code hint is available for this source.",
      text: source.text || source.transcript || "",
      isUserSource: Boolean(source.isUserSource),
      compiledAt: source.compiledAt || "",
      requestedStartSeconds:
        typeof source.requestedStartSeconds === "number" ? source.requestedStartSeconds : null
    };
  }

  function hydrateSavedSources() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(sourceStorageKey) ||
          localStorage.getItem(legacyTranscriptStorageKey) ||
          "[]"
      );
      if (!Array.isArray(saved)) return;
      saved
        .map(normalizeSource)
        .reverse()
        .forEach((source) => {
          if (!sources.some((item) => item.id === source.id)) {
            sources.unshift(source);
          }
        });
      const latestTranscript = sources.map(normalizeSource).find((source) => source.kind === "YouTube transcript");
      if (latestTranscript) activeTranscriptSourceId = latestTranscript.id;
    } catch {
      localStorage.removeItem(sourceStorageKey);
      localStorage.removeItem(legacyTranscriptStorageKey);
    }
  }

  function saveUserSources() {
    const userSources = sources
      .map(normalizeSource)
      .filter(
        (source) =>
          source.text &&
          (source.isUserSource ||
            source.kind === "YouTube transcript" ||
            source.kind === "Article" ||
            source.id.startsWith("article-"))
      );
    try {
      localStorage.setItem(sourceStorageKey, JSON.stringify(userSources));
    } catch {
      sourceStatus.textContent = "Source added for this session. Browser storage is full.";
    }
  }

  function hydrateAvatar() {
    try {
      const savedAvatar = localStorage.getItem(avatarStorageKey);
      if (savedAvatar) {
        petImage.src = savedAvatar;
        petImage.style.background = "transparent";
        setAvatarState(true);
      } else {
        petImage.src = defaultPetSrc;
        petImage.style.background = "transparent";
        setAvatarState(false);
      }
    } catch {
      localStorage.removeItem(avatarStorageKey);
      petImage.src = defaultPetSrc;
      setAvatarState(false);
    }
  }

  function saveAvatar(file) {
    if (!file || !file.type.startsWith("image/")) {
      sourceStatus.textContent = "Use an image file for the avatar.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      petImage.src = result;
      petImage.style.background = "transparent";
      setAvatarState(true);
      try {
        localStorage.setItem(avatarStorageKey, result);
        sourceStatus.textContent = "Avatar image updated.";
      } catch {
        sourceStatus.textContent = "Avatar changed for this session. Browser storage is full.";
      }
    };
    reader.readAsDataURL(file);
  }

  function avatarFileFromEvent(event) {
    return Array.from(event.dataTransfer?.files || []).find((file) => file.type.startsWith("image/")) || null;
  }

  function scoreSource(queryTokens, source) {
    const haystack = sourceText(source);
    const sourceTokens = tokenize(haystack);
    const sourceSet = new Set(sourceTokens);
    let score = 0;

    queryTokens.forEach((token) => {
      if (sourceSet.has(token)) score += 4;
      if (list(source.tags).some((tag) => tag.toLowerCase().includes(token))) score += 3;
      if (source.title.toLowerCase().includes(token)) score += 5;
    });

    if (queryTokens.length > 0) {
      score += sourceTokens.filter((token) => queryTokens.includes(token)).length * 0.45;
    }

    return score;
  }

  function isGenericTranscriptQuery(question) {
    return /\b(summary|summarize|recap|video|transcript|he said|what did he say|talked about|talking about)\b/i.test(
      question
    );
  }

  function retrieve(question) {
    const queryTokens = tokenize(question);
    return sources
      .map((source) => {
        const normalized = normalizeSource(source);
        let score = scoreSource(queryTokens, normalized);
        if (isGenericTranscriptQuery(question) && normalized.kind === "YouTube transcript") {
          score += normalized.id === activeTranscriptSourceId ? 80 : 35;
        }
        return {
          ...normalized,
          score
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
  }

  function formatTime(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    if (hours) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function transcriptUrl(source, seconds) {
    const base = source.url.replace(/([?&])t=\d+s?(&?)/, "$1").replace(/[?&]$/, "");
    return `${base}${base.includes("?") ? "&" : "?"}t=${Math.max(0, Math.floor(seconds || 0))}s`;
  }

  function parseTranscript(text) {
    const entries = [];
    const linePattern = /^\[(\d+(?:\.\d+)?)s\]\s(.+)$/gm;
    let match = linePattern.exec(text);
    while (match) {
      entries.push({
        start: Number(match[1]),
        text: match[2].trim()
      });
      match = linePattern.exec(text);
    }
    return entries;
  }

  function transcriptChunks(entries, targetWords = 120) {
    const chunks = [];
    let current = [];
    let wordCount = 0;
    entries.forEach((entry) => {
      current.push(entry);
      wordCount += tokenize(entry.text).length;
      if (wordCount >= targetWords) {
        chunks.push({
          start: current[0].start,
          end: current[current.length - 1].start,
          text: current.map((item) => item.text).join(" ")
        });
        current = [];
        wordCount = 0;
      }
    });
    if (current.length) {
      chunks.push({
        start: current[0].start,
        end: current[current.length - 1].start,
        text: current.map((item) => item.text).join(" ")
      });
    }
    return chunks;
  }

  function textChunks(text, targetWords = 150) {
    const paragraphs = String(text)
      .split(/\n{2,}/)
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const chunks = [];
    let current = [];
    let wordCount = 0;

    paragraphs.forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length > targetWords * 1.4) {
        if (current.length) {
          chunks.push({
            start: null,
            end: null,
            text: current.join(" ")
          });
          current = [];
          wordCount = 0;
        }
        for (let index = 0; index < words.length; index += targetWords) {
          chunks.push({
            start: null,
            end: null,
            text: words.slice(index, index + targetWords).join(" ")
          });
        }
        return;
      }
      current.push(paragraph);
      wordCount += words.length;
      if (wordCount >= targetWords) {
        chunks.push({
          start: null,
          end: null,
          text: current.join(" ")
        });
        current = [];
        wordCount = 0;
      }
    });
    if (current.length) {
      chunks.push({
        start: null,
        end: null,
        text: current.join(" ")
      });
    }
    return chunks;
  }

  function compiledChunks(source) {
    const normalized = normalizeSource(source);
    if (!normalized.text) return [];
    const entries = parseTranscript(normalized.text);
    if (entries.length) {
      return transcriptChunks(entries, 120).map((chunk) => ({
        ...chunk,
        sourceId: normalized.id,
        title: normalized.title,
        url: transcriptUrl(normalized, chunk.start)
      }));
    }
    return textChunks(normalized.text).map((chunk) => ({
      ...chunk,
      sourceId: normalized.id,
      title: normalized.title,
      url: normalized.url
    }));
  }

  function compiledStats() {
    const compiledSources = sources.map(normalizeSource).filter((source) => source.text);
    const chunkCount = compiledSources.reduce((total, source) => total + compiledChunks(source).length, 0);
    return {
      sourceCount: compiledSources.length,
      chunkCount
    };
  }

  function updateSourceSummary(matchCount = 0) {
    if (!sourceCountLabel) return;
    const stats = compiledStats();
    const loadedCount = sources.length;
    if (stats.chunkCount) {
      sourceCountLabel.textContent = `${stats.sourceCount} compiled · ${stats.chunkCount} chunks`;
    } else if (matchCount) {
      sourceCountLabel.textContent = `${matchCount} cited sources`;
    } else {
      sourceCountLabel.textContent = `${loadedCount} starter sources`;
    }
  }

  function updateLayerPanel(detail) {
    const stats = compiledStats();
    if (knowledgeLayerStatus) {
      knowledgeLayerStatus.textContent = stats.chunkCount
        ? `${stats.sourceCount} sources · ${stats.chunkCount} chunks`
        : indexedPersonaReady
          ? "Indexed corpus connected"
          : `${sources.length} starter source notes`;
    }
    if (layerSummary) {
      layerSummary.textContent = indexedPersonaReady
        ? stats.chunkCount
          ? `Indexed · ${stats.chunkCount} chunks`
          : "Indexed corpus connected"
        : "Local source mode";
    }
    if (compilerStatusText && detail) {
      compilerStatusText.textContent = detail;
    }
    if (answerLayerStatus) {
      const profile = modeProfiles[activeMode] || modeProfiles.simple;
      const answerBase = indexedPersonaReady ? "Indexed RAG + voice" : "Local RAG + voice";
      answerLayerStatus.textContent = `${answerBase} · ${profile.label}`;
    }
  }

  function scoreChunk(questionTokens, chunk) {
    const chunkTokens = new Set(tokenize(chunk.text));
    return questionTokens.reduce((total, token) => total + (chunkTokens.has(token) ? 1 : 0), 0);
  }

  function chunksForQuestion(question, entries) {
    const questionTokens = tokenize(question);
    return transcriptChunks(entries)
      .map((chunk) => ({ ...chunk, score: scoreChunk(questionTokens, chunk) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
  }

  function chunksForSourceQuestion(question, source) {
    const questionTokens = tokenize(question);
    return compiledChunks(source)
      .map((chunk) => ({ ...chunk, score: scoreChunk(questionTokens, chunk) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
  }

  function parseTimeMention(question) {
    const timestamp = question.match(/\b(?:(\d+):)?(\d{1,2}):(\d{2})\b/);
    if (timestamp) {
      const hours = Number(timestamp[1] || 0);
      const minutes = Number(timestamp[2]);
      const seconds = Number(timestamp[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }
    const seconds = question.match(/\b(\d+)\s*s(?:ec(?:ond)?s?)?\b/i);
    if (seconds) return Number(seconds[1]);
    const minutes = question.match(/\b(\d+)\s*m(?:in(?:ute)?s?)?\b/i);
    if (minutes) return Number(minutes[1]) * 60;
    return null;
  }

  function chunkAround(entries, seconds, radius = 6) {
    const nearestIndex = entries.reduce((bestIndex, entry, index) => {
      const bestDistance = Math.abs(entries[bestIndex].start - seconds);
      const distance = Math.abs(entry.start - seconds);
      return distance < bestDistance ? index : bestIndex;
    }, 0);
    return entries
      .slice(Math.max(0, nearestIndex - radius), nearestIndex + radius + 1)
      .map((entry) => entry.text)
      .join(" ");
  }

  function shortExcerpt(text, maxWords = 18) {
    const words = text.replace(/\s+/g, " ").trim().split(" ");
    return words.slice(0, maxWords).join(" ") + (words.length > maxWords ? "..." : "");
  }

  function detectTranscriptTopics(source, entries) {
    const fullText = source.text.toLowerCase();
    return transcriptTopics
      .filter((topic) => topic.patterns.some((pattern) => fullText.includes(pattern)))
      .map((topic) => {
        const moment =
          entries.find((entry) =>
            topic.patterns.some((pattern) => entry.text.toLowerCase().includes(pattern))
          ) || entries[0];
        return { ...topic, start: moment.start };
      });
  }

  function sourceTitleList(matches, limit = 3) {
    return matches
      .slice(0, limit)
      .map((source) => source.title)
      .join("; ");
  }

  function transcriptChunkLines(chunks, maxWords = 24) {
    return chunks.slice(0, 3).map((chunk) => {
      return `- Around ${formatTime(chunk.start)}: ${shortExcerpt(chunk.text, maxWords)}`;
    });
  }

  function composeTranscriptModeAnswer(question, source, chunks) {
    const lines = transcriptChunkLines(chunks);
    const firstChunk = chunks[0];
    const sourceUrl = firstChunk ? transcriptUrl(source, firstChunk.start) : source.url;

    if (activeMode === "code") {
      return [
        `Code mode: here is how to turn "${question}" into something usable from "${source.title}".`,
        "",
        "Relevant transcript evidence:",
        ...lines,
        "",
        "Operational version:",
        "1. State the mechanism in one sentence.",
        "2. Build the smallest prototype, example, or test where that mechanism shows up.",
        "3. Compare the result against the source claim instead of trusting the vibe.",
        "4. Keep one measurable check: output quality, failure case, user reaction, or correctness.",
        "",
        `Source: ${sourceUrl}`
      ].join("\n");
    }

    if (activeMode === "deep") {
      return [
        `Deep mode: the useful read of "${question}" in "${source.title}" is the mechanism underneath the surface claim.`,
        "",
        "Evidence from the transcript:",
        ...lines,
        "",
        "Synthesis:",
        "- Mechanism: reduce the topic to the smallest moving part the source is pointing at.",
        "- Tradeoff: ask what improves, what gets cheaper, and what new failure mode appears.",
        "- Implication: the answer should change how you would learn, build, evaluate, or test the idea.",
        "",
        `Source: ${sourceUrl}`
      ].join("\n");
    }

    if (activeMode === "quiz") {
      return [
        `Quiz mode: use this section of "${source.title}" to test whether you actually understand "${question}".`,
        "",
        "Source hints:",
        ...lines,
        "",
        "Answer these:",
        "1. What is the main claim in your own words?",
        "2. What is the smallest example that would make the claim concrete?",
        "3. What would count as evidence against this claim?",
        "4. If this were a customer or buyer persona, what would they likely push back on?",
        "",
        "Reply with your answers and I will grade them against the source."
      ].join("\n");
    }

    return [
      `Simple mode: grounded in "${source.title}", here is the answer from the transcript.`,
      "",
      ...lines,
      "",
      "Takeaway: reduce the idea to the mechanism, then ask what changes when that mechanism becomes reliable.",
      "",
      `Source: ${sourceUrl}`
    ].join("\n");
  }

  function composeTranscriptSummary(question, source) {
    const entries = parseTranscript(source.text);
    if (!entries.length) {
      return `I found "${source.title}", but the transcript text is not readable yet. Try re-adding the YouTube link.`;
    }

    const topics = detectTranscriptTopics(source, entries);
    const topicLines = topics.slice(0, 6).map((topic) => {
      return `- ${topic.label}: ${topic.summary} (${formatTime(topic.start)})`;
    });
    const shortVersion = topics.length
      ? `Short version: ${topics
          .slice(0, 3)
          .map((topic) => topic.summary)
          .join(" ")}`
      : `Short version: ${shortExcerpt(entries.map((entry) => entry.text).join(" "), 42)}`;
    const startSeconds = parseTimeMention(question) ?? source.requestedStartSeconds;
    const timestampNote =
      startSeconds !== null
        ? [
            "",
            `Your link points near ${formatTime(startSeconds)}. Around there, the transcript is about: ${shortExcerpt(
              chunkAround(entries, startSeconds),
              22
            )}`
          ].join("\n")
        : "";

    const fallbackLine =
      topicLines.length === 0
        ? `- Transcript-level read: ${shortExcerpt(entries.map((entry) => entry.text).join(" "), 52)}`
        : "";

    if (activeMode === "code") {
      return [
        `Code mode: I found the transcript for "${source.title}" and translated it into an implementation/test lens.`,
        "",
        "Main source points:",
        ...topicLines,
        fallbackLine,
        timestampNote,
        "",
        "How to operationalize it:",
        "1. Pick one claim from the source.",
        "2. Turn it into a tiny prototype, workflow, or user-test prompt.",
        "3. Define what would make the result useful or wrong.",
        "4. Iterate with the transcript as the reference, not as generic inspiration."
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (activeMode === "deep") {
      return [
        `Deep mode: I found the transcript for "${source.title}" and grouped it by underlying mechanisms.`,
        "",
        shortVersion,
        "",
        "Core themes:",
        ...topicLines,
        fallbackLine,
        timestampNote,
        "",
        "Synthesis: this source is useful when you want to connect a surface idea to the engineering judgment, tradeoffs, and failure modes behind it."
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (activeMode === "quiz") {
      return [
        `Quiz mode: I found the transcript for "${source.title}". Use these prompts to test understanding or run a lightweight concept interview.`,
        "",
        "Source hints:",
        ...topicLines.slice(0, 4),
        fallbackLine,
        timestampNote,
        "",
        "Questions:",
        "1. What is the strongest claim in this source?",
        "2. What example would make it concrete?",
        "3. What would a skeptical buyer, learner, or stakeholder object to?",
        "4. What source detail would you cite back as evidence?",
        "",
        "Reply with answers and I will grade or synthesize them."
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      `Simple mode: I found the transcript for "${source.title}" and I am using that video as the source.`,
      "",
      shortVersion,
      "",
      "Main takeaways:",
      ...topicLines,
      fallbackLine,
      timestampNote,
      "",
      "Takeaway: use the transcript as grounding, then ask a focused follow-up when you want a specific section explained."
    ]
      .filter(Boolean)
      .join("\n");
  }

  function composeTranscriptQuestion(question, source) {
    const entries = parseTranscript(source.text);
    if (!entries.length) return composeSimple(question, [source]);

    const explicitTime = parseTimeMention(question);
    if (explicitTime !== null) {
      if (activeMode !== "simple") {
        return composeTranscriptModeAnswer(question, source, [
          {
            start: explicitTime,
            text: chunkAround(entries, explicitTime),
            score: 1
          }
        ]);
      }
      return [
        `Around ${formatTime(explicitTime)} in "${source.title}", the relevant transcript section says, in plain English:`,
        "",
        shortExcerpt(chunkAround(entries, explicitTime), 22),
        "",
        `Source: ${transcriptUrl(source, explicitTime)}`
      ].join("\n");
    }

    if (/\b(summary|summarize|recap|overview|what he said|what did he say)\b/i.test(question)) {
      return composeTranscriptSummary(question, source);
    }

    const chunks = chunksForQuestion(question, entries).filter((chunk) => chunk.score > 0);
    if (!chunks.length) {
      return composeTranscriptSummary(question, source);
    }

    return [
      composeTranscriptModeAnswer(question, source, chunks)
    ].join("\n");
  }

  function composeSimple(question, matches) {
    const top = matches[0];
    const second = matches[1];
    return [
      `Simple mode: ${top.principles[0]}`,
      "",
      `Why it matters: ${top.summary}`,
      "",
      top.patterns[0] ? `Practical takeaway: ${top.patterns[0]}` : "",
      second ? `Related source: ${second.title} adds that ${shortExcerpt(second.summary, 22)}` : "",
      "",
      `Grounded in: ${sourceTitleList(matches)}.`
    ]
      .filter(Boolean)
      .join("\n");
  }

  function composeCode(question, matches) {
    const top = matches[0];
    const support = matches[1];
    return [
      `Code mode: turn "${question}" into a prototype, workflow, or test plan.`,
      "",
      `Working model: ${top.principles[0]}`,
      "",
      "Minimal loop:",
      "1. Define the input you will give the persona, learner, or system.",
      "2. Decide what output would count as useful.",
      "3. Run the smallest example and inspect the failure case.",
      "4. Add source context only when it changes the answer.",
      "",
      "```js",
      top.codeHint,
      "```",
      "",
      top.patterns[1] ? `Implementation habit: ${top.patterns[1]}` : "",
      support ? `Cross-check: ${support.title} is the next source to inspect.` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  function composeDeep(question, matches) {
    const top = matches[0];
    const supporting = matches.slice(1, 4);
    const sourceThread = supporting
      .map((source) => `${source.title}: ${source.principles[0]}`)
      .join(" ");

    return [
      `Deep mode: "${question}" is best answered as a mechanism plus tradeoffs, not as a slogan.`,
      "",
      `Mechanism: ${top.principles[0]}`,
      top.principles[1] ? `Second-order idea: ${top.principles[1]}` : "",
      "",
      `Why this source matters: ${top.summary}`,
      "",
      "Tradeoffs and failure modes:",
      ...top.patterns.slice(0, 3).map((pattern) => `- ${pattern}`),
      "",
      sourceThread ? `Connected source thread: ${sourceThread}` : "",
      "Where to be careful: if the source base does not cover the question, the persona should abstain or ask for more material."
    ]
      .filter(Boolean)
      .join("\n");
  }

  function composeQuiz(question, matches) {
    const top = matches[0];
    return [
      `Quiz mode: do not just read about "${question}". Test the idea.`,
      "",
      "Answer these:",
      `1. In your own words, what is the core claim? Hint: ${top.principles[0]}`,
      `2. What is the smallest concrete example or prototype? Hint: ${top.patterns[0]}`,
      `3. What would a skeptical learner, buyer, or customer profile push back on? Hint: ${top.patterns[1] || top.summary}`,
      "4. What source detail would you cite as evidence?",
      "",
      `Evidence base: ${sourceTitleList(matches)}.`,
      "Reply with your answers and I will grade them against the source base."
    ].join("\n");
  }

  function composeAnswer(question, matches) {
    const confident = matches[0] && matches[0].score > 0;
    if (!confident) {
      return {
        text:
          "I do not have enough source grounding for that yet. Add the relevant article, transcript, or notes to the knowledge base, then ask again.",
        matches: sources.slice(0, 3).map((source) => ({ ...source, score: 0 }))
      };
    }

    if (matches[0].kind === "YouTube transcript" && matches[0].text) {
      return {
        text: composeTranscriptQuestion(question, matches[0]),
        matches
      };
    }

    const composers = {
      simple: composeSimple,
      code: composeCode,
      deep: composeDeep,
      quiz: composeQuiz
    };

    return {
      text: composers[activeMode](question, matches),
      matches
    };
  }

  function renderSources(matches) {
    sourceList.innerHTML = "";
    matches.forEach((source) => {
      const normalized = normalizeSource(source);
      const card = document.createElement("article");
      card.className = "source-card";
      const score = Math.max(0, Math.round(source.score));
      const chunkCount = compiledChunks(normalized).length;
      card.innerHTML = `
        <a href="${escapeHtml(normalized.url)}" target="_blank" rel="noreferrer">${escapeHtml(normalized.title)}</a>
        <p class="source-meta">${escapeHtml(normalized.kind)} · ${escapeHtml(normalized.year)}</p>
        <p class="source-meta">${escapeHtml(shortExcerpt(normalized.summary, 24))}</p>
        <span class="score-pill">${score > 0 ? `${score} relevance` : "loaded source"}</span>
        ${chunkCount ? `<span class="score-pill chunk-pill">${chunkCount} chunks</span>` : ""}
        ${
          normalized.text
            ? `<button class="source-action" type="button" data-download-source="${escapeHtml(
                normalized.id
              )}">Download source text</button>`
            : ""
        }
      `;
      sourceList.appendChild(card);
    });
    groundingLabel.textContent = matches.some((source) => source.score > 0)
      ? "Grounded answer"
      : "Source base";
    updateSourceSummary(matches.length);
    updateLayerPanel();
  }

  function renderIndexedSources(indexedSources, abstained) {
    sourceList.innerHTML = "";
    if (abstained) {
      const warning = document.createElement("article");
      warning.className = "source-card warning-card";
      warning.innerHTML = `
        <strong>Weak indexed match</strong>
        <p class="source-meta">The indexed corpus did not strongly cover this question, so treat the answer as cautious.</p>
      `;
      sourceList.appendChild(warning);
    }

    indexedSources.slice(0, 5).forEach((source) => {
      const card = document.createElement("article");
      card.className = "source-card";
      const score = Number.isFinite(source.score) ? Math.round(source.score * 100) : 0;
      card.innerHTML = `
        <a href="${escapeHtml(source.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(
          source.label || "Indexed source"
        )}</a>
        <p class="source-meta">${escapeHtml(source.source || "indexed corpus")}</p>
        <span class="score-pill">${score ? `${score}% match` : "indexed source"}</span>
      `;
      sourceList.appendChild(card);
    });

    groundingLabel.textContent = abstained ? "Weak indexed match" : "Indexed corpus";
    updateSourceSummary(indexedSources.length);
    updateLayerPanel(abstained ? "Indexed retrieval was weak for that question." : "Answer used the indexed knowledge layer.");
  }

  function localTranscriptShouldAnswer(question, matches) {
    const top = matches[0];
    return Boolean(
      top &&
        top.kind === "YouTube transcript" &&
        top.text &&
        (top.score > 0 || isGenericTranscriptQuery(question))
    );
  }

  function localContextForQuestion(question, matches) {
    const contextBlocks = [];
    matches
      .filter((source) => source.text && source.score > 0)
      .map(normalizeSource)
      .slice(0, 3)
      .forEach((source) => {
        const chunks = chunksForSourceQuestion(question, source)
          .filter((chunk) => chunk.score > 0)
          .slice(0, 3);
        chunks.forEach((chunk) => {
          const label = chunk.start !== null ? `${source.title} @ ${formatTime(chunk.start)}` : source.title;
          contextBlocks.push(`[${label}] ${shortExcerpt(chunk.text, 90)}\nURL: ${chunk.url}`);
        });
      });

    if (!contextBlocks.length) return "";
    return [
      "Newly added compiled source chunks are below. Treat them as first-class retrieval context.",
      "Use them when relevant and cite the URL/timestamp. Do not make claims beyond the retrieved or supplied context.",
      "",
      contextBlocks.join("\n\n")
    ].join("\n");
  }

  function personaQuestion(question, matches = []) {
    const modeProfile = modeProfiles[activeMode] || modeProfiles.simple;
    const layerInstruction = [
      "Answer style:",
      "- Give a direct, coherent explanation in a clear first-principles teaching style.",
      "- Synthesize the retrieved ideas instead of listing retrieved facts.",
      "- Do not expose internal labels such as [Fact 3], [1], chunks, passages, or retrieved text.",
      "- For normal questions, avoid horizontal rules, long stage-by-stage outlines, and table-of-contents formatting.",
      "- Use source names or timestamps only naturally, and only when helpful.",
      "- Keep normal answers to 3-5 compact paragraphs unless the user asks for a full deep dive.",
      "- For public thinker personas, stay clearly source-grounded and do not impersonate the real person.",
      "- For consumer, buyer, research, or critique personas, answer as an evidence-grounded profile built from supplied material, not as a generic chatbot."
    ].join("\n");
    const modeInstruction = [`Current mode: ${modeProfile.label}.`, modeProfile.prompt].join("\n");
    const localContext = localContextForQuestion(question, matches);
    return [layerInstruction, modeInstruction, localContext, `Question: ${question}`].filter(Boolean).join("\n\n");
  }

  function markdownLite(text) {
    return escapeHtml(text)
      .replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
      )
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  async function streamIndexedAnswer(question, matches = []) {
    if (!indexedPersonaReady) return false;

    let response;
    try {
      response = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: personaQuestion(question, matches),
          query: question
        })
      });
    } catch {
      indexedPersonaReady = false;
      return false;
    }

    if (!response.ok || !response.body) {
      if (!response.ok) {
        indexedPersonaReady = false;
        return false;
      }
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let hadDelta = false;

    answerText.innerHTML = "";

    function handleIndexedEvent(eventText) {
      const line = eventText.split(/\r?\n/).find((lineText) => lineText.startsWith("data:"));
      if (!line) return;
      const event = JSON.parse(line.slice(5).trim());

      if (event.type === "delta") {
        hadDelta = true;
        answer += event.text;
        setState("talking");
        answerText.innerHTML = markdownLite(answer);
      } else if (event.type === "sources") {
        renderIndexedSources(event.sources || [], event.abstained);
      } else if (event.type === "error") {
        throw new Error(event.message || "Indexed persona could not answer.");
      }
    }

    try {
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || "";

          for (const eventText of events) {
            handleIndexedEvent(eventText);
          }
        }
        if (buffer.trim()) handleIndexedEvent(buffer);
      } else {
        const events = (await response.text()).split(/\r?\n\r?\n/);
        events.forEach((eventText) => {
          if (eventText.trim()) handleIndexedEvent(eventText);
        });
      }
    } catch (error) {
      console.warn("Indexed persona stream failed, falling back to local sources.", error);
      return false;
    }

    if (!hadDelta) return false;
    setState("idle");
    speakAnswer(answer);
    return true;
  }

  function downloadTranscript(sourceId) {
    const source = normalizeSource(sources.find((item) => item.id === sourceId) || {});
    if (!source.text) return;
    const fileName = `${source.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "transcript"}.txt`;
    const blob = new Blob([source.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function typeAnswer(text) {
    window.clearInterval(typingTimer);
    answerText.innerHTML = "";
    setState("talking");

    let index = 0;
    typingTimer = window.setInterval(() => {
      index += 3;
      answerText.innerHTML = markdownLite(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(typingTimer);
        setState("idle");
      }
    }, 14);
  }

  function preferredVoiceScore(voice) {
    const name = `${voice.name} ${voice.lang}`.toLowerCase();
    let score = 0;
    if (voice.lang && voice.lang.toLowerCase().startsWith("en")) score += 20;
    if (isLikelyMaleVoice(voice)) score += 28;
    if (/enhanced|premium|natural|neural|google|microsoft/.test(name)) score += 16;
    if (/compact|novelty|whisper|zarvox|trinoids|bells|bad news|good news|bahh|boing|bubbles/.test(name)) score -= 40;
    return score;
  }

  function cleanVoiceName(voice) {
    return (voice.name || "Browser voice")
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/[()]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isLikelyMaleVoice(voice) {
    const name = `${voice.name} ${voice.voiceURI || ""}`.toLowerCase();
    return /\b(daniel|alex|fred|ralph|tom|thomas|matthew|aaron|nathan|liam|ryan|guy|david|george|oliver|arthur|brian|michael|mark|james|paul|richard|robert|eddy|grandpa|reed|rocko)\b|microsoft.*guy|google us english/.test(
      name
    );
  }

  function isLikelyHigherVoice(voice) {
    const name = `${voice.name} ${voice.voiceURI || ""}`.toLowerCase();
    return /samantha|victoria|karen|moira|tessa|fiona|susan|zira|hazel|aria|jenny|female|flo|grandma|sandy|shelley/.test(name);
  }

  function isNoveltyVoice(voice) {
    const name = `${voice.name} ${voice.voiceURI || ""}`.toLowerCase();
    return /albert|cellos|hysterical|jester|junior|organ|superstar|wobble|bad news|bahh|bells|boing|bubbles|good news|trinoids|whisper|zarvox/.test(name);
  }

  function voiceToneLabel(voice) {
    if (isLikelyMaleVoice(voice)) return "low/male-style";
    if (isLikelyHigherVoice(voice)) return "higher";
    return "neutral";
  }

  function voiceKey(voice) {
    return [voice.voiceURI || "", voice.name || "", voice.lang || ""].join("|||");
  }

  function selectedVoiceProfile() {
    if (!("speechSynthesis" in window)) return { voice: null, rate: 0.88, pitch: 0.74 };
    const selectedValue = voiceSelect.value;
    if (selectedValue === `${voiceStylePrefix}clear`) {
      return { voice: null, rate: 0.92, pitch: 0.9 };
    }
    if (selectedValue === `${voiceStylePrefix}low`) {
      const voice = [...availableVoices].sort((left, right) => preferredVoiceScore(right) - preferredVoiceScore(left))[0] || null;
      return { voice, rate: 0.86, pitch: 0.68 };
    }
    if (selectedValue) {
      const voice =
        availableVoices.find((voice) => voiceKey(voice) === selectedValue) ||
        availableVoices.find((voice) => (voice.voiceURI || voice.name) === selectedValue) ||
        availableVoices.find((voice) => voice.name === selectedValue) ||
        null;
      return {
        voice,
        rate: 0.88,
        pitch: voice && isLikelyMaleVoice(voice) ? 0.82 : 0.72
      };
    }
    const voice = [...availableVoices].sort((left, right) => preferredVoiceScore(right) - preferredVoiceScore(left))[0] || null;
    return { voice, rate: 0.86, pitch: voice && isLikelyMaleVoice(voice) ? 0.82 : 0.68 };
  }

  function populateVoices() {
    if (!("speechSynthesis" in window)) return;
    availableVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => !voice.lang || voice.lang.toLowerCase().startsWith("en"))
      .sort((left, right) => preferredVoiceScore(right) - preferredVoiceScore(left));

    const previous = localStorage.getItem(selectedVoiceStorageKey) || voiceSelect.value;
    voiceSelect.innerHTML = "";

    const autoOption = document.createElement("option");
    autoOption.value = "";
    autoOption.textContent = "Auto low narrator";
    voiceSelect.appendChild(autoOption);

    const lowOption = document.createElement("option");
    lowOption.value = `${voiceStylePrefix}low`;
    lowOption.textContent = "Low narrator (browser default)";
    voiceSelect.appendChild(lowOption);

    const clearOption = document.createElement("option");
    clearOption.value = `${voiceStylePrefix}clear`;
    clearOption.textContent = "Clear narrator (browser default)";
    voiceSelect.appendChild(clearOption);

    const usefulVoices = availableVoices.filter(
      (voice) => isLikelyMaleVoice(voice) || isLikelyHigherVoice(voice) || !isNoveltyVoice(voice)
    );
    usefulVoices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voiceKey(voice);
      option.textContent = `${cleanVoiceName(voice)}${voice.lang ? ` · ${voice.lang}` : ""} · ${voiceToneLabel(voice)}`;
      voiceSelect.appendChild(option);
    });
    if (previous && Array.from(voiceSelect.options).some((option) => option.value === previous)) {
      voiceSelect.value = previous;
    } else {
      voiceSelect.value = "";
    }
  }

  function cleanSpeechText(text) {
    return text
      .replace(/```[\s\S]*?```/g, "I am skipping the code block in voice.")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, (match) => `around ${match}`)
      .replace(/\s+/g, " ")
      .trim();
  }

  function speechChunks(text) {
    const sentences = cleanSpeechText(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    const chunks = [];
    let current = "";
    sentences.forEach((sentence) => {
      const next = `${current} ${sentence}`.trim();
      if (next.length > 240 && current) {
        chunks.push(current);
        current = sentence.trim();
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks.slice(0, 8);
  }

  function stopSpeaking() {
    speechRunId += 1;
    speakingTimers.forEach((timer) => window.clearTimeout(timer));
    speakingTimers = [];
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function setVoiceMuted(muted) {
    voiceMuted = muted;
    voiceToggle.classList.toggle("is-muted", muted);
    voiceToggle.setAttribute("aria-pressed", String(muted));
    voiceToggle.setAttribute("aria-label", muted ? "Unmute voice" : "Mute voice");
    voiceToggle.title = muted ? "Unmute voice" : "Mute voice";
    if (voiceToggleLabel) voiceToggleLabel.textContent = muted ? "Unmute" : "Mute";
    try {
      localStorage.setItem(voiceMutedStorageKey, String(muted));
    } catch {
      // Voice preference is non-critical.
    }
    if (muted) stopSpeaking();
  }

  function speakChunks(chunks, voiceProfile, index = 0, runId = speechRunId) {
    if (runId !== speechRunId) return;
    if (index >= chunks.length) {
      setState("idle");
      return;
    }

    const profile = voiceProfile || { voice: null, rate: 0.88, pitch: 0.74 };
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    if (profile.voice) utterance.voice = profile.voice;
    utterance.lang = profile.voice?.lang || "en-US";
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = 1;
    utterance.onstart = () => setState("talking");
    utterance.onend = () => {
      if (runId !== speechRunId) return;
      const timer = window.setTimeout(() => speakChunks(chunks, profile, index + 1, runId), 130);
      speakingTimers.push(timer);
    };
    utterance.onerror = () => {
      if (runId === speechRunId) setState("idle");
    };
    window.speechSynthesis.speak(utterance);
  }

  function speakAnswer(text) {
    lastSpokenAnswer = cleanSpeechText(text);
    if (voiceMuted || !("speechSynthesis" in window)) return;
    stopSpeaking();
    const runId = speechRunId;
    const chunks = speechChunks(text);
    if (!chunks.length) return;
    const timer = window.setTimeout(() => speakChunks(chunks, selectedVoiceProfile(), 0, runId), 90);
    speakingTimers.push(timer);
  }

  function replayCurrentAnswerWithSelectedVoice() {
    if (voiceMuted || !("speechSynthesis" in window)) return;
    const replayText = lastSpokenAnswer || "Voice changed.";
    speakAnswer(replayText);
  }

  function previewSelectedVoice() {
    if (!("speechSynthesis" in window)) return;
    setVoiceMuted(false);
    speakAnswer("Voice preview. Let's build this up from first principles.");
  }

  async function answerQuestion(question) {
    stopSpeaking();
    setState("thinking");
    groundingLabel.textContent = "Retrieving";

    const matches = retrieve(question);
    if (await streamIndexedAnswer(question, matches)) {
      return;
    }

    window.setTimeout(() => {
      const answer = composeAnswer(question, matches);
      renderSources(answer.matches);
      typeAnswer(answer.text);
      speakAnswer(answer.text);
    }, 180);
  }

  function isYouTubeUrl(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      return host === "youtu.be" || host.endsWith("youtube.com");
    } catch {
      return false;
    }
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function fetchSourcePreview(url) {
    const endpoint = isYouTubeUrl(url) ? "/api/youtube-transcript" : "/api/article-source";
    const response = await fetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not extract source text from that link.");
    }
    return payload;
  }

  async function startIndexedCompile(url) {
    if (!indexedPersonaReady) return false;
    try {
      const response = await fetch(`${apiBase}/api/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, rebuild: true })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Indexed compiler rejected that source.");
      }
      return true;
    } catch (error) {
      console.warn("Indexed compiler start failed.", error);
      return false;
    }
  }

  async function pollIndexedCompile() {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const response = await fetch(`${apiBase}/api/sources/status`);
      if (!response.ok) throw new Error("Could not read compiler status.");
      const status = await response.json();
      const message = status.message || "Compiler is working on the source.";
      if (status.state === "running") {
        sourceStatus.textContent = message;
        updateLayerPanel(message);
        await delay(2000);
        continue;
      }
      if (status.state === "done") {
        await loadIndexedPersona();
        sourceStatus.textContent = message;
        updateLayerPanel(`${message}. The indexed knowledge layer is rebuilt.`);
        return true;
      }
      if (status.state === "error") {
        throw new Error(message || "Compiler failed.");
      }
      await delay(1000);
    }
    sourceStatus.textContent = "Source extracted locally. Indexed compiler is still running in the background.";
    updateLayerPanel("Local chunks are ready; indexed compiler is still running.");
    return false;
  }

  async function ingestSourceUrl(url) {
    const submitButton = sourceForm.querySelector("button");
    submitButton.disabled = true;
    sourceStatus.textContent = isYouTubeUrl(url) ? "Fetching transcript..." : "Extracting article text...";
    groundingLabel.textContent = "Ingesting";
    setState("thinking");

    try {
      const payload = await fetchSourcePreview(url);
      const source = normalizeSource(payload.source);
      source.isUserSource = true;
      source.compiledAt = new Date().toISOString();
      const existingIndex = sources.findIndex((item) => item.id === source.id);
      if (existingIndex >= 0) {
        sources[existingIndex] = source;
      } else {
        sources.unshift(source);
      }
      if (source.kind === "YouTube transcript") activeTranscriptSourceId = source.id;
      saveUserSources();

      sourceUrl.value = "";
      const chunkCount = compiledChunks(source).length;
      const unitText = payload.segment_count
        ? `${payload.segment_count} caption segments`
        : `${payload.word_count || source.text.split(/\s+/).length} words`;
      sourceStatus.textContent = `${unitText} extracted into ${chunkCount} chunks.`;
      renderSources([
        { ...source, score: 1 },
        ...sources
          .filter((item) => item.id !== source.id)
          .slice(0, 3)
          .map((item) => ({ ...normalizeSource(item), score: 0 }))
      ]);
      typeAnswer(`Source loaded for "${source.title}". I broke it into ${chunkCount} chunks and can use it as retrieval context while the indexed compiler runs.`);

      if (await startIndexedCompile(url)) {
        sourceStatus.textContent = "Compiler started: extracting facts and rebuilding the indexed knowledge layer...";
        updateLayerPanel("Compiler started: extracting facts and rebuilding the index.");
        await pollIndexedCompile();
      }
    } catch (error) {
      sourceStatus.textContent = error.message;
      typeAnswer(`I could not ingest that link. ${error.message}`);
    } finally {
      submitButton.disabled = false;
    }
  }

  function setupModes() {
    updateModeCopy();
    modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeMode = button.dataset.mode;
        updateModeCopy();
        showModeReadyMessage();
        questionInput.focus();
      });
    });
  }

  function updateModeCopy() {
    const profile = modeProfiles[activeMode] || modeProfiles.simple;
    modeButtons.forEach((button) => {
      const isActive = button.dataset.mode === activeMode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    if (insightModeLabel) insightModeLabel.textContent = profile.label;
    if (insightModeHint) insightModeHint.textContent = profile.hint;
    if (answerLayerStatus) {
      const answerBase = indexedPersonaReady ? "Indexed RAG + voice" : "Local RAG + voice";
      answerLayerStatus.textContent = `${answerBase} · ${profile.label}`;
    }
  }

  function showModeReadyMessage() {
    const profile = modeProfiles[activeMode] || modeProfiles.simple;
    stopSpeaking();
    answerText.innerHTML = markdownLite(
      `${profile.label} mode selected. ${profile.hint}. Ask a question to use this response shape.`
    );
  }

  function setPanelVisible(isVisible) {
    app.classList.toggle("panel-hidden", !isVisible);
    if (!panelToggle) return;
    panelToggle.setAttribute("aria-expanded", String(isVisible));
    panelToggle.textContent = isVisible ? "Hide sources" : "Sources";
  }

  function setupPanelToggle() {
    if (!panelToggle || !sourcePanel) return;
    setPanelVisible(true);
    panelToggle.addEventListener("click", () => {
      const isVisible = !app.classList.contains("panel-hidden");
      setPanelVisible(!isVisible);
      questionInput.focus();
    });
  }

  function setupMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micButton.disabled = true;
      micButton.title = "Speech recognition is not available in this browser";
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setState("listening");
    recognition.onerror = () => setState("idle");
    recognition.onend = () => setState("idle");
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      questionInput.value = transcript;
      answerQuestion(transcript);
    };

    micButton.addEventListener("click", () => {
      recognition.start();
    });
  }

  askForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = questionInput.value.trim();
    if (!question) return;
    answerQuestion(question);
  });

  sourceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = sourceUrl.value.trim();
    if (!url) return;
    ingestSourceUrl(url);
  });

  sourceList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-download-source]");
    if (!button) return;
    downloadTranscript(button.dataset.downloadSource);
  });

  resetButton.addEventListener("click", async () => {
    stopSpeaking();
    answerText.textContent = `Conversation reset. Ask ${indexedPersonaName} anything.`;
    setState("idle");
    try {
      await fetch(`${apiBase}/api/reset`, { method: "POST" });
    } catch {
      // Local fallback mode has no remote conversation to reset.
    }
  });

  avatarUpload.addEventListener("change", () => {
    const [file] = avatarUpload.files || [];
    saveAvatar(file);
  });

  avatarDropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    avatarDropZone.classList.add("is-dragging");
  });

  avatarDropZone.addEventListener("dragleave", () => {
    avatarDropZone.classList.remove("is-dragging");
  });

  avatarDropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    avatarDropZone.classList.remove("is-dragging");
    saveAvatar(avatarFileFromEvent(event));
  });

  petAvatar.addEventListener("click", () => avatarUpload.click());
  petAvatar.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      avatarUpload.click();
    }
  });
  petAvatar.addEventListener("dragover", (event) => {
    event.preventDefault();
    petAvatar.classList.add("is-dragging");
  });
  petAvatar.addEventListener("dragleave", () => {
    petAvatar.classList.remove("is-dragging");
  });
  petAvatar.addEventListener("drop", (event) => {
    event.preventDefault();
    petAvatar.classList.remove("is-dragging");
    saveAvatar(avatarFileFromEvent(event));
  });

  window.addEventListener("paste", (event) => {
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) return;
    saveAvatar(imageItem.getAsFile());
  });

  setupModes();
  setupPanelToggle();
  setupMic();
  populateVoices();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  } else {
    voiceToggle.disabled = true;
    if (voicePreviewButton) voicePreviewButton.disabled = true;
    voiceToggle.title = "Speech output is not available in this browser";
  }
  setVoiceMuted(voiceMuted);
  voiceToggle.addEventListener("click", () => {
    setVoiceMuted(!voiceMuted);
    questionInput.focus();
  });
  voiceSelect.addEventListener("change", () => {
    try {
      localStorage.setItem(selectedVoiceStorageKey, voiceSelect.value);
    } catch {
      // Voice preference is non-critical.
    }
    setVoiceMuted(false);
    previewSelectedVoice();
    questionInput.focus();
  });
  if (voicePreviewButton) {
    voicePreviewButton.addEventListener("click", () => {
      previewSelectedVoice();
      questionInput.focus();
    });
  }
  if (petImage) {
    petImage.addEventListener("error", () => {
      console.error(
        `Karpathy Companion: could not load pet image (${petImage.src}). ` +
          "Run ./start.sh and ensure assets/andrej-pixel-pet.png exists."
      );
    });
  }

  hydrateAvatar();
  hydrateSavedSources();
  renderSources(sources.slice(0, 4).map((source) => ({ ...source, score: 0 })));
  checkBackendHealth();
  loadIndexedPersona();
})();
