# SIP CREATE FLOW - Business Flow Knowledge Base

## Overview
This document describes the complete SIP (Systematic Investment Plan) creation flow for Digital Gold subscriptions from a business perspective, including all steps, status transitions, database operations, and decision points.

## Product IDs
- **Production**: 635850270 (Nested SIP Product ID: 635850271)
- **Staging**: 1200137890 (Nested SIP Product ID: 1200137890)

## Business Flow Diagram

```
User (Frontend)
    ↓
1. Request Gold Price Quote for Subscription
    ↓
2. Create Subscription & Order
    ↓
3. User Completes First Payment
    ↓
4. Payment Success Notification Received
    ↓
5. Subscription Activation
    ↓
6. Gold Allocation & Portfolio Update
    ↓
7. Next Due Date Calculation
    ↓
8. Subscription Active & Notifications
```

## Detailed Business Flow Steps

### Step 1: Price Quote Request
**Business Purpose**: User requests current gold price for subscription creation.

**What Happens**:
- System fetches current gold price from merchant (MMTC-PAMP)
- Price includes taxes and fees
- Quote is blocked/locked for a specific time period
- User receives quote details: price per gram, total amount, taxes

**Note**: Uses same product ID as buy flow but with subscription metadata.

**Output**: Quote with expiry time

---

### Step 2: Subscription Creation & Order Initiation
**Business Purpose**: User creates subscription and initiates first payment.

**What Happens**:
- System validates user authentication
- System validates product availability
- System performs KYC checks (for high-value subscriptions)
- **System creates subscription record** in database with status: **Initiated (11)**
- **System creates order record** in database with status: **Pending (13)**
- System stores subscription details:
  - Plan ID (frequency: daily, weekly, monthly)
  - Amount or grams per installment
  - Start date
  - End date
  - Payment mode preference
- System initiates payment with payment gateway (Cart service)
- User is redirected to payment page

**Database Operations**:
- **Table**: `subscription`
  - **Status**: `11` (Initiated)
  - **Fields Created**: id, customer_id, plan_id, amount, start_date, end_date, payment_mode, status
- **Table**: `dg_buy_orders`
  - **Status**: `13` (Pending)
  - **Fields Created**: order_id, customer_id, amount, product_id, merchant_id, status
  - **Metadata**: Contains subscription information (subs_flow: 2, gold_subs_id)

**Output**: Payment URL for user

---

### Step 3: User Payment
**Business Purpose**: User completes first payment for subscription.

**Payment Methods Supported**:
- UPI
- Net Banking
- Credit Card
- Debit Card
- Paytm Payments Bank (PPBL)
- Wallet
- Saved Card (for recurring payments)

**What Happens**:
- User selects payment method
- User completes payment
- Payment gateway processes payment
- Payment gateway creates subscription for recurring payments
- Payment gateway sends notification to system

---

### Step 4: Payment Success Notification
**Business Purpose**: System receives payment confirmation and processes the subscription.

**What Happens**:
1. **Order Processing**:
   - System validates order exists
   - System checks order status
   - System detects subscription create flow (subs_flow: 2)
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

5. **Subscription Activation**:
   - **Status Changes**: `11` (Initiated) → `1` (Active)
   - System updates subscription with:
     - Payment gateway subscription ID (pg_sub_id)
     - First order ID (subscription_order_id)
     - Saved card ID (if applicable)
     - Payment mode
     - Payment gateway status
     - Total amount

6. **Subscription Order Creation**:
   - System creates record in `subscription_orders` table
   - **Status**: `1` (PAYMENT_SUCCESS_CALLBACK_RECEIVED)
   - Records first installment details

7. **Next Due Date Calculation**:
   - System calculates next due date based on plan frequency:
     - **Daily**: Next day
     - **Weekly**: Next week
     - **Monthly**: Next month
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
  - **Status Update**: `11` → `1` (Active)
  - **Fields Updated**: pg_sub_id, subscription_order_id, saved_card_id, payment_mode, status, pg_status, total_amount
- **Table**: `subscription_orders`
  - **New Record**: subscription_id, order_id, amount, dg_status: 1, status: 1

---

### Step 5: Payment Failure Notification
**Business Purpose**: System handles payment failure scenarios.

**What Happens**:
- System receives failure notification
- System updates order status to: **0** (Failure)
- System updates subscription status to: **13** (Failed)
- System records failure reason/error code
- System sends failure notification to user
- System handles card/instrument failures:
  - Invalid card → SMS sent, card disabled for SIP
  - Insufficient balance → SMS sent
  - Card expired → Card disabled for SIP

**Database Operations**:
- **Table**: `dg_buy_orders`
  - **Status Update**: `13` → `0` (Failure)
- **Table**: `subscription`
  - **Status Update**: `11` → `13` (Failed)
- **Table**: `subscription_orders`
  - **Status Update**: `0` (PAYMENT_FAILURE_CALLBACK_RECEIVED)

---

## Database Tables & Status Mapping

### Table: subscription
**Purpose**: Stores all subscription information

**Key Fields**:
- `id` - Unique subscription identifier
- `customer_id` - Customer identifier
- `plan_id` - Plan identifier (frequency: daily, weekly, monthly)
- `merchant_id` - Merchant identifier
- `product_id` - Product identifier
- `unit_type` - Unit type (GRAMS or AMOUNT)
- `units` - Units per installment (amount or grams)
- `start_date` - Subscription start date
- `end_date` - Subscription end date
- `next_due_date` - Next payment due date
- `payment_mode` - Payment mode (UPI, CC, DC, etc.)
- `pg_sub_id` - Payment gateway subscription ID
- `pg_status` - Payment gateway status
- `saved_card_id` - Saved card ID (for card payments)
- `mid` - Merchant ID
- `total_amount` - Total subscription amount
- `total_weight` - Total gold weight accumulated
- `installments` - Number of installments completed
- `target_installments` - Target number of installments
- `status` - Subscription status (see status values below)
- `subscription_order_id` - First order ID
- `retry` - Retry count (for failed debits)
- `predebit_notify_status` - Pre-debit notify status
- `predebit_notify_date` - Pre-debit notify date
- `created_at` - Subscription creation timestamp
- `updated_at` - Last update timestamp

