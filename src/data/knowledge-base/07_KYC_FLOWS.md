# KYC FLOWS - Knowledge Base

## Overview
This document describes the complete KYC (Know Your Customer) flows for Digital Gold platform. It covers all KYC-related APIs, verification processes, status management, and database operations from a business perspective.

## KYC Purpose

KYC verification is required for:
- **High-value transactions**: Orders exceeding certain amount limits
- **Sell transactions**: Bank account verification for fund transfers
- **Regulatory compliance**: As per financial regulations

---

## KYC Flow Overview

### Complete KYC Flow Diagram

```
User Initiates KYC
    ↓
1. KYC Consent Acceptance
    ↓
2. PAN Verification
    ↓
3. Aadhaar Verification (via Digio)
    ↓
4. Live Photo Upload
    ↓
5. Bank Account Verification
    ↓
6. Document Verification (Admin)
    ↓
7. KYC Status: VERIFIED
```

---

## KYC APIs

### 1. KYC Consent APIs

#### GET `/v2/gold/consent/:consentname`
**Purpose**: Fetch consent terms and conditions

**Consent Names**:
- `mmtckyc` - MMTC KYC consent
- `pricedrop` - Price drop consent
- `cashbacktogoldback` - Cashback to Goldback consent

**What Happens**:
- System fetches consent terms from KYC service
- Returns consent code, version, and URL

**Response**: Consent terms with code, version, and URL

---

#### GET `/v2/gold/user/consent/:consentname`
**Purpose**: Check if user has already accepted consent

**What Happens**:
- System checks if user has accepted the consent
- Returns consent status

**Response**: 
- `consent: true` - If already accepted
- Error if not accepted

---

#### POST `/v2/gold/user/consent/:consentname`
**Purpose**: Save user's consent acceptance/rejection

**Request Body**:
- `accepted` - Boolean (true/false)

**What Happens**:
- System saves user's consent decision
- Consent is stored in KYC service
- User can accept or reject consent

**Response**: Consent saved successfully

---

#### POST `/v2/gold/user/kycConsent`
**Purpose**: Save KYC consent (Deprecated - use consent API above)

**What Happens**:
- System saves KYC consent
- Validates user can use KYC details
- Updates MMTC profile if needed

---

### 2. KYC Status APIs

#### GET `/v2/gold/kyc/status`
**Purpose**: Get complete KYC status for customer

**What Happens**:
- System fetches KYC status from database
- Returns status of all KYC components:
  - KYC status and substatus
  - PAN status
  - Bank account status
  - Live photo status
  - Aadhaar status

**Response Structure**:
```json
{
  "customerId": "123456",
  "kycStatus": 1,
  "kycSubstatus": 132,
  "kycId": 789,
  "pan": {
    "status": 1,
    "remarks": ""
  },
  "bank": {
    "status": 1
  },
  "livePhoto": {
    "status": 1,
    "remarks": "",
    "reuploadEnabled": true
  },
  "aadhar": {
    "status": 1,
    "remarks": ""
  }
}
```

---

#### GET `/v1/gold/customer/kyc/status`
**Purpose**: Get KYC verification status (for high-value transactions)

**What Happens**:
- System checks if KYC request is pending
- Checks bank verification status at PPBL
- Compares PAN and bank details
- Updates KYC details at MMTC if verified
- Returns verification status

**Response**: KYC verification status (SUCCESS, PENDING, FAILURE)

---

### 3. PAN Verification APIs

#### POST `/v2/gold/customer/verify/pan`
**Purpose**: Verify customer PAN number

**Request Body**:
- `pan_no` - PAN number to verify

**What Happens**:
1. System checks if PAN is already verified
2. System verifies PAN number with PAN verification service
3. System saves PAN details in database
4. System updates KYC status and substatus

**Database Updates**:
- **Table**: `pan_info`
  - Creates/updates PAN record
  - Sets status: `1` (VERIFIED)
- **Table**: `kyc`
  - Updates substatus based on PAN verification result

**Response**: PAN verification result

---

#### PUT `/v2/gold/customer/pan/confirm`
**Purpose**: Confirm PAN verification after user confirmation

**Request Body**:
- `id` - PAN ID
- `metadata.log` - Longitude
- `metadata.lat` - Latitude

**What Happens**:
- System confirms PAN verification
- Updates KYC substatus to `PAN_CONFIRMED` (102)
- Updates PAN status

