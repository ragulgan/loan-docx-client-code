
CREATE TABLE LoandocX_Users_profile (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(50) NOT NULL,
    user_type VARCHAR(2) NOT NULL, 
    user_pwd   varchar(50),
    upi_id VARCHAR(100),
    address1 VARCHAR(200),
    address2 VARCHAR(200),
    mobile_number INT,
    email_id VARCHAR(100),
    aadhar_number VARCHAR(50),
    user_active CHAR(1) 
) ENGINE=InnoDB;

CREATE TABLE Loandocx_screens (
    screen_id INT AUTO_INCREMENT PRIMARY KEY,
    screen_name VARCHAR(50),
    screen_url VARCHAR(200),
    user_type  varchar(2),
    screen_active char(1)
) ENGINE=InnoDB;

CREATE TABLE LoandocX_loan_types (
    loan_id INT AUTO_INCREMENT PRIMARY KEY,
    loan_name VARCHAR(50),
    loan_active CHAR(1)
) ENGINE=InnoDB;

CREATE TABLE LoandocX_loan_doc_checklist (
    loan_id INT,
    doc_name VARCHAR(50),
    doc_description VARCHAR(100),
    doc_required_for_legal CHAR(1),
    doc_required_for_civil CHAR(1) 
) ENGINE=InnoDB;

CREATE TABLE LoandocX_loan_processing_fees (
    from_loan_amount FLOAT,
    to_loan_amount FLOAT,
    processing_fees FLOAT,
    AT_fees FLOAT,
    LU_fees FLOAT,
    LH_fees FLOAT,
    CU_fees FLOAT
) ENGINE=InnoDB;

CREATE TABLE LoandocX_Customers_loan_details (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(50),
    loan_name VARCHAR(20),
    upi_id VARCHAR(100),
    address1 VARCHAR(200),
    address2 VARCHAR(200),
    mobile_number INT, 
    email_id VARCHAR(100),
    aadhar_number VARCHAR(50),
    pan_card_number  varchar(20),
    loan_amount FLOAT,
    processing_fees FLOAT,
    amount_recived  FLOAT,
    transaction_id INT Unique,
    agent_id INT,
    creation_date DATE,
    loan_process_status char(1),
    Loan_bank_name varchar(50),
    Loan_branch_name varchar(30),
    Loan_branch_address1 varchar(200),
    Loan_branch_address2 varchar(200), 
    Loan_branch_mailid   varchar(100),
    Document_Stored_path varchar(100),
    CONSTRAINT fk_cl_agent FOREIGN KEY (agent_id)
    REFERENCES LoandocX_Users_profile(user_id)
) ENGINE=InnoDB;

CREATE TABLE LoandocX_Daywise_Agent_balance (
    agent_id INT, 
    trans_aproved_date DATE,
    account_balance FLOAT,
    payment_done CHAR(1) DEFAULT 'N',
    payment_on DATE,
    payment_tran_id VARCHAR(50),
    Payment_done_by INT,
    PRIMARY KEY (agent_id, trans_aproved_date),
    CONSTRAINT fk_agent_balance_user
        FOREIGN KEY (agent_id)
        REFERENCES LoandocX_Users_profile(user_id)
) ENGINE=InnoDB;

CREATE TABLE LoandocX_Daywise_Legal_user_balance (
    legal_user_id INT,
    legal_completion_date DATE,
    account_balance FLOAT,
    payment_done CHAR(1) DEFAULT 'N',
    payment_on DATE,
    payment_tran_id VARCHAR(50),
    Payment_done_by INT,
    PRIMARY KEY (legal_user_id, legal_completion_date),
    CONSTRAINT fk_legal_user_balance
        FOREIGN KEY (legal_user_id)
        REFERENCES LoandocX_Users_profile(user_id)
) ENGINE=InnoDB;

CREATE TABLE LoandocX_Daywise_Civil_user_balance (
    civil_user_id INT,
    civil_completion_date DATE,
    account_balance FLOAT,
    payment_done CHAR(1) DEFAULT 'N',
    payment_on DATE,
    payment_tran_id VARCHAR(50),
    Payment_done_by INT,
    PRIMARY KEY (civil_user_id, civil_completion_date),
    CONSTRAINT fk_civil_user_balance
        FOREIGN KEY (civil_user_id)
        REFERENCES LoandocX_Users_profile(user_id)
) ENGINE=InnoDB;

CREATE TABLE LoandocX_Daywise_Legal_head_balance (
    legal_head_id INT,
    legal_completion_date DATE,
    account_balance FLOAT,
    payment_done CHAR(1) DEFAULT 'N',
    payment_on DATE,
    payment_tran_id VARCHAR(50),
    Payment_done_by INT,
    PRIMARY KEY (legal_head_id, legal_completion_date),
    CONSTRAINT fk_legal_head_balance
        FOREIGN KEY (legal_head_id)
        REFERENCES LoandocX_Users_profile(user_id)
) ENGINE=InnoDB;

CREATE TABLE LoandocX_Transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    loan_name VARCHAR(50),
    customer_id INT,
    agent_id INT,
    trans_creation_date DATE,
    transaction_state CHAR(1),
    trans_state_modified_by INT,
    trans_state_modified_on DATE,
    legal_team_user INT,
    legal_team_job_allocation_date DATE,
    legal_team_job_completion_date DATE,
    civil_team_user INT,
    civil_team_job_allocation_date DATE,
    civil_team_job_completion_date DATE,
    legal_team_report LONGTEXT,
    legal_head_user INT,
    legal_head_job_allocation_date DATE,
    legal_head_job_completion_date DATE,
    legal_send_courier_name VARCHAR(100),
    legal_courier_tracking_id VARCHAR(50),
    legal_courier_date DATE,
    civil_send_courier_name VARCHAR(100),
    civil_courier_tracking_id VARCHAR(50),
    civil_courier_date DATE
) ENGINE=InnoDB;

-- Production Screen Registry
-- Agent (AT) Screens
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Loan Application', '/loans/create', 'AT', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Track Application', '/loans/track', 'AT', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Manage Documents', '/loans/docs', 'AT', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('My Earnings', '/earnings', 'AT', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Change Password', '/password-change', 'AT', 'Y');

-- Legal User (LU) Screens
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Job List', '/job-queue', 'LU', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('My Earnings', '/earnings', 'LU', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Change Password', '/password-change', 'LU', 'Y');

-- Legal Head (LH) Screens
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Legal Approval', '/legal-approve', 'LH', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('My Earnings', '/earnings', 'LH', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Change Password', '/password-change', 'LH', 'Y');

-- Civil User (CU) Screens
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Civil Approval', '/civil-approve', 'CU', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('My Earnings', '/earnings', 'CU', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Change Password', '/password-change', 'CU', 'Y');

-- Admin (AD) Screens
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Admin Approval', '/admin-approvals', 'AD', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('User Management', '/user-creation', 'AD', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Payout Settlement', '/user-payout-list', 'AD', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Update Payout Status', '/update-paid-status', 'AD', 'Y');
INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active) VALUES ('Change Password', '/password-change', 'AD', 'Y');
