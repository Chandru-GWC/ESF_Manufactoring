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

The Landing Page automatically detects `public/media/hero-factory.mp4` via `/api/v1/system/landing-media` (and Vite dev checks) and falls back cleanly to `public/media/hero-poster.jpg` whenever no local video file is present or when `prefers-reduced-motion: reduce` is enabled.

