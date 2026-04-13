<# : batch portion
@echo off & setlocal
title AllCare HMS - Windows Deployment Tool

echo Requesting administrative privileges...
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -noprofile -command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

:: Change directory to the location of the batch file
cd /d "%~dp0"

powershell -noprofile -executionpolicy bypass -Command "Invoke-Command -ScriptBlock ([ScriptBlock]::Create((Get-Content '%~dpnx0' -Raw)))"
pause
exit /b
: end batch / begin powershell #>

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "       AllCare HMS - Auto Deployment & Setup Script    " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Check Node.js Environment
Write-Host "`n[1/7] Checking Environment..." -ForegroundColor Yellow
if (Get-Command "node" -ErrorAction SilentlyContinue) {
    $nodeVer = node -v
    Write-Host "Node.js is installed ($nodeVer)." -ForegroundColor Green
} else {
    Write-Host "Node.js is NOT installed. Attempting to install via Winget..." -ForegroundColor Red
    winget install OpenJS.NodeJS -e --silent
    Write-Host "Please close this window and run the script again after Node.js installs." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# 1.5. Environment File (.env) Setup
Write-Host "`n[2/7] Checking Environment Configuration (.env)..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host ".env file not found. Creating from .env.example..." -ForegroundColor Cyan
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        # Auto-generate a secure JWT_SECRET
        $jwtSecret = node -e "process.stdout.write(require('crypto').randomBytes(64).toString('hex'))"
        (Get-Content ".env") -replace '^JWT_SECRET=$', "JWT_SECRET=$jwtSecret" | Set-Content ".env"
        Write-Host ".env created and JWT_SECRET auto-generated." -ForegroundColor Green
        Write-Host "Review .env if you need to customize PORT or ALLOWED_ORIGINS." -ForegroundColor Cyan
    } else {
        Write-Host "WARNING: .env.example not found. Skipping .env setup." -ForegroundColor Red
    }
} else {
    Write-Host ".env file already exists." -ForegroundColor Green
    # Warn if JWT_SECRET is blank
    $envContent = Get-Content ".env"
    $jwtLine = $envContent | Where-Object { $_ -match '^JWT_SECRET=' }
    if ($jwtLine -eq 'JWT_SECRET=' -or [string]::IsNullOrWhiteSpace(($jwtLine -split '=',2)[1])) {
        Write-Host "WARNING: JWT_SECRET is empty in .env. Generating one now..." -ForegroundColor Red
        $jwtSecret = node -e "process.stdout.write(require('crypto').randomBytes(64).toString('hex'))"
        (Get-Content ".env") -replace '^JWT_SECRET=$', "JWT_SECRET=$jwtSecret" | Set-Content ".env"
        Write-Host "JWT_SECRET has been set." -ForegroundColor Green
    }
}

# 3. Configure Windows Firewall
Write-Host "`n[3/7] Configuring Windows Firewall..." -ForegroundColor Yellow
$rule = Get-NetFirewallRule -DisplayName "AllCare HMS" -ErrorAction SilentlyContinue
if ($null -eq $rule) {
    New-NetFirewallRule -DisplayName "AllCare HMS" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow | Out-Null
    Write-Host "Firewall rule created successfully for Port 3001." -ForegroundColor Green
} else {
    Write-Host "Firewall rule already exists." -ForegroundColor Green
}

# 4. Static IP Configuration
Write-Host "`n[4/7] Network Configuration" -ForegroundColor Yellow

# Improved IP detection logic
$currentIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL|Pseudo" -and 
    $_.IPAddress -notlike "169.254.*" -and 
    $_.IPAddress -ne "127.0.0.1"
}).IPAddress | Select-Object -First 1

if ([string]::IsNullOrWhiteSpace($currentIP)) {
    # Fallback to computer name resolution
    try {
        $currentIP = [System.Net.Dns]::GetHostAddresses($env:COMPUTERNAME) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -ExpandProperty IPAddressToString -First 1
    } catch {
        $currentIP = "YOUR_LOCAL_IP"
    }
}

Write-Host "Your current IP address is: $currentIP" -ForegroundColor Cyan
Write-Host "WARNING: Setting a static IP incorrectly can disconnect you from the internet." -ForegroundColor Red
$setupStatic = Read-Host "Do you want to set a STATIC IP for this machine? (Y/N)"

