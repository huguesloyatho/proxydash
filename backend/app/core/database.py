from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Main database (ProxyDash)
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# NPM database (read-only)
npm_engine = create_engine(settings.NPM_DATABASE_URL)
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
