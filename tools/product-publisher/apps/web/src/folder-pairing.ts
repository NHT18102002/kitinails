export interface FolderFileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly webkitRelativePath?: string;
}

export interface ProductImagePair<T extends FolderFileLike = FolderFileLike> {
  readonly id: string;
  readonly position: number;
  readonly label: string;
  readonly files: readonly [T, T];
}

export interface FolderScanResult<T extends FolderFileLike = FolderFileLike> {
  readonly folderName: string;
  readonly imageFiles: readonly T[];
  readonly ignoredFiles: readonly T[];
  readonly pairs: readonly ProductImagePair<T>[];
  readonly errors: readonly string[];
}

const supportedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function relativeFilePath(file: FolderFileLike): string {
  return String(file.webkitRelativePath || file.name).replaceAll('\\', '/');
}

function isHiddenOrSystemFile(file: FolderFileLike): boolean {
  const parts = relativeFilePath(file).split('/');
  return parts.some((part) => part.startsWith('.') || part.toLowerCase() === '__macosx')
    || file.name.toLowerCase() === 'thumbs.db';
}

export function isSupportedImage(file: FolderFileLike): boolean {
  if (isHiddenOrSystemFile(file)) return false;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return supportedExtensions.has(extension);
}

export function sortFolderImages<T extends FolderFileLike>(files: readonly T[]): T[] {
  return [...files].sort((left, right) => {
    const leftParts = fileSortParts(left);
    const rightParts = fileSortParts(right);
    const directoryOrder = naturalCollator.compare(leftParts.directory, rightParts.directory);
    if (directoryOrder !== 0) return directoryOrder;
    const rootOrder = naturalCollator.compare(leftParts.root, rightParts.root);
    if (rootOrder !== 0) return rootOrder;
    const variantOrder = leftParts.variant - rightParts.variant;
    if (variantOrder !== 0) return variantOrder;
    return naturalCollator.compare(leftParts.basename, rightParts.basename);
  });
}

function fileSortParts(file: FolderFileLike) {
  const path = relativeFilePath(file);
  const slash = path.lastIndexOf('/');
  const directory = slash >= 0 ? path.slice(0, slash) : '';
  const basename = slash >= 0 ? path.slice(slash + 1) : path;
  const stem = basename.replace(/\.[^.]+$/, '');
  const pairVariant = /^(.*?)(?:\.(\d+))?$/.exec(stem);
  return {
    directory,
    basename,
    root: pairVariant?.[1] || stem,
    variant: pairVariant?.[2] ? Number(pairVariant[2]) : -1,
  };
}

export function scanFolderFiles<T extends FolderFileLike>(files: readonly T[]): FolderScanResult<T> {
  const imageFiles = sortFolderImages(files.filter(isSupportedImage));
  const ignoredFiles = files.filter((file) => !isSupportedImage(file));
  const firstPath = imageFiles[0] ? relativeFilePath(imageFiles[0]) : '';
  const folderName = firstPath.includes('/') ? (firstPath.split('/')[0] ?? 'Thư mục đã chọn') : 'Thư mục đã chọn';
  const errors: string[] = [];

  if (imageFiles.length === 0) {
    errors.push('Không tìm thấy ảnh JPG, PNG hoặc WEBP trong thư mục.');
  } else if (imageFiles.length % 2 !== 0) {
    errors.push(`Có ${imageFiles.length} ảnh — cần số ảnh chẵn để ghép đúng 2 ảnh cho mỗi sản phẩm.`);
  }

  const pairs: ProductImagePair<T>[] = [];
  for (let index = 0; index + 1 < imageFiles.length; index += 2) {
    const position = pairs.length + 1;
    const filesForProduct = [imageFiles[index]!, imageFiles[index + 1]!] as const;
    pairs.push({
      id: `${relativeFilePath(filesForProduct[0])}\u0000${relativeFilePath(filesForProduct[1])}`,
      position,
      label: `Sản phẩm ${String(position).padStart(2, '0')}`,
      files: filesForProduct,
    });
  }

  return {
    folderName,
    imageFiles,
    ignoredFiles,
    pairs,
    errors,
  };
}

export function splitPairsIntoBatches<T extends FolderFileLike>(
  pairs: readonly ProductImagePair<T>[],
  maxBatchItems: number,
): ProductImagePair<T>[][] {
  if (!Number.isInteger(maxBatchItems) || maxBatchItems <= 0) {
    throw new Error('Giới hạn sản phẩm mỗi batch không hợp lệ');
  }
  const chunks: ProductImagePair<T>[][] = [];
  for (let index = 0; index < pairs.length; index += maxBatchItems) {
    chunks.push(pairs.slice(index, index + maxBatchItems));
  }
  return chunks;
}
