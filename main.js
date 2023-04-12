import os from 'os';
import https from 'https';
import fs from 'fs';
import path from 'path';
import tar from 'tar';
import xml2js from 'xml2js';

async function downloadFile(url, folder) {
  let docsetFilename = url.split('/').pop();
  let docsetFilepath = path.join(folder, docsetFilename);
  if (fs.existsSync(docsetFilepath)) {
    // Add unique suffix to filename if it already exists
    let i = 1;
    while (fs.existsSync(path.join(folder, `${path.parse(docsetFilename).name}_${i}.tgz`))) {
      i++;
    }
    docsetFilename = `${path.parse(docsetFilename).name}_${i}.tgz`;
    docsetFilepath = path.join(folder, docsetFilename);
  }
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(docsetFilepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${docsetFilename}`);
        resolve(docsetFilepath);
      });
    }).on('error', (err) => {
      fs.unlink(docsetFilepath, () => {});
      console.error(`Error downloading ${docsetFilename}: ${err}`);
      reject(err);
    });
  });
}

// Set the path to the folder containing the XML files
const xmlFolder = './xmls';

// Create the docsets and archives folders if they don't exist
if (!fs.existsSync('./docsets')) {
  fs.mkdirSync('./docsets');
}
if (!fs.existsSync('./archives')) {
  fs.mkdirSync('./archives');
}

// Create a list to hold the download threads
const docsetFiles = [];

// Process each XML file in the folder
fs.readdirSync(xmlFolder).forEach(async (filename) => {
  if (filename.endsWith('.xml')) {
    // Parse the XML file
    const xml = fs.readFileSync(path.join(xmlFolder, filename));
    try {
      const result = await xml2js.parseStringPromise(xml);
      const root = result.root;

      // Download the latest two docset versions for each URL
      for (const url of root.url) {
        const urlStr = url;
        const urlVersions = [];
        // Get the latest two versions for the URL
        for (const version of root.otherVersions[0].version) {
          urlVersions.push(version.name[0]);
          if (urlVersions.length === 2) {
            break;
          }
        }
        // Download the latest two versions for the URL
        for (const version of urlVersions) {
          if (urlStr.includes(version)) {
            const docsetFile = await downloadFile(urlStr, './docsets');
            if (docsetFile) {
              docsetFiles.push(docsetFile);
            }
            break;
          }
        }
      }
    } catch (err) {
      console.error(`Error parsing ${filename}: ${err}`);
    }
  }
});

// Extract the docsets
for (const docsetFile of docsetFiles) {
  try {
    await tar.x({ file: docsetFile });
    const docsetFolderBase = path.parse(docsetFile).name;
    let docsetFolder = path.join('./docsets', docsetFolderBase);
    let i = 1;
    while (fs.existsSync(docsetFolder)) {
      docsetFolder = path.join('./docsets', `${docsetFolderBase}_${i}`);
      i++;
    }
    fs.mkdirSync(docsetFolder);
    console.log(`Extracted ${docsetFile} to ${docsetFolder}`);
    fs.renameSync(docsetFile, path.join('./archives', path.basename(docsetFile)));
    console.log(`Moved ${docsetFile} to ./archives`);
  } catch (err) {
    console.error(`Error extracting ${docsetFile}: ${err}`);
  }
}