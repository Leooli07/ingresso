# Plataforma de Ingressos + CRM + Fidelização + ERP

**Especificação técnica consolidada**
Versão 1.0 · Abril 2026

---

## Sumário

1. [Visão do produto](#1-visão-do-produto)
2. [Posicionamento e diferenciais](#2-posicionamento-e-diferenciais)
3. [Stack técnica](#3-stack-técnica)
4. [Arquitetura em camadas](#4-arquitetura-em-camadas)
5. [Multi-tenant e isolamento de dados](#5-multi-tenant-e-isolamento-de-dados)
6. [Modelo de dados](#6-modelo-de-dados)
7. [Fluxo de checkout e pagamento](#7-fluxo-de-checkout-e-pagamento)
8. [Adapters externos](#8-adapters-externos)
9. [Tracking server-side](#9-tracking-server-side)
10. [Módulos funcionais](#10-módulos-funcionais)
11. [Telas prioritárias](#11-telas-prioritárias)
12. [Roadmap de construção](#12-roadmap-de-construção)
13. [Decisões arquiteturais registradas](#13-decisões-arquiteturais-registradas)
14. [Riscos e pontos de atenção](#14-riscos-e-pontos-de-atenção)

---

## 1. Visão do produto

Plataforma web que une em um único produto:

- Venda de ingressos por data e horário, com suporte a múltiplos eventos no mesmo dia e no mesmo horário
- CRM com automação de marketing
- Fidelização com pontos, cashback e resgate
- Comunicação multicanal (WhatsApp, SMS, email, push)
- Operação financeira e gerencial (mini-ERP)
- Páginas white-label por loja ou unidade
- Inteligência geográfica e comportamental

O produto não vende funcionalidades — vende resultados prontos: recuperar clientes inativos, aumentar ticket médio, criar promoções automáticas, estimular recompra, reduzir perda no checkout, melhorar avaliação pós-venda.

### Objetivos centrais

Centralizar vendas. Automatizar processos. Aumentar faturamento. Melhorar a experiência do cliente. Transformar a plataforma em motor de retenção e recompra.

---

## 2. Posicionamento e diferenciais

### O que aproveitar dos grandes portais

Da Sympla, a simplicidade de navegação e descoberta de eventos. Da Eventbrite, a estrutura profissional de gestão e filtros robustos. Da Eventim e Ticketmaster, a robustez para grandes volumes e controle operacional. Da Ingresso.com, a clareza por sessão/data/horário. Dos CRMs modernos, a segmentação inteligente e campanhas prontas.

### Diferenciais competitivos reais

Produto guiado por resultado, não só por configuração. O sistema identifica oportunidades e sugere ações: recuperar inativos, promover horários fracos, aumentar ticket médio, ativar cashback, criar campanhas automáticas.

Fidelidade unificada entre PDV físico e venda online. Clientes compram no balcão via PDVTouch e online no portal — o sistema reconhece a mesma pessoa por CPF, email ou telefone e aplica a mesma régua de pontos e cashback.

Tracking server-side confiável. Enquanto concorrentes perdem 30-40% de atribuição por AdBlock e iOS 17+, esta plataforma mantém mensuração próxima de 100% via Meta CAPI, GA4 Measurement Protocol e Facebook XML feed. Isso vira argumento comercial direto: dados de atribuição mais precisos do mercado.

Inteligência geográfica nativa. Mapa de calor de compras por estado, cidade e bairro, com insights automáticos (ex: cidade com alta conversão e zero mídia investida).

### Frase de produto

> Não é só uma plataforma de ingressos. É uma máquina de vendas, retenção e relacionamento.

---

## 3. Stack técnica

### Frontend

- **Portal público e checkout:** Next.js 14+ com App Router. SEO essencial para descoberta orgânica de eventos. Carregamento rápido em 3G/mobile. Pixel e GA4 client-side funcionam naturalmente.
- **Painel administrativo:** Flutter Web. Interface densa estilo Linear/Attio. Time único trabalhando o app cliente e o painel com o mesmo codebase Dart.
- **App mobile cliente final:** Flutter (iOS + Android). Compartilha código com painel web.
- **App organizador/PDV:** Flutter. Validação de QR offline-first.

### Backend

- **Runtime:** Node.js 20+ com TypeScript
- **Framework:** Fastify
- **Arquitetura:** hexagonal (ports and adapters), monolito modular
- **ORM:** Drizzle ORM com migrations versionadas
- **Validação:** Zod em todas as fronteiras

### Dados

- **Banco principal:** PostgreSQL 16 com Row Level Security ativo
- **Cache e locks:** Redis 7 (reserva temporária com TTL, cache de leitura, idempotência)
- **Filas:** BullMQ sobre Redis
- **Armazenamento de arquivos:** S3-compatível (assets, QR codes, relatórios)

### Infraestrutura

- **Observabilidade:** OpenTelemetry, logs estruturados, Sentry, métricas Prometheus
- **CI/CD:** GitHub Actions com deploy por branch
- **Monorepo:** Turborepo

---

## 4. Arquitetura em camadas

### Visão geral

```
┌─────────────────────────────────────────────────────────┐
│ Camada de clientes                                      │
│  Next.js portal · Flutter painel · Flutter app          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│ API Gateway Fastify                                     │
│  Resolução de tenant · rate limit · JWT · CORS          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│ Core de domínio (hexagonal)                             │
│  Ticketing · CRM · Loyalty · Orders · Campaigns         │
│  Finance · Analytics · Geo · Tenancy                    │
└─────┬─────────────────┬──────────────────┬──────────────┘
      │                 │                  │
┌─────▼─────┐   ┌───────▼───────┐   ┌─────▼──────┐
│ Postgres  │   │ Redis         │   │ S3 + CDN   │
│ (RLS)     │   │ (lock, cache) │   │            │
└───────────┘   └───────┬───────┘   └────────────┘
                        │
                 ┌──────▼──────┐
                 │ BullMQ      │
                 │ workers     │
                 └──────┬──────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ Adapters externos                                       │
│  PDVTouch · UPSystem · Gateways · WhatsApp · CAPI · GA4 │
└─────────────────────────────────────────────────────────┘
```

### Princípios

O domínio não conhece fornecedores. Cada integração externa (PDV, gateway de pagamento, mensageria, tracking) vive atrás de uma interface de domínio chamada *port*. O adapter implementa a interface. Nenhum código de domínio importa biblioteca de fornecedor.

Regra de lint obrigatória: arquivos em `src/domain/` não podem importar nada de `src/adapters/`. PR que viola isso é rejeitado.

### Camada de adapters

Contratos padronizados para toda integração:

- `ProviderAdapter` — operações síncronas contra fornecedor
- `WebhookAdapter` — recebe notificações externas
- `ImportAdapter` — importação em lote, incremental ou completa
- `ExportAdapter` — envio de dados para fornecedor
- `TrackingAdapter` — eventos de mensuração

Cada adapter implementa as portas de domínio que fazem sentido para seu caso de uso.

---

## 5. Multi-tenant e isolamento de dados

### Modelo escolhido

Schema único com `tenant_id` em todas as tabelas raiz, protegido por Row Level Security do PostgreSQL.

### Justificativa

Para perfil de 100 a 1000 lojas médias com volume conjunto de 10 a 100 mil ingressos por mês, schema-per-tenant cria problema operacional (migrations multiplicadas, limite de conexões, backup complexo). Database-per-tenant só se justifica em enterprise com dados críticos.

Schema único com RLS oferece isolamento em nível de banco — mesmo se o código da aplicação tiver bug, o banco recusa a query cruzando tenants.

### Implementação

Toda request resolve o tenant via subdomínio (`loja1.seusistema.com.br`) ou rota (`/loja/slug`). O gateway extrai o tenant e injeta como claim no JWT. Middleware do backend executa `SET LOCAL app.tenant_id = '...'` a cada transação. Policies do Postgres filtram automaticamente:

```sql
CREATE POLICY tenant_isolation ON pedidos
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Toda tabela raiz (loja, cliente, evento, pedido, cupom, campanha) carrega `tenant_id` direto. Tabelas filhas herdam o tenant do agregado pai.

---

## 6. Modelo de dados

### Entidades centrais

```
TENANT ──< LOJA ──< EVENTO ──< SESSAO ──< LOTE ──< INGRESSO
                                                      │
CLIENTE ──< PEDIDO ──< INGRESSO                       │
        │         │                                    │
        │         └── PAGAMENTO (1:1)                  │
        │                                              │
        ├── CARTEIRA ──< LANCAMENTO                   │
        ├── FIDELIDADE                                 │
        └── CUSTOMER_IDENTITIES (PDV, email, telefone)

PEDIDO }o──o{ CUPOM
CAMPANHA ──< ENVIO >── CLIENTE
OUTBOX (event sourcing leve)
```

### Regras críticas

**Estoque vive no Lote, não no Evento nem na Sessão.** Isso é o que permite múltiplos eventos no mesmo dia e mesmo horário sem conflito — dois eventos diferentes podem ter sessões em `inicia_em = 2026-05-16 21:00` porque o estoque é contado por lote dentro de cada sessão.

**Cliente pertence ao Tenant, não à Loja.** Um cliente que compra no PDVTouch (importado via adapter) e compra no portal online é o mesmo cliente, casado por CPF/email/telefone. A carteira acumula saldo das duas origens.

**Múltiplas identidades externas por cliente.** A tabela `customer_identities` permite rastrear `external_id` no PDVTouch, UPSystem e outros sistemas externos. Evita duplicatas e permite reconciliação.

**Outbox como tabela.** Toda operação crítica (pagamento confirmado, ingresso emitido, cliente cadastrado) grava uma linha em `outbox` na mesma transação do domínio. Worker lê e publica em filas BullMQ.

### Tabelas principais

**`tenants`** — slug, config JSON com identidade visual e regras.

**`lojas`** — pertence a tenant, slug próprio, branding.

**`customers`** — `tenant_id`, email, telefone, cpf, dados de perfil.

**`customer_identities`** — `customer_id`, `source` ('pdvtouch', 'upsystem', 'online'), `external_id`. Permite múltiplos registros por customer.

**`eventos`** — `loja_id`, nome, categoria, capa, status.

**`sessoes`** — `evento_id`, `inicia_em` (timestamp com timezone), capacidade total, local.

**`lotes`** — `sessao_id`, nome, `preco`, `estoque`, `vendidos`. Estoque real é duplicado no Redis para lock atômico.

**`ingressos`** — `lote_id`, `pedido_id`, `qr_code` único, `status` (emitido, usado, cancelado).

**`pedidos`** — `customer_id`, `total`, `status` (reserved, paid, expired, cancelled), `reservado_ate`, `tracking_context` (JSONB com fbp, fbc, ga_client_id, utm, user_agent, ip).

**`pagamentos`** — `pedido_id`, gateway, `payment_id` externo, status, `payload` bruto.

**`cupons`** — tenant_id, código, tipo (fixo/percentual), regras.

**`carteiras`** — `customer_id`, `saldo_cashback`, `saldo_pontos`, saldos separados por origem.

**`lancamentos`** — `carteira_id`, valor, origem ('pdvtouch', 'online', 'campanha', 'resgate', 'sync').

**`campanhas`** — tenant_id, gatilho, filtro JSON de público.

**`envios`** — `campanha_id`, `customer_id`, canal, status.

**`outbox`** — topic, payload JSON, publicado_em (null = pendente).

**`events`** (log de tracking) — auditoria completa de eventos disparados, alimenta BI e mapa geográfico.

---

## 7. Fluxo de checkout e pagamento

### Decisões

Pagamento aceito: **Pix e cartão apenas**. Boleto fica fora — simplifica operação, reduz abandono, não prende estoque.

TTL de reserva: **10 minutos fixo**, uniforme entre tenants.

### Fase 1 — Reserva temporária

Cliente seleciona lote. Backend chama Lua script no Redis que decrementa contador de estoque atomicamente. Se resultado for negativo, retorna 409. Se positivo, cria pedido no Postgres com `status = 'reserved'` e `reservado_ate = now() + 10 minutes`.

```lua
-- KEYS[1] = lote:{id}:estoque, ARGV[1] = quantidade
local atual = tonumber(redis.call('GET', KEYS[1]) or '0')
if atual < tonumber(ARGV[1]) then return -1 end
return redis.call('DECRBY', KEYS[1], ARGV[1])
```

### Fase 2 — Pagamento

Backend cria intent no gateway (Mercado Pago, Asaas ou outro) e devolve QR Pix ou form de cartão. Frontend entra em polling ou WebSocket para receber confirmação. Nenhuma venda é considerada fechada nessa fase — a fonte da verdade é o webhook.

### Fase 3 — Webhook

Gateway notifica via `POST /webhooks/payment/:gateway`. Handler:

1. Valida assinatura HMAC → 401 se falhar
2. Extrai `payment_id` do body
3. `SETNX webhook:{gateway}:{payment_id}` com TTL 24h. Se retorna 0, já foi processado → 200 e sai
4. Transação atômica:
   - `UPDATE pedido SET status='paid' WHERE id=? AND status='reserved'` → se affected rows = 0, sai
   - `INSERT INTO ingressos` para cada item
   - `INSERT INTO outbox (topic='pedido.pago', payload=...)`
5. Commit, retorna 200

**Requisito crítico:** webhook responde em menos de 3 segundos. Processamento pesado (PDF, WhatsApp, CAPI) vai para workers via outbox.

### Fase 4 — Efeitos assíncronos via outbox

Worker lê outbox e dispara em paralelo:

- Gerar QR code + PDF, upload S3
- Enviar WhatsApp, email, push
- Tracking server-side (Meta CAPI, GA4 MP)
- Creditar pontos de fidelidade
- Sincronizar com PDVTouch se aplicável

Cada worker retenta independentemente com backoff. Nada se perde.

### Job de expiração

Worker cron roda a cada 60 segundos:

```sql
SELECT id FROM pedidos
WHERE status='reserved' AND reservado_ate < now()
FOR UPDATE SKIP LOCKED
LIMIT 100
```

Para cada pedido: `UPDATE status='expired'`, `INCRBY` no Redis devolvendo estoque, `INSERT INTO outbox`.

---

## 8. Adapters externos

### Regra fundamental

O domínio conhece apenas interfaces. Exemplo para PDVTouch:

```typescript
// domain/ports/CustomerImportPort.ts
export interface CustomerImportPort {
  importSince(tenantId: string, since: Date): AsyncIterable<DomainCustomer>;
}

// adapters/secondary/pdv/pdvtouch/PDVTouchCustomerAdapter.ts
export class PDVTouchCustomerAdapter implements CustomerImportPort {
  async *importSince(tenantId: string, since: Date) {
    // ... implementação específica do PDVTouch
  }
}
```

### Portas necessárias para adapters de PDV

- `CustomerImportPort` — importação incremental de clientes
- `SalesImportPort` — importação de vendas presenciais
- `WalletSyncPort` — sincronização de saldo bidirecional
- `OrderPushPort` — envio de pedidos online para o PDV

### Anatomia de um adapter

Cada adapter tem estrutura padrão:

```
adapters/secondary/pdv/pdvtouch/
  PDVTouchCustomerAdapter.ts   → implementa CustomerImportPort
  PDVTouchSalesAdapter.ts      → implementa SalesImportPort
  PDVTouchWalletAdapter.ts     → implementa WalletSyncPort
  PDVTouchOrderAdapter.ts      → implementa OrderPushPort
  PDVTouchHttpClient.ts        → retry, circuit breaker, timeout
  PDVTouchMapper.ts            → traduz DTOs externos em entidades
  types.ts                     → DTOs do fornecedor, nunca vazam
```

### Reconciliação de identidade

Ao importar cliente do PDV, o adapter resolve identidade pelo CPF, email ou telefone (nessa ordem). Se encontrar cliente existente, faz merge (preenche campos vazios, mantém os preenchidos) e adiciona uma identidade em `customer_identities` com `source='pdvtouch'`. Se não encontrar, cria novo.

### Reconciliação contábil diária

Job diário compara total de vendas consolidadas no PDV com total processado no sistema. Divergências acima de limite configurável (normalmente alguns centavos para arredondamento de cashback) vão para dashboard de alerta.

### Boas práticas aprendidas

Não sincronizar durante horário de pico do cliente (sexta e sábado à noite). O PDV está ocupado e latência extra gera fila no caixa. Agendar pesado para madrugada.

Fuso horário sempre explícito. PDV local pode gravar em horário de servidor diferente. Normalizar antes de persistir.

Toda operação tem `integration_log` com request e response. Permite debug posterior e auditoria.

---

## 9. Tracking server-side

### Arquitetura dual

**Client-side** (GTM + gtag + Pixel no browser): captura PageView, ViewContent, AddToCart, InitiateCheckout. Perde 30-40% por AdBlock/ITP.

**Server-side** (worker lendo outbox): captura 100% das conversões de fundo de funil. Passa obrigatoriamente pelo backend.

Ambos compartilham o mesmo `event_id`. Plataformas de tracking (Meta, Google) deduplicam mantendo prioritariamente o server-side quando dados batem.

### dataLayer padronizado

Contrato único de todos os eventos. Frontend e backend usam o mesmo schema.

```typescript
type TrackingEvent = {
  event_name: 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase' | ...
  event_id: string              // UUID, usado para dedupe
  event_time: string            // ISO 8601 com timezone

  tenant_id: string
  loja_id: string

  evento_id?: string
  sessao_id?: string
  cidade_evento?: string
  estado_evento?: string

  items?: Array<{ lote_id, lote_nome, preco, quantidade }>
  valor?: number
  moeda?: 'BRL'
  cupom?: string
  metodo_pagamento?: 'pix' | 'cartao'

  origem_trafego?: string
  canal?: string
  utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?

  cliente_id?: string           // UUID interno
  email_hash?: string           // sha256
  telefone_hash?: string        // sha256 E.164
  cpf_hash?: string             // sha256

  client_id?: string            // GA4 cid do cookie _ga
  fbp?: string                  // Facebook browser id
  fbc?: string                  // Facebook click id
  user_agent?: string
  ip?: string
}
```

### Mapeamento de eventos

| Momento | dataLayer | GA4 | Meta | Disparo |
|---|---|---|---|---|
| Home, busca | `page_view` | `page_view` | `PageView` | Client |
| Página do evento | `view_item` | `view_item` | `ViewContent` | Client |
| Seleção de sessão | `select_item` | `select_item` | `Search` | Client |
| Adicionou carrinho | `add_to_cart` | `add_to_cart` | `AddToCart` | Client |
| Abriu checkout | `begin_checkout` | `begin_checkout` | `InitiateCheckout` | Client |
| Pagamento confirmado | `purchase` | `purchase` | `Purchase` | **Server + Client** |
| Reembolso | `refund` | `refund` | `Purchase` negativo | Server |
| Cadastro | `sign_up` | `sign_up` | `CompleteRegistration` | Server |
| Reativação | `reactivation` | custom | custom | Server |
| Checkout recuperado | `checkout_recovered` | custom | custom | Server |

Os eventos customizados (reactivation, checkout_recovered) alimentam o Meta e Google com sinais de qualidade que competidores não enviam. Permitem criar audiências lookalike de alta qualidade.

### Propagação de tracking no checkout

Frontend Next.js lê cookies do browser (`_ga`, `_fbp`, `_fbc`), parseia UTM da URL, envia no body do POST de reserva. Backend persiste em `pedido.tracking_context` (JSONB). Quando webhook de pagamento chega, worker server-side usa esses IDs para disparar Purchase com match quality alto.

### Facebook XML feed

Endpoint público `/feeds/facebook/{tenant_slug}.xml` gera catálogo dinâmico de eventos ativos. Tenant configura no Meta Business Manager e roda campanhas de catálogo com retargeting automático por evento visualizado. Cache de 15 minutos invalidado quando evento muda.

### Match quality

Meta exibe score 0-10 de qualidade de identificação. Meta do produto: acima de 7. Consegue-se enviando múltiplos identificadores hasheados: email + telefone + cpf + fbp + client_id + ip + user_agent.

### LGPD e consentimento

Cookie banner grava consentimento em `_consent=analytics:1,marketing:0`. Flag propagada no tracking context. Se `marketing=0`, worker pula Meta CAPI e TikTok mas mantém GA4 (analytics legítimo). Decisão final deve ser validada por consultoria jurídica específica do perfil do cliente.

---

## 10. Módulos funcionais

### 10.1 Portal de vendas

Venda por evento, data e horário. Múltiplos eventos no mesmo horário. Lotes independentes por sessão. Combos e adicionais. Reserva temporária de 10 minutos. Check-in via QR Code. Lista de espera.

### 10.2 CRM de clientes

Identidade unificada entre PDV e online. Histórico consolidado. Segmentações nativas: aniversariantes, inativos, primeira compra, VIP, alto ticket, abandono de carrinho, baixa avaliação, alto potencial de recompra.

### 10.3 Fidelização

Programa de pontos configurável por tenant. Cashback com regras por categoria e campanha. Carteira com saldo rastreável por origem. Resgate automático no checkout. Tiers (bronze/prata/ouro) com progressão. Validade configurável.

### 10.4 Cupons e promoções

Fixo, percentual, primeira compra, aniversário, recuperação. Links rastreáveis com UTM. Promoções por horário e lote. Combos promocionais.

### 10.5 Automação e campanhas

Gatilhos: aniversário, pós-venda, abandono de checkout, cliente inativo, primeira compra, segunda compra incentivada, mudança de tier, data especial.

Cada automação permite: filtro de público, mensagem personalizada, horário de envio, canal preferencial, condição de saída.

### 10.6 Comunicação multicanal

WhatsApp via Meta Cloud API ou provedor homologado. SMS. Email via SendGrid/Resend/SES. Push via Firebase. Robô WhatsApp respondendo saldo, reenvio de ingresso, link de pagamento, dúvidas frequentes.

### 10.7 Financeiro

Caixa com abertura, fechamento, sangria, transferência. Contas e carteiras. Conciliação automática de gateway. Créditos e fiado. Split de pagamento entre organizador, casa e plataforma. Relatórios financeiros.

### 10.8 Analytics e BI

KPIs do dia: faturamento, ingressos, ticket médio, conversão, abandono. Recompra e recorrência. Receita por canal e campanha. ROI. NPS e avaliações. CMV, margem, simulação de lucro, previsão de faturamento, meta do dia. Ranking de clientes, eventos, horários.

### 10.9 Avaliação e pós-venda

Pesquisa automática após check-in. Nota baixa → atendimento interno. Nota alta → direcionar para Google ou depoimento público. Protege reputação pública, gera melhoria contínua, cria gatilhos de recuperação.

### 10.10 Inteligência geográfica

Enriquecimento de pedidos com CEP, IP, endereço do cliente. Mapa interativo por estado, cidade, bairro. Filtros por evento, sessão, período, campanha. Insight engine detectando oportunidades (cidade com alta conversão sem mídia investida, bairro com ticket médio alto, etc).

---

## 11. Telas prioritárias

### MVP (Fase 1)

1. **Home / marketplace** — descoberta de eventos
2. **Página do evento** — seleção de sessão, horário e lote
3. **Checkout** — pagamento Pix/cartão em página única
4. **Meus ingressos** — área do cliente
5. **Dashboard admin** — métricas e sugestões de ação
6. **Gestão de eventos e sessões** — CRUD com múltiplas sessões por evento
7. **Pedidos** — listagem e detalhe
8. **Clientes** — ficha consolidada com histórico unificado
9. **Cupons** — criação e gestão

### Fase 2

10. **Fidelidade** — regras, tiers, carteira
11. **Campanhas automáticas** — jornadas e gatilhos
12. **Comunicação** — templates e histórico
13. **Painel de integrações** — status, métricas, erros

### Fase 3

14. **Mapa geográfico** — heatmap interativo com insights
15. **BI avançado** — KPIs, metas, simulações
16. **Financeiro completo** — caixa, conciliação, split

### Princípios de design

Densa e profissional no painel admin (estilo Linear, Attio). Leve e conversiva no portal público (estilo Sympla moderno). Identidade visual neutra por padrão, accent color configurável por tenant.

Card de "Oportunidade agora" ou "Sugestões para hoje" presente em dashboard e ficha de cliente — sistema identifica ação e oferece execução com um clique.

---

## 12. Roadmap de construção

Três fases com sprints quinzenais de esforço relativo. Time recomendado: 2 devs fullstack pleno/sênior + 1 Flutter dedicado a partir da Fase 2 + designer part-time + PM/tech lead.

### Fase 1 — Base transacional · 8 a 10 sprints

Objetivo: sistema vendável. Piloto com tenant real pode começar.

- **Sprint 1-2** — Fundação: monorepo, Postgres com RLS, Redis, auth multi-tenant, CI/CD
- **Sprint 3-4** — Eventos e sessões: CRUD, estoque por lote, lock atômico Redis
- **Sprint 5-6** — Checkout: reserva temporária, adapter de gateway, webhook com HMAC e idempotência, outbox, worker de expiração
- **Sprint 7-8** — Ingresso: QR, PDF, check-in, app Flutter do validador offline-first
- **Sprint 9-10** — Painel admin básico e portal público Next.js com SEO

### Fase 2 — Motor de crescimento · 8 a 10 sprints

Objetivo: produto deixa de ser commodity de venda e vira plataforma de retenção.

- **Sprint 11-12** — CRM unificado com resolução de identidade e import/export CSV
- **Sprint 13-14** — Fidelidade: pontos, cashback, carteira, tiers
- **Sprint 15** — Cupons e promoções com motor de regras
- **Sprint 16-17** — Tracking server-side: Meta CAPI, GA4 MP, Facebook XML feed, painel de integrações
- **Sprint 18** — Motor de automação com gatilhos e jornadas
- **Sprint 19-20** — WhatsApp, email, push, robô básico

### Fase 3 — Inteligência e ERP · 6 a 8 sprints

Objetivo: blindar contra concorrência, fechar contrato enterprise.

- **Sprint 21-22** — Adapters PDVTouch e UPSystem completos com reconciliação
- **Sprint 23-24** — Mapa geográfico, BI avançado, insight engine
- **Sprint 25-26** — Financeiro completo: caixa, conciliação, split, relatórios fiscais

### Ajuste de cronograma por tamanho de time

- 1 dev fullstack + 1 apoio: multiplica por 1.6
- 2 devs bem alocados (baseline acima): cronograma conforme
- 4 devs: reduz até 30%, acima disso vira overhead de coordenação

### Decisões prévias a cada fase

**Antes da Fase 1:** escolher gateway de pagamento, hospedagem, nome e domínio.

**Antes da Fase 2:** escolher provedor de WhatsApp (custo por mensagem varia 10× entre opções), email, negociar conta Meta Business com acesso a CAPI.

**Antes da Fase 3:** confirmar que tenants-piloto usam PDVTouch ou UPSystem em operação. Se não, a fase pode ser repriorizada.

---

## 13. Decisões arquiteturais registradas

Este bloco registra as decisões que, se revertidas depois, causam retrabalho significativo.

**ADR-001: Frontend dividido.** Next.js no portal público e checkout, Flutter no painel admin e apps mobile. Motivo: SEO do portal é crítico para captação orgânica de tráfego; painel admin não precisa de SEO; time único em Dart reaproveita código entre web admin e mobile.

**ADR-002: Backend monolito modular em Fastify.** Volume projetado (10-100k ingressos/mês) não justifica microsserviços. Arquitetura hexagonal permite extrair módulos no futuro sem reescrita.

**ADR-003: Multi-tenant via schema único com RLS.** Perfil de 100-1000 lojas médias. Schema-per-tenant multiplica operação. RLS dá isolamento em nível de banco.

**ADR-004: Reserva temporária com Redis.** Lock atômico via Lua script, TTL 10 minutos. Postgres como fonte da verdade final.

**ADR-005: Pix e cartão apenas.** Boleto fora por complexidade operacional e abandono alto.

**ADR-006: Outbox pattern para eventos de domínio.** Garante consistência entre transação e efeitos assíncronos.

**ADR-007: Idempotência obrigatória em toda escrita pública.** Webhook, endpoints mobile, callbacks de PDV. Padrão: header `Idempotency-Key` + Redis SETNX.

**ADR-008: Tracking server-side como pilar.** Meta CAPI + GA4 MP duplicando client-side com mesmo `event_id`. Diferencial comercial direto contra concorrentes.

**ADR-009: Tabela `customer_identities` para múltiplas origens.** Evita duplicatas entre PDV e online, permite fidelidade unificada.

**ADR-010: Lint rule impedindo `domain/` importar `adapters/`.** Protege arquitetura hexagonal ao longo dos anos.

---

## 14. Riscos e pontos de atenção

### Técnicos

**Concorrência no estoque em lançamentos.** Implementação ingênua corrompe. A solução com Lua script no Redis é eficiente, mas precisa ser testada sob carga real antes de produção (testes de carga simulando 500 requests simultâneos no mesmo lote).

**Webhook de pagamento.** Documentação de gateway mente. Sandbox se comporta diferente de produção. Webhooks chegam em ordem inesperada, duplicados, atrasados. Reservar margem em sprints de pagamento.

**Adapters de PDV brasileiro.** PDVTouch e UPSystem não têm documentação pública completa. Primeira integração pode demandar reuniões com fornecedor, acesso a ambiente de teste, ajustes de mapeamento. Sprints 21-22 são conservadores por isso.

**Match quality do Meta CAPI.** Abaixo de 7 significa que audiências lookalike não funcionam bem. Enviar múltiplos identificadores hasheados desde o primeiro dia para garantir qualidade.

### De produto

**LGPD.** Tracking server-side não dá passe livre. Cookie banner precisa refletir opção do cliente e ser propagado. Validação jurídica específica por perfil de cliente é necessária.

**Chargeback em cartão.** Webhook pode confirmar, cliente pode contestar depois. Fluxo de reembolso precisa estornar pontos de fidelidade já creditados e invalidar ingresso se ainda não usado.

**Reconciliação com PDV.** Divergências entre sistemas são inevitáveis. Job diário com alerta é obrigatório — sem ele, problema fica invisível até cliente reclamar.

### Comerciais

**Piloto antes de escalar.** Fase 1 completa com 1-2 tenants pilotos é mais valioso que Fase 2 imaginada. Feedback real de operação muda prioridades.

**Preço de WhatsApp.** Custo por conversa varia 10× entre provedores. Negociar antes de Fase 2 para não ter surpresa no unit economics.

**Conta Meta Business com CAPI.** Aprovação pode demorar. Iniciar processo assim que Fase 1 estiver próxima do fim.

---

## Apêndice — Referências

- Documento original de visão do produto (2026)
- Conversação de design arquitetural (Abril 2026)
- Decisões registradas em ADR individuais (versionadas no repositório)

---

*Fim do documento.*
