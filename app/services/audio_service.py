"""Audio generation service using HF Transformers (MusicGen / AudioGen).
CPU-first design with GPU auto-detection when available.
"""

import gc, logging, os, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
import numpy as np
import soundfile as sf
import torch


logger = logging.getLogger(__name__)

# --- HF Mirror for mainland China users ---
# Set HF_ENDPOINT to a mirror if not already configured
if not os.environ.get("HF_ENDPOINT"):
    _mirror = os.environ.get("HF_MIRROR", "https://hf-mirror.com")
    os.environ["HF_ENDPOINT"] = _mirror
    logger.info("HF endpoint set to mirror: %s", _mirror)
else:
    logger.info("HF endpoint: %s", os.environ["HF_ENDPOINT"])

def _cuda_ok():
    """Check CUDA is usable, including compute-capability compatibility."""
    if not torch.cuda.is_available():
        return False
    try:
        cc = torch.cuda.get_device_capability(0)
        cc_ver = cc[0] * 10 + cc[1]
        # torch 2.8 supports max sm_90 (CC 9.0). Check if GPU is too new.
        if cc_ver > 90:
            logger.warning(
                "GPU CC %d.%d exceeds torch max (9.0). Falling back to CPU.",
                cc[0], cc[1]
            )
            return False
        t = torch.randn(10, 10, device="cuda")
        _ = t @ t
        del t
        torch.cuda.empty_cache()
        return True
    except Exception as e:
        logger.warning("CUDA test failed: %s", e)
        return False

def _best_dev():
    if _cuda_ok():
        logger.info("CUDA: %s", torch.cuda.get_device_properties(0).name)
        return "cuda"
    logger.info("Using CPU")
    return "cpu"


# --- HF Token for gated models (Stable Audio 3) ---
_HF_TOKEN_FILE = Path(__file__).resolve().parents[2] / "data" / "hf_token.txt"

def _get_hf_token():
    """Get HF token from env or stored file."""
    token = os.environ.get("HF_TOKEN", "").strip()
    if token:
        return token
    try:
        if _HF_TOKEN_FILE.exists():
            token = _HF_TOKEN_FILE.read_text().strip()
            if token:
                return token
    except Exception:
        pass
    return None

def _set_hf_token(token: str):
    """Save HF token to file and set env var."""
    token = token.strip()
    os.environ["HF_TOKEN"] = token
    _HF_TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    _HF_TOKEN_FILE.write_text(token)
    logger.info("HF token saved")

_AC_OK = False
_AC_ERR = ""
try:
    sys.path.insert(0, "F:/AudioCraft/audiocraft")
    from audiocraft.models import MusicGen as _ACM  # noqa
    _AC_OK = True
except ImportError as e:
    _AC_ERR = str(e)
    logger.info("AudioCraft skip: %s", e)

_TF_OK = None  # None=not tested, True=available, False=unavailable

class _HFMG:
    def __init__(self, mn="facebook/musicgen-small", dev="cpu"):
        self.mn, self.dev = mn, dev
        self._m, self._p, self._sr = None, None, 32000

    def _load(self):
        global _TF_OK
        if self._m is not None:
            return
        if _TF_OK is None:
            try:
                global AutoProcessor, MusicgenForConditionalGeneration
                from transformers import AutoProcessor, MusicgenForConditionalGeneration
                _TF_OK = True
            except ImportError:
                _TF_OK = False
        if not _TF_OK:
            raise RuntimeError("HF Transformers not installed")

        load_kwargs = {
            "dtype": torch.float16 if self.dev == "cuda" else torch.float32,
            "low_cpu_mem_usage": True,
        }

        # Try local-only first, fall back to allowing download
        for local_only in (True, False):
            try:
                logger.info(
                    "Loading %s on %s (dtype=%s, low_cpu_mem, local=%s)...",
                    self.mn, self.dev, "float16" if self.dev=="cuda" else "float32", local_only
                )
                self._p = AutoProcessor.from_pretrained(
                    self.mn, local_files_only=local_only
                )
                self._m = MusicgenForConditionalGeneration.from_pretrained(
                    self.mn,
                    local_files_only=local_only,
                    **load_kwargs,
                ).to(self.dev)
                break
            except (OSError, IOError) as e:
                if local_only:
                    logger.warning(
                        "Local-only load failed (%s), retrying with network...", e
                    )
                    continue
                raise

        self._m.eval()
        self._sr = getattr(
            getattr(self._m.config, "audio_encoder", None), "sampling_rate", 32000
        )
        logger.info("Loaded. sr=%s", self._sr)
        self._m.eval()
        cfg = self._m.config
        self._sr = getattr(getattr(cfg, "audio_encoder", None), "sampling_rate", 32000)
        logger.info("Loaded. sr=%s", self._sr)

    def gen(self, desc, dur=30.0, gs=3.0):
        self._load()
        mt = max(64, int(dur * 50))
        inp = self._p(text=[desc], padding=True, return_tensors="pt").to(self.dev)
        with torch.no_grad():
            aud = self._m.generate(
                **inp, max_new_tokens=mt, guidance_scale=gs,
                do_sample=True, temperature=1.0
            )
        arr = aud[0].cpu().float().numpy()
        if arr.ndim == 2:
            arr = arr.T
        return arr

    @property
    def sr(self):
        return self._sr

    def unload(self):
        self._m = None
        self._p = None
        gc.collect()
        if self.dev == "cuda":
            torch.cuda.empty_cache()

    @property
    def loaded(self):
        return self._m is not None



