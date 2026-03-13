-- pg_trgm 확장 활성화 (ILIKE '%검색어%' 패턴에 GIN 인덱스 활용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 리드 검색 성능 개선: name, phone 컬럼에 trigram GIN 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING gin (phone gin_trgm_ops);
