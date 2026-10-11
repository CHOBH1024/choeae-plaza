// Development-only rasterization of our vector assets; no image generation,
// downloads, account data, or modification of the legacy bitmaps.
const path=require('node:path');
const fs=require('node:fs/promises');
const moduleDirectory=process.argv[2];
if(!moduleDirectory){console.error('Usage: node scripts/render-brand-assets.cjs <sharp-package-directory>');process.exit(1);}
const packageDirectory=path.resolve(moduleDirectory);
const manifest=require(path.join(packageDirectory,'package.json'));
if(manifest.name!=='sharp'){console.error('Expected a local sharp package');process.exit(1);}
const sharp=require(packageDirectory);
const root=path.resolve(__dirname,'../public');
(async()=>{
  for(const [source,target,width,height] of [['choeae-icon-v1.svg','choeae-icon-512-v1.png',512,512],['choeae-icon-v1.svg','choeae-apple-180-v1.png',180,180],['choeae-og-v1.svg','choeae-og-v1.png',1200,630]]){
    const result=await sharp(await fs.readFile(path.join(root,source))).resize(width,height).png().toFile(path.join(root,target));
    if(result.width!==width||result.height!==height)throw Error('Incorrect brand dimensions');
    console.log(JSON.stringify({target,width:result.width,height:result.height,renderer:manifest.version}));
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
