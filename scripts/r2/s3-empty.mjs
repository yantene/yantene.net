/**
 * R2 S3-compatible API helper for listing and deleting all objects in a bucket.
 *
 * Required environment variables:
 *   R2_ACCESS_KEY_ID     - R2 API token access key
 *   R2_SECRET_ACCESS_KEY - R2 API token secret key
 *
 * Usage: node s3-empty.mjs <account_id> <bucket_name>
 */

import { createHash, createHmac } from "node:crypto";

const REGION = "auto";
const SERVICE = "s3";

// --- AWS v4 signing ---

function sha256(data) {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key, data) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function getSignatureKey(secretKey, dateStamp) {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, REGION);
  const kService = hmacSha256(kRegion, SERVICE);
  return hmacSha256(kService, "aws4_request");
}

function buildSignedHeaders({
  method,
  path,
  queryString,
  host,
  body,
  accessKeyId,
  secretAccessKey,
}) {
  const now = new Date();
  const datetime = now.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const date = datetime.slice(0, 8);

  const payloadHash = sha256(body);

  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": datetime,
  };

  if (body && method !== "GET") {
    headers["content-type"] = "application/xml";
  }

  const sortedHeaderKeys = Object.keys(headers).toSorted();
  const signedHeaders = sortedHeaderKeys.join(";");
  const canonicalHeaders =
    sortedHeaderKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";

  const canonicalRequest = [
    method,
    path,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(secretAccessKey, date);
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// --- S3 API operations ---

async function s3Request({ method, path, queryString, host, body, accessKeyId, secretAccessKey }) {
  const headers = buildSignedHeaders({
    method,
    path,
    queryString,
    host,
    body: body ?? "",
    accessKeyId,
    secretAccessKey,
  });

  const url = `https://${host}${path}${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`S3 API error (${response.status}): ${text}`);
  }

  return response.text();
}

function extractXmlValues(xml, tag) {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, "g");
  const values = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1]);
  }
  return values;
}

async function listAllObjects({ host, bucket, accessKeyId, secretAccessKey }) {
  const allKeys = [];
  let continuationToken = null;

  do {
    const params = ["list-type=2", "max-keys=1000"];
    if (continuationToken) {
      params.push(`continuation-token=${encodeURIComponent(continuationToken)}`);
    }

    const xml = await s3Request({
      method: "GET",
      path: `/${bucket}`,
      queryString: params.join("&"),
      host,
      accessKeyId,
      secretAccessKey,
    });

    const keys = extractXmlValues(xml, "Key");
    allKeys.push(...keys);

    const isTruncated = extractXmlValues(xml, "IsTruncated");
    if (isTruncated[0] === "true") {
      const tokens = extractXmlValues(xml, "NextContinuationToken");
      continuationToken = tokens[0] ?? null;
    } else {
      continuationToken = null;
    }
  } while (continuationToken);

  return allKeys;
}

async function deleteObjects({ host, bucket, keys, accessKeyId, secretAccessKey }) {
  // S3 DeleteObjects supports up to 1000 keys per request
  const batchSize = 1000;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const objectsXml = batch
      .map((key) => `<Object><Key>${escapeXml(key)}</Key></Object>`)
      .join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>${objectsXml}</Delete>`;

    const contentMd5 = createHash("md5").update(body).digest("base64");

    const headers = buildSignedHeaders({
      method: "POST",
      path: `/${bucket}`,
      queryString: "delete=",
      host,
      body,
      accessKeyId,
      secretAccessKey,
    });

    const url = `https://${host}/${bucket}?delete=`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "content-md5": contentMd5,
        "content-type": "application/xml",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`S3 DeleteObjects error (${response.status}): ${text}`);
    }

    console.log(`  Deleted batch: ${batch.length} object(s)`);
  }
}

function escapeXml(str) {
  return str
    .replaceAll('&', "&amp;")
    .replaceAll('<', "&lt;")
    .replaceAll('>', "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll('\'', "&apos;");
}

// --- Main ---

async function main() {
  const accountId = process.argv[2];
  const bucketName = process.argv[3];

  if (!accountId || !bucketName) {
    console.error("Usage: node s3-empty.mjs <account_id> <bucket_name>");
    process.exit(1);
  }

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.error("Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set.");
    process.exit(1);
  }

  const host = `${accountId}.r2.cloudflarestorage.com`;

  console.log(`Listing objects in '${bucketName}'...`);
  const keys = await listAllObjects({ host, bucket: bucketName, accessKeyId, secretAccessKey });

  if (keys.length === 0) {
    console.log("Bucket is already empty.");
    return;
  }

  console.log(`Found ${keys.length} object(s). Deleting...`);
  await deleteObjects({ host, bucket: bucketName, keys, accessKeyId, secretAccessKey });
  console.log(`Done: all ${keys.length} object(s) deleted from '${bucketName}'.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
