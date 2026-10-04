# MiniPay

A Java backend portfolio project for a simulated KES wallet API, built with Spring Boot and MySQL.

## Features

- Create and retrieve user profiles, with email validation and duplicate checks.
- Create one wallet per user and retrieve its balance.
- Add simulated funds to a wallet.
- Transfer funds between wallets, with checks for positive amounts, whole cents, matching currencies, sufficient funds, and balance limits.
- Retrieve transfer receipts and each wallet's incoming and outgoing transfer history.

## Backend design

Controllers handle HTTP requests and responses. Services apply business rules. Spring Data JPA repositories handle persistence through Hibernate.

- Money uses `BigDecimal`, stored as `DECIMAL(19, 2)`.
- Wallets use `@Version` for optimistic concurrency checks.
- A transfer updates both wallet balances and saves its receipt inside one Spring `@Transactional` method.
- API responses use summary records for wallets and transfers rather than exposing their JPA relationships.
- Local database credentials are loaded from an ignored `db-local.properties` file.

## Requirements

- JDK 21
- MySQL 8.x
- Insomnia or another HTTP client

The project includes the Maven Wrapper; a separate Maven installation is not required.

## Run locally

1. Clone the repository and open the project root containing `pom.xml`.
2. Start MySQL. Run the following SQL with an account permitted to create the database and local application user. Choose your own local password:

   ```sql
   CREATE DATABASE IF NOT EXISTS minipay_db;

   CREATE USER 'minipay_user'@'localhost'
   IDENTIFIED BY 'CHOOSE_YOUR_LOCAL_PASSWORD';

   GRANT ALL PRIVILEGES ON minipay_db.*
   TO 'minipay_user'@'localhost';
   ```

   If this database and user already exist, reuse their credentials instead of creating the user again.

3. Copy the configuration example in the project root:

   ```powershell
   Copy-Item .\db-local.properties.example .\db-local.properties
   ```

4. Edit `db-local.properties` with the credentials you chose:

   ```properties
   spring.datasource.username=minipay_user
   spring.datasource.password=YOUR_LOCAL_PASSWORD
   ```

5. Start the application from the project root:

   ```powershell
   .\mvnw.cmd spring-boot:run
   ```

   On Linux or macOS:

   ```bash
   sh ./mvnw spring-boot:run
   ```

The API runs at `http://localhost:8080`. The development configuration uses `spring.jpa.hibernate.ddl-auto=update` to create and update tables.

## API endpoints

Send JSON request bodies with `Content-Type: application/json`.

| Method | Path | Action |
| --- | --- | --- |
| GET | `/api/health` | Application health response |
| POST | `/api/users` | Create a user |
| GET | `/api/users` | List users |
| GET | `/api/users/{id}` | Retrieve a user |
| POST | `/api/wallets` | Create a wallet for a user |
| GET | `/api/wallets/{walletId}` | Retrieve a wallet |
| GET | `/api/wallets/user/{userId}` | Retrieve a user's wallet |
| POST | `/api/wallets/{walletId}/topups` | Add simulated funds |
| POST | `/api/transfers` | Transfer funds |
| GET | `/api/transfers/{transferId}` | Retrieve a transfer receipt |
| GET | `/api/transfers/wallet/{walletId}` | Retrieve incoming and outgoing transfers |

### Request examples

Create a user:

```json
{
  "fullName": "Shedrack Demo",
  "email": "shedrack.demo@example.com"
}
```

Create a wallet using the user ID returned by the API:

```json
{
  "userId": 1
}
```

Top up a wallet:

```json
{
  "amount": 1000.00
}
```

Transfer funds using two different wallet IDs returned by the API:

```json
{
  "senderWalletId": 1,
  "receiverWalletId": 2,
  "amount": 250.00
}
```

IDs in these examples are illustrative. Use the IDs returned by your own requests.

## Manual verification with Insomnia

1. Create two users and a wallet for each.
2. Fund the sender with KES 1,000.00; leave the receiver at KES 0.00.
3. Send one KES 250.00 transfer. Expect `201 Created`, a receipt, and balances of KES 750.00 and KES 250.00.
4. Retrieve the receipt and both wallets' transfer histories. Check that the same transfer appears in both histories.
5. Try zero, negative and fractional-cent amounts, a transfer to the same wallet, a missing wallet and an amount exceeding the sender's balance.
6. Check that rejected requests leave the balances and transfer history unchanged.
7. Restart the application and retrieve the saved balances and receipt again.

Invalid input returns `400`, missing records return `404`, and business or concurrency conflicts return `409`.

## Current scope and next improvements

MiniPay is a local portfolio demo with simulated funding. Transfer history records transfers between wallets. Authentication, wallet ownership checks, request idempotency, and automated transfer integration tests are planned improvements. Repeating a successful top-up or transfer POST currently creates another operation.
