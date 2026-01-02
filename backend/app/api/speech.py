"""
Speech-to-text API using faster-whisper for local transcription.
"""
import io
import tempfile
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/speech", tags=["speech"])

# Lazy load whisper model to avoid startup delay
_whisper_model = None
_model_size = "tiny"  # Options: tiny, base, small, medium, large-v3 (tiny = faster, base = balanced)


def get_whisper_model():
    """Get or create the whisper model (lazy loading)."""
    global _whisper_model

    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel

            # Use CPU by default, can be changed to "cuda" if GPU available
            _whisper_model = WhisperModel(
                _model_size,
                device="cpu",
                compute_type="int8"  # Faster on CPU
            )
            print(f"Whisper model '{_model_size}' loaded successfully")
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="faster-whisper n'est pas installé. Exécutez: pip install faster-whisper"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Erreur lors du chargement du modèle Whisper: {str(e)}"
            )

    return _whisper_model


class TranscriptionResponse(BaseModel):
    """Response for transcription."""
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None


class SpeechConfigResponse(BaseModel):
    """Response for speech config."""
    available: bool
    model_size: str
    supported_formats: list[str]


class SpeechConfigUpdate(BaseModel):
    """Request to update speech config."""
    model_size: str


VALID_MODEL_SIZES = ["tiny", "base", "small", "medium", "large-v3"]


@router.get("/config", response_model=SpeechConfigResponse)
async def get_speech_config():
    """
    Get speech-to-text configuration and availability.
    This endpoint is public (no auth required) as it just returns service info.
    """
    try:
        from faster_whisper import WhisperModel
        available = True
    except ImportError:
        available = False

    return SpeechConfigResponse(
        available=available,
        model_size=_model_size,
        supported_formats=["wav", "mp3", "webm", "ogg", "m4a", "flac"]
    )


@router.put("/config", response_model=SpeechConfigResponse)
async def update_speech_config(
    config: SpeechConfigUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update speech-to-text configuration.
    Requires admin privileges.
    """
    global _model_size, _whisper_model

    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Seuls les administrateurs peuvent modifier cette configuration"
        )

    if config.model_size not in VALID_MODEL_SIZES:
        raise HTTPException(
            status_code=400,
            detail=f"Taille de modèle invalide. Choix possibles: {', '.join(VALID_MODEL_SIZES)}"
        )

    # Update model size
    _model_size = config.model_size

    # Reset model so it will be reloaded with new size on next use
    _whisper_model = None

    try:
        from faster_whisper import WhisperModel
        available = True
    except ImportError:
        available = False

    return SpeechConfigResponse(
        available=available,
        model_size=_model_size,
        supported_formats=["wav", "mp3", "webm", "ogg", "m4a", "flac"]
    )


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(default="fr"),
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe audio file to text using Whisper.

    Supports: wav, mp3, webm, ogg, m4a, flac
    """
    # Validate file type
    allowed_types = [
        "audio/wav", "audio/x-wav", "audio/wave",
        "audio/mp3", "audio/mpeg",
        "audio/webm",
        "audio/ogg",
        "audio/m4a", "audio/mp4", "audio/x-m4a",
        "audio/flac",
        "video/webm",  # WebM can contain audio only
    ]

    content_type = audio.content_type or ""
    if content_type not in allowed_types and not audio.filename.endswith(('.wav', '.mp3', '.webm', '.ogg', '.m4a', '.flac')):
        raise HTTPException(
            status_code=400,
            detail=f"Format audio non supporté: {content_type}. Utilisez wav, mp3, webm, ogg, m4a ou flac."
        )

    try:
        model = get_whisper_model()

        # Read audio content
        audio_content = await audio.read()

        if len(audio_content) == 0:
            raise HTTPException(
                status_code=400,
                detail="Fichier audio vide"
            )

        # Save to temporary file (faster-whisper needs a file path)
        suffix = os.path.splitext(audio.filename or ".wav")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(audio_content)
            tmp_path = tmp_file.name

        try:
            # Transcribe
            segments, info = model.transcribe(
                tmp_path,
                language=language if language else None,
                beam_size=5,
                vad_filter=True,  # Filter out silence
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                )
            )

            # Collect all segments
            text_parts = []
            for segment in segments:
                text_parts.append(segment.text.strip())

            full_text = " ".join(text_parts)

            return TranscriptionResponse(
                text=full_text,
                language=info.language,
                duration=info.duration
            )

        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except:
                pass

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur de transcription: {str(e)}"
        )


@router.post("/transcribe-blob", response_model=TranscriptionResponse)
async def transcribe_audio_blob(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(default="fr"),
    current_user: User = Depends(get_current_user)
):
    """
    Transcribe audio blob from browser MediaRecorder.
    This endpoint is optimized for browser-recorded audio (webm/opus).
    """
    return await transcribe_audio(audio=audio, language=language, current_user=current_user)
