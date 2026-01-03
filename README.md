# Dashboard Auto

Dashboard de monitoring et gestion pour Nginx Proxy Manager (NPM) avec synchronisation automatique, alertes intelligentes, chat IA et visualisation d'infrastructure.

## Fonctionnalites

### Core
- **Synchronisation NPM** - Sync automatique des hosts depuis Nginx Proxy Manager
- **Gestion des serveurs** - Monitoring SSH, statut, metriques
- **Tableaux de bord personnalisables** - Tabs drag-and-drop avec widgets configurables
- **Visualisation infrastructure** - Carte interactive des connexions reseau

### Monitoring & Alertes
- **Alertes intelligentes** - Detection automatique des problemes (certificats expires, hosts down)
- **Notifications multi-canaux** - Email, Discord, Telegram, Slack, Pushover, Ntfy
- **Webhooks entrants** - GitHub, GitLab, Uptime Kuma, Prometheus, Grafana
- **Logs d'audit** - Tracabilite complete des actions

### Intelligence
- **Chat IA** - Assistant propulse par Ollama (Mistral, LLaMA)
- **Recherche web** - Integration SearXNG optionnelle
- **Reconnaissance vocale** - Transcription via Whisper (local)

### Interface
- **Theme sombre/clair** - Support complet des preferences systeme
- **Temps reel** - WebSocket pour mises a jour instantanees
- **Responsive** - Adaptation mobile/desktop
- **Widgets** - Compteurs, graphiques, listes, embeds Grafana

## Architecture

```
dashboard-auto/
├── backend/           # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/       # Endpoints REST
│   │   ├── core/      # Config, auth, database
│   │   ├── models/    # Modeles SQLAlchemy
│   │   ├── schemas/   # Schemas Pydantic
│   │   └── services/  # Logique metier
│   ├── alembic/       # Migrations DB
│   └── requirements.txt
├── frontend/          # Next.js 16 + React 19
│   ├── src/
│   │   ├── app/       # Pages (App Router)
│   │   ├── components/
│   │   └── lib/       # API clients, stores
│   └── package.json
└── docker-compose.yml
```

## Installation

### Prerequis

- Docker et Docker Compose
- PostgreSQL 14+ (externe ou containerise)
- Redis (inclus dans docker-compose)
- Ollama (optionnel, pour le chat IA)

### Deploiement rapide avec Docker Hub

Les images Docker sont disponibles sur Docker Hub pour un deploiement simplifie.

**Images disponibles:**
- `lortath/proxydash-backend:latest` - API FastAPI
- `lortath/proxydash-frontend:latest` - Interface Next.js

**1. Creer un fichier docker-compose.yml:**

```yaml
version: '3.8'

services:
  backend:
    image: lortath/proxydash-backend:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/proxydash
      - NPM_DATABASE_URL=postgresql://npm:password@npm-db:5432/npm
      - SECRET_KEY=votre-cle-secrete-longue-aleatoire
      - REDIS_URL=redis://redis:6379
      - OLLAMA_URL=http://ollama:11434
    depends_on:
      - redis
    restart: unless-stopped

  frontend:
    image: lortath/proxydash-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
```

**2. Lancer les services:**

```bash
docker-compose up -d
```

**3. Acceder a l'application:**
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Documentation API: http://localhost:8000/docs

### Developpement

1. **Cloner le repository**
```bash
git clone https://github.com/votre-user/dashboard-auto.git
cd dashboard-auto
```

2. **Configurer le backend**
```bash
cd backend
cp .env.example .env
# Editer .env avec vos valeurs
```

3. **Configurer le frontend**
```bash
cd frontend
cp .env.example .env.local
# Editer .env.local avec vos valeurs
```

