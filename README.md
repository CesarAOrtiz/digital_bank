# Digital Bank

Microservicio backend bancario construido con NestJS, GraphQL y PostgreSQL, diseñado para manejar clientes, cuentas y transacciones financieras multi-moneda.

El proyecto prioriza:

- consistencia transaccional
- control de concurrencia
- precisión en cálculos financieros
- arquitectura modular clara

## Resumen

El sistema implementa:

- gestión de clientes
- gestión de cuentas bancarias
- depósitos
- retiros
- transferencias
- transferencias multi-moneda
- tasas de cambio versionadas
- health checks del sistema

El API principal es GraphQL.

El esquema generado se escribe automáticamente en:

`src/schema.gql`

## Stack Tecnológico

- NestJS
- GraphQL (Apollo)
- TypeORM
- PostgreSQL
- `decimal.js` para cálculos monetarios
- `@nestjs/terminus` para health checks

Dependencias disponibles:

- Redis
- Elasticsearch

## Arquitectura

El proyecto utiliza una arquitectura DDD-light modular, donde cada módulo se divide en capas claras:

```text
src/modules/<module>/
  domain/
  application/
  infrastructure/
  presentation/
```

Responsabilidades de cada capa:

| Capa             | Responsabilidad                            |
| ---------------- | ------------------------------------------ |
| `domain`         | reglas de negocio, entidades y excepciones |
| `application`    | coordinación de casos de uso               |
| `infrastructure` | persistencia, ORM, repositorios            |
| `presentation`   | resolvers GraphQL                          |

## Módulos

Los módulos principales del sistema son:

- `clients`
- `accounts`
- `transactions`
- `exchange-rates`

Componentes compartidos:

- `src/common`
- `src/config`

## Modelo de Dominio

### Client

Representa un cliente del banco.

Campos principales:

- `id`
- `firstName`
- `lastName`
- `email`
- `documentNumber`
- `createdAt`
- `updatedAt`

Restricciones:

- `email` único
- `documentNumber` único

### Account

Cuenta bancaria asociada a un cliente.

Campos principales:

- `id`
- `clientId`
- `accountNumber`
- `currency`
- `balance`
- `status`
- `createdAt`
- `updatedAt`

Estados posibles:

- `ACTIVE`
- `BLOCKED`
- `INACTIVE`

Reglas:

- una cuenta pertenece a un cliente
- cada cuenta tiene una moneda fija
- no se puede operar sobre cuentas bloqueadas o inactivas

### Transaction

Representa una operación financiera.

Campos principales:

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

Representa una tasa de cambio efectiva en un momento determinado.

Campos principales:

- `id`
- `baseCurrency`
- `targetCurrency`
- `rate`
- `effectiveAt`
- `createdAt`

## Decisiones de Diseño

### Transacciones ACID

Todas las operaciones financieras se ejecutan dentro de transacciones de base de datos.

Para transferencias:

- se inicia una transacción
- se bloquean ambas cuentas con `pessimistic_write`
- el orden de bloqueo se normaliza por `id`
- se valida saldo
- se aplica débito/crédito
- se persiste la transacción
- se realiza `commit`

Esto evita inconsistencias y reduce el riesgo de deadlocks.

### Estrategia de Concurrencia

Las cuentas involucradas en transferencias se bloquean usando:

`pessimistic_write`

El orden de bloqueo se normaliza:

```text
if accountA.id < accountB.id
  lock A
  lock B
else
  lock B
  lock A
```

Esto reduce significativamente la probabilidad de deadlocks.

### Precisión Monetaria

Los cálculos financieros usan `decimal.js`.

Escalas utilizadas:

- `amount`: `decimal(18,2)`
- `exchange rate`: `decimal(18,6)`

El redondeo usa:

`ROUND_HALF_EVEN`

también conocido como banker's rounding.

### Idempotencia

Las operaciones financieras aceptan el campo:

`idempotencyKey`

La implementación:

- detecta reutilización con payload distinto
- evita ejecuciones duplicadas
- maneja condiciones de carrera en claves duplicadas

Si la misma clave se reutiliza para otra operación incompatible, el sistema lanza:

`IDEMPOTENCY_KEY_REUSE`

### Inmutabilidad de Transacciones

Las transacciones financieras se modelan como registros inmutables.

Reglas:

- se crean una sola vez
- no se editan
- no se borran

Cualquier corrección futura debe representarse como una transacción compensatoria.

Esto preserva la integridad histórica del sistema.

### Versionado de Tasas de Cambio

Las tasas de cambio se tratan como registros históricos versionados.

Reglas:

- una tasa representa un valor efectivo en un momento
- cuando cambia la tasa se inserta una nueva fila
- las tasas existentes no se sobrescriben

Las consultas utilizan la última tasa vigente según `effectiveAt`.

### Semántica de `exchangeRate`

La query:

```graphql
exchangeRate(baseCurrency, targetCurrency): ExchangeRate!
```

es non-null intencionalmente.

