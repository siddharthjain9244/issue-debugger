# CUSTOMER PORTFOLIO - Knowledge Base

## Overview
This document describes the customer portfolio management system for Digital Gold platform. It explains how portfolios are stored, fetched, and updated for different merchants, including Redis caching and database management.

## Portfolio Storage Architecture

The platform uses a **hybrid portfolio storage model** where portfolios are stored differently based on the merchant:

1. **MMTC-PAMP**: Portfolio maintained at MMTC (external merchant system)
2. **AUGMONT**: Portfolio maintained at AUGMONT (external merchant system)
3. **MMTC-PAMP-V2**: Portfolio maintained in `customer_portfolio` table (internal database)
4. **All Merchants**: Portfolios are cached in Redis for performance

---

## Product-Portfolio API

### API Endpoint
**GET** `/v2/gold/product-portfolio`

**Purpose**: Fetches product-level metal prices and customer portfolios (if user is logged in)

**Authentication**: 
- Optional - If user is logged in (SSO token or x-user-id header), portfolio is included
- If user is not logged in, only metal prices are returned

**Response Structure**:
- Metal prices for all active merchants
- Customer portfolio for each merchant (if logged in)
- Recommended product priorities
- Product metadata

### Multi-Seller API Endpoint
**GET** `/v2/gold/multi-seller/product-portfolio`

**Purpose**: Enhanced version with multi-seller support and portfolio caching

**Features**:
- Portfolio caching enabled
- Error handling for external portfolio errors
- Support for multiple merchants simultaneously
- Invested amount calculation
- Weighted average price

---

## Merchant-Specific Portfolio Management

### 1. MMTC-PAMP Portfolio

**Storage Location**: External MMTC system

**How It Works**:
- Portfolio is fetched from MMTC API when needed
- Portfolio data includes:
  - Gold balance (grams)
  - Customer name
  - Pincode
  - Customer profile status
- Portfolio is cached in Redis for 7 days
- Redis key format: `MMTC-PAMP-customer-profile-{customerId}`

**Fetch Process**:
1. Check Redis cache first
2. If not in cache, fetch from MMTC API
3. Store in Redis with 7-day TTL
4. Return portfolio data

**Update Process**:
- Portfolio is updated at MMTC when buy/sell transactions complete
- System invalidates Redis cache after portfolio updates
- Next fetch will get fresh data from MMTC

**Portfolio Fields**:
- `goldBalance` - Gold balance in grams
- `customerName` - Customer name
- `pincode` - Customer pincode
- `isNewCustomer` - Boolean flag

---

### 2. AUGMONT Portfolio

**Storage Location**: External AUGMONT system

**How It Works**:
- Portfolio is fetched from AUGMONT API when needed
- Portfolio data includes:
  - Gold balance (grams)
  - Customer name
  - Pincode
  - Customer profile status
- Portfolio is cached in Redis for 7 days
- Redis key format: `AUGMONT-customer-profile-{customerId}`

**Fetch Process**:
1. Check Redis cache first
2. If not in cache, fetch from AUGMONT API
3. Store in Redis with 7-day TTL
4. Return portfolio data

**Update Process**:
- Portfolio is updated at AUGMONT when buy/sell transactions complete
- System invalidates Redis cache after portfolio updates
- Next fetch will get fresh data from AUGMONT

**Portfolio Fields**:
- `goldBalance` - Gold balance in grams
- `customerName` - Customer name
- `pincode` - Customer pincode
- `isNewCustomer` - Boolean flag

---

### 3. MMTC-PAMP-V2 Portfolio

**Storage Location**: Internal database table `customer_portfolio`

**How It Works**:
- Portfolio is stored in `customer_portfolio` table
- Each customer has one record per merchant
- Portfolio is updated directly in database during buy/sell transactions
- Portfolio is also cached in Redis for performance

**Database Table**: `customer_portfolio`

**Table Structure**:
- `id` - Primary key
- `merchant_id` - Merchant identifier
- `customer_id` - Customer identifier
- `quantity` - Gold balance in grams (stored as varchar)
- `name` - Customer name (optional)
- `pincode` - Customer pincode (optional)
- `status` - Portfolio status (default: 1)
- `positive_balance` - Positive balance flag
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Unique Constraint**: `(merchant_id, customer_id)` - One portfolio per customer per merchant