**Response**: PAN confirmation successful

---

#### PUT `/v1/gold/admin/pan/name`
**Purpose**: Admin API to update PAN name

**What Happens**:
- Admin can update PAN name in database
- Used for corrections

---

### 4. Bank Account Verification APIs

#### POST `/v1/gold/customer/verify/:type`
**Purpose**: Verify KYC details (PAN or Bank Account)

**Type Values**:
- `PAN` - PAN verification
- `BANK_ACC_NO` - Bank account verification

**Request Body** (for BANK_ACC_NO):
- `acc_no` - Bank account number
- `ifsc_code` - IFSC code

**Request Body** (for PAN):
- `acc_no` - PAN number (field name is acc_no for PAN)

**What Happens**:
1. **For PAN**:
   - Verifies PAN number
   - Stores PAN details in Redis
   - Returns PAN verification result

2. **For Bank Account**:
   - Checks if PAN is verified first
   - Initiates bank account verification
   - Stores verification request in Redis
   - Returns verification status (SUCCESS, PENDING, FAILURE)

**Redis Keys**:
- `{customerId}_pan` - PAN details (1 day TTL)
- `{customerId}_kycbankinitiated` - Bank verification initiated flag
- `{customerId}_kycbankpending` - Bank verification pending details

**Response**: Verification status

---

#### GET `/v1/gold/customer/kyc/status`
**Purpose**: Check bank account verification status

**What Happens**:
- System checks bank verification status at PPBL
- If verified, updates KYC details at MMTC
- Returns current verification status

**Response**: Verification status (SUCCESS, PENDING, FAILURE)

---

#### POST `/v1/gold/bank/verify`
**Purpose**: Verify bank account for high-value transactions

**Request Body**:
- Bank account details

**What Happens**:
- System validates bank account
- Matches bank name with KYC name
- Saves bank data
- Initiates verification

**Response**: Bank verification result

---

#### PUT `/v1/gold/bank/status`
**Purpose**: Update bank account status

**What Happens**:
- System updates bank account status
- Matches bank and KYC names
- Updates bank data in database

**Response**: Bank status updated

---

#### GET `/v1/gold/bank/accounts`
**Purpose**: Get all bank accounts for customer

**What Happens**:
- System fetches all bank accounts
- Returns masked account numbers
- Includes high-value verification status

**Response**: List of bank accounts

---

#### GET `/v1/gold/customer/panandbank`
**Purpose**: Get PAN and bank account details

**What Happens**:
- System fetches PAN details
- System fetches bank account details
- Returns combined information

**Response**: PAN and bank account details

---

#### POST `/v1/gold/customer/bankaccount`
**Purpose**: Update bank account details for high-value transactions

**Request Body**:
- Bank account details

**What Happens**:
- System validates update request
- Checks if PAN is verified
- Verifies bank account details
- Matches KYC names
- Updates bank details

**Response**: Bank account updated

---

#### GET `/v1/gold/customer/bankaccounts`
**Purpose**: Get high-value bank accounts (Deprecated)

**What Happens**:
- System fetches high-value verified bank accounts
- Returns masked account numbers

---

### 5. Live Photo APIs

#### POST `/v1/gold/livephoto`
**Purpose**: Upload live photo for KYC

**Request Body**:
- `customer_id` - Customer ID
- `lat` - Latitude
- `long` - Longitude
- `image` - Image file

**What Happens**:
1. System validates request (lat, long required)
2. System checks if customer has pending KYC
3. System checks if live photo already exists
4. System uploads image to S3
5. System performs face match with Aadhaar photo
6. System saves image details to database
7. System updates KYC substatus

**Face Match Process**:
- Compares live photo with Aadhaar photo
- If match: Auto-verifies live photo
- If no match: Sets status to PENDING for admin review

**Database Updates**:
- **Table**: `live_photo`
  - Creates record with status: `PENDING` or `VERIFIED` (if auto-verified)
  - Stores S3 document reference
  - Stores location (lat, long)
- **Table**: `kyc`
  - Updates substatus: `LIVEPHOTO_UPLOAD_SUCCESS` (121) or `LIVEPHOTO_VERIFIED` (122)

**Response**: Live photo upload success

---

#### PUT `/v1/gold/livephoto`
**Purpose**: Re-upload live photo (for rejected/reupload cases)

**Request Body**:
- `customer_id` - Customer ID
- `lat` - Latitude
- `long` - Longitude
- `image` - Image file