4. **Lancer les services**
```bash
# Depuis la racine du projet
docker-compose -f docker-compose.dev.yml up -d

# Ou sans Docker
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

5. **Initialiser la base de donnees**
```bash
cd backend
alembic upgrade head
```

### Production

1. **Configuration**
```bash
# Creer les fichiers .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Configurer les variables pour production
nano backend/.env
```

2. **Variables importantes pour la production**
```env
# backend/.env
DATABASE_URL=postgresql://user:password@db-host:5432/proxydash
SECRET_KEY=votre-cle-secrete-longue-aleatoire
WEBHOOK_BASE_URL=https://api.votre-domaine.com

# frontend/.env.local
NEXT_PUBLIC_API_URL=https://api.votre-domaine.com
```

3. **Deployer**
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## Configuration

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL principale | requis |
| `NPM_DATABASE_URL` | URL base NPM (pour sync) | requis |
| `SECRET_KEY` | Cle secrete JWT | requis |
| `ALGORITHM` | Algorithme JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiration token | `1440` (24h) |
| `OLLAMA_URL` | URL serveur Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Modele Ollama | `mistral:7b` |
| `SYNC_INTERVAL_MINUTES` | Intervalle sync NPM | `5` |
| `REDIS_URL` | URL Redis | `redis://localhost:6379` |
| `REDIS_ENABLED` | Activer le cache | `true` |
| `REDIS_CACHE_TTL` | TTL cache (secondes) | `30` |
| `DB_POOL_SIZE` | Taille pool connexions DB | `40` |
| `DB_MAX_OVERFLOW` | Overflow pool connexions | `60` |
| `WS_ENABLED` | Activer WebSocket | `true` |
| `WS_HEARTBEAT_INTERVAL` | Heartbeat WS (secondes) | `30` |
| `WEBHOOK_BASE_URL` | URL publique pour webhooks | auto-detecte |

### Frontend (.env.local)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL du backend | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket (optionnel) | meme que API_URL |
| `NEXT_PUBLIC_APP_URL` | URL publique frontend | `http://localhost:3000` |

## API

### Authentification

Toutes les routes protegees utilisent JWT Bearer tokens.

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "pass"}'

# Utiliser le token
curl http://localhost:8000/api/hosts \
  -H "Authorization: Bearer <token>"
```

### Endpoints principaux

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/hosts` | Liste des hosts NPM |
| GET | `/api/servers` | Liste des serveurs |
| GET | `/api/alerts` | Liste des alertes |
| GET | `/api/tabs` | Tableaux de bord |
| POST | `/api/webhooks/incoming/{token}` | Reception webhook |
| GET | `/api/public/infrastructure/map` | Donnees carte infra |

### API Publique

Endpoints accessibles sans authentification (pour integrations tierces):

```bash
# Carte d'infrastructure (pour infra-mapper)
curl http://localhost:8000/api/public/infrastructure/map
```

## Webhooks

### Configuration

1. Creer un webhook dans **Parametres > Webhooks**
2. Copier l'URL generee
3. Configurer dans l'application source (GitHub, GitLab, etc.)

### Services supportes

- **GitHub** - Push, Pull Request, Issues, Releases
- **GitLab** - Push, Merge Request, Issues
- **Uptime Kuma** - Alertes de monitoring
- **Prometheus Alertmanager** - Alertes
- **Grafana** - Alertes et notifications

### URL Webhook

L'URL des webhooks utilise la variable `WEBHOOK_BASE_URL`. Si non definie, l'URL de la requete est utilisee.

```env
# Pour production avec un domaine public
WEBHOOK_BASE_URL=https://api.mon-domaine.com
```

## Developpement

### Structure du code

```
backend/app/
├── api/          # Routes FastAPI
├── core/         # Config, auth, database
├── models/       # Modeles SQLAlchemy (ORM)
├── schemas/      # Schemas Pydantic (validation)
└── services/     # Logique metier
```

### Ajouter une migration

```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

### Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm run lint
npm run build
```

## Securite

- Tous les mots de passe sont hashes avec bcrypt
- JWT avec expiration configurable
- 2FA optionnel (TOTP)
- Validation HMAC pour webhooks
- Audit logs de toutes les actions sensibles
- CORS configure pour production

## Licence

MIT License - voir [LICENSE](LICENSE) pour plus de details.
