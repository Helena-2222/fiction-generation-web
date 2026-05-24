"""
Summary service for analyzing novel content and extracting audio generation hints.
Uses LLM (DeepSeek) to analyze chapters and generate audio prompts.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from app.llm.llm_client import DeepSeekClient


logger = logging.getLogger(__name__)


class SummaryService:
    """
    Service for analyzing novel content and generating audio generation hints.
    """
    
    def __init__(self, client: DeepSeekClient):
        """
        Initialize the summary service.
        
        Args:
            client: DeepSeekClient instance for LLM calls.
        """
        self.client = client
        logger.info("SummaryService initialized")
    
    async def analyze_chapter_for_audio(
        self,
        chapter_content: str,
        chapter_title: str,
        story_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze chapter content and extract audio generation hints.
        
        Args:
            chapter_content: The chapter text content.
            chapter_title: Title of the chapter.
            story_context: Optional story background info (genre, style, worldview, etc.).
            
        Returns:
            Dictionary containing summary, mood, emotion_curve, and audio_hints.
        """
        logger.info(f"Analyzing chapter for audio: {chapter_title}")
        
        prompt = self._build_analysis_prompt(
            chapter_content=chapter_content[:3000],  # Limit to avoid token limits
            chapter_title=chapter_title,
            story_context=story_context
        )
        
        try:
            # Call LLM to get analysis
            # Use chat_json() for JSON response format
            response = await self.client.chat_json(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a professional novel analyst and audio director. "
                            "Your task is to analyze novel chapters and provide detailed "
                            "guidance for audio generation (background music and sound effects). "
                            "You must return results in strict JSON format."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7
            )
            
            # Parse the response
            if isinstance(response, str):
                result = json.loads(response)
            else:
                result = response
            
            logger.info(f"Chapter analysis completed: {chapter_title}")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            # Return a default structure
            return self._get_default_analysis(chapter_title)
        except Exception as e:
            logger.error(f"Error analyzing chapter: {e}")
            raise
    
    def _build_analysis_prompt(
        self,
        chapter_content: str,
        chapter_title: str,
        story_context: Optional[Dict[str, Any]]
    ) -> str:
        """
        Build the analysis prompt for the LLM.
        """
        context_str = ""
        if story_context:
            context_parts = []
            if 'genre' in story_context:
                context_parts.append(f"Genre: {story_context['genre']}")
            if 'style' in story_context:
                context_parts.append(f"Style: {story_context['style']}")
            if 'worldview' in story_context:
                context_parts.append(f"Worldview: {story_context['worldview']}")
            if context_parts:
                context_str = "Story Context:\n" + "\n".join(context_parts) + "\n\n"
        
        prompt = f"""
Please analyze the following novel chapter and provide guidance for audio generation (background music and sound effects).

Chapter Title: {chapter_title}

Chapter Content:
{chapter_content}

{context_str}
Please return the analysis in the following JSON format (strict JSON, no additional text):

{{
  "summary": "Brief summary of the chapter (within 100 words)",
  "mood": "Overall emotional tone (e.g., peaceful, tense, sad, joyful)",
  "emotion_curve": [
    {{
      "segment": "Segment identifier (e.g., beginning, middle, climax, ending)",
      "mood": "Emotion of this segment",
      "intensity": "<float between 0.0 and 1.0>"
    }}
  ],
  "audio_hints": {{
    "background_music": "Description of background music (style, emotion, rhythm, instruments, etc.)",
    "sound_effects": [
      {{
        "time": "When it should appear (e.g., beginning, 2nd paragraph)",
        "description": "Sound effect description (e.g., wind, rain, footsteps)",
        "duration": "<suggested duration in seconds>"
      }}
    ],
    "music_style": "Music style tags (e.g., classical, electronic, folk)",
    "tempo": "Tempo description (e.g., slow, medium, fast)",
    "instruments": ["list", "of", "suggested", "instruments"]
  }}
}}

Important:
1. Return ONLY the JSON, no markdown formatting or additional text.
2. Ensure the JSON is valid and complete.
3. Be specific and detailed in the audio_hints section.
"""
        return prompt
    
    def _get_default_analysis(self, chapter_title: str) -> Dict[str, Any]:
        """
        Return a default analysis structure when LLM call fails.
        """
        return {
            "summary": f"Chapter: {chapter_title}",
            "mood": "neutral",
            "emotion_curve": [
                {"segment": "beginning", "mood": "neutral", "intensity": 0.5}
            ],
            "audio_hints": {
                "background_music": "Gentle background music",
                "sound_effects": [],
                "music_style": "ambient",
                "tempo": "slow",
                "instruments": ["piano"]
            }
        }
    
    async def generate_audio_prompts(
        self,
        audio_hints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Convert audio hints to usable prompts for MusicGen/AudioGen.
        
        Args:
            audio_hints: Audio hints dictionary from analyze_chapter_for_audio.
            
        Returns:
            Dictionary with music_prompt and effect_prompts.
        """
        logger.info("Generating audio prompts from audio hints")
        
        # Build music prompt
        music_parts = []
        
        if 'background_music' in audio_hints:
            music_parts.append(audio_hints['background_music'])
        
        if 'music_style' in audio_hints:
            music_parts.append(f"Style: {audio_hints['music_style']}")
        
        if 'tempo' in audio_hints:
            music_parts.append(f"Tempo: {audio_hints['tempo']}")
        
        if 'instruments' in audio_hints and audio_hints['instruments']:
            instruments = ', '.join(audio_hints['instruments'])
            music_parts.append(f"Instruments: {instruments}")
        
        music_prompt = ". ".join(music_parts) if music_parts else "Gentle background music"
        
        # Build effect prompts
        effect_prompts = []
        if 'sound_effects' in audio_hints and audio_hints['sound_effects']:
            for effect in audio_hints['sound_effects']:
                if 'description' in effect:
                    effect_prompts.append(effect['description'])
        
        return {
            "music_prompt": music_prompt,
            "effect_prompts": effect_prompts
        }
    
    async def batch_analyze_chapters(
        self,
        chapters: List[Dict[str, Any]],
        story_context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Batch analyze multiple chapters.
        
        Args:
            chapters: List of chapter dictionaries with 'content' and 'title' keys.
            story_context: Optional story background info.
            
        Returns:
            List of analysis results for each chapter.
        """
        results = []
        
        for idx, chapter in enumerate(chapters):
            logger.info(f"Analyzing chapter {idx+1}/{len(chapters)}")
            
            try:
                analysis = await self.analyze_chapter_for_audio(
                    chapter_content=chapter['content'],
                    chapter_title=chapter.get('title', f"Chapter {idx+1}"),
                    story_context=story_context
                )
                results.append(analysis)
            except Exception as e:
                logger.error(f"Failed to analyze chapter {idx+1}: {e}")
                results.append(self._get_default_analysis(chapter.get('title', f"Chapter {idx+1}")))
        
        return results