# =============================================================================
# Stable Audio 3 Wrapper (Stability AI)
# =============================================================================

_HAS_STABLE_AUDIO = False
try:
    from diffusers import StableAudioPipeline
    _HAS_STABLE_AUDIO = True
    logger.info("Stable Audio 3 pipeline available")
except ImportError:
    logger.info("Stable Audio 3 not available (install: pip install diffusers)")


class _StableAudioGen:
    """Stable Audio 3 wrapper using diffusers pipeline."""

    def __init__(self, model_name="stabilityai/stable-audio-3-small-music", device="cpu"):
        self.model_name = model_name
        self.device = device
        self._pipe = None
        self._sample_rate = 44100

    def _load(self):
        global _HAS_STABLE_AUDIO
        if self._pipe is not None:
            return
        if not _HAS_STABLE_AUDIO:
            # Try late import
            try:
                global StableAudioPipeline
                from diffusers import StableAudioPipeline
                _HAS_STABLE_AUDIO = True
            except ImportError:
                raise RuntimeError(
                    "Stable Audio 3 requires diffusers. "
                    "Install with: pip install diffusers"
                )

        logger.info("Loading Stable Audio 3: %s on %s ...", self.model_name, self.device)
        try:
            _dtype = torch.float16 if self.device == "cuda" else torch.float32
            _token = _get_hf_token()
            self._pipe = StableAudioPipeline.from_pretrained(
                self.model_name,
                dtype=_dtype,
                low_cpu_mem_usage=True,
                token=_token if _token else None,
            )
        except Exception as e:
            err = str(e).lower()
            if "gated" in err or "401" in err or "403" in err or "restricted" in err:
                raise RuntimeError(
                    "Stable Audio 3 模型需要 HuggingFace 授权。请在页面顶部 HF Token 输入框中填入你的 HuggingFace Token。"
                ) from e
            if "ssl" in err or "connection" in err or "max retries" in err:
                raise RuntimeError(
                    "无法连接 HuggingFace。已自动使用镜像站 hf-mirror.com，如仍失败请检查网络。"
                ) from e
            raise
        if self.device == "cuda":
            self._pipe = self._pipe.to(self.device)
        self._sample_rate = getattr(self._pipe, "sample_rate", 44100)
        logger.info("Stable Audio 3 loaded. sr=%s", self._sample_rate)

    def gen(self, desc, dur=30.0, gs=3.0):
        self._load()
        # Stable Audio uses negative prompts and inference steps
        negative = "low quality, noisy, distorted"
        steps = min(200, max(50, int(dur * 6)))

        with torch.no_grad():
            result = self._pipe(
                desc,
                negative_prompt=negative,
                num_inference_steps=steps,
                audio_end_in_s=dur,
                guidance_scale=gs,
            )

        arr = result.audios[0]  # (channels, samples) or (samples,)
        if isinstance(arr, torch.Tensor):
            arr = arr.cpu().float().numpy()
        if arr.ndim == 2 and arr.shape[0] < arr.shape[1]:
            arr = arr.T  # -> (samples, channels)
        return arr

    @property
    def sr(self):
        return self._sample_rate

    def unload(self):
        if self._pipe is not None:
            del self._pipe
            self._pipe = None
        gc.collect()
        if self.device == "cuda":
            torch.cuda.empty_cache()

    @property
    def loaded(self):
        return self._pipe is not None


