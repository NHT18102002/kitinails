import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BatchDto, CollectionSnapshot } from '@ersa/product-publisher-contracts';
import {
  ApiRequestError,
  apiAccessTokenIsRequired,
  cancelBatch,
  clearApiAccessToken,
  createAndRunFolderBatches,
  getPreflight,
  hasApiAccessToken,
  listBatches,
  listCollections,
  resumeBatch,
  runBatch,
  setApiAccessToken,
  type FolderRunProgress,
} from './api.js';
import {
  relativeFilePath,
  scanFolderFiles,
  splitPairsIntoBatches,
  type FolderScanResult,
} from './folder-pairing.js';

type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

const directoryInputProps: DirectoryInputProps = {
  webkitdirectory: '',
  directory: '',
};

const batchStateLabels: Record<BatchDto['state'], string> = {
  DRAFT: 'Đang chuẩn bị',
  SEALED: 'Sẵn sàng chạy',
  RUNNING: 'Đang xử lý',
  PARTIAL_SUCCESS: 'Hoàn tất một phần',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
};

const stageLabels: Record<FolderRunProgress['stage'], string> = {
  creating: 'Đang tạo batch',
  uploading: 'Đang tải ảnh lên hệ thống',
  sealing: 'Đang khóa manifest',
  queueing: 'Đang đưa vào hàng đợi',
  complete: 'Đã tiếp nhận toàn bộ thư mục',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AccessGate({
  invalid,
  onSubmit,
}: {
  invalid: boolean;
  onSubmit: (token: string) => void;
}) {
  const [token, setToken] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (token.trim()) onSubmit(token);
  };

  return (
    <main className="access-shell">
      <section className="access-card" aria-labelledby="access-title">
        <span className="brand__mark" aria-hidden="true">E</span>
        <p className="eyebrow">Ersa Product Publisher</p>
        <h1 id="access-title">Đăng nhập công cụ</h1>
        <p>Nhập mã truy cập nội bộ do quản trị viên cung cấp. Mã Shopify không được nhập tại đây.</p>
        <form onSubmit={submit}>
          <label htmlFor="publisher-access-token">Mã truy cập</label>
          <input
            id="publisher-access-token"
            autoComplete="current-password"
            autoFocus
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          {invalid ? <p className="error" role="alert">Mã truy cập không đúng hoặc đã được thay đổi.</p> : null}
          <button type="submit" disabled={!token.trim()}>Tiếp tục</button>
        </form>
      </section>
    </main>
  );
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'UNAUTHORIZED';
}

function BatchCard({ batch }: { batch: BatchDto }) {
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationFn: (kind: 'run' | 'resume' | 'cancel') => {
      if (kind === 'run') return runBatch(batch.id);
      if (kind === 'resume') return resumeBatch(batch.id);
      return cancelBatch(batch.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  });
  const canCancel = ['DRAFT', 'SEALED', 'RUNNING'].includes(batch.state);
  const items = batch.items ?? [];
  const publishedCount = items.filter((item) => item.state === 'PUBLISHED').length;
  const failedCount = items.filter((item) => (
    ['BLOCKED_DUPLICATE', 'QA_HOLD', 'DRAFT_QA_FAILED', 'DRAFT_CONFLICT', 'FAILED_FINAL', 'COMPENSATION_REQUIRED'].includes(item.state)
  )).length;
  const isSettled = ['COMPLETED', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'].includes(batch.state);
  const progress = isSettled
    ? 100
    : items.length ? Math.round(((publishedCount + failedCount) / items.length) * 100) : 0;

  return (
    <article className="batch-card">
      <div className="batch-card__topline">
        <span className={`status status--${batch.state.toLowerCase()}`}>
          <span className="status__dot" aria-hidden="true" />
          {batchStateLabels[batch.state]}
        </span>
        <time dateTime={batch.createdAt}>
          {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(batch.createdAt))}
        </time>
      </div>
      <div>
        <p className="eyebrow">{batch.collection.title}</p>
        <h3>Batch {batch.id.slice(0, 8)}</h3>
      </div>
      <div className="batch-progress" aria-label={`Tiến độ ${progress}%`}>
        <div className="batch-progress__meta">
          <span>{items.length} sản phẩm</span>
          <strong>
            {batch.state === 'COMPLETED'
              ? `${items.length}/${items.length} hoàn tất`
              : `${publishedCount}/${items.length || 0} đã publish`}
          </strong>
        </div>
        <span className="progress-track"><span style={{ width: `${progress}%` }} /></span>
      </div>
      {failedCount > 0 ? <p className="inline-warning">{failedCount} sản phẩm cần kiểm tra.</p> : null}
      <div className="card-actions">
        {batch.state === 'SEALED' ? (
          <button disabled={action.isPending} onClick={() => action.mutate('run')}>Chạy pipeline</button>
        ) : null}
        {batch.state === 'RUNNING' ? (
          <button className="secondary" disabled={action.isPending} onClick={() => action.mutate('resume')}>Resume</button>
        ) : null}
        {canCancel ? (
          <button className="ghost danger" disabled={action.isPending} onClick={() => action.mutate('cancel')}>Hủy</button>
        ) : null}
      </div>
      {action.error ? <p className="error" role="alert">{action.error.message}</p> : null}
    </article>
  );
}

