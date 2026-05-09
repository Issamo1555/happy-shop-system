#!/bin/bash
# ============================================
#  Mums'Home POS — Création du Package Client
#  Usage:
#    bash build-package.sh              → build v actuelle
#    bash build-package.sh 1.2.0        → build v spécifique
#    bash build-package.sh patch        → auto-incrément patch  (1.0.0 → 1.0.1)
#    bash build-package.sh minor        → auto-incrément minor  (1.0.0 → 1.1.0)
#    bash build-package.sh major        → auto-incrément major  (1.0.0 → 2.0.0)
# ============================================

set -e

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

# ---- VERSION ----
VERSION_FILE="./VERSION"
CURRENT_VERSION=$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]' || echo "1.0.0")

# Gestion de la version via argument
if [ -n "$1" ]; then
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  case "$1" in
    patch) PATCH=$((PATCH + 1)); APP_VERSION="${MAJOR}.${MINOR}.${PATCH}" ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0; APP_VERSION="${MAJOR}.${MINOR}.${PATCH}" ;;
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0; APP_VERSION="${MAJOR}.${MINOR}.${PATCH}" ;;
    [0-9]*.[0-9]*.[0-9]*) APP_VERSION="$1" ;;
    *) error "Usage: bash build-package.sh [patch|minor|major|x.y.z]" ;;
  esac
  echo "$APP_VERSION" > "$VERSION_FILE"
  log "Version mise à jour : ${CURRENT_VERSION} → ${APP_VERSION}"
else
  APP_VERSION="$CURRENT_VERSION"
fi

# ---- CONFIGURATION ----
APP_NAME="mumshome-pos"
IMAGE_TAG="${APP_NAME}:${APP_VERSION}"
PACKAGE_DIR="./package-client"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Mums'Home POS — Build Package v${APP_VERSION}       ║${NC}"
echo -e "${GREEN}║   Parentalité & Co                            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# ÉTAPE 1 : Vérifications
# ============================================
step "1/5 — Vérification de Docker"

if ! command -v docker &> /dev/null; then
  error "Docker n'est pas installé. Installez Docker Desktop."
fi

docker info > /dev/null 2>&1 || error "Docker n'est pas démarré. Lancez Docker Desktop."
log "Docker opérationnel"

# ============================================
# ÉTAPE 2 : Mettre à jour docker-compose.yml avec la version
# ============================================
step "2/5 — Mise à jour de la version"

# Mettre à jour l'image tag dans docker-compose.yml
sed -i.bak "s|image: ${APP_NAME}:.*|image: ${APP_NAME}:${APP_VERSION}|" docker-compose.yml
rm -f docker-compose.yml.bak
log "docker-compose.yml → ${IMAGE_TAG}"
log "VERSION → ${APP_VERSION}"

# ============================================
# ÉTAPE 3 : Build de l'image Docker
# ============================================
step "3/5 — Construction de l'image Docker"

echo -e "  Image : ${BLUE}${IMAGE_TAG}${NC}"
echo -e "  Node  : ${BLUE}20.18.1-alpine3.20${NC}"
echo ""

docker compose build
log "Image construite : ${IMAGE_TAG}"

IMAGE_SIZE=$(docker image inspect ${IMAGE_TAG} --format='{{.Size}}' 2>/dev/null)
IMAGE_SIZE_MB=$((IMAGE_SIZE / 1048576))
log "Taille de l'image : ${IMAGE_SIZE_MB} Mo"

# ============================================
# ÉTAPE 4 : Export de l'image
# ============================================
step "4/5 — Export de l'image Docker"

rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}"

log "Export en cours (peut prendre 1-2 minutes)..."
docker save "${IMAGE_TAG}" -o "${PACKAGE_DIR}/${APP_NAME}.tar"

log "Compression de l'image..."
gzip -9 "${PACKAGE_DIR}/${APP_NAME}.tar"
COMPRESSED_SIZE=$(du -sh "${PACKAGE_DIR}/${APP_NAME}.tar.gz" | cut -f1)
log "Image exportée : ${COMPRESSED_SIZE}"

# ============================================
# ÉTAPE 5 : Préparation du package client
# ============================================
step "5/5 — Préparation du package client"

