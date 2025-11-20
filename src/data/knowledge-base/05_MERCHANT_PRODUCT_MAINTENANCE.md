# MERCHANT & PRODUCT MAINTENANCE - Knowledge Base

## Overview
This document describes the merchant and product configuration structure for Digital Gold platform. It explains how merchants and products are configured, their relationships, and how to maintain them across different environments.

## Merchants

The platform supports **3 main merchants**:

1. **MMTC-PAMP** - 24K 99.99% Purity Gold
2. **MMTC-PAMP-V2** - 24K 99.95% Purity Gold
3. **AUGMONT** - 24K 99.90% Purity Gold

---

## Merchant Configuration Structure

### Merchant Information Fields

Each merchant is configured with the following information:

- **id** - Unique merchant identifier (numeric string)
- **merchant** - Merchant name (MMTC-PAMP, MMTC-PAMP-V2, AUGMONT)
- **purity** - Gold purity level (24K 99.99% Purity, 24K 99.95% Purity, 24K 99.90% Purity)
- **defaultProfileName** - Default profile name for customer creation
- **defaultProfilePin** - Default pincode for customer profile
- **IMPS_MID** - IMPS Merchant ID for fund transfers

### Environment-Specific Merchant IDs

#### Production Environment
- **MMTC-PAMP**: 
  - Primary: `332337`
  - Secondary: `332333`
- **MMTC-PAMP-V2**: `1505574`
- **AUGMONT**: 
  - Primary: `1039572`
  - Secondary: `1040199`

#### Staging Environment
- **MMTC-PAMP**: 
  - Primary: `267076`
  - Secondary: `267075`
- **MMTC-PAMP-V2**: `267077`
- **AUGMONT**: 
  - Primary: `598759`
  - Secondary: `602523`

#### Local Environment
- Uses staging configuration merged with local overrides
- **MMTC-PAMP-V2**: `267077` (local override)

### Default Merchant Configuration

Each environment has default merchant settings:

- **DEFAULT_MERCHANT_ID** - Default merchant for transactions
- **MMTC_MERCHANT_ID** - Default MMTC merchant ID
- **BI_MERCHANT_ID** - Default Bullion India (AUGMONT) merchant ID
- **MINIMUM_TXN_AMOUNT** - Minimum transaction amount (typically 1)

### Supported Merchants by Transaction Type

Merchants are configured for specific transaction types:

- **buy** - Supported merchants for buy transactions
- **goldback** - Supported merchants for goldback transactions

### Redeem Merchant Mapping

Some merchant IDs are mapped to different merchant IDs for redeem transactions:

- **Production**: 
  - `332333` → `332337` (MMTC-PAMP)
  - `1040199` → `1039572` (AUGMONT)
- **Staging**: 
  - `267075` → `267076` (MMTC-PAMP)
  - `602523` → `598759` (AUGMONT)

---

## Product Configuration Structure

### Product Information Fields

Each product is configured with the following information:

- **id** - Unique product identifier (numeric string)
- **name** - Product name (e.g., "24K 99.99% Purity Gold")
- **displayName** - Display name shown to users (e.g., "24K 99.99% Purity")
- **type** - Product type (see Product Types below)
- **merchant** - Associated merchant name
- **merchantId** - Associated merchant ID
- **subType** - Optional subtype (e.g., "GOLD_COIN")

### Product Types

Products are categorized by type:

1. **BUY** - Products for buying gold
2. **SELL** - Products for selling gold
3. **GSP** - Gold Subscription Plan (SIP products)
4. **REDEEM** - Products for redeeming gold
5. **COMMISSION** - Commission products
6. **P2P** - Peer-to-peer transfer products

### Environment-Specific Product IDs

#### Production Environment

