const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  // Build extension
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "out/extension.js",
    external: ["vscode"],
    logLevel: "silent",
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin,
    ],
  });

  // Build test files
  const testCtx = await esbuild.context({
    entryPoints: [
      "src/test/runTest.ts",
      "src/test/suite/index.ts",
      "src/test/suite/*.test.ts",
    ],
    bundle: true,
    format: "cjs",
    minify: false,
    sourcemap: true,
    sourcesContent: false,
    platform: "node",
    outdir: "out/test",
    external: ["vscode", "mocha", "glob"],
    logLevel: "silent",
  });

  if (watch) {
    await ctx.watch();
    await testCtx.watch();
  } else {
    await ctx.rebuild();
    await testCtx.rebuild();
    await ctx.dispose();
    await testCtx.dispose();
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log("[watch] build finished");
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
