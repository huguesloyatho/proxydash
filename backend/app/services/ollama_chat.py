"""
Ollama Chat Service for ProxyDash.
Provides an intelligent chat interface that knows about self-hosted applications
and can suggest solutions based on the user's installed apps and the awesome-selfhosted database.
"""

import json
import logging
from typing import Optional, List, Dict, Any, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# System prompt for the chat assistant
SYSTEM_PROMPT = """Tu es un assistant spécialisé dans les applications self-hosted et l'auto-hébergement.
Tu aides les utilisateurs à trouver et configurer des solutions self-hosted pour leurs besoins.

Tu as accès à:
1. La liste des applications déjà installées par l'utilisateur (fournies dans le contexte)
2. Une base de données de plus de 1000 applications self-hosted (awesome-selfhosted)
3. Des connaissances en administration système, Docker, reverse proxy (Nginx, Traefik), et sécurité

Tes capacités:
- Suggérer des applications self-hosted adaptées aux besoins de l'utilisateur
- Expliquer comment configurer et utiliser les applications
- Donner des conseils sur la sécurité et les bonnes pratiques
- Comparer différentes solutions (ex: Jellyfin vs Plex, Nextcloud vs Seafile)
- Aider à résoudre des problèmes techniques
- Répondre à des questions générales (tu es un LLM complet)

Règles:
- Réponds en français par défaut, sauf si l'utilisateur écrit dans une autre langue
- Sois concis mais complet
- Mentionne les applications déjà installées quand c'est pertinent
- Suggère des alternatives self-hosted aux services cloud commerciaux
- Utilise le format Markdown pour structurer tes réponses
"""


@dataclass
class ChatMessage:
    """A chat message."""
    role: str  # 'user', 'assistant', 'system'
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ChatContext:
    """Context information for the chat."""
    installed_apps: List[Dict[str, Any]] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)
    user_name: Optional[str] = None
    web_search_context: Optional[str] = None


