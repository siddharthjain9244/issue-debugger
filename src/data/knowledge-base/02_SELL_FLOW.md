# SELL FLOW - Business Flow Knowledge Base

## Overview
This document describes the complete sell flow for Digital Gold transactions from a business perspective, including all steps, status transitions, database operations, and decision points.

## Product IDs
- **Production**: 635850272
- **Staging**: 1235517632

## Business Flow Diagram

```
User (Frontend)
    ↓
1. Request Gold Sell Price Quote
    ↓
2. Validate Portfolio Balance
    ↓
3. Create Order & Initiate Payment
    ↓
4. User Completes Payment
    ↓
5. Payment Success Notification Received
    ↓
6. Gold Deduction from Portfolio
    ↓
7. Fund Transfer Initiation
    ↓
8. Transfer Success & Notifications
```

## Detailed Business Flow Steps

### Step 1: Price Quote Request
**Business Purpose**: User requests current gold sell price and gets a locked quote.

**What Happens**:
- System fetches current gold sell price from merchant (MMTC-PAMP)
- Price includes transfer fees
- Quote is blocked/locked for a specific time period
- User receives quote details:
  - Price per gram
  - Total recoverable amount (after fees)
  - Transfer fees
  - Net amount to be credited

**Output**: Quote with expiry time

---

### Step 2: User Details (Optional - for UPI)
**Business Purpose**: For UPI-based sell transactions, system fetches user UPI details.

**What Happens**:
- System validates UPI availability
- System fetches user VPA (Virtual Payment Address)
- System validates UPI is active

**Note**: This step is optional and only for UPI sell transactions.

---

### Step 3: Portfolio Validation & Order Creation
**Business Purpose**: System validates user has sufficient gold and creates sell order.

**What Happens**:
- System validates user authentication
- System validates product availability
- **System validates portfolio balance** (user must have sufficient gold)
- System validates bank account/UPI details
- System performs KYC checks (if required)
- System creates order record in database with status: **Pending (13)**
- System initiates payment with payment gateway (Cart service)
- User is redirected to payment page

**Database Operations**:
- **Table**: `dg_sell_orders`
- **Status**: `13` (Pending)
- **Fields Created**: order_id, customer_id, amount, gram_weight, bank_acc, ifsc_code, product_id, merchant_id, status

**Output**: Payment URL for user

---

### Step 4: User Payment
**Business Purpose**: User completes payment through payment gateway.

**Payment Methods Supported**:
- UPI
- Bank Transfer (IMPS)
- Paytm Payments Bank (PPBL)

**What Happens**:
- User selects payment method
- User completes payment
- Payment gateway processes payment
- Payment gateway sends notification to system

---

### Step 5: Payment Success Notification
**Business Purpose**: System receives payment confirmation and processes the sell order.

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
   - **Status Changes**: `13` (Pending) → `14` (Portfolio Updated)
   - System deducts gold from customer portfolio
   - Portfolio balance is decreased
   - Gold is sold at merchant

4. **Order Status Update**:
   - System updates order with:
     - Merchant order ID
     - Quote ID
     - Fulfillment ID
     - Gold weight (grams)
     - Total amount
     - Recoverable amount

5. **Fund Transfer Initiation**:
   - **Status Changes**: `14` (Portfolio Updated) → `15` (Pending at BPay)
   - **Transfer Status**: `PENDING`
   - System initiates fund transfer:
     - **IMPS Transfer**: For bank account
     - **UPI Transfer**: For UPI/VPA
   - System records transfer details

6. **Transfer Success**:
   - **Status Changes**: `15` (Pending at BPay) → `7` (Success)
   - **Transfer Status**: `TXN_SUCCESS`
   - System receives transfer confirmation
   - System updates transfer tracking ID (for IMPS)

7. **Transaction History**:
   - System creates transaction record in Elasticsearch
   - System updates Cart service status

8. **Notifications**:
   - System sends success notification to user
   - SMS, Email, Push notifications sent

**Database Operations**:
- **Table**: `dg_sell_orders`
- **Status Updates**: 
  - `13` → `14` (Portfolio Updated)
  - `14` → `15` (Pending at BPay)
  - `15` → `7` (Success)
- **Transfer Status Updates**:
  - `PENDING` → `TXN_SUCCESS`
