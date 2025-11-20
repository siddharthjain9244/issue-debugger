# BUY FLOW - Business Flow Knowledge Base

## Overview
This document describes the complete buy flow for Digital Gold transactions from a business perspective, including all steps, status transitions, database operations, and decision points.

## Product IDs
- **Production**: 635850270
- **Staging**: 63779641

## Business Flow Diagram

```
User (Frontend)
    ↓
1. Request Gold Price Quote
    ↓
2. Create Order & Initiate Payment
    ↓
3. User Completes Payment
    ↓
4. Payment Success Notification Received
    ↓
5. Order Processing & Gold Allocation
    ↓
6. Portfolio Update
    ↓
7. Transaction Complete & Notifications
```

## Detailed Business Flow Steps

### Step 1: Price Quote Request
**Business Purpose**: User requests current gold price and gets a locked quote for a specific duration.

**What Happens**:
- System fetches current gold price from merchant (MMTC-PAMP)
- Price includes taxes and fees
- Quote is blocked/locked for a specific time period
- User receives quote details: price per gram, total amount, taxes

**Output**: Quote with expiry time

---

### Step 2: Order Creation & Payment Initiation
**Business Purpose**: User confirms purchase and initiates payment.

**What Happens**:
- System validates user authentication
- System validates product availability
- System performs KYC checks (for high-value orders)
- System creates order record in database with status: **Pending (13)**
- System initiates payment with payment gateway (Cart service)
- User is redirected to payment page

**Database Operations**:
- **Table**: `dg_buy_orders`
- **Status**: `13` (Pending)
- **Fields Created**: order_id, customer_id, amount, product_id, merchant_id, status

**Output**: Payment URL for user

---

### Step 3: User Payment
**Business Purpose**: User completes payment through payment gateway.

**Payment Methods Supported**:
- UPI
- Net Banking
- Credit Card
- Debit Card
- Paytm Payments Bank (PPBL)
- Wallet

**What Happens**:
- User selects payment method
- User completes payment
- Payment gateway processes payment
- Payment gateway sends notification to system

---

### Step 4: Payment Success Notification
**Business Purpose**: System receives payment confirmation and processes the order.

**What Happens**:
1. **Order Validation**:
   - System validates order exists
   - System checks order status
   - System verifies payment details

2. **Merchant Order Execution**:
   - System generates block quote for the order
   - System confirms order with merchant (MMTC)
   - System executes order at merchant
   - System receives merchant order ID

3. **Portfolio Update**:
   - System updates customer portfolio
   - Gold is allocated to customer account
   - Portfolio balance is increased

4. **Order Status Update**:
   - **Status Changes**: `13` (Pending) → `7` (Success)
   - System updates order with:
     - Merchant order ID
     - Quote ID
     - Fulfillment ID
     - Gold weight (grams)
     - Final amount

5. **Transaction History**:
   - System creates transaction record in Elasticsearch
   - System updates Cart service status

6. **Notifications**:
   - System sends success notification to user
   - SMS, Email, Push notifications sent

**Database Operations**:
- **Table**: `dg_buy_orders`
- **Status Update**: `13` → `7` (Success)
- **Fields Updated**: status, fulfillment_id, quote_id, mmtc_order_id, gram_weight, info

---

### Step 5: Payment Failure Notification
**Business Purpose**: System handles payment failure scenarios.

**What Happens**:
- System receives failure notification
- System updates order status to: **0** (Failure)
- System records failure reason/error code
- System sends failure notification to user
- System handles subscription failures (if applicable)
- System sends SMS for card/instrument failures (if applicable)

**Database Operations**:
- **Table**: `dg_buy_orders`
- **Status Update**: `13` → `0` (Failure)
- **Fields Updated**: status, dgErrorCode

---

## Database Tables & Status Mapping

### Table: dg_buy_orders
**Purpose**: Stores all buy order information

**Key Fields**:
- `order_id` - Unique order identifier
- `order_item_id` - Order item identifier
- `customer_id` - Customer identifier
- `merchant_id` - Merchant identifier
- `product_id` - Product identifier
- `amount` - Order amount
- `gram_weight` - Gold weight in grams
- `status` - Order status (see status values below)
- `fulfillment_id` - Fulfillment service ID
- `quote_id` - Merchant quote ID
- `mmtc_order_id` - Merchant order ID
- `dgErrorCode` - Error code (if failure)
- `info` - Additional order information (JSON)
- `created_at` - Order creation timestamp
- `updated_at` - Last update timestamp

