"""
Chat API routes for Ollama-powered assistant.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import json
import httpx

from datetime import datetime
from app.core.database import get_db
from app.models import Application, Category, User, SystemConfig, ChatConversation
from app.api.deps import get_current_user, get_current_admin_user
from app.services.ollama_chat import (
    get_chat_service,
    ChatMessage,
    ChatContext,
    reset_chat_service,
)
from app.services.web_search import get_web_search_service
from app.core.config import settings

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatMessageInput(BaseModel):
    """Input model for a chat message."""
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    messages: List[ChatMessageInput] = Field(..., description="Conversation history")
    include_context: bool = Field(True, description="Include installed apps context")
    temperature: float = Field(0.7, ge=0.0, le=1.0, description="Response creativity")
    max_tokens: int = Field(2048, ge=100, le=8192, description="Max response tokens")
    stream: bool = Field(False, description="Stream the response")
    web_search: bool = Field(False, description="Search web for additional context")


class WebSearchResult(BaseModel):
    """Web search result."""
    title: str
    url: str
    snippet: str


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    response: str
    model: str
    context_apps_count: int
    web_search_results: Optional[List[WebSearchResult]] = None


class SuggestAppsRequest(BaseModel):
    """Request for app suggestions."""
    need: str = Field(..., min_length=3, description="What the user needs")


class OllamaStatus(BaseModel):
    """Ollama status response."""
    available: bool
    model: str
    models: List[dict] = []


@router.get("/status", response_model=OllamaStatus)
async def get_chat_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get the status of the Ollama chat service.
    Returns availability and available models.
    """
    service = get_chat_service()
    available = await service.is_available()
    models = await service.get_models() if available else []

    return OllamaStatus(
        available=available,
        model=service.model,
        models=models
    )


