
import fs from 'fs';
import https from 'https';
import path from 'path';

const url = 'https://huggingface.co/mradermacher/Dolphin3.0-Llama3.1-8B-GGUF/resolve/main/Dolphin3.0-Llama3.1-8B.Q4_K_M.gguf';
const dest = path.join(process.cwd(), 'dolphin.gguf');

async function download() {
  console.log(`Starting download: ${url}`);
  console.log(`Destination: ${dest}`);

  const statusPath = path.join(process.cwd(), 'download_status.json');
  
  const updateStatus = (progress: number, status: string, error?: string) => {
    fs.writeFileSync(statusPath, JSON.stringify({ progress, status, error, timestamp: Date.now() }));
  };

  updateStatus(0, 'starting');

  const startDownload = (downloadUrl: string) => {
    https.get(downloadUrl, (response) => {
      if (response.statusCode === 302 && response.headers.location) {
        console.log(`Redirecting to: ${response.headers.location}`);
        startDownload(response.headers.location);
        return;
      }

      if (response.statusCode !== 200) {
        const errMsg = `Failed to download: ${response.statusCode}`;
        console.error(errMsg);
        updateStatus(0, 'error', errMsg);
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      const file = fs.createWriteStream(dest);

      let lastUpdate = 0;
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const now = Date.now();
        if (totalSize > 0 && now - lastUpdate > 500) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          updateStatus(progress, 'downloading');
          lastUpdate = now;
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('Download completed.');
        updateStatus(100, 'completed');
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        const errMsg = `File error: ${err.message}`;
        console.error(errMsg);
        updateStatus(0, 'error', errMsg);
      });

    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      const errMsg = `Network error: ${err.message}`;
      console.error(errMsg);
      updateStatus(0, 'error', errMsg);
    });
  };

  startDownload(url);
}

download();
