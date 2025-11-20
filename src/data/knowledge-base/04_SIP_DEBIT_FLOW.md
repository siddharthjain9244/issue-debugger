# SIP DEBIT FLOW - Business Flow Knowledge Base

## Overview
This document describes the complete SIP (Systematic Investment Plan) debit flow for recurring subscription payments from a business perspective, including all steps, status transitions, database operations, and decision points.

## Business Flow Diagram

```
Cron Job (Scheduler)
    ↓
1. Identify Subscriptions Due for Debit
    ↓
2. Publish to Kafka Topic
    ↓
3. Kafka Consumer Processes Message
    ↓
4. Call Subscription Checkout
    ↓
5. Cart Service Processes Payment
    ↓
6. Payment Success Notification
    ↓
7. Subscription Renewal Success Notify
    ↓
8. Gold Allocation & Portfolio Update
    ↓
9. Next Due Date Update
    ↓
10. Subscription Active & Notifications
```

## Detailed Business Flow Steps

### Step 1: Cron Job - Subscription Identification
**Business Purpose**: System identifies subscriptions that are due for debit.

**What Happens**:
- Cron job runs at scheduled times (e.g., daily at 1 AM, 4 AM, 8 AM, 1 PM, 4 PM, 10 PM)
- System queries `subscription` table for subscriptions:
  - Status: `1` (Active) or `3` (Active with retry)
  - `next_due_date` is today or in the past
  - `next_due_date` is before or equal to `end_date`
  - Payment mode is UPI or PPBL (for certain schedules)
  - Pre-debit notify status is not SUCCESS or SKIP (if applicable)
- System filters subscriptions based on:
  - Payment mode (UPI, PPBL, CC, DC)
  - Plan ID (special handling for plan_id = 1)
  - Pre-debit notify status
  - Retry count

**Output**: List of subscriptions due for debit

---

### Step 2: Kafka Message Publishing
**Business Purpose**: System publishes subscription details to Kafka for processing.

**What Happens**:
- System creates Kafka message with subscription details:
  - Subscription ID
  - Customer ID
  - Plan ID
  - Amount/Grams
  - Payment mode
  - Next due date
  - Other subscription details
- System publishes message to Kafka topic: `subscription_process`
- Message is queued for processing

**Output**: Kafka message published

---

### Step 3: Kafka Consumer Processing
**Business Purpose**: Kafka consumer receives message and processes subscription debit.

**What Happens**:
- Kafka consumer receives message from topic
- Consumer validates message
- Consumer calls subscription checkout endpoint
- Consumer handles retry logic (for plan_id = 1)

**Key Operations**:
- For plan_id = 1: Sets retry count to max (3) before processing
- Processes dates (start_date, end_date, next_due_date)
- Calls subscription checkout API

**Output**: Checkout request initiated

---

### Step 4: Subscription Checkout
**Business Purpose**: System creates order and initiates payment for subscription installment.

**What Happens**:
- System validates subscription exists and is active
- System validates next due date matches today (for immediate checkout)
- System creates order record in database with status: **Pending (13)**
- System initiates payment with payment gateway (Cart service)
- Payment gateway processes payment using saved payment method:
  - Saved card (for CC/DC)
  - UPI (for UPI)
  - PPBL (for PPBL)
- Payment gateway sends notification to system

**Database Operations**:
- **Table**: `dg_buy_orders`
  - **Status**: `13` (Pending)
  - **Fields Created**: order_id, customer_id, amount, product_id, merchant_id, status
  - **Metadata**: Contains subscription information (isSubscription: true, subscription_id)
- **Table**: `subscription_orders`
  - **Status**: `2` (PAYMENT_PENDING) or `13` (CART_CHECKOUT_SUCCESS)

**Output**: Payment processed by payment gateway

---

### Step 5: Payment Success Notification
**Business Purpose**: System receives payment success notification from Cart service.

**What Happens**:
- System receives notification from Cart service
- System validates order and subscription
- System routes to subscription renewal success notify handler

**Output**: Routes to subscription renewal handler

---

### Step 6: Subscription Renewal Success Notify
**Business Purpose**: System processes successful subscription installment payment.