class AudioService:
    _POOL = None

    def __init__(
        self, device=None,
        music_model_name="facebook/musicgen-small",
        audio_model_name="facebook/audiogen-medium",
        model_type="musicgen",
        stable_music_model="stabilityai/stable-audio-3-small-music",
        stable_sfx_model="stabilityai/stable-audio-3-small-sfx",
        cache_dir=None
    ):
        self.device = device or _best_dev()
        self.mmn = music_model_name
        self.amn = audio_model_name
        self.model_type = model_type
        self.stable_music_model = stable_music_model
        self.stable_sfx_model = stable_sfx_model
        self.cd = cache_dir
        self._mg = None
        self._ag = None
        self._ac = _AC_OK
        be = (
            "AudioCraft" if self._ac
            else "StableAudio3" if model_type == "stable-audio"
            else "HF-MusicGen"
        )
        logger.info(
            "AudioService: dev=%s be=%s type=%s music=%s audio=%s",
            self.device, be, model_type, music_model_name, audio_model_name
        )

    @classmethod
    def _ex(cls):
        if cls._POOL is None:
            cls._POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="audio")
        return cls._POOL

    def _gmg(self):
        """Get music generator based on model_type."""
        if self._mg is not None:
            return self._mg
        if self.model_type == "stable-audio":
            self._mg = _StableAudioGen(self.stable_music_model, self.device)
        else:
            self._mg = _HFMG(self.mmn, self.device)
        return self._mg

    def _gag(self):
        """Get audio/sfx generator. For Stable Audio 3, uses a dedicated SFX model."""
        if self._ag is None:
            if self.model_type == "stable-audio":
                import gc
                # Try to unload music model first to free memory, then load SFX model
                if self._mg is not None and self._mg.loaded:
                    self._mg.unload()
                    self._mg = None
                    gc.collect()
                self._ag = _StableAudioGen(self.stable_sfx_model, self.device)
            else:
                self._ag = _HFMG(self.amn, self.device)
        return self._ag

    async def generate_background_music(
        self, description, duration=30.0, output_path=None,
        guidance_scale=3.0, progress_callback=None
    ):
        import asyncio
        loop = asyncio.get_running_loop()
        gen = self._gmg()

        if progress_callback:
            progress_callback(0.1, "Loading model...")

        await loop.run_in_executor(self._ex(), gen._load)

        if progress_callback:
            progress_callback(0.2, f"Generating: {description[:60]}...")

        arr = await loop.run_in_executor(
            self._ex(), gen.gen, description, duration, guidance_scale
        )

        if progress_callback:
            progress_callback(0.8, "Saving...")

        if output_path is None:
            d = Path("static/audio/music")
            d.mkdir(parents=True, exist_ok=True)
            ts = int(time.time() * 1000)
            output_path = str(d / f"music_{ts}.wav")

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        sr = gen.sr
        if arr.ndim == 2 and arr.shape[1] > arr.shape[0]:
            arr = arr.T
        sf.write(output_path, arr, sr)

        ad = len(arr) / sr if arr.ndim == 1 else arr.shape[0] / sr

        if progress_callback:
            progress_callback(1.0, "Done!")

        logger.info("Music: %s (%.1fs)", output_path, ad)

        return {
            "audio_path": output_path,
            "duration": ad,
            "sample_rate": sr,
            "description": description,
            "device": self.device,
            "backend": "AudioCraft" if self._ac else "HF-Transformers",
        }

    async def generate_sound_effects(
        self, descriptions, duration=5.0, output_dir=None,
        guidance_scale=3.0, progress_callback=None
    ):
        import asyncio
        loop = asyncio.get_running_loop()
        gen = self._gag()

        od = Path(output_dir) if output_dir else Path("static/audio/effects")
        od.mkdir(parents=True, exist_ok=True)

        if progress_callback:
            progress_callback(0.05, "Loading model...")

        try:
            await loop.run_in_executor(self._ex(), gen._load)
        except Exception as e:
            logger.warning("SFX model load failed (%s), falling back to audiogen-medium", e)
            if hasattr(gen, "unload"):
                gen.unload()
            self._ag = _HFMG("facebook/audiogen-medium", self.device)
            gen = self._ag
            await loop.run_in_executor(self._ex(), gen._load)

        results = []
        total = len(descriptions)

        for i, d in enumerate(descriptions):
            if progress_callback:
                pct = 0.1 + 0.8 * (i / max(total, 1))
                progress_callback(pct, f"Effect {i+1}/{total}: {d[:40]}...")

            try:
                arr = await loop.run_in_executor(
                    self._ex(), gen.gen, d, duration, guidance_scale
                )
                ts = int(time.time() * 1000)
                fp = str(od / f"effect_{i}_{ts}.wav")
                sr = gen.sr
                if arr.ndim == 2 and arr.shape[1] > arr.shape[0]:
                    arr = arr.T
                sf.write(fp, arr, sr)

                ad = len(arr) / sr if arr.ndim == 1 else arr.shape[0] / sr
                results.append({
                    "audio_path": fp, "duration": ad,
                    "sample_rate": sr, "description": d,
                })
                logger.info("Effect: %s", fp)

            except Exception as e:
                logger.error("Effect %d fail: %s", i, e)
                results.append({
                    "audio_path": None, "duration": 0,
                    "sample_rate": 0, "description": d, "error": str(e),
                })

        if progress_callback:
            progress_callback(1.0, f"{len(results)} done")

        return results

    def unload_models(self):
        """Unload all loaded model instances."""
        for a in ("_mg", "_ag"):
            g = getattr(self, a, None)
            if g and hasattr(g, "unload"):
                g.unload()
                setattr(self, a, None)
        gc.collect()
        if self.device == "cuda":
            torch.cuda.empty_cache()

    def get_device_info(self):
        info = {
            "device": self.device,
            "device_name": "CPU",
            "memory_total": 0,
            "memory_available": 0,
            "model_type": self.model_type,
            "backend": (
                "AudioCraft" if self._ac
                else "StableAudio3" if self.model_type == "stable-audio"
                else "HF-MusicGen"
            ),
            "cuda_usable": _cuda_ok(),
            "audiocraft_available": _AC_OK,
            "stable_audio_available": _HAS_STABLE_AUDIO,
            "music_model_loaded": self._mg is not None and self._mg.loaded,
            "audio_model_loaded": self._ag is not None and self._ag.loaded,
        }
        if self.device == "cuda" and torch.cuda.is_available():
            try:
                p = torch.cuda.get_device_properties(0)
                info["device_name"] = p.name
                info["memory_total"] = p.total_memory
                info["memory_available"] = p.total_memory - torch.cuda.memory_allocated()
            except Exception:
                pass
        return info

    @staticmethod
    def get_available_models():
        return {
            "model_types": [
                {
                    "id": "musicgen",
                    "name": "MusicGen (Meta)",
                    "description": "Fast, lightweight, good for music and effects",
                    "recommended": True,
                    "models": [
                        {"id": "facebook/musicgen-small", "size": "300M", "recommended": True},
                        {"id": "facebook/musicgen-medium", "size": "1.5B"},
                        {"id": "facebook/musicgen-large", "size": "3.3B"}
                    ],
                },
                {
                    "id": "stable-audio",
                    "name": "Stable Audio 3 (Stability AI)",
                    "description": "Higher quality music and SFX, separate music/sfx models",
                    "recommended": False,
                    "models": [
                        {"id": "stabilityai/stable-audio-3-small-music", "size": "~1B", "recommended": True, "type": "music"},
                        {"id": "stabilityai/stable-audio-3-medium", "size": "~3B", "recommended": False, "type": "music"},
                        {"id": "stabilityai/stable-audio-3-small-sfx", "size": "~1B", "recommended": True, "type": "sfx"}
                    ],
                },
            ],
            "audio_models": [
                {"id": "facebook/musicgen-small", "size": "300M", "recommended": True},
                {"id": "facebook/audiogen-medium", "size": "~1.5B", "recommended": False},
            ],
        }
    def set_model_type(self, model_type, model_name=None):
        """Switch between musicgen and stable-audio models. Optionally set specific model name."""
        if model_type not in ("musicgen", "stable-audio"):
            raise ValueError(f"Unknown model_type: {model_type}")
        if model_name:
            if model_type == "stable-audio":
                if "sfx" in (model_name or ""):
                    self.stable_sfx_model = model_name
                    logger.info("Stable Audio SFX model set to: %s", model_name)
                else:
                    self.stable_music_model = model_name
                    logger.info("Stable Audio music model set to: %s", model_name)
            else:
                self.mmn = model_name
                self.amn = model_name
                logger.info("MusicGen model set to: %s", model_name)
        if model_type != self.model_type:
            logger.info("Switching model type: %s -> %s", self.model_type, model_type)
            self.unload_models()
            self.model_type = model_type