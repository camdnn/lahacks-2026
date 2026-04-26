import { Router }       from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync }    from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DMG_PATH  = join(__dirname, '../../overlay/dist/Pudge-1.0.0-arm64.dmg');

const router = Router();

// GET /download/overlay
router.get('/download/overlay', (_req, res) => {
  if (!existsSync(DMG_PATH)) {
    return res.status(404).json({
      error: "DMG not built yet — run `npm run dist` inside overlay/",
    });
  }
  res.download(DMG_PATH, 'Pudge.dmg');
});

export default router;
