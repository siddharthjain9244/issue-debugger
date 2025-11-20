/**
 * Wealthmgmt Database Schema
 * MySQL 8.0 - Digital Gold Wealth Management Platform
 * 
 * Each table is documented with:
 * - Table name and purpose
 * - Key columns and their types
 * - Relationships to other tables
 * - Common usage patterns
 */

export const DATABASE_SCHEMA = {
  // Customer Management Tables
  customer_portfolio: {
    name: 'customer_portfolio',
    description: 'Customer gold holdings and portfolio balances',
    purpose: 'Track customer gold balance by merchant',
    columns: {
      id: 'int unsigned PRIMARY KEY',
      merchant_id: 'bigint INDEXED - Gold merchant identifier',
      customer_id: 'bigint INDEXED - Links to customer table',
      name: 'varchar(256) - Portfolio name',
      pincode: 'varchar(20) INDEXED',
      gold_balance: 'decimal(15,4) - Current gold balance in grams',
      status: 'tinyint - Portfolio status',
      quantity: 'decimal(15,4) - Current gold quantity in grams',
      created_at: 'timestamp INDEXED',
      updated_at: 'timestamp'
    },
    relationships: [
      'customer_id links to customer',
      'merchant_id links to dg_merchants',
      'quantity affected by buy_orders, sell_orders, transfers'
    ],
    commonQueries: [
      'Get customer total gold balance',
      'Check portfolio balance by merchant',
      'Verify portfolio status for transactions',
      'Calculate weighted average purchase price'
    ]
  },

  kyc: {
    name: 'kyc',
    description: 'KYC verification status for customers',
    purpose: 'Track customer KYC compliance',
    columns: {
      id: 'bigint PRIMARY KEY',
      customer_id: 'bigint UNIQUE - Links to customer',
      status: 'int - KYC status (0=not_started, 1=pending, 2=approved, 3=rejected)',
      substatus: 'int - Detailed substatus',
      remarks: 'json - KYC remarks and notes',
      created_at: 'timestamp INDEXED',
      updated_at: 'timestamp',
      phone_number: 'varchar(255)'
    },
    relationships: [
      'One-to-one with customer',
      'Required for order approval'
    ],
    commonQueries: [
      'Check if customer KYC is approved',
      'Find customers with pending KYC',
      'KYC verification timeline'
    ]
  },

  pan_info: {
    name: 'pan_info',
    description: 'PAN card information for customers',
    purpose: 'Store and verify PAN details',
    columns: {
      id: 'bigint PRIMARY KEY',
      customer_id: 'bigint - Links to customer',
      pan_number: 'varchar - PAN card number',
      status: 'int - Verification status',
      created_at: 'timestamp',
      updated_at: 'timestamp'
    },
    relationships: [
      'customer_id links to customer',
      'Part of KYC process'
    ],
    commonQueries: [
      'Verify PAN for customer',
      'Check PAN verification status'
    ]
  },

  bank_accounts: {
    name: 'bank_accounts',
    description: 'Customer bank account details for payouts',
    purpose: 'Manage bank accounts for sell order settlements',
    columns: {
      id: 'int unsigned PRIMARY KEY',
      customer_id: 'int unsigned - Links to customer',
      name: 'varchar(255) - Account holder name',
      account_number: 'varchar(255) INDEXED - Bank account number',
      ifsc_code: 'varchar(255) - IFSC code',
      phone: 'varchar(255) INDEXED',
      trusted: 'tinyint INDEXED - Is this a verified/trusted account',
      created_at: 'timestamp INDEXED',
      updated_at: 'timestamp'
    },
    relationships: [
      'customer_id links to customer',
      'Used in dg_sell_orders for payouts'
    ],
    commonQueries: [
      'Get customer trusted bank accounts',
      'Verify bank account for sell order',
      'Find account by account_number'
    ]
  },

  // Order Tables
  dg_buy_orders: {
    name: 'dg_buy_orders',
    description: 'Gold purchase orders by customers',
    purpose: 'Track all gold buy transactions',
    columns: {
      id: 'int unsigned PRIMARY KEY',
      order_id: 'bigint - Unique order identifier',
      client_txnId: 'varchar(255) INDEXED - Client transaction ID',
      order_item_id: 'bigint INDEXED - Order line item',
      fulfillment_id: 'bigint INDEXED',
      status: 'smallint INDEXED - Order status (0=pending, 1=processing, 2=completed, 3=failed)',
      merchant_id: 'int - Merchant identifier',
      product_id: 'int - Product identifier',
      customer_id: 'bigint INDEXED - Customer who placed order',
      amount: 'decimal - Order amount in INR',
      gram_weight: 'decimal - Gold quantity in grams',
      rate: 'decimal - Gold rate at time of purchase',
      created_at: 'timestamp INDEXED',
      updated_at: 'timestamp',
      completed_at: 'timestamp'
    },
    relationships: [
      'customer_id links to customer',
      'merchant_id links to dg_merchants',
      'Updates customer_portfolio quantity on completion'
    ],
    commonQueries: [
      'Get customer order history',
      'Find orders by status',
      'Calculate total purchases in date range',
      'Check failed orders for debugging',
      'Sum gram_weight for portfolio reconciliation'
    ]
  },

  dg_sell_orders: {
    name: 'dg_sell_orders',
    description: 'Gold liquidation/sell orders by customers',
    purpose: 'Track gold sales and payouts',
    columns: {
      id: 'int unsigned PRIMARY KEY',
      order_id: 'bigint - Unique order identifier',
      order_item_id: 'bigint INDEXED',
      fulfillment_id: 'bigint INDEXED',
      status: 'tinyint INDEXED - Order status',
      status_updated_at: 'datetime INDEXED',
      merchant_id: 'int',
      product_id: 'int',
      customer_id: 'bigint INDEXED',
      amount: 'decimal - Sale amount in INR',
      gram_weight: 'decimal - Gold sold in grams',
      rate: 'decimal - Gold rate at sale',
      bank_acc: 'varchar - Bank account for payout',
      transfer_status: 'varchar - Bank transfer status',
      created_at: 'timestamp INDEXED',
      updated_at: 'timestamp'
    },
    relationships: [
      'customer_id links to customer',
      'bank_acc links to bank_accounts',
      'Reduces customer_portfolio gold_balance',
      'order_id in sell orders does not link with order_id in buy orders, it is a separate identifier for sell orders'
    ],
    commonQueries: [
      'Get sell order history',
      'Check payout/transfer status',
      'Find pending settlements',
      'Calculate total sales in period',
      'Reconcile portfolio with sell orders'
    ]
  },

  dg_goldback_orders: {
    name: 'dg_goldback_orders',
    description: 'Cashback and reward orders in gold',
    purpose: 'Track promotional gold credits',
    columns: {
      id: 'int unsigned PRIMARY KEY',
      txnId: 'varchar - Transaction ID',
      orderId: 'varchar - Associated order',
      customerRefNo: 'varchar - Customer reference',
      amount: 'decimal - Goldback amount in INR',
      gram_weight: 'decimal - Gold credited in grams',
      status: 'varchar - Order status',
      created_at: 'timestamp'
    },
    relationships: [
      'customerRefNo links to customer.customer_id',
      'Credits customer_portfolio'
    ],
    commonQueries: [
      'Find goldback credits for customer',
      'Calculate total rewards received'
    ]
  },

  // Subscription (SIP) Tables
  subscription: {
    name: 'subscription',
    description: 'Gold SIP (Systematic Investment Plan) subscriptions',
    purpose: 'Manage recurring gold purchase plans',
    columns: {
      id: 'int unsigned PRIMARY KEY',
      label: 'varchar(255) - Plan label',
      customer_id: 'varchar(255) INDEXED - Customer identifier',
      plan_id: 'int unsigned - Links to plan table',
      suggested_plan_id: 'int INDEXED',
      plan_type: 'varchar(255) - Type of SIP',
      plan_name: 'varchar(255) - Display name',
      merchant_id: 'int unsigned INDEXED',
      units: 'int - Number of units',
      amount: 'decimal - SIP amount per cycle',
      frequency: 'varchar - daily/weekly/monthly',
      status: 'tinyint - 0=inactive, 1=active, 2=paused, 3=cancelled',
      next_due_date: 'date - Next execution date',
      created_at: 'timestamp',
      updated_at: 'timestamp'
    },
    relationships: [
      'customer_id links to customer',
      'plan_id links to plan',
      'Generates subscription_orders periodically'
    ],
    commonQueries: [
      'Get active subscriptions for customer',
      'Find SIPs due for execution',
      'Calculate total SIP investment',
      'Check subscription status and next due date'
    ]
  },

  subscription_orders: {
    name: 'subscription_orders',
    description: 'Orders generated from SIP subscriptions',
    purpose: 'Track individual SIP execution orders',
    columns: {
      id: 'int unsigned PRIMARY KEY',
      subscription_id: 'int - Links to subscription.id',
      order_id: 'bigint - Links to dg_buy_orders.order_id (matches the order_id in buy orders table)',
      amount: 'decimal - Order amount',
      status: 'varchar - Execution status',
      created_at: 'timestamp'
    },
    relationships: [
      'subscription_id links to subscription.id',
      'order_id matches with dg_buy_orders.order_id - JOIN ON subscription_orders.order_id = dg_buy_orders.order_id',
      'Each SIP execution creates a buy order, this table tracks that relationship'
    ],
    commonQueries: [
      'Get SIP order history with buy order details',
      'Check failed SIP executions',
      'Calculate SIP performance',
      'JOIN with dg_buy_orders to get order status and amounts'
    ]
  },
  // Transfer Tables
  dg_p2p_transfers: {
    name: 'dg_p2p_transfers',
    description: 'Peer-to-peer gold transfers between customers',
    purpose: 'Track gold gifting and transfers',
    columns: {
      id: 'bigint unsigned PRIMARY KEY',
      srcCustomerRefNo: 'varchar(32) INDEXED - Source customer',
      srcCustomerName: 'varchar(128)',
      srcPhoneNumber: 'varchar(16)',
      dstCustomerRefNo: 'varchar(32) INDEXED - Destination customer',
      dstDisplayName: 'varchar(128)',
      dstPhoneNumber: 'varchar(16) INDEXED',
      quantity: 'decimal - Gold transferred in grams',
      status: 'varchar - Transfer status',
      created_at: 'timestamp',
      completed_at: 'timestamp'
    },
    relationships: [
      'srcCustomerRefNo links to customer.customer_id',
      'dstCustomerRefNo links to customer.customer_id',
      'Debits source portfolio, credits destination portfolio'
    ],
    commonQueries: [
      'Get transfer history for customer',
      'Find pending transfers',
      'Calculate total transferred/received'
    ]
  },

  dg_p2m_transfers: {
    name: 'dg_p2m_transfers',
    description: 'Customer to merchant gold transfers',
    purpose: 'Track gold sent to merchants',
    columns: {
      id: 'bigint PRIMARY KEY',
      srcCustomerRefNo: 'varchar(32) INDEXED - Source customer',
      dstMerchantId: 'varchar(32) - Destination merchant',
      quantity: 'decimal - Gold transferred in grams',
      status: 'varchar - Transfer status',
      created_at: 'timestamp'
    },
    relationships: [
      'srcCustomerRefNo links to customer.customer_id',
      'dstMerchantId links to dg_merchants'
    ],
    commonQueries: [
      'Find merchant transfers for customer',
      'Track outgoing transfers to merchants'
    ]
  },

  // Pricing Tables
  gold_rate: {
    name: 'gold_rate',
    description: 'Current gold buy/sell rates',
    purpose: 'Real-time gold pricing by merchant',
    columns: {
      id: 'bigint unsigned PRIMARY KEY',
      sell: 'decimal(20,6) - Sell rate per gram',
      buy: 'decimal(20,6) - Buy rate per gram',
      sell_with_markup: 'decimal(20,6)',
      buy_with_markup: 'decimal(20,6)',
      merchant: 'varchar(50) INDEXED - Merchant identifier',
      api_version: 'varchar(50)',
      created_at: 'timestamp',
      updated_at: 'timestamp'
    },
    relationships: [
      'merchant links to dg_merchants',
      'Used to calculate order amounts'
    ],
    commonQueries: [
      'Get current gold rate for merchant',
      'Compare rates across merchants',
      'Check rate at specific timestamp'
    ]
  }
};

/**
 * Get all table schemas as an array
 * Each element contains the full schema information for one table
 */
export function getAllTableSchemas() {
  return Object.entries(DATABASE_SCHEMA).map(([key, schema]) => ({
    tableName: schema.name,
    ...schema
  }));
}

/**
 * Get a formatted string representation of a table schema
 * This is what will be embedded and stored in the vector database
 */
export function formatTableSchema(schema) {
  const columnsText = Object.entries(schema.columns)
    .map(([col, desc]) => `  - ${col}: ${desc}`)
    .join('\n');
  
  const relationshipsText = schema.relationships
    .map(rel => `  - ${rel}`)
    .join('\n');
  
  const queriesText = schema.commonQueries
    .map(query => `  - ${query}`)
    .join('\n');

  return `
TABLE: ${schema.name}
DESCRIPTION: ${schema.description}
PURPOSE: ${schema.purpose}

COLUMNS:
${columnsText}

RELATIONSHIPS:
${relationshipsText}

COMMON USAGE:
${queriesText}
`.trim();
}


