import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Counter from "./counter";

function mockFetchResponse(data: unknown, isOk = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: isOk,
      json: () => Promise.resolve(data),
    }),
  );
}

describe("Counter Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should show loading state initially", () => {
    mockFetchResponse({ count: 0 });
    render(<Counter />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should display count after successful fetch", async () => {
    mockFetchResponse({ count: 42 });
    render(<Counter />);

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("should display error message when initial fetch fails", async () => {
    mockFetchResponse({ error: "Failed" }, false);
    render(<Counter />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch counter")).toBeInTheDocument();
    });
  });

  it("should show retry button on error", async () => {
    mockFetchResponse({ error: "Failed" }, false);
    render(<Counter />);

    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });

  it("should call POST /api/counter/increment on button click", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 0 }),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 1 }),
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<Counter />);

    await waitFor(() => {
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /increment/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/counter/increment", {
      method: "POST",
    });
  });

  it("should display error message when increment fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 5 }),
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<Counter />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /increment/i });
    await user.click(button);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to increment counter"),
      ).toBeInTheDocument();
    });
  });

  it("should retry fetching count when retry button is clicked", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Failed" }),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 10 }),
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<Counter />);

    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });
});
