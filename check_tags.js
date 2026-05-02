
const fs = require('fs');
const content = fs.readFileSync('src/components/PricingEngine.tsx', 'utf8');

let depth = 0;
let lines = content.split('\n');
lines.forEach((line, i) => {
    let opens = (line.match(/<div/g) || []).length;
    let closes = (line.match(/<\/div>/g) || []).length;
    let selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
    
    let oldDepth = depth;
    depth += opens - closes - selfCloses;
    
    if (depth < 0) {
        console.log(`Line ${i + 1}: Depth went below 0! (${depth})`);
        depth = 0;
    }
});

console.log(`Final depth: ${depth}`);
