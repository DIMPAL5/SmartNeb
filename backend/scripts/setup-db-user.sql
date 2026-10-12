-- SmartNeb Production & Dev Least-Privilege MySQL User Setup
-- Run as root: mysql -u root -p < setup-db-user.sql

-- 1. Create limited application user
CREATE USER IF NOT EXISTS 'smartneb_user'@'%' IDENTIFIED BY 'ChangeMeInProd_StrongSecret123!';

-- 2. Grant minimum required privileges on production database
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES ON smartneb_prod.* TO 'smartneb_user'@'%';

-- 3. Grant minimum required privileges on dev & test databases
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES ON smartneb_dev.* TO 'smartneb_user'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES ON smartneb_test.* TO 'smartneb_user'@'%';

-- 4. Apply privilege changes
FLUSH PRIVILEGES;

-- Verification query
SHOW GRANTS FOR 'smartneb_user'@'%';