**Status Values**:
- `1` - **Active**: Subscription is active and running
- `2` - **Deleted/Cancelled**: Subscription is cancelled
- `11` - **Initiated**: Subscription created, first payment pending
- `13` - **Failed**: First payment failed

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
- Order is created with subscription metadata (subs_flow: 2, gold_subs_id)
- Status flow: 13 (Pending) → 7 (Success)
- Contains subscription information in metadata

---

## Status Flow Diagram

### Success Flow:
```
Subscription Created
    ↓
Subscription Status: 11 (Initiated)
Order Status: 13 (Pending)
    ↓
Payment Success
    ↓
Order Processing
    ↓
Order Status: 7 (Success)
    ↓
Subscription Activation
    ↓
Subscription Status: 1 (Active)
Subscription Order Status: 1 (PAYMENT_SUCCESS_CALLBACK_RECEIVED)
    ↓
Portfolio Updated
    ↓
Next Due Date Calculated
    ↓
Transaction Complete
```

### Failure Flow:
```
Subscription Created
    ↓
Subscription Status: 11 (Initiated)
Order Status: 13 (Pending)
    ↓
Payment Failure
    ↓
Order Status: 0 (Failure)
    ↓
Subscription Status: 13 (Failed)
Subscription Order Status: 0 (PAYMENT_FAILURE_CALLBACK_RECEIVED)
    ↓
Error Recorded
    ↓
Failure Notification Sent
```

---

## Business Rules & Decision Points

### 1. Subscription Creation
- **Rule**: Subscription is created before first payment
- **Action**: System creates subscription record with status 11 (Initiated)

### 2. First Payment
- **Rule**: First payment activates subscription
- **Action**: On payment success, subscription status changes to 1 (Active)

### 3. Payment Mode Handling
- **Rule**: Payment mode determines recurring payment behavior
- **Action**: 
  - Card payments: Saved card used for recurring payments
  - UPI/Net Banking: User needs to pay each time
  - PPI (Wallet): Pre-debit notify status set to 'SKIP'

### 4. Next Due Date Calculation
- **Rule**: Next due date calculated based on plan frequency
- **Action**: 
  - Daily: next_due_date = start_date + 1 day
  - Weekly: next_due_date = start_date + 7 days
  - Monthly: next_due_date = start_date + 30 days (approximately)

### 5. Subscription Order Tracking
- **Rule**: Each installment creates a subscription_order record
- **Action**: System tracks all installments separately

### 6. Failure Handling
- **Rule**: Payment failures are handled differently for subscriptions
- **Action**: 
  - Invalid card: Card disabled for SIP, SMS sent
  - Insufficient balance: SMS sent, retry later
  - Card expired: Card disabled for SIP

---

## Error Scenarios & Handling

### Payment Failure - First Installment
- **Scenario**: First payment fails
- **Status**: 
  - Order status → `0` (Failure)
  - Subscription status → `13` (Failed)
  - Subscription order status → `0` (PAYMENT_FAILURE_CALLBACK_RECEIVED)
- **Action**: User can retry payment or subscription remains failed

### Card/Instrument Failure
- **Scenario**: Card is invalid, expired, or insufficient balance
- **Status**: Subscription status remains `1` (Active) but payment fails
- **Action**: 
  - Invalid/Expired card: Card disabled for SIP, SMS sent
  - Insufficient balance: SMS sent, retry on next due date

### Subscription Creation Failure
- **Scenario**: Database or system error during creation
- **Status**: Subscription not created
- **Action**: User needs to retry subscription creation

---

## Notifications

### Success Notifications
- **SMS**: Subscription activation confirmation with subscription ID and first installment details
- **Email**: Subscription activation email (if configured)
- **Push**: In-app notification (if configured)
- **Content**: Subscription details, first installment amount, next due date

### Failure Notifications
- **SMS**: Failure notification with reason and retry instructions
- **Email**: Failure notification email (if configured)
- **Push**: In-app notification (if configured)
- **Content**: Failure reason, card/instrument status, retry options

---

## Key Business Metrics

### Success Metrics
- Total subscriptions created
- Subscription activation rate
- First payment success rate
- Average subscription amount
- Processing time

### Failure Metrics
- Subscription creation failure rate
- First payment failure rate
- Card/instrument failure rate
- Retry success rate

---

## Important Business Notes

1. **Dual Record Creation**: Both subscription and order records are created

2. **Subscription Activation**: Subscription is activated only after first payment success

3. **Next Due Date**: Critical for scheduling future installments

4. **Payment Mode**: Determines how recurring payments are processed

5. **PPI Handling**: PPI (Wallet) payments skip pre-debit notify

6. **Idempotency**: Order processing is idempotent

7. **Async Processing**: System responds immediately and processes asynchronously

8. **State Management**: Subscription state and order state are managed separately

9. **First Installment**: First installment activates subscription and sets up recurring payments

10. **Failure Recovery**: Failed subscriptions can be retried or cancelled

---

## Related Flows

- **Buy Flow**: See `01_BUY_FLOW.md` for regular buy transactions
- **Sell Flow**: See `02_SELL_FLOW.md` for selling gold
- **SIP Debit Flow**: See `04_SIP_DEBIT_FLOW.md` for recurring subscription debits
