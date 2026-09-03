@echo off
chcp 65001 > nul
echo ===================================================
echo   JA Korea 제주 워크숍 로컬 서버를 실행합니다...
echo   (브라우저가 자동으로 열립니다)
echo ===================================================
start "" "http://localhost:8000"
python -m http.server 8000
pause
