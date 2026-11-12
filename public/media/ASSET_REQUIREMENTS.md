# Landing Page Hero Media Assets

Place your locally licensed industrial manufacturing hero video at:

- `public/media/hero-factory.mp4`
- `public/media/hero-poster.jpg` (high-resolution fallback image already provided)

## Recommended Encoding Specification for `hero-factory.mp4`
- **Container / Codec:** MP4 (`H.264` / `avc1`, `yuv420p`, `faststart` moov atom at beginning)
- **Resolution:** `1920x1080` (16:9 widescreen)
- **Audio:** Stripped (`-an` muted stream for reliable autoplay across all browsers)
- **Duration:** `10–20` seconds seamless manufacturing / plant operations loop
- **Target File Size:** `<= 15 MB`

Example FFmpeg preparation command:
```bash
ffmpeg -i source_factory.mp4 -c:v libx264 -pix_fmt yuv420p -profile:v high -movflags +faststart -an -t 15 -vf "scale=1920:-2" public/media/hero-factory.mp4
```

The Landing Page always renders `hero-poster.jpg` first and mounts `hero-factory.mp4` directly from `/media/hero-factory.mp4` (no backend call). The video fades in only after it has actually loaded; if the file is missing, fails to decode, or `prefers-reduced-motion: reduce` is set, the poster stays. `*.mp4` in `public/media` is git-ignored (large binary) — copy it onto each machine/deploy.
