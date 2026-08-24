const path = require('path');
const fs = require('fs');

module.exports = async (context) => {
  const apiPath = path.join(context.appOutDir, 'resources/api');
  const srcModules = path.join(__dirname, 'temp_build/api/node_modules');
  const destModules = path.join(apiPath, 'node_modules');
  
  if (fs.existsSync(srcModules)) {
    console.log('Copying node_modules to resources/api...');
    fs.cpSync(srcModules, destModules, { recursive: true, force: true });
    console.log('node_modules copied successfully!');
  }
};
