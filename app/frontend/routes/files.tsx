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
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Object Storage Files</h1>

      {isLoading && <div className="text-gray-700">Loading files...</div>}

      {errorMessage && (
        <div className="bg-red-100 border border-red-500 text-red-800 px-4 py-3 rounded mb-4">
          Error: {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && files.length === 0 && (
        <div className="text-gray-700">ファイルがありません</div>
      )}

      {!isLoading && !errorMessage && files.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-400">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-6 py-3 border-b border-gray-400 text-left text-sm font-semibold text-gray-900">
                  File Name
                </th>
                <th className="px-6 py-3 border-b border-gray-400 text-left text-sm font-semibold text-gray-900">
                  Size (bytes)
                </th>
                <th className="px-6 py-3 border-b border-gray-400 text-left text-sm font-semibold text-gray-900">
                  Content Type
                </th>
                <th className="px-6 py-3 border-b border-gray-400 text-left text-sm font-semibold text-gray-900">
                  Downloads
                </th>
                <th className="px-6 py-3 border-b border-gray-400 text-left text-sm font-semibold text-gray-900">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {files.map((file) => (
                <tr key={file.key} className="hover:bg-gray-50">
                  <td className="px-6 py-4 border-b border-gray-300 text-sm text-gray-900">
                    {file.key}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-300 text-sm text-gray-800">
                    {file.size.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-300 text-sm text-gray-800">
                    {file.contentType}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-300 text-sm text-gray-800">
                    {file.downloadCount}
                  </td>
                  <td className="px-6 py-4 border-b border-gray-300 text-sm">
                    <a
                      href={`/api/files/${file.key
                        .split("/")
                        .map((segment) => encodeURIComponent(segment))
                        .join("/")}`}
                      download
                      className="text-blue-700 hover:text-blue-900 underline font-medium"
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

      <div className="mt-8 p-4 bg-gray-200 border border-gray-300 rounded">
        <h2 className="text-xl font-semibold mb-2 text-gray-900">Admin Actions</h2>
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
