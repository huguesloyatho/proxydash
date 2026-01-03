# ProxyDash Frontend

Interface utilisateur pour ProxyDash - Dashboard de monitoring et gestion pour Nginx Proxy Manager.

## Tags disponibles

- `latest` - Version stable la plus recente
- `1.0.0` - Version initiale

## Demarrage rapide

```bash
docker run -d \
  --name proxydash-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  lortath/proxydash-frontend:latest
```

## Variables d'environnement

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL du backend API | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket (optionnel) | meme que API_URL |
| `NEXT_PUBLIC_APP_URL` | URL publique du frontend | `http://localhost:3000` |

## Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    image: lortath/proxydash-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    image: lortath/proxydash-backend:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://proxydash:password@postgres:5432/proxydash
      - NPM_DATABASE_URL=postgresql://npm:password@npm-db:5432/npm
      - SECRET_KEY=changez-cette-cle-secrete
      - REDIS_URL=redis://redis:6379
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

- **Tableaux de bord** - Tabs personnalisables avec widgets drag-and-drop
- **Widgets** - Compteurs, graphiques, listes, statut VM, embeds Grafana
- **Theme** - Mode sombre/clair avec detection automatique
- **Temps reel** - Mises a jour via WebSocket
- **Responsive** - Adaptation mobile et desktop
- **Chat IA** - Interface de chat avec assistant IA
- **Reconnaissance vocale** - Transcription Whisper integree
- **Carte infrastructure** - Visualisation interactive du reseau

## Ports exposes

- `3000` - Interface web HTTP

## Stack technique

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Zustand (state management)
- React Query (data fetching)

## Configuration Production

Pour un deploiement en production avec un reverse proxy (Nginx, Traefik):

```yaml
frontend:
  image: lortath/proxydash-frontend:latest
  environment:
    - NEXT_PUBLIC_API_URL=https://api.votre-domaine.com
    - NEXT_PUBLIC_APP_URL=https://votre-domaine.com
```

## Liens

- [GitHub](https://github.com/lortath/dashboard-auto)
- [Backend Docker Hub](https://hub.docker.com/r/lortath/proxydash-backend)
