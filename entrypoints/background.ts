import type { CaptureRequest, CaptureSuccess, CaptureError } from '../lib/messaging';
import { addCaptureToSession } from '../lib/db';
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
        const capture: Capture = {
          id: msg.captureId,
          blob: msg.blob,
          thumb: msg.thumb,
          width: msg.width,
          height: msg.height,
          videoTime: msg.videoTime,
          mode: msg.mode,
          sourceUrl:
            (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.url ?? '',
          sessionId: 'default',
          createdAt: Date.now(),
        };
        await addCaptureToSession(capture);
        console.log('[snap-grid] Saved:', capture.id);
      } else if (msg.type === 'CAPTURE_ERROR') {
        console.error('[snap-grid] Error:', msg.message);
      }
    },
  );
});