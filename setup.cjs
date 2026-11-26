const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expo58-'));
const npm = (...args) => execFileSync(process.execPath, [process.env.npm_execpath, ...args], {encoding:'utf8'});
try {
  const [archive] = JSON.parse(npm('pack', 'expo@~58.0.0', '--pack-destination', dir, '--json'));
  const versions = JSON.parse(execFileSync('tar', ['-xOf', path.join(dir, archive.filename), 'package/bundledNativeModules.json'], {encoding:'utf8'}));
  const project = JSON.parse(fs.readFileSync('package.json','utf8'));
  for (const group of [project.dependencies,project.devDependencies]) {
    for (const name of Object.keys(group)) {
      if (versions[name]) group[name] = versions[name];
    }
  }
  project.dependencies.expo = archive.version;
  fs.writeFileSync('package.json', JSON.stringify(project,null,2)+'\n');
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