- **Fields Updated**: 
  - status, fulfillment_id, quote_id, mmtc_order_id, gram_weight, total_amount
  - transfer_status, transfer_response, transfer_status_code
  - imps_track_id (for IMPS), bank_acc, ifsc_code

---

### Step 6: Payment Failure Notification
**Business Purpose**: System handles payment failure scenarios.

**What Happens**:
- System receives failure notification
- System updates order status to: **0** (Failure)
- System records failure reason/error code
- System sends failure notification to user

**Database Operations**:
- **Table**: `dg_sell_orders`
- **Status Update**: `13` → `0` (Failure)
- **Fields Updated**: status, dgErrorCode

---

### Step 7: Transfer Failure Handling
**Business Purpose**: System handles fund transfer failure scenarios.

**What Happens**:
- System receives transfer failure notification
- **Transfer Status**: `TXN_FAILURE` or other failure statuses
- System records failure reason
- System determines if retry is possible:
  - **Hopeless Responses**: Certain errors are marked as hopeless (no retry)
  - **Retryable Errors**: System can retry automatically or manually
- System sends failure notification to user
- User can update bank details and retry

**Transfer Failure Statuses**:
- `TXN_FAILURE` - Transfer failed
- `TXN_FAILURE_CONFIG_ERROR` - Configuration error
- `TXN_FAILURE_UPDATE_REQUIRED` - Bank details update required

**Hopeless Transfer Responses** (No Retry):
- Invalid Bank / NBIN
- Invalid Account Number
- Amount limit exceeded
- Bank account number is invalid
- Amount Range Crossed
- Frozen Account
- Invalid IFSC Code
- NRE Account
- Closed Account
- Unauthorized API access
- IFSC Code is NULL

---

## Database Tables & Status Mapping

### Table: dg_sell_orders
**Purpose**: Stores all sell order information

**Key Fields**:
- `order_id` - Unique order identifier
- `order_item_id` - Order item identifier
- `customer_id` - Customer identifier
- `merchant_id` - Merchant identifier
- `product_id` - Product identifier
- `amount` - Order amount
- `total_amount` - Total amount after fees
- `gram_weight` - Gold weight in grams
- `bank_acc` - Bank account number
- `ifsc_code` - IFSC code
- `status` - Order status (see status values below)
- `transfer_status` - Transfer status (see transfer status values below)
- `transfer_response` - Transfer response details
- `transfer_status_code` - Transfer status code
- `imps_track_id` - IMPS tracking ID
- `fulfillment_id` - Fulfillment service ID
- `quote_id` - Merchant quote ID
- `mmtc_order_id` - Merchant order ID
- `dgErrorCode` - Error code (if failure)
- `info` - Additional order information (JSON)
- `settlement_initiation_time` - Settlement initiation timestamp
- `created_at` - Order creation timestamp
- `updated_at` - Last update timestamp

**Status Values**:
- `13` - **Pending**: Order created, payment initiated
- `14` - **Portfolio Updated**: Gold deducted from portfolio
- `15` - **Pending at BPay**: Transfer initiated, waiting for completion
- `7` - **Success**: Transfer completed successfully
- `0` - **Failure**: Payment failed or merchant cancelled
- `6` - **Cancelled**: Order cancelled

**Transfer Status Values** (SELL_TRANSFER_STATUS_ENUM):
- `TXN_SUCCESS` - Transfer successful
- `PENDING` - Transfer pending
- `TXN_FAILURE` - Transfer failed
- `TXN_FAILURE_CONFIG_ERROR` - Configuration error
- `TXN_FAILURE_UPDATE_REQUIRED` - Bank details update required

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
Portfolio Updated
    ↓
Status: 14 (Portfolio Updated)
    ↓
Transfer Initiated
    ↓
Status: 15 (Pending at BPay)
Transfer Status: PENDING
    ↓
Transfer Success
    ↓
Status: 7 (Success)
Transfer Status: TXN_SUCCESS
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

### Transfer Failure Flow:
```
Status: 14 (Portfolio Updated)
    ↓
Transfer Initiated
    ↓
Status: 15 (Pending at BPay)
Transfer Status: PENDING
    ↓
Transfer Failure
    ↓
Status: 15 (Pending at BPay)
Transfer Status: TXN_FAILURE
    ↓
Retry Logic (if applicable)
    ↓
Manual Retry or Update Bank Details
```

---

## Business Rules & Decision Points

### 1. Portfolio Validation
- **Rule**: User must have sufficient gold in portfolio before sell
- **Action**: If insufficient balance, order is rejected

