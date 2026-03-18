# Digital Bank

Backend bancario construido con NestJS, GraphQL y PostgreSQL para manejar clientes, cuentas, tasas de cambio y transacciones financieras con foco en consistencia, concurrencia e idempotencia.

El proyecto está diseñado como una prueba técnica senior: prioriza decisiones defendibles de arquitectura antes que volumen de features. PostgreSQL es la fuente de verdad operativa; Redis se usa como optimización de lectura; Elasticsearch se usa como índice de búsqueda.

## Qué Resuelve

- gestión de clientes
- gestión de cuentas bancarias
- depósitos
- retiros
- transferencias
- transferencias multi-moneda con tasa vigente
- búsqueda en Elasticsearch
- health checks de PostgreSQL, Redis y Elasticsearch

El API principal es GraphQL. El esquema generado se escribe automáticamente en `src/schema.gql`.

## Stack

- NestJS
- GraphQL con Apollo
- TypeORM
- PostgreSQL
- Redis
- Elasticsearch
- `decimal.js` para cálculos monetarios
- `@nestjs/terminus` para health checks

## Arquitectura

La solución sigue una arquitectura modular DDD-light con separación explícita por capas:

```text
src/
  common/        # infraestructura y utilidades compartidas
  config/        # configuración de base de datos
  migrations/    # migraciones TypeORM
  modules/
    clients/
    accounts/
    transactions/
    exchange-rates/
    search/
```

Cada módulo se organiza así:

```text
src/modules/<module>/
  domain/         # entidades, tipos y contratos
  application/    # casos de uso y coordinación
  infrastructure/ # repositorios, ORM, adaptadores externos
  presentation/   # resolvers GraphQL e inputs/models
```

### Responsabilidad por capa

| Capa             | Responsabilidad                                                    |
| ---------------- | ------------------------------------------------------------------ |
| `domain`         | invariantes del negocio, entidades y contratos                     |
| `application`    | coordinación de flujos, orquestación y validaciones de caso de uso |
| `infrastructure` | persistencia, locking, Redis, Elasticsearch                        |
| `presentation`   | contrato GraphQL                                                   |

### Módulos principales

- `clients`: alta y consulta de clientes
- `accounts`: alta y consulta de cuentas
- `transactions`: depósitos, retiros, transferencias e idempotencia
- `exchange-rates`: versionado y consulta de tasas vigentes
- `search`: creación de índices, mappings e implementación de búsquedas en Elastic

## Modelo de Dominio

### Client

- `id`
- `firstName`
- `lastName`
- `email`
- `documentNumber`
- `createdAt`
- `updatedAt`

Reglas:

- `email` único
- `documentNumber` único

### Account

- `id`
- `accountNumber`
- `clientId`
- `currency`
- `balance`
- `status`
- `createdAt`
- `updatedAt`

Estados:

- `ACTIVE`
- `BLOCKED`
- `INACTIVE`

Reglas:

- la cuenta pertenece a un cliente existente
- `accountNumber` es único
- no se puede operar sobre cuentas bloqueadas o inactivas
- los balances se modifican únicamente dentro de operaciones financieras

### Transaction

- `id`
- `type`
- `sourceAccountId`
- `destinationAccountId`
- `sourceCurrency`
- `destinationCurrency`
- `sourceAmount`
- `destinationAmount`
- `exchangeRateUsed`
- `idempotencyKey`
- `description`
- `createdAt`

Tipos:

- `DEPOSIT`
- `WITHDRAWAL`
- `TRANSFER`

### Exchange Rate

- `id`
- `baseCurrency`
- `targetCurrency`
- `rate`
- `effectiveAt`
- `createdAt`

## Decisiones Técnicas Clave

### PostgreSQL Como Fuente de Verdad

Toda decisión financiera sale de PostgreSQL, no de Redis ni de Elasticsearch.

Eso incluye:

- validación de saldo
- balance final de cuenta
- persistencia de transacciones
- idempotencia efectiva
- control de concurrencia

Redis y Elasticsearch son auxiliares. Si quedan desfasados temporalmente, no comprometen la integridad financiera.

### Concurrencia y Control de Deadlocks

Las operaciones financieras corren dentro de transacciones de base de datos. Para evitar carreras y reducir deadlocks:

- las cuentas involucradas se bloquean con `pessimistic_write`
- los ids de cuenta se normalizan y bloquean en orden estable
- las validaciones de saldo ocurren con los registros ya bloqueados