**What Happens**:
1. **Order Validation**:
   - System validates order exists
   - System checks order status
   - System verifies subscription is active
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

5. **Subscription Update**:
   - System updates subscription:
     - Increments `installments` count
     - Updates `total_amount` (accumulated)
     - Updates `total_weight` (accumulated)
     - Updates `retry` count (resets to 0 on success)

6. **Subscription Order Update**:
   - System updates `subscription_orders` record
   - **Status**: `1` (PAYMENT_SUCCESS_CALLBACK_RECEIVED)
   - Records installment details

7. **Next Due Date Calculation**:
   - System calculates next due date based on plan frequency:
     - **Daily**: next_due_date = current_date + 1 day
     - **Weekly**: next_due_date = current_date + 7 days
     - **Monthly**: next_due_date = current_date + 30 days (approximately)
   - System updates `next_due_date` in subscription

8. **Transaction History**:
   - System creates transaction record in Elasticsearch
   - System updates Cart service status

9. **Notifications**:
   - System sends success notification to user
   - SMS, Email, Push notifications sent

**Database Operations**:
- **Table**: `dg_buy_orders`
  - **Status Update**: `13` → `7` (Success)
- **Table**: `subscription`
  - **Fields Updated**: installments, total_amount, total_weight, next_due_date, retry
- **Table**: `subscription_orders`
  - **Status Update**: `2` or `13` → `1` (PAYMENT_SUCCESS_CALLBACK_RECEIVED)
  - **Fields Updated**: amount, dg_status: 1, status: 1

---

### Step 7: Payment Failure Notification
**Business Purpose**: System handles payment failure scenarios.

**What Happens**:
- System receives failure notification
- System updates order status to: **0** (Failure)
- System updates subscription order status to: **0** (PAYMENT_FAILURE_CALLBACK_RECEIVED)
- System records failure reason/error code
- System updates subscription:
  - Increments `retry` count (decrements for plan_id = 1)
  - Updates failure details
- System sends failure notification to user
- System handles card/instrument failures:
  - Invalid card → SMS sent, card disabled for SIP
  - Insufficient balance → SMS sent
  - Card expired → Card disabled for SIP
- System may send message to Kafka for retry (if configured)

**Database Operations**:
- **Table**: `dg_buy_orders`
  - **Status Update**: `13` → `0` (Failure)
- **Table**: `subscription`
  - **Fields Updated**: retry (incremented or decremented)
- **Table**: `subscription_orders`
  - **Status Update**: `0` (PAYMENT_FAILURE_CALLBACK_RECEIVED)
  - **Fields Updated**: error_code, error_msg

---

### Step 8: Subscription Renewal Failure Notify
**Business Purpose**: System handles subscription renewal failure scenarios.

**What Happens**:
- System receives failure notification
- System updates subscription order status
- System records failure reason
- System sends failure notification to user
- System handles retry logic:
  - For plan_id = 1: Retry count is decremented
  - For other plans: Retry count may be incremented
- System may disable subscription if max retries exceeded

**Database Operations**:
- **Table**: `subscription_orders`
  - **Status Update**: `0` (PAYMENT_FAILURE_CALLBACK_RECEIVED)
- **Table**: `subscription`
  - **Fields Updated**: retry, status (may change to failed if max retries)

---

## Database Tables & Status Mapping

### Table: subscription
**Purpose**: Stores all subscription information

**Key Fields** (relevant for debit flow):
- `id` - Unique subscription identifier
- `customer_id` - Customer identifier
- `plan_id` - Plan identifier (frequency: daily, weekly, monthly)
- `next_due_date` - Next payment due date
- `payment_mode` - Payment mode (UPI, CC, DC, PPBL)
- `pg_sub_id` - Payment gateway subscription ID
- `saved_card_id` - Saved card ID (for card payments)
- `status` - Subscription status (1: Active, 2: Deleted, 3: Active with retry)
- `installments` - Number of installments completed
- `total_amount` - Total subscription amount accumulated
- `total_weight` - Total gold weight accumulated
- `retry` - Retry count (for failed debits)
- `predebit_notify_status` - Pre-debit notify status
- `predebit_notify_date` - Pre-debit notify date
- `end_date` - Subscription end date

