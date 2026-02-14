# Neon Serpent (Mobile Snake)

A mobile-first Snake game built with Python + Kivy. It includes multiple levels, obstacles, swipe controls, a D-pad, power-up foods, and a persistent high score.

## Run (Desktop Dev)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Mobile Build (Android)

Kivy apps can be packaged with Buildozer. From this folder:

```bash
pip install buildozer
buildozer init
# edit buildozer.spec to include: requirements = python3,kivy
buildozer -v android debug
```

Then install the generated APK on your device.

## Controls
- Swipe anywhere on the board to move
- Optional D-pad buttons
- Pause/Resume and Restart controls included

## Levels
Each level increases speed and adds obstacles. After the last named level, the game continues with higher targets and faster pacing.
