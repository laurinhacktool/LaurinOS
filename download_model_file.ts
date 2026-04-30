
import fs from 'fs';
import https from 'https';
import path from 'path';

const url = 'https://huggingface.co/mradermacher/Dolphin3.0-Llama3.1-8B-GGUF/resolve/main/Dolphin3.0-Llama3.1-8B.Q4_K_M.gguf';
const dest = path.join(process.cwd(), 'dolphin.gguf');

async function download() {
  console.log(`Starting download: ${url}`);
  console.log(`Destination: ${dest}`);

  const file = fs.createWriteStream(dest);
  
  https.get(url, (response) => {
    // Handle redirects (HuggingFace uses them)
    if (response.statusCode === 302 || response.statusCode === 301) {
      console.log(`Redirecting to: ${response.headers.location}`);
      https.get(response.headers.location!, (res) => {
        res.pipe(file);
        res.on('end', () => {
          file.close();
          console.log('Download completed.');
        });
      });
      return;
    }

    if (response.statusCode !== 200) {
      console.error(`Failed to download: ${response.statusCode}`);
      return;
    }

    response.pipe(file);

    file.on('finish', () => {
      file.close();
      console.log('Download completed.');
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error(`Error: ${err.message}`);
  });
}

download();