**Fetch Process**:
1. Check Redis cache first (`USER_PORTFOLIO_KEY_{customerId}`)
2. If not in cache, fetch from database
3. Store in Redis with 7-day TTL
4. Return portfolio data

**Update Process**:
1. Update portfolio in database (atomic transaction)
2. Update Redis cache immediately
3. Portfolio changes are reflected in real-time

**Portfolio Update During Transactions**:
- **Buy Transactions**: `quantity = quantity + purchased_grams`
- **Sell Transactions**: `quantity = quantity - sold_grams`
- Updates happen atomically with order status updates

---

## Redis Portfolio Caching

### Cache Strategy

All portfolios are cached in Redis regardless of merchant type for performance optimization.

### Redis Key Formats

1. **MMTC-PAMP**: `MMTC-PAMP-customer-profile-{customerId}`
2. **AUGMONT**: `AUGMONT-customer-profile-{customerId}`
3. **MMTC-PAMP-V2 (Combined)**: `USER_PORTFOLIO_KEY_{customerId}`
4. **MMTC-PAMP-V2 (New Format)**: `USER_PORTFOLIO_NEW_KEY_{customerId}`

### Cache TTL (Time To Live)

- **Default TTL**: 7 days (604,800 seconds)
- **Portfolio Cache TTL**: 1 day (86,400 seconds) for new format

### Cache Structure

**For MMTC-PAMP-V2 (Combined)**:
```json
[
  {
    "merchant": "MMTC-PAMP-V2",
    "merchant_id": "1505574",
    "quantity": 5.5,
    "purity": 99.95
  },
  {
    "merchant": "MMTC-PAMP",
    "merchant_id": "332337",
    "quantity": 10.2,
    "purity": 99.99
  }
]
```

**For MMTC-PAMP-V2 (New Format)**:
```json
[
  {
    "merchant": "MMTC-PAMP-V2",
    "merchant_id": "1505574",
    "quantity": 5.5,
    "isNewCustomer": false,
    "customerName": "John Doe",
    "pincode": "122103",
    "weighted_average": 5500,
    "invested_value": 30250
  }
]
```

### Cache Invalidation

- Cache is invalidated when portfolio is updated
- Cache expires after TTL
- Cache can be manually cleared if needed

---

## Portfolio Fetch Flow

### Flow Diagram

```
API Request
    ↓
Check Redis Cache
    ↓
Cache Hit? → Yes → Return Cached Portfolio
    ↓ No
Fetch from Source:
  - MMTC-PAMP → MMTC API
  - AUGMONT → AUGMONT API
  - MMTC-PAMP-V2 → Database
    ↓
Store in Redis Cache
    ↓
Return Portfolio
```

### Detailed Fetch Process

1. **Check Redis Cache**:
   - Look for portfolio in Redis using customer ID
   - If found and valid, return cached data

2. **Fetch from Source** (if cache miss):
   - **MMTC-PAMP**: Call MMTC API to get portfolio
   - **AUGMONT**: Call AUGMONT API to get portfolio
   - **MMTC-PAMP-V2**: Query `customer_portfolio` table

3. **Process Portfolio Data**:
   - Parse and format portfolio data
   - Calculate additional fields (weighted average, invested value)
   - Merge data from multiple merchants if needed

4. **Cache Portfolio**:
   - Store in Redis with appropriate TTL
   - Use correct key format for merchant

5. **Return Portfolio**:
   - Return formatted portfolio data
   - Include merchant-specific information

---

## Portfolio Update Flow

### Update Triggers

Portfolios are updated when:
1. **Buy Transaction Success**: Gold is added to portfolio
2. **Sell Transaction Success**: Gold is deducted from portfolio
3. **SIP Debit Success**: Gold is added to portfolio
4. **P2P Transfer**: Gold is transferred between customers
5. **Manual Update**: Admin or system update

### Update Process for MMTC-PAMP-V2

1. **Database Update**:
   - Start database transaction
   - Update `customer_portfolio` table
   - Update `quantity` field atomically
   - Commit transaction

2. **Redis Update**:
   - Fetch updated portfolio from database
   - Update Redis cache immediately
   - Set TTL to 7 days

3. **Portfolio Sync**:
   - Ensure database and Redis are in sync
   - Handle update failures gracefully

### Update Process for MMTC-PAMP and AUGMONT

