import { build, context } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
const uiTemplate = await readFile(new URL('./src/ui.html', import.meta.url), 'utf8');
const codeOptions = { entryPoints: ['code.ts'], bundle: true, outfile: 'code.js', format: 'iife', target: 'es2020' };
const uiOptions = {
  entryPoints: ['src/ui.ts'], bundle: true, write: false, format: 'iife', target: 'es2020',
  plugins: [{ name: 'inline-ui', setup(builder) {
    builder.onEnd(async result => {
      if (!result.errors.length) {
        const template = await readFile(new URL('./src/ui.html', import.meta.url), 'utf8');
        await writeFile('ui.html', template.replace('/* FIGRIS_UI_SCRIPT */', () => result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')));
      }
    });
  } }],
};
if (!uiTemplate.includes('/* FIGRIS_UI_SCRIPT */')) throw new Error('UI script marker missing');
if (process.argv.includes('--watch')) {
  const contexts = await Promise.all([context(codeOptions), context(uiOptions)]);
  await Promise.all(contexts.map(ctx => ctx.watch()));
  // The UI template is not an esbuild import; watch it explicitly.
  const { watch } = await import('node:fs');
  watch('src/ui.html', () => { void contexts[1].rebuild(); });
  console.log('Watching plugin TypeScript and UI template…');
} else {
  await Promise.all([build(codeOptions), build(uiOptions)]);
}
