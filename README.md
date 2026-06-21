# Webflow JS Starter

This GitHub project provides a development workflow for JavaScript files in Webflow JS Starter.

In essence, it uses bun to start a development server on [localhost:3000](http://localhost:3000), bundle, build and serve any working file (from the `/src` directory) in local mode. Once pushed up and merged into `main`, it's auto-tagged with the latest semver tag version (using Github CI), and the production code will be auto-loaded from [jsDelivr CDN](https://www.jsdelivr.com/).

**Keep the repository public for jsDelivr to access and serve the file via CDN**

## Install

### Prerequisites

- Have [bun](https://bun.sh/) installed locally. Installation guidelines [here](https://bun.sh/docs/installation) (recommended approach - homebrew / curl)
   - Alternatively, `pnpm` or `npm` will work too.

### Setup

- Run `bun install`
   - Alternatively, `pnpm install` or `npm install`

## Usage

After repository migration, update the repo name and URL in this README file, and the `./src/entry.ts`.

### Output

The project will process and output the files mentioned in the `files` const of `./bin/build.js` file. The output minified files will be in the `./dist/prod` folder for production (pushed to github), and in the `./dist/dev` used for local file serving (excluded from Git).

### Development

1. The initial `entry.js` file needs to be made available via external server first for this system to work (in the `<head>` area of the site).

   ```html
   <script src="https://cdn.jsdelivr.net/gh/parasshah195/{{repo}}/dist/prod/entry.js"></script>
   ```

   For occasional localhost testing when editing `entry.js`, you'll have to manually include that script like following:
   ```html
   <script src="http://localhost:3000/entry.js"></script>
   ```

2. **Load scripts dynamically using `window.loadScript`**

   You can load any script (relative to your repo or a full CDN URL) as a module using the global `window.loadScript` function. This is the recommended way to load scripts in this setup.

   **Usage:**
   ```js
   // Load a relative script (from CDN or localhost, depending on env)
   window.loadScript('global.js');

   // Load an external library from a CDN, with options
   window.loadScript('https://cdn.jsdelivr.net/npm/some-lib@1.0.0/dist/index.js', {
     placement: 'head', // 'head' or 'body' (default: 'body')
     scriptName: 'some-lib', // Optional: emits a custom event 'scriptLoaded:some-lib' when loaded
     defer: true, // (default: true)
     isModule: true // (default: true)
   });
   ```
   - All scripts are loaded as ES modules by default.
   - The function deduplicates by URL (won't load the same script twice).
   - You can listen for a custom event when a script is loaded:

      ```js
      document.addEventListener('scriptLoaded:some-lib', (e) => {
        // e.detail.url, e.detail.scriptName
        // Your code here
      });
      ```

   - **Options:**
     - `placement`: `'head' | 'body'` (default: `'body'`)
     - `defer`: `boolean` (default: `true`)
     - `isModule`: `boolean` (default: `true`)
     - `scriptName`: `string` (optional, for custom event)

   **Do not use the old `window.JS_SCRIPTS` set or batch loading. Use `window.loadScript` for all dynamic script loading.**

3. Whilst working locally, run `bun run dev` to start a development server on [localhost:3000](http://localhost:3000)
   - Alternatively, `pnpm run dev` or `npm run dev`

4. To switch between serving scripts from localhost or CDN, use the following in your browser console:

   - To serve scripts from localhost (when running the dev server):
     ```js
     window.setScriptMode('local');
     ```
   - To switch back to CDN serving mode:
     ```js
     window.setScriptMode('cdn');
     ```
   This preference is saved in the browser's localStorage. If the local server is not running, it will automatically fall back to CDN.

5. As you make changes to your code locally and save, the [localhost:3000](http://localhost:3000) server will serve those files.

#### Debugging

- Add any debug console logs in the code using the `console.debug` function instead of `console.log`. This way, they can be toggled on/off using the browser native "Verbose/Debug" level.
- There is an optional debug mode setup for development that can execute conditional logic using `window.IS_DEBUG` check. Execute `window.setDebugMode(true)` in the browser console to enable the debug mode. Execute `window.setDebugMode(false)` to disable the mode.

### Publishing the code to CDN

1. Run `bun run build` to generate the production files in `./dist/prod` folder
   - Alternatively, `pnpm run build` or `npm run build`

2. To push code to production, merge the working branch into `main`. A Github Actions workflow will run tagging that version with an incremented [semver](https://semver.org/) tag. Once pushed, the production code will be auto loaded from [jsDelivr CDN](https://www.jsdelivr.com/).
   - By default, the version bump is a patch (`x.y.{{patch number}}`). To bump the version by a higher amount, mention a hashtag in the merge commit message, like `#major` or `#minor`

3. To create separate environments for `dev` and `staging`, respective branches can be used, and the [jsDelivr file path can be set to load the latest scripts from those respective branches](https://www.jsdelivr.com/documentation#id-github). Note: The [caching for branches lasts 12 hours](https://www.jsdelivr.com/documentation#id-caching) and would hence require a manual purge.
   - To do so, override the `window.PRODUCTION_BASE` variable in the HTML file after the inclusion of `entry.js` script.

#### jsDelivr Notes & Caveats

- Direct jsDelivr links directly use semver tagged releases when available, else falls back to the master branch [[info discussion link](https://github.com/jsdelivr/jsdelivr/issues/18376#issuecomment-1046876129)]
- Tagged version branches are purged every 12 hours from their servers [[info discussion link](https://github.com/jsdelivr/jsdelivr/issues/18376#issuecomment-1046918481)]
- To manually purge a tagged version's files, wait for 10 minutes after the new release tag is added [[info discussion link](https://github.com/jsdelivr/jsdelivr/issues/18376#issuecomment-1047040896)]

[**JSDelivr CDN Purge URL**](https://www.jsdelivr.com/tools/purge)