**Buy Products**:
- **MMTC-PAMP**: `79469686` (24K 99.99% Purity)
- **MMTC-PAMP-V2**: `635850270` (24K 99.95% Purity)
- **AUGMONT**: `218670066` (24K 99.90% Purity)
- **Gold Coin (MMTC-PAMP-V2)**: `651002322` (24K 99.95% Purity)

**Sell Products**:
- **MMTC-PAMP**: `113077196` (24K 99.99% Purity)
- **MMTC-PAMP-V2**: `635850272` (24K 99.95% Purity)
- **AUGMONT**: `218670193` (24K 99.90% Purity)

**SIP Products (GSP)**:
- **MMTC-PAMP**: `333615133` (24K 99.99% Purity)
- **MMTC-PAMP-V2**: `635850271` (24K 99.95% Purity) - Nested SIP Product ID

**Commission Products**:
- **MMTC-PAMP**: `642670935` (24K 99.99% Purity)

**Redeem Products**:
- Multiple redeem product IDs for different merchants and scenarios

#### Staging Environment

**Buy Products**:
- **MMTC-PAMP**: `63779640` (24K 99.99% Purity)
- **MMTC-PAMP-V2**: `63779641` (24K 99.95% Purity)
- **AUGMONT**: `1200139867` (24K 99.90% Purity)
- **Gold Coin (MMTC-PAMP-V2)**: `1235529285` (24K 99.95% Purity)

**Sell Products**:
- **MMTC-PAMP**: `63794205` (24K 99.99% Purity)
- **MMTC-PAMP-V2**: `1235517632` (24K 99.95% Purity)
- **AUGMONT**: `1200139866` (24K 99.90% Purity)

**SIP Products (GSP)**:
- **MMTC-PAMP**: `1201990981` (24K 99.99% Purity)
- **MMTC-PAMP-V2**: `1200137890` (24K 99.99% Purity) - Nested SIP Product ID

**Commission Products**:
- **MMTC-PAMP**: `1235520415` (24K 99.99% Purity)

**Redeem Products**:
- Multiple redeem product IDs for different merchants and scenarios

---

## Transaction Type to Default Product Mapping

Each merchant has a mapping of transaction types to default product IDs:

### Transaction Types

- **buy** - Buy transactions
- **sell** - Sell transactions
- **automatic** - Automatic transactions (SIP)
- **sent** - P2P sent transactions
- **received** - P2P received transactions
- **p2p** - Peer-to-peer transactions
- **p2p_v2_gold** - P2P V2 gold transactions
- **redeem** - Redeem transactions
- **buy_reversal** - Buy reversal transactions
- **sell_reversal** - Sell reversal transactions
- **automatic_reversal** - Automatic reversal transactions
- **redeem_reversal** - Redeem reversal transactions
- **commission** - Commission transactions
- **gold_coin** - Gold coin transactions

### Example Mapping (Production - MMTC-PAMP-V2)

```
merchantId: 1505574
  buy: '635850270'
  sell: '635850272'
  p2p: '635850270'
  p2p_v2_gold: '635850270'
  gold_coin: '651002322'
```

### Example Mapping (Production - MMTC-PAMP)

```
merchantId: 332337
  buy: '79469686'
  sell: '113077196'
  commission: '642670935'
  automatic: '333615133'
  sent: '79469686'
  received: '79469686'
  p2p: '79469686'
  redeem: '79469686'
  buy_reversal: '79469686'
  sell_reversal: '113077196'
  automatic_reversal: '333615133'
  redeem_reversal: '79469686'
```

---

## Product Lists and Constants

### Buy Product IDs
List of all product IDs that support buy transactions:
- **Production**: `['79469686', '218670066', '651002322']`
- **Staging**: `['63779640', '1200139867', '1235529285']`

### Product Purities
List of supported gold purities:
- `'24K 99.99% Purity Gold'`
- `'24K 99.95% Purity Gold'`
- `'24K 99.90% Purity Gold'`

### Recommended Product Priorities
Order of merchant preference:
- `['MMTC-PAMP', 'AUGMONT']`

