#!/bin/bash
# ============================================
#  Mums'Home POS - Script de Déploiement
#  Usage: curl -sSL <url> | bash
#  Ou:    bash deploy.sh
# ============================================

set -e

# ---- CONFIGURATION ----
REPO_URL="https://github.com/Issamo1555/happy-shop-system.git"
BRANCH="feature/soft-delete-security"
APP_DIR="/opt/mums-home-pos"
APP_PORT=8080

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
  error "Ce script doit être exécuté en root. Utilisez: sudo bash deploy.sh"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Mums'Home POS - Déploiement Auto       ║${NC}"
echo -e "${GREEN}║   Parentalité & Co                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# ÉTAPE 1 : Mise à jour du système
# ============================================
step "1/5 - Mise à jour du système"

if command -v apt-get &> /dev/null; then
  PKG_MANAGER="apt"
  apt-get update -qq
  apt-get install -y -qq curl git wget > /dev/null 2>&1
  log "Système mis à jour (apt)"
elif command -v yum &> /dev/null; then
  PKG_MANAGER="yum"
  yum update -y -q
  yum install -y -q curl git wget > /dev/null 2>&1
  log "Système mis à jour (yum)"
elif command -v apk &> /dev/null; then
  PKG_MANAGER="apk"
  apk update > /dev/null 2>&1
  apk add curl git wget > /dev/null 2>&1
  log "Système mis à jour (apk)"
else
  warn "Gestionnaire de paquets non reconnu. Installation manuelle requise."
fi

# ============================================
# ÉTAPE 2 : Installation de Docker
# ============================================
step "2/5 - Vérification de Docker"

if command -v docker &> /dev/null; then
  DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
  log "Docker déjà installé (v${DOCKER_VERSION})"
else
  warn "Docker non trouvé. Installation en cours..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log "Docker installé avec succès"
fi

# Vérifier Docker Compose
if docker compose version &> /dev/null; then
  log "Docker Compose disponible"
else
  warn "Docker Compose non trouvé. Installation du plugin..."
  mkdir -p /usr/local/lib/docker/cli-plugins/
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  log "Docker Compose installé"
fi

# ============================================
# ÉTAPE 3 : Cloner / Mettre à jour le code
# ============================================
step "3/5 - Récupération du code source"

if [ -d "$APP_DIR/.git" ]; then
  warn "Dossier existant détecté. Mise à jour..."
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
  log "Code mis à jour depuis GitHub"
else
  if [ -d "$APP_DIR" ]; then
    warn "Dossier existant sans git. Sauvegarde..."
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
  fi
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  log "Code cloné depuis GitHub"
fi

# ============================================
# ÉTAPE 4 : Build et lancement Docker
# ============================================
step "4/5 - Construction et lancement de l'application"

cd "$APP_DIR"

# Arrêter l'ancien conteneur s'il existe
if docker ps -a --format '{{.Names}}' | grep -q "mums-home-pos"; then
  warn "Arrêt de l'ancien conteneur..."
  docker compose down 2>/dev/null || docker stop mums-home-pos 2>/dev/null
  log "Ancien conteneur arrêté"
fi

# Build et lancement
log "Construction de l'image Docker (peut prendre 2-5 minutes)..."
docker compose up -d --build

# Attendre que le conteneur démarre
echo -n "  Démarrage"
for i in {1..30}; do
  if docker ps --format '{{.Names}}' | grep -q "mums-home-pos"; then
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' mums-home-pos 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ] || [ "$i" -gt 15 ]; then
      echo ""
      log "Conteneur démarré"
      break
    fi
  fi
  echo -n "."
  sleep 2
done

# ============================================
# ÉTAPE 5 : Configuration du pare-feu
# ============================================
step "5/5 - Configuration réseau"

# Ouvrir le port si ufw est actif
if command -v ufw &> /dev/null; then
  if ufw status | grep -q "active"; then
    ufw allow $APP_PORT/tcp > /dev/null 2>&1
    log "Port $APP_PORT ouvert dans le pare-feu (UFW)"
  fi
fi

# Ouvrir le port si firewalld est actif
if command -v firewall-cmd &> /dev/null; then
  if systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-port=$APP_PORT/tcp > /dev/null 2>&1
    firewall-cmd --reload > /dev/null 2>&1
    log "Port $APP_PORT ouvert dans le pare-feu (firewalld)"
  fi
fi

# ============================================
# RÉSULTAT FINAL
# ============================================
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || curl -s ifconfig.me 2>/dev/null || echo "VOTRE_IP")
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DÉPLOIEMENT RÉUSSI !                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Accès local :${NC}    http://localhost:${APP_PORT}"
echo -e "  ${BLUE}Accès réseau :${NC}   http://${SERVER_IP}:${APP_PORT}"
if [ -n "$PUBLIC_IP" ]; then
echo -e "  ${BLUE}Accès public :${NC}   http://${PUBLIC_IP}:${APP_PORT}"
fi
echo ""
echo -e "  ${YELLOW}Identifiants admin :${NC}"
echo -e "    Email :    admin@mums.home"
echo -e "    Mot de passe : admin123"
echo ""
echo -e "  ${YELLOW}Commandes utiles :${NC}"
echo -e "    Voir les logs :     ${BLUE}docker logs -f mums-home-pos${NC}"
echo -e "    Redémarrer :        ${BLUE}docker compose -f ${APP_DIR}/docker-compose.yml restart${NC}"
echo -e "    Arrêter :           ${BLUE}docker compose -f ${APP_DIR}/docker-compose.yml down${NC}"
echo -e "    Mise à jour :       ${BLUE}sudo bash ${APP_DIR}/deploy.sh${NC}"
echo ""
echo -e "  ${GREEN}Base de données persistée dans le volume Docker 'pos-data'${NC}"
echo ""