**Status Values**:
- `1` - **Active**: Subscription is active and running
- `2` - **Deleted/Cancelled**: Subscription is cancelled
- `3` - **Active with Retry**: Subscription is active but has retry pending

---

### Table: subscription_orders
**Purpose**: Stores individual installment orders for subscriptions

**Key Fields**:
- `id` - Unique identifier
- `subscription_id` - Subscription identifier
- `order_id` - Order identifier (from dg_buy_orders)
- `amount` - Order amount
- `dg_status` - Digital gold status (1: Success, 0: Failure)
- `status` - Order status (SIP_ORDER_STATUS - see values below)
- `error_code` - Error code (if failure)
- `error_msg` - Error message (if failure)
- `pg_status` - Payment gateway status
- `pg_resp_code` - Payment gateway response code
- `created_at` - Order creation timestamp
- `updated_at` - Last update timestamp

**Status Values** (SIP_ORDER_STATUS):
- `0` - **PAYMENT_FAILURE_CALLBACK_RECEIVED**: Payment failed
- `1` - **PAYMENT_SUCCESS_CALLBACK_RECEIVED**: Payment successful
- `2` - **PAYMENT_PENDING**: Payment pending
- `13` - **CART_CHECKOUT_SUCCESS**: Checkout successful
- `14` - **PAYMENT_INITIATION_FAILED**: Payment initiation failed
- `15` - **PAYMENT_CONFIRMATION_FAILED**: Payment confirmation failed (Not in use)

---

### Table: dg_buy_orders
**Same as Buy Flow** - See `01_BUY_FLOW.md` for details

**Key Points**:
- Order is created with subscription metadata (isSubscription: true, subscription_id)
- Status flow: 13 (Pending) → 7 (Success) or 0 (Failure)
- Contains subscription information in metadata

---

## Status Flow Diagram

### Success Flow:
```
Cron Job Identifies Subscription
    ↓
Kafka Message Published
    ↓
Consumer Processes Message
    ↓
Checkout Initiated
    ↓
Order Status: 13 (Pending)
Subscription Order Status: 2 (PAYMENT_PENDING) or 13 (CART_CHECKOUT_SUCCESS)
    ↓
Payment Success
    ↓
Order Processing
    ↓
Order Status: 7 (Success)
    ↓
Subscription Renewal Success
    ↓
Subscription Order Status: 1 (PAYMENT_SUCCESS_CALLBACK_RECEIVED)
    ↓
Portfolio Updated
    ↓
Next Due Date Updated
    ↓
Installment Count Incremented
    ↓
Transaction Complete
```

### Failure Flow:
```
Cron Job Identifies Subscription
    ↓
Kafka Message Published
    ↓
Consumer Processes Message
    ↓
Checkout Initiated
    ↓
Order Status: 13 (Pending)
Subscription Order Status: 2 (PAYMENT_PENDING)
    ↓
Payment Failure
    ↓
Order Status: 0 (Failure)
    ↓
Subscription Order Status: 0 (PAYMENT_FAILURE_CALLBACK_RECEIVED)
    ↓
Retry Count Updated
    ↓
Error Recorded
    ↓
Failure Notification Sent
```

---

## Business Rules & Decision Points

### 1. Subscription Selection
- **Rule**: Only active subscriptions with due date are selected
- **Criteria**:
  - Status: 1 (Active) or 3 (Active with retry)
  - next_due_date <= today
  - next_due_date <= end_date
  - Payment mode matches schedule criteria

### 2. Immediate Checkout
- **Rule**: Checkout happens only if next_due_date is today
- **Action**: If next_due_date is future, checkout is skipped

### 3. Payment Processing
- **Rule**: Payment uses saved payment method
- **Action**: 
  - Card payments: Uses saved_card_id
  - UPI: Uses UPI method
  - PPBL: Uses PPBL method

