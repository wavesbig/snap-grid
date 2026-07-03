import type { CaptureRequest, CaptureSuccess, CaptureError } from '../lib/messaging';
import { addCaptureToSession } from '../lib/db';
import { urlToSessionId, urlToSessionTitle } from '../lib/utils';
import type { Capture } from '../lib/types';

export default defineBackground(() => {
  try {
    browser.commands.onCommand.addListener(async (command: string) => {
      if (command !== 'capture-frame') return;
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      const { mode: storedMode } = await browser.storage.local.get('captureMode');
      const mode = storedMode === 'subtitle' ? 'subtitle' : 'grid';
      const msg: CaptureRequest = { type: 'CAPTURE', mode };
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
        const title = tab?.title ?? urlToSessionTitle(sourceUrl);

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
        console.log('[snap-grid] Saved:', capture.id, 'session:', sessionId);
      } else if (msg.type === 'CAPTURE_ERROR') {
        console.error('[snap-grid] Error:', msg.message);
      }
    },
  );
});