class OllamaChatService:
    """Service for chatting with Ollama with application context."""

    def __init__(self, url: str = None, model: str = None):
        self.base_url = url or settings.OLLAMA_URL
        self.model = model or settings.OLLAMA_MODEL
        self._available: Optional[bool] = None

    async def is_available(self) -> bool:
        """Check if Ollama is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    self._available = any(
                        self.model in m or self.model.split(":")[0] in m
                        for m in models
                    )
                    return self._available
                return False
        except Exception as e:
            logger.error(f"Ollama availability check failed: {e}")
            return False

    async def get_models(self) -> List[Dict[str, Any]]:
        """Get list of available Ollama models."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    return data.get("models", [])
                return []
        except Exception as e:
            logger.error(f"Failed to get Ollama models: {e}")
            return []

    def _build_context_prompt(self, context: ChatContext) -> str:
        """Build a context string to inject into the conversation."""
        parts = []

        if context.installed_apps:
            apps_summary = []
            for app in context.installed_apps[:30]:  # Limit to 30 apps
                app_info = f"- {app.get('name', 'Unknown')}"
                if app.get('detected_type'):
                    app_info += f" ({app['detected_type']})"
                if app.get('category'):
                    app_info += f" [cat: {app['category']}]"
                apps_summary.append(app_info)

            parts.append(f"""Applications installées par l'utilisateur ({len(context.installed_apps)} au total):
{chr(10).join(apps_summary)}""")

        if context.categories:
            parts.append(f"Catégories disponibles: {', '.join(context.categories)}")

        if context.user_name:
            parts.append(f"Nom de l'utilisateur: {context.user_name}")

        if context.web_search_context:
            parts.append(f"--- RÉSULTATS DE RECHERCHE WEB ---\n{context.web_search_context}")

        if parts:
            return "\n\n".join(parts)
        return ""

    async def chat(
        self,
        messages: List[ChatMessage],
        context: Optional[ChatContext] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048
    ) -> str:
        """
        Send a chat request to Ollama and get a response.

        Args:
            messages: List of chat messages (conversation history)
            context: Optional context with installed apps info
            temperature: Creativity parameter (0.0-1.0)
            max_tokens: Maximum tokens in response

        Returns:
            The assistant's response
        """
        # Build the messages list for Ollama
        ollama_messages = []

        # Add system prompt
        system_content = SYSTEM_PROMPT
        if context:
            context_info = self._build_context_prompt(context)
            if context_info:
                system_content += f"\n\n--- CONTEXTE UTILISATEUR ---\n{context_info}"

        ollama_messages.append({
            "role": "system",
            "content": system_content
        })

        # Add conversation history
        for msg in messages:
            ollama_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": ollama_messages,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens,
                        }
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    # Check for error in response
                    if "error" in data:
                        error_msg = data["error"]
                        logger.error(f"Ollama error: {error_msg}")
                        raise Exception(error_msg)
                    return data.get("message", {}).get("content", "")
                else:
                    error_msg = f"Ollama API error: {response.status_code}"
                    logger.error(error_msg)
                    raise Exception(error_msg)

        except httpx.TimeoutException:
            logger.error("Ollama chat request timed out")
            raise Exception("La requête a expiré. Le modèle est peut-être surchargé.")
        except Exception as e:
            logger.error(f"Ollama chat error: {e}")
            raise

    async def chat_stream(
        self,
        messages: List[ChatMessage],
        context: Optional[ChatContext] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048
    ) -> AsyncIterator[str]:
        """
        Send a chat request to Ollama and stream the response.

        Args:
            messages: List of chat messages
            context: Optional context with installed apps info
            temperature: Creativity parameter
            max_tokens: Maximum tokens

        Yields:
            Chunks of the response as they arrive
        """
        # Build the messages list
        ollama_messages = []

        # Add system prompt
        system_content = SYSTEM_PROMPT
        if context:
            context_info = self._build_context_prompt(context)
            if context_info:
                system_content += f"\n\n--- CONTEXTE UTILISATEUR ---\n{context_info}"

        ollama_messages.append({
            "role": "system",
            "content": system_content
        })

        # Add conversation history
        for msg in messages:
            ollama_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": ollama_messages,
                        "stream": True,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens,
                        }
                    }
                ) as response:
                    if response.status_code != 200:
                        raise Exception(f"Ollama API error: {response.status_code}")

                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                # Check for error in response (e.g., memory issues)
                                if "error" in data:
                                    error_msg = data["error"]
                                    logger.error(f"Ollama error: {error_msg}")
                                    raise Exception(error_msg)
                                if "message" in data and "content" in data["message"]:
                                    yield data["message"]["content"]
                                if data.get("done", False):
                                    break
                            except json.JSONDecodeError:
                                continue

        except httpx.TimeoutException:
            raise Exception("La requête a expiré")
        except Exception as e:
            logger.error(f"Ollama stream error: {e}")
            raise

    async def suggest_apps(
        self,
        need: str,
        context: Optional[ChatContext] = None
    ) -> str:
        """
        Suggest self-hosted apps for a specific need.

        Args:
            need: Description of what the user needs
            context: Optional context with installed apps

        Returns:
            Suggestions with explanations
        """
        messages = [
            ChatMessage(
                role="user",
                content=f"""J'ai besoin d'une solution self-hosted pour: {need}

Suggère-moi 3 à 5 applications adaptées avec:
1. Le nom de l'application
2. Une brève description
3. Les avantages principaux
4. Si c'est facile à installer (Docker disponible?)

Si j'ai déjà des applications installées qui pourraient répondre à ce besoin, mentionne-les en premier."""
            )
        ]

        return await self.chat(messages, context, temperature=0.5)


# Global instance
_chat_service: Optional[OllamaChatService] = None


def get_chat_service() -> OllamaChatService:
    """Get or create the global chat service instance."""
    global _chat_service
    if _chat_service is None:
        _chat_service = OllamaChatService()
    return _chat_service


def reset_chat_service(url: str = None, model: str = None) -> OllamaChatService:
    """Reset the chat service with new configuration."""
    global _chat_service
    _chat_service = OllamaChatService(url=url, model=model)
    return _chat_service
