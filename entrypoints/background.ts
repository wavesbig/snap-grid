import type { CaptureRequest, CaptureSuccess, CaptureError } from '../lib/messaging';
import { addCaptureToSession, pruneOldCaptures } from '../lib/db';
import { urlToSessionId, urlToSessionTitle } from '../lib/utils';
import type { Capture } from '../lib/types';

export default defineBackground(() => {
  try {
    browser.commands.onCommand.addListener(async (command: string) => {
      if (command !== 'capture-frame') return;
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      // always capture full frame; mode (grid/subtitle) is chosen in the editor
      const msg: CaptureRequest = { type: 'CAPTURE', mode: 'grid' };
      browser.tabs.sendMessage(tab.id, msg);
    });
  } catch {
    // browser.commands not available in WXT dev mock
  }

  browser.runtime.onMessage.addListener(
    async (msg: CaptureSuccess | CaptureError) => {
      if (msg.type === 'CAPTURE_SUCCESS') {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const sourceUrl = tab?.url ?? '';
        const sessionId = urlToSessionId(sourceUrl);
        // prefer the page title from content script; clean bilibili suffixes
        const rawTitle = msg.pageTitle || tab?.title || urlToSessionTitle(sourceUrl);
        const title = rawTitle
          .replace(/_哔哩哔哩.*$/, '')
          .replace(/_bilibili.*$/i, '')
          .replace(/-哔哩哔哩.*$/, '')
          .trim();

        const capture: Capture = {
          id: msg.captureId,
          blob: msg.blob,
          thumb: msg.thumb,
          width: msg.width,
          height: msg.height,
          videoTime: msg.videoTime,
          mode: msg.mode,
          sourceUrl,
          sessionId,
          createdAt: Date.now(),
        };
        await addCaptureToSession(capture, title, sourceUrl);
        // auto-prune oldest captures if storage exceeds threshold
        const pruned = await pruneOldCaptures().catch(() => 0);
        if (pruned > 0) {
          console.log('[snap-grid] Auto-pruned', pruned, 'old captures to stay within storage limit');
          browser.runtime.sendMessage({ type: 'CAPTURE_DELETED', captureId: '' }).catch(() => {});
        }
        console.log('[snap-grid] Saved:', capture.id, 'session:', sessionId);
      } else if (msg.type === 'CAPTURE_ERROR') {
        console.error('[snap-grid] Error:', msg.message);
      }
    },
  );
});