// audio-generation.js - 音频生成页面前端逻辑

document.addEventListener('DOMContentLoaded', () => {
  // ========== 1. 标签切换逻辑 ==========
  const tabs = document.querySelectorAll('.audio-tab');
  const panels = document.querySelectorAll('.audio-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;

      // 更新标签状态
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      // 更新面板显示
      panels.forEach(p => p.classList.remove('is-active'));
      document.getElementById(target).classList.add('is-active');
    });
  });

  // ========== 2. 导入 Word 文档 ==========
  const docxInput = document.getElementById('docxFileInput');
  const importBtn = document.getElementById('importDocxBtn');
  const importStatus = document.getElementById('importDocxStatus');

  if (importBtn && docxInput) {
    importBtn.addEventListener('click', async () => {
      if (!docxInput.files.length) {
        showToast('请先选择 Word 文档');
        return;
      }

      const file = docxInput.files[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        importStatus.textContent = '正在导入...';
        const resp = await fetch('/api/audio/import-docx', {
          method: 'POST',
          body: formData
        });

        if (!resp.ok) throw new Error('导入失败');

        const data = await resp.json();
        
        // 填充表单
        if (data.title) {
          document.getElementById('novelTitleInput').value = data.title;
        }
        
        // 填充章节内容到文本框
        if (data.chapters && data.chapters.length > 0) {
          // 如果有多个章节，取第一个章节的内容
          const firstChapter = data.chapters[0];
          const contentText = firstChapter && firstChapter.content ? firstChapter.content : (firstChapter || '');
          document.getElementById('chapterContentInput').value = contentText;
          
          // 如果有多个章节，提示用户
          if (data.chapter_count > 1) {
            showToast(`已导入 ${data.chapter_count} 个章节，已加载第一章内容`);
          } else {
            showToast('Word 文档导入成功');
          }
          
          // 填充章节选择下拉框
          const chapterSelect = document.getElementById('chapterSelect');
          if (chapterSelect) {
            chapterSelect.innerHTML = '<option value="all">全部章节</option>';
            if (data.chapters && Array.isArray(data.chapters)) {
              data.chapters.forEach((ch, idx) => {
                const option = document.createElement('option');
                option.value = idx;
                option.textContent = (ch && ch.title) ? ch.title : `第 ${idx + 1} 章`;
                chapterSelect.appendChild(option);
              });
            }
          }
        } else {
          showToast('Word 文档导入成功');
        }

        importStatus.textContent = '导入成功！';
      } catch (err) {
        importStatus.textContent = '导入失败：' + err.message;
        showToast('导入失败，请检查文件格式');
      }
    });
  }

  // ========== 3. 分析章节内容 ==========
  const analyzeBtn = document.getElementById('analyzeBtn');
  const analysisResult = document.getElementById('analysisResult');

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      const title = document.getElementById('novelTitleInput')?.value || '';
      const chapterContent = document.getElementById('chapterContentInput')?.value || '';

      if (!title) {
        showToast('请输入小说标题');
        return;
      }

      if (!chapterContent) {
        showToast('请先导入文档或输入章节内容');
        return;
      }

      try {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = '分析中...';

        // 调用后端 API 分析章节
        const resp = await fetch('/api/audio/analyze-chapter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapter_number: 1,
            chapter_title: title,
            chapter_content: chapterContent,
            music_duration: 30.0,
            generate_effects: true
          })
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error('分析失败: ' + errText);
        }

        const data = await resp.json();

        // 显示分析结果
        const summaryData = data.summary || (data[0] && data[0].summary) || {};
        const audioPrompts = data.audio_prompts || (data[0] && data[0].audio_prompts) || {};
        const hints = summaryData.audio_hints || {};

        // --- 摘要 ---
        const summaryEl = document.getElementById('analysisSummary');
        if (summaryEl) {
          const text = summaryData.summary || '';
          summaryEl.textContent = typeof text === 'string' ? text : JSON.stringify(text);
        }

        // --- 情绪标签 ---
        const moodEl = document.getElementById('analysisMood');
        if (moodEl) {
          const mood = summaryData.mood || '';
          moodEl.textContent = mood;
          moodEl.className = 'mood-badge mood-' + (mood || 'neutral');
        }

        // --- 音乐风格/节拍/乐器标签 ---
        const styleTagsEl = document.getElementById('analysisMusicTags');
        if (styleTagsEl) {
          styleTagsEl.innerHTML = '';
          var tags = [];
          if (hints.music_style) tags.push({ label: hints.music_style, cls: 'tag-style' });
          if (hints.tempo) tags.push({ label: hints.tempo, cls: 'tag-tempo' });
          if (hints.instruments && Array.isArray(hints.instruments)) {
            hints.instruments.forEach(function(inst) { tags.push({ label: inst, cls: 'tag-instrument' }); });
          }
          tags.forEach(function(t) {
            var span = document.createElement('span');
            span.className = 'audio-tag ' + t.cls;
            span.textContent = t.label;
            styleTagsEl.appendChild(span);
          });
        }

        // --- 情绪曲线 ---
        const emotionEl = document.getElementById('analysisEmotionCurve');
        if (emotionEl) {
          emotionEl.innerHTML = '';
          var curve = summaryData.emotion_curve;
          if (curve && Array.isArray(curve) && curve.length > 0) {
            curve.forEach(function(point) {
              var bar = document.createElement('div');
              bar.className = 'emotion-bar';
              var pct = Math.round((point.intensity || 0.5) * 100);
              bar.innerHTML =
                '<span class="emotion-label">' + escapeHtml(point.segment || '') + '</span>' +
                '<span class="emotion-mood">' + escapeHtml(point.mood || '') + '</span>' +
                '<div class="emotion-fill"><div class="emotion-fill-inner" style="width:' + pct + '%"></div></div>';
              emotionEl.appendChild(bar);
            });
          } else {
            emotionEl.innerHTML = '<p class="micro-status">无情绪曲线数据</p>';
          }
        }

        // --- 音乐提示词 (可编辑) ---
        const musicPromptEl = document.getElementById('musicPromptInput');
        if (musicPromptEl) {
          var prompt = audioPrompts.music_prompt || hints.background_music || '';
          musicPromptEl.value = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        }

        // --- 音效提示词列表 ---
        const effectsListEl = document.getElementById('effectsPromptsList');
        if (effectsListEl) {
          effectsListEl.innerHTML = '';
          var effects = audioPrompts.effect_prompts || hints.sound_effects || [];
          if (effects && ((Array.isArray(effects) && effects.length > 0) || (typeof effects === 'object' && Object.keys(effects).length > 0))) {
            var effList = Array.isArray(effects) ? effects : [effects];
            effList.forEach(function(item, idx) {
              var desc = typeof item === 'string' ? item : (item.description || item.desc || JSON.stringify(item));
              var time = (typeof item === 'object' && item.time) ? item.time : null;
              var div = document.createElement('div');
              div.className = 'effect-prompt-item';
              div.innerHTML =
                '<span class="effect-idx">#' + (idx + 1) + '</span>' +
                (time ? '<span class="effect-time">' + escapeHtml(String(time)) + '</span>' : '') +
                '<input type="text" value="' + escapeHtml(String(desc)) + '" class="effect-prompt-input" data-idx="' + idx + '" />';
              effectsListEl.appendChild(div);
            });
          } else {
            effectsListEl.innerHTML = '<p class="micro-status">未检测到音效提示词，可手动添加</p>';
          }
        }

        analysisResult.classList.remove('hidden');
        showToast('内容分析完成');
      } catch (err) {
        console.error('分析失败:', err);
        showToast('分析失败：' + err.message);
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '分析内容并生成提示词 →';
      }
    });
  }

  // ========== 工具函数 ==========
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== 4. 生成背景音乐 ==========
  const generateMusicBtn = document.getElementById('generateMusicBtn');
  const generateMusicBtn2 = document.getElementById('generateMusicBtn2');
  const musicResult = document.getElementById('musicResult');

  async function generateMusic(event) {
    const description = document.getElementById('musicPromptInput')?.value ||
                      document.getElementById('musicStyleInput')?.value;
    const duration = document.getElementById('musicDurationInput')?.value || 10;

    if (!description) {
      showToast('请输入音乐提示词');
      return;
    }

    try {
      const btn = event ? event.target : document.getElementById('generateMusicBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中...';
      }

      // 调用后端 API 生成音乐（参数名必须是 description）
      const resp = await fetch('/api/audio/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description,
          duration: parseInt(duration),
          guidance_scale: 3.0
        })
      });

      if (!resp.ok) throw new Error('生成失败');

      const data = await resp.json();

      // 显示生成结果（后端返回 audio_path，不是 audio_url）
      const resultList = document.getElementById('musicResultList');
      const item = document.createElement('div');
      item.className = 'audio-result-item';
      const audioUrl = '/' + data.audio_path.replace(/\\/g, '/');
      item.innerHTML = `
        <audio controls class="audio-player">
          <source src="${audioUrl}" type="audio/wav">
        </audio>
        <div class="audio-info">${data.description || '背景音乐'}</div>
        <div class="audio-actions">
          <button class="audio-btn audio-btn-ghost" onclick="downloadAudio('${audioUrl}')">下载</button>
        </div>
      `;
      resultList.appendChild(item);

      musicResult.classList.remove('hidden');
      showToast('音乐生成成功');
    } catch (err) {
      console.error('生成音乐失败:', err);
      showToast('生成失败：' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '生成背景音乐';
      }
    }
  }

  if (generateMusicBtn) generateMusicBtn.addEventListener('click', (e) => generateMusic(e));
  if (generateMusicBtn2) generateMusicBtn2.addEventListener('click', (e) => generateMusic(e));

  // ========== 5. 生成音效 ==========
  const generateEffectsBtn = document.getElementById('generateEffectsBtn');
  const generateAllEffectsBtn = document.getElementById('generateAllEffectsBtn');
  const effectsResult = document.getElementById('effectsResult');

  async function generateEffects(event) {
    const descriptions = [];
    document.querySelectorAll('.effect-prompt-input').forEach(input => {
      if (input.value) descriptions.push(input.value);
    });

    if (!descriptions.length) {
      showToast('请先添加音效提示词');
      return;
    }

    try {
      const btn = event ? event.target : document.getElementById('generateEffectsBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中...';
      }

      // 调用后端 API 生成音效（参数名必须是 descriptions）
      const resp = await fetch('/api/audio/generate-effects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptions: descriptions,
          duration: 5.0
        })
      });

      if (!resp.ok) throw new Error('生成失败');

      const data = await resp.json();

      // 显示生成结果（后端返回数组，每个元素有 audio_path）
      const resultList = document.getElementById('effectsResultList');
      if (data && Array.isArray(data)) {
        data.forEach((item, idx) => {
          const resultItem = document.createElement('div');
          resultItem.className = 'audio-result-item';
          const audioPath = item && item.audio_path ? item.audio_path : '';
          const audioUrl = audioPath ? '/' + audioPath.replace(/\\/g, '/') : '';
          const desc = (item && item.description) ? item.description : ('音效 ' + (idx + 1));
          resultItem.innerHTML = `
            <div class="audio-info">${escapeHtml(String(desc))}</div>
            <audio controls class="audio-player">
              <source src="${audioUrl}" type="audio/wav">
            </audio>
            <div class="audio-actions">
              <button class="audio-btn audio-btn-ghost" onclick="downloadAudio('${audioUrl}')">下载</button>
            </div>
          `;
          resultList.appendChild(resultItem);
        });
      } else {
        console.error('Unexpected response format:', data);
        throw new Error('生成失败：返回数据格式错误');
      }

      effectsResult.classList.remove('hidden');
      showToast('音效生成成功');
    } catch (err) {
      console.error('生成音效失败:', err);
      showToast('生成失败：' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '生成音效';
      }
    }
  }

  if (generateEffectsBtn) generateEffectsBtn.addEventListener('click', (e) => generateEffects(e));
  if (generateAllEffectsBtn) generateAllEffectsBtn.addEventListener('click', (e) => generateEffects(e));

  // ========== 6. 添加音效输入框 ==========
  const addEffectBtn = document.getElementById('addEffectBtn');
  if (addEffectBtn) {
    addEffectBtn.addEventListener('click', () => {
      const effectsList = document.getElementById('effectsList');
      const div = document.createElement('div');
      div.className = 'audio-effect-item';
      div.innerHTML = `
        <label>音效提示词
          <input type="text" placeholder="如：雨声、脚步声" class="effect-prompt-input" />
        </label>
      `;
      effectsList.appendChild(div);
    });
  }

  // ========== 7. 导出功能 ==========
  const downloadMusicBtn = document.getElementById('downloadMusicBtn');
  const downloadEffectsBtn = document.getElementById('downloadEffectsBtn');
  const exportAudiobookBtn = document.getElementById('exportAudiobookBtn');

  if (downloadMusicBtn) {
    downloadMusicBtn.addEventListener('click', () => {
      // 下载所有背景音乐
      document.querySelectorAll('#musicResultList audio').forEach(audio => {
        const url = audio.querySelector('source').src;
        downloadAudio(url);
      });
    });
  }

  if (downloadEffectsBtn) {
    downloadEffectsBtn.addEventListener('click', () => {
      // 下载所有音效
      document.querySelectorAll('#effectsResultList audio').forEach(audio => {
        const url = audio.querySelector('source').src;
        downloadAudio(url);
      });
    });
  }

  if (exportAudiobookBtn) {
    exportAudiobookBtn.addEventListener('click', async () => {
      try {
        exportAudiobookBtn.disabled = true;
        exportAudiobookBtn.textContent = '导出中...';

        const resp = await fetch('/api/audio/generate-chapter-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: document.getElementById('novelTitleInput').value,
            chapters: ['all']
          })
        });

        if (!resp.ok) throw new Error('导出失败');

        const data = await resp.json();
        showToast('有声书导出成功！');
        window.open(data.audiobook_url, '_blank');
      } catch (err) {
        showToast('导出失败：' + err.message);
      } finally {
        exportAudiobookBtn.disabled = false;
        exportAudiobookBtn.textContent = '导出有声书';
      }
    });
  }

  // ========== 工具函数 ==========
  function showToast(msg) {
    const toast = document.getElementById('page-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  window.downloadAudio = function(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = url.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
});
