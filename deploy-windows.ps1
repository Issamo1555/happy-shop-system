# ============================================
#  Mums'Home POS - Déploiement Windows
#  Exécuter en tant qu'Administrateur :
#  PowerShell > .\deploy-windows.ps1
# ============================================

$ErrorActionPreference = "Stop"

# ---- CONFIGURATION ----
$REPO_URL   = "https://github.com/Issamo1555/happy-shop-system.git"
$BRANCH     = "feature/soft-delete-security"
$APP_DIR    = "C:\MumsHome"
$APP_PORT   = 8080

# ---- FONCTIONS ----
function Log($msg)  { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!]  $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[X]  $msg" -ForegroundColor Red; exit 1 }
function Step($msg) { Write-Host "`n======================================" -ForegroundColor Cyan; Write-Host "  $msg" -ForegroundColor Cyan; Write-Host "======================================`n" -ForegroundColor Cyan }

# ---- VÉRIFICATION ADMIN ----
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Err "Ce script doit etre execute en tant qu'Administrateur.`nClic droit sur PowerShell > Executer en tant qu'administrateur"
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "   Mums'Home POS - Deploiement Windows         " -ForegroundColor Green
Write-Host "   Parentalite & Co                             " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""

# ============================================
# ETAPE 1 : Vérifier Git
# ============================================
Step "1/5 - Verification de Git"

if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitVersion = git --version
    Log "Git installe ($gitVersion)"
} else {
    Warn "Git non trouve. Installation via winget..."
    try {
        winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Log "Git installe"
    } catch {
        Err "Impossible d'installer Git automatiquement.`nTelechargez-le manuellement : https://git-scm.com/download/win"
    }
}

# ============================================
# ETAPE 2 : Vérifier Docker Desktop
# ============================================
Step "2/5 - Verification de Docker Desktop"

if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerVersion = docker --version
    Log "Docker installe ($dockerVersion)"
    
    # Vérifier que Docker tourne
    try {
        docker info > $null 2>&1
        Log "Docker est en cours d'execution"
    } catch {
        Warn "Docker est installe mais ne tourne pas."
        Write-Host ""
        Write-Host "  => Lancez Docker Desktop puis relancez ce script." -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
} else {
    Warn "Docker Desktop non trouve."
    Write-Host ""
    Write-Host "  Installation requise :" -ForegroundColor Yellow
    Write-Host "  1. Telechargez Docker Desktop : https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host "  2. Installez-le et redemarrez le PC" -ForegroundColor White
    Write-Host "  3. Lancez Docker Desktop" -ForegroundColor White
    Write-Host "  4. Relancez ce script" -ForegroundColor White
    Write-Host ""
    
    $response = Read-Host "Voulez-vous ouvrir la page de telechargement maintenant ? (O/N)"
    if ($response -eq "O" -or $response -eq "o") {
        Start-Process "https://www.docker.com/products/docker-desktop/"
    }
    exit 1
}

# ============================================
# ETAPE 3 : Cloner / Mettre à jour le code
# ============================================
Step "3/5 - Recuperation du code source"

if (Test-Path "$APP_DIR\.git") {
    Warn "Dossier existant detecte. Mise a jour..."
    Set-Location $APP_DIR
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
    Log "Code mis a jour depuis GitHub"
} else {
    if (Test-Path $APP_DIR) {
        $backup = "${APP_DIR}_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Warn "Dossier existant sans git. Sauvegarde vers $backup..."
        Rename-Item $APP_DIR $backup
    }
    git clone -b $BRANCH $REPO_URL $APP_DIR
    Set-Location $APP_DIR
    Log "Code clone depuis GitHub"
}

# ============================================
# ETAPE 4 : Build et lancement Docker
# ============================================
Step "4/5 - Construction et lancement de l'application"

Set-Location $APP_DIR

# Arrêter l'ancien conteneur s'il existe
$existing = docker ps -a --format "{{.Names}}" 2>$null | Where-Object { $_ -eq "mums-home-pos" }
if ($existing) {
    Warn "Arret de l'ancien conteneur..."
    docker compose down 2>$null
    Log "Ancien conteneur arrete"
}

Log "Construction de l'image Docker (2-5 minutes)..."
docker compose up -d --build

# Attendre le démarrage
Write-Host "  Demarrage" -NoNewline
for ($i = 0; $i -lt 30; $i++) {
    $running = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -eq "mums-home-pos" }
    if ($running) {
        Write-Host ""
        Log "Conteneur demarre"
        break
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
}

# ============================================
# ETAPE 5 : Ouvrir le pare-feu Windows
# ============================================
Step "5/5 - Configuration du pare-feu Windows"

$ruleName = "MumsHome POS (Port $APP_PORT)"

# Supprimer l'ancienne règle si elle existe
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existingRule) {
    Remove-NetFirewallRule -DisplayName $ruleName
}

# Créer la règle
New-NetFirewallRule -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $APP_PORT `
    -Action Allow `
    -Profile Any > $null

Log "Port $APP_PORT ouvert dans le pare-feu Windows"

# ============================================
# RÉSULTAT FINAL
# ============================================
$serverIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "   DEPLOIEMENT REUSSI !                        " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Acces local :    http://localhost:$APP_PORT" -ForegroundColor Cyan
Write-Host "  Acces reseau :   http://${serverIP}:$APP_PORT" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Identifiants admin :" -ForegroundColor Yellow
Write-Host "    Email :        admin@mums.home"
Write-Host "    Mot de passe : admin123"
Write-Host ""
Write-Host "  Commandes utiles :" -ForegroundColor Yellow
Write-Host "    Voir les logs :   docker logs -f mums-home-pos" -ForegroundColor Gray
Write-Host "    Redemarrer :      docker compose -f $APP_DIR\docker-compose.yml restart" -ForegroundColor Gray
Write-Host "    Arreter :         docker compose -f $APP_DIR\docker-compose.yml down" -ForegroundColor Gray
Write-Host "    Mise a jour :     .\deploy-windows.ps1  (en admin)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Base de donnees persistee dans le volume Docker 'pos-data'" -ForegroundColor Green
Write-Host ""

# Ouvrir le navigateur
Start-Process "http://localhost:$APP_PORT"
