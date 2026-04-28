-- Nueva estructura para gestión de perfiles individuales

-- Tabla de Cuentas (cada plataforma de streaming)
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT,
    total_price DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Perfiles (cada perfil individual con toda su info)
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    profile_email TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    renewal_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX idx_profiles_account ON profiles(account_id);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_profiles_renewal ON profiles(renewal_date);

-- Habilitar RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Allow all access to accounts" ON accounts FOR ALL USING (true);
CREATE POLICY "Allow all access to profiles" ON profiles FOR ALL USING (true);

-- Trigger para actualizar fecha de renovación automáticamente
CREATE OR REPLACE FUNCTION calculate_renewal_date(start_date DATE)
RETURNS DATE AS $$
BEGIN
    RETURN start_date + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar renewal_date basado en start_date
CREATE OR REPLACE FUNCTION update_renewal_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
        NEW.renewal_date := NEW.start_date + INTERVAL '1 month';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_renewal_date
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_renewal_date();
