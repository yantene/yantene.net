import { useCallback, useEffect, useState } from "react";
import type { Route } from "./+types/counter";
import type { CounterResponse } from "~/lib/types/counter";

export function meta(_args: Route.MetaArgs): ReturnType<Route.MetaFunction> {
  return [
    { title: "Counter Demo" },
    { name: "description", content: "Cloudflare D1 + Drizzle counter demo" },
  ];
}

export default function Counter(): React.JSX.Element {
  const [count, setCount] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCount = useCallback((): void => {
    setIsInitialLoading(true);
    setErrorMessage(null);

    void (async (): Promise<void> => {
      try {
        const response = await fetch("/api/counter");

        if (!response.ok) {
          throw new Error("Failed to fetch counter");
        }

        const data: CounterResponse = await response.json();
        setCount(data.count);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unknown error occurred",
        );
      } finally {
        setIsInitialLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const handleIncrement = (): void => {
    setIsLoading(true);
    setErrorMessage(null);

    void (async (): Promise<void> => {
      try {
        const response = await fetch("/api/counter/increment", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to increment counter");
        }

        const data: CounterResponse = await response.json();
        setCount(data.count);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unknown error occurred",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  };

  if (isInitialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <h1 className="mb-4 text-2xl font-bold">Click Counter</h1>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-4 text-2xl font-bold">Click Counter</h1>
        <p className="mb-4 text-4xl font-bold text-blue-600">
          {count === null ? "..." : count}
        </p>
        <button
          onClick={handleIncrement}
          disabled={isLoading}
          className="rounded bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:bg-gray-300"
        >
          {isLoading ? "Loading..." : "Increment"}
        </button>
        {errorMessage && (
          <div className="mt-4">
            <p className="text-red-500">{errorMessage}</p>
            <button
              onClick={fetchCount}
              className="mt-2 rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
