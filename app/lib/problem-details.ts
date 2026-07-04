import { httpStatus } from "~/lib/constants/http-status";

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
}

export function createProblemResponse(
  status: number,
  title: string,
  detail?: string,
): Response {
  const body: ProblemDetails = {
    type: "about:blank",
    title,
    status,
    ...(detail !== undefined && { detail }),
  };
  return Response.json(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

export function badRequestResponse(detail?: string): Response {
  return createProblemResponse(httpStatus.BAD_REQUEST, "Bad Request", detail);
}

export function unauthorizedResponse(detail?: string): Response {
  return createProblemResponse(httpStatus.UNAUTHORIZED, "Unauthorized", detail);
}

export function notFoundResponse(detail?: string): Response {
  return createProblemResponse(httpStatus.NOT_FOUND, "Not Found", detail);
}

export function internalServerErrorResponse(detail?: string): Response {
  return createProblemResponse(
    httpStatus.INTERNAL_SERVER_ERROR,
    "Internal Server Error",
    detail,
  );
}