# Copier docker-compose.yml
cp docker-compose.yml "${PACKAGE_DIR}/docker-compose.yml"

# Copier le changelog
cp CHANGELOG.md "${PACKAGE_DIR}/CHANGELOG.md" 2>/dev/null || true

# Écrire la version dans le package
echo "${APP_VERSION}" > "${PACKAGE_DIR}/VERSION"

# ---- Script de mise à jour Windows ----
cat > "${PACKAGE_DIR}/update-windows.ps1" << WINUPDATE
# ============================================
#  Mums'Home POS — Mise à jour v${APP_VERSION}
#  Exécuter en tant qu'Administrateur
# ============================================

\$ErrorActionPreference = "Stop"

\$APP_NAME    = "${APP_NAME}"
\$APP_VERSION = "${APP_VERSION}"
\$IMAGE_TAG   = "\${APP_NAME}:\${APP_VERSION}"
\$INSTALL_DIR = "C:\MumsHome"

function Log(\$msg)  { Write-Host "[OK] \$msg" -ForegroundColor Green }
function Warn(\$msg) { Write-Host "[!]  \$msg" -ForegroundColor Yellow }
function Err(\$msg)  { Write-Host "[X]  \$msg" -ForegroundColor Red; exit 1 }

# Vérification admin
\$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not \$isAdmin) { Err "Executez en tant qu'Administrateur." }

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Mums'Home POS — Mise a jour v${APP_VERSION}" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier Docker
docker info > \$null 2>&1
if (\$LASTEXITCODE -ne 0) { Err "Docker n'est pas demarre. Lancez Docker Desktop." }
Log "Docker operationnel"

# 2. Charger la nouvelle image
\$scriptDir = Split-Path -Parent \$MyInvocation.MyCommand.Path
\$tarFile = Join-Path \$scriptDir "\$APP_NAME.tar.gz"
if (-not (Test-Path \$tarFile)) {
    \$tarFile = Join-Path \$scriptDir "\$APP_NAME.tar"
    if (-not (Test-Path \$tarFile)) { Err "Image introuvable." }
}

Write-Host "  Chargement de la nouvelle image..." -ForegroundColor Yellow
docker load -i \$tarFile
Log "Image v${APP_VERSION} chargee"

# 3. Mettre à jour docker-compose.yml
\$composeFile = Join-Path \$scriptDir "docker-compose.yml"
if (Test-Path \$composeFile) {
    Copy-Item \$composeFile "\$INSTALL_DIR\docker-compose.yml" -Force
    Log "Configuration mise a jour"
}

# 4. Redémarrer avec la nouvelle version (les données sont préservées !)
Set-Location \$INSTALL_DIR
Warn "Arret de l'ancienne version..."
docker compose down 2>\$null

Write-Host "  Demarrage de la v${APP_VERSION}..." -ForegroundColor Yellow
docker compose up -d
Log "Mise a jour terminee !"

# 5. Nettoyage des anciennes images
Write-Host "  Nettoyage des anciennes images..." -ForegroundColor Yellow
docker image prune -f > \$null 2>&1
Log "Anciennes images supprimees"

# Résultat
\$serverIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -notlike "*Loopback*" -and \$_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   MISE A JOUR REUSSIE ! v${APP_VERSION}" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Acces : http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Reseau : http://\${serverIP}:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Les donnees (produits, ventes, etc.) sont PRESERVEES." -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:8080"
WINUPDATE

