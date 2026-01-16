CREATE DATABASE erp_db;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL
);

INSERT INTO users (name, email, password) 
VALUES ('anushka', 'test@gmail.com', '09876');


-- Create a custom sequence to start from a 10-digit number (e.g., 1000000000)
CREATE SEQUENCE non_coc_s_no_seq START 9000000000 INCREMENT 1;
ALTER SEQUENCE non_coc_s_no_seq OWNED BY non_coc.s_no;

CREATE TABLE non_coc (
    s_no BIGINT PRIMARY KEY DEFAULT nextval('non_coc_s_no_seq'),
    item_description VARCHAR(30),
    mpn VARCHAR(30) NOT NULL UNIQUE CHECK (mpn ~ '^[A-Za-z0-9\-]+$'),
    on_hand_quantity INTEGER NOT NULL CHECK (on_hand_quantity >= 0) ,
    location VARCHAR(30) DEFAULT 'WH/STOCK',
    receive_date DATE NOT NULL CHECK (receive_date <= CURRENT_DATE),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE CHECK (issue_date >= receive_date)
);

-- create table for roles 
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(30) UNIQUE NOT NULL
);
INSERT INTO roles (role_name) VALUES
('inventory_personnel'),
('quality_personnel'),
('purchase_personnel'),
('rnd_personnel'),
('manufacturing_personnel'),
('admin');

SELECT*FROM roles;

--create table for modules
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(60) UNIQUE NOT NULL
);
INSERT INTO modules (module_name) VALUES
('inventory'),
('quality'),
('purchase'),
('rnd'),
('manufacturing'),
('noncoc_inventory'),
('admin')
('documents');

SELECT*FROM modules;

--create role permission table
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INT REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    module_id INT  REFERENCES modules(id) ON DELETE CASCADE NOT NULL,
    can_access BOOLEAN NOT NULL DEFAULT FALSE,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
	UNIQUE (role_id, module_id)
);

SELECT*FROM role_permissions;

--inventory access
INSERT INTO role_permissions (role_id, module_id, can_access)
VALUES
((SELECT id FROM roles WHERE role_name = 'inventory_personnel'),
 (SELECT id FROM modules WHERE module_name = 'inventory'), TRUE),

((SELECT id FROM roles WHERE role_name = 'inventory_personnel'),
 (SELECT id FROM modules WHERE module_name = 'documents'), TRUE);

--quality access
INSERT INTO role_permissions (role_id, module_id, can_access)
VALUES
((SELECT id FROM roles WHERE role_name = 'quality_personnel'),
 (SELECT id FROM modules WHERE module_name = 'quality'), TRUE),

((SELECT id FROM roles WHERE role_name = 'quality_personnel'),
 (SELECT id FROM modules WHERE module_name = 'documents'), TRUE);

--admin access to all modules
INSERT INTO role_permissions (role_id, module_id, can_access)
SELECT 
    (SELECT id FROM roles WHERE role_name = 'admin'), id, TRUE
FROM modules;

--To check which modules a role can access
SELECT r.role_name, m.module_name, rp.can_access
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN modules m ON rp.module_id = m.id
ORDER BY r.role_name, m.module_name;

--To add permission rights in role_permissions
INSERT INTO role_permissions (role_id, module_id, can_access, can_read, can_edit, can_delete)  
VALUES 
    (
        (SELECT id FROM roles WHERE role_name = 'quality_personnel'), 
        (SELECT id FROM modules WHERE module_name = 'quality'), 
        TRUE, TRUE, TRUE, TRUE
    ),
    (
        (SELECT id FROM roles WHERE role_name = 'quality_personnel'), 
        (SELECT id FROM modules WHERE module_name = 'document'), 
        TRUE, TRUE, TRUE, TRUE
    ),
    (
        (SELECT id FROM roles WHERE role_name = 'quality_personnel'), 
        (SELECT id FROM modules WHERE module_name = 'inventory'), 
        FALSE, TRUE, FALSE, FALSE
    ),
    (
        (SELECT id FROM roles WHERE role_name = 'inventory_personnel'), 
        (SELECT id FROM modules WHERE module_name = 'admin'),
        FALSE, FALSE, FALSE, FALSE
    ),
    (
        (SELECT id FROM roles WHERE role_name = 'quality_personnel'), 
        (SELECT id FROM modules WHERE module_name = 'purchase'),
        FALSE, FALSE, FALSE, FALSE
    ),
    (
        (SELECT id FROM roles WHERE role_name = 'quality_personnel'), 
        (SELECT id FROM modules WHERE module_name = 'rnd'),
        FALSE, FALSE, FALSE, FALSE
    ),
    (
        (SELECT id FROM roles WHERE role_name = 'quality_personnel'), 
        (SELECT id FROM modules WHERE module_name = 'manufacturing'),
        FALSE, FALSE, FALSE, FALSE
    );
    
    --To add permission rights in role_permissions
