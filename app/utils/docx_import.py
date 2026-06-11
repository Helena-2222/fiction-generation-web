"""
Utility for importing and parsing docx files.
Extracts text content for audio generation analysis.
"""

from pathlib import Path
from typing import Dict, Any
import docx


def extract_text_from_docx(file_path: str) -> Dict[str, Any]:
    """
    Extract text content from a docx file.
    
    Args:
        file_path: Path to the docx file.
        
    Returns:
        Dictionary containing:
            - title: Document title (from first paragraph or filename)
            - content: Full text content
            - paragraphs: List of paragraphs
    """
    doc = docx.Document(file_path)
    
    # Extract all paragraphs
    paragraphs = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs.append(text)
    
    # Use first paragraph as title (if it looks like a title)
    title = ""
    if paragraphs:
        first_para = paragraphs[0]
        # If first paragraph is short, treat it as title
        if len(first_para) < 50:
            title = first_para
            content_paragraphs = paragraphs[1:]
        else:
            content_paragraphs = paragraphs
    else:
        content_paragraphs = []
    
    # Join content
    content = "\n\n".join(content_paragraphs)
    
    return {
        "title": title or Path(file_path).stem,
        "content": content,
        "paragraphs": paragraphs,
        "paragraph_count": len(paragraphs)
    }


def extract_chapters_from_docx(file_path: str) -> Dict[str, Any]:
    """
    Extract chapters from a docx file.
    Assumes chapters are separated by headings or specific patterns.
    
    Args:
        file_path: Path to the docx file.
        
    Returns:
        Dictionary containing:
            - title: Document title
            - chapters: List of chapters, each with title and content
    """
    doc = docx.Document(file_path)
    
    chapters = []
    current_chapter = None
    
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        
        # Check if this paragraph is a heading (chapter title)
        # Heuristic: short paragraph that looks like a chapter title
        if _is_chapter_heading(para):
            # Save previous chapter
            if current_chapter:
                chapters.append(current_chapter)
            
            # Start new chapter
            current_chapter = {
                "title": text,
                "content": ""
            }
        else:
            # Add to current chapter
            if current_chapter is None:
                # No chapter title yet, create a default one
                current_chapter = {
                    "title": "开篇",
                    "content": ""
                }
            
            if current_chapter["content"]:
                current_chapter["content"] += "\n\n"
            current_chapter["content"] += text
    
    # Don't forget the last chapter
    if current_chapter:
        chapters.append(current_chapter)
    
    # If no chapters were found, treat entire document as one chapter
    if not chapters:
        full_text = "\n\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())
        chapters = [{
            "title": Path(file_path).stem,
            "content": full_text
        }]
    
    return {
        "title": chapters[0]["title"] if chapters else Path(file_path).stem,
        "chapters": chapters,
        "chapter_count": len(chapters)
    }


def _is_chapter_heading(para) -> bool:
    """
    Check if a paragraph is likely a chapter heading.
    """
    text = para.text.strip()
    
    # Too long to be a heading
    if len(text) > 50:
        return False
    
    # Check style
    if para.style.name.startswith('Heading'):
        return True
    
    # Check patterns like "第X章", "Chapter X", etc.
    import re
    if re.match(r'^(第[一二三四五六七八九十\d]+章|Chapter\s+\d+)', text):
        return True
    
    return False
