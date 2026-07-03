import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    commands: {
      'capture-frame': {
        suggested_key: {
          default: 'Alt+S',
          mac: 'Option+S',
        },
        description: 'Capture current video frame',
      },
    },
    permissions: ['activeTab', 'storage', 'scripting'],
    host_permissions: ['*://*.bilibili.com/*', '*://*.b23.tv/*'],
  },
});
