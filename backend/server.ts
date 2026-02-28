
import express from 'express';
import cors from 'cors';
import { Sequelize, QueryTypes } from 'sequelize';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }) as any);

const sequelize = new Sequelize(
  process.env.DB_NAME || 'loandocx_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false, 
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 }
  }
);

sequelize.authenticate()
  .then(() => console.log('✓ LoanDocX: MySQL Database Connected.'))
  .catch(err => console.error('✗ LoanDocX: MySQL Connection Failed:', err));

const uploadRootDir = path.resolve((process as any).cwd(), 'uploads');
if (!fs.existsSync(uploadRootDir)) {
  fs.mkdirSync(uploadRootDir, { recursive: true });
}
app.use('/uploads', express.static(uploadRootDir) as any);

/**
 * ADMIN: CUSTOMER LOOKUP
 */
app.get('/api/admin/customer-lookup', async (req: any, res: any) => {
  const { type, query } = req.query;
  try {
    let sql = '';
    if (type === 'id') {
      sql = `SELECT customer_id, customer_name, loan_name, address1, address2, mobile_number, loan_amount, agent_id 
             FROM LoandocX_Customers_loan_details WHERE customer_id = :query`;
    } else {
      sql = `SELECT customer_id, customer_name, loan_name, address1, address2, mobile_number, loan_amount, agent_id 
             FROM LoandocX_Customers_loan_details WHERE mobile_number = :query`;
    }

    const records = await sequelize.query(sql, { 
      replacements: { query }, 
      type: QueryTypes.SELECT 
    });

    if (!records || records.length === 0) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ADMIN: PENDING TRANSACTION REPORT BY TEAM
 */
app.get('/api/admin/pending-trans-report', async (req: any, res: any) => {
  const { role } = req.query;
  try {
    let query = '';
    
    if (role === 'LU') {
      // Legal User
      query = `SELECT transaction_id, customer_id, loan_name, agent_id, legal_team_user as team_user_id, legal_team_job_allocation_date as allocation_date 
               FROM LoandocX_Transactions 
               WHERE transaction_state = 'A' AND legal_team_job_completion_date IS NULL`;
    } else if (role === 'CU') {
      // Civil User
      query = `SELECT transaction_id, customer_id, loan_name, agent_id, civil_team_user as team_user_id, civil_team_job_allocation_date as allocation_date 
               FROM LoandocX_Transactions 
               WHERE transaction_state = 'A' AND civil_team_job_completion_date IS NULL`;
    } else if (role === 'LH') {
      // Legal Head
      query = `SELECT transaction_id, customer_id, loan_name, agent_id, legal_head_user as team_user_id, legal_head_job_allocation_date as allocation_date 
               FROM LoandocX_Transactions 
               WHERE transaction_state = 'A' AND legal_team_job_completion_date IS NOT NULL AND legal_head_job_completion_date IS NULL`;
    } else {
      return res.status(400).json({ error: "Invalid team role selected" });
    }

    const records = await sequelize.query(query, { type: QueryTypes.SELECT });
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ADMIN: SYSTEM CONFIG - FETCH USERS FOR REPORT
 */
app.get('/api/admin/user-registry', async (req: any, res: any) => {
  const { type } = req.query;
  try {
    const users = await sequelize.query(
      `SELECT user_id, user_name, upi_id, address1, address2, mobile_number, email_id, aadhar_number, user_active 
       FROM LoandocX_Users_profile 
       WHERE user_type = :type`,
      { replacements: { type }, type: QueryTypes.SELECT }
    );
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ADMIN: SYSTEM CONFIG - INSERT NEW SCREEN
 */
app.post('/api/admin/screens', async (req: any, res: any) => {
  const { screen_name, screen_url, user_type, screen_active } = req.body;
  try {
    await sequelize.query(
      `INSERT INTO Loandocx_screens (screen_name, screen_url, user_type, screen_active)
       VALUES (:name, :url, :type, :active)`,
      { replacements: { name: screen_name, url: screen_url, type: user_type, active: screen_active || 'Y' }, type: QueryTypes.INSERT }
    );
    res.json({ success: true, message: "New screen mapped successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ADMIN: DASHBOARD STATS
 */
app.get('/api/admin/dashboard-stats', async (req: any, res: any) => {
  try {
    const [atPayout]: any = await sequelize.query(`SELECT IFNULL(SUM(account_balance), 0) as total FROM LoandocX_Daywise_Agent_balance WHERE payment_done = 'N'`, { type: QueryTypes.SELECT });
    const [luPayout]: any = await sequelize.query(`SELECT IFNULL(SUM(account_balance), 0) as total FROM LoandocX_Daywise_Legal_user_balance WHERE payment_done = 'N'`, { type: QueryTypes.SELECT });
    const [lhPayout]: any = await sequelize.query(`SELECT IFNULL(SUM(account_balance), 0) as total FROM LoandocX_Daywise_Legal_head_balance WHERE payment_done = 'N'`, { type: QueryTypes.SELECT });
    const [cuPayout]: any = await sequelize.query(`SELECT IFNULL(SUM(account_balance), 0) as total FROM LoandocX_Daywise_Civil_user_balance WHERE payment_done = 'N'`, { type: QueryTypes.SELECT });

    const [adminPending]: any = await sequelize.query(`SELECT COUNT(*) as count FROM LoandocX_Transactions WHERE transaction_state = 'P'`, { type: QueryTypes.SELECT });
    const [legalPending]: any = await sequelize.query(`SELECT COUNT(*) as count FROM LoandocX_Transactions WHERE transaction_state = 'A' AND legal_head_job_completion_date IS NULL`, { type: QueryTypes.SELECT });
    const [civilPending]: any = await sequelize.query(`SELECT COUNT(*) as count FROM LoandocX_Transactions WHERE transaction_state = 'A' AND civil_team_job_completion_date IS NULL`, { type: QueryTypes.SELECT });

    res.json({
      payouts: {
        agent: atPayout.total,
        legalUser: luPayout.total,
        legalHead: lhPayout.total,
        civilUser: cuPayout.total
      },
      pending: {
        admin: adminPending.count,
        legal: legalPending.count,
        civil: civilPending.count
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * AUTHENTICATION
 */
app.post('/api/auth/login', async (req: any, res: any) => {
  const { userId, password } = req.body;
  try {
    const users = await sequelize.query(
      `SELECT user_id, user_name, user_type, email_id, user_active, upi_id 
       FROM LoandocX_Users_profile 
       WHERE user_id = :uid AND user_pwd = :pwd`,
      { replacements: { uid: userId, pwd: password }, type: QueryTypes.SELECT }
    );
    if (users.length > 0) {
      const user: any = users[0];
      if (user.user_active !== 'Y') return res.status(403).json({ success: false, message: "Account inactive." });
      const screens = await sequelize.query(
        `SELECT screen_name, screen_url FROM Loandocx_screens WHERE user_type = :type AND screen_active = 'Y'`,
        { replacements: { type: user.user_type }, type: QueryTypes.SELECT }
      );
      res.json({ success: true, user: { ...user, screens } });
    } else {
      res.status(401).json({ success: false, message: "Incorrect User ID or Password." });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Database error." });
  }
});

/**
 * ADMIN: PAYOUT MANAGEMENT
 */
app.get('/api/admin/validate-payout-user', async (req: any, res: any) => {
  const { userType, userId } = req.query;
  try {
    const results = await sequelize.query(
      `SELECT user_name FROM LoandocX_Users_profile 
       WHERE user_id = :id AND user_type = :type AND user_active = 'Y'`,
      { replacements: { id: userId, type: userType }, type: QueryTypes.SELECT }
    );
    if (results.length > 0) {
      res.json({ success: true, userName: (results[0] as any).user_name });
    } else {
      res.status(404).json({ success: false, message: "Invalid user or account inactive." });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/update-payout-status', async (req: any, res: any) => {
  const { userType, userId, fromDate, toDate, paymentOn, paymentTranId, adminUserId } = req.body;
  try {
    let query = '';
    let replacements: any = { 
      id: userId, 
      from: fromDate, 
      to: toDate, 
      pOn: paymentOn, 
      pTid: paymentTranId, 
      admin: adminUserId 
    };

    if (userType === 'AT') {
      query = `UPDATE LoandocX_Daywise_Agent_balance 
               SET payment_done = 'Y', payment_tran_id = :pTid, payment_on = :pOn, Payment_done_by = :admin
               WHERE agent_id = :id AND trans_aproved_date >= :from AND trans_aproved_date <= :to AND payment_done = 'N'`;
    } else if (userType === 'LU') {
      query = `UPDATE LoandocX_Daywise_Legal_user_balance 
               SET payment_done = 'Y', payment_tran_id = :pTid, payment_on = :pOn, Payment_done_by = :admin
               WHERE legal_user_id = :id AND legal_completion_date >= :from AND legal_completion_date <= :to AND payment_done = 'N'`;
    } else if (userType === 'LH') {
      query = `UPDATE LoandocX_Daywise_Legal_head_balance 
               SET payment_done = 'Y', payment_tran_id = :pTid, payment_on = :pOn, Payment_done_by = :admin
               WHERE legal_head_id = :id AND legal_completion_date >= :from AND legal_completion_date <= :to AND payment_done = 'N'`;
    } else if (userType === 'CU') {
      query = `UPDATE LoandocX_Daywise_Civil_user_balance 
               SET payment_done = 'Y', payment_tran_id = :pTid, payment_on = :pOn, Payment_done_by = :admin
               WHERE civil_user_id = :id AND civil_completion_date >= :from AND civil_completion_date <= :to AND payment_done = 'N'`;
    } else {
      return res.status(400).json({ success: false, message: "Invalid User Type" });
    }

    const [results, metadata]: any = await sequelize.query(query, { replacements });
    res.json({ success: true, affectedRows: metadata.affectedRows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * ADMIN: USER MANAGEMENT
 */
app.get('/api/admin/users/:id', async (req: any, res: any) => {
  try {
    const user = await sequelize.query(
      `SELECT user_name, user_type, user_pwd, upi_id, address1, address2, mobile_number, email_id, aadhar_number, user_active 
       FROM LoandocX_Users_profile WHERE user_id = :id`,
      { replacements: { id: req.params.id }, type: QueryTypes.SELECT }
    );
    if (user.length > 0) {
      res.json(user[0]);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', async (req: any, res: any) => {
  try {
    const { user_name, user_type, user_pwd, upi_id, address1, address2, mobile_number, email_id, aadhar_number, user_active } = req.body;
    await sequelize.query(
      `INSERT INTO LoandocX_Users_profile (user_name, user_type, user_pwd, upi_id, address1, address2, mobile_number, email_id, aadhar_number, user_active)
       VALUES (:un, :ut, :up, :upi, :a1, :a2, :mob, :em, :adn, :ua)`,
      { replacements: { un: user_name, ut: user_type, up: user_pwd, upi: upi_id, a1: address1, a2: address2, mob: mobile_number, em: email_id, adn: aadhar_number, ua: user_active }, type: QueryTypes.INSERT }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/admin/users/:id', async (req: any, res: any) => {
  try {
    const { user_pwd, upi_id, address1, address2, mobile_number, email_id, user_active } = req.body;
    await sequelize.query(
      `UPDATE LoandocX_Users_profile 
       SET user_pwd = :up, upi_id = :upi, address1 = :a1, address2 = :a2, mobile_number = :mob, email_id = :em, user_active = :ua 
       WHERE user_id = :id`,
      { replacements: { up: user_pwd, upi: upi_id, a1: address1, a2: address2, mob: mobile_number, em: email_id, ua: user_active, id: req.params.id }, type: QueryTypes.UPDATE }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req: any, res: any) => {
  try {
    await sequelize.query(`DELETE FROM LoandocX_Users_profile WHERE user_id = :id`, { replacements: { id: req.params.id }, type: QueryTypes.DELETE });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * ADMIN: PAYMENTS LIST
 */
app.get('/api/admin/payments', async (req: any, res: any) => {
  const { userType, fromDate, toDate } = req.query;
  try {
    let query = '';
    let replacements: any = { from: fromDate, to: toDate, type: userType };

    if (userType === 'AT') {
      query = `
        SELECT b.user_name, b.mobile_number, b.upi_id, b.user_id, SUM(a.account_balance) AS payment_amount
        FROM LoandocX_Daywise_Agent_balance a 
        JOIN LoandocX_Users_profile b ON a.agent_id = b.user_id
        WHERE a.trans_aproved_date >= :from AND a.trans_aproved_date <= :to
        AND b.user_type = 'AT' AND a.payment_done = 'N'
        GROUP BY b.user_name, b.mobile_number, b.upi_id, b.user_id`;
    } else if (userType === 'LU') {
      query = `
        SELECT b.user_name, b.mobile_number, b.upi_id, b.user_id, SUM(a.account_balance) AS payment_amount
        FROM LoandocX_Daywise_Legal_user_balance a 
        JOIN LoandocX_Users_profile b ON a.legal_user_id = b.user_id
        WHERE a.legal_completion_date >= :from AND a.legal_completion_date <= :to
        AND b.user_type = 'LU' AND a.payment_done = 'N'
        GROUP BY b.user_name, b.mobile_number, b.upi_id, b.user_id`;
    } else if (userType === 'CU') {
      query = `
        SELECT b.user_name, b.mobile_number, b.upi_id, b.user_id, SUM(a.account_balance) AS payment_amount
        FROM LoandocX_Daywise_Civil_user_balance a 
        JOIN LoandocX_Users_profile b ON a.civil_user_id = b.user_id
        WHERE a.civil_completion_date >= :from AND a.civil_completion_date <= :to
        AND b.user_type = 'CU' AND a.payment_done = 'N'
        GROUP BY b.user_name, b.mobile_number, b.upi_id, b.user_id`;
    } else if (userType === 'LH') {
      query = `
        SELECT b.user_name, b.mobile_number, b.upi_id, b.user_id, SUM(a.account_balance) AS payment_amount
        FROM LoandocX_Daywise_Legal_head_balance a 
        JOIN LoandocX_Users_profile b ON a.legal_head_id = b.user_id
        WHERE a.legal_completion_date >= :from AND a.legal_completion_date <= :to
        AND b.user_type = 'LH' AND a.payment_done = 'N'
        GROUP BY b.user_name, b.mobile_number, b.upi_id, b.user_id`;
    } else {
      return res.status(400).json({ error: "Invalid User Type" });
    }

    const results = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ADMIN: APPROVAL LOGIC
 */
app.get('/api/admin/pending-approvals', async (req: any, res: any) => {
  try {
    const jobs = await sequelize.query(
      `SELECT c.loan_name, c.customer_id, c.agent_id, c.loan_amount, c.processing_fees, 
              t.transaction_id, c.amount_recived, c.customer_name, c.mobile_number
       FROM LoandocX_Customers_loan_details c, LoandocX_Transactions t
       WHERE c.customer_id = t.customer_id
       AND c.transaction_id = t.transaction_id
       AND t.transaction_state = 'P'`,
      { type: QueryTypes.SELECT }
    );
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users-by-role/:type', async (req: any, res: any) => {
  try {
    const users = await sequelize.query(
      `SELECT user_id, user_name FROM LoandocX_Users_profile
       WHERE user_type = :type AND user_active = 'Y'`,
      { replacements: { type: req.params.type }, type: QueryTypes.SELECT }
    );
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/allowed-docs/:txnId', async (req: any, res: any) => {
  try {
    const { loanName } = req.query;
    const allowed = await sequelize.query(
      `SELECT dc.doc_name, dc.doc_description 
       FROM LoandocX_loan_doc_checklist dc, LoandocX_loan_types lt
       WHERE lt.loan_id = dc.loan_id 
       AND lt.loan_name = :loanName
       AND lt.loan_active = 'Y'`,
      { replacements: { loanName }, type: QueryTypes.SELECT }
    );

    const folderPath = path.join(uploadRootDir, req.params.txnId);
    let filesInServer: string[] = [];
    if (fs.existsSync(folderPath)) {
      filesInServer = fs.readdirSync(folderPath);
    }

    const result = (allowed as any[]).map(doc => {
      const sanitized = doc.doc_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const matchedFile = filesInServer.find(f => f.toLowerCase().startsWith(sanitized) && f.endsWith('.pdf'));
      return {
        ...doc,
        fileUrl: matchedFile ? `/uploads/${req.params.txnId}/${matchedFile}` : null
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/approve-transaction', async (req: any, res: any) => {
  const transaction = await sequelize.transaction();
  try {
    const { transactionId, adminUserId, legalUserId, civilUserId, legalHeadId, loanAmount, agentId } = req.body;

    await sequelize.query(
      `UPDATE LoandocX_Transactions 
       SET transaction_state = 'A',
           Trans_state_modified_by = :adminId,
           Trans_state_modified_on = CURDATE(),
           Legal_team_user = :lu,
           Legal_team_job_allocation_date = CURDATE(),
           Civil_team_user = :cu,
           Civil_team_job_allocation_date = CURDATE(),
           Legal_head_user = :lh
       WHERE transaction_id = :tid`,
      { 
        replacements: { adminId: adminUserId, lu: legalUserId, cu: civilUserId, lh: legalHeadId, tid: transactionId }, 
        type: QueryTypes.UPDATE, 
        transaction 
      }
    );

    const feesRecord: any = await sequelize.query(
      `SELECT AT_fees FROM LoandocX_loan_processing_fees 
       WHERE from_loan_amount < :amt AND to_loan_amount >= :amt LIMIT 1`,
      { replacements: { amt: loanAmount }, type: QueryTypes.SELECT, transaction }
    );

    const atFees = feesRecord[0]?.AT_fees || 0;

    const [balanceCheck]: any = await sequelize.query(
      `SELECT COUNT(1) as cnt FROM LoandocX_Daywise_Agent_balance 
       WHERE agent_id = :aid AND trans_aproved_date = CURDATE()`,
      { replacements: { aid: agentId }, type: QueryTypes.SELECT, transaction }
    );

    if (balanceCheck.cnt > 0) {
      await sequelize.query(
        `UPDATE LoandocX_Daywise_Agent_balance SET account_balance = account_balance + :fees 
         WHERE agent_id = :aid AND trans_aproved_date = CURDATE()`,
        { replacements: { fees: atFees, aid: agentId }, type: QueryTypes.UPDATE, transaction }
      );
    } else {
      await sequelize.query(
        `INSERT INTO LoandocX_Daywise_Agent_balance (agent_id, trans_aproved_date, account_balance, payment_done)
         VALUES (:aid, CURDATE(), :fees, 'N')`,
        { replacements: { aid: agentId, fees: atFees }, type: QueryTypes.INSERT, transaction }
      );
    }

    await transaction.commit();
    res.json({ success: true });
  } catch (err: any) {
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: err.message });
  }
});

/**
 * LEGAL USER JOB QUEUE LOGIC
 */
app.get('/api/legal/job-queue/:userId', async (req: any, res: any) => {
  try {
    const jobs = await sequelize.query(
      `SELECT t.transaction_id, c.loan_name, c.customer_id, c.loan_amount, c.customer_name, c.mobile_number 
       FROM LoandocX_Customers_loan_details c, LoandocX_Transactions t
       WHERE c.customer_id = t.customer_id
       AND c.transaction_id = t.transaction_id
       AND t.legal_team_user = :userId
       AND t.legal_team_job_allocation_date IS NOT NULL
       AND t.legal_team_job_completion_date IS NULL 
       AND t.transaction_state = 'A'`,
      { replacements: { userId: req.params.userId }, type: QueryTypes.SELECT }
    );
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * CIVIL USER JOB QUEUE LOGIC
 */
app.get('/api/civil/job-queue/:userId', async (req: any, res: any) => {
  try {
    const jobs = await sequelize.query(
      `SELECT t.transaction_id, c.loan_name, c.customer_id, c.loan_amount, c.customer_name, c.mobile_number,
              c.Loan_bank_name, c.Loan_branch_name, c.Loan_branch_address1, 
              c.Loan_branch_address2, c.Loan_branch_mailid
       FROM LoandocX_Customers_loan_details c, LoandocX_Transactions t
       WHERE c.customer_id = t.customer_id
       AND c.transaction_id = t.transaction_id
       AND t.civil_team_user = :userId
       AND t.civil_team_job_allocation_date IS NOT NULL
       AND t.civil_team_job_completion_date IS NULL 
       AND t.transaction_state = 'A'`,
      { replacements: { userId: req.params.userId }, type: QueryTypes.SELECT }
    );
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/legal/allowed-docs/:txnId', async (req: any, res: any) => {
  try {
    const txn: any = await sequelize.query(
      `SELECT loan_name FROM LoandocX_Transactions WHERE transaction_id = :id`,
      { replacements: { id: req.params.txnId }, type: QueryTypes.SELECT }
    );
    if (!txn || txn.length === 0) return res.status(404).json({ error: "Transaction not found." });

    const allowed = await sequelize.query(
      `SELECT dc.doc_name, dc.doc_description 
       FROM LoandocX_loan_doc_checklist dc, LoandocX_loan_types lt
       WHERE lt.loan_id = dc.loan_id 
       AND lt.loan_name = :loanName
       AND lt.loan_active = 'Y'
       AND dc.doc_required_for_legal = 'Y'`,
      { replacements: { loanName: txn[0].loan_name }, type: QueryTypes.SELECT }
    );

    const folderPath = path.join(uploadRootDir, req.params.txnId);
    let filesInServer: string[] = [];
    if (fs.existsSync(folderPath)) {
      filesInServer = fs.readdirSync(folderPath);
    }

    const result = (allowed as any[]).map(doc => {
      const sanitized = doc.doc_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const matchedFile = filesInServer.find(f => f.toLowerCase().startsWith(sanitized) && f.endsWith('.pdf'));
      return {
        ...doc,
        fileUrl: matchedFile ? `/uploads/${req.params.txnId}/${matchedFile}` : null
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * CIVIL: ALLOWED DOCUMENTS
 */
app.get('/api/civil/allowed-docs/:txnId', async (req: any, res: any) => {
  try {
    const txn: any = await sequelize.query(
      `SELECT loan_name FROM LoandocX_Transactions WHERE transaction_id = :id`,
      { replacements: { id: req.params.txnId }, type: QueryTypes.SELECT }
    );
    if (!txn || txn.length === 0) return res.status(404).json({ error: "Transaction not found." });

    const allowed = await sequelize.query(
      `SELECT dc.doc_name, dc.doc_description 
       FROM LoandocX_loan_doc_checklist dc, LoandocX_loan_types lt
       WHERE lt.loan_id = dc.loan_id 
       AND lt.loan_name = :loanName
       AND lt.loan_active = 'Y'
       AND dc.doc_required_for_civil = 'Y'`,
      { replacements: { loanName: txn[0].loan_name }, type: QueryTypes.SELECT }
    );

    const folderPath = path.join(uploadRootDir, req.params.txnId);
    let filesInServer: string[] = [];
    if (fs.existsSync(folderPath)) {
      filesInServer = fs.readdirSync(folderPath);
    }

    const result = (allowed as any[]).map(doc => {
      const sanitized = doc.doc_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const matchedFile = filesInServer.find(f => f.toLowerCase().startsWith(sanitized) && f.endsWith('.pdf'));
      return {
        ...doc,
        fileUrl: matchedFile ? `/uploads/${req.params.txnId}/${matchedFile}` : null
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/legal/submit-report', async (req: any, res: any) => {
  try {
    const { transactionId, evaluationReport } = req.body;
    await sequelize.query(
      `UPDATE LoandocX_Transactions 
       SET legal_team_job_completion_date = NOW(),
           Legal_team_report = :report,
           legal_head_job_allocation_date = NOW()
       WHERE transaction_id = :id`,
      { replacements: { report: evaluationReport, id: transactionId }, type: QueryTypes.UPDATE }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/civil/submit-report', async (req: any, res: any) => {
  const transaction = await sequelize.transaction();
  try {
    const { transactionId, userId, loanAmount, courierName, courierTrackingId, courierDate } = req.body;
    
    await sequelize.query(
      `UPDATE LoandocX_Transactions 
       SET civil_team_job_completion_date = CURDATE(),
           civil_send_courier_name = :cn,
           civil_courier_tracking_id = :ctid,
           civil_courier_date = :cdate
       WHERE transaction_id = :id`,
      { 
        replacements: { 
          id: transactionId,
          cn: courierName,
          ctid: courierTrackingId,
          cdate: courierDate
        }, 
        type: QueryTypes.UPDATE, 
        transaction 
      }
    );

    const feesRecord: any = await sequelize.query(
      `SELECT CU_fees FROM LoandocX_loan_processing_fees 
       WHERE from_loan_amount < :amt AND to_loan_amount >= :amt LIMIT 1`,
      { replacements: { amt: loanAmount }, type: QueryTypes.SELECT, transaction }
    );
    const cuFees = feesRecord[0]?.CU_fees || 0;

    const [exists]: any = await sequelize.query(
      `SELECT COUNT(1) as cnt FROM LoandocX_Daywise_Civil_user_balance 
       WHERE civil_user_id = :uid AND civil_completion_date = CURDATE()`,
      { replacements: { uid: userId }, type: QueryTypes.SELECT, transaction }
    );

    if (exists.cnt > 0) {
      await sequelize.query(
        `UPDATE LoandocX_Daywise_Civil_user_balance SET account_balance = account_balance + :fees 
         WHERE civil_user_id = :uid AND civil_completion_date = CURDATE()`,
        { replacements: { fees: cuFees, uid: userId }, type: QueryTypes.UPDATE, transaction }
      );
    } else {
      await sequelize.query(
        `INSERT INTO LoandocX_Daywise_Civil_user_balance (civil_user_id, civil_completion_date, account_balance, payment_done)
         VALUES (:uid, CURDATE(), :fees, 'N')`,
        { replacements: { uid: userId, fees: cuFees }, type: QueryTypes.INSERT, transaction }
      );
    }

    await transaction.commit();
    res.json({ success: true });
  } catch (err: any) {
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: err.message });
  }
});

/**
 * LEGAL HEAD (LH) LOGIC
 */
app.get('/api/legal-head/job-queue/:userId', async (req: any, res: any) => {
  try {
    const jobs = await sequelize.query(
      `SELECT t.transaction_id, c.loan_name, c.loan_amount, c.customer_name, c.mobile_number,
              c.loan_bank_name, c.Loan_branch_name, c.Loan_branch_address1, 
              c.Loan_branch_address2, c.Loan_branch_mailid, 
              t.legal_team_user, t.legal_team_job_completion_date, t.legal_team_report
       FROM LoandocX_Customers_loan_details c, LoandocX_Transactions t
       WHERE c.customer_id = t.customer_id
       AND c.transaction_id = t.transaction_id
       AND t.legal_head_user = :userId
       AND t.legal_head_job_allocation_date IS NOT NULL
       AND t.legal_head_job_completion_date IS NULL
       AND t.transaction_state = 'A'`,
      { replacements: { userId: req.params.userId }, type: QueryTypes.SELECT }
    );
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/legal-head/submit-completion', async (req: any, res: any) => {
  const transaction = await sequelize.transaction();
  try {
    const { 
      transactionId, courierName, trackingId, sendDate, 
      loanAmount, legalUserId, legalUserCompDate, legalHeadId 
    } = req.body;

    await sequelize.query(
      `UPDATE LoandocX_Transactions 
       SET legal_head_job_completion_date = :sendDate,
           legal_send_courier_name = :courierName,
           legal_courier_tracking_id = :trackingId,
           legal_courier_date = :sendDate
       WHERE transaction_id = :id`,
      { 
        replacements: { 
          sendDate, courierName, trackingId, id: transactionId 
        }, 
        type: QueryTypes.UPDATE, 
        transaction 
      }
    );

    const feesRecord: any = await sequelize.query(
      `SELECT LU_fees, LH_fees FROM LoandocX_loan_processing_fees 
       WHERE from_loan_amount < :amt AND to_loan_amount >= :amt LIMIT 1`,
      { replacements: { amt: loanAmount }, type: QueryTypes.SELECT, transaction }
    );

    if (feesRecord.length > 0) {
      const { LU_fees, LH_fees } = feesRecord[0];
      const compDateOnly = new Date(legalUserCompDate).toISOString().split('T')[0];

      const [luExists]: any = await sequelize.query(
        `SELECT COUNT(1) as cnt FROM LoandocX_Daywise_Legal_user_balance 
         WHERE legal_user_id = :uid AND legal_completion_date = :cdate`,
        { replacements: { uid: legalUserId, cdate: compDateOnly }, type: QueryTypes.SELECT, transaction }
      );

      if (luExists.cnt > 0) {
        await sequelize.query(
          `UPDATE LoandocX_Daywise_Legal_user_balance SET account_balance = account_balance + :fees 
           WHERE legal_user_id = :uid AND legal_completion_date = :cdate`,
          { replacements: { fees: LU_fees, uid: legalUserId, cdate: compDateOnly }, type: QueryTypes.UPDATE, transaction }
        );
      } else {
        await sequelize.query(
          `INSERT INTO LoandocX_Daywise_Legal_user_balance (legal_user_id, legal_completion_date, account_balance, payment_done)
           VALUES (:uid, :cdate, :fees, 'N')`,
          { replacements: { uid: legalUserId, cdate: compDateOnly, fees: LU_fees }, type: QueryTypes.INSERT, transaction }
        );
      }

      const [lhExists]: any = await sequelize.query(
        `SELECT COUNT(1) as cnt FROM LoandocX_Daywise_Legal_head_balance 
         WHERE legal_head_id = :uid AND legal_completion_date = :cdate`,
        { replacements: { uid: legalHeadId, cdate: sendDate }, type: QueryTypes.SELECT, transaction }
      );

      if (lhExists.cnt > 0) {
        await sequelize.query(
          `UPDATE LoandocX_Daywise_Legal_head_balance SET account_balance = account_balance + :fees 
           WHERE legal_head_id = :uid AND legal_completion_date = :cdate`,
          { replacements: { fees: LH_fees, uid: legalHeadId, cdate: sendDate }, type: QueryTypes.UPDATE, transaction }
        );
      } else {
        await sequelize.query(
          `INSERT INTO LoandocX_Daywise_Legal_head_balance (legal_head_id, legal_completion_date, account_balance, payment_done)
           VALUES (:uid, :cdate, :fees, 'N')`,
          { replacements: { uid: legalHeadId, cdate: sendDate, fees: LH_fees }, type: QueryTypes.INSERT, transaction }
        );
      }
    }

    await transaction.commit();
    res.json({ success: true });
  } catch (err: any) {
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: err.message });
  }
});

/**
 * AGENT & COMMON LOGIC
 */
app.get('/api/agent/fetch-customer-details', async (req: any, res: any) => {
  const { query, type } = req.query;
  try {
    let customer: any = null;
    if (type === 'mobile') {
      const results: any = await sequelize.query(
        `SELECT customer_id, customer_name, loan_name, Document_Stored_path FROM LoandocX_Customers_loan_details WHERE mobile_number = :q`,
        { replacements: { q: query }, type: QueryTypes.SELECT }
      );
      customer = results[0];
    } else {
      const results: any = await sequelize.query(
        `SELECT customer_id, customer_name, loan_name, Document_Stored_path FROM LoandocX_Customers_loan_details WHERE customer_id = :q`,
        { replacements: { q: query }, type: QueryTypes.SELECT }
      );
      customer = results[0];
    }

    if (!customer) return res.status(404).json({ error: "Customer not found." });

    const checklist = await sequelize.query(
      `SELECT a.doc_name, a.doc_description 
       FROM LoandocX_loan_doc_checklist a, LoandocX_loan_types b
       WHERE a.loan_id = b.loan_id 
       AND b.loan_name = :ln 
       AND b.loan_active = 'Y'`,
      { replacements: { ln: customer.loan_name }, type: QueryTypes.SELECT }
    );

    res.json({ customer, checklist });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agent/upload-single-doc', async (req: any, res: any) => {
  const { customerId, docName, pdfData } = req.body;
  try {
    const cust: any = await sequelize.query(
      `SELECT Document_Stored_path FROM LoandocX_Customers_loan_details WHERE customer_id = :id`,
      { replacements: { id: customerId }, type: QueryTypes.SELECT }
    );
    if (!cust || cust.length === 0) return res.status(404).json({ success: false, message: "Customer not found." });

    const relPath = cust[0].Document_Stored_path;
    const absPath = path.join((process as any).cwd(), relPath);

    if (!fs.existsSync(absPath)) fs.mkdirSync(absPath, { recursive: true });

    const sanitizedPrefix = docName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    const files = fs.readdirSync(absPath);
    let maxPage = 0;
    files.forEach(file => {
      if (file.startsWith(sanitizedPrefix) && file.endsWith('.pdf')) {
        const match = file.match(/_page(\d+)\.pdf$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxPage) maxPage = num;
        } else if (file === `${sanitizedPrefix}.pdf`) {
          if (maxPage === 0) maxPage = 1;
        }
      }
    });

    const nextPage = maxPage + 1;
    const newFileName = `${sanitizedPrefix}_page${nextPage}.pdf`;
    const fullFilePath = path.join(absPath, newFileName);

    const base64Data = pdfData.split(';base64,').pop();
    fs.writeFileSync(fullFilePath, base64Data as string, { encoding: 'base64' });

    res.json({ success: true, fileName: newFileName });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/agent/change-password', async (req: any, res: any) => {
  const { userId, userType, newPassword } = req.body;
  try {
    await sequelize.query(
      `UPDATE LoandocX_Users_profile SET user_pwd = :pwd WHERE user_id = :id AND user_type = :type`,
      { replacements: { pwd: newPassword, id: userId, type: userType }, type: QueryTypes.UPDATE }
    );
    res.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/earnings/balance/:userId/:userType', async (req: any, res: any) => {
  try {
    const { userId, userType } = req.params;
    let query = '';
    let replacements: any = { id: userId };

    switch (userType) {
      case 'AT':
        query = `SELECT SUM(account_balance) as balance FROM LoandocX_Daywise_Agent_balance WHERE agent_id = :id AND payment_done = 'N'`;
        break;
      case 'LU':
        query = `SELECT SUM(account_balance) as balance FROM LoandocX_Daywise_Legal_user_balance WHERE legal_user_id = :id AND payment_done = 'N'`;
        break;
      case 'LH':
        query = `SELECT SUM(account_balance) as balance FROM LoandocX_Daywise_Legal_head_balance WHERE legal_head_id = :id AND payment_done = 'N'`;
        break;
      case 'CU':
        query = `SELECT SUM(account_balance) as balance FROM LoandocX_Daywise_Civil_user_balance WHERE civil_user_id = :id AND payment_done = 'N'`;
        break;
      default:
        return res.status(400).json({ error: "Invalid user type for earnings calculation." });
    }

    const result: any = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    res.json({ balance: result[0]?.balance || 0 });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/loans/types', async (req: any, res: any) => {
  try {
    const types = await sequelize.query(
      "SELECT loan_id, loan_name FROM LoandocX_loan_types WHERE loan_active = 'Y'", 
      { type: QueryTypes.SELECT }
    );
    res.json(types);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/loans/fees/:amount', async (req: any, res: any) => {
  try {
    const amount = parseFloat(req.params.amount);
    const fees: any = await sequelize.query(
      `SELECT processing_fees FROM LoandocX_loan_processing_fees 
       WHERE from_loan_amount < :amt AND to_loan_amount >= :amt LIMIT 1`,
      { replacements: { amt: amount }, type: QueryTypes.SELECT }
    );
    res.json({ processing_fees: fees[0]?.processing_fees || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/loans/checklist/:loanId', async (req: any, res: any) => {
  try {
    const docs = await sequelize.query(
      "SELECT doc_name, doc_description FROM LoandocX_loan_doc_checklist WHERE loan_id = :id", 
      { replacements: { id: req.params.loanId }, type: QueryTypes.SELECT }
    );
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/loans/submit', async (req: any, res: any) => {
  const t = await sequelize.transaction();
  try {
    const { customer, loanDetails, agentId, documents } = req.body;
    const [custId]: any = await sequelize.query(
      `INSERT INTO LoandocX_Customers_loan_details (customer_name, loan_name, upi_id, address1, address2, mobile_number, email_id, aadhar_number, pan_card_number, loan_amount, processing_fees, amount_recived, agent_id, creation_date, Loan_bank_name, Loan_branch_name, Loan_branch_address1, Loan_branch_address2, Loan_branch_mailid)
       VALUES (:name, :loan, :upi, :a1, :a2, :mobile, :email, :aadhar, :pan, :amt, :fee, :rec, :aid, NOW(), :bnk, :brn, :ba1, :ba2, :bml)`,
      { 
        replacements: { 
          name: customer.name, loan: loanDetails.loan_name, upi: customer.upi, a1: customer.a1, a2: customer.a2, 
          mobile: customer.mobile, email: customer.email, aadhar: customer.aadhar, pan: customer.pan,
          amt: loanDetails.amt, fee: loanDetails.fee, rec: loanDetails.received, aid: agentId,
          bnk: loanDetails.bnk, brn: loanDetails.brn, ba1: loanDetails.ba1, ba2: loanDetails.ba2, bml: loanDetails.bml
        }, 
        type: QueryTypes.INSERT, transaction: t 
      }
    );

    const [tranId]: any = await sequelize.query(
      `INSERT INTO LoandocX_Transactions (loan_name, customer_id, agent_id, trans_creation_date, transaction_state)
       VALUES (:loan, :cid, :aid, NOW(), 'P')`,
      { replacements: { loan: loanDetails.loan_name, cid: custId, aid: agentId }, type: QueryTypes.INSERT, transaction: t }
    );

    const folderPath = path.join(uploadRootDir, tranId.toString());
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    for (const [docName, docData] of Object.entries(documents) as any) {
      const sanitizedName = docName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const base64Data = docData.data.split(';base64,').pop();
      const filePath = path.join(folderPath, `${sanitizedName}.pdf`);
      fs.writeFileSync(filePath, base64Data as string, { encoding: 'base64' });
    }

    const documentPath = `/uploads/${tranId}/`;
    await sequelize.query(
      `UPDATE LoandocX_Customers_loan_details SET transaction_id = :tid, Document_Stored_path = :path WHERE customer_id = :cid`,
      { replacements: { tid: tranId, path: documentPath, cid: custId }, type: QueryTypes.UPDATE, transaction: t }
    );

    await t.commit();
    res.json({ success: true, transactionId: tranId, customerId: custId });
  } catch (error: any) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/loans/track/:query', async (req: any, res: any) => {
  const { query } = req.params;
  const { type } = req.query; 
  try {
    let transactionId: any = null;
    if (type === 'mobile') {
      const custRecord: any = await sequelize.query(
        `SELECT transaction_id FROM LoandocX_Customers_loan_details WHERE mobile_number = :mobile`,
        { replacements: { mobile: query }, type: QueryTypes.SELECT }
      );
      if (!custRecord || custRecord.length === 0) return res.status(404).json({ error: "Invalid mobile number" });
      transactionId = custRecord[0].transaction_id;
    } else {
      transactionId = query;
    }
    const txnRecord: any = await sequelize.query(
      `SELECT t.transaction_id, t.transaction_state, t.legal_team_job_completion_date, 
              t.civil_team_job_completion_date, t.legal_head_job_completion_date, 
              c.customer_name, c.loan_name, t.trans_creation_date
       FROM LoandocX_Transactions t
       LEFT JOIN LoandocX_Customers_loan_details c ON t.transaction_id = c.transaction_id
       WHERE t.transaction_id = :tid`,
      { replacements: { tid: transactionId }, type: QueryTypes.SELECT }
    );
    if (!txnRecord || txnRecord.length === 0) {
      return res.status(404).json({ error: type === 'mobile' ? "Invalid mobile number" : "Invalid transaction id" });
    }
    res.json(txnRecord[0]);
  } catch (error: any) {
    res.status(500).json({ error: "System tracking error" });
  }
});

app.listen(3000, () => {
  console.log('✓ LoanDocX Backend running on http://localhost:3000');
});
