"""
Ollama integration service for generating application descriptions.
"""

import httpx
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


async def generate_description(app_name: str, domain: str, detected_type: Optional[str] = None) -> Optional[str]:
    """
    Generate a description for an application using Ollama.

    Args:
        app_name: The application name
        domain: The domain name
        detected_type: The detected app type (optional)

    Returns:
        Generated description or None if failed
    """
    prompt = f"""Tu es un assistant qui génère des descriptions courtes et informatives pour des applications self-hosted.

Application: {app_name}
Domaine: {domain}
{"Type détecté: " + detected_type if detected_type else "Type: inconnu"}

Génère une description en français de maximum 100 caractères qui explique brièvement à quoi sert cette application.
Réponds uniquement avec la description, sans guillemets ni ponctuation finale.
Si tu ne connais pas l'application, génère une description générique basée sur le nom."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 50,
                    }
                }
            )

            if response.status_code == 200:
                data = response.json()
                description = data.get("response", "").strip()
                # Clean up the description
                description = description.strip('"\'')
                if len(description) > 150:
                    description = description[:147] + "..."
                return description
            else:
                logger.error(f"Ollama API error: {response.status_code}")
                return None

    except httpx.TimeoutException:
        logger.error("Ollama request timed out")
        return None
    except Exception as e:
        logger.error(f"Error calling Ollama: {e}")
        return None


async def is_ollama_available() -> bool:
    """Check if Ollama is available and the model is loaded."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                return settings.OLLAMA_MODEL in models or any(settings.OLLAMA_MODEL.split(":")[0] in m for m in models)
            return False
    except Exception:
        return False