### 2. Bank Account Validation
- **Rule**: Bank account/UPI details must be valid
- **Action**: System validates before transfer initiation

### 3. Penny Drop (Optional)
- **Rule**: Optional validation step before actual transfer
- **Action**: System can validate bank account with small amount

### 4. Transfer Status Management
- **Rule**: Transfer status is separate from order status
- **Action**: Tracks fund transfer state independently

### 5. Retry Mechanism
- **Rule**: Failed transfers can be retried automatically or manually
- **Action**: 
  - Automatic retry for retryable errors
  - Manual retry by admin
  - User can update bank details and retry

### 6. Fraud Prevention
- **Rule**: Fraud checks are performed before updating bank details
- **Action**: 
  - Old bank details validation (48 hours threshold)
  - Fraud analysis (68 hours max, 1 hour non-fraud)

### 7. Hopeless Responses
- **Rule**: Certain error responses are marked as hopeless
- **Action**: No retry for hopeless responses, user must update details

---

## Error Scenarios & Handling

### Payment Failure
- **Scenario**: User payment fails
- **Status**: Order status → `0` (Failure)
- **Action**: User can retry payment or cancel order

### Portfolio Insufficient Balance
- **Scenario**: User doesn't have enough gold
- **Status**: Order rejected at validation
- **Action**: User cannot proceed with sell

### Transfer Failure - Retryable
- **Scenario**: Transfer fails but error is retryable
- **Status**: Order status → `15` (Pending at BPay), Transfer status → `TXN_FAILURE`
- **Action**: System retries automatically or user can retry manually

### Transfer Failure - Hopeless
- **Scenario**: Transfer fails with hopeless error (invalid account, etc.)
- **Status**: Order status → `15` (Pending at BPay), Transfer status → `TXN_FAILURE`
- **Action**: User must update bank details and retry

### Transfer Failure - Config Error
- **Scenario**: Configuration error in transfer
- **Status**: Transfer status → `TXN_FAILURE_CONFIG_ERROR`
- **Action**: System configuration needs to be fixed

### Transfer Failure - Update Required
- **Scenario**: Bank details need to be updated
- **Status**: Transfer status → `TXN_FAILURE_UPDATE_REQUIRED`
- **Action**: User must update bank details

---

## Notifications

### Success Notifications
- **SMS**: Sell confirmation with order ID, amount, and transfer details
- **Email**: Sell confirmation email (if configured)
- **Push**: In-app notification (if configured)
- **Content**: Order details, gold weight, amount, transfer status

### Failure Notifications
- **SMS**: Failure notification with reason and retry instructions
- **Email**: Failure notification email (if configured)
- **Push**: In-app notification (if configured)
- **Content**: Failure reason, bank details update instructions (if applicable)

### Transfer Failure Notifications
- **SMS**: Transfer failure notification with reason
- **Email**: Transfer failure notification (if configured)
- **Content**: Failure reason, bank details update instructions, retry options

---

## Key Business Metrics

### Success Metrics
- Total sell orders
- Total sell amount
- Success rate
- Average order value
- Processing time
- Transfer success rate

### Failure Metrics
- Failure rate
- Transfer failure rate
- Failure reasons breakdown
- Retry success rate
- Bank details update rate

---

## Important Business Notes

1. **Portfolio Validation**: Critical step - user must have sufficient gold before sell

2. **Dual Status Tracking**: Order status and transfer status are tracked separately for better visibility

3. **Gold Deduction**: Gold is deducted from portfolio immediately after payment success (Status 14)

4. **Fund Transfer**: Fund transfer is initiated after gold deduction (Status 15)

5. **Retry Mechanism**: Failed transfers can be retried, but hopeless errors require bank details update

6. **Fraud Prevention**: Fraud checks prevent unauthorized bank details updates

7. **Idempotency**: Order processing is idempotent - same order can be processed multiple times safely

8. **Async Processing**: System responds immediately and processes asynchronously

9. **State Management**: Order state transitions are managed systematically

10. **Transfer Tracking**: IMPS transfers have tracking IDs for monitoring

---

## Related Flows

- **Buy Flow**: See `01_BUY_FLOW.md` for buying gold
- **SIP Create Flow**: See `03_SIP_CREATE_FLOW.md` for subscription creation
- **SIP Debit Flow**: See `04_SIP_DEBIT_FLOW.md` for subscription debit