if ($setupStatic -match "^[Yy]$") {
    $adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.Virtual -eq $false } | Select-Object -First 1
    if ($adapter) {
        Write-Host "Active Adapter Found: $($adapter.Name)" -ForegroundColor Cyan
        
        $ip = Read-Host "Enter desired Static IP [Press Enter to keep $currentIP]"
        if ([string]::IsNullOrWhiteSpace($ip)) { $ip = $currentIP }
        
        $subnetLength = Read-Host "Enter Subnet Prefix Length (e.g., 24 for 255.255.255.0) [Press Enter for 24]"
        if ([string]::IsNullOrWhiteSpace($subnetLength)) { $subnetLength = 24 }
        
        $gatewayParts = $ip.Split('.')
        $defaultGatewayGuess = "$($gatewayParts[0]).$($gatewayParts[1]).$($gatewayParts[2]).1"
        $gateway = Read-Host "Enter Default Gateway [Press Enter for $defaultGatewayGuess]"
        if ([string]::IsNullOrWhiteSpace($gateway)) { $gateway = $defaultGatewayGuess }
        
        Write-Host "Applying Static IP ($ip)..." -ForegroundColor Yellow
        
        try {
            # Disable DHCP
            Set-NetIPInterface -InterfaceAlias $adapter.Name -Dhcp Disabled -ErrorAction Stop
            # Remove existing IPs to prevent conflicts
            Remove-NetIPAddress -InterfaceAlias $adapter.Name -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue
            # Set new IP
            New-NetIPAddress -InterfaceAlias $adapter.Name -IPAddress $ip -PrefixLength $subnetLength -DefaultGateway $gateway -ErrorAction Stop | Out-Null
            # Set DNS to Google DNS to ensure internet works
            Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses ("8.8.8.8","8.8.4.4") -ErrorAction Stop
            
            Write-Host "Static IP successfully set to $ip" -ForegroundColor Green
            $currentIP = $ip
        } catch {
            Write-Host "Failed to set Static IP. Please check your inputs or run as Administrator." -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
    } else {
        Write-Host "Could not find an active physical network adapter." -ForegroundColor Red
    }
} else {
    Write-Host "Skipping Static IP configuration. Keeping dynamic IP: $currentIP" -ForegroundColor Green
}

# 5. Install Dependencies & Build
Write-Host "`n[5/7] Checking Dependencies & Building..." -ForegroundColor Yellow

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing root dependencies..." -ForegroundColor Cyan
    cmd.exe /c "npm install"
} else {
    Write-Host "Root dependencies already installed. Skipping download." -ForegroundColor Green
}

if (-not (Test-Path "backend/node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    Set-Location -Path "backend"
    cmd.exe /c "npm install"
    Set-Location -Path ".."
} else {
    Write-Host "Backend dependencies already installed. Skipping download." -ForegroundColor Green
}

if (-not (Test-Path "backend/public/index.html")) {
    Write-Host "Building application for production..." -ForegroundColor Cyan
    cmd.exe /c "npm run build"
} else {
    Write-Host "Production build already exists." -ForegroundColor Green
    $rebuild = Read-Host "Do you want to REBUILD the frontend? (Y/N) [Default: N]"
    if ($rebuild -match "^[Yy]$") {
        Write-Host "Rebuilding application..." -ForegroundColor Cyan
        cmd.exe /c "npm run build"
    }
}

# 6. Setup Windows Startup
Write-Host "`n[6/7] Configuring Windows Startup..." -ForegroundColor Yellow
$startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$runScriptPath = "$PWD\run_server.bat"

# Create a dedicated run script that opens the browser and starts the server
$runScriptContent = @"
@echo off
cd /d "%~dp0"
echo Starting AllCare HMS Server...
if not exist ".env" (
    echo WARNING: .env file not found. Using built-in defaults.
    echo Run windows_deploy.bat first to set up your environment correctly.
)
npm run start
"@
Set-Content -Path $runScriptPath -Value $runScriptContent

$setupStartup = Read-Host "Do you want the server to start automatically when Windows boots? (Y/N)"
if ($setupStartup -match "^[Yy]$") {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$startupFolder\AllCareHMS.lnk")
    $Shortcut.TargetPath = $runScriptPath
    $Shortcut.WorkingDirectory = $PWD.Path
    $Shortcut.WindowStyle = 7 # 7 = Minimized window
    $Shortcut.Description = "Starts the AllCare HMS Server"
    $Shortcut.Save()
    Write-Host "Startup shortcut created successfully. The server will start minimized on boot." -ForegroundColor Green
} else {
    # Remove shortcut if it exists from a previous run
    if (Test-Path "$startupFolder\AllCareHMS.lnk") {
        Remove-Item "$startupFolder\AllCareHMS.lnk"
    }
    Write-Host "Skipped Windows Startup configuration." -ForegroundColor Green
}

# 7. Run the Server
Write-Host "`n[7/7] Starting Server..." -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " SERVER IS READY AND RUNNING!" -ForegroundColor Green
Write-Host " Local Access (On this PC):  http://localhost:3001"
Write-Host " Network Access (Other PCs): http://$currentIP:3001"
Write-Host "=======================================================" -ForegroundColor Cyan

Write-Host "Opening system in your default browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3001"

Write-Host "Keep this window open to keep the server running." -ForegroundColor Yellow
cmd.exe /c "npm run start"