### HSN Codes
- **Standard Gold**: `71081300`
- **99.90% Purity Gold**: `7114`
- **MMTC V2 Gold**: `71081300`

### Default Product ID
- **Production**: `79469686`
- **Staging**: `63779640`

---

## Relationship Between Merchants and Products

### One-to-Many Relationship
- One merchant can have multiple products
- Each product belongs to one merchant
- Products are linked to merchants via `merchantId` field

### Product-Merchant Mapping Rules

1. **Buy Products**: Each merchant has at least one buy product
2. **Sell Products**: Each merchant has at least one sell product
3. **SIP Products**: Each merchant may have SIP products (GSP type)
4. **Redeem Products**: Each merchant may have multiple redeem products
5. **Commission Products**: Some merchants have commission products

### Merchant-Product Compatibility

- **MMTC-PAMP**: 99.99% purity products
- **MMTC-PAMP-V2**: 99.95% purity products
- **AUGMONT**: 99.90% purity products

---

## Adding a New Merchant

### Steps to Add a New Merchant

1. **Add Merchant Information**:
   - Add merchant entry in merchant configuration
   - Assign unique merchant ID
   - Set merchant name, purity, default profile details
   - Set IMPS_MID for fund transfers

2. **Add Products**:
   - Create buy product with type: 'BUY'
   - Create sell product with type: 'SELL'
   - Optionally create SIP product with type: 'GSP'
   - Optionally create redeem products with type: 'REDEEM'

3. **Update Transaction Type Mappings**:
   - Add TXN_TYPE_TO_DEFAULT_PRODUCT mapping for the merchant
   - Map all transaction types to appropriate product IDs

4. **Update Supported Merchants**:
   - Add merchant to supportedMerchants.buy list
   - Add merchant to supportedMerchants.goldback list (if applicable)

5. **Update Default Merchant** (if needed):
   - Update DEFAULT_MERCHANT_ID if this becomes the default
   - Update MMTC_MERCHANT_ID or BI_MERCHANT_ID if applicable

6. **Update Redeem Mapping** (if needed):
   - Add entry to redeem_merchant_map if required

---

## Adding a New Product

### Steps to Add a New Product

1. **Create Product Entry**:
   - Assign unique product ID
   - Set product name and displayName
   - Set product type (BUY, SELL, GSP, etc.)
   - Link to merchant via merchantId
   - Set merchant name

2. **Update Transaction Type Mapping**:
   - Add product ID to appropriate transaction type in TXN_TYPE_TO_DEFAULT_PRODUCT
   - Update for the merchant this product belongs to

3. **Update Product Lists** (if applicable):
   - Add to BUY_PRODUCT_IDS if it's a buy product
   - Add to PRODUCT_PURITIES if it's a new purity
   - Update other relevant lists

4. **Special Cases**:
   - **SIP Products**: Ensure nested SIP product ID is configured
   - **Gold Coin**: Set subType: 'GOLD_COIN'
   - **P2P Products**: Configure p2p product entries

---

## Modifying Existing Merchant/Product

### Important Considerations

1. **Environment Consistency**:
   - Ensure changes are made in correct environment (local, staging, production)
   - Local environment merges staging configuration

2. **ID Uniqueness**:
   - Merchant IDs must be unique within an environment
   - Product IDs must be unique within an environment

3. **Backward Compatibility**:
   - Changing product IDs may affect existing orders
   - Changing merchant IDs may affect existing transactions
   - Consider impact on historical data

4. **Transaction Type Mappings**:
   - Ensure all transaction types have valid product mappings
   - Use '0' for transaction types not supported by a merchant

5. **Default Products**:
   - Ensure default product IDs exist and are valid
   - Update DEFAULT_PRODUCT_ID if changing default

---

## Environment Configuration

### Environment Selection

