#!/bin/bash
# ============================================
#  POSetRDV Super-Admin - Déploiement SÉPARÉ
#  ⚠️  NE TOUCHE PAS à Mums Home (port 4000)
#  Déploie sur le port 4001
# ============================================

set -e

# ---- CONFIGURATION ----
REPO_URL="https://github.com/Issamo1555/happy-shop-system.git"
BRANCH="feature/crm-calendar-improvements"
APP_DIR="/opt/posrdv-superadmin"
COMPOSE_FILE="docker-compose.superadmin.yml"
APP_PORT=4001

# ---- COULEURS ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()  { echo -e "\n${BLUE}══════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}══════════════════════════════════════${NC}\n"; }

# ---- VÉRIFICATION ROOT ----
if [ "$EUID" -ne 0 ]; then
  error "Ce script doit être exécuté en root. Utilisez: sudo bash deploy-superadmin.sh"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   POSetRDV Super-Admin - Déploiement     ║${NC}"
echo -e "${GREEN}║   ⚠️  Instance SÉPARÉE (port $APP_PORT)       ║${NC}"
echo -e "${GREEN}║   Mums Home (port 4000) NON IMPACTÉ      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# Vérifier que Mums Home tourne toujours
# ============================================
step "0/4 - Vérification de Mums Home"

if docker ps --format '{{.Names}}' | grep -q "posrdv-app\|mums-home-pos"; then
  log "✅ Mums Home (production) tourne bien — ON N'Y TOUCHE PAS"
else
  warn "⚠️  Mums Home ne semble pas en cours d'exécution (pas grave, on continue)"
fi

# ============================================
# ÉTAPE 1 : Docker
# ============================================
step "1/4 - Vérification de Docker"

if command -v docker &> /dev/null; then
  log "Docker installé"
else
  error "Docker non trouvé. Installez Docker d'abord."
fi

# ============================================
# ÉTAPE 2 : Code source
# ============================================
step "2/4 - Récupération du code source"

if [ -d "$APP_DIR/.git" ]; then
  warn "Dossier existant. Mise à jour..."
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
  log "Code mis à jour depuis GitHub (branche: $BRANCH)"
else
  if [ -d "$APP_DIR" ]; then
    warn "Dossier existant sans git. Sauvegarde..."
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
  fi
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  log "Code cloné depuis GitHub (branche: $BRANCH)"
fi

# ============================================
# ÉTAPE 3 : Build et lancement
# ============================================
step "3/4 - Construction et lancement (port $APP_PORT)"

cd "$APP_DIR"

# Arrêter l'ancien conteneur super-admin s'il existe (JAMAIS mums-home-pos !)
if docker ps -a --format '{{.Names}}' | grep -q "posrdv-superadmin"; then
  warn "Arrêt de l'ancien conteneur super-admin..."
  docker compose -f "$COMPOSE_FILE" down 2>/dev/null || docker stop posrdv-superadmin 2>/dev/null
  log "Ancien conteneur super-admin arrêté"
fi

# Build et lancement avec le fichier compose spécifique
log "Construction de l'image Docker..."
docker compose -f "$COMPOSE_FILE" up -d --build

# Attendre le démarrage
echo -n "  Démarrage"
for i in {1..30}; do
  if docker ps --format '{{.Names}}' | grep -q "posrdv-superadmin"; then
    echo ""
    log "Conteneur super-admin démarré"
    break
  fi
  echo -n "."
  sleep 2
done

# ============================================
# ÉTAPE 4 : Pare-feu
# ============================================
step "4/4 - Configuration réseau"

if command -v ufw &> /dev/null; then
  if ufw status | grep -q "active"; then
    ufw allow $APP_PORT/tcp > /dev/null 2>&1
    log "Port $APP_PORT ouvert (UFW)"
  fi
fi

if command -v firewall-cmd &> /dev/null; then
  if systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-port=$APP_PORT/tcp > /dev/null 2>&1
    firewall-cmd --reload > /dev/null 2>&1
    log "Port $APP_PORT ouvert (firewalld)"
  fi
fi

# ============================================
# RÉSULTAT
# ============================================
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "VOTRE_IP")
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ SUPER-ADMIN DÉPLOYÉ !                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}🏥 Mums Home (PROD) :${NC}  http://${SERVER_IP}:4000  ← INCHANGÉ"
echo -e "  ${BLUE}🚀 Super-Admin (NEW) :${NC} http://${SERVER_IP}:${APP_PORT}  ← NOUVEAU"
if [ -n "$PUBLIC_IP" ]; then
echo -e "  ${BLUE}🌐 Public :${NC}            http://${PUBLIC_IP}:${APP_PORT}"
fi
echo ""
echo -e "  ${YELLOW}Identifiants Super-Admin :${NC}"
echo -e "    Email :    superadmin@posrdv.com"
echo -e "    Mot de passe : admin123"
echo ""
echo -e "  ${YELLOW}Commandes utiles :${NC}"
echo -e "    Logs :       ${BLUE}docker logs -f posrdv-superadmin${NC}"
echo -e "    Redémarrer : ${BLUE}docker compose -f ${APP_DIR}/${COMPOSE_FILE} restart${NC}"
echo -e "    Arrêter :    ${BLUE}docker compose -f ${APP_DIR}/${COMPOSE_FILE} down${NC}"
echo ""
echo -e "  ${GREEN}⚠️  Mums Home sur le port 4000 n'a PAS été touché${NC}"
echo ""