INSERT INTO role_permissions (role_id, module_id, can_access, can_read, can_edit, can_delete)  
SELECT 
    (SELECT id FROM roles WHERE role_name = 'admin') AS role_id, 
    id AS module_id, 
    TRUE, TRUE, TRUE, TRUE
FROM modules 
WHERE module_name IN ('noncoc_inventory', 'documents');


--user activity table
CREATE TABLE user_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    module_name VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    query TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
--noncoc components table
ALTER TABLE non_coc_components
ADD COLUMN component_id BIGSERIAL PRIMARY KEY, 
ADD COLUMN item_description VARCHAR NOT NULL(50), 
ADD COLUMN mpn VARCHAR(50) NOT NULL, 
ADD COLUMN on_hand_quantity INTEGER DEFAULT 0 CHECK (on_hand_quantity >= 0), 
ADD COLUMN location VARCHAR(50) DEFAULT 'WH/STOCK', 
ADD COLUMN receive_date DATE ,
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER SEQUENCE non_coc_components_component_id_seq RESTART WITH 5000000000;

--cart details table
CREATE TABLE cart_details (
    id SERIAL PRIMARY KEY,  -- Auto-incrementing primary key
    user_id BIGINT NOT NULL,   -- Foreign key referencing users table
    component_id BIGINT NOT NULL,  -- Foreign key referencing non_coc_components table
    item_description VARCHAR(255) NOT NULL,  -- Fetched from non_coc_components
    mpn VARCHAR(50) NOT NULL,  -- Fetched from non_coc_components
    on_hand_quantity INTEGER NOT NULL,  -- Fetched from non_coc_components
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity >= 0),  -- Editable, must be >= 0

    -- Foreign key constraints
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_component FOREIGN KEY (component_id) REFERENCES non_coc_components(component_id) ON DELETE CASCADE
);

--user_material_issue_form table
CREATE TABLE user_material_issue_form (
    umi BIGSERIAL PRIMARY KEY,  -- Unique Material Issue ID (Auto-incrementing)
    cart_id BIGINT NOT NULL,  -- Fetched from cart_details (Primary Key of cart_details)
    status VARCHAR(20) NOT NULL,  -- Status of the request

    -- Foreign key constraint linking to cart_details (NOT users or components)
    CONSTRAINT fk_cart FOREIGN KEY (cart_id) REFERENCES cart_details(id) ON DELETE CASCADE
);
select * from user_material_issue_form

-- ✅ Step 1: Create the sequence starting from 10000
CREATE SEQUENCE IF NOT EXISTS umi_sequence START 10000;

-- ✅ Step 2: Create the function to generate UMI ID
CREATE OR REPLACE FUNCTION generate_umi_id() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.umi := 'UMI' || nextval('umi_sequence');  -- Prefix with "UMI"
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ Step 3: Attach trigger to insert event
DROP TRIGGER IF EXISTS umi_trigger ON user_material_issue_form;  -- Prevent duplicate triggers

CREATE TRIGGER umi_trigger
BEFORE INSERT ON user_material_issue_form
FOR EACH ROW EXECUTE FUNCTION generate_umi_id();


--material issue form table
CREATE TABLE material_issue_form (
    mi VARCHAR(10) PRIMARY KEY,  -- Custom MI_ID (MI10000, MI10001)
    umi BIGINT NOT NULL,  -- Fetch all details from UMI
    issued_quantity INT DEFAULT 0 CHECK (issued_quantity >= 0),
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key to fetch all details
    CONSTRAINT fk_umi FOREIGN KEY (umi) REFERENCES user_material_issue_form(umi) ON DELETE CASCADE
);

CREATE SEQUENCE mi_seq START 10000;

CREATE FUNCTION generate_mi() RETURNS TRIGGER AS $$
BEGIN
    NEW.mi := 'MI' || NEXTVAL('mi_seq');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_mi
BEFORE INSERT ON material_issue_form
FOR EACH ROW
EXECUTE FUNCTION generate_mi();

--stock card
CREATE TABLE stock_card (
    id SERIAL PRIMARY KEY,
    mi VARCHAR(10) NOT NULL, -- Material Issue ID
    on_hand_quantity INT NOT NULL, -- From non_coc_components
    requested_quantity INT NOT NULL, -- From material_issue_form
    issued_quantity INT NOT NULL, -- From material_issue_form
    balance INT NOT NULL, -- Will be updated dynamically

    -- ✅ Foreign Key linking to material_issue_form
    CONSTRAINT fk_mi FOREIGN KEY (mi) REFERENCES material_issue_form(mi) ON DELETE CASCADE
);
--balance stock
UPDATE stock_card sc
SET balance = nc.on_hand_quantity - mif.issued_quantity
FROM material_issue_form mif
JOIN user_material_issue_form umi ON mif.umi = umi.umi
JOIN cart_details cd ON umi.cart_id = cd.id  -- ✅ Corrected join condition
JOIN non_coc_components nc ON cd.component_id = nc.component_id
WHERE sc.mi = mif.mi;