1. **Merchant API Update**:
   - Portfolio is updated at merchant system
   - Update happens during transaction processing

2. **Cache Invalidation**:
   - Invalidate Redis cache for the customer
   - Next fetch will get fresh data from merchant API

3. **Cache Refresh**:
   - System may proactively refresh cache
   - Or wait for next fetch request

---

## Portfolio Creation

### New Customer Portfolio

When a new customer makes their first transaction:

1. **MMTC-PAMP-V2**:
   - Portfolio record is created in `customer_portfolio` table
   - Initial quantity: 0
   - Created during first buy transaction

2. **MMTC-PAMP / AUGMONT**:
   - Portfolio is created at merchant system
   - Created during first transaction
   - System fetches portfolio after creation

### Portfolio Creation via Kafka

For MMTC-PAMP-V2, if portfolio doesn't exist:
- Message is sent to Kafka topic: `portfolio_creator`
- Kafka consumer creates portfolio record
- Portfolio initialized with quantity: 0

---

## Portfolio Data Structure

### Portfolio Response Format

```json
{
  "merchant": "MMTC-PAMP-V2",
  "merchant_id": "1505574",
  "quantity": 5.5,
  "balanceInGm": 5.5,
  "purity": 99.95,
  "customerName": "John Doe",
  "pincode": "122103",
  "isNewCustomer": false,
  "weighted_average": 5500,
  "invested_value": 30250,
  "max_sell_amount": 15000,
  "net_worth": 15000
}
```

### Portfolio Fields

- **merchant** - Merchant name
- **merchant_id** - Merchant identifier
- **quantity** - Gold balance in grams
- **balanceInGm** - Gold balance in grams (alias)
- **purity** - Gold purity percentage
- **customerName** - Customer name
- **pincode** - Customer pincode
- **isNewCustomer** - Boolean flag for new customers
- **weighted_average** - Weighted average purchase price
- **invested_value** - Total invested value
- **max_sell_amount** - Maximum amount that can be sold
- **net_worth** - Current net worth based on sell price

---

## Database Schema

### Table: customer_portfolio

**Purpose**: Stores MMTC-PAMP-V2 customer portfolios

**Columns**:
- `id` (int, PK) - Primary key
- `merchant_id` (bigint) - Merchant identifier
- `customer_id` (bigint) - Customer identifier
- `quantity` (varchar) - Gold balance in grams
- `name` (varchar) - Customer name
- `pincode` (varchar) - Customer pincode
- `status` (tinyint) - Portfolio status (default: 1)
- `positive_balance` (tinyint) - Positive balance flag
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

**Indexes**:
- Primary key: `id`
- Unique key: `(merchant_id, customer_id)`
- Index: `merchant_id`
- Index: `customer_id`
- Index: `pincode`
- Index: `created_at`
- Index: `updated_at`

**Constraints**:
- One portfolio per customer per merchant (unique constraint)
- `status` default: 1 (active)

---

## Portfolio Aggregation

### Multi-Merchant Portfolio

When fetching portfolios for a customer with multiple merchants:

1. **Fetch from Each Merchant**:
   - MMTC-PAMP portfolio from MMTC API
   - AUGMONT portfolio from AUGMONT API
   - MMTC-PAMP-V2 portfolio from database

2. **Combine Portfolios**:
   - Merge all merchant portfolios
   - Calculate total gold balance
   - Calculate total invested value
   - Calculate total net worth

3. **Return Aggregated Data**:
   - Product-level portfolio for each merchant
   - Combined portfolio summary
   - Merchant-specific details

---

## Portfolio Update During Transactions

### Buy Transaction

**MMTC-PAMP-V2**:
1. Transaction completes successfully
2. Update `customer_portfolio` table:
   ```sql
   UPDATE customer_portfolio 
   SET quantity = quantity + purchased_grams 
   WHERE customer_id = ? AND merchant_id = ?
   ```
3. Update Redis cache
4. Portfolio balance increases

**MMTC-PAMP / AUGMONT**:
1. Transaction completes successfully
2. Portfolio updated at merchant system
3. Invalidate Redis cache
4. Next fetch gets updated portfolio

### Sell Transaction

**MMTC-PAMP-V2**:
1. Transaction completes successfully
2. Update `customer_portfolio` table:
   ```sql
   UPDATE customer_portfolio 
   SET quantity = quantity - sold_grams 
   WHERE customer_id = ? AND merchant_id = ?
   ```
