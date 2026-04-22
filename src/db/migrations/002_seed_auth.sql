INSERT INTO tenants (id, name, slug)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Loja Piloto',
  'loja-piloto'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, tenant_id, name, email, password_hash)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Admin Piloto',
  'admin@piloto.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm'
)
ON CONFLICT (tenant_id, email) DO NOTHING;