Si no existe tasa vigente, el sistema lanza:

`ExchangeRateNotConfiguredException`

La ausencia de tasa se trata como error de configuración, no como resultado normal del negocio.

### Manejo de Errores

Las excepciones del dominio se exponen en GraphQL con códigos claros:

- `INSUFFICIENT_FUNDS`
- `ACCOUNT_BLOCKED`
- `ACCOUNT_INACTIVE`
- `EXCHANGE_RATE_NOT_CONFIGURED`
- `IDEMPOTENCY_KEY_REUSE`

Estos códigos se entregan en:

`extensions.code`

permitiendo manejo de errores progamados.

### Redis y Caché Selectiva

Redis se usa con `cache-aside pattern` y solo como optimización de lecturas frecuentes y relativamente estables.

Casos cacheados:

- cliente por `id`
- cuentas por `clientId`
- tasa de cambio vigente por par de monedas

Claves usadas:

- `client:{id}`
- `client-accounts:{clientId}`
- `fx:{baseCurrency}:{targetCurrency}`

TTL:

- clientes: `600` segundos
- cuentas por cliente: `600` segundos
- tasas de cambio vigentes: `300` segundos

Flujo aplicado:

- lectura:
  - se consulta Redis
  - si no existe, se consulta PostgreSQL
  - el resultado se guarda en Redis
  - se devuelve la respuesta
- escritura:
  - primero se persiste en PostgreSQL
  - luego se invalidan explícitamente las claves relacionadas en Redis

Invalidaciones implementadas:

- al crear un cliente, se invalida `client:{id}`
- al crear una cuenta, se invalida `client-accounts:{clientId}`
- al crear una tasa de cambio, se invalida `fx:{baseCurrency}:{targetCurrency}`
- en `deposit` y `withdraw`, se invalida `client-accounts:{clientId}` de la cuenta afectada
- en `transfer`, se invalidan las claves `client-accounts` de los clientes involucrados sin duplicar trabajo si ambos coinciden

### Por Qué Redis No Se Usa Para Balances Operativos

Redis no se usa para decidir fondos disponibles, saldos reales ni consistencia financiera.

Motivos:

- en un sistema financiero, la consistencia del balance es crítica
- PostgreSQL sigue siendo la fuente de verdad
- usar Redis para validar fondos introduciría riesgo de inconsistencia

En `deposit`, `withdraw` y `transfer`:

- la cuenta real y su balance se leen siempre desde PostgreSQL
- la operación corre dentro de una transacción
- se mantiene el locking pesimista existente
- Redis no participa en atomicidad, idempotencia ni validación de fondos

Si una respuesta cacheada de `accountsByClient` incluye balance, ese balance es solo de lectura y nunca se reutiliza para cálculos financieros.

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
- `account(id)`
- `accountByAccountNumber(accountNumber)`
- `accountsByClient(clientId)`
- `searchClients(term)`
- `searchAccounts(term)`
- `searchTransactions(filters)`
- `exchangeRate(baseCurrency, targetCurrency)`

## Quick Start

### Instalar dependencias

```bash
npm install
```

### Configurar variables de entorno

Copiar `.env.template` y ajustar valores si es necesario.

### Ejecutar migraciones

```bash
npm run migration:run:dev
```

### Iniciar el servidor

```bash
npm run start:dev
```

### Abrir GraphQL Playground

`http://localhost:3000/graphql`

## Ejemplos de Operaciones GraphQL

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
  }
}
```

### Depositar

```graphql
mutation {
  deposit(input: { accountId: "ACCOUNT_ID", amount: "100" }) {
    id
    sourceAmount
  }
}
```

### Transferir

```graphql
mutation {
  transfer(
    input: {
      sourceAccountId: "ACCOUNT_A"
      destinationAccountId: "ACCOUNT_B"
      amount: "50"
    }
  ) {
    id
    sourceAmount
    destinationAmount
  }
}
```

## Health Check

Endpoint HTTP:

`GET /health`

Implementado con Terminus.

Verifica:

- PostgreSQL
- Redis
- Elasticsearch

Si una dependencia crítica falla:

`HTTP 503`

## Variables de Entorno

```env
DB_HOST=
DB_PORT=
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=

REDIS_HOST=
REDIS_PORT=
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
REDIS_CONNECT_TIMEOUT=3000

ELASTICSEARCH_NODE=

PORT=3000
NODE_ENV=development
```

## Migraciones

Generar migración:

```bash
npm run migration:generate --name=NombreMigracion
```

Ejecutar migraciones:

```bash
npm run migration:run:dev
```

Revertir migración:

```bash
npm run migration:revert:dev
```

## Estado Actual

Actualmente el proyecto incluye:

- modelo de dominio
- persistencia con migraciones
- operaciones financieras principales
- transferencias multi-moneda
- control de concurrencia
- idempotencia
- caché selectiva con Redis para lecturas
- health checks

Fuera del alcance actual:

- Elasticsearch como índice de búsqueda real
- seeds
- Docker
- suite completa de tests