@router.post("/message", response_model=ChatResponse)
async def send_chat_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message to the chat assistant and get a response.

    The assistant has context about:
    - Your installed applications
    - The awesome-selfhosted database
    - Self-hosting best practices
    - Web search results (if enabled)
    """
    service = get_chat_service()

    # Check if Ollama is available
    if not await service.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama n'est pas disponible. Vérifiez que le service est démarré."
        )

    # Build context if requested
    context = None
    context_apps_count = 0
    web_search_results = None
    web_search_context = ""

    # Perform web search if enabled
    if request.web_search and request.messages:
        # Use the last user message as the search query
        last_user_message = None
        for msg in reversed(request.messages):
            if msg.role == "user":
                last_user_message = msg.content
                break

        if last_user_message:
            try:
                web_service = get_web_search_service()
                search_results = await web_service.search(last_user_message, max_results=5)

                if search_results:
                    web_search_results = [
                        WebSearchResult(
                            title=r.title,
                            url=r.url,
                            snippet=r.snippet
                        )
                        for r in search_results
                    ]
                    web_search_context = web_service.format_results_for_context(
                        search_results, last_user_message
                    )
            except Exception as e:
                print(f"Web search error: {e}")

    if request.include_context:
        # Get installed applications
        apps = db.query(Application).filter(
            Application.is_visible == True
        ).order_by(Application.name).all()

        # Get categories
        categories = db.query(Category).all()

        context = ChatContext(
            installed_apps=[
                {
                    "name": app.name,
                    "url": app.url,
                    "detected_type": app.detected_type,
                    "category": app.category.name if app.category else None,
                    "description": app.description,
                }
                for app in apps
            ],
            categories=[cat.name for cat in categories],
            user_name=current_user.username,
            web_search_context=web_search_context if web_search_context else None
        )
        context_apps_count = len(apps)
    elif web_search_context:
        # Even without app context, include web search results
        context = ChatContext(
            installed_apps=[],
            categories=[],
            user_name=current_user.username,
            web_search_context=web_search_context
        )

    # Convert messages
    messages = [
        ChatMessage(role=msg.role, content=msg.content)
        for msg in request.messages
    ]

    try:
        response = await service.chat(
            messages=messages,
            context=context,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )

        return ChatResponse(
            response=response,
            model=service.model,
            context_apps_count=context_apps_count,
            web_search_results=web_search_results
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/stream")
async def stream_chat_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message and stream the response.
    Returns a Server-Sent Events stream.
    """
    service = get_chat_service()

    # Check if Ollama is available
    if not await service.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama n'est pas disponible"
        )

    # Build context if requested
    context = None
    web_search_results = None
    web_search_context = ""

    # Perform web search if enabled
    if request.web_search and request.messages:
        last_user_message = None
        for msg in reversed(request.messages):
            if msg.role == "user":
                last_user_message = msg.content
                break

        if last_user_message:
            try:
                web_service = get_web_search_service()
                search_results = await web_service.search(last_user_message, max_results=5)

                if search_results:
                    web_search_results = [
                        {"title": r.title, "url": r.url, "snippet": r.snippet}
                        for r in search_results
                    ]
                    web_search_context = web_service.format_results_for_context(
                        search_results, last_user_message
                    )
            except Exception as e:
                print(f"Web search error: {e}")

    if request.include_context:
        apps = db.query(Application).filter(
            Application.is_visible == True
        ).order_by(Application.name).all()

        categories = db.query(Category).all()

        context = ChatContext(
            installed_apps=[
                {
                    "name": app.name,
                    "url": app.url,
                    "detected_type": app.detected_type,
                    "category": app.category.name if app.category else None,
                }
                for app in apps
            ],
            categories=[cat.name for cat in categories],
            user_name=current_user.username,
            web_search_context=web_search_context if web_search_context else None
        )
    elif web_search_context:
        context = ChatContext(
            installed_apps=[],
            categories=[],
            user_name=current_user.username,
            web_search_context=web_search_context
        )

    # Convert messages
    messages = [
        ChatMessage(role=msg.role, content=msg.content)
        for msg in request.messages
    ]

    async def generate():
        try:
            # Send web search results first if available
            if web_search_results:
                yield f"data: {json.dumps({'web_search_results': web_search_results})}\n\n"

            async for chunk in service.chat_stream(
                messages=messages,
                context=context,
                temperature=request.temperature,
                max_tokens=request.max_tokens
            ):
                # SSE format
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/suggest")
async def suggest_apps(
    request: SuggestAppsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get app suggestions for a specific need.
    The assistant will consider your already installed apps.
    """
    service = get_chat_service()

    if not await service.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama n'est pas disponible"
        )

    # Get installed apps for context
    apps = db.query(Application).filter(
        Application.is_visible == True
    ).order_by(Application.name).all()

    context = ChatContext(
        installed_apps=[
            {
                "name": app.name,
                "detected_type": app.detected_type,
                "category": app.category.name if app.category else None,
            }
            for app in apps
        ]
    )

    try:
        suggestions = await service.suggest_apps(request.need, context)
        return {
            "need": request.need,
            "suggestions": suggestions,
            "model": service.model
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/quick-prompts")
async def get_quick_prompts(
    current_user: User = Depends(get_current_user)
):
    """
    Get a list of quick prompt suggestions for the chat.
    """
    return {
        "prompts": [
            {
                "category": "Suggestions",
                "items": [
                    "Quelle alternative self-hosted à Google Photos ?",
                    "Comment remplacer Notion par une solution self-hosted ?",
                    "Quelle solution de backup recommandes-tu ?",
                    "Je cherche un gestionnaire de mots de passe self-hosted",
                ]
            },
            {
                "category": "Configuration",
                "items": [
                    "Comment configurer un reverse proxy avec Traefik ?",
                    "Comment sécuriser mes applications avec Authelia ?",
                    "Comment mettre en place des backups automatiques ?",
                    "Explique-moi comment fonctionne Docker Compose",
                ]
            },
            {
                "category": "Mon infrastructure",
                "items": [
                    "Analyse mes applications installées et suggère des améliorations",
                    "Quelles applications me manquent pour une stack complète ?",
                    "Comment organiser mes conteneurs Docker ?",
                    "Quelles sont les bonnes pratiques de sécurité ?",
                ]
            },
            {
                "category": "Comparaisons",
                "items": [
                    "Jellyfin vs Plex vs Emby, que choisir ?",
                    "Nextcloud vs Seafile vs Syncthing ?",
                    "Vaultwarden vs Bitwarden, quelle différence ?",
                    "Traefik vs Nginx Proxy Manager ?",
                ]
            }
        ]
    }


# ============== Ollama Configuration Endpoints ==============

class OllamaConfigResponse(BaseModel):
    """Ollama configuration response."""
    url: str
    model: str
    available: bool
    models: List[dict] = []


class OllamaConfigUpdate(BaseModel):
    """Ollama configuration update request."""
    url: Optional[str] = None
    model: Optional[str] = None


class OllamaTestRequest(BaseModel):
    """Request to test an Ollama connection."""
    url: str


class OllamaTestResponse(BaseModel):
    """Response from testing Ollama connection."""
    success: bool
    message: str
    models: List[dict] = []


def get_ollama_config(db: Session) -> dict:
    """Get Ollama configuration from database or defaults."""
    url_config = db.query(SystemConfig).filter(SystemConfig.key == "ollama_url").first()
    model_config = db.query(SystemConfig).filter(SystemConfig.key == "ollama_model").first()

    return {
        "url": url_config.value if url_config else settings.OLLAMA_URL,
        "model": model_config.value if model_config else settings.OLLAMA_MODEL,
    }


def set_ollama_config(db: Session, key: str, value: str, description: str = None):
    """Set an Ollama configuration value."""
    config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if config:
        config.value = value
    else:
        config = SystemConfig(key=key, value=value, description=description)
        db.add(config)
    db.commit()


@router.get("/config", response_model=OllamaConfigResponse)
async def get_ollama_configuration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Get the current Ollama configuration.
    Admin only.
    """
    config = get_ollama_config(db)
    service = get_chat_service()
    available = await service.is_available()
    models = await service.get_models() if available else []

    return OllamaConfigResponse(
        url=config["url"],
        model=config["model"],
        available=available,
        models=models
    )


@router.put("/config", response_model=OllamaConfigResponse)
async def update_ollama_configuration(
    update: OllamaConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Update the Ollama configuration.
    Admin only.
    """
    if update.url:
        set_ollama_config(db, "ollama_url", update.url, "Ollama API URL")

    if update.model:
        set_ollama_config(db, "ollama_model", update.model, "Ollama model to use")

    # Reset the service to use new configuration
    config = get_ollama_config(db)
    reset_chat_service(config["url"], config["model"])

    service = get_chat_service()
    available = await service.is_available()
    models = await service.get_models() if available else []

    return OllamaConfigResponse(
        url=config["url"],
        model=config["model"],
        available=available,
        models=models
    )


@router.post("/test-connection", response_model=OllamaTestResponse)
async def test_ollama_connection(
    request: OllamaTestRequest,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Test connection to an Ollama instance.
    Admin only.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{request.url}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                return OllamaTestResponse(
                    success=True,
                    message=f"Connexion réussie. {len(models)} modèle(s) disponible(s).",
                    models=models
                )
            else:
                return OllamaTestResponse(
                    success=False,
                    message=f"Erreur HTTP {response.status_code}",
                    models=[]
                )
    except httpx.TimeoutException:
        return OllamaTestResponse(
            success=False,
            message="Délai d'attente dépassé. Vérifiez l'URL et le réseau.",
            models=[]
        )
    except httpx.ConnectError:
        return OllamaTestResponse(
            success=False,
            message="Impossible de se connecter. Vérifiez l'URL et que Ollama est démarré.",
            models=[]
        )
    except Exception as e:
        return OllamaTestResponse(
            success=False,
            message=f"Erreur: {str(e)}",
            models=[]
        )


# ============== Conversation History Endpoints ==============

class ConversationMessageSchema(BaseModel):
    """Schema for a conversation message."""
    role: str
    content: str
    timestamp: Optional[str] = None


class ConversationCreate(BaseModel):
    """Create a new conversation."""
    title: Optional[str] = "Nouvelle conversation"
    model: Optional[str] = None


class ConversationUpdate(BaseModel):
    """Update a conversation."""
    title: Optional[str] = None
    messages: Optional[List[ConversationMessageSchema]] = None
    model: Optional[str] = None


class ConversationResponse(BaseModel):
    """Response for a conversation."""
    id: int
    title: str
    model: Optional[str]
    messages: List[dict]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ConversationListItem(BaseModel):
    """List item for conversations."""
    id: int
    title: str
    model: Optional[str]
    message_count: int
    created_at: datetime
    updated_at: Optional[datetime]


@router.get("/conversations", response_model=List[ConversationListItem])
async def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all conversations for the current user.
    """
    conversations = db.query(ChatConversation).filter(
        ChatConversation.user_id == current_user.id
    ).order_by(ChatConversation.updated_at.desc()).all()

    return [
        ConversationListItem(
            id=conv.id,
            title=conv.title,
            model=conv.model,
            message_count=len(conv.messages) if conv.messages else 0,
            created_at=conv.created_at,
            updated_at=conv.updated_at
        )
        for conv in conversations
    ]


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new conversation.
    """
    service = get_chat_service()

    conversation = ChatConversation(
        user_id=current_user.id,
        title=data.title or "Nouvelle conversation",
        model=data.model or service.model,
        messages=[]
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        model=conversation.model,
        messages=conversation.messages or [],
        created_at=conversation.created_at,
        updated_at=conversation.updated_at
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific conversation by ID.
    """
    conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation non trouvée"
        )

    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        model=conversation.model,
        messages=conversation.messages or [],
        created_at=conversation.created_at,
        updated_at=conversation.updated_at
    )


