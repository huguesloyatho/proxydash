# ProxyDash Backend

Backend API pour ProxyDash - Dashboard de monitoring et gestion pour Nginx Proxy Manager.

## Tags disponibles

- `latest` - Version stable la plus recente
- `1.0.0` - Version initiale

## Demarrage rapide

```bash
docker run -d \
  --name proxydash-backend \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://user:password@postgres:5432/proxydash \
  -e NPM_DATABASE_URL=postgresql://npm:password@npm-db:5432/npm \
  -e SECRET_KEY=votre-cle-secrete \
  lortath/proxydash-backend:latest
```

## Variables d'environnement

### Requises

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL principale (ex: `postgresql://user:pass@host:5432/db`) |
| `NPM_DATABASE_URL` | URL base de donnees Nginx Proxy Manager |
| `SECRET_KEY` | Cle secrete pour les tokens JWT (generez une cle aleatoire) |

### Optionnelles

| Variable | Description | Default |
|----------|-------------|---------|
| `ALGORITHM` | Algorithme JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiration des tokens | `1440` (24h) |
| `REDIS_URL` | URL Redis pour le cache | `redis://localhost:6379` |
| `REDIS_ENABLED` | Activer le cache Redis | `true` |
| `REDIS_CACHE_TTL` | TTL du cache (secondes) | `30` |
| `OLLAMA_URL` | URL serveur Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Modele Ollama pour le chat IA | `mistral:7b` |
| `SYNC_INTERVAL_MINUTES` | Intervalle de sync NPM | `5` |
| `WS_ENABLED` | Activer WebSocket | `true` |
| `WS_HEARTBEAT_INTERVAL` | Intervalle heartbeat WS | `30` |
| `WEBHOOK_BASE_URL` | URL publique pour webhooks | auto-detecte |

## Docker Compose

```yaml
version: '3.8'

services:
  backend:
    image: lortath/proxydash-backend:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://proxydash:password@postgres:5432/proxydash
      - NPM_DATABASE_URL=postgresql://npm:password@npm-db:5432/npm
      - SECRET_KEY=changez-cette-cle-secrete
      - REDIS_URL=redis://redis:6379
      - OLLAMA_URL=http://ollama:11434
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_USER=proxydash
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=proxydash
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

## Fonctionnalites

- **API REST** - Endpoints pour hosts, serveurs, alertes, webhooks
- **Synchronisation NPM** - Sync automatique avec Nginx Proxy Manager
- **WebSocket** - Mises a jour en temps reel
- **Chat IA** - Integration Ollama (Mistral, LLaMA)
- **Webhooks** - Support GitHub, GitLab, Uptime Kuma, Prometheus, Grafana
- **2FA** - Authentification a deux facteurs TOTP
- **Audit logs** - Tracabilite complete

## Ports exposes

- `8000` - API HTTP et WebSocket

## Documentation API

Une fois le container demarre, la documentation Swagger est disponible sur:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Stack technique

- Python 3.11
- FastAPI
- SQLAlchemy
- PostgreSQL
- Redis
- Alembic (migrations)

## Liens

- [GitHub](https://github.com/lortath/dashboard-auto)
- [Frontend Docker Hub](https://hub.docker.com/r/lortath/proxydash-frontend)
