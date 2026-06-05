# deploy_oci.ps1
# Automates provisioning OCI resources and deploying the Plum application

$ErrorActionPreference = "Stop"

# Ensure OCI CLI path is in the environment PATH
if ($env:PATH -notlike "*C:\Program Files (x86)\Oracle\oci_cli*") {
    $env:PATH += ";C:\Program Files (x86)\Oracle\oci_cli"
}

# 1. Configuration & Secrets
$configPath = "$env:USERPROFILE\.oci\config"
if (-not (Test-Path $configPath)) {
    Write-Error "OCI config file not found at $configPath. Please run 'oci setup config' first."
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "       OCI PLUM DEPLOYMENT SCRIPT         " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host "Reading OCI Config..." -ForegroundColor Cyan
$configContent = Get-Content $configPath -Raw
$tenancyId = [regex]::Match($configContent, 'tenancy\s*=\s*(ocid1.tenancy.oc1..[^\s\r\n]+)').Groups[1].Value
$region = [regex]::Match($configContent, 'region\s*=\s*([^\s\r\n]+)').Groups[1].Value

if (-not $tenancyId -or -not $region) {
    Write-Error "Could not parse tenancy or region from OCI config file."
}

Write-Host "Tenancy: $tenancyId" -ForegroundColor DarkGray
Write-Host "Region: $region" -ForegroundColor DarkGray

# Availability Domain (Hyderabad AD-1)
$availabilityDomain = "HwUW:AP-HYDERABAD-1-AD-1"
$imageId = "ocid1.image.oc1.ap-hyderabad-1.aaaaaaaa76jw234swsf2l2pib6vqyhhau62cjdfz6gucbsx7oen7hup6nb7a" # Ubuntu 22.04 x86_64
$shape = "VM.Standard.E2.1.Micro" # Always Free AMD shape

# Encoding for JSON files (UTF-8 without BOM)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Helper function to get OCI-compliant file URL for Windows
function Get-OciFilePath {
    param (
        [string]$fileName
    )
    $fullPath = Join-Path $PWD.Path $fileName
    return "file://$fullPath"
}

# Temp files tracking for cleanup
$tempFiles = @()

try {
    # 2. SSH Key Generation
    $keyDir = "$env:USERPROFILE\.ssh"
    $keyPath = "$keyDir\plum_key"
    if (-not (Test-Path $keyDir)) {
        New-Item -ItemType Directory -Path $keyDir -Force | Out-Null
    }
    if (-not (Test-Path $keyPath)) {
        Write-Host "Generating new SSH key pair at $keyPath..." -ForegroundColor Cyan
        cmd.exe /c "ssh-keygen -t rsa -b 2048 -f `"$keyPath`" -N `"`""
        if (-not (Test-Path $keyPath)) {
            Write-Error "Failed to generate SSH key using ssh-keygen."
        }
    } else {
        Write-Host "Using existing SSH key pair at $keyPath" -ForegroundColor Green
    }

    # 3. Create/Retrieve OCI Networking Resources
    Write-Host "Checking OCI networking resources..." -ForegroundColor Cyan

    # VCN
    $vcnName = "PlumVCN"
    $existingVcn = oci network vcn list --compartment-id $tenancyId --display-name $vcnName | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to list VCNs." }
    
    if ($existingVcn.data.Count -gt 0) {
        $vcnId = $existingVcn.data[0].id
        Write-Host "Using existing VCN: $vcnId" -ForegroundColor Green
    } else {
        Write-Host "Creating VCN..." -ForegroundColor Yellow
        $vcn = oci network vcn create --compartment-id $tenancyId --cidr-block "10.0.0.0/16" --display-name $vcnName | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create VCN." }
        $vcnId = $vcn.data.id
        Write-Host "Created VCN: $vcnId" -ForegroundColor Green
    }

    # Internet Gateway
    $igwName = "PlumIGW"
    $existingIgw = oci network internet-gateway list --compartment-id $tenancyId --vcn-id $vcnId | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to list Internet Gateways." }
    
    if ($existingIgw.data.Count -gt 0) {
        $igwId = $existingIgw.data[0].id
        Write-Host "Using existing Internet Gateway: $igwId" -ForegroundColor Green
    } else {
        Write-Host "Creating Internet Gateway..." -ForegroundColor Yellow
        $igw = oci network internet-gateway create --compartment-id $tenancyId --vcn-id $vcnId --is-enabled true --display-name $igwName | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create Internet Gateway." }
        $igwId = $igw.data.id
        Write-Host "Created Internet Gateway: $igwId" -ForegroundColor Green
    }

    # Route Table
    $rtName = "PlumRouteTable"
    $existingRt = oci network route-table list --compartment-id $tenancyId --vcn-id $vcnId | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to list Route Tables." }
    
    $routeTableId = $null
    foreach ($rt in $existingRt.data) {
        if ($rt."display-name" -eq $rtName) {
            $routeTableId = $rt.id
            break
        }
    }
    if ($routeTableId) {
        Write-Host "Using existing Route Table: $routeTableId" -ForegroundColor Green
    } else {
        Write-Host "Creating Route Table..." -ForegroundColor Yellow
        
        $rtRulesName = "rt_rules.json"
        $rtRulesPath = Join-Path $PWD.Path $rtRulesName
        $tempFiles += $rtRulesPath
        
        $rtRules = @(
            @{
                cidrBlock = "0.0.0.0/0"
                networkEntityId = $igwId
            }
        )
        $rtRulesJson = ConvertTo-Json -InputObject $rtRules -Compress
        [System.IO.File]::WriteAllText($rtRulesPath, $rtRulesJson, $utf8NoBom)

        $rtFileUrl = Get-OciFilePath $rtRulesName
        $rt = oci network route-table create --compartment-id $tenancyId --vcn-id $vcnId --route-rules $rtFileUrl --display-name $rtName | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create Route Table." }
        $routeTableId = $rt.data.id
        Write-Host "Created Route Table: $routeTableId" -ForegroundColor Green
    }

    # Security List (SSH 22, HTTP 80, HTTPS 443, React 3000, API 8000)
    $slName = "PlumSecurityList"
    $existingSl = oci network security-list list --compartment-id $tenancyId --vcn-id $vcnId | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to list Security Lists." }
    
    $securityListId = $null
    foreach ($sl in $existingSl.data) {
        if ($sl."display-name" -eq $slName) {
            $securityListId = $sl.id
            break
        }
    }
    if ($securityListId) {
        Write-Host "Using existing Security List: $securityListId" -ForegroundColor Green
    } else {
        Write-Host "Creating Security List..." -ForegroundColor Yellow

        $egressName = "egress_rules.json"
        $ingressName = "ingress_rules.json"
        $egressPath = Join-Path $PWD.Path $egressName
        $ingressPath = Join-Path $PWD.Path $ingressName
        $tempFiles += $egressPath
        $tempFiles += $ingressPath

        $egressRules = @(
            @{
                destination = "0.0.0.0/0"
                protocol = "all"
            }
        )
        $egressJson = ConvertTo-Json -InputObject $egressRules -Compress
        [System.IO.File]::WriteAllText($egressPath, $egressJson, $utf8NoBom)

        $ingressRules = @(
            @{
                source = "0.0.0.0/0"
                protocol = "6" # TCP
                tcpOptions = @{
                    destinationPortRange = @{
                        min = 22
                        max = 22
                    }
                }
            },
            @{
                source = "0.0.0.0/0"
                protocol = "6" # TCP
                tcpOptions = @{
                    destinationPortRange = @{
                        min = 80
                        max = 80
                    }
                }
            },
            @{
                source = "0.0.0.0/0"
                protocol = "6" # TCP
                tcpOptions = @{
                    destinationPortRange = @{
                        min = 443
                        max = 443
                    }
                }
            },
            @{
                source = "0.0.0.0/0"
                protocol = "6" # TCP
                tcpOptions = @{
                    destinationPortRange = @{
                        min = 3000
                        max = 3000
                    }
                }
            },
            @{
                source = "0.0.0.0/0"
                protocol = "6" # TCP
                tcpOptions = @{
                    destinationPortRange = @{
                        min = 8000
                        max = 8000
                    }
                }
            }
        )
        $ingressJson = ConvertTo-Json -InputObject $ingressRules -Depth 5 -Compress
        [System.IO.File]::WriteAllText($ingressPath, $ingressJson, $utf8NoBom)

        $egressFileUrl = Get-OciFilePath $egressName
        $ingressFileUrl = Get-OciFilePath $ingressName
        $sl = oci network security-list create --compartment-id $tenancyId --vcn-id $vcnId --egress-security-rules $egressFileUrl --ingress-security-rules $ingressFileUrl --display-name $slName | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create Security List." }
        $securityListId = $sl.data.id
        Write-Host "Created Security List: $securityListId" -ForegroundColor Green
    }

    # Subnet
    $subnetName = "PlumSubnet"
    $existingSubnet = oci network subnet list --compartment-id $tenancyId --vcn-id $vcnId | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to list Subnets." }
    
    if ($existingSubnet.data.Count -gt 0) {
        $subnetId = $existingSubnet.data[0].id
        Write-Host "Using existing Subnet: $subnetId" -ForegroundColor Green
    } else {
        Write-Host "Creating Subnet..." -ForegroundColor Yellow
        
        $subnetSecName = "subnet_seclists.json"
        $subnetSecPath = Join-Path $PWD.Path $subnetSecName
        $tempFiles += $subnetSecPath
        
        $subnetSecLists = @($securityListId)
        $subnetSecJson = ConvertTo-Json -InputObject $subnetSecLists -Compress
        [System.IO.File]::WriteAllText($subnetSecPath, $subnetSecJson, $utf8NoBom)

        $subnetSecFileUrl = Get-OciFilePath $subnetSecName
        $subnet = oci network subnet create --compartment-id $tenancyId --vcn-id $vcnId --cidr-block "10.0.0.0/24" --route-table-id $routeTableId --security-list-ids $subnetSecFileUrl --display-name $subnetName | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create Subnet." }
        $subnetId = $subnet.data.id
        Write-Host "Created Subnet: $subnetId" -ForegroundColor Green
    }

    # 4. Create VM Instance
    $instanceName = "plum-server"
    $existingInstance = oci compute instance list --compartment-id $tenancyId --display-name $instanceName | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to list VM Instances." }
    
    $instanceId = $null
    $lifecycleState = $null

    foreach ($inst in $existingInstance.data) {
        if ($inst."lifecycle-state" -ne "TERMINATED") {
            $instanceId = $inst.id
            $lifecycleState = $inst."lifecycle-state"
            break
        }
    }

    if ($instanceId) {
        Write-Host "Found existing Compute Instance ($instanceName): $instanceId (State: $lifecycleState)" -ForegroundColor Green
    } else {
        Write-Host "Launching VM Instance ($shape)..." -ForegroundColor Yellow
        $pubKeyFile = "$keyPath.pub"
        $instance = oci compute instance launch --compartment-id $tenancyId --availability-domain $availabilityDomain --shape $shape --subnet-id $subnetId --image-id $imageId --ssh-authorized-keys-file $pubKeyFile --display-name $instanceName | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to launch VM Instance." }
        $instanceId = $instance.data.id
        $lifecycleState = $instance.data."lifecycle-state"
        Write-Host "VM Instance Launched: $instanceId" -ForegroundColor Green
    }

    # Wait for VM to be in RUNNING state
    Write-Host "Waiting for VM to be RUNNING..." -ForegroundColor Cyan
    while ($lifecycleState -ne "RUNNING") {
        Start-Sleep -Seconds 5
        $instStatus = oci compute instance get --instance-id $instanceId | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { Write-Error "Failed to get VM Instance status." }
        $lifecycleState = $instStatus.data."lifecycle-state"
        Write-Host "Current State: $lifecycleState"
        if ($lifecycleState -eq "STOPPING" -or $lifecycleState -eq "STOPPED" -or $lifecycleState -eq "TERMINATED") {
            Write-Error "VM entered an unexpected state: $lifecycleState"
        }
    }

    # 5. Retrieve Public IP
    Write-Host "Retrieving Public IP..." -ForegroundColor Cyan
    $vnics = oci compute instance list-vnics --instance-id $instanceId | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to list VM VNICs." }
    $publicIp = $vnics.data[0]."public-ip"
    Write-Host "VM Public IP Address: $publicIp" -ForegroundColor Green

    # 6. Wait for SSH (Port 22)
    Write-Host "Waiting for SSH (Port 22) to become active..." -ForegroundColor Cyan
    $sshReady = $false
    while (-not $sshReady) {
        $conn = Test-NetConnection -ComputerName $publicIp -Port 22 -WarningAction SilentlyContinue
        if ($conn.TcpTestSucceeded) {
            $sshReady = $true
            Write-Host "SSH Port 22 is open!" -ForegroundColor Green
        } else {
            Write-Host "SSH Port 22 not ready yet, retrying in 5 seconds..."
            Start-Sleep -Seconds 5
        }
    }

    # 7. Zip and Transfer Files
    Write-Host "Creating deployment archive..." -ForegroundColor Cyan
    $archiveFile = "plum_deploy.tar.gz"
    if (Test-Path $archiveFile) {
        Remove-Item $archiveFile -Force
    }

    # Use tar to compress the project (excludes node_modules, .git, venv)
    tar -czf $archiveFile --exclude="node_modules" --exclude="venv" --exclude=".git" --exclude="dist" frontend backend docker-compose.yml Caddyfile

    Write-Host "Uploading project archive to VM..." -ForegroundColor Cyan
    scp -o StrictHostKeyChecking=no -i $keyPath $archiveFile ubuntu@${publicIp}:/home/ubuntu/
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to upload project archive via SCP." }

    # Remove local tar archive
    Remove-Item $archiveFile -Force

    # 8. Setup Docker, Extract and Run
    Write-Host "Configuring remote server & running Docker Compose..." -ForegroundColor Cyan
    $remoteCommands = @(
        "mkdir -p /home/ubuntu/plum_app",
        "tar -xzf /home/ubuntu/plum_deploy.tar.gz -C /home/ubuntu/plum_app",
        "rm /home/ubuntu/plum_deploy.tar.gz",
        "if ! command -v docker &> /dev/null; then curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker ubuntu && sudo systemctl enable --now docker; fi",
        "if ! docker compose version &> /dev/null; then sudo apt-get install -y docker-compose-plugin; fi",
        "cd /home/ubuntu/plum_app",
        "sudo docker compose down",
        "sudo docker compose up -d --build"
    ) -join " && "

    # Execute via SSH
    ssh -o StrictHostKeyChecking=no -i $keyPath ubuntu@$publicIp $remoteCommands
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to execute deployment commands on remote VM via SSH." }

    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "Access the application at:" -ForegroundColor Cyan
    Write-Host "Frontend: http://$($publicIp):3000" -ForegroundColor Cyan
    Write-Host "Backend API: http://$($publicIp):8000/docs" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Green

} finally {
    # Clean up temp JSON files
    foreach ($file in $tempFiles) {
        if (Test-Path $file) {
            Remove-Item $file -Force -ErrorAction SilentlyContinue
        }
    }
}