**Status Values**:
- `13` - **Pending**: Order created, payment initiated
- `7` - **Success**: Payment successful, gold allocated, order completed
- `0` - **Failure**: Payment failed or merchant cancelled
- `6` - **Cancelled**: Order cancelled
- `8` - **Reversed**: Order reversed
- `17` - **Cancellation Requested**: Cancellation in process
- `18` - **Other Failure States**: Various failure scenarios

---

## Status Flow Diagram

### Success Flow:
```
Order Created
    ↓
Status: 13 (Pending)
    ↓
Payment Success
    ↓
Order Processing
    ↓
Status: 7 (Success)
    ↓
Portfolio Updated
    ↓
Transaction Complete
```

### Failure Flow:
```
Order Created
    ↓
Status: 13 (Pending)
    ↓
Payment Failure
    ↓
Status: 0 (Failure)
    ↓
Error Recorded
    ↓
Failure Notification Sent
```

---

## Business Rules & Decision Points

### 1. KYC Verification
- **Rule**: High-value orders require KYC verification
- **Threshold**: Configurable amount limit
- **Action**: If order amount exceeds threshold, KYC check is performed

### 2. Price Locking
- **Rule**: Quote price is locked for a specific duration
- **Action**: If quote expires, user needs to request new quote

### 3. Order Processing
- **Rule**: Orders are processed asynchronously
- **Action**: System responds immediately and processes in background

### 4. Portfolio Update
- **Rule**: Portfolio is updated atomically with order status
- **Action**: Gold is allocated only after successful payment and merchant confirmation

### 5. Error Handling
- **Rule**: Retryable errors are automatically retried
- **Action**: System retries failed operations with exponential backoff

---

## Error Scenarios & Handling

### Payment Failure
- **Scenario**: User payment fails
- **Status**: Order status → `0` (Failure)
- **Action**: User can retry payment or cancel order

### Merchant Failure
- **Scenario**: Merchant (MMTC) fails to process order
- **Status**: Order status → `0` (Failure)
- **Action**: System retries or refunds payment

### Portfolio Update Failure
- **Scenario**: Portfolio update fails after payment success
- **Status**: Order status remains `7` (Success), but portfolio not updated
- **Action**: System retries portfolio update

### Transaction History Failure
- **Scenario**: Elasticsearch update fails
- **Status**: Order status remains `7` (Success)
- **Action**: System retries ES update

---

## Notifications

### Success Notifications
- **SMS**: Order confirmation with order ID and amount
- **Email**: Order confirmation email (if configured)
- **Push**: In-app notification (if configured)
- **Content**: Order details, gold weight, amount

### Failure Notifications
- **SMS**: Failure notification with reason
- **Email**: Failure notification email (if configured)
- **Push**: In-app notification (if configured)
- **Content**: Failure reason, retry instructions

---

## Key Business Metrics

### Success Metrics
- Total buy orders
- Total buy amount
- Success rate
- Average order value
- Processing time

### Failure Metrics
- Failure rate
- Failure reasons breakdown
- Retry success rate
- Refund rate

---

## Important Business Notes

1. **Idempotency**: Order processing is idempotent - same order can be processed multiple times safely without duplicate charges

2. **Async Processing**: System responds immediately to payment notifications and processes orders asynchronously for better performance

3. **State Management**: Order state transitions are managed systematically to ensure data consistency

4. **Portfolio Updates**: Portfolio is updated atomically with order status to ensure gold balance accuracy

5. **Transaction History**: All transactions are recorded in Elasticsearch for user transaction history

6. **Payment Gateway Integration**: System integrates with Cart service for payment processing

7. **Merchant Integration**: System integrates with MMTC-PAMP for gold allocation

8. **Error Recovery**: System has retry mechanisms for recoverable errors

---

## Related Flows

- **Sell Flow**: See `02_SELL_FLOW.md` for selling gold
- **SIP Create Flow**: See `03_SIP_CREATE_FLOW.md` for subscription creation
- **SIP Debit Flow**: See `04_SIP_DEBIT_FLOW.md` for subscription debit
