// tts-generation.js - TTS Voice Generation Page

document.addEventListener("DOMContentLoaded", () => {

  // ==================== Tab Switching ====================
  const tabs = document.querySelectorAll(".tts-tab");
  const panels = document.querySelectorAll(".tts-panel");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      panels.forEach(p => p.classList.remove("is-active"));
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.add("is-active");
    });
  });

  // ==================== Toast ====================
  function showToast(msg) {
    const el = document.getElementById("page-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add("hidden"), 3000);
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ==================== indexTTS2 Server Health ====================
  async function checkServerHealth() {
    const dot = document.getElementById("ttsServerDot");
    const label = document.getElementById("ttsServerLabel");
    try {
      const resp = await fetch("/api/tts/health");
      const data = await resp.json();
      if (data.index_tts2_available) {
        if (dot) { dot.className = "online"; }
        if (label) { label.textContent = "indexTTS2 在线"; }
      } else {
        if (dot) { dot.className = "offline"; }
        if (label) { label.textContent = "indexTTS2 离线"; }
      }
    } catch {
      if (dot) { dot.className = "offline"; }
      if (label) { label.textContent = "indexTTS2 离线"; }
    }
  }
  checkServerHealth();
  setInterval(checkServerHealth, 30000);

  // ==================== Character Management ====================
  const charNameInput = document.getElementById("newCharName");
  const charDescInput = document.getElementById("newCharDesc");
  const createCharBtn = document.getElementById("createCharBtn");
  const characterList = document.getElementById("characterList");
  const synthCharSelect = document.getElementById("synthCharSelect");

  // Modal elements (created dynamically)
  let voiceUploadCharId = null;

  function buildUploadModal() {
    let modal = document.getElementById("ttsVoiceUploadModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "ttsVoiceUploadModal";
    modal.className = "tts-modal-overlay";
    modal.innerHTML = `
      <div class="tts-modal">
        <h3>上传参考音频</h3>
        <div class="tts-grid tts-grid-full">
          <label>情感类型
            <select id="voiceEmotion" class="tts-modal-emotion">
              <option value="happy">高兴</option>
              <option value="angry">愤怒</option>
              <option value="sad">悲伤</option>
              <option value="fearful">恐惧</option>
              <option value="surprised">惊讶</option>
              <option value="disgusted">反感</option>
              <option value="neutral">平静</option>
            </select>
          </label>
          <label>参考文本（可选）
            <input id="voiceText" type="text" placeholder="此音频对应的台词文本" />
          </label>
          <div>
            <label style="margin-bottom:6px">选择音频文件</label>
            <div class="tts-upload-area" id="voiceUploadArea">
              <p style="margin:0;font-size:13px;color:var(--tts-sub)">拖拽 .wav/.mp3 文件到此处，或点击选择</p>
              <input type="file" id="voiceFileInput" accept=".wav,.mp3" />
            </div>
            <p id="voiceFileLabel" class="micro-status"></p>
          </div>
        </div>
        <div class="card-footer">
          <button type="button" class="tts-btn tts-btn-ghost" id="voiceUploadCancel">取消</button>
          <button type="button" class="tts-btn tts-btn-brand" id="voiceUploadConfirm">上传</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event bindings
    modal.querySelector("#voiceUploadCancel").addEventListener("click", () => {
      modal.classList.remove("is-active");
      voiceUploadCharId = null;
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("is-active");
        voiceUploadCharId = null;
      }
    });

    const uploadArea = modal.querySelector("#voiceUploadArea");
    const fileInput = modal.querySelector("#voiceFileInput");
    const fileLabel = modal.querySelector("#voiceFileLabel");

    uploadArea.addEventListener("click", () => fileInput.click());
    uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.style.borderColor = "var(--tts-brand)"; });
    uploadArea.addEventListener("dragleave", () => { uploadArea.style.borderColor = "var(--tts-border)"; });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--tts-border)";
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileLabel.textContent = "已选择: " + e.dataTransfer.files[0].name;
      }
    });
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length) {
        fileLabel.textContent = "已选择: " + fileInput.files[0].name;
      }
    });

    modal.querySelector("#voiceUploadConfirm").addEventListener("click", async () => {
      if (!voiceUploadCharId) return;
      if (!fileInput.files.length) { showToast("请选择音频文件"); return; }

      const formData = new FormData();
      formData.append("file", fileInput.files[0]);
      formData.append("emotion", modal.querySelector("#voiceEmotion").value);
      formData.append("text", modal.querySelector("#voiceText").value);

      try {
        const resp = await fetch("/api/tts/characters/" + voiceUploadCharId + "/voices", {
          method: "POST", body: formData
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.detail || "上传失败");
        }
        showToast("参考音频上传成功");
        modal.classList.remove("is-active");
        voiceUploadCharId = null;
        loadCharacters();
      } catch (err) {
        showToast("上传失败: " + err.message);
      }
    });

    return modal;
  }

  function openVoiceUploadModal(charId) {
    const modal = buildUploadModal();
    voiceUploadCharId = charId;
    modal.classList.add("is-active");
    const fileInput = modal.querySelector("#voiceFileInput");
    const fileLabel = modal.querySelector("#voiceFileLabel");
    fileInput.value = "";
    fileLabel.textContent = "";
  }

  // Create character
  if (createCharBtn) {
    createCharBtn.addEventListener("click", async () => {
      const name = charNameInput.value.trim();
      if (!name) { showToast("请输入角色名称"); return; }
      try {
        const resp = await fetch("/api/tts/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, description: charDescInput.value.trim() })
        });
        if (!resp.ok) throw new Error("创建失败");
        const data = await resp.json();
        showToast("角色 " + data.name + " 创建成功");
        charNameInput.value = "";
        charDescInput.value = "";
        loadCharacters();
      } catch (err) {
        showToast("创建失败: " + err.message);
      }
    });
  }

  // Load characters and populate both list and synth dropdown
  async function loadCharacters() {
    try {
      const resp = await fetch("/api/tts/characters");
      const data = await resp.json();
      const chars = data.characters || [];

      // Render character list
      if (characterList) {
        if (chars.length === 0) {
          characterList.innerHTML = '<p class="micro-status">暂无角色，请先创建</p>';
        } else {
          characterList.innerHTML = chars.map(c => {
            const voiceChips = (c.voice_count > 0)
              ? '<div class="tts-voice-chips">（点击展开查看音色）</div>'
              : '<div class="tts-voice-chips"><span style="font-size:11px;color:var(--tts-sub)">暂无参考音频</span></div>';
            return `
              <div class="tts-char-item" data-char-id="${escapeHtml(c.id)}">
                <div class="tts-char-info">
                  <p class="tts-char-name">${escapeHtml(c.name)}</p>
                  <p class="tts-char-desc">${escapeHtml(c.description || "暂无描述")}</p>
                  <p class="tts-char-meta">${c.voice_count} 个参考音频</p>
                  <div class="tts-voice-chips" id="chips-${escapeHtml(c.id)}"></div>
                </div>
                <div class="tts-char-actions">
                  <button class="tts-btn tts-btn-ghost tts-btn-sm upload-voice-btn" data-char-id="${escapeHtml(c.id)}">上传音频</button>
                  <button class="tts-btn tts-btn-ghost tts-btn-sm delete-char-btn" data-char-id="${escapeHtml(c.id)}">删除</button>
                </div>
              </div>
            `;
          }).join("");

          // Bind upload buttons
          characterList.querySelectorAll(".upload-voice-btn").forEach(btn => {
            btn.addEventListener("click", () => openVoiceUploadModal(btn.dataset.charId));
          });
          // Bind delete buttons
          characterList.querySelectorAll(".delete-char-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
              if (!confirm("确定要删除此角色及其所有音频吗？")) return;
              try {
                const resp = await fetch("/api/tts/characters/" + btn.dataset.charId, { method: "DELETE" });
                if (!resp.ok) throw new Error("删除失败");
                showToast("角色已删除");
                loadCharacters();
              } catch (err) {
                showToast("删除失败: " + err.message);
              }
            });
          });

          // Load voice details for each character
          chars.forEach(c => loadVoiceDetails(c.id));
        }
      }

      // Populate synth dropdown
      if (synthCharSelect) {
        const currentVal = synthCharSelect.value;
        synthCharSelect.innerHTML = '<option value="">-- 选择角色 --</option>';
        chars.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name + " (" + c.voice_count + " 个参考音频)";
          synthCharSelect.appendChild(opt);
        });
        if (currentVal && chars.some(c => c.id === currentVal)) {
          synthCharSelect.value = currentVal;
        }
      }
    } catch (err) {
      console.error("Failed to load characters:", err);
    }
  }

  async function loadVoiceDetails(charId) {
    try {
      const resp = await fetch("/api/tts/characters/" + charId);
      const data = await resp.json();
      const voices = data.voices || [];
      const chipsEl = document.getElementById("chips-" + charId);
      if (!chipsEl) return;

      if (voices.length === 0) {
        chipsEl.innerHTML = '<span style="font-size:11px;color:var(--tts-sub)">暂无参考音频</span>';
        return;
      }

      chipsEl.innerHTML = voices.map(v => {
        const emo = v.emotion || "neutral";
        return `
          <span class="tts-voice-chip" title="${escapeHtml(v.text || "")}">
            <span class="emotion-dot emotion-${escapeHtml(emo)}"></span>
            ${escapeHtml(emo)}
          </span>
        `;
      }).join("");
    } catch (err) {
      console.error("Failed to load voice details for " + charId, err);
    }
  }

  // Initial load
  loadCharacters();

  // ==================== Synthesize ====================
  const synthEmotionMode = document.getElementById("synthEmotionMode");
  const synthManualEmotionLabel = document.getElementById("synthManualEmotionLabel");
  const synthesizeBtn = document.getElementById("synthesizeBtn");
  const synthResult = document.getElementById("synthResult");
  const synthResultList = document.getElementById("synthResultList");
  const synthStatus = document.getElementById("synthStatus");
  const synthText = document.getElementById("synthText");

  if (synthEmotionMode) {
    synthEmotionMode.addEventListener("change", () => {
      synthManualEmotionLabel.style.display = (synthEmotionMode.value === "manual") ? "" : "none";
    });
  }

  if (synthesizeBtn) {
    synthesizeBtn.addEventListener("click", async () => {
      const charId = synthCharSelect.value;
      if (!charId) { showToast("请选择角色"); return; }
      const text = synthText.value.trim();
      if (!text) { showToast("请输入配音文本"); return; }

      const emotionMode = synthEmotionMode ? synthEmotionMode.value : "auto";
      const manualEmotion = document.getElementById("synthManualEmotion");
      const body = {
        text: text,
        character_id: charId,
        emotion: emotionMode === "manual" && manualEmotion ? manualEmotion.value : "auto",
        speed: parseFloat(document.getElementById("synthSpeed") ? document.getElementById("synthSpeed").value : "1.0"),
      };

      synthesizeBtn.disabled = true;
      synthesizeBtn.textContent = "生成中...";
      if (synthStatus) synthStatus.textContent = "正在调用 indexTTS2 生成语音，请稍候...";

      try {
        const resp = await fetch("/api/tts/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.detail || "合成失败");
        }
        const data = await resp.json();

        const item = document.createElement("div");
        item.className = "tts-result-item";
        const emoInfo = data.emotion && data.emotion.primary
          ? (data.emotion.primary + (data.emotion.complex ? " (" + data.emotion.complex + ")" : ""))
          : "";
        item.innerHTML = `
          <audio controls class="audio-player">
            <source src="${data.audio_url}" type="audio/wav">
          </audio>
          <div class="tts-result-meta">
            <span>角色: ${escapeHtml(data.character || "")}</span>
            ${emoInfo ? ' | 情感: ' + escapeHtml(emoInfo) : ""}
            <br><span style="color:var(--tts-ink)">${escapeHtml(data.text || text)}</span>
          </div>
        `;
        synthResultList.appendChild(item);
        synthResult.classList.remove("hidden");
        if (synthStatus) synthStatus.textContent = "生成成功";
        showToast("配音生成成功");
      } catch (err) {
        console.error("Synthesis failed:", err);
        if (synthStatus) synthStatus.textContent = "合成失败: " + err.message;
        showToast("合成失败: " + err.message);
      } finally {
        synthesizeBtn.disabled = false;
        synthesizeBtn.textContent = "生成配音";
      }
    });
  }

  // ==================== Chapter Batch ====================
  const detectSpeakersBtn = document.getElementById("detectSpeakersBtn");
  const synthesizeChapterBtn = document.getElementById("synthesizeChapterBtn");
  const chapterText = document.getElementById("chapterText");
  const speakerMapping = document.getElementById("speakerMapping");
  const chapterStatus = document.getElementById("chapterStatus");
  const chapterResult = document.getElementById("chapterResult");
  const chapterResultSummary = document.getElementById("chapterResultSummary");
  const chapterResultList = document.getElementById("chapterResultList");

  let detectedSpeakerMap = {};

  if (detectSpeakersBtn && chapterText) {
    detectSpeakersBtn.addEventListener("click", async () => {
      const text = chapterText.value.trim();
      if (!text) { showToast("请粘贴章节文本"); return; }

      // Quick local detection: find "Name: ..." patterns
      const speakerSet = new Set();
      const lines = text.split(/\n/);
      const speakerPattern = /^([A-Za-z\u4e00-\u9fff\w]{1,10})[:\uff1a]/;
      lines.forEach(line => {
        const m = line.match(speakerPattern);
        if (m) speakerSet.add(m[1].trim());
      });

      if (speakerSet.size === 0) {
        showToast("未检测到对话模式（格式：说话者: 内容）");
        return;
      }

      const speakers = Array.from(speakerSet);
      detectedSpeakerMap = {};

      // Fetch available characters
      let charOpts = '<option value="">-- 不映射 --</option>';
      try {
        const resp = await fetch("/api/tts/characters");
        const data = await resp.json();
        (data.characters || []).forEach(c => {
          charOpts += `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`;
        });
      } catch (e) { /* empty */ }

      speakerMapping.innerHTML = speakers.map(s => {
        // Auto-match character by name similarity
        const autoMatchId = "";
        return `
          <div class="tts-speaker-row">
            <span class="speaker-name">${escapeHtml(s)}</span>
            <select class="speaker-select" data-speaker="${escapeHtml(s)}">
              ${charOpts}
            </select>
          </div>
        `;
      }).join("");

      showToast("检测到 " + speakers.length + " 个说话者，请选择对应角色");
    });
  }

  if (synthesizeChapterBtn) {
    synthesizeChapterBtn.addEventListener("click", async () => {
      const text = chapterText.value.trim();
      if (!text) { showToast("请粘贴章节文本"); return; }

      const charMap = {};
      const selects = speakerMapping.querySelectorAll(".speaker-select");
      selects.forEach(sel => {
        if (sel.value) {
          charMap[sel.dataset.speaker] = sel.value;
        }
      });

      if (Object.keys(charMap).length === 0) {
        showToast("请至少为一个说话者映射角色");
        return;
      }

      synthesizeChapterBtn.disabled = true;
      synthesizeChapterBtn.textContent = "生成中...";
      if (chapterStatus) chapterStatus.textContent = "正在批量生成语音，请耐心等待...";

      try {
        const resp = await fetch("/api/tts/synthesize-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapter_text: text,
            character_map: charMap,
            auto_emotion: true
          })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.detail || "批量生成失败");
        }
        const data = await resp.json();

        if (chapterResultSummary) {
          chapterResultSummary.innerHTML = `
            共 ${data.total} 行，成功 ${data.succeeded} 条，失败 ${data.failed} 条
          `;
        }

        if (chapterResultList) {
          chapterResultList.innerHTML = "";
          data.results.forEach(r => {
            const item = document.createElement("div");
            item.className = "tts-result-item";
            if (r.error) {
              item.innerHTML = `
                <span style="color:#e74c3c;font-size:12px">${escapeHtml(r.speaker)}: 失败 - ${escapeHtml(r.error)}</span>
              `;
            } else {
              item.innerHTML = `
                <span class="tts-result-meta">${escapeHtml(r.speaker)} | ${escapeHtml(r.emotion || "")}</span>
                <audio controls class="audio-player">
                  <source src="${r.audio_url}" type="audio/wav">
                </audio>
                <span style="font-size:12px;color:var(--tts-sub)">${escapeHtml(r.text)}</span>
              `;
            }
            chapterResultList.appendChild(item);
          });
        }

        chapterResult.classList.remove("hidden");
        if (chapterStatus) chapterStatus.textContent = "批量生成完成";
        showToast("批量配音完成：" + data.succeeded + " 条成功，共 " + data.total + " 条");
      } catch (err) {
        console.error("Chapter synthesis failed:", err);
        if (chapterStatus) chapterStatus.textContent = "批量生成失败: " + err.message;
        showToast("批量生成失败: " + err.message);
      } finally {
        synthesizeChapterBtn.disabled = false;
        synthesizeChapterBtn.textContent = "批量生成";
      }
    });
  }

});