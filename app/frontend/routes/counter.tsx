import { useEffect, useState } from "react";
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
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
      }
    })();
  }, []);

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
        {errorMessage !== null && errorMessage !== "" && (
          <p className="mt-4 text-red-500">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
