const fs = require('fs');
const { SourceMapConsumer } = require('source-map');
async function find() {
     let files = fs.readdirSync('./dist/assets').filter(f => f.startsWith('services-') && f.endsWith('.js'));
     let file = './dist/assets/' + files[0];
     let mapPath = file + '.map';
     let rawSourceMap = fs.readFileSync(mapPath, 'utf8');

     await SourceMapConsumer.with(rawSourceMap, null, consumer => {
          console.log("Sources in services bundle:", consumer.sources.length);
          let lastSource = "";
          // Try to find what's around line 28
          for (let col = 14500; col < 15500; col += 10) {
               let pos = consumer.originalPositionFor({ line: 28, column: col });
               if (pos && pos.source && pos.source !== lastSource) {
                    console.log(`Line 28 Col ${col} -> ${pos.source}:${pos.line}:${pos.column} (${pos.name})`);
                    lastSource = pos.source;
               }
          }
     });
}
find();