cat > "${PACKAGE_DIR}/UPDATE-Windows.bat" << 'WINUPDATEBAT'
@echo off
chcp 65001 >nul
cd /d "%~dp0"
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Droits administrateur confirmes.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "update-windows.ps1"
    echo.
    echo Appuyez sur une touche pour quitter...
    pause >nul
    exit /b
) else (
    echo [INFO] Demande des droits administrateur...
    powershell.exe -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
WINUPDATEBAT

# ---- Script de mise à jour Linux/Mac ----
cat > "${PACKAGE_DIR}/update-linux.sh" << LINUXUPDATE
#!/bin/bash
# ============================================
#  Mums'Home POS — Mise à jour v${APP_VERSION}
#  Usage: sudo bash update-linux.sh
# ============================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()   { echo -e "\${GREEN}[✓]\${NC} \$1"; }
warn()  { echo -e "\${YELLOW}[!]\${NC} \$1"; }
error() { echo -e "\${RED}[✗]\${NC} \$1"; exit 1; }

APP_NAME="${APP_NAME}"
APP_VERSION="${APP_VERSION}"
IMAGE_TAG="\${APP_NAME}:\${APP_VERSION}"
INSTALL_DIR="/opt/mums-home-pos"
SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"

echo ""
echo -e "\${GREEN}══════════════════════════════════════════${NC}"
echo -e "\${GREEN}  Mums'Home POS — Mise à jour v${APP_VERSION}${NC}"
echo -e "\${GREEN}══════════════════════════════════════════${NC}"
echo ""

# Vérifier Docker
docker info > /dev/null 2>&1 || error "Docker ne tourne pas."
log "Docker opérationnel"

# Charger la nouvelle image
TAR_FILE="\${SCRIPT_DIR}/\${APP_NAME}.tar.gz"
if [ ! -f "\$TAR_FILE" ]; then
  TAR_FILE="\${SCRIPT_DIR}/\${APP_NAME}.tar"
  [ -f "\$TAR_FILE" ] || error "Image introuvable."
fi

log "Chargement de la v${APP_VERSION}..."
docker load -i "\$TAR_FILE"
log "Image chargée"

# Mettre à jour la config
cp "\${SCRIPT_DIR}/docker-compose.yml" "\$INSTALL_DIR/docker-compose.yml"

# Redémarrer (les données sont préservées via le volume Docker !)
cd "\$INSTALL_DIR"
warn "Arrêt de l'ancienne version..."
docker compose down 2>/dev/null || true

log "Démarrage de la v${APP_VERSION}..."
docker compose up -d
log "Mise à jour terminée !"

# Nettoyage
docker image prune -f > /dev/null 2>&1
log "Anciennes images supprimées"

SERVER_IP=\$(hostname -I 2>/dev/null | awk '{print \$1}' || echo "localhost")
echo ""
echo -e "\${GREEN}══════════════════════════════════════════${NC}"
echo -e "\${GREEN}  ✅ MISE À JOUR RÉUSSIE ! v${APP_VERSION}${NC}"
echo -e "\${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  Accès : http://localhost:8080"
echo -e "  Réseau : http://\${SERVER_IP}:8080"
echo ""
echo -e "  \${GREEN}Les données sont PRÉSERVÉES.\${NC}"
echo ""
LINUXUPDATE

chmod +x "${PACKAGE_DIR}/update-linux.sh"

# ---- Script d'installation Windows (première fois) ----
cat > "${PACKAGE_DIR}/installer-windows.ps1" << WININSTALL
# ============================================
#  Mums'Home POS — Installation Client Windows
#  Version : ${APP_VERSION}
#  Exécuter en tant qu'Administrateur
# ============================================

\$ErrorActionPreference = "Stop"

\$APP_NAME    = "${APP_NAME}"
\$APP_VERSION = "${APP_VERSION}"
\$IMAGE_TAG   = "\${APP_NAME}:\${APP_VERSION}"
\$APP_PORT    = 8080
\$INSTALL_DIR = "C:\MumsHome"

function Log(\$msg)  { Write-Host "[OK] \$msg" -ForegroundColor Green }
function Warn(\$msg) { Write-Host "[!]  \$msg" -ForegroundColor Yellow }
function Err(\$msg)  { Write-Host "[X]  \$msg" -ForegroundColor Red; exit 1 }
function Step(\$msg) { Write-Host "\`n======================================" -ForegroundColor Cyan; Write-Host "  \$msg" -ForegroundColor Cyan; Write-Host "======================================\`n" -ForegroundColor Cyan }

\$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not \$isAdmin) { Err "Executez en tant qu'Administrateur." }

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   Mums'Home POS v${APP_VERSION} — Installation  " -ForegroundColor Green
Write-Host "   Parentalite & Co                             " -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# 1. Vérifier Docker
Step "1/4 - Verification de Docker Desktop"
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Log "Docker installe (\$(docker --version))"
    try { docker info > \$null 2>&1; Log "Docker en cours d'execution" }
    catch { Err "Lancez Docker Desktop puis relancez ce script." }
} else {
    Warn "Docker Desktop non trouve."
    Write-Host "  1. Telechargez : https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host "  2. Installez et redemarrez" -ForegroundColor White
    Write-Host "  3. Relancez ce script" -ForegroundColor White
    \$r = Read-Host "Ouvrir la page de telechargement ? (O/N)"
    if (\$r -eq "O" -or \$r -eq "o") { Start-Process "https://www.docker.com/products/docker-desktop/" }
    exit 1
}

