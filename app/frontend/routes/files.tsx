import { useEffect, useState } from "react";
import type { Route } from "./+types/files";
import type { FileListResponse } from "~/lib/types/object-storage";

export function meta(
  _args: Route.MetaArgs,
): Array<{ title: string } | { name: string; content: string }> {
  return [
    { title: "Files Demo" },
    { name: "description", content: "R2 Object Storage File Download Demo" },
  ];
}

async function handleSync(): Promise<void> {
  try {
    const response = await fetch("/api/admin/files/sync", { method: "POST" });
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
    const data = await response.json();
    alert(`Sync completed: ${JSON.stringify(data, null, 2)}`);
    globalThis.location.reload();
  } catch (error) {
    alert(`Sync failed: ${String(error)}`);
  }
}

export default function FilesPage(): React.JSX.Element {
  const [files, setFiles] = useState<FileListResponse["files"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch("/api/files");

        if (!response.ok) {
          throw new Error(`Failed to fetch files: ${response.statusText}`);
        }

        const data = await response.json();
        setFiles((data as FileListResponse).files);
      } catch (error) {
        console.error("Error fetching files:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to fetch files",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void fetchFiles();
  }, []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Object Storage Files</h1>

      {isLoading && <div>Loading files...</div>}

      {errorMessage && (
        <div className="bg-red-100 dark:bg-red-950 border border-red-500 text-red-800 dark:text-red-200 px-4 py-3 rounded mb-4">
          Error: {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && files.length === 0 && (
        <div>ファイルがありません</div>
      )}

      {!isLoading && !errorMessage && files.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-400 dark:border-gray-600">
            <thead className="bg-gray-200 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 border-b border-gray-400 dark:border-gray-600 text-left text-sm font-semibold">
                  File Name
                </th>
                <th className="px-6 py-3 border-b border-gray-400 dark:border-gray-600 text-left text-sm font-semibold">
                  Size (bytes)
                </th>
                <th className="px-6 py-3 border-b border-gray-400 dark:border-gray-600 text-left text-sm font-semibold">
                  Content Type
                </th>
                <th className="px-6 py-3 border-b border-gray-400 dark:border-gray-600 text-left text-sm font-semibold">
                  Downloads
                </th>
                <th className="px-6 py-3 border-b border-gray-400 dark:border-gray-600 text-left text-sm font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800">
              {files.map((file) => (
                <tr key={file.key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 border-b border-gray-300 dark:border-gray-600 text-sm">
                    {file.key}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-300 dark:border-gray-600 text-sm">
                    {file.size.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-300 dark:border-gray-600 text-sm">
                    {file.contentType}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-300 dark:border-gray-600 text-sm">
                    {file.downloadCount}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-300 dark:border-gray-600 text-sm">
                    <a
                      href={`/api/files/${file.key
                        .split("/")
                        .map((segment) => encodeURIComponent(segment))
                        .join("/")}`}
                      download
                      className="text-blue-700 dark:text-blue-400 hover:underline font-medium"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
        <h2 className="text-xl font-semibold mb-2">Admin Actions</h2>
        <button
          onClick={() => void handleSync()}
          className="bg-blue-700 hover:bg-blue-900 text-white font-bold py-2 px-4 rounded"
        >
          Sync Files from R2
        </button>
      </div>
    </div>
  );
}