### 4. Retry Logic
- **Rule**: Different retry logic for different plan IDs
- **Action**:
  - plan_id = 1: Retry count set to max (3) before processing, decremented on failure
  - Other plans: Retry count may be incremented on failure

### 5. Next Due Date Calculation
- **Rule**: Next due date calculated based on plan frequency
- **Action**: 
  - Daily: +1 day
  - Weekly: +7 days
  - Monthly: +30 days (approximately)

### 6. Subscription Completion
- **Rule**: Subscription continues until end_date or cancellation
- **Action**: System processes installments until end_date or user cancels

### 7. Failure Handling
- **Rule**: Failed installments are retried based on retry count
- **Action**: 
  - Max retries: Configurable (e.g., 3 for plan_id = 1)
  - After max retries: Subscription may be disabled

### 8. Pre-debit Notify
- **Rule**: Pre-debit notify is sent before debit (for certain payment modes)
- **Action**: 
  - CC/DC: Pre-debit notify sent
  - UPI/PPBL: Pre-debit notify may be skipped
  - PPI: Pre-debit notify status set to 'SKIP'

---

## Error Scenarios & Handling

### Payment Failure - Retryable
- **Scenario**: Payment fails but retry count not exceeded
- **Status**: 
  - Order status → `0` (Failure)
  - Subscription order status → `0` (PAYMENT_FAILURE_CALLBACK_RECEIVED)
  - Subscription retry count updated
- **Action**: System retries on next scheduled run

### Payment Failure - Max Retries Exceeded
- **Scenario**: Payment fails and max retries exceeded
- **Status**: 
  - Order status → `0` (Failure)
  - Subscription order status → `0` (PAYMENT_FAILURE_CALLBACK_RECEIVED)
  - Subscription status may change to failed
- **Action**: Subscription may be disabled, user notified

### Card/Instrument Failure
- **Scenario**: Card is invalid, expired, or insufficient balance
- **Status**: Subscription status remains `1` (Active) but payment fails
- **Action**: 
  - Invalid/Expired card: Card disabled for SIP, SMS sent
  - Insufficient balance: SMS sent, retry on next due date

### Subscription Not Found
- **Scenario**: Subscription doesn't exist or is cancelled
- **Status**: Order not created
- **Action**: Message is skipped, no processing

### Next Due Date Mismatch
- **Scenario**: Next due date doesn't match today
- **Status**: Checkout skipped
- **Action**: Subscription processed on correct due date

---

## Notifications

### Success Notifications
- **SMS**: Installment success confirmation with installment number and amount
- **Email**: Installment success email (if configured)
- **Push**: In-app notification (if configured)
- **Content**: Installment details, gold weight, total accumulated, next due date

### Failure Notifications
- **SMS**: Failure notification with reason and retry information
- **Email**: Failure notification email (if configured)
- **Push**: In-app notification (if configured)
- **Content**: Failure reason, retry count, card/instrument status, next retry date

---

## Key Business Metrics

### Success Metrics
- Total subscription debits processed
- Debit success rate
- Average installment amount
- Processing time
- On-time payment rate

### Failure Metrics
- Debit failure rate
- Retry success rate
- Card/instrument failure rate
- Max retry exceeded rate

---

## Important Business Notes

1. **Automated Processing**: Debits are processed automatically via cron jobs and Kafka

2. **Scheduled Processing**: Multiple cron schedules for different payment modes

3. **Retry Mechanism**: Failed debits are retried based on retry count

4. **Next Due Date**: Critical for scheduling future installments

5. **Payment Method**: Uses saved payment method for recurring payments

6. **Idempotency**: Order processing is idempotent

7. **Async Processing**: System processes debits asynchronously via Kafka

8. **State Management**: Subscription state and order state are managed separately

9. **Accumulation**: Total amount and weight are accumulated over installments

10. **Failure Recovery**: Failed installments can be retried, but subscription may be disabled after max retries

---

## Related Flows

- **Buy Flow**: See `01_BUY_FLOW.md` for regular buy transactions
- **Sell Flow**: See `02_SELL_FLOW.md` for selling gold
- **SIP Create Flow**: See `03_SIP_CREATE_FLOW.md` for subscription creation