**What Happens**:
1. System validates customer has reupload status
2. System checks retry count (max 3 attempts)
3. System uploads new image to S3
4. System updates live photo record
5. System increments retry count
6. System updates KYC status to PENDING

**Database Updates**:
- **Table**: `live_photo`
  - Updates status to `PENDING`
  - Updates document reference
  - Increments count
- **Table**: `kyc`
  - Updates status to `PENDING`
  - Updates substatus to `LIVEPHOTO_REUPLOAD` (141)

**Response**: Live photo re-upload success

---

### 6. Aadhaar Verification APIs

#### POST `/v1/gold/digio/initiate`
**Purpose**: Initiate Aadhaar verification via Digio

**What Happens**:
- System creates Digio request for Aadhaar verification
- Returns Digio request details

**Response**: Digio request information

---

#### GET `/v1/gold/digio/authorise`
**Purpose**: Authorize and complete Aadhaar verification

**What Happens**:
- System processes Digio authorization
- Completes Aadhaar verification
- Stores Aadhaar details

**Response**: Aadhaar verification result

---

#### GET `/v1/gold/admin/aadhaar/name`
**Purpose**: Admin API to get Aadhaar name

**What Happens**:
- Admin can fetch Aadhaar name for verification

---

### 7. Document Verification APIs (Admin)

#### PUT `/v1/gold/admin/verify/Documents/`
**Purpose**: Admin API to verify/reject KYC documents

**Request Body**:
- `customer_id` - Customer ID
- `kycId` - KYC ID
- `action` - APPROVED or REJECTED
- `remarks` - Remarks (optional)

**What Happens**:
1. System validates document is pending for approval
2. System updates live photo status:
   - **APPROVED**: Status → `VERIFIED` (1), KYC status → `VERIFIED` (1)
   - **REJECTED**: 
     - If retry count < 3: Status → `REUPLOAD` (6), KYC status → `REUPLOAD` (7)
     - If retry count >= 3: KYC status → `REJECTED` (6)
3. System updates KYC status accordingly
4. System checks if bank account is verified:
   - If bank verified and approved: KYC status → `VERIFIED`
   - If bank not verified and approved: KYC substatus → `LIVEPHOTO_VERIFIED`
5. System creates/updates MMTC profile if approved

**Database Updates**:
- **Table**: `live_photo`
  - Updates status and remarks
  - Records approved_by and approved_on
- **Table**: `kyc`
  - Updates status based on action
  - Updates substatus if needed

**Response**: Document verification result

---

#### GET `/v1/gold/admin/verify/documents/`
**Purpose**: Admin API to get KYC documents for verification

**Query Parameters**:
- `page` - Page number
- `size` - Page size
- `livePhotoStatus` - Live photo status filter
- `kycStatus` - KYC status filter
- `fromDate` - From date (default: 90 days ago)
- `toDate` - To date (default: today)

**What Happens**:
- System fetches KYC documents pending verification
- Returns paginated list of documents
- Includes customer details, document references, status

**Response**: Paginated list of KYC documents

---

#### GET `/v1/gold/admin/verify/documents/:customerid`
**Purpose**: Admin API to get KYC documents for specific customer

**What Happens**:
- System fetches KYC documents for specific customer
- Returns customer KYC details including:
  - Live photo document reference
  - Aadhaar document reference
  - Customer address
  - Phone number

**Response**: Customer KYC documents

---

#### GET `/v1/gold/document/`
**Purpose**: Get document image from S3

**Query Parameters**:
- Document reference

**What Happens**:
- System fetches document image from S3
- Returns image file

**Response**: Document image

---

#### GET `/v1/gold/admin/kycuser/count`
**Purpose**: Admin API to get KYC user counts by status

**What Happens**:
- System counts users by KYC status
- Returns counts for:
  - Live photo pending, verified, auto-verified, reupload
  - KYC initiated, verified, rejected
  - Bank verified, PAN verified, Aadhaar verified

**Response**: KYC user counts

---

#### GET `/v1/gold/admin/kycuser/search`
**Purpose**: Admin API to search KYC users

**What Happens**:
- System searches KYC users based on criteria
- Returns matching users

**Response**: List of matching KYC users

---

### 8. KYC Management APIs

#### DELETE `/v2/gold/customer/kyc/delete`
**Purpose**: Customer deletes their own KYC

