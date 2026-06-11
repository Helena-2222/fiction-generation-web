// audio-generation.js - audio page logic
document.addEventListener("DOMContentLoaded", function() {
  console.log("[audio-gen] init");


  function escapeHtml(t) {
    var d = document.createElement("div");
    d.textContent = t || "";
    return d.innerHTML;
  }

  function toast(m) {
    var t = document.getElementById("page-toast");
    if (!t) return;
    t.textContent = m;
    t.classList.remove("hidden");
    clearTimeout(t._tid);
    t._tid = setTimeout(function() { t.classList.add("hidden"); }, 3500);
  }

  function showErr(el, m) { if (el) { el.textContent = m; el.classList.remove("hidden"); } }
  function hideErr(el) { if (el) { el.textContent = ""; el.classList.add("hidden"); } }

  window.downloadAudio = function(url) {
    var a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ========== Model defs ==========
  var musicModels = {
    musicgen: [
      { v: "facebook/musicgen-small", l: "musicgen-small (300M)" },
      { v: "facebook/musicgen-medium", l: "musicgen-medium (1.5B)" },
      { v: "facebook/musicgen-large", l: "musicgen-large (3.3B)" }
    ],
    "stable-audio": [
      { v: "stabilityai/stable-audio-3-small-music", l: "SA3-small-music (~1B)" },
      { v: "stabilityai/stable-audio-3-medium", l: "SA3-medium (~3B)" }
    ]
  };

  var effectsModels = {
    musicgen: [
      { v: "facebook/audiogen-medium", l: "audiogen-medium (1.5B)" }
    ],
    "stable-audio": [
      { v: "stabilityai/stable-audio-3-small-sfx", l: "SA3-small-sfx (~1B)" }
    ]
  };

  // ========== Tab switching ==========
  var tabBtns = document.querySelectorAll(".audio-tab");
  var panels = document.querySelectorAll(".audio-panel");
  console.log("[audio-gen] tabs=" + tabBtns.length + " panels=" + panels.length);

  function switchTab(id) {
    console.log("[audio-gen] switchTab: " + id);
    for (var i = 0; i < tabBtns.length; i++) tabBtns[i].classList.remove("is-active");
    for (var j = 0; j < panels.length; j++) panels[j].classList.remove("is-active");
    var tb = document.querySelector(".audio-tab[data-target=\"" + id + "\"]");
    var pn = document.getElementById(id);
    if (tb) tb.classList.add("is-active");
    if (pn) pn.classList.add("is-active");
  }

  for (var k = 0; k < tabBtns.length; k++) {
    (function(tab) {
      tab.addEventListener("click", function(e) {
        e.preventDefault();
        switchTab(tab.getAttribute("data-target"));
      });
    })(tabBtns[k]);
  }

  // ========== Music model ==========
  var mtype = document.getElementById("musicModelTypeSelect");
  var mvar = document.getElementById("musicModelVariantSelect");
  var mstat = document.getElementById("musicModelSwitchStatus");

  function updMusicDropdown() {
    var t = mtype.value;
    var vs = musicModels[t] || [];
    mvar.innerHTML = "";
    for (var i = 0; i < vs.length; i++) {
      var o = document.createElement("option");
      o.value = vs[i].v;
      o.textContent = vs[i].l;
      mvar.appendChild(o);
    }
  }

  if (mtype && mvar) {
    mtype.addEventListener("change", function() { updMusicDropdown(); switchMusicModel(); });
    mvar.addEventListener("change", switchMusicModel);
  }

  async function switchMusicModel() {
    if (mstat) mstat.textContent = "Switching...";
    try {
      var r = await fetch("/api/audio/switch-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_type: mtype.value, model_name: mvar.value })
      });
      var d = await r.json();
      if (mstat) mstat.textContent = r.ok ? "OK: " + d.message : "Fail: " + (d.detail || "");
    } catch (e) { if (mstat) mstat.textContent = "Error: " + e.message; }
  }

  // ========== Effects model ==========
  var etype = document.getElementById("effectsModelTypeSelect");
  var evar = document.getElementById("effectsModelVariantSelect");
  var estat = document.getElementById("effectsModelSwitchStatus");

  function updEffectsDropdown() {
    var t = etype.value;
    var vs = effectsModels[t] || [];
    evar.innerHTML = "";
    for (var i = 0; i < vs.length; i++) {
      var o = document.createElement("option");
      o.value = vs[i].v;
      o.textContent = vs[i].l;
      evar.appendChild(o);
    }
  }

  if (etype && evar) {
    etype.addEventListener("change", function() { updEffectsDropdown(); switchEffectsModel(); });
    evar.addEventListener("change", switchEffectsModel);
  }

  async function switchEffectsModel() {
    if (estat) estat.textContent = "Switching...";
    try {
      var r = await fetch("/api/audio/switch-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_type: etype.value, model_name: evar.value })
      });
      var d = await r.json();
      if (estat) estat.textContent = r.ok ? "OK: " + d.message : "Fail: " + (d.detail || "");
    } catch (e) { if (estat) estat.textContent = "Error: " + e.message; }
  }

  // ========== Word import ==========
  var docxIn = document.getElementById("docxFileInput");
  var impBtn = document.getElementById("importDocxBtn");
  var impStat = document.getElementById("importDocxStatus");

  if (impBtn && docxIn) {
    impBtn.addEventListener("click", async function() {
      if (!docxIn.files.length) { toast("Please select a file"); return; }
      impBtn.disabled = true;
      try {
        impStat.textContent = "Importing...";
        var fd = new FormData();
        fd.append("file", docxIn.files[0]);
        var r = await fetch("/api/audio/import-docx", { method: "POST", body: fd });
        if (!r.ok) throw new Error("Import failed: HTTP " + r.status);
        var d = await r.json();
        if (d.title) document.getElementById("novelTitleInput").value = d.title;
        if (d.chapters && d.chapters.length) {
          var fc = d.chapters[0];
          document.getElementById("chapterContentInput").value = (fc && fc.content) ? fc.content : (fc || "");
          toast(d.chapter_count > 1 ? "Imported " + d.chapter_count + " chapters" : "Imported");
          var cs = document.getElementById("chapterSelect");
          if (cs) {
            cs.innerHTML = '<option value="all">All</option>';
            if (Array.isArray(d.chapters)) {
              for (var i = 0; i < d.chapters.length; i++) {
                var ch = d.chapters[i];
                var o = document.createElement("option");
                o.value = i;
                o.textContent = (ch && ch.title) ? ch.title : "Ch " + (i + 1);
                cs.appendChild(o);
              }
            }
          }
        }
        impStat.textContent = "Done";
      } catch (e) {
        impStat.textContent = "Error: " + e.message;
        toast("Import error: " + e.message);
      } finally { impBtn.disabled = false; }
    });
  }

  // ========== Analyze ==========
  var anBtn = document.getElementById("analyzeBtn");
  var anRes = document.getElementById("analysisResult");

  if (anBtn) {
    anBtn.addEventListener("click", async function() {
      console.log("[audio-gen] analyze clicked");
      var ti = document.getElementById("novelTitleInput");
      var ci = document.getElementById("chapterContentInput");
      var title = ti ? ti.value : "";
      var content = ci ? ci.value : "";

      if (!title) { toast("Enter title"); return; }
      if (!content) { toast("Enter content"); return; }

      anBtn.disabled = true;
      var orig = anBtn.textContent;
      anBtn.textContent = "Analyzing...";

      try {
        var r = await fetch("/api/audio/analyze-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapter_number: 1, chapter_title: title, chapter_content: content, music_duration: 30, generate_effects: true })
        });
        if (!r.ok) { var et = await r.text(); throw new Error("HTTP " + r.status + ": " + et); }
        var d = await r.json();

        var sd = d.summary || (d[0] && d[0].summary) || {};
        var ap = d.audio_prompts || (d[0] && d[0].audio_prompts) || {};
        var hints = sd.audio_hints || {};

        var se = document.getElementById("analysisSummary");
        if (se) { var t = sd.summary || ""; se.textContent = typeof t === "string" ? t : JSON.stringify(t); }

        var me = document.getElementById("analysisMood");
        if (me) { var m = sd.mood || ""; me.textContent = m; me.className = "mood-badge mood-" + (m || "neutral"); }

        var te = document.getElementById("analysisMusicTags");
        if (te) {
          te.innerHTML = "";
          var tags = [];
          if (hints.music_style) tags.push({ l: hints.music_style, c: "tag-style" });
          if (hints.tempo) tags.push({ l: hints.tempo, c: "tag-tempo" });
          if (hints.instruments && Array.isArray(hints.instruments)) {
            for (var i = 0; i < hints.instruments.length; i++) tags.push({ l: hints.instruments[i], c: "tag-instrument" });
          }
          for (var j = 0; j < tags.length; j++) {
            var sp = document.createElement("span");
            sp.className = "audio-tag " + tags[j].c;
            sp.textContent = tags[j].l;
            te.appendChild(sp);
          }
        }

        var ee = document.getElementById("analysisEmotionCurve");
        if (ee) {
          ee.innerHTML = "";
          var cv = sd.emotion_curve;
          if (cv && Array.isArray(cv) && cv.length) {
            for (var i = 0; i < cv.length; i++) {
              var p = cv[i];
              var bar = document.createElement("div");
              bar.className = "emotion-bar";
              var pct = Math.round((p.intensity || 0.5) * 100);
              bar.innerHTML = "<span class=\"emotion-label\">" + escapeHtml(p.segment || "") + "</span><span class=\"emotion-mood\">" + escapeHtml(p.mood || "") + "</span><div class=\"emotion-fill\"><div class=\"emotion-fill-inner\" style=\"width:" + pct + "%\"></div></div>";
              ee.appendChild(bar);
            }
          } else {
            ee.innerHTML = "<p class=\"micro-status\">No emotion data</p>";
          }
        }

        var mp = ap.music_prompt || hints.background_music || "";
        var mpe = document.getElementById("musicPromptInput");
        if (mpe) mpe.value = typeof mp === "string" ? mp : JSON.stringify(mp);
        var msi = document.getElementById("musicStyleInput");
        if (msi && mp) msi.value = typeof mp === "string" ? mp : JSON.stringify(mp);

        var epl = document.getElementById("effectsPromptsList");
        if (epl) {
          epl.innerHTML = "";
          var ef = ap.effect_prompts || hints.sound_effects || [];
          if (ef && ((Array.isArray(ef) && ef.length) || (typeof ef === "object" && Object.keys(ef).length))) {
            var el = Array.isArray(ef) ? ef : [ef];
            for (var i = 0; i < el.length; i++) {
              var it = el[i];
              var desc = typeof it === "string" ? it : (it.description || it.desc || JSON.stringify(it));
              var tm = (typeof it === "object" && it.time) ? it.time : null;
              var dv = document.createElement("div");
              dv.className = "effect-prompt-item";
              dv.innerHTML = "<span class=\"effect-idx\">#" + (i + 1) + "</span>" + (tm ? "<span class=\"effect-time\">" + escapeHtml(String(tm)) + "</span>" : "") + "<input type=\"text\" value=\"" + escapeHtml(String(desc)) + "\" class=\"effect-prompt-input\" data-idx=\"" + i + "\" />";
              epl.appendChild(dv);
            }
          } else {
            epl.innerHTML = "<p class=\"micro-status\">No effects detected</p>";
          }
        }

        syncFx();
        anRes.classList.remove("hidden");
        toast("Analysis done");
      } catch (e) {
        console.error("[audio-gen] analyze error:", e);
        toast("Error: " + e.message);
      } finally {
        anBtn.disabled = false;
        anBtn.textContent = orig;
      }
    });
  }

  function syncFx() {
    var fl = document.getElementById("effectsList");
    if (!fl) return;
    var ins = document.querySelectorAll("#effectsPromptsList .effect-prompt-input");
    if (!ins.length) return;
    fl.innerHTML = "";
    for (var i = 0; i < ins.length; i++) {
      var dv = document.createElement("div");
      dv.className = "audio-effect-item";
      dv.innerHTML = "<label>Effect prompt<input type=\"text\" class=\"effect-prompt-input\" value=\"" + escapeHtml(ins[i].value) + "\" /></label>";
      fl.appendChild(dv);
    }
  }

  // ========== Nav buttons ==========
  var gmb = document.getElementById("gotoMusicBtn");
  var geb = document.getElementById("gotoEffectsBtn");
  if (gmb) gmb.addEventListener("click", function() {
    var mp = document.getElementById("musicPromptInput");
    var ms = document.getElementById("musicStyleInput");
    if (mp && ms && mp.value) ms.value = mp.value;
    switchTab("music-panel");
  });
  if (geb) geb.addEventListener("click", function() {
    syncFx();
    switchTab("effects-panel");
  });

  // ========== Generate music ==========
  var gmb2 = document.getElementById("generateMusicBtn2");
  var mres = document.getElementById("musicResult");
  var merr = document.getElementById("musicError");

  if (gmb2) gmb2.addEventListener("click", function() { genMusic(gmb2); });

  async function genMusic(btn) {
    var de = document.getElementById("musicStyleInput");
    var du = document.getElementById("musicDurationInput");
    var desc = de ? de.value : "";
    var dur = parseInt(du ? du.value : 10) || 10;
    if (!desc) { toast("Enter music prompt"); return; }

    if (mtype && mvar) {
      try { await fetch("/api/audio/switch-model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model_type: mtype.value, model_name: mvar.value }) }); } catch (e) {}
    }

    var orig = btn ? btn.textContent : "";
    try {
      if (btn) { btn.disabled = true; btn.textContent = "Generating..."; }
      hideErr(merr);
      var r = await fetch("/api/audio/generate-music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: desc, duration: dur, guidance_scale: 3 }) });
      if (!r.ok) { var et406 = await r.text(); var ed406; try { ed406 = JSON.parse(et406); } catch (e2) { ed406 = { detail: et406 }; } throw new Error(ed406.detail || ("HTTP " + r.status)); }
      var d = await r.json();
      var rl = document.getElementById("musicResultList");
      var it = document.createElement("div");
      it.className = "audio-result-item";
      var au = "/" + (d.audio_path || "").replace(/\\/g, "/");
      it.innerHTML = "<audio controls class=\"audio-player\"><source src=\"" + au + "\" type=\"audio/wav\"></audio><div class=\"audio-info\">" + escapeHtml(d.description || "BGM") + "</div><div class=\"audio-actions\"><button class=\"audio-btn audio-btn-ghost\" onclick=\"downloadAudio('" + au + "')\">Download</button></div>";
      rl.appendChild(it);
      mres.classList.remove("hidden");
      hideErr(merr);
      toast("Music generated");
    } catch (e) {
      console.error(e);
      showErr(merr, "Error: " + e.message);
      toast("Error: " + e.message);
    } finally { if (btn) { btn.disabled = false; btn.textContent = orig || "Generate"; } }
  }

  // ========== Generate effects ==========
  var geb2 = document.getElementById("generateAllEffectsBtn");
  var eres = document.getElementById("effectsResult");
  var eerr = document.getElementById("effectsError");

  if (geb2) geb2.addEventListener("click", function() { genFx(geb2); });

  async function genFx(btn) {
    var descs = [];
    var ins = document.querySelectorAll("#effectsList .effect-prompt-input");
    for (var i = 0; i < ins.length; i++) { if (ins[i].value) descs.push(ins[i].value); }
    if (!descs.length) { toast("Add effect prompts first"); return; }

    if (etype && evar) {
      try { await fetch("/api/audio/switch-model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model_type: etype.value, model_name: evar.value }) }); } catch (e) {}
    }

    var orig = btn ? btn.textContent : "";
    try {
      if (btn) { btn.disabled = true; btn.textContent = "Generating..."; }
      hideErr(eerr);
      var r = await fetch("/api/audio/generate-effects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descriptions: descs, duration: 5 }) });
      if (!r.ok) { var et406 = await r.text(); var ed406; try { ed406 = JSON.parse(et406); } catch (e2) { ed406 = { detail: et406 }; } throw new Error(ed406.detail || ("HTTP " + r.status)); }
      var d = await r.json();
      var rl = document.getElementById("effectsResultList");
      if (d && Array.isArray(d)) {
        for (var i = 0; i < d.length; i++) {
          var it = d[i];
          if (it.error) {
            var ei = document.createElement("div");
            ei.className = "audio-result-item audio-result-error";
            ei.innerHTML = "<div class=\"audio-info\">FX " + (i + 1) + ": " + escapeHtml(it.description || "") + "</div><div class=\"audio-error-inline\">Error: " + escapeHtml(it.error) + "</div>";
            rl.appendChild(ei);
            continue;
          }
          var ri = document.createElement("div");
          ri.className = "audio-result-item";
          var ap = it && it.audio_path ? it.audio_path : "";
          var au = ap ? "/" + ap.replace(/\\/g, "/") : "";
          ri.innerHTML = "<div class=\"audio-info\">" + escapeHtml(String(it.description || "FX " + (i + 1))) + "</div><audio controls class=\"audio-player\"><source src=\"" + au + "\" type=\"audio/wav\"></audio><div class=\"audio-actions\"><button class=\"audio-btn audio-btn-ghost\" onclick=\"downloadAudio('" + au + "')\">Download</button></div>";
          rl.appendChild(ri);
        }
      }
      eres.classList.remove("hidden");
      hideErr(eerr);
      toast("Effects done");
    } catch (e) {
      console.error(e);
      showErr(eerr, "Error: " + e.message);
      toast("Error: " + e.message);
    } finally { if (btn) { btn.disabled = false; btn.textContent = orig || "Generate All"; } }
  }

  // ========== Add effect ==========
  var aeb = document.getElementById("addEffectBtn");
  if (aeb) aeb.addEventListener("click", function() {
    var fl = document.getElementById("effectsList");
    var dv = document.createElement("div");
    dv.className = "audio-effect-item";
    dv.innerHTML = "<label>Effect prompt<input type=\"text\" placeholder=\"e.g. rain, footsteps\" class=\"effect-prompt-input\" /></label>";
    fl.appendChild(dv);
  });

  // ========== Export ==========
  var dmb = document.getElementById("downloadMusicBtn");
  if (dmb) dmb.addEventListener("click", function() {
    var as = document.querySelectorAll("#musicResultList audio");
    for (var i = 0; i < as.length; i++) { var s = as[i].querySelector("source"); if (s && s.src) window.downloadAudio(s.src); }
  });
  var deb = document.getElementById("downloadEffectsBtn");
  if (deb) deb.addEventListener("click", function() {
    var as = document.querySelectorAll("#effectsResultList audio");
    for (var i = 0; i < as.length; i++) { var s = as[i].querySelector("source"); if (s && s.src) window.downloadAudio(s.src); }
  });
  var eab = document.getElementById("exportAudiobookBtn");
  if (eab) eab.addEventListener("click", async function() {
    eab.disabled = true;
    var orig = eab.textContent;
    eab.textContent = "Exporting...";
    try {
      var ti = document.getElementById("novelTitleInput");
      var r = await fetch("/api/audio/generate-chapter-audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: ti ? ti.value : "", chapters: ["all"] }) });
      if (!r.ok) throw new Error("Export failed: HTTP " + r.status);
      var d = await r.json();
      toast("Audiobook exported");
      if (d.audiobook_url) window.open(d.audiobook_url, "_blank");
    } catch (e) { toast("Error: " + e.message); }
    finally { eab.disabled = false; eab.textContent = orig; }
  });

  console.log("[audio-gen] ready");
});
