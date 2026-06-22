$ErrorActionPreference = "Stop"
$repo = "C:\Users\ardis\OneDrive\Desktop\PROYECTOS APP\ANDROID\CALIZA APP\CalizaApp"
Set-Location $repo

Write-Host "Iniciando sesión en GitHub CLI..." -ForegroundColor Cyan
gh auth login --web

Write-Host "`nPusheando cambios..." -ForegroundColor Cyan
git push

Write-Host "`n✅ Push completado!" -ForegroundColor Green
Read-Host "Presiona Enter para salir"
