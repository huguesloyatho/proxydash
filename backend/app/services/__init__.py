from app.services.app_detection import detect_application, get_icon_url, format_app_name
from app.services.ollama import generate_description, is_ollama_available
from app.services.npm_sync import sync_all_npm_instances, sync_applications, remove_deleted_applications

__all__ = [
    "detect_application", "get_icon_url", "format_app_name",
    "generate_description", "is_ollama_available",
    "sync_all_npm_instances", "sync_applications", "remove_deleted_applications",
]