# 2. Charger l'image
Step "2/4 - Chargement de l'image Docker"
\$scriptDir = Split-Path -Parent \$MyInvocation.MyCommand.Path
\$tarFile = Join-Path \$scriptDir "\$APP_NAME.tar.gz"
if (-not (Test-Path \$tarFile)) {
    \$tarFile = Join-Path \$scriptDir "\$APP_NAME.tar"
    if (-not (Test-Path \$tarFile)) { Err "Image introuvable." }
}
Write-Host "  Chargement (1-3 min)..." -ForegroundColor Yellow
docker load -i \$tarFile
Log "Image v${APP_VERSION} chargee"

# 3. Lancer
Step "3/4 - Lancement de l'application"
if (-not (Test-Path \$INSTALL_DIR)) { New-Item -ItemType Directory -Path \$INSTALL_DIR -Force | Out-Null }
\$composeFile = Join-Path \$scriptDir "docker-compose.yml"
if (Test-Path \$composeFile) { Copy-Item \$composeFile "\$INSTALL_DIR\docker-compose.yml" -Force }

\$existing = docker ps -a --format "{{.Names}}" 2>\$null | Where-Object { \$_ -eq "mums-home-pos" }
if (\$existing) { Set-Location \$INSTALL_DIR; docker compose down 2>\$null }

Set-Location \$INSTALL_DIR
docker compose up -d
Log "Application demarree"

# 4. Pare-feu
Step "4/4 - Configuration finale"
\$ruleName = "MumsHome POS (Port \$APP_PORT)"
\$existingRule = Get-NetFirewallRule -DisplayName \$ruleName -ErrorAction SilentlyContinue
if (\$existingRule) { Remove-NetFirewallRule -DisplayName \$ruleName }
New-NetFirewallRule -DisplayName \$ruleName -Direction Inbound -Protocol TCP -LocalPort \$APP_PORT -Action Allow -Profile Any > \$null
Log "Port \$APP_PORT ouvert"

\$serverIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -notlike "*Loopback*" -and \$_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   INSTALLATION REUSSIE ! v${APP_VERSION}" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Acces local :  http://localhost:\$APP_PORT" -ForegroundColor Cyan
Write-Host "  Acces reseau : http://\${serverIP}:\$APP_PORT" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Identifiants : admin@mums.home / admin123" -ForegroundColor Yellow
Write-Host ""

Start-Process "http://localhost:\$APP_PORT"
WININSTALL