**What Happens**:
- System deletes all KYC-related records:
  - KYC record
  - Live photo record
  - PAN info record
  - Aadhaar record
  - Bank details record

**Response**: KYC deleted successfully

---

#### DELETE `/v2/gold/admin/customer/kyc/delete/:customerId`
**Purpose**: Admin API to delete customer KYC

**What Happens**:
- Admin can delete KYC for any customer
- Deletes all KYC-related records

**Response**: KYC deleted successfully

---

### 9. Admin Bank Account APIs

#### POST `/v1/gold/admin/addbankaccount`
**Purpose**: Admin API to add bank account for customer

**Request Body**:
- Bank account details

**What Happens**:
- Admin adds bank account for customer
- System performs fraud checks
- Saves bank details

**Response**: Bank account added

---

#### GET `/v1/gold/admin/bankaccount/verify`
**Purpose**: Admin API to list bank accounts for verification

**What Happens**:
- System lists bank accounts pending verification
- Returns bank account details

**Response**: List of bank accounts

---

#### PUT `/v1/gold/admin/bankaccount/verify`
**Purpose**: Admin API to approve bank account details

**Request Body**:
- Bank account approval details

**What Happens**:
- Admin approves bank account
- System updates bank account status

**Response**: Bank account approved

---

## KYC Status Values

### KYC Status (Main Status)

**Location**: `configuration/constants.js` - `KYC_STATUS_ENUMS`

- `15` - **PENDING**: KYC verification in progress
- `1` - **VERIFIED**: KYC verification completed successfully
- `0` - **CANCELLED**: KYC verification cancelled
- `6` - **REJECTED**: KYC verification rejected
- `7` - **REUPLOAD**: KYC documents need to be re-uploaded

---

### KYC Sub-Status

**Location**: `configuration/constants.js` - `KYC_SUB_STATUS_ENUMS`

**PAN Related**:
- `100` - **INVALID_PAN_NUMBER**: PAN number is invalid
- `101` - **VALID_PAN_NUMBER**: PAN number is valid
- `102` - **PAN_CONFIRMED**: PAN verification confirmed by user

**Aadhaar Related**:
- `110` - **INVALID_AADHAAR**: Aadhaar verification failed
- `111` - **VALID_AADHAAR**: Aadhaar verification successful

**Live Photo Related**:
- `121` - **LIVEPHOTO_UPLOAD_SUCCESS**: Live photo uploaded successfully
- `122` - **LIVEPHOTO_VERIFIED**: Live photo verified (auto or manual)
- `141` - **LIVEPHOTO_REUPLOAD**: Live photo needs to be re-uploaded

**Bank Account Related**:
- `130` - **BANK_ACCOUNT_PENDING**: Bank account verification pending
- `131` - **BANK_ACCOUNT_REJECTED**: Bank account verification rejected
- `132` - **BANK_ACCOUNT_VERIFIED**: Bank account verification successful

---

### PAN Status

**Location**: `configuration/constants.js` - `PAN_STATUS_ENUMS`

- `1` - **VERIFIED**: PAN is verified

---

### Aadhaar Status

**Location**: `configuration/constants.js` - `AADHAAR_STATUS`

- `0` - **FAILED**: Aadhaar verification failed
- `1` - **VERIFIED**: Aadhaar verification successful
- `15` - **PENDING**: Aadhaar verification pending

---

### Bank Status

**Location**: `configuration/constants.js` - `BANK_STATUS_ENUMS`

- `15` - **PENDING**: Bank account verification pending
- `1` - **VERIFIED**: Bank account verified
- `0` - **CANCELLED**: Bank account verification cancelled
- `6` - **REJECTED**: Bank account verification rejected

---

### Live Photo Status

**Location**: `configuration/constants.js` - `LIVE_PHOTO_STATUS_ENUM`

- `15` - **PENDING**: Live photo pending verification
- `1` - **VERIFIED**: Live photo verified
- `6` - **REUPLOAD**: Live photo needs to be re-uploaded

---

## Database Tables

### 1. kyc
**Purpose**: Main KYC table storing overall KYC status

**Key Fields**:
- `id` - Primary key
- `customer_id` - Customer identifier
- `status` - KYC status (KYC_STATUS_ENUMS)
- `substatus` - KYC substatus (KYC_SUB_STATUS_ENUMS)
- `phone_number` - Customer phone number
- `source` - KYC source
- `locker_balance` - Locker balance
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Status Values**: See KYC Status section above