El locking se aplica desde el transaction manager de infraestructura, no desde GraphQL ni desde el resolver.

### Idempotencia

`deposit`, `withdraw` y `transfer` aceptan `idempotencyKey`.

La estrategia implementada es:

- buscar una transacción previa de igual `type` e `idempotencyKey`
- si existe, validar que el payload sea compatible
- si coincide, devolver la transacción existente
- si no coincide, rechazar con error de reutilización indebida
- si dos requests compiten, la unicidad en base de datos resuelve la carrera

Además, la unicidad se maneja por combinación `type + idempotencyKey`, no por `idempotencyKey` global, lo que permite semántica más precisa por tipo de operación.

### Precisión Monetaria

Los montos y tasas usan `decimal.js`.

Escalas relevantes:

- montos: `numeric(18,2)`
- tasas: `numeric(18,6)`

El redondeo usa `ROUND_HALF_EVEN`, apropiado para contexto financiero.

### Transacciones Inmutables

Las transacciones financieras son append-only:

- se crean una vez
- no se editan
- no se eliminan

Esto mantiene trazabilidad y evita mutaciones históricas sobre el ledger transaccional.

## Flujo de Transferencias Multi-Moneda

Una transferencia entre monedas distintas sigue este flujo:

1. se abre una transacción de base de datos
2. se bloquean ambas cuentas con `pessimistic_write`
3. se valida que la cuenta origen pueda enviar y tenga fondos suficientes
4. se consulta la tasa vigente para `sourceCurrency -> destinationCurrency`
5. se debita el monto original de la cuenta origen
6. se calcula el monto destino usando la tasa vigente
7. se acredita el monto convertido en la cuenta destino
8. se persiste una transacción con:
   - `sourceAmount`
   - `destinationAmount`
   - `exchangeRateUsed`
9. se hace commit
10. se invalidan cachés y se actualiza el índice de búsqueda

Si las monedas coinciden, no se usa tasa de cambio y `exchangeRateUsed` queda `null`.

## Redis

Redis se usa con patrón `cache-aside` y solo para lecturas frecuentes.

Casos cacheados:

- cliente por `id`
- cuentas por `clientId`
- tasa de cambio vigente por par de monedas

Claves:

- `client:{id}`
- `client-accounts:{clientId}`
- `fx:{baseCurrency}:{targetCurrency}`

TTL configurados:

- clientes: `600s`
- cuentas por cliente: `600s`
- tasas vigentes: `300s`

### Por Qué Redis No Decide Balances

Redis no participa en:

- cálculo de saldo disponible
- validación de fondos
- atomicidad
- idempotencia

En el sistema financiero una cache no debe convertirse en motor de consistencia.

### Estrategia de Invalidación

Después de escribir en PostgreSQL:

- `createClient` invalida `client:{id}`
- `createAccount` invalida `client-accounts:{clientId}`
- `createExchangeRate` invalida `fx:{base}:{target}`
- `deposit` y `withdraw` invalidan `client-accounts:{clientId}`
- `transfer` invalida las cuentas de los clientes afectados sin repetir claves

## Elasticsearch

El módulo `search` implementa la integración real con Elastic.

### Índices

- `transactions`
- `clients`
- `accounts`

### Mappings

Se definen mappings explícitos para evitar depender de inferencia dinámica:

- `keyword` para ids, `accountNumber`, `currency`, `type`, `status`, `idempotencyKey`
- `text + keyword` para nombres, email y descripción
- `date` para timestamps
- `scaled_float` para montos y balances

### Qué Se Indexa

`clients`

- `id`
- `firstName`
- `lastName`
- `fullName`
- `email`
- `documentNumber`
- `createdAt`
- `updatedAt`

`accounts`

- `id`
- `accountNumber`
- `clientId`
- `currency`
- `status`
- `balance`
- `createdAt`
- `updatedAt`

`transactions`

- `id`
- `type`
- `sourceAccountId`
- `destinationAccountId`
- `sourceCurrency`
- `destinationCurrency`
- `sourceAmount`
- `destinationAmount`
- `exchangeRateUsed`
- `description`
- `idempotencyKey`
- `createdAt`

### Cuándo Se Indexa

La indexación se hace después de persistir en PostgreSQL:

