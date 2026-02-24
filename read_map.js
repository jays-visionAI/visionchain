import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

async function run() {
    const mapPath = 'dist/assets/services-BoBHm3Zk.js.map';
    const rawSourceMap = fs.readFileSync(mapPath, 'utf8');

    await SourceMapConsumer.with(rawSourceMap, null, consumer => {
        // We are looking for something around line 28, column 15131 from the old build
        // The new filename is services-BoBHm3Zk.js. We don't know the exact line/col, so let's check
        // all lines/cols in the sourcemap that error could have originated from,
        // or better, just grep for "createSignal" or solid imports in services.

        // Instead of randomly guessing the column, let's find the places where 'from "solid-js"' is used.
        console.log("Reading map successful. Since we dont know exact column in this build, we can't do exact lookup.");
    });
}
run();
