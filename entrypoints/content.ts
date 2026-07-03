import type { CaptureRequest, CaptureSuccess, CaptureError } from '../lib/messaging';
import { captureVideoFrame } from '../lib/capture';

export default defineContentScript({
  matches: ['*://*.bilibili.com/*', '*://*.b23.tv/*'],

  main() {
    function generateId(): string {
      return crypto.randomUUID();
    }

    function findVideo(): HTMLVideoElement | null {
      const selectors = [
        'video.bilibili-player-video',
        'video.video-wrap',
        '.bilibili-player-video video',
        '.video-container video',
        'video',
      ];
      for (const sel of selectors) {
        const el = document.querySelector<HTMLVideoElement>(sel);
        if (el && el.videoWidth > 0) return el;
      }
      return null;
    }

    // Floating toast notification injected into the page
    function showToast(message: string, isError = false) {
      const toast = document.createElement('div');
      toast.style.cssText = [
        'position:fixed',
        'bottom:80px',
        'left:50%',
        'transform:translateX(-50%) translateY(20px)',
        'opacity:0',
        `background:${isError ? 'rgb(220,38,38)' : 'rgba(20,20,22,0.92)'}`,
        'color:#fff',
        'padding:10px 20px',
        'border-radius:12px',
        'font-size:13px',
        'font-weight:500',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif',
        'backdrop-filter:blur(8px)',
        'z-index:2147483647',
        'pointer-events:none',
        'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
        'transition:all 0.3s cubic-bezier(0.32,0.72,0,1)',
        'white-space:nowrap',
      ].join(';');
      toast.textContent = message;
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      });
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }

    browser.runtime.onMessage.addListener((msg: CaptureRequest) => {
      if (msg.type !== 'CAPTURE') return;

      const video = findVideo();
      if (!video) {
        const err: CaptureError = {
          type: 'CAPTURE_ERROR',
          message: '未找到视频元素',
        };
        browser.runtime.sendMessage(err);
        showToast('未找到视频，请先播放视频', true);
        return;
      }

      captureVideoFrame(video, msg.mode)
        .then(({ blob, thumb, width, height }) => {
          const success: CaptureSuccess = {
            type: 'CAPTURE_SUCCESS',
            captureId: generateId(),
            thumb,
            width,
            height,
            videoTime: video.currentTime,
            blob,
            mode: msg.mode,
            pageTitle: document.title,
          };
          browser.runtime.sendMessage(success);
          const modeLabel = msg.mode === 'subtitle' ? '字幕' : '画面';
          showToast(`${modeLabel}已截取 · ${video.currentTime.toFixed(1)}s`);
        })
        .catch((e: Error) => {
          browser.runtime.sendMessage({
            type: 'CAPTURE_ERROR',
            message: e.message || '截图失败',
          } as CaptureError);
          showToast('截图失败: ' + (e.message || '未知错误'), true);
        });
    });
  },
});