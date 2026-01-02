from sqlalchemy import Column, Integer, String, Boolean
from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    icon = Column(String(100), nullable=False)
    order = Column(Integer, default=0)
    is_public = Column(Boolean, default=False)  # True if visible on public dashboard


# Default categories
DEFAULT_CATEGORIES = [
    {"slug": "media", "name": "Media", "icon": "mdi:play-circle", "order": 1},
    {"slug": "productivity", "name": "Productivité", "icon": "mdi:briefcase", "order": 2},
    {"slug": "admin", "name": "Administration", "icon": "mdi:cog", "order": 3},
    {"slug": "monitoring", "name": "Monitoring", "icon": "mdi:chart-line", "order": 4},
    {"slug": "network", "name": "Réseau", "icon": "mdi:network", "order": 5},
    {"slug": "storage", "name": "Stockage", "icon": "mdi:database", "order": 6},
    {"slug": "security", "name": "Sécurité", "icon": "mdi:shield", "order": 7},
    {"slug": "development", "name": "Développement", "icon": "mdi:code-braces", "order": 8},
    {"slug": "home", "name": "Domotique", "icon": "mdi:home-automation", "order": 9},
    {"slug": "communication", "name": "Communication", "icon": "mdi:message", "order": 10},
    {"slug": "other", "name": "Autres", "icon": "mdi:apps", "order": 99},
]
