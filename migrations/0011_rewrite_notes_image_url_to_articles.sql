-- 記事のアセット API を /api/v1/notes/<slug>/assets/ から /api/v1/articles/<slug>/assets/ へ
-- 移した (ADR 0032)。カバー画像の URL は refresh のときに解決済みの形で D1 に入っている
-- ので、接頭辞だけを書き換える。本文 (R2 の MDAST) に埋まった同じ URL は SQL では
-- 直せないため、デプロイ後に force refresh を流すこと (product.md)。
--
-- 後方互換: 旧コードの ImageUrl はルート相対かどうかしか見ないので、この列を先に
-- 書き換えても旧コードは落ちない (environments.md の 2 段リリースは要らない)。
UPDATE `notes`
SET `image_url` = '/api/v1/articles/' || substr(`image_url`, length('/api/v1/notes/') + 1)
WHERE `image_url` LIKE '/api/v1/notes/%';
