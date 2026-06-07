// tts-generation.js - Full TTS dubbing workstation
// Supports local indexTTS2 + EmotionTTS Cloud API

document.addEventListener("DOMContentLoaded", () => {

  // ===================== State =====================
  const STATE = {
    engine: "local",    // "local" | "cloud"
    cloudToken: "",
    cloudValid: false,
    characters: [],
    currentCharId: null,
  };

  // ===================== Helpers =====================
  function $(id) { return document.getElementById(id); }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

  function showToast(msg) {
    const el = $("page-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add("hidden"), 3000);
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  async function api(url, opts = {}) {
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      let detail = "";
      try { detail = (await resp.json()).detail; } catch {}
      throw new Error(detail || "请求失败 (HTTP " + resp.statusCode + ")");
    }
    return resp.json();
  }

  // ===================== Tab Switching =====================
  qsa(".tts-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      qsa(".tts-tab").forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      qsa(".tts-panel").forEach(p => p.classList.remove("is-active"));
      const panel = $("tab-" + target);
      if (panel) panel.classList.add("is-active");
      if (target === "library") loadCharacters();
      if (target === "synth") refreshSynthCharSelect();
    });
  });

  // ===================== Config Modal =====================
  function openConfig() {
    $("configModal").classList.add("is-active");
  }
  function closeConfig() {
    $("configModal").classList.remove("is-active");
  }
  $("openConfigBtn").addEventListener("click", openConfig);
  $("closeConfigBtn").addEventListener("click", closeConfig);
  $("closeConfigBtn2").addEventListener("click", closeConfig);
  $("configModal").addEventListener("click", (e) => {
    if (e.target === $("configModal")) closeConfig();
  });

  // Engine selector
  qsa("input[name='ttsEngine']").forEach(radio => {
    radio.addEventListener("change", () => {
      STATE.engine = radio.value;
      const cloudSec = $("cloudConfigSection");
      if (STATE.engine === "cloud") {
        cloudSec.classList.remove("hidden");
      } else {
        cloudSec.classList.add("hidden");
      }
      updateServerBadge();
    });
  });

  // Save cloud token
  $("saveTokenBtn").addEventListener("click", async () => {
    const token = $("cloudTokenInput").value.trim();
    if (!token) { showToast("请输入 API 令牌"); return; }
    try {
      const data = await api("/api/tts/cloud/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      STATE.cloudToken = token;
      STATE.cloudValid = data.token_valid;
      $("tokenStatus").textContent = data.message || (data.token_valid ? "令牌有效" : "令牌无效");
      $("tokenStatus").style.color = data.token_valid ? "#2e7d32" : "#c62828";
      if (data.token_valid) showToast("云端令牌配置成功");
      updateServerBadge();
    } catch (e) {
      $("tokenStatus").textContent = "保存失败: " + e.message;
      $("tokenStatus").style.color = "#c62828";
    }
  });

  // Load saved token status
  async function loadTokenStatus() {
    try {
      const data = await api("/api/tts/cloud/token");
      if (data.has_token) {
        STATE.cloudToken = data.masked;
        STATE.cloudValid = true;
        $("cloudTokenInput").value = "";
        $("cloudTokenInput").placeholder = "已配置: " + data.masked;
        $("tokenStatus").textContent = "令牌已配置";
        $("tokenStatus").style.color = "#2e7d32";
      }
    } catch {}
  }

  // ===================== Server Health =====================
  async function checkHealth() {
    const badge = $("serverStatus");
    try {
      // Check local health first
      const localResp = await fetch("/api/tts/health");
      const localData = await localResp.json();
      if (localData.index_tts2_available) {
        badge.textContent = "本地 indexTTS2 在线";
        badge.className = "tts-server-badge online";
        STATE.engine = "local";
        return;
      }
    } catch {}

    // Check cloud if token set
    if (STATE.cloudToken) {
      try {
        const cloudResp = await fetch("/api/tts/cloud/health");
        const cloudData = await cloudResp.json();
        if (cloudData.token_valid) {
          badge.textContent = "EmotionTTS 云端在线";
          badge.className = "tts-server-badge online";
          STATE.engine = "cloud";
          return;
        }
      } catch {}
    }

    badge.textContent = "服务离线";
    badge.className = "tts-server-badge offline";
  }

  function updateServerBadge() {
    const badge = $("serverStatus");
    if (STATE.engine === "local") {
      badge.textContent = "本地 indexTTS2";
      badge.className = "tts-server-badge online";
    } else if (STATE.cloudValid) {
      badge.textContent = "EmotionTTS 云端";
      badge.className = "tts-server-badge online";
    } else {
      badge.textContent = "未配置";
      badge.className = "tts-server-badge offline";
    }
  }

  // ===================== Character Library =====================
  async function loadCharacters() {
    try {
      const data = await api("/api/tts/characters");
      STATE.characters = data.characters || [];
      renderCharacterGrid();
      refreshSynthCharSelect();
    } catch (e) {
      console.error("Failed to load characters:", e);
    }
  }

  function renderCharacterGrid() {
    const grid = $("characterGrid");
    const chars = STATE.characters;
    $("charCount").textContent = chars.length + " 个角色";

    if (chars.length === 0) {
      grid.innerHTML = '<p class="micro-status">暂无角色，请先创建</p>';
      return;
    }

    grid.innerHTML = chars.map(c => `
      <div class="tts-char-card" data-char-id="${esc(c.id)}">
        <div class="char-avatar">${esc(c.name.charAt(0))}</div>
        <div class="char-name">${esc(c.name)}</div>
        <div class="char-desc">${esc(c.description || "暂无描述")}</div>
        <div class="char-meta">${c.voice_count} 个参考音频</div>
        <div class="tts-voice-chips" id="chips-${esc(c.id)}"></div>
      </div>
    `).join("");

    // Click to open detail
    grid.querySelectorAll(".tts-char-card").forEach(card => {
      card.addEventListener("click", () => openCharDetail(card.dataset.charId));
    });

    // Load voice chips
    chars.forEach(c => loadVoiceChips(c.id));
  }

  async function loadVoiceChips(charId) {
    try {
      const data = await api("/api/tts/characters/" + charId);
      const voices = data.voices || [];
      const el = $("chips-" + charId);
      if (!el) return;
      if (voices.length === 0) {
        el.innerHTML = '<span style="font-size:10px;color:var(--tts-sub)">无参考音频</span>';
        return;
      }
      el.innerHTML = voices.map(v => {
        const emo = v.emotion || "平";
        return '<span class="tts-voice-chip" title="' + esc(v.text || "") + '"><span class="tts-emotion-dot e-' + esc(emo) + '"></span>' + esc(emo) + '</span>';
      }).join("");
    } catch {}
  }

  // Create character
  $("createCharBtn").addEventListener("click", async () => {
    const name = $("newCharName").value.trim();
    if (!name) { showToast("请输入角色名称"); return; }
    try {
      await api("/api/tts/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: $("newCharDesc").value.trim() })
      });
      $("newCharName").value = "";
      $("newCharDesc").value = "";
      showToast("角色创建成功");
      loadCharacters();
    } catch (e) { showToast("创建失败: " + e.message); }
  });

  // Character detail modal
  function openCharDetail(charId) {
    STATE.currentCharId = charId;
    $("charDetailModal").classList.add("is-active");
    loadCharDetail(charId);
  }
  function closeCharDetail() {
    $("charDetailModal").classList.remove("is-active");
    STATE.currentCharId = null;
  }
  $("closeCharDetailBtn").addEventListener("click", closeCharDetail);
  $("charDetailModal").addEventListener("click", (e) => {
    if (e.target === $("charDetailModal")) closeCharDetail();
  });

  async function loadCharDetail(charId) {
    try {
      const data = await api("/api/tts/characters/" + charId);
      $("charDetailTitle").textContent = data.name;
      const voices = data.voices || [];
      let voicesHtml = voices.length === 0
        ? '<p class="micro-status">暂无参考音频，请上传</p>'
        : voices.map(v => `
            <div class="tts-voice-item">
              <span class="voice-meta"><span class="tts-emotion-dot e-' + esc(v.emotion || '平') + '"></span> ${esc(v.emotion || '平')}</span>
              <audio controls src="/data/tts_characters/${esc(charId)}/${esc(v.filename)}"></audio>
              <button class="tts-btn-icon tts-delete-voice" data-voice-id="${v.id}" title="删除">×</button>
            </div>
          `).join("");

      $("charDetailContent").innerHTML = `
        <p style="margin:0 0 12px;font-size:14px;color:var(--tts-sub)">${esc(data.description || "暂无描述")}</p>
        <h4 style="margin:0 0 8px;font-size:14px">上传参考音频</h4>
        <div class="tts-upload-area" id="voiceUploadArea">
          <p style="margin:0;font-size:13px;color:var(--tts-sub)">点击或拖拽 .wav/.mp3 文件到此处上传</p>
          <input type="file" id="voiceFileInput" accept=".wav,.mp3">
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
          <label style="flex:1;margin:0">
            <select id="voiceEmotion" style="width:100%">
              <option value="喜">喜</option><option value="怒">怒</option><option value="哀">哀</option>
              <option value="惧">惧</option><option value="惊">惊</option><option value="厌">厌</option>
              <option value="平" selected>平</option>
            </select>
          </label>
          <input id="voiceRefText" type="text" placeholder="参考文本(可选)" style="flex:2;padding:8px;border:1px solid var(--tts-border);border-radius:8px;font-size:13px" />
        </div>
        <p id="voiceUploadStatus" class="micro-status"></p>
        <h4 style="margin:16px 0 8px;font-size:14px">参考音频列表</h4>
        <div id="voiceList">${voicesHtml}</div>
        <div class="tts-modal-footer">
          <button id="deleteCharBtn" class="tts-btn tts-btn-danger">删除角色</button>
          <button id="closeDetailBtn" class="tts-btn tts-btn-ghost">关闭</button>
        </div>
      `;

      // Upload logic
      const uploadArea = $("voiceUploadArea");
      const fileInput = $("voiceFileInput");
      uploadArea.addEventListener("click", () => fileInput.click());
      uploadArea.addEventListener("dragover", e => { e.preventDefault(); uploadArea.style.borderColor = "var(--tts-brand)"; });
      uploadArea.addEventListener("dragleave", () => { uploadArea.style.borderColor = "var(--tts-border)"; });
      uploadArea.addEventListener("drop", e => {
        e.preventDefault();
        uploadArea.style.borderColor = "var(--tts-border)";
        if (e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          uploadVoice(charId);
        }
      });
      fileInput.addEventListener("change", () => uploadVoice(charId));

      // Delete
      $("deleteCharBtn").addEventListener("click", async () => {
        if (!confirm("确定要删除此角色及其所有音频吗？")) return;
        await api("/api/tts/characters/" + charId, { method: "DELETE" });
        closeCharDetail();
        loadCharacters();
        showToast("角色已删除");
      });
      $("closeDetailBtn").addEventListener("click", closeCharDetail);

      // Delete voice buttons
      qsa(".tts-delete-voice").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const vid = btn.dataset.voiceId;
          await api("/api/tts/characters/" + charId + "/voices/" + vid, { method: "DELETE" });
          loadCharDetail(charId);
          loadCharacters();
        });
      });

    } catch (e) { showToast("加载角色详情失败: " + e.message); }
  }

  async function uploadVoice(charId) {
    const fileInput = $("voiceFileInput");
    if (!fileInput || !fileInput.files.length) return;
    const status = $("voiceUploadStatus");
    status.textContent = "上传中...";

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("emotion", $("voiceEmotion").value);
    formData.append("text", $("voiceRefText").value);

    try {
      const resp = await fetch("/api/tts/characters/" + charId + "/voices", { method: "POST", body: formData });
      if (!resp.ok) throw new Error((await resp.json()).detail || "上传失败");
      showToast("参考音频上传成功");
      fileInput.value = "";
      loadCharDetail(charId);
      loadCharacters();
    } catch (e) {
      status.textContent = "上传失败: " + e.message;
    }
  }

  // ===================== Single Synthesis =====================
  function refreshSynthCharSelect() {
    const sel = $("synthCharSelect");
    const chars = STATE.characters;
    sel.innerHTML = chars.length === 0
      ? '<option value="">-- 请先在角色库中创建角色 --</option>'
      : '<option value="">-- 选择角色 --</option>' +
        chars.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + ' (' + c.voice_count + ' 个音频)</option>').join("");
  }

  $("synthEmotionMode").addEventListener("change", () => {
    $("synthManualEmotionRow").style.display = $("synthEmotionMode").value === "manual" ? "" : "none";
  });

  $("synthesizeBtn").addEventListener("click", async () => {
    const charId = $("synthCharSelect").value;
    if (!charId) { showToast("请选择角色"); return; }
    const text = $("synthText").value.trim();
    if (!text) { showToast("请输入配音文本"); return; }

    const btn = $("synthesizeBtn");
    btn.disabled = true;
    btn.textContent = "生成中...";
    $("synthStatus").textContent = "正在合成语音，请稍候...";

    const emotionMode = $("synthEmotionMode").value;
    const body = {
      text,
      character_id: charId,
      emotion: emotionMode === "manual" ? $("synthManualEmotion").value : "auto",
      speed: parseFloat($("synthSpeed").value),
    };

    try {
      // Try local first, fallback to cloud
      let data;
      const useCloud = STATE.engine === "cloud" && STATE.cloudValid;
      if (useCloud) {
        data = await api("/api/tts/cloud/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            character_id: charId,
            auto_emotion: emotionMode !== "manual",
            speed: parseFloat($("synthSpeed").value),
          })
        });
      } else {
        data = await api("/api/tts/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }

      const list = $("synthResultList");
      const item = document.createElement("div");
      item.className = "tts-result-item";
      const emoInfo = data.emotion ? (typeof data.emotion === "object" ? (data.emotion.primary || "") : data.emotion) : "";
      item.innerHTML = `
        <span class="tts-result-meta">${esc(emoInfo)}</span>
        <audio controls src="${data.audio_url}"></audio>
        <span style="font-size:12px;color:var(--tts-sub);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(data.text || text)}</span>
      `;
      list.appendChild(item);
      $("synthResult").classList.remove("hidden");
      $("synthStatus").textContent = "生成成功";
      showToast("配音生成成功");
    } catch (e) {
      $("synthStatus").textContent = "生成失败: " + e.message;
      showToast("生成失败: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "生成配音";
    }
  });

  // ===================== Chapter Synthesis =====================
  $("detectSpeakersBtn").addEventListener("click", async () => {
    const text = $("chapterText").value.trim();
    if (!text) { showToast("请粘贴章节文本"); return; }

    // Detect speakers
    const speakers = new Set();
    const lines = text.split(/\n/);
    const pattern = /^([A-Za-z\u4e00-\u9fff\w]{1,10})[:\uff1a]/;
    lines.forEach(line => {
      const m = line.match(pattern);
      if (m) speakers.add(m[1].trim());
    });

    if (speakers.size === 0) {
      showToast("未检测到对话模式（格式：说话者: 内容）");
      return;
    }

    // Build character options
    const chars = STATE.characters;
    if (chars.length === 0) { showToast("请先在角色库中创建角色"); return; }
    const charOpts = '<option value="">-- 不映射 --</option>' + chars.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join("");

    $("speakerMapping").innerHTML = Array.from(speakers).map(s => `
      <div class="tts-speaker-row">
        <span class="spk-name">${esc(s)}</span>
        <select class="spk-select" data-speaker="${esc(s)}">${charOpts}</select>
      </div>
    `).join("");

    showToast("检测到 " + speakers.size + " 个说话者");
  });

  $("synthesizeChapterBtn").addEventListener("click", async () => {
    const text = $("chapterText").value.trim();
    if (!text) { showToast("请粘贴章节文本"); return; }

    const charMap = {};
    qsa(".spk-select").forEach(sel => {
      if (sel.value) charMap[sel.dataset.speaker] = sel.value;
    });
    if (Object.keys(charMap).length === 0) {
      showToast("请先检测说话者并映射角色");
      return;
    }

    const btn = $("synthesizeChapterBtn");
    btn.disabled = true;
    btn.textContent = "生成中...";
    $("chapterStatus").textContent = "正在批量生成语音...";

    try {
      const data = await api("/api/tts/synthesize-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_text: text, character_map: charMap, auto_emotion: true })
      });

      $("chapterResultSummary").textContent = "共 " + data.total + " 行，成功 " + data.succeeded + " 条，失败 " + data.failed + " 条";
      const list = $("chapterResultList");
      list.innerHTML = "";
      data.results.forEach(r => {
        const item = document.createElement("div");
        item.className = "tts-result-item";
        if (r.error) {
          item.innerHTML = '<span style="color:#e74c3c;font-size:12px">' + esc(r.speaker) + ': ' + esc(r.error) + '</span>';
        } else {
          item.innerHTML = `
            <span class="tts-result-meta">${esc(r.speaker)} | ${esc(r.emotion || "")}</span>
            <audio controls src="${r.audio_url}"></audio>
            <span style="font-size:12px;color:var(--tts-sub);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.text)}</span>
          `;
        }
        list.appendChild(item);
      });
      $("chapterResult").classList.remove("hidden");
      $("chapterStatus").textContent = "批量生成完成";
      showToast("批量配音完成：" + data.succeeded + "/" + data.total);
    } catch (e) {
      $("chapterStatus").textContent = "生成失败: " + e.message;
      showToast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "批量生成";
    }
  });

  // ===================== Init =====================
  loadCharacters();
  loadTokenStatus();
  checkHealth();
  setInterval(checkHealth, 30000);

});