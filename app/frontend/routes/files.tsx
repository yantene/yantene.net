import { useEffect, useState } from "react";
import type { Route } from "./+types/files";
import type { FileListResponse } from "~/lib/types/object-storage";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Files Demo" },
    { name: "description", content: "R2 Object Storage File Download Demo" },
  ];
}

export default function FilesPage() {
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

        const data = (await response.json());
        setFiles(data.files);
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

      {isLoading && (
        <div className="text-gray-600">Loading files...</div>
      )}

      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && files.length === 0 && (
        <div className="text-gray-600">ファイルがありません</div>
      )}

      {!isLoading && !errorMessage && files.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-6 py-3 border-b text-left text-sm font-semibold text-gray-700">
                  File Name
                </th>
                <th className="px-6 py-3 border-b text-left text-sm font-semibold text-gray-700">
                  Size (bytes)
                </th>
                <th className="px-6 py-3 border-b text-left text-sm font-semibold text-gray-700">
                  Content Type
                </th>
                <th className="px-6 py-3 border-b text-left text-sm font-semibold text-gray-700">
                  Downloads
                </th>
                <th className="px-6 py-3 border-b text-left text-sm font-semibold text-gray-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.key} className="hover:bg-gray-50">
                  <td className="px-6 py-4 border-b text-sm text-gray-900">
                    {file.key}
                  </td>
                  <td className="px-6 py-4 border-b text-sm text-gray-600">
                    {file.size.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 border-b text-sm text-gray-600">
                    {file.contentType}
                  </td>
                  <td className="px-6 py-4 border-b text-sm text-gray-600">
                    {file.downloadCount}
                  </td>
                  <td className="px-6 py-4 border-b text-sm">
                    <a
                      href={`/api/files/${file.key}`}
                      download
                      className="text-blue-600 hover:text-blue-800 underline"
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

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Admin Actions</h2>
        <button
          onClick={async () => {
            try {
              const response = await fetch("/api/admin/files/sync", {
                method: "POST",
              });
              if (!response.ok) {
                throw new Error(`Sync failed: ${response.statusText}`);
              }
              const data = await response.json();
              alert(
                `Sync completed: ${JSON.stringify(data, null, 2)}`,
              );
              globalThis.location.reload();
            } catch (error) {
              alert(`Sync failed: ${String(error)}`);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Sync Files from R2
        </button>
      </div>
    </div>
  );
}