function PairPreview({
  scan,
  previewUrls,
}: {
  scan: FolderScanResult<File>;
  previewUrls: ReadonlyMap<File, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const visiblePairs = expanded ? scan.pairs : scan.pairs.slice(0, 8);

  return (
    <div className="pairing-review">
      <div className="pairing-review__heading">
        <div>
          <p className="eyebrow">Kiểm tra cách ghép</p>
          <h3>{scan.pairs.length} sản phẩm từ {scan.imageFiles.length} ảnh</h3>
        </div>
        {scan.pairs.length > 8 ? (
          <button className="text-button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Thu gọn' : `Xem tất cả ${scan.pairs.length}`}
          </button>
        ) : null}
      </div>
      <div className="pair-grid">
        {visiblePairs.map((pair) => (
          <article className="pair-card" key={pair.id}>
            <div className="pair-card__images">
              {pair.files.map((file) => (
                <img key={relativeFilePath(file)} src={previewUrls.get(file)} alt="" />
              ))}
              <span>{pair.position}</span>
            </div>
            <strong>{pair.label}</strong>
            <small title={pair.files.map(relativeFilePath).join(' + ')}>
              {pair.files.map((file) => file.name).join(' + ')}
            </small>
          </article>
        ))}
      </div>
    </div>
  );
}

function PublisherApp({
  onLogout,
  onUnauthorized,
}: {
  onLogout: () => void;
  onUnauthorized: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedGid, setSelectedGid] = useState('');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [scan, setScan] = useState<FolderScanResult<File> | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [progress, setProgress] = useState<FolderRunProgress | null>(null);
  const [previewUrls, setPreviewUrls] = useState<ReadonlyMap<File, string>>(new Map());
  const batches = useQuery({ queryKey: ['batches'], queryFn: listBatches, refetchInterval: 10_000 });
  const collections = useQuery({ queryKey: ['collections'], queryFn: listCollections });
  const preflight = useQuery({ queryKey: ['preflight'], queryFn: getPreflight, refetchInterval: 30_000 });

  useEffect(() => {
    if ([batches.error, collections.error, preflight.error].some(isUnauthorized)) onUnauthorized();
  }, [batches.error, collections.error, onUnauthorized, preflight.error]);

  const assignableCollections = useMemo(
    () => (collections.data ?? []).filter((collection) => collection.compatibility === 'ASSIGNABLE'),
    [collections.data],
  );
  const filteredCollections = useMemo(() => {
    const query = collectionSearch.trim().toLocaleLowerCase('vi');
    if (!query) return assignableCollections;
    return assignableCollections.filter((collection) => (
      collection.title.toLocaleLowerCase('vi').includes(query)
      || collection.handle.toLocaleLowerCase('vi').includes(query)
    ));
  }, [assignableCollections, collectionSearch]);
  const selected = useMemo(
    () => assignableCollections.find((collection) => collection.gid === selectedGid)
      ?? assignableCollections[0],
    [assignableCollections, selectedGid],
  );
  const plannedBatchCount = scan && preflight.data
    ? splitPairsIntoBatches(scan.pairs, preflight.data.maxBatchItems).length
    : 0;
  const blocked = preflight.data?.status === 'blocked';
  const canRun = Boolean(
    selected
    && scan
    && scan.pairs.length > 0
    && scan.errors.length === 0
    && !blocked,
  );

  useEffect(() => {
    const next = new Map<File, string>();
    for (const pair of scan?.pairs ?? []) {
      for (const file of pair.files) next.set(file, URL.createObjectURL(file));
    }
    setPreviewUrls(next);
    return () => {
      for (const url of next.values()) URL.revokeObjectURL(url);
    };
  }, [scan]);

  const create = useMutation({
    mutationFn: ({
      collection,
      sourcePairs,
      maxBatchItems,
    }: {
      collection: CollectionSnapshot;
      sourcePairs: FolderScanResult<File>['pairs'];
      maxBatchItems: number;
    }) => createAndRunFolderBatches(collection, sourcePairs, maxBatchItems, setProgress),
    onSuccess: async () => {
      setScan(null);
      setFileInputKey((value) => value + 1);
      await queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });

  const handleFolder = (files: FileList | null) => {
    setProgress(null);
    create.reset();
    setScan(files ? scanFolderFiles(Array.from(files)) : null);
  };

  const progressPercent = progress
    ? Math.round((progress.completedItems / Math.max(1, progress.totalItems)) * 100)
    : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Ersa Product Publisher">
          <span className="brand__mark">E</span>
          <span><strong>Ersa</strong><small>Product Publisher</small></span>
        </a>
        <div className="topbar__actions">
          <div className={`system-pill system-pill--${preflight.data?.status ?? 'loading'}`}>
            <span aria-hidden="true" />
            {preflight.isLoading
              ? 'Đang kiểm tra'
              : blocked
                ? 'Hệ thống bị chặn'
                : `${preflight.data?.liveShop?.name ?? preflight.data?.shopDomain} · Sẵn sàng`}
          </div>
          {hasApiAccessToken() ? <button className="ghost" onClick={onLogout}>Đăng xuất</button> : null}
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">Bulk product upload</p>
          <h1>Một thư mục.<br />Toàn bộ sản phẩm.</h1>
        </div>
        <p>
          Chọn collection và một thư mục ảnh. Hệ thống sắp xếp tên file,
          ghép mỗi hai ảnh thành một sản phẩm rồi đưa toàn bộ vào pipeline Shopify an toàn.
        </p>
      </section>

      <section className="workflow" aria-labelledby="workflow-title">
        <div className="workflow__header">
          <div>
            <p className="eyebrow">Tạo batch mới</p>
            <h2 id="workflow-title">Thiết lập lần upload</h2>
          </div>
          <span className="mode-badge">
            Chế độ {preflight.data?.shopifyWriteMode === 'publish'
              ? 'publish'
              : preflight.data?.shopifyWriteMode === 'draft' ? 'draft' : 'mô phỏng'}
          </span>
        </div>

        <div className="workflow-grid">
          <section className="step-card">
            <div className="step-card__number">01</div>
            <div className="step-card__body">
              <p className="eyebrow">Đích đến</p>
              <h3>Chọn collection</h3>
              <p>Chỉ collection manual có thể nhận sản phẩm mới được hiển thị.</p>
              <input
                className="collection-search"
                type="search"
                value={collectionSearch}
                placeholder="Tìm tên hoặc handle…"
                disabled={create.isPending}
                onChange={(event) => setCollectionSearch(event.target.value)}
              />
              <select
                aria-label="Collection đích"
                value={selected?.gid ?? ''}
                disabled={create.isPending}
                onChange={(event) => setSelectedGid(event.target.value)}
              >
                {filteredCollections.map((collection) => (
                  <option key={collection.gid} value={collection.gid}>
                    {collection.title} · {collection.handle}
                  </option>
                ))}
              </select>
              {collections.isLoading ? <small>Đang tải collection từ Shopify…</small> : null}
              {collections.error ? <p className="error" role="alert">{collections.error.message}</p> : null}
            </div>
          </section>

          <section className="step-card">
            <div className="step-card__number">02</div>
            <div className="step-card__body">
              <p className="eyebrow">Nguồn ảnh</p>
              <h3>Chọn một thư mục</h3>
              <p>Hỗ trợ JPG, PNG, WEBP. File được sắp xếp tự nhiên rồi ghép tuần tự từng hai ảnh.</p>
              <label className={`folder-picker ${scan ? 'folder-picker--selected' : ''}`}>
                <input
                  {...directoryInputProps}
                  key={fileInputKey}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  disabled={create.isPending}
                  onChange={(event) => handleFolder(event.target.files)}
                />
                <span className="folder-picker__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M3.5 7.5h6l2-2h9a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a1 1 0 0 1 1-1Z" /><path d="m9 13 3-3 3 3M12 10v6" /></svg>
                </span>
                <span>
                  <strong>{scan ? scan.folderName : 'Mở trình chọn thư mục'}</strong>
                  <small>{scan ? `${scan.imageFiles.length} ảnh hợp lệ đã quét` : 'Không tải file hệ thống hoặc đường dẫn riêng tư'}</small>
                </span>
                <em>{scan ? 'Chọn lại' : 'Chọn folder'}</em>
              </label>
              {scan?.ignoredFiles.length ? (
                <small>{scan.ignoredFiles.length} file không phải ảnh đã được bỏ qua.</small>
              ) : null}
              {scan?.errors.map((error) => <p className="error" role="alert" key={error}>{error}</p>)}
            </div>
          </section>
        </div>

        {scan && scan.pairs.length > 0 ? <PairPreview scan={scan} previewUrls={previewUrls} /> : null}

        <section className="run-panel">
          <div className="run-summary">
            <div><small>Collection</small><strong>{selected?.title ?? 'Chưa chọn'}</strong></div>
            <div><small>Sản phẩm</small><strong>{scan?.pairs.length ?? 0}</strong></div>
            <div><small>Ảnh</small><strong>{scan?.imageFiles.length ?? 0}</strong></div>
            <div><small>Batch hệ thống</small><strong>{plannedBatchCount}</strong></div>
            <div><small>Dung lượng</small><strong>{formatBytes(scan?.imageFiles.reduce((sum, file) => sum + file.size, 0) ?? 0)}</strong></div>
          </div>
          {progress ? (
            <div className="upload-progress" aria-live="polite">
              <div>
                <strong>{stageLabels[progress.stage]}</strong>
                <span>
                  {progress.currentPairLabel
                    ? `${progress.currentPairLabel} · `
                    : ''}
                  {progress.completedItems}/{progress.totalItems} sản phẩm
                </span>
              </div>
              <span className="progress-track"><span style={{ width: `${progressPercent}%` }} /></span>
            </div>
          ) : null}
          <button
            className="run-button"
            disabled={!canRun || create.isPending}
            onClick={() => {
              if (selected && scan && preflight.data) {
                create.mutate({
                  collection: selected,
                  sourcePairs: scan.pairs,
                  maxBatchItems: preflight.data.maxBatchItems,
                });
              }
            }}
          >
            <span>{create.isPending ? 'Đang tiếp nhận thư mục…' : `Upload ${scan?.pairs.length ?? 0} sản phẩm`}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5" /></svg>
          </button>
          {create.isSuccess ? <p className="success" role="status">Đã đưa toàn bộ sản phẩm vào pipeline.</p> : null}
          {create.error ? <p className="error" role="alert">{create.error.message}</p> : null}
          {preflight.error ? <p className="error" role="alert">{preflight.error.message}</p> : null}
          {blocked ? (
            <p className="error" role="alert">
              Preflight đang bị chặn. Kiểm tra cấu hình Shopify, scope, publication và worker trước khi chạy.
            </p>
          ) : null}
        </section>
      </section>

      <section className="batch-list" aria-labelledby="batch-list-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Theo dõi realtime</p>
            <h2 id="batch-list-title">Lịch sử xử lý</h2>
          </div>
          <button className="secondary" onClick={() => batches.refetch()}>Làm mới</button>
        </div>
        {batches.isLoading ? <p className="empty-state">Đang tải lịch sử…</p> : null}
        {batches.error ? <p className="error" role="alert">{batches.error.message}</p> : null}
        {batches.data?.length === 0 ? <p className="empty-state">Chưa có batch nào.</p> : null}
        <div className="batch-grid">
          {batches.data?.map((batch) => <BatchCard key={batch.id} batch={batch} />)}
        </div>
      </section>
    </main>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const [showAccessGate, setShowAccessGate] = useState(
    () => apiAccessTokenIsRequired() && !hasApiAccessToken(),
  );
  const [invalidAccessToken, setInvalidAccessToken] = useState(false);

  if (showAccessGate) {
    return (
      <AccessGate
        invalid={invalidAccessToken}
        onSubmit={(token) => {
          setApiAccessToken(token);
          queryClient.clear();
          setInvalidAccessToken(false);
          setShowAccessGate(false);
        }}
      />
    );
  }

  return (
    <PublisherApp
      onLogout={() => {
        clearApiAccessToken();
        queryClient.clear();
        setInvalidAccessToken(false);
        setShowAccessGate(true);
      }}
      onUnauthorized={() => {
        clearApiAccessToken();
        queryClient.clear();
        setInvalidAccessToken(true);
        setShowAccessGate(true);
      }}
    />
  );
}