Configuration is selected based on `NODE_ENV` environment variable:
- `production` - Production environment
- `staging` - Staging environment
- `local` or default - Local environment (merges staging + local)

### Local Environment Behavior

- Local environment merges staging configuration with local overrides
- Local-specific entries override staging entries
- Useful for development and testing

---

## Key Product IDs by Flow

### Buy Flow
- **Production**: `635850270` (MMTC-PAMP-V2)
- **Staging**: `63779641` (MMTC-PAMP-V2)

### Sell Flow
- **Production**: `635850272` (MMTC-PAMP-V2)
- **Staging**: `1235517632` (MMTC-PAMP-V2)

### SIP Create Flow
- **Production**: `635850270` (Nested SIP: `635850271`)
- **Staging**: `1200137890` (Nested SIP: `1200137890`)

---

## Important Notes

1. **Merchant ID vs Product ID**:
   - Merchant ID identifies the merchant
   - Product ID identifies the specific product
   - Multiple products can belong to the same merchant

2. **Product Type Importance**:
   - Product type determines transaction flow
   - BUY products use buy flow
   - SELL products use sell flow
   - GSP products use SIP flow

3. **Purity Levels**:
   - Different merchants support different purity levels
   - Purity affects pricing and product availability

4. **Default Product Selection**:
   - System uses TXN_TYPE_TO_DEFAULT_PRODUCT to select default product
   - Default product is used when product ID is not specified

5. **Environment-Specific IDs**:
   - Same merchant/product may have different IDs in different environments
   - Always verify environment before making changes

6. **Nested SIP Products**:
   - SIP create flow uses nested product ID
   - Nested product ID is configured in product info

7. **Redeem Merchant Mapping**:
   - Some merchant IDs are mapped to different merchant IDs for redeem
   - This allows redirecting redeem transactions to specific merchants

8. **Commission Products**:
   - Commission products are used for commission transactions
   - Only certain merchants have commission products

9. **Gold Coin Products**:
   - Gold coin products have subType: 'GOLD_COIN'
   - Used for physical gold coin purchases

10. **P2P Products**:
    - P2P products are configured separately
    - Used for peer-to-peer gold transfers

---

## Troubleshooting

### Common Issues

1. **Product Not Found**:
   - Verify product ID exists in correct environment
   - Check product type matches transaction type
   - Verify merchant ID is correct

2. **Merchant Not Found**:
   - Verify merchant ID exists in correct environment
   - Check merchant is in supportedMerchants list
   - Verify environment configuration

3. **Transaction Type Mapping Missing**:
   - Check TXN_TYPE_TO_DEFAULT_PRODUCT has entry for merchant
   - Verify product ID in mapping exists
   - Check transaction type is supported

4. **Default Product Issues**:
   - Verify DEFAULT_PRODUCT_ID exists
   - Check product is valid for transaction type
   - Verify merchant configuration

---

## Related Documentation

- **Buy Flow**: See `01_BUY_FLOW.md`
- **Sell Flow**: See `02_SELL_FLOW.md`
- **SIP Create Flow**: See `03_SIP_CREATE_FLOW.md`
- **SIP Debit Flow**: See `04_SIP_DEBIT_FLOW.md`

---

## Configuration Files

- **Merchant Configuration**: `configuration/merchant_info.js`
- **Product Configuration**: `configuration/product_info.js`

---

## Summary

This knowledge base provides a comprehensive guide to merchant and product maintenance. Key points:

- **3 Main Merchants**: MMTC-PAMP, MMTC-PAMP-V2, AUGMONT
- **Multiple Product Types**: BUY, SELL, GSP, REDEEM, COMMISSION, P2P
- **Environment-Specific**: Different IDs for production, staging, and local
- **Transaction Type Mapping**: Each merchant has default products for each transaction type
- **Relationship**: One merchant can have multiple products, each product belongs to one merchant

When adding or modifying merchants/products, ensure consistency across all environments and verify transaction type mappings are complete.

