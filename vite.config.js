import { defineConfig } from 'vite';

// GitHub Pages serves this repo at https://ileivoivm.github.io/change/
// so every asset must be prefixed with /change/.
export default defineConfig({
  base: '/change/',
});