3. Update Redis cache
4. Portfolio balance decreases

**MMTC-PAMP / AUGMONT**:
1. Transaction completes successfully
2. Portfolio updated at merchant system
3. Invalidate Redis cache
4. Next fetch gets updated portfolio

---

## Portfolio Validation

### Balance Validation

Before sell transactions:
- System validates customer has sufficient gold balance
- Check is performed against current portfolio
- Validation happens before order creation

### Portfolio Consistency

- Database and Redis should be in sync
- System handles sync failures gracefully
- Periodic sync may be performed

---

## Error Handling

### Portfolio Fetch Failures

1. **Redis Cache Failure**:
   - Fallback to source (database or API)
   - Continue processing

2. **Database Failure** (MMTC-PAMP-V2):
   - Return error or cached data
   - Log error for investigation

3. **Merchant API Failure** (MMTC-PAMP/AUGMONT):
   - Return cached data if available
   - Or return error based on configuration
   - Log error for investigation

### Portfolio Update Failures

1. **Database Update Failure**:
   - Transaction is rolled back
   - Error is logged
   - Retry mechanism may be triggered

2. **Redis Update Failure**:
   - Database update succeeds
   - Redis update failure is logged
   - Next fetch will refresh cache

---

## Performance Optimization

### Caching Strategy

- **Redis Caching**: All portfolios cached for 7 days
- **Cache Hit Rate**: High cache hit rate improves performance
- **Cache Warming**: Portfolios may be pre-loaded

### Database Optimization

- **Indexes**: Proper indexes on customer_id and merchant_id
- **Query Optimization**: Efficient queries for portfolio fetch
- **Connection Pooling**: Database connection pooling

### API Optimization

- **Parallel Fetching**: Fetch from multiple merchants in parallel
- **Timeout Handling**: Proper timeouts for external APIs
- **Error Isolation**: Failures in one merchant don't affect others

---

## Important Notes

1. **Merchant-Specific Storage**:
   - MMTC-PAMP-V2 uses internal database
   - MMTC-PAMP and AUGMONT use external systems
   - All portfolios are cached in Redis

2. **Cache Consistency**:
   - Redis cache is updated after database updates
   - Cache is invalidated when portfolio changes
   - Cache TTL ensures freshness

3. **Portfolio Updates**:
   - Updates are atomic for MMTC-PAMP-V2
   - Updates happen during transaction processing
   - Database and Redis are updated together

4. **Multi-Merchant Support**:
   - System supports multiple merchants simultaneously
   - Each merchant portfolio is managed independently
   - Portfolios are aggregated for display

5. **New Customer Handling**:
   - Portfolios are created on first transaction
   - Initial balance is 0
   - Kafka may be used for portfolio creation

6. **Portfolio Validation**:
   - Balance validation before sell transactions
   - Ensures sufficient gold balance
   - Prevents negative balances

7. **Error Recovery**:
   - System handles failures gracefully
   - Cached data used when available
   - Errors are logged for investigation

---

## Related Documentation

- **Buy Flow**: See `01_BUY_FLOW.md` - Portfolio updates during buy
- **Sell Flow**: See `02_SELL_FLOW.md` - Portfolio updates during sell
- **SIP Create Flow**: See `03_SIP_CREATE_FLOW.md` - Portfolio updates during SIP
- **SIP Debit Flow**: See `04_SIP_DEBIT_FLOW.md` - Portfolio updates during SIP debit
- **Merchant & Product Maintenance**: See `05_MERCHANT_PRODUCT_MAINTENANCE.md`

---

## Summary

The customer portfolio system uses a hybrid approach:

- **MMTC-PAMP-V2**: Internal database storage with Redis caching
- **MMTC-PAMP / AUGMONT**: External merchant storage with Redis caching
- **All Merchants**: Redis caching for performance
- **Product-Portfolio API**: Fetches portfolios from all merchants
- **Atomic Updates**: Database updates are atomic for MMTC-PAMP-V2
- **Cache Management**: Redis cache is kept in sync with source data

This architecture provides:
- **Performance**: Fast portfolio access via Redis caching
- **Reliability**: Multiple storage mechanisms for redundancy
- **Scalability**: Supports multiple merchants simultaneously
- **Consistency**: Database and cache are kept in sync