- `createClient` indexa cliente
- `createAccount` indexa cuenta
- `deposit` indexa transacción y reindexa cuenta
- `withdraw` indexa transacción y reindexa cuenta
- `transfer` indexa transacción y reindexa ambas cuentas

Las búsquedas GraphQL respaldadas por Elastic son:

- `searchClients(term)`
- `searchAccounts(term)`
- `searchTransactions(filters)`

### Tradeoff Operativo

La indexación está implementada como `best effort`: si Elastic falla, el sistema registra el error pero no invalida una operación financiera ya comprometida en PostgreSQL.

Ese tradeoff es intencional:

- protege la integridad del sistema transaccional
- evita que una caída del buscador rompa depósitos, retiros o transferencias
- mantiene a PostgreSQL como única fuente de verdad

El costo es que puede existir desfase temporal entre datos transaccionales y resultados de búsqueda hasta reintento o reindexación.

## API GraphQL

### Mutations

- `createClient`
- `createAccount`
- `createExchangeRate`
- `deposit`
- `withdraw`
- `transfer`

### Queries

- `client(id)`
- `clients`
- `account(id)`
- `accounts`
- `accountByAccountNumber(accountNumber)`
- `accountsByClient(clientId)`
- `transaction(id)`
- `transactions`
- `exchangeRate(baseCurrency, targetCurrency)`
- `exchangeRates`
- `searchClients(term)`
- `searchAccounts(term)`
- `searchTransactions(filters)`

### Filtros de `searchTransactions`

- `type`
- `accountId`
- `sourceAccountId`
- `destinationAccountId`
- `currency`
- `dateFrom`
- `dateTo`
- `text`

## Manejo de Errores

Las excepciones de dominio se exponen en GraphQL mediante `extensions.code`.

Ejemplos:

- `INSUFFICIENT_FUNDS`
- `ACCOUNT_BLOCKED`
- `ACCOUNT_INACTIVE`
- `EXCHANGE_RATE_NOT_CONFIGURED`
- `IDEMPOTENCY_KEY_REUSE`
- `RESOURCE_NOT_FOUND`
- `DUPLICATE_RESOURCE`

Esto facilita manejo programático desde clientes API o frontends.

## Cómo Ejecutarlo

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Usa `.env.template` como base y crea tu `.env`.

Variables relevantes:

```env
DB_HOST=
DB_PORT=
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=
DB_SSL=false

REDIS_HOST=
REDIS_PORT=
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
REDIS_CONNECT_TIMEOUT=3000

ELASTICSEARCH_NODE=
ELASTICSEARCH_API_KEY=
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

PORT=3000
NODE_ENV=development
```

### 3. Ejecutar migraciones

En desarrollo:

```bash
npm run migration:run:dev
```

En build productivo:

```bash
npm run migration:run
```

### 4. Iniciar el servidor

```bash
npm run start:dev
```

GraphQL queda disponible en:

`http://localhost:3000/graphql`

## Ejecutar Con Docker

Levantar todo el stack:

```bash
docker-compose up --build
```

Esto levantará:

- API NestJS
- PostgreSQL
- Redis
- Elasticsearch

Además, el contenedor de la app ejecuta automáticamente:

- migraciones
- seeds
- arranque del servidor

Rutas útiles:

- GraphQL: `http://localhost:3000/graphql`
- Health: `http://localhost:3000/health`

### 5. Cargar datos seed

```bash
npm run seed
```

El seed actual crea un dataset demo idempotente con:

- clientes
- cuentas en USD, EUR y DOP
- tasas de cambio
- depósitos, retiros y transferencias de ejemplo

Si `ELASTICSEARCH_NODE` está configurado, el script también intenta sincronizar los índices de búsqueda en Elastic como parte del proceso.

## Migraciones

Crear migración vacía:

```bash
npm run migration:create --name=NombreMigracion
```

Generar migración desde cambios de entidades:

```bash
npm run migration:generate --name=NombreMigracion
```

Ejecutar migraciones en desarrollo:

```bash
npm run migration:run:dev
```

Revertir la última migración en desarrollo:

```bash
npm run migration:revert:dev
```

Ver migraciones pendientes:

```bash
npm run migration:show:dev
```

## Seeds

Ejecutar seeds en desarrollo:

```bash
npm run seed
```

Ejecutar seeds sobre el build compilado:

```bash
npm run seed:prod
```

Características del seed actual:

