export type FileListItem = {
  key: string;
  size: number;
  contentType: string;
  downloadCount: number;
};

export type FileListResponse = {
  files: FileListItem[];
};

export type SyncResponse = {
  added: number;
  deleted: number;
  updated: number;
};

export type ErrorResponse = {
  error: string;
};
