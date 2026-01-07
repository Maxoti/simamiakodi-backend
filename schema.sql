-- =====================================================
-- SimamiaKodi Database Schema
-- =====================================================

-- Drop existing tables (in reverse order of dependencies)
DROP TABLE IF EXISTS sms_logs CASCADE;
DROP TABLE IF EXISTS whatsapp_messages CASCADE;
DROP TABLE IF EXISTS maintenance_requests CASCADE;
DROP TABLE IF EXISTS utility_bills CASCADE;
DROP TABLE IF EXISTS utilities CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS payment_plans CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS caretakers CASCADE;
DROP TABLE IF EXISTS agent_commissions CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'landlord',
    is_active BOOLEAN DEFAULT TRUE,
    reset_token VARCHAR(255),              
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PROPERTIES TABLE
-- =====================================================
CREATE TABLE properties (
    property_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    property_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    address TEXT,
    property_type VARCHAR(100),
    number_of_units INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    owner_name VARCHAR(255),
    owner_contact VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AGENTS TABLE (Agent Information)
-- =====================================================
CREATE TABLE agents (
    agent_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    id_number VARCHAR(50) UNIQUE,
    commission_rate DECIMAL(5, 2) DEFAULT 10.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CARETAKERS TABLE
-- =====================================================
CREATE TABLE caretakers (
    caretaker_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    id_number VARCHAR(50) UNIQUE,
    property_id INTEGER REFERENCES properties(property_id) ON DELETE SET NULL,
    salary DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- UNITS TABLE
-- =====================================================
CREATE TABLE units (
    unit_id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    unit_type VARCHAR(100),
    house_type VARCHAR(100),
    bedrooms INTEGER,
    bathrooms INTEGER,
    square_feet DECIMAL(10, 2),
    monthly_rent DECIMAL(10, 2) NOT NULL,
    is_occupied BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, unit_number)
);

-- =====================================================
-- TENANTS TABLE
-- =====================================================
CREATE TABLE tenants (
    tenant_id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(property_id) ON DELETE SET NULL,
    unit_id INTEGER REFERENCES units(unit_id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    id_number VARCHAR(50) UNIQUE,
    move_in_date DATE,
    move_out_date DATE,
    rent_amount DECIMAL(10, 2),
    deposit_amount DECIMAL(10, 2),
    deposit_paid DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AGENT COMMISSIONS TABLE (Commission Transactions)
-- =====================================================
CREATE TABLE agent_commissions (
    commission_id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(agent_id) ON DELETE SET NULL,
    tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL,
    property_id INTEGER NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
    commission_amount DECIMAL(10, 2) NOT NULL,
    commission_percentage DECIMAL(5, 2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(property_id) ON DELETE SET NULL,
    unit_id INTEGER REFERENCES units(unit_id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_month VARCHAR(7),
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'completed',
    reference_number VARCHAR(100),
    mpesa_code VARCHAR(100),
    payment_status VARCHAR(50) DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PAYMENT PLANS TABLE
-- =====================================================
CREATE TABLE payment_plans (
    plan_id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(property_id) ON DELETE SET NULL,
    unit_id INTEGER REFERENCES units(unit_id) ON DELETE SET NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    balance DECIMAL(10, 2) NOT NULL,
    installment_amount DECIMAL(10, 2) NOT NULL,
    installment_frequency VARCHAR(20) DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    next_due_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- EXPENSES TABLE
-- =====================================================
CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(property_id) ON DELETE SET NULL,
    unit_id INTEGER REFERENCES units(unit_id) ON DELETE SET NULL,
    expense_type VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    expense_date DATE NOT NULL,
    description TEXT,
    vendor_name VARCHAR(255),
    receipt_number VARCHAR(100),
    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- UTILITIES TABLE
-- =====================================================
CREATE TABLE utilities (
    utility_id SERIAL PRIMARY KEY,
    unit_id INTEGER REFERENCES units(unit_id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    utility_type VARCHAR(50) NOT NULL CHECK (utility_type IN ('electricity', 'water', 'gas', 'internet', 'sewage', 'garbage')),
    billing_month DATE NOT NULL,
    previous_reading DECIMAL(10, 2) DEFAULT 0,
    current_reading DECIMAL(10, 2) NOT NULL,
    units_consumed DECIMAL(10, 2) NOT NULL,
    rate_per_unit DECIMAL(10, 2) NOT NULL,
    amount_due DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    reading_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_utility_billing UNIQUE(unit_id, utility_type, billing_month)
);

-- =====================================================
-- MAINTENANCE REQUESTS TABLE
-- =====================================================
CREATE TABLE maintenance_requests (
    request_id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(property_id) ON DELETE CASCADE,
    unit_id INTEGER REFERENCES units(unit_id) ON DELETE SET NULL,
    tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE SET NULL,
    issue_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    reported_date DATE DEFAULT CURRENT_DATE,
    resolved_date DATE,
    assigned_to VARCHAR(255),
    cost DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- WHATSAPP MESSAGES TABLE
-- =====================================================
DROP TABLE IF EXISTS whatsapp_messages CASCADE;

CREATE TABLE whatsapp_messages (
    message_id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    recipient_phone VARCHAR(20) NOT NULL,
    recipient_name VARCHAR(255),
    message_type VARCHAR(50) DEFAULT 'general' CHECK (message_type IN ('rent_reminder', 'payment', 'maintenance', 'welcome', 'overdue', 'general')),
    message_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- =====================================================
-- SMS LOGS TABLE
-- =====================================================
CREATE TABLE sms_logs (
    log_id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    response TEXT,
    cost DECIMAL(10, 4),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_properties_name ON properties(property_name);
CREATE INDEX idx_units_property ON units(property_id);
CREATE INDEX idx_units_occupied ON units(is_occupied);
CREATE INDEX idx_tenants_property ON tenants(property_id);
CREATE INDEX idx_tenants_unit ON tenants(unit_id);
CREATE INDEX idx_tenants_active ON tenants(is_active);
CREATE INDEX idx_tenants_phone ON tenants(phone);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_month ON payments(payment_month);
CREATE INDEX idx_payment_plans_tenant ON payment_plans(tenant_id);
CREATE INDEX idx_payment_plans_status ON payment_plans(status);
CREATE INDEX idx_expenses_property ON expenses(property_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_utilities_property ON utilities(unit_id);
CREATE INDEX idx_maintenance_property ON maintenance_requests(property_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_agent_commissions_agent_id ON agent_commissions(agent_id);
CREATE INDEX idx_agent_commissions_tenant_id ON agent_commissions(tenant_id);
CREATE INDEX idx_agent_commissions_property_id ON agent_commissions(property_id);
CREATE INDEX idx_agent_commissions_status ON agent_commissions(status);
CREATE INDEX idx_sms_logs_phone ON sms_logs(phone_number);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);
CREATE INDEX idx_sms_logs_date ON sms_logs(sent_at);
CREATE INDEX idx_sms_cost ON sms_logs(cost);
CREATE INDEX idx_sms_delivered ON sms_logs(delivered_at);
CREATE INDEX idx_utilities_unit_id ON utilities(unit_id);
CREATE INDEX idx_utilities_tenant_id ON utilities(tenant_id);
CREATE INDEX idx_utilities_payment_status ON utilities(payment_status);
CREATE INDEX idx_utilities_billing_month ON utilities(billing_month);

-- Create indexes
CREATE INDEX idx_whatsapp_messages_tenant_id ON whatsapp_messages(tenant_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_sent_at ON whatsapp_messages(sent_at DESC);
CREATE INDEX idx_whatsapp_messages_type ON whatsapp_messages(message_type);
CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(recipient_phone);



-- Add comments
COMMENT ON TABLE whatsapp_messages IS 'Stores all WhatsApp messages sent to tenants';
COMMENT ON COLUMN whatsapp_messages.tenant_id IS 'Foreign key linking message to a tenant';
COMMENT ON COLUMN whatsapp_messages.message_type IS 'Type of message: rent_reminder, payment, maintenance, welcome, overdue, general';
COMMENT ON COLUMN whatsapp_messages.status IS 'Message status: pending, sent, delivered, read, failed';

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON payment_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION update_utilities_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER utilities_updated_at
BEFORE UPDATE ON utilities
FOR EACH ROW
EXECUTE FUNCTION update_utilities_timestamp();


-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_messages_updated_at
BEFORE UPDATE ON whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_messages_updated_at();

-- =====================================================
-- SAMPLE DATA (Optional - Comment out if not needed)
-- =====================================================

-- Insert default admin user (password: admin123)
