# Sound Assets

Place the following audio files in this directory:

| File        | Description                   | Source suggestion             |
|---|---|---|
| flap.mp3    | Short flap/wing sound          | [Freesound.org](https://freesound.org) |
| score.mp3   | Point scored chime             | |
| hit.mp3     | Collision impact               | |
| swoosh.mp3  | Screen transition whoosh       | |
| die.mp3     | Game over jingle               | |
| notification-icon.png | Android notification icon (96x96 white PNG) | |

All files must be present before building. You can use free CC0-licensed samples from
freesound.org or the original Flappy Bird fan-made sound packs on GitHub.

For silent placeholders during development, run:
```
for f in flap score hit swoosh die; do ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 0.1 -q:a 9 -acodec libmp3lame ${f}.mp3; done
```