---

### 2. pan_info
**Purpose**: Stores PAN verification details

**Key Fields**:
- `id` - Primary key
- `customer_id` - Customer identifier
- `pan_number` - Encrypted PAN number
- `status` - PAN status (1: VERIFIED)
- `name` - Name from PAN
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

---

### 3. aadhaar
**Purpose**: Stores Aadhaar verification details

**Key Fields**:
- `id` - Primary key
- `customer_id` - Customer identifier
- `status` - Aadhaar status (AADHAAR_STATUS)
- `name` - Name from Aadhaar
- `address` - Address from Aadhaar (JSON)
- `doc_reff` - Document reference (S3 key)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

---

### 4. live_photo
**Purpose**: Stores live photo upload details

**Key Fields**:
- `id` - Primary key
- `customer_id` - Customer identifier
- `status` - Live photo status (LIVE_PHOTO_STATUS_ENUM)
- `doc_reff` - Document reference (S3 key)
- `location` - Location coordinates (JSON: lat, long)
- `count` - Retry count (max 3)
- `remarks` - Remarks from admin
- `approved_by` - Admin who approved/rejected
- `approved_on` - Approval timestamp
- `approval_metadata` - Approval metadata (JSON)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

---

### 5. user_bank_details
**Purpose**: Stores bank account verification details

**Key Fields**:
- `id` - Primary key
- `customer_id` - Customer identifier
- `account_number` - Encrypted account number
- `ifsc_code` - IFSC code
- `status` - Bank status (BANK_STATUS_ENUMS)
- `name` - Account holder name
- `pan_number` - Associated PAN number
- `is_high_value` - High value verification flag
- `penny_amount` - Penny drop amount
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

---

## KYC Flow Steps

### Step 1: KYC Consent
**Purpose**: User accepts KYC consent terms

**What Happens**:
- User views consent terms
- User accepts consent
- Consent is saved in KYC service

**APIs Used**:
- GET `/v2/gold/consent/:consentname`
- POST `/v2/gold/user/consent/:consentname`

---

### Step 2: PAN Verification
**Purpose**: Verify customer PAN number

**What Happens**:
1. User provides PAN number
2. System verifies PAN with PAN verification service
3. System extracts name from PAN
4. System saves PAN details
5. System updates KYC substatus to `VALID_PAN_NUMBER` (101)
6. User confirms PAN (optional step)
7. System updates substatus to `PAN_CONFIRMED` (102)

**APIs Used**:
- POST `/v2/gold/customer/verify/pan`
- PUT `/v2/gold/customer/pan/confirm`

**Database Updates**:
- **Table**: `pan_info` - PAN record created/updated
- **Table**: `kyc` - Substatus updated

---

### Step 3: Aadhaar Verification
**Purpose**: Verify customer Aadhaar

**What Happens**:
1. System initiates Aadhaar verification via Digio
2. User completes Aadhaar verification
3. System stores Aadhaar details
4. System updates KYC substatus to `VALID_AADHAAR` (111)
5. Aadhaar photo is stored for face match

**APIs Used**:
- POST `/v1/gold/digio/initiate`
- GET `/v1/gold/digio/authorise`

**Database Updates**:
- **Table**: `aadhaar` - Aadhaar record created/updated
- **Table**: `kyc` - Substatus updated

---

### Step 4: Live Photo Upload
**Purpose**: Upload live photo for identity verification

**What Happens**:
1. User uploads live photo with location (lat, long)
2. System validates KYC is in PENDING status with VALID_AADHAAR
3. System uploads image to S3
4. System performs face match with Aadhaar photo:
   - **If match**: Auto-verifies (status: VERIFIED)
   - **If no match**: Sets status to PENDING for admin review
5. System saves live photo details
6. System updates KYC substatus:
   - `LIVEPHOTO_UPLOAD_SUCCESS` (121) - If pending
   - `LIVEPHOTO_VERIFIED` (122) - If auto-verified

**APIs Used**:
- POST `/v1/gold/livephoto`

**Database Updates**:
- **Table**: `live_photo` - Live photo record created
- **Table**: `kyc` - Substatus updated

---

### Step 5: Bank Account Verification
**Purpose**: Verify bank account for high-value transactions

**What Happens**:
1. System checks if PAN is verified
2. User provides bank account details (account number, IFSC)
3. System initiates bank account verification (penny drop)
4. System stores verification request in Redis
5. Verification status can be:
   - **SUCCESS**: Bank verified immediately
   - **PENDING**: Verification in progress
   - **FAILURE**: Verification failed
