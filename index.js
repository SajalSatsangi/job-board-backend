require("dotenv").config({ path: "./.env" });
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection using DATABASE_URL directly
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("railway")
    ? false // No SSL needed inside Railway internal network
    : { rejectUnauthorized: false }, // Needed when external (e.g., Render)
});

app.get("/", (req, res) => {
  res.send("🔧 Backend is running!");
});

app.get("/api/jobs", async (req, res) => {
  try {
    const { q, location, page = 1, limit = 361 } = req.query;
    const offset = (page - 1) * limit;
    const values = [];
    const whereClauses = [];

    if (q) {
      values.push(q);
      whereClauses.push(
        `document_with_weights @@ websearch_to_tsquery($${values.length})`
      );
    }

    if (location) {
      values.push(`%${location}%`);
      whereClauses.push(`job_location ILIKE $${values.length}`);
    }

    const where = whereClauses.length
      ? "WHERE " + whereClauses.join(" AND ")
      : "";

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM jobs ${where}`,
      values
    );

    const jobsRes = await pool.query(
      `SELECT id, job_title, company_name, job_location, apply_link, job_description AS description, source
       FROM jobs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    res.json({
      total: parseInt(countRes.rows[0].count, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      jobs: jobsRes.rows,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
