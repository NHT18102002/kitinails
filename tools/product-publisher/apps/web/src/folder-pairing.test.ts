import { describe, expect, it } from 'vitest';
import {
  scanFolderFiles,
  splitPairsIntoBatches,
  type FolderFileLike,
} from './folder-pairing.js';

function file(path: string, type = 'image/jpeg'): FolderFileLike {
  const name = path.split('/').at(-1) ?? path;
  return {
    name,
    type,
    size: 1_024,
    webkitRelativePath: path,
  };
}

describe('folder pairing', () => {
  it('sorts image names naturally and pairs every two files', () => {
    const scan = scanFolderFiles([
      file('summer/10.1.jpg'),
      file('summer/2.jpg'),
      file('summer/1.1.jpg'),
      file('summer/10.jpg'),
      file('summer/2.1.jpg'),
      file('summer/1.jpg'),
    ]);

    expect(scan.folderName).toBe('summer');
    expect(scan.errors).toEqual([]);
    expect(scan.pairs.map((pair) => pair.files.map((item) => item.name))).toEqual([
      ['1.jpg', '1.1.jpg'],
      ['2.jpg', '2.1.jpg'],
      ['10.jpg', '10.1.jpg'],
    ]);
  });

  it('ignores unsupported files and blocks an odd image count', () => {
    const scan = scanFolderFiles([
      file('cute/1.jpg'),
      file('cute/2.png', 'image/png'),
      file('cute/3.webp', 'image/webp'),
      file('cute/readme.txt', 'text/plain'),
      file('cute/.DS_Store', 'application/octet-stream'),
    ]);

    expect(scan.imageFiles).toHaveLength(3);
    expect(scan.ignoredFiles).toHaveLength(2);
    expect(scan.pairs).toHaveLength(1);
    expect(scan.errors[0]).toContain('số ảnh chẵn');
  });

  it('splits large folders into safe API batch sizes without dropping pairs', () => {
    const scan = scanFolderFiles(Array.from({ length: 10 }, (_, index) => (
      file(`nail-art/${index + 1}.jpg`)
    )));
    const chunks = splitPairsIntoBatches(scan.pairs, 2);

    expect(chunks.map((chunk) => chunk.length)).toEqual([2, 2, 1]);
    expect(chunks.flat().map((pair) => pair.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects an invalid configured batch size', () => {
    expect(() => splitPairsIntoBatches([], 0)).toThrow('Giới hạn sản phẩm');
  });
});