6. If pending, user can check status later
7. System updates KYC substatus:
   - `BANK_ACCOUNT_PENDING` (130) - If pending
   - `BANK_ACCOUNT_VERIFIED` (132) - If verified
   - `BANK_ACCOUNT_REJECTED` (131) - If rejected

**APIs Used**:
- POST `/v1/gold/customer/verify/BANK_ACC_NO`
- GET `/v1/gold/customer/kyc/status`
- POST `/v1/gold/bank/verify`

**Database Updates**:
- **Table**: `user_bank_details` - Bank account record created/updated
- **Table**: `kyc` - Substatus updated

**Redis Keys**:
- `{customerId}_kycbankinitiated` - Bank verification initiated
- `{customerId}_kycbankpending` - Bank verification pending details

---

### Step 6: Document Verification (Admin)
**Purpose**: Admin verifies live photo document

**What Happens**:
1. Admin reviews live photo document
2. Admin approves or rejects:
   - **APPROVED**:
     - Live photo status → `VERIFIED` (1)
     - If bank verified: KYC status → `VERIFIED` (1)
     - If bank not verified: KYC substatus → `LIVEPHOTO_VERIFIED` (122)
     - MMTC profile created/updated
   - **REJECTED**:
     - If retry count < 3:
       - Live photo status → `REUPLOAD` (6)
       - KYC status → `REUPLOAD` (7)
       - KYC substatus → `LIVEPHOTO_REUPLOAD` (141)
     - If retry count >= 3:
       - KYC status → `REJECTED` (6)

**APIs Used**:
- PUT `/v1/gold/admin/verify/Documents/`

**Database Updates**:
- **Table**: `live_photo` - Status and remarks updated
- **Table**: `kyc` - Status updated based on action

---

### Step 7: KYC Completion
**Purpose**: KYC is marked as verified

**What Happens**:
- All components verified:
  - PAN: Verified
  - Aadhaar: Verified
  - Live Photo: Verified
  - Bank Account: Verified (for high-value)
- KYC status → `VERIFIED` (1)
- Customer can perform high-value transactions

---

## KYC Status Flow

### Complete Verification Flow:
```
KYC Initiated
    ↓
KYC Status: PENDING (15)
    ↓
PAN Verified
    ↓
KYC Substatus: VALID_PAN_NUMBER (101) → PAN_CONFIRMED (102)
    ↓
Aadhaar Verified
    ↓
KYC Substatus: VALID_AADHAAR (111)
    ↓
Live Photo Uploaded
    ↓
KYC Substatus: LIVEPHOTO_UPLOAD_SUCCESS (121) or LIVEPHOTO_VERIFIED (122)
    ↓
Bank Account Verified (for high-value)
    ↓
KYC Substatus: BANK_ACCOUNT_VERIFIED (132)
    ↓
Admin Verifies Documents (if needed)
    ↓
KYC Status: VERIFIED (1)
```

### Rejection Flow:
```
Live Photo Uploaded
    ↓
Admin Rejects (Retry Count < 3)
    ↓
KYC Status: REUPLOAD (7)
Live Photo Status: REUPLOAD (6)
    ↓
User Re-uploads Live Photo
    ↓
KYC Status: PENDING (15)
    ↓
Admin Reviews Again
```

### Final Rejection Flow:
```
Live Photo Uploaded
    ↓
Admin Rejects (Retry Count >= 3)
    ↓
KYC Status: REJECTED (6)
    ↓
User cannot proceed with high-value transactions
```

---

## High-Value Order Verification

### When KYC is Required

**Rule**: Orders exceeding `NON_HIGH_VALUE_TXN_AMOUNT_MAX_LIMIT` (₹1,00,000) require KYC verification

**What Happens**:
1. System checks order amount
2. If amount > limit:
   - System checks KYC status
   - If KYC not verified: Order is blocked
   - User must complete KYC first
3. If amount <= limit:
   - KYC not required
   - Order can proceed

**Maximum Buy Amount**: `MAX_BUY_AMOUNT_KYC_VERFIED` (₹1,00,00,000)

---

## KYC Name Matching

### Name Matching Rules

1. **PAN and Bank Name Match**:
   - PAN name must match bank account holder name
   - System compares names during verification

