from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Main database (ProxyDash)
# Increase pool size to handle concurrent widget requests
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=40,
    max_overflow=60,
    pool_timeout=60,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# NPM database (read-only)
npm_engine = create_engine(
    settings.NPM_DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_pre_ping=True,
)
NPMSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=npm_engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_npm_db():
    db = NPMSessionLocal()
    try:
        yield db
    finally:
        db.close()