@router.put("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: int,
    data: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a conversation (title, messages, or model).
    """
    conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation non trouvée"
        )

    if data.title is not None:
        conversation.title = data.title

    if data.model is not None:
        conversation.model = data.model

    if data.messages is not None:
        conversation.messages = [
            {
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp or datetime.utcnow().isoformat()
            }
            for msg in data.messages
        ]

    db.commit()
    db.refresh(conversation)

    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        model=conversation.model,
        messages=conversation.messages or [],
        created_at=conversation.created_at,
        updated_at=conversation.updated_at
    )


@router.post("/conversations/{conversation_id}/message")
async def add_message_to_conversation(
    conversation_id: int,
    message: ConversationMessageSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a single message to a conversation.
    """
    conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation non trouvée"
        )

    messages = conversation.messages or []
    messages.append({
        "role": message.role,
        "content": message.content,
        "timestamp": message.timestamp or datetime.utcnow().isoformat()
    })
    conversation.messages = messages

    # Auto-generate title from first user message if still default
    if conversation.title == "Nouvelle conversation" and message.role == "user":
        # Take first 50 chars of the message as title
        conversation.title = message.content[:50] + ("..." if len(message.content) > 50 else "")

    db.commit()
    db.refresh(conversation)

    return {"success": True, "message_count": len(conversation.messages)}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a conversation.
    """
    conversation = db.query(ChatConversation).filter(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == current_user.id
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation non trouvée"
        )

    db.delete(conversation)
    db.commit()

    return {"success": True}