2. **OAuth Name Match**:
   - KYC name should match OAuth profile name
   - System validates name consistency

3. **Name Matching Process**:
   - System extracts names from PAN, bank, OAuth
   - System compares names
   - If mismatch: Verification may fail or require admin review

---

## Redis Caching

### Redis Keys Used

1. **PAN Details**: `{customerId}_pan`
   - TTL: 1 day
   - Stores: Encrypted PAN, decrypted PAN, name

2. **Bank Verification Initiated**: `{customerId}_kycbankinitiated`
   - TTL: 1 day
   - Stores: "true" flag

3. **Bank Verification Pending**: `{customerId}_kycbankpending`
   - TTL: 1 day
   - Stores: Bank verification request details (JSON)

4. **KYC Pending for MMTC Update**: `{customerId}_kyc`
   - TTL: Configurable
   - Stores: KYC details pending MMTC update

5. **Face Match**: `{customerId}-kyc_face_match`
   - TTL: Temporary
   - Stores: Aadhaar photo for face match

---

## Error Handling

### Common Error Scenarios

1. **PAN Already Verified**:
   - Error: PAN is already verified for this customer
   - Action: Cannot verify again

2. **PAN Already Registered**:
   - Error: PAN is registered with another customer
   - Action: Cannot use same PAN

3. **Bank Verification Pending**:
   - Error: Bank verification already in progress
   - Action: Wait for verification or check status

4. **KYC Not Ready for Bank Addition**:
   - Error: KYC status not ready for bank account addition
   - Action: Complete previous KYC steps first

5. **Live Photo Upload Limit Exceeded**:
   - Error: Maximum 3 re-upload attempts exceeded
   - Action: KYC is rejected, contact support

6. **KYC Request Not Found**:
   - Error: No pending KYC request found
   - Action: Initiate new KYC request

---

## Important Notes

1. **KYC Components**:
   - PAN verification is mandatory
   - Aadhaar verification is mandatory
   - Live photo is mandatory
   - Bank account verification is required for high-value transactions

2. **Status Progression**:
   - KYC status progresses through substatuses
   - Each component has its own status
   - Overall KYC status is determined by all components

3. **Face Match**:
   - Live photo is automatically verified if face matches Aadhaar
   - If no match, admin review is required
   - Face match reduces manual verification workload

4. **Retry Mechanism**:
   - Live photo can be re-uploaded up to 3 times
   - After 3 attempts, KYC is rejected
   - User must contact support for further assistance

5. **Bank Verification**:
   - Bank verification uses penny drop mechanism
   - Verification can be immediate or take time
   - Status can be checked via status API

6. **MMTC Integration**:
   - Verified KYC details are updated at MMTC
   - MMTC profile is created/updated on KYC verification
   - Required for merchant transactions

7. **Admin Verification**:
   - Admin can verify/reject documents
   - Admin can update PAN names
   - Admin can add bank accounts
   - Admin can delete KYC records

8. **Consent Management**:
   - Multiple consent types supported
   - User can accept/reject consents
   - Consent status is tracked

9. **High-Value Transactions**:
   - KYC is mandatory for high-value orders
   - System checks KYC status before allowing transaction
   - KYC verification enables higher transaction limits

10. **Data Security**:
    - PAN and bank account numbers are encrypted
    - Documents are stored in S3
    - Access is controlled via authentication

---

## Related Documentation

- **Buy Flow**: See `01_BUY_FLOW.md` - KYC check during buy
- **Sell Flow**: See `02_SELL_FLOW.md` - Bank verification for sell
- **Merchant & Product Maintenance**: See `05_MERCHANT_PRODUCT_MAINTENANCE.md`

---

## Summary

The KYC flow is a multi-step verification process:

1. **Consent**: User accepts KYC consent
2. **PAN Verification**: PAN number is verified
3. **Aadhaar Verification**: Aadhaar is verified via Digio
4. **Live Photo**: User uploads live photo (auto or manual verification)
5. **Bank Account**: Bank account is verified for high-value transactions
6. **Admin Verification**: Admin verifies documents if needed
7. **Completion**: KYC status becomes VERIFIED

**Key Features**:
- Multiple verification components
- Automatic face match for live photo
- Redis caching for verification data
- Admin review and approval
- Status tracking at multiple levels
- Integration with MMTC for merchant transactions

This comprehensive KYC system ensures regulatory compliance and enables high-value transactions for verified customers.