cat > "${PACKAGE_DIR}/INSTALLER-Windows.bat" << 'WININSTALLBAT'
@echo off
chcp 65001 >nul
cd /d "%~dp0"
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Droits administrateur confirmes.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "installer-windows.ps1"
    echo.
    echo Appuyez sur une touche pour quitter...
    pause >nul
    exit /b
) else (
    echo [INFO] Demande des droits administrateur...
    powershell.exe -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
WININSTALLBAT

# ---- Script d'installation Linux/Mac ----
cat > "${PACKAGE_DIR}/installer-linux.sh" << LINUXINSTALL
#!/bin/bash
# ============================================
#  Mums'Home POS — Installation v${APP_VERSION}
#  Usage: sudo bash installer-linux.sh
# ============================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()   { echo -e "\${GREEN}[✓]\${NC} \$1"; }
warn()  { echo -e "\${YELLOW}[!]\${NC} \$1"; }
error() { echo -e "\${RED}[✗]\${NC} \$1"; exit 1; }

APP_NAME="${APP_NAME}"
APP_VERSION="${APP_VERSION}"
IMAGE_TAG="\${APP_NAME}:\${APP_VERSION}"
INSTALL_DIR="/opt/mums-home-pos"
SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"

echo -e "\${GREEN}  Mums'Home POS v${APP_VERSION} — Installation\${NC}"

command -v docker &> /dev/null || error "Docker non installé."
docker info > /dev/null 2>&1 || error "Docker ne tourne pas."

TAR_FILE="\${SCRIPT_DIR}/\${APP_NAME}.tar.gz"
[ ! -f "\$TAR_FILE" ] && TAR_FILE="\${SCRIPT_DIR}/\${APP_NAME}.tar"
[ -f "\$TAR_FILE" ] || error "Image introuvable."

log "Chargement de l'image..."
docker load -i "\$TAR_FILE"

mkdir -p "\$INSTALL_DIR"
cp "\${SCRIPT_DIR}/docker-compose.yml" "\$INSTALL_DIR/"
cd "\$INSTALL_DIR"

docker ps -a --format '{{.Names}}' | grep -q "mums-home-pos" && docker compose down 2>/dev/null || true
docker compose up -d

SERVER_IP=\$(hostname -I 2>/dev/null | awk '{print \$1}' || echo "localhost")
echo -e "\${GREEN}  ✅ Installation réussie ! → http://\${SERVER_IP}:8080\${NC}"
echo -e "  Identifiants : admin@mums.home / admin123"
LINUXINSTALL

chmod +x "${PACKAGE_DIR}/installer-linux.sh"

# ---- LISEZMOI ----
cat > "${PACKAGE_DIR}/LISEZMOI.txt" << README
╔══════════════════════════════════════════════════════╗
║   Mums'Home POS v${APP_VERSION}                              ║
║   Parentalité & Co                                   ║
╚══════════════════════════════════════════════════════╝

CONTENU DU PACKAGE :
  mumshome-pos.tar.gz      — Image Docker v${APP_VERSION}
  docker-compose.yml       — Configuration du service
  INSTALLER-Windows.bat    — 🌟 Lanceur d'installation Windows (Double-clic)
  installer-windows.ps1    — Script d'installation Windows
  installer-linux.sh       — Première installation Linux/Mac
  UPDATE-Windows.bat       — 🌟 Lanceur de mise à jour Windows (Double-clic)
  update-windows.ps1       — Script de mise à jour Windows
  update-linux.sh          — Mise à jour Linux/Mac
  CHANGELOG.md             — Liste des modifications
  VERSION                  — Numéro de version

PREMIÈRE INSTALLATION :
  → Windows : Double-cliquez sur "INSTALLER-Windows.bat"
  → Linux   : sudo bash installer-linux.sh

MISE À JOUR :
  → Windows : Double-cliquez sur "UPDATE-Windows.bat"
  → Linux   : sudo bash update-linux.sh
  ⚠ Les données (produits, ventes, etc.) sont PRÉSERVÉES !

PRÉREQUIS : Docker Desktop uniquement.
README

log "Package v${APP_VERSION} prêt !"

# ============================================
# RÉSULTAT
# ============================================
PACKAGE_SIZE=$(du -sh "${PACKAGE_DIR}" | cut -f1)

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ PACKAGE v${APP_VERSION} PRÊT !                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Dossier :${NC}  ${PACKAGE_DIR}/"
echo -e "  ${BLUE}Taille  :${NC}  ${PACKAGE_SIZE}"
echo -e "  ${BLUE}Version :${NC}  ${APP_VERSION}"
echo ""
echo -e "  ${YELLOW}Contenu :${NC}"
echo "    ├── mumshome-pos.tar.gz       (image Docker)"
echo "    ├── docker-compose.yml        (configuration)"
echo "    ├── INSTALLER-Windows.bat     (LANCEUR INSTALLATION WINDOWS)"
echo "    ├── installer-windows.ps1     (script d'installation)"
echo "    ├── installer-linux.sh        (première installation)"
echo "    ├── UPDATE-Windows.bat        (LANCEUR MISE A JOUR WINDOWS)"
echo "    ├── update-windows.ps1        (mise à jour)"
echo "    ├── update-linux.sh           (mise à jour)"
echo "    ├── CHANGELOG.md              (modifications)"
echo "    ├── VERSION                   (${APP_VERSION})"
echo "    └── LISEZMOI.txt              (guide)"
echo ""
echo -e "  ${YELLOW}Copiez ${BLUE}${PACKAGE_DIR}/${YELLOW} sur clé USB → remettez au client.${NC}"
echo ""