- usa ids fijos para que sea idempotente al re-ejecutarse
- deja cuentas y transacciones demo ya listas para probar GraphQL y búsquedas
- incluye transferencias misma moneda y multi-moneda
- intenta sincronizar Elastic sin hacer fallar todo el proceso si el buscador no está disponible

## Cómo Probar

### Build

```bash
npm run build
```

### Unit tests

```bash
npm test -- --runInBand
```

El repositorio ya incluye unit tests orientados a las partes más sensibles del dominio:

- `TransactionWriteService`: depósitos, retiros, transferencias, fondos insuficientes, idempotencia, invalidación de caché e indexación
- `SearchQueryService`: construcción de queries a Elastic y mapeo de resultados

### Coverage

```bash
npm run test:cov
```

### E2E

```bash
npm run test:e2e
```

La suite e2e actual cubre el contrato GraphQL de los flujos más relevantes:

- `deposit`
- `withdraw`
- `transfer`
- `searchClients`
- `searchAccounts`
- `searchTransactions`

El punto fuerte de la solución está más en las decisiones de diseño, locking, idempotencia y trazabilidad que en cobertura completa automatizada.

## Health Check

Endpoint HTTP:

`GET /health`

Verifica:

- PostgreSQL
- Redis
- Elasticsearch

Si una dependencia crítica no responde, el endpoint devuelve `HTTP 503`.

## Ejemplos de Operaciones

### Crear cliente

```graphql
mutation {
  createClient(
    input: {
      firstName: "John"
      lastName: "Doe"
      email: "john@example.com"
      documentNumber: "123456"
    }
  ) {
    id
    email
  }
}
```

### Crear cuenta

```graphql
mutation {
  createAccount(
    input: {
      clientId: "CLIENT_ID"
      accountNumber: "ACC-001"
      currency: USD
      initialBalance: "1000"
    }
  ) {
    id
    balance
    status
  }
}
```

### Depositar con idempotencia

```graphql
mutation {
  deposit(
    input: {
      accountId: "ACCOUNT_ID"
      amount: "100.00"
      idempotencyKey: "dep-001"
      description: "cash-in"
    }
  ) {
    id
    type
    sourceAmount
  }
}
```

### Transferencia multi-moneda

```graphql
mutation {
  transfer(
    input: {
      sourceAccountId: "ACCOUNT_USD"
      destinationAccountId: "ACCOUNT_DOP"
      amount: "25.00"
      idempotencyKey: "tx-001"
      description: "international transfer"
    }
  ) {
    id
    sourceCurrency
    destinationCurrency
    sourceAmount
    destinationAmount
    exchangeRateUsed
  }
}
```

### Búsqueda de transacciones en Elastic

```graphql
query {
  searchTransactions(
    filters: {
      type: TRANSFER
      sourceAccountId: "ACCOUNT_USD"
      currency: DOP
      dateFrom: "2026-01-01T00:00:00.000Z"
      text: "international"
    }
  ) {
    id
    type
    sourceAmount
    destinationAmount
    createdAt
  }
}
```

## Estado Actual y Trabajo en Curso

Actualmente ya están implementados los componentes centrales del backend financiero:

- clientes, cuentas, depósitos, retiros y transferencias
- transferencias multi-moneda con tasa vigente
- control de concurrencia con locking pesimista
- idempotencia en operaciones financieras
- caché selectiva con Redis
- búsquedas respaldadas por Elasticsearch
- seed inicial de datos demo
- health checks

Todavía estoy trabajando en algunos puntos del alcance original de la prueba:

- Docker y orquestación local
- ampliación de la suite de tests, especialmente e2e y escenarios de concurrencia

Hay además decisiones que sí quedaron fuera del alcance actual de esta iteración:

- autenticación y autorización
- saga/outbox para reintentos de indexación
- reindexación masiva de datos históricos
- observabilidad completa con métricas y tracing

## Resumen Ejecutivo

Lo más importante son estas decisiones:

- balances y fondos salen solo de PostgreSQL
- transferencias usan locking pesimista y orden estable de bloqueo
- la idempotencia está diseñada para tolerar reintentos y carreras
- Redis acelera lecturas pero no participa en consistencia
- Elasticsearch resuelve búsqueda sin convertirse en fuente de verdad
- las transferencias multi-moneda preservan trazabilidad con monto origen, monto destino y tasa usada
