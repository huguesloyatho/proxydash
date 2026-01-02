from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.applications import router as applications_router
from app.api.categories import router as categories_router
from app.api.public import router as public_router
from app.api.users import router as users_router
from app.api.npm_instances import router as npm_instances_router
from app.api.widgets import router as widgets_router
from app.api.vikunja import router as vikunja_router
from app.api.tabs import router as tabs_router
from app.api.health_check import router as health_check_router
from app.api.crowdsec import router as crowdsec_router
from app.api.ping import router as ping_router
from app.api.docker import router as docker_router
from app.api.logs import router as logs_router
from app.api.servers import router as servers_router
from app.api.rss import router as rss_router
from app.api.notes import router as notes_router
from app.api.websocket import router as websocket_router
from app.api.infrastructure import router as infrastructure_router
from app.api.chat import router as chat_router
from app.api.speech import router as speech_router
from app.api.app_dashboard import router as app_dashboard_router
from app.api.notifications import router as notifications_router
from app.api.security import router as security_router
from app.api.webhooks import router as webhooks_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(applications_router)
api_router.include_router(categories_router)
api_router.include_router(public_router)
api_router.include_router(users_router)
api_router.include_router(npm_instances_router)
api_router.include_router(widgets_router)
api_router.include_router(vikunja_router)
api_router.include_router(tabs_router)
api_router.include_router(health_check_router)
api_router.include_router(crowdsec_router)
api_router.include_router(ping_router)
api_router.include_router(docker_router)
api_router.include_router(logs_router)
api_router.include_router(servers_router)
api_router.include_router(rss_router)
api_router.include_router(notes_router)
api_router.include_router(websocket_router)
api_router.include_router(infrastructure_router)
api_router.include_router(chat_router)
api_router.include_router(speech_router)
api_router.include_router(app_dashboard_router)
api_router.include_router(notifications_router)
api_router.include_router(security_router)
api_router.include_router(webhooks_router)
